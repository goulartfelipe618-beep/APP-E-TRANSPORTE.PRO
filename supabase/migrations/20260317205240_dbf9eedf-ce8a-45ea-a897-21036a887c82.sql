
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  url_destino text NOT NULL,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own qr codes" ON public.qr_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own qr codes" ON public.qr_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own qr codes" ON public.qr_codes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin master can view all qr codes" ON public.qr_codes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin_master'::app_role));
