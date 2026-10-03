-- Tournament mode: blinds go up every `level_minutes` (null = blinds never change),
-- counted from the first hand. `place` is each player's final rank once they run out of chips.

alter table public.rooms
  add column level_minutes integer check (level_minutes between 1 and 120),
  add column started_at timestamptz;

alter table public.room_players add column place integer;

create or replace function public.save_room_state(
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
      hand_number = coalesce(p_hand_number, hand_number),
      started_at = coalesce(started_at, now())
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

    -- Once a hand is over, players knocked out in it share the place just behind everyone still in.
    -- (Mid-hand, an all-in player has no chips behind but is not out yet.)
    update public.room_players rp
    set place = (
      select count(*) + 1 from public.room_players x where x.room_id = p_room and x.stack > 0
    )
    where rp.room_id = p_room and rp.stack = 0 and rp.place is null
      and p_public ->> 'street' = 'finished';
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
