"use client";

import Link from "next/link";
import { useDemoStore } from "@/lib/demo/store";
import { formatBRL } from "@/lib/utils";

const MODULES = [
  { href: "/painel/crm/clientes", label: "Clientes", icon: "👥", key: "clients" },
  { href: "/painel/crm/produtos", label: "Produtos", icon: "🛍️", key: "products" },
  { href: "/painel/crm/vendas", label: "Vendas", icon: "💼", key: "sales" },
  { href: "/painel/crm/cobrancas", label: "Cobranças", icon: "🧾", key: "charges" },
  { href: "/painel/crm/tarefas", label: "Tarefas", icon: "✅", key: "tasks" },
  { href: "/painel/crm/financeiro", label: "Financeiro", icon: "💰", key: "finance" },
  { href: "/painel/crm/fidelidade", label: "Fidelidade", icon: "⭐", key: "loyalty" },
  { href: "/painel/crm/whatsapp", label: "WhatsApp", icon: "💬", key: "whatsapp" },
  { href: "/painel/crm/relatorios", label: "Relatórios", icon: "📊", key: "reports" },
  { href: "/painel/crm/configuracoes", label: "Configurações", icon: "⚙️", key: "settings" },
];

export function PainelDemoCrmHome() {
  const { ready, data } = useDemoStore();

  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const totalClientes = data.clients.length;
  const totalVendas = data.sales.reduce((a, s) => a + s.total, 0);
  const totalReceita = data.sales.filter((s) => s.status === "pago").reduce((a, s) => a + s.total, 0);
  const tarefasAbertas = data.tasks.filter((t) => !t.done).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>CRM</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie clientes, vendas, cobranças, tarefas e indicadores — tudo em modo demonstração.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <CardStat label="Clientes" value={String(totalClientes)} icon="👥" />
        <CardStat label="Vendas" value={formatBRL(totalVendas * 100)} icon="💼" />
        <CardStat label="Recebido" value={formatBRL(totalReceita * 100)} icon="💰" accent />
        <CardStat label="Tarefas" value={`${tarefasAbertas} abertas`} icon="✅" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-gray-200 bg-white p-4 hover:border-[#1d5c3a] hover:bg-[#f5faf6] transition-colors"
          >
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="font-medium text-gray-800">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">Demonstração interativa</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CardStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${accent ? "border-[#1d5c3a]" : "border-gray-200"}`}>
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-[#1d5c3a]" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}
