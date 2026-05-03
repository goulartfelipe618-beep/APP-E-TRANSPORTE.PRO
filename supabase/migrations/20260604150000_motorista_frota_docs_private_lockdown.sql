-- Documentos da frota: bucket privado, sem SELECT anónimo. Só o dono do path (primeiro segmento = auth.uid())
-- pode ler/escrever/apagar; o painel usa createSignedUrl com JWT do próprio utilizador.
-- Garante que instâncias que aplicaram a migração pública antiga voltam ao estado seguro.

update storage.buckets
set public = false
where id = 'motorista-frota-docs';

drop policy if exists motorista_frota_docs_public_read on storage.objects;

drop policy if exists motorista_frota_docs_select_owner on storage.objects;
create policy motorista_frota_docs_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'motorista-frota-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists motorista_frota_docs_insert_owner on storage.objects;
create policy motorista_frota_docs_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'motorista-frota-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists motorista_frota_docs_update_owner on storage.objects;
create policy motorista_frota_docs_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'motorista-frota-docs'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'motorista-frota-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists motorista_frota_docs_delete_owner on storage.objects;
create policy motorista_frota_docs_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'motorista-frota-docs'
  and split_part(name, '/', 1) = auth.uid()::text
);
