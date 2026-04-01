-- URLs de webhook globais definidas pelo Admin Master; destino dos envios "Comunicar" dos motoristas executivos.

create table if not exists public.sistema_webhooks_comunicacao (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  transfer_solicitacao_url text,
  transfer_reserva_url text,
  grupo_solicitacao_url text,
  grupo_reserva_url text,
  motorista_intake_url text,
  motoristas_cadastrados_url text,
  geolocalizacao_url text,
  updated_at timestamptz not null default now()
);

comment on table public.sistema_webhooks_comunicacao is 'Webhooks n8n (ou outros) por tipo de fluxo — configurado apenas pelo Admin Master.';

insert into public.sistema_webhooks_comunicacao (id)
values ('00000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

alter table public.sistema_webhooks_comunicacao enable row level security;

create policy "sistema_webhooks_comunicacao_select_admin_master"
  on public.sistema_webhooks_comunicacao
  for select
  to authenticated
  using (public.is_admin_master((select auth.uid())));

create policy "sistema_webhooks_comunicacao_update_admin_master"
  on public.sistema_webhooks_comunicacao
  for update
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

create policy "sistema_webhooks_comunicacao_insert_admin_master"
  on public.sistema_webhooks_comunicacao
  for insert
  to authenticated
  with check (public.is_admin_master((select auth.uid())));
