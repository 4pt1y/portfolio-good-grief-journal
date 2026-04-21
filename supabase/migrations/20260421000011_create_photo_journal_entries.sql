create table photo_journal_entries (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos on delete cascade,
  journal_entry_id uuid not null references journal_entries on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, journal_entry_id)
);

alter table photo_journal_entries enable row level security;

create policy "users can view own photo journal entries"
  on photo_journal_entries for select
  using (
    exists (
      select 1 from journal_entries
      where journal_entries.id = photo_journal_entries.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create policy "users can insert own photo journal entries"
  on photo_journal_entries for insert
  with check (
    exists (
      select 1 from journal_entries
      where journal_entries.id = photo_journal_entries.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create policy "users can delete own photo journal entries"
  on photo_journal_entries for delete
  using (
    exists (
      select 1 from journal_entries
      where journal_entries.id = photo_journal_entries.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create index photo_journal_entries_photo_id_idx on photo_journal_entries (photo_id);
create index photo_journal_entries_journal_entry_id_idx on photo_journal_entries (journal_entry_id);
