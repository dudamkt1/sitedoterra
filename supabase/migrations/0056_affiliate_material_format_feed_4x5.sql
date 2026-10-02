-- ============================================================================
-- 0056: FORMATO "FEED 4:5 (1080x1350)" PARA MATERIAIS DE IMAGEM
-- ----------------------------------------------------------------------------
-- /admin/afiliados → "Materiais para Afiliados": além de Feed 1:1 (1080x1080)
-- e Stories 9:16 (1080x1920), o Tipo "Imagem" passa a aceitar também
-- Feed 4:5 (1080x1350) — proporção vertical usada no feed do Instagram.
-- Vídeos continuam restritos a 1:1 e 9:16.
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================================

do $$
begin
  if to_regclass('public.affiliate_materials') is null then
    raise notice 'Tabela public.affiliate_materials nao existe (rode a 0054 antes). Pulando.';
    return;
  end if;

  alter table public.affiliate_materials
    drop constraint if exists affiliate_materials_format_check;

  alter table public.affiliate_materials
    add constraint affiliate_materials_format_check
    check (
      format in ('feed_1x1', 'feed_4x5', 'story_9x16')
      and not (format = 'feed_4x5' and kind = 'video')
    );
end $$;
