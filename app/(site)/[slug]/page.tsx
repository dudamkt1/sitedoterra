import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { TenantSite } from "@/components/site/TenantSite";
import { SuspendedSitePage } from "@/components/site/SuspendedSitePage";
import { resolveTenantAccess } from "@/lib/tenant";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { tenant } = await resolveTenantAccess({ slug: params.slug });
  if (!tenant) return { title: "Site não encontrado" };
  const name = tenant.profile_name || tenant.site_name || tenant.slug;
  return {
    title: `${name} | Consultora doTERRA`,
    description: `Site oficial de ${name} — consultora doTERRA. Óleos essenciais puros, dicas de bem-estar e agendamento de consultas.`,
  };
}

export default async function TenantSitePage({ params }: { params: { slug: string } }) {
  const { tenant, access } = await resolveTenantAccess({ slug: params.slug });

  if (!tenant) {
    notFound();
  }

  const headerList = headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const protocol = headerList.get("x-forwarded-proto") || "https";
  const canonicalUrl =
    host.endsWith(".vercel.app") || !host
      ? `${process.env.NEXT_PUBLIC_APP_URL || `https://${host}`}/${tenant.slug}`
      : `https://${host}`;

  if (access === "available") {
    return (
      <>
        <link rel="canonical" href={canonicalUrl} />
        <TenantSite tenant={tenant} />
      </>
    );
  }

  return (
    <>
      <link rel="canonical" href={canonicalUrl} />
      <SuspendedSitePage tenant={tenant} host={host} />
    </>
  );
}
