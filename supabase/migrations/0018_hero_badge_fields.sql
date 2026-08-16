-- ============================================================================
-- SELO DA FOTO (hero badge) — campos editáveis pelo usuário
-- ----------------------------------------------------------------------------
-- O selo flutuante sobre a foto ("Certified Wellness" / "Expert em bem-estar")
-- agora é editável em /painel/meu-site → "Informações do site" e no editor
-- de seções. Aqui apenas garantimos que o conteúdo GLOBAL da seção hero já
-- traga os valores padrão, para que o editor e a página pública exibam o
-- mesmo comportamento. Idempotente.
-- ============================================================================

update public.site_sections
set content = content || '{"badgeTitle": "Certified Wellness", "badgeSubtitle": "Expert em bem-estar"}'::jsonb
where key = 'hero'
  and content is not null
  and not content ? 'badgeTitle';
