-- Bump em `revoked_at` (linha id=1) força todos os browsers com sessão activa
-- a fazer sign-out local na próxima leitura (ver ClientSessionRevocationGuard).

create table if not exists public.client_session_revocation (
  id smallint primary key check (id = 1),
  revoked_at timestamptz not null default now()
);

comment on table public.client_session_revocation is
  'Única linha: id=1. O cliente compara revoked_at com localStorage e desloga se o servidor estiver mais recente.';

insert into public.client_session_revocation (id, revoked_at)
values (1, now())
on conflict (id) do update set revoked_at = excluded.revoked_at;

alter table public.client_session_revocation enable row level security;

drop policy if exists "client_session_revocation_select_auth" on public.client_session_revocation;
create policy "client_session_revocation_select_auth"
  on public.client_session_revocation for select
  to authenticated
  using (true);

grant select on public.client_session_revocation to authenticated;
