-- Domínios comprados/gestão pelo usuário (Motorista e Admin Master usam a mesma tabela por user_id).
CREATE TABLE public.dominios_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fqdn text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'ativo', 'em_configuracao', 'cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fqdn)
);

CREATE INDEX dominios_usuario_user_id_idx ON public.dominios_usuario (user_id);

ALTER TABLE public.dominios_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dominios_usuario_select_own"
  ON public.dominios_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "dominios_usuario_insert_own"
  ON public.dominios_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dominios_usuario_update_own"
  ON public.dominios_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dominios_usuario_delete_own"
  ON public.dominios_usuario FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.dominios_usuario IS 'Domínios adquiridos ou em processo de compra/configuração pelo usuário do painel.';
