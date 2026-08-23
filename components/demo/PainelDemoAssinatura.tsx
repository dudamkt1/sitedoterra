"use client";

import { SectionTitle } from "@/components/dashboard/ui";
import { formatBRL } from "@/lib/utils";

const PLANS = [
  {
    id: "essencial",
    name: "Plano Essencial",
    activation: 9900,
    monthly: 4900,
    features: ["Site profissional pronto", "Editor de seções", "Biblioteca de mídia (2 GB)", "CRM completo", "IA para conteúdo"],
  },
  {
    id: "premium",
    name: "Plano Premium",
    activation: 14900,
    monthly: 7900,
    features: [
      "Tudo do Essencial",
      "Biblioteca de mídia (10 GB)",
      "Domínio próprio incluso",
      "Treinamento avançado de IA",
      "Suporte prioritário",
    ],
  },
  {
    id: "pro",
    name: "Plano Pro",
    activation: 19900,
    monthly: 11900,
    features: [
      "Tudo do Premium",
      "Biblioteca de mídia ilimitada",
      "Relatórios avançados",
      "Integração com WhatsApp Business",
      "Consultoria de marketing mensal",
    ],
  },
];

export function PainelDemoAssinatura() {
  return (
    <div className="space-y-6">
      <SectionTitle sub="Demonstração dos planos disponíveis. Nenhuma cobrança é criada no Stripe.">
        Minha Assinatura
      </SectionTitle>

      <div className="card border-emerald-300 bg-emerald-50/40">
        <p className="text-sm text-emerald-900">
          ✨ Plano atual (demonstração): <strong>Plano Essencial</strong>. Em produção, este card mostraria
          o ciclo de cobrança, próxima fatura, métodos de pagamento e botão para alterar plano.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p) => (
          <div key={p.id} className="card flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800">{p.name}</h3>
            <p className="mt-1 text-2xl font-bold text-[#1d5c3a]">
              {formatBRL(p.monthly)}<span className="text-sm font-normal text-gray-500">/mês</span>
            </p>
            <p className="text-xs text-gray-500 mb-4">Ativação: {formatBRL(p.activation)}</p>
            <ul className="space-y-2 text-sm text-gray-700 mb-4 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
            >
              Selecionar (somente demonstração)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
