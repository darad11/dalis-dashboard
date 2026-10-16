-- Assertions for migrations/2026-10-16_step_health_sync.sql (run by tests/sql/run.sh,
-- after step_entries.test.sql: user A and B exist, user A has rows for 2026-10-16/17)
\set ON_ERROR_STOP on
\set user_a '00000000-0000-4000-8000-00000000000a'
\set user_b '00000000-0000-4000-8000-00000000000b'
-- Tokens as the dashboard creates them (base64url, 43 characters); hashes = sha256 hex
\set token_a 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
\set token_b 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

reset role;
-- clean slate for the days used below (relative to today, the function only accepts recent days)
delete from public.step_entries where date >= current_date - 40;

-- ---------- user A manages tokens ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', false) \g /dev/null
insert into public.step_upload_tokens (token_hash, label)
values (encode(sha256(convert_to(:'token_a', 'UTF8')), 'hex'), 'iPhone');

do $$
declare n int;
begin
    -- own token visible (user_id from the login), but not its hash
    select count(*) into n from public.step_upload_tokens where user_id = auth.uid() and label = 'iPhone';
    if n <> 1 then raise exception 'user A should see exactly the own token (% rows)', n; end if;
    begin
        perform token_hash from public.step_upload_tokens;
        raise exception 'token hash was readable';
    exception when insufficient_privilege then null;
    end;
    -- tokens cannot be changed, only revoked
    begin
        update public.step_upload_tokens set label = 'x';
        raise exception 'update of a token was allowed';
    exception when insufficient_privilege then null;
    end;
    -- malformed hash rejected
    begin
        insert into public.step_upload_tokens (token_hash) values ('not-a-hash');
        raise exception 'malformed hash accepted';
    exception when check_violation then null;
    end;
    -- the function is not callable for logged-in users
    begin
        perform public.submit_health_steps(repeat('Q', 43), current_date, 1);
        raise exception 'authenticated could call submit_health_steps';
    exception when insufficient_privilege then null;
    end;
end;
$$;

-- at most 5 tokens per user (user A has 1)
do $$
begin
    insert into public.step_upload_tokens (token_hash) values (repeat('c', 64)), (repeat('d', 64)), (repeat('e', 64)), (repeat('f', 64));
    begin
        insert into public.step_upload_tokens (token_hash) values (repeat('0', 64));
        raise exception 'sixth token accepted';
    exception when check_violation then null;
    end;
    -- revoke: own tokens can be deleted
    delete from public.step_upload_tokens where label = 'iPhone Shortcut';
    if (select count(*) from (select id from public.step_upload_tokens) t) <> 1 then
        raise exception 'revoking own tokens failed';
    end if;
end;
$$;

-- ---------- user B cannot see or revoke A's token ----------
select set_config('request.jwt.claim.sub', :'user_b', false) \g /dev/null
insert into public.step_upload_tokens (token_hash) values (encode(sha256(convert_to(:'token_b', 'UTF8')), 'hex'));
do $$
declare n int;
begin
    select count(*) into n from (select id from public.step_upload_tokens) t;
    if n <> 1 then raise exception 'user B sees % tokens instead of only the own one', n; end if;
    delete from public.step_upload_tokens where label = 'iPhone';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'user B revoked a token of user A'; end if;
    begin
        insert into public.step_upload_tokens (user_id, token_hash) values ('00000000-0000-4000-8000-00000000000a', repeat('1', 64));
        raise exception 'token for another user accepted';
    exception when insufficient_privilege then null;
    end;
end;
$$;

-- ---------- anon: no access at all ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$
begin
    begin
        perform 1 from public.step_upload_tokens;
        raise exception 'anon could read tokens';
    exception when insufficient_privilege then null;
    end;
    begin
        perform public.submit_health_steps(repeat('Q', 43), current_date, 1);
        raise exception 'anon could call submit_health_steps';
    exception when insufficient_privilege then null;
    end;
end;
$$;

-- ---------- the Edge Function (service_role) uploads ----------
set role service_role;
do $$
declare r jsonb; s int; d boolean; u timestamptz; used timestamptz;
    tok text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    a uuid := '00000000-0000-4000-8000-00000000000a';
begin
    -- unknown or malformed token: same error, nothing written
    begin
        perform public.submit_health_steps('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', current_date, 500);
        raise exception 'unknown token accepted';
    exception when invalid_authorization_specification then null;
    end;
    begin
        perform public.submit_health_steps('short', current_date, 500);
        raise exception 'malformed token accepted';
    exception when invalid_authorization_specification then null;
    end;
    -- out of range
    begin
        perform public.submit_health_steps(tok, current_date + 2, 500);
        raise exception 'future day accepted';
    exception when datetime_field_overflow then null;
    end;
    begin
        perform public.submit_health_steps(tok, current_date - 32, 500);
        raise exception 'day older than 31 days accepted';
    exception when datetime_field_overflow then null;
    end;
    begin
        perform public.submit_health_steps(tok, current_date, 200001);
        raise exception 'implausible steps accepted';
    exception when numeric_value_out_of_range then null;
    end;
    begin
        perform public.submit_health_steps(tok, current_date, -1);
        raise exception 'negative steps accepted';
    exception when numeric_value_out_of_range then null;
    end;
    if exists (select 1 from public.step_entries where date >= current_date - 40) then
        raise exception 'a rejected upload wrote a row';
    end if;

    -- first upload of the day: row for user A (from the token), not for the caller
    r := public.submit_health_steps(tok, current_date, 4200);
    if r->>'steps' <> '4200' or (r->>'updated')::boolean is not true then raise exception 'first upload: %', r; end if;
    select steps, deleted, updated_at into s, d, u from public.step_entries where user_id = a and date = current_date;
    if s <> 4200 or d then raise exception 'stored % (deleted %)', s, d; end if;
    select last_used_at into used from public.step_upload_tokens where label = 'iPhone';
    if used is null then raise exception 'last_used_at not set'; end if;

    -- later in the day: higher total replaces it
    r := public.submit_health_steps(tok, current_date, 9100);
    if r->>'steps' <> '9100' then raise exception 'higher total not applied: %', r; end if;

    -- a lower total (locked iPhone, partial day) never lowers it
    r := public.submit_health_steps(tok, current_date, 0);
    if r->>'steps' <> '9100' or (r->>'updated')::boolean is not false then raise exception 'lower total changed the day: %', r; end if;
    select steps into s from public.step_entries where user_id = a and date = current_date;
    if s <> 9100 then raise exception 'stored value lowered to %', s; end if;

    -- a day marked "not logged" is filled again by Health
    update public.step_entries set deleted = true, steps = 0 where user_id = a and date = current_date;
    r := public.submit_health_steps(tok, current_date, 300);
    select steps, deleted into s, d from public.step_entries where user_id = a and date = current_date;
    if s <> 300 or d then raise exception 'tombstone not replaced: % %', s, d; end if;

    -- a device clock far ahead does not block the upload (last-write-wins trigger)
    update public.step_entries set updated_at = now() + interval '1 day' where user_id = a and date = current_date;
    r := public.submit_health_steps(tok, current_date, 12000);
    select steps, updated_at into s, u from public.step_entries where user_id = a and date = current_date;
    if s <> 12000 then raise exception 'upload blocked by a newer updated_at: %', s; end if;
    if u <= now() + interval '1 day' then raise exception 'updated_at did not move forward'; end if;

    -- yesterday (catch-up) and tomorrow in UTC (users east of UTC) are fine
    r := public.submit_health_steps(tok, current_date - 1, 15000);
    r := public.submit_health_steps(tok, current_date + 1, 10);
    if (select count(*) from public.step_entries where user_id = a and date between current_date - 1 and current_date + 1) <> 3 then
        raise exception 'catch-up days missing';
    end if;

    -- user B's token writes B's rows only
    r := public.submit_health_steps('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', current_date, 777);
    if (select steps from public.step_entries where user_id = '00000000-0000-4000-8000-00000000000b' and date = current_date) <> 777 then
        raise exception 'user B upload missing';
    end if;
    if (select steps from public.step_entries where user_id = a and date = current_date) <> 12000 then
        raise exception 'user B upload changed user A';
    end if;
end;
$$;

-- ---------- a revoked token stops working ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', false) \g /dev/null
delete from public.step_upload_tokens where label = 'iPhone';
set role service_role;
do $$
begin
    perform public.submit_health_steps('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', current_date, 13000);
    raise exception 'revoked token still accepted';
exception when invalid_authorization_specification then null;
end;
$$;

-- ---------- deleting the account removes its tokens ----------
reset role;
delete from public.step_entries where user_id = :'user_b';
delete from auth.users where id = :'user_b';
do $$
begin
    if exists (select 1 from public.step_upload_tokens where user_id = '00000000-0000-4000-8000-00000000000b') then
        raise exception 'tokens of a deleted user remain';
    end if;
end;
$$;

-- grants as intended
do $$
begin
    if exists (select 1 from information_schema.routine_privileges
               where routine_name = 'submit_health_steps' and grantee in ('PUBLIC', 'anon', 'authenticated')) then
        raise exception 'submit_health_steps executable by an API role';
    end if;
    if (select count(*) from pg_policies where tablename = 'step_upload_tokens') <> 3 then
        raise exception 'expected 3 policies on step_upload_tokens';
    end if;
end;
$$;

\echo 'step_health_sync.test.sql: all assertions passed'
