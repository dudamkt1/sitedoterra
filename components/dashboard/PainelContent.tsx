"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SiteActivationRequired } from "@/components/dashboard/SiteActivationRequired";

interface PainelContentProps {
  children: ReactNode;
  isDemo: boolean;
  isSuperAdmin: boolean;
  siteActivated: boolean;
}

/**
 * Rotas que ficam 100% funcionais mesmo sem site ativo:
 * - /painel/afiliados: única categoria sempre ativa (com ou sem site).
 * - /painel/assinatura: caminho da ativação (precisa de ação).
 * - /painel/conta: dados da conta (não exige site).
 */
const ALWAYS_OPEN_PREFIXES = ["/painel/afiliados", "/painel/assinatura", "/painel/conta"];

function LockedBanner() {
  return (
    <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
      <p className="flex flex-1 items-center gap-2 text-sm font-medium text-amber-900">
        <Lock className="h-4 w-4 shrink-0" />
        Ative seu site para desbloquear todo o painel.
      </p>
      <Link
        href="/painel/assinatura"
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#165030]"
      >
        Ativar meu site
      </Link>
    </div>
  );
}

export function PainelContent({
  children,
  isDemo,
  isSuperAdmin,
  siteActivated,
}: PainelContentProps) {
  const pathname = usePathname();
  const locked = !siteActivated && !isSuperAdmin && !isDemo;

  if (!locked) {
    return <>{children}</>;
  }

  // Categoria "geral" (/painel): mantém a mensagem completa atual,
  // direcionando para AFILIADOS.
  if (pathname === "/painel") {
    return <SiteActivationRequired />;
  }

  // Rotas sempre abertas (afiliados, assinatura, conta).
  if (ALWAYS_OPEN_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  // Demais ferramentas: mostra tudo em modo vitrine — visível, sem ação.
  // `inert` bloqueia mouse + teclado + foco; a mensagem breve vai no banner.
  return (
    <>
      <LockedBanner />
      <div
        ref={(el) => {
          if (el) (el as unknown as { inert?: boolean }).inert = true;
        }}
        className="pointer-events-none select-none"
        aria-disabled="true"
      >
        {children}
      </div>
    </>
  );
}
