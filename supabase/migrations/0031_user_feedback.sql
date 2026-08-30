-- ============================================================
-- 0031: Sistema de feedback dos usuários
-- Tabela `user_feedback` (sugestões, dúvidas, críticas, problemas,
-- elogios, outros) — usuários criam; super admin gerencia.
-- Sem apagar fisicamente: status controla o ciclo de vida.
-- ============================================================

create table if not exists public.user_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  type text not null default 'suggestion' check (type in ('suggestion', 'question', 'criticism', 'problem', 'praise', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending', 'read', 'in_progress', 'resolved', 'archived')),
  source_page text,
  admin_notes text,
  read_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_feedback_user_idx on public.user_feedback (user_id);
create index if not exists user_feedback_status_idx on public.user_feedback (status);
create index if not exists user_feedback_type_idx on public.user_feedback (type);
create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);

-- updated_at automático em UPDATE
create or replace function public.user_feedback_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_feedback_touch on public.user_feedback;
create trigger trg_user_feedback_touch
  before update on public.user_feedback
  for each row execute function public.user_feedback_touch();

-- ============================ RLS ============================
alter table public.user_feedback enable row level security;

-- Usuário comum pode inserir o próprio feedback (user_id = auth.uid)
drop policy if exists user_feedback_insert_own on public.user_feedback;
create policy user_feedback_insert_own on public.user_feedback
  for insert with check (user_id = auth.uid());

-- Usuário comum pode consultar SOMENTE os próprios
drop policy if exists user_feedback_select_own on public.user_feedback;
create policy user_feedback_select_own on public.user_feedback
  for select using (user_id = auth.uid());

-- Super Admin (via JWT) pode ler e atualizar tudo
drop policy if exists user_feedback_select_admin on public.user_feedback;
create policy user_feedback_select_admin on public.user_feedback
  for select using (public.is_superadmin());

drop policy if exists user_feedback_update_admin on public.user_feedback;
create policy user_feedback_update_admin on public.user_feedback
  for update using (public.is_superadmin())
            with check (public.is_superadmin());

-- DELETE: só super admin (e mesmo assim evitamos — preferido usar status='archived')
drop policy if exists user_feedback_delete_admin on public.user_feedback;
create policy user_feedback_delete_admin on public.user_feedback
  for delete using (public.is_superadmin());

-- GRANTs mínimos
grant select, insert on public.user_feedback to authenticated;
grant select, update, delete on public.user_feedback to authenticated;
