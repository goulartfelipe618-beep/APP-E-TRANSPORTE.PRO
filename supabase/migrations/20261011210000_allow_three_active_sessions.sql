-- Até 3 aparelhos por conta. O login novo entra na lista.
-- Se passar de 3, sai o acesso mais antigo: refresh revogado e sessão apagada.
-- A sessão que acabou de entrar nunca é a que sai.
-- Não apaga usuários, reservas nem as sessões que continuam entre as três.

alter table public.user_active_sessions
  drop constraint user_active_sessions_pkey;

alter table public.user_active_sessions
  add constraint user_active_sessions_pkey primary key (user_id, session_id);

create or replace function public.claim_exclusive_session()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  raw_sid text;
  max_devices constant integer := 3;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  raw_sid := nullif(auth.jwt() ->> 'session_id', '');
  if raw_sid is null or raw_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'session id missing' using errcode = '28000';
  end if;
  sid := raw_sid::uuid;

  insert into public.user_active_sessions (user_id, session_id, updated_at)
  values (uid, sid, now())
  on conflict (user_id, session_id) do update
    set updated_at = excluded.updated_at;

  delete from public.user_active_sessions as kept
  where kept.user_id = uid
    and kept.session_id not in (
      select session_id
      from public.user_active_sessions
      where user_id = uid
      order by (session_id = sid) desc, updated_at desc
      limit max_devices
    );

  update auth.refresh_tokens
     set revoked = true,
         updated_at = now()
   where user_id = uid::text
     and session_id is not null
     and session_id not in (
       select active.session_id
       from public.user_active_sessions as active
       where active.user_id = uid
     )
     and revoked = false;

  delete from auth.sessions
   where user_id = uid
     and id not in (
       select active.session_id
       from public.user_active_sessions as active
       where active.user_id = uid
     );

  return sid;
end;
$$;

revoke all on function public.claim_exclusive_session() from public, anon;
grant execute on function public.claim_exclusive_session() to authenticated;
