-- ============================================================================
-- SEED: SEÇÕES GLOBAIS DA HOME (Super Admin controla estas definições)
-- Idempotente: on conflict (key) do nothing.
-- ============================================================================

insert into public.site_sections (type, key, label, title, subtitle, enabled, is_required, sort_order, settings, content, permissions)
values
  (
    'header', 'header', 'Cabeçalho / Menu', null, null, true, true, 10,
    '{"showInNav": false}'::jsonb,
    '{"logoText": "Ana Beatriz"}'::jsonb,
    '{"can_edit": true, "can_toggle": false, "can_edit_image": false, "can_edit_video": false, "can_edit_button": false, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'hero', 'hero', 'Hero principal', 'Abertura impactante', 'Apresentação do profissional com foto, título e estatísticas.', true, true, 20,
    '{"showInNav": false, "bg": "green"}'::jsonb,
    '{"eyebrow": "Consultora Certificada doTERRA", "firstName": "Ana", "lastName": "Beatriz", "role": "Consultora Wellness Diamond · doTERRA", "description": "Transformo bem-estar em rotina com os melhores óleos essenciais do mundo. Há 7 anos ajudo famílias a descobrirem o poder da natureza para uma vida mais equilibrada e saudável.", "image": null, "imageAlt": "Foto da Consultora", "primaryBtn": {"text": "Falar com a IA", "url": "#about"}, "secondaryBtn": {"text": "Ver Produtos", "url": "#products"}, "stats": [{"value": "7+", "label": "Anos de experiência"}, {"value": "850+", "label": "Clientes atendidas"}, {"value": "98%", "label": "Satisfação"}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": true, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
  ),
  (
    'trustbar', 'trustbar', 'Barra de destaque', 'Faixa de confiança', 'Chamada que destaca o produto/proposta no topo da página.', true, false, 30,
    '{"showInNav": false}'::jsonb,
    '{"badge": "✨", "title": "Você é consultora doTERRA? Tenha um site profissional como este!", "subtitle": "Ferramenta completa com IA, agendamento, CRM e muito mais", "buttonText": "Quero um site assim", "buttonUrl": "#pricing"}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": false}'::jsonb
  ),
  (
    'about', 'about', 'Especialista / Apresentação', 'Seção com IA', 'Assistente IA que indica produtos conforme a necessidade do visitante.', true, true, 40,
    '{"showInNav": true, "navLabel": "Especialista IA"}'::jsonb,
    '{"eyebrow": "Tecnologia + Natureza", "title": "Especialista IA doTERRA", "subtitle": "Descreva como você está se sentindo — física ou emocionalmente — e nossa inteligência artificial vai indicar os melhores óleos essenciais para o seu momento.", "chips": [{"emoji": "😴", "label": "Ansiedade e sono"}, {"emoji": "🤕", "label": "Dor de cabeça"}, {"emoji": "🛡️", "label": "Imunidade"}], "chat": {"name": "Especialista IA doTERRA", "status": "Online agora", "welcome": "Olá! Sou a assistente especialista em óleos essenciais doTERRA 🌿 Me conte como você está se sentindo hoje — fisicamente ou emocionalmente — e vou indicar os melhores óleos para o seu momento!", "placeholder": "Como você está se sentindo?"}}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": false, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'testimonials', 'testimonials', 'Depoimentos', 'Histórias de clientes', 'Depoimentos que geram confiança e conexão.', true, true, 50,
    '{"showInNav": true, "navLabel": "Depoimentos"}'::jsonb,
    '{"eyebrow": "O que dizem por aí", "title": "Histórias que me inspiram todo dia", "subtitle": "Cada depoimento é uma vida transformada pela natureza.", "items": [{"text": "Depois de 3 semanas usando o protocolo de sono, minha insônia de anos simplesmente desapareceu. É incrível como óleos naturais podem fazer diferença tão grande.", "name": "Mariana Ferreira", "location": "São Paulo, SP", "initials": "MF"}, {"text": "Uma verdadeira parceira de bem-estar. Me acompanha há 2 anos e sempre indica o produto certo para cada fase da minha vida.", "name": "Carla Souza", "location": "Campinas, SP", "initials": "CS"}, {"text": "Meu filho tem 6 anos e desde que passei a usar os óleos em casa, reduzimos muito as idas ao pediatra. Virou nosso aliado número um!", "name": "Renata Lima", "location": "Rio de Janeiro, RJ", "initials": "RL"}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": false, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
  )
on conflict (key) do nothing;
