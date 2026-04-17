-- Alinhamento do Geolocalizador com o fluxo "Criar link + Comunicar ao cliente":
--   1. Alinhar o CHECK de status (o código/RPC usa 'concluida', o CHECK original
--      aceitava só 'finalizado'). Mantemos 'finalizado' para histórico e
--      adicionamos 'concluida' como status oficial de encerramento.
--   2. Adicionar campos usados pelo painel Transfer → Geolocalização:
--        cliente_nome, cliente_telefone, observacoes,
--        categoria_rastreamento ('cliente' | 'motorista'),
--        comunicado_em (timestamp do último disparo de webhook para n8n).
--   3. Expor cliente_nome (não sensível — só o primeiro nome, tipicamente)
--      no RPC público `get_rastreio_publico`, para a página do cliente
--      personalizar a saudação sem exigir RLS público.

-- -----------------------------------------------------------
-- 1) CHECK status alinhado
-- -----------------------------------------------------------
alter table public.rastreios_ao_vivo
  drop constraint if exists rastreios_ao_vivo_status_check;

alter table public.rastreios_ao_vivo
  add constraint rastreios_ao_vivo_status_check
  check (status in ('ativo', 'pausado', 'finalizado', 'concluida'));

comment on constraint rastreios_ao_vivo_status_check on public.rastreios_ao_vivo is
  'Status permitidos: ativo (em andamento), pausado, finalizado (legado) ou concluida (encerrado pelo motorista via RPC).';

-- -----------------------------------------------------------
-- 2) Novas colunas para o fluxo de comunicação
-- -----------------------------------------------------------
alter table public.rastreios_ao_vivo
  add column if not exists cliente_nome           text,
  add column if not exists cliente_telefone       text,
  add column if not exists observacoes            text,
  add column if not exists categoria_rastreamento text
    check (categoria_rastreamento is null or categoria_rastreamento in ('cliente','motorista')),
  add column if not exists comunicado_em          timestamptz;

comment on column public.rastreios_ao_vivo.cliente_nome           is 'Nome opcional do cliente a ser saudado na página pública e no webhook.';
comment on column public.rastreios_ao_vivo.cliente_telefone       is 'Telefone (somente dígitos E.164 sem +) do cliente para o n8n enviar o link por WhatsApp.';
comment on column public.rastreios_ao_vivo.observacoes            is 'Observações livres para a central/n8n (não aparece ao cliente).';
comment on column public.rastreios_ao_vivo.categoria_rastreamento is 'Quem é rastreado: cliente (celular do passageiro) ou motorista (celular do condutor).';
comment on column public.rastreios_ao_vivo.comunicado_em          is 'Data/hora em que o link foi enviado ao cliente via webhook (n8n).';

-- -----------------------------------------------------------
-- 3) RPC pública — incluir cliente_nome + categoria no retorno
--    (telefone nunca é retornado — campo sensível).
-- Drop primeiro porque Postgres não permite mudar o row type
-- de uma função via CREATE OR REPLACE.
-- -----------------------------------------------------------
drop function if exists public.get_rastreio_publico(text);

create function public.get_rastreio_publico(p_token text)
returns table (
  id                  uuid,
  status              text,
  motorista_nome      text,
  veiculo_descricao   text,
  cliente_nome        text,
  categoria_rastreamento text,
  latitude            double precision,
  longitude           double precision,
  heading             double precision,
  speed_kmh           double precision,
  ultima_atualizacao  timestamptz,
  iniciado_em         timestamptz,
  finalizado_em       timestamptz,
  expira_em           timestamptz,
  origem_endereco     text,
  destino_endereco    text,
  distancia_total_km  numeric,
  duracao_segundos    integer,
  data_hora_fim       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         r.status,
         r.motorista_nome,
         r.veiculo_descricao,
         r.cliente_nome,
         r.categoria_rastreamento,
         r.latitude,
         r.longitude,
         r.heading,
         r.speed_kmh,
         r.ultima_atualizacao,
         r.iniciado_em,
         r.finalizado_em,
         r.expira_em,
         r.origem_endereco,
         r.destino_endereco,
         r.distancia_total_km,
         r.duracao_segundos,
         r.data_hora_fim
    from public.rastreios_ao_vivo r
   where r.token = p_token
     and (r.expira_em is null or r.expira_em > now());
$$;

revoke all on function public.get_rastreio_publico(text) from public;
grant execute on function public.get_rastreio_publico(text) to anon, authenticated;

comment on function public.get_rastreio_publico(text) is
  'Retorna snapshot público (sem dados sensíveis) de um rastreio pelo token. Acessível a anon/authenticated.';
