
CREATE TABLE public.templates_website (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  imagem_url text NOT NULL DEFAULT '',
  link_modelo text DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.templates_website ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view active templates
CREATE POLICY "Authenticated can view active templates"
ON public.templates_website FOR SELECT TO authenticated
USING (true);

-- Only admin_master can insert
CREATE POLICY "Admin master can insert templates"
ON public.templates_website FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin_master'::app_role));

-- Only admin_master can update
CREATE POLICY "Admin master can update templates"
ON public.templates_website FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));

-- Only admin_master can delete
CREATE POLICY "Admin master can delete templates"
ON public.templates_website FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));
