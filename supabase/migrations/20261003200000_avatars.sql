-- Each player's avatar: an emoji on a colored disc, picked when joining a table.
alter table public.room_players
  add column avatar text,
  add column avatar_color text;
