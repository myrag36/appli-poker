-- Friends, the weekly ranking between friends, and tournaments over several games.

-- Each player gets a friend code; their name and avatar for the rankings live in profiles.
alter table public.player_progress
  add column friend_code text unique,
  -- Experience and wins of the current week (Monday, Paris time) and of the one before.
  add column week_start date,
  add column week_xp integer not null default 0,
  add column week_wins integer not null default 0,
  add column last_week_start date,
  add column last_week_xp integer not null default 0,
  -- Week whose podium reward was already taken.
  add column podium_claimed date;

create table public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;
create policy "Chacun voit ses amis" on public.friendships
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

-- Names and avatars are shown in friends' rankings and tournaments.
create policy "Tout le monde voit les profils" on public.profiles
  for select to authenticated using (true);
grant select on public.profiles to authenticated;

-- Monday of the current week in Paris.
create function public.paris_week()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', (now() at time zone 'Europe/Paris'))::date;
$$;

-- Counts this week's experience and wins whenever experience is given.
create function public.count_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  monday date := public.paris_week();
  won_before integer;
  won_after integer;
begin
  if new.xp <= old.xp then
    return new;
  end if;
  if new.week_start is distinct from monday then
    new.last_week_start := monday - 7;
    new.last_week_xp := case when new.week_start = monday - 7 then new.week_xp else 0 end;
    new.week_start := monday;
    new.week_xp := 0;
    new.week_wins := 0;
  end if;
  select coalesce(sum((value ->> 'won')::int), 0) into won_before from jsonb_each(old.games);
  select coalesce(sum((value ->> 'won')::int), 0) into won_after from jsonb_each(new.games);
  new.week_xp := new.week_xp + (new.xp - old.xp);
  new.week_wins := new.week_wins + greatest(0, won_after - won_before);
  return new;
end;
$$;

create trigger count_week before update of xp on public.player_progress
  for each row execute function public.count_week();

-- Me and my friends, with this week's experience and wins, best first.
create function public.friends_board()
returns table (
  user_id uuid,
  name text,
  avatar text,
  avatar_color text,
  xp integer,
  equipped jsonb,
  owned jsonb,
  week_xp integer,
  week_wins integer,
  streak integer,
  me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select (select auth.uid()) as id
    union
    select friend_id from public.friendships where user_id = (select auth.uid())
  )
  select p.id, coalesce(pr.name, 'Joueur'), pr.avatar, pr.avatar_color,
         coalesce(g.xp, 0), coalesce(g.equipped, '{}'), coalesce(g.owned, '[]'),
         case when g.week_start = public.paris_week() then g.week_xp else 0 end,
         case when g.week_start = public.paris_week() then g.week_wins else 0 end,
         case when g.last_day >= (now() at time zone 'Europe/Paris')::date - 1 then g.streak else 0 end,
         p.id = (select auth.uid())
  from people p
  left join public.profiles pr on pr.user_id = p.id
  left join public.player_progress g on g.user_id = p.id
  order by 8 desc, 5 desc;
$$;

revoke all on function public.friends_board from public, anon;
grant execute on function public.friends_board to authenticated;

-- Last week's experience of me and my friends, to give the podium.
create function public.last_week_board(p_user uuid)
returns table (user_id uuid, xp integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.user_id,
         case
           when g.week_start = public.paris_week() - 7 then g.week_xp
           when g.last_week_start = public.paris_week() - 7 then g.last_week_xp
           else 0
         end
  from public.player_progress g
  where g.user_id = p_user
     or g.user_id in (select friend_id from public.friendships where user_id = p_user);
$$;

-- Takes last week's podium reward among friends, once.
create function public.claim_podium(p_user uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  monday date := public.paris_week();
begin
  update public.player_progress
  set podium_claimed = monday,
      chests = chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', p_kind, 'reason', 'podium'))
  where user_id = p_user and podium_claimed is distinct from monday;
  if not found then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.last_week_board from public, anon, authenticated;
revoke all on function public.claim_podium from public, anon, authenticated;
grant execute on function public.last_week_board to service_role;
grant execute on function public.claim_podium to service_role;

-- Tournaments: friends play several online games in a row and add up points.
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 1 and 30),
  host_id uuid not null references auth.users (id) on delete cascade,
  games text[] not null check (array_length(games, 1) between 1 and 8),
  status text not null default 'open' check (status in ('open', 'playing', 'finished')),
  -- The game being played (index in games) and its table, once the host opened it.
  round integer not null default 0,
  room_id uuid,
  room_code text,
  created_at timestamptz not null default now()
);

create table public.tournament_players (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  avatar text,
  avatar_color text,
  points integer not null default 0,
  wins integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.game_rooms
  add column tournament_id uuid references public.tournaments (id) on delete set null,
  add column tournament_round integer;

create function public.is_tournament_member(p_tournament uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_players
    where tournament_id = p_tournament and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_tournament_member from public, anon;
grant execute on function public.is_tournament_member to authenticated;

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
create policy "Les joueurs voient leur tournoi" on public.tournaments
  for select to authenticated using (public.is_tournament_member(id));
create policy "Les joueurs voient le classement" on public.tournament_players
  for select to authenticated using (public.is_tournament_member(tournament_id));
revoke all on public.tournaments, public.tournament_players from anon, authenticated;
grant select on public.tournaments, public.tournament_players to authenticated;

-- A tournament table just finished: 3 points to its winners, 1 to the others, then the
-- next game (or the end, with a big chest for the champion).
create function public.tournament_round_done(p_room uuid, p_results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
  r jsonb;
  best integer;
begin
  select tr.* into t from public.tournaments tr
    join public.game_rooms g on g.tournament_id = tr.id and g.tournament_round = tr.round
    where g.id = p_room and tr.room_id = p_room
    for update of tr;
  if not found then
    return;
  end if;
  for r in select * from jsonb_array_elements(p_results) loop
    update public.tournament_players
    set points = points + case when (r ->> 'won')::boolean then 3 else 1 end,
        wins = wins + case when (r ->> 'won')::boolean then 1 else 0 end
    where tournament_id = t.id and user_id = (r ->> 'userId')::uuid;
  end loop;
  if t.round + 1 >= array_length(t.games, 1) then
    update public.tournaments set status = 'finished', room_id = null, room_code = null where id = t.id;
    select max(points) into best from public.tournament_players where tournament_id = t.id;
    update public.player_progress g
    set chests = chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'grand', 'reason', 'tournoi'))
    from public.tournament_players p
    where p.tournament_id = t.id and p.points = best and g.user_id = p.user_id;
  else
    update public.tournaments set round = round + 1, room_id = null, room_code = null where id = t.id;
  end if;
end;
$$;

revoke all on function public.tournament_round_done from public, anon, authenticated;
grant execute on function public.tournament_round_done to service_role;

alter publication supabase_realtime add table public.tournaments, public.tournament_players;
