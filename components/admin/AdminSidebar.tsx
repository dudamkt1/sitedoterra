"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Visão geral", icon: "📊" },
  { href: "/admin/editor-home", label: "Editor da Home", icon: "🏗️" },
  { href: "/admin/editor-ia", label: "Provedores de IA", icon: "🤖" },
  { href: "/admin/usuarios", label: "Usuários", icon: "👥" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "💰" },
  { href: "/admin/midias", label: "Mídias (R2)", icon: "🖼️" },
  { href: "/admin/dominios", label: "Domínios", icon: "🔗" },
  { href: "/admin/planos", label: "Planos e Preços", icon: "💰" },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-[#0d3320] text-white min-h-screen flex flex-col sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>TopConsultores</span>
          <span className="badge bg-amber-500/20 text-amber-300">Super Admin</span>
        </div>
        <p className="text-xs text-white/40 mt-1 truncate">{email}</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
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
      <div className="px-4 py-4 border-t border-white/10 space-y-3">
        <p className="text-xs text-white/40">Controle global da plataforma</p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 bg-white/5 hover:bg-red-600/20 hover:text-red-200 transition-colors"
        >
          <span>🚪</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
