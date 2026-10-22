-- O mini painel pode ficar aberto em vários navegadores ao mesmo tempo.
-- Entrar de novo neste link não derruba quem já está em outro navegador.
-- A conta da empresa continua limitada a 3 aparelhos.
-- O vínculo dos outros motoristas da reserva é gravado pela conta dona da reserva.

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

  if exists (
    select 1
    from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = uid
      and sm.status = 'cadastrado'
  ) then
    return sid;
  end if;

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

create or replace function public.replace_reserva_motoristas_extra(
  p_kind text,
  p_reserva_id uuid,
  p_vinculos jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_primary text := '';
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('transfer', 'grupo') or p_reserva_id is null then
    raise exception 'reserva invalida' using errcode = '22023';
  end if;

  if p_kind = 'transfer' then
    select btrim(coalesce(r.motorista_id, ''))
      into v_primary
    from public.reservas_transfer r
    where r.id = p_reserva_id
      and r.user_id = v_uid;
  else
    select btrim(coalesce(g.motorista_id::text, ''))
      into v_primary
    from public.reservas_grupos g
    where g.id = p_reserva_id
      and g.user_id = v_uid;
  end if;

  if not found then
    raise exception 'reserva nao encontrada' using errcode = '42501';
  end if;

  delete from public.reserva_motoristas_extra e
  where e.user_id = v_uid
    and e.reserva_kind = p_kind
    and e.reserva_id = p_reserva_id;

  insert into public.reserva_motoristas_extra (
    user_id, reserva_kind, reserva_id, motorista_id, repasse_valor
  )
  select distinct on (sm.id)
    v_uid,
    p_kind,
    p_reserva_id,
    sm.id::text,
    case
      when nullif(btrim(item->>'repasse'), '') is null then null
      else round((item->>'repasse')::numeric, 2)
    end
  from jsonb_array_elements(coalesce(p_vinculos, '[]'::jsonb)) item
  join public.solicitacoes_motoristas sm
    on sm.user_id = v_uid
   and sm.status = 'cadastrado'
   and btrim(coalesce(item->>'motorista_id', '')) in (
     sm.id::text,
     coalesce(sm.portal_auth_user_id::text, '')
   )
  where btrim(coalesce(item->>'motorista_id', '')) <> ''
    and not (
      v_primary <> ''
      and v_primary in (sm.id::text, coalesce(sm.portal_auth_user_id::text, ''))
    )
  order by sm.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.replace_reserva_motoristas_extra(text, uuid, jsonb) from public, anon;
grant execute on function public.replace_reserva_motoristas_extra(text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
