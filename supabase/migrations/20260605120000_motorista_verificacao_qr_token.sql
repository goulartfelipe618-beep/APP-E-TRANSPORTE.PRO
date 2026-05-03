-- Token opaco para QR no PDF do dossiê: página pública confirma motorista + operador sem expor CPF/endereço completo.

alter table public.solicitacoes_motoristas
  add column if not exists motorista_verificacao_qr_token uuid;

update public.solicitacoes_motoristas
set motorista_verificacao_qr_token = gen_random_uuid()
where motorista_verificacao_qr_token is null;

alter table public.solicitacoes_motoristas
  alter column motorista_verificacao_qr_token set default gen_random_uuid();

alter table public.solicitacoes_motoristas
  alter column motorista_verificacao_qr_token set not null;

create unique index if not exists solicitacoes_motoristas_verificacao_qr_token_uidx
  on public.solicitacoes_motoristas (motorista_verificacao_qr_token);

comment on column public.solicitacoes_motoristas.motorista_verificacao_qr_token is
  'Token público (URL) para selo de autenticidade do motorista; não substitui portal_token (acesso ao painel).';
