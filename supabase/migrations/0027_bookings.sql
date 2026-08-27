-- ============================================================
-- 0027: Controle de agendamentos da consultora
-- O dono do site registra consultas marcadas e controla status.
-- ============================================================

create table if not exists public.tenant_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_whatsapp text,
  client_email text,
  client_phone text,
  booking_date date not null,
  booking_time text not null,
  notes text,
  status text not null default 'pendente' check (status in ('pendente','confirmado','realizado','cancelado','faltou','reagendado')),
  source text not null default 'painel' check (source in ('painel','site','whatsapp','importado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_bookings_tenant_idx on public.tenant_bookings(tenant_id);
create index if not exists tenant_bookings_date_idx on public.tenant_bookings(tenant_id, booking_date);
create index if not exists tenant_bookings_status_idx on public.tenant_bookings(tenant_id, status);

drop trigger if exists tenant_bookings_touch on public.tenant_bookings;
create trigger tenant_bookings_touch before update on public.tenant_bookings
  for each row execute procedure public.touch_updated_at();

alter table public.tenant_bookings enable row level security;

drop policy if exists tenant_bookings_select_own on public.tenant_bookings;
create policy tenant_bookings_select_own on public.tenant_bookings
  for select using (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_bookings_insert_own on public.tenant_bookings;
create policy tenant_bookings_insert_own on public.tenant_bookings
  for insert with check (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_bookings_update_own on public.tenant_bookings;
create policy tenant_bookings_update_own on public.tenant_bookings
  for update using (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  ) with check (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );
drop policy if exists tenant_bookings_delete_own on public.tenant_bookings;
create policy tenant_bookings_delete_own on public.tenant_bookings
  for delete using (
    tenant_id in (select id from public.tenants where user_id = auth.uid())
    or public.is_superadmin()
  );

grant select, insert, update, delete on public.tenant_bookings to authenticated;
