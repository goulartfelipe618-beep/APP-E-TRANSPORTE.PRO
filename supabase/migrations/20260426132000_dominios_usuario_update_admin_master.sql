-- Permite ao admin_master aprovar/reprovar domínios no painel master.
create policy "dominios_usuario_update_admin_master"
  on public.dominios_usuario for update
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));
