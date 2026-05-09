-- Alguns projetos tinham CHECK em user_plans.plano apenas ('free','pro'), o que fazia upsert falhar para 'standart'.
-- Remove CHECKs existentes sobre plano e define um único CHECK alinhado à app (inclui legados migrados no cliente).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_plans'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%plano%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.user_plans DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

update public.user_plans
set plano = 'standart', updated_at = now()
where lower(trim(plano)) = 'standard';

ALTER TABLE public.user_plans
  DROP CONSTRAINT IF EXISTS user_plans_plano_allowed_values;

ALTER TABLE public.user_plans
  ADD CONSTRAINT user_plans_plano_allowed_values
  CHECK (
    lower(trim(plano)) IN (
      'free',
      'standart',
      'pro',
      'seed',
      'grow',
      'rise',
      'apex',
      'premium'
    )
  );

comment on constraint user_plans_plano_allowed_values on public.user_plans is
  'Valores ativos: free | standart | pro; legados seed/grow/rise/apex/premium até migração total.';
