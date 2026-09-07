-- ============================================================================
-- 0043: Lembretes de agendamento via WhatsApp
--
-- booking_settings: preferência por tenant (ativado + minutos antes do
-- compromisso; default 30). tenant_bookings.reminder_sent_at: marca quando
-- o lembrete foi enviado (evita reenvio).
-- O envio em si usa POST /api/crm/whatsapp/send (provedor já configurado).
-- ============================================================================

-- ============================ TABELA booking_settings ============================

create table if not exists public.booking_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  reminder_enabled boolean not null default true,
  reminder_minutes int not null default 30 check (reminder_minutes between 5 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists booking_settings_touch on public.booking_settings;
create trigger booking_settings_touch before update on public.booking_settings
  for each row execute procedure public.touch_updated_at();

-- ============================ COLUNA reminder_sent_at ============================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenant_bookings' and column_name = 'reminder_sent_at'
  ) then
    alter table public.tenant_bookings add column reminder_sent_at timestamptz;
  end if;
end $$;

-- ============================ RLS (padrão 0027/0022) ============================

alter table public.booking_settings enable row level security;

drop policy if exists booking_settings_select_own on public.booking_settings;
create policy booking_settings_select_own on public.booking_settings
  for select using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

drop policy if exists booking_settings_insert_own on public.booking_settings;
create policy booking_settings_insert_own on public.booking_settings
  for insert with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

drop policy if exists booking_settings_update_own on public.booking_settings;
create policy booking_settings_update_own on public.booking_settings
  for update using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin())
  with check (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

drop policy if exists booking_settings_delete_own on public.booking_settings;
create policy booking_settings_delete_own on public.booking_settings
  for delete using (tenant_id in (select id from public.tenants where user_id = auth.uid()) or public.is_superadmin());

-- ---------- Grants ----------
grant select, insert, update, delete on public.booking_settings to authenticated;

-- ============================ RPC idempotente ============================

create or replace function public.exec_migration_0043() returns text
  language plpgsql security definer set search_path = public as $func$
declare
  v_msg text := '0043 already applied';
begin
  create table if not exists public.booking_settings (
    tenant_id uuid primary key references public.tenants(id) on delete cascade,
    reminder_enabled boolean not null default true,
    reminder_minutes int not null default 30 check (reminder_minutes between 5 and 1440),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenant_bookings' and column_name = 'reminder_sent_at'
  ) then
    alter table public.tenant_bookings add column reminder_sent_at timestamptz;
  end if;

  alter table public.booking_settings enable row level security;

  grant select, insert, update, delete on public.booking_settings to authenticated;
  grant execute on function public.exec_migration_0043() to authenticated;

  v_msg := '0043 applied';
  return v_msg;
end;
$func$;

grant execute on function public.exec_migration_0043() to authenticated;
