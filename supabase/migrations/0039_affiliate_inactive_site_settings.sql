-- ============================================================================
-- Controle do Super Admin sobre afiliados SEM site ativo
-- ============================================================================
-- Esta migration adiciona a flag global `allow_inactive_site_affiliate` que
-- permite ao Super Admin decidir se afiliados que ainda não possuem site
-- ativo podem ou não divulgar seu link de afiliado e gerar novas indicações.
--
-- Valor padrão: TRUE (permite). Esse padrão é "seguro" no sentido de
-- preservar o comportamento atual do programa: a única consequência quando
-- o site está inativo é que o visitante vê uma página de fallback profissional
-- em vez da HOME personalizada do afiliado.
--
-- Regras implementadas:
--   1. register_affiliate_click valida:
--      - programa ativo (program_active)
--      - afiliado com is_active=true
--      - se afiliado NÃO tem site ativo, exige allow_inactive_site_affiliate=true
--   2. register_affiliate_conversion (já existente) é estendida para usar
--      o mesmo check no momento de fechar a venda: se o afiliado não tem
--      site ativo e o Super Admin desligou a permissão, a conversão NÃO é
--      registrada e a comissão NÃO é criada.
--   3. Nova RPC get_tenant_for_affiliate_lookup(p_slug): retorna o tenant
--      mesmo que site_status != 'active'. Usada para que o link de afiliado
--      SEMPRE renderize uma página de fallback (nunca 404), preservando o
--      cookie first-party tc_visitor_token e a atribuição.
-- ============================================================================

-- ============================ COLUNA NOVA ============================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_settings'
      and column_name = 'allow_inactive_site_affiliate'
  ) then
    alter table public.affiliate_settings
      add column allow_inactive_site_affiliate boolean not null default true;
  end if;
end $$;

-- ============================ FUNÇÃO AUXILIAR ============================

-- Retorna TRUE se o site do afiliado está PUBLICAMENTE ativo
-- (considera tanto site_status quanto assinatura/billing/profile).
-- Esta é a fonte da verdade para a regra de "site ativo" do afiliado.
create or replace function public.is_affiliate_site_active(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tenants t
    left join public.profiles pr on pr.user_id = t.user_id
    where t.user_id = p_user_id
      and t.site_status = 'active'
      and coalesce(pr.status, 'active') = 'active'
      and (
        not coalesce(t.monthly_billing_enabled, true)
        or exists (
          select 1 from public.subscriptions su
          where su.tenant_id = t.id
            and su.status = 'active'
        )
      )
  );
$$;

-- ============================ RPC: CLICK ============================

-- Recria register_affiliate_click com a nova regra:
-- - Se o afiliado não tem site ativo, exige allow_inactive_site_affiliate=true
--   para registrar o clique.
drop function if exists public.register_affiliate_click(uuid, text, text);
create or replace function public.register_affiliate_click(
  p_affiliate_user_id uuid,
  p_visitor_token text,
  p_source_subdomain text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_existing_token boolean;
  v_program_active boolean;
  v_allow_inactive boolean;
  v_affiliate_active boolean;
  v_site_active boolean;
begin
  -- 1) Programa global ativo?
  select program_active, allow_inactive_site_affiliate
    into v_program_active, v_allow_inactive
  from public.affiliate_settings
  limit 1;

  if v_program_active is null or v_program_active = false then
    return null;
  end if;

  -- 2) Afiliado ativo no programa?
  select is_active
    into v_affiliate_active
  from public.affiliate_status
  where user_id = p_affiliate_user_id;

  if v_affiliate_active is null or v_affiliate_active = false then
    return null;
  end if;

  -- 3) Site do afiliado está ativo?
  v_site_active := public.is_affiliate_site_active(p_affiliate_user_id);

  -- Se NÃO está ativo e a flag global está DESATIVADA: rejeita a indicação.
  if not v_site_active and not v_allow_inactive then
    return null;
  end if;

  -- 4) First-click wins
  select exists(select 1 from public.affiliate_clicks where visitor_token = p_visitor_token)
    into v_existing_token;

  if v_existing_token then
    return null;
  end if;

  insert into public.affiliate_clicks (affiliate_user_id, visitor_token, source_subdomain)
  values (p_affiliate_user_id, p_visitor_token, p_source_subdomain)
  returning id into v_click_id;

  return v_click_id;
end;
$$;

-- ============================ RPC: CONVERSÃO ============================

-- A conversão continua valida o estado do afiliado NO MOMENTO DA VENDA.
-- Se o afiliado não tem site ativo e a flag global está OFF, a comissão
-- NÃO é registrada (a venda segue normalmente — apenas sem atribuição).
create or replace function public.register_affiliate_conversion(
  p_visitor_token text,
  p_new_customer_user_id uuid,
  p_sale_amount numeric,
  p_commission_percent numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_click_id uuid;
  v_affiliate_user_id uuid;
  v_allow_inactive boolean;
  v_site_active boolean;
  v_commission_amount numeric;
  v_conversion_id uuid;
begin
  -- Busca o click não convertido para este visitor_token
  select id, affiliate_user_id
    into v_click_id, v_affiliate_user_id
  from public.affiliate_clicks
  where visitor_token = p_visitor_token
    and converted = false
  limit 1;

  if v_click_id is null then
    return null;
  end if;

  -- Revalida elegibilidade no momento do pagamento:
  -- o afiliado pode ter ativado/desativado o site entre o clique e a venda.
  select allow_inactive_site_affiliate
    into v_allow_inactive
  from public.affiliate_settings
  limit 1;

  v_site_active := public.is_affiliate_site_active(v_affiliate_user_id);

  if not v_site_active and not v_allow_inactive then
    -- Indicação NÃO elegível: marca o click como convertido (para não tentar
    -- de novo) mas NÃO cria comissão.
    update public.affiliate_clicks
      set converted = true
      where id = v_click_id;
    return null;
  end if;

  -- Calcula comissão
  v_commission_amount := round(p_sale_amount * p_commission_percent / 100, 2);

  -- Marca click como convertido
  update public.affiliate_clicks
    set converted = true
    where id = v_click_id;

  -- Cria registro de conversão
  insert into public.affiliate_conversions (
    click_id,
    affiliate_user_id,
    new_customer_user_id,
    sale_amount,
    commission_percent_at_time,
    commission_amount,
    status
  ) values (
    v_click_id,
    v_affiliate_user_id,
    p_new_customer_user_id,
    p_sale_amount,
    p_commission_percent,
    v_commission_amount,
    'pendente'
  )
  returning id into v_conversion_id;

  return v_conversion_id;
end;
$$;

-- ============================ RPC: LOOKUP PARA LINK DE AFILIADO ============================

-- Esta RPC é usada EXCLUSIVAMENTE quando o visitante chega por um link de
-- afiliado (`?ref=`) e o slug NÃO corresponde a um site público ativo.
--
-- Retorna o tenant SEM exigir site_status='active' nem assinatura ativa.
-- A página /[slug] usa isso para renderizar a página de fallback
-- (SiteUnprepared) em vez de um 404 — preservando o cookie tc_visitor_token
-- e permitindo que a venda ainda seja atribuída ao afiliado (caso a flag
-- global allow_inactive_site_affiliate esteja ativa).
--
-- SECURITY: retornamos apenas dados públicos (mesma forma que
-- get_public_tenant_by_slug). Não expomos informações sensíveis.
create or replace function public.get_tenant_for_affiliate_lookup(p_slug text)
returns table (
  tenant_id uuid,
  slug text,
  site_name text,
  site_status public.site_status,
  settings jsonb,
  site_data jsonb,
  profile_name text,
  email text,
  monthly_billing_enabled boolean,
  user_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    t.slug,
    t.site_name,
    t.site_status,
    t.settings,
    s.data,
    p.name,
    p.email,
    t.monthly_billing_enabled,
    t.user_id
  from public.tenants t
  left join public.site_settings s on s.tenant_id = t.id
  left join public.profiles p on p.user_id = t.user_id
  where t.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_tenant_for_affiliate_lookup(text) to anon, authenticated;
grant execute on function public.is_affiliate_site_active(uuid) to anon, authenticated;