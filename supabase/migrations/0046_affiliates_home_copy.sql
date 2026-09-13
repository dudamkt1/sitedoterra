-- ============================================================================
-- 0046: Atualiza o texto da faixa "Chamada Afiliados" (#afiliados) na HOME
-- para a nova mensagem (saldo como forma de pagamento).
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar e executar.
-- Idempotente: atualiza todas as linhas do tipo `affiliates`.
-- (Novas instalações já recebem o texto via 0044 atualizada.)
-- ============================================================================

update public.site_sections
set content = '{"eyebrow": "Sem condições de ativar agora?", "title": "Indique. Acumule saldo. Ative de graça.", "subtitle": "Cada indicação confirmada gera 10% de comissão — use o saldo para ativar seu site ou zerar sua mensalidade.", "buttonText": "Ver como funciona", "buttonUrl": "/afiliados"}'::jsonb
where type = 'affiliates';
