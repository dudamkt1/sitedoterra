import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { isOfficialHomeTenantById } from "@/lib/site-official";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getRaffleSettings,
  getRoundEntries,
} from "@/lib/crm-raffle";
import { firstNameOf } from "@/lib/loyalty-raffle";
import { SorteioView } from "@/components/site/SorteioView";
import "@/app/(site)/site.css";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return { title: `Sorteio por Fidelidade | ${params.slug}` };
}

export default async function RafflePage({ params }: { params: { slug: string } }) {
  const tenant = await getPublicTenantBySlug(params.slug);
  if (!tenant) notFound();

  // O site oficial usa a página da raiz (/sorteio) — sem slug na URL.
  const isOfficial = await isOfficialHomeTenantById(tenant.tenant_id).catch(() => false);
  if (isOfficial) redirect("/sorteio");

  const admin = createAdminClient();
  const settings = await getRaffleSettings(admin, tenant.tenant_id).catch(() => null);

  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const profileName = tenant.profile_name || tenant.site_name || tenant.slug;
  const backHref = `/${tenant.slug}#sorteio`;

  if (!settings?.enabled) {
    return (
      <SorteioView
        slug={tenant.slug}
        homeHref={`/${tenant.slug}`}
        backHref={backHref}
        profileName={profileName}
        ownerName={
          (siteData.fullName as string) ||
          ([siteData.name, siteData.surname].filter(Boolean).join(" ") as string) ||
          undefined
        }
        whatsapp={(siteData.whatsapp as string) || undefined}
        email={(siteData.email as string) || tenant.email || undefined}
        instagram={
          siteData.instagram
            ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
            : undefined
        }
        aboutDescription={(siteData.description as string) || undefined}
        active={false}
        sampleMode={false}
        snap={{
          amount_per_number_cents: 0,
          total_numbers: 0,
          prize_type: "brinde",
          prize_description: "",
          prize_credit_amount_cents: null,
        }}
        taken={[]}
        history={[]}
      />
    );
  }

  const round = await ensureCurrentRound(admin, tenant.tenant_id, settings);
  const [entries, drawn] = await Promise.all([
    getRoundEntries(admin, tenant.tenant_id, round.id),
    getDrawnRounds(admin, tenant.tenant_id, 5),
  ]);

  return (
    <SorteioView
      slug={tenant.slug}
      homeHref={`/${tenant.slug}`}
      backHref={backHref}
      profileName={profileName}
      ownerName={
        (siteData.fullName as string) ||
        ([siteData.name, siteData.surname].filter(Boolean).join(" ") as string) ||
        undefined
      }
      whatsapp={(siteData.whatsapp as string) || undefined}
      email={(siteData.email as string) || tenant.email || undefined}
      instagram={
        siteData.instagram
          ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
          : undefined
      }
      aboutDescription={(siteData.description as string) || undefined}
      active
      sampleMode={false}
      snap={{
        amount_per_number_cents: round.settings_snapshot.amount_per_number_cents,
        total_numbers: round.settings_snapshot.total_numbers,
        prize_type: round.settings_snapshot.prize_type,
        prize_description: round.settings_snapshot.prize_description,
        prize_credit_amount_cents: round.settings_snapshot.prize_credit_amount_cents,
      }}
      taken={entries.map((e) => ({ number: e.chosen_number, name: firstNameOf(e.client_name || "") }))}
      history={drawn.map((h) => ({
        id: h.id,
        winner_name: h.winner_name,
        winner_number: h.winner_number,
        prize: h.settings_snapshot.prize_description,
        prize_type: h.settings_snapshot.prize_type,
        drawn_at: h.drawn_at,
        seed: h.random_seed,
      }))}
    />
  );
}
