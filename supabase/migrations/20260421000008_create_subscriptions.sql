create type subscription_status as enum ('trialing', 'active', 'cancelled');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  status subscription_status not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "users can view own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

create policy "users can insert own subscription"
  on subscriptions for insert
  with check (auth.uid() = user_id);

create policy "users can update own subscription"
  on subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index subscriptions_user_id_idx on subscriptions (user_id);
create index subscriptions_stripe_customer_id_idx on subscriptions (stripe_customer_id);
create index subscriptions_stripe_subscription_id_idx on subscriptions (stripe_subscription_id);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function handle_updated_at();
