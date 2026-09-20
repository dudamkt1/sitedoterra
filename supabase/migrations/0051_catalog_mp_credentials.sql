-- ============================================================================
-- CATALOG MP CREDENTIALS (conta Mercado Pago do dono do catálogo)
-- Permite vincular a conta MP do usuário para receber PIX e cartão direto
-- no catálogo público, com parcelamento configurado na conta dele.
-- ============================================================================

alter table public.catalog_payment_settings
  add column if not exists mp_access_token text;

alter table public.catalog_payment_settings
  add column if not exists mp_public_key text;
