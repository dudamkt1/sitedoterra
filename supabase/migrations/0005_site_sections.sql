-- ============================================================================
-- HOME MODULAR MULTI-TENANT
-- ----------------------------------------------------------------------------
-- * site_sections   -> definição GLOBAL das seções da HOME (Super Admin)
-- * tenant_sections -> personalização de cada tenant por seção (usuário)
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

-- ============================ SITE SECTIONS ============================
create table if not exists public.site_sections (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  key text not null unique,
  label text not null,
  title text,
  subtitle text,
  enabled boolean not null default true,
  is_required boolean not null default false,
  sort_order int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_sections_enabled_idx on public.site_sections (enabled, sort_order);

-- ============================ TENANT SECTIONS ============================
create table if not exists public.tenant_sections (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  section_id uuid not null references public.site_sections(id) on delete cascade,
  enabled boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, section_id)
);
create index if not exists tenant_sections_tenant_idx on public.tenant_sections (tenant_id);
create index if not exists tenant_sections_section_idx on public.tenant_sections (section_id);

-- ============================ TRIGGERS (updated_at) ============================
drop trigger if exists site_sections_touch on public.site_sections;
create trigger site_sections_touch before update on public.site_sections
  for each row execute procedure public.touch_updated_at();
drop trigger if exists tenant_sections_touch on public.tenant_sections;
create trigger tenant_sections_touch before update on public.tenant_sections
  for each row execute procedure public.touch_updated_at();

-- ============================ RLS ============================
alter table public.site_sections enable row level security;
alter table public.tenant_sections enable row level security;

-- site_sections: leitura pública (informação das seções), gestão só Super Admin
drop policy if exists site_sections_select_all on public.site_sections;
create policy site_sections_select_all on public.site_sections
  for select using (true);
drop policy if exists site_sections_insert_admin on public.site_sections;
create policy site_sections_insert_admin on public.site_sections
  for insert with check (public.is_superadmin());
drop policy if exists site_sections_update_admin on public.site_sections;
create policy site_sections_update_admin on public.site_sections
  for update using (public.is_superadmin());
drop policy if exists site_sections_delete_admin on public.site_sections;
create policy site_sections_delete_admin on public.site_sections
  for delete using (public.is_superadmin());

-- tenant_sections: dono do tenant ou Super Admin
drop policy if exists tenant_sections_select_own on public.tenant_sections;
create policy tenant_sections_select_own on public.tenant_sections
  for select using (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_sections_insert_own on public.tenant_sections;
create policy tenant_sections_insert_own on public.tenant_sections
  for insert with check (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_sections_update_own on public.tenant_sections;
create policy tenant_sections_update_own on public.tenant_sections
  for update using (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_sections_delete_admin on public.tenant_sections;
create policy tenant_sections_delete_admin on public.tenant_sections
  for delete using (public.is_superadmin());

-- ============================ GRANTS ============================
grant execute on function public.is_superadmin() to authenticated;
