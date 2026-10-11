-- Partie rapide: playing online with strangers.
--  * match_queue: who is searching for a game right now (one search per player).
--  * game_rooms.visibility / rooms.visibility: private (friends with the code, the default),
--    public (listed in "Tables ouvertes") or quick (made by the matchmaker).
--  * game_ratings / rating_changes: an Elo rating per player and game, changed only by tables
--    open to strangers (public and quick).
--  * player_blocks: a blocked player is never seated with the one who blocked them again.
-- Only the `jeux` and `poker` Edge Functions write here (service role); players read their own rows.

-- ---------------------------------------------------------------------------
-- Tables open to strangers

alter table public.game_rooms
  add column visibility text not null default 'private'
    check (visibility in ('private', 'public', 'quick'));
alter table public.rooms
  add column visibility text not null default 'private'
    check (visibility in ('private', 'public', 'quick'));

-- "Tables ouvertes": public tables still in the lobby, newest first.
create index game_rooms_open_idx on public.game_rooms (created_at desc)
  where visibility = 'public' and status = 'lobby';
create index rooms_open_idx on public.rooms (created_at desc)
  where visibility = 'public' and status = 'lobby';

-- ---------------------------------------------------------------------------
-- The queue

create table public.match_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- poker or any online game: new games need no change here.
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  size smallint not null check (size between 2 and 8),
  variant text not null default '' check (char_length(variant) <= 20),
  -- Rating in this game and level when the search started, to seat players of close strength.
  rating integer not null default 1000,
  level integer not null default 1,
  name text not null check (char_length(name) between 1 and 16),
  avatar text,
  avatar_color text,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'left')),
  joined_at timestamptz not null default now(),
  -- Every few seconds the waiting phone says it is still there; a silent row is a ghost.
  last_seen timestamptz not null default now(),
  -- The table found: room_id once the seats are taken, room_code once it can be played.
  room_id uuid,
  room_code text,
  -- Searches started since joins_since, for the rate limit.
  joins integer not null default 1,
  joins_since timestamptz not null default now()
);

-- The matchmaker reads the players waiting for one game, table size and variant.
create index match_queue_waiting_idx on public.match_queue (game, size, variant, joined_at)
  where status = 'waiting';
create index match_queue_last_seen_idx on public.match_queue (last_seen);

alter table public.match_queue enable row level security;

create policy "Chacun voit sa recherche" on public.match_queue
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.match_queue from anon, authenticated;
grant select on public.match_queue to authenticated;

/**
 * Seats a group: takes all these players out of the queue for one table, or none of them if
 * one stopped searching, went silent or was seated elsewhere meanwhile (two requests pairing at
 * the same moment cannot seat a player twice).
 */
create function public.quick_claim(p_users uuid[], p_room uuid, p_stale_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed integer;
begin
  update public.match_queue
  set status = 'matched', room_id = p_room, room_code = null
  where user_id = any (p_users)
    and status = 'waiting'
    and last_seen > now() - make_interval(secs => p_stale_seconds);
  get diagnostics claimed = row_count;
  if claimed <> cardinality(p_users) then
    raise exception 'conflict' using errcode = '40001';
  end if;
  return true;
end;
$$;

revoke all on function public.quick_claim from public, anon, authenticated;
grant execute on function public.quick_claim to service_role;

-- ---------------------------------------------------------------------------
-- Ratings

create table public.game_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  rating integer not null default 1000 check (rating >= 100),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

-- One row per person and rated table: a table counted twice changes ratings once.
create table public.rating_changes (
  room_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  delta integer not null,
  rating_after integer,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index rating_changes_user_idx on public.rating_changes (user_id, created_at desc);

alter table public.game_ratings enable row level security;
alter table public.rating_changes enable row level security;

-- Strangers see each other's pseudo, avatar and level only: a rating is for its owner.
create policy "Chacun voit ses cotes" on public.game_ratings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Chacun voit ses variations de cote" on public.rating_changes
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.game_ratings, public.rating_changes from anon, authenticated;
grant select on public.game_ratings, public.rating_changes to authenticated;

/**
 * Applies the rating changes of a finished table, once: [{ user_id, delta, won }]. Changes are
 * added to the current rating (two tables ending together both count), never below 100.
 */
create function public.apply_ratings(p_room uuid, p_game text, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  after_rating integer;
begin
  for c in select * from jsonb_to_recordset(p_changes) as x(user_id uuid, delta integer, won boolean) loop
    insert into public.rating_changes (room_id, user_id, game, delta)
    values (p_room, c.user_id, p_game, c.delta)
    on conflict (room_id, user_id) do nothing;
    if not found then
      continue;
    end if;
    insert into public.game_ratings as g (user_id, game, rating, games, wins)
    values (c.user_id, p_game, greatest(100, 1000 + c.delta), 1, case when c.won then 1 else 0 end)
    on conflict (user_id, game) do update
      set rating = greatest(100, g.rating + c.delta),
          games = g.games + 1,
          wins = g.wins + case when c.won then 1 else 0 end,
          updated_at = now()
    returning rating into after_rating;
    update public.rating_changes set rating_after = after_rating
    where room_id = p_room and user_id = c.user_id;
  end loop;
end;
$$;

revoke all on function public.apply_ratings from public, anon, authenticated;
grant execute on function public.apply_ratings to service_role;

-- ---------------------------------------------------------------------------
-- Blocks

create table public.player_blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Any account; no link so a removed account leaves nothing behind for the other.
  blocked_id uuid not null,
  -- What the blocker saw of them, to recognize them in the list.
  name text check (char_length(name) <= 16),
  avatar text,
  avatar_color text,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

-- "Who blocked me" is read when seating players and listing public tables.
create index player_blocks_blocked_idx on public.player_blocks (blocked_id);

alter table public.player_blocks enable row level security;

create policy "Chacun voit qui il a bloqué" on public.player_blocks
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.player_blocks from anon, authenticated;
grant select on public.player_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- Chat at poker tables open to strangers: quick phrases and emoji only, no free text. The
-- phrases are those of the chat panel, in French and in English.

create function public.stranger_chat_allowed(p_room uuid, p_body text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.visibility = 'private' from public.rooms r where r.id = p_room),
    true
  )
  or btrim(p_body) in (
    'Bien joué ! 👏', 'Allez ! 🔥', 'Je bluffe pas 😏', 'Trop de chance 😅', 'GG 🤝', 'Dépêche ⏰',
    'Nice play! 👏', 'Come on! 🔥', 'Not bluffing 😏', 'So lucky 😅', 'Hurry up ⏰'
  )
  -- Emoji only: no letter and no digit.
  or btrim(p_body) !~ '[[:alnum:]]';
$$;

revoke all on function public.stranger_chat_allowed from public, anon;
grant execute on function public.stranger_chat_allowed to authenticated;

drop policy "Les membres écrivent sous leur nom" on public.room_messages;
create policy "Les membres écrivent sous leur nom" on public.room_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id)
    and public.stranger_chat_allowed(room_id, body)
  );
