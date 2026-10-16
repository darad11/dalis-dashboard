-- Assertions for migrations/2026-10-16_step_entries.sql (run by tests/sql/run.sh)
\set ON_ERROR_STOP on
\set user_a '00000000-0000-4000-8000-00000000000a'
\set user_b '00000000-0000-4000-8000-00000000000b'

insert into auth.users values (:'user_a'), (:'user_b');

-- ---------- as user A ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', false) \g /dev/null

-- user_id defaults to the logged-in user
insert into public.step_entries (date, steps, updated_at) values ('2026-10-16', 12000, '2026-10-16T18:00:00Z');

do $$
declare n int; s int;
begin
    -- upsert with a NEWER timestamp is applied and returned (what PostgREST does)
    with r as (
        insert into public.step_entries (user_id, date, steps, deleted, updated_at)
        values (auth.uid(), '2026-10-16', 15000, false, '2026-10-16T19:00:00Z')
        on conflict (user_id, date) do update
            set steps = excluded.steps, deleted = excluded.deleted, updated_at = excluded.updated_at
        returning 1)
    select count(*) into n from r;
    if n <> 1 then raise exception 'newer upsert was not applied (% rows)', n; end if;

    -- upsert with an OLDER timestamp is skipped and not returned
    with r as (
        insert into public.step_entries (user_id, date, steps, deleted, updated_at)
        values (auth.uid(), '2026-10-16', 9000, false, '2026-10-16T17:00:00Z')
        on conflict (user_id, date) do update
            set steps = excluded.steps, deleted = excluded.deleted, updated_at = excluded.updated_at
        returning 1)
    select count(*) into n from r;
    if n <> 0 then raise exception 'older upsert must be skipped (% rows returned)', n; end if;
    select steps into s from public.step_entries where date = '2026-10-16';
    if s <> 15000 then raise exception 'older upsert overwrote the newer value: %', s; end if;

    -- same timestamp (re-upload of the same version) is accepted
    update public.step_entries set steps = 15000 where date = '2026-10-16' and updated_at = '2026-10-16T19:00:00Z';

    -- tombstone ("not logged" again)
    with r as (
        insert into public.step_entries (user_id, date, steps, deleted, updated_at)
        values (auth.uid(), '2026-10-17', 0, true, '2026-10-17T20:00:00Z')
        on conflict (user_id, date) do update
            set steps = excluded.steps, deleted = excluded.deleted, updated_at = excluded.updated_at
        returning 1)
    select count(*) into n from r;
    if n <> 1 then raise exception 'tombstone insert failed'; end if;

    -- one row per day: a second plain insert for the same day fails
    begin
        insert into public.step_entries (date, steps) values ('2026-10-16', 1);
        raise exception 'duplicate day was accepted';
    exception when unique_violation then null;
    end;

    -- invalid values are rejected by the database too
    begin
        insert into public.step_entries (date, steps) values ('2026-10-20', -1);
        raise exception 'negative steps accepted';
    exception when check_violation then null;
    end;
    begin
        insert into public.step_entries (date, steps) values ('2026-10-21', 200001);
        raise exception 'implausible steps accepted';
    exception when check_violation then null;
    end;

    -- RLS: cannot write rows for another user
    begin
        insert into public.step_entries (user_id, date, steps) values ('00000000-0000-4000-8000-00000000000b', '2026-10-16', 1);
        raise exception 'row for another user was accepted';
    exception when insufficient_privilege then null;
    end;
end;
$$;

-- ---------- as user B ----------
select set_config('request.jwt.claim.sub', :'user_b', false) \g /dev/null
do $$
declare n int;
begin
    select count(*) into n from public.step_entries;
    if n <> 0 then raise exception 'user B can see % rows of user A', n; end if;

    update public.step_entries set steps = 1 where user_id = '00000000-0000-4000-8000-00000000000a';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'user B updated % rows of user A', n; end if;

    delete from public.step_entries where user_id = '00000000-0000-4000-8000-00000000000a';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'user B deleted % rows of user A', n; end if;

    -- B's own row for the same day is independent
    insert into public.step_entries (date, steps) values ('2026-10-16', 7000);
end;
$$;

-- ---------- anonymous ----------
reset role;
set role anon;
do $$
begin
    perform 1 from public.step_entries;
    raise exception 'anon can read step_entries';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- ---------- structure ----------
do $$
declare n int;
begin
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'step_entries';
    if n <> 4 then raise exception 'expected 4 policies, found %', n; end if;
    select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'step_entries';
    if n <> 1 then raise exception 'step_entries is not in the realtime publication'; end if;
    select count(*) into n from public.step_entries where user_id = '00000000-0000-4000-8000-00000000000a';
    if n <> 2 then raise exception 'expected 2 rows for user A, found %', n; end if;
end;
$$;

\echo 'step_entries: all assertions passed'
