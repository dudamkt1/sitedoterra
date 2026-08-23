"use client";

import { useEffect, useRef, useState } from "react";

export interface HeaderProps {
  logoText?: string;
  logoUrl?: string;
  /** Logo alternativa para quando o menu fica com fundo claro (ao rolar a página). */
  logoLightUrl?: string;
  navItems: { label: string; href: string }[];
  extraNav?: { label: string; href: string; className?: string }[];
}

export function Header({ logoText = "Logo", logoUrl, logoLightUrl, navItems, extraNav = [] }: HeaderProps) {
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

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

  return (
    <nav
      ref={navRef}
      className={`${logoUrl && logoLightUrl ? "dual-logo" : ""} ${open ? "menu-open" : ""}`.trim() || undefined}
    >
      <a
        href="#hero"
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
        {allItems.map((item) => (
          <li key={item.href}>
            <a href={item.href} className={!item.extra ? undefined : "nav-extra-link"}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Painel mobile */}
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
      <div className="nav-mobile" aria-hidden={!open}>
        <ul className="nav-mobile-list">
          {allItems.map((item, i) => (
            <li key={item.href} style={{ transitionDelay: `${40 + i * 35}ms` }}>
              <a
                href={item.href}
                className={`nav-mobile-link ${item.extra ? "nav-mobile-extra" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
                {!item.extra && <span className="nav-mobile-arrow">→</span>}
              </a>
            </li>
          ))}
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
