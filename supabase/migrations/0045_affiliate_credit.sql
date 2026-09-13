-- ============================================================================
-- Crédito de afiliado no checkout (saldo disponível como desconto)
-- ============================================================================
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
-- e executar. Idempotente: pode ser re-executado sem erros.
--
-- Até esta migration ser aplicada, o checkout funciona exatamente como antes
-- (o backend detecta a ausência da infra e segue sem crédito — fail closed).
-- ============================================================================

-- ============================ TABELA ============================

-- Utilizações de crédito de afiliado como desconto em pagamentos.
-- Sem FKs para tenants/payments de propósito: o histórico do afiliado é
-- preservado mesmo se os registros financeiros forem removidos.
create table if not exists public.affiliate_credit_usages (
  id uuid primary key default uuid_generate_v4(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid,
  subscription_id uuid,
  payment_id uuid,
  -- Valor do crédito em REAIS (mesma unidade das comissões/saques).
  amount numeric(10,2) not null check (amount > 0),
  -- 'activation' (ativação) | 'subscription' (mensalidade).
  kind text not null default 'activation' check (kind in ('activation', 'subscription')),
  -- 'reserved' (pagamento em andamento) | 'applied' (pagamento confirmado) |
  -- 'released' (pagamento falhou/abandonado — saldo volta).
  status text not null default 'reserved' check (status in ('reserved', 'applied', 'released')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists affiliate_credit_usages_affiliate_idx
  on public.affiliate_credit_usages (affiliate_user_id);
create index if not exists affiliate_credit_usages_status_idx
  on public.affiliate_credit_usages (status);
create index if not exists affiliate_credit_usages_tenant_kind_idx
  on public.affiliate_credit_usages (tenant_id, kind)
  where status = 'reserved';

-- ============================ RLS ============================

alter table public.affiliate_credit_usages enable row level security;

-- Afiliado vê o próprio histórico de uso de crédito, superadmin vê tudo.
drop policy if exists affiliate_credit_usages_select_own on public.affiliate_credit_usages;
create policy affiliate_credit_usages_select_own on public.affiliate_credit_usages
  for select using (affiliate_user_id = auth.uid() or public.is_superadmin());

drop policy if exists affiliate_credit_usages_admin on public.affiliate_credit_usages;
create policy affiliate_credit_usages_admin on public.affiliate_credit_usages
  for all using (public.is_superadmin());

-- ============================ SALDO LÍQUIDO ============================

-- Saldo disponível passa a descontar o crédito reservado/aplicado, de forma
-- que o MESMO saldo canônico protege saques (payout) e crédito no checkout
-- contra gasto duplo. Substitui a versão da migration 0035.
create or replace function public.get_affiliate_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select sum(commission_amount) from public.affiliate_conversions
    where affiliate_user_id = p_user_id
      and status = 'aprovado'
  ), 0) - coalesce((
    select sum(amount) from public.affiliate_payouts
    where affiliate_user_id = p_user_id
      and status = 'pago'
  ), 0) - coalesce((
    -- Crédito reservado (pagamento em andamento) ou aplicado (confirmado).
    -- 'released' volta ao saldo automaticamente.
    select sum(amount) from public.affiliate_credit_usages
    where affiliate_user_id = p_user_id
      and status in ('reserved', 'applied')
  ), 0);
$$;

-- ============================ RPCs DE CRÉDITO ============================

-- Reserva crédito de forma ATÔMICA (trava por usuário contra condição de
-- corrida): libera reservas antigas abandonadas do mesmo tenant+tipo,
-- valida o saldo dentro da transação e insere a reserva. Levanta exceção
-- com código 'INSUFFICIENT_BALANCE' quando o saldo não cobre o valor.
create or replace function public.reserve_affiliate_credit(
  p_user_id uuid,
  p_amount numeric,
  p_tenant_id uuid,
  p_kind text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_usage_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('activation', 'subscription') then
    raise exception 'INVALID_KIND';
  end if;

  -- Serializa reservas concorrentes do mesmo afiliado (impede gasto duplo
  -- em duplo clique / retentativas simultâneas).
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Libera reservas antigas do mesmo tenant+tipo (tentativas abandonadas —
  -- ex.: usuário fechou a aba sem concluir). Só a tentativa atual fica ativa.
  update public.affiliate_credit_usages
  set status = 'released', released_at = now()
  where affiliate_user_id = p_user_id
    and tenant_id is not distinct from p_tenant_id
    and kind = p_kind
    and status = 'reserved';

  -- Saldo líquido (conversões aprovadas − saques pagos − crédito em uso).
  select public.get_affiliate_balance(p_user_id) into v_balance;

  if p_amount > v_balance then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.affiliate_credit_usages (
    affiliate_user_id, tenant_id, kind, amount, status, metadata
  ) values (
    p_user_id, p_tenant_id, p_kind, p_amount, 'reserved',
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_usage_id;

  return v_usage_id;
end;
$$;

-- Confirma a utilização quando o pagamento é aprovado (webhook).
-- Idempotente: se já aplicada, retorna verdadeiro sem duplicar.
create or replace function public.apply_affiliate_credit(
  p_usage_id uuid,
  p_payment_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.affiliate_credit_usages
  where id = p_usage_id;

  if v_status is null then
    return false;
  end if;
  if v_status = 'applied' then
    return true;
  end if;
  if v_status <> 'reserved' then
    return false;
  end if;

  update public.affiliate_credit_usages
  set status = 'applied',
      applied_at = now(),
      payment_id = coalesce(p_payment_id, payment_id)
  where id = p_usage_id;

  return true;
end;
$$;

-- Libera a reserva quando o pagamento falha/expira (saldo volta).
-- Idempotente: se já liberada/aplicada, não altera nada.
create or replace function public.release_affiliate_credit(p_usage_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.affiliate_credit_usages
  where id = p_usage_id;

  if v_status is null then
    return false;
  end if;
  if v_status = 'released' then
    return true;
  end if;
  -- Crédito já aplicado (pagamento confirmado) nunca é liberado aqui.
  if v_status <> 'reserved' then
    return false;
  end if;

  update public.affiliate_credit_usages
  set status = 'released', released_at = now()
  where id = p_usage_id;

  return true;
end;
$$;
