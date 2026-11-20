-- =============================================================================
-- Surinder Caterers – Storage
-- dish-images: publicly readable (images are shown on menus); admins upload.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dish-images',
  'dish-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "dish-images: admin upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dish-images' and (select public.is_admin()));

create policy "dish-images: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'dish-images' and (select public.is_admin()))
  with check (bucket_id = 'dish-images' and (select public.is_admin()));

create policy "dish-images: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dish-images' and (select public.is_admin()));
