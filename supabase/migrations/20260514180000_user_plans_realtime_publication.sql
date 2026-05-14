-- Permite que o cliente receba `postgres_changes` na própria linha de `user_plans`
-- (ex.: upgrade pelo admin_master ou webhook Mercado Pago), para a UI actualizar o plano sem F5.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_plans'
  ) then
    alter publication supabase_realtime add table public.user_plans;
  end if;
exception
  when others then
    raise notice 'supabase_realtime add user_plans: %', sqlerrm;
end $$;
