import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGateways } from "@/lib/gateway-config";
import { createMercadoPagoPreference, createPixPayment } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Base para as back_urls do Mercado Pago: SEMPRE o local exato onde a compra
 * começou (mesmo domínio + página do produto), nunca o domínio canônico da
 * plataforma. Prioridade: body.returnUrl (validado) > origin > referer >
 * x-forwarded-host > env.
 */
function resolveReturnBase(request: Request, bodyReturnUrl?: unknown): string {
  const fallback = (process.env.NEXT_PUBLIC_APP_URL || "https://app.topconsultores.com.br").replace(/\/$/, "");

  // 1) returnUrl enviado pelo frontend (window.location.href da página do produto)
  if (typeof bodyReturnUrl === "string" && bodyReturnUrl.trim()) {
    try {
      const u = new URL(bodyReturnUrl.trim());
      if ((u.protocol === "https:" || u.protocol === "http:") && u.pathname.startsWith("/catalogo/")) {
        return `${u.origin}${u.pathname}`.replace(/\/$/, "");
      }
    } catch { /* ignora e tenta headers */ }
  }

  // 2) origin da requisição (fetch envia Origin)
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin.replace(/\/$/, "");
    } catch { /* ignora */ }
  }

  // 3) referer (página do produto que iniciou a compra)
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if ((u.protocol === "https:" || u.protocol === "http:") && u.pathname.startsWith("/catalogo/")) {
        return `${u.origin}${u.pathname}`.replace(/\/$/, "");
      }
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin.replace(/\/$/, "");
    } catch { /* ignora */ }
  }

  // 4) host encaminhado (proxy/Vercel) — preserva o domínio que o cliente usou
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }

  return fallback;
}

/** POST /api/catalogo/orders — cria um pedido do catálogo público. */
export async function POST(request: Request) {
  const admin = createAdminClient();

  try {
    const body = await request.json();
    const { slug, productId, customerName, customerEmail, customerPhone, customerNotes, paymentMethod, quantity = 1, returnUrl } = body;

    if (!slug || !productId || !customerName || !paymentMethod) {
      return NextResponse.json({ error: "Dados obrigatórios faltando." }, { status: 400 });
    }

    // Busca tenant pelo slug
    const { data: tenant } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug.toLowerCase() });
    const t = (Array.isArray(tenant) ? tenant[0] : tenant) as { tenant_id: string; slug: string; site_name: string | null; site_status: string; profile_name: string | null } | null;
    if (!t || t.site_status !== "active") {
      return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 });
    }

    // Busca o produto
    const { data: product, error: pErr } = await admin
      .from("crm_products")
      .select("id, name, description, price_cents, category, image_url, unit, active, show_publicly, tenant_id, user_id")
      .eq("id", productId)
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();

    if (pErr || !product || !product.active || !product.show_publicly) {
      return NextResponse.json({ error: "Produto não disponível." }, { status: 404 });
    }

    // Busca configurações de pagamento
    const { data: paymentSettings } = await admin
      .from("catalog_payment_settings")
      .select("*")
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();

    const settings = paymentSettings || {
      pix_enabled: true,
      pix_discount_percent: 0,
      mp_enabled: false,
      mp_installments: 1,
      mp_installments_without_interest: 1,
      requires_contact_info: true,
    };

    // Valida método de pagamento
    if (paymentMethod === "pix" && !settings.pix_enabled) {
      return NextResponse.json({ error: "PIX não está habilitado para este catálogo." }, { status: 400 });
    }
    if (paymentMethod === "mercadopago" && !settings.mp_enabled) {
      return NextResponse.json({ error: "Mercado Pago não está habilitado para este catálogo." }, { status: 400 });
    }

    // Calcula valores
    const originalPriceCents = product.price_cents;
    let discountPercent = 0;
    let discountCents = 0;
    let finalPriceCents = originalPriceCents;

    if (paymentMethod === "pix" && settings.pix_discount_percent > 0) {
      discountPercent = settings.pix_discount_percent;
      discountCents = Math.round(originalPriceCents * (discountPercent / 100));
      finalPriceCents = originalPriceCents - discountCents;
    }

    const totalFinalCents = finalPriceCents * quantity;

    // Cria o pedido
    const { data: order, error: oErr } = await admin
      .from("catalog_orders")
      .insert({
        tenant_id: t.tenant_id,
        product_id: productId,
        customer_name: customerName.trim(),
        customer_email: customerEmail?.trim() || null,
        customer_phone: customerPhone?.trim() || null,
        customer_notes: customerNotes?.trim() || null,
        payment_method: paymentMethod,
        payment_status: "pending",
        original_price_cents: originalPriceCents,
        discount_percent: discountPercent,
        discount_cents: discountCents * quantity,
        final_price_cents: finalPriceCents,
        quantity: quantity,
        metadata: { product_name: product.name },
      })
      .select()
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 });
    }

    // Token MP: prefere a conta do dono do catálogo, cai para a global da plataforma
    const tenantMpToken = (settings as Record<string, unknown>).mp_access_token as string | null;
    const gateways = await resolveGateways();
    const mpToken = tenantMpToken || gateways.mercadopago.accessToken;

    // Processa pagamento conforme método
    if (paymentMethod === "pix") {
      // Gera PIX via Mercado Pago (mesmo gateway)
      if (!mpToken) {
        return NextResponse.json({ error: "Mercado Pago não configurado. O dono do catálogo precisa vincular a conta em Catálogo → Config. Pagamento." }, { status: 400 });
      }
      try {
        const pixData = await createPixPayment({
          accessToken: mpToken,
          amount: totalFinalCents / 100,
          description: `Pedido catálogo: ${product.name}`,
          payerEmail: customerEmail || "cliente@catalogo.com",
          payerName: customerName,
          externalReference: `CATALOG-${order.id}`,
          notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.topconsultores.com.br"}/api/webhooks/mercadopago`,
        });

        // Atualiza pedido com QR Code
        await admin
          .from("catalog_orders")
          .update({
            payment_id: pixData.id,
            payment_qr_code: pixData.qrCode,
            payment_qr_code_text: pixData.qrCodeBase64,
          })
          .eq("id", order.id);

        return NextResponse.json({
          order: { ...order, payment_id: pixData.id, payment_qr_code: pixData.qrCode, payment_qr_code_text: pixData.qrCodeBase64 },
          pix: { qrCode: pixData.qrCode, qrCodeBase64: pixData.qrCodeBase64, expiresAt: pixData.expiresAt },
        });
      } catch (e) {
        console.error("[catalog] erro ao criar PIX:", e);
        return NextResponse.json({ error: "Erro ao gerar QR Code PIX. Tente novamente." }, { status: 500 });
      }
    } else if (paymentMethod === "mercadopago") {
      // Cria preferência Mercado Pago
      if (!mpToken) {
        return NextResponse.json({ error: "Mercado Pago não configurado. O dono do catálogo precisa vincular a conta em Catálogo → Config. Pagamento." }, { status: 400 });
      }
      try {
        // Volta SEMPRE para a página exata do produto que iniciou a compra
        // (mesmo domínio + /catalogo/<slug>/<produto>), com status na query.
        const returnBase = resolveReturnBase(request, returnUrl);
        const productBase = returnBase.includes("/catalogo/")
          ? returnBase
          : `${returnBase}/catalogo/${slug}/${productId}`;
        const sep = productBase.includes("?") ? "&" : "?";
        const preference = await createMercadoPagoPreference({
          accessToken: mpToken,
          items: [{
            id: productId,
            title: product.name,
            quantity: quantity,
            unit_price: totalFinalCents / 100,
            currency_id: "BRL",
          }],
          payer: customerEmail ? { email: customerEmail } : undefined,
          externalReference: `CATALOG-${order.id}`,
          notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.topconsultores.com.br"}/api/webhooks/mercadopago`,
          backUrls: {
            success: `${productBase}${sep}order_id=${order.id}&mp=success`,
            failure: `${productBase}${sep}order_id=${order.id}&mp=failure`,
            pending: `${productBase}${sep}order_id=${order.id}&mp=pending`,
          },
        });

        await admin
          .from("catalog_orders")
          .update({ payment_id: preference.id })
          .eq("id", order.id);

        return NextResponse.json({
          order: { ...order, payment_id: preference.id },
          mercadoPago: { preferenceId: preference.id, initPoint: preference.init_point },
        });
      } catch (e) {
        console.error("[catalog] erro ao criar preferência MP:", e);
        return NextResponse.json({ error: "Erro ao criar pagamento Mercado Pago. Tente novamente." }, { status: 500 });
      }
    }

    // Para pagamento manual
    return NextResponse.json({ order });
  } catch (e) {
    console.error("[catalog] erro ao criar pedido:", e);
    return NextResponse.json({ error: "Erro interno ao processar pedido." }, { status: 500 });
  }
}