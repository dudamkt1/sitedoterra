-- ============================================================================
-- COBRANÇA MENSAL INICIA APÓS N MESES (definido pelo Super Admin)
-- ----------------------------------------------------------------------------
-- Substitui o modelo "primeira cobrança em N dias" (trial_days) por
-- "após N meses da ativação" (trial_months, padrão 3 meses).
-- O Super Admin define em /admin/planos quantos meses o cliente tem após a
-- ativação para iniciar a cobrança mensal. O cliente pode cancelar quando quiser.
-- A coluna trial_days é mantida para compatibilidade, mas deixa de ser usada.
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

-- ============================ NOVA COLUNA ============================
alter table public.plans add column if not exists trial_months int not null default 3;

-- ============================ SEED / CONFIGURAÇÃO ATUAL ============================
-- Mensalidade: R$ 47/mês, primeira cobrança após 3 meses da ativação (trial_months)
-- Cancelamento: permitido a qualquer momento (sem fidelidade / multa)
update public.plans
set trial_months = 3,
    transparency_text = '{activation} corresponde à ativação inicial do site. Após 3 meses, inicia-se a mensalidade de {monthly}. Sem fidelidade e com cancelamento quando quiser.'
where code = 'monthly';
