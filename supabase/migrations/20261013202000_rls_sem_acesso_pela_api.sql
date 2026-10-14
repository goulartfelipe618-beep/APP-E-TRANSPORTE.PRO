-- O linter 0008 avisa quando a RLS está ligada e não existe política.
-- Sem política o cliente já não lia nada. A política abaixo repete essa negação
-- de forma explícita (USING false), para o aviso sumir sem abrir linha.
-- service_role continua fora da RLS. Não usar USING (true).

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'app_internal_secrets',
    'claude_code_tokens',
    'gmail_connections',
    'gmail_oauth_states',
    'pipeline_cards',
    'pipeline_colunas',
    'pipeline_integracao',
    'platform_product_leads',
    'platform_products',
    'renatlizador_keep',
    'uazapi_chat_assinatura'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS sem_acesso_pela_api ON public.%I', tabela);
    EXECUTE format(
      'CREATE POLICY sem_acesso_pela_api ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      tabela
    );
    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      tabela
    );
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tabela);
  END LOOP;
END $$;
