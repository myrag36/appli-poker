-- Days in a row, chests and achievements. Like the rest of the progress, only the servers
-- change them.

alter table public.player_progress
  add column streak integer not null default 0,
  add column best_streak integer not null default 0,
  add column quests_done integer not null default 0,
  -- Chests not opened yet: [{"id", "kind": "normal"|"grand", "reason"}]
  add column chests jsonb not null default '[]',
  -- Achievements whose coins were taken, and rare moments spotted in games.
  add column achievements jsonb not null default '[]',
  add column feats jsonb not null default '[]';

create or replace function public.award_xp(
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
  new_day boolean;
  days integer;
  bonus integer := 0;
  new_chests jsonb := '[]';
begin
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into rec from public.player_progress where user_id = p_user for update;

  new_day := rec.last_day is distinct from today;
  gained := greatest(p_amount, 0) + case when new_day then greatest(p_daily, 0) else 0 end;
  -- Days in a row: the first game of each day pays more the longer the streak, and every
  -- 7th day gives a big chest.
  days := case
    when not new_day then rec.streak
    when rec.last_day = today - 1 then rec.streak + 1
    else 1
  end;
  if new_day then
    bonus := 10 * least(7, days);
    if days % 7 = 0 then
      new_chests := jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'grand', 'reason', 'serie'));
    end if;
  end if;
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
      coins = coins + greatest(p_coins, 0) + bonus,
      streak = days,
      best_streak = greatest(best_streak, days),
      chests = chests || new_chests,
      last_day = today,
      games = case when p_played then jsonb_set(games, array[p_game], counters) else games end,
      quests_claimed = case when stats_day = today then quests_claimed else '[]' end,
      stats_day = today,
      day_stats = stats,
      updated_at = now()
  where user_id = p_user;

  return jsonb_build_object('before', rec.xp, 'after', rec.xp + gained, 'gained', gained, 'streak', days);
end;
$$;

-- Takes a finished quest's coins, once; finishing the three quests of the day gives a chest.
create or replace function public.claim_quest(p_user uuid, p_day date, p_quest text, p_coins integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
  all_done boolean;
begin
  select * into rec from public.player_progress where user_id = p_user for update;
  if not found or rec.stats_day is distinct from p_day
     or p_day <> (now() at time zone 'Europe/Paris')::date then
    return jsonb_build_object('error', 'Cette quête est terminée, de nouvelles t’attendent');
  end if;
  if rec.quests_claimed ? p_quest then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  all_done := jsonb_array_length(rec.quests_claimed) + 1 >= 3;
  update public.player_progress
  set coins = coins + greatest(p_coins, 0),
      quests_claimed = quests_claimed || to_jsonb(p_quest),
      quests_done = quests_done + 1,
      chests = case when all_done
        then chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'normal', 'reason', 'quetes'))
        else chests end,
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('coins', rec.coins + greatest(p_coins, 0), 'chest', all_done);
end;
$$;

-- Gives a chest (the game servers give one on each level up).
create function public.grant_chest(p_user uuid, p_kind text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_progress
  set chests = chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', p_kind, 'reason', p_reason))
  where user_id = p_user;
$$;

-- Opens a chest: its coins, and the item the server drew for it (if the player lacks it).
create function public.open_chest(p_user uuid, p_chest text, p_coins integer, p_item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
  chest jsonb;
  gets_item boolean;
begin
  select * into rec from public.player_progress where user_id = p_user for update;
  if not found then
    return jsonb_build_object('error', 'Coffre introuvable');
  end if;
  select c into chest from jsonb_array_elements(rec.chests) c where c ->> 'id' = p_chest;
  if chest is null then
    return jsonb_build_object('error', 'Coffre déjà ouvert');
  end if;
  gets_item := p_item is not null and not rec.owned ? p_item;
  update public.player_progress
  set chests = (select coalesce(jsonb_agg(c), '[]') from jsonb_array_elements(rec.chests) c where c ->> 'id' <> p_chest),
      coins = coins + greatest(p_coins, 0),
      owned = case when gets_item then owned || to_jsonb(p_item) else owned end,
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('kind', chest ->> 'kind', 'coins', greatest(p_coins, 0),
    'item', case when gets_item then p_item end);
end;
$$;

-- Takes an achievement's coins, once. The server checked it is reached.
create function public.claim_achievement(p_user uuid, p_id text, p_coins integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
begin
  select * into rec from public.player_progress where user_id = p_user for update;
  if not found or rec.achievements ? p_id then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  update public.player_progress
  set achievements = achievements || to_jsonb(p_id),
      coins = coins + greatest(p_coins, 0),
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('coins', rec.coins + greatest(p_coins, 0));
end;
$$;

-- Notes a rare moment spotted during a game.
create function public.add_feat(p_user uuid, p_feat text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.player_progress
  set feats = case when feats ? p_feat then feats else feats || to_jsonb(p_feat) end
  where user_id = p_user;
$$;

revoke all on function public.award_xp from public, anon, authenticated;
revoke all on function public.claim_quest from public, anon, authenticated;
revoke all on function public.grant_chest from public, anon, authenticated;
revoke all on function public.open_chest from public, anon, authenticated;
revoke all on function public.claim_achievement from public, anon, authenticated;
revoke all on function public.add_feat from public, anon, authenticated;
grant execute on function public.award_xp to service_role;
grant execute on function public.claim_quest to service_role;
grant execute on function public.grant_chest to service_role;
grant execute on function public.open_chest to service_role;
grant execute on function public.claim_achievement to service_role;
grant execute on function public.add_feat to service_role;
