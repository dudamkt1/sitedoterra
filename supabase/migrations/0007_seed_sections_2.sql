-- ============================================================================
-- SEED: SEÇÕES GLOBAIS DA HOME (parte 2)
-- Idempotente: on conflict (key) do nothing.
-- ============================================================================

insert into public.site_sections (type, key, label, title, subtitle, enabled, is_required, sort_order, settings, content, permissions)
values
  (
    'story', 'story', 'História / Sobre', 'Jornada do profissional', 'História pessoal que cria conexão emocional.', true, true, 60,
    '{"showInNav": true, "navLabel": "História"}'::jsonb,
    '{"eyebrow": "Minha jornada", "title": "Uma história de cura e propósito", "paragraphs": ["Tudo começou quando minha filha tinha apenas 2 anos e eu me vi completamente perdida tentando encontrar alternativas naturais para as constantes gripes e alergias dela.", "Uma amiga me apresentou aos óleos essenciais e aquilo mudou tudo. Em poucos meses, vi transformações que eu nem imaginava serem possíveis — não só na saúde da minha filha, mas em toda a nossa família.", "Hoje, 7 anos depois, tenho o privilégio de acompanhar mais de 850 famílias nessa mesma jornada de descoberta. Cada história que ouço me renova a certeza de que estou no lugar certo."], "signature": "Ana Beatriz ✦", "image": null, "imageAlt": "Foto da Consultora", "badgeValue": "7+", "badgeLabel": "transformando vidas"}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": true, "can_edit_video": false, "can_edit_button": false, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
  ),
  (
    'video', 'video', 'Vídeo / Conteúdo', 'Conteúdo em vídeo', 'Vídeo de apresentação ou conteúdo educativo.', true, true, 70,
    '{"showInNav": false}'::jsonb,
    '{"eyebrow": "Assista agora", "title": "O que são óleos essenciais puros?", "subtitle": "Neste vídeo explico de forma simples como os óleos funcionam, por que a pureza faz toda a diferença e como começar sua jornada com segurança.", "videoUrl": null, "thumbLabel": "Assistir vídeo • 8 min", "playLabel": "Reproduzir vídeo"}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": true, "can_edit_video": true, "can_edit_button": false, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'booking', 'booking', 'Agendamento', 'Consulta / Agenda', 'Agendamento de consulta com calendário e horários.', true, true, 80,
    '{"showInNav": true, "navLabel": "Agendar"}'::jsonb,
    '{"eyebrow": "Agenda da consultora", "title": "Agende sua consulta gratuita", "subtitle": "Escolha o melhor dia e horário. Após a seleção, você será direcionada ao WhatsApp para confirmar.", "schedule": {"monthLabel": "Abril 2026", "year": 2026, "firstWeekday": 3, "daysInMonth": 30, "available": [3, 7, 8, 10, 14, 15, 17, 21, 22, 24], "occupied": [2, 5, 9, 12, 16, 19, 23], "today": 3, "slots": ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"], "taken": {"7": ["09:00", "14:00"], "10": ["10:00", "15:00"], "14": ["09:30", "16:00"], "17": ["14:30"]}}}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'tips', 'tips', 'Dicas / Rotinas', 'Conteúdos e redes sociais', 'Dicas, rotinas e conteúdos (ex.: feed do Instagram).', true, true, 90,
    '{"showInNav": false}'::jsonb,
    '{"eyebrow": "Acompanhe no Instagram", "title": "Dicas, rotinas e momentos reais", "instagramHandle": "@anabeatriz.doterra", "instagramUrl": null, "items": [{"emoji": "🌿", "gradient": "linear-gradient(135deg, #d4e8d4 0%, #a8d5b5 100%)"}, {"emoji": "🍋", "gradient": "linear-gradient(135deg, #f5e6d0 0%, #e8c87a 100%)"}, {"emoji": "🌸", "gradient": "linear-gradient(135deg, #c8e6d4 0%, #1D5C3A 100%)"}, {"emoji": "🧴", "gradient": "linear-gradient(135deg, #fbe8d0 0%, #C4963A 100%)"}, {"emoji": "🌱", "gradient": "linear-gradient(135deg, #e0f2e8 0%, #4A9E6B 100%)"}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": true, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
  ),
  (
    'products', 'products', 'Produtos em destaque', 'Vitrine de produtos', 'Produtos com destaque, preço e botão de compra.', true, true, 100,
    '{"showInNav": true, "navLabel": "Produtos"}'::jsonb,
    '{"eyebrow": "Favoritos da Ana", "title": "Produtos em destaque", "storeUrl": null, "items": [{"name": "On Guard®", "category": "Proteção imunológica", "description": "Blend protetor com sabor de canela, cravo, laranja-selvagem e eucalipto. Fortalece o sistema imunológico naturalmente.", "price": "R$ 189,00", "emoji": "🌿", "badge": "Mais vendido", "gradient": "linear-gradient(135deg, #e8f5ee 0%, #c8e8d8 100%)"}, {"name": "Lavender", "category": "Relaxamento & sono", "description": "O óleo mais versátil do mundo. Calma, relaxa, auxilia o sono e tem propriedades calmantes naturais incomparáveis.", "price": "R$ 149,00", "emoji": "💜", "badge": "Bestseller", "gradient": "linear-gradient(135deg, #f0f4fe 0%, #c8d8f8 100%)"}, {"name": "Lemon", "category": "Energia & clareza", "description": "Fresco e revitalizante, o limão doTERRA limpa, energiza e eleva o ânimo. Perfeito para aromatizar e purificar ambientes.", "price": "R$ 89,00", "emoji": "🍋", "gradient": "linear-gradient(135deg, #fff8e8 0%, #fce8b0 100%)"}]}'::jsonb,
    '{"can_edit": true, "can_toggle": true, "can_edit_image": true, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": true, "available_to_all": true}'::jsonb
  )
on conflict (key) do nothing;
