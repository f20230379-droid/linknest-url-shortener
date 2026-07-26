-- Run this once in Supabase: SQL Editor > New query.
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  code varchar(32) not null unique check (code ~ '^[a-z0-9_-]{3,32}$'),
  destination text not null check (destination ~ '^https?://'),
  clicks bigint not null default 0 check (clicks >= 0),
  created_at timestamptz not null default now(),
  last_visited_at timestamptz
);

alter table public.links enable row level security;

-- The app's server connects using a private Supabase server key. Browser users
-- receive no direct table or function access.
revoke all on table public.links from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.links to service_role;

-- The server calls this function with a private service-role key. It atomically
-- updates analytics, so two visits at the same time cannot lose a click.
create or replace function public.record_link_visit(short_code text)
returns table (
  id uuid,
  code text,
  destination text,
  clicks bigint,
  created_at timestamptz,
  last_visited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.links as link
  set clicks = link.clicks + 1,
      last_visited_at = now()
  where link.code = lower(short_code)
  returning link.id, link.code::text, link.destination, link.clicks, link.created_at, link.last_visited_at;
end;
$$;

revoke all on function public.record_link_visit(text) from public, anon, authenticated;
grant execute on function public.record_link_visit(text) to service_role;
