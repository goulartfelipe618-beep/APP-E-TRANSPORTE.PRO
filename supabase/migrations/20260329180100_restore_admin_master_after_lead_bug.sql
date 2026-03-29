-- Correção única: conta admin usada como e-mail no formulário de motorista perdeu admin_master.
-- Idempotente: se o e-mail não existir, não faz nada.
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('goulartfelipe618@gmail.com');
  if uid is null then
    raise notice 'restore_admin_master: utilizador não encontrado';
    return;
  end if;

  delete from public.user_roles where user_id = uid;
  insert into public.user_roles (user_id, role) values (uid, 'admin_master');

  delete from public.user_plans where user_id = uid;
end $$;
