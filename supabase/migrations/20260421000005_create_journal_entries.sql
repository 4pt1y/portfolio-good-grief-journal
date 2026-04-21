create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  loved_one_id uuid references loved_ones on delete set null,
  prompt_id uuid references prompts on delete set null,
  content text not null,
  word_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table journal_entries enable row level security;

create policy "users can view own journal entries"
  on journal_entries for select
  using (auth.uid() = user_id);

create policy "users can insert own journal entries"
  on journal_entries for insert
  with check (auth.uid() = user_id);

create policy "users can update own journal entries"
  on journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own journal entries"
  on journal_entries for delete
  using (auth.uid() = user_id);

create index journal_entries_user_id_idx on journal_entries (user_id);
create index journal_entries_loved_one_id_idx on journal_entries (loved_one_id);
create index journal_entries_prompt_id_idx on journal_entries (prompt_id);
create index journal_entries_created_at_idx on journal_entries (created_at desc);

create trigger journal_entries_updated_at
  before update on journal_entries
  for each row execute function handle_updated_at();

-- Increment/decrement loved_ones.entry_count on insert/delete
create or replace function update_loved_one_entry_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.loved_one_id is not null then
    update loved_ones set entry_count = entry_count + 1 where id = new.loved_one_id;
  elsif tg_op = 'DELETE' and old.loved_one_id is not null then
    update loved_ones set entry_count = greatest(entry_count - 1, 0) where id = old.loved_one_id;
  elsif tg_op = 'UPDATE' then
    if old.loved_one_id is distinct from new.loved_one_id then
      if old.loved_one_id is not null then
        update loved_ones set entry_count = greatest(entry_count - 1, 0) where id = old.loved_one_id;
      end if;
      if new.loved_one_id is not null then
        update loved_ones set entry_count = entry_count + 1 where id = new.loved_one_id;
      end if;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger journal_entries_entry_count
  after insert or update or delete on journal_entries
  for each row execute function update_loved_one_entry_count();
