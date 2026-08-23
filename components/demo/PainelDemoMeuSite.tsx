"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoStore } from "@/lib/demo/store";
import {
  DEFAULT_SECTION_CONTENT,
  SECTION_TYPE_ICONS,
  SECTION_TYPE_LABELS,
} from "@/lib/site-sections";
import type { SectionType } from "@/types";
import { SectionContentEditor } from "@/components/editors/SectionContentEditor";

const DEMO_SLUG = "demonstracao";
const APP_URL_PLACEHOLDER = "https://seusite.com.br";

const SECTION_ORDER: SectionType[] = [
  "hero",
  "trustbar",
  "about",
  "testimonials",
  "story",
  "video",
  "booking",
  "tips",
  "products",
  "faq",
  "pricing",
];

const REQUIRED_SECTIONS: SectionType[] = [
  "hero",
  "about",
  "testimonials",
  "story",
  "booking",
  "products",
  "faq",
];

const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", placeholder: "ex.: seuperfil (ou link completo)" },
  { key: "facebook", label: "Facebook", placeholder: "ex.: seuperfil (ou link completo)" },
  { key: "youtube", label: "YouTube", placeholder: "ex.: @seucanal (ou link completo)" },
] as const;

function socialUrl(key: "instagram" | "facebook" | "youtube", raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base: Record<string, string> = {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    youtube: "https://youtube.com/",
  };
  return `${base[key]}${value.replace(/^@/, "")}`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function PainelDemoMeuSite() {
  const { ready, data, update } = useDemoStore();
  const [appUrl, setAppUrl] = useState(APP_URL_PLACEHOLDER);
  const [editing, setEditing] = useState<SectionType | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const fileTarget = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setAppUrl(window.location.origin);
  }, []);

  // Indicador "salvo" que pisca após cada alteração
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [data]);

  const sections = useMemo(
    () => SECTION_ORDER.filter((t) => data?.sections?.[t]),
    [data]
  );
  const isCustomized = (type: SectionType) =>
    Boolean(data?.sections?.[type]) &&
    JSON.stringify(data!.sections[type].content) !==
      JSON.stringify(DEFAULT_SECTION_CONTENT[type]);

  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const site = data.site;

  function patchSite(patch: Partial<typeof site>) {
    update((d) => ({ ...d, site: { ...d.site, ...patch } }));
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !fileTarget.current) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      patchSite({ [fileTarget.current]: dataUrl } as Partial<typeof site>);
    } catch {
      // ignora falha de leitura
    }
    fileTarget.current = null;
  }

  function ImageField({
    label,
    fieldKey,
    hint,
  }: {
    label: string;
    fieldKey: "logoUrl" | "logoLightUrl" | "faviconUrl";
    hint?: string;
  }) {
    const value = String(site[fieldKey] || "");
    return (
      <div>
        <label className="label">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input flex-1"
            value={value}
            placeholder="URL da imagem ou envie do dispositivo"
            onChange={(e) => patchSite({ [fieldKey]: e.target.value } as Partial<typeof site>)}
          />
          <button
            type="button"
            className="btn btn-outline !py-1.5 !px-3 !text-xs shrink-0"
            onClick={() => {
              fileTarget.current = fieldKey;
              fileInputRef.current?.click();
            }}
          >
            📁 Enviar
          </button>
        </div>
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        {value && (
          <div className="mt-2 rounded-lg bg-gray-50 p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="h-10 w-auto max-w-56 object-contain" referrerPolicy="no-referrer" />
            <button
              type="button"
              className="block mt-1 text-xs text-red-600 hover:underline"
              onClick={() => patchSite({ [fieldKey]: "" } as Partial<typeof site>)}
            >
              Remover imagem
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

      {/* ---------- URL pública (FIXA na demonstração) ---------- */}
      <div className="card">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="card-title mb-0">Nome de usuário e URL</h2>
          <span className="badge badge-gray">🔒 Fixo na demonstração</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Aqui é só um endereço de exemplo para você explorar o painel.
        </p>

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">
            URL pública atual
          </p>
          <a href={`/${DEMO_SLUG}`} target="_blank" rel="noreferrer" className="text-sm text-[#1d5c3a] underline break-all">
            {appUrl}/{DEMO_SLUG} ↗
          </a>
        </div>

        <div className="mt-4 rounded-xl border border-[#cfe8d8] bg-gradient-to-br from-[#f2faf5] to-[#faf8f2] p-4">
          <p className="text-sm font-semibold text-[#1d5c3a] mb-1">
            💚 Ao adquirir seu SITE DOTERRA, esse campo vira seu!
          </p>
          <ul className="text-xs text-gray-700 space-y-1.5 leading-relaxed">
            <li>
              ✅ Você escolhe o <strong>seu próprio nome de usuário</strong>: seu site fica em{" "}
              <strong>seusite.com/seu-nome</strong> (ex.: /joao, /anabeatriz).
            </li>
            <li>
              ✅ Pode vincular um <strong>domínio próprio</strong> (ex.: <strong>www.suamarca.com.br</strong>)
              direto pelo painel, sem mexer em código.
            </li>
            <li>
              ✅ Na demonstração o endereço é fixo — no seu site real, essa edição fica{" "}
              <strong>100% liberada</strong>.
            </li>
          </ul>
        </div>
      </div>

      {/* ---------- Logo do site ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Logo do site</h2>
        <p className="text-sm text-gray-500 mb-4">
          A logo aparece no menu superior do seu site. Escolha uma <strong>imagem</strong> ou use o <strong>texto</strong>.
        </p>

        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-gray-500">Exibir como:</span>
          {(["text", "image"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn !py-1.5 !px-4 !text-sm ${site.logoMode === mode ? "btn-primary" : "btn-outline"}`}
              onClick={() => patchSite({ logoMode: mode })}
            >
              {mode === "image" ? "🖼️ Imagem" : "🔤 Texto"}
            </button>
          ))}
        </div>

        {site.logoMode === "image" && (
          <>
            <ImageField
              label="Imagem da logo"
              fieldKey="logoUrl"
              hint="PNG/SVG com fundo transparente, horizontal (ex.: 200×48px). Exibida com até 220×44px."
            />
            <div className="mt-4">
              <ImageField
                label="Logo para fundo claro"
                fieldKey="logoLightUrl"
                hint="Usada quando o menu passa a ter fundo claro ao rolar a página."
              />
            </div>
          </>
        )}

        <div className="mt-4">
          <label className="label">Nome / Texto do logo</label>
          <input
            type="text"
            className="input"
            value={site.logoText}
            placeholder="ex.: Ana Beatriz"
            onChange={(e) => patchSite({ logoText: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">
            Usado quando a exibição é por texto (e como texto alternativo da imagem).
          </p>
        </div>
      </div>

      {/* ---------- Favicon ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Favicon (ícone do navegador)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pequeno ícone que aparece na <strong>aba do navegador</strong> e ao favoritar seu site.
        </p>
        <ImageField label="Imagem do favicon" fieldKey="faviconUrl" hint="Envie PNG, ICO ou SVG quadrado (ex.: 512×512px)." />
      </div>

      {/* ---------- Informações do site ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Informações do site</h2>
        <p className="text-sm text-gray-500 mb-5">Estas informações aparecem no seu site público.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Nome" value={site.name} onChange={(v) => patchSite({ name: v, fullName: `${v} ${site.surname}`.trim() })} />
          <TextField label="Sobrenome" value={site.surname} onChange={(v) => patchSite({ surname: v, fullName: `${site.name} ${v}`.trim() })} />
          <TextField label="Título / Cargo" value={site.role} onChange={(v) => patchSite({ role: v })} />
          <TextField label="Subtítulo do topo" value={site.eyebrow} onChange={(v) => patchSite({ eyebrow: v })} />
          <TextField label="WhatsApp" value={site.whatsapp} onChange={(v) => patchSite({ whatsapp: v })} />
          <TextField label="E-mail" type="email" value={site.email} onChange={(v) => patchSite({ email: v })} />
          <TextField label="Usuário do Instagram (sem @)" value={site.instagram} onChange={(v) => patchSite({ instagram: v })} />
          <TextField label="Mostrar como (com @)" value={site.instagramHandle} onChange={(v) => patchSite({ instagramHandle: v })} />
          <div className="sm:col-span-2">
            <label className="label">Descrição principal</label>
            <textarea
              className="input min-h-24"
              value={site.description}
              onChange={(e) => patchSite({ description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Selo sobre a foto</p>
            <p className="text-xs text-gray-400 mb-2">
              Aparece flutuando sobre a foto no topo do seu site (ex.: &quot;Certified Wellness&quot;).
            </p>
          </div>
          <TextField label="Título do selo" value={site.badgeTitle} onChange={(v) => patchSite({ badgeTitle: v })} />
          <TextField label="Subtítulo do selo" value={site.badgeSubtitle} onChange={(v) => patchSite({ badgeSubtitle: v })} />
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField label="Anos de experiência" value={site.stats.years} onChange={(v) => patchSite({ stats: { ...site.stats, years: v } })} />
            <TextField label="Clientes atendidas" value={site.stats.clients} onChange={(v) => patchSite({ stats: { ...site.stats, clients: v } })} />
            <TextField label="Satisfação" value={site.stats.satisfaction} onChange={(v) => patchSite({ stats: { ...site.stats, satisfaction: v } })} />
          </div>
        </div>
      </div>

      {/* ---------- Redes sociais ---------- */}
      <div className="card">
        <h2 className="card-title mb-1">Redes sociais</h2>
        <p className="text-sm text-gray-500 mb-5">
          Ative as redes que aparecem no rodapé do seu site e informe o endereço.
        </p>
        <div className="space-y-3">
          {SOCIAL_NETWORKS.map((net) => {
            const item = site.social[net.key];
            return (
              <div key={net.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{net.label}</p>
                    <p className="text-xs text-gray-400 break-all">{net.placeholder}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patchSite({
                        social: {
                          ...site.social,
                          [net.key]: { ...item, enabled: !item.enabled },
                        },
                      })
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${item.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                    title={item.enabled ? "Desativar" : "Ativar"}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${item.enabled ? "left-[1.4rem]" : "left-0.5"}`} />
                  </button>
                </div>
                {item.enabled && (
                  <input
                    type="text"
                    className="input mt-3"
                    value={item.url}
                    placeholder={net.placeholder}
                    onChange={(e) =>
                      patchSite({
                        social: {
                          ...site.social,
                          [net.key]: { ...item, url: e.target.value },
                        },
                      })
                    }
                    onBlur={(e) =>
                      patchSite({
                        social: {
                          ...site.social,
                          [net.key]: { ...item, url: socialUrl(net.key, e.target.value) },
                        },
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Minha Home / Seções ---------- */}
      <div className="card">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="card-title mb-0">Minha Home</h2>
          {savedFlash && (
            <span className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-1">
              ✓ Salvo neste dispositivo
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Ative, desative e personalize cada seção da sua página inicial — exatamente como no painel real.
        </p>

        <div className="space-y-2">
          {sections.map((type) => {
            const state = data.sections[type];
            const customized = isCustomized(type);
            const required = REQUIRED_SECTIONS.includes(type);
            return (
              <div key={type} className="rounded-xl border border-gray-200 bg-white !p-4 flex items-center gap-3">
                <span className="text-2xl">{SECTION_TYPE_ICONS[type] || "📄"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{SECTION_TYPE_LABELS[type]}</span>
                    {required && <span className="badge badge-yellow">Obrigatória</span>}
                    {customized && <span className="badge badge-blue">Personalizada</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {state.enabled ? "Ativa" : "Desativada"} · #{type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      sections: {
                        ...d.sections,
                        [type]: { ...d.sections[type], enabled: !d.sections[type].enabled },
                      },
                    }))
                  }
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${state.enabled ? "bg-[#1d5c3a]" : "bg-gray-300"}`}
                  title={state.enabled ? "Desativar seção" : "Ativar seção"}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${state.enabled ? "left-[1.25rem]" : "left-0.5"}`} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline !py-1.5 !px-3 !text-xs shrink-0"
                  onClick={() => {
                    setEditing(type);
                    setDraft(JSON.parse(JSON.stringify(state.content)));
                  }}
                >
                  Editar
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card border-emerald-200 bg-emerald-50/40">
        <p className="text-sm text-emerald-900">
          ✓ Tudo o que você editar aqui fica salvo <strong>apenas neste navegador/celular</strong> — nenhum
          site real é alterado. No seu site definitivo, essas mesmas telas salvam tudo automaticamente.
        </p>
      </div>

      {/* ---------- Modal de edição de seção ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl my-8">
            <div className="flex items-center justify-between mb-1">
              <h3 className="card-title">
                {SECTION_TYPE_ICONS[editing]} Editar — {SECTION_TYPE_LABELS[editing]}
              </h3>
              <button type="button" className="text-gray-400 text-xl" onClick={() => setEditing(null)}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              As alterações entram em vigor nesta demonstração ao clicar em Salvar (somente neste dispositivo).
            </p>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <SectionContentEditor
                sectionType={editing}
                value={draft}
                onChange={setDraft}
                mediaScope="tenant"
                disableLibrary
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  update((d) => ({
                    ...d,
                    sections: {
                      ...d.sections,
                      [editing]: { ...d.sections[editing], content: draft },
                    },
                  }));
                  setEditing(null);
                }}
              >
                Salvar seção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
