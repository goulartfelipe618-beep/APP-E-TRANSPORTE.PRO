-- Ao encerrar: preservar apenas coordenadas de início e fim do trajeto na linha principal.
-- Distância/tempo continuam calculados a partir de todos os pontos antes da limpeza.
-- Pontos intermediários em rastreios_ao_vivo_pontos são removidos como antes.

alter table public.rastreios_ao_vivo
  add column if not exists inicio_latitude   double precision,
  add column if not exists inicio_longitude  double precision,
  add column if not exists fim_latitude      double precision,
  add column if not exists fim_longitude     double precision;

comment on column public.rastreios_ao_vivo.inicio_latitude  is 'Latitude GPS do primeiro ponto da viagem (snapshot ao encerrar).';
comment on column public.rastreios_ao_vivo.inicio_longitude is 'Longitude GPS do primeiro ponto da viagem.';
comment on column public.rastreios_ao_vivo.fim_latitude      is 'Latitude GPS do último ponto da viagem.';
comment on column public.rastreios_ao_vivo.fim_longitude      is 'Longitude GPS do último ponto da viagem.';

create or replace function public.rastreios_antes_encerrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distancia numeric(10,3);
  v_lat_ini double precision;
  v_lon_ini double precision;
  v_lat_fim double precision;
  v_lon_fim double precision;
begin
  if new.status = 'concluida' and (old.status is distinct from 'concluida') then

    select p.latitude, p.longitude into v_lat_ini, v_lon_ini
      from public.rastreios_ao_vivo_pontos p
     where p.rastreio_id = new.id
     order by p.registrado_em asc nulls last
     limit 1;

    select p.latitude, p.longitude into v_lat_fim, v_lon_fim
      from public.rastreios_ao_vivo_pontos p
     where p.rastreio_id = new.id
     order by p.registrado_em desc nulls last
     limit 1;

    -- Sem breadcrumbs: usar última posição conhecida na linha principal (uma única localização).
    if v_lat_ini is null and v_lon_ini is null and old.latitude is not null and old.longitude is not null then
      v_lat_ini := old.latitude;
      v_lon_ini := old.longitude;
    end if;

    if v_lat_fim is null and v_lon_fim is null and old.latitude is not null and old.longitude is not null then
      v_lat_fim := old.latitude;
      v_lon_fim := old.longitude;
    end if;

    new.inicio_latitude := v_lat_ini;
    new.inicio_longitude := v_lon_ini;
    new.fim_latitude := v_lat_fim;
    new.fim_longitude := v_lon_fim;

    -- Distância percorrida (soma dos segmentos), calculada antes do AFTER trigger apagar pontos.
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

    new.data_hora_fim    := coalesce(new.data_hora_fim, now());
    new.finalizado_em    := coalesce(new.finalizado_em, new.data_hora_fim);
    new.duracao_segundos := coalesce(
      new.duracao_segundos,
      greatest(0, extract(epoch from (new.data_hora_fim - new.iniciado_em))::integer)
    );

    new.latitude    := null;
    new.longitude   := null;
    new.heading     := null;
    new.speed_kmh   := null;
    new.accuracy_m  := null;
  end if;

  return new;
end;
$$;

comment on function public.rastreios_antes_encerrar() is
  'Ao passar a concluida: calcula distância/duração, grava início/fim GPS, limpa posição ao vivo na linha.';
