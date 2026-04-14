-- Liberação global das ferramentas BETA Google Maps e Disparador (painel motorista).
-- Linha única id = 1; apenas admin_master pode alterar; todos autenticados podem ler.

create table public.plataforma_ferramentas_disponibilidade (
  id smallint primary key default 1,
  google_maps_consumo_liberado boolean not null default false,
  disparador_consumo_liberado boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint plataforma_ferramentas_disponibilidade_single check (id = 1)
);

comment on table public.plataforma_ferramentas_disponibilidade is
  'Quando false, o painel motorista exibe aviso e bloqueia interação até o admin liberar.';

insert into public.plataforma_ferramentas_disponibilidade (id, google_maps_consumo_liberado, disparador_consumo_liberado)
values (1, false, false)
on conflict (id) do nothing;

alter table public.plataforma_ferramentas_disponibilidade enable row level security;

create policy "plataforma_ferramentas_disponibilidade_select_authenticated"
  on public.plataforma_ferramentas_disponibilidade for select to authenticated
  using (true);

create policy "plataforma_ferramentas_disponibilidade_update_master"
  on public.plataforma_ferramentas_disponibilidade for update to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (id = 1);

grant select on public.plataforma_ferramentas_disponibilidade to authenticated;
grant update on public.plataforma_ferramentas_disponibilidade to authenticated;
