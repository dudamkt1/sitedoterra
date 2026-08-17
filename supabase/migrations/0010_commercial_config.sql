-- ============================================================================
-- CONFIGURAÇÃO COMERCIAL CENTRALIZADA
-- ----------------------------------------------------------------------------
-- Estende a tabela `plans` para ser a ÚNICA fonte de verdade comercial:
--   * ativação (valor normal + valor promocional);
--   * mensalidade e período de cobrança;
--   * textos da oferta (título, subtítulo, promo, CTA, transparência, cancelamento);
--   * regras (permite cancelamento, primeira cobrança em N dias);
--   * Price IDs do Stripe (ativação e mensalidade);
--   * benefícios, ordem e status.
-- Adiciona `price_history` para auditoria de alterações de preço.
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

-- ============================ NOVAS COLUNAS EM plans ============================
alter table public.plans add column if not exists activation_regular_price_cents int not null default 0;
alter table public.plans add column if not exists offer_title text;
alter table public.plans add column if not exists offer_subtitle text;
alter table public.plans add column if not exists promo_text text;
alter table public.plans add column if not exists cta_text text;
alter table public.plans add column if not exists transparency_text text;
alter table public.plans add column if not exists cancel_text text;
alter table public.plans add column if not exists allow_cancel boolean not null default true;
alter table public.plans add column if not exists trial_days int not null default 30;
alter table public.plans add column if not exists sort_order int not null default 0;
alter table public.plans add column if not exists activation_price_id text;
alter table public.plans add column if not exists monthly_price_id text;

-- ============================ PRICE HISTORY (auditoria) ============================
create table if not exists public.price_history (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid references public.plans(id) on delete cascade,
  field text not null,
  previous_value_cents int,
  new_value_cents int,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists price_history_plan_idx on public.price_history (plan_id);

-- ============================ RLS ============================
alter table public.price_history enable row level security;

-- plans: escrita e exclusão SOMENTE Super Admin (leitura pública já existe)
drop policy if exists plans_insert_admin on public.plans;
create policy plans_insert_admin on public.plans
  for insert with check (public.is_superadmin());
drop policy if exists plans_update_admin on public.plans;
create policy plans_update_admin on public.plans
  for update using (public.is_superadmin());
drop policy if exists plans_delete_admin on public.plans;
create policy plans_delete_admin on public.plans
  for delete using (public.is_superadmin());

-- price_history: somente Super Admin
drop policy if exists price_history_select_admin on public.price_history;
create policy price_history_select_admin on public.price_history
  for select using (public.is_superadmin());
drop policy if exists price_history_insert_admin on public.price_history;
create policy price_history_insert_admin on public.price_history
  for insert with check (public.is_superadmin());

grant select on public.plans to authenticated;
grant select, insert on public.price_history to authenticated;

-- ============================ SEED / CONFIGURAÇÃO COMERCIAL ATUAL ============================
-- ATIVAÇÃO DO SITE: de R$ 1.500 por R$ 297 (pagamento único)
-- MENSALIDADE: R$ 47/mês, primeira cobrança após 30 dias (trial_days)
-- Cancelamento: permitido a qualquer momento (sem fidelidade / multa)
update public.plans
set name = 'Site Profissional',
    description = 'Site profissional com IA, agendamento, CRM, endereço personalizado e suporte.',
    activation_regular_price_cents = 150000,
    activation_price_cents = 29700,
    monthly_price_cents = 4700,
    billing_interval = 'month',
    offer_title = 'Tenha um site assim hoje mesmo',
    offer_subtitle = 'Seu negócio merece uma presença profissional na internet.',
    promo_text = 'Oferta especial de lançamento',
    cta_text = 'Quero meu site por {price}',
    transparency_text = '{activation} corresponde à ativação inicial do site. Após o primeiro mês, inicia-se a mensalidade de {monthly}. Sem fidelidade e com cancelamento quando quiser.',
    cancel_text = 'Sem fidelidade. Cancele quando quiser.',
    allow_cancel = true,
    trial_days = 30,
    sort_order = 10,
    features = '["Site profissional completo","Seu endereço personalizado","Painel exclusivo","Personalização do conteúdo","Site 100% responsivo","Central de IA (conteúdo e redes sociais)","CRM de clientes completo","Agendamento de consultas","Relatórios com exportação PDF/CSV","Suporte por WhatsApp"]'::jsonb,
    is_active = true
where code = 'monthly';

update public.plans
set is_active = false,
    sort_order = 20
where code = 'yearly';

-- Seção de oferta: título, subtítulo e preços passam a vir da tabela `plans`.
-- O conteúdo da seção mantém apenas o selo superior (eyebrow).
update public.site_sections
set content = jsonb_build_object('eyebrow', 'Seja uma TopConsultora'),
    title = null,
    subtitle = null
where key = 'pricing';
