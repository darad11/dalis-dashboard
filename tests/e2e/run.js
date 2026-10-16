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

  // Every section is displayed, in the order Today, Week, Health, Habits, Lists
  const sections = await page.evaluate(() => window.MobileUI.SECTIONS.map(n => {
    const el = document.getElementById('section-' + n);
    return [n, getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, Math.round(el.getBoundingClientRect().top + window.scrollY)];
  }));
  assert.deepEqual(sections.map(s => s[0]), ['today', 'week', 'health', 'habits', 'lists']);
  sections.forEach(([name, shown]) => assert.ok(shown, `${name} displayed`));
  for (let i = 1; i < sections.length; i++) assert.ok(sections[i][2] > sections[i - 1][2], `${sections[i][0]} below ${sections[i - 1][0]}`);
  assert.ok(await page.evaluate(() => !!document.querySelector('#section-week .calendar-section') &&
    !!document.querySelector('#section-habits .weekly-review-section') && !!document.querySelector('#section-lists .lists-section')),
  'calendar in Week, weekly review in Habits, lists last');
  assert.equal(await currentSection(page), 'today');
  assert.equal(await page.getAttribute('.mobile-tab[data-section="today"]', 'aria-current'), 'location');

  // Scrolling through the page marks one section after the other, without tapping
  const seen = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 250) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await settle(page, 60);
    const name = await currentSection(page);
    if (seen[seen.length - 1] !== name) seen.push(name);
  }
  assert.deepEqual(seen, ['today', 'week', 'health', 'habits', 'lists'], 'marker follows the scroll position');
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitFor(async () => (await currentSection(page)) === 'today', 'back to today at the top');

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
    ['dark-mode', 'focus-mode', 'sync', 'sign-out']);
  assert.equal(await page.getAttribute('.menu', 'role'), 'menu');
  await menuAction(page, 'dark-mode');
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark')), true, 'dark mode from the menu');
  assert.equal(await page.getAttribute('meta[name="theme-color"]', 'content'), '#000000');

  // Touch targets of the main controls: at least 44 x 44 pt (HIG)
  const small = await page.evaluate(() => [...document.querySelectorAll(
    '.mobile-tab, .app-bar-btn, .week-nav-panel .btn, .calendar-header .btn, .kanban-add-btn, .item-more-btn, .habit-check, .day-cell:not(.empty), .pomo-mode-btn, .goals-container .btn')]
    .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
    .map(el => { const r = el.getBoundingClientRect(); return [el.className || el.id, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 44 || h < 36));
  assert.deepEqual(small, [], 'controls smaller than 44pt');
  assert.deepEqual(errors, []);
  await context.close();
});

scenario('scroll: a short last section is marked at the end of the page; a chosen one stays marked', async (env) => {
  seedDemo(env.store, { steps: false });
  const { page, errors, context } = await openPhone(env);
  // No lists: the Lists section is too short to reach the reading line at the end of the page
  await page.evaluate(() => { db.set('customListsMeta', [], true); renderUnifiedLists(); });
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
  await finger.down(tabs.today);
  await waitFor(async () => (await lensBox(page)).lift > 0.99, 'lens lifted');
  const lifted = await lensBox(page);
  assert.ok(lifted.barWidth > finger.geo.width + 10, `bar swells while touched (${lifted.barWidth})`);
  assert.ok(lifted.barTop - lifted.top > 2 && lifted.bottom - lifted.barBottom > 2, 'lens reaches past the bar');
  assert.ok(Math.abs(lifted.center - lifted.tabs.today) < 1, 'lens over the touched item');
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
  assert.deepEqual(parts.links, ['today', 'week', 'health', 'habits', 'lists'], 'the five links stay the only links');
  assert.equal(parts.pill, '0', 'resting pill hidden under the lens');
  assert.notEqual(parts.hole, 'none', 'the real items get a hole under the lens');

  // Drag to Habits and hold: the lens follows the finger, nothing is selected yet
  await finger.move(tabs.today, tabs.habits, 12);
  const candidate = () => page.evaluate(() => {
    const t = document.querySelector('.tabbar-lens-core .tabbar-lens-tab.candidate');
    return t && t.dataset.section;
  });
  await waitFor(async () => (await candidate()) === 'habits' && Math.abs((await lensBox(page)).center - tabs.habits) < 1.5,
    'lens over habits, under the finger');
  assert.equal(await currentSection(page), 'today');
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

  // A tap at the rounded end of the bar selects the nearest section
  await page.touchscreen.tap(finger.geo.left + 4, finger.geo.y);
  await waitFor(async () => (await currentSection(page)) === 'today' && await sectionAtTop(page, 'today'), 'end of the bar selects today');
  await waitFor(async () => !(await lensUp(page)), 'lens dropped after the tap');

  // Keyboard: the links select without a lens
  await page.focus('.mobile-tab[data-section="week"]');
  await page.keyboard.press('Enter');
  await waitFor(async () => (await currentSection(page)) === 'week', 'Enter selects week');
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
  const saturday = '.kanban-column:nth-child(6)';
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
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.calendar-section-content .glass-panel')).display), 'grid', 'calendar and agenda side by side');

  // A menu opened while unfolded is still fully on screen after folding
  await page.locator('.kanban-card', { hasText: 'Bauernmarkt' }).locator('.item-more-btn').tap();
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 400);
  const box = await page.locator('.menu').boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= DUO_FOLDED.width + 1 && box.y + box.height <= DUO_FOLDED.height + 1, `menu off screen: ${JSON.stringify(box)}`);
  await page.keyboard.press('Escape');

  // iPad rotated to landscape (1180px): the desktop layout, then back
  await page.setViewportSize({ width: 1180, height: 820 });
  await settle(page, 300);
  assert.equal(await touchLayoutOn(page), false);
  assert.equal(await displayed(page, '#mobileTabbar'), false);
  assert.equal(await displayed(page, '.app-bar-actions'), false);
  for (const sel of ['.dashboard-main-layout', '.week-overview-section', '.gym-hub-section', '.lists-section', '.calendar-section', '.habits-section']) {
    assert.equal(await displayed(page, sel), true, `${sel} visible on the wide layout`);
  }
  await page.setViewportSize(DUO_FOLDED);
  await settle(page, 300);
  assert.equal(await touchLayoutOn(page), true);
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
