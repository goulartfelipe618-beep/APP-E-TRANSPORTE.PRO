-- Permite status "publicado" no fluxo Website (site no ar).
alter table public.solicitacoes_servicos
  drop constraint if exists solicitacoes_servicos_status_check;

alter table public.solicitacoes_servicos
  add constraint solicitacoes_servicos_status_check
  check (
    status = any (
      array['pendente', 'em_andamento', 'concluido', 'recusado', 'publicado']::text[]
    )
  );
