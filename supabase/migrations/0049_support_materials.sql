-- Support Materials table for global materials shared across all tenants
create table if not exists public.support_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  link_url text not null,
  "order" int not null default 0,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.support_materials enable row level security;

-- Policy: Super admin can do everything
drop policy if exists "Super admin full access" on public.support_materials;
create policy "Super admin full access" on public.support_materials
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );

-- Policy: Authenticated users can read (for painel display)
drop policy if exists "Authenticated users can read" on public.support_materials;
create policy "Authenticated users can read" on public.support_materials
  for select
  using (auth.role() = 'authenticated');

-- Trigger for updated_at
drop trigger if exists set_updated_at_support_materials on public.support_materials;
create trigger set_updated_at_support_materials
  before update on public.support_materials
  for each row
  execute function public.set_updated_at();