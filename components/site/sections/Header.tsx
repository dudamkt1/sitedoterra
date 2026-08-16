"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleMobileMenu() {
    const links = document.querySelector("#tenant-site .nav-links") as HTMLElement | null;
    if (links) links.style.display = links.style.display === "flex" ? "none" : "flex";
  }

  return (
    <nav ref={navRef} className={logoUrl && logoLightUrl ? "dual-logo" : undefined}>
      <a href="#hero" className="nav-logo">
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
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
        {extraNav.map((item) => (
          <li key={item.href}>
            <a href={item.href} className={item.className || "nav-extra-link"}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <button className="hamburger" onClick={toggleMobileMenu} aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </nav>
  );
}
