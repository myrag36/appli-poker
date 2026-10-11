-- Indexes for lookups that had none: each one replaced a scan of the whole table.
-- Only additions: no data or behavior changes.

-- Poker statistics (player_stats): the games each person won.
create index if not exists game_results_winner_idx on public.game_results (winner_id);

-- Friendships are looked up from both sides: "who has me as a friend" and the cascade when an
-- account is deleted (the primary key only starts with user_id).
create index if not exists friendships_friend_idx on public.friendships (friend_id);

-- A person's seats and registrations, by account alone: the trigger and cascades run when an
-- account is deleted (anonymous accounts are cleaned up), which otherwise read the whole tables.
create index if not exists room_players_user_idx on public.room_players (user_id);
create index if not exists game_players_user_idx on public.game_players (user_id);
create index if not exists tournament_players_user_idx on public.tournament_players (user_id);
create index if not exists weekly_registrations_user_idx on public.weekly_registrations (user_id);
