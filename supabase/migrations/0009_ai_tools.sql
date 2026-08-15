-- ============================================================================
-- FERRAMENTAS DE IA GRATUITAS (multi-tenant)
-- ----------------------------------------------------------------------------
-- * ai_providers -> provedores de IA (Super Admin controla quais aparecem)
-- * ai_settings  -> configuração de IA por usuário (API key criptografada)
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

-- ============================ AI PROVIDERS ============================
create table if not exists public.ai_providers (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  enabled boolean not null default true,
  requires_api_key boolean not null default true,
  free_tier text,
  limits text,
  docs_url text,
  base_url text,
  model text,
  instructions text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================ AI SETTINGS (por usuário) ============================
create table if not exists public.ai_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  provider_id uuid references public.ai_providers(id) on delete set null,
  api_key_enc text,
  updated_at timestamptz not null default now()
);

-- ============================ TRIGGERS (updated_at) ============================
drop trigger if exists ai_providers_touch on public.ai_providers;
create trigger ai_providers_touch before update on public.ai_providers
  for each row execute procedure public.touch_updated_at();
drop trigger if exists ai_settings_touch on public.ai_settings;
create trigger ai_settings_touch before update on public.ai_settings
  for each row execute procedure public.touch_updated_at();

-- ============================ RLS ============================
alter table public.ai_providers enable row level security;
alter table public.ai_settings enable row level security;

-- ai_providers: leitura pública (info/guia), gestão só Super Admin
drop policy if exists ai_providers_select_all on public.ai_providers;
create policy ai_providers_select_all on public.ai_providers
  for select using (true);
drop policy if exists ai_providers_insert_admin on public.ai_providers;
create policy ai_providers_insert_admin on public.ai_providers
  for insert with check (public.is_superadmin());
drop policy if exists ai_providers_update_admin on public.ai_providers;
create policy ai_providers_update_admin on public.ai_providers
  for update using (public.is_superadmin());
drop policy if exists ai_providers_delete_admin on public.ai_providers;
create policy ai_providers_delete_admin on public.ai_providers
  for delete using (public.is_superadmin());

-- ai_settings: somente o próprio usuário (ou Super Admin)
drop policy if exists ai_settings_select_own on public.ai_settings;
create policy ai_settings_select_own on public.ai_settings
  for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists ai_settings_insert_own on public.ai_settings;
create policy ai_settings_insert_own on public.ai_settings
  for insert with check (user_id = auth.uid());
drop policy if exists ai_settings_update_own on public.ai_settings;
create policy ai_settings_update_own on public.ai_settings
  for update using (user_id = auth.uid());

-- ============================ SEED: PROVEDORES ============================
insert into public.ai_providers (code, name, enabled, requires_api_key, free_tier, limits, docs_url, base_url, model, instructions, sort_order)
values
  (
    'google-gemini', 'Google Gemini', true, true,
    'Plano gratuito (Free Tier) com cota generosa por dia.',
    'O plano gratuito do Gemini tem limite de requisições por dia (RPm/TPM). Para uso contínuo e intenso, verifique o plano pago (Pay-as-you-go). Não é necessário cartão para começar.',
    'https://aistudio.google.com/app/apikey',
    'https://generativelanguage.googleapis.com',
    'gemini-2.5-flash',
    'Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional. Sempre entregue o texto solicitado pronto para uso.',
    10
  ),
  (
    'groq', 'Groq (Llama 3)', true, true,
    'Plano gratuito com créditos diários e latência muito baixa.',
    'O free tier da Groq tem limites de tokens e requisições por minuto. Pode exigir cartão para criar a conta. Os modelos gratuitos mais usados são llama-3.1-8b e llama-3.3-70b.',
    'https://console.groq.com/keys',
    'https://api.groq.com/openai/v1',
    'llama-3.3-70b-versatile',
    'Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional.',
    20
  ),
  (
    'openrouter', 'OpenRouter', true, true,
    'Oferece modelos gratuitos (free) sem custo, dentro dos limites do provedor.',
    'Modelos marcados como :free são gratuitos. Modelos pagos cobram por token. Requer cadastro e pode pedir crédito mínimo. Nunca afirme que é 100% gratuito sem limites.',
    'https://openrouter.ai/keys',
    'https://openrouter.ai/api/v1',
    'meta-llama/llama-3.1-8b-instruct:free',
    'Você é um assistente de conteúdo para sites de consultoras de bem-estar. Responda em português do Brasil, com tom elegante e profissional.',
    30
  )
on conflict (code) do nothing;
