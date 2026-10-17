// Rules of the Home section (js/home-core.js): greeting, today's events, task triage, goals,
// matrix counts, steps, habits, weather codes and the home settings.
// Run: node --test "tests/unit/*.test.js"
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/home-core.js');

const FRIDAY = new Date(2026, 9, 16, 9, 40); // Friday 16 October 2026, 09:40 local
const TODAY = '2026-10-16';

test('greeting follows the hour; the name is cleaned and optional', () => {
  assert.equal(Core.greeting(5), 'Good morning');
  assert.equal(Core.greeting(11), 'Good morning');
  assert.equal(Core.greeting(12), 'Good afternoon');
  assert.equal(Core.greeting(17), 'Good afternoon');
  assert.equal(Core.greeting(18), 'Good evening');
  assert.equal(Core.greeting(23), 'Good evening');
  assert.equal(Core.greeting(0), 'Good evening');
  assert.equal(Core.greeting(4), 'Good evening');
  assert.equal(Core.greetingLine('  Dali ', 9), 'Good morning, Dali.');
  assert.equal(Core.greetingLine('', 9), 'Good morning.');
  assert.equal(Core.greetingLine(null, 20), 'Good evening.');
  assert.equal(Core.cleanName('x'.repeat(60)).length, Core.MAX_NAME);
  assert.equal(Core.dateLabel(FRIDAY), 'Freitag, 16. Oktober');
  assert.equal(Core.dayKey(FRIDAY), TODAY);
  assert.equal(Core.weekdayIndex(FRIDAY), 4);
  assert.equal(Core.dayKey(Core.mondayOf(FRIDAY)), '2026-10-12');
  assert.equal(Core.dayKey(Core.mondayOf(new Date(2026, 9, 18))), '2026-10-12', 'Sunday belongs to the week before');
});

test("today's events: calendar order, state against the clock, the next one up", () => {
  const entries = [
    'Paket abholen',
    { text: 'Standup', start: '09:00', end: '09:15' },
    { text: 'Team-Meeting', start: '10:00', end: '10:30', calendarId: 'cal-work' },
    { text: 'Zahnarzt', start: '14:30', end: '15:00' },
    { text: 'Running', start: '09:30', end: '10:00' }
  ];
  const day = Core.todayEvents(entries, FRIDAY);
  assert.deepEqual(day.events.map(e => [e.text, e.state, e.timeLabel]), [
    ['Paket abholen', 'allday', 'all-day'],
    ['Standup', 'past', '09:00–09:15'],
    ['Running', 'now', '09:30–10:00'],
    ['Team-Meeting', 'later', '10:00–10:30'],
    ['Zahnarzt', 'later', '14:30–15:00']
  ]);
  assert.equal(day.events[2].index, 4, 'rows keep the stored index');
  assert.equal(day.nextUp.text, 'Running');
  assert.equal(Core.nextUpLabel(day.nextUp, FRIDAY), 'until 10:00');
  assert.equal(day.count, 5);
  assert.equal(day.open, 4);
  assert.equal(Core.nextUpLabel(day.events[3], FRIDAY), 'in 20 min');
  assert.equal(Core.nextUpLabel(day.events[4], FRIDAY), 'in 4 h 50 min');
  assert.equal(Core.nextUpLabel(day.events[4], new Date(2026, 9, 16, 12, 30)), 'in 2 h');
  assert.equal(Core.nextUpLabel(day.events[0], FRIDAY), '', 'all-day entries have no countdown');
  // Later in the day: nothing ahead
  const evening = Core.todayEvents(entries, new Date(2026, 9, 16, 19, 0));
  assert.equal(evening.nextUp, null);
  assert.equal(evening.open, 1, 'only the all-day entry is not past');
  assert.deepEqual(Core.todayEvents(null, FRIDAY), { events: [], nextUp: null, count: 0, open: 0 });
});

test('tasks: overdue first, then today by priority, then the coming days; done ones last; counts', () => {
  const board = {
    MO: [{ text: 'Rechnungen', done: true }],
    DI: [{ text: 'Auto Service', done: false, priority: 'medium' }],
    MI: [{ text: 'Entwurf', done: false, priority: 'high' }, 'alter Text'],
    FR: [{ text: 'Laufen', done: false }, { text: 'Präsentation', done: false, priority: 'high' }, { text: 'Mail', done: true }, { text: 'Einkauf', done: false, priority: 'low' }],
    SA: [{ text: 'Bauernmarkt', done: false }],
    SO: [{ text: 'Vorbereiten', done: false, priority: 'high' }, null, { text: '   ' }]
  };
  const triage = Core.triageTasks(board, 4, 6);
  assert.deepEqual(triage.rows.map(r => [r.text, r.kind, r.dayLabel]), [
    ['Entwurf', 'overdue', 'Mi'],
    ['Auto Service', 'overdue', 'Di'],
    ['alter Text', 'overdue', 'Mi'],
    ['Präsentation', 'today', 'Fr'],
    ['Einkauf', 'today', 'Fr'],
    ['Laufen', 'today', 'Fr']
  ]);
  assert.deepEqual([triage.todayOpen, triage.todayDone, triage.overdue, triage.weekOpen, triage.weekDone, triage.hidden], [3, 1, 3, 8, 2, 3]);
  assert.deepEqual(triage.rows[0], { column: 'MI', index: 0, dayIndex: 2, text: 'Entwurf', done: false, priority: 'high', kind: 'overdue', dayLabel: 'Mi' });
  // Room for the coming days and today's done tasks
  const wide = Core.triageTasks(board, 4, 20);
  assert.deepEqual(wide.rows.slice(6).map(r => [r.text, r.kind, r.done]), [
    ['Bauernmarkt', 'upcoming', false], ['Vorbereiten', 'upcoming', false], ['Mail', 'today', true]
  ]);
  assert.equal(wide.hidden, 0);
  assert.deepEqual(Core.triageTasks(null, 0), { rows: [], todayOpen: 0, todayDone: 0, overdue: 0, weekOpen: 0, weekDone: 0, hidden: 0 });
  // Monday: nothing can be overdue yet
  assert.equal(Core.triageTasks(board, 0).overdue, 0);
});

test('goals: the focus is the first open goal by urgency, the rest keep their order', () => {
  const goals = [
    { text: 'Lesen', done: true },
    'Wocheneinkauf planen',
    { text: 'Steuer', done: false, urgency: 'high' },
    { text: 'Mail', done: false, urgency: 'low' },
    { text: 'Anrufen', done: false, urgency: 'high' }
  ];
  const summary = Core.goalsSummary(goals);
  assert.deepEqual(summary.focus, { index: 2, text: 'Steuer', done: false, urgency: 'high' });
  assert.deepEqual(summary.rest.map(g => g.text), ['Wocheneinkauf planen', 'Mail', 'Anrufen']);
  assert.deepEqual([summary.open, summary.doneCount, summary.total], [4, 1, 5]);
  assert.deepEqual(summary.done.map(g => g.index), [0]);
  const plain = Core.goalsSummary(['a', 'b']);
  assert.equal(plain.focus.text, 'a', 'without urgency the first goal is the focus');
  assert.equal(Core.goalsSummary([]).focus, null);
  assert.equal(Core.goalsSummary([{ text: 'x', done: true }]).focus, null);
});

test('matrix: open tasks per area and the task to look at first (earliest due day)', () => {
  const entry = { id: 'matrix', type: 'matrix', title: 'Matrix', areas: [{ id: 'next', title: 'Diese Woche' }] };
  const tasks = [
    { id: 'a', text: 'ohne Datum', done: false, area: 'todo' },
    { id: 'b', text: 'morgen', done: false, area: 'todo', due: '2026-10-17' },
    { id: 'c', text: 'überfällig', done: false, area: 'todo', due: '2026-10-10' },
    { id: 'd', text: 'erledigt', done: true, area: 'todo', due: '2026-10-01' },
    { id: 'e', text: 'Idee', done: false, area: 'ideas' }
  ];
  const summary = Core.matrixSummary(entry, tasks, TODAY);
  assert.deepEqual(summary.areas.map(a => [a.id, a.title, a.open]), [['todo', 'to do', 3], ['next', 'Diese Woche', 0], ['waiting', 'waiting', 0], ['ideas', 'ideas', 1]]);
  assert.deepEqual(summary.areas[0].task, { id: 'c', text: 'überfällig', due: { label: 'Sa., 10. Okt.', overdue: true, today: false } });
  assert.deepEqual(summary.areas[3].task, { id: 'e', text: 'Idee', due: null });
  assert.equal(summary.areas[1].task, null);
  assert.equal(summary.open, 4);
  assert.equal(Core.matrixSummary(null, null, TODAY).open, 0);
});

test('steps: today against the target, the year against the goal', () => {
  const stats = { todayInYear: true, todayLogged: true, todaySteps: 8420, todayTarget: 11200, ytd: 2405000, goal: 4018405, progressPercent: 59.85, goalReached: false, status: 'behind' };
  assert.deepEqual(Core.stepsSummary(stats), {
    todaySteps: 8420, target: 11200, remaining: 2780, percent: 75, ytd: 2405000, goal: 4018405, yearPercent: 60, goalReached: false, status: 'behind'
  });
  const notLogged = Core.stepsSummary(Object.assign({}, stats, { todayLogged: false, todaySteps: null }));
  assert.equal(notLogged.todaySteps, null);
  assert.equal(notLogged.remaining, 11200);
  assert.equal(notLogged.percent, 0);
  assert.equal(Core.stepsSummary(Object.assign({}, stats, { todaySteps: 20000 })).percent, 100, 'capped');
  assert.equal(Core.stepsSummary(Object.assign({}, stats, { todayTarget: null })).remaining, null);
  assert.equal(Core.stepsSummary(Object.assign({}, stats, { todayInYear: false })), null);
  assert.equal(Core.stepsSummary(null), null);
});

test('habits: done today out of all', () => {
  const summary = Core.habitsSummary(['Meditation', { name: 'Lesen' }, { name: '' }, null], i => i === 1);
  assert.deepEqual(summary, { habits: [{ index: 0, name: 'Meditation', done: false }, { index: 1, name: 'Lesen', done: true }], total: 2, done: 1 });
  assert.deepEqual(Core.habitsSummary(null, () => true), { habits: [], total: 0, done: 0 });
});

test('weather: the documented WMO codes, symbols by day and night, the forecast response', () => {
  assert.equal(Core.weatherDescription(0), 'Clear sky');
  assert.equal(Core.weatherDescription(3), 'Overcast');
  assert.equal(Core.weatherDescription(61), 'Slight rain');
  assert.equal(Core.weatherDescription(95), 'Thunderstorm');
  assert.equal(Core.weatherDescription(42), 'Unknown');
  assert.deepEqual([0, 1, 2, 3, 45, 55, 63, 71, 81, 86, 99].map(c => Core.weatherIcon(c, true)),
    ['sun', 'sun', 'cloud-sun', 'cloud', 'fog', 'drizzle', 'rain', 'snow', 'rain', 'snow', 'thunder']);
  assert.deepEqual([0, 2].map(c => Core.weatherIcon(c, false)), ['moon', 'cloud-moon']);
  assert.equal(Core.formatTemperature(13.6), '14°');
  assert.equal(Core.formatTemperature(-3.5), '-3°');
  assert.equal(Core.formatTemperature(null), '–');
  assert.equal(Core.timeOfIso('2026-10-16T07:21'), '07:21');
  assert.equal(Core.timeOfIso('nope'), '');
  const parsed = Core.parseForecast({
    current_units: { temperature_2m: '°C' },
    current: { time: '2026-10-16T09:30', interval: 900, temperature_2m: 13.6, weather_code: 2, is_day: 1 },
    daily: { time: ['2026-10-16'], sunrise: ['2026-10-16T07:21'], sunset: ['2026-10-16T18:12'], temperature_2m_max: [14.3], temperature_2m_min: [5.8] },
    timezone: 'Europe/Vienna', utc_offset_seconds: 7200
  });
  assert.deepEqual(parsed, { temperature: 13.6, code: 2, isDay: true, time: '2026-10-16T09:30', sunrise: '07:21', sunset: '18:12', high: 14.3, low: 5.8, unit: '°C' });
  // An answer without the day's range (cached before it was requested) still counts, without it
  const older = Core.parseForecast({ current: { temperature_2m: 10, weather_code: 0 }, daily: { sunrise: ['2026-10-16T07:21'], sunset: ['2026-10-16T18:12'] } });
  assert.equal(older.high, null);
  assert.equal(older.low, null);
  assert.equal(Core.parseForecast({ current: { temperature_2m: 'warm', weather_code: 1 } }), null);
  assert.equal(Core.parseForecast({ reason: 'error' }), null);
  assert.equal(Core.parseForecast(null), null);
  const t = Date.parse('2026-10-16T10:00:00Z');
  assert.equal(Core.weatherAge(t - 10 * 60 * 1000, t), 'fresh');
  assert.equal(Core.weatherAge(t - 2 * 60 * 60 * 1000, t), 'ok');
  assert.equal(Core.weatherAge(t - 7 * 60 * 60 * 1000, t), 'stale');
  assert.equal(Core.weatherAge(undefined, t), 'stale');
});

test('home settings: name and a valid location only; place labels', () => {
  assert.deepEqual(Core.normalizeSettings(null), { name: '', location: null });
  assert.deepEqual(Core.normalizeSettings({ name: ' Dali ', location: { name: 'Wien', latitude: 48.20849, longitude: 16.37208, timezone: 'Europe/Vienna' } }),
    { name: 'Dali', location: { name: 'Wien', latitude: 48.2085, longitude: 16.3721, timezone: 'Europe/Vienna' } });
  assert.equal(Core.normalizeSettings({ location: { name: 'x', latitude: 91, longitude: 0 } }).location, null);
  assert.equal(Core.normalizeSettings({ location: { name: '', latitude: 1, longitude: 1 } }).location, null);
  assert.equal(Core.normalizeSettings({ location: { name: 'x', latitude: '48', longitude: 16 } }).location, null);
  assert.equal(Core.placeLabel({ name: 'Wien', admin1: 'Wien', country: 'Österreich' }), 'Wien, Österreich');
  assert.equal(Core.placeLabel({ name: 'Graz', admin1: 'Steiermark', country: 'Österreich' }), 'Graz, Steiermark, Österreich');
  assert.equal(Core.placeLabel(null), '');
});
