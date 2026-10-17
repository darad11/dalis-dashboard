/*
 * End-to-end tests in Chromium against the in-memory Supabase mock (no real
 * Supabase project is touched). Run: node tests/e2e/run.js [filter]
 * Requires Playwright (global or local install) and its Chromium build.
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEnv, openDashboard, settle } = require('./harness');
const { CloudStore } = require('./cloud-store');
const { seedDemo } = require('./demo-data');

const USER = '00000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-10-16T10:00:00+02:00'); // Friday, Vienna
const BASELINE = 2223411;
const GOAL = 4018405;
const fmt = (n) => new Intl.NumberFormat('de-DE').format(n);

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

async function waitFor(check, what, timeout = 6000) {
  const start = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await check(); } catch (e) { ok = false; }
    if (ok) return;
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for: ' + what);
    await new Promise(r => setTimeout(r, 100));
  }
}

const card = (page) => page.locator('#stepChallenge');
const text = (page, selector) => page.locator(selector).first().innerText();
const heroValue = (page) => text(page, '#stepChallenge .step-hero-value');
const kpi = (page, index) => page.locator('#stepChallenge .step-kpi').nth(index).innerText();
const stepRows = (env) => env.store.rows('step_entries').filter(r => r.user_id === USER);

const openContexts = new Set();

async function open(env, opts = {}) {
  const handle = await openDashboard(env, Object.assign({ now: NOW }, opts));
  openContexts.add(handle.context);
  await waitFor(() => handle.page.locator('#stepChallenge:not([hidden])').count(), 'step card visible');
  return handle;
}

async function confirmSetup(page) {
  await page.click('#stepChallenge .step-setup button[type=submit]');
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'main view after setup');
}

async function logSteps(page, value) {
  await page.fill('#step-entry-input', String(value));
  await page.click('#stepChallenge .step-save-btn');
}

async function badge(page) {
  return (await text(page, '#stepChallenge .step-sync-badge')).trim();
}

// ---------------------------------------------------------------- Step Challenge

scenario('1 start value and goal are only used after confirmation', async (env) => {
  const { page, errors, context } = await open(env);
  assert.equal(await page.locator('#stepChallenge .step-hero-value').count(), 0, 'no current value before confirming');
  assert.equal(await page.inputValue('#step-setup-baseline'), fmt(BASELINE));
  assert.equal(await page.inputValue('#step-setup-date'), '2026-10-15');
  assert.equal(await page.inputValue('#step-setup-previous'), fmt(4018404));
  assert.equal(await page.inputValue('#step-setup-goal'), fmt(GOAL));
  assert.equal(stepRows(env).length, 0);

  await confirmSetup(page);
  assert.equal(await heroValue(page), fmt(BASELINE));
  assert.match(await kpi(page, 0), new RegExp(fmt(GOAL - BASELINE).replace(/\./g, '\\.')));
  assert.match(await kpi(page, 1), /23\.312/);
  assert.match(await kpi(page, 1), /77 days incl\. today/);
  await waitFor(() => env.store.rows('settings').some(r => r.key === 'stepChallenge'), 'challenge settings uploaded');
  const saved = env.store.rows('settings').find(r => r.key === 'stepChallenge').value.years['2026'];
  assert.deepEqual([saved.baselineSteps, saved.baselineDate, saved.goal, saved.previousYearTotal], [BASELINE, '2026-10-15', GOAL, 4018404]);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('2+3+4 add, correct and repeatedly update a day without double counting', async (env) => {
  const { page, errors, context } = await open(env);
  await confirmSetup(page);

  await logSteps(page, '12.345');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 12345), 'total after first value');
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 12345, 'row uploaded');
  assert.match(await text(page, '#step-entry-msg'), /12\.345 steps saved/);

  await logSteps(page, '15000');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 15000), 'total after correction');
  assert.match(await text(page, '#step-entry-msg'), /12\.345 → 15\.000/);

  for (const v of ['16.000', '17 500', '18,200']) await logSteps(page, v);
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 18200), 'total after several updates');
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 18200, 'single cloud row with latest value');
  await waitFor(async () => (await badge(page)) === 'Synced', 'synced badge');

  // Undo restores the previous value
  await page.click('#step-entry-msg .step-link-btn');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 17500), 'undo');
  await waitFor(() => stepRows(env)[0].steps === 17500, 'undo uploaded');

  // Removing makes the day "not logged" (tombstone), different from 0
  await page.click('#stepChallenge .step-clear-btn');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE), 'entry removed');
  await waitFor(() => stepRows(env)[0].deleted === true, 'tombstone uploaded');
  await logSteps(page, '0');
  await waitFor(() => stepRows(env)[0].deleted === false && stepRows(env)[0].steps === 0, 'confirmed zero uploaded');
  assert.match(await kpi(page, 2), /^Today\s*0/);

  // 13: still there after a reload
  await page.reload();
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after reload');
  assert.equal(await heroValue(page), fmt(BASELINE));
  assert.equal(await page.inputValue('#step-entry-input'), '0');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('5 day change at midnight without reload', async (env) => {
  const { page, errors, context } = await open(env);
  await confirmSetup(page);
  await logSteps(page, '20.000');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 20000), 'logged');
  assert.match(await kpi(page, 1), /76 days from tomorrow/);

  await page.clock.fastForward('14:00:10'); // 10:00 -> 00:00:10 next day
  await waitFor(async () => /^Today\s*–\s*target 23\./.test(await kpi(page, 2)), 'today reset after midnight');
  assert.match(await kpi(page, 1), /76 days incl\. today/);
  assert.equal(await page.locator('#step-entry-input').inputValue(), '');
  assert.match(await text(page, '#stepChallenge .step-entry-label'), /Today/);
  const friday = page.locator('#stepChallenge .step-day', { hasText: 'Fri' });
  assert.match(await friday.innerText(), /20k/);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('6 year change: 2026 is closed, 2027 needs its own confirmation', async (env) => {
  const { page, errors, context } = await open(env, { now: Date.parse('2026-12-31T22:00:00+01:00') });
  await confirmSetup(page);
  await logSteps(page, '25.000');
  await waitFor(() => stepRows(env).some(r => r.date === '2026-12-31'), '31.12. uploaded');

  await page.clock.fastForward('02:00:10');
  await waitFor(async () => /Step Challenge 2027/.test(await text(page, '#stepChallengeTitle')), '2027 header');
  assert.match(await text(page, '#stepChallenge .step-year-summary'), /2026 finished with/);
  assert.equal(await page.inputValue('#step-setup-baseline'), '0');
  assert.equal(await page.inputValue('#step-setup-date'), '2026-12-31');
  // Last day of 2026 can still be corrected before 2027 is set up
  assert.match(await text(page, '#stepChallenge .step-entry-label'), /31\.12\./);
  await logSteps(page, '26.000');
  await waitFor(() => stepRows(env).find(r => r.date === '2026-12-31').steps === 26000, 'late correction uploaded');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('7+8 goal reached and exceeded', async (env) => {
  const { page, errors, context } = await open(env);
  await page.fill('#step-setup-goal', fmt(BASELINE + 10000));
  await confirmSetup(page);
  await logSteps(page, '12.000');
  await waitFor(async () => /Goal reached/.test(await text(page, '#stepChallenge .step-status')), 'goal reached status');
  assert.match(await text(page, '#stepChallenge .step-status'), /\+2\.000 above goal/);
  assert.match(await kpi(page, 0), /^Remaining\s*0/);
  assert.match(await kpi(page, 1), /^Needed per day\s*0/);
  assert.match(await text(page, '#stepChallenge .step-hero-label'), /100,/);
  assert.deepEqual(errors, []);
  await context.close();
});

// The card is rebuilt whenever data changes; a rebuild while typing used to move the caret to
// the end, so typing over the selected suggestion appended to it ("4.018.4052.233.411").
// This made "7+8" fail now and then (first sync finishing during page.fill).
scenario('setup: a rebuild while typing keeps the selection and the caret', async (env) => {
  const { page, errors, context } = await open(env);
  await waitFor(async () => (await page.evaluate(() => window.stepCounter.syncSummary())) === 'all changes are in the cloud', 'first sync done');
  const goal = page.locator('#step-setup-goal');
  const otherDeviceLogs = async (date) => {
    await goal.evaluate(el => { el.__old = true; });
    const row = { user_id: USER, date, steps: 5000, deleted: false, updated_at: '2026-10-16T08:00:00Z' };
    env.store.seed('step_entries', [row]);
    env.store.emit({ eventType: 'INSERT', schema: 'public', table: 'step_entries', new: env.store.rows('step_entries').pop(), old: {} });
    await waitFor(() => page.evaluate(() => !document.querySelector('#step-setup-goal').__old), 'card rebuilt');
  };

  await goal.focus();
  await goal.evaluate(el => el.select()); // about to type over the suggested goal
  await otherDeviceLogs('2026-10-10');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'step-setup-goal');
  await page.keyboard.type('4.100.000');
  assert.equal(await goal.inputValue(), '4.100.000', 'typing replaces the selected suggestion');

  await goal.evaluate(el => el.setSelectionRange(0, 0));
  await otherDeviceLogs('2026-10-11');
  await page.keyboard.type('1');
  assert.equal(await goal.inputValue(), '14.100.000', 'the caret stays where it was');

  await confirmSetup(page);
  await waitFor(() => (env.store.rows('settings').find(r => r.key === 'stepChallenge') || { value: { years: {} } }).value.years['2026'], 'challenge uploaded');
  assert.equal(env.store.rows('settings').find(r => r.key === 'stepChallenge').value.years['2026'].goal, 14100000);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('9 missing day is shown and can be filled in', async (env) => {
  const { page, errors, context } = await open(env, { now: Date.parse('2026-10-19T09:00:00+02:00') });
  await confirmSetup(page);
  // log 16. and 18. via the date navigation
  for (const [date, value] of [['2026-10-16', '15.000'], ['2026-10-18', '17.000']]) {
    await page.fill('#step-entry-date', date);
    await page.dispatchEvent('#step-entry-date', 'change');
    await logSteps(page, value);
  }
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 32000), 'two days logged');
  await page.click('#stepChallenge .step-details-toggle');
  const chip = page.locator('#stepChallenge .step-chip-btn');
  assert.deepEqual(await chip.allInnerTexts(), ['Sat 17.10.']);
  assert.match(await chip.innerText(), /17\.10\./);
  assert.equal(await page.locator('#stepChallenge .step-cal-cell.is-missing').count(), 1); // today (19.) is open, not missing
  assert.match(await text(page, '#stepChallenge .step-recon'), /2 daily entries/);

  await chip.click();
  assert.match(await text(page, '#stepChallenge .step-entry-label'), /17\.10\./);
  await logSteps(page, '9.000');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 41000), 'missing day filled');
  assert.equal(await page.locator('#stepChallenge .step-chip-btn').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('10 invalid input is rejected and nothing is stored', async (env) => {
  const { page, errors, context } = await open(env);
  await confirmSetup(page);
  const cases = [['-5', /cannot be negative/], ['12,5', /without decimals/], ['abc', /Only digits/], ['250.000', /more than 200\.000/], ['', /Enter a number/]];
  for (const [value, message] of cases) {
    await logSteps(page, value);
    assert.match(await text(page, '#step-entry-msg'), message, value);
    assert.equal(await page.getAttribute('#step-entry-input', 'aria-invalid'), 'true');
  }
  assert.equal(await heroValue(page), fmt(BASELINE));
  const stored = await page.evaluate(uid => localStorage.getItem(`stepChallenge.v1.${uid}.entries`), USER);
  assert.ok(!stored || Object.keys(JSON.parse(stored)).length === 0, 'no local entry');
  assert.equal(stepRows(env).length, 0);

  // Days inside the start value and future days cannot be logged
  await page.fill('#step-entry-date', '2026-10-15');
  await page.dispatchEvent('#step-entry-date', 'change');
  assert.match(await text(page, '#step-entry-msg'), /already included in your start value/);
  assert.equal(await page.locator('#stepChallenge .step-save-btn').isDisabled(), true);
  assert.equal(await page.getAttribute('#step-entry-date', 'max'), '2026-10-16');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('11+13 offline change survives a reload and syncs later', async (env) => {
  const { page, context } = await open(env);
  await confirmSetup(page);
  await waitFor(async () => (await badge(page)) === 'Synced', 'initial sync');

  context.__offline = true;
  await logSteps(page, '11.111');
  await waitFor(async () => (await badge(page)) === 'Offline', 'offline badge');
  assert.equal(await heroValue(page), fmt(BASELINE + 11111));
  // Global cloud icon: pending (⏳) or "not reachable" (❌), never "synced"
  await waitFor(async () => /⏳|❌/.test(await page.textContent('#syncStatus')), 'global indicator shows unsynced state');

  await page.reload();
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after offline reload');
  assert.equal(await heroValue(page), fmt(BASELINE + 11111));
  assert.equal(stepRows(env).length, 0);

  context.__offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 11111, 'uploaded after reconnect');
  await waitFor(async () => (await badge(page)) === 'Synced', 'synced badge');
  await context.close();
});

scenario('12 cloud errors and a missing table never lose local data', async (env) => {
  env.store.missingTables.add('step_entries');
  const { page, errors, context } = await open(env);
  await confirmSetup(page);
  await logSteps(page, '8.000');
  await waitFor(async () => (await badge(page)) === 'Device only', 'device-only badge');
  assert.equal(await heroValue(page), fmt(BASELINE + 8000));
  await page.click('#fabTrigger');
  await page.click('#syncStatus');
  await waitFor(async () => /cloud table missing/.test(await text(page, '#syncModalStatus')), 'migration hint in sync panel');
  await page.click('#syncModalClose');

  // "Run the migration", then a server error, then recovery
  env.store.missingTables.clear();
  env.store.failTables.add('step_entries');
  await logSteps(page, '9.000');
  await waitFor(async () => (await badge(page)) === 'Sync error', 'sync error badge');
  await page.reload();
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after reload');
  assert.equal(await heroValue(page), fmt(BASELINE + 9000));

  env.store.failTables.clear();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 9000, 'uploaded after recovery');
  assert.ok(errors.every(e => /step_entries|Failed to fetch|Internal server error|Error fetching/i.test(e)), errors.join('\n'));
  await context.close();
});

scenario('multi-device: realtime update and newest change wins', async (env) => {
  const a = await open(env);
  await confirmSetup(a.page);
  await logSteps(a.page, '12.345');
  await waitFor(() => stepRows(env).length === 1, 'device A uploaded');

  const b = await open(env); // new browser context = second device
  await waitFor(async () => (await b.page.locator('#stepChallenge .step-hero-value').count()) > 0, 'settings from cloud on device B');
  await waitFor(async () => (await heroValue(b.page)) === fmt(BASELINE + 12345), 'device B sees value');

  await logSteps(a.page, '13.000');
  await waitFor(async () => (await heroValue(b.page)) === fmt(BASELINE + 13000), 'realtime update on device B');

  // Changing the goal on device A reaches device B without a reload
  await a.page.click('#stepChallenge .step-icon-btn[aria-label="Challenge settings"]');
  await a.page.fill('#step-setup-goal', fmt(4200000));
  await a.page.click('#stepChallenge .step-setup button[type=submit]');
  await waitFor(async () => /4\.200\.000/.test(await text(b.page, '#stepChallenge .step-hero-label')), 'goal change on device B', 12000);

  // Device B goes offline and edits first; device A edits later -> A's value wins everywhere
  b.context.__offline = true;
  await logSteps(b.page, '10.000');
  await settle(b.page, 300);
  await logSteps(a.page, '20.000');
  await waitFor(() => stepRows(env)[0].steps === 20000, 'device A uploaded newer value');
  b.context.__offline = false;
  await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitFor(async () => (await heroValue(b.page)) === fmt(BASELINE + 20000), 'device B adopts newer value');
  assert.equal(stepRows(env)[0].steps, 20000);
  assert.match(await text(b.page, '#step-entry-msg'), /changed on another device/);
  await a.context.close();
  await b.context.close();
});

scenario('15 export contains step data but no login tokens; import restores and uploads', async (env) => {
  const { page, context } = await open(env);
  await confirmSetup(page);
  await logSteps(page, '14.000');
  await waitFor(() => stepRows(env).length === 1, 'uploaded');
  await page.evaluate(() => localStorage.setItem('sb-test-auth-token', '{"refresh_token":"secret"}'));

  await page.click('#fabTrigger');
  await page.click('#syncStatus');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Export backup')]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dalis-e2e-')), 'backup.json');
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(backup[`stepChallenge.v1.${USER}.entries`], 'step entries exported');
  assert.ok(backup[`stepChallenge.v1.${USER}.config`], 'step settings exported');
  assert.ok(!Object.keys(backup).some(k => k.startsWith('sb-')), 'no auth token in backup');

  // Lose the data on this device and in the cloud, then restore from the file
  await page.evaluate(uid => {
    localStorage.removeItem(`stepChallenge.v1.${uid}.entries`);
    localStorage.setItem('goals-2026-9-16', '[{"text":"not in backup","done":false}]');
  }, USER);
  env.store.tables.step_entries = [];
  await page.setInputFiles('#importFile', file);
  await page.click('#confirmModalConfirm');
  await page.waitForEvent('load');
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after import');
  assert.equal(await heroValue(page), fmt(BASELINE + 14000));
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 14000, 'restored data uploaded');
  assert.equal(await page.evaluate(() => localStorage.getItem('sb-test-auth-token')), '{"refresh_token":"secret"}', 'login kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('goals-2026-9-16')), null, 'data not in the backup removed');
  await context.close();
});

scenario('16 Apple Health: upload key for the Shortcut, automatic uploads, revoke', async (env) => {
  const { page, errors, context } = await open(env);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await confirmSetup(page);
  const status = () => text(page, '#stepChallenge [data-role="health-status"]');
  await waitFor(async () => /Not set up/.test(await status()), 'status: not set up');

  // Set up: the key is made in the browser; only its SHA-256 hash goes to the cloud
  await page.click('#stepChallenge .step-health-toggle');
  assert.equal(await page.getAttribute('#stepChallenge .step-health-toggle', 'aria-expanded'), 'true');
  await page.click('#stepChallenge .step-health-create');
  await waitFor(() => page.locator('#stepHealthKey').count(), 'key shown');
  const key = await page.inputValue('#stepHealthKey');
  assert.match(key, /^[A-Za-z0-9_-]{43}$/, 'base64url of 32 random bytes');
  assert.equal(await page.inputValue('#stepHealthUrl'), 'https://jbkufpyyfmbxjeswagli.supabase.co/functions/v1/health-steps');
  const stored = env.store.rows('step_upload_tokens');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].user_id, USER);
  assert.equal(stored[0].token_hash, crypto.createHash('sha256').update(key).digest('hex'));
  assert.ok(!JSON.stringify(stored).includes(key), 'the key itself is not stored in the cloud');
  assert.equal(await page.evaluate(k => Object.keys(localStorage).some(n => String(localStorage.getItem(n)).includes(k)), key), false,
    'nor on the device');
  await page.click('#stepChallenge .step-health-copy button >> nth=0');
  await waitFor(async () => (await page.evaluate(() => navigator.clipboard.readText())) === key, 'key copied');
  assert.match(await text(page, '#stepChallenge .step-health-copy button'), /Copied/);

  // The Shortcut uploads today's total: the card shows it at once (realtime), no reload
  assert.equal(env.store.healthUpload(key, '2026-10-16', 8123, '2026-10-16T08:05:00+00:00').status, 200);
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 8123), 'upload counted');
  // A lower count later (e.g. a run on the locked iPhone) changes nothing
  assert.equal(env.store.healthUpload(key, '2026-10-16', 0, '2026-10-16T08:10:00+00:00').updated, false);
  await settle(page, 400);
  assert.equal(await heroValue(page), fmt(BASELINE + 8123));

  // "Done" forgets the key (shown only once); the status says when the last upload came
  await page.click('#stepChallenge .step-health-toggle');
  assert.equal(await page.locator('#stepHealthKey').count(), 0, 'key gone from the page');
  await waitFor(async () => /last upload today, 10:10/.test(await status()), 'last upload in the status');

  // Manage: the key with its last upload; revoking asks first
  await page.click('#stepChallenge .step-health-toggle');
  await waitFor(() => page.locator('#stepChallenge .step-health-key').count(), 'key listed');
  assert.equal(await page.locator('#stepHealthKey').count(), 0, 'the key is not shown a second time');
  assert.match(await text(page, '#stepChallenge .step-health-key-text'), /^iPhone Shortcut · created .+ · last upload today, 10:10$/);
  await page.click('#stepChallenge .step-health-revoke');
  await waitFor(() => page.locator('#confirmModal.active').count(), 'confirmation');
  assert.equal((await page.textContent('#confirmModalConfirm')).trim(), 'Revoke');
  await page.click('#confirmModalConfirm');
  await waitFor(() => env.store.rows('step_upload_tokens').length === 0, 'key revoked in the cloud');
  assert.equal(env.store.healthUpload(key, '2026-10-16', 9000).status, 401, 'a revoked key is rejected');
  await waitFor(async () => /Not set up/.test(await status()), 'status after revoking');
  assert.equal(await heroValue(page), fmt(BASELINE + 8123), 'uploaded steps stay');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('17 Apple Health without the database update: a clear hint, manual entries unaffected', async (env) => {
  env.store.missingTables.add('step_upload_tokens');
  const { page, errors, context } = await open(env);
  await confirmSetup(page);
  await waitFor(async () => /database update/.test(await text(page, '#stepChallenge [data-role="health-status"]')), 'hint shown');
  await page.click('#stepChallenge .step-health-toggle');
  assert.equal(await page.locator('#stepChallenge .step-health-create').count(), 0, 'no key can be created');
  assert.match(await text(page, '#stepHealthPanel'), /2026-10-16_step_health_sync\.sql/);
  await logSteps(page, '5.000');
  await waitFor(async () => (await heroValue(page)) === fmt(BASELINE + 5000), 'manual entry still works');
  await waitFor(() => stepRows(env).length === 1, 'manual entry uploaded');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('mobile: iPhone layout without horizontal overflow and with usable touch targets', async (env) => {
  const { page, errors, context } = await open(env, {
    viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark'
  });
  // The section bar jumps to the Health section with the Step Challenge
  await page.locator('.mobile-tab[data-section="health"]').tap();
  await confirmSetup(page);
  await logSteps(page, '12.345');
  await page.click('#stepChallenge .step-details-toggle');
  await settle(page, 300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, 'horizontal overflow');
  const sizes = await page.evaluate(() => [
    '#step-entry-input', '#stepChallenge .step-save-btn', '#stepChallenge .step-day', '#stepChallenge .step-cal-cell:not(.is-empty)', '#stepChallenge .step-details-toggle'
  ].map(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [sel, Math.round(r.width), Math.round(r.height)]; }));
  sizes.forEach(([sel, w, h]) => assert.ok(h >= 36 && w >= 36, `${sel} too small: ${w}x${h}`));
  const fontSize = await page.evaluate(() => getComputedStyle(document.querySelector('#step-entry-input')).fontSize);
  assert.equal(fontSize, '16px', 'inputs must be 16px to avoid iOS zoom');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('shortcut link only pre-fills the form; saving needs a tap', async (env) => {
  const { page, errors, context } = await open(env);
  await confirmSetup(page);
  await page.goto(env.url + '?steps=13579&date=2026-10-15');
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after link');
  assert.match(await text(page, '#step-entry-msg'), /could not be used|already included/);

  await page.goto(env.url + '?steps=13579&date=2026-10-16');
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after link');
  assert.equal(await page.inputValue('#step-entry-input'), '13.579');
  assert.match(await text(page, '#step-entry-msg'), /from your link – check and press Save/);
  assert.equal(await heroValue(page), fmt(BASELINE), 'nothing saved before the tap');
  assert.equal(new URL(page.url()).search, '', 'parameters removed from the address bar');
  await page.click('#stepChallenge .step-save-btn');
  await waitFor(() => stepRows(env).length === 1 && stepRows(env)[0].steps === 13579, 'saved after tap');
  assert.deepEqual(errors, []);
  await context.close();
});

// ---------------------------------------------------------------- Existing features + sync fixes

scenario('14 existing features keep working (goals, calendar, kanban, habits, lists, timer, review)', async (env) => {
  const { page, errors, context } = await open(env, { authDelayMs: 300 });
  const modal = async (value) => {
    await page.waitForSelector('#inputModal.active');
    await page.fill('#inputModalField', value);
    await page.click('#inputModalSubmit');
  };

  // Goals
  await page.click('text=+ Add Goal');
  await modal('Write report');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'goals-2026-9-16' && r.text === 'Write report'), 'goal uploaded');
  await page.click('#goalsList .focus-checkbox');
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Write report' && r.done === true), 'goal done uploaded');

  // Calendar quick capture (Q) opens the entry editor for today + kanban card
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); // shortcuts ignore inputs
  await page.keyboard.press('q');
  await waitFor(() => page.locator('.event-editor[open]').count(), 'quick capture editor');
  assert.equal(await page.inputValue('.event-editor .form-input'), '', 'the shortcut key is not typed into the field');
  assert.equal(await page.inputValue('.event-editor input[type="date"]'), '2026-10-16');
  await page.fill('.event-editor .form-input', 'Call dentist');
  await page.keyboard.press('Enter');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-16' && r.text === 'Call dentist' && r.start_time === null), 'quick capture uploaded');
  assert.equal(await page.locator('.event-editor[open]').count(), 0, 'editor closed after saving');
  assert.match(await page.locator('#weekKanban').innerText(), /Call dentist/);
  await page.locator('#weekKanban .kanban-column.today .kanban-add-btn').click();
  await modal('Kanban card');
  await waitFor(() => env.store.rows('kanban_tasks').some(r => r.week_key === 'week-2026-W42' && /Kanban card/.test(r.text)), 'kanban uploaded');

  // Habits
  await page.click('text=+ New Habit');
  await modal('Read');
  await waitFor(() => env.store.rows('habits').some(r => r.name === 'Read'), 'habit uploaded');
  await waitFor(() => page.evaluate(() => !!(JSON.parse(localStorage.getItem('habits'))[0] || {}).id), 'habit id stored locally');
  await page.locator('#habits .habit-check.today').first().click();
  await waitFor(() => env.store.rows('settings').some(r => r.key === 'habitChecks' && Object.keys(r.value).length === 1), 'habit check uploaded');
  assert.equal(env.store.rows('habits').length, 1, 'no duplicate habits');

  // Lists (title with markup must stay text)
  await page.click('text=+ Create New List');
  await modal('<img src=x onerror="window.__xss=1">Groceries');
  await page.locator('.list-panel .list-add-item-btn').click();
  await modal('Milk');
  await waitFor(() => env.store.rows('lists').some(r => Array.isArray(r.items) && r.items.some(i => i.text === 'Milk')), 'list item uploaded');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'no script from list title');
  assert.match(await page.locator('.list-panel h3').innerText(), /<img src=x/);

  // Timer: button and Space shortcut (listener registered once despite auth delay)
  await page.click('#pomoStart');
  assert.equal(await page.textContent('#pomoStart'), '⏸ Pause');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Space');
  assert.equal(await page.textContent('#pomoStart'), '▶ Start');

  // Health Hub: supplement quick toggle and water are uploaded and survive a reload
  await page.click('.supp-quick-btn[data-supp="vitamin d"]');
  await page.click('.hero-water-btns-vertical .btn >> nth=0');
  await waitFor(() => {
    const row = env.store.rows('settings').find(r => r.key === 'gymHubData');
    const day = row && row.value['2026-10-16'];
    return row && day && day.water === 250 && (row.value.supplementsTaken['2026-10-16'] || []).includes('vitamin d');
  }, 'health hub data uploaded');
  await page.reload();
  await waitFor(async () => (await page.textContent('#waterAmount')) === '250', 'water after reload');
  assert.ok(await page.locator('.supp-quick-btn[data-supp="vitamin d"].taken').count(), 'supplement still marked');

  // Weekly review autosave
  await page.fill('#weeklyReview', 'Good week');
  await waitFor(() => env.store.rows('notes').some(r => r.date === 'review-2026-W42' && r.content === 'Good week'), 'review uploaded');

  // Sync panel
  await page.click('#fabTrigger');
  await page.click('#syncStatus');
  await waitFor(async () => /Everything synced/.test(await text(page, '#syncModalStatus')), 'sync panel status');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#syncModal.active').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('sync fixes: offline edits survive reloads, failed downloads delete nothing', async (env) => {
  const { page, context } = await open(env);
  await page.evaluate(() => {
    const goals = db.getGoals();
    goals.push({ text: 'Synced goal', done: false });
    db.setGoals(goals);
  });
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Synced goal'), 'goal uploaded');

  // Failed download must not prune local days
  env.store.failTables.add('goals');
  await page.evaluate(() => db.loadFromCloud());
  assert.ok(await page.evaluate(() => db.getGoals().some(g => g.text === 'Synced goal')), 'local goals kept');
  assert.match(await page.getAttribute('#syncStatus', 'title'), /Sync Error/);
  env.store.failTables.clear();

  // Offline edit, reload while online: uploaded instead of discarded
  context.__offline = true;
  await page.evaluate(() => {
    const goals = db.getGoals();
    goals.push({ text: 'Offline goal', done: false });
    db.setGoals(goals);
  });
  await settle(page, 300);
  context.__offline = false;
  await page.reload();
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Offline goal'), 'offline goal uploaded after reload');
  assert.ok(await page.evaluate(() => db.getGoals().some(g => g.text === 'Offline goal')));

  // Conflict: the cloud changed meanwhile -> cloud wins, local copy is backed up
  context.__offline = true;
  await page.evaluate(() => {
    const goals = db.getGoals();
    goals.push({ text: 'Stale local edit', done: false });
    db.setGoals(goals);
  });
  await settle(page, 300);
  env.store.tables.goals = env.store.tables.goals.filter(r => r.date !== 'goals-2026-9-16');
  env.store.seed('goals', [{ user_id: USER, date: 'goals-2026-9-16', text: 'Edited on phone', done: false, position: 0 }]);
  context.__offline = false;
  await page.reload();
  await waitFor(async () => (await page.evaluate(() => db.getGoals().map(g => g.text))).includes('Edited on phone'), 'cloud version adopted');
  const backups = await page.evaluate(() => JSON.parse(localStorage.getItem('syncBackups') || '[]'));
  assert.ok(backups.some(b => b.key === 'goals-2026-9-16' && /Stale local edit/.test(b.value)), 'local copy backed up');
  await context.close();
});

scenario('weekly review keeps text typed right before switching weeks', async (env) => {
  const { page, errors, context } = await open(env);
  await page.fill('#weeklyReview', 'Notes for week 42');
  await page.click('button[onclick="changeReviewWeek(-1)"]'); // within the 500 ms autosave delay
  await waitFor(() => env.store.rows('notes').some(r => r.date === 'review-2026-W42' && r.content === 'Notes for week 42'), 'text saved to week 42');
  assert.equal(await page.inputValue('#weeklyReview'), '', 'week 41 shows its own (empty) review');
  assert.ok(!env.store.rows('notes').some(r => r.date === 'review-2026-W41' && r.content === 'Notes for week 42'), 'not saved into week 41');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('week keys stay stable across New Year (ISO week-year)', async (env) => {
  const { page, context } = await open(env);
  const keys = await page.evaluate(() => [
    db.weekKey(new Date(2026, 11, 28)), db.weekKey(new Date(2027, 0, 3)),
    db.reviewKey(new Date(2027, 0, 1)), db.habitsKey(new Date(2027, 0, 2)),
    db.weekKey(new Date(2026, 9, 16)), db.weekKey(new Date(2025, 11, 30)),
    getHabitKeyForWeek(new Date(2027, 0, 13), 0, 2), getHabitKeyForWeek(new Date(2026, 9, 16), 1, 4)
  ]);
  assert.deepEqual(keys, [
    'week-2026-W53', 'week-2026-W53', 'review-2026-W53', 'habitsData-2026-W53',
    'week-2026-W42', 'week-2026-W1',
    'habitsData-2027-W2-h0-d2', 'habitsData-2026-W42-h1-d4'
  ]);
  await context.close();
});

// ---------------------------------------------------------------- Phones, tablets, iPhone Duo
// Viewports: iPhone 15 (393x852), iPhone Duo folded (~466x678) and unfolded (~890x626,
// landscape), iPad landscape (1180x820). The Duo sizes are third-party estimates; the layout
// only depends on width ranges, so nearby sizes behave the same.

const PHONE = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DUO_FOLDED = { width: 466, height: 678 };
const DUO_UNFOLDED = { width: 890, height: 626 };

async function openPhone(env, extra = {}) {
  return open(env, Object.assign({}, PHONE, extra));
}

// Calendar, weekly overview, today's goals, focus timer: their order on screen (top to bottom,
// then left to right) and for VoiceOver and the keyboard (DOM order)
const PAGE_BLOCKS = { calendar: '.calendar-section', week: '.week-overview-section', goals: '.goals-container', focus: '#pomoStatsWrapper' };
const PHONE_ORDER = ['calendar', 'week', 'goals', 'focus'];
const DESKTOP_ORDER = ['focus', 'goals', 'week', 'calendar'];
const pageOrder = (page) => page.evaluate(blocks => {
  const els = Object.entries(blocks).map(([name, sel]) => [name, document.querySelector(sel)]);
  const box = el => el.getBoundingClientRect();
  return {
    screen: els.slice().sort(([, a], [, b]) => (Math.abs(box(a).top - box(b).top) > 30 ? box(a).top - box(b).top : box(a).left - box(b).left)).map(([name]) => name),
    dom: els.slice().sort(([, a], [, b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map(([name]) => name)
  };
}, PAGE_BLOCKS);

const displayed = (page, selector) => page.evaluate(sel => {
  const el = document.querySelector(sel);
  return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
}, selector);

const touchLayoutOn = (page) => page.evaluate(() => document.documentElement.classList.contains('touch-layout'));
const currentSection = (page) => page.evaluate(() => window.MobileUI.currentSection());
const horizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Start of the section just below the app bar (or the page cannot scroll further)
const sectionAtTop = (page, name) => page.evaluate(n => {
  const top = document.getElementById('section-' + n).getBoundingClientRect().top;
  const bar = document.querySelector('.app-bar').getBoundingClientRect().bottom;
  const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  return Math.abs(top - bar - 4) <= 6 || (atEnd && top >= bar);
}, name);

const lensUp = (page) => page.evaluate(() => document.getElementById('mobileTabbar').classList.contains('lens-active'));

async function goToSection(page, name) {
  await page.locator(`.mobile-tab[data-section="${name}"]`).tap();
  await waitFor(async () => (await currentSection(page)) === name && await sectionAtTop(page, name), `jump to ${name}`);
  await waitFor(async () => !(await lensUp(page)), 'lens dropped into the selection');
  await settle(page, 200);
}

// A finger on the section bar, through the DevTools protocol (Playwright's touchscreen only taps)
async function barFinger(page) {
  const client = await page.context().newCDPSession(page);
  const geo = await page.evaluate(() => {
    const bar = document.getElementById('mobileTabbar');
    const r = bar.getBoundingClientRect();
    const tabs = {};
    bar.querySelectorAll('.mobile-tab').forEach(t => { const b = t.getBoundingClientRect(); tabs[t.dataset.section] = b.left + b.width / 2; });
    return { left: r.left, y: r.top + r.height / 2, width: r.width, padHeight: bar.clientHeight, tabWidth: bar.querySelector('.mobile-tab').getBoundingClientRect().width, tabs };
  });
  const send = (type, x) => client.send('Input.dispatchTouchEvent',
    { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: geo.y, id: 1 }] });
  return {
    geo,
    down: (x) => send('touchStart', x),
    async move(from, to, steps) {
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', from + (to - from) * i / steps);
        await page.waitForTimeout(16);
      }
    },
    up: () => send('touchEnd'),
    cancel: () => send('touchCancel')
  };
}

const lensBox = (page) => page.evaluate(() => {
  const bar = document.getElementById('mobileTabbar');
  const l = bar.querySelector('.tabbar-lens').getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  // Item centres as they are now (the bar swells while touched)
  const tabs = {};
  bar.querySelectorAll('.mobile-tab').forEach(t => { const r = t.getBoundingClientRect(); tabs[t.dataset.section] = r.left + r.width / 2; });
  return { lift: +(bar.style.getPropertyValue('--lift') || 0), center: l.left + l.width / 2, width: l.width, height: l.height, top: l.top, bottom: l.bottom, barTop: b.top, barBottom: b.bottom, barWidth: b.width, tabs };
});

async function menuAction(page, id) {
  await page.locator(`.menu-layer.open .menu-item[data-action="${id}"]`).tap();
  await settle(page, 250);
}

const editorOpen = (page) => page.locator('.event-editor[open]').count();

scenario('scroll: phones show one continuous page; the section bar follows and jumps', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  assert.equal(await touchLayoutOn(page), true);
  assert.equal(await page.getAttribute('html', 'data-tab'), null, 'no tab state that hides sections');

  // Every section is displayed, in the order Week, Today, Health, Habits, Lists; the page starts
  // with the calendar, then the weekly overview, today's goals and the focus timer - on screen
  // and for VoiceOver
  const sections = await page.evaluate(() => window.MobileUI.SECTIONS.map(n => {
    const el = document.getElementById('section-' + n);
    return [n, getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, Math.round(el.getBoundingClientRect().top + window.scrollY)];
  }));
  assert.deepEqual(sections.map(s => s[0]), ['home', 'week', 'today', 'health', 'habits', 'lists']);
  assert.deepEqual(await pageOrder(page), { screen: PHONE_ORDER, dom: PHONE_ORDER });
  assert.deepEqual(await page.$$eval('.mobile-tab', els => els.map(e => e.dataset.section)), ['home', 'week', 'today', 'health', 'habits', 'lists'], 'bar in the order of the page');
  // The page opens on Home, right below the app bar; the calendar starts the Week section
  assert.ok(await page.evaluate(() => document.getElementById('section-home').getBoundingClientRect().top - document.querySelector('.app-bar').getBoundingClientRect().bottom < 12), 'Home right below the app bar');
  assert.ok(await page.evaluate(() => document.querySelector('.calendar-section').getBoundingClientRect().top - document.getElementById('section-week').getBoundingClientRect().top < 12), 'calendar first in Week');
  sections.forEach(([name, shown]) => assert.ok(shown, `${name} displayed`));
  for (let i = 1; i < sections.length; i++) assert.ok(sections[i][2] > sections[i - 1][2], `${sections[i][0]} below ${sections[i - 1][0]}`);
  assert.ok(await page.evaluate(() => !!document.querySelector('#section-week .calendar-section') &&
    !!document.querySelector('#section-habits .weekly-review-section') && !!document.querySelector('#section-lists .lists-section')),
  'calendar in Week, weekly review in Habits, lists last');
  assert.equal(await currentSection(page), 'home');
  assert.equal(await page.getAttribute('.mobile-tab[data-section="home"]', 'aria-current'), 'location');
  // Six items fit the bar: labels whole, every item a touch target
  const tabs = await page.$$eval('.mobile-tab', els => els.map(e => {
    const r = e.getBoundingClientRect();
    const label = e.querySelector('.mobile-tab-label');
    return [e.dataset.section, Math.round(r.width), Math.round(r.height), label.scrollWidth <= label.clientWidth + 1];
  }));
  tabs.forEach(([name, w, h, whole]) => assert.ok(w >= 44 && h >= 44 && whole, `tab ${name}: ${w}x${h}, label whole: ${whole}`));

  // Scrolling through the page marks one section after the other, without tapping
  const seen = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 250) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await settle(page, 60);
    const name = await currentSection(page);
    if (seen[seen.length - 1] !== name) seen.push(name);
  }
  assert.deepEqual(seen, ['home', 'week', 'today', 'health', 'habits', 'lists'], 'marker follows the scroll position');
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitFor(async () => (await currentSection(page)) === 'home', 'back to Home at the top');

  // Tapping a section jumps to its start, the selection pill moves under it
  for (const name of ['habits', 'week', 'lists', 'health', 'today']) await goToSection(page, name);
  await goToSection(page, 'week');
  const pill = await page.evaluate(() => {
    const i = document.querySelector('.tabbar-indicator').getBoundingClientRect();
    const t = document.querySelector('.mobile-tab.active').getBoundingClientRect();
    return [Math.round(i.left - t.left), Math.round(i.width - t.width)];
  });
  assert.deepEqual(pill, [-4, 8], 'selection pill under the active section, 4px wider on both sides');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'section-week', 'focus moved into the section');

  assert.equal(await horizontalOverflow(page), 0, 'no horizontal scrolling');

  // App bar: "+" opens a new calendar entry for today, "⋯" the menu
  await page.locator('#appBarAdd').tap();
  await waitFor(() => editorOpen(page), 'entry editor');
  assert.equal(await page.inputValue('.event-editor input[type="date"]'), '2026-10-16');
  await page.locator('.event-editor .sheet-leading').tap(); // nothing changed: closes without asking
  await waitFor(async () => (await editorOpen(page)) === 0, 'editor closed');
  await page.locator('#appBarMore').tap();
  await page.waitForSelector('.menu-layer.open');
  assert.deepEqual(await page.$$eval('.menu-layer.open .menu-item', els => els.map(e => e.dataset.action)),
    ['dark-mode', 'name', 'focus-mode', 'sync', 'sign-out']);
  assert.equal(await page.getAttribute('.menu', 'role'), 'menu');
  await menuAction(page, 'dark-mode');
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark')), true, 'dark mode from the menu');
  assert.equal(await page.getAttribute('meta[name="theme-color"]', 'content'), '#000000');

  // Touch targets of the main controls: at least 44 x 44 pt (HIG)
  const small = await page.evaluate(() => [...document.querySelectorAll(
    '.mobile-tab, .app-bar-btn, .week-nav-panel .btn, .week-strip-day, .calendar-header .btn, .kanban-add-btn, .item-more-btn, .habit-check, .day-cell:not(.empty), .pomo-mode-btn, .goals-container .btn')]
    .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
    .map(el => { const r = el.getBoundingClientRect(); return [el.className || el.id, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 44 || h < 36));
  assert.deepEqual(small, [], 'controls smaller than 44pt');
  assert.deepEqual(errors, []);
  await context.close();
});

// The order is set before the first paint (inline in index.html): while the scripts at the end
// of the page are still loading, the calendar already stands first - no jump when they run
scenario('phones: the calendar stands first already while the scripts load', async (env) => {
  const context = await env.browser.newContext(Object.assign({ locale: 'de-AT', timezoneId: 'Europe/Vienna' }, PHONE));
  openContexts.add(context);
  const page = await context.newPage();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const mock = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, async route => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: mock }).catch(() => { });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const loading = page.goto(env.url).catch(() => { });
  await page.waitForSelector('#section-lists', { state: 'attached' });
  assert.equal(await page.evaluate(() => !!window.MobileUI), false, 'js/mobile.js has not run yet');
  assert.deepEqual(await pageOrder(page), { screen: PHONE_ORDER, dom: PHONE_ORDER });
  release();
  await loading;
  await page.waitForFunction(() => !!window.MobileUI);
  assert.deepEqual(await pageOrder(page), { screen: PHONE_ORDER, dom: PHONE_ORDER });
  await context.close();
});

// The theme used to be applied by initTheme (js/app.js) after the sign-in and the first sync:
// a dark-mode device painted the page light for about a second on every start. The body gets
// "dark" from an inline script at the top of the body now, before anything is painted.
scenario('dark mode shows from the first paint, not only after the sign-in and the first sync', async (env) => {
  seedDemo(env.store, { steps: false });
  const context = await env.browser.newContext(Object.assign({ locale: 'de-AT', timezoneId: 'Europe/Vienna' }, PHONE));
  openContexts.add(context);
  const page = await context.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('darkMode', 'true'); } catch (e) { /* blocked */ } });
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const mock = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, async route => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: mock }).catch(() => { });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/open-meteo\.com/, route => route.abort('failed'));
  const loading = page.goto(env.url).catch(() => { });
  await page.waitForSelector('#section-lists', { state: 'attached' });
  // The scripts at the end of the page have not run, yet the page is already dark
  assert.equal(await page.evaluate(() => !!window.MobileUI), false, 'js/mobile.js has not run yet');
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark')), true, 'dark before the scripts run');
  // Once the stylesheets are in (the DOM is parsed before they arrive), the first paint is black
  await page.waitForFunction(() => [...document.styleSheets].some(s => s.href && s.href.includes('mobile.css') && s.cssRules.length > 0));
  assert.equal(await page.evaluate(() => !!window.MobileUI), false, 'still before the scripts');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)', 'painted on the iOS dark background');
  assert.equal(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content), '#000000', 'the browser chrome is dark as well');
  release();
  await loading;
  await page.waitForFunction(() => !!window.MobileUI);
  await page.waitForSelector('#stepChallenge:not([hidden])');
  await settle(page, 300);
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark')), true, 'still dark after the sign-in and the sync');
  assert.equal(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content), '#000000');
  await context.close();

  // Without the setting the page stays light
  const light = await openPhone(env);
  assert.equal(await light.page.evaluate(() => document.body.classList.contains('dark')), false);
  assert.equal(await light.page.evaluate(() => document.querySelector('meta[name="theme-color"]').content), '#f2f2f7');
  assert.deepEqual(light.errors, []);
  await light.context.close();
});

scenario('scroll: a short last section is marked at the end of the page; a chosen one stays marked', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  // A short Lists section: no lists and, only for this check, without the matrix (always shown
  // in the app) - too short to reach the reading line at the end of the page
  await page.evaluate(() => { db.set('customListsMeta', [], true); renderUnifiedLists(); document.querySelector('.matrix-panel').remove(); });
  await settle(page, 200);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await waitFor(async () => (await currentSection(page)) === 'lists', 'lists marked at the end');
  assert.ok(await page.evaluate(() => {
    const top = document.getElementById('section-lists').getBoundingClientRect().top;
    const bar = document.querySelector('.app-bar').getBoundingClientRect().bottom;
    return top - bar > (window.innerHeight - bar) * 0.25;
  }), 'Lists starts below the reading line (the end-of-page rule is what marks it)');
  // Habits collapsed and chosen in the bar: the page cannot scroll so far that Habits starts
  // at the top, the bar still shows Habits (not Lists)
  await page.evaluate(() => { toggleHabitsSection(); toggleWeeklyReviewSection(); });
  await settle(page, 300);
  assert.ok(await page.evaluate(() => document.getElementById('section-habits').getBoundingClientRect().height +
    document.getElementById('section-lists').getBoundingClientRect().height < window.innerHeight / 2), 'short sections at the end');
  await page.locator('.mobile-tab[data-section="habits"]').tap();
  await settle(page, 900);
  assert.equal(await currentSection(page), 'habits');
  assert.equal(await sectionAtTop(page, 'habits'), true, 'as far as the page can scroll');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('scroll: the steps link and #section- links open at their section', async (env) => {
  const { page, errors, context } = await openPhone(env);
  await confirmSetup(page);
  await page.goto(env.url + '?steps=12345');
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'card after link');
  await waitFor(async () => (await currentSection(page)) === 'health' && await sectionAtTop(page, 'health'), 'opened at Health');
  assert.equal(await page.inputValue('#step-entry-input'), '12.345');

  await page.goto(env.url + '#section-lists');
  await page.waitForFunction(() => document.querySelector('#goalsList') !== null);
  await waitFor(async () => (await currentSection(page)) === 'lists', 'opened at Lists');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('section bar: a finger lifts the selection into a glass lens, a drag selects on release', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  const finger = await barFinger(page);
  const { tabs } = finger.geo;

  // Touch: the selection lifts into a lens taller than the bar, the bar swells
  await finger.down(tabs.week);
  await waitFor(async () => (await lensBox(page)).lift > 0.99, 'lens lifted');
  const lifted = await lensBox(page);
  assert.ok(lifted.barWidth > finger.geo.width + 10, `bar swells while touched (${lifted.barWidth})`);
  assert.ok(lifted.barTop - lifted.top > 2 && lifted.bottom - lifted.barBottom > 2, 'lens reaches past the bar');
  assert.ok(Math.abs(lifted.center - lifted.tabs.week) < 1, 'lens over the touched item');
  const parts = await page.evaluate(() => {
    const bar = document.getElementById('mobileTabbar');
    const lens = bar.querySelector('.tabbar-lens');
    const items = getComputedStyle(bar.querySelector('.tabbar-items'));
    return {
      hidden: lens.getAttribute('aria-hidden'),
      focusable: lens.querySelectorAll('a, button, input, [tabindex]').length,
      links: [...bar.querySelectorAll('a[href]')].map(a => a.dataset.section),
      pill: getComputedStyle(bar.querySelector('.tabbar-indicator')).opacity,
      hole: items.maskImage || items.webkitMaskImage
    };
  });
  assert.equal(parts.hidden, 'true', 'the lens is decoration');
  assert.equal(parts.focusable, 0);
  assert.deepEqual(parts.links, ['home', 'week', 'today', 'health', 'habits', 'lists'], 'the six links stay the only links');
  assert.equal(parts.pill, '0', 'resting pill hidden under the lens');
  assert.notEqual(parts.hole, 'none', 'the real items get a hole under the lens');

  // Drag to Habits and hold: the lens follows the finger, nothing is selected yet
  await finger.move(tabs.week, tabs.habits, 12);
  const candidate = () => page.evaluate(() => {
    const t = document.querySelector('.tabbar-lens-core .tabbar-lens-tab.candidate');
    return t && t.dataset.section;
  });
  await waitFor(async () => (await candidate()) === 'habits' && Math.abs((await lensBox(page)).center - tabs.habits) < 1.5,
    'lens over habits, under the finger');
  assert.equal(await currentSection(page), 'home', 'still at the start of the page');
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'no jump before release');

  // Release: Habits is selected and the page jumps there; the lens drops into the pill
  await finger.up();
  await waitFor(async () => (await currentSection(page)) === 'habits' && await sectionAtTop(page, 'habits'), 'jump to habits');
  await waitFor(async () => !(await lensUp(page)), 'lens dropped');
  const rest = await page.evaluate(() => {
    const bar = document.getElementById('mobileTabbar');
    const i = bar.querySelector('.tabbar-indicator');
    const ir = i.getBoundingClientRect();
    const t = bar.querySelector('.mobile-tab.active');
    const tr = t.getBoundingClientRect();
    return { width: bar.getBoundingClientRect().width, pill: [Math.round(ir.left - tr.left), Math.round(ir.width - tr.width)], opacity: getComputedStyle(i).opacity, active: t.dataset.section, transform: bar.style.transform };
  });
  assert.ok(Math.abs(rest.width - finger.geo.width) < 0.5, 'bar back to its size');
  assert.deepEqual(rest.pill, [-4, 8], 'pill under Habits');
  assert.equal(rest.opacity, '1');
  assert.equal(rest.active, 'habits');
  assert.equal(rest.transform, '', 'no inline transform left behind');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'section-habits', 'focus moved into the section');

  // A short drag that ends on the selected section changes nothing - also not through the
  // click Chromium still sends for a movement this short
  await page.evaluate(() => window.scrollBy(0, 150));
  await settle(page, 250);
  const before = await page.evaluate(() => window.scrollY);
  await finger.down(tabs.habits + 20);
  await finger.move(tabs.habits + 20, tabs.habits + 8, 2);
  await finger.up();
  await settle(page, 700);
  assert.equal(await page.evaluate(() => window.scrollY), before, 'no jump to the start of the section');
  assert.equal(await currentSection(page), 'habits');

  // The system takes the touch: back to the selection, nothing chosen
  await finger.down(tabs.lists);
  await finger.move(tabs.lists, tabs.week, 10);
  await finger.cancel();
  await waitFor(async () => !(await lensUp(page)), 'lens back in the selection');
  assert.equal(await currentSection(page), 'habits');
  assert.equal(await page.evaluate(() => window.scrollY), before);

  // A tap at the rounded end of the bar selects the nearest section (Home at the left end)
  await page.touchscreen.tap(finger.geo.left + 4, finger.geo.y);
  await waitFor(async () => (await currentSection(page)) === 'home' && await sectionAtTop(page, 'home'), 'end of the bar selects home');
  await waitFor(async () => !(await lensUp(page)), 'lens dropped after the tap');

  // Keyboard: the links select without a lens
  await page.focus('.mobile-tab[data-section="today"]');
  await page.keyboard.press('Enter');
  await waitFor(async () => (await currentSection(page)) === 'today', 'Enter selects today');
  assert.equal(await lensUp(page), false, 'no lens without a finger');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('section bar: with Reduce Motion the lens neither swells the bar nor overshoots', async (env) => {
  const { page, errors, context } = await openPhone(env, { reducedMotion: 'reduce' });
  const finger = await barFinger(page);
  const lensW = (finger.geo.tabWidth + 8) * 1.22;
  const lensH = finger.geo.padHeight + 7;
  const samples = [];
  await finger.down(finger.geo.tabs.lists); // from Today across the whole bar
  for (let i = 0; i < 14; i++) {
    samples.push(await lensBox(page));
    await page.waitForTimeout(20);
  }
  await finger.up();
  await waitFor(async () => (await currentSection(page)) === 'lists', 'the tap selects lists');
  await waitFor(async () => !(await lensUp(page)), 'lens dropped');
  assert.ok(samples[samples.length - 1].lift > 0.95, 'the lens still lifts');
  assert.ok(samples.every(s => Math.abs(s.barWidth - finger.geo.width) < 0.5), 'bar keeps its size');
  assert.ok(samples.every(s => s.width <= lensW + 0.5 && s.height <= lensH + 0.5),
    `lens never larger than lifted: ${JSON.stringify(samples.map(s => [Math.round(s.width), Math.round(s.height)]))}`);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('touch: menus replace hover, double-click, right-click and drag & drop', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  const goal = page.locator('.focus-item', { hasText: 'Steuererklärung' });
  // Hover-only delete buttons were invisible but tappable; on touch they are gone
  assert.equal(await goal.locator('.focus-delete').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await goal.locator('.item-more-btn').isVisible(), true);

  // Urgency in a submenu of the "⋯" menu (was right-click only); the menu sits at its button
  await goal.locator('.item-more-btn').tap();
  assert.equal(await page.getAttribute('.menu', 'role'), 'menu');
  assert.equal(await goal.locator('.item-more-btn').getAttribute('aria-expanded'), 'true');
  await page.waitForSelector('.menu-layer.open');
  const [menuBox, buttonBox] = [await page.locator('.menu').boundingBox(), await goal.locator('.item-more-btn').boundingBox()];
  assert.ok(menuBox.y >= buttonBox.y + buttonBox.height - 1 || menuBox.y + menuBox.height <= buttonBox.y + 1, 'menu above or below its button');
  assert.deepEqual(await page.$$eval('.menu-layer.open .menu-item', els => els.map(e => e.dataset.action)), ['edit', 'urgency', 'delete']);
  await menuAction(page, 'urgency');
  assert.equal(await page.getAttribute('.menu-item[data-action="priority-none"]', 'aria-checked'), 'true');
  await menuAction(page, 'priority-high');
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Steuererklärung abschicken' && r.urgency === 'high'), 'urgency uploaded');
  assert.equal(await page.locator('.focus-item.urgency-high', { hasText: 'Steuererklärung' }).count(), 1);

  // Tapping the text ticks a goal
  await page.locator('.focus-item .focus-text', { hasText: 'Wocheneinkauf' }).tap();
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Wocheneinkauf planen' && r.done === true), 'goal ticked by tapping its text');

  // Escape and a tap outside close a menu without doing anything; focus returns to the button
  await goal.locator('.item-more-btn').tap();
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator('.menu-layer').count()) === 0, 'menu closed by Escape');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('item-more-btn')), true, 'focus back on the ⋯ button');
  // ... and stays there when the list is rebuilt (re-sort after ticking, refresh after a sync)
  await page.evaluate(() => renderGoals());
  assert.equal(await page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a.classList.contains('item-more-btn') && a.closest('.focus-item').textContent.includes('Steuererklärung');
  }), true, 'focus kept on the same ⋯ button after a re-render');
  await goal.locator('.item-more-btn').tap();
  await page.touchscreen.tap(20, 300);
  await waitFor(async () => (await page.locator('.menu-layer').count()) === 0, 'menu closed by a tap outside');
  assert.equal(await page.locator('.focus-item.done', { hasText: 'Mail an die Hausverwaltung' }).count(), 0, 'the tap outside did not tick anything');

  // Move a weekly task to another day (was drag & drop only)
  await goToSection(page, 'week');
  await page.locator('.kanban-card', { hasText: 'Laufen 5 km' }).locator('.item-more-btn').tap();
  await menuAction(page, 'move');
  await menuAction(page, 'day-SA');
  await waitFor(() => env.store.rows('kanban_tasks').some(r => r.column_name === 'SA' && r.text.includes('Laufen 5 km')), 'task moved to Saturday in the cloud');
  assert.match(await page.locator('.kanban-column').nth(5).innerText(), /Laufen 5 km/);

  // A calendar entry opens in the editor from the day agenda (was double-click only)
  await page.locator('.day-cell[data-date="cal-2026-9-20"]').tap();
  await page.locator('#calendarAgenda .agenda-row', { hasText: 'Geburtstag Mama' }).tap();
  await waitFor(() => editorOpen(page), 'editor for the entry');
  assert.equal(await page.textContent('.event-editor .sheet-title'), 'Edit Event');
  await page.fill('.event-editor .form-input', 'Geburtstag Mama – Kuchen mitbringen');
  await page.locator('.event-editor .sheet-trailing').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-20' && r.text === 'Geburtstag Mama – Kuchen mitbringen'), 'calendar entry edited');

  // Move a list item to another list (was drag & drop only)
  await goToSection(page, 'lists');
  await page.locator('.simple-list-item', { hasText: 'Steuerunterlagen sortieren' }).locator('.item-more-btn').tap();
  await menuAction(page, 'move');
  await menuAction(page, 'list-custom-2');
  await waitFor(() => {
    const lists = Object.fromEntries(env.store.rows('lists').map(r => [r.name, r.items.map(i => i.text)]));
    return lists['custom-2'] && lists['custom-2'].includes('Steuerunterlagen sortieren') && !lists['custom-3'].includes('Steuerunterlagen sortieren');
  }, 'list item moved to another list in the cloud');

  // Delete asks for confirmation where the desktop does (habits, lists); the button names the action
  await goToSection(page, 'habits');
  await page.locator('.habit-name', { hasText: 'Lesen' }).locator('.item-more-btn').tap();
  await menuAction(page, 'delete');
  assert.equal(await page.locator('#confirmModal.active').count(), 1, 'confirmation shown');
  assert.equal(await page.textContent('#confirmModalConfirm'), 'Delete');
  await page.locator('#confirmModalCancel').tap();
  assert.equal(await page.locator('.habit-name', { hasText: 'Lesen' }).count(), 1, 'habit kept after cancel');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('foldable: unfolding and folding keeps the reading position and open menus', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, { viewport: DUO_FOLDED, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await goToSection(page, 'week');
  // Folded = phone width: one day card at a time; Saturday chosen in the day strip
  const saturday = '#week-day-5';
  await page.locator('#weekStrip .week-strip-day').nth(5).tap();
  await waitFor(() => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }, saturday), 'Saturday on screen');
  const topOf = () => page.evaluate(sel => Math.round(document.querySelector(sel).getBoundingClientRect().top), saturday);
  await page.evaluate(sel => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120); }, saturday);
  await settle(page, 300);
  assert.equal(await topOf(), 120);

  // Unfold: wider layout (days in columns), Saturday stays where it was on screen
  await page.setViewportSize(DUO_UNFOLDED);
  await settle(page, 400);
  assert.equal(await touchLayoutOn(page), true);
  assert.ok(Math.abs((await topOf()) - 120) <= 4, `Saturday moved to ${await topOf()}px after unfolding`);
  assert.equal(await currentSection(page), 'week');
  assert.equal(await horizontalOverflow(page), 0);
  const columns = await page.evaluate(() => new Set([...document.querySelectorAll('.kanban-column')].map(c => Math.round(c.getBoundingClientRect().left))).size);
  assert.ok(columns >= 3, `unfolded week uses ${columns} columns`);
  assert.equal(await page.locator('#weekStrip').count(), 0, 'no day strip when the days fit side by side');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.calendar-section-content .glass-panel')).display), 'grid', 'calendar and agenda side by side');

  // A menu opened while unfolded is still fully on screen after folding
  await page.locator('.kanban-card', { hasText: 'Bauernmarkt' }).locator('.item-more-btn').tap();
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 400);
  const box = await page.locator('.menu').boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= DUO_FOLDED.width + 1 && box.y + box.height <= DUO_FOLDED.height + 1, `menu off screen: ${JSON.stringify(box)}`);
  await page.keyboard.press('Escape');
  // Folded again: the day strip is back and Saturday is still the day on screen
  assert.equal(await page.getAttribute('#weekStrip .week-strip-day:nth-child(6)', 'aria-current'), 'true');
  assert.equal(await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }, saturday), true, 'Saturday on screen after folding');

  // iPad rotated to landscape (1180px): the desktop layout and its order, then back; the
  // goals move with the order and keep the focus
  assert.deepEqual(await pageOrder(page), { screen: PHONE_ORDER, dom: PHONE_ORDER });
  await page.focus('.goals-container > .btn');
  await page.setViewportSize({ width: 1180, height: 820 });
  await settle(page, 300);
  assert.equal(await touchLayoutOn(page), false);
  assert.deepEqual(await pageOrder(page), { screen: DESKTOP_ORDER, dom: DESKTOP_ORDER });
  assert.equal(await page.evaluate(() => document.activeElement.matches('.goals-container > .btn')), true, 'focus kept on the desktop');
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  assert.equal(await displayed(page, '.app-bar-actions'), false);
  for (const sel of ['.dashboard-main-layout', '.week-overview-section', '.gym-hub-section', '.lists-section', '.calendar-section', '.habits-section']) {
    assert.equal(await displayed(page, sel), true, `${sel} visible on the wide layout`);
  }
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 300);
  assert.equal(await touchLayoutOn(page), true);
  assert.deepEqual(await pageOrder(page), { screen: PHONE_ORDER, dom: PHONE_ORDER });
  assert.equal(await page.evaluate(() => document.activeElement.matches('.goals-container > .btn')), true, 'focus kept on the phone');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('calendar on phones: month grid with coloured dots, agenda with times, new entries', async (env) => {
  seedDemo(env.store, { steps: false });
  env.store.seed('settings', [{ user_id: USER, key: 'calendars', value: [{ id: 'default', name: 'Personal', color: 'blue' }, { id: 'cal-work', name: 'Work', color: 'red' }] }]);
  env.store.seed('goals', [{ user_id: USER, date: 'cal-2026-9-14', text: 'Review', done: false, position: 1, start_time: '09:00', end_time: '09:30', calendar_id: 'cal-work' }]);
  // 31 October: stepping a month forward must land in November (setMonth on the 31st skipped it)
  const { page, errors, context } = await openPhone(env, { now: Date.parse('2026-10-31T10:00:00+01:00') });
  await goToSection(page, 'week');
  assert.match(await text(page, '#calendarAgenda .calendar-agenda-title'), /Samstag, 31\. Oktober/);
  assert.equal(await page.getAttribute('.day-cell[data-date="cal-2026-9-31"]', 'aria-pressed'), 'true');
  assert.equal(await page.locator('.day-cell.has-tasks').count(), 4, 'days with entries are marked');
  // 14 October: an entry in "Personal" (blue) and one in "Work" (red), all-day first
  const dots = await page.$$eval('.day-cell[data-date="cal-2026-9-14"] .day-dot', els => els.map(e => e.style.getPropertyValue('--dot')));
  assert.deepEqual(dots, ['var(--cal-blue)', 'var(--cal-red)']);

  await page.locator('.day-cell[data-date="cal-2026-9-14"]').tap();
  const rows = await page.$$eval('#calendarAgenda .agenda-row', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(rows, ['all-day Zahnarzt 14:30 Personal', '09:00 09:30 Review Work']);

  // New timed entry in the Work calendar for the selected day
  await page.locator('#calendarAgenda .calendar-agenda-add').tap();
  await waitFor(() => editorOpen(page), 'editor');
  assert.equal(await page.inputValue('.event-editor input[type="date"]'), '2026-10-14');
  await page.fill('.event-editor .form-input', 'Rezept abholen');
  await page.locator('.event-editor .form-switch').tap(); // all-day off: times appear
  assert.equal(await page.inputValue('.event-editor input[name="start"]'), '09:00', 'not today: 09:00');
  assert.equal(await page.inputValue('.event-editor input[name="end"]'), '10:00');
  await page.fill('.event-editor input[name="start"]', '16:30');
  await page.dispatchEvent('.event-editor input[name="start"]', 'change');
  assert.equal(await page.inputValue('.event-editor input[name="end"]'), '17:30', 'duration kept when the start moves');
  await page.selectOption('.event-editor select[name="calendar"]', 'cal-work');
  await page.locator('.event-editor .sheet-trailing').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-14' && r.text === 'Rezept abholen' &&
    r.start_time === '16:30:00' && r.end_time === '17:30:00' && r.calendar_id === 'cal-work'), 'timed entry uploaded');
  assert.match(await text(page, '#calendarAgenda'), /16:30\s+17:30\s+Rezept abholen\s+Work/);

  // An end before the start cannot be saved
  await page.locator('#calendarAgenda .agenda-row', { hasText: 'Rezept abholen' }).tap();
  await waitFor(() => editorOpen(page), 'editor again');
  await page.fill('.event-editor input[name="end"]', '15:00');
  await page.dispatchEvent('.event-editor input[name="end"]', 'input');
  assert.equal(await page.locator('.event-editor .sheet-trailing').isDisabled(), true, 'Done disabled');
  assert.equal(await page.getAttribute('.event-editor input[name="end"]', 'aria-invalid'), 'true');
  // Closing with changes asks first
  await page.locator('.event-editor .sheet-leading').tap();
  assert.equal(await page.locator('.event-editor .sheet-confirm:not([hidden])').count(), 1, 'discard changes?');
  await page.locator('.event-editor .sheet-confirm-btn.destructive').tap();
  await waitFor(async () => (await editorOpen(page)) === 0, 'discarded');
  assert.ok(env.store.rows('goals').some(r => r.text === 'Rezept abholen' && r.end_time === '17:30:00'), 'nothing saved');

  await page.locator('#nextMonth').tap();
  assert.equal(await text(page, '#title'), 'November 2026');
  await page.locator('#nextMonth').tap();
  assert.equal(await text(page, '#title'), 'Dezember 2026');
  await page.locator('#prevMonth').tap();
  await page.locator('#prevMonth').tap();
  await page.locator('#prevMonth').tap();
  assert.equal(await text(page, '#title'), 'September 2026');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('calendar: own calendars with colours, editing, moving and deleting entries (desktop)', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env);
  const settingsCalendars = () => (env.store.rows('settings').find(r => r.key === 'calendars') || {}).value;

  // Calendar list: the default calendar, then a new "Work" calendar in red
  await page.click('.calendar-header .calendars-btn');
  await waitFor(() => page.locator('.calendar-manager[open]').count(), 'calendar list');
  assert.deepEqual(await page.$$eval('.calendar-row', els => els.map(e => e.dataset.calendar)), ['default']);
  await page.click('.calendar-manager .form-row-button.tinted');
  assert.equal(await page.textContent('.calendar-manager .sheet-title'), 'Add Calendar');
  assert.equal(await page.locator('.calendar-manager .sheet-trailing').isDisabled(), true, 'name needed');
  await page.fill('.calendar-manager input[name="name"]', 'Work');
  await page.check('.calendar-manager .color-radio[value="red"]');
  await page.click('.calendar-manager .sheet-trailing');
  await waitFor(() => (settingsCalendars() || []).some(c => c.name === 'Work' && c.color === 'red'), 'calendars uploaded');
  const workId = settingsCalendars().find(c => c.name === 'Work').id;
  await page.click('.calendar-manager .sheet-trailing'); // Done
  await waitFor(async () => (await page.locator('.calendar-manager[open]').count()) === 0, 'list closed');

  // Double-click opens the editor; time and calendar are saved with the entry
  await page.locator('.day-cell[data-date="cal-2026-9-16"] .task-text', { hasText: 'Team-Meeting' }).dblclick();
  await waitFor(() => editorOpen(page), 'editor');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('form-input')), true, 'title focused on desktop');
  await page.uncheck('.event-editor .form-switch');
  await page.fill('.event-editor input[name="start"]', '10:00');
  await page.dispatchEvent('.event-editor input[name="start"]', 'change');
  await page.fill('.event-editor input[name="end"]', '11:30');
  await page.dispatchEvent('.event-editor input[name="end"]', 'input');
  await page.selectOption('.event-editor select[name="calendar"]', workId);
  await page.selectOption('.event-editor select[name="priority"]', 'high');
  await page.click('.event-editor .sheet-trailing');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-16' && r.text === 'Team-Meeting 10:00' &&
    r.start_time === '10:00:00' && r.end_time === '11:30:00' && r.calendar_id === workId && r.priority === 'high'), 'entry with time uploaded');
  // Shown by time after the all-day entry, with the calendar's colour and the time
  assert.deepEqual(await page.$$eval('.day-cell[data-date="cal-2026-9-16"] .task-text', els => els.map(e => e.textContent)),
    ['Paket abholen', '10:00–11:30Team-Meeting 10:00']);
  assert.equal(await page.$eval('.day-cell[data-date="cal-2026-9-16"] .task-item:last-child .task-dot', e => e.style.getPropertyValue('--dot')), 'var(--cal-red)');
  // The weekly overview shows it the same way
  assert.match(await page.locator('.kanban-column.today').innerText(), /Paket abholen[\s\S]*10:00–11:30\s*Team-Meeting/);

  // A new date moves the entry to that day
  await page.locator('.day-cell[data-date="cal-2026-9-16"] .task-text', { hasText: 'Team-Meeting' }).dblclick();
  await page.fill('.event-editor input[type="date"]', '2026-10-21');
  await page.dispatchEvent('.event-editor input[type="date"]', 'change');
  await page.click('.event-editor .sheet-trailing');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-21' && r.text === 'Team-Meeting 10:00') &&
    !env.store.rows('goals').some(r => r.date === 'cal-2026-9-16' && r.text === 'Team-Meeting 10:00'), 'entry moved to 21 October');

  // Deleting the calendar: its entries show in the default calendar (blue)
  await page.click('.calendar-header .calendars-btn');
  await page.click(`.calendar-row[data-calendar="${workId}"]`);
  await page.click('.calendar-manager .form-row-button.destructive');
  assert.match(await page.textContent('.calendar-manager .sheet-confirm-message'), /“Work” will be deleted\. Its 1 event moves to “Personal”\./);
  await page.click('.calendar-manager .sheet-confirm-btn.destructive');
  await waitFor(() => (settingsCalendars() || []).length === 1, 'calendar deleted in the cloud');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.day-cell[data-date="cal-2026-9-21"] .task-dot', e => e.style.getPropertyValue('--dot')), 'var(--cal-blue)');

  // The editor's Delete asks first
  await page.locator('.day-cell[data-date="cal-2026-9-21"] .task-text').dblclick();
  await page.click('.event-editor [data-edit-only] .destructive, .event-editor .form-row-button.destructive');
  await page.click('.event-editor .sheet-confirm-btn.destructive');
  await waitFor(() => !env.store.rows('goals').some(r => r.text === 'Team-Meeting 10:00'), 'entry deleted');
  assert.deepEqual(errors, []);
  await context.close();
});

// White would vanish on the white cards of the light theme: white dots get a grey edge (3.2:1
// against white); in dark mode the edge is white like the dot
scenario('calendar: white as a calendar colour, visible on white cards', async (env) => {
  seedDemo(env.store, { steps: false });
  const settingsCalendars = () => (env.store.rows('settings').find(r => r.key === 'calendars') || {}).value;
  const { page, errors, context } = await openPhone(env);
  await goToSection(page, 'week');

  // The colour list offers White, after the iOS colours; a new calendar in white
  await page.locator('#calendarAgenda .calendars-btn').tap();
  await waitFor(() => page.locator('.calendar-manager[open]').count(), 'calendar list');
  await page.locator('.calendar-manager .form-row-button.tinted').tap();
  assert.equal((await page.locator('.calendar-manager .color-row .color-name').allInnerTexts()).pop(), 'White');
  await page.fill('.calendar-manager input[name="name"]', 'Notizen');
  await page.locator('.calendar-manager .color-row', { hasText: 'White' }).tap();
  await page.locator('.calendar-manager .sheet-trailing').tap();
  await waitFor(() => (settingsCalendars() || []).some(c => c.name === 'Notizen' && c.color === 'white'), 'white calendar uploaded');
  const notesId = settingsCalendars().find(c => c.name === 'Notizen').id;
  assert.equal(await text(page, `.calendar-row[data-calendar="${notesId}"] .calendar-row-color`), 'White');
  await page.locator('.calendar-manager .sheet-trailing').tap(); // Done
  await waitFor(async () => (await page.locator('.calendar-manager[open]').count()) === 0, 'list closed');

  // Today's "Paket abholen" moves into the white calendar
  await page.locator('#calendarAgenda .agenda-row', { hasText: 'Paket abholen' }).tap();
  await waitFor(() => editorOpen(page), 'editor');
  await page.selectOption('.event-editor select[name="calendar"]', notesId);
  await page.locator('.event-editor .sheet-trailing').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Paket abholen' && r.calendar_id === notesId), 'entry in the white calendar');

  // Month grid, day list, day strip and day card: white dots with an edge
  const dots = () => page.evaluate(() => ['.day-dot', '.agenda-dot', '.week-strip-dot', '.kanban-card-dot'].map(cls => {
    const dot = document.querySelector(`${cls}[data-color="white"]`);
    if (!dot) return `${cls} missing`;
    const style = getComputedStyle(dot);
    return `${cls} ${style.backgroundColor} | ${style.boxShadow}`;
  }));
  const edged = (edge) => ['.day-dot', '.agenda-dot', '.week-strip-dot', '.kanban-card-dot'].map(cls => `${cls} rgb(255, 255, 255) | ${edge} 0px 0px 0px 1px inset`);
  await waitFor(async () => !(await dots()).some(d => d.endsWith('missing')), 'white dots rendered');
  assert.deepEqual(await dots(), edged('rgb(134, 134, 139)'), 'grey edge on white (light)');
  await page.locator('#appBarMore').tap();
  await page.waitForSelector('.menu-layer.open');
  await menuAction(page, 'dark-mode');
  assert.deepEqual(await dots(), edged('rgb(255, 255, 255)'), 'dark: the edge is white like the dot');

  // Desktop: the dots in the month grid and on the card in the week
  const desktop = await open(env, { viewport: { width: 1440, height: 900 } });
  await waitFor(() => desktop.page.locator('.kanban-card-dot[data-color="white"]').count(), 'white card on the desktop');
  for (const cls of ['.task-dot', '.kanban-card-dot']) {
    assert.equal(await desktop.page.$eval(`${cls}[data-color="white"]`, el => getComputedStyle(el).boxShadow), 'rgb(134, 134, 139) 0px 0px 0px 1px inset', cls);
  }
  assert.deepEqual(desktop.errors, []);
  await desktop.context.close();
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('calendar: without the database migration an entry with a time stays on the device', async (env) => {
  const { page, context } = await open(env);
  env.store.missingColumns.add('goals.start_time');
  env.store.missingColumns.add('goals.end_time');
  env.store.missingColumns.add('goals.calendar_id');
  await page.locator('.day-cell[data-date="cal-2026-9-16"] .add-task-btn').click();
  await page.fill('.event-editor .form-input', 'Zahnarzt');
  await page.uncheck('.event-editor .form-switch');
  await page.click('.event-editor .sheet-trailing');
  await waitFor(async () => (await page.getAttribute('#syncStatus', 'data-sync-state')) === 'error', 'sync error shown');
  assert.match(await page.getAttribute('#syncStatus', 'title'), /start_time/);
  assert.ok(await page.evaluate(() => db.isDirty('cal-2026-9-16')), 'kept as pending change');
  assert.equal(await page.locator('.day-cell[data-date="cal-2026-9-16"] .task-time').count(), 1, 'still shown with its time');
  // Days without a time keep syncing
  await page.evaluate(() => { db.setGoals([{ text: 'Ziel', done: false }]); });
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Ziel'), 'goals still upload');

  // After the migration the next sync uploads it
  env.store.missingColumns.clear();
  await page.evaluate(() => db.loadFromCloud());
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Zahnarzt' && r.start_time === '11:00:00'), 'uploaded after the migration');
  await context.close();
});

scenario('habits: "+ New Habit" keeps a gap to the weekday labels (desktop and phone)', async (env) => {
  seedDemo(env.store, { steps: false });
  const gap = (page) => page.evaluate(() => {
    const button = document.querySelector('.habits-toolbar .btn').getBoundingClientRect();
    const labels = [...document.querySelectorAll('.habit-header-row > div')].filter(d => d.getBoundingClientRect().height > 0);
    return Math.round(Math.min(...labels.map(d => d.getBoundingClientRect().top)) - button.bottom);
  });
  const desk = await open(env);
  assert.ok(await gap(desk.page) >= 16, `desktop gap ${await gap(desk.page)}px`);
  await desk.context.close();
  const phone = await openPhone(env);
  assert.ok(await gap(phone.page) >= 16, `phone gap ${await gap(phone.page)}px`);
  assert.deepEqual(phone.errors, []);
  await phone.context.close();
});

// Phones: the week as a strip of days (Apple Calendar) and one day card per swipe; the row
// takes the height of the day on screen, so the page no longer grows with every task
scenario('week on phones: day strip and one day card per swipe; wide screens keep the columns', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, PHONE);
  await goToSection(page, 'week');
  await waitFor(() => page.locator('#weekStrip .week-strip-day').count(), 'day strip');
  const strip = page.locator('#weekStrip .week-strip-day');
  const state = () => page.evaluate(() => {
    const pager = document.getElementById('weekKanban');
    const cards = [...pager.children].filter(c => c.classList.contains('kanban-column'));
    const current = [...document.querySelectorAll('#weekStrip .week-strip-day')].findIndex(b => b.getAttribute('aria-current') === 'true');
    return {
      shown: cards.filter(c => { const r = c.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }).map(c => c.id),
      current,
      pagerHeight: pager.offsetHeight,
      cardHeight: current >= 0 ? cards[current].offsetHeight : -1,
      allCards: cards.reduce((sum, c) => sum + c.offsetHeight, 0),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  // The row stopped scrolling: unchanged for 6 frames in a row. A card counts as on screen while
  // the snap still glides through its last pixels (a jump over six days takes a while)
  const scrollStopped = () => page.evaluate(() => new Promise(resolve => {
    const pager = document.getElementById('weekKanban');
    let last = pager.scrollLeft;
    let still = 0;
    const tick = () => {
      if (pager.scrollLeft === last) still++;
      else { still = 0; last = pager.scrollLeft; }
      if (still >= 6) resolve(true);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const settled = async (day) => {
    await waitFor(async () => {
      const s = await state();
      return s.current === day && s.shown.length === 1 && s.shown[0] === `week-day-${day}` && s.pagerHeight === s.cardHeight;
    }, `day ${day} on screen, row as high as its card`);
    await scrollStopped();
    return state();
  };

  // The card on screen lines up with the week panel above (centred, same width) and no
  // neighbouring day peeks in at the screen edges
  const alignment = () => page.evaluate(() => {
    const panel = document.querySelector('.week-nav-panel').getBoundingClientRect();
    const cards = [...document.querySelectorAll('#weekKanban > .kanban-column')].map(c => c.getBoundingClientRect());
    const shown = cards.find(r => r.left >= -1 && r.right <= innerWidth + 1);
    return {
      left: Math.round(shown.left - panel.left), right: Math.round(shown.right - panel.right),
      peeking: cards.filter(r => r !== shown && r.right > 0 && r.left < innerWidth).length
    };
  });

  // Today (Friday, 16 October) on screen and filled in the strip; far shorter than all days
  let s = await settled(4);
  assert.deepEqual(await alignment(), { left: 0, right: 0, peeking: 0 }, 'day card aligned with the panel above');
  assert.ok(s.pagerHeight < s.allCards / 2, `row ${s.pagerHeight}px, all days ${s.allCards}px`);
  assert.equal(s.overflow, 0);
  assert.equal(await strip.count(), 7);
  assert.equal(await strip.nth(4).getAttribute('aria-label'), 'Freitag, 16. Oktober, today, 2 events, 2 open tasks');
  assert.equal(await strip.nth(0).getAttribute('aria-label'), 'Montag, 12. Oktober, nothing planned');
  assert.equal(await strip.nth(4).getAttribute('aria-controls'), 'week-day-4');
  assert.deepEqual(await strip.nth(4).locator('.week-strip-dot').evaluateAll(dots => dots.map(d => d.classList.contains('is-task') ? 'task' : d.style.getPropertyValue('--dot'))),
    ['var(--cal-blue)', 'task'], 'calendar colour, then a dot for open tasks');
  assert.equal(await strip.nth(0).locator('.week-strip-dot').count(), 0);
  assert.equal(await text(page, '#week-day-4 .kanban-day-long'), 'Freitag, 16. Oktober');
  assert.equal(await displayed(page, '#week-day-4 .kanban-date'), false, 'short date replaced by the whole date');

  // Swipe to the next day (Safari: native scroll snapping; here a scroll of 60% of a card)
  await page.evaluate(() => { const p = document.getElementById('weekKanban'); p.scrollBy({ left: p.clientWidth * 0.6 }); });
  s = await settled(5);
  assert.match(await text(page, '#week-day-5'), /Samstag, 17\. Oktober[\s\S]*Bauernmarkt/);
  assert.deepEqual(await alignment(), { left: 0, right: 0, peeking: 0 }, 'Saturday aligned too');

  // A tap in the strip jumps to that day; a new task there makes the row grow with it
  await strip.nth(0).tap();
  await settled(0);
  const before = (await state()).pagerHeight;
  await page.locator('#week-day-0 .kanban-add-btn').tap();
  await page.waitForSelector('#inputModal.active');
  await page.fill('#inputModalField', 'Wäsche waschen');
  await page.click('#inputModalSubmit');
  await waitFor(() => env.store.rows('kanban_tasks').some(r => r.column_name === 'MO' && /Wäsche waschen/.test(r.text)), 'task uploaded on Monday');
  s = await settled(0);
  assert.ok(s.pagerHeight > before, 'row grew with the new task');
  assert.equal(await strip.nth(0).getAttribute('aria-label'), 'Montag, 12. Oktober, 1 open task');

  // Next week: the same weekday stays on screen; Today: back to today's card
  await page.locator('.week-nav-panel .chevron-next').tap();
  await settled(0);
  assert.equal(await strip.nth(0).getAttribute('aria-label'), 'Montag, 19. Oktober, nothing planned');
  // Sunday (the last card) snaps like the others
  await strip.nth(6).tap();
  await settled(6);
  assert.deepEqual(await alignment(), { left: 0, right: 0, peeking: 0 }, 'Sunday aligned too');
  await page.locator('.week-nav-panel .btn', { hasText: 'Today' }).tap();
  await settled(4);

  // Unfolded / tablet width: all days as columns again, no strip; back: strip and today's card
  await page.setViewportSize(DUO_UNFOLDED);
  await waitFor(async () => (await page.locator('#weekStrip').count()) === 0, 'strip removed on the wide layout');
  assert.equal(await page.evaluate(() => document.getElementById('weekKanban').style.height), '', 'no fixed height on the wide layout');
  const columns = await page.evaluate(() => new Set([...document.querySelectorAll('.kanban-column')].map(c => Math.round(c.getBoundingClientRect().left))).size);
  assert.ok(columns >= 3, `wide layout uses ${columns} columns`);
  await page.setViewportSize(PHONE.viewport);
  await settled(4);
  assert.deepEqual(errors, []);
  await context.close();
});

// Phones and tablets: the Step Challenge first in the Health Hub (moved in the DOM, so the
// reading and focus order match the screen); the desktop keeps it below the hero row
scenario('health hub: Step Challenge first on phones and tablets, below the hero row on the desktop', async (env) => {
  seedDemo(env.store);
  const order = (page) => page.evaluate(() => {
    const card = document.getElementById('stepChallenge');
    const top = (sel) => document.querySelector(sel).getBoundingClientRect().top;
    return {
      after: card.previousElementSibling.id || card.previousElementSibling.className.split(' ')[0],
      above: top('#stepChallenge') < top('.gym-hero')
    };
  });

  const desktop = await open(env, { viewport: { width: 1440, height: 900 } });
  await waitFor(() => desktop.page.locator('#stepChallenge .step-hero-value').count(), 'desktop step card');
  assert.deepEqual(await order(desktop.page), { after: 'streakHistory', above: false }, 'desktop: unchanged, below the hero row');
  await desktop.context.close();

  const { page, errors, context } = await open(env, PHONE);
  await waitFor(() => page.locator('#stepChallenge .step-hero-value').count(), 'phone step card');
  assert.deepEqual(await order(page), { after: 'gym-hub-header', above: true }, 'phone: first in the Health Hub');
  // KPI numbers stay whole: one line and inside their tile ("1.794.99" / "4" before)
  const kpis = await page.$$eval('#stepChallenge .step-kpi-value', els => els.map(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return { text: el.textContent, lines: new Set([...range.getClientRects()].map(r => Math.round(r.top))).size, fits: el.scrollWidth <= el.clientWidth + 1 };
  }));
  assert.ok(kpis.some(k => k.text === '1.794.994'), JSON.stringify(kpis));
  assert.deepEqual(kpis.filter(k => k.lines !== 1 || !k.fits), [], 'KPI values on one line, inside the tile');

  // Tablet turned to landscape (desktop layout) and back; the focus stays in the card
  await page.setViewportSize({ width: 820, height: 1180 });
  await settle(page, 300);
  assert.deepEqual(await order(page), { after: 'gym-hub-header', above: true }, 'tablet portrait: first');
  await page.focus('#step-entry-input');
  await page.setViewportSize({ width: 1180, height: 820 });
  await waitFor(async () => !(await touchLayoutOn(page)), 'desktop layout');
  assert.deepEqual(await order(page), { after: 'streakHistory', above: false }, 'tablet landscape: below the hero row');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'step-entry-input', 'focus kept after the move');
  await page.setViewportSize({ width: 820, height: 1180 });
  await waitFor(() => touchLayoutOn(page), 'touch layout again');
  assert.deepEqual(await order(page), { after: 'gym-hub-header', above: true }, 'tablet portrait again: first');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'step-entry-input', 'focus kept after moving back');
  assert.deepEqual(errors, []);
  await context.close();
});

// ---------------------------------------------------------------- Matrix (js/matrix-ui.js)

const matrixTasks = (env) => ((env.store.rows('lists').find(r => r.name === 'matrix') || {}).items || []);
const storedListOrder = (env) => ((env.store.rows('settings').find(r => r.key === 'customListsMeta') || {}).value || []).map(l => l.id);
const cardTexts = (page, area) => page.$$eval(`.matrix-panel .matrix-area[data-area="${area}"] .matrix-task-main`, els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
const matrixSheetOpen = (page, cls) => page.locator(`.${cls}[open]`).count();

scenario('matrix on phones: first in Lists; add, tick, repeat, rename an area, move tasks and the matrix', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  await goToSection(page, 'lists');

  // At the top of Lists, the four areas, then the lists; nothing stored until the first change
  assert.deepEqual(await page.$$eval('#unifiedListsGrid > *', els => els.map(e => e.dataset.listId)), ['matrix', 'custom-1', 'custom-2', 'custom-3']);
  assert.deepEqual(await page.$$eval('.matrix-area-name', els => els.map(e => e.textContent)), ['to do', 'up next', 'waiting', 'ideas']);
  assert.equal(await page.getAttribute('.matrix-area[data-area="todo"] .matrix-area-open', 'aria-label'), 'to do, 0 open tasks');
  assert.deepEqual(storedListOrder(env), ['custom-1', 'custom-2', 'custom-3']);

  // "+" in "up next": text, note, Today, repeat weekly
  await page.locator('.matrix-area[data-area="next"] .matrix-area-add').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet');
  assert.equal((await text(page, '.matrix-task-sheet .sheet-title')).trim(), 'up next');
  assert.equal(await page.locator('.matrix-task-sheet .sheet-trailing').isDisabled(), true, 'text needed');
  await page.fill('.matrix-task-sheet input[name="text"]', 'test');
  await page.fill('.matrix-task-sheet textarea[name="note"]', 'mit Notiz');
  await page.locator('.matrix-chip[data-chip="today"]').tap();
  assert.equal(await page.getAttribute('.matrix-chip[data-chip="today"]', 'aria-pressed'), 'true');
  await page.locator('.matrix-task-sheet input[name="repeat"]').tap();
  await page.selectOption('.matrix-task-sheet select[name="every"]', 'weekly');
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await waitFor(() => matrixTasks(env).length === 1, 'task uploaded');
  const repeating = matrixTasks(env)[0];
  assert.match(repeating.id, /^t/);
  assert.deepEqual(Object.assign({}, repeating, { id: 'x' }), { id: 'x', text: 'test', done: false, area: 'next', note: 'mit Notiz', due: '2026-10-16', repeat: 'weekly' });
  await waitFor(() => storedListOrder(env)[0] === 'matrix', 'the matrix is stored at the top with its first task');
  assert.deepEqual(await cardTexts(page, 'next'), ['test Today Weekly']);

  // The same text in "to do" is a task of its own
  await page.locator('.matrix-area[data-area="todo"] .matrix-area-add').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet again');
  await page.fill('.matrix-task-sheet input[name="text"]', 'test');
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await waitFor(() => matrixTasks(env).length === 2, 'second task uploaded');
  const todo = matrixTasks(env).find(t => t.area === 'todo');
  assert.notEqual(todo.id, repeating.id);

  // Ticking: the repeating task moves on a week and stays; the other one is done
  await page.locator(`.matrix-panel [data-task-id="${repeating.id}"] .matrix-check`).tap();
  await waitFor(() => matrixTasks(env).find(t => t.id === repeating.id).due === '2026-10-23', 'next week');
  assert.equal(matrixTasks(env).find(t => t.id === repeating.id).done, false);
  assert.deepEqual(await cardTexts(page, 'next'), ['test Fr., 23. Okt. Weekly']);
  await page.locator(`.matrix-panel [data-task-id="${todo.id}"] .matrix-check`).tap();
  await waitFor(() => matrixTasks(env).find(t => t.id === todo.id).done === true, 'done uploaded');
  await waitFor(async () => (await cardTexts(page, 'todo')).length === 0, 'gone from the card');

  // Area sheet: count, done ones under Completed (tick opens again), rename with the pencil
  await page.locator('.matrix-area[data-area="todo"] .matrix-area-open').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-area-sheet'), 'area sheet');
  assert.equal(await text(page, '.matrix-area-sheet .matrix-count'), '0');
  assert.equal(await page.isVisible('.matrix-area-sheet .matrix-empty'), true);
  await page.locator('.matrix-area-sheet .matrix-done-list .matrix-check').tap();
  await waitFor(async () => (await text(page, '.matrix-area-sheet .matrix-count')) === '1', 'opened again');
  await waitFor(() => matrixTasks(env).find(t => t.id === todo.id).done === false, 'open again uploaded');
  await page.locator('.matrix-area-sheet .matrix-rename').tap();
  assert.equal(await page.inputValue('.matrix-area-sheet .matrix-sheet-input'), 'to do');
  await page.fill('.matrix-area-sheet .matrix-sheet-input', '  heute  ');
  await page.keyboard.press('Enter');
  await waitFor(async () => (await text(page, '.matrix-area-sheet .matrix-sheet-title')) === 'heute', 'renamed');
  await waitFor(() => {
    const entry = ((env.store.rows('settings').find(r => r.key === 'customListsMeta') || {}).value || []).find(l => l.id === 'matrix');
    return entry && entry.areas.find(a => a.id === 'todo').title === 'heute';
  }, 'area title uploaded');
  // The big button adds to this area; Escape in the rename field does not close the sheet
  await page.locator('.matrix-area-sheet .matrix-rename').tap();
  await page.keyboard.press('Escape');
  assert.equal(await matrixSheetOpen(page, 'matrix-area-sheet'), 1, 'still open');
  assert.equal(await text(page, '.matrix-area-sheet .matrix-sheet-title'), 'heute');
  await page.locator('.matrix-area-sheet .matrix-add-big').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet over the area sheet');
  assert.equal((await text(page, '.matrix-task-sheet .sheet-title')).trim(), 'heute');
  await page.fill('.matrix-task-sheet input[name="text"]', 'Rechnung zahlen');
  await page.locator('.matrix-chip[data-chip="tomorrow"]').tap();
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await waitFor(() => matrixTasks(env).some(t => t.text === 'Rechnung zahlen' && t.area === 'todo' && t.due === '2026-10-17'), 'added from the area sheet');
  await waitFor(async () => (await text(page, '.matrix-area-sheet .matrix-count')) === '2', 'count follows');
  await page.locator('.matrix-area-sheet .sheet-leading').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-area-sheet')) === 0, 'area sheet closed');
  assert.equal(await text(page, '.matrix-area[data-area="todo"] .matrix-area-name'), 'heute');

  // Editing: another area moves the task; Delete asks first
  await page.locator(`.matrix-panel [data-task-id="${repeating.id}"] .matrix-task-main`).tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'edit sheet');
  assert.equal(await page.inputValue('.matrix-task-sheet textarea[name="note"]'), 'mit Notiz');
  assert.equal(await page.getAttribute('.matrix-chip[data-chip="custom"]', 'aria-pressed'), 'true');
  assert.equal(await page.inputValue('.matrix-task-sheet input[name="due"]'), '2026-10-23');
  await page.selectOption('.matrix-task-sheet select[name="area"]', 'waiting');
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await waitFor(() => matrixTasks(env).find(t => t.id === repeating.id).area === 'waiting', 'moved to waiting');
  assert.deepEqual(await cardTexts(page, 'next'), []);
  assert.equal((await cardTexts(page, 'waiting')).length, 1);
  await page.locator(`.matrix-panel [data-task-id="${repeating.id}"] .matrix-task-main`).tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'edit sheet again');
  await page.locator('.matrix-task-sheet .form-row-button.destructive').tap();
  assert.match(await text(page, '.matrix-task-sheet .sheet-confirm-message'), /“test” will be deleted\./);
  await page.locator('.matrix-task-sheet .sheet-confirm-btn.destructive').tap();
  await waitFor(() => !matrixTasks(env).some(t => t.id === repeating.id), 'deleted');

  // The whole matrix moves like a list
  await page.locator('.matrix-more-btn').tap();
  await page.waitForSelector('.menu-layer.open');
  assert.equal(await page.locator('.menu-item[data-action="up"]').isDisabled(), true, 'already first');
  await menuAction(page, 'down');
  await waitFor(() => storedListOrder(env).join() === 'custom-1,matrix,custom-2,custom-3', 'moved down in the cloud');
  assert.deepEqual(await page.$$eval('#unifiedListsGrid > *', els => els.map(e => e.dataset.listId)), ['custom-1', 'matrix', 'custom-2', 'custom-3']);
  await page.locator('.matrix-more-btn').tap();
  await page.waitForSelector('.menu-layer.open');
  await menuAction(page, 'up');
  await waitFor(() => storedListOrder(env)[0] === 'matrix', 'back to the top');
  assert.equal(await horizontalOverflow(page), 0);
  // Every control of the matrix at least 44 x 44 pt
  const small = await page.$$eval('.matrix-panel button', els => els
    .filter(el => el.getClientRects().length > 0)
    .map(el => { const r = el.getBoundingClientRect(); return [el.className, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 44 || h < 44));
  assert.deepEqual(small, [], 'matrix controls smaller than 44pt');
  assert.deepEqual(errors, []);
  await context.close();
});

// Lists are merged item by item when this device had unsent changes. Items were matched by
// their text, so the same text in several areas collapsed into one; matrix tasks have an id.
scenario('matrix: the same text in several areas survives a merge with the cloud', async (env) => {
  seedDemo(env.store, { steps: false });
  env.store.tables.settings.find(r => r.key === 'customListsMeta').value.unshift(Object.assign({}, require('../../js/matrix-core.js').defaultEntry()));
  env.store.seed('lists', [{ user_id: USER, name: 'matrix', icon: 'list', items: [
    { id: 'a', text: 'test', done: false, area: 'todo' },
    { id: 'b', text: 'test', done: false, area: 'next' }
  ] }]);
  const { page, errors, context } = await openPhone(env);
  await goToSection(page, 'lists');
  await waitFor(async () => (await cardTexts(page, 'next')).length === 1, 'tasks from the cloud');

  context.__offline = true;
  await page.locator('.matrix-area[data-area="waiting"] .matrix-area-add').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet');
  await page.fill('.matrix-task-sheet input[name="text"]', 'test');
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await settle(page, 300);
  assert.equal(matrixTasks(env).length, 2, 'offline: not uploaded');
  context.__offline = false;
  await page.evaluate(() => db.loadFromCloud());
  await waitFor(() => matrixTasks(env).length === 3, 'merged and uploaded');
  assert.deepEqual(matrixTasks(env).map(t => `${t.text}/${t.area}`).sort(), ['test/next', 'test/todo', 'test/waiting']);
  for (const area of ['todo', 'next', 'waiting']) assert.equal((await cardTexts(page, area)).length, 1, area);
  assert.deepEqual(errors.filter(e => !/Failed to fetch|Sync/.test(e)), []);
  await context.close();
});

// ---------------------------------------------------------------- Sheets and the keyboard
// iOS shows the keyboard only for a focus during the tap, and it scrolls the page to reveal the
// focused field. A field focused while its sheet was still below the screen (sliding up) made
// the page jump (a dark screen, "Repeat" at the top) and that scroll stayed after the sheet
// closed (Lists → Habits). Chromium has no on-screen keyboard, so these checks hold the
// conditions: the field is in its final place when it gets the focus, and the page behind an
// open sheet cannot be scrolled and is back at its place when the sheet closes.

async function recordFocus(page) {
  await page.evaluate(() => {
    window.__focusLog = [];
    document.addEventListener('focusin', (e) => {
      if (!e.target.matches('input[type="text"], textarea')) return;
      const r = e.target.getBoundingClientRect();
      window.__focusLog.push({ name: e.target.name, top: Math.round(r.top), bottom: Math.round(r.bottom), screen: window.innerHeight });
    }, true);
    window.__sections = [];
    window.addEventListener('dashboard:sectionchange', (e) => window.__sections.push(e.detail.section));
  });
}
const takeLog = (page, name) => page.evaluate(n => window[n].splice(0), name);
// Where the page stands: its scroll position, a block's place on screen and the app bar's
const pageSpot = (page, selector) => page.evaluate(sel => ({
  y: Math.round(window.scrollY),
  block: Math.round(document.querySelector(sel).getBoundingClientRect().top),
  bar: Math.round(document.querySelector('.app-bar').getBoundingClientRect().top)
}), selector);
// What iOS does to reveal a focused field: it scrolls the page
const tryToScroll = (page) => page.evaluate(() => window.scrollTo(0, window.scrollY + 600));
const sheetAnimation = (page, cls) => page.evaluate(c => getComputedStyle(document.querySelector(`.${c}`)).animationName, cls);

function assertFocusedInPlace(entry, name) {
  assert.ok(entry, `${name} focused`);
  assert.equal(entry.name, name);
  assert.ok(entry.top >= 0 && entry.bottom <= entry.screen, `${name} on screen when it got the focus: ${JSON.stringify(entry)}`);
}

scenario('sheets on phones: a new entry gets the keyboard where its field stays; the page behind keeps its place', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  await recordFocus(page);
  await goToSection(page, 'lists');
  const before = await pageSpot(page, '.matrix-panel');
  assert.ok(before.y > 1000, 'Lists is far down the page');
  await takeLog(page, '__sections');

  // "+" in "to do": the task field gets the focus in its final place
  await page.locator('.matrix-area[data-area="todo"] .matrix-area-add').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet');
  const [focused] = await takeLog(page, '__focusLog');
  assertFocusedInPlace(focused, 'text');
  assert.equal(await sheetAnimation(page, 'matrix-task-sheet'), 'sheet-appear', 'appears in place');
  await settle(page, 400);
  const field = await page.evaluate(() => {
    const input = document.querySelector('.matrix-task-sheet input[name="text"]');
    return { top: Math.round(input.getBoundingClientRect().top), active: document.activeElement === input };
  });
  assert.equal(field.active, true, 'typing goes into the task field');
  assert.equal(field.top, focused.top, 'the field stays where it got the focus');

  // The page behind keeps its place, also when the browser scrolls it
  const held = await pageSpot(page, '.matrix-panel');
  assert.equal(held.block, before.block, 'no jump when the sheet opens');
  assert.equal(held.bar, 0, 'the app bar stays at the top');
  await tryToScroll(page);
  await settle(page, 100);
  assert.equal((await pageSpot(page, '.matrix-panel')).block, before.block, 'the page behind cannot be scrolled');

  // Saved: back at the same place in Lists
  await page.keyboard.type('Brief schreiben');
  await page.locator('.matrix-task-sheet .sheet-trailing').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-task-sheet')) === 0, 'saved and closed');
  await waitFor(() => matrixTasks(env).some(t => t.text === 'Brief schreiben'), 'uploaded');
  assert.deepEqual(await pageSpot(page, '.matrix-panel'), before, 'same place as before');
  assert.equal(await currentSection(page), 'lists');

  // Editing opens no keyboard: the sheet slides up as before
  await page.locator('.matrix-panel .matrix-task-main', { hasText: 'Brief schreiben' }).tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'edit sheet');
  assert.equal(await sheetAnimation(page, 'matrix-task-sheet'), 'none', 'slides up');
  await settle(page, 400);
  assert.deepEqual(await takeLog(page, '__focusLog'), [], 'no text field focused');
  await page.locator('.matrix-task-sheet .sheet-leading').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-task-sheet')) === 0, 'edit sheet closed');
  assert.deepEqual(await pageSpot(page, '.matrix-panel'), before);

  // A task sheet over the area sheet: the page stays held until the last sheet closes
  await page.locator('.matrix-area[data-area="todo"] .matrix-area-open').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-area-sheet'), 'area sheet');
  await page.locator('.matrix-area-sheet .matrix-add-big').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet over the area sheet');
  assertFocusedInPlace((await takeLog(page, '__focusLog'))[0], 'text');
  await page.locator('.matrix-task-sheet .sheet-leading').tap(); // nothing typed: closes
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-task-sheet')) === 0, 'task sheet closed');
  await tryToScroll(page);
  await settle(page, 100);
  assert.equal((await pageSpot(page, '.matrix-panel')).block, before.block, 'still held under the area sheet');
  await page.locator('.matrix-area-sheet .sheet-leading').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-area-sheet')) === 0, 'area sheet closed');
  assert.deepEqual(await pageSpot(page, '.matrix-panel'), before);
  assert.deepEqual(await takeLog(page, '__sections'), [], 'the section bar stayed on Lists');

  // Lists starts in the lower half of the screen, so the bar shows the section above it: a
  // sheet opened from there leaves the bar as it is
  await page.evaluate(() => window.scrollBy(0, -Math.round(window.innerHeight * 0.45)));
  await waitFor(async () => (await currentSection(page)) !== 'lists', 'the section above Lists');
  await settle(page, 300);
  const above = await currentSection(page);
  const middle = await pageSpot(page, '.matrix-panel');
  await takeLog(page, '__sections');
  await page.locator('.matrix-area[data-area="next"] .matrix-area-add').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'task sheet from the middle');
  assertFocusedInPlace((await takeLog(page, '__focusLog'))[0], 'text');
  await page.keyboard.type('x');
  await settle(page, 300);
  assert.equal(await currentSection(page), above, 'the bar keeps its section while the sheet is open');
  await page.keyboard.press('Backspace');
  await page.locator('.matrix-task-sheet .sheet-leading').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-task-sheet')) === 0, 'closed again');
  assert.deepEqual(await pageSpot(page, '.matrix-panel'), middle);
  assert.equal(await currentSection(page), above);
  assert.deepEqual(await takeLog(page, '__sections'), [], 'no section change');

  // Calendar: "+ New Event" with the page scrolled a little
  await goToSection(page, 'week');
  const y = await page.evaluate(() => {
    const r = document.querySelector('#calendarAgenda .calendar-agenda-add').getBoundingClientRect();
    return Math.max(80, Math.round(r.top + window.scrollY - window.innerHeight / 2));
  });
  await page.evaluate(v => window.scrollTo(0, v), y);
  await settle(page, 300);
  const cal = await pageSpot(page, '.calendar-section');
  assert.equal(cal.y, y);
  await takeLog(page, '__sections');
  await page.locator('#calendarAgenda .calendar-agenda-add').tap();
  await waitFor(() => editorOpen(page), 'event editor');
  assertFocusedInPlace((await takeLog(page, '__focusLog'))[0], 'title');
  assert.equal(await sheetAnimation(page, 'event-editor'), 'sheet-appear');
  await tryToScroll(page);
  await settle(page, 400);
  assert.equal((await pageSpot(page, '.calendar-section')).block, cal.block, 'the page behind the editor cannot be scrolled');
  await page.locator('.event-editor .sheet-leading').tap(); // nothing typed: closes
  await waitFor(async () => (await editorOpen(page)) === 0, 'editor closed');
  assert.deepEqual(await pageSpot(page, '.calendar-section'), cal, 'same place as before');
  assert.deepEqual(await takeLog(page, '__sections'), []);
  assert.equal(await horizontalOverflow(page), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('foldable: unfolding while a sheet is open keeps the reading position behind it', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, { viewport: DUO_FOLDED, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await goToSection(page, 'week');
  const saturday = '#week-day-5';
  await page.locator('#weekStrip .week-strip-day').nth(5).tap();
  await waitFor(() => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }, saturday), 'Saturday on screen');
  const topOf = () => page.evaluate(sel => Math.round(document.querySelector(sel).getBoundingClientRect().top), saturday);
  await page.evaluate(sel => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120); }, saturday);
  await settle(page, 300);
  assert.equal(await topOf(), 120);

  // The calendar list (no keyboard; the button is above, off screen, and a click does not
  // scroll): unfold under it
  const managerOpen = () => page.locator('.calendar-manager[open]').count();
  await page.evaluate(() => document.querySelector('#calendarAgenda .calendars-btn').click());
  await waitFor(managerOpen, 'calendar list');
  assert.equal(await topOf(), 120, 'held in place');
  await page.setViewportSize(DUO_UNFOLDED);
  await settle(page, 400);
  assert.ok(Math.abs((await topOf()) - 120) <= 4, `Saturday moved to ${await topOf()}px behind the calendar list after unfolding`);
  await page.locator('.calendar-manager .sheet-trailing').tap(); // Done
  await waitFor(async () => (await managerOpen()) === 0, 'calendar list closed');
  assert.ok(Math.abs((await topOf()) - 120) <= 4, `Saturday moved to ${await topOf()}px after the calendar list closed`);

  // "+ New Event" (with the keyboard): fold under it
  await page.evaluate(() => document.querySelector('#calendarAgenda .calendar-agenda-add').click());
  await waitFor(() => editorOpen(page), 'event editor');
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 400);
  assert.ok(Math.abs((await topOf()) - 120) <= 4, `Saturday moved to ${await topOf()}px behind the editor after folding`);
  await page.locator('.event-editor .sheet-leading').tap(); // nothing typed: closes
  await waitFor(async () => (await editorOpen(page)) === 0, 'editor closed');
  assert.ok(Math.abs((await topOf()) - 120) <= 4, `Saturday moved to ${await topOf()}px after the editor closed`);
  assert.equal(await currentSection(page), 'week');
  assert.equal(await horizontalOverflow(page), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('matrix on the desktop: across the list grid, dialogs, dragged like a list', async (env) => {
  seedDemo(env.store, { steps: false });
  // Tasks from another device whose place in the list order has not arrived yet
  env.store.seed('lists', [{ user_id: USER, name: 'matrix', icon: 'list', items: [{ id: 'w', text: 'Antwort vom Vermieter', done: false, area: 'waiting' }] }]);
  const { page, errors, context } = await open(env, { viewport: { width: 1440, height: 900 } });
  await page.locator('#section-lists').scrollIntoViewIfNeeded();
  await waitFor(async () => (await cardTexts(page, 'waiting')).join() === 'Antwort vom Vermieter', 'tasks from the cloud');
  const widths = await page.evaluate(() => ({
    grid: Math.round(document.getElementById('unifiedListsGrid').getBoundingClientRect().width),
    matrix: Math.round(document.querySelector('.matrix-panel').getBoundingClientRect().width),
    columns: new Set([...document.querySelectorAll('.matrix-area')].map(a => Math.round(a.getBoundingClientRect().left))).size
  }));
  assert.equal(widths.matrix, widths.grid, 'whole row');
  assert.equal(widths.columns, 2, 'two columns');
  await page.click('.matrix-area[data-area="ideas"] .matrix-area-add');
  await waitFor(() => matrixSheetOpen(page, 'matrix-task-sheet'), 'dialog');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'text', 'text focused');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'static', 'the desktop page is not held');
  await page.keyboard.type('Balkon bepflanzen');
  await page.keyboard.press('Enter');
  await waitFor(() => matrixTasks(env).some(t => t.text === 'Balkon bepflanzen' && t.area === 'ideas'), 'added with Enter');
  assert.deepEqual(await cardTexts(page, 'ideas'), ['Balkon bepflanzen']);
  // The card was rebuilt: the focus is back on its "+" (keyboard, VoiceOver)
  await waitFor(() => page.evaluate(() => document.activeElement.dataset.focus === 'add-ideas'), 'focus back on +');
  // Dragging the matrix onto the title of the last list puts it in that place
  await page.dragAndDrop('.matrix-panel .matrix-head', '.list-panel[data-list-id="custom-3"] h3');
  await waitFor(() => storedListOrder(env).join() === 'custom-1,custom-2,custom-3,matrix', 'dragged to the end');
  assert.deepEqual(await page.$$eval('#unifiedListsGrid > *', els => els.map(e => e.dataset.listId)), ['custom-1', 'custom-2', 'custom-3', 'matrix']);
  assert.deepEqual(errors, []);
  await context.close();
});

// ---------------------------------------------------------------- Home (js/home-ui.js)
// Home only summarises the other sections: the checks read their stored rows and their DOM
// after every tick, and the weather comes from a mocked Open-Meteo (no service is reached).

const FORECAST = {
  latitude: 48.2, longitude: 16.37, utc_offset_seconds: 7200, timezone: 'Europe/Vienna', timezone_abbreviation: 'CEST',
  current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', weather_code: 'wmo code', is_day: '' },
  current: { time: '2026-10-16T09:45', interval: 900, temperature_2m: 13.6, weather_code: 2, is_day: 1 },
  daily_units: { time: 'iso8601', sunrise: 'iso8601', sunset: 'iso8601', temperature_2m_max: '°C', temperature_2m_min: '°C' },
  daily: { time: ['2026-10-16'], sunrise: ['2026-10-16T07:21'], sunset: ['2026-10-16T18:12'], temperature_2m_max: [14.3], temperature_2m_min: [5.8] }
};
const PLACES = [
  { id: 1, name: 'Wien', latitude: 48.20849, longitude: 16.37208, country: 'Österreich', admin1: 'Wien', timezone: 'Europe/Vienna' },
  { id: 2, name: 'Graz', latitude: 47.06667, longitude: 15.45, country: 'Österreich', admin1: 'Steiermark', timezone: 'Europe/Vienna' }
];
const MATRIX_TASKS = [
  { id: 'a', text: 'Reifen wechseln', done: false, area: 'todo', due: '2026-10-10' },
  { id: 'b', text: 'Urlaub planen', done: false, area: 'todo' },
  { id: 'c', text: 'Antwort Vermieter', done: false, area: 'waiting', due: '2026-10-20' },
  { id: 'd', text: 'Schon erledigt', done: true, area: 'ideas' }
];
const homeRows = (page, card) => page.$$eval(`${card} .home-row-text`, els => els.map(e => e.textContent));
const homeSetting = (env) => (env.store.rows('settings').find(r => r.key === 'home') || {}).value || null;
const boardTask = (env, column, textOf) => env.store.rows('kanban_tasks')
  .filter(r => r.week_key === 'week-2026-W42' && r.column_name === column).map(r => JSON.parse(r.text)).find(t => t.text === textOf);

scenario('home on phones: the day at a glance from the other sections; ticks change the same entries', async (env) => {
  seedDemo(env.store);
  env.store.seed('settings', [{ user_id: USER, key: 'home', value: { name: 'Dali' } }]);
  env.store.seed('lists', [{ user_id: USER, name: 'matrix', icon: '📝', items: MATRIX_TASKS }]);
  env.store.seed('step_entries', [{ user_id: USER, date: '2026-10-16', steps: 8420, updated_at: new Date(NOW).toISOString() }]);
  const { page, errors, context } = await openPhone(env);

  // The page opens on Home: greeting with the name, the day as the calendar writes it
  assert.equal(await currentSection(page), 'home');
  assert.equal(await text(page, '.home-greeting-text'), 'Good morning, Dali.');
  assert.equal(await text(page, '.home-date-text'), 'Friday, 16 October');
  // The clock stands next to the date (moved here from above Today's Goals) and ticks
  assert.match(await text(page, '.home-clock'), /^10:00:\d\d$/);
  const clockBefore = await text(page, '.home-clock');
  await waitFor(async () => (await text(page, '.home-clock')) !== clockBefore, 'the clock ticks');
  assert.equal(await page.locator('#sidebarDateTime').count(), 0, 'no second clock above the goals');
  const edges = await page.evaluate(() => {
    const header = document.querySelector('.home-header').getBoundingClientRect();
    const date = document.querySelector('.home-date-text').getBoundingClientRect();
    const clock = document.querySelector('.home-clock').getBoundingClientRect();
    return { dateLeft: Math.round(date.left - header.left), clockRight: Math.round(header.right - clock.right), sameLine: Math.abs(date.top - clock.top) < 4 };
  });
  assert.ok(edges.clockRight <= 6 && edges.dateLeft <= 6 && edges.sameLine, `date left, clock flush right: ${JSON.stringify(edges)}`);
  assert.deepEqual(await page.$$eval('.home-card', els => els.map(e => e.className.replace('home-card glass-panel ', '').split(' ')[0])),
    ['home-weather', 'home-today', 'home-tasks', 'home-goals', 'home-matrix', 'home-steps', 'home-habits']);

  // Today: the entries of 16 October from the calendar, in its order
  assert.equal(await text(page, '.home-today .home-card-meta'), '2 events');
  assert.deepEqual(await page.$$eval('.home-today .home-event-text', els => els.map(e => e.textContent)), ['Team-Meeting 10:00', 'Paket abholen']);

  // Tasks: the overdue one from Wednesday first, today's by priority, then Saturday; counts
  assert.deepEqual(await page.$$eval('.home-tasks .home-task', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim())),
    ['Präsentation Entwurf !!! Overdue · Mi', 'Präsentation für Montag fertigstellen !!!', 'Laufen 5 km', 'Bauernmarkt Sa']);
  assert.equal(await text(page, '.home-tasks .home-card-meta'), '2 open today · 1 overdue');
  assert.equal(await text(page, '.home-tasks .home-card-foot'), '3 of 7 done this week');
  // Ticking here ticks the task on the week board (cloud and the Week section)
  await page.locator('.home-tasks .home-check[aria-label="Laufen 5 km"]').tap();
  await waitFor(() => (boardTask(env, 'FR', 'Laufen 5 km') || {}).done === true, 'done on the board in the cloud');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#weekKanban .kanban-card')].find(c => c.textContent.includes('Laufen 5 km')).classList.contains('done')), true, 'the Week section shows it done');
  await waitFor(async () => (await text(page, '.home-tasks .home-card-meta')) === '1 open today · 1 overdue · 1 done', 'counts follow');
  assert.deepEqual(await homeRows(page, '.home-tasks'), ['Präsentation Entwurf', 'Präsentation für Montag fertigstellen', 'Bauernmarkt', 'Laufen 5 km'], 'done tasks last');
  assert.equal(await page.getAttribute('.home-tasks .home-check[aria-label="Laufen 5 km"]', 'aria-checked'), 'true');

  // Goals: the first open goal is the focus; ticking it moves the focus on and reaches the goals list
  assert.equal(await text(page, '.home-goals .home-card-meta'), '2 of 5 done');
  assert.equal(await text(page, '.home-goals .home-row-focus .home-row-text'), 'Steuererklärung abschicken');
  // The focus row's circle and text stand in one column with the rows below; "FOCUS" starts
  // where the circles start (the visible circle is 11px inside its 44px button)
  const column = await page.evaluate(() => {
    const left = el => Math.round(el.getBoundingClientRect().left);
    const checks = [...document.querySelectorAll('.home-goals .home-check')].map(left);
    const texts = [...document.querySelectorAll('.home-goals .home-row-text')].map(left);
    const circle = document.querySelector('.home-goals .home-row-focus .home-check').getBoundingClientRect().left + 11;
    return { checks, texts, label: Math.round(document.querySelector('.home-focus-label').getBoundingClientRect().left - circle) };
  });
  assert.equal(new Set(column.checks).size, 1, `circles in one column: ${column.checks}`);
  assert.equal(new Set(column.texts).size, 1, `texts in one column: ${column.texts}`);
  assert.ok(Math.abs(column.label) <= 1, `FOCUS flush with the circles: ${column.label}px`);
  await page.locator('.home-goals .home-row-focus .home-check').tap();
  await waitFor(async () => (await text(page, '.home-goals .home-card-meta')) === '3 of 5 done', 'goal done');
  assert.equal(await text(page, '.home-goals .home-row-focus .home-row-text'), 'Mail an die Hausverwaltung wegen der Heizungsablesung im Stiegenhaus schreiben');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'goals-2026-9-16' && r.text === 'Steuererklärung abschicken' && r.done === true), 'goal done in the cloud');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#goalsList .focus-item')].find(i => i.textContent.includes('Steuererklärung')).classList.contains('done')), true, 'the goals list shows it done');
  // "+" adds a goal for today
  await page.locator('.home-goals .home-add').tap();
  await page.fill('#inputModalField', 'Zahnarzt anrufen');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'goals-2026-9-16' && r.text === 'Zahnarzt anrufen'), 'new goal uploaded');
  await waitFor(async () => (await text(page, '.home-goals .home-card-meta')) === '3 of 6 done', 'goal count follows');
  assert.ok((await page.$$eval('#goalsList .focus-text', els => els.map(e => e.textContent))).includes('Zahnarzt anrufen'), 'in the goals list');

  // Habits: a chip ticks today's check of the habit grid
  assert.equal(await text(page, '.home-habits .home-card-meta'), '1 of 4 done today');
  await page.locator('.home-habits .home-chip', { hasText: '10k Schritte' }).tap();
  await waitFor(async () => (await text(page, '.home-habits .home-card-meta')) === '2 of 4 done today', 'habit done');
  await waitFor(() => { const row = env.store.rows('settings').find(r => r.key === 'habitChecks'); return !!row && row.value['habitsData-2026-W42-h1-d4'] === true; }, 'check uploaded');
  assert.equal(await page.evaluate(() => {
    const row = [...document.querySelectorAll('#habits .habit-row')].find(r => r.textContent.includes('10k Schritte'));
    return row.querySelectorAll('.habit-check')[4].getAttribute('aria-checked');
  }), 'true', 'the habit grid shows Friday ticked');

  // Matrix: open tasks per area, the earliest due day first (overdue in red); a tile opens the area
  assert.equal(await text(page, '.home-matrix .home-card-meta'), '3 open');
  assert.deepEqual(await page.$$eval('.home-tile', els => els.map(e => [e.dataset.area, e.querySelector('.home-tile-count').textContent, (e.querySelector('.home-tile-text') || {}).textContent || null, (e.querySelector('.home-tile-due') || {}).textContent || null])),
    [['todo', '2', 'Reifen wechseln', 'Sa., 10. Okt.'], ['next', '0', null, null], ['waiting', '1', 'Antwort Vermieter', 'Di., 20. Okt.'], ['ideas', '0', null, null]]);
  assert.equal(await page.locator('.home-tile[data-area="todo"] .home-tile-task.is-overdue').count(), 1);
  await page.locator('.home-tile[data-area="todo"]').tap();
  await waitFor(() => matrixSheetOpen(page, 'matrix-area-sheet'), 'area sheet from Home');
  assert.equal(await text(page, '.matrix-area-sheet .matrix-count'), '2');
  await page.locator('.matrix-area-sheet .sheet-leading').tap();
  await waitFor(async () => (await matrixSheetOpen(page, 'matrix-area-sheet')) === 0, 'sheet closed');

  // Steps: today's entry against the day's target, the year against the goal (js/steps-core.js)
  await waitFor(async () => (await text(page, '.home-steps .home-steps-value')) === '8.420 steps', 'steps from the challenge');
  assert.equal(await text(page, '.home-steps .home-card-meta'), 'Target 23.312');
  assert.equal(await text(page, '.home-steps .home-steps-remaining'), '14.892 to go');
  assert.equal(await page.getAttribute('.home-steps .home-meter', 'aria-valuenow'), '36');
  assert.equal(await text(page, '.home-steps .home-card-foot'), 'Year 56 % · 2.231.831 of 4.018.405');

  // The buttons in the card heads: links of one width, "+" in one column, all flush right
  const heads = await page.evaluate(() => [...document.querySelectorAll('.home-card-head')].map(head => {
    const card = head.closest('.home-card').getBoundingClientRect();
    const link = head.querySelector('.home-link').getBoundingClientRect();
    const add = head.querySelector('.home-add');
    return { card: head.closest('.home-card').classList[2], width: Math.round(link.width), linkRight: Math.round(card.right - link.right), addRight: add ? Math.round(card.right - add.getBoundingClientRect().right) : null };
  }));
  assert.equal(heads.length, 6, 'six card heads');
  assert.equal(new Set(heads.map(x => x.width)).size, 1, `links of one width: ${JSON.stringify(heads)}`);
  assert.equal(new Set(heads.map(x => x.linkRight)).size, 1, 'links flush right');
  assert.equal(new Set(heads.filter(x => x.addRight !== null).map(x => x.addRight)).size, 1, '"+" in one column');
  assert.equal(await text(page, '.home-today .home-link'), 'Calendar', 'only the own label is read');
  assert.equal(await page.getAttribute('.home-tasks .home-link .home-link-sizer', 'aria-hidden'), 'true');

  // Every card leads to the section that owns its data
  await page.locator('.home-tasks .home-link').tap();
  await waitFor(async () => (await currentSection(page)) === 'week' && await sectionAtTop(page, 'week'), 'Week');
  await goToSection(page, 'home');
  await page.locator('.home-habits .home-link').tap();
  await waitFor(async () => (await currentSection(page)) === 'habits' && await sectionAtTop(page, 'habits'), 'Habits');
  await goToSection(page, 'home');
  await page.locator('.home-today .home-event', { hasText: 'Paket abholen' }).tap();
  await waitFor(() => editorOpen(page), 'the entry opens in the calendar editor');
  assert.equal(await page.inputValue('.event-editor .form-input'), 'Paket abholen');
  await page.locator('.event-editor .sheet-leading').tap();
  await waitFor(async () => (await editorOpen(page)) === 0, 'editor closed');

  // The name lives in the "⋯" menu (no pencil in the greeting); greeting and cloud follow
  await page.locator('#appBarMore').tap();
  await page.waitForSelector('.menu-layer.open');
  assert.equal(await page.evaluate(() => document.querySelector('.menu-layer.open .menu-item[data-action="name"]').innerText.replace(/\s+/g, ' ').trim()), 'Your Name… Dali');
  await menuAction(page, 'name');
  assert.equal(await page.inputValue('#inputModalField'), 'Dali');
  await page.fill('#inputModalField', 'Dalibor');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(async () => (await text(page, '.home-greeting-text')) === 'Good morning, Dalibor.', 'greeting follows');
  await waitFor(() => (homeSetting(env) || {}).name === 'Dalibor', 'name uploaded');

  // Touch targets and no horizontal overflow
  const small = await page.$$eval('#section-home button', els => els
    .filter(el => el.getClientRects().length > 0)
    .map(el => { const r = el.getBoundingClientRect(); return [el.className, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 44 || h < 44));
  assert.deepEqual(small, [], 'Home controls smaller than 44pt');
  assert.equal(await horizontalOverflow(page), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('home with empty data: quiet empty states, nothing invented; "+" adds where the data lives', async (env) => {
  const { page, errors, context } = await openPhone(env);
  assert.equal(await text(page, '.home-greeting-text'), 'Good morning.');
  assert.equal(await page.locator('.home-header button').count(), 0, 'nothing but the greeting in the header');
  await page.locator('#appBarMore').tap();
  await page.waitForSelector('.menu-layer.open');
  assert.equal(await page.evaluate(() => document.querySelector('.menu-layer.open .menu-item[data-action="name"]').innerText.replace(/\s+/g, ' ').trim()), 'Add Your Name…');
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator('.menu-layer.open').count()) === 0, 'menu closed');
  assert.equal(await text(page, '.home-today .home-card-meta'), 'No events');
  assert.equal(await text(page, '.home-today .home-empty'), 'No events today.');
  assert.equal(await text(page, '.home-tasks .home-empty'), 'No tasks this week yet.');
  assert.equal(await page.locator('.home-tasks .home-card-meta').count(), 0);
  assert.equal(await text(page, '.home-goals .home-empty'), 'What do you want to accomplish today?');
  assert.deepEqual(await page.$$eval('.home-tile .home-tile-count', els => els.map(e => e.textContent)), ['0', '0', '0', '0']);
  assert.equal(await text(page, '.home-steps .home-card-meta'), 'Set up the Step Challenge in Health to see today’s steps here.');
  assert.equal(await page.locator('.home-steps .home-steps-value').count(), 0, 'no number without a challenge');
  assert.equal(await page.locator('.home-habits').count(), 0, 'no habits: no card');
  assert.equal(await page.locator('.home-weather.is-empty .home-weather-set').count(), 1, 'no place: no weather');

  // "+" on Today opens the calendar editor for today
  await page.locator('.home-today .home-add').tap();
  await waitFor(() => editorOpen(page), 'editor');
  assert.equal(await page.inputValue('.event-editor input[type="date"]'), '2026-10-16');
  await page.locator('.event-editor .sheet-leading').tap();
  await waitFor(async () => (await editorOpen(page)) === 0, 'editor closed');

  // "+" on Tasks adds to today's column of the week board
  await page.locator('.home-tasks .home-add').tap();
  await page.fill('#inputModalField', 'Blumen gießen');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(() => !!boardTask(env, 'FR', 'Blumen gießen'), 'task uploaded to Friday');
  assert.deepEqual(await homeRows(page, '.home-tasks'), ['Blumen gießen']);
  assert.equal(await text(page, '.home-tasks .home-card-meta'), '1 open today');
  assert.ok((await page.$$eval('#weekKanban .kanban-column.today .kanban-card-text', els => els.map(e => e.textContent))).includes('Blumen gießen'), 'on the board under today');

  // The Steps link leads to the Health section with the challenge card
  await page.locator('.home-steps .home-link').tap();
  await waitFor(async () => (await currentSection(page)) === 'health' && await sectionAtTop(page, 'health'), 'Health');
  assert.deepEqual(errors, []);

  // Evening: the greeting follows the clock
  const evening = await openPhone(env, { now: Date.parse('2026-10-16T19:30:00+02:00') });
  assert.equal(await text(evening.page, '.home-greeting-text'), 'Good evening.');
  assert.deepEqual(evening.errors, []);
  await context.close();
  await evening.context.close();
});

scenario('home: weather for a chosen place from Open-Meteo - cached while offline, honest when it fails', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  const calls = [];
  let fail = false;
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, route => {
    calls.push(route.request().url());
    if (fail) return route.fulfill({ status: 500, contentType: 'text/plain', body: 'error' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORECAST) });
  });
  await page.route(/geocoding-api\.open-meteo\.com/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: PLACES }) }));

  // No place yet: no request, a button to choose one; the sheet searches by name
  assert.equal(await page.locator('.home-weather.is-empty').count(), 1);
  await page.locator('.home-weather-set').tap();
  await waitFor(() => page.locator('.home-location-sheet[open]').count(), 'location sheet');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'place', 'search field focused');
  await page.keyboard.type('Wie');
  await waitFor(() => page.locator('.home-location-sheet .home-place').count(), 'results');
  assert.deepEqual(await page.$$eval('.home-location-sheet .home-place', els => els.map(e => e.textContent)), ['Wien, Österreich', 'Graz, Steiermark, Österreich']);
  await page.locator('.home-location-sheet .home-place').first().tap();
  await waitFor(async () => (await page.locator('.home-location-sheet[open]').count()) === 0, 'sheet closed');
  await waitFor(() => page.locator('.home-weather-temp').count(), 'weather shown');
  assert.equal(await text(page, '.home-weather-temp'), '14°');
  assert.equal(await text(page, '.home-weather-text'), 'Partly cloudy');
  assert.deepEqual(await page.$$eval('.home-sun dd', els => els.map(e => e.textContent)), ['07:21', '18:12']);
  // Visible text without the words for screen readers ("High 14° Low 6°")
  assert.equal(await page.evaluate(() => [...document.querySelector('.home-weather-range').childNodes]
    .filter(n => !(n.nodeType === 1 && n.classList.contains('visually-hidden'))).map(n => n.textContent).join('')), 'H:14° L:6°', "the day's high and low");
  assert.equal(await text(page, '.home-weather-place'), 'Wien');
  assert.equal(await page.locator('.home-weather-note').count(), 0, 'fresh weather carries no note');
  // One request, with nothing but the coordinates and the documented parameters
  assert.equal(calls.length, 1);
  const url = new URL(calls[0]);
  assert.deepEqual(['latitude', 'longitude', 'current', 'daily', 'timezone', 'forecast_days'].map(k => url.searchParams.get(k)),
    ['48.2085', '16.3721', 'temperature_2m,weather_code,is_day', 'sunrise,sunset,temperature_2m_max,temperature_2m_min', 'auto', '1']);
  assert.ok(!calls[0].includes('Wien'), 'no place name in the request');
  await waitFor(() => { const s = homeSetting(env); return !!s && !!s.location && s.location.name === 'Wien' && s.location.latitude === 48.2085; }, 'place stored in the settings');

  // Reload: the cached answer shows at once without a new request (it is still fresh)
  await page.reload();
  await page.waitForSelector('#stepChallenge:not([hidden])');
  await waitFor(() => page.locator('.home-weather-temp').count(), 'weather after reload');
  await settle(page, 500);
  assert.equal(calls.length, 1, 'no second request while fresh');

  // Offline: the last answer stays, marked with its time
  await context.setOffline(true);
  await page.evaluate(() => window.Weather.refresh(true));
  await waitFor(async () => /^Offline · from \d\d:\d\d$/.test(await text(page, '.home-weather-note')), 'offline note');
  assert.equal(await text(page, '.home-weather-temp'), '14°');
  await context.setOffline(false);
  await waitFor(() => calls.length === 2, 'fetched again when back online');
  await waitFor(async () => (await page.locator('.home-weather-note').count()) === 0, 'fresh again');

  // The service fails: the last answer stays, marked; a new place without one says so and offers a retry
  fail = true;
  await page.evaluate(() => window.Weather.refresh(true));
  await waitFor(async () => /^Could not update · from \d\d:\d\d$/.test(await text(page, '.home-weather-note')), 'failure note');
  assert.equal(await text(page, '.home-weather-temp'), '14°', 'the last answer stays');
  await page.locator('.home-weather-place').tap();
  await waitFor(() => page.locator('.home-location-sheet[open]').count(), 'sheet again');
  assert.equal(await text(page, '.home-location-sheet .home-place-current'), 'Current: Wien');
  await page.keyboard.type('Graz');
  await waitFor(() => page.locator('.home-location-sheet .home-place').count(), 'results again');
  await page.locator('.home-location-sheet .home-place', { hasText: 'Graz' }).tap();
  await waitFor(() => page.locator('.home-weather.is-pending .home-weather-retry').count(), 'no weather for the new place yet');
  assert.equal(await text(page, '.home-weather.is-pending .home-weather-text'), 'The weather could not be loaded.');
  assert.equal(await page.locator('.home-weather-temp').count(), 0, 'nothing invented');
  fail = false;
  await page.locator('.home-weather-retry').tap();
  await waitFor(() => page.locator('.home-weather-temp').count(), 'weather after the retry');
  assert.equal(await text(page, '.home-weather-place'), 'Graz');

  // Removing the place: the empty card again, nothing is fetched any more
  await page.locator('.home-weather-place').tap();
  await waitFor(() => page.locator('.home-location-sheet[open]').count(), 'sheet to remove');
  await page.locator('.home-location-sheet .form-row-button.destructive').tap();
  await waitFor(() => page.locator('.home-weather.is-empty').count(), 'empty again');
  await waitFor(() => { const s = homeSetting(env); return !!s && s.location === null; }, 'place removed in the settings');
  // The browser logs the two failed answers itself; nothing else may fail
  assert.deepEqual(errors.filter(e => !/status of 500/.test(e)), []);
  await context.close();
});

scenario('home follows changes made in the sections, on another device and across a reload', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  // A task ticked on the week board
  await goToSection(page, 'week');
  // Promptly, through the change announcement of db.set - not only once the cloud echoes the
  // change back (the realtime refresh waits out a 5 s cooldown after a local change)
  await page.locator('#weekKanban .kanban-card', { hasText: 'Laufen 5 km' }).locator('.task-checkbox').tap();
  await waitFor(async () => (await text(page, '.home-tasks .home-card-meta')) === '1 open today · 1 overdue · 1 done', 'Home follows the board', 2000);
  // A goal added in the goals section
  await goToSection(page, 'today');
  await page.locator('.goals-container > .btn').tap();
  await page.fill('#inputModalField', 'Fenster putzen');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(async () => (await text(page, '.home-goals .home-card-meta')) === '2 of 6 done', 'Home follows the goals', 2000);
  // Another device ticks a habit: the realtime update reaches Home
  const other = await openPhone(env);
  await other.page.evaluate(() => {
    const row = [...document.querySelectorAll('#habits .habit-row')].find(r => r.textContent.includes('Lesen'));
    row.querySelectorAll('.habit-check')[4].click();
  });
  await waitFor(async () => (await text(page, '.home-habits .home-card-meta')) === '2 of 4 done today', 'habit from the other device', 12000);
  await other.context.close();
  // Reload: the same picture
  await page.reload();
  await page.waitForSelector('#stepChallenge:not([hidden])');
  await waitFor(async () => (await text(page, '.home-tasks .home-card-meta')) === '1 open today · 1 overdue · 1 done', 'tasks after the reload');
  assert.equal(await text(page, '.home-goals .home-card-meta'), '2 of 6 done');
  assert.equal(await text(page, '.home-habits .home-card-meta'), '2 of 4 done today');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('home on the desktop: first on the page, a grid of cards, links scroll to the sections, keyboard ticks', async (env) => {
  seedDemo(env.store, { steps: false });
  env.store.seed('settings', [{ user_id: USER, key: 'home', value: { name: 'Dali' } }]);
  const { page, errors, context } = await open(env, { viewport: { width: 1440, height: 900 } });
  assert.equal(await page.evaluate(() => document.querySelector('.page-section').id), 'section-home');
  assert.equal(await text(page, '.home-greeting-text'), 'Good morning, Dali.');
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  const tops = await page.evaluate(() => {
    const top = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
    return { weather: top('.home-weather'), today: top('.home-today'), tasks: top('.home-tasks'), goals: top('.home-goals'), matrix: top('.home-matrix'), steps: top('.home-steps'), habits: top('.home-habits') };
  });
  assert.equal(tops.today, tops.tasks, 'Today and Tasks side by side');
  assert.ok(tops.goals === tops.matrix && tops.matrix === tops.steps, 'Goals, Matrix and Steps in one row');
  assert.ok(tops.weather < tops.today && tops.today < tops.goals && tops.goals < tops.habits, 'rows in order');
  assert.ok(tops.goals < 900, 'the first two rows of cards fit a desktop screen');
  // Card heads on the desktop too: links of one width, flush right in their card
  const deskHeads = await page.evaluate(() => [...document.querySelectorAll('.home-card-head')].map(head => {
    const card = head.closest('.home-card').getBoundingClientRect();
    const link = head.querySelector('.home-link').getBoundingClientRect();
    return [Math.round(link.width), Math.round(card.right - link.right)];
  }));
  assert.equal(new Set(deskHeads.map(x => x[0])).size, 1, `links of one width: ${JSON.stringify(deskHeads)}`);
  assert.equal(new Set(deskHeads.map(x => x[1])).size, 1, 'links flush right');
  assert.equal(await horizontalOverflow(page), 0);

  // Keyboard: Space ticks the focused task, the focus stays on it after the re-render, and
  // the focus timer does not start
  await page.focus('.home-tasks .home-check[aria-label="Laufen 5 km"]');
  await page.keyboard.press('Space');
  await waitFor(() => (boardTask(env, 'FR', 'Laufen 5 km') || {}).done === true, 'ticked with the keyboard');
  await waitFor(() => page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Laufen 5 km' && document.activeElement.getAttribute('aria-checked') === 'true'), 'focus kept on the same task');
  assert.equal(await text(page, '#pomoStart'), '▶ Start', 'the focus timer did not start');

  // The name is changed from the floating menu on the desktop
  await page.click('.fab-trigger');
  await page.click('.fab-item[title="Your Name"]');
  assert.equal(await page.inputValue('#inputModalField'), 'Dali');
  await page.fill('#inputModalField', 'Dalibor');
  await page.click('#inputModalSubmit');
  await waitFor(async () => (await text(page, '.home-greeting-text')) === 'Good morning, Dalibor.', 'greeting follows on the desktop');

  // A link scrolls to the section
  await page.click('.home-tasks .home-link');
  await waitFor(() => page.evaluate(() => Math.abs(document.getElementById('section-week').getBoundingClientRect().top) < 40), 'scrolled to Week');
  await page.click('.home-matrix .home-link');
  await waitFor(() => page.evaluate(() => Math.abs(document.getElementById('section-lists').getBoundingClientRect().top) < 40), 'scrolled to Lists');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('desktop with mouse: no section bar, no touch buttons, hover effects unchanged', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, { viewport: { width: 1440, height: 900 } });
  assert.equal(await touchLayoutOn(page), false);
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  assert.equal(await displayed(page, '.app-bar-actions'), false);
  assert.equal(await displayed(page, '#quickCapture'), true, 'desktop quick add button');
  assert.equal(await page.locator('.item-more-btn').first().evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await displayed(page, '#calendarAgenda'), false);
  for (const sel of ['.dashboard-main-layout', '.week-overview-section', '.gym-hub-section', '.lists-section', '.calendar-section', '.habits-section', '.weekly-review-section']) {
    assert.equal(await displayed(page, sel), true, `${sel} visible`);
  }
  // The order stays: focus timer and goals side by side at the top, then the week, the calendar
  assert.deepEqual(await pageOrder(page), { screen: DESKTOP_ORDER, dom: DESKTOP_ORDER });
  // Hover styles still apply with a mouse
  const addGoal = page.locator('.goals-container > .btn');
  const before = await addGoal.evaluate(el => getComputedStyle(el).backgroundColor);
  await addGoal.hover();
  await settle(page, 300);
  const after = await addGoal.evaluate(el => getComputedStyle(el).backgroundColor);
  assert.notEqual(after, before, 'button hover effect');
  assert.equal(after, 'rgb(99, 102, 241)');
  // Hidden delete button appears on hover, as before
  const item = page.locator('.focus-item', { hasText: 'Steuererklärung' });
  await item.hover();
  await settle(page, 300);
  assert.equal(await item.locator('.focus-delete').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.deepEqual(errors, []);
  await context.close();
});

// ---------------------------------------------------------------- runner

(async () => {
  const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
  const env = await createEnv();
  let failed = 0;
  let ran = 0;
  try {
    for (const s of scenarios) {
      if (filter && !filter.test(s.name)) continue;
      ran++;
      // A new store, not a reset of the old one: a request that a page of the previous scenario
      // sent just before it closed is still inside the store's latency and would otherwise
      // land in this scenario's data
      env.store = new CloudStore();
      const started = Date.now();
      try {
        await s.fn(env);
        console.log(`ok   ${s.name} (${Date.now() - started} ms)`);
      } catch (e) {
        failed++;
        console.log(`FAIL ${s.name}\n     ${String(e && e.stack || e).split('\n').filter((l, i, a) => i < 8 || i >= a.length - 4).join('\n     ')}`);
      } finally {
        // A failed scenario must not leave a device running that writes into the next one
        for (const ctx of openContexts) await ctx.close().catch(() => { });
        openContexts.clear();
      }
    }
  } finally {
    await env.browser.close();
    env.server.close();
  }
  console.log(`\n${ran - failed}/${ran} scenarios passed`);
  process.exit(failed ? 1 : 0);
})();
