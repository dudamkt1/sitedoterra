-- ============================================================================
-- Dados de recebimento dos afiliados (PIX / Mercado Pago)
-- ============================================================================
-- Esta migration cria a tabela `affiliate_payment_methods` que armazena,
-- por afiliado, o método padrão para receber comissões.
--
-- Princípios:
--   1) Apenas UMA linha por afiliado (UPSERT). Atualizar é idempotente.
--   2) RLS estrito: afiliado lê/edita SOMENTE seus próprios dados.
--      Super Admin lê tudo (via service_role) mas nunca via API pública.
--   3) Snapshot no momento do saque: ao solicitar um saque, o backend
--      COPIA os valores atuais de `affiliate_payment_methods` para
--      colunas snapshot em `affiliate_payouts`. Assim, mesmo que o
--      afiliado altere sua chave PIX depois, o histórico do saque
--      preserva os dados que estavam vigentes NA HORA do pedido —
--      fundamental para o Super Admin saber para onde pagar.
--   4) Tipos de chave PIX armazenados como enum: cpf_cnpj | email | phone | random.
-- ============================================================================

-- ============================ ENUM PIX KEY TYPE ============================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname = 'affiliate_pix_key_type' and typtype = 'e') then
    create type public.affiliate_pix_key_type as enum ('cpf_cnpj', 'email', 'phone', 'random');
  end if;
end $$;

-- ============================ TABELA ============================

create table if not exists public.affiliate_payment_methods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Método: 'pix' usa pix_key + pix_key_type; 'mercado_pago' usa mp_email.
  method public.affiliate_payout_method not null,
  pix_key_type public.affiliate_pix_key_type,
  pix_key text,
  mp_email text,
  updated_at timestamptz not null default now(),
  -- CHECKs de sanidade: garante consistência método <-> campos preenchidos.
  constraint affiliate_payment_methods_pix_consistency check (
    (method = 'pix' and pix_key is not null and length(trim(pix_key)) > 0 and pix_key_type is not null)
    or method <> 'pix'
  ),
  constraint affiliate_payment_methods_mp_consistency check (
    (method = 'mercado_pago' and mp_email is not null and length(trim(mp_email)) > 0)
    or method <> 'mercado_pago'
  )
);

create index if not exists affiliate_payment_methods_updated_idx on public.affiliate_payment_methods (updated_at desc);

-- Trigger touch_updated_at (caso a função pública touch_updated_at já exista)
drop trigger if exists affiliate_payment_methods_touch on public.affiliate_payment_methods;
do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_updated_at' and pronamespace = 'public'::regnamespace) then
    create trigger affiliate_payment_methods_touch before update on public.affiliate_payment_methods
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;

-- ============================ COLUNAS SNAPSHOT EM PAYOUTS ============================

-- Adiciona colunas de snapshot em affiliate_payouts. Estas colunas são
-- PREENCHIDAS no momento do INSERT do payout, copiando os valores de
-- affiliate_payment_methods. NUNCA são alteradas depois — o histórico
-- do saque preserva os dados de pagamento usados.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'affiliate_payouts' and column_name = 'pix_key_type_snapshot') then
    alter table public.affiliate_payouts add column pix_key_type_snapshot public.affiliate_pix_key_type;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'affiliate_payouts' and column_name = 'pix_key_snapshot') then
    alter table public.affiliate_payouts add column pix_key_snapshot text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'affiliate_payouts' and column_name = 'mp_email_snapshot') then
    alter table public.affiliate_payouts add column mp_email_snapshot text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'affiliate_payouts' and column_name = 'payment_method_label') then
    alter table public.affiliate_payouts add column payment_method_label text;
  end if;
end $$;

-- Mantém pix_key e mercado_pago_account_info como colunas legadas para
-- compatibilidade retroativa (registros antigos continuam visíveis).

-- ============================ RLS ============================

alter table public.affiliate_payment_methods enable row level security;

-- Afiliado lê SOMENTE o próprio registro.
drop policy if exists affiliate_payment_methods_select_own on public.affiliate_payment_methods;
create policy affiliate_payment_methods_select_own on public.affiliate_payment_methods
  for select using (user_id = auth.uid() or public.is_superadmin());

-- Afiliado insere SOMENTE o próprio registro.
drop policy if exists affiliate_payment_methods_insert_own on public.affiliate_payment_methods;
create policy affiliate_payment_methods_insert_own on public.affiliate_payment_methods
  for insert with check (user_id = auth.uid());

-- Afiliado atualiza SOMENTE o próprio registro (e o user_id não pode mudar).
drop policy if exists affiliate_payment_methods_update_own on public.affiliate_payment_methods;
create policy affiliate_payment_methods_update_own on public.affiliate_payment_methods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Afiliado deleta SOMENTE o próprio registro (raro, mas mantido para consistência).
drop policy if exists affiliate_payment_methods_delete_own on public.affiliate_payment_methods;
create policy affiliate_payment_methods_delete_own on public.affiliate_payment_methods
  for delete using (user_id = auth.uid());