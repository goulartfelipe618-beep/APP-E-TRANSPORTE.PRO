-- =========================================================================
-- Rastreios ao Vivo — Lock por dispositivo e RPCs anónimas de transmissão
-- =========================================================================
--
-- Nova arquitectura do fluxo de rastreio:
--   1. Dono do SaaS cria o link (INSERT em rastreios_ao_vivo) → partilha URL
--      pública /rastreio/:token com o cliente (via WhatsApp/e-mail).
--   2. Cliente ABRE o link: NÃO inicia GPS automaticamente. Vê um botão
--      "Iniciar viagem".
--   3. Cliente clica "Iniciar viagem" e autoriza geolocalização no browser.
--      O device gera um device_secret aleatório (256 bits, guardado em
--      localStorage) e chama iniciar_rastreio_publico(token, device_secret).
--   4. Se o rastreio ainda não foi iniciado, o DB grava o secret e marca
--      iniciado_em_dispositivo = now(). Agora o LINK ESTÁ BLOQUEADO a este
--      device — qualquer outro browser que tente iniciar recebe erro.
--   5. O mesmo device continua a chamar enviar_posicao_publico(token, secret,
--      lat, lng, ...) a cada 7s, actualizando a posição.
--   6. O dono do SaaS (autenticado) vê a posição em tempo real via
--      "Acompanhar" (SELECT authorizado por RLS) — SEM activar o próprio GPS.
--
-- Segurança:
--   * Os dois RPCs novos são SECURITY DEFINER e só actualizam se o
--     device_secret corresponder ao guardado no DB.
--   * O secret nunca aparece em GET — só em POST (parâmetro de função).
--   * anon + authenticated podem executar — a legitimidade é comprovada
--     apenas pelo par (token, device_secret).
--   * expira_em continua a ser respeitado.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Colunas novas em rastreios_ao_vivo
-- -------------------------------------------------------------------------
alter table public.rastreios_ao_vivo
  add column if not exists iniciado_em_dispositivo timestamptz,
  add column if not exists iniciado_device_secret  text,
  add column if not exists iniciado_user_agent     text;

comment on column public.rastreios_ao_vivo.iniciado_em_dispositivo is
  'Timestamp em que o cliente clicou "Iniciar viagem" no link público. NULL = ainda não iniciado.';
comment on column public.rastreios_ao_vivo.iniciado_device_secret is
  'Segredo aleatório de 256 bits (hex) que autentica o device a enviar posições. Só o device que iniciou a viagem possui este valor.';
comment on column public.rastreios_ao_vivo.iniciado_user_agent is
  'User-Agent do browser que iniciou a viagem (diagnóstico).';

-- -------------------------------------------------------------------------
-- 2) Extender get_rastreio_publico para incluir iniciado_em_dispositivo
--    (o front usa para decidir se mostra o botão "Iniciar viagem").
-- -------------------------------------------------------------------------
drop function if exists public.get_rastreio_publico(text);

create or replace function public.get_rastreio_publico(p_token text)
returns table (
  id                      uuid,
  status                  text,
  motorista_nome          text,
  veiculo_descricao       text,
  cliente_nome            text,
  categoria_rastreamento  text,
  latitude                double precision,
  longitude               double precision,
  heading                 double precision,
  speed_kmh               double precision,
  ultima_atualizacao      timestamptz,
  iniciado_em             timestamptz,
  iniciado_em_dispositivo timestamptz,
  finalizado_em           timestamptz,
  expira_em               timestamptz,
  origem_endereco         text,
  destino_endereco        text,
  distancia_total_km      numeric,
  duracao_segundos        integer,
  data_hora_fim           timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.status, r.motorista_nome, r.veiculo_descricao,
         r.cliente_nome, r.categoria_rastreamento,
         r.latitude, r.longitude, r.heading, r.speed_kmh,
         r.ultima_atualizacao, r.iniciado_em, r.iniciado_em_dispositivo,
         r.finalizado_em, r.expira_em,
         r.origem_endereco, r.destino_endereco, r.distancia_total_km,
         r.duracao_segundos, r.data_hora_fim
    from public.rastreios_ao_vivo r
   where r.token = p_token
     and (r.expira_em is null or r.expira_em > now());
$$;

revoke all on function public.get_rastreio_publico(text) from public;
grant execute on function public.get_rastreio_publico(text) to anon, authenticated;

comment on function public.get_rastreio_publico(text) is
  'Leitura pública (por token) de um rastreio ao vivo — usado no link partilhado ao cliente. Não expõe device_secret nem user_id.';

-- -------------------------------------------------------------------------
-- 3) RPC iniciar_rastreio_publico — chamada pelo cliente anónimo quando
--    clica em "Iniciar viagem". Faz o lock do rastreio a este device.
-- -------------------------------------------------------------------------
create or replace function public.iniciar_rastreio_publico(
  p_token         text,
  p_device_secret text,
  p_user_agent    text default null
)
returns table (
  rastreio_id             uuid,
  status                  text,
  motorista_nome          text,
  veiculo_descricao       text,
  cliente_nome            text,
  categoria_rastreamento  text,
  iniciado_em_dispositivo timestamptz,
  ja_iniciado_neste_device boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rastreios_ao_vivo%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'RASTREIO_TOKEN_INVALIDO' using errcode = 'P0001';
  end if;

  if p_device_secret is null or length(p_device_secret) < 32 then
    raise exception 'DEVICE_SECRET_INVALIDO' using errcode = 'P0005';
  end if;

  select * into v_row
    from public.rastreios_ao_vivo r
   where r.token = p_token
     and (r.expira_em is null or r.expira_em > now())
   for update;

  if not found then
    raise exception 'RASTREIO_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if v_row.status not in ('ativo', 'pausado') then
    raise exception 'RASTREIO_NAO_ATIVO' using errcode = 'P0002';
  end if;

  -- Nunca iniciado antes → aceita este device e faz o lock
  if v_row.iniciado_device_secret is null then
    update public.rastreios_ao_vivo
       set iniciado_em_dispositivo = now(),
           iniciado_device_secret  = p_device_secret,
           iniciado_user_agent     = p_user_agent
     where id = v_row.id
    returning * into v_row;

    return query
      select v_row.id, v_row.status, v_row.motorista_nome, v_row.veiculo_descricao,
             v_row.cliente_nome, v_row.categoria_rastreamento,
             v_row.iniciado_em_dispositivo, false;
    return;
  end if;

  -- Mesmo device a re-abrir (mesmo secret no localStorage) → deixa passar
  if v_row.iniciado_device_secret = p_device_secret then
    return query
      select v_row.id, v_row.status, v_row.motorista_nome, v_row.veiculo_descricao,
             v_row.cliente_nome, v_row.categoria_rastreamento,
             v_row.iniciado_em_dispositivo, true;
    return;
  end if;

  -- Outro device a tentar iniciar → bloqueado
  raise exception 'RASTREIO_JA_INICIADO_NOUTRO_DEVICE' using errcode = 'P0003';
end;
$$;

revoke all on function public.iniciar_rastreio_publico(text, text, text) from public;
grant execute on function public.iniciar_rastreio_publico(text, text, text) to anon, authenticated;

comment on function public.iniciar_rastreio_publico(text, text, text) is
  'Anon-callable. Bloqueia o rastreio ao primeiro device que clicar "Iniciar viagem" no link público. Outros devices recebem erro P0003.';

-- -------------------------------------------------------------------------
-- 4) RPC enviar_posicao_publico — chamada pelo device do cliente a cada 7s.
--    Só aceita se (token, device_secret) bate certo com o DB.
-- -------------------------------------------------------------------------
create or replace function public.enviar_posicao_publico(
  p_token             text,
  p_device_secret     text,
  p_lat               double precision,
  p_lng               double precision,
  p_heading           double precision default null,
  p_speed_kmh         double precision default null,
  p_accuracy          double precision default null,
  p_gravar_breadcrumb boolean          default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_secret    text;
  v_status    text;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'RASTREIO_TOKEN_INVALIDO' using errcode = 'P0001';
  end if;

  if p_device_secret is null or length(p_device_secret) < 32 then
    raise exception 'DEVICE_SECRET_INVALIDO' using errcode = 'P0005';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90  or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'COORD_INVALIDA' using errcode = 'P0006';
  end if;

  select r.id, r.iniciado_device_secret, r.status
    into v_id, v_secret, v_status
    from public.rastreios_ao_vivo r
   where r.token = p_token
     and (r.expira_em is null or r.expira_em > now());

  if v_id is null then
    raise exception 'RASTREIO_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if v_status not in ('ativo', 'pausado') then
    raise exception 'RASTREIO_NAO_ATIVO' using errcode = 'P0002';
  end if;

  if v_secret is null then
    raise exception 'RASTREIO_NAO_INICIADO' using errcode = 'P0007';
  end if;

  if v_secret <> p_device_secret then
    raise exception 'DEVICE_NAO_AUTORIZADO' using errcode = 'P0004';
  end if;

  update public.rastreios_ao_vivo
     set latitude  = p_lat,
         longitude = p_lng,
         heading   = p_heading,
         speed_kmh = p_speed_kmh,
         accuracy_m = p_accuracy
   where id = v_id;

  if p_gravar_breadcrumb then
    insert into public.rastreios_ao_vivo_pontos
      (rastreio_id, latitude, longitude, heading, speed_kmh, accuracy_m)
    values
      (v_id, p_lat, p_lng, p_heading, p_speed_kmh, p_accuracy);
  end if;
end;
$$;

revoke all on function public.enviar_posicao_publico(
  text, text, double precision, double precision,
  double precision, double precision, double precision, boolean
) from public;
grant execute on function public.enviar_posicao_publico(
  text, text, double precision, double precision,
  double precision, double precision, double precision, boolean
) to anon, authenticated;

comment on function public.enviar_posicao_publico(
  text, text, double precision, double precision,
  double precision, double precision, double precision, boolean
) is
  'Anon-callable. Só actualiza posição se (token, device_secret) corresponder ao device que iniciou a viagem. Usado pelo browser do cliente a cada 7 segundos.';
