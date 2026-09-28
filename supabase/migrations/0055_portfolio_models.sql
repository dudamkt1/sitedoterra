-- ============================================================================
-- PORTFÓLIO DE MODELOS DE SITE
-- ----------------------------------------------------------------------------
-- A plataforma deixou de ser "site para doTERRA/óleos" e passou a ser
-- "sites profissionais + ferramentas para consultores de venda direta".
-- O Portfolio é a ponte entre os dois conceitos:
--
--   MODELO PADRÃO (estrutura atual, preservada)
--        ├── Modelo AMAKHA
--        ├── Modelo Tupperware
--        ├── Modelo iGREEN
--        └── ...
--              └── novo usuário escolhe um modelo na ativação
--                    └── o site dele nasce como CÓPIA INDEPENDENTE
--
-- REGRA FUNDAMENTAL: o modelo é apenas TEMPLATE INICIAL.
-- Depois que o site do usuário nasce, ele é totalmente independente:
-- alterar um modelo do portfólio NUNCA altera sites já criados, e
-- personalizar o site do usuário NUNCA altera o modelo.
--
-- Tabelas:
--   portfolio_models          -> modelos (estrutura copiada em jsonb)
--   tenants.portfolio_model_id-> modelo escolhido pelo usuário (origem)
--   tenant_sections.sort_order-> ordenação específica copiada do modelo
--
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

-- ============================ MODELOS =====================================
create table if not exists public.portfolio_models (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  company text,
  category text,
  description text,
  thumbnail_url text,
  cover_url text,
  demo_url text,
  status text not null default 'active',
  is_default boolean not null default false,
  is_selectable boolean not null default true,
  sort_order int not null default 0,
  -- Estrutura INDEPENDENTE do site (seções copiadas do Modelo Padrão).
  -- jsonb puro: duplicar um modelo = copiar o json, sem referências cruzadas.
  sections jsonb not null default '[]'::jsonb,
  -- Dados de "Informações do site" usados como base do novo site.
  site_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_models_list_idx
  on public.portfolio_models (status, sort_order);

-- Só existe UM modelo padrão (fallback obrigatório da ativação).
drop index if exists portfolio_models_default_idx;
create unique index portfolio_models_default_idx
  on public.portfolio_models ((is_default)) where is_default;

-- ============================ RELAÇÃO MODELO → SITE ========================
-- Guarda a ESCOLHA feita durante a ativação. É apenas a ORIGEM do site:
-- depois de criado, o site nunca mais consulta este campo para conteúdo.
alter table public.tenants
  add column if not exists portfolio_model_id uuid
  references public.portfolio_models(id) on delete set null;

-- Ordenação própria das seções copiadas de um modelo (null = segue a ordem
-- global do template). Permite que cada modelo tenha sua organização sem
-- alterar o template global nem a ordem dos sites já criados.
alter table public.tenant_sections
  add column if not exists sort_order int;

-- ============================ TRIGGERS ====================================
drop trigger if exists portfolio_models_touch on public.portfolio_models;
create trigger portfolio_models_touch before update on public.portfolio_models
  for each row execute procedure public.touch_updated_at();

-- ============================ RLS ==========================================
alter table public.portfolio_models enable row level security;

-- Leitura pública (Home, /portfolio e o seletor de ativação)
drop policy if exists portfolio_models_select_all on public.portfolio_models;
create policy portfolio_models_select_all on public.portfolio_models
  for select using (true);
-- Escrita apenas do Super Admin
drop policy if exists portfolio_models_insert_admin on public.portfolio_models;
create policy portfolio_models_insert_admin on public.portfolio_models
  for insert with check (public.is_superadmin());
drop policy if exists portfolio_models_update_admin on public.portfolio_models;
create policy portfolio_models_update_admin on public.portfolio_models
  for update using (public.is_superadmin());
drop policy if exists portfolio_models_delete_admin on public.portfolio_models;
create policy portfolio_models_delete_admin on public.portfolio_models
  for delete using (public.is_superadmin());

-- ============================================================================
-- MODELO PADRÃO — ÓLEOS (primeiro modelo oficial do Portfolio)
-- ----------------------------------------------------------------------------
-- Criado a partir da estrutura ATUAL (site_sections + dados do tenant
-- oficial). NÃO é reconstruído: é uma cópia da base real do sistema e
-- serve de ponto de partida para todos os novos modelos.
-- Executado ANTES de inserir a seção "portfolio", então o Modelo Padrão
-- mantém exatamente a estrutura de hoje (sem a seção nova do portfólio).
-- ============================================================================
insert into public.portfolio_models (
  key, name, company, category, description,
  is_default, is_selectable, status, sort_order, sections, site_data
)
select
  'padrao-oleos',
  'Modelo Padrão — Óleos',
  'doTERRA',
  'Óleos essenciais',
  'O modelo original da plataforma: site completo para consultores de óleos essenciais. É a base para criar novos modelos do portfólio.',
  true,
  true,
  'active',
  10,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', s.key,
      'type', s.type,
      'label', s.label,
      'title', s.title,
      'subtitle', s.subtitle,
      'enabled', s.enabled,
      'is_required', s.is_required,
      'sort_order', s.sort_order,
      'settings', s.settings,
      'content', s.content,
      'permissions', s.permissions
    ) order by s.sort_order)
    from public.site_sections s
  ), '[]'::jsonb),
  coalesce((
    select ss.data
    from public.site_settings ss
    join public.tenants t on t.id = ss.tenant_id
    where t.is_official_home = true
    limit 1
  ), '{}'::jsonb)
where not exists (
  select 1 from public.portfolio_models where key = 'padrao-oleos'
);

-- ============================================================================
-- SEÇÃO "ESCOLHA SEU MODELO DE SITE" NA HOME DA PLATAFORMA
-- ----------------------------------------------------------------------------
-- Aparece depois da apresentação principal (hero/barra/sobre) e antes das
-- seções informativas. Só é renderizada no domínio principal: nos sites dos
-- usuários a seção existe mas não recebe a lista de modelos (não renderiza).
-- ============================================================================
insert into public.site_sections (
  type, key, label, title, subtitle,
  enabled, is_required, sort_order, settings, content, permissions
)
select
  'portfolio',
  'portfolio',
  'Modelos de site',
  'Escolha seu modelo de site',
  'Modelos prontos de sites profissionais para consultores de venda direta.',
  true,
  false,
  45,
  '{"showInNav": true, "navLabel": "Modelos"}'::jsonb,
  '{
    "eyebrow": "Modelos de site",
    "title": "Escolha seu modelo de site",
    "subtitle": "Seu site profissional + ferramentas para vender e organizar seu negócio. Escolha o modelo que mais combina com a sua empresa e produtos — depois personalize textos, imagens, cores e seções no seu painel.",
    "buttonText": "Ver todos os modelos",
    "buttonUrl": "/portfolio",
    "maxModels": 6,
    "primaryButtonText": "Quero este modelo",
    "secondaryButtonText": "Ver modelo"
  }'::jsonb,
  '{
    "can_edit": true,
    "can_toggle": true,
    "can_edit_image": true,
    "can_edit_video": false,
    "can_edit_button": true,
    "can_edit_colors": true,
    "can_edit_layout": true,
    "available_to_all": true
  }'::jsonb
where not exists (
  select 1 from public.site_sections where key = 'portfolio'
);

-- ============================================================================
-- POSICIONAMENTO (seguro: só sobrescreve se o texto ainda for o antigo)
-- ----------------------------------------------------------------------------
-- O Super Admin pode já ter personalizado estes textos em /admin/editor-home;
-- nesse caso nada é alterado (a customização dele preservada).
-- ============================================================================
update public.site_sections
set content = (content || jsonb_build_object(
  'title', 'Consultor de venda direta? Tenha um site profissional como este!',
  'subtitle', 'Plataforma completa: site, CRM, clientes, vendas, catálogo, fidelidade, afiliados, WhatsApp, IA e PWA — para doTERRA, AMAKHA, Tupperware, iGREEN e outras empresas.'
))
where key = 'trustbar'
  and content ->> 'title' = 'Você é consultora doTERRA? Tenha um site profissional como este!';
