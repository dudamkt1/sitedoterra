-- ============================================================================
-- Notificações para o usuário (crédito do Saldo em Conta, etc.)
-- ============================================================================
-- COMO APLICAR: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
-- e executar. Idempotente: pode ser re-executado sem erros.
--
-- CONTEXTO / REGRA DE NEGÓCIO
--   Quando o Super Admin adiciona/edita/exclui crédito do "Saldo em Conta" de
--   um usuário via /admin/usuários, uma notificação é criada para esse usuário.
--   Ela aparece como um badge vermelho em "Minha Conta" (/painel/conta) no
--   sidebar do cliente, para ele saber que houve uma atualização e conferir.
-- ============================================================================

create or replace function public.exec_migration_0061()
returns text
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_msg text;
begin
  -- ======================= TABELA DE NOTIFICAÇÕES =======================
  create table if not exists public.user_notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null default 'credit' check (kind in ('credit', 'system', 'payment')),
    title text not null,
    detail text not null default '',
    href text not null default '/painel/conta',
    read boolean not null default false,
    created_at timestamptz not null default now()
  );

  create index if not exists user_notifications_user_created_idx
    on public.user_notifications (user_id, created_at desc);
  create index if not exists user_notifications_user_unread_idx
    on public.user_notifications (user_id, read) where read = false;

  -- ============================== RLS ==============================
  alter table public.user_notifications enable row level security;

  drop policy if exists user_notifications_select_own on public.user_notifications;
  create policy user_notifications_select_own on public.user_notifications
    for select using (user_id = auth.uid());

  drop policy if exists user_notifications_update_own on public.user_notifications;
  create policy user_notifications_update_own on public.user_notifications
    for update using (user_id = auth.uid());

  drop policy if exists user_notifications_insert_admin on public.user_notifications;
  create policy user_notifications_insert_admin on public.user_notifications
    for insert with check (public.is_superadmin());

  -- Recarrega o cache de schema do PostgREST.
  perform pg_notify('pgrst', 'reload schema');

  v_msg := '0061 applied';
  return v_msg;
end;
$func$;

-- Aplica de fato (idempotente).
select public.exec_migration_0061();
