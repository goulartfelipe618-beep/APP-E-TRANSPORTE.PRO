-- Motorista da frota (auth do portal): pode ler ficheiros do bucket quando o 2.º segmento do path
-- é o id da linha solicitacoes_motoristas ligada a portal_auth_user_id = auth.uid().
-- O 1.º segmento continua a ser o user_id do operador que fez upload; o dono da frota mantém insert/update/delete.

drop policy if exists motorista_frota_docs_select_portal_motorista on storage.objects;
create policy motorista_frota_docs_select_portal_motorista
on storage.objects for select to authenticated
using (
  bucket_id = 'motorista-frota-docs'
  and exists (
    select 1
    from public.solicitacoes_motoristas sm
    where sm.id::text = split_part(name, '/', 2)
      and sm.portal_auth_user_id is not null
      and sm.portal_auth_user_id = (select auth.uid())
  )
);
