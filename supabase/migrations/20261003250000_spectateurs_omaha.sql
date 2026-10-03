-- Game variant of each table: Texas Hold'em or Omaha (pot limit).
alter table public.rooms
  add column variant text not null default 'holdem' check (variant in ('holdem', 'omaha'));

-- People watching a table without playing. They can read the table and its chat
-- like players, but never anyone's cards.
create table public.room_spectators (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_spectators enable row level security;
revoke all on public.room_spectators from anon, authenticated;
grant select on public.room_spectators to authenticated;

-- Members are now players and spectators: both can follow the table and chat.
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room and user_id = (select auth.uid())
  ) or exists (
    select 1 from public.room_spectators
    where room_id = p_room and user_id = (select auth.uid())
  );
$$;

-- Everyone at the table sees who is watching, to name them in the chat.
create policy "Les membres voient les spectateurs" on public.room_spectators
  for select to authenticated using (public.is_room_member(room_id));
