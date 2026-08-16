-- ============================================================================
-- REDES SOCIAIS DO RODAPÉ — links por rede (Instagram, Facebook, YouTube)
-- ----------------------------------------------------------------------------
-- O modelo anterior usava booleanos (mostrar/não mostrar). Agora cada rede é
-- um objeto { enabled, url }: o usuário ativa a rede e informa o endereço em
-- /painel/meu-site → "Redes sociais", e o rodapé renderiza o ícone com link
-- _blank. Aqui atualizamos o template GLOBAL (Super Admin) para o novo formato.
-- Idempotente: só aplica quando a rede ainda não está no formato de objeto.
-- ============================================================================

update public.site_sections
set content = content || '{"social": {"whatsapp": true, "instagram": {"enabled": true, "url": null}, "facebook": {"enabled": true, "url": null}, "youtube": {"enabled": true, "url": null}}}'::jsonb
where key = 'footer'
  and content is not null
  and not (content #> '{social,instagram}' ? 'url');