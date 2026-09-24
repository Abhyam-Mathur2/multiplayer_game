-- DUO online multiplayer database
create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null,
  guest_id uuid,
  host_name text not null,
  guest_name text,
  game text not null default 'tictactoe',
  state jsonb not null default '{}'::jsonb,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create policy "rooms readable by everyone"
on public.rooms for select using (true);

create policy "rooms insertable by everyone"
on public.rooms for insert with check (true);

create policy "rooms updateable by everyone"
on public.rooms for update using (true) with check (true);

create policy "rooms deletable by everyone"
on public.rooms for delete using (true);

-- Realtime
alter publication supabase_realtime add table public.rooms;
