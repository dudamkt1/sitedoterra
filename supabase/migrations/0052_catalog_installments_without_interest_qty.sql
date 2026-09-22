-- ============================================================================
-- CATALOG PAYMENT: "Parcelas sem juros até" como QUANTIDADE (1-12)
-- Antes era boolean (não permitia escolher a quantidade no select).
-- Converte: true -> mp_installments, false -> 1.
-- ============================================================================

-- Remove default boolean para permitir a conversão de tipo
alter table public.catalog_payment_settings
  alter column mp_installments_without_interest drop default;

-- Converte boolean -> int preservando a intenção anterior
alter table public.catalog_payment_settings
  alter column mp_installments_without_interest type int
  using (
    case
      when mp_installments_without_interest is true then greatest(1, least(12, mp_installments))
      else 1
    end
  );

-- Novo default + constraint 1..12
alter table public.catalog_payment_settings
  alter column mp_installments_without_interest set default 1;

alter table public.catalog_payment_settings
  alter column mp_installments_without_interest set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_payment_settings_without_interest_chk'
  ) then
    alter table public.catalog_payment_settings
      add constraint catalog_payment_settings_without_interest_chk
      check (mp_installments_without_interest >= 1 and mp_installments_without_interest <= 12);
  end if;
end
$$;
