create table crisis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  journal_entry_id uuid references journal_entries on delete set null,
  trigger_phrase text,
  created_at timestamptz not null default now()
);

alter table crisis_events enable row level security;

create policy "users can view own crisis events"
  on crisis_events for select
  using (auth.uid() = user_id);

create policy "users can insert own crisis events"
  on crisis_events for insert
  with check (auth.uid() = user_id);

create index crisis_events_user_id_idx on crisis_events (user_id);
create index crisis_events_journal_entry_id_idx on crisis_events (journal_entry_id);
create index crisis_events_created_at_idx on crisis_events (created_at desc);
