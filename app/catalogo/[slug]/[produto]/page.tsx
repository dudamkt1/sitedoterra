import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PublicProductClient from "./PublicProductClient";

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

  const { data: site } = await admin
    .from("site_settings")
    .select("site_data")
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();
  const siteData = (site?.site_data || {}) as Record<string, unknown>;
  const whatsappRaw = (siteData.whatsapp as string | undefined) || (siteData._contactWhatsapp as string | undefined);
  const whatsappDigits = (whatsappRaw || "").replace(/\D+/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Tenho interesse no produto "${product.name}".`)}`
    : null;

  return (
    <PublicProductClient
      slug={t.slug}
      profileName={t.profile_name || t.site_name || "Consultora"}
      product={product as never}
      whatsappLink={whatsappLink}
    />
  );
}
