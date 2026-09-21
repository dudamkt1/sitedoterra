-- ============================================================================
-- FIDELIDADE: catálogo de benefícios resgatáveis por nível de programa
-- Coluna nova (não destrutiva): tenants existentes continuam funcionando,
-- o código trata ausência como lista vazia. Nenhum dado é alterado/apagado.
-- ============================================================================

alter table public.crm_loyalty_settings
  add column if not exists redeemables jsonb not null default '[]'::jsonb;
