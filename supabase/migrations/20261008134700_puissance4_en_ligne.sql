-- Puissance 4 can now be played online. Every game added in parallel writes this same full list,
-- so whichever migration runs last, no game is blocked.
alter table public.game_rooms drop constraint if exists game_rooms_game_check;
alter table public.game_rooms add constraint game_rooms_game_check
  check (game in ('blackjack', 'president', 'yams', 'belote', 'puissance4', 'rami', 'uno', 'huit', 'tarot'));
