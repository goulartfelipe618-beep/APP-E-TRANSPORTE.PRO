-- Uma sessão de login por conta. O login novo grava o session_id do JWT,
-- revoga os refresh tokens das outras sessões e apaga essas sessões.
-- Não mexe na sessão atual. O cliente antigo é deslogado ao comparar o id.

create table if not exists public.user_active_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.user_active_sessions enable row level security;

drop policy if exists user_active_sessions_select_own on public.user_active_sessions;
create policy user_active_sessions_select_own
  on public.user_active_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.user_active_sessions from public, anon, authenticated;
grant select on table public.user_active_sessions to authenticated;

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
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        updated_at = now();

  update auth.refresh_tokens
     set revoked = true,
         updated_at = now()
   where user_id = uid::text
     and session_id is not null
     and session_id <> sid
     and revoked = false;

  delete from auth.sessions
   where user_id = uid
     and id <> sid;

  return sid;
end;
$$;

revoke all on function public.claim_exclusive_session() from public, anon;
grant execute on function public.claim_exclusive_session() to authenticated;
