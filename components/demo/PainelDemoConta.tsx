"use client";

import { useDemoStore } from "@/lib/demo/store";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PainelDemoConta() {
  const { ready, data, reset, clearAll } = useDemoStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!ready || !data) return null;

  async function handleReset() {
    if (
      !confirm(
        "Restaurar demonstração?\n\nIsso apagará somente suas alterações neste dispositivo e restaurará o ambiente de demonstração."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleExit() {
    if (
      !confirm(
        "Sair do modo demonstração? Suas alterações locais serão preservadas neste dispositivo até você restaurar."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/demo/exit", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    if (
      !confirm(
        "Apagar TODOS os dados da demonstração deste navegador? Isso inclui clientes, vendas, CRM, mídia e configurações."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      clearAll();
      await fetch("/api/demo/exit", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="card">
        <h2 className="card-title mb-3">Identidade da demonstração</h2>
        <dl className="divide-y divide-gray-100 text-sm">
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Nome</dt>
            <dd className="font-medium text-gray-800">Acesso Rápido (Demonstração)</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">E-mail</dt>
            <dd className="font-medium text-gray-800">acesso-rapido@demonstracao.local</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Plano</dt>
            <dd className="font-medium text-gray-800">Plano Essencial (demonstração)</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium text-[#1d5c3a]">Ambiente de teste</dd>
          </div>
        </dl>
      </div>

      <div className="card border-amber-300 bg-amber-50/40">
        <h2 className="card-title mb-1">Ações da demonstração</h2>
        <p className="text-xs text-gray-600 mb-4">
          Como você está em modo demonstração, nenhuma destas ações escreve no Supabase, no R2 ou no Stripe.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="flex-1 rounded-lg border border-[#1d5c3a] bg-white px-4 py-2.5 text-sm font-semibold text-[#1d5c3a] hover:bg-[#e5f4ea] transition-colors disabled:opacity-50"
          >
            ♻️ Restaurar demonstração
          </button>
          <button
            type="button"
            onClick={handleExit}
            disabled={busy}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            🚪 Sair da demonstração
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={busy}
            className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            🗑️ Apagar tudo deste navegador
          </button>
        </div>
        <p className="mt-3 text-[0.7rem] text-gray-500 leading-relaxed">
          Suas alterações (clientes, vendas, CRM, financeiro, mídia e aparência) ficam salvas apenas no
          <code className="mx-1 font-mono">localStorage</code> deste navegador. Limpar os dados do navegador também remove a demonstração.
        </p>
      </div>
    </div>
  );
}
