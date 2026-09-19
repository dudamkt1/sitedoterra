"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Globe,
  ListChecks,
  CalendarDays,
  FolderOpen,
  ContactRound,
  Bot,
  Brain,
  CreditCard,
  Link2,
  Smartphone,
  ReceiptText,
  Handshake,
  UserRound,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ExternalLink,
  ChevronRight,
  Lock,
  BookOpen,
  Sparkles,
} from "lucide-react";

const USER_LINKS = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard, requiresActiveSite: false },
  { href: "/painel/meu-site", label: "Meu Site", icon: Globe, requiresActiveSite: true },
  { href: "/painel/checklist", label: "Meu Checklist", icon: ListChecks, requiresActiveSite: true },
  { href: "/painel/agendamentos", label: "Agendamentos", icon: CalendarDays, requiresActiveSite: true },
  { href: "/painel/midias", label: "Mídias", icon: FolderOpen, requiresActiveSite: true },
  { href: "/painel/materiais-apoio", label: "Materiais de apoio", icon: BookOpen, requiresActiveSite: true, highlight: true },
  { href: "/painel/crm", label: "CRM", icon: ContactRound, requiresActiveSite: true },
  { href: "/painel/ia", label: "IA do site", icon: Bot, requiresActiveSite: true },
  { href: "/painel/ia/treinamento", label: "Treinar IA", icon: Brain, requiresActiveSite: true },
  { href: "/painel/assinatura", label: "Assinatura", icon: CreditCard, requiresActiveSite: false },
  { href: "/painel/dominio", label: "Domínio", icon: Link2, requiresActiveSite: true },
  { href: "/painel/pwa", label: "Aplicativo", icon: Smartphone, requiresActiveSite: true },
  { href: "/painel/pagamentos", label: "Pagamentos", icon: ReceiptText, requiresActiveSite: true },
  { href: "/painel/afiliados", label: "Afiliados", icon: Handshake, requiresActiveSite: false },
  { href: "/painel/conta", label: "Minha Conta", icon: UserRound, requiresActiveSite: false },
];

const TABS = [
  { href: "/painel", label: "Início", icon: LayoutDashboard, requiresActiveSite: false },
  { href: "/painel/meu-site", label: "Site", icon: Globe, requiresActiveSite: true },
  { href: "/painel/crm", label: "CRM", icon: ContactRound, requiresActiveSite: true },
  { href: "/painel/ia", label: "IA", icon: Bot, requiresActiveSite: true },
  { href: "/painel/conta", label: "Conta", icon: UserRound, requiresActiveSite: false },
];

function isActive(pathname: string, href: string) {
  if (href === "/painel") return pathname === "/painel";
  if (href === "/painel/crm" || href === "/painel/checklist") return pathname === href || pathname.startsWith(href + "/");
  if (href === "/painel/ia") return pathname === "/painel/ia";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function DashboardSidebar({
  name,
  email,
  isSuperAdmin,
  siteSlug,
  isDemo,
  siteActivated = true,
}: {
  name: string;
  email: string;
  isSuperAdmin: boolean;
  siteSlug: string | null;
  isDemo?: boolean;
  siteActivated?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  const currentLabel = useMemo(
    () => USER_LINKS.find((l) => isActive(pathname, l.href))?.label ?? "Painel",
    [pathname]
  );

  const initials = useMemo(() => {
    const base = (name || email || "?").trim();
    const parts = base.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
  }, [name, email]);

  async function leaveDemo() {
    if (!confirm("Sair do modo demonstração? Suas alterações locais serão preservadas neste dispositivo.")) {
      return;
    }
    setLeaving(true);
    try {
      await fetch("/api/demo/exit", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  function NavLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
    // Filtra links baseado no status do site
    const filteredLinks = USER_LINKS.filter((l) => {
      // Demo e Super Admin veem tudo
      if (isDemo) return true;
      if (isSuperAdmin) return true;
      // Se site não ativado, só mostra links que não requerem site ativo
      if (!siteActivated && l.requiresActiveSite) return false;
      return true;
    });

    return (
      <>
        {filteredLinks.map((l) => {
          const active = isActive(pathname, l.href);
          const Icon = l.icon;
          const isLocked = !siteActivated && l.requiresActiveSite && !isDemo && !isSuperAdmin;

          const isHighlight = l.highlight && !active && !isLocked;

          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl transition-all ${
                compact ? "px-3 py-3 text-sm" : "px-3 py-2.5 text-[13.5px]"
              } font-medium ${
                isLocked
                  ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                  : active
                  ? "bg-gradient-to-r from-[#1d5c3a] to-[#2d7a4f] text-white shadow-[0_8px_20px_rgba(29,92,58,0.3)]"
                  : isHighlight
                  ? "text-[#1d5c3a] bg-gradient-to-r from-emerald-50/60 to-amber-50/60 hover:from-emerald-100/80 hover:to-amber-100/80 border border-emerald-200/50 shadow-[0_4px_16px_-8px_rgba(29,92,58,0.25)]"
                  : "text-gray-600 hover:bg-emerald-50/80 hover:text-[#1d5c3a] active:bg-emerald-100"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors relative ${
                  active
                    ? "bg-white/20 text-white"
                    : isLocked
                    ? "bg-gray-100 text-gray-300"
                    : isHighlight
                    ? "bg-gradient-to-br from-emerald-100 to-amber-100 text-[#1d5c3a] group-hover:from-emerald-200 group-hover:to-amber-200"
                    : "bg-gray-100 text-gray-500 group-hover:bg-emerald-100 group-hover:text-[#1d5c3a]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {isHighlight && !compact && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  </span>
                )}
                {isLocked && !compact && (
                  <span className="absolute -top-1 -right-1 h-4 w-4">
                    <Lock className="h-4 w-4 text-gray-300" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              {active && !compact && !isLocked && <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />}
              {isLocked && !compact && (
                <span className="h-4 w-4 shrink-0 opacity-50" title="Requer site ativo">
                  <Lock className="h-4 w-4 text-gray-300" />
                </span>
              )}
            </Link>
          );
        })}
      </>
    );
  }

  function Footer({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <div className="space-y-3">
        {isSuperAdmin && !isDemo && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 text-sm font-semibold text-[#92400e]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Super Admin
          </Link>
        )}
        {siteSlug && !isDemo && (
          <div className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Seu site público</p>
            <Link href={`/${siteSlug}`} target="_blank" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-[#1d5c3a]">
              <span className="min-w-0 flex-1 truncate">/{siteSlug}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-gray-800">{name}</p>
            <p className="truncate text-[11px] text-gray-400">{email}</p>
          </div>
        </div>
        {isDemo ? (
          <button
            type="button"
            onClick={leaveDemo}
            disabled={leaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {leaving ? "Saindo..." : "Sair da demonstração"}
          </button>
        ) : (
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ── Topbar mobile ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1d5c3a] text-white active:bg-[#165030]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-[#1d5c3a]" style={{ fontFamily: "var(--font-display)" }}>
            TopConsultores
          </p>
          <p className="truncate text-[11px] text-gray-400">{currentLabel}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-[11px] font-bold text-white" title={name}>
          {initials}
        </span>
      </header>

      {/* ── Sidebar desktop ───────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-r border-gray-100 bg-white md:flex">
        <div className="px-5 pb-3 pt-5">
          <Link href="/painel" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] text-lg font-bold text-white shadow-lg">
              T
            </span>
            <span className="text-[19px] font-semibold text-[#1d5c3a]" style={{ fontFamily: "var(--font-display)" }}>
              TopConsultores
            </span>
          </Link>
          {isDemo && (
            <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Demonstração
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
          <NavLinks />
        </nav>
        <div className="border-t border-gray-100 p-3">
          <Footer />
        </div>
      </aside>

      {/* ── Drawer mobile ─────────────────────────────────── */}
      <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu do painel"
          className={`absolute left-0 top-0 flex h-full w-[86vw] max-w-[320px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1d5c3a] to-[#2d7a4f] font-bold text-white">
              T
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[#1d5c3a]">TopConsultores</p>
              <p className="truncate text-[11px] text-gray-400">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            <NavLinks onNavigate={() => setOpen(false)} compact />
          </nav>
          <div className="max-h-[38vh] overflow-y-auto border-t border-gray-100 p-3">
            <Footer onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>

      {/* ── Bottom tab bar mobile ─────────────────────────── */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.filter((t) => {
            if (isDemo) return true;
            if (isSuperAdmin) return true;
            if (!siteActivated && t.requiresActiveSite) return false;
            return true;
          }).map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            const isLocked = !siteActivated && t.requiresActiveSite && !isDemo && !isSuperAdmin;

            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold ${
                  isLocked
                    ? "text-gray-300"
                    : active
                    ? "text-[#1d5c3a]"
                    : "text-gray-400"
                }`}
                style={{ pointerEvents: isLocked ? "none" : "auto" }}
              >
                {active && !isLocked && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#1d5c3a]" />}
                <Icon className="h-[22px] w-[22px]" />
                <span className="w-full truncate text-center leading-none">{t.label}</span>
                {isLocked && (
                  <span className="absolute top-1 right-1 h-3.5 w-3.5" title="Requer site ativo">
                    <Lock className="h-3.5 w-3.5 text-gray-300" />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
