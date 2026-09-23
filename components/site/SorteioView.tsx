import Link from "next/link";
import { RAFFLE_PRIZE_LABELS, formatBRL } from "@/lib/loyalty-raffle";
import { Header } from "@/components/site/sections/Header";
import { Footer } from "@/components/site/sections/Footer";

export interface SorteioSnap {
  amount_per_number_cents: number;
  total_numbers: number;
  prize_type: string;
  prize_description: string;
  prize_credit_amount_cents: number | null;
}

export interface SorteioTaken {
  number: number;
  name: string;
}

export interface SorteioWinner {
  id: string;
  winner_name: string | null;
  winner_number: number | null;
  prize: string;
  prize_type: string;
  drawn_at: string | null;
  seed: string | null;
}

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

export interface SorteioViewProps {
  slug: string;
  homeHref: string;
  backHref: string;
  profileName: string;
  ownerName?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  aboutDescription?: string;
  active: boolean;
  sampleMode: boolean;
  snap: SorteioSnap;
  taken: SorteioTaken[];
  history: SorteioWinner[];
}

/**
 * Totem visual da página do sorteio (Header + conteúdo + Rodapé padrão do
 * site). Usado tanto em `/sorteio` (domínio principal) quanto em
 * `/{slug}/sorteio` (site da consultora). O "Voltar pro site" sempre volta
 * para a seção #sorteio da home de origem (`backHref`).
 */
export function SorteioView({
  slug,
  homeHref,
  backHref,
  profileName,
  ownerName,
  whatsapp,
  email,
  instagram,
  aboutDescription,
  active,
  sampleMode,
  snap,
  taken,
  history,
}: SorteioViewProps) {
  const navItems = [
    { label: "Início", href: homeHref },
    { label: "Sorteio", href: "#topo" },
  ];
  const takenMap = new Map(taken.map((t) => [t.number, t.name]));

  return (
    <div id="tenant-site" data-slug={slug}>
      <Header
        logoText={profileName}
        navItems={navItems}
        extraNav={[{ label: "Voltar pro site", href: backHref }]}
        logoHref={homeHref}
      />

      <main
        id="topo"
        style={{
          background: "#faf8f2",
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

          {!active ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontSize: 15, color: "#5b6b62" }}>
                O sorteio por fidelidade não está ativo neste site.
              </p>
              <div style={{ marginTop: 16 }}>
                <BackButton href={backHref} big />
              </div>
            </div>
          ) : (
            <>
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
                  {RAFFLE_PRIZE_LABELS[snap.prize_type as keyof typeof RAFFLE_PRIZE_LABELS] || snap.prize_type}
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
                  <strong style={{ color: GOLD_LIGHT }}>
                    {Math.max(0, snap.total_numbers - takenMap.size)}
                  </strong>{" "}
                  de {snap.total_numbers}!
                </div>
                <div
                  style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden", marginTop: 14 }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.round((takenMap.size / Math.max(1, snap.total_numbers)) * 100))}%`,
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD})`,
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", margin: "6px 0 0" }}>
                  {takenMap.size} de {snap.total_numbers} números já escolhidos
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
                    {Array.from({ length: snap.total_numbers }, (_, i) => i + 1).map((n) => {
                      const who = takenMap.get(n);
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
                      Quando todos os {snap.total_numbers} números forem escolhidos (ou a consultora
                      antecipar), ocorre o sorteio.
                    </li>
                  </ol>
                </Card>
              </div>

              <div style={{ textAlign: "center", marginTop: 32 }}>
                <BackButton href={backHref} big />
              </div>
            </>
          )}
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
        aboutDescription={aboutDescription}
      />
    </div>
  );
}
