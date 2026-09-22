import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveModelLogo } from "@/lib/site-data";
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

  // WhatsApp do tenant: campo whatsapp de site_settings.data (mesma coluna
  // que o painel/meu-site salva via /api/site).
  const { data: site } = await admin
    .from("site_settings")
    .select("data")
    .eq("tenant_id", t.tenant_id)
    .maybeSingle();
  const siteData = (site?.data || {}) as Record<string, unknown>;
  const whatsappRaw = (siteData.whatsapp as string | undefined) || (siteData._contactWhatsapp as string | undefined);
  const whatsappDigits = (whatsappRaw || "").replace(/\D+/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Vi um produto no catálogo e gostaria de mais informações.`)}`
    : null;

  // Identidade do cabeçalho: mesma resolução do site (/[slug]) —
  // o conteúdo da seção "Cabeçalho/Menu" do editor (tenant_sections) tem
  // prioridade, com fallback para "Logo do site" de painel/meu-site.
  const { data: headerSection } = await admin
    .from("site_sections")
    .select("id")
    .eq("type", "header")
    .maybeSingle();
  let headerContent: Record<string, unknown> = {};
  if (headerSection) {
    const { data: headerOverride } = await admin
      .from("tenant_sections")
      .select("content")
      .eq("tenant_id", t.tenant_id)
      .eq("section_id", (headerSection as { id: string }).id)
      .maybeSingle();
    headerContent = ((headerOverride as { content?: Record<string, unknown> } | null)?.content || {}) as Record<string, unknown>;
  }
  const logo = resolveModelLogo(
    headerContent,
    siteData,
    t.profile_name || t.site_name || "Consultora"
  );
  const initialMessage = searchParams?.msg ? decodeURIComponent(String(searchParams.msg)) : null;

  return (
    <CatalogClient
      slug={t.slug}
      profileName={t.profile_name || t.site_name || "Consultora"}
      logo={logo}
      products={(products as never) || []}
      whatsappLink={whatsappLink}
      initialMessage={initialMessage}
    />
  );
}
