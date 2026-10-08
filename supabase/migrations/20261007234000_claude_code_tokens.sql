-- Chave pessoal para o Claude Code. Só a conta que a criou (admin_transfer ou admin_master).
-- O segredo em claro sai uma vez pelo RPC. Na tabela fica só o SHA-256.
-- A API do painel não lê esta tabela: o MCP usa a service role e filtra por user_id.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.claude_code_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  token_prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint claude_code_tokens_nome_len check (char_length(nome) between 1 and 60),
  constraint claude_code_tokens_hash_len check (char_length(token_hash) = 64)
);

create index if not exists claude_code_tokens_user_idx
  on public.claude_code_tokens (user_id, created_at desc);

alter table public.claude_code_tokens enable row level security;

revoke all on table public.claude_code_tokens from public, anon, authenticated;

create or replace function public.criar_token_claude_code(p_nome text default 'Claude Code')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nome text := left(btrim(coalesce(p_nome, '')), 60);
  token text;
  hash text;
  new_id uuid;
  prefix text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = uid
      and role in ('admin_transfer', 'admin_master')
  ) then
    raise exception 'forbidden';
  end if;

  if (
    select count(*)
    from public.claude_code_tokens
    where user_id = uid
      and revoked_at is null
  ) >= 5 then
    raise exception 'limite de 5 conexões ativas';
  end if;

  if nome = '' then
    nome := 'Claude Code';
  end if;

  token := 'etp_cc_' || encode(extensions.gen_random_bytes(32), 'hex');
  hash := encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex');
  prefix := left(token, 14);

  insert into public.claude_code_tokens (user_id, nome, token_prefix, token_hash)
  values (uid, nome, prefix, hash)
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'token', token,
    'token_prefix', prefix,
    'nome', nome
  );
end;
$$;

create or replace function public.listar_tokens_claude_code()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'nome', t.nome,
          'token_prefix', t.token_prefix,
          'created_at', t.created_at,
          'last_used_at', t.last_used_at,
          'revoked_at', t.revoked_at
        )
        order by t.created_at desc
      )
      from public.claude_code_tokens t
      where t.user_id = uid
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.revogar_token_claude_code(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.claude_code_tokens
  set revoked_at = now()
  where id = p_id
    and user_id = uid
    and revoked_at is null;

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.criar_token_claude_code(text) from public, anon;
revoke all on function public.listar_tokens_claude_code() from public, anon;
revoke all on function public.revogar_token_claude_code(uuid) from public, anon;

grant execute on function public.criar_token_claude_code(text) to authenticated;
grant execute on function public.listar_tokens_claude_code() to authenticated;
grant execute on function public.revogar_token_claude_code(uuid) to authenticated;
