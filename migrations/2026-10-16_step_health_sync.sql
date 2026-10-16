-- ============================================================
-- Step Challenge: automatic upload from Apple Health (iOS Shortcut)
-- Run once in the Supabase SQL Editor. Safe to run again: every statement is
-- idempotent, nothing existing is changed and nothing is dropped.
-- Requires migrations/2026-10-16_step_entries.sql.
--
-- A Shortcut on the iPhone reads the day's steps from Apple Health and posts
-- them to the Edge Function "health-steps" (supabase/functions/health-steps).
-- No login is involved there: a personal upload token, created in the
-- dashboard, identifies the user. Only the SHA-256 hash of a token is stored;
-- the token itself exists only in the Shortcut. The Edge Function calls
-- submit_health_steps() with the secret key; nobody else may call it.
-- ============================================================

-- ----- Upload tokens -----
create table if not exists public.step_upload_tokens (
    id           uuid        primary key default gen_random_uuid(),
    user_id      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
    token_hash   text        not null unique check (token_hash ~ '^[0-9a-f]{64}$'), -- sha256, hex
    label        text        not null default 'iPhone Shortcut' check (char_length(label) between 1 and 60),
    created_at   timestamptz not null default now(),
    last_used_at timestamptz                                        -- last upload with this token
);

comment on table public.step_upload_tokens is 'Step Challenge: tokens of the Apple Health Shortcut, only their SHA-256 hash (Dali''s Dashboard)';

create index if not exists step_upload_tokens_user_id_idx on public.step_upload_tokens (user_id);

alter table public.step_upload_tokens enable row level security;

-- Users see, add and revoke their own tokens; nobody changes one
do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'step_upload_tokens'
                   and policyname = 'Users can view own upload tokens') then
        create policy "Users can view own upload tokens" on public.step_upload_tokens
            for select to authenticated using ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'step_upload_tokens'
                   and policyname = 'Users can add own upload tokens') then
        create policy "Users can add own upload tokens" on public.step_upload_tokens
            for insert to authenticated with check ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'step_upload_tokens'
                   and policyname = 'Users can revoke own upload tokens') then
        create policy "Users can revoke own upload tokens" on public.step_upload_tokens
            for delete to authenticated using ((select auth.uid()) = user_id);
    end if;
end;
$$;

-- The hash is never read back through the API; anon gets nothing
revoke all on public.step_upload_tokens from anon, authenticated;
grant select (id, user_id, label, created_at, last_used_at), insert (user_id, token_hash, label), delete
    on public.step_upload_tokens to authenticated;

-- At most 5 tokens per user (one per device or Shortcut is plenty)
create or replace function public.step_upload_tokens_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if (select count(*) from public.step_upload_tokens t where t.user_id = new.user_id) >= 5 then
        raise exception 'At most 5 upload tokens: revoke one first' using errcode = '23514';
    end if;
    return new;
end;
$$;

create or replace trigger step_upload_tokens_limit
    before insert on public.step_upload_tokens
    for each row execute function public.step_upload_tokens_limit();

-- ----- Upload of one day -----
-- p_token: the token from the Shortcut (32 random bytes, base64url, 43 characters)
-- p_date:  the local calendar day of the steps (from the Shortcut)
-- p_steps: Apple Health's total for that day
-- Health totals only grow during a day, so an upload never lowers the stored
-- value: a run on a locked iPhone (Health data unreadable) or a partial day
-- cannot erase steps. A higher value - also a manual entry - stays.
create or replace function public.submit_health_steps(p_token text, p_date date, p_steps integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_hash  text;
    v_user  uuid;
    v_steps integer;
begin
    if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
        raise exception 'Invalid upload token' using errcode = '28000';
    end if;
    v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
    select t.user_id into v_user from public.step_upload_tokens t where t.token_hash = v_hash;
    if v_user is null then
        raise exception 'Invalid upload token' using errcode = '28000';
    end if;
    -- Local day of the user: allow one day ahead of UTC; catch-up for 31 days
    if p_date is null or p_date > current_date + 1 or p_date < current_date - 31 then
        raise exception 'Date out of range' using errcode = '22008';
    end if;
    if p_steps is null or p_steps < 0 or p_steps > 200000 then
        raise exception 'Steps out of range' using errcode = '22003';
    end if;

    update public.step_upload_tokens set last_used_at = now() where token_hash = v_hash;

    -- updated_at strictly newer than the stored row, so the last-write-wins trigger
    -- (step_entries_keep_newest) applies it even if a device clock ran ahead
    insert into public.step_entries as e (user_id, date, steps, deleted, updated_at)
    values (v_user, p_date, p_steps, false, now())
    on conflict (user_id, date) do update
        set steps = excluded.steps,
            deleted = false,
            updated_at = greatest(now(), e.updated_at + interval '1 millisecond')
        where e.deleted or excluded.steps > e.steps
    returning e.steps into v_steps;

    if v_steps is not null then
        return jsonb_build_object('date', p_date, 'steps', v_steps, 'updated', true);
    end if;
    select e.steps into v_steps from public.step_entries e where e.user_id = v_user and e.date = p_date;
    return jsonb_build_object('date', p_date, 'steps', v_steps, 'updated', false);
end;
$$;

-- Only the Edge Function (secret key = service_role) may call it
revoke all on function public.submit_health_steps(text, date, integer) from public, anon, authenticated;
grant execute on function public.submit_health_steps(text, date, integer) to service_role;

-- Check: three policies, function executable by service_role only
-- select policyname, cmd from pg_policies where tablename = 'step_upload_tokens';
-- select grantee from information_schema.routine_privileges where routine_name = 'submit_health_steps';
