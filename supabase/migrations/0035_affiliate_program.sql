-- ============================================================================
-- Programa de Afiliados TopConsultores
-- ============================================================================

-- ============================ ENUMS ============================
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'affiliate_conversion_status' and typtype = 'e') then
    create type public.affiliate_conversion_status as enum ('pendente', 'aprovado', 'pago', 'estornado');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'affiliate_payout_status' and typtype = 'e') then
    create type public.affiliate_payout_status as enum ('solicitado', 'em_analise', 'pago', 'rejeitado');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'affiliate_payout_method' and typtype = 'e') then
    create type public.affiliate_payout_method as enum ('pix', 'mercado_pago');
  end if;
end $$;

-- ============================ TABELAS ============================

-- Configurações globais do programa (controlado pelo super admin)
create table if not exists public.affiliate_settings (
  id uuid primary key default uuid_generate_v4(),
  commission_percent numeric(5,2) not null default 10.00, -- % pago por ativação de novo usuário
  min_payout_amount numeric(10,2) not null default 50.00, -- valor mínimo para saque (em reais)
  program_active boolean not null default true, -- liga/desliga o programa inteiro
  terms_version int not null default 1, -- versionamento dos termos
  cookie_max_age_days int not null default 180, -- duração do cookie de atribuição
  updated_at timestamptz not null default now()
);

-- Insere configuração padrão (apenas uma linha)
insert into public.affiliate_settings (id, commission_percent, min_payout_amount, program_active, terms_version, cookie_max_age_days)
values (uuid_generate_v4(), 10.00, 50.00, true, 1, 180)
on conflict do nothing;

-- Status do afiliado por usuário
create table if not exists public.affiliate_status (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  is_active boolean not null default false, -- usuário ativou o programa no próprio painel?
  accepted_terms_at timestamptz,
  accepted_terms_version int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_status_user_idx on public.affiliate_status (user_id);

-- Rastreamento de primeiro clique (first click wins)
create table if not exists public.affiliate_clicks (
  id uuid primary key default uuid_generate_v4(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade, -- quem indicou
  visitor_token text not null, -- id gerado e salvo em cookie/localStorage do visitante
  source_subdomain text not null, -- subdomínio onde o clique ocorreu
  clicked_at timestamptz not null default now(),
  converted boolean not null default false
);

create index if not exists affiliate_clicks_affiliate_idx on public.affiliate_clicks (affiliate_user_id);
create index if not exists affiliate_clicks_visitor_token_idx on public.affiliate_clicks (visitor_token);
create index if not exists affiliate_clicks_converted_idx on public.affiliate_clicks (converted) where converted = false;

-- Conversões (quando o clique vira venda)
create table if not exists public.affiliate_conversions (
  id uuid primary key default uuid_generate_v4(),
  click_id uuid not null references public.affiliate_clicks(id) on delete cascade,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  new_customer_user_id uuid not null references auth.users(id) on delete cascade, -- quem comprou
  sale_amount numeric(10,2) not null, -- valor da venda em reais
  commission_percent_at_time numeric(5,2) not null, -- snapshot do % vigente na hora da venda
  commission_amount numeric(10,2) not null, -- valor da comissão em reais
  status public.affiliate_conversion_status not null default 'pendente',
  created_at timestamptz not null default now()
);

create index if not exists affiliate_conversions_click_idx on public.affiliate_conversions (click_id);
create index if not exists affiliate_conversions_affiliate_idx on public.affiliate_conversions (affiliate_user_id);
create index if not exists affiliate_conversions_customer_idx on public.affiliate_conversions (new_customer_user_id);
create index if not exists affiliate_conversions_status_idx on public.affiliate_conversions (status);

-- Solicitações de saque
create table if not exists public.affiliate_payouts (
  id uuid primary key default uuid_generate_v4(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,
  method public.affiliate_payout_method not null,
  pix_key text,
  mercado_pago_account_info jsonb,
  status public.affiliate_payout_status not null default 'solicitado',
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_user_id);
create index if not exists affiliate_payouts_status_idx on public.affiliate_payouts (status);

-- ============================ TRIGGERS ============================

drop trigger if exists affiliate_settings_touch on public.affiliate_settings;
create trigger affiliate_settings_touch before update on public.affiliate_settings
  for each row execute procedure public.touch_updated_at();

drop trigger if exists affiliate_status_touch on public.affiliate_status;
create trigger affiliate_status_touch before update on public.affiliate_status
  for each row execute procedure public.touch_updated_at();

-- ============================ RLS ============================

alter table public.affiliate_settings enable row level security;
alter table public.affiliate_status enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.affiliate_payouts enable row level security;

-- affiliate_settings: apenas superadmin lê/escreve (configuração global)
drop policy if exists affiliate_settings_select_admin on public.affiliate_settings;
create policy affiliate_settings_select_admin on public.affiliate_settings
  for select using (public.is_superadmin());

drop policy if exists affiliate_settings_update_admin on public.affiliate_settings;
create policy affiliate_settings_update_admin on public.affiliate_settings
  for update using (public.is_superadmin());

drop policy if exists affiliate_settings_insert_admin on public.affiliate_settings;
create policy affiliate_settings_insert_admin on public.affiliate_settings
  for insert with check (public.is_superadmin());

-- affiliate_status: usuário vê/edita o próprio, superadmin vê todos
drop policy if exists affiliate_status_select_own on public.affiliate_status;
create policy affiliate_status_select_own on public.affiliate_status
  for select using (user_id = auth.uid() or public.is_superadmin());

drop policy if exists affiliate_status_update_own on public.affiliate_status;
create policy affiliate_status_update_own on public.affiliate_status
  for update using (user_id = auth.uid());

drop policy if exists affiliate_status_insert_own on public.affiliate_status;
create policy affiliate_status_insert_own on public.affiliate_status
  for insert with check (user_id = auth.uid());

drop policy if exists affiliate_status_admin on public.affiliate_status;
create policy affiliate_status_admin on public.affiliate_status
  for all using (public.is_superadmin());

-- affiliate_clicks: afiliado vê seus próprios cliques, superadmin vê todos
drop policy if exists affiliate_clicks_select_own on public.affiliate_clicks;
create policy affiliate_clicks_select_own on public.affiliate_clicks
  for select using (affiliate_user_id = auth.uid() or public.is_superadmin());

drop policy if exists affiliate_clicks_insert_service on public.affiliate_clicks;
create policy affiliate_clicks_insert_service on public.affiliate_clicks
  for insert with check (true); -- service_role (API) pode inserir

drop policy if exists affiliate_clicks_update_service on public.affiliate_clicks;
create policy affiliate_clicks_update_service on public.affiliate_clicks
  for update using (true); -- service_role pode atualizar (marcar converted)

drop policy if exists affiliate_clicks_admin on public.affiliate_clicks;
create policy affiliate_clicks_admin on public.affiliate_clicks
  for all using (public.is_superadmin());

-- affiliate_conversions: afiliado vê suas conversões, superadmin vê todas
drop policy if exists affiliate_conversions_select_own on public.affiliate_conversions;
create policy affiliate_conversions_select_own on public.affiliate_conversions
  for select using (affiliate_user_id = auth.uid() or public.is_superadmin());

drop policy if exists affiliate_conversions_insert_service on public.affiliate_conversions;
create policy affiliate_conversions_insert_service on public.affiliate_conversions
  for insert with check (true); -- service_role (webhook) pode inserir

drop policy if exists affiliate_conversions_update_admin on public.affiliate_conversions;
create policy affiliate_conversions_update_admin on public.affiliate_conversions
  for update using (public.is_superadmin());

-- affiliate_payouts: afiliado vê/solicita seus saques, superadmin gerencia
drop policy if exists affiliate_payouts_select_own on public.affiliate_payouts;
create policy affiliate_payouts_select_own on public.affiliate_payouts
  for select using (affiliate_user_id = auth.uid() or public.is_superadmin());

drop policy if exists affiliate_payouts_insert_own on public.affiliate_payouts;
create policy affiliate_payouts_insert_own on public.affiliate_payouts
  for insert with check (affiliate_user_id = auth.uid());

drop policy if exists affiliate_payouts_update_admin on public.affiliate_payouts;
create policy affiliate_payouts_update_admin on public.affiliate_payouts
  for update using (public.is_superadmin());

-- ============================ FUNÇÕES AUXILIARES ============================

-- Retorna configuração global do programa
create or replace function public.get_affiliate_settings()
returns public.affiliate_settings
language sql
security definer
set search_path = public
stable
as $$
  select * from public.affiliate_settings limit 1;
$$;

-- Verifica se o programa está ativo globalmente
create or replace function public.is_affiliate_program_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select program_active from public.affiliate_settings limit 1;
$$;

-- Verifica se um usuário tem o programa ativo
create or replace function public.is_user_affiliate_active(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_active from public.affiliate_status where user_id = p_user_id;
$$;

-- Registra clique de afiliado (first-click wins)
-- Retorna o click_id se registrou, null se já existia token (atribuição mantida)
create or replace function public.register_affiliate_click(
  p_affiliate_user_id uuid,
  p_visitor_token text,
  p_source_subdomain text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_existing_token boolean;
begin
  -- Verifica se o programa está ativo globalmente
  if not (select program_active from public.affiliate_settings limit 1) then
    return null;
  end if;

  -- Verifica se o afiliado tem o programa ativo
  if not (select is_active from public.affiliate_status where user_id = p_affiliate_user_id) then
    return null;
  end if;

  -- First-click wins: verifica se já existe click para este visitor_token
  select exists(select 1 from public.affiliate_clicks where visitor_token = p_visitor_token)
  into v_existing_token;

  if v_existing_token then
    return null; -- Atribuição já existe, não sobrescreve
  end if;

  -- Registra o clique
  insert into public.affiliate_clicks (affiliate_user_id, visitor_token, source_subdomain)
  values (p_affiliate_user_id, p_visitor_token, p_source_subdomain)
  returning id into v_click_id;

  return v_click_id;
end;
$$;

-- Registra conversão a partir do visitor_token (chamado pelo webhook de pagamento)
create or replace function public.register_affiliate_conversion(
  p_visitor_token text,
  p_new_customer_user_id uuid,
  p_sale_amount numeric,
  p_commission_percent numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_affiliate_user_id uuid;
  v_commission_amount numeric;
  v_conversion_id uuid;
begin
  -- Busca o click não convertido para este visitor_token
  select id, affiliate_user_id
  into v_click_id, v_affiliate_user_id
  from public.affiliate_clicks
  where visitor_token = p_visitor_token
    and converted = false
  limit 1;

  if v_click_id is null then
    return null; -- Nenhum click pendente para este token
  end if;

  -- Calcula comissão
  v_commission_amount := round(p_sale_amount * p_commission_percent / 100, 2);

  -- Marca click como convertido
  update public.affiliate_clicks
  set converted = true
  where id = v_click_id;

  -- Cria registro de conversão
  insert into public.affiliate_conversions (
    click_id,
    affiliate_user_id,
    new_customer_user_id,
    sale_amount,
    commission_percent_at_time,
    commission_amount,
    status
  ) values (
    v_click_id,
    v_affiliate_user_id,
    p_new_customer_user_id,
    p_sale_amount,
    p_commission_percent,
    v_commission_amount,
    'pendente'
  )
  returning id into v_conversion_id;

  return v_conversion_id;
end;
$$;

-- Calcula saldo disponível do afiliado (conversões aprovadas - saques pagos)
create or replace function public.get_affiliate_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select sum(commission_amount) from public.affiliate_conversions
    where affiliate_user_id = p_user_id
      and status = 'aprovado'
  ), 0) - coalesce((
    select sum(amount) from public.affiliate_payouts
    where affiliate_user_id = p_user_id
      and status = 'pago'
  ), 0);
$$;

-- Calcula saldo pendente do afiliado (conversões pendentes)
create or replace function public.get_affiliate_pending_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(commission_amount), 0) from public.affiliate_conversions
  where affiliate_user_id = p_user_id
    and status = 'pendente';
$$;