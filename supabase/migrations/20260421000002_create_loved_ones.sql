create table loved_ones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  relationship text,
  pronouns text,
  date_of_birth date,
  date_of_passing date,
  photo_url text,
  entry_count int not null default 0,
  is_primary bool not null default false,
  created_at timestamptz not null default now()
);

alter table loved_ones enable row level security;

create policy "users can view own loved ones"
  on loved_ones for select
  using (auth.uid() = user_id);

create policy "users can insert own loved ones"
  on loved_ones for insert
  with check (auth.uid() = user_id);

create policy "users can update own loved ones"
  on loved_ones for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own loved ones"
  on loved_ones for delete
  using (auth.uid() = user_id);

create index loved_ones_user_id_idx on loved_ones (user_id);
