-- Encerramento de rastreio + hard cleanup dos pontos de GPS
--
-- Fluxo:
--   1) Frontend chama RPC public.encerrar_rastreio(id, origem, destino, valor).
--   2) RPC faz UPDATE do rastreio para status = 'concluida'.
--   3) BEFORE trigger calcula distância/duração a partir dos pontos e limpa lat/lng.
--   4) AFTER trigger apaga permanentemente os pontos (breadcrumbs).
--
-- Objetivo: manter apenas o resumo da viagem (origem, destino, distância, tempo,
-- valor, datas) e remover qualquer rastro de GPS após o encerramento.

-- -----------------------------------------------------------
-- 1) Colunas de resumo em rastreios_ao_vivo
-- -----------------------------------------------------------
alter table public.rastreios_ao_vivo
  add column if not exists origem_endereco    text,
  add column if not exists destino_endereco   text,
  add column if not exists valor_total        numeric(12,2),
  add column if not exists distancia_total_km numeric(10,3),
  add column if not exists duracao_segundos   integer,
  add column if not exists data_hora_fim      timestamptz;

comment on column public.rastreios_ao_vivo.origem_endereco    is 'Endereço/ponto de origem da viagem (resumo pós-encerramento).';
comment on column public.rastreios_ao_vivo.destino_endereco   is 'Endereço/ponto de destino da viagem (resumo pós-encerramento).';
comment on column public.rastreios_ao_vivo.valor_total        is 'Valor cobrado da viagem (resumo; opcional).';
comment on column public.rastreios_ao_vivo.distancia_total_km is 'Distância total percorrida, calculada via Haversine a partir dos pontos no encerramento.';
comment on column public.rastreios_ao_vivo.duracao_segundos   is 'Duração total da viagem em segundos (data_hora_fim - iniciado_em).';
comment on column public.rastreios_ao_vivo.data_hora_fim      is 'Data/hora do encerramento efetivo (status = concluida).';

-- -----------------------------------------------------------
-- 2) Haversine (km) — função imutável para reuso
-- -----------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371 * asin(
    sqrt(
      sin(radians((lat2 - lat1) / 2)) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2))
        * sin(radians((lon2 - lon1) / 2)) ^ 2
    )
  );
$$;

comment on function public.haversine_km(double precision, double precision, double precision, double precision)
  is 'Distância em km entre dois pontos geográficos (fórmula de Haversine, R=6371km).';

-- -----------------------------------------------------------
-- 3) BEFORE trigger: calcula resumo e zera posição ao concluir
-- -----------------------------------------------------------
create or replace function public.rastreios_antes_encerrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distancia numeric(10,3);
begin
  -- Só age na transição para 'concluida'.
  if new.status = 'concluida' and (old.status is distinct from 'concluida') then

    -- Distância (soma dos segmentos consecutivos via Haversine), se ainda não fornecida.
    if new.distancia_total_km is null then
      select coalesce(sum(public.haversine_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude)), 0)::numeric(10,3)
        into v_distancia
        from (
          select latitude, longitude,
                 row_number() over (order by registrado_em) as rn
            from public.rastreios_ao_vivo_pontos
           where rastreio_id = new.id
        ) p1
        join (
          select latitude, longitude,
                 row_number() over (order by registrado_em) as rn
            from public.rastreios_ao_vivo_pontos
           where rastreio_id = new.id
        ) p2 on p2.rn = p1.rn + 1;

      new.distancia_total_km := v_distancia;
    end if;

    -- Datas / duração — preenche só se o caller não forneceu.
    new.data_hora_fim    := coalesce(new.data_hora_fim, now());
    new.finalizado_em    := coalesce(new.finalizado_em, new.data_hora_fim);
    new.duracao_segundos := coalesce(
      new.duracao_segundos,
      greatest(0, extract(epoch from (new.data_hora_fim - new.iniciado_em))::integer)
    );

    -- Hard cleanup da posição ao vivo na linha principal (o Realtime deixa de transmitir GPS).
    new.latitude    := null;
    new.longitude   := null;
    new.heading     := null;
    new.speed_kmh   := null;
    new.accuracy_m  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rastreios_antes_encerrar on public.rastreios_ao_vivo;
create trigger trg_rastreios_antes_encerrar
  before update of status on public.rastreios_ao_vivo
  for each row
  execute function public.rastreios_antes_encerrar();

-- -----------------------------------------------------------
-- 4) AFTER trigger: apaga permanentemente os pontos (breadcrumbs)
-- -----------------------------------------------------------
create or replace function public.rastreios_apos_encerrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluida' and (old.status is distinct from 'concluida') then
    delete from public.rastreios_ao_vivo_pontos
     where rastreio_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_rastreios_apos_encerrar on public.rastreios_ao_vivo;
create trigger trg_rastreios_apos_encerrar
  after update of status on public.rastreios_ao_vivo
  for each row
  execute function public.rastreios_apos_encerrar();

-- -----------------------------------------------------------
-- 5) RPC pública para o frontend encerrar a viagem
--    Respeita RLS (security invoker): usa as policies existentes de UPDATE.
-- -----------------------------------------------------------
create or replace function public.encerrar_rastreio(
  p_rastreio_id     uuid,
  p_origem          text    default null,
  p_destino         text    default null,
  p_valor_total     numeric default null,
  p_distancia_km    numeric default null,
  p_duracao_segundos integer default null
)
returns public.rastreios_ao_vivo
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.rastreios_ao_vivo;
begin
  update public.rastreios_ao_vivo
     set status             = 'concluida',
         origem_endereco    = coalesce(p_origem, origem_endereco),
         destino_endereco   = coalesce(p_destino, destino_endereco),
         valor_total        = coalesce(p_valor_total, valor_total),
         distancia_total_km = coalesce(p_distancia_km, distancia_total_km),
         duracao_segundos   = coalesce(p_duracao_segundos, duracao_segundos)
   where id = p_rastreio_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Rastreio % não encontrado ou sem permissão.', p_rastreio_id
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.encerrar_rastreio(uuid, text, text, numeric, numeric, integer) from public;
grant execute on function public.encerrar_rastreio(uuid, text, text, numeric, numeric, integer) to authenticated;

comment on function public.encerrar_rastreio(uuid, text, text, numeric, numeric, integer) is
  'Encerra um rastreio (status=concluida), grava resumo da viagem e dispara limpeza automática dos pontos GPS.';
