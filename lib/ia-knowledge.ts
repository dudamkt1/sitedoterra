/**
 * Base de conhecimento da "Especialista IA doTERRA" (seção About da HOME).
 *
 * Cada resposta possui palavras-chave de correspondência (sem acento, em
 * minúsculas), um texto de introdução e a lista de óleos sugeridos.
 * As respostas "treinadas" pelo próprio consultor (knowledge) têm prioridade
 * sobre a base padrão, permitindo que cada usuário personalize a assistente.
 */

export interface IaKnowledgeEntry {
  match: string[];
  text: string;
  oils: string[];
}

export interface IaTrainingEntry {
  keywords?: string;
  text?: string;
  oils?: string[];
}

const DOTERRA_KNOWLEDGE: IaKnowledgeEntry[] = [
  {
    match: ["ansiedad", "ansios", "estresse", "stress", "nervos", "preocup", "calm", "relax"],
    text: "Para aliviar ansiedade e estresse, os óleos mais indicados são:",
    oils: ["Lavender", "Serenity", "Balance", "Vetiver"],
  },
  {
    match: ["sono", "dormir", "insonia", "insônia", "noite"],
    text: "Para uma noite de sono tranquila, recomendo usar no difusor ou nos pulsos:",
    oils: ["Lavender", "Cedarwood", "Vetiver", "Serenity"],
  },
  {
    match: ["dor", "cabe", "cabeca", "enxaqueca", "migrânea", "migranea"],
    text: "Para alívio de dores de cabeça, massaje suavemente as têmporas e a nuca com:",
    oils: ["Peppermint", "Deep Blue", "PastTense"],
  },
  {
    match: ["imunid", "grippe", "gripe", "resfriado", "resfriad", "defesas", "viral", "proteção", "protecao"],
    text: "Para fortalecer a imunidade naturalmente, aplique na sola dos pés ou difunda:",
    oils: ["On Guard", "Oregano", "Frankincense"],
  },
  {
    match: ["energia", "cansad", "cansaco", "cansaço", "disposiç", "disposic", "fadiga", "cansa", "manhã", "manha"],
    text: "Para mais energia, foco e clareza mental ao longo do dia:",
    oils: ["Peppermint", "Wild Orange", "Motivate", "InTune"],
  },
  {
    match: ["digest", "estomago", "estômago", "náusea", "nausea", "enjoo", "enjo", "intestin", "gases", "azia"],
    text: "Para digestão confortável, aplique diluído sobre o abdômen em movimentos circulares:",
    oils: ["DigestZen", "Peppermint", "Ginger"],
  },
  {
    match: ["respira", "nariz", "congestão", "congestao", "sinus", "pulmão", "pulmao", "tosse", "bronqui", "asma"],
    text: "Para conforto respiratório, difunda ou inale direto das mãos:",
    oils: ["Eucalyptus", "Breathe", "Peppermint", "Lemon"],
  },
  {
    match: ["muscular", "músculo", "musculo", "articula", "coluna", "costas", "pescoço", "pescoco", "joelho", "contusão", "contusao"],
    text: "Para desconforto muscular e articular, massageie a região com:",
    oils: ["Deep Blue", "AromaTouch", "Peppermint", "Marjoram"],
  },
  {
    match: ["pele", "acne", "oleosidade", "manchas", "cicatri", "cort", "ferida", "queimad", "ressec"],
    text: "Para cuidados com a pele, aplique diluído no óleo de coco fracionado:",
    oils: ["Lavender", "Melaleuca", "Frankincense", "Tea Tree"],
  },
  {
    match: ["alerg", "rinite", "espirr", "coceira", "coceir"],
    text: "Para desconforto alérgico, difunda os óleos no ambiente ou inale:",
    oils: ["Lemon", "Lavender", "Peppermint", "Breathe"],
  },
  {
    match: ["criança", "crianca", "bebe", "bebê", "filho", "filha", "pequen"],
    text: "Para os pequenos, sempre use diluído e com moderação. Os mais suaves e indicados são:",
    oils: ["Lavender", "Gentle Baby", "Cedarwood"],
  },
  {
    match: ["foc", "concentra", "estudo", "trabalh", "memoria", "memória", "atenção", "atencao"],
    text: "Para melhorar o foco e a concentração, difunda no ambiente de estudo ou trabalho:",
    oils: ["InTune", "Peppermint", "Rosemary", "Lemon"],
  },
  {
    match: ["dilu", "carreador", "coco fracionado", "uso tópico", "topico", "quantas gotas", "como usar"],
    text: "Para uso seguro, sempre dilua em óleo de coco fracionado e faça um teste de sensibilidade:",
    oils: ["Coconut Oil", "Lavender", "Peppermint"],
  },
  {
    match: ["difusor", "difund", "aroma", "cheiro", "ambiente", "casa", "limpeza do ar", "purific"],
    text: "Para purificar e perfumar o ambiente no difusor, comece com 4 a 6 gotas:",
    oils: ["Purification", "On Guard", "Lemon", "Wild Orange"],
  },
  {
    match: ["limpeza", "higien", "lavar", "superficie", "superfície", "banheiro", "cozinha"],
    text: "Para uma limpeza natural e perfumada da casa, use:",
    oils: ["On Guard", "Lemon", "Purification", "Melaleuca"],
  },
  {
    match: ["gravidez", "gestant", "grávida", "lacta", "amament"],
    text: "Durante a gestação e amamentação, consulte sempre um profissional de saúde. Os óleos mais suaves e usados com cautela são:",
    oils: ["Lavender", "Lemon", "Frankincense"],
  },
  {
    match: ["pet", "cachorro", "cão", "cao", "gato", "anim"],
    text: "Cuidado com pets: muitos óleos não são indicados para gatos e cães pequenos. Sempre oriente-se com um veterinário.",
    oils: ["Lavender", "Cedarwood"],
  },
  {
    match: ["quais óleos", "quais oleos", "kit", "começar", "comecar", "iniciar", "primeiro", "comprar", "pedido", "encomenda"],
    text: "O melhor jeito de começar é com o Kit Inicial doTERRA, que reúne os óleos mais usados do dia a dia:",
    oils: ["Lavender", "Lemon", "Peppermint", "On Guard"],
  },
  {
    match: ["fevereiro", "garganta", "dor de garganta", "inflama"],
    text: "Para garganta irritada, uma gota diluída em água morna para gargarejo ajuda (não engula):",
    oils: ["On Guard", "Lemon", "Melaleuca"],
  },
  {
    match: ["tpm", "menstrua", "cólicas", "colicas", "feminin", "hormônios", "hormonios"],
    text: "Para o conforto feminino e equilíbrio hormonal, aplique diluído no baixo ventre:",
    oils: ["ClaryCalm", "Lavender", "Geranium", "Ylang Ylang"],
  },
  {
    match: ["cabelo", "queda", "couro", "oleosidade", "brilho"],
    text: "Para cabelos mais fortes e saudáveis, adicione gotas ao seu shampoo ou massageie o couro cabeludo:",
    oils: ["Rosemary", "Lavender", "Cedarwood", "Lemon"],
  },
  {
    match: ["suor", "transpir", "odor", "perfume", "cheirar bem", "fragrância", "fragrancia"],
    text: "Para uma fragrância natural que dura o dia todo, aplique nos pulsos e atrás das orelhas:",
    oils: ["Ylang Ylang", "Wild Orange", "Lavender", "Patchouli"],
  },
  {
    match: ["suplemento", "vitamin", "capsula", "ingestão", "ingestao", "tomar", "oral"],
    text: "Somente óleos com indicação de uso oral na embalagem podem ser ingeridos. Consulte um profissional antes:",
    oils: ["Lemon", "On Guard", "Peppermint", "Oregano"],
  },
  {
    match: ["contato", "consult", "atendimento", "prec", "duvida", "dúvida", "orçamento", "orcamento", "valores", "valor", "preço", "preco"],
    text: "Posso te ajudar com detalhes! Para tirar todas as suas dúvidas e receber um atendimento personalizado, fale comigo agora:",
    oils: [],
  },
];

const DEFAULT_RESPONSE: IaKnowledgeEntry = {
  match: [],
  text: "Entendi! Baseado no que você descreveu, recomendo começar por:",
  oils: ["Lavender", "Balance", "Serenity"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function keywordsOf(entry: IaTrainingEntry): string[] {
  return (entry.keywords || "")
    .split(",")
    .map((k) => normalize(k))
    .filter((k) => k.length > 1);
}

function oilsOf(entry: IaTrainingEntry): string[] {
  if (Array.isArray(entry.oils)) {
    return entry.oils.filter((o) => typeof o === "string" && o.trim());
  }
  return [];
}

/** Encontra a melhor resposta combinando o treinamento do consultor (prioridade) e a base padrão. */
export function findIaResponse(raw: string, training?: IaTrainingEntry[]): IaKnowledgeEntry {
  const input = normalize(raw);
  if (!input) return DEFAULT_RESPONSE;

  for (const entry of training || []) {
    if (!entry.text) continue;
    const kws = keywordsOf(entry);
    if (kws.length > 0 && kws.some((k) => input.includes(k))) {
      return { match: kws, text: entry.text, oils: oilsOf(entry) };
    }
  }

  const hit = DOTERRA_KNOWLEDGE.find((r) => r.match.some((k) => input.includes(k)));
  return hit || DEFAULT_RESPONSE;
}

export { DOTERRA_KNOWLEDGE, DEFAULT_RESPONSE };