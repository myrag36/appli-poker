-- Revanche: once a game is over, the first player who asks for a rematch opens a new
-- table with the same settings. Its id, code and who asked are written on the finished
-- table, so the others see it live and follow with one tap. Only the Edge Functions
-- write this column; members already read the whole row.

alter table public.rooms add column rematch jsonb;
alter table public.game_rooms add column rematch jsonb;
