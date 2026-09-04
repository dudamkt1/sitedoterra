"use client";

import { Suspense } from "react";
import { AffiliateAttribution } from "@/components/site/AffiliateAttribution";
import type { PublicTenant } from "@/types";

/**
 * Página de fallback renderizada quando o tenant:
 *   - existe no banco (afiliado válido), mas
 *   - ainda não tem site ativo (suspended / pending / billing pendente).
 *
 * Mostra uma mensagem profissional preservando:
 *   - a identidade visual básica (gradiente verde do brand);
 *   - o affiliateUserId na URL via `?ref=` (cookie first-party);
 *   - um CTA direto para a plataforma/contratação.
 *
 * O AffiliateAttribution continua sendo montado aqui (com destination
 * "none") para que o `?ref=` seja capturado e o cookie de atribuição
 * seja gerado/persistido — mesmo nessa página de fallback, a indicação
 * fica preservada para o checkout posterior.
 *
 * IMPORTANTE: o cookie `tc_visitor_token` (first-party) é o canal de
 * atribuição que sobrevive a este fallback e chega até `/api/checkout`.
 */
export function SiteUnprepared({
  tenant,
  destination,
}: {
  tenant: PublicTenant;
  destination: import("@/lib/affiliate-destination").AffiliateDestination;
}) {
  const name = tenant.profile_name || tenant.site_name || tenant.slug;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <Suspense fallback={null}>
        <AffiliateAttribution destination={destination} />
      </Suspense>

      <div className="max-w-md w-full text-center text-white">
        <div className="text-5xl mb-4" aria-hidden>
          🌱
        </div>
        <h1
          className="text-3xl font-light mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Este site está sendo preparado
        </h1>
        <p className="text-white/60 leading-relaxed">
          O site de <span className="text-white/90 font-medium">{name}</span>{" "}
          está em construção. Em breve este espaço estará disponível.
        </p>
        <p className="text-white/40 text-sm mt-3 leading-relaxed">
          Enquanto isso, você pode conhecer a plataforma e garantir seu próprio
          site profissional.
        </p>

        <a
          href="/"
          className="inline-flex items-center justify-center mt-8 px-6 py-3 rounded-full bg-white text-[#103d2d] font-semibold text-sm shadow-lg hover:bg-white/95 transition leading-none"
        >
          Quero meu site →
        </a>

        <p className="mt-8 text-xs text-white/40">
          /{tenant.slug} · Site em preparação
        </p>
      </div>
    </div>
  );
}
