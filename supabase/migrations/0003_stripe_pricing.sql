-- ============================================================================
-- ALINHA PLANOS AO MODELO COMERCIAL FIXO (R$ 297,00 ativação + R$ 47,00/mês)
-- ----------------------------------------------------------------------------
-- O valor efetivamente cobrado vem dos Price IDs do Stripe (variáveis de
-- ambiente). Estes valores mantêm a exibição no painel/admin coerente.
-- O plano anual é desativado enquanto o modelo utiliza apenas a mensalidade.
-- ============================================================================

update public.plans
set activation_price_cents = 29700,
    monthly_price_cents = 4700
where code = 'monthly';

update public.plans
set is_active = false
where code = 'yearly';
