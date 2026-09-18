"use client";

import Link from "next/link";

export function SiteActivationRequired() {
  return (
    <div className="card max-w-2xl mx-auto mt-10 text-center">
      <div className="p-10">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-6">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Ative seu site para desbloquear todo o painel
        </h1>

        <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
          Seu site ainda não está ativo. Enquanto isso, você tem acesso apenas ao
          <strong>programa de Afiliados</strong> — divulgue seu link e ganhe comissões
          desde já!
        </p>

        <div className="space-y-4 mb-8 p-6 rounded-xl bg-gradient-to-r from-[#1d5c3a]/5 to-[#2d7a4f]/5 border border-[#1d5c3a]/20">
          <div className="flex items-center justify-center gap-3 text-sm text-gray-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1d5c3a] font-bold">1</span>
            <span>Acesse <Link href="/painel/assinatura" className="font-semibold text-[#1d5c3a] underline hover:text-[#2d7a4f]">Assinatura</Link> e escolha seu plano</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-sm text-gray-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1d5c3a] font-bold">2</span>
            <span>Conclua o pagamento da ativação (R$ 297,00)</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-sm text-gray-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1d5c3a] font-bold">3</span>
            <span>Seu site vai ao ar automaticamente e <strong>todas as ferramentas são liberadas</strong></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/painel/assinatura"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1d5c3a] to-[#2d7a4f] px-6 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(29,92,58,0.3)] hover:shadow-[0_12px_28px_rgba(29,92,58,0.4)] transition-all"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Ativar meu site agora
          </Link>

          <Link
            href="/painel/afiliados"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#1d5c3a] px-6 py-3.5 text-base font-semibold text-[#1d5c3a] bg-white hover:bg-[#f0fdf4] transition-all"
          >
            Continuar como Afiliado
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Após a ativação, você terá acesso a: <strong>Meu Site, Checklist, Agendamentos, CRM, IA, Mídias, PWA, Domínio, Pagamentos e mais.</strong>
        </p>
      </div>
    </div>
  );
}