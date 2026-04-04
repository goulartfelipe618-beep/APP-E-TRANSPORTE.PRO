-- Abrangência motorista: incluir reservas em que o usuário é o operador (user_id) e ainda não há motorista atribuído,
-- além das reservas com motorista_id = auth.uid().

create or replace function public.get_motorista_abrangencia_reservas()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'transfer', coalesce(
      (
        select json_agg(row_to_json(r))
        from public.reservas_transfer r
        where (
          trim(coalesce(r.motorista_id, '')) = auth.uid()::text
          or (
            r.user_id = auth.uid()
            and trim(coalesce(r.motorista_id, '')) = ''
          )
        )
      ),
      '[]'::json
    ),
    'grupos', coalesce(
      (
        select json_agg(row_to_json(g))
        from public.reservas_grupos g
        where (
          g.motorista_id = auth.uid()
          or (
            g.user_id = auth.uid()
            and g.motorista_id is null
          )
        )
      ),
      '[]'::json
    )
  );
$$;

comment on function public.get_motorista_abrangencia_reservas() is
  'Mapa Abrangência (motorista): reservas com motorista_id = usuário OU (user_id = usuário e sem motorista atribuído).';
