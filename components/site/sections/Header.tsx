"use client";

import { useEffect, useRef, useState } from "react";
import type { HeaderAccount } from "@/lib/header-account";

export interface HeaderProps {
  logoText?: string;
  logoUrl?: string;
  /** Logo alternativa para quando o menu fica com fundo claro (ao rolar a página). */
  logoLightUrl?: string;
  navItems: { label: string; href: string }[];
  extraNav?: { label: string; href: string; className?: string }[];
  /** Destino do clique no logotipo. Default "#hero" (HOME e sites das consultoras);
   *  páginas fora da HOME (ex.: /afiliados) devem passar "/" para voltar à HOME. */
  logoHref?: string;
  /**
   * Sessão ativa: troca o link "Painel" pelo nome do usuário + menu
   * suspenso (Painel / Sair). null/ausente = visitante, mantém o link antigo.
   */
  account?: HeaderAccount | null;
}

function AccountAvatar({ name }: { name: string }) {
  return (
    <span className="nav-account-avatar" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function Header({ logoText = "Logo", logoUrl, logoLightUrl, navItems, extraNav = [], logoHref = "#hero", account = null }: HeaderProps) {
  const navRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Fecha o menu de conta ao clicar fora (no desktop o hover já cuida disso;
  // o clique é o caminho em touch/teclado).
  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trava o scroll do body enquanto o menu está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Fecha com ESC e ao voltar para desktop
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 768 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const allItems = [
    ...navItems.map((i) => ({ ...i, extra: false })),
    ...extraNav.map((i) => ({ ...i, extra: true })),
  ];
  // Logado: o item "Painel" dá lugar ao nome do usuário (menu de conta).
  const visibleItems = account
    ? allItems.filter((i) => !(i.extra && i.label === "Painel"))
    : allItems;

  return (
    <nav
      ref={navRef}
      className={`${logoUrl && logoLightUrl ? "dual-logo" : ""} ${open ? "menu-open" : ""}`.trim() || undefined}
    >
      <a
        href={logoHref}
        className="nav-logo"
        onClick={() => setOpen(false)}
        aria-label={logoText}
      >
        {logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={logoText} className="nav-logo-img nav-logo-img--dark" referrerPolicy="no-referrer" />
            {logoLightUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoLightUrl} alt={logoText} className="nav-logo-img nav-logo-img--light" referrerPolicy="no-referrer" />
            )}
          </>
        ) : (
          logoText
        )}
      </a>

      {/* Links desktop */}
      <ul className="nav-links">
        {visibleItems.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={
                !item.extra
                  ? undefined
                  : item.label === "Painel"
                    ? "nav-extra-link nav-extra-link--painel"
                    : "nav-extra-link"
              }
            >
              {item.label}
              {item.extra && item.label === "Painel" && (
                <span className="nav-badge" title="Teste grátis — explore o painel sem cadastro">
                  Teste grátis
                </span>
              )}
            </a>
          </li>
        ))}

        {/* Conta logada: nome no lugar de "Painel" + menu ao passar o mouse */}
        {account && (
          <li
            ref={accountRef}
            className={`nav-account${accountOpen ? " is-open" : ""}`}
          >
            <button
              type="button"
              className="nav-account-trigger"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAccountOpen(false);
              }}
            >
              <AccountAvatar name={account.name} />
              <span className="nav-account-name">{account.name}</span>
              <svg className="nav-account-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="nav-account-menu" role="menu">
              {account.email && <span className="nav-account-email">{account.email}</span>}
              <a className="nav-account-item" role="menuitem" href={account.panelHref}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="9" rx="1.5" />
                  <rect x="14" y="3" width="7" height="5" rx="1.5" />
                  <rect x="14" y="12" width="7" height="9" rx="1.5" />
                  <rect x="3" y="16" width="7" height="5" rx="1.5" />
                </svg>
                Painel
              </a>
              <a className="nav-account-item nav-account-item--out" role="menuitem" href={account.signOutHref}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sair
              </a>
            </div>
          </li>
        )}
      </ul>

      {/* Painel mobile */}
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
      <div className="nav-mobile" aria-hidden={!open}>
        <ul className="nav-mobile-list">
          {visibleItems.map((item, i) => (
            <li key={item.href} style={{ transitionDelay: `${40 + i * 35}ms` }}>
              <a
                href={item.href}
                className={`nav-mobile-link ${item.extra ? "nav-mobile-extra" : ""} ${item.extra && item.label === "Painel" ? "nav-mobile-link--painel" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-mobile-link-label">{item.label}</span>
                {item.extra && item.label === "Painel" && (
                  <span className="nav-badge nav-badge--mobile" title="Teste grátis — explore o painel sem cadastro">
                    Teste grátis
                  </span>
                )}
                {!item.extra && <span className="nav-mobile-arrow">→</span>}
              </a>
            </li>
          ))}

          {/* Conta logada no drawer: sem hover no mobile — ações sempre visíveis */}
          {account && (
            <li
              className="nav-mobile-account"
              style={{ transitionDelay: `${40 + visibleItems.length * 35}ms` }}
            >
              <div className="nav-mobile-account-head">
                <AccountAvatar name={account.name} />
                <span className="nav-mobile-account-text">
                  <span className="nav-mobile-account-name">{account.name}</span>
                  {account.email && <span className="nav-mobile-account-email">{account.email}</span>}
                </span>
              </div>
              <div className="nav-mobile-account-actions">
                <a
                  href={account.panelHref}
                  className="nav-mobile-link nav-mobile-account-link"
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-mobile-link-label">Painel</span>
                  <span className="nav-mobile-arrow">→</span>
                </a>
                <a
                  href={account.signOutHref}
                  className="nav-mobile-link nav-mobile-account-link nav-mobile-account-link--out"
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-mobile-link-label">Sair</span>
                </a>
              </div>
            </li>
          )}
        </ul>
      </div>

      <button
        type="button"
        className="hamburger"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>
    </nav>
  );
}
