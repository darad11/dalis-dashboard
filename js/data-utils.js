/**
 * Shared, dependency-free helpers for app.js (browser) and the unit tests (Node).
 *
 * - escapeHtml: safe interpolation of user text into innerHTML templates
 * - fingerprint: compact hash of a value in the shape the cloud returns it,
 *   used to detect whether the cloud changed since this device last synced
 * - normalizeTime / goalIdentity: times of calendar entries and the key that tells
 *   two entries of one day apart (also used by js/supabase.js and js/calendar-core.js)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DataUtils = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
  }

  // JSON with recursively sorted object keys (JSONB does not preserve key order).
  function canonicalJson(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }

  // cyrb53: fast 53-bit string hash, plenty for change detection.
  function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  const SETTING_KEYS = ['habitChecks', 'customListsMeta', 'gymHubData', 'calendars', 'home'];

  // "HH:MM" for a valid wall-clock time ("HH:MM:SS" as Postgres returns a time column), else null.
  function normalizeTime(value) {
    if (typeof value !== 'string') return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d(\.\d+)?)?$/.exec(value.trim());
    return m ? `${m[1]}:${m[2]}` : null;
  }

  // Entries of one day with the same text are duplicates (old concurrent writes), unless
  // their time or calendar differs ("Meeting" at 10:00 and at 14:00 are two entries).
  function goalIdentity(goal) {
    if (typeof goal === 'string') return goal + '|||';
    return [goal.text, normalizeTime(goal.start) || '', normalizeTime(goal.end) || '', goal.calendarId || ''].join('|');
  }

  // Which cloud representation a localStorage key maps to (null = local-only key).
  function keyKind(key) {
    if (typeof key !== 'string') return null;
    if (key.startsWith('goals-') || key.startsWith('cal-')) return 'goals';
    if (key.startsWith('notes-') || key.startsWith('review-')) return 'notes';
    if (key.startsWith('week-') || key === 'backlog') return 'board';
    if (key === 'habits') return 'habits';
    if (SETTING_KEYS.includes(key)) return 'setting';
    if (key.startsWith('list-')) return 'list';
    return null;
  }

  function isSyncableKey(key) {
    return keyKind(key) !== null;
  }

  // Mirrors supabase.js setGoals + getAllGoals (fields kept, de-duplicated by goalIdentity).
  function normalizeGoals(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    value.forEach(goal => {
      if (goal === null || goal === undefined) return;
      const isText = typeof goal === 'string';
      const text = isText ? goal : goal.text;
      const identity = goalIdentity(goal);
      if (seen.has(identity)) return;
      seen.add(identity);
      const item = {
        text: text === undefined ? null : text,
        done: isText ? false : !!goal.done,
        priority: (!isText && goal.priority) || null,
        urgency: (!isText && goal.urgency) || null
      };
      // Only when set: entries without times keep the fingerprint they had before times existed
      if (!isText) {
        const start = normalizeTime(goal.start);
        const end = normalizeTime(goal.end);
        if (start) item.start = start;
        if (end) item.end = end;
        if (goal.calendarId) item.calendarId = goal.calendarId;
      }
      out.push(item);
    });
    return out;
  }

  // Mirrors setKanban/setBacklog (objects stored as JSON text) + getKanban/getBacklog.
  function normalizeBoard(value) {
    const out = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    Object.keys(value).sort().forEach(column => {
      const tasks = value[column];
      if (!Array.isArray(tasks) || tasks.length === 0) return;
      out[column] = tasks.map(task => {
        const text = typeof task === 'object' ? JSON.stringify(task) : String(task);
        if (text.startsWith('{')) {
          try { return JSON.parse(text); } catch (e) { return text; }
        }
        return text;
      });
    });
    return out;
  }

  function normalizeHabits(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(h => h !== null && h !== undefined).map(h => (
      typeof h === 'string' ? { name: h, color: '#6366f1' } : { name: h.name, color: h.color || '#6366f1' }
    ));
  }

  function normalizeForCompare(key, value) {
    switch (keyKind(key)) {
      case 'goals': return normalizeGoals(value);
      case 'notes': return value === null || value === undefined ? '' : String(value);
      case 'board': return normalizeBoard(value);
      case 'habits': return normalizeHabits(value);
      case 'list': return Array.isArray(value) ? value : [];
      case 'setting': return value === undefined ? null : value;
      default: return value === undefined ? null : value;
    }
  }

  function fingerprint(key, value) {
    return hashString(canonicalJson(normalizeForCompare(key, value)));
  }

  // True when the cloud holds nothing for this key (no rows / empty value).
  function isEmptyCloudValue(key, value) {
    const normalized = normalizeForCompare(key, value);
    if (normalized === null || normalized === '') return true;
    if (Array.isArray(normalized)) return normalized.length === 0;
    if (typeof normalized === 'object') return Object.keys(normalized).length === 0;
    return false;
  }

  return {
    escapeHtml,
    normalizeTime,
    goalIdentity,
    canonicalJson,
    hashString,
    keyKind,
    isSyncableKey,
    normalizeForCompare,
    fingerprint,
    isEmptyCloudValue
  };
});
