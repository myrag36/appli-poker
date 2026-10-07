-- Coins, daily quests and the shop. Like experience, only the servers change them.

alter table public.player_progress
  add column coins integer not null default 0 check (coins >= 0),
  -- Bought items, as "kind:id" strings.
  add column owned jsonb not null default '[]',
  -- What the player did on stats_day (Paris time), to check the quests of that day.
  add column stats_day date,
  add column day_stats jsonb not null default '{}',
  -- Quests of stats_day whose coins were already taken.
  add column quests_claimed jsonb not null default '[]';

drop function public.award_local_game(uuid, text, integer, boolean, integer);
drop function public.award_xp(uuid, text, integer, boolean, boolean, integer);

-- Adds experience (plus the daily bonus on the first one of the day) and coins, counts the
-- game, and notes it in today's stats for the quests.
create function public.award_xp(
  p_user uuid,
  p_game text,
  p_amount integer,
  p_played boolean,
  p_won boolean,
  p_daily integer,
  p_coins integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  rec public.player_progress;
  gained integer;
  counters jsonb;
  stats jsonb;
begin
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into rec from public.player_progress where user_id = p_user for update;

  gained := greatest(p_amount, 0) + case when rec.last_day is distinct from today then greatest(p_daily, 0) else 0 end;
  counters := coalesce(rec.games -> p_game, '{"played":0,"won":0}');
  stats := case when rec.stats_day = today then rec.day_stats else '{}' end;
  if p_played then
    counters := jsonb_build_object(
      'played', coalesce((counters ->> 'played')::int, 0) + 1,
      'won', coalesce((counters ->> 'won')::int, 0) + case when p_won then 1 else 0 end
    );
    stats := jsonb_set(stats, '{played}', coalesce(stats -> 'played', '{}'), true);
    stats := jsonb_set(stats, array['played', p_game], to_jsonb(coalesce((stats #>> array['played', p_game])::int, 0) + 1));
    if p_won then
      stats := jsonb_set(stats, '{won}', coalesce(stats -> 'won', '{}'), true);
      stats := jsonb_set(stats, array['won', p_game], to_jsonb(coalesce((stats #>> array['won', p_game])::int, 0) + 1));
    end if;
  else
    stats := jsonb_set(stats, '{rounds}', to_jsonb(coalesce((stats ->> 'rounds')::int, 0) + 1));
  end if;

  update public.player_progress
  set xp = xp + gained,
      coins = coins + greatest(p_coins, 0),
      last_day = today,
      games = case when p_played then jsonb_set(games, array[p_game], counters) else games end,
      quests_claimed = case when stats_day = today then quests_claimed else '[]' end,
      stats_day = today,
      day_stats = stats,
      updated_at = now()
  where user_id = p_user;

  return jsonb_build_object('before', rec.xp, 'after', rec.xp + gained, 'gained', gained);
end;
$$;

-- A game finished on one phone. The phone could lie, so: at most one every 30 seconds,
-- 40 a day, and never more than a normal game would give.
create function public.award_local_game(
  p_user uuid,
  p_game text,
  p_amount integer,
  p_won boolean,
  p_daily integer,
  p_coins integer default 0
)
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
  return public.award_xp(p_user, p_game, least(p_amount, 50), true, p_won, p_daily, least(p_coins, 25));
end;
$$;

-- Takes a finished quest's coins, once. The server checked the quest is done on p_day.
create function public.claim_quest(p_user uuid, p_day date, p_quest text, p_coins integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
begin
  select * into rec from public.player_progress where user_id = p_user for update;
  if not found or rec.stats_day is distinct from p_day
     or p_day <> (now() at time zone 'Europe/Paris')::date then
    return jsonb_build_object('error', 'Cette quête est terminée, de nouvelles t’attendent');
  end if;
  if rec.quests_claimed ? p_quest then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  update public.player_progress
  set coins = coins + greatest(p_coins, 0),
      quests_claimed = quests_claimed || to_jsonb(p_quest),
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('coins', rec.coins + greatest(p_coins, 0));
end;
$$;

-- Buys a shop item: enough coins, not already owned.
create function public.buy_item(p_user uuid, p_item text, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
begin
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into rec from public.player_progress where user_id = p_user for update;
  if rec.owned ? p_item then
    return jsonb_build_object('error', 'Tu l’as déjà');
  end if;
  if rec.coins < p_price then
    return jsonb_build_object('error', 'Pas assez de pièces');
  end if;
  update public.player_progress
  set coins = coins - p_price,
      owned = owned || to_jsonb(p_item),
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('coins', rec.coins - p_price);
end;
$$;

revoke all on function public.award_xp from public, anon, authenticated;
revoke all on function public.award_local_game from public, anon, authenticated;
revoke all on function public.claim_quest from public, anon, authenticated;
revoke all on function public.buy_item from public, anon, authenticated;
grant execute on function public.award_xp to service_role;
grant execute on function public.award_local_game to service_role;
grant execute on function public.claim_quest to service_role;
grant execute on function public.buy_item to service_role;
