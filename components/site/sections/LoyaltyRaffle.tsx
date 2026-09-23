"use client";

import { useEffect, useState } from "react";
import { RAFFLE_SAMPLE, formatBRL } from "@/lib/loyalty-raffle";

export interface LoyaltyRaffleContent {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
}

interface PublicRaffle {
  enabled: boolean;
  amount_per_number_cents: number;
  total_numbers: number;
  prize_description: string;
  filled_count: number;
}

/**
 * Seção pública do Sorteio por Fidelidade (após Produtos, antes do FAQ).
 * Data-driven como as demais seções; o progresso ao vivo vem de
 * GET /api/raffle/public?slug=. Não renderiza se o sorteio estiver
 * desativado para o tenant — exceto em `sample` (vitrine do domínio
 * principal com dados fictícios, sem gravar nada).
 *
 * Renderiza a casca imediatamente (sem depender do observer global
 * `.reveal` do SiteEffects, que só enxerga elementos presentes no mount).
 */
export function LoyaltyRaffle({
  content,
  slug,
  sample = false,
  sorteioHref,
}: {
  content: LoyaltyRaffleContent;
  slug: string;
  sample?: boolean;
  /** Destino do botão (default `/{slug}/sorteio`; na HOME principal é `/sorteio`). */
  sorteioHref?: string;
}) {
  const [data, setData] = useState<PublicRaffle | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/raffle/public?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (!j || j.enabled !== true) setDisabled(true);
        else setData(j as PublicRaffle);
      })
      .catch(() => alive && setDisabled(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  const useSample = sample && (disabled || !data);
  if (disabled && !sample) return null;

  const live = useSample
    ? {
        amount_per_number_cents: RAFFLE_SAMPLE.amount_per_number_cents,
        total_numbers: RAFFLE_SAMPLE.total_numbers,
        prize_description: RAFFLE_SAMPLE.prize_description,
        filled_count: RAFFLE_SAMPLE.numbers.length,
      }
    : data;

  const amountText = live ? formatBRL(live.amount_per_number_cents) : "…";
  const totalText = live ? String(live.total_numbers) : "…";
  const prize = live?.prize_description || "um prêmio especial";
  const filled = live?.filled_count || 0;
  const total = live?.total_numbers || 0;
  const missing = Math.max(0, total - filled);
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;

  return (
    <section id="sorteio" style={{ padding: "20px 0" }}>
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          borderRadius: 28,
          padding: "clamp(24px, 5vw, 48px)",
          background: "linear-gradient(135deg, #0e3b28 0%, #1d5c3a 55%, #2a7a4e 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(14,59,40,0.35)",
        }}
      >
        {/* brilhos decorativos */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -90,
            right: -90,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,150,58,0.45) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -110,
            left: -70,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)",
          }}
        />

        <div style={{ position: "relative", textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#0e3b28",
              background: "linear-gradient(90deg, #e8c87a, #c4963a)",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            🎟️ {content.eyebrow || "Programa de Fidelidade"}
          </span>
          {useSample && (
            <span
              style={{
                display: "inline-block",
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                border: "1px dashed rgba(255,255,255,0.6)",
                borderRadius: 999,
                padding: "5px 12px",
              }}
            >
              Exemplo
            </span>
          )}

          <h2
            className="section-title"
            style={{ color: "#fff", marginTop: 14 }}
          >
            {content.title || "Toda compra te aproxima do prêmio"}
          </h2>

          {/* tíquete do prêmio */}
          <div
            style={{
              marginTop: 18,
              background: "rgba(255,255,255,0.12)",
              border: "2px dashed rgba(232,200,122,0.8)",
              borderRadius: 18,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 34 }}>🎁</span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{prize}</span>
          </div>

          <p style={{ color: "rgba(255,255,255,0.88)", marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>
            A cada <strong style={{ color: "#e8c87a" }}>{amountText}</strong> em compras, você
            ganha <strong>1 número da sorte</strong>. Quando tivermos{" "}
            <strong>{totalText} números</strong> escolhidos, sorteamos entre quem participou.
            {missing > 0 ? (
              <>
                {" "}Faltam <strong style={{ color: "#e8c87a" }}>{missing}</strong>!
              </>
            ) : (
              <> Sorteio próximo! </>
            )}
          </p>

          {/* progresso */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #e8c87a, #c4963a)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
              {live ? `${filled} de ${total} números já escolhidos` : "Carregando números…"}
            </p>
          </div>

          <a
            href={sorteioHref || `/${slug}/sorteio`}
            style={{
              display: "inline-block",
              marginTop: 18,
              background: "#fff",
              color: "#0e3b28",
              fontWeight: 800,
              fontSize: 15,
              borderRadius: 999,
              padding: "13px 34px",
              textDecoration: "none",
              boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
            }}
          >
            {content.buttonText || "Ver números"} →
          </a>
        </div>
      </div>
    </section>
  );
}
