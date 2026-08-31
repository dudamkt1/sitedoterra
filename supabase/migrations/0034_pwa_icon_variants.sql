-- ============================================================
-- 0034: PWA Icon Variants (180x180 Apple + Maskable 512x512)
-- Adiciona colunas para armazenar variantes de ícone geradas
-- automaticamente a partir do upload do usuário.
-- ============================================================

alter table public.pwa_settings
  add column if not exists icon_180_url text,
  add column if not exists icon_maskable_512_url text;

comment on column public.pwa_settings.icon_180_url is
  'Apple Touch Icon 180x180 (iOS "Adicionar à Tela de Início")';
comment on column public.pwa_settings.icon_maskable_512_url is
  'Android Maskable Icon 512x512 (safe zone, background preenchido)';