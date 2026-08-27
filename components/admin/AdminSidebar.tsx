"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Visão geral", icon: "📊" },
  { href: "/admin/conta", label: "Contas", icon: "👤" },
  { href: "/admin/editor-home", label: "Editor da Home", icon: "🏗️" },
  { href: "/admin/editor-ia", label: "Provedores de IA", icon: "🔑" },
  { href: "/admin/ia", label: "Central de IA", icon: "🤖" },
  { href: "/admin/crm", label: "CRM (geral)", icon: "📇" },
  { href: "/admin/usuarios", label: "Usuários", icon: "👥" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "💰" },
  { href: "/admin/midias", label: "Mídias (R2)", icon: "🖼️" },
  { href: "/admin/dominios", label: "Domínios", icon: "🔗" },
  { href: "/admin/planos", label: "Planos e Preços", icon: "💰" },
  { href: "/admin/pagamentos", label: "Pagamentos (Gateway)", icon: "💱" },
  { href: "/admin/emails", label: "E-mails (SMTP)", icon: "📧" },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 shrink-0 border-r border-gray-200 bg-[#0d3320] text-white flex flex-col sticky top-0 md:h-screen">
      {/* Cabeçalho (desktop + mobile) com o botão Sair SEMPRE visível */}
      <div className="px-4 md:px-5 py-3 md:py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
              TopConsultores
            </span>
            <span className="badge bg-amber-500/20 text-amber-300 shrink-0">Super Admin</span>
          </div>
          <p className="text-[0.7rem] md:text-xs text-white/40 mt-0.5 truncate">{email}</p>
        </div>
        <form action="/auth/signout" method="POST" className="shrink-0">
          <button
            type="submit"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors shadow-md"
            style={{ boxShadow: "0 2px 10px rgba(220,38,38,0.45)" }}
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Sair</span>
            <span className="sm:hidden">Sair</span>
          </button>
        </form>
      </div>

      {/* Navegação (desktop: coluna lateral; mobile: faixa horizontal rolável) */}
      <nav className="flex-1 min-h-0 py-4 px-3 space-y-1 overflow-y-auto md:flex-col hidden md:flex">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
        <Link href="/painel" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white">
          <span>🏠</span>
          Meu painel
        </Link>
      </nav>

      {/* Mobile: navegação em linha com rolagem horizontal */}
      <nav className="md:hidden flex gap-2 overflow-x-auto px-3 py-2 border-t border-white/10">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
        <Link href="/painel" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap text-white/60 hover:bg-white/5 hover:text-white">
          <span>🏠</span>
          Meu painel
        </Link>
      </nav>
    </aside>
  );
}