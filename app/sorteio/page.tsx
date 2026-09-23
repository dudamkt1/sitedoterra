import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOfficialHomeTenant } from "@/lib/site-official";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getRaffleSettings,
  getRoundEntries,
} from "@/lib/crm-raffle";
import { RAFFLE_SAMPLE, firstNameOf } from "@/lib/loyalty-raffle";
import { SorteioView } from "@/components/site/SorteioView";
import "@/app/(site)/site.css";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sorteio por Fidelidade | TopConsultores" };
}

/**
 * Totem do sorteio no DOMÍNIO PRINCIPAL (`/sorteio`, sem slug).
 * Usa os dados do tenant oficial quando configurado; senão, vitrine de
 * exemplo (nada real) — para futuros consultores verem como funciona.
 * O "Voltar pro site" sempre volta para `/#sorteio`.
 */
export default async function MainRafflePage() {
  const admin = createAdminClient();
  const tenant = await getOfficialHomeTenant();
  const settings = await getRaffleSettings(admin, tenant.tenant_id).catch(() => null);

  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const profileName = tenant.profile_name || tenant.site_name || "TopConsultores";
  const ownerName =
    (siteData.fullName as string) ||
    ([siteData.name, siteData.surname].filter(Boolean).join(" ") as string) ||
    undefined;
  const whatsapp = (siteData.whatsapp as string) || undefined;
  const email = (siteData.email as string) || tenant.email || undefined;
  const instagram = siteData.instagram
    ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
    : undefined;
  const aboutDescription = (siteData.description as string) || undefined;

  const base = {
    slug: tenant.slug,
    homeHref: "/",
    backHref: "/#sorteio",
    profileName,
    ownerName,
    whatsapp,
    email,
    instagram,
    aboutDescription,
  };

  if (!settings?.enabled) {
    return (
      <SorteioView
        {...base}
        active
        sampleMode
        snap={{
          amount_per_number_cents: RAFFLE_SAMPLE.amount_per_number_cents,
          total_numbers: RAFFLE_SAMPLE.total_numbers,
          prize_type: RAFFLE_SAMPLE.prize_type,
          prize_description: RAFFLE_SAMPLE.prize_description,
          prize_credit_amount_cents: RAFFLE_SAMPLE.prize_credit_amount_cents,
        }}
        taken={RAFFLE_SAMPLE.numbers.map((n) => ({ number: n.number, name: n.name }))}
        history={RAFFLE_SAMPLE.winners.map((w, i) => ({
          id: `sample-${i}`,
          winner_name: w.name,
          winner_number: w.number,
          prize: w.prize,
          prize_type: w.prize_type,
          drawn_at: w.drawn_at,
          seed: w.seed,
        }))}
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
      {...base}
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
