-- Documentos de motoristas da frota (painel do parceiro): bucket privado, paths sob {auth.uid()}/...

insert into storage.buckets (id, name, public)
values ('motorista-frota-docs', 'motorista-frota-docs', false)
on conflict (id) do nothing;

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
