-- A política RESTRICTIVE mfa_verified_requires_aal2 (migração 20260326130000) aplica-se a todas
-- as tabelas public com RLS. Com fator MFA verificado e JWT ainda em aal1, o Postgres nega
-- SELECT/INSERT/UPDATE — o painel parece "vazio" (imagens/dados sumidos) e operações falham.
-- O reforço de MFA permanece no fluxo da app (Login → /mfa, Protected*); remove-se apenas o bloqueio em cadeia no banco.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_policies
    where policyname = 'mfa_verified_requires_aal2'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'mfa_verified_requires_aal2',
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

-- Garantir admin master (ajuste o e-mail se for outro)
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('goulartfelipe618@gmail.com');
  if uid is null then
    raise notice 'restore_admin_master: email não encontrado em auth.users';
    return;
  end if;

  delete from public.user_roles where user_id = uid;
  insert into public.user_roles (user_id, role) values (uid, 'admin_master');
  delete from public.user_plans where user_id = uid;
end $$;
