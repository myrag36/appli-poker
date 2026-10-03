-- Table chat. Unlike the game, players write their messages directly: the
-- policies below only let a seated player post under their own account.

create table public.room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);

create index room_messages_room_id_idx on public.room_messages (room_id, id);

alter table public.room_messages enable row level security;

create policy "Les membres lisent le chat" on public.room_messages
  for select to authenticated using (public.is_room_member(room_id));

create policy "Les membres écrivent sous leur nom" on public.room_messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_room_member(room_id));

-- Messages can be read and posted, never edited or deleted.
revoke all on public.room_messages from anon, authenticated;
grant select on public.room_messages to authenticated;
grant insert (room_id, body) on public.room_messages to authenticated;

alter publication supabase_realtime add table public.room_messages;
