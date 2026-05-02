-- Dono da conta (user_id da linha) pode ver todas as suas solicitações de motorista,
-- incluindo leads em testando/pendente — não só status cadastrado.
-- Admin_master mantém visão global.

drop policy if exists solicitacoes_motoristas_select_scope on public.solicitacoes_motoristas;

create policy solicitacoes_motoristas_select_scope
  on public.solicitacoes_motoristas
  for select
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
    )
  );

comment on policy solicitacoes_motoristas_select_scope on public.solicitacoes_motoristas is
  'Admin master: todas as linhas. Motorista executivo: apenas linhas com user_id = auth.uid() (leads + cadastrados da sua frota).';

-- Completar cadastro na frota (lead → cadastrado): o dono precisa de UPDATE na própria linha.
drop policy if exists solicitacoes_motoristas_update_scope on public.solicitacoes_motoristas;

create policy solicitacoes_motoristas_update_scope
  on public.solicitacoes_motoristas
  for update
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
    )
  );

comment on policy solicitacoes_motoristas_update_scope on public.solicitacoes_motoristas is
  'Admin altera qualquer linha. Motorista altera apenas onde user_id = auth.uid() (inclui concluir solicitação).';
