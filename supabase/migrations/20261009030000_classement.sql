-- Weekly ranking between friends: one row per player and finished online game (poker and
-- the games of the `jeux` server). Only the Edge Functions write here, when a game ends;
-- games played on one phone are not counted. A player reads their own results and those
-- of their friends.

create table public.online_results (
  room_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Any online game: new games need no change here.
  game text not null check (game ~ '^[a-z0-9]{1,20}$'),
  -- 1 for the winners, the others share the next place.
  placement integer not null check (placement >= 1),
  won boolean not null,
  players integer not null check (players >= 1),
  -- Monday of the week (Paris time) the game ended in.
  week date not null default public.paris_week(),
  finished_at timestamptz not null default now(),
  -- A game recorded twice counts once.
  primary key (room_id, user_id)
);

create index online_results_week_idx on public.online_results (week, user_id);

alter table public.online_results enable row level security;

create policy "Chacun voit ses résultats et ceux de ses amis" on public.online_results
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where f.user_id = (select auth.uid()) and f.friend_id = online_results.user_id
    )
  );

revoke all on public.online_results from anon, authenticated;
grant select on public.online_results to authenticated;
