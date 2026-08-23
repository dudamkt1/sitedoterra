-- ============================================================
-- 0025: PWA por usuário (Meu Aplicativo)
-- Uma linha por tenant (1:1). user_id é mantido para políticas RLS.
-- ============================================================

create table if not exists public.pwa_settings (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,
  user_id           uuid not null,
  enabled           boolean not null default false,
  app_name          text not null default '',
  short_name        text not null default '',
  description       text not null default '',
  logo_url          text,
  icon_192_url      text,
  icon_512_url      text,
  theme_color       text not null default '#1d5c3a',
  background_color  text not null default '#faf8f2',
  -- 'platform' = https://oleos.topconsultores.com.br/{slug}
  -- 'custom'   = domínio próprio verificado (quando houver)
  canonical         text not null default 'platform'
                    check (canonical in ('platform','custom')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pwa_settings_user_id_idx on public.pwa_settings(user_id);

alter table public.pwa_settings enable row level security;

drop policy if exists "pwa_owner_all" on public.pwa_settings;
create policy "pwa_owner_all"
  on public.pwa_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (usado pelas rotas de servidor) bypassa RLS por padrão.
