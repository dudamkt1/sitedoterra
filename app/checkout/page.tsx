import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import CheckoutPageClient from "./CheckoutPageClient";
import "@/app/(site)/site.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — Ative seu site | TopConsultores",
  description: "Finalize sua contratação com pagamento seguro. Ativação imediata após confirmação.",
  robots: { index: false, follow: false },
};

function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#eef2ee] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between gap-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0" aria-label="Kero Impresso">
          <span className="w-[36px] h-[36px] flex items-center justify-center">
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M14 0C14 0 4.5 9.2 4.5 18.2C4.5 24.5 8.7 28.8 14 28.8C19.3 28.8 23.5 24.5 23.5 18.2C23.5 9.2 14 0 14 0Z" stroke="#C9A84C" strokeWidth="1.6" fill="none" />
              <path d="M14 5.5C14 5.5 7.2 12.2 7.2 18.5C7.2 22.8 10.1 26 14 26C17.9 26 20.8 22.8 20.8 18.5C20.8 12.2 14 5.5 14 5.5Z" stroke="#C9A84C" strokeWidth="1.3" fill="none" />
              <path d="M13.2 10.5C13.2 10.5 9.5 14.2 9.5 18C9.5 20.2 11.1 23.1 13.2 24.2" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M14.8 10.5C14.8 10.5 18.5 14.2 18.5 18C18.5 20.2 16.9 23.1 14.8 24.2" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M14 26V28.8" stroke="#C9A84C" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9.8 28.2C9.8 28.2 11.2 30 14 30C16.8 30 18.2 28.2 18.2 28.2" stroke="#C9A84C" strokeWidth="1.3" fill="none" />
            </svg>
          </span>
        </a>

        {/* Nav center - hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-8">
          <a href="/#ia" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#6b7a89] hover:text-[#143d2e] transition-colors">Especialista IA</a>
          <a href="/#depoimentos" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#162032] font-semibold">Depoimentos</a>
          <a href="/#historia" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#6b7a89] hover:text-[#143d2e] transition-colors">História</a>
          <a href="/#agendamento" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#6b7a89] hover:text-[#143d2e] transition-colors">Agendar</a>
          <a href="/#produtos" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#6b7a89] hover:text-[#143d2e] transition-colors">Produtos</a>
          <a href="/#faq" className="text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#6b7a89] hover:text-[#143d2e] transition-colors">Dúvidas</a>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/painel"
            className="hidden sm:inline-flex items-center justify-center px-[18px] h-[36px] rounded-full border border-[#d7ddd6] bg-white text-[12px] font-semibold tracking-[0.06em] uppercase text-[#2d4a3a] hover:bg-[#f6f8f6] hover:border-[#c5d1c3] transition-colors"
          >
            Painel
          </a>
          <a
            href="/#planos"
            className="inline-flex items-center justify-center px-[16px] sm:px-[20px] h-[36px] rounded-full bg-[#103d2d] hover:bg-[#0e3326] text-white text-[12px] font-semibold tracking-[0.06em] uppercase shadow-[0_2px_10px_rgba(16,61,45,0.18)] transition-colors"
          >
            Teste Grátis
          </a>
          {/* mobile hamburger placeholder - just visual */}
          <button className="lg:hidden ml-1 w-9 h-9 rounded-xl bg-[#f3f5f3] flex items-center justify-center text-[#103d2d]" aria-label="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function CheckoutFooter() {
  const year = 2025;
  return (
    <footer className="bg-[#0a2e22] border-t border-[#0e3a2d]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row items-center lg:items-center justify-between gap-6">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <span className="w-[36px] h-[36px] flex items-center justify-center shrink-0">
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M14 0C14 0 4.5 9.2 4.5 18.2C4.5 24.5 8.7 28.8 14 28.8C19.3 28.8 23.5 24.5 23.5 18.2C23.5 9.2 14 0 14 0Z" stroke="#C9A84C" strokeWidth="1.6" fill="none" />
              <path d="M14 5.5C14 5.5 7.2 12.2 7.2 18.5C7.2 22.8 10.1 26 14 26C17.9 26 20.8 22.8 20.8 18.5C20.8 12.2 14 5.5 14 5.5Z" stroke="#C9A84C" strokeWidth="1.3" fill="none" />
              <path d="M13.2 10.5C13.2 10.5 9.5 14.2 9.5 18C9.5 20.2 11.1 23.1 13.2 24.2" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M14.8 10.5C14.8 10.5 18.5 14.2 18.5 18C18.5 20.2 16.9 23.1 14.8 24.2" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M14 26V28.8" stroke="#C9A84C" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M9.8 28.2C9.8 28.2 11.2 30 14 30C16.8 30 18.2 28.2 18.2 28.2" stroke="#C9A84C" strokeWidth="1.3" fill="none" />
            </svg>
          </span>
          <div className="text-left">
            <p className="text-[13px] leading-4 text-white font-medium">Comece seu site profissional agora.</p>
            <p className="text-[12.5px] leading-4 text-white/80">Pagamento seguro e ativação imediata.</p>
          </div>
        </div>

        <p className="text-[11.5px] leading-4 text-white/60 text-center lg:text-center order-last lg:order-none">
          © {year} Kero Impresso. Todos os direitos reservados.
        </p>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[12.5px] leading-4 font-semibold text-white">Suporte via WhatsApp</p>
            <p className="text-[11.5px] leading-4 text-white/70">Após a confirmação da compra.</p>
          </div>
          <a
            href="https://wa.me/5599999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#1fb560] hover:bg-[#1aa052] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-colors shrink-0"
            aria-label="WhatsApp"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M19.05 4.94A9.91 9.91 0 0 0 12.03 2C6.53 2 2.04 6.48 2.04 11.97c0 1.76.46 3.48 1.33 5L2 22l5.2-1.36a9.96 9.96 0 0 0 4.83 1.23h.01c5.5 0 9.99-4.48 9.99-9.97 0-2.67-1.04-5.17-2.98-7l.01.04ZM12.04 20.3h-.01a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.09.81.83-3.01-.2-.31a8.17 8.17 0 0 1-1.26-4.49c0-4.53 3.71-8.23 8.27-8.23 2.21 0 4.28.86 5.84 2.42a8.18 8.18 0 0 1 2.41 5.81c0 4.53-3.71 8.23-8.29 8.23Zm6.77-6.12c-.37-.19-2.19-1.08-2.53-1.2-.34-.12-.59-.19-.83.19-.24.37-.96 1.2-1.18 1.45-.22.24-.43.27-.8.09-.37-.19-1.56-.57-2.97-1.83-.11-.1-.22-.2-.32-.3-.92-.82-1.53-1.83-1.71-2.14-.18-.31-.02-.48.13-.63.14-.14.37-.36.55-.54.18-.19.24-.31.37-.52.12-.2.06-.37-.03-.56-.09-.19-.83-2-1.14-2.75-.3-.72-.6-.62-.83-.63l-.71-.01c-.24 0-.63.09-.96.37-.33.27-1.26 1.23-1.26 2.99s1.29 3.47 1.47 3.71c.18.24 2.54 3.88 6.16 5.44.86.37 1.53.59 2.05.76.86.27 1.64.23 2.26.14.69-.1 2.19-.89 2.5-1.75.31-.86.31-1.6.22-1.75-.09-.15-.34-.24-.71-.43Z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: { planId?: string; plan?: string };
}) {
  await getCurrentUser();
  const planId = searchParams?.planId || searchParams?.plan || undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfcfa]">
      <CheckoutHeader />
      <main className="flex-1 bg-[#fdfcfa] pt-6 sm:pt-8 pb-8 sm:pb-10">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="max-w-[640px] mx-auto py-12 text-center text-sm text-slate-500">Carregando checkout...</div>}>
            <CheckoutPageClient planIdParam={planId} />
          </Suspense>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  );
}
