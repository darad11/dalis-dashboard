-- ============================================================
-- READ-ONLY health check for the existing tables (changes nothing).
-- Run in the Supabase SQL Editor and look at each result.
-- ============================================================

-- 1) Row Level Security must be ON for every table (rowsecurity = true)
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2) Policies per table: expect SELECT/INSERT/UPDATE/DELETE limited to auth.uid() = user_id,
--    and no leftover "Allow all" policy
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- 3) Rows without an owner (invisible to everyone, usually from before the multi-user migration)
select 'goals' as table_name, count(*) from public.goals where user_id is null
union all select 'habits', count(*) from public.habits where user_id is null
union all select 'notes', count(*) from public.notes where user_id is null
union all select 'kanban_tasks', count(*) from public.kanban_tasks where user_id is null
union all select 'backlog_tasks', count(*) from public.backlog_tasks where user_id is null
union all select 'lists', count(*) from public.lists where user_id is null
union all select 'pomodoro_stats', count(*) from public.pomodoro_stats where user_id is null
union all select 'settings', count(*) from public.settings where user_id is null;

-- 4) Duplicate rows that older app versions could create
--    (the app now tolerates them, but they should not exist)
select 'settings' as table_name, user_id, key as item, count(*) as copies
from public.settings group by user_id, key having count(*) > 1
union all
select 'notes', user_id, date, count(*) from public.notes group by user_id, date having count(*) > 1
union all
select 'lists', user_id, name, count(*) from public.lists group by user_id, name having count(*) > 1
union all
select 'pomodoro_stats', user_id, date, count(*) from public.pomodoro_stats group by user_id, date having count(*) > 1;

-- ------------------------------------------------------------
-- OPTIONAL, only after reviewing result 4 and exporting a backup
-- (dashboard: ☁️ Sync → Export backup). Not needed for the Step Challenge.
-- Keeps the most recently created row per key and adds a unique index so
-- duplicates cannot come back. Run each block separately.
-- ------------------------------------------------------------
-- delete from public.settings s
-- using public.settings newer
-- where s.user_id = newer.user_id and s.key = newer.key
--   and (newer.created_at, newer.id::text) > (s.created_at, s.id::text);
-- create unique index if not exists settings_user_key_unique on public.settings (user_id, key);
--
-- (requires a created_at column; check with:
--  select column_name from information_schema.columns where table_name = 'settings';)
