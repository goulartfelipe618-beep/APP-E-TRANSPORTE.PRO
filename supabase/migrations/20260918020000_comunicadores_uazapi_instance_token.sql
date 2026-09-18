-- Token da instância uazapiGO (header `token`). O admintoken fica em comunicador_evolution_credenciais.api_key.

ALTER TABLE public.comunicadores_evolution
  ADD COLUMN IF NOT EXISTS uazapi_instance_token text;

COMMENT ON COLUMN public.comunicadores_evolution.uazapi_instance_token IS
  'Token da instância uazapiGO (não é o admintoken). Usado nos envios e no QR.';
