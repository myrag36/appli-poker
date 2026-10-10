-- The Friday tournament: every Friday at 21:00 (Paris time), a knockout bracket on one online
-- game chosen in turn. One row per Friday, made by the `jeux` server the first time someone looks
-- at it or signs up. No timer runs on the server: the first request after the start time builds
-- the bracket, and each table that ends moves the bracket on (see supabase/functions/jeux).
-- Only the `jeux` server writes here; every signed-in player may read, as the bracket and the
-- hall of fame are public.

create table public.weekly_tournaments (
  id uuid primary key default gen_random_uuid(),
  -- The Friday ("YYYY-MM-DD", Paris) and when it starts.
  friday date not null unique,
  starts_at timestamptz not null,
  -- Any online game: new games need no change here.
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  status text not null default 'open' check (status in ('open', 'running', 'finished', 'cancelled')),
  -- The bracket (rounds of matches, see packages/engine/src/weekly.ts), once started.
  bracket jsonb,
  -- Every change of the bracket is checked against this, so two requests never undo each other.
  version integer not null default 0,
  -- The "starts in 10 minutes" notice was sent.
  reminded boolean not null default false,
  winner_id uuid,
  winner_name text,
  winner_avatar text,
  winner_avatar_color text,
  winner_bot boolean,
  players integer not null default 0,
  -- The champion's coins and title were given (once).
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index weekly_tournaments_status on public.weekly_tournaments (status, starts_at);

create table public.weekly_registrations (
  tournament_id uuid not null references public.weekly_tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  avatar text,
  avatar_color text,
  registered_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

-- The table of a match: one per match, even when two requests open it at the same moment.
alter table public.game_rooms
  add column weekly_id uuid references public.weekly_tournaments (id) on delete set null,
  add column weekly_match text,
  add constraint game_rooms_weekly_match unique (weekly_id, weekly_match);

alter table public.weekly_tournaments enable row level security;
alter table public.weekly_registrations enable row level security;
create policy "Tout le monde voit les tournois du vendredi" on public.weekly_tournaments
  for select to authenticated using (true);
create policy "Tout le monde voit les inscrits" on public.weekly_registrations
  for select to authenticated using (true);
revoke all on public.weekly_tournaments, public.weekly_registrations from anon, authenticated;
grant select on public.weekly_tournaments, public.weekly_registrations to authenticated;

-- The champion's reward, given once: coins, the champion title and the trophy (a feat that
-- unlocks the "Champion du vendredi" achievement). Returns false when already given.
create function public.weekly_reward(p_tournament uuid, p_user uuid, p_coins integer, p_title text, p_feat text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.weekly_tournaments
  set rewarded = true
  where id = p_tournament and winner_id = p_user and not rewarded;
  if not found then
    return false;
  end if;
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.player_progress
  set coins = coins + p_coins,
      owned = case when owned ? p_title then owned else owned || to_jsonb(p_title) end,
      feats = case when feats ? p_feat then feats else feats || to_jsonb(p_feat) end
  where user_id = p_user;
  return true;
end;
$$;

revoke all on function public.weekly_reward from public, anon, authenticated;
grant execute on function public.weekly_reward to service_role;

alter publication supabase_realtime add table public.weekly_tournaments, public.weekly_registrations;
