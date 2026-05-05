-- Create the photos storage bucket with public read access
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Authenticated users can upload into their own folder
create policy "users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access so URLs work without tokens
create policy "photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Users can delete only their own files
create policy "users can delete own photo files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
