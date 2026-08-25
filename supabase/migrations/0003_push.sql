-- Web Push subscriptions.
--
-- Browser notifications only fire while the app is open, and iOS Safari doesn't
-- implement the Notification constructor at all — so for a daily streak product
-- the in-page reminder never reaches the people who most need it. Push is
-- delivered by the browser's push service whether or not the app is running,
-- and works in an installed PWA on iOS 16.4+.
--
-- One row per browser/device: the same account legitimately has several.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set when the push service reports the subscription is gone, so a bad
  -- endpoint isn't retried forever.
  failed_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (auth.uid () = user_id) with check (auth.uid () = user_id);

create trigger push_subscriptions_set_updated_at
  before insert or update on public.push_subscriptions
  for each row execute function public.set_updated_at();
