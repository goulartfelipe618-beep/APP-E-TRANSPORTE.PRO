-- Logos enviadas no briefing do Website (motorista autenticado).
insert into storage.buckets (id, name, public)
values ('website-briefing', 'website-briefing', true)
on conflict (id) do nothing;

drop policy if exists website_briefing_public_read on storage.objects;
create policy website_briefing_public_read
on storage.objects for select to public
using (bucket_id = 'website-briefing');

drop policy if exists website_briefing_auth_insert on storage.objects;
create policy website_briefing_auth_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-briefing'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists website_briefing_auth_update on storage.objects;
create policy website_briefing_auth_update
on storage.objects for update to authenticated
using (
  bucket_id = 'website-briefing'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'website-briefing'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists website_briefing_auth_delete on storage.objects;
create policy website_briefing_auth_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-briefing'
  and split_part(name, '/', 1) = (select auth.uid())::text
);
