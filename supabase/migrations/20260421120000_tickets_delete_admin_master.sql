-- Permite ao Admin Master excluir tickets (remove a linha para todos os painéis).

drop policy if exists "tickets_delete_admin_master" on public.tickets;

create policy "tickets_delete_admin_master"
  on public.tickets for delete to authenticated
  using (public.is_admin_master((select auth.uid())));
