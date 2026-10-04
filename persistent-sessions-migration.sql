-- Run once in Supabase SQL Editor before deploying this version.
create table if not exists public.user_sessions (
  sid text primary key,
  sess jsonb not null,
  expire timestamptz not null
);

create index if not exists user_sessions_expire_idx
  on public.user_sessions (expire);

-- Sessions are server-only. Do not expose them through the Data API.
alter table public.user_sessions enable row level security;

revoke all on table public.user_sessions from anon, authenticated;
