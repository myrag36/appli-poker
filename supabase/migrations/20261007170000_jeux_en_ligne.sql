-- Online tables for the other games (Blackjack, Président, Yams, Belote).
-- Only the `jeux` Edge Function writes here. The full game state stays in
-- game_secrets; each player reads only their own view in game_private.

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game text not null check (game in ('blackjack', 'president', 'yams', 'belote')),
  host_id uuid not null references auth.users (id) on delete cascade,
  options jsonb not null default '{}',
  status text not null default 'lobby' check (status in ('lobby', 'playing')),
  -- What everyone at the table may see, plus whose turn it is and until when.
  public_state jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now()
);

-- Robots have made-up ids, so user_id has no link to auth.users.
create table public.game_players (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 16),
  seat integer not null check (seat between 0 and 7),
  avatar text,
  avatar_color text,
  is_bot boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table public.game_private (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null,
  view jsonb not null,
  version integer not null,
  primary key (room_id, user_id)
);

create table public.game_secrets (
  room_id uuid primary key references public.game_rooms (id) on delete cascade,
  state jsonb not null
);

create function public.is_game_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players
    where room_id = p_room and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_game_member from public, anon;
grant execute on function public.is_game_member to authenticated;

alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.game_private enable row level security;
alter table public.game_secrets enable row level security;

create policy "Les membres voient leur table" on public.game_rooms
  for select to authenticated using (public.is_game_member(id));
create policy "Les membres voient les joueurs" on public.game_players
  for select to authenticated using (public.is_game_member(room_id));
create policy "Chacun voit son jeu" on public.game_private
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.game_rooms, public.game_players, public.game_private, public.game_secrets
  from anon, authenticated;
grant select on public.game_rooms, public.game_players, public.game_private to authenticated;

-- Saves a move atomically: refuses it if someone else saved in between.
create function public.save_game_state(
  p_room uuid,
  p_version integer,
  p_public jsonb,
  p_secret jsonb,
  p_private jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_version integer;
begin
  update public.game_rooms
  set public_state = p_public,
      status = 'playing',
      version = version + 1
  where id = p_room and version = p_version
  returning version into new_version;

  if new_version is null then
    raise exception 'conflict' using errcode = '40001';
  end if;

  insert into public.game_secrets (room_id, state)
  values (p_room, p_secret)
  on conflict (room_id) do update set state = excluded.state;

  insert into public.game_private (room_id, user_id, view, version)
  select p_room, key::uuid, value, new_version from jsonb_each(p_private)
  on conflict (room_id, user_id) do update set view = excluded.view, version = excluded.version;

  return new_version;
end;
$$;

revoke all on function public.save_game_state from public, anon, authenticated;
grant execute on function public.save_game_state to service_role;

alter publication supabase_realtime add table public.game_rooms, public.game_players, public.game_private;
