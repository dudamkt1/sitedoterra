-- ============================================================================
-- ARMAZENA STRIPE CUSTOMER ID DIRETO NO TENANT
-- ----------------------------------------------------------------------------
-- Motivo: o Customer do Stripe é criado no momento do checkout de ativação,
-- ANTES de existir qualquer assinatura. Armazená-lo no tenant evita a criação
-- de múltiplos Customers desnecessários (abandono/retry do checkout).
-- A coluna de subscriptions continua existindo para referência por assinatura.
-- ============================================================================

alter table public.tenants
  add column if not exists stripe_customer_id text;

create index if not exists tenants_stripe_customer_idx
  on public.tenants (stripe_customer_id);
