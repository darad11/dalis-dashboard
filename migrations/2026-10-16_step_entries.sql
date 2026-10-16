-- ============================================================
-- Step Challenge: daily step counts
-- Run once in the Supabase SQL Editor. Safe to run again: every
-- statement is idempotent and nothing existing is changed or deleted.
--
-- One row per user and calendar day. The challenge settings (goal,
-- start value, last year's total) live in the existing settings table
-- under the key 'stepChallenge'.
-- ============================================================

create table if not exists public.step_entries (
    user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
    date       date        not null,                 -- local calendar day of the user
    steps      integer     not null default 0 check (steps between 0 and 200000),
    deleted    boolean     not null default false,   -- "not logged" again (keeps the change visible to other devices)
    updated_at timestamptz not null default now(),   -- time of the change on the device (last write wins)
    created_at timestamptz not null default now(),
    primary key (user_id, date)                      -- one value per day, enforced by the database
);

comment on table public.step_entries is 'Step Challenge: one row per user and day (Dali''s Dashboard)';

-- ----- Row Level Security: every user sees and changes only own rows -----
alter table public.step_entries enable row level security;

drop policy if exists "Users can view own step entries" on public.step_entries;
create policy "Users can view own step entries" on public.step_entries
    for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own step entries" on public.step_entries;
create policy "Users can insert own step entries" on public.step_entries
    for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own step entries" on public.step_entries;
create policy "Users can update own step entries" on public.step_entries
    for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own step entries" on public.step_entries;
create policy "Users can delete own step entries" on public.step_entries
    for delete using ((select auth.uid()) = user_id);

-- Logged-in users only; RLS above limits them to their own rows
revoke all on public.step_entries from anon;
grant select, insert, update, delete on public.step_entries to authenticated;

-- ----- Last write wins per day -----
-- An upload with an older updated_at than the stored row (e.g. from a device
-- that was offline) is skipped instead of overwriting the newer value.
create or replace function public.step_entries_keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.updated_at < old.updated_at then
        return null; -- keep the newer stored row
    end if;
    return new;
end;
$$;

drop trigger if exists step_entries_keep_newest on public.step_entries;
create trigger step_entries_keep_newest
    before update on public.step_entries
    for each row execute function public.step_entries_keep_newest();

-- ----- Realtime: other devices receive changes immediately -----
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'step_entries'
       ) then
        alter publication supabase_realtime add table public.step_entries;
    end if;
end;
$$;

-- Check: should list the four policies above
-- select policyname, cmd from pg_policies where tablename = 'step_entries';
