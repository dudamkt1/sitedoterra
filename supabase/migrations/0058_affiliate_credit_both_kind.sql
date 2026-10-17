-- ============================================================================
-- Crédito de afiliado: novo tipo "both" (válido para ativação E mensalidade)
-- ============================================================================
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
-- e executar. Idempotente: pode ser re-executado sem erros.
--
-- Antes: affiliate_credit_usages.kind só aceitava 'activation' | 'subscription'
-- e a RPC reserve_affiliate_credit rejeitava qualquer outro valor.
-- Agora: aceita também 'both' (crédito serve para ativação e para mensalidade).
-- ============================================================================

create or replace function public.exec_migration_0058()
returns text
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_msg text;
begin
  -- 1) Permite o novo tipo "both" no CHECK da tabela.
  alter table public.affiliate_credit_usages
    drop constraint if exists affiliate_credit_usages_kind_check;
  alter table public.affiliate_credit_usages
    add constraint affiliate_credit_usages_kind_check
    check (kind in ('activation', 'subscription', 'both'));

  -- 2) reserve_affiliate_credit passa a aceitar "both".
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
    v_balance numeric;
    v_usage_id uuid;
  begin
    if p_amount is null or p_amount <= 0 then
      raise exception 'INVALID_AMOUNT';
    end if;
    if p_kind not in ('activation', 'subscription', 'both') then
      raise exception 'INVALID_KIND';
    end if;

    -- Serializa reservas concorrentes do mesmo afiliado (impede gasto duplo
    -- em duplo clique / retentativas simultâneas).
    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    -- Libera reservas antigas do mesmo tenant+tipo (tentativas abandonadas —
    -- ex.: usuário fechou a aba sem concluir). "both" é tratado como um tipo
    -- próprio, independente de 'activation'/'subscription'.
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
  $reserve$;

  -- Recarrega o cache de schema do PostgREST.
  perform pg_notify('pgrst', 'reload schema');

  v_msg := '0058 applied';
  return v_msg;
end;
$func$;

-- Aplica de fato (idempotente).
select public.exec_migration_0058();
