-- ============================================================
-- 0026: Gateway de pagamento ativo + chaves (Super Admin)
-- Singleton (id=1). RLS habilitada SEM políticas: acesso apenas
-- via service role (rotas admin server-side). Nunca exposto ao browser.
-- ============================================================

create table if not exists public.payment_config (
  id int primary key default 1 check (id = 1),
  gateway text not null default 'stripe' check (gateway in ('stripe','mercadopago')),
  stripe_secret_key text,
  stripe_publishable_key text,
  stripe_webhook_secret text,
  mercadopago_access_token text,
  mercadopago_webhook_secret text,
  mercadopago_sandbox boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.payment_config enable row level security;

insert into public.payment_config (id) values (1)
on conflict (id) do nothing;

-- Cache do valor usado na criação dos Price IDs do Stripe (recria quando muda)
alter table public.plans add column if not exists activation_price_amount_cents int;
alter table public.plans add column if not exists monthly_price_amount_cents int;
