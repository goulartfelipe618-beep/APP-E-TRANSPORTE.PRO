-- Isolamento entre empresas.
-- is_platform_staff incluía admin_transfer, e várias políticas usam essa função
-- como "vê/edita qualquer linha". Isso deixava um ADMIN_USER ler ou alterar
-- dados de outro tenant (reservas, automações, catálogos, instâncias WhatsApp).
-- A partir daqui a função só é verdadeira para admin_master.
-- Nenhuma linha é apagada, reassociada ou recriada.

create or replace function public.is_platform_staff(check_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = check_uid
      and ur.role = 'admin_master'
  );
$$;

comment on function public.is_platform_staff(uuid) is
  'Verdadeiro só para admin_master. admin_transfer acessa apenas as linhas do próprio user_id.';

-- A política anônima devolvia todas as automações (webhooks) para quem tem a chave anon.
drop policy if exists "Service can read automations" on public.automacoes;

-- O painel não lê o token. As funções de borda usam service_role.
revoke all on table public.comunicadores_evolution from anon, authenticated;

grant select (
  id,
  escopo,
  user_id,
  rotulo,
  instance_name,
  qr_code_base64,
  connection_status,
  telefone_conectado,
  created_at,
  updated_at,
  nome_dispositivo,
  foto_perfil_url,
  painel_motorista_evolution_ativo,
  inbox_sessao_conectado_em
) on public.comunicadores_evolution to authenticated;

grant insert (
  id,
  escopo,
  user_id,
  rotulo,
  instance_name,
  qr_code_base64,
  connection_status,
  telefone_conectado,
  created_at,
  updated_at,
  nome_dispositivo,
  foto_perfil_url,
  painel_motorista_evolution_ativo,
  inbox_sessao_conectado_em
) on public.comunicadores_evolution to authenticated;

grant update (
  id,
  escopo,
  user_id,
  rotulo,
  instance_name,
  qr_code_base64,
  connection_status,
  telefone_conectado,
  created_at,
  updated_at,
  nome_dispositivo,
  foto_perfil_url,
  painel_motorista_evolution_ativo,
  inbox_sessao_conectado_em
) on public.comunicadores_evolution to authenticated;

grant delete on public.comunicadores_evolution to authenticated;

-- comunicador_uazapi_instancias continua legível só por is_platform_staff(),
-- agora restrito a admin_master. O painel do master grava instance_token por essa política.
