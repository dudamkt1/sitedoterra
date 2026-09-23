import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import { isOfficialHomeTenantById } from "@/lib/site-official";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getRaffleSettings,
  getRoundEntries,
} from "@/lib/crm-raffle";
import { RAFFLE_PRIZE_LABELS, RAFFLE_SAMPLE, firstNameOf, formatBRL } from "@/lib/loyalty-raffle";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";
import "@/app/(site)/site.css";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return { title: `Sorteio por Fidelidade | ${params.slug}` };
}

export default async function RafflePage({ params }: { params: { slug: string } }) {
  const tenant = await getPublicTenantBySlug(params.slug);
  if (!tenant) notFound();
  const admin = createAdminClient();
  const settings = await getRaffleSettings(admin, tenant.tenant_id).catch(() => null);

  // Vitrine no site oficial: sem config, mostra exemplo fictício (nada real).
  const isOfficial = await isOfficialHomeTenantById(tenant.tenant_id).catch(() => false);
  const sampleMode = !settings?.enabled && isOfficial;

  if (!settings?.enabled && !sampleMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f2] px-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">O sorteio por fidelidade não está ativo neste site.</p>
          <Link
            href={`/${tenant.slug}#sorteio`}
            className="btn btn-primary mt-4 inline-block"
          >
            ← Voltar pro site
          </Link>
        </div>
      </div>
    );
  }

  const siteData = (tenant.site_data || {}) as Record<string, unknown>;
  const profileName = tenant.profile_name || tenant.site_name || tenant.slug;
  const ownerName =
    (siteData.fullName as string) ||
    ([siteData.name, siteData.surname].filter(Boolean).join(" ") as string) ||
    undefined;
  const whatsapp = (siteData.whatsapp as string) || undefined;
  const email = (siteData.email as string) || tenant.email || undefined;
  const instagram = siteData.instagram
    ? `https://instagram.com/${String(siteData.instagram).replace(/^@/, "")}`
    : undefined;
  const navItems = [
    { label: "Início", href: `/${tenant.slug}` },
    { label: "Sorteio", href: "#topo" },
  ];

  let snap = {
    amount_per_number_cents: RAFFLE_SAMPLE.amount_per_number_cents,
    total_numbers: RAFFLE_SAMPLE.total_numbers,
    prize_type: RAFFLE_SAMPLE.prize_type,
    prize_description: RAFFLE_SAMPLE.prize_description,
    prize_credit_amount_cents: RAFFLE_SAMPLE.prize_credit_amount_cents,
  };
  let taken = new Map<number, string>(
    RAFFLE_SAMPLE.numbers.map((n) => [n.number, n.name])
  );
  let history: {
    id: string;
    winner_name: string | null;
    winner_number: number | null;
    prize: string;
    prize_type: string;
    drawn_at: string | null;
    seed: string | null;
  }[] = RAFFLE_SAMPLE.winners.map((w, i) => ({
    id: `sample-${i}`,
    winner_name: w.name,
    winner_number: w.number,
    prize: w.prize,
    prize_type: w.prize_type,
    drawn_at: w.drawn_at,
    seed: w.seed,
  }));

  if (!sampleMode && settings?.enabled) {
    const round = await ensureCurrentRound(admin, tenant.tenant_id, settings);
    const [entries, drawn] = await Promise.all([
      getRoundEntries(admin, tenant.tenant_id, round.id),
      getDrawnRounds(admin, tenant.tenant_id, 5),
    ]);
    snap = {
      amount_per_number_cents: round.settings_snapshot.amount_per_number_cents,
      total_numbers: round.settings_snapshot.total_numbers,
      prize_type: round.settings_snapshot.prize_type,
      prize_description: round.settings_snapshot.prize_description,
      prize_credit_amount_cents: round.settings_snapshot.prize_credit_amount_cents,
    };
    taken = new Map(entries.map((e) => [e.chosen_number, firstNameOf(e.client_name || "")]));
    history = drawn.map((h) => ({
      id: h.id,
      winner_name: h.winner_name,
      winner_number: h.winner_number,
      prize: h.settings_snapshot.prize_description,
      prize_type: h.settings_snapshot.prize_type,
      drawn_at: h.drawn_at,
      seed: h.random_seed,
    }));
  }

  const total = snap.total_numbers;
  const missing = Math.max(0, total - taken.size);
  const prizeLabel = RAFFLE_PRIZE_LABELS[snap.prize_type as keyof typeof RAFFLE_PRIZE_LABELS] || snap.prize_type;
  const backHref = `/${tenant.slug}#sorteio`;

  return (
    <div id="tenant-site" data-slug={tenant.slug} className="min-h-screen bg-[#faf8f2]">
      <Header
        logoText={profileName}
        navItems={navItems}
        extraNav={[{ label: "Voltar pro site", href: backHref }]}
        logoHref={`/${tenant.slug}`}
      />

      <main id="topo" className="mx-auto max-w-3xl px-4 py-10">
        <Link href={backHref} className="btn btn-primary inline-block shadow-lg">
          ← Voltar pro site
        </Link>
        {sampleMode && (
          <p className="mt-3 inline-block ml-3 text-[11px] font-bold text-[#1d5c3a] border border-dashed border-[#1d5c3a] rounded-full px-3 py-1">
            Exemplo — veja como funciona
          </p>
        )}

        <p className="text-xs font-bold uppercase tracking-widest text-[#1d5c3a] mt-6">
          Programa de Fidelidade
        </p>
        <h1 className="text-3xl font-semibold mt-1" style={{ fontFamily: "var(--font-display)" }}>
          🎟️ Sorteio por Fidelidade
        </h1>

        <div
          className="mt-6 rounded-3xl p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #0e3b28 0%, #1d5c3a 55%, #2a7a4e 100%)",
            boxShadow: "0 24px 60px rgba(14,59,40,0.35)",
          }}
        >
          <h2 className="text-lg font-extrabold">🎁 Prêmio da rodada</h2>
          <p className="text-sm mt-1 text-white/90">
            <span className="badge badge-gold mr-2">{prizeLabel}</span>
            <strong>{snap.prize_description || "Prêmio surpresa"}</strong>
            {snap.prize_type === "credito_loja" && snap.prize_credit_amount_cents ? (
              <> · vale {formatBRL(snap.prize_credit_amount_cents)} em compras futuras</>
            ) : null}
          </p>
          <p className="text-sm text-white/85 mt-3">
            A cada {formatBRL(snap.amount_per_number_cents)} em compras confirmadas, você ganha
            1 número da sorte. Quando os {total} números forem escolhidos, sorteamos entre quem
            participou. Faltam <strong className="text-[#e8c87a]">{missing}</strong> número(s)!
          </p>
          <div className="h-3 rounded-full overflow-hidden mt-3" style={{ background: "rgba(255,255,255,0.18)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((taken.size / Math.max(1, total)) * 100))}%`,
                background: "linear-gradient(90deg, #e8c87a, #c4963a)",
              }}
            />
          </div>
          <p className="text-xs text-white/80 mt-1">
            {taken.size} de {total} números já escolhidos
          </p>
        </div>

        <div className="card mt-6">
          <h2 className="card-title mb-3">Números da rodada</h2>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
              const who = taken.get(n);
              return (
                <div
                  key={n}
                  title={who ? `Escolhido por ${who}` : "Disponível"}
                  className={`rounded-lg border px-1 py-2 text-center ${
                    who ? "bg-[#1d5c3a] text-white border-[#1d5c3a]" : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  <p className="text-sm font-bold leading-none">{n}</p>
                  <p className="text-[10px] leading-tight mt-0.5 truncate">{who || "livre"}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Fez uma compra? Fale com a consultora para escolher seu número entre os disponíveis.
          </p>
        </div>

        {history.length > 0 && (
          <div className="card mt-6">
            <h2 className="card-title mb-3">🏆 Últimos ganhadores</h2>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-2 text-sm text-gray-700">
                  <span>
                    <strong>{h.winner_name || "—"}</strong> ganhou <strong>{h.prize || "o prêmio"}</strong>{" "}
                    com o número <strong>{h.winner_number}</strong>
                  </span>
                  <span className="text-xs text-gray-400">
                    · {h.drawn_at ? new Date(h.drawn_at).toLocaleDateString("pt-BR") : ""}
                    {h.seed ? ` · semente ${h.seed.slice(0, 8)}…` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              Sorteio verificável: semente pública + data registrados em cada rodada para auditoria.
            </p>
          </div>
        )}

        <div className="card mt-6">
          <h2 className="card-title mb-2">Como participar</h2>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Faça suas compras com a consultora (loja, WhatsApp ou catálogo).</li>
            <li>
              A cada {formatBRL(snap.amount_per_number_cents)} em compras confirmadas, você ganha
              1 número da sorte.
            </li>
            <li>Escolha seu número entre os disponíveis com a consultora.</li>
            <li>Quando todos os {total} números forem escolhidos (ou a consultora antecipar), ocorre o sorteio.</li>
          </ol>
        </div>

        <div className="text-center mt-8">
          <Link href={backHref} className="btn btn-primary inline-block shadow-lg !px-8 !py-3 !text-base">
            ← Voltar pro site
          </Link>
        </div>
      </main>

      <Footer
        content={{}}
        navItems={navItems}
        contactWhatsapp={whatsapp}
        contactEmail={email}
        contactInstagram={instagram}
        profileName={profileName}
        ownerName={ownerName}
        aboutDescription={(siteData.description as string) || undefined}
      />
    </div>
  );
}
