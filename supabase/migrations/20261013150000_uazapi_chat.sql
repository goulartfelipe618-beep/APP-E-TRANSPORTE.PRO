-- Espelho das mensagens que a UAZAPI entregou (find, history-sync ou webhook).
-- O painel só lê a própria conta. O segredo do webhook não sai desta tabela.

create table if not exists public.uazapi_chat_mensagens (
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null,
  chatid text not null,
  messageid text,
  id_uazapi text,
  from_me boolean,
  texto text,
  status text,
  remetente text,
  remetente_nome text,
  tipo text,
  enviada_pela_api boolean,
  erro text,
  message_timestamp bigint,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave),
  constraint uazapi_chat_mensagens_chave_len check (char_length(chave) between 1 and 200),
  constraint uazapi_chat_mensagens_chatid_len check (char_length(chatid) between 1 and 200)
);

create index if not exists uazapi_chat_mensagens_chat_idx
  on public.uazapi_chat_mensagens (user_id, chatid, message_timestamp desc);

alter table public.uazapi_chat_mensagens enable row level security;

revoke all on table public.uazapi_chat_mensagens from public, anon, authenticated;
grant select on table public.uazapi_chat_mensagens to authenticated;

drop policy if exists uazapi_chat_mensagens_select_own on public.uazapi_chat_mensagens;
create policy uazapi_chat_mensagens_select_own
  on public.uazapi_chat_mensagens
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.uazapi_chat_assinatura (
  user_id uuid primary key references auth.users (id) on delete cascade,
  segredo text not null,
  criado_em timestamptz not null default now(),
  constraint uazapi_chat_assinatura_segredo_len check (char_length(segredo) between 32 and 80)
);

alter table public.uazapi_chat_assinatura enable row level security;

revoke all on table public.uazapi_chat_assinatura from public, anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.uazapi_chat_mensagens;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
