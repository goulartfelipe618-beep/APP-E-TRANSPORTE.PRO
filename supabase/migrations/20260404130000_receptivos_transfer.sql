-- Histórico de receptivos (plaquinhas PDF) gerados pelos motoristas — apenas reservas Transfer.
create table if not exists public.receptivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  modelo smallint not null check (modelo >= 1 and modelo <= 5),
  nome_cliente text not null,
  reserva_transfer_id uuid references public.reservas_transfer (id) on delete set null,
  reserva_numero integer,
  tipo_viagem text,
  embarque text,
  desembarque text,
  volta_embarque text,
  volta_desembarque text,
  ida_data text,
  ida_hora text,
  volta_data text,
  volta_hora text
);

create index if not exists receptivos_user_created_idx on public.receptivos (user_id, created_at desc);

comment on table public.receptivos is 'Plaquinhas de receptivo geradas para embarque (Transfer); PDF gerado no cliente.';

alter table public.receptivos enable row level security;

create policy receptivos_select_own
  on public.receptivos for select to authenticated
  using (user_id = (select auth.uid()));

create policy receptivos_insert_own
  on public.receptivos for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy receptivos_delete_own
  on public.receptivos for delete to authenticated
  using (user_id = (select auth.uid()));
