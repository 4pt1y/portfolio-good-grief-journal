create table prompt_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  color text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table prompt_categories enable row level security;

create policy "prompt categories are publicly readable"
  on prompt_categories for select
  using (true);

create index prompt_categories_slug_idx on prompt_categories (slug);
create index prompt_categories_display_order_idx on prompt_categories (display_order);

insert into prompt_categories (name, slug, description, display_order) values
  ('Sadness',       'sadness',       'Express and process feelings of grief and sorrow',   1),
  ('Memories',      'memories',      'Revisit and cherish meaningful moments together',    2),
  ('Hard Emotions', 'hard-emotions', 'Acknowledge and work through difficult feelings',    3),
  ('Small Steps',   'small-steps',   'Take gentle steps forward at your own pace',         4),
  ('Acceptance',    'acceptance',    'Move toward peace and finding meaning after loss',   5);
