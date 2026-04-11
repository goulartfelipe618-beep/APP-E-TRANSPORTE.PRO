-- Permite ao admin_master consultar todos os domínios (ex.: painel Domínios).
create policy "dominios_usuario_select_admin_master"
  on public.dominios_usuario for select
  to authenticated
  using (public.is_admin_master((select auth.uid())));
