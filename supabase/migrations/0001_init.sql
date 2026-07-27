-- 75 Create server schema. Rows mirror the local-first shapes 1:1 (JSONB
-- blobs), so sync is simple last-write-wins per row keyed by updated_at.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  tz text not null default 'UTC',
  late_night_buffer_hrs int not null default 3,
  reminder_time text, -- "HH:MM" local time, null = reminders off
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid () = id) with check (auth.uid () = id);

-- ---------- challenges ----------
create table public.challenges (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null, -- the full Challenge object (src/lib/types.ts)
  updated_at timestamptz not null default now()
);

create index challenges_user_idx on public.challenges (user_id);

alter table public.challenges enable row level security;

create policy "own challenges" on public.challenges
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- ---------- day data ----------
create table public.day_data (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null, -- the full DayData blob (src/lib/repository.ts)
  updated_at timestamptz not null default now()
);

create index day_data_user_idx on public.day_data (user_id);

alter table public.day_data enable row level security;

create policy "own day data" on public.day_data
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- ---------- artifact images ----------
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false);

create policy "own artifact objects" on storage.objects
  for all using (
    bucket_id = 'artifacts'
    and (storage.foldername (name))[1] = auth.uid ()::text
  )
  with check (
    bucket_id = 'artifacts'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );
