-- Edição de reservas no painel: UPDATE para dono da linha (user_id) ou staff da plataforma.
-- Idempotente com nomes fixos.

drop policy if exists "reservas_transfer_update_owner_or_staff" on public.reservas_transfer;
create policy "reservas_transfer_update_owner_or_staff"
  on public.reservas_transfer
  for update
  to authenticated
  using (
    public.is_platform_staff()
    or (user_id is not null and auth.uid() = user_id)
  )
  with check (
    public.is_platform_staff()
    or (user_id is not null and auth.uid() = user_id)
  );

drop policy if exists "reservas_grupos_update_owner_or_staff" on public.reservas_grupos;
create policy "reservas_grupos_update_owner_or_staff"
  on public.reservas_grupos
  for update
  to authenticated
  using (
    public.is_platform_staff()
    or (user_id is not null and auth.uid() = user_id)
  )
  with check (
    public.is_platform_staff()
    or (user_id is not null and auth.uid() = user_id)
  );
