// Checks that js/supabase.js builds the expected PostgREST requests with the
// real supabase-js library (pinned version), using an intercepted fetch: no network.
//
// Optional: needs @supabase/supabase-js, e.g.
//   npm install --no-save @supabase/supabase-js@2.117.2 && node --test tests/contract/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let supabaseJs = null;
try {
  supabaseJs = require('@supabase/supabase-js');
} catch (e) {
  // skipped below
}

const USER = '00000000-0000-4000-8000-000000000001';
const requests = [];
let responder = () => ({ status: 200, body: [] });
let latency = () => 0;

async function fakeFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const headers = new Headers(init.headers || {});
  const req = {
    method: (init.method || 'GET').toUpperCase(),
    path: url.pathname,
    params: Object.fromEntries(url.searchParams),
    prefer: headers.get('prefer') || '',
    body: init.body ? JSON.parse(init.body) : null
  };
  requests.push(req);
  // The "server" handles the request on arrival; latency only delays the response
  const { status, body } = responder(req);
  const wait = latency(req);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function loadApi() {
  global.window = global;
  window.currentUserId = USER;
  window.supabase = {
    createClient: (url, key) => supabaseJs.createClient(url, key, {
      global: { fetch: fakeFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  };
  delete window.supabaseClient;
  delete require.cache[require.resolve('../../js/supabase.js')];
  require(path.join(__dirname, '../../js/supabase.js'));
  return window.supabaseDB;
}

test('supabase.js request contract', { skip: supabaseJs ? false : '@supabase/supabase-js not installed' }, async (t) => {
  const api = loadApi();

  await t.test('getStepEntries reads only the own rows, ordered by day', async () => {
    requests.length = 0;
    responder = () => ({ status: 200, body: [{ date: '2026-10-16', steps: 12345, deleted: false, updated_at: '2026-10-16T18:00:00+00:00' }] });
    const res = await api.getStepEntries();
    assert.equal(res.error, null);
    assert.equal(res.data.length, 1);
    const [req] = requests;
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/rest/v1/step_entries');
    assert.equal(req.params.user_id, `eq.${USER}`);
    assert.equal(req.params.select, 'date,steps,deleted,updated_at');
    assert.equal(req.params.order, 'date.asc');
  });

  await t.test('upsertStepEntries upserts on (user_id, date) and returns the written rows', async () => {
    requests.length = 0;
    responder = (req) => ({ status: 201, body: req.body.map(r => ({ ...r, updated_at: r.updated_at.replace('Z', '+00:00') })) });
    const rows = [{ date: '2026-10-16', steps: 12345, deleted: false, updated_at: '2026-10-16T18:00:00.000Z' }];
    const res = await api.upsertStepEntries(rows);
    assert.equal(res.error, null);
    const [req] = requests;
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/step_entries');
    assert.equal(req.params.on_conflict, 'user_id,date');
    assert.match(req.prefer, /resolution=merge-duplicates/);
    assert.match(req.prefer, /return=representation/);
    assert.deepEqual(req.body, [{ user_id: USER, date: '2026-10-16', steps: 12345, deleted: false, updated_at: '2026-10-16T18:00:00.000Z' }]);
  });

  await t.test('upload keys: only the hash is sent, the hash is never read back', async () => {
    const hash = 'a'.repeat(64);
    requests.length = 0;
    responder = () => ({ status: 201, body: { id: 'k1', label: 'iPhone Shortcut', created_at: '2026-10-16T08:00:00+00:00', last_used_at: null } });
    const created = await api.createStepUploadToken(hash, 'iPhone Shortcut');
    assert.equal(created.error, null);
    assert.equal(created.data.id, 'k1');
    let [req] = requests;
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/rest/v1/step_upload_tokens');
    assert.deepEqual(req.body, { user_id: USER, token_hash: hash, label: 'iPhone Shortcut' });
    assert.equal(req.params.select, 'id,label,created_at,last_used_at');

    requests.length = 0;
    responder = () => ({ status: 200, body: [] });
    await api.listStepUploadTokens();
    [req] = requests;
    assert.equal(req.method, 'GET');
    assert.equal(req.params.select, 'id,label,created_at,last_used_at', 'token_hash is not requested');
    assert.equal(req.params.user_id, `eq.${USER}`);
    assert.equal(req.params.order, 'created_at.asc');

    requests.length = 0;
    responder = () => ({ status: 204, body: null });
    await api.deleteStepUploadToken('k1');
    [req] = requests;
    assert.equal(req.method, 'DELETE');
    assert.equal(req.params.id, 'eq.k1');
    assert.equal(req.params.user_id, `eq.${USER}`);
    assert.equal(api.healthStepsUrl, 'https://jbkufpyyfmbxjeswagli.supabase.co/functions/v1/health-steps');
  });

  await t.test('missing table errors reach the caller unchanged', async () => {
    responder = () => ({ status: 404, body: { code: 'PGRST205', message: "Could not find the table 'public.step_entries' in the schema cache" } });
    const res = await api.getStepEntries();
    assert.equal(res.error.code, 'PGRST205');
  });

  await t.test('setSetting updates all rows of the key, inserts only if none exist', async () => {
    requests.length = 0;
    responder = (req) => (req.method === 'PATCH' ? { status: 200, body: [] } : { status: 201, body: null });
    const err = await api.setSetting('stepChallenge', { version: 1 });
    assert.equal(err, null);
    assert.deepEqual(requests.map(r => r.method), ['PATCH', 'POST']);
    const [patch, insert] = requests;
    assert.equal(patch.params.user_id, `eq.${USER}`);
    assert.equal(patch.params.key, 'eq.stepChallenge');
    assert.match(patch.prefer, /return=representation/);
    assert.deepEqual(patch.body, { value: { version: 1 } });
    assert.deepEqual(insert.body, { user_id: USER, key: 'stepChallenge', value: { version: 1 } });

    requests.length = 0;
    responder = (req) => (req.method === 'PATCH' ? { status: 200, body: [{ id: 'x' }, { id: 'y' }] } : { status: 500, body: null });
    assert.equal(await api.setSetting('stepChallenge', { version: 2 }), null);
    assert.deepEqual(requests.map(r => r.method), ['PATCH']); // duplicates updated, no new row
  });

  await t.test('fetchSetting tells "missing" apart from "failed" and tolerates duplicates', async () => {
    responder = () => ({ status: 200, body: [] });
    assert.deepEqual(await api.fetchSetting('stepChallenge'), { ok: true, exists: false, value: null });

    responder = () => ({ status: 200, body: [{ value: { a: 1 } }, { value: { a: 2 } }] });
    assert.deepEqual(await api.fetchSetting('stepChallenge'), { ok: true, exists: true, value: { a: 2 } });

    responder = () => ({ status: 500, body: { message: 'boom' } });
    const failed = await api.fetchSetting('stepChallenge');
    assert.equal(failed.ok, false);
    assert.equal(await api.getSetting('habitChecks', {}), null); // null = request failed
  });

  await t.test('getters return null on errors instead of empty data', async () => {
    responder = () => ({ status: 503, body: { message: 'paused' } });
    assert.equal(await api.getAllGoals(), null);
    assert.equal(await api.getHabits(), null);
    assert.equal(await api.getNotes('review-2026-W42'), null);
    assert.equal(await api.getKanban('week-2026-W42'), null);
    assert.equal(await api.getAllLists(), null);
  });

  await t.test('calendar entries: times and calendar are sent only when set', async () => {
    requests.length = 0;
    responder = () => ({ status: 201, body: null });
    const err = await api.setGoals('cal-2026-9-16', [
      { text: 'Paket abholen', done: false, priority: null },
      { text: 'Meeting', done: false, priority: 'high', start: '10:00', end: '11:30', calendarId: 'cal-work' }
    ]);
    assert.equal(err, null);
    assert.deepEqual(requests.map(r => r.method), ['DELETE', 'POST']);
    const [del, insert] = requests;
    assert.equal(del.params.user_id, `eq.${USER}`);
    assert.equal(del.params.date, 'eq.cal-2026-9-16');
    assert.deepEqual(insert.body, [
      { user_id: USER, date: 'cal-2026-9-16', text: 'Paket abholen', done: false, rolled_from: null, priority: null, urgency: null, position: 0 },
      { user_id: USER, date: 'cal-2026-9-16', text: 'Meeting', done: false, rolled_from: null, priority: 'high', urgency: null, position: 1,
        start_time: '10:00', end_time: '11:30', calendar_id: 'cal-work' }
    ]);
    // supabase-js names the union of all columns, so rows without a time get NULL there
    assert.match(insert.params.columns || '', /start_time/);

    // A day without times names exactly the columns of the version before times existed
    // (works with or without migrations/2026-10-16_calendar_times.sql)
    requests.length = 0;
    await api.setGoals('goals-2026-9-16', [{ text: 'Ziel', done: true }]);
    assert.equal(requests[1].params.columns, '"user_id","date","text","done","rolled_from","priority","urgency","position"');
  });

  await t.test('getAllGoals returns times as HH:MM and keeps same-text entries at different times', async () => {
    responder = () => ({
      status: 200, body: [
        { date: 'cal-2026-9-16', text: 'Meeting', done: false, priority: null, urgency: null, position: 0, start_time: '10:00:00', end_time: '11:30:00', calendar_id: 'cal-work' },
        { date: 'cal-2026-9-16', text: 'Meeting', done: false, priority: null, urgency: null, position: 1, start_time: '14:00:00', end_time: '15:00:00', calendar_id: 'cal-work' },
        { date: 'cal-2026-9-16', text: 'Meeting', done: false, priority: null, urgency: null, position: 2, start_time: '10:00:00', end_time: '11:30:00', calendar_id: 'cal-work' },
        { date: 'cal-2026-9-16', text: 'Paket', done: true, priority: 'low', urgency: null, position: 3, start_time: null, end_time: null, calendar_id: null },
        { date: 'cal-2026-9-16', text: 'Paket', done: true, priority: 'low', urgency: null, position: 4 }
      ]
    });
    const all = await api.getAllGoals();
    assert.deepEqual(all['cal-2026-9-16'], [
      { text: 'Meeting', done: false, priority: null, urgency: null, start: '10:00', end: '11:30', calendarId: 'cal-work' },
      { text: 'Meeting', done: false, priority: null, urgency: null, start: '14:00', end: '15:00', calendarId: 'cal-work' },
      { text: 'Paket', done: true, priority: 'low', urgency: null }
    ]);
  });

  await t.test('writes for the same day are serialized (no interleaved delete/insert)', async () => {
    const order = [];
    // While the first DELETE response is in flight, a second unserialized write would
    // already delete, so both inserts would land (duplicates)
    latency = (req) => (req.method === 'DELETE' ? 40 : 0);
    responder = (req) => {
      order.push(`${req.method}:${req.body ? req.body.map(r => r.text).join('|') : ''}`);
      return { status: 200, body: null };
    };
    await Promise.all([
      api.setGoals('goals-2026-9-16', [{ text: 'A' }]),
      api.setGoals('goals-2026-9-16', [{ text: 'B' }])
    ]);
    latency = () => 0;
    assert.deepEqual(order, ['DELETE:', 'POST:A', 'DELETE:', 'POST:B']);
  });
});
