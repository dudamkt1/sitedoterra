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
}

export const SECTION_CONTENT_FIELDS: Record<SectionType, ContentFieldDef[]> = {
  header: [
    { key: "logoText", label: "Texto da logo", type: "text" },
    { key: "logoUrl", label: "Logo (imagem)", type: "image" },
  ],
  hero: [
    { key: "eyebrow", label: "Selo / subtítulo do topo", type: "text", ai: true, aiKind: "title" },
    { key: "firstName", label: "Nome", type: "text" },
    { key: "lastName", label: "Sobrenome", type: "text" },
    { key: "role", label: "Título / cargo", type: "text" },
    { key: "description", label: "Descrição principal", type: "textarea", ai: true, aiKind: "description" },
    { key: "image", label: "Foto (URL)", type: "image" },
    { key: "imageAlt", label: "Texto alternativo da foto", type: "text" },
    { key: "badgeTitle", label: "Selo da foto — título (ex.: Certified Wellness)", type: "text" },
    { key: "badgeSubtitle", label: "Selo da foto — subtítulo (ex.: Expert em bem-estar)", type: "text" },
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
    { key: "paragraphs", label: "Parágrafos", type: "list", itemLabel: "Parágrafo", fields: [{ key: "p", label: "Parágrafo", type: "textarea", ai: true, aiKind: "description" }] },
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
    { key: "instagramHandle", label: "Mostrar como (ex.: @perfil)", type: "text" },
    { key: "instagramUrl", label: "Link do perfil", type: "url" },
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
    { key: "storeUrl", label: "Link da loja", type: "url" },
    {
      key: "items", label: "Produtos", type: "list", itemLabel: "Produto", fields: [
        { key: "name", label: "Nome", type: "text" },
        { key: "category", label: "Categoria", type: "text" },
        { key: "description", label: "Descrição", type: "textarea", ai: true, aiKind: "post" },
        { key: "price", label: "Preço", type: "text" },
        { key: "emoji", label: "Emoji", type: "text" },
        { key: "badge", label: "Selo (ex.: Mais vendido)", type: "text" },
        { key: "gradient", label: "Gradiente (CSS)", type: "text" },
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
        { key: "instagram", label: "Mostrar Instagram", type: "boolean" },
        { key: "youtube", label: "Mostrar YouTube", type: "boolean" },
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
