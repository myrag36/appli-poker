-- The host can pause the game: no move, deal or timeout is accepted meanwhile.
alter table public.rooms add column paused boolean not null default false;
