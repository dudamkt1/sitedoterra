-- ============================================================================
-- "Saldo em Conta": crédito manual do admin, separado do saldo de afiliado
-- ============================================================================
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
-- e executar. Idempotente: pode ser re-executado sem erros.
--
-- CONTEXTO / REGRA DE NEGÓCIO
--   - "Saldo de Afiliado" = comissões que o usuário ganha indicando pessoas.
--   - "Saldo em Conta"    = crédito colocado manualmente pelo superadmin.
--     NÃO tem relação com comissões e NÃO deve reduzir o saldo de afiliado.
--   - No checkout o usuário pode usar OS DOIS: primeiro o Saldo em Conta e,
--     se faltar, o saldo de comissões do afiliado.
--
-- Antes desta migration o crédito manual era inserido como reserva em
-- affiliate_credit_usages (metadata.created_by_superadmin = true), o que o
-- fazia ser descontado do saldo de afiliado e falhava com INSUFFICIENT_BALANCE
-- quando o usuário não tinha comissões.
-- ============================================================================

create or replace function public.exec_migration_0059()
returns text
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_msg text;
begin
  -- ======================= TABELA DE CONCESSÕES =======================

  create table if not exists public.account_credit_grants (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    -- 'activation' (só ativação) | 'subscription' (só mensalidade) |
    -- 'both' (serve para os dois).
    kind text not null default 'both' check (kind in ('activation', 'subscription', 'both')),
    -- Valor em REAIS (mesma unidade de comissões/saques).
    amount numeric(10,2) not null check (amount > 0),
    -- 'active' (disponível) | 'canceled' (revogado — não volta a valer).
    status text not null default 'active' check (status in ('active', 'canceled')),
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists account_credit_grants_user_idx
    on public.account_credit_grants (user_id);
  create index if not exists account_credit_grants_user_active_idx
    on public.account_credit_grants (user_id, kind)
    where status = 'active';

  -- ============================== RLS ==============================

  alter table public.account_credit_grants enable row level security;

  drop policy if exists account_credit_grants_select_own on public.account_credit_grants;
  create policy account_credit_grants_select_own on public.account_credit_grants
    for select using (user_id = auth.uid() or public.is_superadmin());

  drop policy if exists account_credit_grants_admin on public.account_credit_grants;
  create policy account_credit_grants_admin on public.account_credit_grants
    for all using (public.is_superadmin());

  -- ==================== COLUNAS DE RASTREIO DE USO ====================

  -- Quanto de cada utilização veio do Saldo em Conta e quanto veio,
  -- especificamente, do pot compartilhado 'both'.
  alter table public.affiliate_credit_usages
    add column if not exists account_amount numeric(10,2) not null default 0;
  alter table public.affiliate_credit_usages
    add column if not exists account_both_amount numeric(10,2) not null default 0;

  alter table public.affiliate_credit_usages
    drop constraint if exists affiliate_credit_usages_account_amount_check;
  alter table public.affiliate_credit_usages
    add constraint affiliate_credit_usages_account_amount_check
    check (
      account_amount >= 0
      and account_both_amount >= 0
      and account_both_amount <= account_amount
      and account_amount <= amount
    );

  -- ==================== MIGRAÇÃO DE CRÉDITOS ANTIGOS ====================
  -- Créditos manuais antigos (created_by_superadmin) passam a ser concessões
  -- oficiais de Saldo em Conta. Assim deixam de reduzir o saldo de comissões.

  insert into public.account_credit_grants (user_id, kind, amount, status, metadata, created_at)
  select
    u.affiliate_user_id,
    case when u.kind in ('activation', 'subscription', 'both') then u.kind else 'both' end,
    u.amount,
    'active',
    jsonb_build_object('migrated_from_usage', u.id),
    u.created_at
  from public.affiliate_credit_usages u
  where coalesce(u.account_amount, 0) = 0
    and u.metadata ->> 'created_by_superadmin' = 'true'
    and u.status in ('reserved', 'applied')
    and not exists (
      select 1 from public.account_credit_grants g
      where g.metadata ->> 'migrated_from_usage' = u.id::text
    );

  -- Usos já confirmados: marcar toda a utilização como vinda do Saldo em Conta
  -- (a parcela de comissões vira zero e o saldo de afiliado é devolvido).
  update public.affiliate_credit_usages
  set account_amount = amount,
      account_both_amount = case when kind = 'both' then amount else 0 end
  where account_amount = 0
    and metadata ->> 'created_by_superadmin' = 'true'
    and status = 'applied';

  -- Reservas antigas (tentativas não concluídas): liberar.
  update public.affiliate_credit_usages
  set status = 'released', released_at = now()
  where account_amount = 0
    and metadata ->> 'created_by_superadmin' = 'true'
    and status = 'reserved';

  -- ================= SALDO DE AFILIADO (só comissões) =================
  -- Desconta apenas a parcela de comissões das utilizações — o Saldo em Conta
  -- (account_amount) não afeta mais o saldo de afiliado nem os saques.

  create or replace function public.get_affiliate_balance(p_user_id uuid)
  returns numeric
  language sql
  security definer
  set search_path = public
  stable
  as $balance$
    select coalesce((
      select sum(commission_amount) from public.affiliate_conversions
      where affiliate_user_id = p_user_id
        and status = 'aprovado'
    ), 0) - coalesce((
      select sum(amount) from public.affiliate_payouts
      where affiliate_user_id = p_user_id
        and status = 'pago'
    ), 0) - coalesce((
      -- Apenas a parte paga com comissões (amount − account_amount).
      select sum(amount - account_amount) from public.affiliate_credit_usages
      where affiliate_user_id = p_user_id
        and status in ('reserved', 'applied')
    ), 0);
  $balance$;

  -- ===================== SALDO EM CONTA DISPONÍVEL =====================
  -- Crédito manual disponível (em REAIS). Com p_kind informado, considera
  -- também as concessões 'both'. Somente leitura.

  create or replace function public.get_account_credit_available(
    p_user_id uuid,
    p_kind text default null
  )
  returns numeric
  language sql
  security definer
  set search_path = public
  stable
  as $acct$
    select greatest(0, case
      when p_kind is null then
        coalesce((
          select sum(g.amount) from public.account_credit_grants g
          where g.user_id = p_user_id and g.status = 'active'
        ), 0) - coalesce((
          select sum(u.account_amount) from public.affiliate_credit_usages u
          where u.affiliate_user_id = p_user_id
            and u.status in ('reserved', 'applied')
        ), 0)
      else
        coalesce((
          select sum(g.amount) from public.account_credit_grants g
          where g.user_id = p_user_id and g.status = 'active'
            and (g.kind = p_kind or g.kind = 'both')
        ), 0) - coalesce((
          -- Parcela vinda do pot específico do tipo (consumida só por este tipo).
          select sum(u.account_amount - u.account_both_amount)
          from public.affiliate_credit_usages u
          where u.affiliate_user_id = p_user_id
            and u.status in ('reserved', 'applied')
            and u.kind = p_kind
        ), 0) - coalesce((
          -- Parcela vinda do pot 'both' (consumida por qualquer tipo).
          select sum(u.account_both_amount)
          from public.affiliate_credit_usages u
          where u.affiliate_user_id = p_user_id
            and u.status in ('reserved', 'applied')
        ), 0)
    end);
  $acct$;

  -- ==================== RESERVA (Saldo em Conta + Comissões) ====================
  -- Consome primeiro o Saldo em Conta (pot do tipo e depois o 'both') e só
  -- então o saldo de comissões do afiliado. Levanta INSUFFICIENT_BALANCE
  -- apenas quando Saldo em Conta + comissões não cobrem o valor.

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
  as $reserve$
  declare
    v_affiliate numeric;
    v_account_total numeric;
    v_both_avail numeric;
    v_specific_avail numeric;
    v_from_specific numeric;
    v_from_both numeric;
    v_account_amount numeric;
    v_remaining numeric;
    v_usage_id uuid;
  begin
    if p_amount is null or p_amount <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;
    if p_kind not in ('activation', 'subscription', 'both') then
      raise exception 'INVALID_KIND';
    end if;

    -- Serializa reservas concorrentes do mesmo usuário (impede gasto duplo).
    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    -- Libera reservas antigas do mesmo tenant+tipo (tentativas abandonadas).
    update public.affiliate_credit_usages
    set status = 'released', released_at = now()
    where affiliate_user_id = p_user_id
      and tenant_id is not distinct from p_tenant_id
      and kind = p_kind
      and status = 'reserved';

    v_affiliate := public.get_affiliate_balance(p_user_id);
    v_account_total := public.get_account_credit_available(p_user_id, p_kind);

    -- Pot compartilhado 'both' disponível (concessões 'both' − tudo que dele
    -- já foi consumido, em qualquer tipo).
    v_both_avail := greatest(0,
      coalesce((
        select sum(g.amount) from public.account_credit_grants g
        where g.user_id = p_user_id and g.status = 'active' and g.kind = 'both'
      ), 0) - coalesce((
        select sum(u.account_both_amount) from public.affiliate_credit_usages u
        where u.affiliate_user_id = p_user_id
          and u.status in ('reserved', 'applied')
      ), 0)
    );
    v_specific_avail := greatest(0, v_account_total - v_both_avail);

    if p_amount > v_account_total + v_affiliate then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;

    -- Saque: Saldo em Conta (específico → 'both') e depois comissões.
    v_from_specific := least(p_amount, v_specific_avail);
    v_remaining := p_amount - v_from_specific;
    v_from_both := least(v_remaining, v_both_avail);
    v_account_amount := v_from_specific + v_from_both;

    insert into public.affiliate_credit_usages (
      affiliate_user_id, tenant_id, kind, amount,
      account_amount, account_both_amount, status, metadata
    ) values (
      p_user_id, p_tenant_id, p_kind, p_amount,
      v_account_amount, v_from_both, 'reserved',
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_usage_id;

    return v_usage_id;
  end;
  $reserve$;

  -- Recarrega o cache de schema do PostgREST.
  perform pg_notify('pgrst', 'reload schema');

  v_msg := '0059 applied';
  return v_msg;
end;
$func$;

-- Aplica de fato (idempotente).
select public.exec_migration_0059();
