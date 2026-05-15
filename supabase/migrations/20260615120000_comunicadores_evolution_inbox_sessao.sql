-- Início da sessão do menu WhatsApp: filtra chats/mensagens apenas após o scan do QR.
ALTER TABLE public.comunicadores_evolution
  ADD COLUMN IF NOT EXISTS inbox_sessao_conectado_em timestamptz;

COMMENT ON COLUMN public.comunicadores_evolution.inbox_sessao_conectado_em IS
  'Moment em que o WhatsApp próprio ficou ligado ao painel; o inbox só mostra actividade igual ou posterior.';
