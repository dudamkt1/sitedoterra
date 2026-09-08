"use client";

import { useEffect } from "react";

/**
 * Exibido ao voltar do pagamento (…/meu-site?ativado=1).
 * Limpa a flag de "pagamento pendente" e confirma a ativação em andamento.
 */
export function ActivationReturnNotice({ siteActive }: { siteActive: boolean }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem("site_activation_checkout");
    } catch {}
  }, []);

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
      <p className="text-sm font-semibold text-green-900">
        🎉 Pagamento recebido! {siteActive ? "Seu site já está ativado." : "Seu site está sendo ativado."}
      </p>
      {!siteActive && (
        <p className="text-sm text-green-800 mt-1.5">
          A confirmação pode levar alguns instantes. Recarregue esta página em breve para ver
          seu site no ar.
        </p>
      )}
    </div>
  );
}
