-- ============================================================
-- 0033: Catálogo de produtos — extensões para SKU, unidade,
-- observações internas e flag de visibilidade pública.
-- A tabela `crm_products` JÁ EXISTIA (0022_crm.sql) — não duplicamos:
-- adicionamos apenas colunas novas com default seguro para preservar
-- produtos existentes.
-- ============================================================

alter table public.crm_products add column if not exists sku text;
alter table public.crm_products add column if not exists unit text not null default 'un';
alter table public.crm_products add column if not exists notes text;
alter table public.crm_products add column if not exists show_publicly boolean not null default true;

-- Índice para listagem pública (active + show_publicly)
create index if not exists crm_products_public_idx
  on public.crm_products (tenant_id, active, show_publicly);

-- Índice para busca por nome/categoria/sku
create index if not exists crm_products_tenant_name_idx
  on public.crm_products (tenant_id, name);
