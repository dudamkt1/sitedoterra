-- ============================================================================
-- 0057: Analytics da plataforma (primeira-parte, sem cookies de terceiros)
--
-- Mede SOMENTE a audiência do DOMÍNIO PRINCIPAL da plataforma
-- (site.topconsultores.com.br + o legado oleos.topconsultores.com.br):
-- HOME, /login, /checkout, /catalogo, /afiliados, /portfolio e páginas legais.
-- NÃO mede os sites dos usuários (/{slug} nem domínios próprios).
--
-- Por que é leve:
--   * A gravação acontece no middleware do Next, de forma assíncrona
--     (waitUntil) — ZERO JavaScript extra entregue ao visitante.
--   * Nenhum IP cru é guardado: só um hash anônimo DIÁRIO
--     (dia + IP + user-agent). Serve para contar visitantes únicos do dia
--     sem rastrear a mesma pessoa entre dias.
--   * Bots são descartados na gravação (não ocupam espaço).
--   * A leitura é feita por UMA função agregadora (admin_analytics_dashboard),
--     acessível apenas via service_role (super admin).
--
-- Idempotente: pode ser executado mais de uma vez sem efeito colateral.
--
-- COMO APLICAR: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================

create or replace function public.exec_migration_0057() returns text
  language plpgsql security definer set search_path = public as $func$
declare
  v_msg text := '0057 already applied';
begin
  -- ============================== Tabela ==============================
  create table if not exists public.platform_pageviews (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    day date not null,
    host text not null,
    path text not null,
    referrer text,
    source text not null default 'direto',
    device text not null default 'other',
    is_bot boolean not null default false,
    visitor_hash text not null
  );

  create index if not exists platform_pageviews_day_idx
    on public.platform_pageviews (day desc);
  create index if not exists platform_pageviews_day_visitor_idx
    on public.platform_pageviews (day, visitor_hash);
  create index if not exists platform_pageviews_path_idx
    on public.platform_pageviews (path);

  -- Sem policies: anon/authenticated NÃO leem nem escrevem direto. Só a
  -- função security definer (chamada pelo middleware) grava e só o
  -- service_role lê (admin).
  alter table public.platform_pageviews enable row level security;
  revoke all on public.platform_pageviews from anon, authenticated;

  -- ======================= Gravação de um acesso =======================
  create or replace function public.track_pageview(
    p_host text,
    p_path text,
    p_referrer text default null,
    p_source text default 'direto',
    p_device text default 'other',
    p_is_bot boolean default false,
    p_visitor text default null
  ) returns void
  language plpgsql security definer set search_path = public as $inner$
  declare
    v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 300);
    v_host text := left(lower(coalesce(p_host, '')), 200);
    v_ref  text := left(nullif(trim(coalesce(p_referrer, '')), ''), 500);
    v_src  text := left(coalesce(nullif(trim(p_source), ''), 'direto'), 120);
    v_dev  text := case when p_device in ('mobile', 'tablet', 'desktop', 'other') then p_device else 'other' end;
  begin
    -- Bots não entram na base (mantém a tabela pequena e as métricas limpas).
    if coalesce(p_is_bot, false) then
      return;
    end if;

    insert into public.platform_pageviews
      (day, host, path, referrer, source, device, is_bot, visitor_hash)
    values (
      (now() at time zone 'America/Sao_Paulo')::date,
      v_host,
      v_path,
      v_ref,
      v_src,
      v_dev,
      false,
      left(coalesce(p_visitor, ''), 64)
    );
  end;
  $inner$;

  revoke all on function public.track_pageview(text, text, text, text, text, boolean, text) from public;
  grant execute on function public.track_pageview(text, text, text, text, text, boolean, text) to anon, authenticated;

  -- ===================== Leitura agregada (admin) =====================
  create or replace function public.admin_analytics_dashboard(p_from date, p_to date)
  returns jsonb
  language plpgsql security definer set search_path = public as $dash$
  declare
    v_to date := coalesce(p_to, (now() at time zone 'America/Sao_Paulo')::date);
    v_from date := coalesce(p_from, v_to - 29);
    v_days int;
    v_prev_to date;
    v_prev_from date;
    v_result jsonb;
  begin
    if v_from > v_to then
      v_from := v_to;
    end if;
    v_days := (v_to - v_from) + 1;
    v_prev_to := v_from - 1;
    v_prev_from := v_prev_to - (v_days - 1);

    select jsonb_build_object(
      'generated_at', now(),
      'range', jsonb_build_object('from', v_from, 'to', v_to, 'days', v_days),
      'prev_range', jsonb_build_object('from', v_prev_from, 'to', v_prev_to),
      'totals', (
        select jsonb_build_object(
          'pageviews', count(*),
          'visitors', count(distinct visitor_hash),
          'per_visitor', case
            when count(distinct visitor_hash) = 0 then 0
            else round(count(*)::numeric / count(distinct visitor_hash), 2)
          end
        )
        from public.platform_pageviews
        where day between v_from and v_to and not is_bot
      ),
      'previous', (
        select jsonb_build_object(
          'pageviews', count(*),
          'visitors', count(distinct visitor_hash)
        )
        from public.platform_pageviews
        where day between v_prev_from and v_prev_to and not is_bot
      ),
      'series', (
        select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb)
        from (
          select g::date as day,
                 count(pv.id) as pageviews,
                 count(distinct pv.visitor_hash) as visitors
          from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') g
          left join public.platform_pageviews pv
            on pv.day = g::date and not pv.is_bot
          group by g
        ) x
      ),
      'hours', (
        select coalesce(jsonb_agg(row_to_json(h) order by h.hour), '[]'::jsonb)
        from (
          select extract(hour from (created_at at time zone 'America/Sao_Paulo'))::int as hour,
                 count(*) as pageviews,
                 count(distinct visitor_hash) as visitors
          from public.platform_pageviews
          where day between v_from and v_to and not is_bot
          group by 1
        ) h
      ),
      'top_pages', (
        select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb)
        from (
          select path, count(*) as pageviews, count(distinct visitor_hash) as visitors
          from public.platform_pageviews
          where day between v_from and v_to and not is_bot
          group by path
          order by pageviews desc
          limit 20
        ) p
      ),
      'sources', (
        select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
        from (
          select source, count(*) as pageviews, count(distinct visitor_hash) as visitors
          from public.platform_pageviews
          where day between v_from and v_to and not is_bot
          group by source
          order by pageviews desc
          limit 20
        ) s
      ),
      'devices', (
        select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb)
        from (
          select device, count(*) as pageviews, count(distinct visitor_hash) as visitors
          from public.platform_pageviews
          where day between v_from and v_to and not is_bot
          group by device
          order by pageviews desc
        ) d
      ),
      'hosts', (
        select coalesce(jsonb_agg(row_to_json(hh)), '[]'::jsonb)
        from (
          select host, count(*) as pageviews
          from public.platform_pageviews
          where day between v_from and v_to and not is_bot
          group by host
          order by pageviews desc
          limit 10
        ) hh
      )
    ) into v_result;

    return v_result;
  end;
  $dash$;

  -- Só o service_role (admin) executa a leitura agregada.
  revoke all on function public.admin_analytics_dashboard(date, date) from public;
  grant execute on function public.admin_analytics_dashboard(date, date) to service_role;

  -- ==================== Limpeza opcional (retenção) ====================
  create or replace function public.prune_platform_pageviews(p_keep_days int default 400)
  returns integer
  language plpgsql security definer set search_path = public as $prune$
  declare
    v_deleted int;
  begin
    delete from public.platform_pageviews
    where day < ((now() at time zone 'America/Sao_Paulo')::date - greatest(p_keep_days, 30));
    get diagnostics v_deleted = row_count;
    return v_deleted;
  end;
  $prune$;

  revoke all on function public.prune_platform_pageviews(int) from public;
  grant execute on function public.prune_platform_pageviews(int) to service_role;

  -- Recarrega o cache de schema do PostgREST para as novas RPCs ficarem
  -- disponíveis imediatamente.
  perform pg_notify('pgrst', 'reload schema');

  v_msg := '0057 applied';
  return v_msg;
end;
$func$;

-- Aplica de fato (idempotente).
select public.exec_migration_0057();
