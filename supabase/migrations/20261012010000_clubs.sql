-- Clubs: a group of friends (30 at most) with a lounge (chat), a weekly ranking of its own and
-- challenges against other clubs. A player is in one club at a time. Everything players change
-- goes through the `clubs` Edge Function, which checks the rules and limits; players only read.

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  -- Badge and color picked from the app's lists (the server checks them).
  emoji text not null check (char_length(emoji) between 1 and 8),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  description text not null default '' check (char_length(description) <= 140),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- To join with a code or a link: only the members can read it.
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

-- Two clubs never share a name, whatever the case.
create unique index clubs_name_unique on public.clubs (lower(name));

create table public.club_members (
  -- One club per player.
  user_id uuid primary key references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now()
);

create index club_members_club on public.club_members (club_id, joined_at);
create unique index club_members_one_owner on public.club_members (club_id) where role = 'owner';

-- 30 members at most: checked one club at a time, so two players joining together cannot both
-- take the last place.
create function public.club_member_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.club_id = old.club_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('club_members:' || new.club_id::text));
  if (select count(*) from public.club_members where club_id = new.club_id) >= 30 then
    raise exception 'Ce club est complet (30 membres)';
  end if;
  return new;
end;
$$;

create trigger club_member_guard before insert or update of club_id on public.club_members
  for each row execute function public.club_member_guard();

-- Invitations from a member to a friend; the friend joins or declines.
create table public.club_invites (
  club_id uuid not null references public.clubs (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, to_id)
);

create index club_invites_to on public.club_invites (to_id, created_at desc);

-- The lounge: messages of the members, invitations to a table, and what happened in the club
-- (arrivals, departures, challenges: `kind` = 'event', the code of the event in `body`).
create table public.club_messages (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'invite', 'event')),
  body text not null default '' check (char_length(body) <= 500),
  game text check (game is null or game ~ '^[a-z0-9]{1,20}$'),
  room_code text check (room_code is null or room_code ~ '^[A-Z0-9]{4,8}$'),
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and char_length(btrim(body)) between 1 and 500)
    or (kind = 'invite' and game is not null and room_code is not null)
    or (kind = 'event' and body ~ '^[a-z_]{1,24}(:.{0,40})?$')
  )
);

create index club_messages_club on public.club_messages (club_id, id desc);
create index club_messages_rate on public.club_messages (sender_id, created_at desc);

-- A club challenges another one for a week; the other answers. The result is written once the
-- week is over (see the `clubs` function).
create table public.club_challenges (
  id uuid primary key default gen_random_uuid(),
  -- Monday of the week of the challenge (Paris).
  week date not null,
  from_club uuid not null references public.clubs (id) on delete cascade,
  to_club uuid not null references public.clubs (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  -- {"duel":[a,b],"total":[a,b],"winner":0|1|null,"by":"duel"|"total"|"draw"}
  result jsonb,
  check (from_club <> to_club)
);

create index club_challenges_from on public.club_challenges (from_club, week);
create index club_challenges_to on public.club_challenges (to_club, week);
-- One live challenge between two clubs a week.
create unique index club_challenges_pair on public.club_challenges (
  week, least(from_club, to_club), greatest(from_club, to_club)
) where status in ('pending', 'accepted');

-- Last week's club ranking, written once on the first request of the new week: its places and
-- who was a member before the week ended (they, and only they, win the chest).
create table public.club_weeks (
  week date not null,
  club_id uuid not null references public.clubs (id) on delete cascade,
  place integer not null check (place >= 1),
  points integer not null check (points >= 0),
  members uuid[] not null default '{}',
  primary key (week, club_id)
);

-- Last week's club chest, taken once a week whatever the club; and when I last left a club.
alter table public.player_progress
  add column club_chest_claimed date,
  add column club_left_at timestamptz;

grant select (club_chest_claimed) on public.player_progress to authenticated;

-- The club of the player asking.
create function public.my_club_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id from public.club_members where user_id = (select auth.uid());
$$;

revoke all on function public.my_club_id from public, anon;
grant execute on function public.my_club_id to authenticated;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;
alter table public.club_messages enable row level security;
alter table public.club_challenges enable row level security;
alter table public.club_weeks enable row level security;

-- Clubs and their members are public (badges next to names, top clubs); the code is not.
create policy "Tout le monde voit les clubs" on public.clubs
  for select to authenticated using (true);
create policy "Tout le monde voit les membres" on public.club_members
  for select to authenticated using (true);
create policy "Les invitations de mon club et les miennes" on public.club_invites
  for select to authenticated
  using (to_id = (select auth.uid()) or club_id = (select public.my_club_id()));
create policy "Les membres lisent le salon" on public.club_messages
  for select to authenticated using (club_id = (select public.my_club_id()));
create policy "Les membres voient leurs défis" on public.club_challenges
  for select to authenticated
  using (from_club = (select public.my_club_id()) or to_club = (select public.my_club_id()));
create policy "Tout le monde voit les classements passés" on public.club_weeks
  for select to authenticated using (true);

revoke all on public.clubs, public.club_members, public.club_invites, public.club_messages,
  public.club_challenges, public.club_weeks from public, anon, authenticated;
grant select (id, name, emoji, color, description, owner_id, created_at) on public.clubs to authenticated;
grant select on public.club_members, public.club_invites, public.club_messages, public.club_challenges,
  public.club_weeks to authenticated;

-- Games played and won in a week by each club's members (those who joined before `p_before`,
-- when given). The points (3 a win, 1 any other game) are counted by the server.
create function public.club_week_tallies(p_week date, p_before timestamptz default null)
returns table (club_id uuid, played integer, won integer, members integer, member_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select cm.club_id, cm.user_id from public.club_members cm
    where p_before is null or cm.joined_at < p_before
  ),
  r as (
    select o.user_id, count(*)::integer as played, count(*) filter (where o.won)::integer as won
    from public.online_results o
    where o.week = p_week and o.user_id in (select user_id from m)
    group by o.user_id
  )
  select m.club_id, coalesce(sum(r.played), 0)::integer, coalesce(sum(r.won), 0)::integer,
         count(*)::integer, array_agg(m.user_id)
  from m left join r on r.user_id = m.user_id
  group by m.club_id;
$$;

-- Games of a week where members of both clubs sat at the same table, for each club.
create function public.club_duel_tallies(p_a uuid, p_b uuid, p_week date)
returns table (a_played integer, a_won integer, b_played integer, b_won integer)
language sql
stable
security definer
set search_path = ''
as $$
  with ra as (
    select o.room_id, o.won from public.online_results o
    join public.club_members m on m.user_id = o.user_id and m.club_id = p_a
    where o.week = p_week
  ),
  rb as (
    select o.room_id, o.won from public.online_results o
    join public.club_members m on m.user_id = o.user_id and m.club_id = p_b
    where o.week = p_week
  ),
  shared as (
    select room_id from ra intersect select room_id from rb
  )
  select
    (select count(*)::integer from ra where room_id in (select room_id from shared)),
    (select count(*)::integer from ra where won and room_id in (select room_id from shared)),
    (select count(*)::integer from rb where room_id in (select room_id from shared)),
    (select count(*)::integer from rb where won and room_id in (select room_id from shared));
$$;

-- Takes last week's club chest, once a week (even after changing club).
create function public.claim_club_chest(p_user uuid, p_kind text, p_week date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('grand', 'normal') then
    return jsonb_build_object('error', 'Pas de coffre de club pour toi');
  end if;
  update public.player_progress
  set club_chest_claimed = p_week,
      chests = chests || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'kind', p_kind, 'reason', 'club'))
  where user_id = p_user and club_chest_claimed is distinct from p_week;
  if not found then
    return jsonb_build_object('error', 'Récompense déjà prise');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Creates a club and makes its creator the owner, at once. Answers {id} or {error}; {retry}
-- when the random code was already taken.
create function public.club_create(
  p_user uuid, p_name text, p_emoji text, p_color text, p_description text, p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_constraint text;
begin
  if exists (select 1 from public.club_members where user_id = p_user) then
    return jsonb_build_object('error', 'Tu es déjà dans un club');
  end if;
  if exists (select 1 from public.clubs where lower(name) = lower(p_name)) then
    return jsonb_build_object('error', 'Ce nom de club est déjà pris');
  end if;
  insert into public.clubs (name, emoji, color, description, owner_id, code)
    values (p_name, p_emoji, p_color, p_description, p_user, p_code)
    returning id into v_id;
  insert into public.club_members (user_id, club_id, role) values (p_user, v_id, 'owner');
  delete from public.club_invites where to_id = p_user;
  return jsonb_build_object('id', v_id);
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'clubs_code_key' then
    return jsonb_build_object('retry', true);
  elsif v_constraint = 'club_members_pkey' then
    return jsonb_build_object('error', 'Tu es déjà dans un club');
  end if;
  return jsonb_build_object('error', 'Ce nom de club est déjà pris');
end;
$$;

-- Hands the club over to another member: the old owner becomes an admin.
create function public.club_transfer(p_club uuid, p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.club_members where club_id = p_club and user_id = p_to and role <> 'owner';
  if not found then
    return jsonb_build_object('error', 'Ce joueur n’est pas dans ton club');
  end if;
  update public.club_members set role = 'admin' where club_id = p_club and user_id = p_from and role = 'owner';
  if not found then
    return jsonb_build_object('error', 'Seul le créateur du club peut faire ça');
  end if;
  update public.club_members set role = 'owner' where club_id = p_club and user_id = p_to;
  update public.clubs set owner_id = p_to where id = p_club;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.club_create from public, anon, authenticated;
revoke all on function public.club_transfer from public, anon, authenticated;
grant execute on function public.club_create to service_role;
grant execute on function public.club_transfer to service_role;

revoke all on function public.club_week_tallies from public, anon, authenticated;
revoke all on function public.club_duel_tallies from public, anon, authenticated;
revoke all on function public.claim_club_chest from public, anon, authenticated;
grant execute on function public.club_week_tallies to service_role;
grant execute on function public.club_duel_tallies to service_role;
grant execute on function public.claim_club_chest to service_role;

-- The lounge, the members and the challenges change live (each player only receives what they can read).
alter publication supabase_realtime add table public.club_messages, public.club_members, public.club_challenges;
