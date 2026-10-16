-- Assertions for migrations/2026-10-16_calendar_times.sql (run by tests/sql/run.sh)
\set ON_ERROR_STOP on
\set user_a '00000000-0000-4000-8000-0000000000c1'
\set user_b '00000000-0000-4000-8000-0000000000c2'

insert into auth.users values (:'user_a'), (:'user_b');

do $$
declare t text;
begin
    select data_type into t from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'start_time';
    if t is distinct from 'time without time zone' then raise exception 'start_time has type %', t; end if;
    select data_type into t from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'end_time';
    if t is distinct from 'time without time zone' then raise exception 'end_time has type %', t; end if;
    select data_type into t from information_schema.columns
    where table_schema = 'public' and table_name = 'goals' and column_name = 'calendar_id';
    if t is distinct from 'text' then raise exception 'calendar_id has type %', t; end if;
end;
$$;

-- ---------- as user A ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', false) \g /dev/null

-- Old-style rows (what the app sends for entries without a time) still work
insert into public.goals (user_id, date, text, done, position)
values (auth.uid(), 'cal-2026-9-16', 'Paket abholen', false, 0);

-- Timed entry in an own calendar; "HH:MM" from the app is stored and returned as a time
insert into public.goals (user_id, date, text, done, position, start_time, end_time, calendar_id)
values (auth.uid(), 'cal-2026-9-16', 'Team-Meeting', false, 1, '10:00', '11:30', 'cal-work');

do $$
declare r record;
begin
    select start_time::text as s, end_time::text as e, calendar_id into r
    from public.goals where text = 'Team-Meeting';
    if r.s <> '10:00:00' or r.e <> '11:30:00' or r.calendar_id <> 'cal-work' then
        raise exception 'unexpected stored values: % % %', r.s, r.e, r.calendar_id;
    end if;
    select start_time, end_time, calendar_id into r from public.goals where text = 'Paket abholen';
    if r.start_time is not null or r.end_time is not null or r.calendar_id is not null then
        raise exception 'old-style row got values';
    end if;

    -- zero-length entry (start = end) is allowed
    insert into public.goals (user_id, date, text, position, start_time, end_time)
    values (auth.uid(), 'cal-2026-9-16', 'Anruf', 2, '14:00', '14:00');

    -- end before start is rejected
    begin
        insert into public.goals (user_id, date, text, position, start_time, end_time)
        values (auth.uid(), 'cal-2026-9-16', 'kaputt', 3, '15:00', '14:00');
        raise exception 'end before start was accepted';
    exception when check_violation then null;
    end;

    -- end without start is rejected
    begin
        insert into public.goals (user_id, date, text, position, end_time)
        values (auth.uid(), 'cal-2026-9-16', 'kaputt', 3, '14:00');
        raise exception 'end without start was accepted';
    exception when check_violation then null;
    end;

    -- invalid times are rejected by the type
    begin
        insert into public.goals (user_id, date, text, position, start_time)
        values (auth.uid(), 'cal-2026-9-16', 'kaputt', 3, '25:00');
        raise exception 'invalid time was accepted';
    exception when datetime_field_overflow or invalid_datetime_format then null;
    end;

    -- empty calendar id is rejected
    begin
        insert into public.goals (user_id, date, text, position, calendar_id)
        values (auth.uid(), 'cal-2026-9-16', 'kaputt', 3, '');
        raise exception 'empty calendar id was accepted';
    exception when check_violation then null;
    end;
end;
$$;

-- ---------- as user B: Row Level Security still applies to the new columns ----------
select set_config('request.jwt.claim.sub', :'user_b', false) \g /dev/null
do $$
declare n int;
begin
    select count(*) into n from public.goals;
    if n <> 0 then raise exception 'user B sees % rows of user A', n; end if;
    update public.goals set start_time = '08:00' where text = 'Team-Meeting';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'user B changed a row of user A'; end if;
end;
$$;

reset role;
do $$
declare n int;
begin
    select count(*) into n from public.goals where text = 'Team-Meeting' and start_time = '10:00';
    if n <> 1 then raise exception 'row of user A was changed by user B'; end if;
end;
$$;

select 'calendar_times.test.sql: all assertions passed' as result;
