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
  '{"eyebrow": "Sem condições de ativar agora?", "title": "Indique. Acumule saldo. Ative de graça.", "subtitle": "Cada indicação confirmada gera 10% de comissão — use o saldo para ativar seu site ou zerar sua mensalidade.", "buttonText": "Ver como funciona", "buttonUrl": "/afiliados"}'::jsonb,
  '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
where not exists (select 1 from public.site_sections where type = 'affiliates');
