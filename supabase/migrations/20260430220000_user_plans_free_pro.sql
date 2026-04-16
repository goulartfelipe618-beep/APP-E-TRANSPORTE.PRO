-- Planos: apenas FREE e PRÓ. Migra valores antigos (seed/grow/rise/apex) → pro.
update public.user_plans
set plano = 'pro', updated_at = now()
where lower(trim(plano)) in ('seed', 'grow', 'rise', 'apex');

comment on table public.user_plans is 'Plano por utilizador: free (pré-cadastro / limitado) ou pro (painel completo).';
