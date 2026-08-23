"use client";

import { SectionTitle } from "@/components/dashboard/ui";
import { formatBRL } from "@/lib/utils";

const PAYMENTS = [
  { id: "p1", date: "2026-07-15", description: "Mensalidade — Plano Essencial", amount: 4900, status: "pago" },
  { id: "p2", date: "2026-06-15", description: "Mensalidade — Plano Essencial", amount: 4900, status: "pago" },
  { id: "p3", date: "2026-05-15", description: "Mensalidade — Plano Essencial", amount: 4900, status: "pago" },
  { id: "p4", date: "2026-04-15", description: "Mensalidade — Plano Essencial", amount: 4900, status: "pago" },
  { id: "p5", date: "2026-03-01", description: "Ativação do plano", amount: 9900, status: "pago" },
];

export function PainelDemoPagamentos() {
  return (
    <div className="space-y-6">
      <SectionTitle sub="Demonstração do histórico de cobranças. Nada é processado pelo Stripe ou Mercado Pago.">
        Pagamentos
      </SectionTitle>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PAYMENTS.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-gray-600">{new Date(p.date).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{p.description}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatBRL(p.amount)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card border-amber-300 bg-amber-50/40">
        <p className="text-xs text-amber-900">
          Em produção, esta tela integra com Stripe e Mercado Pago para listar faturas, baixar recibos e abrir
          o portal do cliente. Aqui tudo é simulado.
        </p>
      </div>
    </div>
  );
}
