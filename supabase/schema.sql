-- Paste once into the Supabase SQL editor. The browser talks to the database directly with the
-- public key, so the policies below are the only access control.
create table tabs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  file text not null,  -- path in the `tabs` bucket: <user id>/<uuid>.<ext>
  title text, artist text, tuning text, tempo int,
  tags text not null default '',
  added_at timestamptz not null default now());
create table fingerings (
  tab_id bigint not null references tabs on delete cascade,
  track int not null, changes jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tab_id, track));
create table exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text, goal text, technique text, alphatex text not null,
  start_bpm int, target_bpm int, current_bpm int,
  drill text not null, level int not null,
  created_at timestamptz not null default now(),
  unique (user_id, drill, level));  -- the browser seeds and unlocks levels; a double insert fails instead of duplicating
create table sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tab_id bigint references tabs on delete set null,
  exercise_id bigint references exercises on delete set null,
  bars text, bpm int, target_bpm int, rating int, notes text,
  at timestamptz not null default now());
create index on tabs (user_id);
create index on sessions (user_id, at desc);
create index on sessions (tab_id);
create index on sessions (exercise_id);

alter table tabs enable row level security;
alter table fingerings enable row level security;
alter table exercises enable row level security;
alter table sessions enable row level security;
-- on a `for all` policy, `using` is also the `with check`: rows can't be created for, or handed to, someone else
create policy own on tabs for all to authenticated using (user_id = (select auth.uid()));
create policy own on exercises for all to authenticated using (user_id = (select auth.uid()));
create policy own on sessions for all to authenticated using (user_id = (select auth.uid()));
-- no owner column: a fingering belongs to whoever owns its tab, so nobody can claim another user's (tab_id, track)
create policy own on fingerings for all to authenticated
  using (exists (select 1 from tabs where tabs.id = fingerings.tab_id and tabs.user_id = (select auth.uid())));

-- newer projects grant nothing by default, older ones grant to signed-out visitors too
revoke all on tabs, fingerings, exercises, sessions from anon;
grant select, insert, update, delete on tabs, fingerings, exercises, sessions to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit) values ('tabs', 'tabs', false, 2097152);
-- one folder per user; no update policy, so files are never overwritten or moved
create policy "tabs read own" on storage.objects for select to authenticated
  using (bucket_id = 'tabs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tabs add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'tabs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.extension(name) in ('gp3', 'gp4', 'gp5', 'gpx', 'gp'));
create policy "tabs delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'tabs' and (storage.foldername(name))[1] = (select auth.uid())::text);
