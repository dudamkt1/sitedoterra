import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import CatalogClient from "./CatalogClient";

export const dynamic = "force-dynamic";

type SearchParams = { cliente?: string; msg?: string };

export default async function PublicCatalogPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: SearchParams;
}) {
  const slug = String(params.slug || "").toLowerCase();
  const admin = createAdminClient();
  const { data: tenant, error: tErr } = await admin.rpc("get_public_tenant_by_slug", { p_slug: slug });
  if (tErr || !tenant) notFound();
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

  const { data: products, error: pErr } = await admin
    .from("crm_products")
    .select("id, name, description, price_cents, category, image_url, unit")
    .eq("tenant_id", t.tenant_id)
    .eq("active", true)
    .eq("show_publicly", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (pErr) notFound();

  // WhatsApp do tenant: tenta o campo whatsapp do site_data (padrão já existente)
  // ou cai no email/CRM. Para manter simples, mostramos o link de WhatsApp
  // somente se houver cadastrado no site_data.
  const { data: site } = await admin
    .from("site_settings")
    .select("site_data")
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();
  const siteData = (site?.site_data || {}) as Record<string, unknown>;
  const whatsappRaw = (siteData.whatsapp as string | undefined) || (siteData._contactWhatsapp as string | undefined);
  const whatsappDigits = (whatsappRaw || "").replace(/\D+/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Vi um produto no catálogo e gostaria de mais informações.`)}`
    : null;

  const initialMessage = searchParams?.msg ? decodeURIComponent(String(searchParams.msg)) : null;

  return (
    <CatalogClient
      slug={t.slug}
      profileName={t.profile_name || t.site_name || "Consultora"}
      siteName={t.site_name}
      products={(products as never) || []}
      whatsappLink={whatsappLink}
      initialMessage={initialMessage}
    />
  );
}
