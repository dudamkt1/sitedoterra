-- ============================================================================
-- 0044: Seção global "Chamada Afiliados" (#afiliados) na HOME.
-- Faixa compacta entre Planos (120) e Rodapé (130) com CTA para /afiliados.
-- Idempotente: só insere se ainda não existir seção do tipo `affiliates`.
-- ============================================================================

insert into public.site_sections (type, key, label, title, subtitle, enabled, is_required, sort_order, settings, content, permissions)
select
  'affiliates',
  'chamada-afiliados',
  'Chamada Afiliados',
  null,
  null,
  true,
  false,
  125,
  '{"showInNav": false}'::jsonb,
  '{"eyebrow": "Ganhe indicando", "title": "Indique. Sua colega ativa. Você recebe.", "subtitle": "Transforme sua rede de consultoras em renda extra.", "buttonText": "Saiba como funciona", "buttonUrl": "/afiliados"}'::jsonb,
  '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
where not exists (select 1 from public.site_sections where type = 'affiliates');
