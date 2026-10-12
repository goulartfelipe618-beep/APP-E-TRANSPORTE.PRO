-- A view filtra user_id = auth.uid(). Com security_invoker, o painel
-- lia a tabela base sem GRANT e o navegador recebia 403.
-- O dono da view lê a tabela; a API continua sem acesso direto a ela.

alter view public.r2_auto_backup_status set (security_invoker = false);

revoke all on table public.r2_auto_backup_settings from public, anon, authenticated;
grant select on table public.r2_auto_backup_status to authenticated, service_role;
