-- Remove Disparador / Empty Legs / Mentoria.
-- Não toca em reservas, clientes, motoristas, veículos nem restantes cadastros do utilizador.

CREATE OR REPLACE FUNCTION public.metricas_solicitacoes_por_canal()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  ),
  joined as (
    select s.mes,
           coalesce(sum(case when m.canal = 'Transfer'   then m.n end), 0)::integer as transfer,
           coalesce(sum(case when m.canal = 'Grupos'     then m.n end), 0)::integer as grupos,
           coalesce(sum(case when m.canal = 'Motoristas' then m.n end), 0)::integer as motoristas
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
           'Motoristas', motoristas
         )), '[]'::jsonb)
    into v_resultado
  from joined;

  return v_resultado;
end;
$function$;

DROP FUNCTION IF EXISTS public.get_my_mentoria_progress();

DROP TABLE IF EXISTS public.mentoria_progresso CASCADE;
DROP TABLE IF EXISTS public.mentoria_cards CASCADE;
DROP TABLE IF EXISTS public.empty_lags CASCADE;

ALTER TABLE public.plataforma_ferramentas_disponibilidade
  DROP COLUMN IF EXISTS disparador_consumo_liberado;

DELETE FROM public.slides
WHERE pagina IN ('disparador', 'mentoria', 'empty_legs', 'empty-legs');

UPDATE public.admin_avisos_plataforma
SET paginas_motorista = COALESCE((
  SELECT array_agg(x)
  FROM unnest(paginas_motorista) AS x
  WHERE x NOT IN ('disparador', 'empty-legs', 'mentoria', 'empty_legs')
), ARRAY[]::text[])
WHERE paginas_motorista && ARRAY['disparador', 'empty-legs', 'mentoria', 'empty_legs']::text[];

UPDATE public.admin_fullscreen_banners
SET paginas_motorista = COALESCE((
  SELECT array_agg(x)
  FROM unnest(paginas_motorista) AS x
  WHERE x NOT IN ('disparador', 'empty-legs', 'mentoria', 'empty_legs')
), ARRAY[]::text[])
WHERE paginas_motorista && ARRAY['disparador', 'empty-legs', 'mentoria', 'empty_legs']::text[];
