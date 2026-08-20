-- ============================================================================
-- MERCADO PAGO — SEGUNDO GATEWAY DE PAGAMENTO (sincronizado com /admin/planos)
-- ----------------------------------------------------------------------------
-- Extende o schema para suportar o Mercado Pago SEM criar estrutura paralela:
--   * `plans` continua sendo a ÚNICA fonte de verdade comercial (ativação,
--     mensalidade, trial). Guarda apenas o cache do plano recorrente do MP
--     (criado automaticamente na primeira contratação).
--   * `subscriptions.gateway` identifica o gateway ('stripe' | 'mercadopago').
--   * `subscriptions.snapshot` congela os termos contratuais no momento da
--     contratação (ativação, mensalidade, trial, moeda, plan_id). Alterações
--     futuras de preço em /admin/planos NÃO afetam contratos existentes.
--   * `payments` / `billing_history` ganham colunas de idempotência do MP.
--   * `payment_events.gateway` diferencia eventos de webhook por gateway.
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

-- ============================ plans: cache do plano recorrente do MP ============================
alter table public.plans add column if not exists mercadopago_plan_id text;
alter table public.plans add column if not exists mercadopago_plan_amount_cents int;

-- ============================ subscriptions ============================
alter table public.subscriptions add column if not exists gateway text not null default 'stripe';
alter table public.subscriptions add column if not exists mercadopago_customer_id text;
alter table public.subscriptions add column if not exists mercadopago_subscription_id text unique;
alter table public.subscriptions add column if not exists mercadopago_plan_id text;
alter table public.subscriptions add column if not exists snapshot jsonb not null default '{}'::jsonb;

create index if not exists subscriptions_mercadopago_idx on public.subscriptions (mercadopago_subscription_id);
create index if not exists subscriptions_gateway_idx on public.subscriptions (gateway);

-- ============================ payments ============================
alter table public.payments add column if not exists gateway text not null default 'stripe';
alter table public.payments add column if not exists mercadopago_payment_id text unique;
alter table public.payments add column if not exists mercadopago_preference_id text;

-- ============================ billing_history ============================
alter table public.billing_history add column if not exists gateway text not null default 'stripe';
alter table public.billing_history add column if not exists mercadopago_payment_id text unique;

-- ============================ payment_events (webhooks) ============================
alter table public.payment_events add column if not exists gateway text not null default 'stripe';
create index if not exists payment_events_gateway_idx on public.payment_events (gateway);