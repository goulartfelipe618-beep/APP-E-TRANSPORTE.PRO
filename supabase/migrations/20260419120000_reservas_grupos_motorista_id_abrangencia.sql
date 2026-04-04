-- Atribuição de motorista (mesmo modelo de reservas_transfer) + leitura para mapa Abrangência do motorista executivo.

alter table public.reservas_grupos
  add column if not exists motorista_id uuid references auth.users (id) on delete set null;

create index if not exists reservas_grupos_motorista_id_idx on public.reservas_grupos (motorista_id);

comment on column public.reservas_grupos.motorista_id is
  'Usuário (motorista executivo) atribuído à reserva; usado no mapa Principal → Abrangência.';

-- Políticas adicionais: motorista vê reservas onde está atribuído (complementa políticas do operador user_id).
-- reservas_transfer.motorista_id pode ser text (legado); auth.uid() é uuid.
drop policy if exists "reservas_transfer_select_as_motorista" on public.reservas_transfer;
create policy "reservas_transfer_select_as_motorista"
  on public.reservas_transfer for select to authenticated
  using (motorista_id is not null and trim(motorista_id) = auth.uid()::text);

drop policy if exists "reservas_grupos_select_as_motorista" on public.reservas_grupos;
create policy "reservas_grupos_select_as_motorista"
  on public.reservas_grupos for select to authenticated
  using (motorista_id is not null and motorista_id = auth.uid());
