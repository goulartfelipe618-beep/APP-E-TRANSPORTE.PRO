-- Token e servidor da instância UAZAPI de cada comunicador (header `token` e server_url).

ALTER TABLE public.comunicadores_evolution
  ADD COLUMN IF NOT EXISTS uazapi_instance_token text,
  ADD COLUMN IF NOT EXISTS uazapi_server_url text;

COMMENT ON COLUMN public.comunicadores_evolution.uazapi_instance_token IS
  'Token da instância uazapiGO. Não é o token permanente da plataforma.';

COMMENT ON COLUMN public.comunicadores_evolution.uazapi_server_url IS
  'server_url devolvido ao criar a instância. Os envios usam este host.';

UPDATE public.comunicadores_evolution
SET painel_motorista_evolution_ativo = true
WHERE escopo = 'sistema'
  AND painel_motorista_evolution_ativo IS DISTINCT FROM true;
