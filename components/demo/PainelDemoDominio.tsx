"use client";

import { SectionTitle } from "@/components/dashboard/ui";

export function PainelDemoDominio() {
  return (
    <div className="space-y-6">
      <SectionTitle sub="Demonstração da área de domínio. Nenhuma alteração é enviada para servidores DNS reais.">
        Domínio
      </SectionTitle>

      <div className="card">
        <h2 className="card-title mb-1">Domínio principal</h2>
        <p className="text-sm text-gray-500 mb-3">URL pública da sua página no SITE DOTERRA.</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-500">/demonstracao</span>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-1">Domínio personalizado</h2>
        <p className="text-sm text-gray-500 mb-3">
          Você pode conectar um domínio próprio (ex: seunome.com.br). Em produção esta tela gui você pela
          configuração de DNS.
        </p>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm text-emerald-900">
            ✓ <strong>carla.consultoria.local</strong> — conectado (demonstração)
          </p>
        </div>
      </div>

      <div className="card border-amber-300 bg-amber-50/40">
        <p className="text-xs text-amber-900">
          Em produção, esta tela mostraria registros DNS a serem configurados no seu provedor de domínio,
          além do status de verificação e propagação.
        </p>
      </div>
    </div>
  );
}
