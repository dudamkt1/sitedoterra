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

const PAGE_BG = "#faf8f2";
const INK = "#0e3b28";
const GOLD = "#c4963a";
const GOLD_LIGHT = "#e8c87a";

function BackButton({ href, big = false }: { href: string; big?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        background: "#1d5c3a",
        color: "#fff",
        fontWeight: 800,
        fontSize: big ? 16 : 14,
        borderRadius: 999,
        padding: big ? "14px 36px" : "11px 26px",
        textDecoration: "none",
        boxShadow: "0 10px 26px rgba(29,92,58,0.30)",
      }}
    >
      ← Voltar pro site
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "clamp(18px, 4vw, 28px)",
        boxShadow: "0 10px 30px rgba(14,59,40,0.08)",
        border: "1px solid rgba(14,59,40,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: "0 0 12px" }}>
      {children}
    </h2>
  );
}

export default async function RafflePage({ params }: { params: { slug: string } }) {
  const tenant = await getPublicTenantBySlug(params.slug);
  if (!tenant) notFound();
  const admin = createAdminClient();
  const settings = await getRaffleSettings(admin, tenant.tenant_id).catch(() => null);

  // Vitrine no site oficial: sem config, mostra exemplo fictício (nada real).
  const isOfficial = await isOfficialHomeTenantById(tenant.tenant_id).catch(() => false);
  const sampleMode = !settings?.enabled && isOfficial;

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
  const backHref = `/${tenant.slug}#sorteio`;

  if (!settings?.enabled && !sampleMode) {
    return (
      <div id="tenant-site" data-slug={tenant.slug}>
        <Header
          logoText={profileName}
          navItems={navItems}
          extraNav={[{ label: "Voltar pro site", href: backHref }]}
          logoHref={`/${tenant.slug}`}
        />
        <main
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: PAGE_BG,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ fontSize: 15, color: "#5b6b62" }}>
              O sorteio por fidelidade não está ativo neste site.
            </p>
            <div style={{ marginTop: 16 }}>
              <BackButton href={backHref} big />
            </div>
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
  const pct = Math.min(100, Math.round((taken.size / Math.max(1, total)) * 100));
  const prizeLabel =
    RAFFLE_PRIZE_LABELS[snap.prize_type as keyof typeof RAFFLE_PRIZE_LABELS] || snap.prize_type;

  return (
    <div id="tenant-site" data-slug={tenant.slug}>
      <Header
        logoText={profileName}
        navItems={navItems}
        extraNav={[{ label: "Voltar pro site", href: backHref }]}
        logoHref={`/${tenant.slug}`}
      />

      <main
        id="topo"
        style={{
          background: PAGE_BG,
          padding: "32px 16px 56px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <BackButton href={backHref} />
          {sampleMode && (
            <span
              style={{
                display: "inline-block",
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 800,
                color: INK,
                border: "1px dashed #1d5c3a",
                borderRadius: 999,
                padding: "6px 12px",
                verticalAlign: "middle",
              }}
            >
              Exemplo
            </span>
          )}

          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#1d5c3a",
              margin: "26px 0 0",
            }}
          >
            Programa de Fidelidade
          </p>
          <h1
            style={{
              fontSize: "clamp(26px, 5vw, 34px)",
              fontWeight: 800,
              color: INK,
              margin: "6px 0 0",
              fontFamily: "var(--font-display)",
            }}
          >
            🎟️ Sorteio por Fidelidade
          </h1>

          {/* cartão do prêmio */}
          <div
            style={{
              marginTop: 20,
              borderRadius: 24,
              padding: "clamp(20px, 4vw, 30px)",
              color: "#fff",
              background: "linear-gradient(135deg, #0e3b28 0%, #1d5c3a 55%, #2a7a4e 100%)",
              boxShadow: "0 24px 60px rgba(14,59,40,0.35)",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD_LIGHT, margin: 0 }}>
              Prêmio da rodada
            </p>
            <p style={{ fontSize: "clamp(19px, 4vw, 24px)", fontWeight: 800, margin: "8px 0 0" }}>
              🎁 {snap.prize_description || "Prêmio surpresa"}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>
              {prizeLabel}
              {snap.prize_type === "credito_loja" && snap.prize_credit_amount_cents
                ? ` · vale ${formatBRL(snap.prize_credit_amount_cents)} em compras futuras`
                : ""}
            </p>
            <div
              style={{
                marginTop: 16,
                border: "2px dashed rgba(232,200,122,0.8)",
                borderRadius: 16,
                padding: "12px 16px",
                fontSize: 14,
                lineHeight: 1.6,
                background: "rgba(255,255,255,0.10)",
              }}
            >
              A cada <strong style={{ color: GOLD_LIGHT }}>{formatBRL(snap.amount_per_number_cents)}</strong>{" "}
              em compras confirmadas, você ganha <strong>1 número da sorte</strong>. Faltam{" "}
              <strong style={{ color: GOLD_LIGHT }}>{missing}</strong> de {total}!
            </div>
            <div
              style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden", marginTop: 14 }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD})`,
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>
              {taken.size} de {total} números já escolhidos
            </p>
          </div>

          {/* grade de números */}
          <div style={{ marginTop: 20 }}>
            <Card>
              <CardTitle>Números da rodada</CardTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
                  gap: 8,
                }}
              >
                {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
                  const who = taken.get(n);
                  return (
                    <div
                      key={n}
                      title={who ? `Escolhido por ${who}` : "Disponível"}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${who ? "#1d5c3a" : "#e2e8e2"}`,
                        background: who ? "#1d5c3a" : "#fff",
                        color: who ? "#fff" : "#75847a",
                        padding: "8px 2px",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{n}</p>
                      <p
                        style={{
                          fontSize: 10,
                          margin: "3px 0 0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          padding: "0 4px",
                        }}
                      >
                        {who || "livre"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: "#98a39b", margin: "12px 0 0" }}>
                Fez uma compra? Fale com a consultora para escolher seu número entre os disponíveis.
              </p>
            </Card>
          </div>

          {/* ganhadores */}
          {history.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <Card>
                <CardTitle>🏆 Últimos ganhadores</CardTitle>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                  {history.map((h) => (
                    <li
                      key={h.id}
                      style={{
                        border: "1px solid rgba(14,59,40,0.10)",
                        background: "#f6faf7",
                        borderRadius: 14,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#33413a",
                      }}
                    >
                      <strong>{h.winner_name || "—"}</strong> ganhou{" "}
                      <strong>{h.prize || "o prêmio"}</strong> com o número{" "}
                      <strong style={{ color: INK }}>{h.winner_number}</strong>
                      <span style={{ display: "block", fontSize: 12, color: "#98a39b", marginTop: 2 }}>
                        {h.drawn_at ? new Date(h.drawn_at).toLocaleDateString("pt-BR") : ""}
                        {h.seed ? ` · semente ${h.seed.slice(0, 8)}…` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12, color: "#98a39b", margin: "12px 0 0" }}>
                  Sorteio verificável: semente pública + data registrados em cada rodada para auditoria.
                </p>
              </Card>
            </div>
          )}

          {/* como participar */}
          <div style={{ marginTop: 20 }}>
            <Card>
              <CardTitle>Como participar</CardTitle>
              <ol style={{ fontSize: 14, color: "#4b5750", lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
                <li>Faça suas compras com a consultora (loja, WhatsApp ou catálogo).</li>
                <li>
                  A cada {formatBRL(snap.amount_per_number_cents)} em compras confirmadas, você ganha
                  1 número da sorte.
                </li>
                <li>Escolha seu número entre os disponíveis com a consultora.</li>
                <li>
                  Quando todos os {total} números forem escolhidos (ou a consultora antecipar),
                  ocorre o sorteio.
                </li>
              </ol>
            </Card>
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <BackButton href={backHref} big />
          </div>
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
