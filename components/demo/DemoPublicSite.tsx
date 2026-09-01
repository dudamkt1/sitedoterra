"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHome } from "@/components/site/SiteHome";
import type { ResolvedHomeSection } from "@/types";
import { loadDemoData } from "@/lib/demo/storage";
import { DEMO_SECTION_TYPES } from "@/lib/demo/seed";
import { anchorFor, DEFAULT_SECTION_CONTENT } from "@/lib/site-sections";
import type { DemoData } from "@/lib/demo/types";
import type { SectionType } from "@/types";
import { DemoFetchBridge } from "@/components/demo/DemoFetchBridge";

const HEADER_FOOTER: SectionType[] = ["header", "footer"];
const NAV_TYPES = ["about", "testimonials", "story", "booking", "products", "faq"];

const NAV_LABELS: Partial<Record<SectionType, string>> = {
  about: "Especialista IA",
  testimonials: "Depoimentos",
  story: "História",
  booking: "Agendamento",
  products: "Produtos",
  faq: "Dúvidas",
};

const LABELS: Record<string, string> = {
  header: "Cabeçalho / Menu",
  hero: "Hero principal",
  trustbar: "Barra de destaque",
  about: "Especialista IA doTERRA",
  testimonials: "Depoimentos",
  story: "História / Sobre",
  video: "Vídeo / Conteúdo",
  booking: "Agendamento",
  tips: "Dicas / Rotinas",
  products: "Produtos em destaque",
  faq: "Perguntas frequentes",
  pricing: "Planos / Oferta",
  footer: "Rodapé",
};

function mergeContent(
  base: Record<string, unknown>,
  saved?: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  if (!saved) return out;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v) &&
        out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = mergeContent(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildSections(demo: DemoData): ResolvedHomeSection[] {
  const types: SectionType[] = [
    "header",
    ...DEMO_SECTION_TYPES,
    "footer",
  ];

  return types.map((type, idx) => {
    const base = JSON.parse(JSON.stringify(DEFAULT_SECTION_CONTENT[type]));
    const savedState = demo.sections[type];
    let enabled = true;
    let content = base;

    if (savedState) {
      enabled = savedState.enabled;
      // Remove nulls salvos para que melhorias nos padrões (ex.: novas
      // imagens padrão) cheguem a quem já tinha demonstração iniciada.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(savedState.content || {})) {
        if (v !== null) cleaned[k] = v;
      }
      content = mergeContent(base, cleaned);
    }

    // Campos globais de "Informações do site" têm prioridade na Hero,
    // espelhando o comportamento do painel real.
    if (type === "hero") {
      content = {
        ...content,
        firstName: demo.site.name || (content.firstName as string),
        lastName: demo.site.surname || (content.lastName as string),
        role: demo.site.role || (content.role as string),
        eyebrow: demo.site.eyebrow || (content.eyebrow as string),
        description: demo.site.description || (content.description as string),
        badgeTitle: demo.site.badgeTitle || (content.badgeTitle as string),
        badgeSubtitle: demo.site.badgeSubtitle || (content.badgeSubtitle as string),
        stats: [
          { value: demo.site.stats.years, label: "Anos de experiência" },
          { value: demo.site.stats.clients, label: "Clientes atendidas" },
          { value: demo.site.stats.satisfaction, label: "Satisfação" },
        ].filter((s) => Boolean(s.value)),
      };
    }

    if (type === "header") {
      content = { logoText: demo.site.logoText };
    }

    if (type === "footer") {
      content = {
        aboutText: `${demo.site.fullName} — ${demo.site.role}. Bem-estar natural com óleos essenciais.`,
        social: demo.site.social,
        showPlatformCredit: true,
      };
    }

    const showInNav = NAV_TYPES.includes(type);
    return {
      id: `demo-${type}`,
      type,
      key: type,
      label: LABELS[type] || type,
      title: null,
      subtitle: null,
      enabled,
      is_required: !["trustbar", "pricing"].includes(type),
      sort_order: (idx + 1) * 10,
      settings: showInNav ? { showInNav: true } : { showInNav: false },
      content,
      permissions: {} as ResolvedHomeSection["permissions"],
      tenant_enabled: enabled,
      tenant_override: Boolean(savedState),
      anchor: anchorFor(type),
      navLabel: showInNav ? NAV_LABELS[type] : undefined,
    } satisfies ResolvedHomeSection;
  });
}

export function DemoPublicSite() {
  const [demo, setDemo] = useState<DemoData | null>(null);

  useEffect(() => {
    setDemo(loadDemoData());
  }, []);

  const sections = useMemo(() => (demo ? buildSections(demo) : []), [demo]);

  if (!demo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f2]">
        <p className="text-sm text-gray-500">Preparando demonstração...</p>
      </div>
    );
  }

  const instagramUrl = demo.site.instagram
    ? /^https?:\/\//i.test(demo.site.instagram)
      ? demo.site.instagram
      : `https://instagram.com/${demo.site.instagram.replace(/^@/, "")}`
    : undefined;

  return (
    <div style={{ position: "relative" }}>
      <DemoFetchBridge />
      {/* Faixa fixa informando que é uma demonstração local */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          maxWidth: "calc(100vw - 24px)",
        }}
        className="rounded-full bg-[#1d5c3a] text-white text-xs font-semibold shadow-lg px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis"
      >
        👀 Demonstração — altere tudo no painel e veja aqui · salvo só neste dispositivo ·{" "}
        <a href="/cadastro" className="underline">Quero meu site</a>
      </div>

      <SiteHome
        slug="demonstracao"
        sections={sections}
        contact={{
          whatsapp: demo.site.whatsapp?.replace(/[^\d]/g, "") || undefined,
          whatsapp_floating_enabled: demo.site.whatsapp_floating_enabled ?? false,
          email: demo.site.email || undefined,
          instagram: instagramUrl,
          profileName: demo.site.fullName || undefined,
        }}
        logo={{
          mode: demo.site.logoMode,
          url: demo.site.logoMode === "image" ? demo.site.logoUrl || undefined : undefined,
          lightUrl: demo.site.logoLightUrl || undefined,
          text: demo.site.logoText || undefined,
        }}
        extraNav={[{ label: "Quero meu site", href: "/cadastro" }]}
      />
    </div>
  );
}
