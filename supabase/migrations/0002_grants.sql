-- Grants das funções públicas (chamáveis por anon para resolução de tenant no edge middleware)
grant execute on function public.get_public_tenant_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_tenant_by_domain(text) to anon, authenticated;
grant execute on function public.is_slug_available(text, uuid) to anon, authenticated, service_role;
grant execute on function public.is_superadmin() to authenticated;
