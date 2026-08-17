-- ============================================================
-- 0022: CRM completo para consultores doTERRA
-- Tabelas por tenant/user com isolamento multi-tenant + RLS.
-- ============================================================

-- ---------- Configurações do CRM (por tenant) ----------
create table public.crm_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  currency text not null default 'BRL',
  modules jsonb not null default '{}'::jsonb,
  vip_rules jsonb not null default '{}'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  financial_categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cpf text,
  birth_date date,
  email text,
  phone text,
  whatsapp text,
  city text,
  state text,
  notes text,
  category text not null default 'Novo cliente',
  is_vip boolean not null default false,
  first_contact_at date,
  first_purchase_at date,
  last_purchase_at date,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Anotações do cliente ----------
create table public.crm_client_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

-- ---------- Linha do tempo do cliente ----------
create table public.crm_client_timeline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  event_type text not null default 'manual',
  title text not null,
  description text,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- Produtos ----------
create table public.crm_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  category text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Vendas ----------
create table public.crm_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  sale_date date not null default current_date,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  payment_method text,
  status text not null default 'Pago',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Itens de venda ----------
create table public.crm_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.crm_sales(id) on delete cascade,
  product_id uuid references public.crm_products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  total_cents integer not null default 0
);

-- ---------- Entradas e saídas financeiras ----------
create table public.crm_financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  type text not null default 'income',
  category text,
  description text,
  amount_cents integer not null default 0,
  entry_date date not null default current_date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Cobranças ----------
create table public.crm_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  sale_id uuid references public.crm_sales(id) on delete set null,
  amount_cents integer not null default 0,
  due_date date not null default current_date,
  payment_method text,
  status text not null default 'Pendente',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Configuração do programa de fidelidade ----------
create table public.crm_loyalty_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  program_name text not null default 'Programa de Fidelidade',
  points_per_purchase_cents integer not null default 10,
  points_per_referral integer not null default 50,
  points_per_birthday integer not null default 100,
  points_per_special integer not null default 20,
  rules jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  rewards jsonb not null default '[]'::jsonb,
  levels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Pontos de fidelidade (histórico/auditoria) ----------
create table public.crm_loyalty_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  amount integer not null,
  type text not null default 'compra',
  description text,
  created_at timestamptz not null default now()
);

-- ---------- Tarefas e lembretes ----------
create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  title text not null,
  due_date date,
  due_time text,
  priority text not null default 'Média',
  category text,
  notes text,
  status text not null default 'A fazer',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Automações / lembretes ----------
create table public.crm_automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  enabled boolean not null default false,
  days integer not null default 0,
  schedule_time text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Mensagens prontas (WhatsApp) ----------
create table public.crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text,
  label text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Configuração de WhatsApp (token criptografado) ----------
create table public.crm_whatsapp_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  provider text,
  api_url text,
  access_token_enc text,
  phone_id text,
  webhook_url text,
  connection_status text not null default 'not_configured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Logs de exportação ----------
create table public.crm_export_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  export_type text not null,
  format text not null,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

-- ---------- Triggers updated_at ----------
create trigger touch_updated_at before update on public.crm_settings
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_clients
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_products
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_sales
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_financial_entries
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_charges
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_loyalty_settings
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_tasks
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_automations
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_message_templates
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.crm_whatsapp_config
  for each row execute function public.touch_updated_at();

-- ---------- Índices ----------
create index crm_clients_tenant_idx on public.crm_clients(tenant_id);
create index crm_clients_name_idx on public.crm_clients(tenant_id, name);
create index crm_client_notes_client_idx on public.crm_client_notes(client_id);
create index crm_client_timeline_client_idx on public.crm_client_timeline(client_id);
create index crm_products_tenant_idx on public.crm_products(tenant_id);
create index crm_sales_tenant_idx on public.crm_sales(tenant_id);
create index crm_sales_client_idx on public.crm_sales(client_id);
create index crm_sale_items_sale_idx on public.crm_sale_items(sale_id);
create index crm_financial_entries_tenant_idx on public.crm_financial_entries(tenant_id);
create index crm_charges_tenant_idx on public.crm_charges(tenant_id);
create index crm_charges_client_idx on public.crm_charges(client_id);
create index crm_loyalty_points_client_idx on public.crm_loyalty_points(client_id);
create index crm_tasks_tenant_idx on public.crm_tasks(tenant_id);
create index crm_automations_tenant_idx on public.crm_automations(tenant_id);
create index crm_message_templates_tenant_idx on public.crm_message_templates(tenant_id);
create index crm_export_logs_tenant_idx on public.crm_export_logs(tenant_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.crm_settings enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_client_notes enable row level security;
alter table public.crm_client_timeline enable row level security;
alter table public.crm_products enable row level security;
alter table public.crm_sales enable row level security;
alter table public.crm_sale_items enable row level security;
alter table public.crm_financial_entries enable row level security;
alter table public.crm_charges enable row level security;
alter table public.crm_loyalty_settings enable row level security;
alter table public.crm_loyalty_points enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_automations enable row level security;
alter table public.crm_message_templates enable row level security;
alter table public.crm_whatsapp_config enable row level security;
alter table public.crm_export_logs enable row level security;

do $$
declare
  t text;
  tables text[] := array['crm_settings','crm_clients','crm_client_notes','crm_client_timeline','crm_products','crm_sales','crm_sale_items','crm_financial_entries','crm_charges','crm_loyalty_settings','crm_loyalty_points','crm_tasks','crm_automations','crm_message_templates','crm_whatsapp_config','crm_export_logs'];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on public.%I for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin()) with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())',
      t || '_delete_own', t);
  end loop;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;