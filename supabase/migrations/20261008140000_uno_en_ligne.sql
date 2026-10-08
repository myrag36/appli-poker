-- Uno and 8 américain can be played online too. Every online-game migration writes the
-- same full list, so whichever runs last, no game is refused.
alter table public.game_rooms drop constraint if exists game_rooms_game_check;
alter table public.game_rooms
  add constraint game_rooms_game_check
  check (game in ('blackjack', 'president', 'yams', 'belote', 'puissance4', 'rami', 'uno', 'huit', 'tarot'));
