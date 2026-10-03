-- Private poker rooms. Clients only read; every write goes through the
-- `poker` Edge Function, which uses the service role.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  big_blind integer not null check (big_blind >= 2 and big_blind % 2 = 0),
  starting_stack integer not null check (starting_stack > 0),
  status text not null default 'lobby' check (status in ('lobby', 'playing')),
  dealer integer not null default 0,
  hand_number integer not null default 0,
  -- Bumped on every write so two simultaneous actions cannot both apply.
  version integer not null default 0,
  -- What every player at the table may see: no deck, no hidden cards.
  public_state jsonb,
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  seat integer not null check (seat between 0 and 7),
  stack integer not null check (stack >= 0),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat),
  unique (room_id, name)
);

-- Full engine state including the deck and everyone's cards. No client access.
create table public.room_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  hand_state jsonb not null
);

-- Each player's two cards, readable only by that player.
create table public.private_hands (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hand_number integer not null,
  cards text[] not null,
  primary key (room_id, user_id)
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_secrets enable row level security;
alter table public.private_hands enable row level security;

create function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room and user_id = (select auth.uid())
  );
$$;

create policy "Les membres voient leur salle" on public.rooms
  for select to authenticated using (public.is_room_member(id));

create policy "Les membres voient les joueurs" on public.room_players
  for select to authenticated using (public.is_room_member(room_id));

create policy "Chacun voit ses propres cartes" on public.private_hands
  for select to authenticated using (user_id = (select auth.uid()));

-- Saves one step of a hand atomically. Fails if someone else wrote first.
create function public.save_room_state(
  p_room uuid,
  p_version integer,
  p_public jsonb,
  p_secret jsonb,
  p_dealer integer default null,
  p_hand_number integer default null,
  p_stacks jsonb default null,
  p_hands jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_version integer;
begin
  update public.rooms
  set public_state = p_public,
      status = 'playing',
      version = version + 1,
      dealer = coalesce(p_dealer, dealer),
      hand_number = coalesce(p_hand_number, hand_number)
  where id = p_room and version = p_version
  returning version into new_version;

  if new_version is null then
    raise exception 'conflict' using errcode = '40001';
  end if;

  insert into public.room_secrets (room_id, hand_state)
  values (p_room, p_secret)
  on conflict (room_id) do update set hand_state = excluded.hand_state;

  if p_stacks is not null then
    update public.room_players rp
    set stack = (p_stacks ->> rp.user_id::text)::integer
    where rp.room_id = p_room and p_stacks ? rp.user_id::text;
  end if;

  if p_hands is not null then
    delete from public.private_hands where room_id = p_room;
    insert into public.private_hands (room_id, user_id, hand_number, cards)
    select p_room, h.key::uuid, coalesce(p_hand_number, 0),
           array(select jsonb_array_elements_text(h.value))
    from jsonb_each(p_hands) as h;
  end if;

  return new_version;
end;
$$;

revoke all on function public.save_room_state from public, anon, authenticated;
grant execute on function public.save_room_state to service_role;
revoke all on function public.is_room_member from public, anon;
grant execute on function public.is_room_member to authenticated;

alter publication supabase_realtime add table public.rooms, public.room_players, public.private_hands;
