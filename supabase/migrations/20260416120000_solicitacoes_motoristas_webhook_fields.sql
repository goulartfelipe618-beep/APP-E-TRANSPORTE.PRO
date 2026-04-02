-- Campos explícitos para webhook de motorista (estado e observações separados + extras JSON)
alter table public.solicitacoes_motoristas
  add column if not exists estado text,
  add column if not exists mensagem_observacoes text,
  add column if not exists dados_webhook jsonb default '{}'::jsonb;

comment on column public.solicitacoes_motoristas.estado is 'UF/estado informado no lead (não concatenar na mensagem).';
comment on column public.solicitacoes_motoristas.mensagem_observacoes is 'Observações/mensagem livre do formulário ou webhook.';
comment on column public.solicitacoes_motoristas.dados_webhook is 'Demais campos do mapeamento (endereço, CNH, veículo, etc.) para pré-preencher cadastro.';
