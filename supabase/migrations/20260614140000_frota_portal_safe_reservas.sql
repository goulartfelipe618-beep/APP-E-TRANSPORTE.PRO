-- Segurança LGPD: o mini painel do motorista da frota não pode ler linhas completas
-- de reservas nem gerar PDF de confirmação com dados pessoais do cliente.
-- O portal passa a consumir apenas esta RPC sanitizada.

drop policy if exists "reservas_transfer_select_as_motorista" on public.reservas_transfer;
drop policy if exists "reservas_grupos_select_as_motorista" on public.reservas_grupos;

create or replace function public.get_frota_motorista_reservas()
returns table (
  kind text,
  id uuid,
  numero_reserva integer,
  status text,
  motorista_id text,
  tipo_viagem text,
  ida_data text,
  ida_hora text,
  volta_data text,
  volta_hora text,
  por_hora_data text,
  por_hora_hora text,
  ida_embarque text,
  ida_desembarque text,
  volta_embarque text,
  volta_desembarque text,
  por_hora_endereco_inicio text,
  por_hora_ponto_encerramento text,
  data_ida text,
  hora_ida text,
  data_retorno text,
  hora_retorno text,
  embarque text,
  destino text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    'transfer'::text as kind,
    r.id,
    r.numero_reserva,
    r.status,
    nullif(trim(r.motorista_id), '') as motorista_id,
    r.tipo_viagem,
    r.ida_data::text,
    r.ida_hora::text,
    r.volta_data::text,
    r.volta_hora::text,
    r.por_hora_data::text,
    r.por_hora_hora::text,
    r.ida_embarque,
    r.ida_desembarque,
    r.volta_embarque,
    r.volta_desembarque,
    r.por_hora_endereco_inicio,
    r.por_hora_ponto_encerramento,
    null::text as data_ida,
    null::text as hora_ida,
    null::text as data_retorno,
    null::text as hora_retorno,
    null::text as embarque,
    null::text as destino
  from public.reservas_transfer r
  where r.motorista_id is not null
    and nullif(trim(r.motorista_id), '') = (select auth.uid())::text
    and exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = r.user_id
        and sm.status = 'cadastrado'
    )

  union all

  select
    'grupo'::text as kind,
    g.id,
    g.numero_reserva,
    g.status,
    g.motorista_id::text as motorista_id,
    null::text as tipo_viagem,
    null::text as ida_data,
    null::text as ida_hora,
    null::text as volta_data,
    null::text as volta_hora,
    null::text as por_hora_data,
    null::text as por_hora_hora,
    null::text as ida_embarque,
    null::text as ida_desembarque,
    null::text as volta_embarque,
    null::text as volta_desembarque,
    null::text as por_hora_endereco_inicio,
    null::text as por_hora_ponto_encerramento,
    g.data_ida::text,
    g.hora_ida::text,
    g.data_retorno::text,
    g.hora_retorno::text,
    g.embarque,
    g.destino
  from public.reservas_grupos g
  where g.motorista_id = (select auth.uid())
    and exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = g.user_id
        and sm.status = 'cadastrado'
    )
  order by numero_reserva desc;
$$;

comment on function public.get_frota_motorista_reservas() is
  'Retorna apenas dados operacionais de reservas atribuídas ao motorista da frota. Não expõe nome, telefone, email, CPF/CNPJ, valores, observações, passageiros ou contrato.';

revoke all on function public.get_frota_motorista_reservas() from public;
grant execute on function public.get_frota_motorista_reservas() to authenticated;
