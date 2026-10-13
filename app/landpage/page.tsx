"use client";

import { useEffect } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveHomeTenant } from "@/lib/tenant";
import { siteData } from "@/lib/site-data";
import "@/app/globals.css";

type LandpageData = {
  site_name: string;
  slogan: string;
  benefits: Array<{ title: string; desc: string; icon: string }>;
  social_proof: Array<{ name: string; text: string }>;
  cta_text: string;
  cta_href: string;
  checkout_text: string;
};

const DEFAULT_LANDING: LandpageData = {
  site_name: "TopConsultores",
  slogan: "Sites profissionais para consultoras doTERRA",
  benefits: [
    { title: "Site Profissional", desc: "Design elegante e moderno que passa credibilidade para seus clientes.", icon: "🏪" },
    { title: "IA Especialista doTERRA", desc: "Assistente inteligente que indica os óleos essenciais certos para cada situação.", icon: "🤖" },
    { title: "Agendamento Integrado", desc: "Permita que clientes agendem consultas diretamente no seu site.", icon: "📅" },
    { title: "CRM de Clientes", desc: "Gerencie contatos, histórico e follow-ups em um só lugar.", icon: "📊" },
    { title: "Domínio Próprio", desc: "Tenha seusite.com doTERRA com identidade visual única.", icon: "🌐" },
    { title: "Suporte WhatsApp", desc: "Comunicação direta e rápida com seus clientes.", icon: "💬" },
  ],
  social_proof: [
    { name: "Márcia R.", text: "Meu site ficou incrível! Aumento 30% de agendamentos no primeiro mês." },
    { name: "Juliana S.", text: "A IA do site já indica óleos que meus clientes amam. Prático e eficiente." },
    { name: "Carla M.", text: "Valeu o investimento. Domínio próprio e suporte que funciona." },
  ],
  cta_text: "Quero meu site profissional",
  cta_href: "/checkout",
  checkout_text: "Acessar Checkout",
};

export default function Landpage() {
  const userPromise = getCurrentUser().catch(() => null);

  useEffect(() => {
    document.body.style.background = "#fefcf8";
    document.body.style.color = "#1a1a14";
  }, []);

  // Aplica dados reais do tenant se houver, senão usa defaults
  const [landingData, setLandingData] = (React as any).useState(DEFAULT_LANDING);

  useEffect(() => {
    (async () => {
      try {
        const { tenant } = await resolveHomeTenant();
        const raw = (tenant?.site_data || {}) as Record<string, unknown>;
        const data = { ...DEFAULT_LANDING, ...siteData, ...raw };
        setLandingData(data as LandpageData);
      } catch {
        setLandingData(DEFAULT_LANDING);
      }
    })();
  }, []);

  const { site_name, slogan, benefits, social_proof, cta_text, cta_href, checkout_text } = landingData;

  return (
    <div style={{ background: "#fefcf8", color: "#1a1a14" }}>
      {/* ---------- HEADER ---------- */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/80 backdrop-blur md:hidden" style={{ background: "rgba(254,252,248,0.8)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#hero" className="text-2xl font-bold tracking-tight" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1d5c3a" }}>
            {site_name}
          </a>
          <button className="btn btn-outline hidden md:block" style={{ color: "#1d5c3a" }}>Entrar</button>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section id="hero" className="min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#fefcf8] to-[#ede5d4]">
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" fill="white" opacity="0.1" />
              <circle cx="30" cy="70" r="20" fill="white" opacity="0.08" />
              <circle cx="70" cy="70" r="20" fill="white" opacity="0.08" />
            </svg>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-24 relative">
          <div className="max-w-3xl text-center">
            <div className="inline-block mb-6">
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium" style={{ background: "rgba(29,92,58,0.1)", border: "1px solid rgba(29,92,58,0.3)" }}>
                🌿 Solução completa para consultoras doTERRA
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
              {slogan}
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8" style={{ fontFamily: '"DM Sans", sans-serif', color: "#5a5a52" }}>
              Crie um site profissional para sua consultoria doTERRA em minutos. Com IA especializada, agendamento integrado, CRM completo e domínio próprio. Comece hoje e transforme mais vidas com os óleos essenciais puros.
            </p>

            <div className="hero-cta flex flex-col md:flex-row gap-4 justify-center md:justify-start">
              <a href={cta_href} className="btn btn-primary flex-1">
                {checkout_text}
              </a>
              <a href="#planos" className="btn btn-outline flex-1">
                Ver Planos →
              </a>
            </div>
          </div>

          {/* Decorative elements for hero */}
          <div className="absolute top-0 right-0 opacity-10">
            <svg width="300" height="300" viewBox="0 0 300 300" fill="none" style={{ transform: "rotate(-30deg)" }}>
              <circle cx="150" cy="150" r="120" stroke="#1d5c3a" strokeWidth="1" fill="none" opacity="0.3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ---------- BENEFITS ---------- */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium" style={{ background: "rgba(29,92,58,0.1)", border: "1px solid rgba(29,92,58,0.3)" }}>
              ✨ Benefícios
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
              Por que escolher o TopConsultores?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-300 border-green-100/50"
                style={{
                  borderRadius: "1rem",
                  background: "#fff",
                  border: "1px solid rgba(29,92,58,0.1)",
                }}
              >
                <div className="text-4xl mb-3" style={{ fontSize: "3rem" }}>{b.icon}</div>
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
                  {b.title}
                </h3>
                <p className="text-gray-600 line-clamp-2" style={{ fontFamily: '"DM Sans", sans-serif', color: "#5a5a52" }}>
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SOCIAL PROOF ---------- */}
      <section className="py-20 bg-gray-50 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium" style={{ background: "rgba(29,92,58,0.08)", border: "1px solid rgba(29,92,58,0.2)" }}>
              💬 Depoimentos
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
              Quem já conquistou seu site
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {social_proof.map((s, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white border shadow-sm border-gray-100 hover:border-green-100 transition-colors duration-300">
                <p className="text-gray-700 mb-4 line-clamp-3" style={{ fontFamily: '"DM Sans", sans-serif', color: "#4a4a45" }}>
                  "{s.text}"
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>{s.name}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#1d5c3a" }}
                  >
                    <path d="M5 12h14" />
                    <path d="m19 5-5 5-5-5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PLANS CTA ---------- */}
      <section id="planos" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-gold-100 text-gold-800 text-sm font-medium" style={{ background: "rgba(196,150,58,0.1)", border: "1px solid rgba(196,150,58,0.3)" }}>
              🏆 Planos
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
              Escolha o plano ideal para sua consultoria
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              className="p-6 rounded-2xl border bg-white shadow-sm border-green-100/50 hover:shadow-lg transition-shadow duration-300"
              style={{
                borderRadius: "1rem",
                background: "#fff",
                border: "1px solid rgba(29,92,58,0.1)",
              }}
            >
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1d5c3a" }}">R$ 47</div>
              <div className="text-sm font-medium text-gray-600 mb-1" style={{ color: "#5a5a52" }}>por mês</div>
              <hr className="my-4 border-green-200" />
              <ul className="space-y-3 text-left text-gray-600" style={{ fontFamily: '"DM Sans", sans-serif', color: "#5a5a52" }}>
                <li>Site profissional personalizado</li>
                <li>Chat IA especialista doTERRA</li>
                <li>Agendamento integrado</li>
                <li>CRM de clientes</li>
                <li>Todas as ferramentas</li>
                <li>Suporte por WhatsApp</li>
              </ul>
              <a href={cta_href} className="mt-4 w-full btn btn-primary">
                Assinar Mensal →
              </a>
            </div>

            <div
              className="p-6 rounded-2xl bg-white shadow-lg border border-gold-200 bg-gold-50/50 hover:shadow-xl transition-shadow duration-300"
              style={{
                borderRadius: "1rem",
                background: "rgba(254,242,234,0.5)",
                border: "1px solid rgba(206,150,58,0.3)",
              }}
            >
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#b87333" }}">R$ 564</div>
              <div className="text-sm font-medium text-gray-600 mb-1" style={{ color: "#5a5a52" }}>pagamento único</div>
              <div className="text-green-600 font-medium mb-3" style={{ color: "#1a73e8" }}>
                = R$ 47/mês — Economize 75%
              </div>
              <hr className="my-4 border-gold-200" />
              <ul className="space-y-3 text-left text-gray-600" style={{ fontFamily: '"DM Sans", sans-serif', color: "#5a5a52" }}>
                <li>Tudo do plano mensal</li>
                <li>Domínio próprio incluso</li>
                <li>Base de conhecimento IA</li>
                <li>Relatórios avançados</li>
                <li>Prioridade no suporte</li>
                <li>Novidades em primeira mão</li>
                <li>Suporte dedicado</li>
                <li>12 meses de vantagem</li>
              </ul>
              <a href={cta_href} className="mt-4 w-full btn btn-gold">
                Assinar Anual →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FEATURES GRID ---------- */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mt-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
                Funcionalidades Completas
              </h2>
              <p className="text-gray-600 mb-6" style={{ fontFamily: '"DM Sans", sans-serif', color: "#5a5a52" }}>
                Tudo o que você precisa para transformar visitantes em clientes fiéis. Desde o primeiro contato até o fidelização, temos ferramentas inteligentes que trabalham enquanto você cuida das suas consultoras.
              </p>
              <a href={cta_href} className="inline-block btn btn-primary">
                Começar Agora →
              </a>
            </div>
            <div className="space-y-4">
              {["🤖", "📅", "📊", "🌐", "💬", "📈"].map((icon, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white border border-gray-100 hover:border-green-200 transition-colors duration-300"
                  style={{
                    borderRadius: "0.75rem",
                    background: "#fff",
                  }}
                >
                  <div className="text-3xl mb-2">{icon}</div>
                  <h4 className="font-bold mb-1" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#1a1a14" }}>
                    Funcionalidade {i + 1}
                  </h4>
                  <p className="text-sm text-gray-500" style={{ fontFamily: '"DM Sans", sans-serif', color: "#6b6b5e" }}>
                    Descrição da funcionalidade avançada do sistema TopConsultores.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA SECTION ---------- */}
      <section className="py-24 bg-gradient-to-b from-[#1d5c3a] to-[#0d3a20] relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block px-8 py-4 rounded-full bg-white/20 backdrop-blur-md" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)" }}>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#fff" }}>
              Pronto para transformar sua consultoria?
            </h2>
          </div>
          <p className="text-lg md:text-xl text-white-400 mt-4 max-w-2xl mx-auto">
            Junte-se a dezenas de consultoras doTERRA que já têm seu site profissional. Ativação imediata com trial de 3 meses. Sem risco.
          </p>
          <div className="mt-8">
            <a href={cta_href} className="btn btn-primary text-lg px-8 py-3">
              {checkout_text}
            </a>
            <a href="#planos" className="btn btn-outline text-lg px-8 py-3 mt-4">
              Ver Planos
            </a>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="py-16 bg-gray-800/90 relative" style={{ background: "rgba(26,26,20,0.9)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#fff" }}>TopConsultores</h4>
              <p className="text-gray-300 text-sm" style={{ fontFamily: '"DM Sans", sans-serif', color: "#a0a09a" }}>
                Plataforma de sites para consultoras doTERRA com IA, agendamento e CRM.
              </p>
              <div className="mt-4">
                <a href="#hero" className="text-gray-300 hover:text-white transition-colors" style={{ color: "#a0a09a" }}>
                  Início
                </a>
                <a href="#planos" className="text-gray-300 hover:text-white transition-colors">
                  Planos
                </a>
                <a href="#agendamento" className="text-gray-300 hover:text-white transition-colors">
                  Agendamento
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#fff" }}">Soluções</h4>
              <ul className="space-y-3 text-sm" style={{ fontFamily: '"DM Sans", sans-serif', color: "#a0a09a" }}>
                <li><a href="#produtos" className="hover:text-white transition-colors">Produtos</a></li>
                <li><a href="#ia" className="hover:text-white transition-colors">IA doTERRA</a></li>
                <li><a href="#depoimentos" className="hover:text-white transition-colors">Depoimentos</a></li>
                <li><a href="#historia" className="hover:text-white transition-colors">História</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#fff" }}>Recursos</h4>
              <ul className="space-y-3 text-sm" style={{ fontFamily: '"DM Sans", sans-serif', color: "#a0a09a" }}>
                <li><a href="#planos" className="hover:text-white transition-colors">Planos e Preços</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="https://wa.me/5511999999999" className="hover:text-white transition-colors" target="_blank">
                  WhatsApp
                </a></li>
                <li><a href="#contato" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: "#fff" }}>Redes Sociais</h4>
              <div className="space-y-3">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  target="_blank"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
                  </svg>
                  Instagram
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  target="_blank"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  target="_blank"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                  </svg>
                  YouTube
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700/50 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-300" style={{ fontFamily: '"DM Sans", sans-serif', color: "#70706a" }}>
              © {new Date().getFullYear()} TopConsultores. Todos os direitos reservados.
            </p>
            <div className="flex gap-4 md:gap-6">
              <a
                href="#"
                className="text-gray-300 hover:text-white transition-colors"
                target="_blank"
              >
                Política de Privacidade
              </a>
              <a href="#terminos" className="text-gray-300 hover:text-white transition-colors">
                Termos de Uso
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ---------- TERMINOS LINK ---------- */}
      <a href="#terminos" id="terminos" className="hidden" />
    </div>
  );
}