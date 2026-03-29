-- Documenta o payload JSON em dados_solicitacao para website/e-mail (domínio compartilhado no app).
COMMENT ON COLUMN public.solicitacoes_servicos.dados_solicitacao IS
  'JSON do pedido por tipo_servico (website, email, google). Website e e-mail: dominio, tipo_dominio (new|existing), possui_dominio (boolean, espelho de existing), provedor quando já possui domínio.';
