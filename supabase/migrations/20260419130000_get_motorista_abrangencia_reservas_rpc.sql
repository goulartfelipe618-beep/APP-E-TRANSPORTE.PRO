-- Leitura das reservas atribuídas ao motorista sem depender de políticas RLS na tabela (evita mapa vazio quando só o operador tinha SELECT por user_id).

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
        where trim(r.motorista_id) = auth.uid()::text
      ),
      '[]'::json
    ),
    'grupos', coalesce(
      (
        select json_agg(row_to_json(g))
        from public.reservas_grupos g
        where g.motorista_id = auth.uid()
      ),
      '[]'::json
    )
  );
$$;

comment on function public.get_motorista_abrangencia_reservas() is
  'Mapa Abrangência (motorista): reservas Transfer/Grupos com motorista_id = usuário logado.';

revoke all on function public.get_motorista_abrangencia_reservas() from public;
grant execute on function public.get_motorista_abrangencia_reservas() to authenticated;
