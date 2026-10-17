/**
 * Matrix in the Lists section: four areas (to do, up next, waiting, ideas) with tasks.
 * Pure rules (no DOM, no storage), used by js/matrix-ui.js in the browser and by
 * tests/unit/matrix-core.test.js in Node.
 *
 * Stored like a list (js/app.js), so ordering and sync work as for the other lists:
 * - its entry in "customListsMeta" places it among the lists and holds the area titles:
 *   { id: 'matrix', type: 'matrix', title: 'Matrix', areas: [{ id, title }, ...] }
 * - its tasks are the items of list "matrix" (localStorage "list-matrix", cloud table lists):
 *   { id, text, done, area, note?, due?, repeat? }
 *     area   'todo' | 'next' | 'waiting' | 'ideas'
 *     due    local day "YYYY-MM-DD"; repeat: 'daily' | 'weekly' | 'monthly' | 'yearly'
 *     id     identity of a task: two tasks may have the same text (the sync matches by it)
 *
 * Days are 'YYYY-MM-DD' strings; arithmetic runs on UTC dates, so daylight-saving changes
 * never shift a day.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatrixCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MATRIX_ID = 'matrix';
  const TYPE = 'matrix';
  const AREAS = Object.freeze([
    Object.freeze({ id: 'todo', title: 'to do' }),
    Object.freeze({ id: 'next', title: 'up next' }),
    Object.freeze({ id: 'waiting', title: 'waiting' }),
    Object.freeze({ id: 'ideas', title: 'ideas' })
  ]);
  const AREA_IDS = AREAS.map(a => a.id);
  const REPEATS = ['daily', 'weekly', 'monthly', 'yearly'];
  const REPEAT_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  const MAX_TITLE = 40;
  const MAX_TEXT = 500;
  const MAX_NOTE = 2000;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // ===== Days =====
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function isDayKey(key) {
    const m = typeof key === 'string' && DATE_RE.exec(key);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  function toUTC(key) {
    const m = DATE_RE.exec(key);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  function fromUTC(d) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function addDays(key, n) {
    const d = toUTC(key);
    d.setUTCDate(d.getUTCDate() + n);
    return fromUTC(d);
  }

  // Months counted from the original day: 31 Jan + 1 month = 28/29 Feb, + 2 months = 31 Mar
  function addMonths(key, n) {
    const m = DATE_RE.exec(key);
    const first = new Date(Date.UTC(+m[1], +m[2] - 1 + n, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(+m[3], last));
    return fromUTC(first);
  }

  /** The next due day of a repeating task after it was done: after today, on its rhythm. */
  function nextDue(due, repeat, todayKey) {
    if (!isDayKey(due) || !REPEATS.includes(repeat)) return null;
    const step = (k) => {
      if (repeat === 'daily') return addDays(due, k);
      if (repeat === 'weekly') return addDays(due, 7 * k);
      if (repeat === 'monthly') return addMonths(due, k);
      return addMonths(due, 12 * k);
    };
    let k = 1;
    let next = step(k);
    while (next <= todayKey) next = step(++k);
    return next;
  }

  /** How a due day reads next to a task: Today, Tomorrow, Yesterday or a short date. */
  function dueInfo(due, todayKey) {
    if (!isDayKey(due)) return null;
    const overdue = due < todayKey;
    let label;
    if (due === todayKey) label = 'Today';
    else if (due === addDays(todayKey, 1)) label = 'Tomorrow';
    else if (due === addDays(todayKey, -1)) label = 'Yesterday';
    else {
      const sameYear = due.slice(0, 4) === todayKey.slice(0, 4);
      label = toUTC(due).toLocaleDateString('de-DE', Object.assign(
        { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }, sameYear ? {} : { year: 'numeric' }));
    }
    return { label, overdue, today: due === todayKey };
  }

  // ===== The entry among the lists =====
  function cleanTitle(value, max) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }

  function isMatrix(entry) {
    return !!entry && typeof entry === 'object' && (entry.type === TYPE || entry.id === MATRIX_ID);
  }

  function defaultEntry() {
    return { id: MATRIX_ID, type: TYPE, title: 'Matrix', areas: AREAS.map(a => ({ id: a.id, title: a.title })) };
  }

  /** Clean entry: the four areas in their order, each with a title (the default if none). */
  function normalizeEntry(entry) {
    const saved = isMatrix(entry) && Array.isArray(entry.areas) ? entry.areas : [];
    return {
      id: MATRIX_ID,
      type: TYPE,
      title: (isMatrix(entry) && cleanTitle(entry.title, MAX_TITLE)) || 'Matrix',
      areas: AREAS.map(area => {
        const own = saved.find(a => a && a.id === area.id);
        return { id: area.id, title: (own && cleanTitle(own.title, MAX_TITLE)) || area.title };
      })
    };
  }

  /** The list order with the matrix in it: first, until it is stored somewhere else. */
  function withMatrix(meta) {
    const list = Array.isArray(meta) ? meta : [];
    const index = list.findIndex(isMatrix);
    if (index === -1) return [defaultEntry()].concat(list);
    return list.map((entry, i) => (i === index ? normalizeEntry(entry) : entry));
  }

  /** The entry with one area renamed, or null when the title is empty. */
  function renameArea(entry, areaId, title) {
    const name = cleanTitle(title, MAX_TITLE);
    if (!name || !AREA_IDS.includes(areaId)) return null;
    const next = normalizeEntry(entry);
    next.areas = next.areas.map(a => (a.id === areaId ? { id: a.id, title: name } : a));
    return next;
  }

  function areaTitle(entry, areaId) {
    const area = normalizeEntry(entry).areas.find(a => a.id === areaId);
    return area ? area.title : '';
  }

  // ===== Tasks =====
  function newId(now) {
    return 't' + Math.floor(now).toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Valid tasks. Items without an id or area (e.g. added by an older version as a plain
   *  list) get a stable id from their position and land in "to do". */
  function normalizeTasks(items) {
    const out = [];
    const seen = new Set();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const raw = typeof item === 'string' ? { text: item } : item;
      if (!raw || typeof raw !== 'object') return;
      const text = cleanTitle(raw.text, MAX_TEXT);
      if (!text) return;
      let id = typeof raw.id === 'string' && raw.id ? raw.id : `item-${index}`;
      if (seen.has(id)) id = `${id}-${index}`;
      seen.add(id);
      const task = { id, text, done: !!raw.done, area: AREA_IDS.includes(raw.area) ? raw.area : 'todo' };
      const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE) : '';
      if (note) task.note = note;
      if (isDayKey(raw.due)) task.due = raw.due;
      if (task.due && REPEATS.includes(raw.repeat)) task.repeat = raw.repeat;
      out.push(task);
    });
    return out;
  }

  /**
   * Fields of the task sheet as a task: text needed; a repeating task needs a day, so it
   * gets today when none was chosen (as in Reminders). Returns { ok, task } or { ok: false }.
   */
  function buildTask(values, base, todayKey, now) {
    const text = cleanTitle(values && values.text, MAX_TEXT);
    if (!text) return { ok: false, error: 'text' };
    const area = AREA_IDS.includes(values.area) ? values.area : (base && base.area) || 'todo';
    const task = { id: base && base.id ? base.id : newId(now), text, done: !!(base && base.done), area };
    const note = typeof values.note === 'string' ? values.note.trim().slice(0, MAX_NOTE) : '';
    if (note) task.note = note;
    const repeat = REPEATS.includes(values.repeat) ? values.repeat : null;
    const due = isDayKey(values.due) ? values.due : (repeat ? todayKey : null);
    if (due) task.due = due;
    if (due && repeat) task.repeat = repeat;
    return { ok: true, task };
  }

  /**
   * Ticking a task: a repeating one moves on to its next day and stays open; any other is
   * done. Ticking a done task opens it again. Returns { task, repeated }.
   */
  function toggle(task, todayKey) {
    if (task.done) return { task: Object.assign({}, task, { done: false }), repeated: false };
    if (task.repeat && task.due) {
      return { task: Object.assign({}, task, { due: nextDue(task.due, task.repeat, todayKey) }), repeated: true };
    }
    return { task: Object.assign({}, task, { done: true }), repeated: false };
  }

  function openTasks(tasks, areaId) {
    return tasks.filter(t => t.area === areaId && !t.done);
  }

  function doneTasks(tasks, areaId) {
    return tasks.filter(t => t.area === areaId && t.done);
  }

  /** Replaces a task; a task moved to another area goes to the end of that area. */
  function replaceTask(tasks, task) {
    const index = tasks.findIndex(t => t.id === task.id);
    if (index === -1) return tasks.concat([task]);
    const out = tasks.slice();
    if (out[index].area !== task.area) {
      out.splice(index, 1);
      out.push(task);
    } else {
      out[index] = task;
    }
    return out;
  }

  function removeTask(tasks, id) {
    return tasks.filter(t => t.id !== id);
  }

  function clearDone(tasks, areaId) {
    return tasks.filter(t => !(t.area === areaId && t.done));
  }

  return {
    MATRIX_ID,
    TYPE,
    AREAS,
    REPEATS,
    REPEAT_LABELS,
    MAX_TITLE,
    MAX_TEXT,
    dayKey,
    isDayKey,
    addDays,
    nextDue,
    dueInfo,
    isMatrix,
    defaultEntry,
    normalizeEntry,
    withMatrix,
    renameArea,
    areaTitle,
    normalizeTasks,
    buildTask,
    toggle,
    openTasks,
    doneTasks,
    replaceTask,
    removeTask,
    clearDone
  };
});
