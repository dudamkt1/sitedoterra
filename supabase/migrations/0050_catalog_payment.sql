-- ============================================================================
-- CATALOG PAYMENT SETTINGS
-- Permite configurar PIX (com/sem desconto) e Mercado Pago no catálogo público
-- ============================================================================

create table if not exists public.catalog_payment_settings (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- PIX
  pix_enabled boolean not null default true,
  pix_discount_percent numeric(5,2) not null default 0 check (pix_discount_percent >= 0 and pix_discount_percent <= 50),
  pix_key text,
  pix_key_type text check (pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'evp')),
  pix_merchant_name text,
  pix_merchant_city text,
  -- Mercado Pago
  mp_enabled boolean not null default false,
  mp_installments int not null default 1 check (mp_installments >= 1 and mp_installments <= 12),
  mp_installments_without_interest boolean not null default false,
  -- Configurações gerais
  requires_contact_info boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create index if not exists catalog_payment_settings_tenant_idx on public.catalog_payment_settings (tenant_id);

-- Trigger para updated_at
create trigger set_updated_at_catalog_payment_settings
  before update on public.catalog_payment_settings
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.catalog_payment_settings enable row level security;

-- Usuário do tenant pode gerenciar suas configurações
drop policy if exists catalog_payment_settings_tenant_rw on public.catalog_payment_settings;
create policy catalog_payment_settings_tenant_rw on public.catalog_payment_settings
  for all
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

-- Super admin vê tudo
drop policy if exists catalog_payment_settings_superadmin on public.catalog_payment_settings;
create policy catalog_payment_settings_superadmin on public.catalog_payment_settings
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ============================================================================
-- CATALOG ORDERS (pedidos do catálogo público)
-- Sincroniza automaticamente com crm_sales e crm_sale_items
-- ============================================================================

create table if not exists public.catalog_orders (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.crm_products(id) on delete restrict,
  -- Dados do cliente
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_notes text,
  -- Pagamento
  payment_method text not null check (payment_method in ('pix', 'mercadopago', 'manual')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_id text, -- ID do pagamento no gateway (ex: Mercado Pago payment_id)
  payment_qr_code text, -- QR Code do PIX (base64 ou URL)
  payment_qr_code_text text, -- Copia e cola do PIX
  -- Valores
  original_price_cents int not null,
  discount_percent numeric(5,2) not null default 0,
  discount_cents int not null default 0,
  final_price_cents int not null,
  quantity int not null default 1 check (quantity > 0),
  -- Sincronização com CRM
  crm_sale_id uuid references public.crm_sales(id) on delete set null,
  crm_sale_item_id uuid references public.crm_sale_items(id) on delete set null,
  -- Metadata
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists catalog_orders_tenant_idx on public.catalog_orders (tenant_id);
create index if not exists catalog_orders_product_idx on public.catalog_orders (product_id);
create index if not exists catalog_orders_status_idx on public.catalog_orders (payment_status);
create index if not exists catalog_orders_created_idx on public.catalog_orders (created_at desc);
create index if not exists catalog_orders_crm_sale_idx on public.catalog_orders (crm_sale_id);

-- Trigger para updated_at
create trigger set_updated_at_catalog_orders
  before update on public.catalog_orders
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.catalog_orders enable row level security;

-- Usuário do tenant pode ver/gerenciar seus pedidos
drop policy if exists catalog_orders_tenant_rw on public.catalog_orders;
create policy catalog_orders_tenant_rw on public.catalog_orders
  for all
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

-- Super admin vê tudo
drop policy if exists catalog_orders_superadmin on public.catalog_orders;
create policy catalog_orders_superadmin on public.catalog_orders
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Função para criar venda no CRM a partir do pedido do catálogo
create or replace function public.create_crm_sale_from_catalog_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order record;
  v_client_id uuid;
  v_sale_id uuid;
  v_sale_item_id uuid;
  v_product record;
begin
  -- Busca o pedido
  select * into v_order
  from public.catalog_orders
  where id = p_order_id;

  if not found then
    raise exception 'Pedido não encontrado: %', p_order_id;
  end if;

  -- Busca o produto
  select * into v_product
  from public.crm_products
  where id = v_order.product_id;

  if not found then
    raise exception 'Produto não encontrado: %', v_order.product_id;
  end if;

  -- Busca ou cria cliente (usa email/telefone como identificador)
  if v_order.customer_email is not null then
    select id into v_client_id
    from public.crm_clients
    where tenant_id = v_order.tenant_id and email = v_order.customer_email
    limit 1;
  end if;

  if v_client_id is null and v_order.customer_phone is not null then
    select id into v_client_id
    from public.crm_clients
    where tenant_id = v_order.tenant_id and phone = v_order.customer_phone
    limit 1;
  end if;

  -- Cria cliente se não existe
  if v_client_id is null then
    insert into public.crm_clients (tenant_id, user_id, name, email, phone, notes, created_at)
    values (
      v_order.tenant_id,
      (select user_id from public.crm_products where id = v_order.product_id limit 1),
      v_order.customer_name,
      v_order.customer_email,
      v_order.customer_phone,
      'Cliente criado via catálogo público',
      now()
    )
    returning id into v_client_id;
  end if;

  -- Cria a venda no CRM
  insert into public.crm_sales (tenant_id, user_id, client_id, sale_date, discount_cents, total_cents, payment_method, status, notes, created_at)
  values (
    v_order.tenant_id,
    (select user_id from public.crm_products where id = v_order.product_id limit 1),
    v_client_id,
    (v_order.paid_at or v_order.created_at)::date,
    v_order.discount_cents,
    v_order.final_price_cents * v_order.quantity,
    v_order.payment_method,
    case when v_order.payment_status = 'paid' then 'Pago' else 'Pendente' end,
    'Venda originada do catálogo público. Pedido: ' || v_order.id,
    v_order.created_at
  )
  returning id into v_sale_id;

  -- Cria o item da venda
  insert into public.crm_sale_items (tenant_id, sale_id, product_id, quantity, unit_price_cents, total_cents, created_at)
  values (
    v_order.tenant_id,
    v_sale_id,
    v_order.product_id,
    v_order.quantity,
    v_order.original_price_cents,
    v_order.final_price_cents * v_order.quantity,
    v_order.created_at
  )
  returning id into v_sale_item_id;

  -- Atualiza o pedido com os IDs do CRM
  update public.catalog_orders
  set crm_sale_id = v_sale_id,
      crm_sale_item_id = v_sale_item_id
  where id = p_order_id;

  return v_sale_id;
end;
$$;