-- =====================================================================
-- Métricas Dashboard — RPCs agregadoras (SECURITY DEFINER, filtradas por auth.uid())
-- =====================================================================
-- Todas as funções devolvem JSON e são executadas com privilégios de
-- definidor para conseguir agregar tabelas com RLS sem expor dados
-- de outros utilizadores: o filtro `user_id = auth.uid()` é aplicado
-- explicitamente em cada subconsulta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) metricas_kpis — KPIs principais com sparkline 30d e delta vs período anterior
-- ---------------------------------------------------------------------
create or replace function public.metricas_kpis(p_period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := current_date;
  v_period_start date;
  v_prev_start date;
  v_prev_end date;

  v_frota_total integer;
  v_frota_ativa integer;
  v_frota_manutencao integer;
  v_frota_inativa integer;

  v_viagens_hoje_total integer;
  v_viagens_hoje_concluidas integer;
  v_viagens_hoje_andamento integer;
  v_viagens_hoje_pendentes integer;

  v_receita_mes numeric;
  v_receita_dia numeric;
  v_receita_periodo numeric;
  v_receita_periodo_prev numeric;

  v_viagens_periodo integer;
  v_viagens_periodo_prev integer;

  v_ticket_medio numeric;
  v_utilizacao_pct numeric;

  v_spark_receita jsonb;
  v_spark_viagens jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  v_period_start := v_today - (p_period_days - 1);
  v_prev_end    := v_period_start - 1;
  v_prev_start  := v_prev_end - (p_period_days - 1);

  -- Frota
  select
    count(*),
    count(*) filter (where status = 'ativo'),
    count(*) filter (where status = 'manutencao'),
    count(*) filter (where status = 'inativo')
  into v_frota_total, v_frota_ativa, v_frota_manutencao, v_frota_inativa
  from public.veiculos_frota
  where user_id = v_uid;

  -- Viagens hoje (transfer + grupos, baseado na data principal)
  with viagens_hoje as (
    select status from public.reservas_transfer
      where user_id = v_uid and ida_data = v_today
    union all
    select status from public.reservas_grupos
      where user_id = v_uid and data_ida = v_today
  )
  select
    count(*),
    count(*) filter (where status in ('concluida', 'finalizado', 'concluído', 'concluida_paga')),
    count(*) filter (where status in ('em_andamento', 'em andamento', 'andamento', 'pausado', 'iniciada')),
    count(*) filter (where status in ('ativa', 'pendente', 'aguardando'))
  into v_viagens_hoje_total, v_viagens_hoje_concluidas, v_viagens_hoje_andamento, v_viagens_hoje_pendentes
  from viagens_hoje;

  -- Receita do mês corrente
  with mes as (
    select coalesce(valor_total, 0) as v from public.reservas_transfer
      where user_id = v_uid
        and ida_data >= date_trunc('month', v_today)::date
        and ida_data <= v_today
    union all
    select coalesce(valor_total, 0) from public.reservas_grupos
      where user_id = v_uid
        and data_ida >= date_trunc('month', v_today)::date
        and data_ida <= v_today
  )
  select coalesce(sum(v), 0) into v_receita_mes from mes;

  -- Receita do dia
  with dia as (
    select coalesce(valor_total, 0) as v from public.reservas_transfer
      where user_id = v_uid and ida_data = v_today
    union all
    select coalesce(valor_total, 0) from public.reservas_grupos
      where user_id = v_uid and data_ida = v_today
  )
  select coalesce(sum(v), 0) into v_receita_dia from dia;

  -- Receita e viagens no período (usado para delta)
  with periodo as (
    select coalesce(valor_total, 0) as v from public.reservas_transfer
      where user_id = v_uid
        and ida_data between v_period_start and v_today
    union all
    select coalesce(valor_total, 0) from public.reservas_grupos
      where user_id = v_uid
        and data_ida between v_period_start and v_today
  )
  select coalesce(sum(v), 0), coalesce(count(*), 0)
    into v_receita_periodo, v_viagens_periodo
  from periodo;

  -- Mesmo intervalo, período anterior
  with prev as (
    select coalesce(valor_total, 0) as v from public.reservas_transfer
      where user_id = v_uid
        and ida_data between v_prev_start and v_prev_end
    union all
    select coalesce(valor_total, 0) from public.reservas_grupos
      where user_id = v_uid
        and data_ida between v_prev_start and v_prev_end
  )
  select coalesce(sum(v), 0), coalesce(count(*), 0)
    into v_receita_periodo_prev, v_viagens_periodo_prev
  from prev;

  -- Ticket médio (período)
  v_ticket_medio := case when v_viagens_periodo > 0
    then v_receita_periodo / v_viagens_periodo
    else 0 end;

  -- Utilização da Frota (% no período): viagens / (frota * dias) * 100
  -- Se a frota for 0 ou não houver viagens, devolvemos 0.
  v_utilizacao_pct := case
    when v_frota_total > 0 and p_period_days > 0
      then round(((v_viagens_periodo)::numeric / (v_frota_total * p_period_days)::numeric) * 100, 1)
    else 0
  end;
  if v_utilizacao_pct > 100 then v_utilizacao_pct := 100; end if;

  -- Sparkline 30d: receita por dia (array de 30 elementos, sempre 30)
  with serie as (
    select gs.d::date as d
    from generate_series(v_today - 29, v_today, interval '1 day') gs(d)
  ),
  diaria as (
    select ida_data as d, sum(coalesce(valor_total, 0)) as v
      from public.reservas_transfer
      where user_id = v_uid and ida_data between v_today - 29 and v_today
      group by ida_data
    union all
    select data_ida, sum(coalesce(valor_total, 0))
      from public.reservas_grupos
      where user_id = v_uid and data_ida between v_today - 29 and v_today
      group by data_ida
  ),
  agrupada as (
    select d, sum(v) as v from diaria group by d
  ),
  joined as (
    select s.d, coalesce(a.v, 0) as v
    from serie s left join agrupada a on a.d = s.d
    order by s.d
  )
  select coalesce(jsonb_agg(jsonb_build_object('d', to_char(d,'YYYY-MM-DD'), 'v', v)), '[]'::jsonb)
    into v_spark_receita
  from joined;

  -- Sparkline 30d viagens (count por dia)
  with serie as (
    select gs.d::date as d
    from generate_series(v_today - 29, v_today, interval '1 day') gs(d)
  ),
  diaria as (
    select ida_data as d, count(*) as v
      from public.reservas_transfer
      where user_id = v_uid and ida_data between v_today - 29 and v_today
      group by ida_data
    union all
    select data_ida, count(*)
      from public.reservas_grupos
      where user_id = v_uid and data_ida between v_today - 29 and v_today
      group by data_ida
  ),
  agrupada as (
    select d, sum(v) as v from diaria group by d
  ),
  joined as (
    select s.d, coalesce(a.v, 0) as v
    from serie s left join agrupada a on a.d = s.d
    order by s.d
  )
  select coalesce(jsonb_agg(jsonb_build_object('d', to_char(d,'YYYY-MM-DD'), 'v', v)), '[]'::jsonb)
    into v_spark_viagens
  from joined;

  return jsonb_build_object(
    'period_days',          p_period_days,
    'period_start',         v_period_start,
    'period_end',           v_today,
    'frota_total',          v_frota_total,
    'frota_ativa',          v_frota_ativa,
    'frota_manutencao',     v_frota_manutencao,
    'frota_inativa',        v_frota_inativa,
    'viagens_hoje_total',   v_viagens_hoje_total,
    'viagens_hoje_concluidas', v_viagens_hoje_concluidas,
    'viagens_hoje_andamento',  v_viagens_hoje_andamento,
    'viagens_hoje_pendentes',  v_viagens_hoje_pendentes,
    'receita_mes',          v_receita_mes,
    'receita_dia',          v_receita_dia,
    'receita_periodo',      v_receita_periodo,
    'receita_periodo_prev', v_receita_periodo_prev,
    'viagens_periodo',      v_viagens_periodo,
    'viagens_periodo_prev', v_viagens_periodo_prev,
    'ticket_medio',         v_ticket_medio,
    'utilizacao_pct',       v_utilizacao_pct,
    'spark_receita',        v_spark_receita,
    'spark_viagens',        v_spark_viagens
  );
end;
$$;

revoke all on function public.metricas_kpis(integer) from public;
grant execute on function public.metricas_kpis(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2) metricas_evolucao_mensal — últimos 12 meses (receita + viagens + kilometragem aproximada)
-- ---------------------------------------------------------------------
create or replace function public.metricas_evolucao_mensal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  with serie as (
    select date_trunc('month', current_date - (n || ' months')::interval)::date as mes
    from generate_series(0, 11) n
  ),
  mensal as (
    select date_trunc('month', ida_data)::date as mes,
           sum(coalesce(valor_total, 0)) as receita,
           count(*)::integer as viagens
      from public.reservas_transfer
      where user_id = v_uid
        and ida_data >= (date_trunc('month', current_date) - interval '11 months')::date
      group by 1
    union all
    select date_trunc('month', data_ida)::date,
           sum(coalesce(valor_total, 0)),
           count(*)
      from public.reservas_grupos
      where user_id = v_uid
        and data_ida >= (date_trunc('month', current_date) - interval '11 months')::date
      group by 1
  ),
  agrupado as (
    select mes, sum(receita) as receita, sum(viagens)::integer as viagens
    from mensal group by mes
  ),
  joined as (
    select s.mes,
           coalesce(a.receita, 0) as receita,
           coalesce(a.viagens, 0) as viagens
    from serie s
    left join agrupado a on a.mes = s.mes
    order by s.mes
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'mes',  to_char(mes, 'YYYY-MM'),
           'label', to_char(mes, 'TMMon'),
           'receita', receita,
           'viagens', viagens
         )), '[]'::jsonb)
    into v_resultado
  from joined;

  return v_resultado;
end;
$$;

revoke all on function public.metricas_evolucao_mensal() from public;
grant execute on function public.metricas_evolucao_mensal() to authenticated;

-- ---------------------------------------------------------------------
-- 3) metricas_solicitacoes_por_canal — últimos 6 meses, agrupado por origem (canal)
--    Como o sistema atual não regista canal explícito, agrupamos por
--    TIPO de origem (transfer / grupos / motoristas / empty_legs) — o cliente
--    apresenta como barras empilhadas.
-- ---------------------------------------------------------------------
create or replace function public.metricas_solicitacoes_por_canal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  with serie as (
    select date_trunc('month', current_date - (n || ' months')::interval)::date as mes
    from generate_series(0, 5) n
  ),
  mensal as (
    select date_trunc('month', created_at)::date as mes,
           'Transfer'::text as canal,
           count(*)::integer as n
      from public.solicitacoes_transfer
      where user_id = v_uid
        and created_at >= (date_trunc('month', current_date) - interval '5 months')
      group by 1
    union all
    select date_trunc('month', created_at)::date,
           'Grupos'::text,
           count(*)::integer
      from public.solicitacoes_grupos
      where user_id = v_uid
        and created_at >= (date_trunc('month', current_date) - interval '5 months')
      group by 1
    union all
    select date_trunc('month', created_at)::date,
           'Motoristas'::text,
           count(*)::integer
      from public.solicitacoes_motoristas
      where user_id = v_uid
        and created_at >= (date_trunc('month', current_date) - interval '5 months')
      group by 1
    union all
    -- empty_lags não tem user_id (é global) — atribuímos ao período em todos os utilizadores
    select date_trunc('month', created_at)::date,
           'Empty Legs'::text,
           count(*)::integer
      from public.empty_lags
      where created_at >= (date_trunc('month', current_date) - interval '5 months')
      group by 1
  ),
  joined as (
    select s.mes,
           coalesce(sum(case when m.canal = 'Transfer'   then m.n end), 0)::integer as transfer,
           coalesce(sum(case when m.canal = 'Grupos'     then m.n end), 0)::integer as grupos,
           coalesce(sum(case when m.canal = 'Motoristas' then m.n end), 0)::integer as motoristas,
           coalesce(sum(case when m.canal = 'Empty Legs' then m.n end), 0)::integer as empty_legs
    from serie s
    left join mensal m on m.mes = s.mes
    group by s.mes
    order by s.mes
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'mes',        to_char(mes, 'YYYY-MM'),
           'label',      to_char(mes, 'TMMon'),
           'Transfer',   transfer,
           'Grupos',     grupos,
           'Motoristas', motoristas,
           'Empty Legs', empty_legs
         )), '[]'::jsonb)
    into v_resultado
  from joined;

  return v_resultado;
end;
$$;

revoke all on function public.metricas_solicitacoes_por_canal() from public;
grant execute on function public.metricas_solicitacoes_por_canal() to authenticated;

-- ---------------------------------------------------------------------
-- 4) metricas_top_destinos — Top N destinos (transfer + grupos) com viagens e receita
-- ---------------------------------------------------------------------
create or replace function public.metricas_top_destinos(p_limit integer default 5, p_period_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_resultado jsonb;
  v_period_start date := current_date - (p_period_days - 1);
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  with todos as (
    select nullif(trim(ida_desembarque), '') as destino,
           coalesce(valor_total, 0)        as v
      from public.reservas_transfer
      where user_id = v_uid and ida_data between v_period_start and current_date
    union all
    select nullif(trim(destino), ''),
           coalesce(valor_total, 0)
      from public.reservas_grupos
      where user_id = v_uid and data_ida between v_period_start and current_date
  ),
  agrupado as (
    select destino, count(*)::integer as viagens, sum(v) as receita
    from todos
    where destino is not null
    group by destino
    order by viagens desc, receita desc
    limit greatest(p_limit, 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'destino', destino,
           'viagens', viagens,
           'receita', receita
         )), '[]'::jsonb)
    into v_resultado
  from agrupado;

  return v_resultado;
end;
$$;

revoke all on function public.metricas_top_destinos(integer, integer) from public;
grant execute on function public.metricas_top_destinos(integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5) metricas_funil_conversao — Solicitação → Reserva → Concluída
-- ---------------------------------------------------------------------
create or replace function public.metricas_funil_conversao(p_period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_period_start date := current_date - (p_period_days - 1);
  v_solicitacoes integer;
  v_reservas integer;
  v_concluidas integer;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select
    (select count(*) from public.solicitacoes_transfer where user_id = v_uid and created_at::date between v_period_start and current_date) +
    (select count(*) from public.solicitacoes_grupos   where user_id = v_uid and created_at::date between v_period_start and current_date)
  into v_solicitacoes;

  select
    (select count(*) from public.reservas_transfer where user_id = v_uid and ida_data between v_period_start and current_date) +
    (select count(*) from public.reservas_grupos   where user_id = v_uid and data_ida between v_period_start and current_date)
  into v_reservas;

  select
    (select count(*) from public.reservas_transfer
        where user_id = v_uid
          and ida_data between v_period_start and current_date
          and status in ('concluida','finalizado','concluído')) +
    (select count(*) from public.reservas_grupos
        where user_id = v_uid
          and data_ida between v_period_start and current_date
          and status in ('concluida','finalizado','concluído'))
  into v_concluidas;

  return jsonb_build_array(
    jsonb_build_object('etapa', 'Solicitações',  'valor', v_solicitacoes),
    jsonb_build_object('etapa', 'Reservas',      'valor', v_reservas),
    jsonb_build_object('etapa', 'Concluídas',    'valor', v_concluidas)
  );
end;
$$;

revoke all on function public.metricas_funil_conversao(integer) from public;
grant execute on function public.metricas_funil_conversao(integer) to authenticated;
