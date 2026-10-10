-- Uma sessão por conta. Sessões extras (um portal de motorista chegou a centenas)
-- renovam token e sustentam o volume de requisições do plano free.
-- Mantém a sessão renovada por último. Revoga o resto.

with ranked as (
  select
    id,
    user_id,
    row_number() over (
      partition by user_id
      order by refreshed_at desc nulls last, updated_at desc, created_at desc
    ) as rn
  from auth.sessions
)
update auth.refresh_tokens rt
   set revoked = true,
       updated_at = now()
  from ranked r
 where r.rn > 1
   and rt.session_id = r.id
   and rt.revoked = false;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by refreshed_at desc nulls last, updated_at desc, created_at desc
    ) as rn
  from auth.sessions
)
delete from auth.sessions s
 using ranked r
 where s.id = r.id
   and r.rn > 1;

insert into public.user_active_sessions (user_id, session_id, updated_at)
select distinct on (user_id)
       user_id,
       id,
       now()
  from auth.sessions
 order by user_id, refreshed_at desc nulls last, updated_at desc, created_at desc
on conflict (user_id) do update
  set session_id = excluded.session_id,
      updated_at = now();

delete from auth.refresh_tokens
 where revoked = true
   and coalesce(updated_at, created_at) < now() - interval '1 day';
