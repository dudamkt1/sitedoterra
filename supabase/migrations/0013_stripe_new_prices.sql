-- ============================================================================
-- NOVA CONTA STRIPE — ATUALIZA OS PRICE IDs DA CONFIGURAÇÃO COMERCIAL
-- ----------------------------------------------------------------------------
-- Atualiza a fonte de verdade (tabela `plans`) com os novos Price IDs da nova
-- conta Stripe. A tabela `plans` TEM PRIORIDADE sobre as variáveis de ambiente
-- (lib/billing.ts resolve primeiro activation_price_id / monthly_price_id).
--
-- NOVO PRODUTO:  prod_V4qSyICHHkYlZd
--   Ativação R$ 297,00 (one-time): price_1U4gl7KyzQRHIXPePuOAXdOm
--   Mensalidade R$ 47,00 (recorrente): price_1U4gmaKyzQRHIXPeO9x4HSe5
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

update public.plans
set stripe_product_id = 'prod_V4qSyICHHkYlZd',
    activation_price_id = 'price_1U4gl7KyzQRHIXPePuOAXdOm',
    monthly_price_id = 'price_1U4gmaKyzQRHIXPeO9x4HSe5'
where code = 'monthly';