// GERADO AUTOMATICAMENTE — não editar à mão.
// Fonte: supabase/migrations/0021_ai_content_center.sql e 0009_ai_tools.sql
// Catálogo estático usado pelo modo demonstração (acesso rápido).

export interface DemoAiToolRow {
  id: string; code: string; name: string; emoji: string; category: string;
  description: string | null; examples: string[]; enabled: boolean;
  requires_api_key: boolean; sort_order: number; base_prompt: string | null;
}

export interface DemoAiTemplateRow {
  id: string; code: string; name: string; emoji: string; category: string;
  description: string | null; structure: unknown; enabled: boolean; sort_order: number;
}

export interface DemoAiProviderRow {
  id: string; code: string; name: string; enabled: boolean; requires_api_key: boolean;
  free_tier: string | null; limits: string | null; docs_url: string | null;
  base_url: string | null; model: string | null; instructions: string | null; sort_order: number;
}

export const DEMO_AI_TOOLS: DemoAiToolRow[] = [
  {
    "id": "tool-1",
    "code": "title",
    "name": "Gerar título",
    "emoji": "✍️",
    "category": "conteudo",
    "description": "Crie várias opções de título para posts, vídeos, carrosséis e anúncios, com o tom e o objetivo que você escolher.",
    "examples": [
      "5 opções de título para um post sobre Lavender",
      "Título comercial para divulgar o Kit Básico Familiar",
      "Título educativo para um carrossel sobre diluição de óleos"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 10,
    "base_prompt": "Você é um redator especialista em marketing de conteúdo para consultoras doTERRA. Gere opções de título criativas, chamativas e adequadas ao tom pedido, sempre sem promessas médicas."
  },
  {
    "id": "tool-2",
    "code": "description",
    "name": "Gerar descrição",
    "emoji": "📝",
    "category": "conteudo",
    "description": "Produza título, descrição, CTA e hashtags prontos para usar em posts e páginas, no tamanho e tom ideais.",
    "examples": [
      "Descrição de apresentação da consultora",
      "Texto completo com CTA e hashtags para um post de produto",
      "Descrição curta para o perfil do Instagram"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 20,
    "base_prompt": "Você é um copywriter especializado em bem-estar e óleos essenciais. Escreva conteúdo comercial/educativo responsável, sem afirmações médicas, promessas de cura ou alegações terapêuticas não comprovadas."
  },
  {
    "id": "tool-3",
    "code": "post",
    "name": "Posts para redes sociais",
    "emoji": "📱",
    "category": "redes",
    "description": "Gere posts completos para Instagram, Facebook, WhatsApp, Stories, Reels e TikTok com texto, CTA, hashtags e sugestões visuais.",
    "examples": [
      "Post comercial para divulgar um óleo no Instagram",
      "Story com enquete para engajar o público",
      "Roteiro de Reel educativo sobre 3 formas de usar um blend"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 30,
    "base_prompt": "Você é um estrategista de redes sociais para consultoras doTERRA. Produza posts prontos para publicação, com gancho, texto, CTA, hashtags e sugestões de imagem/layout/cores. Nunca crie promessas médicas."
  },
  {
    "id": "tool-4",
    "code": "product",
    "name": "Descrição de produto",
    "emoji": "🛍️",
    "category": "produtos",
    "description": "Crie descrições completas de produtos doTERRA com destaque para características, diferenciais, CTA e SEO.",
    "examples": [
      "Descrição do óleo Lavender para a vitrine do site",
      "SEO title e meta description do produto On Guard",
      "Descrição completa com destaques e CTA"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 40,
    "base_prompt": "Você é um redator de e-commerce especializado em produtos doTERRA. Escreva descrições atrativas sem INVENTAR propriedades, composição, certificações ou benefícios médicos. Quando o usuário não fornecer informações do produto, use apenas linguagem genérica e educativa."
  },
  {
    "id": "tool-5",
    "code": "ad",
    "name": "Anúncio",
    "emoji": "📢",
    "category": "marketing",
    "description": "Crie anúncios com headline, texto e CTA em várias versões, incluindo variações para teste A/B.",
    "examples": [
      "Anúncio curto para Instagram Ads",
      "5 variações de anúncio para o Facebook",
      "Anúncio completo com oferta e diferencial"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 50,
    "base_prompt": "Você é um especialista em anúncios para consultoras doTERRA. Gere headline, texto principal, CTA e variações para teste A/B, sempre com linguagem comercial ética e sem promessas de cura."
  },
  {
    "id": "tool-6",
    "code": "ideas",
    "name": "Ideias de conteúdo",
    "emoji": "💡",
    "category": "ideias",
    "description": "Gere ideias organizadas por categorias para suas redes, com gancho, formato, CTA e sugestões visuais.",
    "examples": [
      "Ideias para 1 semana de posts no Instagram",
      "Categorias: educativo, engajamento, storytelling",
      "Ideias de Reels e Stories"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 60,
    "base_prompt": "Você é um planejador de conteúdo para consultoras doTERRA. Gere ideias organizadas por categorias (educativo, comercial, engajamento, storytelling, lifestyle, produto, curiosidades, perguntas, reels, stories, carrossel), cada uma com título, descrição, formato, gancho, CTA, sugestão de imagem/vídeo e hashtags."
  },
  {
    "id": "tool-7",
    "code": "calendar",
    "name": "Calendário de conteúdo",
    "emoji": "🗓️",
    "category": "ideias",
    "description": "Monte um calendário pronto de 7, 15 ou 30 dias com um tema de conteúdo por dia.",
    "examples": [
      "Calendário de 15 dias de posts para Instagram",
      "30 dias de conteúdo educativo e comercial",
      "Calendário semanal para Stories e Reels"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 70,
    "base_prompt": "Você é um planner de conteúdo para consultoras doTERRA. Monte um calendário com um tema por dia (dia, formato, ideia, gancho, CTA, hashtags), balanceando conteúdo educativo e comercial. Nunca inclua promessas médicas."
  },
  {
    "id": "tool-8",
    "code": "faq",
    "name": "Gerar FAQ",
    "emoji": "❓",
    "category": "conteudo",
    "description": "Gere perguntas e respostas frequentes sobre seus produtos e serviços, prontas para publicar.",
    "examples": [
      "3 perguntas frequentes sobre como começar com óleos",
      "FAQ para o site com dúvidas de clientes",
      "Perguntas sobre compra e entrega"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 80,
    "base_prompt": "Você é um atendente especializado em óleos essenciais. Gere perguntas frequentes com respostas claras, acolhedoras e educativas, sem afirmar benefícios médicos não comprovados."
  },
  {
    "id": "tool-9",
    "code": "client-reply",
    "name": "Resposta para cliente",
    "emoji": "💬",
    "category": "conteudo",
    "description": "Elabore respostas educadas e acolhedoras para clientes que fazem perguntas pelo WhatsApp ou redes.",
    "examples": [
      "Resposta para cliente perguntando como começar",
      "Resposta sobre disponibilidade de um produto",
      "Resposta acolhedora para uma dúvida de uso"
    ],
    "enabled": true,
    "requires_api_key": true,
    "sort_order": 90,
    "base_prompt": "Você é uma consultora doTERRA experiente e acolhedora. Responda a cliente com empatia, educação e clareza, orientando sobre o universo dos óleos essenciais sem criar promessas médicas."
  },
  {
    "id": "tool-10",
    "code": "prompts",
    "name": "Central de prompts",
    "emoji": "🧩",
    "category": "especial",
    "description": "Prompts prontos para copiar e usar em qualquer ferramenta gratuita de IA (ChatGPT, Gemini, Copilot e outras).",
    "examples": [
      "Criar legenda para Instagram",
      "Criar roteiro de Reel",
      "Criar descrição de produto"
    ],
    "enabled": true,
    "requires_api_key": false,
    "sort_order": 100,
    "base_prompt": null
  },
  {
    "id": "tool-11",
    "code": "templates",
    "name": "Templates prontos",
    "emoji": "🎨",
    "category": "especial",
    "description": "Modelos visuais prontos para redes sociais, com edição de texto, cores, imagem, logo, CTA e posição dos elementos.",
    "examples": [
      "Produto em destaque",
      "Óleo da semana",
      "Dica rápida"
    ],
    "enabled": true,
    "requires_api_key": false,
    "sort_order": 110,
    "base_prompt": null
  }
];

export const DEMO_AI_TEMPLATES: DemoAiTemplateRow[] = [
  {
    "id": "tpl-1",
    "code": "produto-destaque",
    "name": "Produto em destaque",
    "emoji": "🛍️",
    "category": "redes",
    "description": "Template para apresentar um produto com imagem grande e chamada forte.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "O produto da vez"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "On Guard®"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Conhecido por seu aroma revigorante, faz parte da rotina de quem busca bem-estar."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Chame no WhatsApp"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#doterra #oleosessenciais #bemestar"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#1d5c3a"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#c4963a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 10
  },
  {
    "id": "tpl-2",
    "code": "oleo-semana",
    "name": "Óleo da semana",
    "emoji": "🌿",
    "category": "redes",
    "description": "Apresente um óleo essencial por semana, destacando o nome e um uso.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Óleo da semana"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Lavender"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Conhecido por seu aroma calmante, pode fazer parte da sua rotina de relaxamento."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Quero saber mais"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#oleodasemana #lavender #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#2d7a4f"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#e8c87a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 20
  },
  {
    "id": "tpl-3",
    "code": "dica-rapida",
    "name": "Dica rápida",
    "emoji": "⚡",
    "category": "redes",
    "description": "Post objetivo com uma dica prática e fácil de aplicar.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Dica rápida"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Para o seu dia a dia"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "1. Escolha um aroma\n2. Aplique com movimentos circulares\n3. Respire e aproveite o momento"
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Salve esse post"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#dica #doterra #rotina"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#8b6b45"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#f7f2ea"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1470259078422-06e8c24ebf84?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 30
  },
  {
    "id": "tpl-4",
    "code": "voce-sabia",
    "name": "Você sabia?",
    "emoji": "💡",
    "category": "redes",
    "description": "Curiosidade rápida para educar o público e gerar engajamento.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Você sabia?"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Curiosidades sobre óleos"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Os óleos essenciais podem fazer parte da sua rotina de bem-estar de diferentes formas: no difusor, na massagem ou no banho."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Comente o que achou"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#vocesabia #curiosidades #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#4a9e6b"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#f7f2ea"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1598440947619-cc6db50d67f9?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 40
  },
  {
    "id": "tpl-5",
    "code": "3-formas",
    "name": "3 formas de usar",
    "emoji": "✳️",
    "category": "redes",
    "description": "Post em carrossel mostrando três usos diferentes de um produto.",
    "structure": {
      "layout": "carrossel",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "3 formas de usar"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Lemon"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "1. No difusor pela manhã\n2. Na água da limpeza\n3. Em uma massagem"
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Veja os slides"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#3formas #lemon #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#c4963a"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#1a1a14"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "top"
        }
      ]
    },
    "enabled": true,
    "sort_order": 50
  },
  {
    "id": "tpl-6",
    "code": "frase-inspiradora",
    "name": "Frase inspiradora",
    "emoji": "✨",
    "category": "redes",
    "description": "Post com frase inspiradora para conectar com o público.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Inspiração do dia"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": ""
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "O autocuidado começa com pequenos rituais que cuidam de você."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Marque alguém que precisa"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#inspiracao #autocuidado #bemestar"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#f7f2ea"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#1d5c3a"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#c4963a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 60
  },
  {
    "id": "tpl-7",
    "code": "post-educativo",
    "name": "Post educativo",
    "emoji": "📚",
    "category": "redes",
    "description": "Post para ensinar um conceito ou informação sobre óleos essenciais.",
    "structure": {
      "layout": "carrossel",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Entenda na prática"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "O que são blends"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Blends são combinações de óleos essenciais que se complementam. Cada um tem seu aroma e características próprias."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Salve para depois"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#educativo #blends #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#1a1a14"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#f7f2ea"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#e8c87a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1470259078422-06e8c24ebf84?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "top"
        }
      ]
    },
    "enabled": true,
    "sort_order": 70
  },
  {
    "id": "tpl-8",
    "code": "chamada-contato",
    "name": "Chamada para contato",
    "emoji": "📲",
    "category": "redes",
    "description": "Post de convite para conversar ou agendar uma consulta.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Vamos conversar?"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Consultoria gratuita"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Agende uma conversa e descubra como os óleos essenciais podem fazer parte da sua rotina."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Chamar no WhatsApp"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#consulta #doterra #vamosconversar"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#2d7a4f"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#e8c87a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1608571423902-eed4a94d8108?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 80
  },
  {
    "id": "tpl-9",
    "code": "novo-produto",
    "name": "Novo produto",
    "emoji": "🎉",
    "category": "redes",
    "description": "Apresente um lançamento com animação e chamada clara.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Chegou novidade!"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Conheça o produto"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Novo produto na linha! Conheça de perto e descubra como pode combinar com a sua rotina."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Pedir mais informações"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#novidade #lancamento #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#4a9e6b"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#e8c87a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1598440947619-cc6db50d67f9?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 90
  },
  {
    "id": "tpl-10",
    "code": "oferta",
    "name": "Oferta",
    "emoji": "🏷️",
    "category": "redes",
    "description": "Post promocional com destaque para a oferta e o CTA.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Oferta por tempo limitado"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": ""
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Aproveite as condições especiais para começar sua jornada com óleos essenciais."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Garantir minha oferta"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#oferta #promocao #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#8b6b45"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#e8c87a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 100
  },
  {
    "id": "tpl-11",
    "code": "depoimento",
    "name": "Depoimento",
    "emoji": "💬",
    "category": "redes",
    "description": "Post com depoimento de cliente para gerar confiança.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "O que dizem por aqui"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": ""
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "\"Descobri os óleos essenciais e mudou minha rotina de bem-estar.\" — Cliente"
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Quero ser a próxima"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#depoimento #clientes #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#1d5c3a"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#c4963a"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 110
  },
  {
    "id": "tpl-12",
    "code": "story-produto",
    "name": "Story de produto",
    "emoji": "📸",
    "category": "redes",
    "description": "Template vertical no formato Story, ideal para fotos de produto.",
    "structure": {
      "layout": "story",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Na sua rotina"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": ""
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "Um aroma para cada momento do seu dia."
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Deslize para ver"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#story #doterra #rotina"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#f7f2ea"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#1d5c3a"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#2d7a4f"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "center"
        }
      ]
    },
    "enabled": true,
    "sort_order": 120
  },
  {
    "id": "tpl-13",
    "code": "carrossel-educativo",
    "name": "Carrossel educativo",
    "emoji": "🎠",
    "category": "redes",
    "description": "Template para carrossel com passos numerados e didáticos.",
    "structure": {
      "layout": "carrossel",
      "fields": [
        {
          "key": "title",
          "label": "Título",
          "type": "text",
          "default": "Passo a passo"
        },
        {
          "key": "subtitle",
          "label": "Subtítulo",
          "type": "text",
          "default": "Como começar"
        },
        {
          "key": "body",
          "label": "Texto",
          "type": "textarea",
          "default": "1. Escolha o seu aroma\n2. Conheça as formas de uso\n3. Crie sua rotina"
        },
        {
          "key": "cta",
          "label": "CTA",
          "type": "text",
          "default": "Veja os próximos slides"
        },
        {
          "key": "hashtags",
          "label": "Hashtags",
          "type": "text",
          "default": "#carrossel #passoapasso #doterra"
        },
        {
          "key": "bgColor",
          "label": "Cor de fundo",
          "type": "color",
          "default": "#c4963a"
        },
        {
          "key": "textColor",
          "label": "Cor do texto",
          "type": "color",
          "default": "#1a1a14"
        },
        {
          "key": "accentColor",
          "label": "Cor de destaque",
          "type": "color",
          "default": "#ffffff"
        },
        {
          "key": "image",
          "label": "Imagem (URL)",
          "type": "image",
          "default": "https://images.unsplash.com/photo-1446071103084-c257b5f70672?w=800&auto=format&fit=crop&q=80"
        },
        {
          "key": "logo",
          "label": "Logo (URL)",
          "type": "image",
          "default": ""
        },
        {
          "key": "position",
          "label": "Posição",
          "type": "select",
          "options": [
            "top",
            "center",
            "bottom"
          ],
          "default": "top"
        }
      ]
    },
    "enabled": true,
    "sort_order": 130
  }
];

export const DEMO_AI_PROVIDERS: DemoAiProviderRow[] = [
  {
    "id": "prov-1",
    "code": "google-gemini",
    "name": "Google Gemini",
    "enabled": true,
    "requires_api_key": true,
    "free_tier": "Plano gratuito (Free Tier) com cota generosa por dia.",
    "limits": "O plano gratuito do Gemini tem limite de requisições por dia (RPm/TPM). Para uso contínuo e intenso, verifique o plano pago (Pay-as-you-go). Não é necessário cartão para começar.",
    "docs_url": "https://aistudio.google.com/app/apikey",
    "base_url": "https://generativelanguage.googleapis.com",
    "model": "gemini-2.5-flash",
    "instructions": "Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional. Sempre entregue o texto solicitado pronto para uso.",
    "sort_order": 10
  },
  {
    "id": "prov-2",
    "code": "groq",
    "name": "Groq (Llama 3)",
    "enabled": true,
    "requires_api_key": true,
    "free_tier": "Plano gratuito com créditos diários e latência muito baixa.",
    "limits": "O free tier da Groq tem limites de tokens e requisições por minuto. Pode exigir cartão para criar a conta. Os modelos gratuitos mais usados são llama-3.1-8b e llama-3.3-70b.",
    "docs_url": "https://console.groq.com/keys",
    "base_url": "https://api.groq.com/openai/v1",
    "model": "llama-3.3-70b-versatile",
    "instructions": "Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional.",
    "sort_order": 20
  },
  {
    "id": "prov-3",
    "code": "openrouter",
    "name": "OpenRouter",
    "enabled": true,
    "requires_api_key": true,
    "free_tier": "Oferece modelos gratuitos (free) sem custo, dentro dos limites do provedor.",
    "limits": "Modelos marcados como :free são gratuitos. Modelos pagos cobram por token. Requer cadastro e pode pedir crédito mínimo. Nunca afirme que é 100% gratuito sem limites.",
    "docs_url": "https://openrouter.ai/keys",
    "base_url": "https://openrouter.ai/api/v1",
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "instructions": "Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional.",
    "sort_order": 30
  }
];
