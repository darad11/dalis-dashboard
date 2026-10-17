// Rules of the matrix in the Lists section (js/matrix-core.js).
// Run: node --test "tests/unit/*.test.js"
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/matrix-core.js');

const TODAY = '2026-10-17';

test('the matrix stands first among the lists until it is stored elsewhere', () => {
  const lists = [{ id: 'custom-1', title: 'Einkauf' }, { id: 'custom-2', title: 'Ziele' }];
  const shown = Core.withMatrix(lists);
  assert.deepEqual(shown.map(e => e.id), ['matrix', 'custom-1', 'custom-2']);
  assert.deepEqual(shown[0].areas.map(a => a.title), ['to do', 'up next', 'waiting', 'ideas']);
  assert.deepEqual(lists.map(e => e.id), ['custom-1', 'custom-2'], 'input untouched');
  // Moved below the lists: stays there, area titles kept, missing ones filled in
  const stored = [lists[0], { id: 'matrix', type: 'matrix', title: 'Matrix', areas: [{ id: 'next', title: '  Diese  Woche ' }] }, lists[1]];
  const again = Core.withMatrix(stored);
  assert.deepEqual(again.map(e => e.id), ['custom-1', 'matrix', 'custom-2']);
  assert.deepEqual(again[1].areas.map(a => a.title), ['to do', 'Diese Woche', 'waiting', 'ideas']);
  assert.equal(Core.withMatrix(null).length, 1);
});

test('renaming an area: trimmed, at most 40 characters, never empty', () => {
  const entry = Core.defaultEntry();
  const renamed = Core.renameArea(entry, 'waiting', '  wartet auf  Antwort ');
  assert.equal(Core.areaTitle(renamed, 'waiting'), 'wartet auf Antwort');
  assert.equal(Core.areaTitle(renamed, 'todo'), 'to do', 'other areas unchanged');
  assert.equal(Core.areaTitle(entry, 'waiting'), 'waiting', 'entry untouched');
  assert.equal(Core.renameArea(entry, 'waiting', '   '), null);
  assert.equal(Core.renameArea(entry, 'someday', 'x'), null);
  assert.equal(Core.areaTitle(Core.renameArea(entry, 'ideas', 'x'.repeat(60)), 'ideas').length, 40);
});

test('tasks: same text in several areas stay separate tasks; older plain items land in to do', () => {
  const tasks = Core.normalizeTasks([
    { id: 'a', text: 'test', done: false, area: 'todo' },
    { id: 'b', text: 'test', done: false, area: 'next' },
    { id: 'a', text: 'duplicate id', area: 'waiting' },
    { text: 'from an older version', done: true },
    'plain text',
    { id: 'c', text: '   ', area: 'ideas' },
    null,
    { id: 'd', text: 'x', area: 'someday', due: '2026-02-30', repeat: 'weekly', note: '  bring it  ' }
  ]);
  assert.deepEqual(tasks.map(t => [t.id, t.text, t.area]), [
    ['a', 'test', 'todo'], ['b', 'test', 'next'], ['a-2', 'duplicate id', 'waiting'],
    ['item-3', 'from an older version', 'todo'], ['item-4', 'plain text', 'todo'], ['d', 'x', 'todo']
  ]);
  assert.equal(tasks[3].done, true);
  assert.deepEqual(tasks[5], { id: 'd', text: 'x', done: false, area: 'todo', note: 'bring it' }, 'invalid day dropped, so no repeat');
});

test('task sheet: text needed, note optional, a repeating task gets today when it has no day', () => {
  assert.deepEqual(Core.buildTask({ text: '  ', area: 'todo' }, null, TODAY, 1), { ok: false, error: 'text' });
  const plain = Core.buildTask({ text: ' Steuer ', note: '', area: 'next', due: '', repeat: '' }, null, TODAY, 1).task;
  assert.equal(plain.text, 'Steuer');
  assert.equal(plain.area, 'next');
  assert.ok(plain.id.startsWith('t'));
  assert.deepEqual(Object.keys(plain).sort(), ['area', 'done', 'id', 'text']);
  const weekly = Core.buildTask({ text: 'Müll', area: 'todo', due: '', repeat: 'weekly' }, null, TODAY, 1).task;
  assert.equal(weekly.due, TODAY);
  assert.equal(weekly.repeat, 'weekly');
  // Editing keeps id and done state, a new area moves it
  const edited = Core.buildTask({ text: 'Müll raus', area: 'waiting', due: '2026-10-20', note: 'blau' }, Object.assign({}, weekly, { done: true }), TODAY, 2).task;
  assert.deepEqual(edited, { id: weekly.id, text: 'Müll raus', done: true, area: 'waiting', note: 'blau', due: '2026-10-20' });
});

test('ticking: done, open again; a repeating task moves on to its next day and stays open', () => {
  const plain = { id: 'a', text: 'a', done: false, area: 'todo' };
  assert.deepEqual(Core.toggle(plain, TODAY), { task: Object.assign({}, plain, { done: true }), repeated: false });
  assert.equal(Core.toggle(Object.assign({}, plain, { done: true }), TODAY).task.done, false);
  const daily = { id: 'b', text: 'b', done: false, area: 'todo', due: TODAY, repeat: 'daily' };
  assert.deepEqual(Core.toggle(daily, TODAY), { task: Object.assign({}, daily, { due: '2026-10-18' }), repeated: true });
  // Overdue: the next day after today on its rhythm; done early: one step on
  assert.equal(Core.nextDue('2026-10-01', 'weekly', TODAY), '2026-10-22');
  assert.equal(Core.nextDue('2026-10-24', 'weekly', TODAY), '2026-10-31');
  assert.equal(Core.nextDue('2026-10-10', 'daily', TODAY), '2026-10-18');
  // Months and years from the original day
  assert.equal(Core.nextDue('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28');
  assert.equal(Core.nextDue('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31');
  assert.equal(Core.nextDue('2028-02-29', 'yearly', '2028-02-29'), '2029-02-28');
  assert.equal(Core.nextDue('2026-10-25', 'daily', '2026-10-25'), '2026-10-26', 'across the clock change');
  assert.equal(Core.nextDue('nope', 'daily', TODAY), null);
});

test('due days read as Today, Tomorrow, Yesterday or a short date; past days are overdue', () => {
  assert.deepEqual(Core.dueInfo(TODAY, TODAY), { label: 'Today', overdue: false, today: true });
  assert.deepEqual(Core.dueInfo('2026-10-18', TODAY), { label: 'Tomorrow', overdue: false, today: false });
  assert.deepEqual(Core.dueInfo('2026-10-16', TODAY), { label: 'Yesterday', overdue: true, today: false });
  assert.deepEqual(Core.dueInfo('2026-10-20', TODAY), { label: 'Di., 20. Okt.', overdue: false, today: false });
  assert.equal(Core.dueInfo('2027-01-05', TODAY).label, 'Di., 5. Jan. 2027');
  assert.equal(Core.dueInfo('2026-09-30', TODAY).overdue, true);
  assert.equal(Core.dueInfo(undefined, TODAY), null);
});

test('open and done tasks per area; moving to another area puts a task at its end', () => {
  const tasks = [
    { id: 'a', text: 'a', done: false, area: 'todo' },
    { id: 'b', text: 'b', done: true, area: 'todo' },
    { id: 'c', text: 'c', done: false, area: 'next' },
    { id: 'd', text: 'd', done: false, area: 'todo' }
  ];
  assert.deepEqual(Core.openTasks(tasks, 'todo').map(t => t.id), ['a', 'd']);
  assert.deepEqual(Core.doneTasks(tasks, 'todo').map(t => t.id), ['b']);
  const moved = Core.replaceTask(tasks, Object.assign({}, tasks[0], { area: 'next' }));
  assert.deepEqual(Core.openTasks(moved, 'next').map(t => t.id), ['c', 'a']);
  const renamed = Core.replaceTask(tasks, Object.assign({}, tasks[3], { text: 'D' }));
  assert.deepEqual(renamed.map(t => t.text), ['a', 'b', 'c', 'D'], 'same area: same place');
  assert.deepEqual(Core.removeTask(tasks, 'c').map(t => t.id), ['a', 'b', 'd']);
  assert.deepEqual(Core.clearDone(tasks, 'todo').map(t => t.id), ['a', 'c', 'd']);
});
