-- Isolamento forte dos contratos por utilizador.
-- Cada conta mantém seu próprio contrato por tipo (transfer/grupos),
-- sem partilhar alterações com outras contas.

-- Garante integridade da chave lógica por conta + tipo.
create unique index if not exists contratos_user_tipo_uidx
  on public.contratos (user_id, tipo);

-- RLS obrigatório para evitar leitura/edição cruzada.
alter table public.contratos enable row level security;

do $$
declare
  p record;
begin
  -- Remove políticas existentes (incluindo legadas) para recriar regras explícitas.
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contratos'
  loop
    execute format('drop policy if exists %I on public.contratos', p.policyname);
  end loop;
end $$;

-- Dono da conta: acesso total apenas às próprias linhas.
create policy contratos_owner_select
  on public.contratos
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy contratos_owner_insert
  on public.contratos
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy contratos_owner_update
  on public.contratos
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy contratos_owner_delete
  on public.contratos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Admin master pode auditar/operar quando necessário.
create policy contratos_admin_master_all
  on public.contratos
  for all
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

-- Motorista da frota: leitura apenas do contrato do operador dono da conta.
create policy contratos_select_for_frota_motorista
  on public.contratos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = contratos.user_id
    )
  );
