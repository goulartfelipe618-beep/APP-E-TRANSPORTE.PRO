-- Um único campo JSON reutilizado: emissão do QR (export PDF) grava { jti, iat }; após 1ª leitura válida limpa-se (substitui, não cria tabelas novas).

alter table public.solicitacoes_motoristas
  add column if not exists motorista_verificacao_gate jsonb;

comment on column public.solicitacoes_motoristas.motorista_verificacao_gate is
  'Estado efémero do selo QR (JWT): substituído a cada exportação do PDF; apagado após a primeira consulta pública bem-sucedida.';
