-- Robots sit at tables like players but have no account: their id is not a user,
-- and the server plays their moves.
alter table public.room_players drop constraint room_players_user_id_fkey;
alter table public.room_players add column is_bot boolean not null default false;

-- A person's seat still disappears with their account.
create function public.forget_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.room_players where user_id = old.id;
  return old;
end;
$$;

create trigger forget_deleted_user
  after delete on auth.users
  for each row execute function public.forget_deleted_user();
