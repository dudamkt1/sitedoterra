-- ============================================================================
-- FORMA DE PAGAMENTO E DETALHES DO SALDO (rastreabilidade do pagamento)
-- ============================================================================
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
-- e executar. Idempotente: pode ser re-executado sem erros.
--
-- CONTEXTO / REGRA DE NEGÓCIO
--   Antes desta migration o histórico (payments/billing_history) registrava
--   apenas tipo/valor/status — não era possível saber COMO o pagamento foi
--   feito (PIX, cartão, saldo da equipe ou saldo de afiliados). O valor pago
--   com "Saldo em Conta"/"Saldo de Afiliados" aparecia como R$ 0,00 sem
--   indicar que a cobrança foi quitada por crédito.
--
--   Agora cada lançamento guarda:
--     payment_method        'pix' | 'card' | 'credit' | 'mixed' | 'manual' | 'other'
--                           - 'credit' = quitado 100% por saldo/crédito (sem gateway)
--                           - 'mixed'  = parte por saldo/crédito + parte no gateway
--     credit_applied_cents  quanto foi abatido por saldo/crédito (centavos)
--     original_amount_cents valor original ANTES do abatimento (centavos)
--
--   A coluna `gateway` ('stripe'|'mercadopago'|'affiliate_credit') já existe
--   desde a migration 0024; passa a ser preenchida em conjunto.
-- ============================================================================

-- ============================== payments ==============================

alter table public.payments
  add column if not exists payment_method text,
  add column if not exists credit_applied_cents integer not null default 0,
  add column if not exists original_amount_cents integer;

-- =========================== billing_history ==========================

alter table public.billing_history
  add column if not exists payment_method text,
  add column if not exists credit_applied_cents integer not null default 0,
  add column if not exists original_amount_cents integer;

-- ============================ constraints =============================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_payment_method_check'
  ) then
    alter table public.payments
      add constraint payments_payment_method_check
      check (
        payment_method is null
        or payment_method in ('pix', 'card', 'credit', 'mixed', 'manual', 'other')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'billing_history_payment_method_check'
  ) then
    alter table public.billing_history
      add constraint billing_history_payment_method_check
      check (
        payment_method is null
        or payment_method in ('pix', 'card', 'credit', 'mixed', 'manual', 'other')
      );
  end if;
end $$;

comment on column public.payments.payment_method is
  'Forma de pagamento: pix | card | credit (100% saldo) | mixed (saldo + gateway) | manual | other.';
comment on column public.payments.credit_applied_cents is
  'Valor (centavos) abatido por Saldo em Conta / saldo de afiliados.';
comment on column public.payments.original_amount_cents is
  'Valor original (centavos) antes do abatimento por saldo.';
comment on column public.billing_history.payment_method is
  'Forma de pagamento: pix | card | credit (100% saldo) | mixed (saldo + gateway) | manual | other.';
comment on column public.billing_history.credit_applied_cents is
  'Valor (centavos) abatido por Saldo em Conta / saldo de afiliados.';
comment on column public.billing_history.original_amount_cents is
  'Valor original (centavos) antes do abatimento por saldo.';
