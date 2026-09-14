"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualização automática de `/painel/pagamentos` enquanto houver cobrança
 * pendente: recarrega os dados do servidor (router.refresh) a cada 20s, por
 * até 15 minutos. Para sozinho quando não há mais pendências (o componente
 * deixa de ser renderizado) ou ao desmontar.
 */
export function PagamentosAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      if (ticks > 45) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 20000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
