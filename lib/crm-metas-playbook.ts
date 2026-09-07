/** Playbook estático de boas práticas (caminho 1).
 *
 * Roteiros inspirados em práticas consagradas de consultoras doTERRA,
 * mapeados 1:1 às situações que o sistema já detecta nos dados do CRM
 * (action_key das recomendações determinísticas de lib/crm-metas.ts).
 * Sem IA, sem API externa: conteúdo fixo, escolha da ação é determinística.
 */

export interface PlaybookEntry {
  action_key: string;
  headline: string;
  steps: string[];
}

export const METAS_PLAYBOOK: Record<string, PlaybookEntry> = {
  reactivate: {
    action_key: "reactivate",
    headline: "Roteiro de reativação em 3 mensagens",
    steps: [
      "Retome sem vender: chame pelo nome, cite a última compra e pergunte como está a experiência.",
      "Ofereça algo específico: reposição do óleo favorito ou amostra de um lançamento que combine com o perfil.",
      "Último contato com prazo: condição especial válida até o fim da semana e pedido de resposta (sim ou não).",
    ],
  },
  leads: {
    action_key: "leads",
    headline: "Converter Leads: convite + experiência",
    steps: [
      "Convide para uma experiência curta (presencial ou vídeo de 15 min) em vez de enviar catálogo frio.",
      "Na conversa, apresente 1 kit de entrada alinhado à necessidade que o lead mencionou.",
      "Faça follow-up em 48h com uma pergunta direta e registre o resultado no CRM.",
    ],
  },
  tasks: {
    action_key: "tasks",
    headline: "Mutirão de follow-ups",
    steps: [
      "Liste as tarefas pendentes e ordene por valor potencial (reposição e aniversários primeiro).",
      "Reserve blocos de 25 min só para executar os contatos, sem alternar com outras atividades.",
      "Ao concluir cada contato, atualize a tarefa no CRM para não perder o fio.",
    ],
  },
  "close-gap": {
    action_key: "close-gap",
    headline: "Oferta da semana para fechar a diferença",
    steps: [
      "Monte 1 combo objetivo (ex.: reposição + lançamento) com preço fechado e prazo até domingo.",
      "Liste 10 clientes propensos (última compra há 30–90 dias) e envie mensagem personalizada.",
      "Acompanhe quem visualizou e não respondeu em 48h com uma segunda mensagem curta.",
    ],
  },
  "first-sale": {
    action_key: "first-sale",
    headline: "Destravar a primeira venda do período",
    steps: [
      "Liste 5 pessoas próximas que já demonstraram interesse e ainda não compraram.",
      "Envie mensagem de novidade (chegada, reposição ou condição de início de mês).",
      "Registre a primeira venda no CRM — ela destrava o ritmo do restante do período.",
    ],
  },
  vips: {
    action_key: "vips",
    headline: "Cuidar de quem mais compra (manutenção)",
    steps: [
      "Envie mensagem de cortesia aos VIPs (sem oferta): pergunte do uso e ofereça dica.",
      "Apresente lançamentos em primeira mão com prioridade de entrega.",
      "Peça indicação: quem indica amiga mantém o ciclo de vendas girando.",
    ],
  },
};

export function playbookFor(action_key: string): PlaybookEntry | null {
  return METAS_PLAYBOOK[action_key] || null;
}
