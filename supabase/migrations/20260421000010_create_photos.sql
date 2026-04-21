create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  loved_one_id uuid references loved_ones on delete set null,
  url text not null,
  thumbnail_url text,
  caption text,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

alter table photos enable row level security;

create policy "users can view own photos"
  on photos for select
  using (auth.uid() = user_id);

create policy "users can insert own photos"
  on photos for insert
  with check (auth.uid() = user_id);

create policy "users can update own photos"
  on photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own photos"
  on photos for delete
  using (auth.uid() = user_id);

create index photos_user_id_idx on photos (user_id);
create index photos_loved_one_id_idx on photos (loved_one_id);
create index photos_created_at_idx on photos (created_at desc);
