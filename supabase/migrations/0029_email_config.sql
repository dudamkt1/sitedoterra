-- 0029: Configuração de e-mail transacional (SMTP) - Super Admin
-- Singleton (id=1). Armazena credenciais criptografadas e templates de e-mail.
-- Usado para recuperação de senha e demais e-mails do site (remetente personalizado).
create table if not exists public.email_config (
  id int primary key default 1 check (id = 1),
  smtp_host text,
  smtp_port int,
  smtp_secure boolean not null default false,
  smtp_user text,
  smtp_pass_enc text,
  smtp_from_email text,
  smtp_from_name text,
  smtp_reply_to text,
  smtp_logo_url text,
  smtp_subject text,
  smtp_body_html text,
  updated_at timestamptz not null default now()
);

alter table public.email_config enable row level security;

insert into public.email_config (id) values (1) on conflict (id) do nothing;

-- trigger updated_at
drop trigger if exists email_config_touch on public.email_config;
create trigger email_config_touch before update on public.email_config
  for each row execute procedure public.touch_updated_at();
