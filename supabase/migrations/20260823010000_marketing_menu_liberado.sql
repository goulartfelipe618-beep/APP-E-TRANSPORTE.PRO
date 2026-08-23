-- Libera a categoria Marketing (sidebar) no painel das empresas (admin_transfer)
-- apenas quando o Admin Master activar a flag.

ALTER TABLE public.plataforma_ferramentas_disponibilidade
  ADD COLUMN IF NOT EXISTS marketing_menu_liberado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plataforma_ferramentas_disponibilidade.marketing_menu_liberado IS
  'Quando true, empresas veem a categoria Marketing (Campanhas, E-mail Business, Website, Domínios, Comunidade, Network).';
