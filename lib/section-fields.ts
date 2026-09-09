import type { SectionType } from "@/types";

/**
 * Schema de edição estruturada do conteúdo de cada seção.
 * Usado pelo editor do Super Admin e pelo editor do usuário para gerar
 * formulários amigáveis (em vez de editar JSON bruto).
 */

export type ContentFieldType =
  | "text"
  | "textarea"
  | "url"
  | "image"
  | "color"
  | "boolean"
  | "json"
  | "object"
  | "list";

export interface ContentFieldDef {
  key: string;
  label: string;
  type: ContentFieldType;
  placeholder?: string;
  ai?: boolean;
  aiKind?: "title" | "description" | "faq" | "post" | "default";
  itemLabel?: string;
  fields?: ContentFieldDef[];
  /**
   * Quando true e o campo é uma lista simples de strings (sem `fields`),
   * o editor renderiza textarea em vez de input (ex.: parágrafos).
   */
  multiline?: boolean;
}

export const SECTION_CONTENT_FIELDS: Record<SectionType, ContentFieldDef[]> = {
  header: [
    { key: "logoText", label: "Texto da logo", type: "text" },
    { key: "logoUrl", label: "Logo — fundo escuro (topo da página)", type: "image" },
    { key: "logoLightUrl", label: "Logo — fundo claro (menu ao rolar a página)", type: "image" },
  ],
  hero: [
    // Nome, cargo, descrição, selos e estatísticas são gerenciados em
    // "Informações do site" (site_settings) e injetados na Hero — editar aqui
    // congelaria esses valores. O editor da seção cuida do visual:
    { key: "image", label: "Foto (URL)", type: "image" },
    { key: "imageAlt", label: "Texto alternativo da foto", type: "text" },
    {
      key: "primaryBtn", label: "Botão principal", type: "object", fields: [
        { key: "text", label: "Texto", type: "text" },
        { key: "url", label: "Link", type: "url" },
      ],
    },
    {
      key: "secondaryBtn", label: "Botão secundário", type: "object", fields: [
        { key: "text", label: "Texto", type: "text" },
        { key: "url", label: "Link", type: "url" },
      ],
    },
    {
      key: "stats", label: "Estatísticas", type: "list", itemLabel: "Estatística", fields: [
        { key: "value", label: "Valor (ex.: 7+)", type: "text" },
        { key: "label", label: "Rótulo", type: "text" },
      ],
    },
  ],
  trustbar: [
    { key: "badge", label: "Ícone / emoji", type: "text" },
    { key: "title", label: "Título da faixa", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Subtítulo", type: "text" },
    { key: "buttonText", label: "Texto do botão", type: "text" },
    { key: "buttonUrl", label: "Link do botão", type: "url" },
  ],
  about: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Descrição", type: "textarea", ai: true, aiKind: "description" },
    {
      key: "chips", label: "Sugestões rápidas", type: "list", itemLabel: "Sugestão", fields: [
        { key: "emoji", label: "Emoji", type: "text" },
        { key: "label", label: "Rótulo", type: "text" },
      ],
    },
    {
      key: "chat", label: "Assistente (chat)", type: "object", fields: [
        { key: "name", label: "Nome do assistente", type: "text" },
        { key: "status", label: "Status", type: "text" },
        { key: "welcome", label: "Mensagem de boas-vindas", type: "textarea", ai: true, aiKind: "default" },
        { key: "placeholder", label: "Placeholder do campo", type: "text" },
      ],
    },
    {
      key: "knowledge",
      label: "Treinamento da assistente (perguntas e respostas pré-prontas)",
      type: "list",
      itemLabel: "Pergunta/Resposta",
      fields: [
        { key: "keywords", label: "Pergunta (palavras-chave separadas por vírgula)", type: "text" },
        { key: "text", label: "Resposta pronta do assistente", type: "textarea" },
        { key: "oils", label: "Óleos sugeridos (um por linha)", type: "list" },
      ],
    },
  ],
  testimonials: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Subtítulo", type: "text" },
    {
      key: "items", label: "Depoimentos", type: "list", itemLabel: "Depoimento", fields: [
        { key: "text", label: "Texto do depoimento", type: "textarea", ai: true, aiKind: "post" },
        { key: "name", label: "Nome", type: "text" },
        { key: "location", label: "Cidade / estado", type: "text" },
        { key: "initials", label: "Iniciais", type: "text" },
      ],
    },
  ],
  story: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    // IMPORTANTE: paragraphs é string[] em todo o resto do código
    // (DEFAULT_SECTION_CONTENT, StoryContent, seed do banco). Por isso o
    // schema aqui também é uma lista simples de strings (sem `fields`).
    // O formato antigo [{ p: "..." }] corrompia o dado e quebrava a HOME
    // com "Objects are not valid as a React child". O normalizador abaixo
    // e os renderers aceitam ambos os formatos por compatibilidade.
    { key: "paragraphs", label: "Parágrafos", type: "list", itemLabel: "Parágrafo", multiline: true },
    { key: "signature", label: "Assinatura", type: "text" },
    { key: "image", label: "Foto (URL)", type: "image" },
    { key: "imageAlt", label: "Texto alternativo", type: "text" },
    { key: "badgeValue", label: "Número do selo (ex.: 7+)", type: "text" },
    { key: "badgeLabel", label: "Rótulo do selo", type: "text" },
  ],
  video: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Descrição", type: "textarea", ai: true, aiKind: "description" },
    { key: "videoUrl", label: "URL do vídeo (YouTube / Vimeo)", type: "url" },
    { key: "thumbLabel", label: "Rótulo da miniatura", type: "text" },
    { key: "playLabel", label: "Texto do botão reproduzir", type: "text" },
  ],
  booking: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Descrição", type: "textarea" },
    { key: "whatsappText", label: "Mensagem do WhatsApp (use {nome}, {dia}, {mes}, {hora})", type: "textarea" },
    {
      key: "schedule", label: "Calendário", type: "object", fields: [
        { key: "monthLabel", label: "Mês (ex.: Abril 2026)", type: "text" },
        { key: "firstWeekday", label: "Primeiro dia da semana (0 = domingo)", type: "json" },
        { key: "daysInMonth", label: "Dias no mês", type: "json" },
        { key: "available", label: "Dias disponíveis", type: "json" },
        { key: "occupied", label: "Dias ocupados", type: "json" },
        { key: "today", label: "Dia de hoje", type: "json" },
        { key: "slots", label: "Horários", type: "json" },
        { key: "taken", label: "Horários ocupados por dia", type: "json" },
      ],
    },
  ],
  tips: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    // instagramHandle/instagramUrl vêm de "Informações do site" (Instagram) —
    {
      key: "items", label: "Publicações", type: "list", itemLabel: "Publicação", fields: [
        { key: "emoji", label: "Emoji", type: "text" },
        { key: "gradient", label: "Gradiente (CSS)", type: "text" },
      ],
    },
  ],
  products: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "storeUrl", label: "Link da loja", type: "url", placeholder: "https://sualoja.com.br" },
    {
      key: "items", label: "Produtos", type: "list", itemLabel: "Produto", fields: [
        { key: "name", label: "Nome", type: "text" },
        { key: "category", label: "Categoria", type: "text" },
        { key: "description", label: "Descrição", type: "textarea", ai: true, aiKind: "post" },
        { key: "price", label: "Preço", type: "text" },
        // Antes: campo "Emoji" (texto) e "Gradiente (CSS)" (texto livre).
        // Agora: foto do produto (upload/URL) e cor de fundo via paleta.
        // Os valores legados `emoji`/`gradient` continuam renderizando como
        // fallback — nada antigo é perdido.
        { key: "image", label: "Imagem do produto", type: "image" },
        { key: "badge", label: "Selo (ex.: Mais vendido)", type: "text" },
        { key: "bgColor", label: "Cor de fundo", type: "color" },
      ],
    },
  ],
  faq: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
    { key: "title", label: "Título", type: "text", ai: true, aiKind: "title" },
    { key: "subtitle", label: "Subtítulo", type: "text" },
    {
      key: "items", label: "Perguntas", type: "list", itemLabel: "Pergunta", fields: [
        { key: "q", label: "Pergunta", type: "text", ai: true, aiKind: "faq" },
        { key: "a", label: "Resposta", type: "textarea", ai: true, aiKind: "default" },
      ],
    },
  ],
  pricing: [
    { key: "eyebrow", label: "Selo superior", type: "text" },
  ],
  footer: [
    { key: "aboutText", label: "Texto sobre", type: "textarea", ai: true, aiKind: "description" },
    {
      key: "social", label: "Redes sociais", type: "object", fields: [
        { key: "whatsapp", label: "Mostrar WhatsApp", type: "boolean" },
        {
          key: "instagram", label: "Instagram", type: "object", fields: [
            { key: "enabled", label: "Ativo", type: "boolean" },
            { key: "url", label: "Endereço (URL)", type: "url" },
          ],
        },
        {
          key: "facebook", label: "Facebook", type: "object", fields: [
            { key: "enabled", label: "Ativo", type: "boolean" },
            { key: "url", label: "Endereço (URL)", type: "url" },
          ],
        },
        {
          key: "youtube", label: "YouTube", type: "object", fields: [
            { key: "enabled", label: "Ativo", type: "boolean" },
            { key: "url", label: "Endereço (URL)", type: "url" },
          ],
        },
      ],
    },
    { key: "showPlatformCredit", label: "Mostrar crédito da plataforma", type: "boolean" },
  ],
};

/** Converte um valor JSON para string de exibição (campos do tipo json). */
export function jsonToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 0);
}

/** Converte a string digitada em um campo json de volta para o valor. */
export function stringToJson(value: string): unknown {
  const v = value.trim();
  if (v === "") return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/** Formata conteúdo no formato "campo legível" para exibição nas listas. */
export function contentSummary(content: Record<string, unknown>): string {
  const title = content.title || content.name || content.eyebrow;
  if (typeof title === "string") return title;
  const first = Object.keys(content)[0];
  if (!first) return "Sem conteúdo";
  const v = content[first];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `${first}: ${v.length} item(ns)`;
  return first;
}

/**
 * Normaliza a lista de parágrafos da seção "História / Sobre" para string[].
 *
 * Aceita o formato canônico (string[]) e o formato legado/corrompido
 * produzido pelo editor antigo ([{ p: "..." }] ou misto), extraindo o texto
 * de objetos `{ p }` / `{ text }`. Qualquer outro valor não-texto é
 * descartado — nunca retorna objetos, então é seguro renderizar com
 * `{paragraphs.map((p, i) => <p key={i}>{p}</p>)}` sem o erro
 * "Objects are not valid as a React child" (tela branca).
 */
export function normalizeParagraphs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      out.push(item);
    } else if (typeof item === "number" || typeof item === "boolean") {
      out.push(String(item));
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const text = obj.p ?? obj.text ?? obj.value ?? obj.paragraph;
      if (typeof text === "string") out.push(text);
      else if (typeof text === "number" || typeof text === "boolean") out.push(String(text));
      // objetos sem texto reconhecível são ignorados (não quebram o render)
    }
  }
  return out;
}

/** Extrai o texto de exibição/edição de um item de lista simples (string[]). */
export function plainListItemText(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const text = obj.p ?? obj.text ?? obj.value ?? obj.paragraph;
    if (typeof text === "string") return text;
    if (typeof text === "number" || typeof text === "boolean") return String(text);
  }
  return "";
}

/**
 * Paleta padrão de cores de fundo para os cards de produto.
 * Ideal para fotos com fundo transparente (PNG): a cor preenche o card.
 */
export const PRODUCT_BG_PALETTE: string[] = [
  "#FFFFFF",
  "#F7F2EA",
  "#E8F5EE",
  "#C8E8D8",
  "#A8D5B5",
  "#4A9E6B",
  "#1D5C3A",
  "#FFF8E8",
  "#FCE8B0",
  "#F5E6D0",
  "#F0F4FE",
  "#C8D8F8",
];

/** Diz se o valor é uma cor hexadecimal válida (#RGB ou #RRGGBB). */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Normaliza um link digitado no editor.
 * Completa com https:// quando o esquema está ausente (ex.: "sualoja.com.br"
 * ou "www.sualoja.com.br"), que era o motivo de o "Link da loja" não abrir o
 * site desejado (o navegador tratava como caminho relativo do próprio site).
 * Âncoras (#...), caminhos internos (/...), mailto: e tel: são preservados.
 */
export function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return `https://${v}`;
}

/**
 * Sanitiza o conteúdo da seção "Produtos em destaque" no salvamento:
 * normaliza o link da loja e aparafusa os campos de texto do produto.
 * Chaves legadas (`emoji`, `gradient`) são preservadas como fallback.
 */
export function sanitizeProductsContent(content: Record<string, unknown>): Record<string, unknown> {
  const out = { ...content };
  if ("storeUrl" in out) out.storeUrl = normalizeUrl(out.storeUrl);
  if (Array.isArray(out.items)) {
    out.items = (out.items as unknown[]).map((it) => {
      if (!it || typeof it !== "object" || Array.isArray(it)) return it;
      const p = { ...(it as Record<string, unknown>) };
      for (const k of ["name", "category", "description", "price", "image", "badge", "bgColor", "emoji", "gradient"]) {
        if (typeof p[k] === "string") p[k] = (p[k] as string).trim();
      }
      return p;
    });
  }
  return out;
}
