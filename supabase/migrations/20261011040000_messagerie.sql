-- Private messages between friends, and invitations to a table sent inside a conversation.
-- Who is online is not stored: the app shares it on a Realtime presence channel.

create table public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  -- An invitation to a table: the game and the code of the table (written by the profile server).
  game text check (game is null or game ~ '^[a-z0-9]{1,20}$'),
  room_code text check (room_code is null or room_code ~ '^[A-Z0-9]{4,8}$'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check (
    (game is null and room_code is null and char_length(btrim(body)) between 1 and 500)
    or (game is not null and room_code is not null)
  )
);

create index direct_messages_pair on public.direct_messages (sender_id, recipient_id, id desc);
create index direct_messages_inbox on public.direct_messages (recipient_id, read_at, sender_id);
create index direct_messages_rate on public.direct_messages (sender_id, created_at desc);

-- Friends both ways: adding a friend code writes the two rows at once.
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.friendships where user_id = a and friend_id = b)
     and exists (select 1 from public.friendships where user_id = b and friend_id = a);
$$;

revoke all on function public.are_friends from public, anon;
grant execute on function public.are_friends to authenticated;

-- Before a message is kept: trimmed, only between friends, and not too many at once (5 in
-- 10 seconds, 150 an hour; the same limits as the profile server). Invitations to a table have
-- their own limit (one a minute per friend and table) and are not counted.
create function public.direct_message_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  burst integer;
  hourly integer;
begin
  new.body := btrim(new.body);
  new.created_at := now();
  new.read_at := null;
  if not public.are_friends(new.sender_id, new.recipient_id) then
    raise exception 'Ce joueur n’est pas dans tes amis';
  end if;
  if new.game is not null then
    return new;
  end if;
  -- One sender at a time, so two messages sent together cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('direct_messages:' || new.sender_id::text));
  select count(*) filter (where created_at > now() - interval '10 seconds'), count(*)
    into burst, hourly
    from public.direct_messages
    where sender_id = new.sender_id and game is null and created_at > now() - interval '1 hour';
  if burst >= 5 or hourly >= 150 then
    raise exception 'Doucement ! Attends un peu avant d’écrire encore';
  end if;
  return new;
end;
$$;

create trigger direct_message_guard before insert on public.direct_messages
  for each row execute function public.direct_message_guard();

alter table public.direct_messages enable row level security;

-- Only the two people of a conversation read it.
create policy "Chacun lit ses conversations" on public.direct_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- Only under my own name, only to a friend, and only text (invitations go through the server).
create policy "Chacun écrit à ses amis" on public.direct_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and game is null
    and public.are_friends((select auth.uid()), recipient_id)
  );

-- Messages are never edited or deleted by players; read_at is set by read_messages below.
revoke all on public.direct_messages from public, anon, authenticated;
grant select on public.direct_messages to authenticated;
grant insert (recipient_id, body) on public.direct_messages to authenticated;

-- My conversations: the last message with each person and how many of theirs I have not read.
create function public.my_conversations()
returns table (
  friend_id uuid,
  last_id bigint,
  last_body text,
  last_game text,
  last_mine boolean,
  last_at timestamptz,
  last_read boolean,
  unread integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select case when m.sender_id = (select auth.uid()) then m.recipient_id else m.sender_id end as other,
           m.*
    from public.direct_messages m
    where m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid())
  ),
  last as (
    select distinct on (other) * from mine order by other, id desc
  )
  select l.other, l.id, l.body, l.game, l.sender_id = (select auth.uid()), l.created_at,
         l.read_at is not null,
         (select count(*)::integer from mine u
          where u.other = l.other and u.recipient_id = (select auth.uid()) and u.read_at is null)
  from last l
  order by l.id desc;
$$;

revoke all on function public.my_conversations from public, anon;
grant execute on function public.my_conversations to authenticated;

-- Marks as read everything a friend sent me; returns how many messages that was.
create function public.read_messages(p_friend uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with done as (
    update public.direct_messages
    set read_at = now()
    where recipient_id = (select auth.uid()) and sender_id = p_friend and read_at is null
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.read_messages from public, anon;
grant execute on function public.read_messages to authenticated;

-- New messages and "seen" marks arrive live (each player only receives the rows they can read).
alter publication supabase_realtime add table public.direct_messages;
