/**
 * Esquemas das ferramentas da Central de IA doTERRA.
 *
 * A tabela ai_tools guarda a CONFIGURAÇÃO (nome, emoji, categoria, descrição,
 * exemplos, ordenação, habilitado e base_prompt/instruções que o Super Admin
 * pode editar). Os ESQUEMAS de campos de cada ferramenta e os BUILDERS de
 * prompt vivem aqui no código, garantindo a consistência entre o formulário do
 * painel e o prompt enviado à IA.
 */

export type ToolFieldType = "text" | "textarea" | "select" | "number";

export interface ToolField {
  key: string;
  label: string;
  type: ToolFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}

export interface ToolSchema {
  code: string;
  category: "conteudo" | "redes" | "produtos" | "marketing" | "ideias" | "especial";
  /** true = gera conteúdo via IA (exige API configurada). false = ferramenta especial (prompts/templates). */
  generatesContent: boolean;
  fields: ToolField[];
}

/** Bloco de contexto doTERRA + regras de conteúdo responsável, adicionado a todo prompt. */
export const DOTERRA_CONTEXT = `CONTEXTO (sempre válido):
- O universo é o de óleos essenciais, blends, produtos doTERRA, bem-estar, aromas, rotina, lifestyle e conteúdo educativo/comercial.
- Use linguagem responsável: NUNCA afirme cura, tratamento, diagnóstico, prevenção de doenças, substituição de medicamento ou qualquer alegação terapêutica/médica não comprovada.
- Prefira expressões como "conhecido por seu aroma...", "pode fazer parte da sua rotina...", "experiência aromática...", "conteúdo educativo...".
- Não invente propriedades, composição, certificações, benefícios ou fatos sobre produtos que o usuário não informou.
- Escreva em português do Brasil, com naturalidade, sem repetir a palavra "doTERRA" em excesso.`;

function fieldText(fields: Record<string, string>, key: string, label: string): string {
  const v = (fields[key] || "").trim();
  return v ? `${label}: ${v}` : "";
}

/** Lista os campos preenchidos no formato "Label: valor". */
function renderFields(fields: Record<string, string>, labels: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const line = fieldText(fields, key, label);
    if (line) lines.push(`- ${line}`);
  }
  return lines.join("\n");
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    code: "title",
    category: "conteudo",
    generatesContent: true,
    fields: [
      { key: "produto", label: "Produto", type: "text", placeholder: "ex.: Kit Básico Familiar" },
      { key: "oleo", label: "Nome do óleo essencial", type: "text", placeholder: "ex.: Lavender, On Guard, Peppermint" },
      { key: "tema", label: "Tema", type: "text", placeholder: "ex.: relaxamento, energia, imunidade" },
      { key: "publico", label: "Público-alvo", type: "text", placeholder: "ex.: mães, profissionais, iniciantes" },
      { key: "objetivo", label: "Objetivo do conteúdo", type: "text", placeholder: "ex.: vender, educar, engajar" },
      {
        key: "tom",
        label: "Tom",
        type: "select",
        options: ["Profissional", "Inspirador", "Educativo", "Elegante", "Comercial", "Emocional", "Curto e direto"],
        required: true,
      },
      { key: "quantidade", label: "Quantidade de opções", type: "number", min: 1, max: 12, placeholder: "ex.: 5" },
    ],
  },
  {
    code: "description",
    category: "conteudo",
    generatesContent: true,
    fields: [
      { key: "produto", label: "Produto", type: "text", placeholder: "ex.: óleo essencial de Lavender" },
      { key: "oleo", label: "Óleo essencial", type: "text", placeholder: "ex.: Lavender" },
      { key: "tema", label: "Tema", type: "text", placeholder: "ex.: relaxamento, sono, rotina" },
      { key: "beneficios", label: "Benefícios / características a destacar", type: "textarea", placeholder: "ex.: aroma calmante, versátil, fácil de combinar" },
      { key: "publico", label: "Público", type: "text", placeholder: "ex.: mulheres 25-45, iniciantes" },
      {
        key: "tamanho",
        label: "Tamanho",
        type: "select",
        options: ["Curta", "Média", "Completa"],
        required: true,
      },
      {
        key: "tom",
        label: "Tom da comunicação",
        type: "select",
        options: ["Profissional", "Inspirador", "Educativo", "Elegante", "Comercial", "Emocional"],
        required: true,
      },
    ],
  },
  {
    code: "post",
    category: "redes",
    generatesContent: true,
    fields: [
      {
        key: "rede",
        label: "Rede social",
        type: "select",
        options: ["Instagram", "Facebook", "WhatsApp", "Stories", "Reels", "TikTok"],
        required: true,
      },
      {
        key: "tipo",
        label: "Tipo de conteúdo",
        type: "select",
        options: [
          "Post educativo",
          "Post comercial",
          "Apresentação de produto",
          "Curiosidade",
          "Dica",
          "Pergunta",
          "Depoimento",
          "Chamada para contato",
          "Divulgação de oportunidade",
          "Rotina",
          "Lifestyle",
          "Inspiração",
        ],
        required: true,
      },
      {
        key: "formato",
        label: "Formato",
        type: "select",
        options: ["Feed", "Story", "Carrossel", "Reel", "Texto curto", "Texto longo"],
        required: true,
      },
      {
        key: "estilo",
        label: "Estilo",
        type: "select",
        options: ["Elegante", "Minimalista", "Natural", "Premium", "Inspirador", "Moderno", "Comercial", "Educativo"],
        required: true,
      },
      { key: "produto", label: "Produto / óleo", type: "text", placeholder: "ex.: On Guard, Lavender, blend relax" },
      { key: "tema", label: "Tema / assunto", type: "text", placeholder: "ex.: rotina noturna, bem-estar, imunidade" },
      { key: "beneficios", label: "Benefícios a destacar", type: "textarea", placeholder: "ex.: aroma acolhedor, fácil de usar" },
      { key: "publico", label: "Público", type: "text", placeholder: "ex.: mães, iniciantes, clientes" },
    ],
  },
  {
    code: "product",
    category: "produtos",
    generatesContent: true,
    fields: [
      { key: "nome", label: "Nome do produto", type: "text", placeholder: "ex.: On Guard®", required: true },
      {
        key: "categoria",
        label: "Categoria",
        type: "select",
        options: ["Óleo essencial", "Blend", "Produto de cuidado pessoal", "Produto para casa", "Outro"],
        required: true,
      },
      { key: "publico", label: "Público-alvo", type: "text", placeholder: "ex.: famílias, iniciantes, atletas" },
      { key: "caracteristicas", label: "Características", type: "textarea", placeholder: "ex.: aroma cítrico e picante, combina com...", hint: "Informe apenas o que você sabe que é verdade" },
      { key: "diferenciais", label: "Diferenciais", type: "textarea", placeholder: "ex.: padrão de pureza, versatilidade" },
      {
        key: "tom",
        label: "Tom",
        type: "select",
        options: ["Profissional", "Inspirador", "Educativo", "Elegante", "Comercial"],
        required: true,
      },
    ],
  },
  {
    code: "ad",
    category: "marketing",
    generatesContent: true,
    fields: [
      {
        key: "canal",
        label: "Canal",
        type: "select",
        options: ["Instagram", "Facebook", "WhatsApp", "Google", "Site", "Anúncio curto", "Anúncio completo"],
        required: true,
      },
      { key: "produto", label: "Produto", type: "text", placeholder: "ex.: consultoria gratuita, kit de óleos", required: true },
      { key: "objetivo", label: "Objetivo", type: "text", placeholder: "ex.: gerar cadastros, vender, agendar consulta" },
      { key: "publico", label: "Público", type: "text", placeholder: "ex.: mulheres que buscam bem-estar" },
      { key: "oferta", label: "Oferta", type: "text", placeholder: "ex.: 25% off na primeira compra" },
      { key: "cta", label: "CTA", type: "text", placeholder: "ex.: Chamar no WhatsApp", hint: "O que o usuário deve fazer" },
      { key: "diferencial", label: "Diferencial", type: "text", placeholder: "ex.: acompanhamento personalizado" },
      {
        key: "tom",
        label: "Tom",
        type: "select",
        options: ["Profissional", "Inspirador", "Comercial", "Elegante", "Urgente"],
        required: true,
      },
    ],
  },
  {
    code: "ideas",
    category: "ideias",
    generatesContent: true,
    fields: [
      { key: "tema", label: "Tema", type: "text", placeholder: "ex.: bem-estar, rotina, óleos para dormir" },
      { key: "produto", label: "Produto", type: "text", placeholder: "ex.: Lavender, On Guard" },
      { key: "publico", label: "Público", type: "text", placeholder: "ex.: iniciantes, mães, clientes" },
      {
        key: "rede",
        label: "Rede social",
        type: "select",
        options: ["Instagram", "Facebook", "WhatsApp", "TikTok", "Todas"],
        required: true,
      },
      {
        key: "frequencia",
        label: "Frequência de publicação",
        type: "select",
        options: ["1x por semana", "2x por semana", "3x por semana", "Todos os dias"],
        required: true,
      },
    ],
  },
  {
    code: "calendar",
    category: "ideias",
    generatesContent: true,
    fields: [
      { key: "tema", label: "Tema", type: "text", placeholder: "ex.: bem-estar, rotina, óleos essenciais" },
      { key: "produto", label: "Produto / óleo", type: "text", placeholder: "ex.: Lavender, On Guard" },
      { key: "publico", label: "Público", type: "text", placeholder: "ex.: iniciantes, clientes" },
      {
        key: "rede",
        label: "Rede social",
        type: "select",
        options: ["Instagram", "Facebook", "WhatsApp", "TikTok", "Todas"],
        required: true,
      },
      {
        key: "dias",
        label: "Dias",
        type: "select",
        options: ["7 dias", "15 dias", "30 dias"],
        required: true,
      },
    ],
  },
  {
    code: "faq",
    category: "conteudo",
    generatesContent: true,
    fields: [
      { key: "tema", label: "Tema", type: "text", placeholder: "ex.: como começar com óleos essenciais", required: true },
      { key: "quantidade", label: "Quantidade de perguntas", type: "number", min: 1, max: 10, placeholder: "ex.: 3" },
    ],
  },
  {
    code: "client-reply",
    category: "conteudo",
    generatesContent: true,
    fields: [
      { key: "pergunta", label: "Pergunta da cliente", type: "textarea", placeholder: "ex.: Como começo a usar óleos essenciais?", required: true },
      { key: "contexto", label: "Contexto / histórico", type: "textarea", placeholder: "ex.: Ela nunca usou óleos e tem bebê em casa" },
    ],
  },
  {
    code: "prompts",
    category: "especial",
    generatesContent: false,
    fields: [],
  },
  {
    code: "templates",
    category: "especial",
    generatesContent: false,
    fields: [],
  },
];

const TITLE_LABELS: Record<string, string> = {
  produto: "Produto",
  oleo: "Óleo essencial",
  tema: "Tema",
  publico: "Público-alvo",
  objetivo: "Objetivo",
  tom: "Tom",
};

const DESCRIPTION_LABELS: Record<string, string> = {
  produto: "Produto",
  oleo: "Óleo essencial",
  tema: "Tema",
  beneficios: "Benefícios a destacar",
  publico: "Público",
  tamanho: "Tamanho",
  tom: "Tom",
};

const POST_LABELS: Record<string, string> = {
  rede: "Rede social",
  tipo: "Tipo de conteúdo",
  formato: "Formato",
  estilo: "Estilo",
  produto: "Produto / óleo",
  tema: "Tema",
  beneficios: "Benefícios a destacar",
  publico: "Público",
};

const PRODUCT_LABELS: Record<string, string> = {
  nome: "Nome do produto",
  categoria: "Categoria",
  publico: "Público-alvo",
  caracteristicas: "Características",
  diferenciais: "Diferenciais",
  tom: "Tom",
};

const AD_LABELS: Record<string, string> = {
  canal: "Canal",
  produto: "Produto",
  objetivo: "Objetivo",
  publico: "Público",
  oferta: "Oferta",
  cta: "CTA",
  diferencial: "Diferencial",
  tom: "Tom",
};

const IDEAS_LABELS: Record<string, string> = {
  tema: "Tema",
  produto: "Produto",
  publico: "Público",
  rede: "Rede social",
  frequencia: "Frequência",
};

const CALENDAR_LABELS: Record<string, string> = {
  tema: "Tema",
  produto: "Produto / óleo",
  publico: "Público",
  rede: "Rede social",
  dias: "Dias",
};

const FAQ_LABELS: Record<string, string> = {
  tema: "Tema",
  quantidade: "Quantidade",
};

const REPLY_LABELS: Record<string, string> = {
  pergunta: "Pergunta da cliente",
  contexto: "Contexto",
};

function quantity(fields: Record<string, string>, fallback: number): number {
  const n = parseInt(fields.quantidade || "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : fallback;
}

/** Constrói o prompt final de uma ferramenta a partir dos campos preenchidos. */
export function buildToolPrompt(code: string, fields: Record<string, string>): string {
  const qty = quantity(fields, 5);
  const parts: string[] = [];

  switch (code) {
    case "title": {
      parts.push("Crie opções de TÍTULO para o conteúdo informado.");
      const ctx = renderFields(fields, TITLE_LABELS);
      if (ctx) parts.push(ctx);
      parts.push(`- Gere ${qty} opções de título variadas e de alta qualidade.`);
      parts.push("- Liste cada opção em uma linha, começando com o número seguido de ponto (ex.: 1. ...).");
      parts.push("- Não explique os títulos: entregue apenas a lista.");
      break;
    }
    case "description": {
      parts.push("Crie um conteúdo pronto para uso com: TÍTULO, DESCRIÇÃO, CTA e HASHTAGS.");
      const ctx = renderFields(fields, DESCRIPTION_LABELS);
      if (ctx) parts.push(ctx);
      const size = (fields.tamanho || "Média").toLowerCase();
      if (size === "curta") parts.push("- Tamanho: CURTO (2 a 3 frases de descrição).");
      else if (size === "completa") parts.push("- Tamanho: COMPLETO (5 a 8 frases de descrição).");
      else parts.push("- Tamanho: MÉDIO (3 a 5 frases de descrição).");
      parts.push("- Formato do resultado:\n  1. TÍTULO\n  2. DESCRIÇÃO\n  3. CTA (uma frase de ação)\n  4. HASHTAGS (5 a 8 relevantes)");
      break;
    }
    case "post": {
      parts.push("Crie um POST pronto para publicar na rede social informada.");
      const ctx = renderFields(fields, POST_LABELS);
      if (ctx) parts.push(ctx);
      parts.push("- Formato do resultado, com seções claras: TEXTO PRINCIPAL, TÍTULO, CTA, HASHTAGS, SUGESTÃO DE IMAGEM, SUGESTÃO DE LAYOUT, SUGESTÃO DE CORES.");
      parts.push("- O texto principal deve ser envolvente, com gancho no início.");
      parts.push("- As sugestões de imagem/layout/cores devem ser descritas em 1 linha cada.");
      break;
    }
    case "product": {
      parts.push("Crie a descrição comercial completa de um produto.");
      const ctx = renderFields(fields, PRODUCT_LABELS);
      if (ctx) parts.push(ctx);
      parts.push(`- NÃO invente propriedades, composição, certificações ou benefícios médicos. Use apenas as informações fornecidas; o que não foi informado deve ser tratado de forma genérica (ex.: "produto doTERRA").`);
      parts.push("- Formato do resultado, com seções claras:\n  1. NOME/TÍTULO\n  2. DESCRIÇÃO CURTA (1-2 frases)\n  3. DESCRIÇÃO COMPLETA (3-5 frases)\n  4. DESTAQUES (bullets)\n  5. CTA\n  6. SUGESTÃO DE UTILIZAÇÃO COMERCIAL\n  7. SEO TITLE (até 60 caracteres)\n  8. META DESCRIPTION (até 155 caracteres)\n  9. PALAVRAS-CHAVE (5 a 8)");
      break;
    }
    case "ad": {
      parts.push("Crie um ANÚNCIO de alta conversão para o canal informado.");
      const ctx = renderFields(fields, AD_LABELS);
      if (ctx) parts.push(ctx);
      parts.push("- Formato do resultado:\n  1. HEADLINE\n  2. TEXTO PRINCIPAL\n  3. CTA\n  4. VERSÃO CURTA\n  5. VERSÃO MÉDIA\n  6. VERSÃO LONGA\n  7. SUGESTÃO VISUAL (1 linha)\n  8. VARIAÇÕES PARA TESTE A/B (2 variações de headline e 2 de texto)");
      parts.push("- Sem promessas de cura ou alegações médicas.");
      break;
    }
    case "ideas": {
      parts.push("Gere IDEIAS DE CONTEÚDO organizadas por categorias.");
      const ctx = renderFields(fields, IDEAS_LABELS);
      if (ctx) parts.push(ctx);
      parts.push("- Organize por categorias, sempre que fizer sentido: EDUCATIVO, COMERCIAL, ENGAJAMENTO, STORYTELLING, LIFESTYLE, PRODUTO, CURIOSIDADES, PERGUNTAS, REELS, STORIES, CARROSSEL.");
      parts.push("- Para cada ideia, apresente no formato:\n  • Título\n  • Descrição (1-2 frases)\n  • Formato recomendado\n  • Gancho\n  • CTA\n  • Sugestão de imagem/vídeo\n  • Hashtags");
      break;
    }
    case "calendar": {
      parts.push("Monte um CALENDÁRIO DE CONTEÚDO pronto.");
      const ctx = renderFields(fields, CALENDAR_LABELS);
      if (ctx) parts.push(ctx);
      const days = (fields.dias || "7 dias").replace(/\D/g, "");
      parts.push(`- Gere ${days} dias de conteúdo, do Dia 1 ao Dia ${days}.`);
      parts.push("- Para cada dia, informe: DIA, FORMATO, TEMA/IDÉIA, GANCHO, CTA, HASHTAGS.");
      parts.push("- Alterne conteúdo educativo e comercial, com boa variedade.");
      break;
    }
    case "faq": {
      parts.push("Gere perguntas frequentes com respostas.");
      const ctx = renderFields(fields, FAQ_LABELS);
      if (ctx) parts.push(ctx);
      parts.push(`- Gere ${quantity(fields, 3)} perguntas com respostas claras e acolhedoras.`);
      parts.push("- Formato:\n  P1) Pergunta\n  R1) Resposta\n  (repetir para cada item).");
      break;
    }
    case "client-reply": {
      parts.push("Escreva uma resposta educada, acolhedora e útil para a cliente.");
      const ctx = renderFields(fields, REPLY_LABELS);
      if (ctx) parts.push(ctx);
      parts.push("- Seja natural e próximo, como uma consultora experiente.");
      parts.push("- Não crie promessas médicas nem alegações terapêuticas.");
      break;
    }
    default:
      parts.push("Crie um conteúdo relevante para o universo doTERRA.");
      const rest = Object.values(fields).filter((v) => v && String(v).trim()).join(" | ");
      if (rest) parts.push(rest);
  }

  parts.push(DOTERRA_CONTEXT);
  return parts.join("\n\n");
}
