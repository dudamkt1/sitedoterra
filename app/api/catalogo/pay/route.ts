import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGateways } from "@/lib/gateway-config";
import { MERCADOPAGO_API, type MpPayment } from "@/lib/mercadopago";

export const runtime = "nodejs";

function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function cleanMpError(message: string): string {
  let detail = message.slice(0, 500);
  try {
    const parsed = JSON.parse(message) as { message?: unknown; error?: unknown; cause?: unknown };
    const msg = String(
      parsed?.message || (Array.isArray(parsed?.cause) ? parsed.cause[0] : parsed?.cause) || parsed?.error || ""
    ).trim();
    if (msg) detail = msg.slice(0, 300);
  } catch {
    // texto não-JSON: tenta extrair "message"
    const m = message.match(/"message"\s*:\s*"([^"]{4,200})"/);
    if (m) detail = m[1];
  }
  return detail
    .replace(/Mercado Pago API[^\:]*:\s*/i, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim()
    .slice(0, 300);
}

/**
 * POST /api/catalogo/pay — checkout TRANSPARENTE (sem sair do site).
 * Recebe o formData do Payment Brick (cartão tokenizado) e processa via
 * Payments API com o token do dono do catálogo (fallback: global).
 * O VALOR é sempre recalculado no servidor a partir do produto × quantidade.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();

  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || "").toLowerCase();
    const productId = String(body.productId || "");
    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
    const customerNotes = typeof body.customerNotes === "string" ? body.customerNotes.trim() : "";
    const quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 1)));
    const formData = body.formData && typeof body.formData === "object" ? body.formData : null;

    if (!slug || !productId || !customerName || !formData) {
      return NextResponse.json({ error: "Dados obrigatórios faltando." }, { status: 400 });
    }
    if (!isValidEmail(customerEmail)) {
      return NextResponse.json({ error: "Informe um e-mail válido para pagar com cartão." }, { status: 400 });
    }

    const { data: tenant } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
    const t = (Array.isArray(tenant) ? tenant[0] : tenant) as {
      tenant_id: string;
      site_status: string;
    } | null;
    if (!t || t.site_status !== "active") {
      return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 });
    }

    const { data: product } = await admin
      .from("crm_products")
      .select("id, name, price_cents, active, show_publicly, tenant_id")
      .eq("id", productId)
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();
    if (!product || !product.active || !product.show_publicly) {
      return NextResponse.json({ error: "Produto não disponível." }, { status: 404 });
    }

    const { data: settings } = await admin
      .from("catalog_payment_settings")
      .select("*")
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();
    if (!settings || !settings.mp_enabled) {
      return NextResponse.json({ error: "Pagamento com cartão indisponível." }, { status: 400 });
    }

    const gateways = await resolveGateways();
    const mpToken =
      (settings as Record<string, unknown>).mp_access_token || gateways.mercadopago.accessToken;
    if (!mpToken) {
      return NextResponse.json({ error: "Mercado Pago não configurado para este catálogo." }, { status: 400 });
    }

    // ---- Valida o formData do Brick ----
    const fd = formData as Record<string, unknown>;
    const token = typeof fd.token === "string" && fd.token.trim() ? fd.token.trim() : null;
    const paymentMethodId =
      typeof fd.payment_method_id === "string" && fd.payment_method_id.trim()
        ? fd.payment_method_id.trim()
        : null;
    if (!token || !paymentMethodId) {
      return NextResponse.json({ error: "Dados do cartão incompletos. Preencha novamente." }, { status: 400 });
    }
    if (paymentMethodId === "pix") {
      return NextResponse.json({ error: "Use a aba PIX para pagar com PIX." }, { status: 400 });
    }
    const maxInstallments = Math.max(1, Math.min(12, Number(settings.mp_installments) || 1));
    const installments = Math.max(1, Math.min(maxInstallments, Math.floor(Number(fd.installments) || 1)));
    const issuerId = fd.issuer_id !== undefined && fd.issuer_id !== null && String(fd.issuer_id) !== ""
      ? fd.issuer_id
      : undefined;
    const payer = (fd.payer && typeof fd.payer === "object" ? fd.payer : {}) as Record<string, unknown>;
    const identification = (payer.identification && typeof payer.identification === "object"
      ? payer.identification
      : {}) as Record<string, unknown>;
    const idNumber = typeof identification.number === "string" ? identification.number.trim() : "";
    const idType = typeof identification.type === "string" && identification.type.trim()
      ? identification.type.trim()
      : "CPF";
    const payerEmail = isValidEmail(payer.email) ? String(payer.email).trim() : customerEmail;

    // ---- Valor: fonte de verdade = banco (produto × quantidade, sem desconto PIX no cartão) ----
    const unitCents = Number(product.price_cents) || 0;
    if (unitCents <= 0) {
      return NextResponse.json({ error: "Produto com preço inválido." }, { status: 400 });
    }
    const totalCents = unitCents * quantity;
    const amount = Math.round(totalCents) / 100;

    // ---- Cria o pedido (pendente) ----
    const { data: order, error: oErr } = await admin
      .from("catalog_orders")
      .insert({
        tenant_id: t.tenant_id,
        product_id: productId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        customer_notes: customerNotes || null,
        payment_method: "mercadopago",
        payment_status: "pending",
        original_price_cents: unitCents,
        discount_percent: 0,
        discount_cents: 0,
        final_price_cents: unitCents,
        quantity,
        metadata: { product_name: product.name, transparent: true },
      })
      .select("id")
      .single();
    if (oErr || !order) {
      return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 });
    }
    const orderId = (order as { id: string }).id;

    // ---- Cobra no Mercado Pago (conta do dono do catálogo) ----
    const [firstName, ...rest] = customerName.split(/\s+/).filter(Boolean);
    const mpRes = await fetch(`${MERCADOPAGO_API}/v1/payments`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpToken}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Catálogo: ${String(product.name).slice(0, 120)}`,
        payment_method_id: paymentMethodId,
        token,
        installments,
        ...(issuerId !== undefined ? { issuer_id: issuerId } : {}),
        payer: {
          email: payerEmail,
          first_name: firstName || undefined,
          last_name: rest.length > 0 ? rest.join(" ") : undefined,
          ...(idNumber ? { identification: { type: idType, number: idNumber } } : {}),
        },
        external_reference: `CATALOG-${orderId}`,
        metadata: { catalog_order: true, order_id: orderId, tenant_id: t.tenant_id, product_id: productId },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.topconsultores.com.br"}/api/webhooks/mercadopago`,
        statement_descriptor: "SITE DOTERRA",
        capture: true,
      }),
    });

    if (!mpRes.ok) {
      const text = await mpRes.text();
      await admin.from("catalog_orders").update({ payment_status: "failed" }).eq("id", orderId);
      return NextResponse.json(
        { error: cleanMpError(text) || "Pagamento não aprovado. Confira os dados do cartão.", orderId },
        { status: 502 }
      );
    }

    const payment = (await mpRes.json()) as MpPayment;
    const status = String(payment.status || "");

    if (status === "approved") {
      await admin
        .from("catalog_orders")
        .update({ payment_id: String(payment.id), payment_status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderId);
      await admin.rpc("create_crm_sale_from_catalog_order", { p_order_id: orderId });
    } else if (["pending", "in_process", "in_mediation", "authorized"].includes(status)) {
      await admin
        .from("catalog_orders")
        .update({ payment_id: String(payment.id), payment_status: "pending" })
        .eq("id", orderId);
    } else {
      await admin
        .from("catalog_orders")
        .update({ payment_id: String(payment.id), payment_status: "failed" })
        .eq("id", orderId);
    }

    return NextResponse.json({
      orderId,
      status,
      statusDetail: payment.status_detail || null,
      paymentId: payment.id,
    });
  } catch (e) {
    console.error("[catalog] erro em /pay:", e);
    return NextResponse.json({ error: "Erro interno ao processar pagamento." }, { status: 500 });
  }
}
