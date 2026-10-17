/**
 * Calendar entries with times and own calendars: data rules shared by the browser
 * (js/app.js, js/calendar-ui.js) and the unit tests (Node). No DOM access here.
 *
 * Entry (localStorage "cal-Y-M-D" arrays, cloud table goals):
 *   { text, done, priority, start?: "HH:MM", end?: "HH:MM", calendarId?: string }
 *   - no start  = all-day entry (every entry created before times existed)
 *   - start/end are local wall-clock times of that day; an entry never spans midnight
 *   - no calendarId, or one that no longer exists = the default calendar
 *
 * Calendars (settings key "calendars"): [{ id, name, color }], the default calendar first.
 * Colours are names of iOS system colours and white (see css/calendar.css for the values).
 */
(function (root, factory) {
  const DataUtils = (typeof module === 'object' && module.exports) ? require('./data-utils') : root.DataUtils;
  const api = factory(DataUtils);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalendarCore = api;
})(typeof self !== 'undefined' ? self : this, function (DataUtils) {
  'use strict';

  const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'white'];
  const COLOR_LABELS = {
    red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', brown: 'Brown',
    white: 'White'
  };
  const DEFAULT_ID = 'default';
  const DEFAULT_CALENDAR = Object.freeze({ id: DEFAULT_ID, name: 'Personal', color: 'blue' });
  const MAX_NAME = 60;
  const LAST_MINUTE = 23 * 60 + 59;

  const normalizeTime = DataUtils.normalizeTime;

  function toMinutes(time) {
    const t = normalizeTime(time);
    return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null;
  }

  function fromMinutes(minutes) {
    const m = Math.max(0, Math.min(LAST_MINUTE, Math.round(minutes)));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  // ------------------------------------------------------------ calendars

  /** Valid calendar list: default calendar first, unique ids, known colours, non-empty names. */
  function normalizeCalendars(value) {
    const list = Array.isArray(value) ? value : [];
    const out = [];
    const seen = new Set();
    list.forEach(cal => {
      if (!cal || typeof cal !== 'object' || typeof cal.id !== 'string' || !cal.id || seen.has(cal.id)) return;
      seen.add(cal.id);
      const name = typeof cal.name === 'string' ? cal.name.trim().slice(0, MAX_NAME) : '';
      out.push({
        id: cal.id,
        name: name || (cal.id === DEFAULT_ID ? DEFAULT_CALENDAR.name : 'Calendar'),
        color: COLORS.includes(cal.color) ? cal.color : DEFAULT_CALENDAR.color
      });
    });
    const defaultIndex = out.findIndex(c => c.id === DEFAULT_ID);
    if (defaultIndex === -1) out.unshift(Object.assign({}, DEFAULT_CALENDAR));
    else if (defaultIndex > 0) out.unshift(out.splice(defaultIndex, 1)[0]);
    return out;
  }

  /** The calendar an entry belongs to (unknown or missing id = default calendar). */
  function calendarOf(calendars, entry) {
    const id = entry && typeof entry === 'object' ? entry.calendarId : null;
    return calendars.find(c => c.id === id) || calendars.find(c => c.id === DEFAULT_ID) || DEFAULT_CALENDAR;
  }

  function newCalendarId(existing, random) {
    const rnd = random || Math.random;
    const ids = new Set((existing || []).map(c => c.id));
    for (;;) {
      const id = 'cal-' + Math.floor(rnd() * 0x7fffffff).toString(36) + Date.now().toString(36).slice(-4);
      if (!ids.has(id)) return id;
    }
  }

  // --------------------------------------------------------------- entries

  function entryObject(entry) {
    return typeof entry === 'string' ? { text: entry, done: false, priority: null } : entry;
  }

  function isTimed(entry) {
    const e = entryObject(entry);
    return !!(e && normalizeTime(e.start));
  }

  /**
   * Indices of the entries in display order: all-day entries first in their stored order
   * (they can be reordered by drag & drop), then timed entries by start and end time.
   * Rendering keeps the stored index, so edits and deletes hit the right entry.
   */
  function displayOrder(entries) {
    const list = Array.isArray(entries) ? entries : [];
    return list
      .map((entry, index) => ({ entry: entryObject(entry), index }))
      .filter(item => item.entry && typeof item.entry === 'object')
      .sort((a, b) => {
        const sa = toMinutes(a.entry.start);
        const sb = toMinutes(b.entry.start);
        if (sa === null || sb === null) {
          if (sa === null && sb === null) return a.index - b.index;
          return sa === null ? -1 : 1;
        }
        if (sa !== sb) return sa - sb;
        const ea = toMinutes(a.entry.end);
        const eb = toMinutes(b.entry.end);
        if (ea !== eb) return (ea === null ? sa : ea) - (eb === null ? sb : eb);
        return a.index - b.index;
      })
      .map(item => item.index);
  }

  /** "14:00–15:30", "14:00" (no or equal end) or "" (all-day). */
  function formatRange(entry) {
    const e = entryObject(entry);
    const start = e && normalizeTime(e.start);
    if (!start) return '';
    const end = normalizeTime(e.end);
    return end && end !== start ? `${start}–${end}` : start;
  }

  /** Distinct calendar colours of a day's entries, in display order (for the month grid). */
  function dayColors(entries, calendars, max) {
    const limit = max || 3;
    const colors = [];
    displayOrder(entries).forEach(index => {
      const color = calendarOf(calendars, entryObject(entries[index])).color;
      if (!colors.includes(color) && colors.length < limit) colors.push(color);
    });
    return colors;
  }

  /**
   * Start and end proposed when an entry gets a time: the next full hour for today
   * (as in Apple Calendar), 09:00 for other days; one hour long, never past midnight.
   */
  function defaultTimes(day, now) {
    const current = now instanceof Date ? now : new Date();
    const isToday = day instanceof Date && day.getFullYear() === current.getFullYear() &&
      day.getMonth() === current.getMonth() && day.getDate() === current.getDate();
    const start = isToday ? Math.min((current.getHours() + 1) * 60, 23 * 60) : 9 * 60;
    return { start: fromMinutes(start), end: fromMinutes(Math.min(start + 60, LAST_MINUTE)) };
  }

  /** New end after the start moved: the duration is kept (as in Apple Calendar). */
  function shiftEnd(oldStart, oldEnd, newStart) {
    const s0 = toMinutes(oldStart);
    const e0 = toMinutes(oldEnd);
    const s1 = toMinutes(newStart);
    if (s1 === null) return normalizeTime(oldEnd);
    const duration = s0 !== null && e0 !== null && e0 >= s0 ? e0 - s0 : 60;
    return fromMinutes(Math.min(s1 + duration, LAST_MINUTE));
  }

  /**
   * Checks an entry from the editor. Returns { ok, entry, error } where entry contains only
   * the fields that are set (untimed entries carry no start/end, the default calendar no id).
   */
  function buildEntry(input, base) {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) return { ok: false, error: 'title' };
    const entry = Object.assign({}, base || { done: false, priority: null });
    entry.text = text;
    entry.priority = ['high', 'medium', 'low'].includes(input.priority) ? input.priority : null;
    delete entry.start;
    delete entry.end;
    if (!input.allDay) {
      const start = normalizeTime(input.start);
      const end = normalizeTime(input.end);
      if (!start) return { ok: false, error: 'start' };
      if (!end || toMinutes(end) < toMinutes(start)) return { ok: false, error: 'end' };
      entry.start = start;
      entry.end = end;
    }
    if (input.calendarId && input.calendarId !== DEFAULT_ID) entry.calendarId = input.calendarId;
    else delete entry.calendarId;
    return { ok: true, entry };
  }

  return {
    COLORS,
    COLOR_LABELS,
    DEFAULT_ID,
    DEFAULT_CALENDAR,
    normalizeTime,
    toMinutes,
    fromMinutes,
    normalizeCalendars,
    calendarOf,
    newCalendarId,
    isTimed,
    displayOrder,
    formatRange,
    dayColors,
    defaultTimes,
    shiftEnd,
    buildEntry
  };
});
