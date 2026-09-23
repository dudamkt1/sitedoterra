-- ============================================================================
-- 0053: SORTEIO POR FIDELIDADE (vinculado a compras do CRM)
-- ----------------------------------------------------------------------------
-- * loyalty_raffle_settings — configuração por tenant (opt-in, desativado
--   por padrão). Valores em CENTAVOS (mesmo padrão de crm_sales/total_cents).
-- * loyalty_raffle_rounds   — rodadas; snapshot da config no momento da
--   criação para não quebrar rodadas antigas. Ao sortear, uma nova rodada
--   `collecting` começa automaticamente (sorteios recorrentes).
-- * loyalty_raffle_entries  — números escolhidos (UNIQUE por rodada).
-- * loyalty_raffle_credits  — créditos pendentes de número gerados por
--   compras confirmadas (Pago/Parcial), pendentes de escolha do número.
-- * Sorteio verificável: random_seed (hex) + drawn_at + algorithm_description
--   gravados na rodada para auditoria.
-- * Seção global `loyalty_raffle` (#sorteio, sort 105: após Produtos=100,
--   antes do FAQ=110) + backfill DESABILITADO em tenant_sections para
--   tenants existentes (não força em quem já customizou a home; a
--   consultora ativa em /painel/meu-site → Minha Home).
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

-- ============================ SETTINGS ============================
create table if not exists public.loyalty_raffle_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  amount_per_number_cents integer not null default 5000 check (amount_per_number_cents > 0),
  total_numbers integer not null default 30 check (total_numbers >= 2 and total_numbers <= 1000),
  prize_type text not null default 'brinde' check (prize_type in ('brinde', 'dinheiro', 'credito_loja')),
  prize_description text not null default '',
  prize_credit_amount_cents integer check (prize_credit_amount_cents is null or prize_credit_amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists loyalty_raffle_settings_touch on public.loyalty_raffle_settings;
create trigger loyalty_raffle_settings_touch before update on public.loyalty_raffle_settings
  for each row execute procedure public.touch_updated_at();

-- ============================ ROUNDS ============================
create table if not exists public.loyalty_raffle_rounds (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  settings_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'collecting' check (status in ('collecting', 'drawn')),
  winner_entry_id uuid,
  drawn_at timestamptz,
  random_seed text,
  algorithm_description text,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_raffle_rounds_tenant_idx on public.loyalty_raffle_rounds(tenant_id);
create index if not exists loyalty_raffle_rounds_open_idx on public.loyalty_raffle_rounds(tenant_id, status) where status = 'collecting';

-- ============================ ENTRIES ============================
create table if not exists public.loyalty_raffle_entries (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references public.loyalty_raffle_rounds(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  chosen_number integer not null check (chosen_number >= 1),
  earned_from_sale_id uuid references public.crm_sales(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (round_id, chosen_number)
);
create index if not exists loyalty_raffle_entries_round_idx on public.loyalty_raffle_entries(round_id);
create index if not exists loyalty_raffle_entries_client_idx on public.loyalty_raffle_entries(client_id);
create index if not exists loyalty_raffle_entries_tenant_idx on public.loyalty_raffle_entries(tenant_id);

-- FK do vencedor (adicionada após a criação de entries para evitar ciclo).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loyalty_raffle_rounds_winner_fk'
  ) then
    alter table public.loyalty_raffle_rounds
      add constraint loyalty_raffle_rounds_winner_fk
      foreign key (winner_entry_id) references public.loyalty_raffle_entries(id) on delete set null;
  end if;
end $$;

-- ============================ CREDITS (pendentes de escolha) ============================
create table if not exists public.loyalty_raffle_credits (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  sale_id uuid not null references public.crm_sales(id) on delete cascade,
  numbers_total integer not null default 0 check (numbers_total >= 0),
  numbers_used integer not null default 0 check (numbers_used >= 0),
  created_at timestamptz not null default now(),
  unique (sale_id)
);
create index if not exists loyalty_raffle_credits_tenant_client_idx on public.loyalty_raffle_credits(tenant_id, client_id);

-- ============================ RLS ============================
alter table public.loyalty_raffle_settings enable row level security;
alter table public.loyalty_raffle_rounds enable row level security;
alter table public.loyalty_raffle_entries enable row level security;
alter table public.loyalty_raffle_credits enable row level security;

do $$
declare
  t text;
  tables text[] := array['loyalty_raffle_settings','loyalty_raffle_rounds','loyalty_raffle_entries','loyalty_raffle_credits'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I;', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin()) with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_delete_own', t);
  end loop;
end $$;

grant select, insert, update, delete on public.loyalty_raffle_settings to authenticated;
grant select, insert, update, delete on public.loyalty_raffle_rounds to authenticated;
grant select, insert, update, delete on public.loyalty_raffle_entries to authenticated;
grant select, insert, update, delete on public.loyalty_raffle_credits to authenticated;

-- ============================ SEÇÃO GLOBAL (após Produtos, antes do FAQ) ============================
insert into public.site_sections (type, key, label, title, subtitle, enabled, is_required, sort_order, settings, content, permissions)
select
  'loyalty_raffle',
  'sorteio-fidelidade',
  'Sorteio Fidelidade',
  null,
  null,
  true,
  false,
  105,
  '{"showInNav": true, "navLabel": "Sorteio"}'::jsonb,
  '{"eyebrow": "Programa de Fidelidade", "title": "Toda compra te aproxima do prêmio", "subtitle": "A cada compra você ganha números da sorte e concorre a prêmios exclusivos.", "buttonText": "Ver números"}'::jsonb,
  '{"can_edit": true, "can_toggle": true, "can_edit_image": false, "can_edit_video": false, "can_edit_button": true, "can_edit_colors": true, "can_edit_layout": false, "available_to_all": true}'::jsonb
where not exists (select 1 from public.site_sections where type = 'loyalty_raffle');

-- Backfill: tenants existentes recebem a seção DESABILITADA (opt-in explícito
-- em /painel/meu-site). Sem essa linha, sites congelados (frozenTenantContent)
-- nem enxergariam a seção no painel, pois só entram seções com override.
insert into public.tenant_sections (tenant_id, section_id, enabled, content, settings)
select t.id, s.id, false, '{}'::jsonb, '{}'::jsonb
from public.tenants t
cross join public.site_sections s
where s.type = 'loyalty_raffle'
on conflict (tenant_id, section_id) do nothing;
