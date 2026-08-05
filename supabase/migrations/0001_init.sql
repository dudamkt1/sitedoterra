-- ============================================================================
-- Plataforma Multi-Tenant doTERRA — Schema inicial
-- ============================================================================

-- ============================ EXTENSIONS ============================
create extension if not exists "uuid-ossp";

-- ============================ ENUMS ============================
create type public.user_role as enum ('user', 'superadmin');
create type public.account_status as enum ('pending_activation', 'active', 'suspended', 'blocked', 'cancelled');
create type public.site_status as enum ('pending', 'active', 'suspended');
create type public.subscription_status as enum ('awaiting_activation', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused');
create type public.domain_status as enum ('pending', 'verifying', 'verified', 'ssl_pending', 'active', 'error', 'removed', 'blocked');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'cancelled');
create type public.payment_type as enum ('activation', 'subscription', 'manual', 'refund');
create type public.plan_interval as enum ('month', 'year');
create type public.plan_status as enum ('active', 'inactive');

-- ============================ PROFILES ============================
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  role public.user_role not null default 'user',
  status public.account_status not null default 'pending_activation',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  suspended_at timestamptz,
  blocked_at timestamptz,
  unblocked_at timestamptz
);
create index profiles_email_idx on public.profiles (email);

-- ============================ TENANTS ============================
create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(user_id) on delete cascade unique,
  slug text unique not null,
  site_name text,
  site_status public.site_status not null default 'pending',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  reactivated_at timestamptz,
  settings jsonb not null default '{}'::jsonb
);
create index tenants_slug_idx on public.tenants (slug);

-- ============================ SITE SETTINGS ============================
create table public.site_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================ PLANS ============================
create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  description text,
  activation_price_cents int not null default 0,
  monthly_price_cents int not null default 0,
  billing_interval public.plan_interval not null default 'month',
  status public.plan_status not null default 'active',
  features jsonb not null default '[]'::jsonb,
  stripe_product_id text,
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================ SUBSCRIPTIONS ============================
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status public.subscription_status not null default 'awaiting_activation',
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  activated_at timestamptz,
  canceled_at timestamptz,
  reactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- ============================ PAYMENTS ============================
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  type public.payment_type not null,
  amount_cents int not null,
  currency text not null default 'brl',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payments_tenant_idx on public.payments (tenant_id);

-- ============================ BILLING HISTORY ============================
create table public.billing_history (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid references public.plans(id),
  stripe_invoice_id text unique,
  stripe_charge_id text,
  type public.payment_type not null,
  amount_cents int not null,
  currency text not null default 'brl',
  status public.payment_status not null default 'pending',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);
create index billing_tenant_idx on public.billing_history (tenant_id);

-- ============================ DOMAINS ============================
create table public.domains (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  is_apex boolean not null default false,
  vercel_domain_id text,
  status public.domain_status not null default 'pending',
  ssl_status text,
  vercel_config jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  verified_at timestamptz,
  last_checked_at timestamptz,
  error_message text,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index domains_tenant_idx on public.domains (tenant_id);
create index domains_domain_idx on public.domains (domain);

-- ============================ PAYMENT EVENTS (webhooks / auditoria) ============================
create table public.payment_events (
  id uuid primary key default uuid_generate_v4(),
  stripe_event_id text not null unique,
  stripe_event_type text not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

-- ============================ AUDIT LOGS ============================
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.user_role,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ============================ TRIGGERS ============================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger tenants_touch before update on public.tenants
  for each row execute procedure public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute procedure public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute procedure public.touch_updated_at();
create trigger plans_touch before update on public.plans
  for each row execute procedure public.touch_updated_at();

-- ============================ FUNÇÕES PÚBLICAS (multi-tenant) ============================
-- Retorna o tenant público por slug, apenas se o site for PUBLICO.
create or replace function public.get_public_tenant_by_slug(p_slug text)
returns table (
  tenant_id uuid,
  slug text,
  site_name text,
  site_status public.site_status,
  settings jsonb,
  site_data jsonb,
  profile_name text,
  email text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.slug,
    t.site_name,
    t.site_status,
    t.settings,
    s.data,
    p.name,
    p.email
  from public.tenants t
  left join public.site_settings s on s.tenant_id = t.id
  left join public.profiles p on p.user_id = t.user_id
  where t.slug = p_slug
    and t.site_status = 'active'
    and exists (
      select 1 from public.profiles pr
      join public.subscriptions su on su.tenant_id = t.id
      where pr.user_id = t.user_id
        and pr.status = 'active'
        and su.status = 'active'
    );
$$;

-- Retorna o tenant por domínio personalizado (apenas se PUBLICO).
create or replace function public.get_public_tenant_by_domain(p_domain text)
returns table (
  tenant_id uuid,
  slug text,
  site_name text,
  site_status public.site_status,
  settings jsonb,
  site_data jsonb,
  profile_name text,
  email text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.slug,
    t.site_name,
    t.site_status,
    t.settings,
    s.data,
    p.name,
    p.email
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  left join public.site_settings s on s.tenant_id = t.id
  left join public.profiles p on p.user_id = t.user_id
  where lower(d.domain) = lower(p_domain)
    and d.status in ('verified', 'ssl_pending', 'active')
    and d.removed_at is null
    and t.site_status = 'active'
    and exists (
      select 1 from public.profiles pr
      join public.subscriptions su on su.tenant_id = t.id
      where pr.user_id = t.user_id
        and pr.status = 'active'
        and su.status = 'active'
    );
$$;

-- Verifica disponibilidade de slug (unico) e palavras reservadas.
create or replace function public.is_slug_available(p_slug text, p_exclude_user_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_slug is null or p_slug = '' then
    return false;
  end if;
  if p_slug ~ '[^a-z0-9-]' then
    return false;
  end if;
  if p_slug ~ '^-|-$|--' then
    return false;
  end if;
  if p_slug in ('admin','login','cadastro','signup','api','super-admin','painel','configuracoes','usuarios','dominio','dominios','assinatura','pagamento','planos','admin-login','auth','www','app','dashboard','suporte','ajuda','legal','politica-privacidade','termos') then
    return false;
  end if;
  if length(p_slug) < 2 or length(p_slug) > 40 then
    return false;
  end if;
  return not exists (
    select 1 from public.tenants t
    where t.slug = p_slug
      and (p_exclude_user_id is null or t.user_id <> p_exclude_user_id)
  );
end;
$$;

-- Cria o tenant do usuário (chamado após ativação). Retorna o tenant.
create or replace function public.create_tenant(p_user_id uuid, p_slug text)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants;
  v_available boolean;
begin
  select public.is_slug_available(p_slug, p_user_id) into v_available;
  if not v_available then
    raise exception 'SLUG_TAKEN';
  end if;

  insert into public.tenants (user_id, slug, site_status, activated_at)
  values (p_user_id, p_slug, 'active', now())
  returning * into v_tenant;

  insert into public.site_settings (tenant_id, data)
  values (v_tenant.id, '{}'::jsonb)
  on conflict (tenant_id) do nothing;

  update public.profiles
  set status = 'active', activated_at = now()
  where user_id = p_user_id;

  return v_tenant;
end;
$$;

-- Helper de acesso do Super Admin (usado pelas políticas de RLS).
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'superadmin' from public.profiles where user_id = auth.uid()), false);
$$;

-- ============================ RLS ============================
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.site_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.billing_history enable row level security;
alter table public.domains enable row level security;
alter table public.plans enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payment_events enable row level security;

create policy audit_select_admin on public.audit_logs
  for select using (public.is_superadmin());
create policy payment_events_select_admin on public.payment_events
  for select using (public.is_superadmin());

-- Isolamento multi-tenant: cada usuário só acessa os próprios dados.
-- O papel 'superadmin' acessa tudo. Admin da app usa service_role (bypass RLS).

create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid() or public.is_superadmin());
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());
create policy profiles_update_admin on public.profiles
  for update using (public.is_superadmin());
create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid());

create policy tenants_select_own on public.tenants
  for select using (user_id = auth.uid() or public.is_superadmin());
create policy tenants_update_own on public.tenants
  for update using (user_id = auth.uid());
create policy tenants_update_admin on public.tenants
  for update using (public.is_superadmin());
create policy tenants_insert_own on public.tenants
  for insert with check (user_id = auth.uid());
create policy tenants_delete_admin on public.tenants
  for delete using (public.is_superadmin());

create policy site_settings_select_own on public.site_settings
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy site_settings_update_own on public.site_settings
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy site_settings_update_admin on public.site_settings
  for update using (public.is_superadmin());
create policy site_settings_insert_own on public.site_settings
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));

create policy subs_select_own on public.subscriptions
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy subs_update_own on public.subscriptions
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy subs_update_admin on public.subscriptions
  for update using (public.is_superadmin());
create policy subs_insert_own on public.subscriptions
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));

create policy payments_select_own on public.payments
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy payments_select_admin on public.payments
  for select using (public.is_superadmin());

create policy billing_select_own on public.billing_history
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

create policy domains_select_own on public.domains
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy domains_update_own on public.domains
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy domains_update_admin on public.domains
  for update using (public.is_superadmin());
create policy domains_insert_own on public.domains
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy domains_delete_admin on public.domains
  for delete using (public.is_superadmin());

create policy plans_select_all on public.plans
  for select using (true);

-- ============================ SEED ============================
-- Modelo comercial: R$ 297,00 de ativação (único) + R$ 47,00/mês (recorrente).
-- Os Price IDs cobrados vêm do Stripe via variáveis de ambiente.
insert into public.plans (name, code, description, activation_price_cents, monthly_price_cents, billing_interval, features, is_active)
values
  ('Plano Mensal', 'monthly', 'Site profissional, IA, agendamento, CRM e domínio próprio.', 29700, 4700, 'month', '["Site profissional personalizado","Chat IA especialista doTERRA","Agendamento integrado","CRM de clientes","Domínio próprio incluso","Suporte por WhatsApp"]', true),
  ('Plano Anual', 'yearly', 'Todos os benefícios do plano mensal com desconto.', 29700, 4700, 'year', '["Tudo do plano mensal","Domínio próprio incluso","Base de conhecimento IA","Relatórios avançados","Prioridade no suporte","Novidades em primeira mão"]', false)
on conflict (code) do nothing;
