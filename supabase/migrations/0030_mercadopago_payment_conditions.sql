-- ============================================================
-- 0030: Condições dinâmicas Mercado Pago (parcelamento + PIX)
-- Singleton payment_config ganha campos que o checkout consome
-- dinamicamente, sem hardcoded. Valores padrão = sem benefício
-- extra (compatível com produção existente).
-- ============================================================

alter table public.payment_config add column if not exists mercadopago_public_key text;
alter table public.payment_config add column if not exists mercadopago_pix_discount_percent numeric not null default 0;
alter table public.payment_config add column if not exists mercadopago_installments int not null default 0;
alter table public.payment_config add column if not exists mercadopago_installments_without_interest boolean not null default true;

-- Garante limites sanos (0 = sem benefício; desconto em %)
alter table public.payment_config drop constraint if exists payment_config_pix_discount_chk;
alter table public.payment_config add constraint payment_config_pix_discount_chk
  check (mercadopago_pix_discount_percent >= 0 and mercadopago_pix_discount_percent <= 50);

alter table public.payment_config drop constraint if exists payment_config_installments_chk;
alter table public.payment_config add constraint payment_config_installments_chk
  check (mercadopago_installments >= 0 and mercadopago_installments <= 12);
