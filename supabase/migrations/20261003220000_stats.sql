-- Player profiles, finished hands and results, for statistics and hand history.
-- Only the `poker` Edge Function writes here; players read through the policies
-- and the `player_stats` function below.

-- Name and avatar last used by each player, to show them in rankings.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  avatar text,
  avatar_color text,
  updated_at timestamptz not null default now()
);

-- Every finished hand as everyone at the table saw it (cards shown at showdown only).
create table public.hand_history (
  room_id uuid not null references public.rooms (id) on delete cascade,
  hand_number integer not null,
  summary jsonb not null,
  finished_at timestamptz not null default now(),
  primary key (room_id, hand_number)
);

-- One row per player and hand. Kept without a link to rooms so statistics
-- survive if a table is ever deleted.
create table public.hand_results (
  room_id uuid not null,
  hand_number integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  net integer not null,
  won boolean not null,
  best_pot integer not null,
  finished_at timestamptz not null default now(),
  primary key (room_id, hand_number, user_id)
);

create index hand_results_user_id_idx on public.hand_results (user_id);

-- Who won each game (the last player with chips).
create table public.game_results (
  room_id uuid primary key,
  winner_id uuid not null references auth.users (id) on delete cascade,
  players integer not null,
  tournament boolean not null,
  finished_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.hand_history enable row level security;
alter table public.hand_results enable row level security;
alter table public.game_results enable row level security;

create policy "Les membres voient l'historique" on public.hand_history
  for select to authenticated using (public.is_room_member(room_id));

revoke all on public.profiles, public.hand_history, public.hand_results, public.game_results
  from anon, authenticated;
grant select on public.hand_history to authenticated;

-- Statistics for me and for everyone I have played a hand with.
create function public.player_stats()
returns table (
  user_id uuid,
  name text,
  avatar text,
  avatar_color text,
  is_me boolean,
  hands_played integer,
  hands_won integer,
  net integer,
  best_pot integer,
  games_played integer,
  games_won integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  people as (
    select me.id as user_id from me
    union
    select other.user_id
    from public.hand_results mine
    join public.hand_results other
      on other.room_id = mine.room_id and other.hand_number = mine.hand_number
    where mine.user_id = (select id from me)
  )
  select
    people.user_id,
    coalesce(pr.name, 'Joueur'),
    pr.avatar,
    pr.avatar_color,
    people.user_id = (select id from me),
    coalesce(r.hands_played, 0)::integer,
    coalesce(r.hands_won, 0)::integer,
    coalesce(r.net, 0)::integer,
    coalesce(r.best_pot, 0)::integer,
    coalesce(r.games_played, 0)::integer,
    coalesce(g.games_won, 0)::integer
  from people
  left join public.profiles pr on pr.user_id = people.user_id
  left join lateral (
    select
      count(*) as hands_played,
      count(*) filter (where hr.won) as hands_won,
      sum(hr.net) as net,
      max(hr.best_pot) as best_pot,
      count(distinct hr.room_id) as games_played
    from public.hand_results hr
    where hr.user_id = people.user_id
  ) r on true
  left join lateral (
    select count(*) as games_won from public.game_results gr where gr.winner_id = people.user_id
  ) g on true
  where people.user_id is not null;
$$;

revoke all on function public.player_stats from public, anon;
grant execute on function public.player_stats to authenticated;
