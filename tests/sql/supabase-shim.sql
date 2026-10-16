-- Minimal stand-in for the parts of Supabase the migrations rely on.
-- For a LOCAL throwaway PostgreSQL only (see tests/sql/run.sh) - never run this on Supabase.
-- Roles are cluster-wide: create them only once
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated; -- needed for the foreign key check

grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants new tables in public to the API roles by default
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

create publication supabase_realtime;

-- Existing dashboard tables (columns as used by js/supabase.js)
create table public.goals (id uuid primary key default gen_random_uuid(), date text, text text, done boolean default false,
    rolled_from text, created_at timestamptz default now());
create table public.habits (id uuid primary key default gen_random_uuid(), name text, color text, history jsonb,
    created_at timestamptz default now());
create table public.notes (id uuid primary key default gen_random_uuid(), date text, content text, created_at timestamptz default now());
create table public.kanban_tasks (id uuid primary key default gen_random_uuid(), week_key text, column_name text, text text,
    sort_order integer, created_at timestamptz default now());
create table public.backlog_tasks (id uuid primary key default gen_random_uuid(), column_name text, text text,
    sort_order integer, created_at timestamptz default now());
create table public.lists (id uuid primary key default gen_random_uuid(), name text, items jsonb, icon text,
    created_at timestamptz default now());
create table public.pomodoro_stats (id uuid primary key default gen_random_uuid(), date text, count integer);
create table public.settings (id uuid primary key default gen_random_uuid(), key text, value jsonb,
    created_at timestamptz default now());
alter table public.goals enable row level security;
alter table public.habits enable row level security;
alter table public.notes enable row level security;
alter table public.kanban_tasks enable row level security;
alter table public.backlog_tasks enable row level security;
alter table public.lists enable row level security;
alter table public.pomodoro_stats enable row level security;
alter table public.settings enable row level security;
