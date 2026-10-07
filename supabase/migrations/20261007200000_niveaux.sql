-- Experience, levels and cosmetic rewards. Only the servers give experience; what a
-- player shows (border, title, card back, banner) is public so others see it at the table.

create table public.player_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  -- Finished games per game: {"yams": {"played": 3, "won": 1}, ...}
  games jsonb not null default '{}',
  equipped jsonb not null default '{}',
  -- Day (Paris time) of the last experience, for the first-game-of-the-day bonus.
  last_day date,
  -- Limits on games played on one phone, which only the phone reports.
  local_day date,
  local_count integer not null default 0,
  last_local_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;
create policy "Tout le monde voit les niveaux" on public.player_progress
  for select to authenticated using (true);
revoke all on public.player_progress from anon, authenticated;
grant select on public.player_progress to authenticated;

-- Adds experience (plus the daily bonus on the first one of the day) and counts the game.
-- Returns the experience before and after, so the caller can tell a level up.
create function public.award_xp(
  p_user uuid,
  p_game text,
  p_amount integer,
  p_played boolean,
  p_won boolean,
  p_daily integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  before_xp integer;
  first_today boolean;
  gained integer;
  counters jsonb;
begin
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  select xp, last_day is distinct from today, coalesce(games -> p_game, '{"played":0,"won":0}')
    into before_xp, first_today, counters
    from public.player_progress where user_id = p_user for update;

  gained := greatest(p_amount, 0) + case when first_today then greatest(p_daily, 0) else 0 end;
  if p_played then
    counters := jsonb_build_object(
      'played', coalesce((counters ->> 'played')::int, 0) + 1,
      'won', coalesce((counters ->> 'won')::int, 0) + case when p_won then 1 else 0 end
    );
  end if;

  update public.player_progress
  set xp = xp + gained,
      last_day = today,
      games = case when p_played then jsonb_set(games, array[p_game], counters) else games end,
      updated_at = now()
  where user_id = p_user;

  return jsonb_build_object('before', before_xp, 'after', before_xp + gained, 'gained', gained);
end;
$$;

-- A game finished on one phone. The phone could lie, so: at most one every 30 seconds,
-- 40 a day, and never more than a normal game would give.
create function public.award_local_game(p_user uuid, p_game text, p_amount integer, p_won boolean, p_daily integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  rec public.player_progress;
begin
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into rec from public.player_progress where user_id = p_user for update;
  if rec.last_local_at is not null and rec.last_local_at > now() - interval '30 seconds' then
    return jsonb_build_object('before', rec.xp, 'after', rec.xp, 'gained', 0);
  end if;
  if rec.local_day = today and rec.local_count >= 40 then
    return jsonb_build_object('before', rec.xp, 'after', rec.xp, 'gained', 0);
  end if;
  update public.player_progress
  set last_local_at = now(),
      local_count = case when local_day = today then local_count + 1 else 1 end,
      local_day = today
  where user_id = p_user;
  return public.award_xp(p_user, p_game, least(p_amount, 50), true, p_won, p_daily);
end;
$$;

revoke all on function public.award_xp from public, anon, authenticated;
revoke all on function public.award_local_game from public, anon, authenticated;
grant execute on function public.award_xp to service_role;
grant execute on function public.award_local_game to service_role;

alter publication supabase_realtime add table public.player_progress;
