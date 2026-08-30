-- ============================================================
-- 0032: Checklist de rotina pessoal do usuário (/painel/checklist)
-- Estrutura nova: tarefas recorrentes + conclusões por ocorrência.
-- Não reutiliza crm_tasks (que é por tenant/cliente) — escopo é o user_id.
-- Timezone: cada conclusão é indexada por occurrence_date (YYYY-MM-DD)
-- calculado no fuso do navegador do usuário. Datas armazenadas como DATE
-- para evitar confusões de fuso no banco.
-- Soft-delete: ao excluir tarefa recorrente, o histórico permanece
-- (conclusões antigas continuam linkadas) e a task some das listas.
-- ============================================================

create table if not exists public.user_checklist_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  category text not null default 'other' check (category in ('clients', 'sales', 'marketing', 'content', 'organization', 'studies', 'personal', 'other')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  time_of_day time,
  day_of_week int check (day_of_week is null or day_of_week between 0 and 6),  -- 0 = domingo
  day_of_month int check (day_of_month is null or day_of_month between 1 and 31),
  specific_date date,                                                            -- usado quando frequency='yearly' OU primeira ocorrência
  is_paused boolean not null default false,
  archived_at timestamptz,                                                       -- soft delete: preserva histórico
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_checklist_tasks_user_idx on public.user_checklist_tasks (user_id);
create index if not exists user_checklist_tasks_frequency_idx on public.user_checklist_tasks (frequency);
create index if not exists user_checklist_tasks_active_idx on public.user_checklist_tasks (user_id, is_paused, archived_at);

create or replace function public.user_checklist_tasks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_checklist_tasks_touch on public.user_checklist_tasks;
create trigger trg_user_checklist_tasks_touch
  before update on public.user_checklist_tasks
  for each row execute function public.user_checklist_tasks_touch();

-- ============================ CONCLUSÕES ============================
-- FK sem CASCADE: ao excluir a task via soft-delete, as conclusões
-- permanecem atreladas. O histórico (estatísticas/streak) continua válido.

create table if not exists public.user_checklist_completions (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.user_checklist_tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_title_snapshot text,                                                      -- preserva o nome se a task for excluída
  frequency_snapshot text,                                                        -- preserva a periodicidade no histórico
  occurrence_date date not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create index if not exists user_checklist_completions_user_idx on public.user_checklist_completions (user_id);
create index if not exists user_checklist_completions_task_idx on public.user_checklist_completions (task_id);
create index if not exists user_checklist_completions_date_idx on public.user_checklist_completions (occurrence_date desc);
create index if not exists user_checklist_completions_user_date_idx on public.user_checklist_completions (user_id, occurrence_date desc);

-- ============================ RLS ============================

alter table public.user_checklist_tasks enable row level security;
alter table public.user_checklist_completions enable row level security;

-- Tarefas: usuário só enxerga/edita as próprias
drop policy if exists uct_select_own on public.user_checklist_tasks;
create policy uct_select_own on public.user_checklist_tasks
  for select using (user_id = auth.uid());

drop policy if exists uct_insert_own on public.user_checklist_tasks;
create policy uct_insert_own on public.user_checklist_tasks
  for insert with check (user_id = auth.uid());

drop policy if exists uct_update_own on public.user_checklist_tasks;
create policy uct_update_own on public.user_checklist_tasks
  for update using (user_id = auth.uid())
            with check (user_id = auth.uid());

drop policy if exists uct_delete_own on public.user_checklist_tasks;
create policy uct_delete_own on public.user_checklist_tasks
  for delete using (user_id = auth.uid());

-- Conclusões: usuário só enxerga/insere/edita as próprias
drop policy if exists ucc_select_own on public.user_checklist_completions;
create policy ucc_select_own on public.user_checklist_completions
  for select using (user_id = auth.uid());

drop policy if exists ucc_insert_own on public.user_checklist_completions;
create policy ucc_insert_own on public.user_checklist_completions
  for insert with check (user_id = auth.uid());

drop policy if exists ucc_update_own on public.user_checklist_completions;
create policy ucc_update_own on public.user_checklist_completions
  for update using (user_id = auth.uid())
            with check (user_id = auth.uid());

drop policy if exists ucc_delete_own on public.user_checklist_completions;
create policy ucc_delete_own on public.user_checklist_completions
  for delete using (user_id = auth.uid());

-- Grants mínimos
grant select, insert, update, delete on public.user_checklist_tasks to authenticated;
grant select, insert, update, delete on public.user_checklist_completions to authenticated;
