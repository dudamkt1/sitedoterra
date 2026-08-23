"use client";

import { useDemoStore } from "@/lib/demo/store";

const SECTION_LABELS: Record<keyof import("@/lib/demo/types").DemoSections, string> = {
  hero: "Hero / Apresentação",
  stats: "Estatísticas",
  about: "Sobre",
  products: "Produtos",
  testimonials: "Depoimentos",
  history: "História",
  faq: "Perguntas Frequentes",
  schedule: "Agendamento",
  cta: "Chamada para ação",
};

export function PainelDemoMeuSite() {
  const { ready, data, update } = useDemoStore();

  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  const site = data.site;
  const sections = data.sections;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="card-title mb-1">Identidade do site</h2>
        <p className="text-sm text-gray-500 mb-4">
          Estes dados definem o cabeçalho, rodapé e a identidade visual da sua home pública.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Título do site">
            <input
              type="text"
              className="input"
              value={site.site_title}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, site_title: e.target.value } }))}
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              className="input"
              value={site.name}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, name: e.target.value } }))}
            />
          </Field>
          <Field label="Sobrenome">
            <input
              type="text"
              className="input"
              value={site.surname}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, surname: e.target.value } }))}
            />
          </Field>
          <Field label="Função">
            <input
              type="text"
              className="input"
              value={site.role}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, role: e.target.value } }))}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="text"
              className="input"
              value={site.whatsapp}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, whatsapp: e.target.value } }))}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              className="input"
              value={site.email}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, email: e.target.value } }))}
            />
          </Field>
          <Field label="Instagram">
            <input
              type="text"
              className="input"
              value={site.instagramHandle}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  site: { ...d.site, instagramHandle: e.target.value, instagram: e.target.value.replace(/^@/, "") },
                }))
              }
            />
          </Field>
          <Field label="Eyebrow (linha acima do título)">
            <input
              type="text"
              className="input"
              value={site.eyebrow}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, eyebrow: e.target.value } }))}
            />
          </Field>
          <Field label="Selo (título)" full>
            <input
              type="text"
              className="input"
              value={site.badgeTitle}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, badgeTitle: e.target.value } }))}
            />
          </Field>
          <Field label="Selo (subtítulo)" full>
            <input
              type="text"
              className="input"
              value={site.badgeSubtitle}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, badgeSubtitle: e.target.value } }))}
            />
          </Field>
          <Field label="Descrição" full>
            <textarea
              className="input min-h-[100px]"
              value={site.description}
              onChange={(e) => update((d) => ({ ...d, site: { ...d.site, description: e.target.value } }))}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-1">Aparência</h2>
        <p className="text-sm text-gray-500 mb-4">
          Defina o logo e as cores principais da sua identidade visual.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Modo do logo">
            <select
              className="input"
              value={site.logoMode}
              onChange={(e) =>
                update((d) => ({ ...d, site: { ...d.site, logoMode: e.target.value as "text" | "image" } }))
              }
            >
              <option value="text">Texto</option>
              <option value="image">Imagem</option>
            </select>
          </Field>
          {site.logoMode === "text" ? (
            <Field label="Texto do logo">
              <input
                type="text"
                className="input"
                value={site.logoText}
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, logoText: e.target.value } }))}
              />
            </Field>
          ) : (
            <Field label="URL da imagem do logo">
              <input
                type="text"
                className="input"
                value={site.logoUrl}
                placeholder="https://..."
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, logoUrl: e.target.value } }))}
              />
            </Field>
          )}
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded border border-gray-200"
                value={site.primaryColor}
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, primaryColor: e.target.value } }))}
              />
              <input
                type="text"
                className="input"
                value={site.primaryColor}
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, primaryColor: e.target.value } }))}
              />
            </div>
          </Field>
          <Field label="Cor de destaque">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 rounded border border-gray-200"
                value={site.accentColor}
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, accentColor: e.target.value } }))}
              />
              <input
                type="text"
                className="input"
                value={site.accentColor}
                onChange={(e) => update((d) => ({ ...d, site: { ...d.site, accentColor: e.target.value } }))}
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-1">Seções da Home</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ative ou desative as seções visíveis na sua página pública.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(sections) as Array<keyof typeof sections>).map((k) => (
            <label
              key={k}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-gray-700">{SECTION_LABELS[k]}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1d5c3a]"
                checked={sections[k]}
                onChange={(e) =>
                  update((d) => ({ ...d, sections: { ...d.sections, [k]: e.target.checked } }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="card border-emerald-200 bg-emerald-50/40">
        <p className="text-sm text-emerald-900">
          ✓ Alterações salvas automaticamente neste dispositivo. Em produção, elas seriam enviadas ao Supabase e ao R2 reais.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
