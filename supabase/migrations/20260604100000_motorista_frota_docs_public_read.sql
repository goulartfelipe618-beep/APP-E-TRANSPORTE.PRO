-- Pré-visualização em <img> e PDF precisam de URL pública (como veiculos-imagens).
-- Paths continuam opacos ({user_id}/{motorista_id}/perfil.png); só quem conhece o URL acede.

update storage.buckets
set public = true
where id = 'motorista-frota-docs';

drop policy if exists motorista_frota_docs_public_read on storage.objects;
create policy motorista_frota_docs_public_read
on storage.objects for select to public
using (bucket_id = 'motorista-frota-docs');
