/*
 * End-to-end tests in Chromium against the in-memory Supabase mock (no real
 * Supabase project is touched). Run: node tests/e2e/run.js [filter]
 * Requires Playwright (global or local install) and its Chromium build.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEnv, openDashboard, settle } = require('./harness');
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

scenario('mobile: iPhone layout without horizontal overflow and with usable touch targets', async (env) => {
  const { page, errors, context } = await open(env, {
    viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark'
  });
  // Phones show one section at a time: the Step Challenge is in the Health tab
  await page.locator('.mobile-tab[data-tab="health"]').tap();
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

  // Calendar quick capture (Q) + kanban card
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); // shortcuts ignore inputs
  await page.keyboard.press('q');
  await waitFor(() => page.locator('#inputModal.active').count(), 'quick capture dialog');
  assert.equal(await page.inputValue('#inputModalField'), '', 'the shortcut key is not typed into the field');
  await modal('Call dentist');
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-16' && r.text === 'Call dentist'), 'quick capture uploaded');
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

const displayed = (page, selector) => page.evaluate(sel => {
  const el = document.querySelector(sel);
  return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
}, selector);

async function tab(page, name) {
  await page.locator(`.mobile-tab[data-tab="${name}"]`).tap();
  await settle(page, 150);
}

async function sheetAction(page, id) {
  await page.locator(`.action-sheet-layer.open .action-sheet-btn[data-action="${id}"]`).tap();
  await settle(page, 300);
}

const tabsOn = (page) => page.evaluate(() => document.documentElement.classList.contains('tabs-on'));

const horizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

scenario('tabs: a phone shows one section at a time and remembers tab and position', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  assert.equal(await tabsOn(page), true);
  assert.equal(await page.getAttribute('html', 'data-tab'), 'today');
  const sections = {
    today: '.dashboard-main-layout', week: '.week-overview-section', health: '.gym-hub-section',
    habits: '.habits-section', lists: '.lists-section'
  };
  for (const name of Object.keys(sections)) {
    await tab(page, name);
    for (const [other, selector] of Object.entries(sections)) {
      assert.equal(await displayed(page, selector), other === name, `${selector} on tab ${name}`);
    }
    assert.equal(await page.getAttribute(`.mobile-tab[data-tab="${name}"]`, 'aria-current'), 'page');
    assert.equal(await horizontalOverflow(page), 0, `horizontal overflow on tab ${name}`);
    // Quick Add puts tasks on today's calendar: only offered on Today and Week
    assert.equal(await displayed(page, '#quickCapture'), name === 'today' || name === 'week', `quick add on ${name}`);
  }
  await tab(page, 'week');
  assert.equal(await displayed(page, '.calendar-section'), true, 'calendar is on the week tab');
  await tab(page, 'habits');
  assert.equal(await displayed(page, '.weekly-review-section'), true, 'weekly review is on the habits tab');

  // Each tab keeps its own scroll position; tapping the active tab goes back to the top
  await tab(page, 'week');
  await page.evaluate(() => window.scrollTo(0, 600));
  await settle(page, 200);
  await tab(page, 'lists');
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'lists start at the top');
  await tab(page, 'week');
  assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 600, 'week tab scroll position restored');
  await tab(page, 'week');
  await waitFor(() => page.evaluate(() => window.scrollY < 2), 'active tab tap scrolls to top');

  // The tab survives a reload
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#goalsList') !== null);
  assert.equal(await page.getAttribute('html', 'data-tab'), 'week');
  assert.equal(await displayed(page, '.week-overview-section'), true);

  // Touch targets of the main controls are at least 44px (Apple HIG)
  const small = await page.evaluate(() => [...document.querySelectorAll('.mobile-tab, .week-nav-panel .btn, .calendar-header .btn, .kanban-add-btn, #fabTrigger')]
    .filter(el => el.getClientRects().length > 0) // rendered (not inside another tab)
    .map(el => { const r = el.getBoundingClientRect(); return [el.className || el.id, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 40 || h < 40));
  assert.deepEqual(small, [], 'controls smaller than 40px');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('touch: sheets replace hover, double-click, right-click and drag & drop', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  const goal = page.locator('.focus-item', { hasText: 'Steuererklärung' });
  // Hover-only delete buttons were invisible but tappable; on touch they are gone
  assert.equal(await goal.locator('.focus-delete').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await goal.locator('.item-more-btn').isVisible(), true);

  // Urgency via the sheet (was right-click only)
  await goal.locator('.item-more-btn').tap();
  assert.equal(await page.getAttribute('.action-sheet', 'role'), 'dialog');
  await sheetAction(page, 'urgency');
  await sheetAction(page, 'priority-high');
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Steuererklärung abschicken' && r.urgency === 'high'), 'urgency uploaded');
  assert.equal(await page.locator('.focus-item.urgency-high', { hasText: 'Steuererklärung' }).count(), 1);

  // Tapping the text ticks a goal
  await page.locator('.focus-item .focus-text', { hasText: 'Wocheneinkauf' }).tap();
  await waitFor(() => env.store.rows('goals').some(r => r.text === 'Wocheneinkauf planen' && r.done === true), 'goal ticked by tapping its text');

  // Escape and Cancel close a sheet without doing anything; focus returns to the button
  await goal.locator('.item-more-btn').tap();
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator('.action-sheet-layer').count()) === 0, 'sheet closed by Escape');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('item-more-btn')), true, 'focus back on the ⋯ button');

  // Move a weekly task to another day (was drag & drop only)
  await tab(page, 'week');
  await page.locator('.kanban-card', { hasText: 'Laufen 5 km' }).locator('.item-more-btn').tap();
  await sheetAction(page, 'move');
  await sheetAction(page, 'day-SA');
  await waitFor(() => env.store.rows('kanban_tasks').some(r => r.column_name === 'SA' && r.text.includes('Laufen 5 km')), 'task moved to Saturday in the cloud');
  assert.match(await page.locator('.kanban-column').nth(5).innerText(), /Laufen 5 km/);

  // Edit a calendar entry from the day agenda (was double-click only)
  await page.locator('.day-cell[data-date="cal-2026-9-20"]').tap();
  await page.locator('#calendarAgenda .task-item', { hasText: 'Geburtstag Mama' }).locator('.item-more-btn').tap();
  await sheetAction(page, 'edit');
  await page.fill('#inputModalField', 'Geburtstag Mama – Kuchen mitbringen');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-20' && r.text === 'Geburtstag Mama – Kuchen mitbringen'), 'calendar entry edited');

  // Move a list item to another list (was drag & drop only)
  await tab(page, 'lists');
  await page.locator('.simple-list-item', { hasText: 'Steuerunterlagen sortieren' }).locator('.item-more-btn').tap();
  await sheetAction(page, 'move');
  await sheetAction(page, 'list-custom-2');
  await waitFor(() => {
    const lists = Object.fromEntries(env.store.rows('lists').map(r => [r.name, r.items.map(i => i.text)]));
    return lists['custom-2'] && lists['custom-2'].includes('Steuerunterlagen sortieren') && !lists['custom-3'].includes('Steuerunterlagen sortieren');
  }, 'list item moved to another list in the cloud');

  // Delete asks for confirmation where the desktop does (habits, lists)
  await tab(page, 'habits');
  await page.locator('.habit-name', { hasText: 'Lesen' }).locator('.item-more-btn').tap();
  await sheetAction(page, 'delete');
  assert.equal(await page.locator('#confirmModal.active').count(), 1, 'confirmation shown');
  await page.locator('#confirmModalCancel').tap();
  assert.equal(await page.locator('.habit-name', { hasText: 'Lesen' }).count(), 1, 'habit kept after cancel');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('foldable: unfolding and folding keeps tab, reading position and open sheets', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, { viewport: DUO_FOLDED, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await tab(page, 'week');
  const saturday = '.kanban-column:nth-child(6)';
  const topOf = () => page.evaluate(sel => Math.round(document.querySelector(sel).getBoundingClientRect().top), saturday);
  await page.evaluate(sel => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80); }, saturday);
  await settle(page, 300);
  assert.equal(await topOf(), 80);

  // Unfold: wider layout (days in columns), same tab, Saturday stays where it was on screen
  await page.setViewportSize(DUO_UNFOLDED);
  await settle(page, 400);
  assert.equal(await page.getAttribute('html', 'data-tab'), 'week');
  assert.equal(await tabsOn(page), true);
  assert.ok(Math.abs((await topOf()) - 80) <= 4, `Saturday moved to ${await topOf()}px after unfolding`);
  assert.equal(await horizontalOverflow(page), 0);
  const columns = await page.evaluate(() => new Set([...document.querySelectorAll('.kanban-column')].map(c => Math.round(c.getBoundingClientRect().left))).size);
  assert.ok(columns >= 3, `unfolded week uses ${columns} columns`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.calendar-section-content .glass-panel')).display), 'grid', 'calendar and agenda side by side');

  // A sheet opened while unfolded is still fully on screen after folding
  await page.locator('.kanban-card', { hasText: 'Bauernmarkt' }).locator('.item-more-btn').tap();
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 400);
  const box = await page.locator('.action-sheet').boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= DUO_FOLDED.width + 1 && box.y + box.height <= DUO_FOLDED.height + 1, `sheet off screen: ${JSON.stringify(box)}`);
  await page.locator('.action-sheet-cancel').tap();

  // iPad rotated to landscape (1180px): the desktop layout with every section, then back
  await page.setViewportSize({ width: 1180, height: 820 });
  await settle(page, 300);
  assert.equal(await tabsOn(page), false);
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  for (const sel of ['.dashboard-main-layout', '.week-overview-section', '.gym-hub-section', '.lists-section', '.calendar-section', '.habits-section']) {
    assert.equal(await displayed(page, sel), true, `${sel} visible on the wide layout`);
  }
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 300);
  assert.equal(await tabsOn(page), true);
  assert.equal(await page.getAttribute('html', 'data-tab'), 'week');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('calendar on phones: month grid selects a day, the agenda lists and adds entries', async (env) => {
  seedDemo(env.store, { steps: false });
  // 31 October: stepping a month forward must land in November (setMonth on the 31st skipped it)
  const { page, errors, context } = await openPhone(env, { now: Date.parse('2026-10-31T10:00:00+01:00') });
  await tab(page, 'week');
  assert.match(await text(page, '#calendarAgenda .calendar-agenda-title'), /Samstag, 31\. Oktober/);
  assert.equal(await page.getAttribute('.day-cell[data-date="cal-2026-9-31"]', 'aria-pressed'), 'true');
  assert.equal(await page.locator('.day-cell.has-tasks').count(), 4, 'days with entries are marked');

  await page.locator('.day-cell[data-date="cal-2026-9-14"]').tap();
  assert.match(await text(page, '#calendarAgenda'), /Mittwoch, 14\. Oktober[\s\S]*Zahnarzt 14:30/);

  await page.locator('#calendarAgenda .calendar-agenda-add').tap();
  await page.fill('#inputModalField', 'Rezept abholen');
  await page.locator('#inputModalSubmit').tap();
  await waitFor(() => env.store.rows('goals').some(r => r.date === 'cal-2026-9-14' && r.text === 'Rezept abholen'), 'entry added for the selected day');
  assert.match(await text(page, '#calendarAgenda'), /Rezept abholen/);

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

scenario('desktop with mouse: no tab bar, no touch buttons, hover effects unchanged', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await open(env, { viewport: { width: 1440, height: 900 } });
  assert.equal(await tabsOn(page), false);
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  assert.equal(await page.locator('.item-more-btn').first().evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await displayed(page, '#calendarAgenda'), false);
  for (const sel of ['.dashboard-main-layout', '.week-overview-section', '.gym-hub-section', '.lists-section', '.calendar-section', '.habits-section', '.weekly-review-section']) {
    assert.equal(await displayed(page, sel), true, `${sel} visible`);
  }
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
      env.store.reset();
      const started = Date.now();
      try {
        await s.fn(env);
        console.log(`ok   ${s.name} (${Date.now() - started} ms)`);
      } catch (e) {
        failed++;
        console.log(`FAIL ${s.name}\n     ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n     ')}`);
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
