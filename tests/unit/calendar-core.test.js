// Rules for calendar entries with times and own calendars (js/calendar-core.js) and the
// sync fingerprint of calendar days (js/data-utils.js). Run: node --test "tests/unit/*.test.js"
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/calendar-core.js');
const DataUtils = require('../../js/data-utils.js');

test('times: "HH:MM" from the editor and "HH:MM:SS" from Postgres; invalid values rejected', () => {
  assert.equal(Core.normalizeTime('09:05'), '09:05');
  assert.equal(Core.normalizeTime('14:30:00'), '14:30');
  assert.equal(Core.normalizeTime('23:59:59.5'), '23:59');
  for (const bad of ['24:00', '9:00', '12:60', '', null, undefined, 930, 'noon']) {
    assert.equal(Core.normalizeTime(bad), null, String(bad));
  }
  assert.equal(Core.toMinutes('01:30'), 90);
  assert.equal(Core.fromMinutes(90), '01:30');
  assert.equal(Core.fromMinutes(24 * 60 + 5), '23:59', 'never past midnight');
});

test('calendars: default calendar first and always present, invalid entries dropped', () => {
  assert.deepEqual(Core.normalizeCalendars(null), [{ id: 'default', name: 'Personal', color: 'blue' }]);
  const list = Core.normalizeCalendars([
    { id: 'cal-work', name: '  Work ', color: 'red' },
    { id: 'default', name: 'Privat', color: 'green' },
    { id: 'cal-work', name: 'duplicate', color: 'blue' },
    { id: 'cal-x', name: '', color: 'magenta' },
    null, 'text', { name: 'no id' }
  ]);
  assert.deepEqual(list, [
    { id: 'default', name: 'Privat', color: 'green' },
    { id: 'cal-work', name: 'Work', color: 'red' },
    { id: 'cal-x', name: 'Calendar', color: 'blue' }
  ]);
});

test('an entry without calendar or with a deleted calendar belongs to the default calendar', () => {
  const cals = Core.normalizeCalendars([{ id: 'default', name: 'Personal', color: 'blue' }, { id: 'cal-work', name: 'Work', color: 'red' }]);
  assert.equal(Core.calendarOf(cals, { text: 'a' }).id, 'default');
  assert.equal(Core.calendarOf(cals, { text: 'a', calendarId: 'cal-work' }).id, 'cal-work');
  assert.equal(Core.calendarOf(cals, { text: 'a', calendarId: 'cal-deleted' }).id, 'default');
  assert.equal(Core.calendarOf(cals, 'old string entry').id, 'default');
  const id = Core.newCalendarId(cals, () => 0.5);
  assert.match(id, /^cal-/);
  assert.ok(!cals.some(c => c.id === id));
});

test('display order: all-day entries first in stored order, then by time; stored indexes kept', () => {
  const day = [
    { text: 'Laufen', start: '18:00', end: '19:00' },
    { text: 'Paket abholen' },
    { text: 'Meeting', start: '10:00', end: '11:30' },
    'Altes Format',
    { text: 'Standup', start: '10:00', end: '10:15' },
    null
  ];
  assert.deepEqual(Core.displayOrder(day), [1, 3, 4, 2, 0]);
  assert.deepEqual(Core.displayOrder([]), []);
  assert.deepEqual(Core.displayOrder(undefined), []);
});

test('time range text and the colours of a day for the month grid', () => {
  assert.equal(Core.formatRange({ text: 'a', start: '10:00', end: '11:30' }), '10:00–11:30');
  assert.equal(Core.formatRange({ text: 'a', start: '14:00', end: '14:00' }), '14:00');
  assert.equal(Core.formatRange({ text: 'a', start: '14:00' }), '14:00');
  assert.equal(Core.formatRange({ text: 'a' }), '');
  const cals = Core.normalizeCalendars([{ id: 'w', name: 'Work', color: 'red' }, { id: 's', name: 'Sport', color: 'green' }, { id: 'f', name: 'Family', color: 'purple' }]);
  const day = [
    { text: '1', calendarId: 's', start: '18:00', end: '19:00' },
    { text: '2' },
    { text: '3', calendarId: 'w', start: '09:00', end: '10:00' },
    { text: '4', calendarId: 'w', start: '12:00', end: '13:00' },
    { text: '5', calendarId: 'f', start: '20:00', end: '21:00' }
  ];
  assert.deepEqual(Core.dayColors(day, cals), ['blue', 'red', 'green'], 'distinct, display order, at most 3');
});

test('proposed times: next full hour today, 09:00 on other days, one hour long, not past midnight', () => {
  const now = new Date(2026, 9, 16, 10, 20);
  assert.deepEqual(Core.defaultTimes(new Date(2026, 9, 16), now), { start: '11:00', end: '12:00' });
  assert.deepEqual(Core.defaultTimes(new Date(2026, 9, 17), now), { start: '09:00', end: '10:00' });
  assert.deepEqual(Core.defaultTimes(new Date(2026, 9, 16), new Date(2026, 9, 16, 23, 10)), { start: '23:00', end: '23:59' });
});

test('moving the start keeps the duration (as in Apple Calendar)', () => {
  assert.equal(Core.shiftEnd('10:00', '11:30', '13:00'), '14:30');
  assert.equal(Core.shiftEnd('10:00', '11:30', '23:00'), '23:59');
  assert.equal(Core.shiftEnd(null, null, '08:15'), '09:15', 'no previous range: one hour');
  assert.equal(Core.shiftEnd('10:00', '09:00', '12:00'), '13:00', 'broken range: one hour');
});

test('editor input becomes an entry with only the fields that are set', () => {
  const allDay = Core.buildEntry({ text: '  Paket abholen ', allDay: true, start: '10:00', end: '11:00', calendarId: 'default', priority: '' });
  assert.deepEqual(allDay, { ok: true, entry: { done: false, priority: null, text: 'Paket abholen' } });

  const timed = Core.buildEntry({ text: 'Meeting', allDay: false, start: '10:00', end: '11:30', calendarId: 'cal-work', priority: 'high' });
  assert.deepEqual(timed.entry, { done: false, priority: 'high', text: 'Meeting', start: '10:00', end: '11:30', calendarId: 'cal-work' });

  // Editing keeps other fields, removes the time and calendar when they are cleared
  const edited = Core.buildEntry({ text: 'Meeting', allDay: true, calendarId: 'default' },
    { text: 'Meeting', done: true, priority: 'low', start: '10:00', end: '11:00', calendarId: 'cal-work', rolledFrom: 'x' });
  assert.deepEqual(edited.entry, { text: 'Meeting', done: true, priority: null, rolledFrom: 'x' });

  assert.equal(Core.buildEntry({ text: '   ', allDay: true }).error, 'title');
  assert.equal(Core.buildEntry({ text: 'a', allDay: false, start: '', end: '11:00' }).error, 'start');
  assert.equal(Core.buildEntry({ text: 'a', allDay: false, start: '12:00', end: '11:00' }).error, 'end');
  assert.equal(Core.buildEntry({ text: 'a', allDay: false, start: '12:00', end: '12:00' }).ok, true, 'zero length allowed');
});

test('sync fingerprint: entries without times keep their fingerprint, times and calendar count', () => {
  const old = [{ text: 'a', done: false }, { text: 'b', done: true, priority: 'high' }];
  // value computed with the version before times existed (must not change: pending
  // changes of an earlier session would otherwise look like a conflict after the update)
  assert.equal(DataUtils.fingerprint('cal-2026-9-16', old), '19pto2h9el9');
  const cloudShape = [{ text: 'a', done: false, priority: null, urgency: null }, { text: 'b', done: true, priority: 'high', urgency: null }];
  assert.equal(DataUtils.fingerprint('cal-2026-9-16', cloudShape), '19pto2h9el9');

  const local = [{ text: 'Meeting', done: false, priority: null, start: '10:00', end: '11:30', calendarId: 'cal-work' }];
  const fromCloud = [{ text: 'Meeting', done: false, priority: null, urgency: null, start: '10:00', end: '11:30', calendarId: 'cal-work' }];
  assert.equal(DataUtils.fingerprint('cal-2026-9-16', local), DataUtils.fingerprint('cal-2026-9-16', fromCloud));
  assert.notEqual(DataUtils.fingerprint('cal-2026-9-16', local),
    DataUtils.fingerprint('cal-2026-9-16', [Object.assign({}, local[0], { start: '10:15' })]));
  assert.notEqual(DataUtils.fingerprint('cal-2026-9-16', local),
    DataUtils.fingerprint('cal-2026-9-16', [Object.assign({}, local[0], { calendarId: 'default' })]));
});

test('same text twice on one day: duplicates only when time and calendar are equal too', () => {
  const day = [
    { text: 'Meeting', start: '10:00', end: '11:00' },
    { text: 'Meeting', start: '14:00', end: '15:00' },
    { text: 'Meeting', start: '10:00:00', end: '11:00:00' }
  ];
  assert.equal(DataUtils.normalizeForCompare('cal-2026-9-16', day).length, 2);
  assert.equal(DataUtils.goalIdentity({ text: 'x', start: '10:00:00' }), DataUtils.goalIdentity({ text: 'x', start: '10:00' }));
  assert.equal(DataUtils.isSyncableKey('calendars'), true);
  assert.equal(DataUtils.keyKind('calendars'), 'setting');
});
