-- ============================================================================
-- SEED: SEÇÕES GLOBAIS DA HOME (parte 3)
-- Idempotente: on conflict (key) do nothing.
-- ============================================================================

insert into public.site_sections (type, key, label, title, subtitle, enabled, is_required, sort_order, settings, content, permissions)
values
  (
    'faq', 'faq', 'Perguntas frequentes', 'FAQ', 'Dúvidas comuns respondidas para gerar confiança.', true, true, 110,
    '{"showInNav": true, "navLabel": "Dúvidas"}'::jsonb,
    '{"eyebrow": "Tiro suas dúvidas", "title": "Perguntas frequentes", "subtitle": "Não encontrou sua dúvida? Fale diretamente com a IA ou pelo WhatsApp.", "items": [{"q": "Os óleos doTERRA são seguros para usar com crianças?", "a": "Sim! Os óleos doTERRA são certificados CPTG® (Grau de Pureza Terapêutica Certificado), o que significa que não contêm aditivos, pesticidas ou substâncias prejudiciais. Para crianças, recomendo sempre diluir mais (1-2 gotas para 10ml de óleo vegetal) e consultar os guias específicos por faixa etária."}, {"q": "Como começo? Qual kit indicar para iniciantes?", "a": "O melhor ponto de entrada é o Kit Básico Familiar, que inclui os 10 óleos mais usados e versáteis. Mas dependendo do seu objetivo (saúde, sono, energia, proteção), posso indicar o kit ideal. Nossa consulta gratuita existe exatamente para isso — agende e conversamos!"}, {"q": "Posso usar óleos essenciais na gravidez?", "a": "Alguns óleos são seguros com as devidas precauções, enquanto outros devem ser evitados nos primeiros trimestres. Lavender, Frankincense e Wild Orange são geralmente bem tolerados. Recomendo fortemente uma consulta personalizada para gestantes."}, {"q": "Como fazer para comprar? Precisa ser membro?", "a": "Você pode comprar como cliente a varejo (preço normal) ou se tornar membro Wellness Advocate com 25% de desconto em todas as compras. Não há mensalidade — basta fazer uma compra mínima de pontos por mês ou não fazer nada (sem obrigação!)."}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'pricing', 'pricing', 'Planos / Oferta', 'Chamada final e planos', 'Planos e CTA final da página.', true, false, 120,
    '{"showInNav": false}'::jsonb,
    '{"eyebrow": "Seja uma TopConsultora", "title": "Tenha um site assim hoje mesmo", "subtitle": "Sem precisar de programador. Pronto em minutos. Com IA, agendamento, CRM e muito mais.", "plans": [{"name": "Plano Mensal", "price": "97", "period": "por mês", "features": ["Site profissional personalizado", "Chat IA especialista doTERRA", "Agendamento integrado", "CRM de clientes", "Todas as ferramentas", "Suporte por WhatsApp"], "buttonText": "Começar agora", "buttonUrl": "#pricing"}, {"name": "Plano Anual", "price": "299", "period": "pagamento único · 12 meses", "popular": true, "badge": "⭐ Mais popular", "economy": "= R$ 24,75/mês — Economize 75%!", "features": ["Tudo do plano mensal", "Domínio próprio incluso", "Base de conhecimento IA", "Relatórios avançados", "Prioridade no suporte", "Novidades em primeira mão"], "buttonText": "Quero o anual!", "buttonUrl": "#pricing"}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": false}'::jsonb
  ),
  (
    'footer', 'footer', 'Rodapé', 'Rodapé com contatos e links', 'Informações de contato, navegação e legal.', true, true, 130,
    '{"showInNav": false}'::jsonb,
    '{"aboutText": "Consultora doTERRA Diamond ajudando famílias a descobrirem o poder dos óleos essenciais puros.", "social": {"whatsapp": true, "instagram": true, "youtube": true}, "showPlatformCredit": true}'::jsonb,
    '{"can_edit": true, "can_toggle": false, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  )
on conflict (key) do nothing;
