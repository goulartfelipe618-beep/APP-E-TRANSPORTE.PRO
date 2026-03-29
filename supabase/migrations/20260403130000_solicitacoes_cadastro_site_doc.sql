-- Regras de negócio: cadastro pelo site → solicitacoes_motoristas + user_plans FREE + login liberado;
-- plano pago ao finalizar no admin (finalize_landing_lead) ou via self-upgrade-plan no painel do cliente.
COMMENT ON TABLE public.solicitacoes_motoristas IS
  'Pré-cadastros vindos do site (webhook motorista). lead_user_id aponta o login em FREE até upgrade ou finalize_landing_lead.';

COMMENT ON TABLE public.solicitacoes_acesso IS
  'Solicitações de interesse/contato (formulário), distintas do pré-cadastro motorista pela landing.';
