create type prompt_difficulty as enum ('easy', 'medium', 'hard');

create table prompts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references prompt_categories on delete cascade,
  text text not null,
  description text,
  difficulty prompt_difficulty not null default 'medium',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table prompts enable row level security;

create policy "prompts are publicly readable"
  on prompts for select
  using (true);

create index prompts_category_id_idx on prompts (category_id);
create index prompts_display_order_idx on prompts (display_order);
