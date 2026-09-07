-- ============================================================================
-- 0042: Minhas Metas do CRM (mensal / semestral / anual) + checklist
--
-- Fonte oficial de receita: public.crm_sales.total_cents onde status NOT IN
-- ('Cancelado','Reembolsado'), filtrado por sale_date no período da meta.
-- Mesma regra de lib/crm.ts saleEffectiveCents() usada pelo dashboard.
-- Isolamento por tenant: mesmo padrão de 0022_crm.sql (via tenants.user_id).
-- ============================================================================

-- ============================ TABELA crm_metas ============================

create table if not exists public.crm_metas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('monthly','semiannual','annual')),
  year int not null check (year between 2020 and 2100),
  month int check (month is null or (month between 1 and 12)),
  semester int check (semester is null or semester in (1, 2)),
  target_cents int not null default 0 check (target_cents >= 0),
  target_sales int not null default 0 check (target_sales >= 0),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_metas_period_check check (
    (type = 'monthly' and month is not null and semester is null) or
    (type = 'semiannual' and semester is not null and month is null) or
    (type = 'annual' and month is null and semester is null)
  )
);

drop trigger if exists crm_metas_touch on public.crm_metas;
create trigger crm_metas_touch before update on public.crm_metas
  for each row execute procedure public.touch_updated_at();

create index if not exists crm_metas_tenant_idx on public.crm_metas(tenant_id);
create index if not exists crm_metas_period_idx on public.crm_metas(tenant_id, type, year);

-- Unicidade por período (NULL-safe via COALESCE).
create unique index if not exists crm_metas_unique_period
  on public.crm_metas(tenant_id, type, year, coalesce(month, 0), coalesce(semester, 0));

-- ============================ TABELA crm_meta_checks ============================

create table if not exists public.crm_meta_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  meta_id uuid not null references public.crm_metas(id) on delete cascade,
  action_key text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  priority int not null default 2 check (priority between 1 and 3),
  period_key text not null default '',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meta_id, action_key)
);

drop trigger if exists crm_meta_checks_touch on public.crm_meta_checks;
create trigger crm_meta_checks_touch before update on public.crm_meta_checks
  for each row execute procedure public.touch_updated_at();

create index if not exists crm_meta_checks_tenant_idx on public.crm_meta_checks(tenant_id);
create index if not exists crm_meta_checks_meta_idx on public.crm_meta_checks(meta_id);

-- ============================ RLS (padrão 0022) ============================

alter table public.crm_metas enable row level security;
alter table public.crm_meta_checks enable row level security;

do $$
declare
  t text;
  tables text[] := array['crm_metas','crm_meta_checks'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin()) with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_delete_own', t);
  end loop;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on public.crm_metas to authenticated;
grant select, insert, update, delete on public.crm_meta_checks to authenticated;

-- ============================ RPC idempotente ============================

create or replace function public.exec_migration_0042() returns text
  language plpgsql security definer set search_path = public as $func$
declare
  v_msg text := '0042 already applied';
begin
  -- Re-executa de forma segura: tabelas/policies/índices usam IF NOT EXISTS / DROP IF EXISTS acima.
  -- Este bloco só garante que a função exista e registra a execução.
  create table if not exists public.crm_metas (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('monthly','semiannual','annual')),
    year int not null check (year between 2020 and 2100),
    month int check (month is null or (month between 1 and 12)),
    semester int check (semester is null or semester in (1, 2)),
    target_cents int not null default 0 check (target_cents >= 0),
    target_sales int not null default 0 check (target_sales >= 0),
    name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.crm_meta_checks (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    meta_id uuid not null references public.crm_metas(id) on delete cascade,
    action_key text not null,
    title text not null,
    status text not null default 'pending' check (status in ('pending','done','skipped')),
    priority int not null default 2 check (priority between 1 and 3),
    period_key text not null default '',
    done_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (meta_id, action_key)
  );

  alter table public.crm_metas enable row level security;
  alter table public.crm_meta_checks enable row level security;

  grant select, insert, update, delete on public.crm_metas to authenticated;
  grant select, insert, update, delete on public.crm_meta_checks to authenticated;
  grant execute on function public.exec_migration_0042() to authenticated;

  v_msg := '0042 applied';
  return v_msg;
end;
$func$;

grant execute on function public.exec_migration_0042() to authenticated;
