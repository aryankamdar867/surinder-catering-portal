-- =============================================================================
-- Surinder Caterers – let admins see dish-images objects through the API.
--
-- Storage's delete (and list) only act on objects the caller can SELECT. Without
-- this policy, admin deletes silently removed nothing, leaving orphaned files when
-- a dish photo was replaced or a dish deleted. Public image URLs do not use this
-- policy (the bucket is public), so customers still cannot list the bucket.
-- =============================================================================

drop policy if exists "dish-images: admin select" on storage.objects;

create policy "dish-images: admin select"
  on storage.objects for select to authenticated
  using (bucket_id = 'dish-images' and (select public.is_admin()));
