/**
 * Step Challenge card in the Health Hub: local storage, cloud sync and UI.
 *
 * - Calculations: js/steps-core.js (unit-tested in Node)
 * - Daily values: table step_entries, one row per user and day
 *   (migrations/2026-10-16_step_entries.sql)
 * - Challenge settings (goal, start value, last year): settings key "stepChallenge"
 *
 * Every change is written to localStorage first (per user), then uploaded.
 * Per day the newest change wins (updated_at); a database trigger enforces the
 * same rule, so an older upload can never overwrite a newer value.
 */
(function () {
  'use strict';

  const Core = window.StepCore;
  if (!Core) {
    console.error('[Steps] js/steps-core.js not loaded');
    return;
  }

  const SETTING_KEY = 'stepChallenge';
  const STORAGE_PREFIX = 'stepChallenge.v1';
  const UI_PREFS_KEY = 'stepChallenge.ui';
  const RETRY_MS = 60000;

  // Values from the last manual calculation (handover, 15 Oct 2026). They only
  // pre-fill the setup form; nothing is shown as a current value until confirmed.
  const SETUP_SUGGESTION = { year: 2026, baselineSteps: 2223411, baselineDate: '2026-10-15', previousYearTotal: 4018404 };

  const INPUT_ERRORS = {
    empty: () => 'Enter a number of steps.',
    negative: () => 'Steps cannot be negative.',
    decimal: () => 'Use whole steps without decimals, e.g. 12.345.',
    format: () => 'Only digits are allowed, e.g. 12345 or 12.345.',
    too_large: (max) => `That is more than ${Core.formatSteps(max)} – please check the number.`
  };

  const HEAT_BUCKETS = [5000, 10000, 15000, 20000, 25000]; // 6 classes: <5k … 25k+

  const state = {
    userId: null,
    started: false,
    config: null,      // { version, years: { 'YYYY': cfg }, updatedAt, pending? }
    entries: {},       // { 'YYYY-MM-DD': { steps, updatedAt, deleted?, pending? } }
    cloud: 'idle',     // idle | syncing | ok | offline | missing_table | error
    cloudMessage: '',
    lastSyncAt: 0,
    syncRunning: null,
    syncAgain: false,
    syncTimer: null,
    retryTimer: null,
    midnightTimer: null,
    channel: null,
    renderedDay: null,
    // UI
    root: null,
    editingSettings: false,
    selectedDate: null,  // null = today
    calendarMonth: null, // 'YYYY-MM'
    detailsOpen: false,
    tableOpen: false,
    draft: {},           // unsaved text in inputs, survives re-renders
    entryInvalid: false,
    focusField: null,
    message: null,       // { text, kind: 'ok'|'error'|'info', undo?: bool }
    lastChange: null,    // { date, previous } for undo
    postRender: [],
    resizeObserver: null,
    lastWidth: 0,
    health: freshHealthState()
  };

  // Apple Health Shortcut (upload keys); the new key lives only in memory until "Done"
  function freshHealthState() {
    return { open: false, keys: null, problem: null, error: null, busy: false, newKey: null, copied: null, loaded: false, reloadTimer: null };
  }

  // ===== Storage =====
  function storageKey(name) {
    return `${STORAGE_PREFIX}.${state.userId}.${name}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[Steps] Could not save', key, e);
      return false;
    }
  }

  function loadLocal() {
    const cfg = readJson(storageKey('config'), null);
    state.config = cfg && typeof cfg === 'object' && cfg.years && typeof cfg.years === 'object' ? cfg : null;

    state.entries = {};
    const raw = readJson(storageKey('entries'), {});
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(date => {
        const e = raw[date];
        if (!Core.isValidDateKey(date) || !e || typeof e !== 'object') return;
        if (!Number.isInteger(e.steps) || e.steps < 0 || e.steps > Core.MAX_DAILY_STEPS) return;
        if (!Number.isFinite(e.updatedAt)) return;
        state.entries[date] = e;
      });
    }

    const prefs = readJson(UI_PREFS_KEY, {}) || {};
    state.detailsOpen = !!prefs.detailsOpen;
  }

  function saveUiPrefs() {
    writeJson(UI_PREFS_KEY, { detailsOpen: state.detailsOpen });
  }

  function today() {
    return Core.toDateKey(new Date());
  }

  function yearConfig(year) {
    return state.config && state.config.years ? state.config.years[String(year)] || null : null;
  }

  function pendingCount() {
    let n = 0;
    Object.keys(state.entries).forEach(date => { if (state.entries[date].pending) n++; });
    if (state.config && state.config.pending) n++;
    return n;
  }

  // ===== Local changes =====
  function editableError(date) {
    if (!Core.isValidDateKey(date)) return 'Please choose a valid day.';
    if (date > today()) return 'Future days cannot be logged yet.';
    const year = Core.yearOf(date);
    const cfg = yearConfig(year);
    if (!cfg) return `Set up the challenge for ${year} first.`;
    if (date <= cfg.baselineDate) {
      return `${Core.formatDay(date)} is already included in your start value (up to ${Core.formatDay(cfg.baselineDate)}). ` +
        'Change the start value in the settings instead.';
    }
    return null;
  }

  function writeEntry(date, next) {
    const previous = state.entries[date] ? Object.assign({}, state.entries[date]) : null;
    state.entries[date] = next;
    if (!writeJson(storageKey('entries'), state.entries)) {
      if (previous) state.entries[date] = previous;
      else delete state.entries[date];
      return { ok: false, error: 'Could not save on this device (storage full or blocked). Nothing was changed.' };
    }
    return { ok: true, previous };
  }

  function nextVersion(date) {
    const current = state.entries[date];
    // Monotonic per day, even if the device clock jumps back
    return Math.max(Date.now(), current ? current.updatedAt + 1 : 0);
  }

  function saveEntry(date, steps) {
    const error = editableError(date);
    if (error) return { ok: false, error };
    const result = writeEntry(date, { steps, updatedAt: nextVersion(date), pending: true });
    if (result.ok) afterLocalChange();
    return result;
  }

  function clearEntry(date) {
    const error = editableError(date);
    if (error) return { ok: false, error };
    // Tombstone instead of deleting, so other devices learn about the removal
    const result = writeEntry(date, { steps: 0, deleted: true, updatedAt: nextVersion(date), pending: true });
    if (result.ok) afterLocalChange();
    return result;
  }

  function undoLastChange() {
    const change = state.lastChange;
    if (!change) return;
    state.lastChange = null;
    const prev = change.previous;
    const restored = prev && !prev.deleted
      ? { steps: prev.steps, updatedAt: nextVersion(change.date), pending: true }
      : { steps: 0, deleted: true, updatedAt: nextVersion(change.date), pending: true };
    const result = writeEntry(change.date, restored);
    state.message = result.ok
      ? { text: `Undone – ${Core.formatDay(change.date)} is back to ${prev && !prev.deleted ? Core.formatSteps(prev.steps) + ' steps' : 'not logged'}.`, kind: 'info' }
      : { text: result.error, kind: 'error' };
    state.draft = {};
    if (result.ok) afterLocalChange();
    else render();
  }

  function saveYearConfig(year, values) {
    const invalid = Core.validateYearConfig(values, year);
    if (invalid) return { ok: false, field: invalid };
    const next = state.config ? JSON.parse(JSON.stringify(state.config)) : { version: 1, years: {} };
    const existing = next.years[String(year)];
    next.years[String(year)] = {
      goal: values.goal,
      baselineSteps: values.baselineSteps,
      baselineDate: values.baselineDate,
      previousYearTotal: values.previousYearTotal,
      confirmedAt: existing && existing.confirmedAt ? existing.confirmedAt : Date.now()
    };
    next.updatedAt = Math.max(Date.now(), state.config && state.config.updatedAt ? state.config.updatedAt + 1 : 0);
    next.pending = true;
    if (!writeJson(storageKey('config'), next)) return { ok: false, field: 'storage' };
    state.config = next;
    afterLocalChange();
    return { ok: true };
  }

  function afterLocalChange() {
    notifyGlobalStatus();
    render();
    scheduleSync(400);
  }

  function notifyGlobalStatus() {
    if (typeof window.updateSyncStatus === 'function') window.updateSyncStatus();
    else if (typeof updateSyncStatus === 'function') updateSyncStatus(); // eslint-disable-line no-undef
  }

  // ===== Cloud sync =====
  function canSync() {
    return !!(state.userId && window.supabaseDB && window.currentUserId === state.userId &&
      typeof window.supabaseDB.getStepEntries === 'function');
  }

  function classifyError(err) {
    const code = err && err.code ? String(err.code) : '';
    const message = String((err && (err.message || err.error)) || err || '');
    if (code === 'PGRST205' || code === '42P01' ||
      (/step_entries/.test(message) && /does not exist|schema cache|could not find/i.test(message))) return 'missing_table';
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(message) || navigator.onLine === false) return 'offline';
    return 'error';
  }

  function setCloudProblem(err) {
    state.cloud = classifyError(err);
    state.cloudMessage = String((err && (err.message || err.error)) || err || 'Unknown error');
    if (state.cloud !== 'missing_table') console.warn('[Steps] Sync problem:', state.cloud, err);
  }

  function scheduleSync(delay) {
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(() => { sync(); }, delay || 0);
  }

  function sync() {
    if (!canSync()) return Promise.resolve();
    if (state.syncRunning) {
      state.syncAgain = true;
      return state.syncRunning;
    }
    state.syncRunning = (async () => {
      try {
        do {
          state.syncAgain = false;
          const before = snapshotSignature();
          state.cloud = 'syncing';
          renderSyncStatus();
          await syncConfig();
          if (state.cloud === 'syncing' || state.cloud === 'ok') await syncEntries();
          if (state.cloud === 'syncing') state.cloud = 'ok';
          if (state.cloud === 'ok') state.lastSyncAt = Date.now();
          if (state.cloud === 'ok' && !state.health.loaded) {
            state.health.loaded = true;
            loadHealthKeys();
          }
          if (snapshotSignature() !== before) render();
        } while (state.syncAgain);
      } catch (e) {
        setCloudProblem(e);
      } finally {
        state.syncRunning = null;
        renderSyncStatus();
        notifyGlobalStatus();
        scheduleRetry();
      }
    })();
    return state.syncRunning;
  }

  // Changes that affect what the card shows (pending flags excluded)
  function snapshotSignature() {
    const parts = Object.keys(state.entries).sort().map(d => {
      const e = state.entries[d];
      return `${d}:${e.deleted ? 'x' : e.steps}`;
    });
    return JSON.stringify([state.config && state.config.years, parts]);
  }

  function scheduleRetry() {
    clearTimeout(state.retryTimer);
    if (pendingCount() > 0 && state.cloud !== 'missing_table') {
      state.retryTimer = setTimeout(() => sync(), RETRY_MS);
    }
  }

  function stripPending(config) {
    const copy = JSON.parse(JSON.stringify(config));
    delete copy.pending;
    return copy;
  }

  async function syncConfig() {
    const res = await window.supabaseDB.fetchSetting(SETTING_KEY);
    if (!res.ok) {
      setCloudProblem(res.error);
      return;
    }
    const remote = res.exists && res.value && typeof res.value === 'object' && res.value.years ? res.value : null;
    const local = state.config;

    if (remote && (!local || (remote.updatedAt || 0) > (local.updatedAt || 0))) {
      // A newer configuration from another device wins
      state.config = stripPending(remote);
      writeJson(storageKey('config'), state.config);
      return;
    }
    if (local && (local.pending || !remote || (local.updatedAt || 0) > (remote.updatedAt || 0))) {
      const payload = stripPending(local);
      const err = await window.supabaseDB.setSetting(SETTING_KEY, payload);
      if (err) {
        setCloudProblem(err);
        return;
      }
      if (state.config && state.config.updatedAt === local.updatedAt) {
        delete state.config.pending;
        writeJson(storageKey('config'), state.config);
      }
    }
  }

  async function syncEntries() {
    const res = await window.supabaseDB.getStepEntries();
    if (res.error) {
      setCloudProblem(res.error);
      return;
    }
    mergeRows(res.data || [], true);
    await pushPending();
    subscribeRealtime();
  }

  // fullList: rows are the complete cloud state, so local days missing there get uploaded
  function mergeRows(rows, fullList) {
    const seen = new Set();
    const conflicts = [];
    rows.forEach(row => {
      if (!row || !Core.isValidDateKey(row.date)) return;
      const remote = Core.rowToRemote(row);
      if (!Number.isFinite(remote.updatedAt)) return;
      seen.add(row.date);
      const local = state.entries[row.date];
      const merged = Core.mergeRemoteEntry(local, remote);
      if (merged.conflict) conflicts.push({ date: row.date, mine: Core.activeSteps(local), theirs: Core.activeSteps(merged.entry) });
      state.entries[row.date] = merged.entry;
    });
    if (fullList) {
      Object.keys(state.entries).forEach(date => {
        if (!seen.has(date) && !state.entries[date].pending) state.entries[date].pending = true;
      });
    }
    writeJson(storageKey('entries'), state.entries);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      const describe = (v) => v === null ? 'not logged' : `${Core.formatSteps(v)} steps`;
      state.message = {
        text: `${Core.formatDay(c.date)} was changed on another device in the meantime: kept ${describe(c.theirs)} instead of ${describe(c.mine)}.` +
          (conflicts.length > 1 ? ` (${conflicts.length - 1} more day(s) affected)` : ''),
        kind: 'info'
      };
    }
  }

  async function pushPending() {
    const dates = Object.keys(state.entries).filter(d => state.entries[d].pending);
    if (dates.length === 0) return;
    const sent = dates.map(d => ({ date: d, updatedAt: state.entries[d].updatedAt }));
    const rows = dates.map(d => Core.entryToRow(d, state.entries[d]));

    const res = await window.supabaseDB.upsertStepEntries(rows);
    if (res.error) {
      setCloudProblem(res.error);
      return;
    }
    const applied = new Map((res.data || []).map(r => [r.date, Core.rowToRemote(r)]));
    let rejected = false;
    sent.forEach(({ date, updatedAt }) => {
      const row = applied.get(date);
      if (!row) {
        rejected = true; // the cloud kept a newer value for this day
        return;
      }
      const entry = state.entries[date];
      if (entry && entry.updatedAt === updatedAt && row.updatedAt === updatedAt) delete entry.pending;
    });
    writeJson(storageKey('entries'), state.entries);

    if (rejected) {
      const again = await window.supabaseDB.getStepEntries();
      if (again.error) setCloudProblem(again.error);
      else mergeRows(again.data || [], false);
    }
  }

  function subscribeRealtime() {
    if (state.channel || typeof window.supabaseDB.subscribeToStepEntries !== 'function') return;
    state.channel = window.supabaseDB.subscribeToStepEntries(payload => {
      const before = snapshotSignature();
      if (payload.eventType === 'DELETE') {
        const date = payload.old && payload.old.date;
        if (date && state.entries[date] && !state.entries[date].pending) {
          delete state.entries[date];
          writeJson(storageKey('entries'), state.entries);
        }
      } else if (payload.new && payload.new.date) {
        mergeRows([payload.new], false);
      }
      if (snapshotSignature() !== before) render();
      notifyGlobalStatus();
      if (state.health.keys && state.health.keys.length > 0) scheduleHealthReload();
    });
  }

  // Used by "This device → cloud" and backup import: re-upload everything
  async function uploadAll() {
    if (!canSync()) return { error: 'Not signed in' };
    Object.keys(state.entries).forEach(date => { state.entries[date].pending = true; });
    writeJson(storageKey('entries'), state.entries);
    if (state.config) {
      state.config.pending = true;
      writeJson(storageKey('config'), state.config);
    }
    await sync();
    if (state.cloud === 'ok' && pendingCount() === 0) return { error: null };
    return { error: syncSummary() };
  }

  function syncSummary() {
    const pending = pendingCount();
    switch (state.cloud) {
      case 'missing_table':
        return `stored on this device only – cloud table missing (run migrations/2026-10-16_step_entries.sql)${pending ? `, ${pending} change(s) waiting` : ''}`;
      case 'offline':
        return `offline – ${pending} change(s) saved on this device, uploads automatically`;
      case 'error':
        return `sync failed (${state.cloudMessage}) – saved on this device, retrying`;
      case 'syncing':
        return 'syncing…';
      default:
        if (pending > 0) return `${pending} change(s) waiting for upload`;
        return state.lastSyncAt ? 'all changes are in the cloud' : 'saved on this device';
    }
  }

  // ===== Apple Health: automatic upload by an iOS Shortcut =====
  // A web page cannot read Apple Health; a Shortcut on the iPhone can. It reads the day's
  // steps and posts them to the Edge Function "health-steps" with a personal upload key
  // (supabase/functions/health-steps, migrations/2026-10-16_step_health_sync.sql). The key
  // is made here from 32 random bytes; only its SHA-256 hash goes to the database. The key
  // itself is shown once for the Shortcut and never stored. Uploads arrive like changes
  // from another device (realtime); a lower count never replaces a higher one.
  const HEALTH_KEY_LABEL = 'iPhone Shortcut';
  const HEALTH_MAX_KEYS = 5;
  const HEALTH_GUIDE_URL = 'https://github.com/darad11/dalis-dashboard/blob/main/docs/STEP_CHALLENGE.md#automatisch-aus-apple-health';

  function base64Url(bytes) {
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  function healthSupported() {
    return canSync() && typeof window.supabaseDB.listStepUploadTokens === 'function' &&
      !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
  }

  function healthProblem(err) {
    const kind = classifyError(err);
    const code = err && err.code ? String(err.code) : '';
    const message = String((err && (err.message || err.error)) || '');
    if (code === 'PGRST205' || code === '42P01' || /step_upload_tokens/.test(message)) return 'missing';
    return kind === 'offline' ? 'offline' : 'error';
  }

  function healthSignature() {
    const hs = state.health;
    return JSON.stringify([hs.problem, hs.keys && hs.keys.map(k => [k.id, k.last_used_at])]);
  }

  async function loadHealthKeys() {
    if (!healthSupported()) return;
    const before = healthSignature();
    const res = await window.supabaseDB.listStepUploadTokens();
    if (res.error) {
      state.health.problem = healthProblem(res.error);
      if (state.health.problem !== 'offline') state.health.keys = null;
    } else {
      state.health.problem = null;
      state.health.keys = Array.isArray(res.data) ? res.data : [];
    }
    if (healthSignature() !== before) render();
  }

  // An upload just arrived: refresh "last upload" (once, after a burst of changes)
  function scheduleHealthReload() {
    clearTimeout(state.health.reloadTimer);
    state.health.reloadTimer = setTimeout(loadHealthKeys, 1500);
  }

  async function createHealthKey() {
    const hs = state.health;
    if (hs.busy) return;
    hs.busy = true;
    hs.error = null;
    render();
    try {
      const key = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      const res = await window.supabaseDB.createStepUploadToken(await sha256Hex(key), HEALTH_KEY_LABEL);
      if (res.error) {
        const message = String(res.error.message || '');
        hs.error = /at most 5/i.test(message)
          ? `You already have ${HEALTH_MAX_KEYS} upload keys – revoke one first.`
          : healthProblem(res.error) === 'missing'
            ? 'Not available yet: the database update for it is missing.'
            : 'Could not create the key – check the connection and try again.';
      } else {
        hs.newKey = key;
        hs.keys = (hs.keys || []).concat(res.data ? [res.data] : []);
      }
    } catch (e) {
      hs.error = 'Could not create the key in this browser.';
    } finally {
      hs.busy = false;
      render();
    }
  }

  async function revokeHealthKey(key) {
    const confirmText = 'The Shortcut with this key can no longer upload steps. Steps that were already uploaded stay.';
    const ok = typeof window.showConfirmModal === 'function'
      ? await window.showConfirmModal('Revoke Upload Key', confirmText, { confirmLabel: 'Revoke' })
      : window.confirm(confirmText);
    if (!ok) return;
    const res = await window.supabaseDB.deleteStepUploadToken(key.id);
    state.health.error = res.error ? 'Could not revoke the key – check the connection and try again.' : null;
    if (!res.error) state.health.newKey = null; // its Shortcut (if just set up) stops working too
    await loadHealthKeys();
    render();
  }

  async function copyText(text, which, input) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      if (input) {
        input.focus();
        input.select();
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      }
    }
    state.health.copied = ok ? which : null;
    render();
    if (ok) {
      setTimeout(() => {
        if (state.health.copied === which) {
          state.health.copied = null;
          render();
        }
      }, 2000);
    }
  }

  // "today, 18:02", "yesterday, 21:00", "14.10.2026, 09:12"
  function formatMoment(iso) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return '';
    const day = Core.toDateKey(t);
    const time = t.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    if (day === today()) return `today, ${time}`;
    if (day === Core.addDays(today(), -1)) return `yesterday, ${time}`;
    return `${Core.formatDay(day)}, ${time}`;
  }

  // ===== DOM helpers (all dynamic text goes through textContent) =====
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(key => {
        const value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'style') Object.assign(el.style, value);
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else el.setAttribute(key, value === true ? '' : String(value));
      });
    }
    children.flat(Infinity).forEach(child => {
      if (child === null || child === undefined || child === false) return;
      el.append(child instanceof Node ? child : String(child));
    });
    return el;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(key => {
      const value = attrs[key];
      if (value === null || value === undefined) return;
      if (key === 'text') el.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, String(value));
    });
    children.flat(Infinity).forEach(child => { if (child) el.append(child); });
    return el;
  }

  // ===== Rendering =====
  function render() {
    const root = state.root;
    if (!root) return;
    const todayKey = today();
    state.renderedDay = todayKey;
    const year = Core.yearOf(todayKey);
    const cfg = yearConfig(year);

    hideTooltip();
    state.postRender = [];
    // Removing a focused input fires focusout in some browsers: remember it first
    const keepFocus = state.focusField;
    const selection = typingSelection();
    const showSetup = !cfg || state.editingSettings;
    root.replaceChildren(
      renderHeader(year, cfg),
      showSetup ? renderSetup(year, cfg, todayKey) : renderMain(cfg, todayKey),
      h('div', { class: 'step-tooltip', role: 'tooltip', hidden: true })
    );
    state.focusField = keepFocus;
    restoreFocus(selection);
    state.postRender.forEach(fn => fn());
    renderSyncStatus();
    // Home (js/home-ui.js) shows today's steps and re-renders on this
    window.dispatchEvent(new CustomEvent('dashboard:datachange', { detail: { key: 'steps' } }));
  }

  function renderHeader(year, cfg) {
    return h('div', { class: 'step-card-header' },
      h('h3', { id: 'stepChallengeTitle', class: 'step-card-title' },
        h('span', { 'aria-hidden': 'true' }, '👟 '),
        `Step Challenge ${year}`),
      cfg ? h('span', { class: 'step-sync-badge', 'data-role': 'sync-badge' }) : null,
      cfg && !state.editingSettings
        ? h('button', {
          type: 'button',
          class: 'step-icon-btn',
          'aria-label': 'Challenge settings',
          title: 'Challenge settings',
          onclick: () => { state.editingSettings = true; state.draft = {}; render(); }
        }, '⚙️')
        : null
    );
  }

  function renderSyncStatus() {
    if (!state.root) return;
    const badge = state.root.querySelector('[data-role="sync-badge"]');
    if (!badge) return;
    const pending = pendingCount();
    let kind = 'ok';
    let label = 'Synced';
    if (!canSync()) { kind = 'local'; label = 'On this device'; }
    else if (state.cloud === 'syncing') { kind = 'busy'; label = 'Syncing…'; }
    else if (state.cloud === 'missing_table') { kind = 'warn'; label = 'Device only'; }
    else if (state.cloud === 'offline') { kind = 'warn'; label = 'Offline'; }
    else if (state.cloud === 'error') { kind = 'error'; label = 'Sync error'; }
    else if (pending > 0) { kind = 'busy'; label = 'Upload pending'; }
    else if (!state.lastSyncAt) { kind = 'local'; label = 'Saved'; }
    badge.className = `step-sync-badge step-sync-${kind}`;
    badge.textContent = label;
    badge.title = `Steps: ${syncSummary()}`;
  }

  // ----- Setup / settings -----
  function suggestionFor(year, cfg) {
    if (cfg) return cfg;
    const previousCfg = yearConfig(year - 1);
    const previousTotal = previousCfg ? Core.yearTotal(previousCfg, state.entries, year - 1) : null;
    if (year === SETUP_SUGGESTION.year) {
      return {
        baselineSteps: SETUP_SUGGESTION.baselineSteps,
        baselineDate: SETUP_SUGGESTION.baselineDate,
        previousYearTotal: SETUP_SUGGESTION.previousYearTotal,
        goal: SETUP_SUGGESTION.previousYearTotal + 1
      };
    }
    return {
      baselineSteps: 0,
      baselineDate: `${year - 1}-12-31`,
      previousYearTotal: previousTotal,
      goal: previousTotal !== null ? previousTotal + 1 : null
    };
  }

  function renderSetup(year, cfg, todayKey) {
    const form = renderSetupForm(year, cfg, todayKey);
    const previousCfg = yearConfig(year - 1);
    if (cfg || !previousCfg) return form;

    // New year: show how last year ended and keep its last days editable
    const total = Core.yearTotal(previousCfg, state.entries, year - 1);
    const record = previousCfg.previousYearTotal;
    let verdict = '';
    if (Number.isInteger(record)) {
      verdict = total > record
        ? ` – record beaten by ${Core.formatSteps(total - record)} 🎉`
        : ` – ${Core.formatSteps(record - total + 1)} short of the record`;
    }
    return h('div', { class: 'step-main' },
      h('p', { class: 'step-year-summary' }, `${year - 1} finished with ${Core.formatSteps(total)} steps${verdict}.`),
      form,
      h('p', { class: 'step-setup-hint' }, `Missing a day of ${year - 1}? You can still log it here:`),
      renderEntryForm(todayKey));
  }

  function renderSetupForm(year, cfg, todayKey) {
    const s = suggestionFor(year, cfg);
    const isEdit = !!cfg;
    const field = (name, fallback) => (state.draft[name] !== undefined ? state.draft[name] : fallback);
    const numberText = (n) => (n === null || n === undefined ? '' : Core.formatSteps(n));
    const ids = { steps: 'step-setup-baseline', date: 'step-setup-date', prev: 'step-setup-previous', goal: 'step-setup-goal' };

    const errorBox = h('p', { class: 'step-form-error', role: 'alert', hidden: true });
    const goalInput = h('input', {
      id: ids.goal, class: 'step-input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      value: field('goal', state.draft.goalAuto !== undefined ? state.draft.goalAuto : numberText(s.goal)),
      dataset: { keep: 'goal' }
    });
    const prevInput = h('input', {
      id: ids.prev, class: 'step-input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      value: field('prev', numberText(s.previousYearTotal)), dataset: { keep: 'prev' }
    });
    // Goal follows "record + 1" until the user edits it (kept as a draft across re-renders)
    prevInput.addEventListener('input', () => {
      if (state.draft.goal !== undefined) return;
      const parsed = Core.parseStepInput(prevInput.value, { max: Core.MAX_TOTAL_STEPS });
      if (parsed.ok) {
        goalInput.value = Core.formatSteps(parsed.value + 1);
        state.draft.goalAuto = goalInput.value;
      }
    });

    const form = h('form', { class: 'step-setup', novalidate: true },
      h('p', { class: 'step-setup-intro' }, isEdit
        ? 'Adjust your challenge. Daily entries stay as they are; all numbers are recalculated.'
        : (year === SETUP_SUGGESTION.year
          ? 'Beat last year\'s record. These values come from your last calculation – please check them. Nothing is counted until you confirm.'
          : `New year, new challenge. Check the values for ${year} – nothing is counted until you confirm.`)),
      h('div', { class: 'step-setup-grid' },
        h('label', { class: 'step-field', for: ids.steps },
          h('span', { class: 'step-field-label' }, `Steps in ${year} so far`),
          h('input', {
            id: ids.steps, class: 'step-input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
            value: field('steps', numberText(s.baselineSteps)), dataset: { keep: 'steps' }
          })),
        h('label', { class: 'step-field', for: ids.date },
          h('span', { class: 'step-field-label' }, 'up to and including'),
          h('input', {
            id: ids.date, class: 'step-input', type: 'date',
            min: `${year - 1}-12-31`, max: todayKey,
            value: field('date', s.baselineDate), dataset: { keep: 'date' }
          })),
        h('label', { class: 'step-field', for: ids.prev },
          h('span', { class: 'step-field-label' }, `Steps in ${year - 1} (record)`),
          prevInput),
        h('label', { class: 'step-field', for: ids.goal },
          h('span', { class: 'step-field-label' }, `Goal for ${year}`),
          goalInput)
      ),
      h('p', { class: 'step-setup-hint' },
        `Daily entries are counted from the day after this date. To start from zero, use 0 steps up to 31.12.${year - 1}.`),
      errorBox,
      h('div', { class: 'step-setup-actions' },
        isEdit ? h('button', {
          type: 'button', class: 'btn step-btn-secondary',
          onclick: () => { state.editingSettings = false; state.draft = {}; render(); }
        }, 'Cancel') : null,
        h('button', { type: 'submit', class: 'btn step-btn-primary' }, isEdit ? 'Save changes' : 'Confirm & start')
      )
    );

    form.addEventListener('input', (e) => {
      if (e.target.dataset && e.target.dataset.keep) state.draft[e.target.dataset.keep] = e.target.value;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const read = (id) => form.querySelector('#' + id).value;
      const big = { max: Core.MAX_TOTAL_STEPS };
      const baseline = Core.parseStepInput(read(ids.steps), big);
      const previous = read(ids.prev).trim() === '' ? { ok: true, value: null } : Core.parseStepInput(read(ids.prev), big);
      const goal = Core.parseStepInput(read(ids.goal), big);
      const date = read(ids.date);
      const fail = (msg, id) => {
        errorBox.hidden = false;
        errorBox.textContent = msg;
        const input = form.querySelector('#' + id);
        if (input) input.focus();
      };
      if (!baseline.ok) return fail(`Steps so far: ${INPUT_ERRORS[baseline.error](baseline.max)}`, ids.steps);
      if (!Core.isValidDateKey(date) || date > todayKey || date < `${year - 1}-12-31`) {
        return fail(`Choose a date between 31.12.${year - 1} and today.`, ids.date);
      }
      if (date === `${year - 1}-12-31` && baseline.value !== 0) {
        return fail(`Up to 31.12.${year - 1} means nothing of ${year} is included yet – use 0 steps.`, ids.steps);
      }
      if (!previous.ok) return fail(`Last year: ${INPUT_ERRORS[previous.error](previous.max)}`, ids.prev);
      if (!goal.ok) return fail(`Goal: ${INPUT_ERRORS[goal.error](goal.max)}`, ids.goal);
      if (goal.value <= 0) return fail('The goal must be greater than 0.', ids.goal);

      const result = saveYearConfig(year, {
        baselineSteps: baseline.value,
        baselineDate: date,
        previousYearTotal: previous.value,
        goal: goal.value
      });
      if (!result.ok) {
        return fail(result.field === 'storage'
          ? 'Could not save on this device (storage full or blocked).'
          : 'Please check the values.', ids.steps);
      }
      state.editingSettings = false;
      state.draft = {};
      state.message = { text: isEdit ? 'Challenge updated.' : 'Challenge started – log your steps below.', kind: 'ok' };
      render();
    });
    return form;
  }

  // ----- Main view -----
  function renderMain(cfg, todayKey) {
    const stats = Core.computeStats(cfg, state.entries, todayKey);
    return h('div', { class: 'step-main' },
      renderHero(stats),
      renderKpis(stats),
      renderEntryForm(todayKey),
      renderHealth(),
      renderWeek(stats),
      h('button', {
        type: 'button',
        class: 'step-details-toggle',
        'aria-expanded': String(state.detailsOpen),
        'aria-controls': 'stepDetails',
        onclick: () => { state.detailsOpen = !state.detailsOpen; saveUiPrefs(); render(); }
      }, state.detailsOpen ? 'Hide details ▲' : 'Details & history ▼'),
      state.detailsOpen ? renderDetails(stats, todayKey) : null
    );
  }

  // ----- Apple Health (automatic upload) -----
  function healthStatusText(keys) {
    const hs = state.health;
    if (!canSync()) return 'Sign in to upload your steps from Apple Health automatically.';
    if (hs.problem === 'missing') return 'Not available yet: the database update for it is missing.';
    if (!hs.keys) return hs.problem === 'offline' ? 'Offline – the upload status is shown when you are online.' : 'Upload your steps from the iPhone automatically.';
    if (keys.length === 0) return 'Not set up – steps are entered by hand.';
    const last = keys.reduce((max, k) => (k.last_used_at && (!max || k.last_used_at > max) ? k.last_used_at : max), null);
    return last ? `Automatic · last upload ${formatMoment(last)}` : 'Set up – waiting for the first upload from the Shortcut.';
  }

  function renderHealth() {
    const hs = state.health;
    const keys = hs.keys || [];
    const toggle = () => {
      hs.open = !hs.open;
      if (!hs.open) {
        hs.newKey = null; // shown once: gone when the panel closes
        hs.error = null;
      } else {
        loadHealthKeys();
      }
      render();
    };
    return h('section', { class: 'step-health', 'aria-labelledby': 'stepHealthTitle' },
      h('div', { class: 'step-health-row' },
        h('div', { class: 'step-health-text' },
          h('h4', { id: 'stepHealthTitle', class: 'step-health-title' }, 'Apple Health'),
          h('p', { class: 'step-health-status', 'data-role': 'health-status' }, healthStatusText(keys))),
        h('button', {
          type: 'button',
          class: 'btn step-btn-secondary step-health-toggle',
          'aria-expanded': String(hs.open),
          'aria-controls': 'stepHealthPanel',
          onclick: toggle
        }, hs.open ? 'Done' : (keys.length > 0 ? 'Manage' : 'Set up'))),
      hs.open ? renderHealthPanel(keys) : null);
  }

  function copyField(id, label, value, which) {
    const input = h('input', { id, class: 'step-input step-health-code', type: 'text', readonly: true, value, spellcheck: 'false', autocomplete: 'off' });
    return h('div', { class: 'step-health-field' },
      h('label', { class: 'step-field-label', for: id }, label),
      h('div', { class: 'step-health-copy' },
        input,
        h('button', {
          type: 'button',
          class: 'btn step-btn-secondary',
          'aria-label': `Copy ${label.toLowerCase()}`,
          onclick: () => copyText(value, which, input)
        }, state.health.copied === which ? 'Copied ✓' : 'Copy')));
  }

  function renderHealthSteps() {
    return h('ol', { class: 'step-health-steps' },
      h('li', null, 'Shortcuts app → +. Add “Find Health Samples” (search “Health”): Type Steps, Start Date is today, Add Filter: Source is Apple Watch (with several Watch entries, the one that matches the Health app), Group By None. Without that filter iPhone and Apple Watch are counted twice.'),
      h('li', null, 'Add “Calculate Statistics”: Sum.'),
      h('li', null, 'Add “Format Date”: tap the pale “Date” and choose Current Date (pale = empty); Date Format ISO 8601.'),
      h('li', null, 'Add “Get Contents of URL” with the address, Method POST, Request Body JSON: ',
        h('code', null, 'token'), ' (Text: your key), ', h('code', null, 'date'), ' (Text: Formatted Date), ',
        h('code', null, 'steps'), ' (Number: the Sum).'),
      h('li', null, 'Run it once: it answers “Saved: … steps”. Compare with the Health app: the same or slightly less is right; almost twice as much means the Source filter is missing.'),
      h('li', null, 'Steps after the last run of a day: duplicate the Shortcut as “Step Challenge yesterday”. In the copy add “Adjust Date” at the very top: Subtract 1 day from Current Date. In “Find Health Samples” change Start Date “is today” to “is” with Adjusted Date, and in “Format Date” replace Current Date with Adjusted Date. Run it: the answer must name yesterday’s date. Then add “Run Shortcut” → “Step Challenge yesterday” at the end of your first Shortcut.'),
      h('li', null, 'Automation → + → App → apps you open often (e.g. WhatsApp) → Is Opened → Run Immediately, Notify When Run off → your Shortcut: it then runs whenever you open them, with the iPhone unlocked (Health cannot be read while it is locked).'));
  }

  function renderHealthPanel(keys) {
    const hs = state.health;
    const children = [];
    if (!canSync()) {
      children.push(h('p', { class: 'step-health-note' }, 'The Shortcut uploads into your cloud data, so you need to be signed in.'));
    } else if (hs.problem === 'missing') {
      children.push(h('p', { class: 'step-health-note' },
        'This needs a one-time database update (migrations/2026-10-16_step_health_sync.sql) and the Edge Function "health-steps".'));
    } else if (hs.keys) {
      const setUp = keys.length > 0 && !hs.newKey;
      if (!setUp) {
        children.push(h('p', { class: 'step-health-note' },
          'Websites cannot read Apple Health. A Shortcut on your iPhone can: it reads today\'s steps and sends them here ' +
          'several times a day without asking; the next day it also sends yesterday\'s final count. A lower count never replaces a higher one.'));
      }
      if (hs.newKey) {
        children.push(h('div', { class: 'step-health-secret' },
          h('p', { class: 'step-health-warning' }, 'Your upload key is shown only now. Paste it into the Shortcut; it works only for uploading steps to your account.'),
          copyField('stepHealthKey', 'Upload key', hs.newKey, 'key'),
          copyField('stepHealthUrl', 'Address', window.supabaseDB.healthStepsUrl, 'url')));
      }
      if (keys.length > 0) {
        children.push(h('ul', { class: 'step-health-keys', 'aria-label': 'Upload keys' },
          keys.map(key => h('li', { class: 'step-health-key' },
            h('span', { class: 'step-health-key-text' },
              `${key.label} · created ${formatMoment(key.created_at)} · `,
              key.last_used_at ? `last upload ${formatMoment(key.last_used_at)}` : 'not used yet'),
            h('button', {
              type: 'button',
              class: 'btn step-btn-secondary step-health-revoke',
              'aria-label': `Revoke upload key created ${formatMoment(key.created_at)}`,
              onclick: () => revokeHealthKey(key)
            }, 'Revoke')))));
      }
      if (!hs.newKey) {
        children.push(h('button', {
          type: 'button',
          class: `btn ${setUp ? 'step-btn-secondary' : 'step-btn-primary'} step-health-create`,
          disabled: hs.busy || keys.length >= HEALTH_MAX_KEYS,
          onclick: createHealthKey
        }, hs.busy ? 'Creating…' : (keys.length > 0 ? 'Create another key' : 'Create upload key')));
      }
      // Set up already: the steps on request
      children.push(setUp
        ? h('details', { class: 'step-health-details' }, h('summary', null, 'How to set up the Shortcut'), renderHealthSteps())
        : renderHealthSteps());
      children.push(h('p', { class: 'step-health-note' },
        h('a', { href: HEALTH_GUIDE_URL, target: '_blank', rel: 'noopener' }, 'Step-by-step guide (German)')));
    } else {
      children.push(h('p', { class: 'step-health-note' }, hs.problem === 'offline' ? 'Offline – try again when you are online.' : 'Loading…'));
    }
    if (hs.error) children.push(h('p', { class: 'step-form-error', role: 'alert' }, hs.error));
    return h('div', { id: 'stepHealthPanel', class: 'step-health-panel' }, children);
  }

  const STATUS = {
    start: { icon: '●', label: 'Challenge started', cls: 'neutral' },
    on_track: { icon: '●', label: 'On plan', cls: 'good' },
    ahead: { icon: '▲', label: 'Ahead of plan', cls: 'good' },
    behind: { icon: '▼', label: 'Behind plan', cls: 'warn' },
    reached: { icon: '✓', label: 'Goal reached', cls: 'good' }
  };

  function renderHero(stats) {
    const st = STATUS[stats.status];
    let detail;
    if (stats.status === 'reached') detail = `${Core.formatSigned(stats.surplus)} above goal`;
    else if (stats.status === 'start') detail = `Plan: ${Core.formatSteps(Math.ceil(stats.planDailyRate))} per day`;
    else detail = `${Core.formatSigned(stats.deviation)} vs. plan ${stats.evalDate === stats.todayKey ? '(incl. today)' : '(until yesterday)'}`;

    const pct = Math.max(0, Math.min(100, stats.progressPercent));
    const planPct = Math.max(0, Math.min(100, (stats.planAtEval / stats.goal) * 100));

    return h('div', { class: 'step-hero' },
      h('div', { class: 'step-hero-top' },
        h('div', { class: 'step-hero-figure' },
          h('div', { class: 'step-hero-value' }, Core.formatSteps(stats.ytd)),
          h('div', { class: 'step-hero-label' },
            `steps in ${stats.year} · ${Core.formatPercent(stats.progressPercent)} of ${Core.formatSteps(stats.goal)}`)),
        h('div', { class: `step-status step-status-${st.cls}` },
          h('span', { class: 'step-status-icon', 'aria-hidden': 'true' }, st.icon),
          h('span', { class: 'step-status-text' },
            h('strong', null, st.label),
            h('span', { class: 'step-status-detail' }, detail)))
      ),
      h('div', {
        class: 'step-meter',
        role: 'progressbar',
        'aria-label': `Progress towards the ${stats.year} goal`,
        'aria-valuemin': '0',
        'aria-valuemax': String(stats.goal),
        'aria-valuenow': String(Math.min(stats.ytd, stats.goal)),
        'aria-valuetext': `${Core.formatSteps(stats.ytd)} of ${Core.formatSteps(stats.goal)} steps (${Core.formatPercent(stats.progressPercent)})`
      },
      h('div', { class: 'step-meter-fill', style: { width: pct + '%' } }),
      stats.status !== 'start' && !stats.goalReached
        ? h('div', {
          class: 'step-meter-plan',
          style: { left: planPct + '%' },
          title: `Plan for ${Core.formatDay(stats.evalDate)}: ${Core.formatSteps(stats.planAtEval)}`
        })
        : null
      )
    );
  }

  function kpi(label, value, sub, extra) {
    return h('div', { class: 'step-kpi' },
      h('div', { class: 'step-kpi-label' }, label),
      h('div', { class: 'step-kpi-value' }, value),
      sub ? h('div', { class: 'step-kpi-sub' }, sub) : null,
      extra || null);
  }

  function renderKpis(stats) {
    let neededValue;
    let neededSub;
    if (stats.goalReached) {
      neededValue = '0';
      neededSub = 'goal reached 🎉';
    } else if (stats.goalOutOfReach) {
      neededValue = '–';
      neededSub = 'no days left this year';
    } else {
      neededValue = Core.formatSteps(stats.requiredDailyAverage);
      neededSub = `for ${stats.remainingDays} day${stats.remainingDays === 1 ? '' : 's'} ${stats.countsToday ? 'incl. today' : 'from tomorrow'}`;
    }

    let todayValue = '–';
    let todaySub = 'not logged yet';
    let todayMeter = null;
    if (stats.todayCoveredByBaseline) {
      todaySub = 'included in start value';
    } else if (stats.todayLogged) {
      todayValue = Core.formatSteps(stats.todaySteps);
    }
    if (stats.todayTarget !== null && !stats.todayCoveredByBaseline) {
      const ratio = stats.todayTarget > 0 ? (stats.todaySteps || 0) / stats.todayTarget : 1;
      const pct = Math.round(ratio * 100);
      todaySub = stats.todayLogged
        ? `of ${Core.formatSteps(stats.todayTarget)} needed · ${pct} %`
        : `target ${Core.formatSteps(stats.todayTarget)}`;
      todayMeter = h('div', { class: 'step-mini-meter', 'aria-hidden': 'true' },
        h('div', { class: 'step-mini-meter-fill' + (ratio >= 1 ? ' is-done' : ''), style: { width: Math.min(100, pct) + '%' } }));
    }

    return h('div', { class: 'step-kpis' },
      kpi('Remaining', Core.formatSteps(stats.remaining),
        stats.goalReached ? `goal: ${Core.formatSteps(stats.goal)}` : `to reach ${Core.formatSteps(stats.goal)}`),
      kpi('Needed per day', neededValue, neededSub),
      kpi('Today', todayValue, todaySub, todayMeter)
    );
  }

  // ----- Entry form -----
  function earliestEditableDate(todayKey) {
    const year = Core.yearOf(todayKey);
    const previous = yearConfig(year - 1);
    if (previous) return Core.addDays(previous.baselineDate, 1);
    const current = yearConfig(year);
    return current ? Core.addDays(current.baselineDate, 1) : todayKey;
  }

  function renderEntryForm(todayKey) {
    // Before the new year is set up, the last day of the previous challenge is the natural default
    const fallback = !yearConfig(Core.yearOf(todayKey)) && yearConfig(Core.yearOf(todayKey) - 1)
      ? `${Core.yearOf(todayKey) - 1}-12-31`
      : todayKey;
    const date = state.selectedDate && state.selectedDate <= todayKey ? state.selectedDate : fallback;
    const isToday = date === todayKey;
    const entry = state.entries[date];
    const existing = Core.activeSteps(entry);
    const minDate = earliestEditableDate(todayKey);
    const blocked = editableError(date);

    const input = h('input', {
      id: 'step-entry-input',
      class: 'step-input step-entry-input',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      enterkeyhint: 'done',
      placeholder: 'e.g. 12.345',
      'aria-describedby': 'step-entry-msg',
      'aria-invalid': state.entryInvalid ? 'true' : null,
      disabled: blocked ? true : null,
      value: state.draft.entry !== undefined ? state.draft.entry : (existing !== null ? Core.formatSteps(existing) : ''),
      dataset: { keep: 'entry' }
    });
    input.addEventListener('input', () => {
      state.draft.entry = input.value;
      state.entryInvalid = false;
      input.removeAttribute('aria-invalid');
    });
    input.addEventListener('focus', () => input.select());

    const dateInput = h('input', {
      id: 'step-entry-date',
      class: 'step-date-input',
      type: 'date',
      min: minDate,
      max: todayKey,
      value: date,
      'aria-label': 'Day to log'
    });
    dateInput.addEventListener('change', () => {
      if (Core.isValidDateKey(dateInput.value)) selectDate(dateInput.value, false);
    });

    const msg = state.message;
    const msgEl = h('p', {
      id: 'step-entry-msg',
      class: 'step-entry-msg' + (msg ? ` is-${msg.kind}` : ''),
      role: 'status',
      'aria-live': 'polite'
    }, msg ? msg.text : (blocked || (existing !== null ? `Logged: ${Core.formatSteps(existing)} steps. Enter a new number to correct it.` : '')));
    if (msg && msg.undo && state.lastChange) {
      msgEl.append(' ', h('button', { type: 'button', class: 'step-link-btn', onclick: undoLastChange }, 'Undo'));
    }

    const form = h('form', { class: 'step-entry', novalidate: true },
      h('div', { class: 'step-entry-head' },
        h('label', { for: 'step-entry-input', class: 'step-entry-label' },
          isToday ? 'Today\'s steps' : `Steps on ${Core.formatDay(date, true)}`),
        h('div', { class: 'step-date-nav' },
          h('button', {
            type: 'button', class: 'step-nav-btn', 'aria-label': 'Previous day',
            disabled: date <= minDate ? true : null,
            onclick: () => selectDate(Core.addDays(date, -1), false)
          }, '‹'),
          dateInput,
          h('button', {
            type: 'button', class: 'step-nav-btn', 'aria-label': 'Next day',
            disabled: isToday ? true : null,
            onclick: () => selectDate(Core.addDays(date, 1), false)
          }, '›'),
          !isToday ? h('button', { type: 'button', class: 'step-link-btn', onclick: () => selectDate(null, false) }, 'Today') : null
        )
      ),
      h('div', { class: 'step-entry-row' },
        input,
        h('button', { type: 'submit', class: 'btn step-btn-primary step-save-btn', disabled: blocked ? true : null },
          existing !== null ? 'Update' : 'Save'),
        existing !== null && !blocked
          ? h('button', {
            type: 'button', class: 'step-icon-btn step-clear-btn',
            'aria-label': `Remove the entry for ${Core.formatDay(date)}`,
            title: 'Remove entry (day becomes “not logged”)',
            onclick: () => applyResult(date, clearEntry(date), `${Core.formatDay(date, true)}: entry removed (not logged).`)
          }, '✕')
          : null
      ),
      msgEl
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const parsed = Core.parseStepInput(input.value);
      if (!parsed.ok) {
        state.entryInvalid = true;
        state.message = { text: INPUT_ERRORS[parsed.error](parsed.max), kind: 'error' };
        state.focusField = 'entry';
        render();
        return;
      }
      if (existing !== null && parsed.value === existing && !entry.deleted) {
        state.draft = {};
        state.message = { text: `${Core.formatDay(date, true)}: already ${Core.formatSteps(existing)} steps – nothing changed.`, kind: 'info' };
        render();
        return;
      }
      const verb = existing !== null
        ? `${Core.formatDay(date, true)}: updated ${Core.formatSteps(existing)} → ${Core.formatSteps(parsed.value)} steps.`
        : `${Core.formatDay(date, true)}: ${Core.formatSteps(parsed.value)} steps saved.`;
      applyResult(date, saveEntry(date, parsed.value), verb);
    });
    return form;
  }

  function applyResult(date, result, successText) {
    if (result.ok) {
      state.lastChange = { date, previous: result.previous };
      state.message = { text: successText, kind: 'ok', undo: true };
      state.draft = {};
      state.entryInvalid = false;
      state.focusField = null; // closes the on-screen keyboard after saving
    } else {
      state.message = { text: result.error, kind: 'error' };
    }
    render();
  }

  function selectDate(date, focusInput) {
    state.selectedDate = date && date !== today() ? date : null;
    state.draft = {};
    state.entryInvalid = false;
    state.message = null;
    if (focusInput) state.focusField = 'entry';
    render();
    if (focusInput && state.root) {
      const input = state.root.querySelector('#step-entry-input');
      if (input && !input.disabled) {
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  // ----- Week strip -----
  function renderWeek(stats) {
    const week = Core.weekSummary(stats, state.entries, Core.weekStart(stats.asOf));
    const maxValue = Math.max(stats.planDailyRate, ...week.days.map(d => d.steps || 0), 1) * 1.1;
    const targetPct = (stats.planDailyRate / maxValue) * 100;
    const parts = [`${Core.formatSteps(week.total)} steps`];
    if (week.average !== null) parts.push(`Ø ${Core.formatSteps(week.average)}/day`);
    if (week.planTotal > 0) parts.push(`plan ${Core.formatSteps(week.planTotal)}`);

    return h('section', { class: 'step-week', 'aria-label': 'This week' },
      h('div', { class: 'step-section-head' },
        h('h4', null, 'This week'),
        h('p', null, parts.join(' · '))),
      h('div', { class: 'step-week-grid' },
        week.days.map(day => {
          const name = Core.formatDay(day.date, true).split(' ')[0];
          let valueText = '–';
          let aria = `${Core.formatDay(day.date, true)}: `;
          const classes = ['step-day'];
          if (day.isToday) classes.push('is-today');
          if (day.isFuture) {
            classes.push('is-future');
            valueText = '';
            aria += 'upcoming';
          } else if (!day.inChallenge) {
            classes.push('is-covered');
            valueText = '·';
            aria += 'included in start value';
          } else if (day.steps === null) {
            classes.push('is-missing');
            aria += 'not logged';
          } else {
            valueText = Core.formatCompact(day.steps);
            aria += `${Core.formatSteps(day.steps)} steps`;
          }
          const height = day.steps !== null ? Math.max(day.steps > 0 ? 4 : 0, (day.steps / maxValue) * 100) : 0;
          const editable = day.inChallenge && !day.isFuture;
          return h('button', {
            type: 'button',
            class: classes.join(' '),
            'aria-label': editable ? `${aria}. Edit` : aria,
            disabled: editable ? null : true,
            onclick: editable ? () => selectDate(day.date, true) : null
          },
          h('span', { class: 'step-day-plot', 'aria-hidden': 'true' },
            day.inChallenge ? h('span', { class: 'step-day-target', style: { bottom: targetPct + '%' } }) : null,
            day.steps !== null ? h('span', { class: 'step-day-bar' + (day.steps >= stats.planDailyRate ? ' is-done' : ''), style: { height: height + '%' } }) : null),
          h('span', { class: 'step-day-value', 'aria-hidden': 'true' }, valueText),
          h('span', { class: 'step-day-name', 'aria-hidden': 'true' }, name));
        })
      ),
      h('p', { class: 'step-week-legend' },
        h('span', { class: 'step-key-line', 'aria-hidden': 'true' }),
        ` daily plan ${Core.formatSteps(Math.ceil(stats.planDailyRate))} · tap a day to edit`)
    );
  }

  // ----- Details -----
  function renderDetails(stats, todayKey) {
    return h('div', { class: 'step-details', id: 'stepDetails' },
      renderRecord(stats),
      renderActivity(stats),
      h('div', { class: 'step-details-pair' },
        renderCalendar(stats, todayKey),
        renderWeeklyChart(stats)),
      renderCumulativeChart(stats),
      renderReconciliation(stats),
      renderTable(stats)
    );
  }

  function tile(label, value, sub) {
    return h('div', { class: 'step-tile' },
      h('div', { class: 'step-kpi-label' }, label),
      h('div', { class: 'step-tile-value' }, value),
      sub ? h('div', { class: 'step-kpi-sub' }, sub) : null);
  }

  function renderRecord(stats) {
    const tiles = [];
    if (stats.previousYearTotal !== null) {
      tiles.push(tile(`Last year (${stats.year - 1})`, Core.formatSteps(stats.previousYearTotal), 'record to beat'));
      tiles.push(stats.recordBeaten
        ? tile('Record', 'beaten 🎉', `${Core.formatSigned(stats.recordDiff)} steps`)
        : tile('Gap to record', Core.formatSteps(-stats.recordDiff + 1), 'steps until the record falls'));
    }
    if (stats.projectedYearEnd !== null && !stats.yearFinished) {
      const vs = stats.projectedVsRecord;
      tiles.push(tile('Forecast 31.12.', Core.formatCompact(stats.projectedYearEnd),
        `at Ø ${Core.formatSteps(stats.recentAverage)}/day (last logged days)` +
        (vs !== null ? ` · ${Core.formatSigned(vs)} vs. record` : '')));
    } else if (!stats.yearFinished) {
      tiles.push(tile('Forecast 31.12.', '–', 'log a few days to see a forecast'));
    }
    tiles.push(tile('Plan', `${Core.formatSteps(Math.ceil(stats.planDailyRate))}/day`,
      `from ${Core.formatDay(stats.challengeStart)} to reach ${Core.formatCompact(stats.goal)}`));
    return h('section', { class: 'step-block', 'aria-label': 'Record comparison' },
      h('h4', null, 'Record comparison'),
      h('div', { class: 'step-tiles' }, tiles));
  }

  function renderActivity(stats) {
    const totalDays = Math.max(0, Core.daysBetween(stats.baselineDate, stats.todayLogged ? stats.todayKey : stats.evalDate));
    const missing = stats.missingDays;
    return h('section', { class: 'step-block', 'aria-label': 'Daily statistics' },
      h('h4', null, 'Since the start'),
      h('div', { class: 'step-tiles' },
        tile('Ø per logged day', stats.averagePerLoggedDay !== null ? Core.formatSteps(stats.averagePerLoggedDay) : '–',
          stats.loggedDays ? `${stats.loggedDays} day${stats.loggedDays === 1 ? '' : 's'} logged` : 'nothing logged yet'),
        tile('Best day', stats.bestDay ? Core.formatSteps(stats.bestDay.steps) : '–',
          stats.bestDay ? Core.formatDay(stats.bestDay.date, true) : ''),
        tile('Logged days', `${stats.loggedDays} / ${Math.max(totalDays, stats.loggedDays)}`,
          missing.length ? `${missing.length} missing` : 'none missing')
      ),
      missing.length > 0
        ? h('div', { class: 'step-missing' },
          h('span', null, 'Not logged yet:'),
          missing.slice(-6).map(date => h('button', {
            type: 'button', class: 'step-chip-btn',
            onclick: () => selectDate(date, true)
          }, Core.formatDay(date, true))),
          missing.length > 6 ? h('span', { class: 'step-muted' }, `+${missing.length - 6} more (see calendar)`) : null,
          h('p', { class: 'step-muted' }, 'Missing days count as 0 until you log them, so the total may be too low.'))
        : null
    );
  }

  function heatClass(steps) {
    let bucket = 1;
    HEAT_BUCKETS.forEach(limit => { if (steps >= limit) bucket++; });
    return 'heat-' + bucket;
  }

  function renderCalendar(stats, todayKey) {
    const monthKey = state.calendarMonth || todayKey.slice(0, 7);
    const [y, m] = monthKey.split('-').map(Number);
    const first = `${monthKey}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstCfg = earliestEditableDate(todayKey).slice(0, 7);
    const canPrev = monthKey > firstCfg;
    const canNext = monthKey < `${stats.year}-12`;
    const shift = (delta) => {
      const d = new Date(y, m - 1 + delta, 1);
      state.calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      render();
    };
    const title = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const cells = [];
    const offset = Core.daysBetween(Core.weekStart(first), first);
    for (let i = 0; i < offset; i++) cells.push(h('span', { class: 'step-cal-cell is-empty', 'aria-hidden': 'true' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${monthKey}-${String(d).padStart(2, '0')}`;
      const cfg = yearConfig(Core.yearOf(date));
      const covered = cfg ? date <= cfg.baselineDate : true;
      const future = date > todayKey;
      const steps = Core.activeSteps(state.entries[date]);
      const classes = ['step-cal-cell'];
      let label;
      if (future) {
        classes.push('is-future');
        label = 'upcoming';
      } else if (covered) {
        classes.push('is-covered');
        label = cfg ? 'included in start value' : 'no challenge set up';
      } else if (steps === null) {
        classes.push(date === todayKey ? 'is-open' : 'is-missing');
        label = date === todayKey ? 'not logged yet' : 'not logged';
      } else {
        classes.push(heatClass(steps));
        label = `${Core.formatSteps(steps)} steps`;
      }
      if (date === todayKey) classes.push('is-today');
      if (state.selectedDate === date || (!state.selectedDate && date === todayKey)) classes.push('is-selected');
      const editable = !future && !covered;
      const full = `${Core.formatDay(date, true)}: ${label}`;
      cells.push(h('button', {
        type: 'button',
        class: classes.join(' '),
        'aria-label': editable ? `${full}. Edit` : full,
        disabled: editable ? null : true,
        onclick: editable ? () => selectDate(date, true) : null,
        onpointerenter: (e) => showTooltip(e.currentTarget, [full]),
        onpointerleave: hideTooltip,
        onfocus: (e) => showTooltip(e.currentTarget, [full]),
        onblur: hideTooltip
      }, String(d)));
    }

    const legend = h('div', { class: 'step-heat-legend', 'aria-hidden': 'true' },
      h('span', { class: 'step-heat-swatch is-missing' }), h('span', null, 'not logged'),
      h('span', { class: 'step-heat-scale' },
        ['0', '5k', '10k', '15k', '20k', '25k+'].map((label, i) =>
          h('span', { class: 'step-heat-step' }, h('span', { class: `step-heat-swatch heat-${i + 1}` }), label))));

    return h('section', { class: 'step-block', 'aria-label': 'Calendar' },
      h('div', { class: 'step-cal-head' },
        h('h4', null, 'Calendar'),
        h('div', { class: 'step-cal-nav' },
          h('button', { type: 'button', class: 'step-nav-btn', 'aria-label': 'Previous month', disabled: canPrev ? null : true, onclick: () => shift(-1) }, '‹'),
          h('span', { class: 'step-cal-title' }, title),
          h('button', { type: 'button', class: 'step-nav-btn', 'aria-label': 'Next month', disabled: canNext ? null : true, onclick: () => shift(1) }, '›'))),
      h('div', { class: 'step-cal-weekdays', 'aria-hidden': 'true' },
        ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(n => h('span', null, n))),
      h('div', { class: 'step-cal-grid' }, cells),
      legend);
  }

  // ----- Charts -----
  function chartWidth(holder) {
    return Math.max(260, Math.round(holder.clientWidth || 600));
  }

  function niceMax(value) {
    if (value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const n = value / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function renderWeeklyChart(stats) {
    const weeks = Core.weeklyTotals(stats, state.entries, 8);
    const holder = h('div', { class: 'step-chart' });
    const section = h('section', { class: 'step-block', 'aria-label': 'Weekly totals' },
      h('h4', null, 'Weekly totals'),
      h('p', { class: 'step-chart-sub' },
        h('span', { class: 'step-key-rect', 'aria-hidden': 'true' }), ' steps per week  ',
        h('span', { class: 'step-key-line', 'aria-hidden': 'true' }), ' plan for the counted days'),
      holder);

    state.postRender.push(() => {
      const width = chartWidth(holder);
      const height = 180;
      const pad = { top: 18, right: 8, bottom: 26, left: 40 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      const max = niceMax(Math.max(1, ...weeks.map(w => Math.max(w.total, w.planTotal))) * 1.05);
      const yOf = (v) => pad.top + plotH - (v / max) * plotH;
      const band = plotW / Math.max(weeks.length, 1);
      const barW = Math.min(24, band * 0.55);

      const root = svg('svg', {
        width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
        'aria-label': `Weekly step totals for the last ${weeks.length} week(s). Values are listed in the table below.`
      });
      [0, 0.5, 1].forEach(f => {
        const v = max * f;
        const y = yOf(v);
        root.append(
          svg('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: 'step-grid' }),
          svg('text', { x: pad.left - 6, y: y + 4, 'text-anchor': 'end', class: 'step-axis', text: Core.formatCompact(v) }));
      });
      weeks.forEach((w, i) => {
        const cx = pad.left + band * i + band / 2;
        const x = cx - barW / 2;
        const top = yOf(w.total);
        const barH = Math.max(0, pad.top + plotH - top);
        const r = Math.min(4, barH, barW / 2);
        const path = barH > 0
          ? `M${x},${pad.top + plotH} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${pad.top + plotH} Z`
          : '';
        const lines = [
          `Week of ${Core.formatDay(w.start)}: ${Core.formatSteps(w.total)} steps`,
          `plan ${Core.formatSteps(w.planTotal)} · ${w.logged} day${w.logged === 1 ? '' : 's'} logged`
        ];
        const g = svg('g', {
          class: 'step-bar-group', tabindex: '0', role: 'img', 'aria-label': lines.join(', '),
          onpointerenter: (e) => showTooltip(e.currentTarget, lines),
          onpointerleave: hideTooltip,
          onfocus: (e) => showTooltip(e.currentTarget, lines),
          onblur: hideTooltip
        },
        svg('rect', { x: cx - band / 2, y: pad.top, width: band, height: plotH, class: 'step-hit' }),
        path ? svg('path', { d: path, class: 'step-bar' }) : null,
        w.planTotal > 0 ? svg('line', { x1: x - 4, x2: x + barW + 4, y1: yOf(w.planTotal), y2: yOf(w.planTotal), class: 'step-plan-tick' }) : null,
        svg('text', { x: cx, y: height - 8, 'text-anchor': 'middle', class: 'step-axis', text: Core.formatDay(w.start) }));
        root.append(g);
        if (i === weeks.length - 1 && w.total > 0) {
          root.append(svg('text', { x: cx, y: top - 5, 'text-anchor': 'middle', class: 'step-value-label', text: Core.formatCompact(w.total) }));
        }
      });
      holder.replaceChildren(root);
    });
    return section;
  }

  function renderCumulativeChart(stats) {
    const series = Core.cumulativeSeries(stats, state.entries);
    const holder = h('div', { class: 'step-chart' });
    const section = h('section', { class: 'step-block', 'aria-label': 'Cumulative progress' },
      h('h4', null, 'Progress vs. plan'),
      h('p', { class: 'step-chart-sub' },
        h('span', { class: 'step-key-line is-accent', 'aria-hidden': 'true' }), ' actual  ',
        h('span', { class: 'step-key-line', 'aria-hidden': 'true' }), ` plan to ${Core.formatSteps(stats.goal)} on 31.12.`),
      holder);

    state.postRender.push(() => {
      const width = chartWidth(holder);
      const height = 200;
      const pad = { top: 16, right: 12, bottom: 26, left: 52 };
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom;
      const totalDays = Math.max(1, Core.daysBetween(stats.baselineDate, stats.yearEnd));
      const span = Math.max(stats.goal, stats.ytd) - stats.baselineSteps;
      const tickStep = niceMax(Math.max(span, 1) / 4);
      const minY = Math.floor(stats.baselineSteps / tickStep) * tickStep;
      const maxY = Math.ceil(Math.max(stats.goal, stats.ytd) / tickStep) * tickStep;
      const xOf = (date) => pad.left + (Core.daysBetween(stats.baselineDate, date) / totalDays) * plotW;
      const yOf = (v) => pad.top + plotH - ((v - minY) / Math.max(1, maxY - minY)) * plotH;

      const root = svg('svg', {
        width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
        'aria-label': `Cumulative steps since ${Core.formatDay(stats.baselineDate)}: ${Core.formatSteps(stats.ytd)} now, plan ${Core.formatSteps(stats.planAtEval)}. Values are listed in the table below.`
      });
      for (let v = minY; v <= maxY + 1; v += tickStep) {
        root.append(
          svg('line', { x1: pad.left, x2: width - pad.right, y1: yOf(v), y2: yOf(v), class: 'step-grid' }),
          svg('text', { x: pad.left - 6, y: yOf(v) + 4, 'text-anchor': 'end', class: 'step-axis', text: Core.formatCompact(v) }));
      }
      // X labels: start, first of each month, end
      const ticks = [stats.baselineDate];
      for (let k = Core.addDays(stats.baselineDate, 1); k <= stats.yearEnd; k = Core.addDays(k, 1)) {
        if (k.endsWith('-01')) ticks.push(k);
      }
      let lastLabelX = -Infinity;
      ticks.forEach(k => {
        const x = xOf(k);
        if (k !== stats.baselineDate && (x > width - pad.right - 20 || x - lastLabelX < 52)) return;
        lastLabelX = x;
        root.append(svg('text', { x, y: height - 8, 'text-anchor': k === stats.baselineDate ? 'start' : 'middle', class: 'step-axis', text: Core.formatDay(k) }));
      });

      root.append(svg('line', {
        x1: xOf(stats.baselineDate), y1: yOf(stats.baselineSteps), x2: xOf(stats.yearEnd), y2: yOf(stats.goal), class: 'step-plan-line'
      }));
      root.append(svg('text', { x: xOf(stats.yearEnd) - 2, y: yOf(stats.goal) - 6, 'text-anchor': 'end', class: 'step-value-label', text: `Goal ${Core.formatCompact(stats.goal)}` }));

      if (series.length > 1) {
        const d = series.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(1)},${yOf(p.actual).toFixed(1)}`).join(' ');
        root.append(svg('path', { d, class: 'step-actual-line' }));
      }
      const last = series[series.length - 1];
      if (last) {
        root.append(svg('circle', { cx: xOf(last.date), cy: yOf(last.actual), r: 4, class: 'step-end-dot' }));
      }

      // Crosshair + tooltip
      const cross = svg('line', { x1: 0, x2: 0, y1: pad.top, y2: pad.top + plotH, class: 'step-crosshair', visibility: 'hidden' });
      root.append(cross);
      const overlay = svg('rect', { x: pad.left, y: pad.top, width: plotW, height: plotH, class: 'step-hit' });
      const show = (clientX) => {
        const box = root.getBoundingClientRect();
        const rel = Math.min(Math.max(clientX - box.left - pad.left, 0), plotW);
        const dayIdx = Math.round((rel / plotW) * totalDays);
        const date = Core.addDays(stats.baselineDate, dayIdx);
        const point = series.find(p => p.date === date);
        const plan = Math.round(stats.planAt(date));
        const x = xOf(date);
        cross.setAttribute('x1', x);
        cross.setAttribute('x2', x);
        cross.setAttribute('visibility', 'visible');
        const lines = [Core.formatDay(date, true)];
        if (point) {
          lines.push(`actual ${Core.formatSteps(point.actual)}`, `plan ${Core.formatSteps(plan)} (${Core.formatSigned(point.actual - plan)})`);
        } else {
          lines.push(`plan ${Core.formatSteps(plan)}`);
        }
        showTooltipAt(box.left + x, box.top + pad.top, lines);
      };
      overlay.addEventListener('pointermove', (e) => show(e.clientX));
      overlay.addEventListener('pointerdown', (e) => show(e.clientX));
      overlay.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTooltip(); });
      root.append(overlay);
      holder.replaceChildren(root);
    });
    return section;
  }

  function renderReconciliation(stats) {
    const firstCounted = Core.addDays(stats.baselineDate, 1);
    const fromStart = stats.baselineDate === `${stats.year - 1}-12-31`;
    return h('section', { class: 'step-block', 'aria-label': 'How the total is calculated' },
      h('h4', null, 'How the total is calculated'),
      h('dl', { class: 'step-recon' },
        h('dt', null, fromStart ? 'Start value' : `Start value (01.01.–${Core.formatDay(stats.baselineDate)})`),
        h('dd', null, Core.formatSteps(stats.baselineSteps)),
        h('dt', null, `+ ${stats.loggedDays} daily entr${stats.loggedDays === 1 ? 'y' : 'ies'} (from ${Core.formatDay(firstCounted)})`),
        h('dd', null, Core.formatSteps(stats.entriesSum)),
        h('dt', { class: 'is-total' }, `= Steps in ${stats.year}`),
        h('dd', { class: 'is-total' }, Core.formatSteps(stats.ytd))),
      h('p', { class: 'step-muted' },
        `Days up to ${Core.formatDay(stats.baselineDate)} are part of the start value and are never counted twice.`));
  }

  function renderTable(stats) {
    const toggle = h('button', {
      type: 'button', class: 'step-link-btn', 'aria-expanded': String(state.tableOpen),
      onclick: () => { state.tableOpen = !state.tableOpen; render(); }
    }, state.tableOpen ? 'Hide table' : 'Show all values as a table');
    if (!state.tableOpen) return h('section', { class: 'step-block' }, toggle);

    const series = Core.cumulativeSeries(stats, state.entries).slice(1).reverse();
    const rows = series.map(p => {
      const steps = Core.activeSteps(state.entries[p.date]);
      return h('tr', null,
        h('th', { scope: 'row' }, Core.formatDay(p.date, true)),
        h('td', null, steps === null ? 'not logged' : Core.formatSteps(steps)),
        h('td', null, Core.formatSteps(p.actual)),
        h('td', null, Core.formatSteps(p.plan)),
        h('td', null, Core.formatSigned(p.actual - p.plan)));
    });
    return h('section', { class: 'step-block' }, toggle,
      h('div', { class: 'step-table-wrap' },
        h('table', { class: 'step-table' },
          h('caption', null, `Daily values since ${Core.formatDay(stats.challengeStart)}`),
          h('thead', null, h('tr', null,
            h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, 'Steps'), h('th', { scope: 'col' }, 'Total'),
            h('th', { scope: 'col' }, 'Plan'), h('th', { scope: 'col' }, 'vs. plan'))),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: '5' }, 'No values yet.'))))));
  }

  // ----- Tooltip -----
  function tooltipEl() {
    return state.root ? state.root.querySelector('.step-tooltip') : null;
  }

  function showTooltip(target, lines) {
    const box = target.getBoundingClientRect();
    showTooltipAt(box.left + box.width / 2, box.top, lines);
  }

  function showTooltipAt(clientX, clientY, lines) {
    const tip = tooltipEl();
    if (!tip || !state.root) return;
    tip.replaceChildren(...lines.map((line, i) => h(i === 0 ? 'strong' : 'span', null, line)));
    tip.hidden = false;
    const rootBox = state.root.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const left = Math.min(Math.max(clientX - rootBox.left - tipW / 2, 4), rootBox.width - tipW - 4);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, clientY - rootBox.top - tip.offsetHeight - 8) + 'px';
  }

  function hideTooltip() {
    const tip = tooltipEl();
    if (tip) tip.hidden = true;
  }

  // ----- Focus handling across re-renders -----
  // Caret and selection of the field being typed in. The card is rebuilt whenever data changes
  // (e.g. the first sync finishing while the setup form is filled in); without this the caret
  // jumped to the end, so typing over a selected value appended to it instead of replacing it.
  function typingSelection() {
    const el = document.activeElement;
    if (!el || !state.root || !state.root.contains(el) || !el.dataset || el.dataset.keep !== state.focusField) return null;
    try {
      // null for inputs without a text selection (type=date)
      return el.selectionStart === null ? null : { start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection };
    } catch (e) {
      return null;
    }
  }

  function restoreFocus(selection) {
    if (!state.focusField || !state.root) return;
    const el = state.root.querySelector(`[data-keep="${state.focusField}"]`);
    if (el && !el.disabled) {
      el.focus({ preventScroll: true });
      if (typeof el.setSelectionRange === 'function' && el.type === 'text') {
        const length = el.value.length;
        // Focus moved here by the app (no previous selection): caret at the end
        if (selection) el.setSelectionRange(Math.min(selection.start, length), Math.min(selection.end, length), selection.direction || 'none');
        else el.setSelectionRange(length, length);
      }
    }
  }

  // ===== Lifecycle =====
  // ?steps=12345&date=YYYY-MM-DD (e.g. from an iOS Shortcut that reads Apple Health)
  // only pre-fills the form. Saving still needs a tap, so a crafted link cannot write data.
  function consumeUrlPrefill() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return false;
    }
    if (!params.has('steps')) return false;
    const parsed = Core.parseStepInput(params.get('steps'));
    const date = params.get('date') || today();
    params.delete('steps');
    params.delete('date');
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);

    if (!parsed.ok || !Core.isValidDateKey(date) || date > today()) {
      state.message = { text: 'The steps link could not be used (invalid number or date).', kind: 'error' };
      return true;
    }
    const blocked = editableError(date);
    if (blocked) {
      state.message = { text: `The steps link could not be used: ${blocked}`, kind: 'error' };
      return true;
    }
    state.selectedDate = date === today() ? null : date;
    state.draft.entry = Core.formatSteps(parsed.value);
    state.message = {
      text: `${Core.formatSteps(parsed.value)} steps for ${Core.formatDay(date, true)} from your link – check and press Save.`,
      kind: 'info'
    };
    return true;
  }

  function scheduleMidnightRender() {
    clearTimeout(state.midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    state.midnightTimer = setTimeout(() => {
      onDayMaybeChanged();
      scheduleMidnightRender();
    }, next - now);
  }

  function onDayMaybeChanged() {
    if (state.renderedDay && state.renderedDay !== today()) {
      if (state.selectedDate && state.selectedDate > today()) state.selectedDate = null;
      state.calendarMonth = null;
      render();
    }
  }

  function start() {
    const userId = window.currentUserId;
    const root = document.getElementById('stepChallenge');
    if (!userId || !root) return;
    if (state.started && state.userId === userId) {
      scheduleSync(0);
      return;
    }
    state.userId = userId;
    state.root = root;
    state.started = true;
    clearTimeout(state.health.reloadTimer);
    state.health = freshHealthState();
    loadLocal();

    root.addEventListener('focusin', (e) => {
      if (e.target.dataset && e.target.dataset.keep) state.focusField = e.target.dataset.keep;
    });
    root.addEventListener('focusout', (e) => {
      if (e.target.dataset && e.target.dataset.keep && state.focusField === e.target.dataset.keep) state.focusField = null;
    });

    if (typeof ResizeObserver === 'function') {
      state.resizeObserver = new ResizeObserver(() => {
        const width = root.clientWidth;
        if (Math.abs(width - state.lastWidth) < 8) return;
        state.lastWidth = width;
        if (state.detailsOpen) state.postRender.forEach(fn => fn());
      });
      state.resizeObserver.observe(root);
    }

    window.addEventListener('online', () => scheduleSync(0));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      onDayMaybeChanged();
      if (Date.now() - state.lastSyncAt > RETRY_MS || pendingCount() > 0) scheduleSync(0);
    });

    const prefilled = consumeUrlPrefill();
    root.hidden = false;
    render();
    if (prefilled) root.scrollIntoView({ block: 'start', behavior: 'smooth' });
    scheduleMidnightRender();
    scheduleSync(0);
  }

  // Today's numbers for Home (js/home-ui.js): the same stats the card shows, or null before
  // the challenge of this year is set up
  function summary() {
    const todayKey = today();
    const cfg = yearConfig(Core.yearOf(todayKey));
    return { configured: !!cfg, started: state.started, stats: cfg ? Core.computeStats(cfg, state.entries, todayKey) : null };
  }

  window.stepCounter = {
    start,
    sync,
    pendingCount,
    syncSummary,
    uploadAll,
    summary
  };
})();
