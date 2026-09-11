"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  PenLine,
  KeyRound,
  Bot,
  ContactRound,
  Handshake,
  Wallet,
  Image as ImageIcon,
  Globe,
  CreditCard,
  ArrowLeftRight,
  Mail,
  MessageSquareText,
  Home,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/editor-home", label: "Editor da Home", icon: PenLine },
  { href: "/admin/editor-ia", label: "Provedores de IA", icon: KeyRound },
  { href: "/admin/ia", label: "Central de IA", icon: Bot },
  { href: "/admin/crm", label: "CRM geral", icon: ContactRound },
  { href: "/admin/afiliados", label: "Afiliados", icon: Handshake },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/midias", label: "Mídias", icon: ImageIcon },
  { href: "/admin/dominios", label: "Domínios", icon: Globe },
  { href: "/admin/planos", label: "Planos e Preços", icon: CreditCard },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: ArrowLeftRight },
  { href: "/admin/emails", label: "E-mails", icon: Mail },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
];

// Atalhos da barra inferior mobile (5 itens + drawer completo)
const TABS = [
  { href: "/admin", label: "Início", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/ia", label: "IA", icon: Bot },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/feedback/count", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (alive) setUnread(j.unread || 0);
      } catch {
        // silencioso
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  // Fecha o drawer ao trocar de rota + trava scroll do body
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  const currentLabel = useMemo(() => {
    const found = [...LINKS, { href: "/painel", label: "Meu painel", icon: Home }].find((l) =>
      isActive(pathname, l.href)
    );
    return found?.label ?? "Super Admin";
  }, [pathname]);

  function Badge({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
      <span className="ml-auto inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-[0_0_0_2px_rgba(13,51,32,0.9)]">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  return (
    <>
      {/* ── Topbar mobile ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-emerald-950/10 bg-[#0d3320]/95 px-4 py-3 text-white backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            TopConsultores
          </p>
          <p className="truncate text-[11px] text-white/55">{currentLabel}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </span>
      </header>

      {/* ── Sidebar desktop ───────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col overflow-hidden bg-[#0d3320] text-white md:flex">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-emerald-400/20 via-emerald-400/5 to-transparent"
          aria-hidden
        />
        <div className="relative flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-lg font-bold text-emerald-950 shadow-lg">
            T
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              TopConsultores
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <ShieldCheck className="h-3 w-3" />
              Super Admin
            </span>
          </div>
        </div>
        <p className="relative truncate px-5 text-xs text-white/45">{email}</p>

        <nav className="relative mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            const Icon = l.icon;
            const isFeedback = l.href === "/admin/feedback";
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all ${
                  active
                    ? "bg-white text-emerald-950 shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
                    : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active ? "bg-emerald-950 text-amber-300" : "bg-white/10 text-white/80 group-hover:bg-white/15"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                {isFeedback && <Badge count={unread} />}
                {active && <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />}
              </Link>
            );
          })}
          <Link
            href="/painel"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Home className="h-4 w-4" />
            </span>
            Meu painel
          </Link>
        </nav>

        <div className="relative border-t border-white/10 p-3">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* ── Drawer mobile ─────────────────────────────────── */}
      <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu administrativo"
          className={`absolute left-0 top-0 flex h-full w-[86vw] max-w-[320px] flex-col bg-[#0d3320] text-white shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 font-bold text-emerald-950">
              T
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                TopConsultores
              </p>
              <p className="truncate text-[11px] text-white/50">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              const Icon = l.icon;
              const isFeedback = l.href === "/admin/feedback";
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    active ? "bg-white text-emerald-950" : "text-white/70 active:bg-white/10"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-emerald-950 text-amber-300" : "bg-white/10"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  {isFeedback && <Badge count={unread} />}
                </Link>
              );
            })}
            <Link href="/painel" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/70">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Home className="h-4 w-4" />
              </span>
              Meu painel
            </Link>
          </nav>
          <div className="border-t border-white/10 p-3">
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Bottom tab bar mobile ─────────────────────────── */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-950/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            const showBadge = t.href === "/admin/feedback" && unread > 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold ${
                  active ? "text-emerald-800" : "text-gray-400"
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-700" />}
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center leading-none">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
