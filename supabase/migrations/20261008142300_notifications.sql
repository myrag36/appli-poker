-- Web Push notifications: a friend invites me to their table, or it is my turn while the app
-- is in the background.

-- The server's VAPID key pair. The Edge Functions make it themselves on first use; only the
-- service role can read it (row-level security with no policy, and no grant to players), so no
-- person ever handles the private key.
create table public.push_keys (
  id integer primary key check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_keys enable row level security;
revoke all on public.push_keys from public, anon, authenticated;

-- One row per browser that accepted notifications. The profile server writes them (after
-- checking the address is a real push service); each player can see and remove their own.
create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1024),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "Chacun voit ses appareils" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Chacun retire ses appareils" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Invitations to a table between friends: shown in the app (even without notifications) and
-- used to send at most one a minute to the same friend for the same table.
create table public.table_invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 16),
  game text not null,
  room_code text not null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create index table_invites_to on public.table_invites (to_id, created_at desc);
create index table_invites_from on public.table_invites (from_id, to_id, room_code, created_at desc);

alter table public.table_invites enable row level security;
create policy "Chacun voit les invitations reçues" on public.table_invites
  for select to authenticated using (to_id = (select auth.uid()));
create policy "Chacun efface les invitations reçues" on public.table_invites
  for delete to authenticated using (to_id = (select auth.uid()));
revoke all on public.table_invites from public, anon, authenticated;
grant select, delete on public.table_invites to authenticated;
