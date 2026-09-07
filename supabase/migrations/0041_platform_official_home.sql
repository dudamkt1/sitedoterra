-- ============================================================================
-- Sincronização de Super Admin: fonte única de verdade para a Home, /demonstracao
-- e sites do Super Admin.
--
-- ANTES:
--   - A Home (`/`) resolvia o tenant via `process.env.HOME_TENANT_SLUG` (slug
--     fixo, default "usuarioteste"). Sem tenant com esse slug, a Home caía em
--     um fallback estático com dados de demonstração.
--   - Não havia como identificar programaticamente qual era o "site oficial".
--   - O super admin precisava ter um tenant próprio; se não tivesse, não
--     conseguia editar nada por /painel/meu-site.
--
-- DEPOIS:
--   - Tabela `platform_config` (key/value JSON) guarda configurações globais
--     da plataforma. Hoje: `home_tenant_slug` (slug canônico que representa a
--     Home oficial) e `official_superadmin_user_id` (cache do user_id do
--     super admin "oficial").
--   - Função `get_platform_config(key text)` retorna o valor ou NULL.
--   - Função `is_official_home_tenant(p_tenant_id uuid)` checa se o tenant
--     apontado por `home_tenant_slug` é o tenant "oficial" da plataforma.
--   - Função `resolve_official_home_tenant()` faz o trabalho completo:
--     lê config → resolve tenant → fallback robusto.
--   - Trigger `ensure_official_tenant_for_superadmin`: sempre que o profile
--     de um super admin for criado/atualizado e ele ainda não tiver tenant,
--     cria um tenant com slug `home` (canônico) e `site_settings` vazio.
--   - Constraint `tenants_official_home_unique`: apenas UM tenant pode ser
--     o oficial (defesa contra múltiplas flags simultâneas).
-- ============================================================================

-- ============================ TABELA platform_config ============================

create table if not exists public.platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_config_touch on public.platform_config;
create trigger platform_config_touch before update on public.platform_config
  for each row execute procedure public.touch_updated_at();

alter table public.platform_config enable row level security;

-- Leitura: qualquer usuário (anônimo incluso) — a config é pública.
drop policy if exists platform_config_select_all on public.platform_config;
create policy platform_config_select_all on public.platform_config
  for select using (true);

-- Escrita: somente super admin.
drop policy if exists platform_config_insert_admin on public.platform_config;
create policy platform_config_insert_admin on public.platform_config
  for insert with check (public.is_superadmin());

drop policy if exists platform_config_update_admin on public.platform_config;
create policy platform_config_update_admin on public.platform_config
  for update using (public.is_superadmin());

drop policy if exists platform_config_delete_admin on public.platform_config;
create policy platform_config_delete_admin on public.platform_config
  for delete using (public.is_superadmin());

-- ============================ COLUNA OFICIAL EM TENANTS ============================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'is_official_home'
  ) then
    alter table public.tenants add column is_official_home boolean not null default false;
  end if;
end $$;

-- Garantir que apenas UM tenant pode ser o oficial (constraint parcial).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_official_home_unique'
  ) then
    create unique index tenants_official_home_unique
      on public.tenants (is_official_home)
      where is_official_home = true;
  end if;
end $$;

-- ============================ FUNÇÕES AUXILIARES ============================

-- Lê uma chave da platform_config. Retorna NULL se não existir.
create or replace function public.get_platform_config(p_key text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select value from public.platform_config where key = p_key limit 1;
$$;

-- Seta uma chave da platform_config (cria ou atualiza). Apenas super admin.
-- Esta função é o ÚNICO caminho programático para alterar platform_config
-- usado pelo backoffice — ajuda a manter auditoria e evita writes diretos.
create or replace function public.set_platform_config(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized: only super admin can set platform_config';
  end if;
  insert into public.platform_config (key, value)
  values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- Verifica se um tenant é o "oficial" da plataforma (i.e. aquele cuja
-- configuração aparece na Home, /demonstracao e sites do super admin).
create or replace function public.is_official_home_tenant(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.tenants
    where id = p_tenant_id and is_official_home = true
  );
$$;

-- Resolve o tenant oficial da plataforma.
--
-- Estratégia:
--   1) Procura tenant com is_official_home = true (preferido).
--   2) Fallback: lê home_tenant_slug da platform_config e busca por slug.
--   3) Fallback final: pega o tenant de qualquer usuário com role=superadmin
--      (mais antigo, determinístico).
create or replace function public.resolve_official_home_tenant()
returns public.tenants
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tenant public.tenants;
  v_slug text;
begin
  -- (1) Flag explícita
  select * into v_tenant from public.tenants where is_official_home = true limit 1;
  if found then return v_tenant; end if;

  -- (2) Slug configurado
  v_slug := public.get_platform_config('home_tenant_slug') #>> '{}';
  if v_slug is not null and length(v_slug) > 0 then
    select * into v_tenant from public.tenants where slug = v_slug limit 1;
    if found then return v_tenant; end if;
  end if;

  -- (3) Fallback: tenant de super admin
  select t.* into v_tenant
  from public.tenants t
  join public.profiles p on p.user_id = t.user_id
  where p.role = 'superadmin'
  order by t.created_at asc
  limit 1;
  return v_tenant;
end;
$$;

-- ============================ SEED: platform_config inicial ============================

insert into public.platform_config (key, value)
values ('home_tenant_slug', to_jsonb('usuarioteste'::text))
on conflict (key) do nothing;

-- Se já existe um tenant com slug "usuarioteste", promovê-lo para oficial.
do $$
declare
  v_tid uuid;
begin
  select id into v_tid from public.tenants where slug = 'usuarioteste' limit 1;
  if v_tid is not null then
    update public.tenants set is_official_home = true where id = v_tid and not is_official_home;
  end if;
end $$;

-- ============================ TRIGGER: garante tenant para super admin ============================

-- Função que cria um tenant "home" para qualquer super admin que ainda não tenha.
create or replace function public.ensure_official_tenant_for_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_existing_tenant uuid;
begin
  -- Só age se o profile passou a ser superadmin.
  if (TG_OP = 'UPDATE' and OLD.role is not distinct from NEW.role) then
    return NEW;
  end if;

  if NEW.role is distinct from 'superadmin'::public.user_role then
    return NEW;
  end if;

  -- Tem tenant?
  select id into v_existing_tenant from public.tenants where user_id = NEW.user_id limit 1;
  if v_existing_tenant is not null then
    return NEW;
  end if;

  -- Cria tenant canônico. Se já existir slug 'home' (pertencente a outro user),
  -- anexa sufixo numérico para evitar conflito.
  declare
    v_slug text := 'home';
    v_i int := 1;
  begin
    while exists (select 1 from public.tenants where slug = v_slug) loop
      v_i := v_i + 1;
      v_slug := 'home' || v_i::text;
    end loop;
    insert into public.tenants (user_id, slug, site_status, site_name)
    values (NEW.user_id, v_slug, 'pending', 'Site Oficial')
    returning id into v_tenant_id;
    -- Cria site_settings vazio para o tenant oficial.
    insert into public.site_settings (tenant_id, data) values (v_tenant_id, '{}'::jsonb);
    -- Se não houver nenhum tenant oficial, promove este.
    if not exists (select 1 from public.tenants where is_official_home = true) then
      update public.tenants set is_official_home = true where id = v_tenant_id;
    end if;
  end;

  return NEW;
end;
$$;

drop trigger if exists profiles_ensure_official_tenant on public.profiles;
create trigger profiles_ensure_official_tenant
  after insert or update of role on public.profiles
  for each row execute procedure public.ensure_official_tenant_for_superadmin();

-- ============================ FUNÇÃO DE EXECUÇÃO SEGURA ============================

-- Esta função encapsula toda a lógica da migration 0041 em um único
-- ponto de execução idempotente. Assim, a rota admin pode chamá-la via
-- `.rpc('exec_migration_0041')` sem precisar de SQL arbitrário.
create or replace function public.exec_migration_0041()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text := 'migration_0041_applied';
  v_tid uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not_authorized: only super admin can apply this migration';
  end if;

  -- Re-aplicar partes-chave é seguro porque são IF NOT EXISTS / DROP IF EXISTS.

  -- platform_config table
  create table if not exists public.platform_config (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
  );
  if not exists (select 1 from pg_trigger where tgname = 'platform_config_touch') then
    create trigger platform_config_touch before update on public.platform_config
      for each row execute procedure public.touch_updated_at();
  end if;
  alter table public.platform_config enable row level security;
  drop policy if exists platform_config_select_all on public.platform_config;
  create policy platform_config_select_all on public.platform_config for select using (true);
  drop policy if exists platform_config_insert_admin on public.platform_config;
  create policy platform_config_insert_admin on public.platform_config for insert with check (public.is_superadmin());
  drop policy if exists platform_config_update_admin on public.platform_config;
  create policy platform_config_update_admin on public.platform_config for update using (public.is_superadmin());
  drop policy if exists platform_config_delete_admin on public.platform_config;
  create policy platform_config_delete_admin on public.platform_config for delete using (public.is_superadmin());

  -- is_official_home
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='is_official_home') then
    alter table public.tenants add column is_official_home boolean not null default false;
  end if;
  if not exists (select 1 from pg_indexes where indexname='tenants_official_home_unique') then
    create unique index tenants_official_home_unique on public.tenants (is_official_home) where is_official_home = true;
  end if;

  -- funções (re-create é seguro)
  create or replace function public.get_platform_config(p_key text) returns jsonb
    language sql security definer set search_path = public stable as $func$
      select value from public.platform_config where key = p_key limit 1;
    $func$;

  create or replace function public.set_platform_config(p_key text, p_value jsonb) returns void
    language plpgsql security definer set search_path = public as $func$
    begin
      if not public.is_superadmin() then
        raise exception 'not_authorized';
      end if;
      insert into public.platform_config (key, value) values (p_key, p_value)
        on conflict (key) do update set value = excluded.value, updated_at = now();
    end;
    $func$;

  create or replace function public.is_official_home_tenant(p_tenant_id uuid) returns boolean
    language sql security definer set search_path = public stable as $func$
      select exists(select 1 from public.tenants where id = p_tenant_id and is_official_home = true);
    $func$;

  create or replace function public.resolve_official_home_tenant() returns public.tenants
    language plpgsql security definer set search_path = public stable as $func$
    declare v_tenant public.tenants; v_slug text;
    begin
      select * into v_tenant from public.tenants where is_official_home = true limit 1;
      if found then return v_tenant; end if;
      v_slug := public.get_platform_config('home_tenant_slug') #>> '{}';
      if v_slug is not null and length(v_slug) > 0 then
        select * into v_tenant from public.tenants where slug = v_slug limit 1;
        if found then return v_tenant; end if;
      end if;
      select t.* into v_tenant from public.tenants t join public.profiles p on p.user_id = t.user_id
        where p.role = 'superadmin' order by t.created_at asc limit 1;
      return v_tenant;
    end;
    $func$;

  create or replace function public.ensure_official_tenant_for_superadmin() returns trigger
    language plpgsql security definer set search_path = public as $func$
    declare v_tenant_id uuid; v_existing_tenant uuid;
    begin
      if (TG_OP = 'UPDATE' and OLD.role is not distinct from NEW.role) then return NEW; end if;
      if NEW.role is distinct from 'superadmin'::public.user_role then return NEW; end if;
      select id into v_existing_tenant from public.tenants where user_id = NEW.user_id limit 1;
      if v_existing_tenant is not null then return NEW; end if;
      declare v_slug text := 'home'; v_i int := 1;
      begin
        while exists (select 1 from public.tenants where slug = v_slug) loop
          v_i := v_i + 1; v_slug := 'home' || v_i::text;
        end loop;
        insert into public.tenants (user_id, slug, site_status, site_name)
          values (NEW.user_id, v_slug, 'pending', 'Site Oficial')
          returning id into v_tenant_id;
        insert into public.site_settings (tenant_id, data) values (v_tenant_id, '{}'::jsonb);
        if not exists (select 1 from public.tenants where is_official_home = true) then
          update public.tenants set is_official_home = true where id = v_tenant_id;
        end if;
      end;
      return NEW;
    end;
    $func$;

  if not exists (select 1 from pg_trigger where tgname = 'profiles_ensure_official_tenant') then
    create trigger profiles_ensure_official_tenant
      after insert or update of role on public.profiles
      for each row execute procedure public.ensure_official_tenant_for_superadmin();
  end if;

  insert into public.platform_config (key, value) values ('home_tenant_slug', to_jsonb('usuarioteste'::text))
    on conflict (key) do nothing;

  select id into v_tid from public.tenants where slug = 'usuarioteste' limit 1;
  if v_tid is not null then
    update public.tenants set is_official_home = true where id = v_tid and not is_official_home;
  end if;

  -- Garantir tenant para qualquer super admin existente sem tenant.
  for v_tid in
    select p.user_id from public.profiles p
    where p.role = 'superadmin'
      and not exists (select 1 from public.tenants t where t.user_id = p.user_id)
  loop
    declare v_slug text := 'home'; v_i int := 1; v_new_id uuid;
    begin
      while exists (select 1 from public.tenants where slug = v_slug) loop
        v_i := v_i + 1; v_slug := 'home' || v_i::text;
      end loop;
      insert into public.tenants (user_id, slug, site_status, site_name)
        values (v_tid, v_slug, 'pending', 'Site Oficial')
        returning id into v_new_id;
      insert into public.site_settings (tenant_id, data) values (v_new_id, '{}'::jsonb);
      if not exists (select 1 from public.tenants where is_official_home = true) then
        update public.tenants set is_official_home = true where id = v_new_id;
      end if;
    end;
  end loop;

  grant execute on function public.get_platform_config(text) to anon, authenticated;
  grant execute on function public.set_platform_config(text, jsonb) to authenticated;
  grant execute on function public.is_official_home_tenant(uuid) to anon, authenticated;
  grant execute on function public.resolve_official_home_tenant() to anon, authenticated;
  grant execute on function public.exec_migration_0041() to authenticated;

  return v_msg;
end;
$$;

-- ============================ GRANTS ============================

grant execute on function public.get_platform_config(text) to anon, authenticated;
grant execute on function public.set_platform_config(text, jsonb) to authenticated;
grant execute on function public.is_official_home_tenant(uuid) to anon, authenticated;
grant execute on function public.resolve_official_home_tenant() to anon, authenticated;