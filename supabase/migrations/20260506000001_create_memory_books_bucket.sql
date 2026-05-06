-- Private bucket — files are read via signed URLs only
insert into storage.buckets (id, name, public)
values ('memory-books', 'memory-books', false)
on conflict (id) do nothing;

-- Owner-only read
create policy "users can read own memory books"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memory-books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner-only upload (the API route uses the user's authed client)
create policy "users can upload own memory books"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memory-books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner-only update (upsert overwrites prior PDF for the same loved one)
create policy "users can update own memory books"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'memory-books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete own memory books"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memory-books'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
