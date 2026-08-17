-- ============================================================================
-- CENTRAL DE IA PARA CONTEÚDO DOTERRA (multi-tenant)
-- ----------------------------------------------------------------------------
-- * ai_tools            -> catálogo global de ferramentas (Super Admin gerencia)
-- * ai_templates        -> templates prontos para redes sociais (Super Admin gerencia)
-- * ai_history          -> histórico de gerações por usuário/tenant
-- * ai_user_templates   -> templates salvos/personalizados por usuário
-- * ai_user_favorites   -> ferramentas favoritas por usuário
--
-- Isolamento: todo dado gerado pertence ao user_id/tenant_id do autor. RLS
-- garante que um usuário NUNCA veja conteúdo de outro. Idempotente.
-- ============================================================================

-- ============================ AI TOOLS ============================
create table if not exists public.ai_tools (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  emoji text not null default '🤖',
  category text not null default 'conteudo',
  description text,
  examples jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  requires_api_key boolean not null default true,
  sort_order int not null default 0,
  base_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tools_enabled_idx on public.ai_tools (enabled, sort_order);

-- ============================ AI TEMPLATES ============================
create table if not exists public.ai_templates (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  emoji text not null default '🎨',
  category text not null default 'redes',
  description text,
  structure jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_templates_enabled_idx on public.ai_templates (enabled, sort_order);

-- ============================ AI HISTORY ============================
create table if not exists public.ai_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  tool_code text,
  tool_name text,
  prompt text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_history_user_idx on public.ai_history (user_id, created_at desc);
create index if not exists ai_history_tenant_idx on public.ai_history (tenant_id);
create index if not exists ai_history_fav_idx on public.ai_history (user_id, favorite);

-- ============================ AI USER TEMPLATES ============================
create table if not exists public.ai_user_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  template_code text,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_user_templates_user_idx on public.ai_user_templates (user_id, created_at desc);

-- ============================ AI USER FAVORITES ============================
create table if not exists public.ai_user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_code text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tool_code)
);

-- ============================ TRIGGERS updated_at ============================
drop trigger if exists ai_tools_touch on public.ai_tools;
create trigger ai_tools_touch before update on public.ai_tools
  for each row execute procedure public.touch_updated_at();

drop trigger if exists ai_templates_touch on public.ai_templates;
create trigger ai_templates_touch before update on public.ai_templates
  for each row execute procedure public.touch_updated_at();

drop trigger if exists ai_history_touch on public.ai_history;
create trigger ai_history_touch before update on public.ai_history
  for each row execute procedure public.touch_updated_at();

drop trigger if exists ai_user_templates_touch on public.ai_user_templates;
create trigger ai_user_templates_touch before update on public.ai_user_templates
  for each row execute procedure public.touch_updated_at();

-- ============================ RLS ============================
alter table public.ai_tools enable row level security;
alter table public.ai_templates enable row level security;
alter table public.ai_history enable row level security;
alter table public.ai_user_templates enable row level security;
alter table public.ai_user_favorites enable row level security;

-- ai_tools: leitura autenticada (catálogo), gestão só Super Admin
drop policy if exists ai_tools_select_all on public.ai_tools;
create policy ai_tools_select_all on public.ai_tools
  for select using (true);
drop policy if exists ai_tools_insert_admin on public.ai_tools;
create policy ai_tools_insert_admin on public.ai_tools
  for insert with check (public.is_superadmin());
drop policy if exists ai_tools_update_admin on public.ai_tools;
create policy ai_tools_update_admin on public.ai_tools
  for update using (public.is_superadmin());
drop policy if exists ai_tools_delete_admin on public.ai_tools;
create policy ai_tools_delete_admin on public.ai_tools
  for delete using (public.is_superadmin());

-- ai_templates: leitura autenticada, gestão só Super Admin
drop policy if exists ai_templates_select_all on public.ai_templates;
create policy ai_templates_select_all on public.ai_templates
  for select using (true);
drop policy if exists ai_templates_insert_admin on public.ai_templates;
create policy ai_templates_insert_admin on public.ai_templates
  for insert with check (public.is_superadmin());
drop policy if exists ai_templates_update_admin on public.ai_templates;
create policy ai_templates_update_admin on public.ai_templates
  for update using (public.is_superadmin());
drop policy if exists ai_templates_delete_admin on public.ai_templates;
create policy ai_templates_delete_admin on public.ai_templates
  for delete using (public.is_superadmin());

-- ai_history: somente o próprio usuário (ou Super Admin)
drop policy if exists ai_history_select_own on public.ai_history;
create policy ai_history_select_own on public.ai_history
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_history_insert_own on public.ai_history;
create policy ai_history_insert_own on public.ai_history
  for insert with check (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_history_update_own on public.ai_history;
create policy ai_history_update_own on public.ai_history
  for update using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_history_delete_own on public.ai_history;
create policy ai_history_delete_own on public.ai_history
  for delete using (user_id = auth.uid() or public.is_superadmin());

-- ai_user_templates: somente o próprio usuário (ou Super Admin)
drop policy if exists ai_user_templates_select_own on public.ai_user_templates;
create policy ai_user_templates_select_own on public.ai_user_templates
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_user_templates_insert_own on public.ai_user_templates;
create policy ai_user_templates_insert_own on public.ai_user_templates
  for insert with check (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_user_templates_update_own on public.ai_user_templates;
create policy ai_user_templates_update_own on public.ai_user_templates
  for update using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_user_templates_delete_own on public.ai_user_templates;
create policy ai_user_templates_delete_own on public.ai_user_templates
  for delete using (user_id = auth.uid() or public.is_superadmin());

-- ai_user_favorites: somente o próprio usuário (ou Super Admin)
drop policy if exists ai_user_favorites_select_own on public.ai_user_favorites;
create policy ai_user_favorites_select_own on public.ai_user_favorites
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_user_favorites_insert_own on public.ai_user_favorites;
create policy ai_user_favorites_insert_own on public.ai_user_favorites
  for insert with check (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_user_favorites_delete_own on public.ai_user_favorites;
create policy ai_user_favorites_delete_own on public.ai_user_favorites
  for delete using (user_id = auth.uid() or public.is_superadmin());

grant select on public.ai_tools to authenticated;
grant select on public.ai_templates to authenticated;
grant select, insert, update, delete on public.ai_history to authenticated;
grant select, insert, update, delete on public.ai_user_templates to authenticated;
grant select, insert, delete on public.ai_user_favorites to authenticated;

-- ============================ SEED: FERRAMENTAS ============================
insert into public.ai_tools (code, name, emoji, category, description, examples, enabled, requires_api_key, sort_order, base_prompt)
values
  (
    'title', 'Gerar título', '✍️', 'conteudo',
    'Crie várias opções de título para posts, vídeos, carrosséis e anúncios, com o tom e o objetivo que você escolher.',
    '["5 opções de título para um post sobre Lavender", "Título comercial para divulgar o Kit Básico Familiar", "Título educativo para um carrossel sobre diluição de óleos"]',
    true, true, 10,
    'Você é um redator especialista em marketing de conteúdo para consultoras doTERRA. Gere opções de título criativas, chamativas e adequadas ao tom pedido, sempre sem promessas médicas.'
  ),
  (
    'description', 'Gerar descrição', '📝', 'conteudo',
    'Produza título, descrição, CTA e hashtags prontos para usar em posts e páginas, no tamanho e tom ideais.',
    '["Descrição de apresentação da consultora", "Texto completo com CTA e hashtags para um post de produto", "Descrição curta para o perfil do Instagram"]',
    true, true, 20,
    'Você é um copywriter especializado em bem-estar e óleos essenciais. Escreva conteúdo comercial/educativo responsável, sem afirmações médicas, promessas de cura ou alegações terapêuticas não comprovadas.'
  ),
  (
    'post', 'Posts para redes sociais', '📱', 'redes',
    'Gere posts completos para Instagram, Facebook, WhatsApp, Stories, Reels e TikTok com texto, CTA, hashtags e sugestões visuais.',
    '["Post comercial para divulgar um óleo no Instagram", "Story com enquete para engajar o público", "Roteiro de Reel educativo sobre 3 formas de usar um blend"]',
    true, true, 30,
    'Você é um estrategista de redes sociais para consultoras doTERRA. Produza posts prontos para publicação, com gancho, texto, CTA, hashtags e sugestões de imagem/layout/cores. Nunca crie promessas médicas.'
  ),
  (
    'product', 'Descrição de produto', '🛍️', 'produtos',
    'Crie descrições completas de produtos doTERRA com destaque para características, diferenciais, CTA e SEO.',
    '["Descrição do óleo Lavender para a vitrine do site", "SEO title e meta description do produto On Guard", "Descrição completa com destaques e CTA"]',
    true, true, 40,
    'Você é um redator de e-commerce especializado em produtos doTERRA. Escreva descrições atrativas sem INVENTAR propriedades, composição, certificações ou benefícios médicos. Quando o usuário não fornecer informações do produto, use apenas linguagem genérica e educativa.'
  ),
  (
    'ad', 'Anúncio', '📢', 'marketing',
    'Crie anúncios com headline, texto e CTA em várias versões, incluindo variações para teste A/B.',
    '["Anúncio curto para Instagram Ads", "5 variações de anúncio para o Facebook", "Anúncio completo com oferta e diferencial"]',
    true, true, 50,
    'Você é um especialista em anúncios para consultoras doTERRA. Gere headline, texto principal, CTA e variações para teste A/B, sempre com linguagem comercial ética e sem promessas de cura.'
  ),
  (
    'ideas', 'Ideias de conteúdo', '💡', 'ideias',
    'Gere ideias organizadas por categorias para suas redes, com gancho, formato, CTA e sugestões visuais.',
    '["Ideias para 1 semana de posts no Instagram", "Categorias: educativo, engajamento, storytelling", "Ideias de Reels e Stories"]',
    true, true, 60,
    'Você é um planejador de conteúdo para consultoras doTERRA. Gere ideias organizadas por categorias (educativo, comercial, engajamento, storytelling, lifestyle, produto, curiosidades, perguntas, reels, stories, carrossel), cada uma com título, descrição, formato, gancho, CTA, sugestão de imagem/vídeo e hashtags.'
  ),
  (
    'calendar', 'Calendário de conteúdo', '🗓️', 'ideias',
    'Monte um calendário pronto de 7, 15 ou 30 dias com um tema de conteúdo por dia.',
    '["Calendário de 15 dias de posts para Instagram", "30 dias de conteúdo educativo e comercial", "Calendário semanal para Stories e Reels"]',
    true, true, 70,
    'Você é um planner de conteúdo para consultoras doTERRA. Monte um calendário com um tema por dia (dia, formato, ideia, gancho, CTA, hashtags), balanceando conteúdo educativo e comercial. Nunca inclua promessas médicas.'
  ),
  (
    'faq', 'Gerar FAQ', '❓', 'conteudo',
    'Gere perguntas e respostas frequentes sobre seus produtos e serviços, prontas para publicar.',
    '["3 perguntas frequentes sobre como começar com óleos", "FAQ para o site com dúvidas de clientes", "Perguntas sobre compra e entrega"]',
    true, true, 80,
    'Você é um atendente especializado em óleos essenciais. Gere perguntas frequentes com respostas claras, acolhedoras e educativas, sem afirmar benefícios médicos não comprovados.'
  ),
  (
    'client-reply', 'Resposta para cliente', '💬', 'conteudo',
    'Elabore respostas educadas e acolhedoras para clientes que fazem perguntas pelo WhatsApp ou redes.',
    '["Resposta para cliente perguntando como começar", "Resposta sobre disponibilidade de um produto", "Resposta acolhedora para uma dúvida de uso"]',
    true, true, 90,
    'Você é uma consultora doTERRA experiente e acolhedora. Responda a cliente com empatia, educação e clareza, orientando sobre o universo dos óleos essenciais sem criar promessas médicas.'
  ),
  (
    'prompts', 'Central de prompts', '🧩', 'especial',
    'Prompts prontos para copiar e usar em qualquer ferramenta gratuita de IA (ChatGPT, Gemini, Copilot e outras).',
    '["Criar legenda para Instagram", "Criar roteiro de Reel", "Criar descrição de produto"]',
    true, false, 100,
    null
  ),
  (
    'templates', 'Templates prontos', '🎨', 'especial',
    'Modelos visuais prontos para redes sociais, com edição de texto, cores, imagem, logo, CTA e posição dos elementos.',
    '["Produto em destaque", "Óleo da semana", "Dica rápida"]',
    true, false, 110,
    null
  )
on conflict (code) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  category = excluded.category,
  description = excluded.description,
  examples = excluded.examples,
  requires_api_key = excluded.requires_api_key,
  sort_order = excluded.sort_order;

-- ============================ SEED: TEMPLATES ============================
insert into public.ai_templates (code, name, emoji, category, description, structure, enabled, sort_order)
values
  (
    'produto-destaque', 'Produto em destaque', '🛍️', 'redes',
    'Template para apresentar um produto com imagem grande e chamada forte.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"O produto da vez"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"On Guard®"},{"key":"body","label":"Texto","type":"textarea","default":"Conhecido por seu aroma revigorante, faz parte da rotina de quem busca bem-estar."},{"key":"cta","label":"CTA","type":"text","default":"Chame no WhatsApp"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#doterra #oleosessenciais #bemestar"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#1d5c3a"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#c4963a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 10
  ),
  (
    'oleo-semana', 'Óleo da semana', '🌿', 'redes',
    'Apresente um óleo essencial por semana, destacando o nome e um uso.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Óleo da semana"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Lavender"},{"key":"body","label":"Texto","type":"textarea","default":"Conhecido por seu aroma calmante, pode fazer parte da sua rotina de relaxamento."},{"key":"cta","label":"CTA","type":"text","default":"Quero saber mais"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#oleodasemana #lavender #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#2d7a4f"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#e8c87a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 20
  ),
  (
    'dica-rapida', 'Dica rápida', '⚡', 'redes',
    'Post objetivo com uma dica prática e fácil de aplicar.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Dica rápida"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Para o seu dia a dia"},{"key":"body","label":"Texto","type":"textarea","default":"1. Escolha um aroma\n2. Aplique com movimentos circulares\n3. Respire e aproveite o momento"},{"key":"cta","label":"CTA","type":"text","default":"Salve esse post"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#dica #doterra #rotina"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#8b6b45"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#f7f2ea"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 30
  ),
  (
    'voce-sabia', 'Você sabia?', '💡', 'redes',
    'Curiosidade rápida para educar o público e gerar engajamento.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Você sabia?"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Curiosidades sobre óleos"},{"key":"body","label":"Texto","type":"textarea","default":"Os óleos essenciais podem fazer parte da sua rotina de bem-estar de diferentes formas: no difusor, na massagem ou no banho."},{"key":"cta","label":"CTA","type":"text","default":"Comente o que achou"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#vocesabia #curiosidades #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#4a9e6b"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#f7f2ea"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 40
  ),
  (
    '3-formas', '3 formas de usar', '✳️', 'redes',
    'Post em carrossel mostrando três usos diferentes de um produto.',
    '{"layout":"carrossel","fields":[{"key":"title","label":"Título","type":"text","default":"3 formas de usar"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Lemon"},{"key":"body","label":"Texto","type":"textarea","default":"1. No difusor pela manhã\n2. Na água da limpeza\n3. Em uma massagem"},{"key":"cta","label":"CTA","type":"text","default":"Veja os slides"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#3formas #lemon #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#c4963a"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#1a1a14"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#ffffff"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"top"}]}',
    true, 50
  ),
  (
    'frase-inspiradora', 'Frase inspiradora', '✨', 'redes',
    'Post com frase inspiradora para conectar com o público.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Inspiração do dia"},{"key":"subtitle","label":"Subtítulo","type":"text","default":""},{"key":"body","label":"Texto","type":"textarea","default":"O autocuidado começa com pequenos rituais que cuidam de você."},{"key":"cta","label":"CTA","type":"text","default":"Marque alguém que precisa"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#inspiracao #autocuidado #bemestar"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#f7f2ea"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#1d5c3a"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#c4963a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 60
  ),
  (
    'post-educativo', 'Post educativo', '📚', 'redes',
    'Post para ensinar um conceito ou informação sobre óleos essenciais.',
    '{"layout":"carrossel","fields":[{"key":"title","label":"Título","type":"text","default":"Entenda na prática"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"O que são blends"},{"key":"body","label":"Texto","type":"textarea","default":"Blends são combinações de óleos essenciais que se complementam. Cada um tem seu aroma e características próprias."},{"key":"cta","label":"CTA","type":"text","default":"Salve para depois"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#educativo #blends #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#1a1a14"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#f7f2ea"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#e8c87a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"top"}]}',
    true, 70
  ),
  (
    'chamada-contato', 'Chamada para contato', '📲', 'redes',
    'Post de convite para conversar ou agendar uma consulta.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Vamos conversar?"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Consultoria gratuita"},{"key":"body","label":"Texto","type":"textarea","default":"Agende uma conversa e descubra como os óleos essenciais podem fazer parte da sua rotina."},{"key":"cta","label":"CTA","type":"text","default":"Chamar no WhatsApp"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#consulta #doterra #vamosconversar"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#2d7a4f"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#e8c87a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 80
  ),
  (
    'novo-produto', 'Novo produto', '🎉', 'redes',
    'Apresente um lançamento com animação e chamada clara.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Chegou novidade!"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Conheça o produto"},{"key":"body","label":"Texto","type":"textarea","default":"Novo produto na linha! Conheça de perto e descubra como pode combinar com a sua rotina."},{"key":"cta","label":"CTA","type":"text","default":"Pedir mais informações"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#novidade #lancamento #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#4a9e6b"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#e8c87a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 90
  ),
  (
    'oferta', 'Oferta', '🏷️', 'redes',
    'Post promocional com destaque para a oferta e o CTA.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Oferta por tempo limitado"},{"key":"subtitle","label":"Subtítulo","type":"text","default":""},{"key":"body","label":"Texto","type":"textarea","default":"Aproveite as condições especiais para começar sua jornada com óleos essenciais."},{"key":"cta","label":"CTA","type":"text","default":"Garantir minha oferta"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#oferta #promocao #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#8b6b45"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#e8c87a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 100
  ),
  (
    'depoimento', 'Depoimento', '💬', 'redes',
    'Post com depoimento de cliente para gerar confiança.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"O que dizem por aqui"},{"key":"subtitle","label":"Subtítulo","type":"text","default":""},{"key":"body","label":"Texto","type":"textarea","default":"\"Descobri os óleos essenciais e mudou minha rotina de bem-estar.\" — Cliente"},{"key":"cta","label":"CTA","type":"text","default":"Quero ser a próxima"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#depoimento #clientes #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#1d5c3a"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#ffffff"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#c4963a"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 110
  ),
  (
    'story-produto', 'Story de produto', '📸', 'redes',
    'Template vertical no formato Story, ideal para fotos de produto.',
    '{"layout":"story","fields":[{"key":"title","label":"Título","type":"text","default":"Na sua rotina"},{"key":"subtitle","label":"Subtítulo","type":"text","default":""},{"key":"body","label":"Texto","type":"textarea","default":"Um aroma para cada momento do seu dia."},{"key":"cta","label":"CTA","type":"text","default":"Deslize para ver"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#story #doterra #rotina"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#f7f2ea"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#1d5c3a"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#2d7a4f"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"center"}]}',
    true, 120
  ),
  (
    'carrossel-educativo', 'Carrossel educativo', '🎠', 'redes',
    'Template para carrossel com passos numerados e didáticos.',
    '{"layout":"carrossel","fields":[{"key":"title","label":"Título","type":"text","default":"Passo a passo"},{"key":"subtitle","label":"Subtítulo","type":"text","default":"Como começar"},{"key":"body","label":"Texto","type":"textarea","default":"1. Escolha o seu aroma\n2. Conheça as formas de uso\n3. Crie sua rotina"},{"key":"cta","label":"CTA","type":"text","default":"Veja os próximos slides"},{"key":"hashtags","label":"Hashtags","type":"text","default":"#carrossel #passoapasso #doterra"},{"key":"bgColor","label":"Cor de fundo","type":"color","default":"#c4963a"},{"key":"textColor","label":"Cor do texto","type":"color","default":"#1a1a14"},{"key":"accentColor","label":"Cor de destaque","type":"color","default":"#ffffff"},{"key":"image","label":"Imagem (URL)","type":"image","default":""},{"key":"logo","label":"Logo (URL)","type":"image","default":""},{"key":"position","label":"Posição","type":"select","options":["top","center","bottom"],"default":"top"}]}',
    true, 130
  )
on conflict (code) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  category = excluded.category,
  description = excluded.description,
  structure = excluded.structure,
  sort_order = excluded.sort_order;
