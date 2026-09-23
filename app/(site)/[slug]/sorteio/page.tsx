import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicTenantBySlug } from "@/lib/tenant";
import {
  ensureCurrentRound,
  getDrawnRounds,
  getRaffleSettings,
  getRoundEntries,
} from "@/lib/crm-raffle";
import { RAFFLE_PRIZE_LABELS, firstNameOf, formatBRL } from "@/lib/loyalty-raffle";
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
  if (!settings?.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f2] px-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">O sorteio por fidelidade não está ativo neste site.</p>
          <Link href={`/${tenant.slug}`} className="text-[#1d5c3a] underline text-sm">
            Voltar ao site
          </Link>
        </div>
      </div>
    );
  }

  const round = await ensureCurrentRound(admin, tenant.tenant_id, settings);
  const [entries, history] = await Promise.all([
    getRoundEntries(admin, tenant.tenant_id, round.id),
    getDrawnRounds(admin, tenant.tenant_id, 5),
  ]);
  const snap = round.settings_snapshot;
  const total = snap.total_numbers;
  const taken = new Map(entries.map((e) => [e.chosen_number, firstNameOf(e.client_name || "")]));
  const missing = Math.max(0, total - entries.length);
  const prizeLabel = RAFFLE_PRIZE_LABELS[snap.prize_type] || snap.prize_type;

  return (
    <div className="min-h-screen bg-[#faf8f2]">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/${tenant.slug}`} className="text-xs text-[#1d5c3a] underline">
          ← Voltar ao site
        </Link>
        <p className="text-xs font-bold uppercase tracking-widest text-[#1d5c3a] mt-4">
          Programa de Fidelidade
        </p>
        <h1 className="text-3xl font-semibold mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Sorteio por Fidelidade
        </h1>

        <div className="card mt-6">
          <h2 className="card-title mb-1">🎁 Prêmio da rodada</h2>
          <p className="text-sm text-gray-600">
            <span className="badge badge-gold mr-2">{prizeLabel}</span>
            <strong>{snap.prize_description || "Prêmio surpresa"}</strong>
            {snap.prize_type === "credito_loja" && snap.prize_credit_amount_cents ? (
              <> · vale {formatBRL(snap.prize_credit_amount_cents)} em compras futuras</>
            ) : null}
          </p>
          <p className="text-sm text-gray-500 mt-3">
            A cada {formatBRL(snap.amount_per_number_cents)} em compras confirmadas, você ganha
            1 número da sorte. Quando os {total} números forem escolhidos, sorteamos entre quem
            participou. Faltam <strong>{missing}</strong> número(s)!
          </p>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-[#1d5c3a]"
              style={{ width: `${Math.min(100, Math.round((entries.length / Math.max(1, total)) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {entries.length} de {total} números já escolhidos
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
                    <strong>{h.winner_name || "—"}</strong> ganhou <strong>{h.settings_snapshot.prize_description || "o prêmio"}</strong>{" "}
                    com o número <strong>{h.winner_number}</strong>
                  </span>
                  <span className="text-xs text-gray-400">
                    · {h.drawn_at ? new Date(h.drawn_at).toLocaleDateString("pt-BR") : ""}
                    {h.random_seed ? ` · semente ${h.random_seed.slice(0, 8)}…` : ""}
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
      </main>
    </div>
  );
}
