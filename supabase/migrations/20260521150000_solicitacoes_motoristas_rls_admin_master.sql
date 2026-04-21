-- Pré-cadastros / leads em solicitacoes_motoristas: apenas admin_master vê e altera fila da plataforma.
-- Motorista executivo mantém apenas linhas próprias já marcadas como cadastrado (frota interna + Website).

alter table public.solicitacoes_motoristas enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'solicitacoes_motoristas'
  loop
    execute format('drop policy if exists %I on public.solicitacoes_motoristas', r.policyname);
  end loop;
end $$;

-- Leitura: admin vê tudo; motorista só as suas fichas internas finalizadas (status cadastrado).
create policy solicitacoes_motoristas_select_scope
  on public.solicitacoes_motoristas
  for select
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
  );

-- Inserção: admin ou motorista criando registro próprio (ex.: cadastro manual na frota).
create policy solicitacoes_motoristas_insert_scope
  on public.solicitacoes_motoristas
  for insert
  to authenticated
  with check (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
    )
  );

-- Atualização: só admin altera leads / fila; motorista só edita as suas linhas já cadastrado.
create policy solicitacoes_motoristas_update_scope
  on public.solicitacoes_motoristas
  for update
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
  )
  with check (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
  );

-- Remoção: apenas admin (webhook / edge usam service_role).
create policy solicitacoes_motoristas_delete_scope
  on public.solicitacoes_motoristas
  for delete
  to authenticated
  using (public.is_admin_master((select auth.uid())));
