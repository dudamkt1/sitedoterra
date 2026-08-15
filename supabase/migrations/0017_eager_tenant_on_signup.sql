-- ============================================================================
-- TENANT IMEDIATO NO CADASTRO (novo usuário já nasce com site)
-- ----------------------------------------------------------------------------
-- Antes, o tenant só era criado de forma preguiçosa (ensureTenantForUser) quando
-- o usuário abria o painel. Isso fazia novos cadastros ficarem "sem site" e sem
-- URL, confundindo quem preenche o painel e não vê o site no ar.
-- Agora, no trigger on_auth_user_created, criamos o tenant (slug temporário
-- "aguardando-..." e status 'pending') junto com o profile. Idempotente.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_slug text;
  v_tenant_id uuid;
begin
  insert into public.profiles (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (user_id) do nothing;

  -- Tenant na hora do cadastro (slug temporário único; usuário define depois)
  if not exists (select 1 from public.tenants t where t.user_id = new.id) then
    v_slug := 'aguardando-' || replace(new.id::text, '-', '');
    v_slug := left(v_slug, 30);
    insert into public.tenants (user_id, slug, site_name, site_status, settings)
    values (new.id, v_slug, null, 'pending', '{}'::jsonb)
    on conflict (slug) do nothing;
  end if;

  select id into v_tenant_id from public.tenants where user_id = new.id limit 1;
  if v_tenant_id is not null then
    insert into public.site_settings (tenant_id, data)
    values (v_tenant_id, '{}'::jsonb)
    on conflict (tenant_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant execute on function public.handle_new_user() to service_role;