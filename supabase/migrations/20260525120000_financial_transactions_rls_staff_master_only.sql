-- Isolamento financeiro por conta: a política de SELECT para "staff" não pode usar
-- is_platform_staff() (admin_transfer / admin_taxi), pois esses papéis podem existir
-- em contas operacionais e o OR com a política do dono expõe TODAS as linhas financeiras.
-- Apenas admin_master mantém visão transversal para suporte plataforma.

drop policy if exists "financial_transactions_select_staff" on public.financial_transactions;

create policy "financial_transactions_select_staff"
  on public.financial_transactions
  for select
  to authenticated
  using (public.is_admin_master((select auth.uid())));

comment on policy "financial_transactions_select_staff" on public.financial_transactions is
  'Leitura global só para admin_master. Motoristas e admins operacionais (transfer/taxi) ficam apenas com a política do próprio user_id.';
