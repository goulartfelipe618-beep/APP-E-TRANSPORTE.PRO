ALTER TABLE public.cabecalho_contratual
  ADD COLUMN IF NOT EXISTS assinatura_url text;

COMMENT ON COLUMN public.cabecalho_contratual.assinatura_url IS
  'URL pública da imagem de assinatura eletrónica (PNG/JPEG/WebP) usada nos PDFs de reserva e solicitação.';
