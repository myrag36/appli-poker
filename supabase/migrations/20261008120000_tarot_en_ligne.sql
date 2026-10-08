-- Tarot can be played online too. The list is the same in every migration that adds an online
-- game, so the constraint stays complete whatever order they run in.
alter table public.game_rooms drop constraint if exists game_rooms_game_check;
alter table public.game_rooms add constraint game_rooms_game_check
  check (game in ('blackjack', 'president', 'yams', 'belote', 'puissance4', 'rami', 'uno', 'huit', 'tarot'));
