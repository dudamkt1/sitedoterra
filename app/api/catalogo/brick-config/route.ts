import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGateways } from "@/lib/gateway-config";

export const runtime = "nodejs";

/**
 * GET /api/catalogo/brick-config?slug=<slug>&productId=<uuid>
 * Config pública do checkout transparente (SEM segredos): public key do MP,
 * valores e parcelamento. O access token NUNCA sai do servidor.
 */
export async function GET(request: Request) {
  const admin = createAdminClient();
  try {
    const url = new URL(request.url);
    const slug = String(url.searchParams.get("slug") || "").toLowerCase();
    const productId = String(url.searchParams.get("productId") || "");
    if (!slug || !productId) {
      return NextResponse.json({ error: "Parâmetros obrigatórios faltando." }, { status: 400 });
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
      .select("id, name, price_cents, active, show_publicly")
      .eq("id", productId)
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();
    if (!product || !product.active || !product.show_publicly) {
      return NextResponse.json({ error: "Produto não disponível." }, { status: 404 });
    }

    const { data: settings } = await admin
      .from("catalog_payment_settings")
      .select("mp_enabled, mp_installments, mp_installments_without_interest, mp_public_key, pix_enabled, pix_discount_percent")
      .eq("tenant_id", t.tenant_id)
      .maybeSingle();
    if (!settings || !settings.mp_enabled) {
      return NextResponse.json({ error: "Pagamento com cartão indisponível." }, { status: 400 });
    }

    const gateways = await resolveGateways();
    const publicKey =
      (settings as { mp_public_key?: string | null }).mp_public_key || gateways.mercadopago.publicKey;
    if (!publicKey) {
      return NextResponse.json(
        { error: "Checkout transparente indisponível (Public Key não configurada). Use o botão do Mercado Pago." },
        { status: 400 }
      );
    }

    const maxInstallments = Math.max(1, Math.min(12, Number(settings.mp_installments) || 1));
    const rawWo = (settings as unknown as Record<string, unknown>).mp_installments_without_interest;
    const withoutInterest =
      typeof rawWo === "boolean"
        ? rawWo
          ? maxInstallments
          : 1
        : Math.max(1, Math.min(maxInstallments, Number(rawWo) || 1));

    return NextResponse.json({
      publicKey,
      productName: (product as { name: string }).name,
      priceCents: (product as { price_cents: number }).price_cents,
      maxInstallments,
      withoutInterest,
      pixEnabled: Boolean(settings.pix_enabled),
      pixDiscountPercent: Number(settings.pix_discount_percent) || 0,
    });
  } catch (e) {
    console.error("[catalog] erro em brick-config:", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
