create type memory_book_status as enum ('generating', 'complete', 'failed');

create table memory_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  loved_one_id uuid references loved_ones on delete set null,
  title text not null,
  pdf_url text,
  status memory_book_status not null default 'generating',
  created_at timestamptz not null default now()
);

alter table memory_books enable row level security;

create policy "users can view own memory books"
  on memory_books for select
  using (auth.uid() = user_id);

create policy "users can insert own memory books"
  on memory_books for insert
  with check (auth.uid() = user_id);

create policy "users can update own memory books"
  on memory_books for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own memory books"
  on memory_books for delete
  using (auth.uid() = user_id);

create index memory_books_user_id_idx on memory_books (user_id);
create index memory_books_loved_one_id_idx on memory_books (loved_one_id);
