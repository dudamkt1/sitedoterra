-- ============================================================================
-- Corrige RPCs públicas para respeitar monthly_billing_enabled
-- ============================================================================
-- A migration 0036 sobrescreveu a lógica da 0014 que permitia sites sem
-- assinatura ativa quando monthly_billing_enabled = false.
-- Esta migration restaura essa lógica mantendo o user_id no retorno.

-- Drop e recria get_public_tenant_by_slug
drop function if exists public.get_public_tenant_by_slug(text);
create function public.get_public_tenant_by_slug(p_slug text)
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

-- Drop e recria get_public_tenant_by_domain
drop function if exists public.get_public_tenant_by_domain(text);
create function public.get_public_tenant_by_domain(p_domain text)
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