"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHome } from "@/components/site/SiteHome";
import type { ResolvedHomeSection } from "@/types";
import { loadDemoData } from "@/lib/demo/storage";
import { DEMO_SECTION_TYPES, buildDemoSeed } from "@/lib/demo/seed";
import { diffAgainstSeed, buildDemoSite } from "@/lib/demo/model-diff";
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

export interface DemoModelSection {
  type: string;
  enabled: boolean;
  content: Record<string, unknown>;
}

function buildSections(
  demo: DemoData,
  seed: DemoData,
  site: DemoData["site"],
  model?: { site: Record<string, unknown>; sections: DemoModelSection[] } | null
): ResolvedHomeSection[] {
  const modelByType = new Map((model?.sections || []).map((s) => [s.type, s]));

  const types: SectionType[] = [
    "header",
    ...DEMO_SECTION_TYPES,
    "footer",
  ];

  return types.map((type, idx) => {
    const modelEntry = modelByType.get(type);
    // Base viva: conteúdo atual do modelo; sem modelo, o padrão estático.
    const base = JSON.parse(
      JSON.stringify(modelEntry?.content ?? DEFAULT_SECTION_CONTENT[type] ?? {})
    ) as Record<string, unknown>;
    const seedContent = ((seed.sections as Record<string, { content: Record<string, unknown> }>)[type]?.content ?? {}) as Record<string, unknown>;
    const savedState = demo.sections[type];
    // Só as edições reais do visitante sobem por cima do modelo.
    const diff = savedState ? diffAgainstSeed((savedState.content || {}) as Record<string, unknown>, seedContent) : {};
    // Visibilidade: o modelo pode desligar; o visitante também — mas o
    // visitante não religa o que o modelo desligou.
    let enabled = modelEntry?.enabled !== false;
    if (savedState) enabled = enabled && savedState.enabled !== false;
    let content = mergeContent(base, diff);

    // Campos globais de "Informações do site" têm prioridade na Hero,
    // espelhando o comportamento do painel real.
    if (type === "hero") {
      content = {
        ...content,
        firstName: site.name || (content.firstName as string),
        lastName: site.surname || (content.lastName as string),
        role: site.role || (content.role as string),
        eyebrow: site.eyebrow || (content.eyebrow as string),
        description: site.description || (content.description as string),
        badgeTitle: site.badgeTitle || (content.badgeTitle as string),
        badgeSubtitle: site.badgeSubtitle || (content.badgeSubtitle as string),
        stats: [
          { value: site.stats.years, label: "Anos de experiência" },
          { value: site.stats.clients, label: "Clientes atendidas" },
          { value: site.stats.satisfaction, label: "Satisfação" },
        ].filter((s) => Boolean(s.value)),
      };
    }

    if (type === "header") {
      // Mantém o logo do modelo quando houver; o texto efetivo (edição local
      // ou modelo ou seed) tem prioridade sobre o conteúdo da seção.
      content = { ...content, logoText: site.logoText || (content.logoText as string) };
    }

    if (type === "footer") {
      content = {
        aboutText: `${site.fullName} — ${site.role}. Bem-estar natural com óleos essenciais.`,
        social: site.social,
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

export function DemoPublicSite({ model }: { model?: { site: Record<string, unknown>; sections: DemoModelSection[] } | null }) {
  const [demo, setDemo] = useState<DemoData | null>(null);

  useEffect(() => {
    setDemo(loadDemoData());
  }, []);

  // Seed estático = linha de base para detectar edições reais do visitante.
  const seed = useMemo(() => buildDemoSeed(), []);
  const site = useMemo(() => (demo ? buildDemoSite(demo, seed, model) : null), [demo, seed, model]);
  const sections = useMemo(
    () => (demo && site ? buildSections(demo, seed, site, model) : []),
    [demo, seed, site, model]
  );

  if (!demo || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f2]">
        <p className="text-sm text-gray-500">Preparando demonstração...</p>
      </div>
    );
  }

  const instagramUrl = site.instagram
    ? /^https?:\/\//i.test(site.instagram)
      ? site.instagram
      : `https://instagram.com/${site.instagram.replace(/^@/, "")}`
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
          whatsapp: site.whatsapp?.replace(/[^\d]/g, "") || undefined,
          whatsapp_floating_enabled: site.whatsapp_floating_enabled ?? false,
          email: site.email || undefined,
          instagram: instagramUrl,
          profileName: site.fullName || undefined,
        }}
        logo={{
          mode: site.logoMode,
          url: site.logoMode === "image" ? site.logoUrl || undefined : undefined,
          lightUrl: site.logoLightUrl || undefined,
          text: site.logoText || undefined,
        }}
        extraNav={[{ label: "Quero meu site", href: "/cadastro" }]}
      />
    </div>
  );
}
