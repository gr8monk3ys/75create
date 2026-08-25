-- Hardening pass over the 0001 schema.
--
-- 1. updated_at is owned by the database, not the client.
-- 2. RLS policies are scoped to authenticated users rather than every role.
-- 3. Reminder lookups get an index, so the emailer doesn't table-scan.

-- ---------- updated_at belongs to the server ----------
-- Every updated_at was previously generated in the browser and sent up. A
-- device with a skewed clock therefore won every last-write-wins comparison
-- from then on, discarding correct edits from every other device. The trigger
-- overwrites whatever the client sends, so skew can no longer decide who wins.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before insert or update on public.profiles
  for each row execute function public.set_updated_at();

create trigger challenges_set_updated_at
  before insert or update on public.challenges
  for each row execute function public.set_updated_at();

create trigger day_data_set_updated_at
  before insert or update on public.day_data
  for each row execute function public.set_updated_at();

-- ---------- scope policies to authenticated users ----------
-- `for all` with no `to` clause applies to every role, including anon. The
-- auth.uid() check makes anon fail anyway, but saying so explicitly keeps the
-- intent readable and stops an anon request from being evaluated at all.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (auth.uid () = id) with check (auth.uid () = id);

drop policy if exists "own challenges" on public.challenges;
create policy "own challenges" on public.challenges
  for all to authenticated
  using (auth.uid () = user_id) with check (auth.uid () = user_id);

drop policy if exists "own day data" on public.day_data;
create policy "own day data" on public.day_data
  for all to authenticated
  using (auth.uid () = user_id) with check (auth.uid () = user_id);

drop policy if exists "own artifact objects" on storage.objects;
create policy "own artifact objects" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername (name))[1] = auth.uid ()::text
  )
  with check (
    bucket_id = 'artifacts'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- ---------- reminder lookups ----------
-- The emailer pages through everyone with a reminder set, every 15 minutes.
create index if not exists profiles_reminder_idx
  on public.profiles (id)
  where reminder_time is not null;
