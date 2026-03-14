
CREATE TABLE public.webhook_testes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automacao_id UUID NOT NULL REFERENCES public.automacoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_testes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test entries"
ON public.webhook_testes FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own test entries"
ON public.webhook_testes FOR DELETE TO authenticated
USING (user_id = auth.uid());
