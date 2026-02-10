begin;

alter table public.menu_items
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-item-images',
  'menu-item-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "menu_item_images_select" on storage.objects;
create policy "menu_item_images_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'menu-item-images');

drop policy if exists "menu_item_images_insert" on storage.objects;
create policy "menu_item_images_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'menu-item-images');

drop policy if exists "menu_item_images_update" on storage.objects;
create policy "menu_item_images_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'menu-item-images')
with check (bucket_id = 'menu-item-images');

drop policy if exists "menu_item_images_delete" on storage.objects;
create policy "menu_item_images_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'menu-item-images');

commit;
