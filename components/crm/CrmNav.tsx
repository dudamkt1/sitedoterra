"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CrmModuleCode } from "@/types";

const MODULES: { href: string; label: string; icon: string; code: CrmModuleCode | null }[] = [
  { href: "/painel/crm", label: "Dashboard", icon: "📊", code: null },
  { href: "/painel/crm/clientes", label: "Clientes", icon: "👥", code: null },
  { href: "/painel/crm/fidelidade", label: "Fidelidade", icon: "🎁", code: "fidelidade" },
  { href: "/painel/crm/catalogo", label: "Catálogo", icon: "📦", code: null },
  { href: "/painel/crm/vendas", label: "Vendas", icon: "🛒", code: null },
  { href: "/painel/crm/financeiro", label: "Financeiro", icon: "💰", code: "financeiro" },
  { href: "/painel/crm/cobrancas", label: "Cobranças", icon: "🧾", code: "cobrancas" },
  { href: "/painel/crm/whatsapp", label: "WhatsApp", icon: "💬", code: "whatsapp" },
  { href: "/painel/crm/tarefas", label: "Tarefas", icon: "✅", code: null },
  { href: "/painel/crm/relatorios", label: "Relatórios", icon: "📈", code: "relatorios" },
  { href: "/painel/crm/configuracoes", label: "Configurações", icon: "⚙️", code: null },
];

export default function CrmNav({ modules, activePrefix }: { modules: Record<string, boolean>; activePrefix?: string }) {
  const pathname = usePathname();
  const prefix = activePrefix || pathname;

  const visible = MODULES.filter((m) => {
    if (m.code && modules[m.code] === false) return false;
    return true;
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1">
      {visible.map((m) => {
        const active = prefix === m.href || prefix.startsWith(m.href + "/");
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
              active
                ? "bg-[#1d5c3a] text-white border-[#1d5c3a]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-[#1d5c3a]"
            }`}
          >
            <span>{m.icon}</span>
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}