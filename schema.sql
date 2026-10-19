-- D1 (SQLite) schema. Apply with: npx wrangler d1 execute guitarhub --remote --file=schema.sql (or --local for dev).
-- `user_id` is the Cloudflare Access email. The browser never sets it: functions/api fills it in and filters on it,
-- so every user only ever sees their own rows.
create table tabs (
  id integer primary key autoincrement,  -- never reused: old sessions point at deleted ids
  user_id text not null,
  title text, artist text, tuning text, tempo integer,
  tags text not null default '',
  added_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
-- the Guitar Pro file itself is in KV under `<user_id>/<tab id>`
create table fingerings (
  user_id text not null,
  tab_id integer not null,
  track integer not null,
  changes text not null,  -- JSON
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, tab_id, track));  -- user_id first: replacing a row can't touch another user's fingering
create table exercises (
  id integer primary key autoincrement,  -- never reused: old sessions point at deleted ids
  user_id text not null,
  title text, goal text, technique text, alphatex text not null,
  start_bpm integer, target_bpm integer, current_bpm integer,
  drill text not null, level integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (user_id, drill, level));  -- the browser seeds and unlocks levels; a double insert is ignored instead of duplicating
create table sessions (
  id integer primary key autoincrement,
  user_id text not null,
  tab_id integer,       -- a deleted tab or exercise leaves its sessions on the calendar
  exercise_id integer,
  bars text, bpm integer, target_bpm integer, rating integer, notes text,
  activity text,  -- what was practised when it's neither a tab nor an exercise, e.g. the fretboard note trainer
  at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
create index tabs_user on tabs (user_id);
create index sessions_user on sessions (user_id, at desc);
create index sessions_tab on sessions (tab_id);
