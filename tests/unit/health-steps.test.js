'use strict';
// Edge Function "health-steps" (supabase/functions/health-steps/handler.mjs): request
// checks, parsing of what a Shortcut sends, the call of submit_health_steps and the answers.
// The database is replaced by a fake fetch; nothing is sent anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const load = () => import(path.join(__dirname, '../../supabase/functions/health-steps/handler.mjs'));
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_6'; // 43 characters, base64url
const URL_ = 'https://example.supabase.co';

function post(body, raw) {
  return new Request('https://example.supabase.co/functions/v1/health-steps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : JSON.stringify(body)
  });
}

function fakeDb(status, payload) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, calls };
}

test('parseSteps: numbers and the texts a Shortcut can produce', async () => {
  const { parseSteps } = await load();
  assert.equal(parseSteps(12345), 12345);
  assert.equal(parseSteps(12345.6), 12346);
  assert.equal(parseSteps(0), 0);
  assert.equal(parseSteps('12345'), 12345);
  assert.equal(parseSteps('12.345'), 12345);   // German thousands separator
  assert.equal(parseSteps('12,345'), 12345);
  assert.equal(parseSteps('12 345'), 12345);
  assert.equal(parseSteps('12 345'), 12345);
  assert.equal(parseSteps('1.234.567'), 1234567);
  assert.equal(parseSteps('12345,7'), 12346);  // decimal comma
  assert.equal(parseSteps('12.345 Schritte'), 12345);
  assert.equal(parseSteps('8123 count'), 8123);
  for (const bad of [-1, NaN, Infinity, '', 'abc', '-5', '1.2.3', '12.34.5', '12.345.', null, undefined, {}, [], true]) {
    assert.equal(parseSteps(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

test('parseDate: yyyy-MM-dd, ISO with time, dd.MM.yyyy; invalid days rejected', async () => {
  const { parseDate } = await load();
  assert.equal(parseDate('2026-10-16'), '2026-10-16');
  assert.equal(parseDate(' 2026-10-16 '), '2026-10-16');
  assert.equal(parseDate('2026-10-16T18:05:00+02:00'), '2026-10-16');
  assert.equal(parseDate('16.10.2026'), '2026-10-16');
  assert.equal(parseDate('6.1.2027'), '2027-01-06');
  for (const bad of ['2026-02-30', '2026-13-01', '16/10/2026', '20261016', 'today', '', 20261016, null]) {
    assert.equal(parseDate(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

test('only POST; an unconfigured function says so', async () => {
  const { handleHealthSteps } = await load();
  const db = fakeDb(200, {});
  let res = await handleHealthSteps(new Request(URL_ + '/functions/v1/health-steps'), { supabaseUrl: URL_, secretKey: 'sb_secret_x', fetch: db.fetch });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('Allow'), 'POST');
  res = await handleHealthSteps(post({ token: TOKEN, date: '2026-10-16', steps: 1 }), { fetch: db.fetch });
  assert.equal(res.status, 500);
  assert.equal(db.calls.length, 0);
});

test('malformed requests are answered without touching the database', async () => {
  const { handleHealthSteps } = await load();
  const db = fakeDb(200, {});
  const env = { supabaseUrl: URL_, secretKey: 'sb_secret_x', fetch: db.fetch };
  const cases = [
    [post(null, 'not json'), 400],
    [post([1, 2]), 400],
    [post({ date: '2026-10-16', steps: 5 }), 401],
    [post({ token: 'short', date: '2026-10-16', steps: 5 }), 401],
    [post({ token: TOKEN + '!', date: '2026-10-16', steps: 5 }), 401],
    [post({ token: TOKEN, date: '16 Oct 2026', steps: 5 }), 400],
    [post({ token: TOKEN, date: '2026-10-16', steps: 'many' }), 400],
    [post({ token: TOKEN, date: '2026-10-16' }), 400]
  ];
  for (const [req, status] of cases) {
    const res = await handleHealthSteps(req, env);
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(typeof body.error, 'string');
  }
  assert.equal(db.calls.length, 0);
});

test('a valid upload calls submit_health_steps with the secret key on apikey', async () => {
  const { handleHealthSteps } = await load();
  const db = fakeDb(200, { date: '2026-10-16', steps: 12345, updated: true });
  const res = await handleHealthSteps(post({ token: ` ${TOKEN} `, date: '2026-10-16', steps: '12.345' }),
    { supabaseUrl: URL_ + '/', secretKey: 'sb_secret_abc', fetch: db.fetch });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await res.json(), { ok: true, date: '2026-10-16', steps: 12345, updated: true, message: 'Saved: 12345 steps on 2026-10-16' });
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].url, 'https://example.supabase.co/rest/v1/rpc/submit_health_steps');
  assert.equal(db.calls[0].init.method, 'POST');
  assert.deepEqual(db.calls[0].body, { p_token: TOKEN, p_date: '2026-10-16', p_steps: 12345 });
  assert.equal(db.calls[0].init.headers.apikey, 'sb_secret_abc');
  assert.equal(db.calls[0].init.headers.Authorization, undefined, 'new secret keys must not be sent as bearer token');
});

test('a legacy service_role key (JWT) is also sent as bearer token', async () => {
  const { handleHealthSteps } = await load();
  const db = fakeDb(200, { date: '2026-10-16', steps: 50, updated: true });
  await handleHealthSteps(post({ token: TOKEN, date: '2026-10-16', steps: 50 }), { supabaseUrl: URL_, secretKey: 'eyJhbGciOi.legacy.jwt', fetch: db.fetch });
  assert.equal(db.calls[0].init.headers.apikey, 'eyJhbGciOi.legacy.jwt');
  assert.equal(db.calls[0].init.headers.Authorization, 'Bearer eyJhbGciOi.legacy.jwt');
});

test('a lower count is reported as kept', async () => {
  const { handleHealthSteps } = await load();
  const db = fakeDb(200, { date: '2026-10-16', steps: 9100, updated: false });
  const res = await handleHealthSteps(post({ token: TOKEN, date: '2026-10-16', steps: 0 }), { supabaseUrl: URL_, secretKey: 'sb_secret_abc', fetch: db.fetch });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.updated, false);
  assert.equal(body.steps, 9100);
  assert.match(body.message, /already stored/);
});

test('database answers become clear errors without internal details', async () => {
  const { handleHealthSteps } = await load();
  const env = (status, payload) => ({ supabaseUrl: URL_, secretKey: 'sb_secret_abc', fetch: fakeDb(status, payload).fetch });
  const req = () => post({ token: TOKEN, date: '2026-10-16', steps: 10 });
  const errors = console.error;
  console.error = () => {};
  try {
    let res = await handleHealthSteps(req(), env(400, { code: '28000', message: 'Invalid upload token' }));
    assert.equal(res.status, 401);
    res = await handleHealthSteps(req(), env(400, { code: '22008', message: 'Date out of range' }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /31 days/);
    res = await handleHealthSteps(req(), env(400, { code: '22003', message: 'Steps out of range' }));
    assert.equal(res.status, 400);
    res = await handleHealthSteps(req(), env(500, { code: 'XX000', message: 'relation "secret_table" does not exist' }));
    assert.equal(res.status, 502);
    assert.doesNotMatch(JSON.stringify(await res.json()), /secret_table|XX000/);
    res = await handleHealthSteps(req(), { supabaseUrl: URL_, secretKey: 'sb_secret_abc', fetch: async () => { throw new Error('offline'); } });
    assert.equal(res.status, 502);
  } finally {
    console.error = errors;
  }
});
