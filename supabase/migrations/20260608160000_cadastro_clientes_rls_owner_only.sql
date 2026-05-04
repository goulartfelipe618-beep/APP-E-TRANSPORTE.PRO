-- Clientes: apenas o operador dono (LGPD). Sem acesso para admin_master / staff da plataforma.

drop policy if exists cadastro_clientes_select_scope on public.cadastro_clientes;
create policy cadastro_clientes_select_scope
  on public.cadastro_clientes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists cadastro_clientes_insert_scope on public.cadastro_clientes;
create policy cadastro_clientes_insert_scope
  on public.cadastro_clientes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists cadastro_clientes_update_scope on public.cadastro_clientes;
create policy cadastro_clientes_update_scope
  on public.cadastro_clientes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cadastro_clientes_delete_scope on public.cadastro_clientes;
create policy cadastro_clientes_delete_scope
  on public.cadastro_clientes for delete to authenticated
  using (user_id = auth.uid());
