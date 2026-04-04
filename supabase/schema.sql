create extension if not exists pgcrypto;

create table if not exists public.profiles (
  username text primary key,
  password jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  from_username text not null references public.profiles(username) on delete cascade,
  to_username text not null references public.profiles(username) on delete cascade,
  status text not null check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.connections (
  room_key text primary key,
  user_a text not null references public.profiles(username) on delete cascade,
  user_b text not null references public.profiles(username) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_key text not null references public.connections(room_key) on delete cascade,
  from_username text not null references public.profiles(username) on delete cascade,
  to_username text not null references public.profiles(username) on delete cascade,
  text text,
  attachment jsonb,
  status text not null check (status in ('sending','sent','delivered','read','failed')),
  client_temp_id text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

create index if not exists messages_room_key_created_idx on public.messages(room_key, created_at);
create index if not exists invites_to_status_created_idx on public.invites(to_username, status, created_at desc);

create table if not exists public.typing_status (
  from_username text not null references public.profiles(username) on delete cascade,
  to_username text not null references public.profiles(username) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (from_username, to_username)
);
