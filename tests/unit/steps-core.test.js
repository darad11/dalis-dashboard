// Run: node --test tests/unit
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/steps-core.js');

// Starting values from the handover (last calculation on 15 Oct 2026)
const CFG_2026 = {
  goal: 4018405,
  baselineSteps: 2223411,
  baselineDate: '2026-10-15',
  previousYearTotal: 4018404
};

const entry = (steps, extra) => Object.assign({ steps, updatedAt: 1 }, extra || {});

test('baseline and goal: nothing logged yet on the first challenge day', () => {
  const s = Core.computeStats(CFG_2026, {}, '2026-10-16');
  assert.equal(s.ytd, 2223411);
  assert.equal(s.goal, 4018405);
  assert.equal(s.remaining, 1794994);
  assert.equal(Math.round(s.progressPercent * 100) / 100, 55.33);
  // 16 Oct .. 31 Dec = 77 calendar days, today still counts because it is not logged
  assert.equal(s.remainingDays, 77);
  assert.equal(s.requiredDailyAverage, Math.ceil(1794994 / 77)); // 23.312
  assert.equal(s.requiredDailyAverage, 23312);
  assert.equal(s.todayTarget, 23312);
  assert.equal(s.todayLogged, false);
  assert.equal(s.status, 'start');
  assert.deepEqual(s.missingDays, []);
  assert.equal(s.recordDiff, 2223411 - 4018404);
});

test('adding today\'s value updates total, remaining and the per-day requirement', () => {
  const s = Core.computeStats(CFG_2026, { '2026-10-16': entry(12000) }, '2026-10-16');
  assert.equal(s.ytd, 2223411 + 12000);
  assert.equal(s.remaining, 1794994 - 12000);
  assert.equal(s.todayLogged, true);
  assert.equal(s.todaySteps, 12000);
  // Today is logged: the requirement now covers the 76 days after today
  assert.equal(s.remainingDays, 76);
  assert.equal(s.requiredDailyAverage, Math.ceil((1794994 - 12000) / 76));
  // Today's target stays the requirement as of the start of today
  assert.equal(s.todayTarget, 23312);
});

test('correcting a value replaces it (no double counting)', () => {
  const entries = { '2026-10-16': entry(12000) };
  entries['2026-10-16'] = entry(15000, { updatedAt: 2 });
  const s = Core.computeStats(CFG_2026, entries, '2026-10-16');
  assert.equal(s.ytd, 2223411 + 15000);
  assert.equal(s.entriesSum, 15000);
  assert.equal(s.loggedDays, 1);
});

test('updating the same day several times counts only the latest value', () => {
  let local;
  for (const [steps, at] of [[3000, 10], [8000, 20], [14000, 30]]) {
    local = Core.mergeRemoteEntry(local, { steps, updatedAt: at, deleted: false }).entry;
  }
  const s = Core.computeStats(CFG_2026, { '2026-10-16': local }, '2026-10-16');
  assert.equal(s.entriesSum, 14000);
  assert.equal(s.ytd, 2223411 + 14000);
});

test('day change: yesterday becomes a complete day, today counts as remaining again', () => {
  const entries = { '2026-10-16': entry(20000) };
  const s = Core.computeStats(CFG_2026, entries, '2026-10-17');
  assert.equal(s.ytd, 2223411 + 20000);
  assert.equal(s.todayLogged, false);
  assert.equal(s.remainingDays, 76); // 17 Oct .. 31 Dec
  assert.equal(s.evalDate, '2026-10-16');
  assert.deepEqual(s.missingDays, []);

  const unlogged = Core.computeStats(CFG_2026, {}, '2026-10-17');
  assert.deepEqual(unlogged.missingDays, ['2026-10-16']);
});

test('year change: last year is closed, the new year starts from its own baseline', () => {
  const entries = { '2026-12-30': entry(25000), '2026-12-31': entry(26000), '2027-01-01': entry(9000) };
  const closed = Core.computeStats(CFG_2026, entries, '2027-01-01', 2026);
  assert.equal(closed.yearFinished, true);
  assert.equal(closed.remainingDays, 0);
  assert.equal(closed.asOf, '2026-12-31');
  assert.equal(closed.ytd, 2223411 + 25000 + 26000); // 2027 entry not counted
  assert.equal(Core.yearTotal(CFG_2026, entries, 2026), 2223411 + 51000);

  const cfg2027 = { goal: 4000000, baselineSteps: 0, baselineDate: '2026-12-31', previousYearTotal: 2274411 };
  assert.equal(Core.validateYearConfig(cfg2027, 2027), null);
  const s = Core.computeStats(cfg2027, entries, '2027-01-01');
  assert.equal(s.year, 2027);
  assert.equal(s.ytd, 9000); // 2026 entries are not part of 2027
  assert.equal(s.remainingDays, 364); // 2 Jan .. 31 Dec (today logged)
  assert.equal(s.planDays, 365);
  assert.equal(Core.weekStart('2027-01-01'), '2026-12-28');
});

test('goal reached exactly', () => {
  const cfg = { goal: 2223411 + 10000, baselineSteps: 2223411, baselineDate: '2026-10-15', previousYearTotal: 2223411 + 9999 };
  const s = Core.computeStats(cfg, { '2026-10-16': entry(10000) }, '2026-10-16');
  assert.equal(s.goalReached, true);
  assert.equal(s.remaining, 0);
  assert.equal(s.requiredDailyAverage, 0);
  assert.equal(s.status, 'reached');
  assert.equal(Math.round(s.progressPercent), 100);
  assert.equal(s.recordBeaten, true);
});

test('goal exceeded', () => {
  const cfg = { goal: 2230000, baselineSteps: 2223411, baselineDate: '2026-10-15', previousYearTotal: 2229999 };
  const s = Core.computeStats(cfg, { '2026-10-16': entry(30000) }, '2026-10-16');
  assert.equal(s.goalReached, true);
  assert.equal(s.surplus, 2223411 + 30000 - 2230000);
  assert.ok(s.progressPercent > 100);
  assert.equal(s.remaining, 0);
  assert.equal(s.requiredDailyAverage, 0);
});

test('missing days are reported and not guessed', () => {
  const entries = { '2026-10-16': entry(15000), '2026-10-18': entry(17000) };
  const s = Core.computeStats(CFG_2026, entries, '2026-10-19');
  assert.deepEqual(s.missingDays, ['2026-10-17']);
  assert.equal(s.ytd, 2223411 + 32000);
  assert.equal(s.loggedDays, 2);
  assert.equal(s.averagePerLoggedDay, 16000);
});

test('a confirmed zero is a logged day, a missing day is not', () => {
  const zero = Core.computeStats(CFG_2026, { '2026-10-16': entry(0) }, '2026-10-17');
  assert.deepEqual(zero.missingDays, []);
  assert.equal(zero.loggedDays, 1);

  const today = Core.computeStats(CFG_2026, { '2026-10-16': entry(0) }, '2026-10-16');
  assert.equal(today.todayLogged, true);
  assert.equal(today.todaySteps, 0);

  const none = Core.computeStats(CFG_2026, {}, '2026-10-17');
  assert.deepEqual(none.missingDays, ['2026-10-16']);
  assert.equal(none.loggedDays, 0);
});

test('deleted entries (tombstones) count as not logged', () => {
  const s = Core.computeStats(CFG_2026, { '2026-10-16': entry(0, { deleted: true }) }, '2026-10-17');
  assert.equal(s.ytd, 2223411);
  assert.deepEqual(s.missingDays, ['2026-10-16']);
});

test('entries on or before the baseline day are part of the start value and never counted twice', () => {
  const entries = { '2026-10-14': entry(11000), '2026-10-15': entry(12000), '2026-10-16': entry(13000) };
  const s = Core.computeStats(CFG_2026, entries, '2026-10-16');
  assert.equal(s.ytd, 2223411 + 13000);
  assert.equal(s.entriesSum, 13000);

  const covered = Core.computeStats(CFG_2026, entries, '2026-10-15');
  assert.equal(covered.todayCoveredByBaseline, true);
  assert.equal(covered.todaySteps, null);
  assert.equal(covered.ytd, 2223411);
});

test('the sum of daily values reconciles with the total', () => {
  const entries = {};
  let sum = 0;
  for (let i = 1; i <= 30; i++) {
    const date = Core.addDays('2026-10-15', i);
    const steps = 10000 + i * 137;
    entries[date] = entry(steps);
    sum += steps;
  }
  const s = Core.computeStats(CFG_2026, entries, '2026-11-14');
  assert.equal(s.entriesSum, sum);
  assert.equal(s.ytd, CFG_2026.baselineSteps + sum);
  const series = Core.cumulativeSeries(s, entries);
  assert.equal(series[0].date, '2026-10-15');
  assert.equal(series[0].actual, CFG_2026.baselineSteps);
  assert.equal(series[series.length - 1].actual, s.ytd);
});

test('last day of the year', () => {
  const open = Core.computeStats(CFG_2026, {}, '2026-12-31');
  assert.equal(open.remainingDays, 1);
  assert.equal(open.requiredDailyAverage, open.remaining);

  const logged = Core.computeStats(CFG_2026, { '2026-12-31': entry(30000) }, '2026-12-31');
  assert.equal(logged.remainingDays, 0);
  assert.equal(logged.requiredDailyAverage, null);
  assert.equal(logged.goalOutOfReach, true);
});

test('plan line and status', () => {
  const s0 = Core.computeStats(CFG_2026, {}, '2026-10-16');
  assert.equal(s0.planDays, 77);
  assert.equal(Math.round(s0.planAt('2026-12-31')), 4018405);
  assert.equal(s0.planAt('2026-10-15'), 2223411);

  const behind = Core.computeStats(CFG_2026, { '2026-10-16': entry(5000) }, '2026-10-16');
  assert.equal(behind.status, 'behind');
  assert.ok(behind.deviation < 0);

  const ahead = Core.computeStats(CFG_2026, { '2026-10-16': entry(40000) }, '2026-10-16');
  assert.equal(ahead.status, 'ahead');

  const onTrack = Core.computeStats(CFG_2026, { '2026-10-16': entry(23000) }, '2026-10-16');
  assert.equal(onTrack.status, 'on_track');

  // About half of the daily requirement is clearly behind, not "on plan"
  const half = Core.computeStats(CFG_2026, { '2026-10-16': entry(12345) }, '2026-10-16');
  assert.equal(half.status, 'behind');
});

test('projection uses the recent average', () => {
  const entries = {};
  for (let i = 1; i <= 7; i++) entries[Core.addDays('2026-10-15', i)] = entry(15000);
  const s = Core.computeStats(CFG_2026, entries, '2026-10-22');
  assert.equal(s.recentAverage, 15000);
  assert.equal(s.projectedYearEnd, s.ytd + 15000 * s.remainingDays);
  assert.equal(s.projectedVsRecord, s.projectedYearEnd - 4018404);
});

test('calendar math is DST-safe and handles leap years', () => {
  assert.equal(Core.daysBetween('2026-03-28', '2026-03-30'), 2); // spring forward (EU 29 Mar)
  assert.equal(Core.daysBetween('2026-10-24', '2026-10-26'), 2); // fall back (EU 25 Oct)
  assert.equal(Core.addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(Core.daysInYear(2026), 365);
  assert.equal(Core.daysInYear(2028), 366);
  assert.equal(Core.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(Core.weekStart('2026-10-18'), '2026-10-12'); // Sunday -> Monday
  assert.equal(Core.weekStart('2026-10-12'), '2026-10-12');
  assert.equal(Core.isValidDateKey('2026-02-30'), false);
  assert.equal(Core.isValidDateKey('2026-2-3'), false);
  assert.equal(Core.toDateKey(new Date(2026, 9, 16, 23, 59)), '2026-10-16');
});

test('step input validation', () => {
  const ok = (raw, value) => assert.deepEqual(Core.parseStepInput(raw), { ok: true, value }, String(raw));
  const bad = (raw, error) => assert.equal(Core.parseStepInput(raw).error, error, String(raw));
  ok('12345', 12345);
  ok('12.345', 12345);
  ok('12,345', 12345);
  ok('12 345', 12345);
  ok('12 345', 12345);
  ok("12'345", 12345);
  ok(' 0 ', 0);
  bad('', 'empty');
  bad('   ', 'empty');
  bad('-500', 'negative');
  bad('12,5', 'decimal');
  bad('12.34', 'decimal');
  bad('abc', 'format');
  bad('1e5', 'format');
  bad('12.34.5', 'format');
  bad('250000', 'too_large');
  bad('1.234.567', 'too_large');
  assert.deepEqual(Core.parseStepInput('2.223.411', { max: Core.MAX_TOTAL_STEPS }), { ok: true, value: 2223411 });
});

test('configuration validation', () => {
  assert.equal(Core.validateYearConfig(CFG_2026, 2026), null);
  assert.equal(Core.validateYearConfig(null, 2026), 'missing');
  assert.equal(Core.validateYearConfig({ ...CFG_2026, goal: 0 }, 2026), 'goal');
  assert.equal(Core.validateYearConfig({ ...CFG_2026, baselineSteps: -1 }, 2026), 'baselineSteps');
  assert.equal(Core.validateYearConfig({ ...CFG_2026, baselineDate: '2025-06-01' }, 2026), 'baselineDate');
  assert.equal(Core.validateYearConfig({ ...CFG_2026, baselineDate: '2025-12-31' }, 2026), 'baselineSteps');
  assert.equal(Core.validateYearConfig({ ...CFG_2026, baselineSteps: 0, baselineDate: '2025-12-31' }, 2026), null);
  assert.equal(Core.validateYearConfig({ ...CFG_2026, previousYearTotal: 1.5 }, 2026), 'previousYearTotal');
});

test('sync merge: last write wins per day, pending local changes are kept or reported', () => {
  const remote = (steps, updatedAt, deleted) => ({ steps, updatedAt, deleted: !!deleted });

  assert.deepEqual(Core.mergeRemoteEntry(undefined, remote(9000, 5)), { entry: { steps: 9000, updatedAt: 5 }, conflict: false });

  // Newer remote replaces an older pending local value and reports the conflict
  const lost = Core.mergeRemoteEntry({ steps: 8000, updatedAt: 4, pending: true }, remote(9000, 5));
  assert.deepEqual(lost, { entry: { steps: 9000, updatedAt: 5 }, conflict: true });

  // Same version: confirmed, no longer pending
  assert.deepEqual(Core.mergeRemoteEntry({ steps: 9000, updatedAt: 5, pending: true }, remote(9000, 5)).entry, { steps: 9000, updatedAt: 5 });

  // Newer local stays and is (re-)uploaded
  assert.deepEqual(Core.mergeRemoteEntry({ steps: 12000, updatedAt: 9 }, remote(9000, 5)).entry, { steps: 12000, updatedAt: 9, pending: true });

  // Remote deletion
  assert.deepEqual(Core.mergeRemoteEntry({ steps: 12000, updatedAt: 9 }, remote(0, 10, true)).entry, { steps: 0, updatedAt: 10, deleted: true });

  // Rows from/to the database
  const row = Core.entryToRow('2026-10-16', { steps: 12345, updatedAt: Date.parse('2026-10-16T18:00:00.123Z') });
  assert.deepEqual(row, { date: '2026-10-16', steps: 12345, deleted: false, updated_at: '2026-10-16T18:00:00.123Z' });
  const back = Core.rowToRemote({ date: '2026-10-16', steps: 12345, deleted: false, updated_at: '2026-10-16T18:00:00.123+00:00' });
  assert.equal(back.updatedAt, Date.parse('2026-10-16T18:00:00.123Z'));
});

test('weekly overview', () => {
  const entries = { '2026-10-16': entry(12000), '2026-10-17': entry(0) };
  const s = Core.computeStats(CFG_2026, entries, '2026-10-17');
  const week = Core.weekSummary(s, entries, Core.weekStart('2026-10-17'));
  assert.equal(week.start, '2026-10-12');
  assert.equal(week.days.length, 7);
  assert.deepEqual(week.days.map(d => d.inChallenge), [false, false, false, false, true, true, true]);
  assert.equal(week.days[3].coveredByBaseline, true);
  assert.equal(week.total, 12000);
  assert.equal(week.logged, 2);
  assert.equal(week.average, 6000);
  assert.equal(week.planTotal, Math.round(3 * s.planDailyRate));
  assert.equal(week.days[5].isToday, true);
  assert.equal(week.days[6].isFuture, true);

  const weeks = Core.weeklyTotals(s, entries, 8);
  assert.equal(weeks.length, 1); // challenge started this week
});

test('formatting', () => {
  assert.equal(Core.formatSteps(2223411), '2.223.411');
  assert.equal(Core.formatSigned(-3100), '−3.100');
  assert.equal(Core.formatSigned(1200), '+1.200');
  assert.equal(Core.formatCompact(23312), '23k');
  assert.equal(Core.formatCompact(4018405), '4,02 Mio.');
  assert.equal(Core.formatPercent(55.334), '55,3 %');
  assert.equal(Core.formatDay('2026-10-16'), '16.10.');
  assert.equal(Core.formatDay('2026-10-16', true), 'Fri 16.10.');
});
