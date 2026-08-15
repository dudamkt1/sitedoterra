-- ============================================================================
-- ISENÇÃO DE MENSALIDADE POR USUÁRIO (Super Admin)
-- ----------------------------------------------------------------------------
-- O Super Admin pode ATIVAR o site de qualquer usuário escolhendo se o usuário
-- manterá a cobrança mensal recorrente (padrão, via Stripe) ou se ficará ativo
-- SEM mensalidade (cortesia / isenção total da recorrência).
--
-- Quando `tenants.monthly_billing_enabled = false`:
--   * o site fica público sem exigir assinatura ativa no Stripe;
--   * o webhook NÃO cria recorrência mensal nem suspende o site por billing;
--   * o painel exibe "ativo sem mensalidade".
-- Usado em ações do painel Admin -> Usuários -> Ativar site.
-- Idempotente: pode ser re-executado sem erros.
-- ============================================================================

-- ============================ NOVA COLUNA ============================
alter table public.tenants
  add column if not exists monthly_billing_enabled boolean not null default true;

-- ============================ ATUALIZA RPCs PÚBLICAS ============================
-- Slug e domínio: site visível quando o usuário está ativo E (tem assinatura
-- ativa OU está isento de mensalidade).
drop function if exists public.get_public_tenant_by_slug(text);
create or replace function public.get_public_tenant_by_slug(p_slug text)
returns table (
  tenant_id uuid,
  slug text,
  site_name text,
  site_status public.site_status,
  settings jsonb,
  site_data jsonb,
  profile_name text,
  email text,
  monthly_billing_enabled boolean
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
    t.monthly_billing_enabled
  from public.tenants t
  left join public.site_settings s on s.tenant_id = t.id
  left join public.profiles p on p.user_id = t.user_id
  where t.slug = p_slug
    and t.site_status = 'active'
    and exists (
      select 1 from public.profiles pr
      where pr.user_id = t.user_id
        and pr.status = 'active'
    )
    and (
      not t.monthly_billing_enabled
      or exists (
        select 1 from public.subscriptions su
        where su.tenant_id = t.id
          and su.status = 'active'
      )
    );
$$;

drop function if exists public.get_public_tenant_by_domain(text);
create or replace function public.get_public_tenant_by_domain(p_domain text)
returns table (
  tenant_id uuid,
  slug text,
  site_name text,
  site_status public.site_status,
  settings jsonb,
  site_data jsonb,
  profile_name text,
  email text,
  monthly_billing_enabled boolean
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
    t.monthly_billing_enabled
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  left join public.site_settings s on s.tenant_id = t.id
  left join public.profiles p on p.user_id = t.user_id
  where lower(d.domain) = lower(p_domain)
    and d.status in ('verified', 'ssl_pending', 'active')
    and d.removed_at is null
    and t.site_status = 'active'
    and exists (
      select 1 from public.profiles pr
      where pr.user_id = t.user_id
        and pr.status = 'active'
    )
    and (
      not t.monthly_billing_enabled
      or exists (
        select 1 from public.subscriptions su
        where su.tenant_id = t.id
          and su.status = 'active'
      )
    );
$$;

grant execute on function public.get_public_tenant_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_tenant_by_domain(text) to anon, authenticated;