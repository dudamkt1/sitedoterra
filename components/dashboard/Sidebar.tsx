"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const USER_LINKS = [
  { href: "/painel", label: "Visão geral", icon: "📊" },
  { href: "/painel/meu-site", label: "Meu Site", icon: "🌐" },
  { href: "/painel/ia", label: "IA para seu site", icon: "🤖" },
  { href: "/painel/assinatura", label: "Minha Assinatura", icon: "💳" },
  { href: "/painel/dominio", label: "Domínio", icon: "🔗" },
  { href: "/painel/pagamentos", label: "Pagamentos", icon: "🧾" },
  { href: "/painel/conta", label: "Minha Conta", icon: "👤" },
];

export default function DashboardSidebar({
  name,
  email,
  isSuperAdmin,
  siteSlug,
}: {
  name: string;
  email: string;
  isSuperAdmin: boolean;
  siteSlug: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white min-h-screen flex flex-col sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/painel" className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--verde)" }}>
          TopConsultores
        </Link>
        <p className="text-xs text-gray-400 mt-1 truncate">{email}</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {USER_LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-[#e5f4ea] text-[#1d5c3a]" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}

        {isSuperAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#92400e] bg-amber-50 hover:bg-amber-100 mt-4"
          >
            <span>🛡️</span>
            Super Admin
          </Link>
        )}

        {siteSlug && (
          <div className="mt-6 px-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-gray-400 mb-2">Seu site público</p>
            <Link
              href={`/${siteSlug}`}
              target="_blank"
              className="text-xs text-[#1d5c3a] underline break-all"
            >
              /{siteSlug} ↗
            </Link>
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        <p className="text-sm font-medium text-gray-700 truncate">{name}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <span>🚪</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
