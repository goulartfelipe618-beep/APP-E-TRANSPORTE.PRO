-- Metadados para pares IDA/VOLTA persistidos como duas linhas (mesmo par_reserva_id).
-- RLS existente por user_id mantém-se; colunas só leitura/escrita pelo dono da reserva.

alter table public.reservas_transfer
  add column if not exists perna_viagem text,
  add column if not exists par_reserva_id uuid;

alter table public.reservas_transfer
  drop constraint if exists reservas_transfer_perna_viagem_check;

alter table public.reservas_transfer
  add constraint reservas_transfer_perna_viagem_check
  check (perna_viagem is null or perna_viagem in ('ida', 'volta'));

comment on column public.reservas_transfer.perna_viagem is
  'Quando a viagem ida+volta é gravada como duas reservas, marca IDA ou VOLTA. Null em reservas simples ou legado.';

comment on column public.reservas_transfer.par_reserva_id is
  'UUID comum às duas linhas do mesmo par ida/volta (opcional).';

alter table public.reservas_grupos
  add column if not exists perna_viagem text,
  add column if not exists par_reserva_id uuid;

alter table public.reservas_grupos
  drop constraint if exists reservas_grupos_perna_viagem_check;

alter table public.reservas_grupos
  add constraint reservas_grupos_perna_viagem_check
  check (perna_viagem is null or perna_viagem in ('ida', 'volta'));

comment on column public.reservas_grupos.perna_viagem is
  'Marca IDA ou VOLTA quando ida+volta é persistida como duas reservas.';

comment on column public.reservas_grupos.par_reserva_id is
  'UUID comum ao par ida/volta em duas linhas.';

create index if not exists reservas_transfer_par_reserva_id_idx
  on public.reservas_transfer (par_reserva_id)
  where par_reserva_id is not null;

create index if not exists reservas_grupos_par_reserva_id_idx
  on public.reservas_grupos (par_reserva_id)
  where par_reserva_id is not null;
