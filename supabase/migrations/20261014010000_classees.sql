-- Tables classées: ranked games with strangers, open from level 10 (see packages/engine/src/ranks.ts).
--  * match_queue.ranked: a ranked search is only seated with other ranked searches.
--  * game_rooms.ranked / rooms.ranked: a table made by the ranked queue; it changes ranked points
--    (RP) instead of the casual Elo rating.
--  * ranked_ratings: each player's rank per game and monthly season (public, like a leaderboard).
--  * ranked_changes: what each ranked table did to each player's rank, once per table and person.
--  * ranked_rewards: the end-of-season rewards, taken once per season.
-- Only the `jeux` and `poker` Edge Functions write here (service role).

-- ---------------------------------------------------------------------------
-- The ranked queue and tables

alter table public.match_queue add column ranked boolean not null default false;

-- Ranked and normal searches never meet: the matchmaker reads one kind at a time.
drop index public.match_queue_waiting_idx;
create index match_queue_waiting_idx on public.match_queue (game, size, variant, ranked, joined_at)
  where status = 'waiting';

alter table public.game_rooms add column ranked boolean not null default false;
alter table public.rooms add column ranked boolean not null default false;

-- Only quick tables are ranked: nobody picks their opponents.
alter table public.game_rooms add constraint game_rooms_ranked_quick check (not ranked or visibility = 'quick');
alter table public.rooms add constraint rooms_ranked_quick check (not ranked or visibility = 'quick');

-- ---------------------------------------------------------------------------
-- Ranks

create table public.ranked_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  -- The monthly season, Paris time: "2026-10".
  season text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- 300 per tier, 100 per division; 1500 and more is Maître (hidden while placing).
  points integer not null check (points >= 0),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  -- Games left shielded from demotion after a promotion.
  shield smallint not null default 0 check (shield between 0 and 5),
  -- Placement games left: the rank shows at 0.
  placement smallint not null default 5 check (placement between 0 and 20),
  -- Highest points reached this season once placed, for the season reward.
  peak integer not null default 0 check (peak >= 0),
  -- How the player looked at their last ranked table, for the leaderboard.
  name text check (char_length(name) <= 16),
  avatar text check (char_length(avatar) <= 16),
  avatar_color text check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, game, season)
);

-- The leaderboard of a game and season: placed players, most points first.
create index ranked_ratings_board_idx on public.ranked_ratings (game, season, points desc, updated_at)
  where placement = 0;

create table public.ranked_changes (
  room_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  season text not null,
  delta integer not null,
  points_before integer not null,
  points_after integer not null,
  -- Placement games left after this one.
  placement smallint not null default 0,
  -- The rank reached ("or-2", "maitre") after a promotion or a demotion.
  promoted text,
  demoted text,
  -- 'shield' or 'floor': a loss that did not demote.
  saved text check (saved in ('shield', 'floor')),
  placed boolean not null default false,
  -- The player left the table before the end: a loss.
  forfeit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index ranked_changes_user_idx on public.ranked_changes (user_id, created_at desc);

create table public.ranked_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  season text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tier text not null check (tier in ('bronze', 'argent', 'or', 'platine', 'diamant', 'maitre', 'legende')),
  coins integer not null check (coins >= 0),
  chest text check (chest in ('normal', 'grand')),
  items jsonb not null default '[]',
  claimed_at timestamptz not null default now(),
  primary key (user_id, season)
);

alter table public.ranked_ratings enable row level security;
alter table public.ranked_changes enable row level security;
alter table public.ranked_rewards enable row level security;

-- Ranks are shown at the tables and on the leaderboard: everyone signed in sees them.
create policy "Tout le monde voit les rangs" on public.ranked_ratings
  for select to authenticated using (true);
create policy "Chacun voit ses variations de rang" on public.ranked_changes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Chacun voit ses récompenses de saison" on public.ranked_rewards
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.ranked_ratings, public.ranked_changes, public.ranked_rewards from anon, authenticated;
grant select on public.ranked_ratings, public.ranked_changes, public.ranked_rewards to authenticated;

/**
 * Saves what a ranked table did to one player's rank, once per table: the new state (computed by
 * the server from the state it read) replaces the old one only if nobody changed it meanwhile.
 * p_games is the number of games of the state read, or -1 when there was no row yet.
 * Returns 'ok', 'done' (already saved for this table) or 'conflict' (read again and retry).
 */
create function public.apply_ranked(
  p_room uuid, p_user uuid, p_game text, p_season text, p_games integer, p_state jsonb, p_change jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_games integer;
begin
  if exists (select 1 from public.ranked_changes where room_id = p_room and user_id = p_user) then
    return 'done';
  end if;
  select games into current_games from public.ranked_ratings
  where user_id = p_user and game = p_game and season = p_season
  for update;
  if found then
    if current_games <> p_games then
      return 'conflict';
    end if;
    update public.ranked_ratings
    set points = (p_state ->> 'points')::integer,
        games = (p_state ->> 'games')::integer,
        wins = (p_state ->> 'wins')::integer,
        shield = (p_state ->> 'shield')::smallint,
        placement = (p_state ->> 'placement')::smallint,
        peak = (p_state ->> 'peak')::integer,
        name = coalesce(p_state ->> 'name', name),
        avatar = coalesce(p_state ->> 'avatar', avatar),
        avatar_color = coalesce(p_state ->> 'avatar_color', avatar_color),
        updated_at = now()
    where user_id = p_user and game = p_game and season = p_season;
  else
    if p_games <> -1 then
      return 'conflict';
    end if;
    insert into public.ranked_ratings
      (user_id, game, season, points, games, wins, shield, placement, peak, name, avatar, avatar_color)
    values (
      p_user, p_game, p_season,
      (p_state ->> 'points')::integer, (p_state ->> 'games')::integer, (p_state ->> 'wins')::integer,
      (p_state ->> 'shield')::smallint, (p_state ->> 'placement')::smallint, (p_state ->> 'peak')::integer,
      p_state ->> 'name', p_state ->> 'avatar', p_state ->> 'avatar_color'
    )
    on conflict (user_id, game, season) do nothing;
    if not found then
      return 'conflict';
    end if;
  end if;
  insert into public.ranked_changes
    (room_id, user_id, game, season, delta, points_before, points_after, placement,
     promoted, demoted, saved, placed, forfeit)
  values (
    p_room, p_user, p_game, p_season,
    (p_change ->> 'delta')::integer, (p_change ->> 'points_before')::integer,
    (p_change ->> 'points_after')::integer, coalesce((p_change ->> 'placement')::smallint, 0),
    p_change ->> 'promoted', p_change ->> 'demoted', p_change ->> 'saved',
    coalesce((p_change ->> 'placed')::boolean, false), coalesce((p_change ->> 'forfeit')::boolean, false)
  )
  on conflict (room_id, user_id) do nothing;
  if not found then
    -- Saved meanwhile by another request: undo ours.
    raise exception 'conflict' using errcode = '40001';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.apply_ranked from public, anon, authenticated;
grant execute on function public.apply_ranked to service_role;

/**
 * The reward of a finished season, once: coins, a chest and the trophies (title, frame, card
 * back) the server picked for the best tier reached. Returns false when already taken.
 */
create function public.claim_ranked_reward(
  p_user uuid, p_season text, p_tier text, p_coins integer, p_chest text, p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ranked_rewards (user_id, season, tier, coins, chest, items)
  values (p_user, p_season, p_tier, greatest(p_coins, 0), p_chest, coalesce(p_items, '[]'))
  on conflict (user_id, season) do nothing;
  if not found then
    return false;
  end if;
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.player_progress
  set coins = coins + greatest(p_coins, 0),
      owned = owned || coalesce(
        (select jsonb_agg(i) from jsonb_array_elements(coalesce(p_items, '[]')) i where not owned @> jsonb_build_array(i)),
        '[]'
      ),
      chests = case when p_chest in ('normal', 'grand')
        then chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', p_chest, 'reason', 'classee'))
        else chests end,
      updated_at = now()
  where user_id = p_user;
  return true;
end;
$$;

revoke all on function public.claim_ranked_reward from public, anon, authenticated;
grant execute on function public.claim_ranked_reward to service_role;
