import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PublicProductClient from "./PublicProductClient";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const dynamic = "force-dynamic";

export default async function PublicProductPage({
  params,
}: {
  params: { slug: string; produto: string };
}) {
  const slug = String(params.slug || "").toLowerCase();
  const productId = String(params.produto || "");
  if (!productId) notFound();

  const admin = createAdminClient();
  const { data: tenant } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
  const t = (Array.isArray(tenant) ? tenant[0] : tenant) as
    | {
        tenant_id: string;
        slug: string;
        site_name: string | null;
        site_status: string;
        profile_name: string | null;
      }
    | null;
  if (!t || t.site_status !== "active") notFound();

  const { data: product, error } = await admin
    .from("crm_products")
    .select("id, name, description, price_cents, category, image_url, unit, active, show_publicly")
    .eq("id", productId)
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();
  if (error || !product || !product.active || !product.show_publicly) notFound();

  // Busca configurações de pagamento
  const { data: paymentSettings } = await admin
    .from("catalog_payment_settings")
    .select("*")
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();

  const { data: site } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();
  const siteData = (site?.data || {}) as Record<string, unknown>;
  const whatsappRaw = (siteData.whatsapp as string | undefined) || (siteData._contactWhatsapp as string | undefined);
  const whatsappDigits = (whatsappRaw || "").replace(/\D+/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Tenho interesse no produto "${product.name}" (${formatBRL(product.price_cents)}). Gostaria de mais informações e finalizar a compra.`)}`
    : null;

  // NUNCA expõe o access token ao browser: só campos públicos do checkout.
  const s = (paymentSettings || {}) as Record<string, unknown>;
  const publicSettings = {
    pix_enabled: s.pix_enabled !== false,
    pix_discount_percent: Number(s.pix_discount_percent) || 0,
    mp_enabled: s.mp_enabled === true,
    mp_installments: Math.max(1, Math.min(12, Number(s.mp_installments) || 1)),
    mp_installments_without_interest: s.mp_installments_without_interest ?? 1,
    mp_public_key: typeof s.mp_public_key === "string" ? s.mp_public_key : null,
    requires_contact_info: s.requires_contact_info !== false,
  };

  return (
    <PublicProductClient
      slug={t.slug}
      profileName={t.profile_name || t.site_name || "Consultora"}
      product={product as never}
      whatsappLink={whatsappLink}
      paymentSettings={publicSettings as any}
    />
  );
}
