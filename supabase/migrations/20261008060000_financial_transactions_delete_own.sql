-- O dono pode excluir qualquer lançamento próprio, inclusive os gerados pela reserva.
drop policy if exists financial_transactions_delete_own on public.financial_transactions;
create policy financial_transactions_delete_own
on public.financial_transactions
for delete
to authenticated
using ((select auth.uid()) = user_id);
