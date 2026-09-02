-- ============================================================================
-- Adiciona updated_at à tabela tenants (falta na migration inicial)
-- ============================================================================
-- O trigger tenants_touch tenta atualizar updated_at mas a coluna não existe.

alter table public.tenants
  add column if not exists updated_at timestamptz not null default now();

-- Atualiza registros existentes
update public.tenants
set updated_at = created_at
where updated_at is null;