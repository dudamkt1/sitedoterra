-- ============================================================================
-- CONTINUAÇÃO PARA PROJETOS ONDE O 0001_init.sql FALHOU PARCIALMENTE
-- (erro: function public.is_superadmin() does not exist na linha do policy)
-- ----------------------------------------------------------------------------
-- Rodar SOMENTE em um projeto onde o 0001 foi aplicado até o bloco de RLS
-- (tabelas/enums/funções/triggers já existem). Em projeto novo, basta rodar
-- o 0001_init.sql corrigido (a ordem da função is_superadmin foi ajustada).
-- ============================================================================

-- Helper de acesso do Super Admin (usado pelas políticas de RLS).
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'superadmin' from public.profiles where user_id = auth.uid()), false);
$$;

create policy audit_select_admin on public.audit_logs
  for select using (public.is_superadmin());
create policy payment_events_select_admin on public.payment_events
  for select using (public.is_superadmin());

create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid() or public.is_superadmin());
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());
create policy profiles_update_admin on public.profiles
  for update using (public.is_superadmin());
create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid());

create policy tenants_select_own on public.tenants
  for select using (user_id = auth.uid() or public.is_superadmin());
create policy tenants_update_own on public.tenants
  for update using (user_id = auth.uid());
create policy tenants_update_admin on public.tenants
  for update using (public.is_superadmin());
create policy tenants_insert_own on public.tenants
  for insert with check (user_id = auth.uid());
create policy tenants_delete_admin on public.tenants
  for delete using (public.is_superadmin());

create policy site_settings_select_own on public.site_settings
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy site_settings_update_own on public.site_settings
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy site_settings_update_admin on public.site_settings
  for update using (public.is_superadmin());
create policy site_settings_insert_own on public.site_settings
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));

create policy subs_select_own on public.subscriptions
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy subs_update_own on public.subscriptions
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy subs_update_admin on public.subscriptions
  for update using (public.is_superadmin());
create policy subs_insert_own on public.subscriptions
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));

create policy payments_select_own on public.payments
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy payments_select_admin on public.payments
  for select using (public.is_superadmin());

create policy billing_select_own on public.billing_history
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

create policy domains_select_own on public.domains
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());
create policy domains_update_own on public.domains
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy domains_update_admin on public.domains
  for update using (public.is_superadmin());
create policy domains_insert_own on public.domains
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy domains_delete_admin on public.domains
  for delete using (public.is_superadmin());

create policy plans_select_all on public.plans
  for select using (true);

-- Seed de planos (idempotente)
insert into public.plans (name, code, description, activation_price_cents, monthly_price_cents, billing_interval, features, is_active)
values
  ('Plano Mensal', 'monthly', 'Site profissional, IA, agendamento, CRM e domínio próprio.', 29700, 4700, 'month', '["Site profissional personalizado","Chat IA especialista doTERRA","Agendamento integrado","CRM de clientes","Domínio próprio incluso","Suporte por WhatsApp"]', true),
  ('Plano Anual', 'yearly', 'Todos os benefícios do plano mensal com desconto.', 29700, 4700, 'year', '["Tudo do plano mensal","Domínio próprio incluso","Base de conhecimento IA","Relatórios avançados","Prioridade no suporte","Novidades em primeira mão"]', false)
on conflict (code) do nothing;
