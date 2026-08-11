-- ============================================================================
-- SISTEMA CENTRAL DE MÍDIA (Cloudflare R2 + metadados no Supabase)
-- ----------------------------------------------------------------------------
-- O Supabase armazena SOMENTE metadados; os binários vivem no Cloudflare R2.
-- Separação multi-tenant: cada arquivo pertence ao tenant do usuário autenticado
-- (campo tenant_id). Mídias do sistema (HOME global do Super Admin) têm
-- tenant_id NULL e prefixo `sistema/` no R2.
-- Inclui media_files (metadados), media_actions (auditoria) e a quota por plano
-- (plans.media_quota_bytes). Idempotente: pode ser re-executado sem erros.
-- ============================================================================

-- ============================ MEDIA_FILES ============================
create table if not exists public.media_files (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null unique,
  public_url text,
  original_name text,
  file_name text,
  mime_type text,
  file_size bigint not null default 0,
  width int,
  height int,
  category text not null default 'general',
  folder text,
  is_public boolean not null default true,
  status text not null default 'uploaded' check (status in ('uploading', 'uploaded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_files_tenant_idx on public.media_files (tenant_id);
create index if not exists media_files_user_idx on public.media_files (user_id);
create index if not exists media_files_category_idx on public.media_files (category);
create index if not exists media_files_status_idx on public.media_files (status);
create index if not exists media_files_created_idx on public.media_files (created_at desc);

-- ============================ MEDIA_ACTIONS (auditoria) ============================
create table if not exists public.media_actions (
  id uuid primary key default uuid_generate_v4(),
  media_id uuid references public.media_files(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists media_actions_created_idx on public.media_actions (created_at desc);

-- ============================ QUOTA POR PLANO ============================
alter table public.plans add column if not exists media_quota_bytes bigint not null default 536870912; -- 500 MB

update public.plans set media_quota_bytes = 536870912 where media_quota_bytes is null or media_quota_bytes <= 0;

-- ============================ TRIGGER updated_at ============================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists media_files_updated_at on public.media_files;
create trigger media_files_updated_at before update on public.media_files
  for each row execute function public.set_updated_at();

-- ============================ RLS ============================
alter table public.media_files enable row level security;
alter table public.media_actions enable row level security;

-- media_files: o usuário vê/gerencia os PRÓPRIOS arquivos; superadmin vê tudo.
drop policy if exists media_files_select_own on public.media_files;
create policy media_files_select_own on public.media_files
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists media_files_insert_own on public.media_files;
create policy media_files_insert_own on public.media_files
  for insert with check (user_id = auth.uid() or public.is_superadmin());
drop policy if exists media_files_update_own on public.media_files;
create policy media_files_update_own on public.media_files
  for update using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists media_files_delete_own on public.media_files;
create policy media_files_delete_own on public.media_files
  for delete using (user_id = auth.uid() or public.is_superadmin());

-- media_actions: somente o próprio usuário lê as próprias ações; superadmin tudo.
drop policy if exists media_actions_select on public.media_actions;
create policy media_actions_select on public.media_actions
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists media_actions_insert on public.media_actions;
create policy media_actions_insert on public.media_actions
  for insert with check (user_id = auth.uid() or public.is_superadmin());

grant select, insert, update, delete on public.media_files to authenticated;
grant select, insert on public.media_actions to authenticated;