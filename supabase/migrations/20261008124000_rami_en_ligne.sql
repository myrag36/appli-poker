-- Rami can be played at an online table.
-- Every game added online writes this same full list, so the migrations can run in any order.
alter table public.game_rooms drop constraint if exists game_rooms_game_check;
alter table public.game_rooms add constraint game_rooms_game_check
  check (game in ('blackjack', 'president', 'yams', 'belote', 'puissance4', 'rami', 'uno', 'huit', 'tarot'));
