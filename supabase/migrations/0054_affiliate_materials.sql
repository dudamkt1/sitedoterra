-- ============================================================================
-- 0054: MATERIAIS DE APOIO PARA AFILIADOS
-- ----------------------------------------------------------------------------
-- O super admin cadastra em /admin/afiliados (upload p/ R2); afiliados
-- baixam/usam em /painel/afiliados.
-- Padrão de formatos:
--   imagens: feed 1:1 (1080x1080) | stories 9:16 (1080x1920)
--   vídeos:  1:1 e 9:16
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

create table if not exists public.affiliate_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'imagem' check (kind in ('imagem', 'video')),
  format text not null default 'feed_1x1' check (format in ('feed_1x1', 'story_9x16')),
  file_url text not null,
  thumbnail_url text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_materials_active_idx on public.affiliate_materials(active, sort_order);

alter table public.affiliate_materials enable row level security;

-- Super admin: tudo
drop policy if exists "Super admin full access" on public.affiliate_materials;
create policy "Super admin full access" on public.affiliate_materials
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );

-- Afiliados (qualquer usuário autenticado): só leitura dos ATIVOS
drop policy if exists "Authenticated users can read active" on public.affiliate_materials;
create policy "Authenticated users can read active" on public.affiliate_materials
  for select
  using (auth.role() = 'authenticated' and active = true);

-- Trigger updated_at (mesma função de support_materials)
drop trigger if exists set_updated_at_affiliate_materials on public.affiliate_materials;
create trigger set_updated_at_affiliate_materials
  before update on public.affiliate_materials
  for each row
  execute function public.set_updated_at();

grant select, insert, update, delete on public.affiliate_materials to authenticated;
