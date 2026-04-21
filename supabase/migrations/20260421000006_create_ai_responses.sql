create table ai_responses (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries on delete cascade,
  content text not null,
  model_used text,
  created_at timestamptz not null default now()
);

alter table ai_responses enable row level security;

create policy "users can view own ai responses"
  on ai_responses for select
  using (
    exists (
      select 1 from journal_entries
      where journal_entries.id = ai_responses.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create policy "users can insert own ai responses"
  on ai_responses for insert
  with check (
    exists (
      select 1 from journal_entries
      where journal_entries.id = ai_responses.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create policy "users can delete own ai responses"
  on ai_responses for delete
  using (
    exists (
      select 1 from journal_entries
      where journal_entries.id = ai_responses.journal_entry_id
        and journal_entries.user_id = auth.uid()
    )
  );

create index ai_responses_journal_entry_id_idx on ai_responses (journal_entry_id);
