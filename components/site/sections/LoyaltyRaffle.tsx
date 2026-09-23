"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/loyalty-raffle";

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
 * desativado para o tenant.
 */
export function LoyaltyRaffle({
  content,
  slug,
}: {
  content: LoyaltyRaffleContent;
  slug: string;
}) {
  const [data, setData] = useState<PublicRaffle | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/raffle/public?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (!j || j.enabled !== true) setGone(true);
        else setData(j as PublicRaffle);
      })
      .catch(() => alive && setGone(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  if (gone || !data) return null;

  const pct = Math.min(100, Math.round((data.filled_count / Math.max(1, data.total_numbers)) * 100));
  const prize = data.prize_description || "um prêmio especial";

  return (
    <section id="sorteio">
      <div className="reveal" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <div className="section-eyebrow" style={{ justifyContent: "center" }}>
          <span className="eyebrow-line"></span>
          <span className="eyebrow-text">{content.eyebrow || "Programa de Fidelidade"}</span>
        </div>
        <h2 className="section-title">{content.title || "Toda compra te aproxima do prêmio"}</h2>
        <p style={{ color: "var(--text-muted, #5b6b62)", marginTop: 8 }}>
          A cada {formatBRL(data.amount_per_number_cents)} em compras, você ganha 1 número da
          sorte. Quando tivermos {data.total_numbers} números escolhidos, sorteamos{" "}
          <strong>{prize}</strong> entre quem participou. Garanta já o seu número!
        </p>
        <div style={{ marginTop: 16 }}>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1d5c3a] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500" style={{ marginTop: 6 }}>
            {data.filled_count} de {data.total_numbers} números já escolhidos
          </p>
        </div>
        <a href={`/${slug}/sorteio`} className="insta-link reveal" style={{ marginTop: 12, display: "inline-block" }}>
          {content.buttonText || "Ver números"} →
        </a>
      </div>
    </section>
  );
}
