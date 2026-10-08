-- The daily challenge ("Défi du jour"): one objective a day for everyone, paid once, with a
-- small bonus for days in a row. Like the quests, only the servers change it: the profile
-- server checks the challenge is done from day_stats before calling claim_challenge.

alter table public.player_progress
  -- Last day (Paris time) whose challenge was taken, days in a row, and how many in all.
  add column challenge_day date,
  add column challenge_streak integer not null default 0,
  add column challenges_done integer not null default 0;

grant select (challenge_day, challenge_streak, challenges_done) on public.player_progress to authenticated;

-- Takes today's challenge coins, once. p_step coins more per day in a row (from the 2nd),
-- for at most p_cap days.
create function public.claim_challenge(p_user uuid, p_day date, p_coins integer, p_step integer, p_cap integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.player_progress;
  days integer;
  bonus integer;
begin
  select * into rec from public.player_progress where user_id = p_user for update;
  if not found or rec.stats_day is distinct from p_day
     or p_day <> (now() at time zone 'Europe/Paris')::date then
    return jsonb_build_object('error', 'Ce défi est terminé, un nouveau t’attend');
  end if;
  if rec.challenge_day = p_day then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  days := case when rec.challenge_day = p_day - 1 then rec.challenge_streak + 1 else 1 end;
  bonus := greatest(p_step, 0) * greatest(0, least(greatest(p_cap, 0), days - 1));
  update public.player_progress
  set coins = coins + greatest(p_coins, 0) + bonus,
      challenge_day = p_day,
      challenge_streak = days,
      challenges_done = challenges_done + 1,
      updated_at = now()
  where user_id = p_user;
  return jsonb_build_object('coins', rec.coins + greatest(p_coins, 0) + bonus, 'bonus', bonus, 'streak', days);
end;
$$;

revoke all on function public.claim_challenge from public, anon, authenticated;
grant execute on function public.claim_challenge to service_role;
