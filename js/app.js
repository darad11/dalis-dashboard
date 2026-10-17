/**
 * Dali's Dashboard
 * Full-featured productivity system
 */

// ===== SIGN OUT FUNCTION =====
function signOut() {
  if (window.authModule && window.authModule.signOut) {
    window.authModule.signOut();
  }
}

// ===== UTILITY: Handle Enter key on inputs =====
function handleEnter(event, callback) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (typeof callback === 'function') {
      callback();
    }
  }
}
window.handleEnter = handleEnter;

// ===== SOUND EFFECTS =====
const sounds = {
  click: () => playSound(800, 0.05, 'sine'),
  complete: () => playSound(600, 0.1, 'sine', 523.25, 659.25, 783.99),
  success: () => playSound(400, 0.15, 'sine', 440, 554.37, 659.25),
};

function playSound(duration, volume, type, ...freqs) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    freqs = freqs.length ? freqs : [440];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + (i * 0.1));
      osc.stop(ctx.currentTime + duration / 1000 + (i * 0.1));
    });
    // Close AudioContext after sound completes to prevent memory leak
    setTimeout(() => ctx.close(), duration + 500);
  } catch (e) { }
}

// ===== AMBIENT SOUND =====
let ambientCtx = null;
let ambientSource = null;
let ambientGain = null;
let currentAmbient = 'none';

function initAmbient() {
  const select = document.getElementById('ambientSelect');
  const volume = document.getElementById('ambientVolume');

  select.onchange = () => {
    currentAmbient = select.value;
    if (pomo.isRunning) {
      startAmbient(select.value);
    }
  };

  volume.oninput = () => {
    if (ambientGain) {
      ambientGain.gain.value = volume.value / 100;
    }
  };
}

function startAmbient(type) {
  stopAmbient();
  if (type === 'none') return;

  try {
    ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = ambientCtx.createGain();
    ambientGain.gain.value = document.getElementById('ambientVolume').value / 100;
    ambientGain.connect(ambientCtx.destination);

    if (type === 'white' || type === 'brown' || type === 'pink') {
      // Generate noise
      const bufferSize = 2 * ambientCtx.sampleRate;
      const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
      const output = buffer.getChannelData(0);

      if (type === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
      } else if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      ambientSource = ambientCtx.createBufferSource();
      ambientSource.buffer = buffer;
      ambientSource.loop = true;
      ambientSource.connect(ambientGain);
      ambientSource.start();
    } else {
      // Generate simulated environmental sounds using oscillators
      const baseFreq = type === 'rain' ? 800 : type === 'forest' ? 200 : 400;
      const count = type === 'cafe' ? 8 : 4;

      // Create multiple oscillators for richer sound
      for (let i = 0; i < count; i++) {
        const osc = ambientCtx.createOscillator();
        const oscGain = ambientCtx.createGain();
        const lfo = ambientCtx.createOscillator();
        const lfoGain = ambientCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = baseFreq + Math.random() * 200;

        lfo.type = 'sine';
        lfo.frequency.value = 0.1 + Math.random() * 0.5;
        lfoGain.gain.value = 0.3;

        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        oscGain.gain.value = 0.1 / count;
        osc.connect(oscGain);
        oscGain.connect(ambientGain);

        osc.start();
        lfo.start();
      }

      // Add noise layer for rain/forest
      if (type === 'rain' || type === 'forest') {
        const noiseBuffer = ambientCtx.createBuffer(1, ambientCtx.sampleRate, ambientCtx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }
        const noiseSource = ambientCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = ambientCtx.createBiquadFilter();
        noiseFilter.type = type === 'rain' ? 'highpass' : 'lowpass';
        noiseFilter.frequency.value = type === 'rain' ? 3000 : 500;

        const noiseGain = ambientCtx.createGain();
        noiseGain.gain.value = type === 'rain' ? 0.15 : 0.05;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ambientGain);
        noiseSource.start();
      }
    }
  } catch (e) {
    console.log('Ambient sound not supported');
  }
}

function stopAmbient() {
  if (ambientSource) {
    try { ambientSource.stop(); } catch (e) { }
    ambientSource = null;
  }
  if (ambientCtx) {
    try { ambientCtx.close(); } catch (e) { }
    ambientCtx = null;
  }
}

// ===== NOTIFICATION BANNERS =====
function showNotification(title, body, variant = 'info', duration = 5000) {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  const banner = document.createElement('div');
  banner.className = `notification-banner ${variant}`;
  banner.setAttribute('role', 'status');

  // Extract emoji from title if present (Extended_Pictographic: digits are not icons)
  const emojiMatch = title.match(/^(\p{Extended_Pictographic}\uFE0F?)/u);
  const icon = emojiMatch ? emojiMatch[1] : '🔔';
  const titleText = emojiMatch ? title.replace(emojiMatch[0], '').trim() : title;

  // Titles and bodies can contain user text (e.g. supplement names): always escape
  banner.innerHTML = `
    <div class="notification-icon" aria-hidden="true">${escapeHtml(icon)}</div>
    <div class="notification-content">
      <div class="notification-title">${escapeHtml(titleText)}</div>
      ${body ? `<div class="notification-body">${escapeHtml(body)}</div>` : ''}
    </div>
    <button class="notification-close" aria-label="Close">×</button>
    <div class="notification-progress" style="animation-duration: ${Number(duration) || 5000}ms"></div>
  `;

  // Close button action
  banner.querySelector('.notification-close').onclick = () => dismissNotification(banner);

  container.appendChild(banner);

  // Auto-dismiss after duration
  setTimeout(() => dismissNotification(banner), duration);
}

function dismissNotification(banner) {
  if (!banner || banner.classList.contains('hiding')) return;
  banner.classList.add('hiding');
  setTimeout(() => banner.remove(), 300);
}

// ===== CUSTOM INPUT MODAL =====
// options.type: 'text' (default) or 'date' (value as YYYY-MM-DD, native date picker on phones)
function showInputModal(title, placeholder = '', defaultValue = '', options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('inputModal');
    const titleEl = document.getElementById('inputModalTitle');
    const input = document.getElementById('inputModalField');
    const submitBtn = document.getElementById('inputModalSubmit');
    const cancelBtn = document.getElementById('inputModalCancel');

    titleEl.textContent = title;
    input.type = options.type === 'date' ? 'date' : 'text';
    input.placeholder = placeholder || 'Type here...';
    input.value = defaultValue;
    modal.classList.add('active');

    // Focus right away: iOS only opens the keyboard when focus happens during the tap
    // that opened the dialog. The delayed call is a fallback for the animation.
    input.focus();
    setTimeout(() => input.focus(), 50);

    const cleanup = () => {
      modal.classList.remove('active');
      submitBtn.onclick = null;
      cancelBtn.onclick = null;
      input.onkeydown = null;
      input.type = 'text';
    };

    submitBtn.onclick = () => {
      cleanup();
      resolve(input.value);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cleanup();
        resolve(input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
    };
  });
}

// Custom confirm modal (replaces native confirm()). options.confirmLabel names the action
// ("Delete" rather than "Confirm", as in iOS alerts); every use replaces or deletes data.
function showConfirmModal(title, message = 'Are you sure?', options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = options.confirmLabel || 'Confirm';
    modal.classList.add('active');

    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.onclick = null;
      document.onkeydown = null;
    };

    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    // Keyboard support
    document.onkeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        resolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        cleanup();
        resolve(true);
      }
    };
  });
}

// ===== STATE MANAGEMENT =====
// Check if Supabase is available at runtime (function instead of constant to avoid race condition)
function isSupabaseAvailable() {
  return typeof window.supabaseDB !== 'undefined' && !!window.currentUserId;
}

// js/data-utils.js; the fallback keeps the dashboard usable if that file is missing
// (e.g. a cached index.html from before the update) and disables change verification.
const DataUtils = window.DataUtils || {
  escapeHtml: (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  keyKind: () => null,
  isSyncableKey: (key) => /^(goals-|cal-|notes-|review-|week-|list-)/.test(key) || ['backlog', 'habits', 'habitChecks', 'customListsMeta', 'gymHubData', 'calendars'].includes(key),
  normalizeTime: (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(v) ? v.slice(0, 5) : null),
  goalIdentity: (g) => (typeof g === 'string' ? g + '|||' : [g.text, g.start || '', g.end || '', g.calendarId || ''].join('|')),
  fingerprint: () => null,
  isEmptyCloudValue: () => false
};
if (!window.DataUtils) console.error('[App] js/data-utils.js not loaded - sync verification disabled');
const escapeHtml = DataUtils.escapeHtml;

// Sync Status Tracking
let lastSyncError = null;
let lastSyncAt = null;

function describeError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  return err.message || err.error || err.code || 'Unknown error';
}

// Keys with a pending upload. Local-only UI state is never uploaded, so it is not counted.
function pendingSyncKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('dirty_') && DataUtils.isSyncableKey(k.substring(6))) keys.push(k.substring(6));
  }
  return keys;
}

function stepPendingCount() {
  const steps = window.stepCounter;
  return steps && typeof steps.pendingCount === 'function' ? steps.pendingCount() : 0;
}

function updateSyncStatus() {
  if (db._quiet > 0) return;
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const dirtyCount = pendingSyncKeys().length + stepPendingCount();
  // Icon and (phone menu) label are separate spans, so only their text changes
  const icon = el.querySelector('.fab-item-icon');
  const label = el.querySelector('.fab-item-label');
  const show = (iconText, labelText, state) => {
    if (icon) icon.textContent = iconText; else el.textContent = iconText;
    if (label) label.textContent = labelText;
    el.dataset.syncState = state;
  };

  if (lastSyncError) {
    show('☁️❌', 'Sync problem – details', 'error');
    el.title = 'Sync Error: ' + lastSyncError;
    el.style.cssText = 'color: #ff4444 !important; filter: drop-shadow(0 0 2px rgba(255,0,0,0.5));';
  } else if (dirtyCount > 0) {
    show('☁️⏳', `Sync: ${dirtyCount} waiting`, 'pending');
    el.title = 'Pending Uploads: ' + dirtyCount;
    el.style.cssText = 'color: #ffcc00 !important; filter: drop-shadow(0 0 2px rgba(255,200,0,0.5));';
  } else {
    show('☁️✅', 'Sync & backup', 'ok');
    el.title = 'Synced';
    el.style.cssText = 'color: #44ff44 !important;';
  }
  if (document.getElementById('syncModal')?.classList.contains('active')) renderSyncModalStatus();
}

const db = {
  // === Local storage (cache/fallback) ===
  get: (key, def = null) => {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  },

  // Local writes are flagged dirty + timestamped; cloud writes record what the cloud holds.
  set: (key, val, fromCloud = false) => {
    localStorage.setItem(key, JSON.stringify(val));
    if (fromCloud) {
      db.markSynced(key, val);
    } else {
      localStorage.setItem('dirty_' + key, '1');
      // Track when this data was last modified (for stale detection)
      localStorage.setItem('ts_' + key, Date.now().toString());
    }
    updateSyncStatus();
  },

  del: (key, fromCloud = false) => {
    localStorage.removeItem(key);
    localStorage.removeItem('dirty_' + key);
    if (fromCloud) {
      localStorage.removeItem('ts_' + key);
      localStorage.removeItem('synced_' + key);
    }
    updateSyncStatus();
  },

  // Dirty Flag Helpers
  clearDirty: (key) => {
    localStorage.removeItem('dirty_' + key);
    updateSyncStatus();
  },
  isDirty: (key) => localStorage.getItem('dirty_' + key) === '1',

  // Fingerprint of what the cloud holds for a key (after a pull or a successful upload).
  // Used to tell whether the cloud changed since this device last synced.
  markSynced(key, value) {
    if (!DataUtils.isSyncableKey(key)) return;
    const fp = DataUtils.fingerprint(key, value);
    if (fp) localStorage.setItem('synced_' + key, fp);
    else localStorage.removeItem('synced_' + key);
  },

  // Bookkeeping after an upload. pushedRaw is the localStorage string that was uploaded.
  afterPush(key, pushedRaw, err) {
    if (err) {
      db.reportSyncError(key, err);
      return false;
    }
    let pushedValue = null;
    try { pushedValue = JSON.parse(pushedRaw); } catch (e) { /* keep null */ }
    db.markSynced(key, pushedValue);
    if (lastSyncError && lastSyncError.startsWith(key + ':')) lastSyncError = null;
    // A newer edit made during the upload stays pending
    if (localStorage.getItem(key) === pushedRaw) db.clearDirty(key);
    return true;
  },

  reportSyncError(key, err) {
    lastSyncError = `${key}: ${describeError(err)}`;
    console.error('[Sync] Upload failed:', key, err);
    updateSyncStatus();
  },

  // Upload the current local value of key via pushFn (returns error or null).
  pushKey(key, pushFn) {
    if (!isSupabaseAvailable()) return Promise.resolve(false);
    const pushedRaw = localStorage.getItem(key);
    return Promise.resolve()
      .then(pushFn)
      .then(err => db.afterPush(key, pushedRaw, err))
      .catch(e => db.afterPush(key, pushedRaw, e || 'Upload failed'));
  },

  // Local copy of a value before cloud data replaces it (Sync → Export backup).
  backupLocalValue(key, reason) {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    try {
      let backups = JSON.parse(localStorage.getItem('syncBackups') || '[]');
      if (!Array.isArray(backups)) backups = [];
      if (backups.some(b => b.key === key && b.value === raw)) return;
      backups.push({
        key,
        value: raw,
        reason,
        modifiedAt: parseInt(localStorage.getItem('ts_' + key) || '0') || null,
        savedAt: Date.now()
      });
      localStorage.setItem('syncBackups', JSON.stringify(backups.slice(-50)));
    } catch (e) {
      console.error('[Sync] Could not store backup for', key, e);
    }
  },

  // Current cloud value for a key: { ok: true, value } or { ok: false } if unreachable
  async fetchCloudValue(key) {
    const api = window.supabaseDB;
    let value;
    switch (DataUtils.keyKind(key)) {
      case 'goals': value = await api.getGoals(key); break;
      case 'notes': value = await api.getNotes(key); break;
      case 'board': value = key === 'backlog' ? await api.getBacklog() : await api.getKanban(key); break;
      case 'habits': value = await api.getHabits(); break;
      case 'list': {
        const list = await api.getList(key.substring(5));
        value = list ? list.items : null;
        break;
      }
      case 'setting': {
        const res = await api.fetchSetting(key);
        return res.ok ? { ok: true, value: res.exists ? res.value : null } : { ok: false };
      }
      default: return { ok: false };
    }
    return value === null || value === undefined ? { ok: false } : { ok: true, value };
  },

  // Write ids assigned by the cloud back into the local habit list (no new upload needed)
  storeHabitIds(pushedHabits) {
    if (!Array.isArray(pushedHabits)) return;
    const local = db.getAllHabits();
    let changed = false;
    local.forEach(h => {
      if (!h || typeof h !== 'object' || h.id) return;
      const match = pushedHabits.find(p => p && typeof p === 'object' && p.id && p.name === h.name);
      if (match) {
        h.id = match.id;
        changed = true;
      }
    });
    if (changed) localStorage.setItem('habits', JSON.stringify(local));
  },

  // === Key generators ===
  calKey: (d) => `cal-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  goalKey: (d) => `goals-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  notesKey: (d) => `notes-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  // Week keys use the ISO week-year, so a week spanning New Year keeps one key
  // (28.12.2026-03.01.2027 is week-2026-W53 on every day of that week)
  weekKey: (d) => `week-${getWeekYear(d)}-W${getWeekNumber(d)}`,
  reviewKey: (d) => `review-${getWeekYear(d)}-W${getWeekNumber(d)}`,
  habitsKey: (d) => `habitsData-${getWeekYear(d)}-W${getWeekNumber(d)}`,

  // === Local getters (sync, use cache) ===
  getAllHabits: () => db.get('habits', []),
  setHabits: (habits) => {
    db.set('habits', habits);
    db.lastLocalChange = Date.now();
    if (!isSupabaseAvailable()) return;
    const pushedRaw = localStorage.getItem('habits');
    window.supabaseDB.setHabits(habits)
      .then(err => {
        db.afterPush('habits', pushedRaw, err);
        if (!err) db.storeHabitIds(habits);
      })
      .catch(e => db.afterPush('habits', pushedRaw, e));
  },
  getKanban: (weekDate) => db.get(db.weekKey(weekDate || currentWeekDate), {}),
  setKanban: (data, weekDate) => {
    const key = db.weekKey(weekDate || currentWeekDate);
    db.set(key, data);
    db.lastLocalChange = Date.now();
    db.pushKey(key, () => window.supabaseDB.setKanban(key, data));
  },
  getGoals: (date) => db.get(db.goalKey(date || currentGoalDate), []),
  // Track when last local change was made (to defer realtime sync during cooldown)
  lastLocalChange: 0,
  setGoals: (goals, date) => {
    const key = db.goalKey(date || currentGoalDate);
    db.set(key, goals);
    db.lastLocalChange = Date.now();
    db.pushKey(key, () => window.supabaseDB.setGoals(key, goals));
  },
  getGoalsTimestamp: (key) => parseInt(localStorage.getItem(`ts_${key}`) || '0'),
  getNotes: (date) => db.get(db.notesKey(date || currentGoalDate), ''),
  setNotes: (text, date) => {
    const key = db.notesKey(date || currentGoalDate);
    db.set(key, text);
    db.lastLocalChange = Date.now();
    db.pushKey(key, () => window.supabaseDB.setNotes(key, text));
  },
  getWeeklyReview: (date) => db.get(db.reviewKey(date || currentNoteDate), ''),
  setWeeklyReview: (text, date) => {
    const key = db.reviewKey(date || currentNoteDate);
    db.set(key, text);
    db.lastLocalChange = Date.now();
    db.pushKey(key, () => window.supabaseDB.setNotes(key, text));
  },
  getBacklog: () => db.get('backlog', {}),
  setBacklog: (backlog) => {
    db.set('backlog', backlog);
    db.lastLocalChange = Date.now();
    db.pushKey('backlog', () => window.supabaseDB.setBacklog(backlog));
  },

  // Update Habit Checks (uses db.get/set logic internally)
  setHabitCheck: (key, value) => {
    // 1. Update LocalStorage
    if (value) localStorage.setItem(key, '1'); else localStorage.removeItem(key);

    // 2. Update In-Memory Cache (for Cloud Upload)
    const checks = db.get('habitChecks', {});
    if (value) checks[key] = true; else delete checks[key];
    db.set('habitChecks', checks); // Marks dirty
    db.lastLocalChange = Date.now();

    // 3. Sync to Cloud
    db.pushKey('habitChecks', () => window.supabaseDB.setSetting('habitChecks', checks));
  },
  // Own calendars (name, colour): settings key "calendars", default calendar first
  getCalendars: () => CalendarCore.normalizeCalendars(db.get('calendars', null)),
  setCalendars: (calendars) => {
    const list = CalendarCore.normalizeCalendars(calendars);
    db.set('calendars', list);
    db.lastLocalChange = Date.now();
    db.pushKey('calendars', () => window.supabaseDB.setSetting('calendars', list));
  },
  getCalendarTasks: (date) => db.get(db.calKey(date), []),
  setCalendarTasks: (date, tasks) => {
    const key = db.calKey(date);
    db.set(key, tasks);
    // Mark that we just made a local change (cooldown for realtime sync)
    db.lastLocalChange = Date.now();
    db.pushKey(key, () => window.supabaseDB.setGoals(key, tasks));
  },

  // Load habit checks from cloud data into localStorage
  loadHabitChecks: (checksObj) => {
    if (!checksObj || typeof checksObj !== 'object') return;
    Object.entries(checksObj).forEach(([key, val]) => {
      if (val) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    });
  },
  getStats: () => db.get('stats', { pomos: 0, tasks: 0, streak: 0, lastActive: null }),
  setStats: (stats) => db.set('stats', stats),

  // Track when this session started (for conflict resolution)
  sessionStartTime: Date.now(),
  _quiet: 0, // > 0 while writing many keys at once (status is refreshed once afterwards)
  _syncRunning: null,
  _syncAgain: false,

  // === Cloud sync functions ===
  // Serialized: callers during a running sync share it, and one more pass runs
  // afterwards so changes announced meanwhile are not missed.
  loadFromCloud() {
    if (!isSupabaseAvailable() || !window.currentUserId) return Promise.resolve();
    if (db._syncRunning) {
      db._syncAgain = true;
      return db._syncRunning;
    }
    db._syncRunning = (async () => {
      try {
        do {
          db._syncAgain = false;
          await db._syncOnce();
        } while (db._syncAgain);
      } catch (e) {
        lastSyncError = describeError(e);
        console.error('[Sync] Sync failed:', e);
      } finally {
        db._syncRunning = null;
        updateSyncStatus();
      }
    })();
    return db._syncRunning;
  },

  // --- Phase 0: Changes left over from earlier sessions ---
  // A dirty flag from before this page load means an upload never finished
  // (offline, Supabase paused, tab closed). Upload it if the cloud still holds
  // what this device last synced. Otherwise another device changed it: keep a
  // local backup copy and let the cloud win (previous behaviour).
  async resolveLeftoverChanges() {
    const leftovers = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('dirty_')) continue;
      const key = k.substring(6);
      if (db.getGoalsTimestamp(key) < db.sessionStartTime) leftovers.push(key);
    }

    const resumed = [];
    const replaced = [];
    for (const key of leftovers) {
      if (!DataUtils.isSyncableKey(key)) {
        // Local-only UI state never syncs
        localStorage.removeItem('dirty_' + key);
        continue;
      }
      const cloud = await db.fetchCloudValue(key);
      if (!cloud.ok) continue; // cloud unreachable: keep pending, retry on next sync

      const synced = localStorage.getItem('synced_' + key);
      const cloudUnchanged = synced
        ? DataUtils.fingerprint(key, cloud.value) === synced
        : DataUtils.isEmptyCloudValue(key, cloud.value);

      if (cloudUnchanged) {
        // Treat as a change of this session so the phases below upload it
        localStorage.setItem('ts_' + key, Date.now().toString());
        resumed.push(key);
      } else {
        db.backupLocalValue(key, synced ? 'conflict' : 'unverified');
        localStorage.removeItem('dirty_' + key);
        replaced.push(key);
      }
    }

    if (resumed.length > 0) console.log('[Sync] Uploading changes from an earlier session:', resumed);
    if (replaced.length > 0) {
      console.warn('[Sync] Cloud had newer data; local copies backed up:', replaced);
      showNotification('⚠️ Sync conflict',
        `${replaced.length} unsynced change(s) were replaced by newer cloud data. A copy is kept on this device (Sync → Export backup).`,
        'info', 12000);
    }
  },

  async _syncOnce() {
    console.log('[Sync] Starting Sync...');
    const errors = [];
    const noteError = (what, err) => errors.push(`${what}: ${describeError(err)}`);

    await db.resolveLeftoverChanges();

    // Pending keys (now all from this session, or unresolved because the cloud was unreachable)
    const dirtyKeysBeforePull = pendingSyncKeys();
    const isSessionChange = (key) => db.getGoalsTimestamp(key) >= db.sessionStartTime;

    // --- Phase 1/2: Pull from cloud; keys with pending uploads are never overwritten ---

    // 0. Metadata (Lists, Checks)
    const habitChecks = await window.supabaseDB.getSetting('habitChecks', {});
    if (habitChecks === null) {
      noteError('habitChecks', 'download failed');
    } else if (!db.isDirty('habitChecks')) {
      db.set('habitChecks', habitChecks, true);
      db.loadHabitChecks(habitChecks);
    }

    // Own calendars: the cloud version unless this device has an unsent change
    const calendarsSetting = await window.supabaseDB.fetchSetting('calendars');
    if (!calendarsSetting.ok) {
      noteError('calendars', 'download failed');
    } else if (calendarsSetting.exists && !db.isDirty('calendars')) {
      db.set('calendars', calendarsSetting.value, true);
    }

    // List Metadata: ALWAYS merge cloud lists into local (even if dirty)
    // This ensures we receive new lists from other devices while preserving our pending changes
    const cloudListMeta = await window.supabaseDB.getSetting('customListsMeta', []);
    if (cloudListMeta === null) {
      noteError('customListsMeta', 'download failed');
    } else {
      const localListMeta = db.get('customListsMeta', []);

      // Merge: combine both local and cloud lists (no duplicates by ID)
      const mergedMeta = [...localListMeta];
      let addedFromCloud = 0;
      for (const cloudList of (cloudListMeta || [])) {
        if (!mergedMeta.some(m => m.id === cloudList.id)) {
          mergedMeta.push(cloudList);
          addedFromCloud++;
        }
      }

      if (addedFromCloud > 0) {
        console.log('[Sync] Added', addedFromCloud, 'lists from cloud. Total:', mergedMeta.length);
        localStorage.setItem('customListsMeta', JSON.stringify(mergedMeta));
      } else if (!db.isDirty('customListsMeta') && cloudListMeta && cloudListMeta.length > 0) {
        // If not dirty and cloud has data, use cloud data
        db.set('customListsMeta', cloudListMeta, true);
      }
    }

    // 1. Goals & calendar - push this session's changes, then pull everything else
    const allGoals = await window.supabaseDB.getAllGoals();
    if (allGoals === null) {
      // Never prune or overwrite on a failed download
      noteError('goals', 'download failed');
    } else {
      const cloudGoalKeys = new Set(Object.keys(allGoals));

      for (const goalKey of dirtyKeysBeforePull) {
        if (!goalKey.startsWith('goals-') && !goalKey.startsWith('cal-')) continue;
        if (!isSessionChange(goalKey)) continue; // unresolved leftover, retried next sync

        const localGoals = db.get(goalKey, []);
        const pushedRaw = localStorage.getItem(goalKey);
        let err = null;
        try {
          err = await window.supabaseDB.setGoals(goalKey, localGoals);
        } catch (e) {
          err = e;
        }
        if (db.afterPush(goalKey, pushedRaw, err)) {
          // Update allGoals with what we pushed so we don't overwrite on pull
          allGoals[goalKey] = localGoals;
          cloudGoalKeys.add(goalKey);
        } else {
          noteError(goalKey, err);
        }
      }

      db._quiet++;
      try {
        // Now update local from cloud (skip dirty keys)
        Object.entries(allGoals).forEach(([k, v]) => {
          if (!db.isDirty(k)) {
            db.set(k, v, true);
          }
        });

        // Handle remote deletions: drop local days the cloud no longer has, unless pending
        const removedRemotely = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('goals-') || key.startsWith('cal-')) && !cloudGoalKeys.has(key) && !db.isDirty(key)) {
            removedRemotely.push(key);
          }
        }
        removedRemotely.forEach(key => db.del(key, true));
      } finally {
        db._quiet--;
      }
    }

    // 2. Notes & Reviews (only today and current week)
    const todayNotesKey = db.notesKey(new Date());
    if (!db.isDirty(todayNotesKey)) {
      const notes = await window.supabaseDB.getNotes(todayNotesKey);
      if (notes === null) noteError('notes', 'download failed');
      else if (notes) db.set(todayNotesKey, notes, true);
    }

    const reviewKey = db.reviewKey(new Date());
    if (!db.isDirty(reviewKey)) {
      const review = await window.supabaseDB.getNotes(reviewKey);
      if (review === null) noteError('review', 'download failed');
      else if (review) db.set(reviewKey, review, true);
    }

    // 3. Habits & Checks - MERGE local and cloud habits
    const cloudHabits = await window.supabaseDB.getHabits();
    if (cloudHabits === null) {
      noteError('habits', 'download failed');
    } else if (db.isDirty('habits') && !isSessionChange('habits')) {
      // Unverified change from an earlier session: leave untouched until it can be checked
    } else if (db.isDirty('habits')) {
      // Merge local and cloud habits
      const localHabits = db.getAllHabits();
      const mergedHabits = [...cloudHabits];
      const cloudNames = new Set(cloudHabits.map(h => h.name));

      localHabits.forEach(localHabit => {
        if (!cloudNames.has(localHabit.name)) {
          // Add local habit not in cloud
          mergedHabits.push(localHabit);
        } else {
          // Merge history for existing habits
          const idx = mergedHabits.findIndex(h => h.name === localHabit.name);
          if (idx >= 0) {
            // Merge history objects
            mergedHabits[idx].history = {
              ...mergedHabits[idx].history,
              ...localHabit.history
            };
            mergedHabits[idx].color = localHabit.color || mergedHabits[idx].color;
          }
        }
      });

      // Handle deletions (if local has fewer habits)
      let finalHabits = mergedHabits;
      if (localHabits.length < cloudHabits.length) {
        const localNames = new Set(localHabits.map(h => h.name));
        finalHabits = mergedHabits.filter(h => localNames.has(h.name));
      }

      console.log(`[Sync] Merging habits: local=${localHabits.length}, cloud=${cloudHabits.length}, merged=${finalHabits.length}`);
      db.set('habits', finalHabits);
      const pushedRaw = localStorage.getItem('habits');
      const err = await window.supabaseDB.setHabits(finalHabits);
      if (db.afterPush('habits', pushedRaw, err)) db.storeHabitIds(finalHabits);
      else noteError('habits', err);
    } else if (cloudHabits.length > 0) {
      db.set('habits', cloudHabits, true);
    }

    // 4. Kanban & Backlog
    const weekKey = db.weekKey(new Date());
    if (!db.isDirty(weekKey)) {
      const kanban = await window.supabaseDB.getKanban(weekKey);
      if (kanban === null) noteError('kanban', 'download failed');
      else if (Object.keys(kanban).length > 0) db.set(weekKey, kanban, true);
    }

    if (!db.isDirty('backlog')) {
      const backlog = await window.supabaseDB.getBacklog();
      if (backlog === null) noteError('backlog', 'download failed');
      else if (Object.keys(backlog).length > 0) db.set('backlog', backlog, true);
    }

    // 5. Lists - MERGE local and cloud list items
    const lists = await window.supabaseDB.getAllLists();
    if (lists === null) {
      noteError('lists', 'download failed');
    } else if (lists.length > 0) {
      const meta = db.get('customListsMeta', []);

      for (const cloudList of lists) {
        // Match by ID: cloudList.name is stored as the list ID
        const localList = meta.find(m => m.id === cloudList.name);
        if (!localList) continue;
        const localKey = `list-${localList.id}`;
        const cloudItems = cloudList.items || [];

        if (db.isDirty(localKey) && !isSessionChange(localKey)) {
          // Unverified change from an earlier session: leave untouched until it can be checked
        } else if (db.isDirty(localKey)) {
          // Merge local and cloud items
          const localItems = db.get(localKey, []);
          const mergedItems = [...cloudItems];

          // Get text for comparison (items can be strings or objects)
          const getItemText = (item) => typeof item === 'string' ? item : (item.text || item.name || JSON.stringify(item));
          const cloudTexts = new Set(cloudItems.map(getItemText));

          localItems.forEach(localItem => {
            const text = getItemText(localItem);
            if (!cloudTexts.has(text)) {
              mergedItems.push(localItem);
            } else {
              // Update with local state
              const idx = mergedItems.findIndex(i => getItemText(i) === text);
              if (idx >= 0) mergedItems[idx] = localItem;
            }
          });

          // Handle deletions
          let finalItems = mergedItems;
          if (localItems.length < cloudItems.length) {
            const localTexts = new Set(localItems.map(getItemText));
            finalItems = mergedItems.filter(i => localTexts.has(getItemText(i)));
          }

          console.log(`[Sync] Merging list ${localList.id}: local=${localItems.length}, cloud=${cloudItems.length}, merged=${finalItems.length}`);
          db.set(localKey, finalItems);
          const pushedRaw = localStorage.getItem(localKey);
          const icon = db.get(`listIcon_${localList.id}`, '📝');
          const err = await window.supabaseDB.setList(localList.id, finalItems, icon);
          if (!db.afterPush(localKey, pushedRaw, err)) noteError(localKey, err);
        } else {
          db.set(localKey, cloudItems, true);
        }
      }
    }

    // --- Phase 3: Push remaining changes made during this session ---
    console.log('[Sync] Phase 3: Pushing session-modified items...');

    for (const key of dirtyKeysBeforePull) {
      // Goals and calendar are handled above
      if (key.startsWith('goals-') || key.startsWith('cal-')) continue;
      // Only push if still dirty (might have been cleared) and not an unresolved leftover
      if (!db.isDirty(key) || !isSessionChange(key)) continue;

      const raw = localStorage.getItem(key);
      let val;
      try { val = JSON.parse(raw); } catch (e) { continue; }
      if (val === null || val === undefined) continue;

      let err = null;
      try {
        if (key.startsWith('notes-') || key.startsWith('review-')) err = await window.supabaseDB.setNotes(key, val);
        else if (key === 'habits') {
          err = await window.supabaseDB.setHabits(val);
          if (!err) db.storeHabitIds(val);
        }
        else if (key === 'habitChecks' || key === 'customListsMeta' || key === 'gymHubData' || key === 'calendars') err = await window.supabaseDB.setSetting(key, val);
        else if (key === 'backlog') err = await window.supabaseDB.setBacklog(val);
        else if (key.startsWith('week-')) err = await window.supabaseDB.setKanban(key, val);
        else if (key.startsWith('list-')) {
          const listId = key.substring(5);
          const icon = db.get(`listIcon_${listId}`, '📝');
          err = await window.supabaseDB.setList(listId, val, icon);
        }
        else continue;
      } catch (e) {
        err = e;
      }

      if (db.afterPush(key, raw, err)) console.log(`[Sync] Pushed: ${key}`);
      else noteError(key, err);
    }

    lastSyncAt = Date.now();
    if (errors.length === 0) lastSyncError = null;
    else if (navigator.onLine === false) lastSyncError = 'Offline – changes stay on this device and upload automatically';
    else if (errors.every(e => e.endsWith('download failed'))) lastSyncError = 'Cloud not reachable – changes stay on this device and upload automatically';
    else lastSyncError = errors.join('; ');
    if (errors.length > 0) console.warn('[Sync] Finished with errors:', errors);
    updateSyncStatus();

    // Refresh UI to show newly synced data
    try {
      if (typeof renderUnifiedLists === 'function') renderUnifiedLists();
      if (typeof renderHabits === 'function') renderHabits();
      if (typeof renderGoals === 'function') renderGoals();
    } catch (e) {
      console.error('[Sync] UI refresh error:', e);
    }
  },

  // === Manual Push to Cloud (Recovery) ===
  async pushToCloud() {
    if (!isSupabaseAvailable() || !window.currentUserId) throw new Error("Not logged in (User ID missing). Please sign out and sign in again.");

    console.log('[Sync] Starting manual upload...');
    let count = 0;
    const errors = [];
    const api = window.supabaseDB;

    // Upload one key; push(value) returns an error or null
    const upload = async (key, label, push) => {
      const raw = localStorage.getItem(key);
      let err = null;
      try {
        err = await push(JSON.parse(raw));
      } catch (e) {
        err = e;
      }
      if (db.afterPush(key, raw, err)) count++;
      else errors.push(`${label}: ${describeError(err)}`);
    };

    const keysWithPrefix = (...prefixes) => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixes.some(p => key.startsWith(p))) keys.push(key);
      }
      return keys;
    };

    // 1. Goals & Calendar
    for (const key of keysWithPrefix('goals-', 'cal-')) {
      await upload(key, `Goal ${key}`, val => api.setGoals(key, val || []));
    }

    // 2. Notes & Reviews
    for (const key of keysWithPrefix('notes-', 'review-')) {
      await upload(key, `Note ${key}`, val => api.setNotes(key, val || ''));
    }

    // 3. Habits
    if (localStorage.getItem('habits') !== null) {
      await upload('habits', 'Habits', async val => {
        const habits = val || [];
        const err = await api.setHabits(habits);
        if (!err) db.storeHabitIds(habits);
        return err;
      });
    }

    // 4. Settings blobs (habit checks, list metadata, health hub, own calendars)
    for (const key of ['habitChecks', 'customListsMeta', 'gymHubData', 'calendars']) {
      if (localStorage.getItem(key) !== null) await upload(key, key, val => api.setSetting(key, val));
    }

    // 5. Backlog
    if (localStorage.getItem('backlog') !== null) {
      await upload('backlog', 'Backlog', val => api.setBacklog(val || {}));
    }

    // 6. Weekly Kanban
    for (const key of keysWithPrefix('week-')) {
      await upload(key, `Kanban ${key}`, val => api.setKanban(key, val || {}));
    }

    // 7. Lists (use ID, not title!)
    for (const list of db.get('customListsMeta', [])) {
      const key = `list-${list.id}`;
      if (localStorage.getItem(key) === null) continue;
      await upload(key, `List ${list.id}`, val => api.setList(list.id, val || [], '📝'));
    }

    // 8. Step counter (own table)
    if (window.stepCounter && typeof window.stepCounter.uploadAll === 'function') {
      const stepResult = await window.stepCounter.uploadAll();
      if (stepResult && stepResult.error) errors.push(`Steps: ${stepResult.error}`);
      else count++;
    }

    lastSyncError = errors.length > 0 ? errors.join('; ') : null;
    updateSyncStatus();
    return { count, errors };
  }
};

// ===== SYNC & BACKUP PANEL =====
function formatSyncTime(ms) {
  if (!ms) return 'not yet in this session';
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getSyncBackups() {
  try {
    const backups = JSON.parse(localStorage.getItem('syncBackups') || '[]');
    return Array.isArray(backups) ? backups : [];
  } catch (e) {
    return [];
  }
}

function renderSyncModalStatus() {
  const el = document.getElementById('syncModalStatus');
  if (!el) return;
  const pending = pendingSyncKeys();
  const stepPending = stepPendingCount();
  const backups = getSyncBackups();
  const online = navigator.onLine !== false;

  let state;
  if (!isSupabaseAvailable()) state = '⚪ Not signed in – data is only stored on this device';
  else if (lastSyncError) state = '❌ Last sync had errors';
  else if (pending.length + stepPending > 0) state = `⏳ ${pending.length + stepPending} change(s) waiting for upload`;
  else state = '✅ Everything synced';

  const rows = [
    `<p class="sync-modal-state">${escapeHtml(state)}</p>`,
    `<p>Last full sync: ${escapeHtml(formatSyncTime(lastSyncAt))}${online ? '' : ' · <strong>offline</strong>'}</p>`
  ];
  if (lastSyncError) rows.push(`<p class="sync-modal-error">${escapeHtml(lastSyncError)}</p>`);
  if (pending.length > 0) {
    const shown = pending.slice(0, 6).map(k => escapeHtml(k)).join(', ');
    rows.push(`<p class="sync-modal-muted">Pending: ${shown}${pending.length > 6 ? ' …' : ''}</p>`);
  }
  if (window.stepCounter && typeof window.stepCounter.syncSummary === 'function') {
    rows.push(`<p>Steps: ${escapeHtml(window.stepCounter.syncSummary())}</p>`);
  }
  if (backups.length > 0) {
    rows.push(`<p class="sync-modal-muted">${backups.length} local backup cop${backups.length === 1 ? 'y' : 'ies'} of replaced changes (included in “Export backup”).</p>`);
  }
  el.innerHTML = rows.join('');
}

window.showSyncDetails = () => {
  const modal = document.getElementById('syncModal');
  if (!modal) return;
  renderSyncModalStatus();
  modal.classList.add('active');
  const close = document.getElementById('syncModalClose');
  if (close) close.focus();
};

window.closeSyncDetails = () => {
  document.getElementById('syncModal')?.classList.remove('active');
};

async function runSyncAction(button, label, action) {
  const original = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = label;
  }
  try {
    await action();
  } catch (e) {
    lastSyncError = describeError(e);
    console.error('[Sync] Action failed:', e);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
    updateSyncStatus();
    renderSyncModalStatus();
  }
}

window.syncNow = (button) => runSyncAction(button, 'Syncing…', async () => {
  await db.loadFromCloud();
  if (window.stepCounter) await window.stepCounter.sync();
  refreshAllViews();
});

// Cloud wins: pending local changes are backed up, then replaced by cloud data
window.forceDownload = async (button) => {
  const pending = pendingSyncKeys();
  const confirmed = await showConfirmModal('Replace local data?',
    pending.length > 0
      ? `${pending.length} change(s) on this device have not been uploaded. They will be replaced by the cloud version (a backup copy is kept on this device).`
      : 'Reload all data from the cloud?', { confirmLabel: 'Replace' });
  if (!confirmed) return;
  return runSyncAction(button, 'Downloading…', async () => {
    pending.forEach(key => {
      db.backupLocalValue(key, 'manual-download');
      localStorage.removeItem('dirty_' + key);
    });
    await db.loadFromCloud();
    if (window.stepCounter) await window.stepCounter.sync();
    refreshAllViews();
  });
};

// Device wins: upload everything stored on this device
window.forceUpload = async (button) => {
  const confirmed = await showConfirmModal('Overwrite cloud data?',
    'This uploads all data stored on this device and replaces the cloud version. Use it on the device that has the correct data.', { confirmLabel: 'Overwrite' });
  if (!confirmed) return;
  return runSyncAction(button, 'Uploading…', async () => {
    const result = await db.pushToCloud();
    if (result.errors.length > 0) {
      showNotification('⚠️ Upload incomplete', `${result.count} item(s) uploaded, ${result.errors.length} failed. Details in the sync panel.`, 'info', 8000);
    } else {
      showNotification('✅ Upload complete', `${result.count} item(s) uploaded.`, 'success');
    }
  });
};

// Older entry point (kept for console use)
window.forceSync = () => window.showSyncDetails();

// Re-render everything that shows synced data (the weekly review textarea is
// left alone so text being typed is never replaced)
function refreshAllViews() {
  const views = [renderCalendar, renderGoals, renderKanban, renderHabits, renderAllLists, updateStats];
  views.forEach(view => {
    try { view(); } catch (e) { console.error('[UI] Refresh failed:', view.name, e); }
  });
}

// Helper: ISO week-year (the calendar year of the week's Thursday)
function getWeekYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  return date.getUTCFullYear();
}

// Helper: Get ISO week number
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Helper: Format week range as DD.MM.YY - DD.MM.YY
function formatWeekRange(weekDate) {
  const monday = new Date(weekDate);
  const d = monday.getDay();
  const diff = monday.getDate() - d + (d === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n) => String(n).padStart(2, '0');
  const formatDate = (date) => {
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  return `${formatDate(monday)} - ${formatDate(sunday)}`;
}

// ===== UI STATE =====
let currentDate = new Date();
let currentGoalDate = new Date(); // For Today's Goals navigation
let currentNotesDate = new Date(); // For Quick Notes navigation
let currentWeekDate = new Date(); // For Weekly Focus kanban navigation
let weekPagerDay = null; // Phones: index into weekdays of the day card on screen (null = today, or Monday)
let currentStatsWeekDate = new Date(); // For Stats section week navigation
let currentHabitsWeekDate = new Date(); // For Habits section week navigation
let currentReviewWeekDate = new Date(); // For Weekly Review section navigation
let draggedTask = null;
let draggedTaskSource = null;
let focusModeActive = false;

// ===== DOM ELEMENTS =====
const els = {};

// ===== POMODORO STATE =====
const pomo = {
  modes: { work: 25 * 60, short: 5 * 60, long: 15 * 60 },
  currentMode: 'work',
  timeLeft: 25 * 60,
  isRunning: false,
  interval: null,
  sessions: 0,
  endTime: null  // Track when timer should end (for background accuracy)
};

const weekdays = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];

// ===== INITIALIZATION =====
// init() runs on DOMContentLoaded (local data), again once the login is known
// (cloud sync) and on "Sync now"; listeners must therefore be registered once.
let oneTimeSetupDone = false;
async function init() {
  // Ensure DOM is fully loaded before running
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
    return;
  }

  // Get DOM elements (redundant safety check)
  els.calList = document.getElementById('calendar');
  els.calTitle = document.getElementById('title');
  els.habitsList = document.getElementById('habits');
  els.weekKanban = document.getElementById('weekKanban');
  els.longKanban = document.getElementById('longKanban');
  els.btnDark = document.getElementById('btnToggleDark');
  els.pomoTime = document.getElementById('pomoTime');
  els.pomoStart = document.getElementById('pomoStart');
  els.pomoReset = document.getElementById('pomoReset');
  els.pomoRing = document.querySelector('.pomo-ring-progress');
  els.pomoCount = document.getElementById('pomoCount');
  els.goalsList = document.getElementById('goalsList');
  els.quickNotes = document.getElementById('quickNotes');
  els.weeklyReview = document.getElementById('weeklyReview');
  els.focusOverlay = document.getElementById('focusOverlay');
  els.focusTime = document.getElementById('focusTime');
  els.focusRing = document.querySelector('.focus-ring');
  els.confettiCanvas = document.getElementById('confettiCanvas');

  // Load data from Supabase (if available)
  await db.loadFromCloud();

  initTheme();
  initPomodoro();
  initAmbient();
  initStats();

  try { renderCalendar(); } catch (e) { console.error('Calendar render failed', e); }
  try { renderHabits(); } catch (e) { console.error('Habits render failed', e); }

  // restoreAnalyticsState(); // Disabled to keep closed by default
  loadStatsState(); // Restore stats panel visibility

  try { renderKanban(); } catch (e) { console.error('Kanban render failed', e); }

  rolloverIncompleteGoals(); // Move incomplete goals from previous days to today

  try { renderGoals(); } catch (e) { console.error('Goals render failed', e); }
  try { loadNotes(); } catch (e) { console.error('Notes load failed', e); }
  try { renderAllLists(); } catch (e) { console.error('Lists render failed', e); }
  try { loadWeeklyReview(); } catch (e) { console.error('Review load failed', e); }

  updateTitles();
  updateHabitsTitle();
  setupEventListeners();
  if (!oneTimeSetupDone) {
    oneTimeSetupDone = true;
    setupKeyboardShortcuts();
    setupConfetti();
    setupBackgroundSync();
  }

  // Initialize Realtime sync for cross-device updates
  initRealtimeSync();

  // Step challenge (js/steps.js) needs the logged-in user
  if (window.stepCounter && window.currentUserId) window.stepCounter.start();

  // Sections are filled: deep links may jump now (js/mobile.js)
  window.dispatchEvent(new CustomEvent('dashboard:rendered'));
}

// ===== REALTIME SYNC =====
let realtimeChannel = null;

// Cooldown after a local change; remote refreshes inside it are postponed, not dropped
const REALTIME_COOLDOWN = 5000;
let remoteRefreshTimer = null;

function scheduleRemoteRefresh(delay = 500) {
  clearTimeout(remoteRefreshTimer);
  remoteRefreshTimer = setTimeout(async () => {
    const sinceLocalChange = Date.now() - db.lastLocalChange;
    if (sinceLocalChange < REALTIME_COOLDOWN) {
      scheduleRemoteRefresh(REALTIME_COOLDOWN - sinceLocalChange + 100);
      return;
    }
    console.log('[Realtime] Refreshing after remote change...');
    await db.loadFromCloud();
    refreshAllViews();
    // Step Challenge settings live in the settings table: pick up changes from other devices
    if (window.stepCounter) window.stepCounter.sync();
  }, delay);
}

function initRealtimeSync() {
  if (realtimeChannel) return; // already subscribed
  if (!window.supabaseDB || !window.supabaseDB.subscribeToChanges) {
    console.log('[Realtime] Supabase not available, skipping realtime sync');
    return;
  }

  const onRemoteChange = () => scheduleRemoteRefresh();
  realtimeChannel = window.supabaseDB.subscribeToChanges(onRemoteChange, onRemoteChange, onRemoteChange, onRemoteChange);
  if (realtimeChannel) console.log('[Realtime] Sync initialized');
}

// Retry pending uploads when the connection returns, and catch up on changes
// from other devices when the app comes back to the foreground (iOS pauses
// the realtime connection in the background).
function setupBackgroundSync() {
  window.addEventListener('online', () => {
    if (!isSupabaseAvailable()) return;
    db.loadFromCloud().then(refreshAllViews);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !isSupabaseAvailable()) return;
    if (lastSyncAt && Date.now() - lastSyncAt < 60000) return;
    db.loadFromCloud().then(refreshAllViews);
  });
}

// ===== DATE/WEEK NAVIGATION =====
function updateTitles() {
  // Goals title (date-based)
  const goalTitle = document.getElementById('goalsTitle');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const goalDate = new Date(currentGoalDate);
  goalDate.setHours(0, 0, 0, 0);

  if (goalDate.getTime() === today.getTime()) {
    goalTitle.textContent = "🎯 Today's Goals";
  } else {
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    goalTitle.textContent = `🎯 Goals - ${currentGoalDate.toLocaleDateString('en-US', options)}`;
  }

  // Notes title (date-based) - element may not exist if Quick Notes is removed
  const notesTitle = document.getElementById('notesTitle');
  if (notesTitle) {
    const notesDate = new Date(currentNotesDate);
    notesDate.setHours(0, 0, 0, 0);

    if (notesDate.getTime() === today.getTime()) {
      notesTitle.textContent = "📝 Quick Notes";
    } else {
      const options = { weekday: 'short', day: 'numeric', month: 'short' };
      notesTitle.textContent = `📝 Notes - ${currentNotesDate.toLocaleDateString('en-US', options)}`;
    }
  }

  // Week title - show date range format DD.MM.YY - DD.MM.YY
  const weekTitle = document.getElementById('weekTitle');
  weekTitle.textContent = formatWeekRange(currentWeekDate);
}

window.changeGoalDate = (delta) => {
  currentGoalDate.setDate(currentGoalDate.getDate() + delta);
  renderGoals();
  updateTitles();
};

window.changeNotesDate = (delta) => {
  currentNotesDate.setDate(currentNotesDate.getDate() + delta);
  loadNotes();
  updateTitles();
};

window.goToGoalsToday = () => {
  currentGoalDate = new Date();
  renderGoals();
  updateTitles();
};

window.goToNotesToday = () => {
  currentNotesDate = new Date();
  loadNotes();
  updateTitles();
};

window.changeWeek = (delta) => {
  currentWeekDate.setDate(currentWeekDate.getDate() + (delta * 7));
  updateTitles(); // Update UI first
  try { renderKanban(); } catch (e) { console.error(e); }
  try { renderHabits(); } catch (e) { console.error(e); }
  try { loadWeeklyReview(); } catch (e) { console.error(e); }
  try { updateStats(); } catch (e) { console.error(e); }
};

window.goToWeekToday = () => {
  currentWeekDate = new Date();
  weekPagerDay = null; // phones: back to today's card
  updateTitles();
  try { renderKanban(); } catch (e) { console.error(e); }
  try { renderHabits(); } catch (e) { console.error(e); }
  try { loadWeeklyReview(); } catch (e) { console.error(e); }
  try { updateStats(); } catch (e) { console.error(e); }
};


// Phone/tablet layout switched on or off (rotation, unfolding, iPad split view):
// the calendar is rendered differently in the two layouts (js/mobile.js)
window.addEventListener('dashboard:layoutchange', () => {
  if (!els.calList) return;
  try { renderCalendar(); } catch (e) { console.error(e); }
  try { syncWeekPager(true); } catch (e) { console.error(e); }
});

function setupEventListeners() {
  document.getElementById('prevMonth').onclick = () => changeMonth(-1);
  document.getElementById('nextMonth').onclick = () => changeMonth(1);

  els.pomoStart.onclick = togglePomodoro;
  els.pomoReset.onclick = resetPomodoro;

  document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
    btn.onclick = () => switchPomoMode(btn.dataset.mode);
  });

  // Quick Capture
  document.getElementById('quickCapture').onclick = quickCapture;

  // Focus Mode
  document.getElementById('focusExit').onclick = exitFocusMode;
  document.getElementById('focusStart').onclick = togglePomodoro;
  document.getElementById('focusReset').onclick = resetPomodoro;
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input/textarea/contenteditable
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.isContentEditable || e.target.contentEditable === 'true') return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        togglePomodoro();
        break;
      case 'r':
        resetPomodoro();
        break;
      case 'q':
        e.preventDefault(); // the dialog's field gets focus right away: do not type the "q" into it
        quickCapture();
        break;
      case 'f':
        if (!focusModeActive) enterFocusMode();
        break;
      case 'd':
        toggleDark();
        break;
      case '?':
        showShortcuts();
        break;
      case 'escape':
        closeShortcuts();
        closeSyncDetails();
        if (focusModeActive) exitFocusMode();
        break;
    }
  });
}

window.showShortcuts = () => {
  document.getElementById('shortcutsModal').classList.add('active');
};

window.closeShortcuts = () => {
  document.getElementById('shortcutsModal').classList.remove('active');
};

// ===== QUICK CAPTURE =====
// New calendar entry for today (title first; time and calendar are optional)
function quickCapture() {
  openCalendarEditor({ date: new Date() });
}

// ===== FOCUS MODE =====
window.enterFocusMode = () => {
  focusModeActive = true;
  els.focusOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  updateFocusDisplay();
};

function exitFocusMode() {
  focusModeActive = false;
  els.focusOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

function updateFocusDisplay() {
  if (!focusModeActive) return;
  const mins = Math.floor(pomo.timeLeft / 60);
  const secs = pomo.timeLeft % 60;
  els.focusTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const total = pomo.modes[pomo.currentMode];
  const progress = (total - pomo.timeLeft) / total;
  const circumference = 283;
  els.focusRing.style.strokeDashoffset = circumference * (1 - progress);
}

// ===== RESET DATA =====
window.resetAllData = () => {
  if (confirm('⚠️ This will clear ALL your dashboard data including:\\n\\n• Calendar tasks\\n• Kanban boards\\n• Goals & Notes\\n• Habits\\n• Statistics\\n\\nThis cannot be undone. Continue?')) {
    localStorage.clear();
    alert('✅ All data has been cleared. The page will now reload.');
    location.reload();
  }
};

// ===== CONFETTI =====
let confettiParticles = [];
let confettiCtx = null;

function setupConfetti() {
  const canvas = els.confettiCanvas;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  confettiCtx = canvas.getContext('2d');

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

function fireConfetti() {
  const colors = ['#6366f1', '#EC4899', '#10b981', '#f59e0b', '#ef4444'];

  for (let i = 0; i < 100; i++) {
    confettiParticles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }

  animateConfetti();
}

function animateConfetti() {
  if (confettiParticles.length === 0) return;

  confettiCtx.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);

  confettiParticles = confettiParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3; // gravity
    p.rotation += p.rotationSpeed;

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rotation * Math.PI / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    confettiCtx.restore();

    return p.y < window.innerHeight + 50;
  });

  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  }
}

// ===== THEME =====
function initTheme() {
  const isDark = localStorage.getItem("darkMode") === "true";
  if (isDark) document.body.classList.add("dark");
  updateThemeBtn();
}

function toggleDark() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
  updateThemeBtn();
  sounds.click();
}

function updateThemeBtn() {
  const isDark = document.body.classList.contains("dark");
  if (!els.btnDark) return;
  const icon = els.btnDark.querySelector('.fab-item-icon');
  const label = els.btnDark.querySelector('.fab-item-label');
  if (icon) icon.textContent = isDark ? "☀️" : "🌙"; else els.btnDark.textContent = isDark ? "☀️" : "🌙";
  if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
}

// ===== FLOATING ACTION MENU =====
window.toggleFabMenu = () => {
  const container = document.getElementById('fabContainer');
  container.classList.toggle('open');
};

// Close FAB menu when clicking escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const container = document.getElementById('fabContainer');
    if (container && container.classList.contains('open')) {
      container.classList.remove('open');
    }
  }
});

// ===== STATISTICS =====
function initStats() {
  updateStats();
  updateStatsTitle();
}

// Toggle Statistics Panel
window.toggleStats = () => {
  const wrapper = document.getElementById('pomoStatsWrapper');
  wrapper.classList.toggle('stats-open');
  // Save state preference
  localStorage.setItem('statsOpen', wrapper.classList.contains('stats-open'));
};

function loadStatsState() {
  const isOpen = localStorage.getItem('statsOpen') === 'true';
  if (isOpen) {
    document.getElementById('pomoStatsWrapper').classList.add('stats-open');
  }
}

function updateStats() {
  // Calculate stats for the currently viewed stats week
  const weekDate = new Date(currentStatsWeekDate);

  // Get Monday of viewed week
  const viewedMonday = new Date(weekDate);
  const d = viewedMonday.getDay();
  const diff = viewedMonday.getDate() - d + (d === 0 ? -6 : 1);
  viewedMonday.setDate(diff);
  viewedMonday.setHours(0, 0, 0, 0);

  let totalPomos = 0;
  let totalTasks = 0;
  let totalHabitChecks = 0;
  const habits = db.getAllHabits();
  const totalPossibleHabits = habits.length * 7;

  // Count habit checks for the stats week (using stats week date)
  const statsWeekKey = db.habitsKey(currentStatsWeekDate);
  for (let h = 0; h < habits.length; h++) {
    for (let day = 0; day < 7; day++) {
      if (localStorage.getItem(`${statsWeekKey}-h${h}-d${day}`)) totalHabitChecks++;
    }
  }

  // Count tasks done in viewed week
  for (let i = 0; i < 7; i++) {
    const date = new Date(viewedMonday);
    date.setDate(viewedMonday.getDate() + i);
    const tasks = db.get(db.calKey(date), []);
    totalTasks += tasks.filter(t => t.done).length;
  }

  // Get pomodoro count for the week (sum of daily counts)
  for (let i = 0; i < 7; i++) {
    const date = new Date(viewedMonday);
    date.setDate(viewedMonday.getDate() + i);
    const pomoKey = `pomo-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    totalPomos += parseInt(localStorage.getItem(pomoKey) || '0');
  }

  // Calculate streak (days with completed tasks)
  const today = new Date();
  let streak = 0;
  const checkDate = new Date(today);
  while (true) {
    const tasks = db.get(db.calKey(checkDate), []);
    if (tasks.some(t => t.done)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 365) break;
  }

  // Update DOM
  document.getElementById('statPomos').textContent = totalPomos;
  document.getElementById('statTasks').textContent = totalTasks;
  document.getElementById('statHabits').textContent = totalPossibleHabits > 0
    ? Math.round((totalHabitChecks / totalPossibleHabits) * 100) + '%'
    : '0%';
  document.getElementById('statStreak').textContent = streak;
}

function updateStatsTitle() {
  const statsTitle = document.getElementById('statsWeekTitle');
  statsTitle.textContent = formatWeekRange(currentStatsWeekDate);
}

window.changeStatsWeek = (delta) => {
  currentStatsWeekDate.setDate(currentStatsWeekDate.getDate() + (delta * 7));
  updateStats();
  updateStatsTitle();
};

window.goToStatsToday = () => {
  currentStatsWeekDate = new Date();
  updateStats();
  updateStatsTitle();
};

// ===== POMODORO =====
function initPomodoro() {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem('pomoDate');
  if (savedDate === today) {
    pomo.sessions = parseInt(localStorage.getItem('pomoSessions') || '0');
  } else {
    pomo.sessions = 0;
    localStorage.setItem('pomoDate', today);
    localStorage.setItem('pomoSessions', '0');
  }
  updatePomoDisplay();
}

function switchPomoMode(mode) {
  if (pomo.isRunning) return;
  pomo.currentMode = mode;
  pomo.timeLeft = pomo.modes[mode];

  document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  els.pomoRing.classList.toggle('break', mode !== 'work');
  updatePomoDisplay();
}

window.togglePomodoro = function () {
  if (pomo.isRunning) {
    pausePomodoro();
  } else {
    startPomodoro();
  }
};

function startPomodoro() {
  pomo.isRunning = true;
  els.pomoStart.textContent = '⏸ Pause';
  document.getElementById('focusStart').textContent = '⏸ Pause';

  // Calculate end time based on actual clock (for background accuracy)
  pomo.endTime = Date.now() + (pomo.timeLeft * 1000);

  // Persist to localStorage for reliability across tab switches and even page reloads
  localStorage.setItem('pomoEndTime', pomo.endTime.toString());
  localStorage.setItem('pomoRunning', 'true');
  localStorage.setItem('pomoMode', pomo.currentMode);

  updatePomoDisplay();

  // Start ambient sound
  const ambientType = document.getElementById('ambientSelect').value;
  if (ambientType !== 'none') {
    startAmbient(ambientType);
  }

  pomo.interval = setInterval(() => {
    // Calculate remaining time from actual clock (fixes background throttling)
    const remaining = Math.max(0, Math.ceil((pomo.endTime - Date.now()) / 1000));
    pomo.timeLeft = remaining;
    updatePomoDisplay();
    updateFocusDisplay();

    if (pomo.timeLeft <= 0) {
      completePomodoro();
    }
  }, 1000);
}

function pausePomodoro() {
  pomo.isRunning = false;
  pomo.endTime = null;  // Clear end time

  // Clear from localStorage
  localStorage.removeItem('pomoEndTime');
  localStorage.removeItem('pomoRunning');

  els.pomoStart.textContent = '▶ Start';
  document.getElementById('focusStart').textContent = '▶ Start';
  updatePomoDisplay();
  clearInterval(pomo.interval);

  // Stop ambient sound
  stopAmbient();
}

function resetPomodoro() {
  pausePomodoro();
  pomo.timeLeft = pomo.modes[pomo.currentMode];
  updatePomoDisplay();
  updateFocusDisplay();
}

function completePomodoro() {
  pausePomodoro();
  sounds.complete();

  if (pomo.currentMode === 'work') {
    pomo.sessions++;

    // Save with date-based key for weekly tracking
    const today = new Date();
    const pomoKey = `pomo-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const dayPomos = parseInt(localStorage.getItem(pomoKey) || '0') + 1;
    localStorage.setItem(pomoKey, dayPomos.toString());

    // Also save for today's display
    localStorage.setItem('pomoSessions', pomo.sessions.toString());
    els.pomoCount.textContent = pomo.sessions;
    updateStats();

    const nextMode = pomo.sessions % 4 === 0 ? 'long' : 'short';
    switchPomoMode(nextMode);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { // not available in iOS Safari tabs
      new Notification('🍅 Pomodoro Complete!', { body: 'Time for a break.' });
    }
  } else {
    switchPomoMode('work');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('⏰ Break Over!', { body: 'Ready to focus?' });
    }
  }
}

function updatePomoDisplay() {
  const mins = Math.floor(pomo.timeLeft / 60);
  const secs = pomo.timeLeft % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  els.pomoTime.textContent = timeStr;

  // Update PiP timer too
  const pipTime = document.getElementById('pipTime');
  const pipPlayPause = document.getElementById('pipPlayPause');
  if (pipTime) pipTime.textContent = timeStr;
  if (pipPlayPause) pipPlayPause.textContent = pomo.isRunning ? '⏸' : '▶';

  // Update Document PiP window if open
  if (pomo.pipWindow && !pomo.pipWindow.closed) {
    const pipDoc = pomo.pipWindow.document;
    const pipTimeEl = pipDoc.getElementById('docPipTime');
    const pipBtnEl = pipDoc.getElementById('docPipBtn');
    if (pipTimeEl) pipTimeEl.textContent = timeStr;
    if (pipBtnEl) pipBtnEl.textContent = pomo.isRunning ? '⏸' : '▶';
  }

  // Update browser tab title when timer is running
  if (pomo.isRunning) {
    document.title = `${timeStr} - Pomodoro | dali's dashboard`;
  } else {
    document.title = "dali's dashboard";
  }

  const total = pomo.modes[pomo.currentMode];
  const progress = (total - pomo.timeLeft) / total;
  const circumference = 283;
  els.pomoRing.style.strokeDashoffset = circumference * (1 - progress);
  els.pomoCount.textContent = pomo.sessions;
}

// Toggle Picture-in-Picture timer
window.togglePiP = async () => {
  // Try Document Picture-in-Picture API first (Chrome 116+)
  if ('documentPictureInPicture' in window) {
    try {
      // If already open, close it
      if (pomo.pipWindow && !pomo.pipWindow.closed) {
        pomo.pipWindow.close();
        pomo.pipWindow = null;
        return;
      }

      // Open Document PiP window
      pomo.pipWindow = await documentPictureInPicture.requestWindow({
        width: 180,
        height: 120
      });

      // Copy all stylesheets from main window to PiP window
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pomo.pipWindow.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media;
          link.href = styleSheet.href;
          pomo.pipWindow.document.head.appendChild(link);
        }
      });

      // Add specific body style for PiP window (dark background, no padding)
      const bodyStyle = pomo.pipWindow.document.createElement('style');
      bodyStyle.textContent = `
        body {
            background: linear-gradient(135deg, #111827 0%, #1f2937 100%) !important;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        .pip-timer {
            position: static !important;
            display: flex !important;
            border: none;
            box-shadow: none;
            background: transparent;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            animation: none;
            width: 100%;
            height: 100%;
        }
        .pip-time {
            color: #ffffff !important;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            font-weight: 800;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            font-variant-numeric: tabular-nums !important;
        }
        .pip-title {
            display: none !important;
        }
        .pip-close { display: none; }
      `;
      pomo.pipWindow.document.head.appendChild(bodyStyle);

      // Add content - clone the existing PiP timer HTML
      const pipContent = document.getElementById('pipTimer').cloneNode(true);
      pipContent.id = 'docPipTimer';

      // Update IDs to be unique in the new window context
      const timeDisplay = pipContent.querySelector('#pipTime');
      if (timeDisplay) timeDisplay.id = 'docPipTime';

      // Update button to call parent window function
      const playBtn = pipContent.querySelector('#pipPlayPause');
      if (playBtn) {
        playBtn.id = 'docPipBtn';
        // Use simple inline attribute which persists in the new window context
        playBtn.setAttribute('onclick', 'window.opener.togglePomodoro()');
      }

      // Append content
      pomo.pipWindow.document.body.appendChild(pipContent);

      // Make togglePomodoro available to PiP window
      pomo.pipWindow.togglePomodoro = togglePomodoro;

    } catch (e) {
      console.log('Document PiP not supported, using in-page PiP');
      // Fallback to in-page PiP
      const pip = document.getElementById('pipTimer');
      pip.classList.toggle('visible');
    }
  } else {
    // Fallback to in-page PiP for unsupported browsers
    const pip = document.getElementById('pipTimer');
    pip.classList.toggle('visible');
  }
};

// ===== CALENDAR =====
function changeMonth(delta) {
  // Step from the 1st: setMonth() on the 29th-31st would skip short months (31.10. + 1 = 1.12.)
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
  renderCalendar();
}

window.goToToday = () => {
  currentDate = new Date();
  calendarSelectedKey = null;
  renderCalendar();
};

// Austrian public holidays
function getEasterDate(year) {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function getAustrianHolidays(year) {
  const easter = getEasterDate(year);
  const holidays = new Map();

  // Fixed holidays - Helper function for consistent date formatting
  const pad = (n) => String(n).padStart(2, '0');
  const makeKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  holidays.set(makeKey(year, 1, 1), 'Neujahr');
  holidays.set(makeKey(year, 1, 6), 'Hl. Drei Könige');
  holidays.set(makeKey(year, 5, 1), 'Staatsfeiertag');
  holidays.set(makeKey(year, 8, 15), 'Mariä Himmelfahrt');
  holidays.set(makeKey(year, 10, 26), 'Nationalfeiertag');
  holidays.set(makeKey(year, 11, 1), 'Allerheiligen');
  holidays.set(makeKey(year, 12, 8), 'Mariä Empfängnis');
  holidays.set(makeKey(year, 12, 25), 'Christtag');
  holidays.set(makeKey(year, 12, 26), 'Stefanitag');

  // Easter-based holidays
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  holidays.set(formatDate(addDays(easter, 1)), 'Ostermontag');
  holidays.set(formatDate(addDays(easter, 39)), 'Christi Himmelfahrt');
  holidays.set(formatDate(addDays(easter, 50)), 'Pfingstmontag');
  holidays.set(formatDate(addDays(easter, 60)), 'Fronleichnam');

  return holidays;
}

function getHoliday(date) {
  const year = date.getFullYear();
  const holidays = getAustrianHolidays(year);
  const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return holidays.get(key);
}

// Entries can have a start/end time and belong to one of the user's calendars
// (rules: js/calendar-core.js, editor and calendar list: js/calendar-ui.js).

// Day whose entries the phone/tablet agenda below the month grid shows (calKey)
let calendarSelectedKey = null;

function isTouchLayout() {
  return !!(window.MobileUI && window.MobileUI.isTouchLayout());
}

const CALENDAR_DAY_FORMAT = { weekday: 'long', day: 'numeric', month: 'long' };

// CSS colour of a calendar (values per theme and contrast setting in css/calendar.css) as
// --dot; data-color names it, so css/calendar.css can give white an edge on white
function paintCalendarColor(el, color) {
  const name = CalendarCore.COLORS.includes(color) ? color : CalendarCore.DEFAULT_CALENDAR.color;
  el.style.setProperty('--dot', `var(--cal-${name})`);
  el.dataset.color = name;
}

function calendarDot(calendar, className) {
  const dot = document.createElement('span');
  dot.className = className || 'calendar-dot';
  paintCalendarColor(dot, calendar.color);
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

// The entry may have moved in the day's list since it was rendered (a sync can re-render
// the calendar while the editor is open): find it again by text, time and calendar.
function findCalendarEntry(tasks, index, original) {
  if (!original) return tasks[index] ? index : -1;
  const identity = DataUtils.goalIdentity(original);
  if (tasks[index] && DataUtils.goalIdentity(tasks[index]) === identity) return index;
  return tasks.findIndex(t => t && typeof t === 'object' && DataUtils.goalIdentity(t) === identity);
}

// Shows a day in the calendar (and its month), e.g. after an entry was moved there
function showCalendarDay(dateObj) {
  calendarSelectedKey = db.calKey(dateObj);
  if (dateObj.getMonth() !== currentDate.getMonth() || dateObj.getFullYear() !== currentDate.getFullYear()) {
    currentDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  }
}

/**
 * Saves an entry from the editor. fromDate/index/original identify the edited entry
 * (null for a new one); a changed date moves the entry to the end of the new day.
 */
function saveCalendarEntry({ fromDate, index, original, date, entry }) {
  const isNew = index === null || index === undefined;
  const toKey = db.calKey(date);
  if (!isNew && db.calKey(fromDate) === toKey) {
    const tasks = db.getCalendarTasks(date);
    const at = findCalendarEntry(tasks, index, original);
    if (at === -1) tasks.push(entry); // deleted meanwhile (other device): keep the edit
    else tasks[at] = entry;
    db.setCalendarTasks(date, tasks);
  } else {
    if (!isNew) {
      const fromTasks = db.getCalendarTasks(fromDate);
      const at = findCalendarEntry(fromTasks, index, original);
      if (at !== -1) {
        fromTasks.splice(at, 1);
        db.setCalendarTasks(fromDate, fromTasks);
      }
    }
    const toTasks = db.getCalendarTasks(date);
    toTasks.push(entry);
    db.setCalendarTasks(date, toTasks);
  }
  showCalendarDay(date);
  renderCalendar();
  renderKanban(); // the weekly overview shows calendar entries too
}

function deleteCalendarEntry(dateObj, index, original) {
  const tasks = db.getCalendarTasks(dateObj);
  const at = findCalendarEntry(tasks, index, original);
  if (at === -1) return;
  tasks.splice(at, 1);
  db.setCalendarTasks(dateObj, tasks);
  renderCalendar();
  renderKanban();
}

function openCalendarEditor(opts) {
  if (window.CalendarUI) window.CalendarUI.openEditor(opts);
}

// Selected day if it is in the shown month, else today (current month) or the 1st
function calendarAgendaDate() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const prefix = `cal-${year}-${month}-`;
  if (calendarSelectedKey && calendarSelectedKey.startsWith(prefix)) {
    return new Date(year, month, parseInt(calendarSelectedKey.slice(prefix.length), 10));
  }
  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() === month) {
    return new Date(year, month, today.getDate());
  }
  return new Date(year, month, 1);
}

function selectCalendarDay(dateObj) {
  calendarSelectedKey = db.calKey(dateObj);
  els.calList.querySelectorAll('.day-cell[data-date]').forEach(cell => {
    const selected = cell.dataset.date === calendarSelectedKey;
    cell.classList.toggle('selected', selected);
    cell.setAttribute('aria-pressed', String(selected));
  });
  renderCalendarAgenda();
}

function isPastDay(dateObj) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(dateObj);
  day.setHours(0, 0, 0, 0);
  return day < today;
}

// "!!!" before the title, as Apple Reminders shows priorities
const PRIORITY_MARKS = { high: '!!!', medium: '!!', low: '!' };

/** Phone/tablet: one row of the day agenda; tapping it opens the entry in the editor. */
function createAgendaRow(task, dateObj, index, calendars, showCalendarName) {
  const calendar = CalendarCore.calendarOf(calendars, task);
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'agenda-row';
  row.dataset.index = index;
  if (task.done) row.classList.add('done');
  if (isPastDay(dateObj)) row.classList.add('past');

  const time = document.createElement('span');
  time.className = 'agenda-time';
  if (CalendarCore.isTimed(task)) {
    const start = document.createElement('span');
    start.className = 'agenda-start';
    start.textContent = CalendarCore.normalizeTime(task.start);
    time.appendChild(start);
    const endValue = CalendarCore.normalizeTime(task.end);
    if (endValue && endValue !== start.textContent) {
      const end = document.createElement('span');
      end.className = 'agenda-end';
      end.textContent = endValue;
      time.appendChild(end);
    }
  } else {
    time.classList.add('all-day');
    time.textContent = 'all-day';
  }

  const main = document.createElement('span');
  main.className = 'agenda-main';
  const title = document.createElement('span');
  title.className = 'agenda-title';
  if (task.priority && PRIORITY_MARKS[task.priority]) {
    const mark = document.createElement('span');
    mark.className = `agenda-priority priority-mark-${task.priority}`;
    mark.textContent = PRIORITY_MARKS[task.priority] + ' ';
    mark.setAttribute('aria-label', `${MobileUI.PRIORITY_LABELS[task.priority]} priority, `);
    title.appendChild(mark);
  }
  title.appendChild(document.createTextNode(task.text));
  main.appendChild(title);
  if (showCalendarName) {
    const name = document.createElement('span');
    name.className = 'agenda-calendar';
    name.textContent = calendar.name;
    main.appendChild(name);
  }

  row.append(time, calendarDot(calendar, 'agenda-dot'), main);
  row.addEventListener('click', () => openCalendarEditor({ date: dateObj, index, entry: task }));
  return row;
}

function renderCalendarAgenda() {
  const box = document.getElementById('calendarAgenda');
  if (!box) return;
  box.textContent = '';
  if (!isTouchLayout()) return;

  const dateObj = calendarAgendaDate();
  const tasks = db.getCalendarTasks(dateObj);
  const calendars = db.getCalendars();

  const head = document.createElement('div');
  head.className = 'calendar-agenda-head';
  const title = document.createElement('h4');
  title.className = 'calendar-agenda-title';
  title.textContent = dateObj.toLocaleDateString('de-DE', CALENDAR_DAY_FORMAT);
  head.appendChild(title);
  const holiday = getHoliday(dateObj);
  if (holiday) {
    const tag = document.createElement('span');
    tag.className = 'calendar-agenda-holiday';
    tag.textContent = holiday;
    head.appendChild(tag);
  }
  box.appendChild(head);

  const list = document.createElement('div');
  list.className = 'calendar-agenda-list';
  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'calendar-agenda-empty';
    empty.textContent = 'No Events';
    list.appendChild(empty);
  }
  // The calendar name is shown as text once there is more than one calendar (not colour alone)
  const showNames = calendars.length > 1;
  CalendarCore.displayOrder(tasks).forEach(idx => {
    const task = typeof tasks[idx] === 'string' ? { text: tasks[idx], done: false, priority: null } : tasks[idx];
    list.appendChild(createAgendaRow(task, dateObj, idx, calendars, showNames));
  });
  box.appendChild(list);

  // Below the agenda, as in Apple Calendar's toolbar: new event and the calendar list
  const footer = document.createElement('div');
  footer.className = 'calendar-agenda-footer';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn calendar-agenda-add';
  add.textContent = 'New Event';
  add.onclick = () => openCalendarEditor({ date: dateObj, returnFocus: add });
  const calendarsBtn = document.createElement('button');
  calendarsBtn.type = 'button';
  calendarsBtn.className = 'btn calendars-btn';
  calendarsBtn.textContent = 'Calendars';
  calendarsBtn.onclick = () => window.CalendarUI && window.CalendarUI.openCalendars({ returnFocus: calendarsBtn });
  footer.append(add, calendarsBtn);
  box.appendChild(footer);
}

function renderCalendar() {
  els.calList.innerHTML = "";
  els.calTitle.textContent = currentDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const touchLayout = isTouchLayout();
  const agendaKey = touchLayout ? db.calKey(calendarAgendaDate()) : null;
  const calendars = db.getCalendars();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    els.calList.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = (d + firstDay - 1) % 7;
    const box = document.createElement("div");
    box.className = "day-cell";
    box.dataset.date = db.calKey(dateObj);
    box.dataset.weekday = weekdays[dayOfWeek];

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      num.classList.add("today");
    }

    // Check for Austrian holidays
    const holiday = getHoliday(dateObj);
    if (holiday) {
      box.classList.add('holiday');
      const holidayLabel = document.createElement("div");
      holidayLabel.className = "holiday-label";
      holidayLabel.textContent = holiday;
      holidayLabel.title = holiday;
      box.appendChild(holidayLabel);
    }

    const tasks = db.get(db.calKey(dateObj), []);

    // Phone/tablet: the month grid only selects a day; its entries are listed below
    // (renderCalendarAgenda). Dots in the colours of the day's calendars, as in Apple Calendar.
    if (touchLayout) {
      const key = db.calKey(dateObj);
      const selected = key === agendaKey;
      box.classList.toggle('selected', selected);
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-pressed', String(selected));
      const label = dateObj.toLocaleDateString('de-DE', CALENDAR_DAY_FORMAT);
      box.setAttribute('aria-label', `${label}${holiday ? ', ' + holiday : ''}, ${tasks.length} ${tasks.length === 1 ? 'event' : 'events'}`);
      box.append(num);
      if (tasks.length) {
        box.classList.add('has-tasks');
        box.dataset.count = tasks.length;
        const dots = document.createElement('span');
        dots.className = 'day-dots';
        dots.setAttribute('aria-hidden', 'true');
        CalendarCore.dayColors(tasks, calendars).forEach(color => dots.appendChild(calendarDot({ color }, 'day-dot')));
        box.appendChild(dots);
      }
      const select = () => selectCalendarDay(dateObj);
      box.addEventListener('click', select);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });
      els.calList.appendChild(box);
      continue;
    }

    const tasksContainer = document.createElement("div");
    tasksContainer.className = "tasks-list";
    CalendarCore.displayOrder(tasks).forEach(idx => {
      const t = typeof tasks[idx] === 'string' ? { text: tasks[idx], done: false, priority: null } : tasks[idx];
      tasksContainer.appendChild(createTaskEl(t, dateObj, idx, calendars));
    });

    // Drag drop
    box.ondragover = (e) => {
      e.preventDefault();
      box.classList.add('drag-over');
    };
    box.ondragleave = (e) => {
      if (!box.contains(e.relatedTarget)) box.classList.remove('drag-over');
    };
    box.ondrop = (e) => handleCalendarDrop(e, dateObj, box);

    const addBtn = document.createElement("button");
    addBtn.className = "add-task-btn";
    addBtn.textContent = "+";
    addBtn.setAttribute('aria-label', `New event on ${dateObj.toLocaleDateString('de-DE', CALENDAR_DAY_FORMAT)}`);
    addBtn.onclick = (e) => {
      e.stopPropagation();
      openCalendarEditor({ date: dateObj });
    };

    box.append(num, tasksContainer, addBtn);
    els.calList.appendChild(box);
  }

  renderCalendarAgenda();
}

// Desktop month cell entry: dot in the calendar's colour, time, title. Double-click opens
// the editor, right-click cycles the priority, drag & drop moves it to another day.
function createTaskEl(task, dateObj, index, calendars) {
  const calendar = CalendarCore.calendarOf(calendars || db.getCalendars(), task);
  const el = document.createElement("div");
  el.className = `task-item ${task.done ? 'done' : ''}`;
  if (task.priority) el.classList.add(`priority-${task.priority}`);
  el.dataset.index = index;
  if (isPastDay(dateObj)) el.classList.add('past');
  el.title = calendar.name;

  el.draggable = true;

  el.ondragstart = (e) => {
    el.classList.add('dragging');
    draggedTask = { task, dateObj, index };
    draggedTaskSource = 'calendar';
    e.dataTransfer.effectAllowed = 'move';
  };
  el.ondragend = () => {
    el.classList.remove('dragging');
    draggedTask = null;
    document.querySelectorAll('.day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
  };

  const span = document.createElement("span");
  span.className = "task-text";
  const range = CalendarCore.formatRange(task);
  if (range) {
    const time = document.createElement('span');
    time.className = 'task-time';
    time.textContent = range;
    span.appendChild(time);
  }
  span.appendChild(document.createTextNode(task.text));

  const setPriority = (priority) => {
    const tasks = db.getCalendarTasks(dateObj);
    const at = findCalendarEntry(tasks, index, task);
    if (at === -1) return;
    tasks[at] = Object.assign({}, tasks[at], { priority });
    db.setCalendarTasks(dateObj, tasks);
    renderCalendar();
    renderKanban(); // Update weekly overview
  };

  // Double-click opens the editor (title, time, calendar, priority)
  span.ondblclick = (e) => {
    e.stopPropagation();
    openCalendarEditor({ date: dateObj, index, entry: task });
  };

  // Right-click to set priority
  el.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const priorities = [null, 'high', 'medium', 'low'];
    const currentIdx = priorities.indexOf(task.priority);
    setPriority(priorities[(currentIdx + 1) % priorities.length]);
  };

  const del = document.createElement("button");
  del.className = "task-delete";
  del.innerHTML = "&times;";
  del.setAttribute('aria-label', `Delete ${task.text}`);
  del.onclick = (e) => {
    e.stopPropagation();
    deleteCalendarEntry(dateObj, index, task);
  };

  el.append(calendarDot(calendar, 'task-dot'), span, del);

  // Touch screens wider than the phone layout (iPad in landscape): "⋯" menu
  if (window.MobileUI) {
    el.appendChild(MobileUI.moreButton(`Actions for ${task.text}`, () => ({
      title: task.text,
      items: [
        { id: 'edit', label: 'Edit…', icon: 'pencil', onSelect: () => openCalendarEditor({ date: dateObj, index, entry: task }) },
        MobileUI.priorityMenu(task.priority, setPriority),
        { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, onSelect: () => deleteCalendarEntry(dateObj, index, task) }
      ]
    })));
  }
  return el;
}

function handleCalendarDrop(e, targetDate, box) {
  e.preventDefault();
  box.classList.remove('drag-over');

  if (!draggedTask || draggedTaskSource !== 'calendar') return;

  const { task, dateObj: fromDate, index: fromIndex } = draggedTask;
  const fromKey = db.calKey(fromDate);
  const toKey = db.calKey(targetDate);

  // Same day - reorder within the day
  if (fromKey === toKey) {
    const tasks = db.getCalendarTasks(targetDate);

    // Find drop position based on mouse position
    const tasksContainer = box.querySelector('.tasks-list');
    const taskElements = [...tasksContainer.querySelectorAll('.task-item:not(.dragging)')];
    let insertIndex = tasks.length;

    for (let i = 0; i < taskElements.length; i++) {
      const rect = taskElements[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertIndex = parseInt(taskElements[i].dataset.index) || i;
        break;
      }
    }

    // Adjust insert index if moving down
    if (insertIndex > fromIndex) insertIndex--;
    if (insertIndex === fromIndex) return; // No change

    // Reorder
    const [movedTask] = tasks.splice(fromIndex, 1);
    tasks.splice(insertIndex, 0, movedTask);
    db.setCalendarTasks(targetDate, tasks);

    renderCalendar();
    renderKanban();
    return;
  }

  // Different day - move between days
  const fromTasks = db.getCalendarTasks(fromDate);
  fromTasks.splice(fromIndex, 1);
  db.setCalendarTasks(fromDate, fromTasks);

  const toTasks = db.getCalendarTasks(targetDate);
  toTasks.push(task);
  db.setCalendarTasks(targetDate, toTasks);

  renderCalendar();
  renderKanban(); // Update weekly overview
}

// ===== HABITS =====
function getHabitKey(hIdx, d) {
  const weekKey = db.habitsKey(currentHabitsWeekDate);
  return `${weekKey}-h${hIdx}-d${d}`;
}

function renderHabits() {
  const habits = db.getAllHabits();
  els.habitsList.innerHTML = "";

  // Determine if viewing current week and which day is today
  const today = new Date();
  const dayOfWeek = today.getDay();
  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to our array (Mon=0)

  // Check if viewing current week
  const mondayViewing = new Date(currentHabitsWeekDate);
  const d = mondayViewing.getDay();
  const diff = mondayViewing.getDate() - d + (d === 0 ? -6 : 1);
  mondayViewing.setDate(diff);
  mondayViewing.setHours(0, 0, 0, 0);

  const mondayToday = new Date();
  const td = mondayToday.getDay();
  const tdiff = mondayToday.getDate() - td + (td === 0 ? -6 : 1);
  mondayToday.setDate(tdiff);
  mondayToday.setHours(0, 0, 0, 0);

  const isCurrentWeek = mondayViewing.getTime() === mondayToday.getTime();

  const headerRow = document.createElement("div");
  headerRow.className = "habit-header-row";
  headerRow.innerHTML = `<div></div>` + weekdays.map((day, idx) =>
    `<div class="${isCurrentWeek && idx === todayIndex ? 'today' : ''}">${day}</div>`
  ).join("");
  els.habitsList.appendChild(headerRow);

  habits.forEach((habit, hIdx) => {
    const row = document.createElement("div");
    row.className = "habit-row";

    const nameEl = document.createElement("div");
    nameEl.className = "habit-name";

    const habitName = typeof habit === 'string' ? habit : habit.name;
    const nameText = document.createElement("span");
    nameText.className = "habit-name-text";
    nameText.textContent = habitName;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-delete-btn";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHabit(hIdx);
    };

    nameEl.append(nameText, deleteBtn);
    const renameHabit = async () => {
      const newName = await showInputModal('Rename Habit', 'Enter new name...', habitName);
      if (newName && newName.trim()) {
        const cleanName = newName.trim();
        if (cleanName !== habitName) {
          // Migrate completion data
          const checks = db.get('habitChecks', {});
          const oldPrefix = habitName + '_';
          const newPrefix = cleanName + '_';
          let migrated = false;

          Object.keys(checks).forEach(k => {
            if (k.startsWith(oldPrefix)) {
              checks[newPrefix + k.substring(oldPrefix.length)] = checks[k];
              delete checks[k];
              migrated = true;
            }
          });

          if (migrated) {
            db.set('habitChecks', checks);
            db.lastLocalChange = Date.now();
            db.pushKey('habitChecks', () => window.supabaseDB.setSetting('habitChecks', checks));
            // Refresh local storage keys to ensure UI renders correctly
            db.loadHabitChecks(checks);
          }
        }

        if (typeof habits[hIdx] === 'object') {
          habits[hIdx].name = cleanName;
        } else {
          habits[hIdx] = cleanName;
        }
        db.setHabits(habits);
        renderHabits();
      }
    };
    nameEl.ondblclick = renameHabit;

    // Touch screens: rename / delete in a menu (no double-click or hover there)
    if (window.MobileUI) {
      nameEl.appendChild(MobileUI.moreButton(`Actions for habit ${habitName}`, () => ({
        title: habitName,
        items: [
          { id: 'rename', label: 'Rename…', icon: 'pencil', onSelect: renameHabit },
          { id: 'delete', label: 'Delete Habit', icon: 'trash', destructive: true, onSelect: () => deleteHabit(hIdx) }
        ]
      })));
    }

    row.appendChild(nameEl);

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const check = document.createElement("div");
      check.className = "habit-check";
      if (isCurrentWeek && dayIdx === todayIndex) {
        check.classList.add("today");
      }
      const key = getHabitKey(hIdx, dayIdx);
      if (localStorage.getItem(key)) check.classList.add("done");

      // Each day is a checkbox for screen readers and keyboards
      check.setAttribute('role', 'checkbox');
      check.tabIndex = 0;
      check.setAttribute('aria-label', `${habitName}, ${weekdays[dayIdx]}`);
      check.setAttribute('aria-checked', String(check.classList.contains('done')));
      check.onkeydown = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation(); // Space must not also start/pause the focus timer
          check.click();
        }
      };

      check.onclick = () => {
        check.classList.toggle("done");
        const isDone = check.classList.contains("done");
        check.setAttribute('aria-checked', String(isDone));

        // Use db.setHabitCheck to ensure cloud sync
        db.setHabitCheck(key, isDone);

        if (isDone) {
          sounds.click();

          // Check if all habits are done for a day (only celebrate on Sunday)
          if (dayIdx === 6) {
            let allDayDone = true;
            for (let h = 0; h < habits.length; h++) {
              // Check local storage directly for other habits' status (fast check)
              if (!localStorage.getItem(getHabitKey(h, dayIdx))) {
                allDayDone = false;
                break;
              }
            }
            if (allDayDone) {
              fireConfetti();
              sounds.complete();
            }
          }

          // Check if this habit is done for the whole week
          let daysComplete = 0;
          for (let day = 0; day < 7; day++) {
            if (localStorage.getItem(getHabitKey(hIdx, day))) daysComplete++;
          }
          if (daysComplete === 7) {
            fireConfetti();
            fireConfetti();
            sounds.complete();
            row.classList.add('habit-week-complete');
            setTimeout(() => row.classList.remove('habit-week-complete'), 2000);
          }
        }
        updateStats();
      };
      row.appendChild(check);
    }

    els.habitsList.appendChild(row);
  });

  // Update analytics
  calculateHabitAnalytics();
}

async function deleteHabit(index) {
  const confirmed = await showConfirmModal('Delete Habit', 'Are you sure you want to delete this habit? This action cannot be undone.', { confirmLabel: 'Delete' });
  if (!confirmed) return;
  const habits = db.getAllHabits();
  habits.splice(index, 1);
  db.setHabits(habits);
  for (let d = 0; d < 7; d++) localStorage.removeItem(getHabitKey(index, d));
  renderHabits();
}

window.addHabit = async () => {
  const habits = db.getAllHabits();
  const name = await showInputModal('New Habit', 'What habit do you want to track?');
  if (name && name.trim()) {
    // Create habit as an object (not a string) for proper Supabase sync
    const newHabit = {
      name: name.trim(),
      color: '#6366f1', // Default color
      history: {}
      // Note: id will be assigned by Supabase on first sync
    };
    habits.push(newHabit);
    db.setHabits(habits);
    renderHabits();
  }
};



function updateHabitsTitle() {
  const habitsTitle = document.getElementById('habitsWeekTitle');
  habitsTitle.textContent = formatWeekRange(currentHabitsWeekDate);
}

window.changeHabitsWeek = (delta) => {
  currentHabitsWeekDate.setDate(currentHabitsWeekDate.getDate() + (delta * 7));
  updateHabitsTitle(); // Update UI first
  try { renderHabits(); } catch (e) { console.error(e); }
};

window.goToHabitsToday = () => {
  currentHabitsWeekDate = new Date();
  updateHabitsTitle();
  try { renderHabits(); } catch (e) { console.error(e); }
};

// ===== HABIT ANALYTICS =====
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Same key as the habit grid writes (getHabitKey), so analytics read the stored checks
function getHabitKeyForWeek(weekDate, hIdx, dayIdx) {
  return `${db.habitsKey(getMondayOfWeek(weekDate))}-h${hIdx}-d${dayIdx}`;
}

function calculateHabitAnalytics() {
  const analyticsEl = document.getElementById('habitAnalytics');
  const overallRateEl = document.getElementById('habitOverallRate');

  // Guard: If elements don't exist, silently return
  if (!analyticsEl) return;

  const habits = db.getAllHabits();
  if (habits.length === 0) {
    analyticsEl.style.display = 'none';
    return;
  }
  analyticsEl.style.display = 'block';

  const today = new Date();
  const currentMonday = getMondayOfWeek(today);

  // Calculate this week's completion rate
  let thisWeekDone = 0;
  let thisWeekTotal = 0;
  const todayDayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

  for (let h = 0; h < habits.length; h++) {
    for (let d = 0; d <= todayDayIdx; d++) {
      thisWeekTotal++;
      const key = getHabitKeyForWeek(currentMonday, h, d);
      if (localStorage.getItem(key)) thisWeekDone++;
    }
  }
  const thisWeekRate = thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;
  if (overallRateEl) overallRateEl.textContent = `${thisWeekRate}%`;

  // Calculate last 4 weeks completion rate
  let last4WeeksDone = 0;
  let last4WeeksTotal = 0;
  for (let w = 0; w < 4; w++) {
    const weekDate = new Date(currentMonday);
    weekDate.setDate(currentMonday.getDate() - (w * 7));
    const maxDay = w === 0 ? todayDayIdx : 6;

    for (let h = 0; h < habits.length; h++) {
      for (let d = 0; d <= maxDay; d++) {
        last4WeeksTotal++;
        const key = getHabitKeyForWeek(weekDate, h, d);
        if (localStorage.getItem(key)) last4WeeksDone++;
      }
    }
  }
  const monthlyRate = last4WeeksTotal > 0 ? Math.round((last4WeeksDone / last4WeeksTotal) * 100) : 0;
  const monthlyEl = document.getElementById('habitMonthlyRate');
  if (monthlyEl) monthlyEl.textContent = `${monthlyRate}%`;

  // Calculate current streak (consecutive days with ALL habits done)
  let currentStreak = 0;
  let checkDate = new Date(today);
  checkDate.setHours(0, 0, 0, 0);

  while (true) {
    const dayOfWeek = checkDate.getDay();
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    let allDone = true;

    for (let h = 0; h < habits.length; h++) {
      const key = getHabitKeyForWeek(checkDate, h, dayIdx);
      if (!localStorage.getItem(key)) {
        allDone = false;
        break;
      }
    }

    if (allDone) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }

    // Limit search to 365 days
    if (currentStreak > 365) break;
  }
  const streakEl = document.getElementById('habitCurrentStreak');
  if (streakEl) streakEl.textContent = currentStreak;

  // Calculate best streak (search last 52 weeks)
  let bestStreak = currentStreak;
  let tempStreak = 0;
  checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 365);

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = checkDate.getDay();
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    let allDone = true;

    for (let h = 0; h < habits.length; h++) {
      const key = getHabitKeyForWeek(checkDate, h, dayIdx);
      if (!localStorage.getItem(key)) {
        allDone = false;
        break;
      }
    }

    if (allDone) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }
  const bestStreakEl = document.getElementById('habitBestStreak');
  if (bestStreakEl) bestStreakEl.textContent = bestStreak;

  // Per-habit breakdown (last 4 weeks)
  const breakdownContainer = document.getElementById('habitBreakdown');
  if (!breakdownContainer) return;
  breakdownContainer.innerHTML = '<h5>Per-Habit Performance (Last 4 Weeks)</h5>';

  habits.forEach((habit, hIdx) => {
    let habitDone = 0;
    let habitTotal = 0;

    for (let w = 0; w < 4; w++) {
      const weekDate = new Date(currentMonday);
      weekDate.setDate(currentMonday.getDate() - (w * 7));
      const maxDay = w === 0 ? todayDayIdx : 6;

      for (let d = 0; d <= maxDay; d++) {
        habitTotal++;
        const key = getHabitKeyForWeek(weekDate, hIdx, d);
        if (localStorage.getItem(key)) habitDone++;
      }
    }

    const percent = habitTotal > 0 ? Math.round((habitDone / habitTotal) * 100) : 0;

    const habitName = typeof habit === 'string' ? habit : habit.name;
    const item = document.createElement('div');
    item.className = 'habit-breakdown-item';
    item.innerHTML = `
      <div class="habit-breakdown-name" title="${escapeHtml(habitName)}">${escapeHtml(habitName)}</div>
      <div class="habit-breakdown-bar">
        <div class="habit-breakdown-fill" style="width: ${percent}%"></div>
      </div>
      <div class="habit-breakdown-percent">${percent}%</div>
    `;
    breakdownContainer.appendChild(item);
  });

  // Weekly trend chart (last 8 weeks)
  const chartContainer = document.getElementById('habitChart');
  if (!chartContainer) return;
  chartContainer.innerHTML = '';

  const weeklyRates = [];
  for (let w = 7; w >= 0; w--) {
    const weekDate = new Date(currentMonday);
    weekDate.setDate(currentMonday.getDate() - (w * 7));

    let weekDone = 0;
    let weekTotal = 0;
    const maxDay = w === 0 ? todayDayIdx : 6;

    for (let h = 0; h < habits.length; h++) {
      for (let d = 0; d <= maxDay; d++) {
        weekTotal++;
        const key = getHabitKeyForWeek(weekDate, h, d);
        if (localStorage.getItem(key)) weekDone++;
      }
    }

    const rate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
    const weekLabel = w === 0 ? 'Now' : `-${w}w`;
    weeklyRates.push({ rate, label: weekLabel });
  }

  weeklyRates.forEach(({ rate, label }) => {
    const bar = document.createElement('div');
    bar.className = 'habit-chart-bar';
    bar.innerHTML = `
      <div class="habit-chart-bar-value">${rate}%</div>
      <div class="habit-chart-bar-fill" style="height: ${rate}px"></div>
      <div class="habit-chart-bar-label">${label}</div>
    `;
    chartContainer.appendChild(bar);
  });
}

// Toggle analytics collapse
window.toggleAnalytics = () => {
  const analytics = document.getElementById('habitAnalytics');
  analytics.classList.toggle('collapsed');
  localStorage.setItem('analyticsCollapsed', analytics.classList.contains('collapsed'));
};

// Restore analytics collapsed state on load
function restoreAnalyticsState() {
  const collapsed = localStorage.getItem('analyticsCollapsed') === 'true';
  if (collapsed) {
    document.getElementById('habitAnalytics')?.classList.add('collapsed');
  }
}

// ===== TODAY'S GOALS =====

// Rollover incomplete goals from previous days to today
function rolloverIncompleteGoals() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayKey = db.goalKey(today);
  let todayGoals = db.get(todayKey, []);
  let hasRollovers = false;

  // Check last 30 days for incomplete goals
  for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - daysAgo);
    const pastKey = db.goalKey(pastDate);

    let pastGoals = db.get(pastKey, []);
    if (pastGoals.length === 0) continue;

    const incomplete = [];
    const completed = [];

    pastGoals.forEach(goal => {
      const goalObj = typeof goal === 'string' ? { text: goal, done: false } : goal;
      if (!goalObj.done) {
        // Add rollover indicator to the goal
        incomplete.push({
          text: goalObj.text,
          done: false,
          rolledFrom: pastDate.toISOString()
        });
        hasRollovers = true;
      } else {
        completed.push(goalObj);
      }
    });

    // If there were incomplete goals, move them to today
    if (incomplete.length > 0) {
      // Keep only completed goals in the past day
      db.setGoals(completed, pastDate);

      // Add incomplete goals to today (avoid duplicates)
      incomplete.forEach(incompleteGoal => {
        const alreadyExists = todayGoals.some(g => {
          const goalText = typeof g === 'string' ? g : g.text;
          return goalText === incompleteGoal.text;
        });
        if (!alreadyExists) {
          todayGoals.push(incompleteGoal);
        }
      });
    }
  }

  // Save today's goals with rollovers
  if (hasRollovers) {
    db.setGoals(todayGoals, today);
  }
}

function renderGoals() {
  const rawGoals = db.getGoals();
  // Map to preserve original indices then sort: Done (true/1) first
  const displayGoals = rawGoals.map((g, i) => ({ task: g, idx: i }));
  displayGoals.sort((a, b) => (b.task.done ? 1 : 0) - (a.task.done ? 1 : 0));

  // The list is rebuilt (re-sort after ticking, refresh after a sync): keyboard and VoiceOver
  // focus stays on the same control of the same goal instead of falling back to the page
  const active = document.activeElement;
  const focusedItem = active && active !== els.goalsList && els.goalsList.contains(active) ? active.closest('.focus-item') : null;
  const refocus = focusedItem && active.classList[0] ? { idx: focusedItem.dataset.idx, control: active.classList[0] } : null;

  els.goalsList.innerHTML = "";

  if (rawGoals.length === 0) {
    els.goalsList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; height: 100%; display: flex; align-items: center; justify-content: center;">What do you want to accomplish today?</div>';
    return;
  }

  // Setup drop zone for the goals list
  els.goalsList.ondragover = (e) => {
    e.preventDefault();
    const dragging = els.goalsList.querySelector('.dragging');
    const siblings = [...els.goalsList.querySelectorAll('.focus-item:not(.dragging)')];
    const afterElement = siblings.find(sibling => {
      const box = sibling.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    if (afterElement) {
      els.goalsList.insertBefore(dragging, afterElement);
    } else if (dragging) {
      els.goalsList.appendChild(dragging);
    }
  };

  displayGoals.forEach(({ task: goal, idx }) => {
    const item = document.createElement("div");
    item.className = `focus-item ${goal.done ? 'done' : ''}`;
    if (goal.urgency) item.classList.add(`urgency-${goal.urgency}`);
    item.draggable = true;
    item.dataset.idx = idx;

    // Drag events for reordering
    item.ondragstart = (e) => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idx);
    };
    item.ondragend = () => {
      item.classList.remove('dragging');
      // Save new order
      const newOrder = [...els.goalsList.querySelectorAll('.focus-item')].map(el => {
        const i = parseInt(el.dataset.idx);
        return rawGoals[i];
      });
      db.setGoals(newOrder);
    };

    // Checkbox
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "focus-checkbox";
    cb.checked = goal.done || false;
    cb.onclick = (e) => {
      e.stopPropagation();
      goal.done = cb.checked;
      const goals = db.getGoals();
      goals[idx] = goal;
      db.setGoals(goals);

      if (cb.checked) {
        sounds.success();
        item.classList.add('completing');
        setTimeout(() => {
          item.classList.remove('completing');
          item.classList.add('done');
          renderGoals(); // Re-sort to top
        }, 400);
      } else {
        item.classList.remove('done');
        renderGoals(); // Re-sort
      }
    };

    // Goal text
    const textDiv = document.createElement("div");
    textDiv.className = "focus-text";
    textDiv.textContent = typeof goal === 'string' ? goal : goal.text;
    // Touch screens: tapping the text ticks the goal (editing is in the "⋯" menu)
    textDiv.onclick = () => {
      if (window.MobileUI && MobileUI.isTouch()) cb.click();
    };

    const editGoal = async () => {
      const currentText = typeof goal === 'string' ? goal : goal.text;
      const newText = await showInputModal('Edit Goal', 'Update your goal...', currentText);
      if (newText && newText.trim()) {
        const goals = db.getGoals();
        goals[idx] = { text: newText.trim(), done: goal.done || false, urgency: goal.urgency || null };
        db.setGoals(goals);
        renderGoals();
      }
    };

    const setUrgency = (urgency) => {
      goal.urgency = urgency;
      const goals = db.getGoals();
      goals[idx] = goal;
      db.setGoals(goals);
      renderGoals();
    };

    // Double-click to edit
    textDiv.ondblclick = editGoal;

    // Right-click to set urgency
    textDiv.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const urgencies = [null, 'high', 'medium', 'low'];
      const currentIdx = urgencies.indexOf(goal.urgency || null);
      setUrgency(urgencies[(currentIdx + 1) % urgencies.length]);
    };

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "focus-delete";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = () => deleteGoal(idx);

    item.append(cb, textDiv, deleteBtn);

    // Touch screens: the same actions in a menu (no hover, double-click or right-click there)
    if (window.MobileUI) {
      const label = textDiv.textContent;
      item.appendChild(MobileUI.moreButton(`Actions for goal ${label}`, () => ({
        title: label,
        items: [
          { id: 'edit', label: 'Edit…', icon: 'pencil', onSelect: editGoal },
          MobileUI.priorityMenu(goal.urgency, setUrgency, 'Urgency'),
          { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, onSelect: () => deleteGoal(idx) }
        ]
      })));
    }
    els.goalsList.appendChild(item);
  });

  if (refocus) {
    const control = els.goalsList.querySelector(`.focus-item[data-idx="${refocus.idx}"] .${CSS.escape(refocus.control)}`);
    if (control) control.focus({ preventScroll: true });
  }
}

window.addGoal = async () => {
  const text = await showInputModal("Today's Goal", "What do you want to accomplish?");
  if (!text || !text.trim()) return;

  const goals = db.getGoals();
  goals.push({ text: text.trim(), done: false, urgency: null });
  db.setGoals(goals);
  renderGoals();
};

window.deleteGoal = (idx) => {
  const goals = db.getGoals();
  goals.splice(idx, 1);
  db.setGoals(goals);
  renderGoals();
};

// ===== QUICK NOTES (deprecated - HTML removed, keeping for data compatibility) =====
let notesDebounceTimer = null;

function loadNotes() {
  if (!els.quickNotes) return; // Element removed from HTML
  els.quickNotes.value = db.getNotes(currentNotesDate);

  // Set up auto-save on input
  els.quickNotes.oninput = () => {
    clearTimeout(notesDebounceTimer);
    notesDebounceTimer = setTimeout(() => {
      db.setNotes(els.quickNotes.value, currentNotesDate);
    }, 500);
  };
}

window.saveNotes = () => {
  if (!els.quickNotes) return;
  db.setNotes(els.quickNotes.value, currentNotesDate);
};

// ===== SIMPLE LISTS (Goals 2026, Shopping, Chores) =====
// Unified dynamic lists
function getListConfig(name) {
  return { key: 'list-' + name, elementId: name + 'List' };
}

function getListItems(listName) {
  return db.get(getListConfig(listName).key, []);
}

function setListItems(listName, items) {
  const config = getListConfig(listName);
  db.set(config.key, items);
  db.lastLocalChange = Date.now();
  // Sync to Supabase (the dirty flag is only cleared after a confirmed upload)
  db.pushKey(config.key, () => window.supabaseDB.setList(listName, items));
}

// Persist list metadata (titles, order) locally and upload it
function saveListMeta(meta) {
  db.set('customListsMeta', meta);
  db.lastLocalChange = Date.now();
  db.pushKey('customListsMeta', () => window.supabaseDB.setSetting('customListsMeta', meta));
}

function renderSimpleList(listName) {
  const config = getListConfig(listName);
  const container = document.getElementById(config.elementId);
  if (!container) return;

  const items = getListItems(listName);
  container.innerHTML = '';
  container.dataset.listName = listName; // Store list name for drop handling

  // Setup drop zone for drag reordering AND cross-list drops
  container.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.classList.add('drag-over');

    // Handle visual reordering within same list
    const dragging = container.querySelector('.dragging');
    if (dragging) {
      const siblings = [...container.querySelectorAll('.simple-list-item:not(.dragging)')];
      const afterElement = siblings.find(sibling => {
        const box = sibling.getBoundingClientRect();
        return e.clientY < box.top + box.height / 2;
      });
      if (afterElement) {
        container.insertBefore(dragging, afterElement);
      } else {
        container.appendChild(dragging);
      }
    }
  };

  container.ondragleave = (e) => {
    // Only remove if actually leaving the container
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over');
    }
  };

  container.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove('drag-over');

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'listItem' && data.sourceList !== listName) {
        // Cross-list move: remove from source, add to target
        const sourceItems = getListItems(data.sourceList);
        const [movedItem] = sourceItems.splice(data.idx, 1);
        setListItems(data.sourceList, sourceItems);

        const targetItems = getListItems(listName);
        targetItems.push(movedItem);
        setListItems(listName, targetItems);

        // Re-render both lists
        renderSimpleList(data.sourceList);
        renderSimpleList(listName);
        sounds.click();
      }
    } catch (err) {
      // Not a cross-list drop, ignore (same-list reorder handled in ondragend)
    }
  };

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-list-placeholder" style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.85rem;">No items yet</div>`;
    return;
  }

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `simple-list-item ${item.done ? 'done' : ''}`;
    div.draggable = true;
    div.dataset.idx = idx;
    div.dataset.listName = listName;

    // Drag events for reordering AND cross-list movement
    div.ondragstart = (e) => {
      div.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Store item data for cross-list drops
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'listItem',
        sourceList: listName,
        idx: idx,
        item: item
      }));
    };
    div.ondragend = () => {
      div.classList.remove('dragging');
      document.querySelectorAll('.simple-list.drag-over').forEach(el => el.classList.remove('drag-over'));

      // Only save reorder if still in same list
      if (container.contains(div)) {
        const currentItems = getListItems(listName);
        const newOrder = [...container.querySelectorAll('.simple-list-item')].map(el => {
          const i = parseInt(el.dataset.idx);
          return currentItems[i];
        }).filter(Boolean);
        if (newOrder.length > 0) {
          setListItems(listName, newOrder);
        }
      }
    };

    const span = document.createElement('span');
    span.textContent = item.text;
    // The text is the toggle (drawn as a round checkbox in the touch layout): checkbox
    // semantics for VoiceOver and the keyboard
    span.setAttribute('role', 'checkbox');
    span.setAttribute('aria-checked', String(!!item.done));
    span.tabIndex = 0;
    span.onkeydown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Space must not also start/pause the focus timer
        span.click();
      }
    };

    // Click to toggle done state
    span.onclick = () => {
      item.done = !item.done;
      span.setAttribute('aria-checked', String(item.done));
      setListItems(listName, items);

      if (item.done) {
        sounds.success();
        div.classList.add('completing');
        setTimeout(() => {
          div.classList.remove('completing');
          div.classList.add('done');
        }, 400);
      } else {
        div.classList.remove('done');
      }

      // Re-render after animation
      setTimeout(() => renderSimpleList(listName), 450);
    };

    // Two-finger click (right-click) to edit
    span.oncontextmenu = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newText = await showInputModal('Edit Item', 'Update...', item.text);
      if (newText && newText.trim()) {
        item.text = newText.trim();
        setListItems(listName, items);
        renderSimpleList(listName);
      }
    };

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.innerHTML = '✕';
    del.onclick = (e) => {
      e.stopPropagation();
      items.splice(idx, 1);
      setListItems(listName, items);
      renderSimpleList(listName);
    };

    div.append(span, del);

    // Touch screens: edit / reorder / move / delete in a menu
    if (window.MobileUI) {
      div.appendChild(MobileUI.moreButton(`Actions for ${item.text}`, () => {
        const otherLists = db.get('customListsMeta', []).filter(m => m.id !== listName);
        const menuItems = [
          { id: 'edit', label: 'Edit…', icon: 'pencil', onSelect: () => editListItem(listName, idx, item.text) },
          { id: 'up', label: 'Move Up', icon: 'arrowUp', disabled: idx === 0, onSelect: () => moveListItem(listName, idx, idx - 1, item.text) },
          { id: 'down', label: 'Move Down', icon: 'arrowDown', disabled: idx === items.length - 1, onSelect: () => moveListItem(listName, idx, idx + 1, item.text) }
        ];
        if (otherLists.length) {
          menuItems.push({
            id: 'move', label: 'Move to List', icon: 'list',
            submenu: { items: otherLists.map(m => ({ id: 'list-' + m.id, label: m.title, onSelect: () => moveListItemToList(listName, idx, m.id, item.text) })) }
          });
        }
        menuItems.push('-', { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, onSelect: () => deleteListItem(listName, idx, item.text) });
        return { title: item.text, items: menuItems };
      }));
    }
    container.appendChild(div);
  });
}

// The menu actions re-read the list and check the item is still where it was:
// a sync from another device may have changed the list while the menu was open.
function listItemAt(items, idx, text) {
  return items[idx] && items[idx].text === text ? items[idx] : null;
}

async function editListItem(listName, idx, text) {
  const items = getListItems(listName);
  const item = listItemAt(items, idx, text);
  if (!item) return;
  const newText = await showInputModal('Edit Item', 'Update...', item.text);
  if (newText && newText.trim()) {
    item.text = newText.trim();
    setListItems(listName, items);
    renderSimpleList(listName);
  }
}

function moveListItem(listName, from, to, text) {
  const items = getListItems(listName);
  if (!listItemAt(items, from, text) || to < 0 || to >= items.length) return;
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  setListItems(listName, items);
  renderSimpleList(listName);
}

// Same as dropping an item on another list
function deleteListItem(listName, idx, text) {
  const items = getListItems(listName);
  if (!listItemAt(items, idx, text)) return;
  items.splice(idx, 1);
  setListItems(listName, items);
  renderSimpleList(listName);
}

function moveListItemToList(sourceList, idx, targetList, text) {
  const sourceItems = getListItems(sourceList);
  if (!listItemAt(sourceItems, idx, text)) return;
  const [moved] = sourceItems.splice(idx, 1);
  setListItems(sourceList, sourceItems);
  const targetItems = getListItems(targetList);
  targetItems.push(moved);
  setListItems(targetList, targetItems);
  renderSimpleList(sourceList);
  renderSimpleList(targetList);
}

window.addListItem = async (listName) => {
  const text = await showInputModal('New Item', 'Add item to list');

  if (!text || !text.trim()) return;

  const items = getListItems(listName);
  items.push({ text: text.trim(), done: false });
  setListItems(listName, items);
  renderSimpleList(listName);
  sounds.click();
};

function renderAllLists() {
  initUnifiedLists();
  renderUnifiedLists();
}

// ===== UNIFIED LISTS LOGIC =====

window.initUnifiedLists = () => {
  if (localStorage.getItem('unifiedListsInited')) return;

  // No default lists - user creates their own
  const existing = db.get('customListsMeta', []);
  if (existing.length === 0) {
    db.set('customListsMeta', [], true); // Start with empty list
  }

  localStorage.setItem('unifiedListsInited', 'true');
};

window.createNewCustomList = async () => {
  const name = await showInputModal('New List', 'Enter a name for your new list');
  if (!name || !name.trim()) return;

  const meta = db.get('customListsMeta', []);
  const id = 'custom-' + Date.now();
  meta.push({ id, title: name.trim() });
  saveListMeta(meta);

  renderUnifiedLists();
};

window.renderUnifiedLists = () => {
  const container = document.getElementById('unifiedListsGrid');
  if (!container) return;
  container.innerHTML = '';

  const meta = db.get('customListsMeta', []);
  meta.forEach((list, index) => {
    const div = document.createElement('div');
    div.className = 'glass-panel list-panel';
    div.setAttribute('draggable', 'true');
    div.setAttribute('data-list-id', list.id);
    div.setAttribute('data-list-index', index);

    // Titles and ids may come from the cloud or a backup file: set them as text/properties only
    div.innerHTML = `
            <div class="list-drag-handle" title="Drag to reorder">⋮⋮</div>
            <button class="delete-list-btn" title="Delete List">×</button>
            <h3 contenteditable="true"
                style="outline:none; cursor:text; padding-bottom:2px;"
                title="Click to edit"></h3>
            <div class="simple-list"></div>
            <button class="btn list-add-item-btn" style="margin-top:auto;">+</button>
        `;
    const titleEl = div.querySelector('h3');
    titleEl.id = `title-${list.id}`;
    titleEl.textContent = list.title;
    titleEl.style.borderBottom = list.title === 'Custom List' ? '1px dashed rgba(255,255,255,0.2)' : 'none';
    titleEl.onblur = () => updateListTitle(list.id, titleEl);
    div.querySelector('.delete-list-btn').onclick = () => deleteList(list.id);
    div.querySelector('.simple-list').id = `${list.id}List`;
    div.querySelector('.list-add-item-btn').onclick = () => addListItem(list.id);

    // Touch screens: rename / reorder / delete in a menu (hover buttons and dragging do not work there)
    if (window.MobileUI) {
      const more = MobileUI.moreButton(`Actions for list ${list.title}`, () => ({
        title: list.title,
        items: [
          { id: 'rename', label: 'Rename…', icon: 'pencil', onSelect: () => renameList(list.id) },
          { id: 'up', label: 'Move Up', icon: 'arrowUp', disabled: index === 0, onSelect: () => moveList(list.id, -1) },
          { id: 'down', label: 'Move Down', icon: 'arrowDown', disabled: index === meta.length - 1, onSelect: () => moveList(list.id, 1) },
          '-',
          { id: 'delete', label: 'Delete List', icon: 'trash', destructive: true, onSelect: () => deleteList(list.id) }
        ]
      }));
      more.classList.add('list-more-btn');
      div.appendChild(more);
    }

    // Drag event handlers
    div.addEventListener('dragstart', handleListDragStart);
    div.addEventListener('dragend', handleListDragEnd);
    div.addEventListener('dragover', handleListDragOver);
    div.addEventListener('drop', handleListDrop);
    div.addEventListener('dragenter', handleListDragEnter);
    div.addEventListener('dragleave', handleListDragLeave);

    container.appendChild(div);
    renderSimpleList(list.id);
  });
};

// === List Drag and Drop ===
let draggedListElement = null;
let draggedListId = null;

function handleListDragStart(e) {
  draggedListElement = this;
  draggedListId = this.getAttribute('data-list-id');
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedListId);
}

function handleListDragEnd(e) {
  this.classList.remove('dragging');
  // Remove all drag-over states
  document.querySelectorAll('.list-panel').forEach(panel => {
    panel.classList.remove('drag-over');
  });
  draggedListElement = null;
  draggedListId = null;
}

function handleListDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // Continuously apply drag-over class while dragging over this element
  // This prevents flickering when moving over child elements
  if (this !== draggedListElement && !this.classList.contains('drag-over')) {
    // Remove from all other panels first
    document.querySelectorAll('.list-panel.drag-over').forEach(panel => {
      if (panel !== this) panel.classList.remove('drag-over');
    });
    this.classList.add('drag-over');
  }
}

function handleListDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  // Drag-over class is now handled by dragover for stability
}

function handleListDragLeave(e) {
  // Only remove drag-over if we're actually leaving the panel
  // Check if the related target (where we're going) is still inside this panel
  const relatedTarget = e.relatedTarget;
  if (relatedTarget && this.contains(relatedTarget)) {
    // Still inside this panel (entered a child element), keep the class
    return;
  }
  this.classList.remove('drag-over');
}

function handleListDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  this.classList.remove('drag-over');

  const targetId = this.getAttribute('data-list-id');
  if (!draggedListId || draggedListId === targetId) return;

  // Reorder the metadata
  const meta = db.get('customListsMeta', []);
  const draggedIndex = meta.findIndex(m => m.id === draggedListId);
  const targetIndex = meta.findIndex(m => m.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Remove dragged item and insert at target position
  const [draggedItem] = meta.splice(draggedIndex, 1);
  meta.splice(targetIndex, 0, draggedItem);

  // Save reordered metadata
  saveListMeta(meta);

  // Re-render with new order
  renderUnifiedLists();
}

window.updateListTitle = (id, el) => {
  const meta = db.get('customListsMeta', []);
  const list = meta.find(m => m.id === id);
  if (list) {
    const newTitle = el.innerText.trim();
    if (!newTitle || newTitle === list.title) {
      el.textContent = list.title;
      return;
    }
    list.title = newTitle;
    // Toggle border
    el.style.borderBottom = list.title === 'Custom List' ? '1px dashed rgba(255,255,255,0.2)' : 'none';
    saveListMeta(meta);
  }
};

// Touch alternatives to editing the title in place and dragging lists
async function renameList(id) {
  const meta = db.get('customListsMeta', []);
  const list = meta.find(m => m.id === id);
  if (!list) return;
  const name = await showInputModal('Rename List', 'List name', list.title);
  if (!name || !name.trim() || name.trim() === list.title) return;
  list.title = name.trim();
  saveListMeta(meta);
  renderUnifiedLists();
}

function moveList(id, delta) {
  const meta = db.get('customListsMeta', []);
  const from = meta.findIndex(m => m.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= meta.length) return;
  const [moved] = meta.splice(from, 1);
  meta.splice(to, 0, moved);
  saveListMeta(meta);
  renderUnifiedLists();
}

window.deleteList = async (id) => {
  // Find list name for better UX
  const meta = db.get('customListsMeta', []);
  const list = meta.find(m => m.id === id);
  const listName = list ? list.title : 'this list';

  const confirmed = await showConfirmModal('Delete List', `Are you sure you want to delete "${listName}"? This action cannot be undone.`, { confirmLabel: 'Delete' });
  if (!confirmed) return;

  const newMeta = meta.filter(m => m.id !== id);
  ['', 'dirty_', 'ts_', 'synced_'].forEach(prefix => localStorage.removeItem(prefix + 'list-' + id));
  saveListMeta(newMeta);

  // Delete the list from cloud using its ID (not title!). If this fails the row is
  // orphaned but harmless: lists are only shown when listed in customListsMeta.
  if (isSupabaseAvailable()) {
    const err = await window.supabaseDB.deleteList(id);
    if (err) db.reportSyncError('list-' + id, err);
  }

  renderUnifiedLists();
};

// ===== WEEKLY REVIEW =====
let reviewDebounceTimer = null;
let reviewPendingWeek = null; // week the pending text was typed for

// Save text typed during the debounce window to the week it belongs to
function flushWeeklyReview() {
  if (!reviewDebounceTimer) return;
  clearTimeout(reviewDebounceTimer);
  reviewDebounceTimer = null;
  db.setWeeklyReview(els.weeklyReview.value, reviewPendingWeek);
}

function loadWeeklyReview() {
  // Reloading the field (week change, second init after login) must not drop typed text
  flushWeeklyReview();
  els.weeklyReview.value = db.getWeeklyReview(currentReviewWeekDate);
  updateReviewTitle();

  // Set up auto-save on input
  els.weeklyReview.oninput = () => {
    clearTimeout(reviewDebounceTimer);
    reviewPendingWeek = new Date(currentReviewWeekDate);
    reviewDebounceTimer = setTimeout(() => {
      reviewDebounceTimer = null;
      db.setWeeklyReview(els.weeklyReview.value, reviewPendingWeek);
    }, 500);
  };
}

window.addEventListener('pagehide', () => {
  if (els.weeklyReview) flushWeeklyReview();
});

window.saveWeeklyReview = () => {
  db.setWeeklyReview(els.weeklyReview.value, currentReviewWeekDate);
};

function updateReviewTitle() {
  const reviewTitle = document.getElementById('reviewWeekTitle');
  reviewTitle.textContent = formatWeekRange(currentReviewWeekDate);
}

window.changeReviewWeek = (delta) => {
  currentReviewWeekDate.setDate(currentReviewWeekDate.getDate() + (delta * 7));
  loadWeeklyReview();
};

window.goToReviewToday = () => {
  currentReviewWeekDate = new Date();
  loadWeeklyReview();
};

// ===== KANBAN =====
function renderKanban() {
  // Week kanban is week-based
  renderKanbanBoard(els.weekKanban, weekdays, true);

  // Backlog (longKanban) is disabled/missing from HTML
  if (els.longKanban) {
    renderKanbanBoard(els.longKanban, ["To Do", "Waiting", "Ideas"], false);
  }
}

// Helper: Get the date for a weekday column (MO, DI, MI, etc.) in the current viewed week
function getDateForWeekday(weekdayIndex) {
  const monday = new Date(currentWeekDate);
  const d = monday.getDay();
  const diff = monday.getDate() - d + (d === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + weekdayIndex);
  return targetDate;
}

// Helper: Get calendar tasks for a specific date
function getCalendarTasksForDate(date) {
  const key = db.calKey(date);
  return db.get(key, []);
}

function renderKanbanBoard(container, columns, isWeekBased) {
  if (!container) return; // Guard against null container
  container.innerHTML = "";
  const boardData = isWeekBased ? db.getKanban() : db.get('backlog', {});

  columns.forEach((colName, colIndex) => {
    const colDiv = document.createElement("div");
    colDiv.className = "kanban-column";
    if (isWeekBased) colDiv.id = `week-day-${colIndex}`; // target of the day strip on phones

    // Highlight today's column in week kanban
    if (isWeekBased) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      // weekdays array is ["MO", "DI", "MI", "DO", "FR", "SA", "SO"]
      // JS getDay(): 0=Sunday, 1=Monday, etc.
      const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to our array

      // Check if we're viewing current week
      const mondayViewing = new Date(currentWeekDate);
      const d = mondayViewing.getDay();
      const diff = mondayViewing.getDate() - d + (d === 0 ? -6 : 1);
      mondayViewing.setDate(diff);
      mondayViewing.setHours(0, 0, 0, 0);

      const mondayToday = new Date();
      const td = mondayToday.getDay();
      const tdiff = mondayToday.getDate() - td + (td === 0 ? -6 : 1);
      mondayToday.setDate(tdiff);
      mondayToday.setHours(0, 0, 0, 0);

      if (colIndex === todayIndex && mondayViewing.getTime() === mondayToday.getTime()) {
        colDiv.classList.add('today');
      }
    }

    const header = document.createElement("div");
    header.className = "kanban-header";

    // Add date for week-based view
    if (isWeekBased) {
      const dayDate = getDateForWeekday(colIndex);
      const dateStr = dayDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

      const dateDiv = document.createElement("div");
      dateDiv.className = "kanban-date";
      dateDiv.textContent = dateStr;
      header.appendChild(dateDiv);

      // Phones (day cards): the whole date as the card's title, "Freitag, 16. Oktober"
      const longDiv = document.createElement("div");
      longDiv.className = "kanban-day-long";
      longDiv.textContent = dayDate.toLocaleDateString('de-DE', CALENDAR_DAY_FORMAT);
      header.appendChild(longDiv);
    }

    const titleSpan = document.createElement("div");
    titleSpan.className = "kanban-weekday";
    titleSpan.textContent = colName;
    header.appendChild(titleSpan);

    // Add holiday indicator for week-based view
    if (isWeekBased) {
      const dayDate = getDateForWeekday(colIndex);
      const holiday = getHoliday(dayDate);
      if (holiday) {
        colDiv.classList.add('holiday');
        const holidaySpan = document.createElement("div");
        holidaySpan.className = "kanban-holiday";
        holidaySpan.textContent = holiday;
        holidaySpan.title = holiday;
        header.appendChild(holidaySpan);
      }
    }

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "kanban-items";
    itemsDiv.dataset.column = colName;
    itemsDiv.dataset.weekBased = isWeekBased;

    itemsDiv.ondragover = e => {
      e.preventDefault();
      itemsDiv.classList.add('drag-over');
    };
    itemsDiv.ondragleave = (e) => {
      if (!itemsDiv.contains(e.relatedTarget)) itemsDiv.classList.remove('drag-over');
    };
    itemsDiv.ondrop = e => handleKanbanDrop(e, colName, isWeekBased);

    // For week-based kanban, first add calendar tasks for this day
    if (isWeekBased) {
      const dayDate = getDateForWeekday(colIndex);
      const calendarTasks = getCalendarTasksForDate(dayDate);

      // Same order as in the calendar: all-day entries, then by time
      CalendarCore.displayOrder(calendarTasks).forEach(idx => {
        const task = calendarTasks[idx];
        const taskObj = typeof task === 'string' ? { text: task, done: false, priority: null } : task;
        itemsDiv.appendChild(createKanbanCard(taskObj, colName, idx, isWeekBased, true, dayDate));
      });
    }

    // Then add kanban-only tasks
    const items = boardData[colName] || [];
    items.forEach((item, idx) => {
      if (!item) return;
      // Support both old string format and new object format
      const task = typeof item === 'string' ? { text: item, done: false, priority: null } : item;
      itemsDiv.appendChild(createKanbanCard(task, colName, idx, isWeekBased, false, null));
    });

    const btn = document.createElement("button");
    btn.className = "kanban-add-btn";
    btn.textContent = "+";
    btn.onclick = async () => {
      const t = await showInputModal(`New Card - ${colName}`, 'What needs to be done?');
      if (t && t.trim()) addKanbanItem(colName, { text: t.trim(), done: false, priority: null }, isWeekBased);
    };

    colDiv.append(header, itemsDiv, btn);
    container.appendChild(colDiv);
  });

  if (isWeekBased && container === els.weekKanban) syncWeekPager(true);
}

// ===== WEEK ON PHONES: day strip + swipeable day cards =====
// Phones (touch layout under 700px, css/mobile.css): the seven day columns sit side by side
// in a horizontal scroll-snap pager - one day per swipe, with the system's own scrolling -
// under a strip of the week as in Apple Calendar (weekday, date, dots for the day's
// entries; a tap scrolls to that day). The pager takes the height of the day on screen, so
// a busy day leaves no empty space under a quiet one, and the page stays short.
const weekPagerMedia = window.matchMedia('(max-width: 699px)');
const weekPagerMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let weekPagerReady = false;
let weekPagerFrame = 0;
let weekPagerSettle = null;
let weekPagerResize = null;

function isWeekPager() {
  return isTouchLayout() && weekPagerMedia.matches;
}

function weekPagerOn() {
  return !!els.weekKanban && els.weekKanban.classList.contains('is-pager');
}

function mondayOf(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function todayWeekdayIndex() {
  return (new Date().getDay() + 6) % 7;
}

function weekPagerColumns() {
  return els.weekKanban ? Array.from(els.weekKanban.children).filter(el => el.classList.contains('kanban-column')) : [];
}

// The day whose card is closest to the middle of the pager (also at the end of the row,
// where the last card cannot reach the snap position)
function visibleWeekPagerDay() {
  const pager = els.weekKanban;
  const mid = pager.scrollLeft + pager.clientWidth / 2;
  let best = 0;
  let bestDistance = Infinity;
  weekPagerColumns().forEach((col, i) => {
    const distance = Math.abs(col.offsetLeft + col.offsetWidth / 2 - mid);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

function scrollWeekPagerTo(index, animate) {
  const pager = els.weekKanban;
  const col = weekPagerColumns()[index];
  if (!col) return;
  const pad = parseFloat(getComputedStyle(pager).paddingLeft) || 0;
  pager.scrollTo({ left: col.offsetLeft - pad, behavior: animate && !weekPagerMotion.matches ? 'smooth' : 'auto' });
}

function updateWeekPagerHeight(animate) {
  if (!weekPagerOn()) return; // a settle timer or resize can arrive after leaving the pager
  const col = weekPagerColumns()[weekPagerDay];
  if (!col) return;
  const pager = els.weekKanban;
  const height = `${col.offsetHeight}px`;
  if (pager.style.height === height) return;
  if (!animate) pager.style.transition = 'none';
  pager.style.height = height;
  if (!animate) {
    void pager.offsetHeight; // apply without the transition, then allow it again
    pager.style.transition = '';
  }
}

function markWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  strip.querySelectorAll('.week-strip-day').forEach((btn, i) => {
    if (i === weekPagerDay) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}

function countLabel(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function renderWeekStrip() {
  const panel = els.weekKanban.closest('.week-overview-section').querySelector('.week-nav-panel');
  let strip = document.getElementById('weekStrip');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'weekStrip';
    strip.className = 'week-strip';
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Days of the week');
    panel.appendChild(strip);
  }
  const board = db.getKanban();
  const calendars = db.getCalendars();
  const currentWeek = mondayOf(currentWeekDate).getTime() === mondayOf(new Date()).getTime();
  strip.replaceChildren(...weekdays.map((day, i) => {
    const date = getDateForWeekday(i);
    const entries = getCalendarTasksForDate(date);
    const open = (board[day] || []).filter(t => t && !(typeof t === 'object' && t.done)).length;
    const holiday = getHoliday(date);
    const today = currentWeek && i === todayWeekdayIndex();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'week-strip-day';
    btn.classList.toggle('today', today);
    btn.classList.toggle('holiday', !!holiday);
    btn.setAttribute('aria-controls', `week-day-${i}`);
    const parts = [date.toLocaleDateString('de-DE', CALENDAR_DAY_FORMAT)];
    if (today) parts.push('today');
    if (holiday) parts.push(holiday);
    parts.push(entries.length || open
      ? [entries.length ? countLabel(entries.length, 'event', 'events') : '', open ? countLabel(open, 'open task', 'open tasks') : ''].filter(Boolean).join(', ')
      : 'nothing planned');
    btn.setAttribute('aria-label', parts.join(', '));

    const weekday = document.createElement('span');
    weekday.className = 'week-strip-weekday';
    weekday.textContent = day.charAt(0) + day.slice(1).toLowerCase();
    const number = document.createElement('span');
    number.className = 'week-strip-date';
    number.textContent = date.getDate();
    // Up to three dots: the colours of the day's calendars, then one for open tasks
    const dots = document.createElement('span');
    dots.className = 'week-strip-dots';
    dots.setAttribute('aria-hidden', 'true');
    CalendarCore.dayColors(entries, calendars, 3).forEach(color => dots.appendChild(calendarDot({ color }, 'week-strip-dot')));
    if (open && dots.children.length < 3) {
      const taskDot = document.createElement('span');
      taskDot.className = 'week-strip-dot is-task';
      dots.appendChild(taskDot);
    }
    btn.append(weekday, number, dots);
    btn.addEventListener('click', () => {
      weekPagerDay = i;
      markWeekStrip();
      scrollWeekPagerTo(i, true);
    });
    return btn;
  }));
  markWeekStrip();
}

function setupWeekPager() {
  weekPagerReady = true;
  els.weekKanban.addEventListener('scroll', () => {
    if (!weekPagerOn()) return;
    cancelAnimationFrame(weekPagerFrame);
    weekPagerFrame = requestAnimationFrame(() => {
      const day = visibleWeekPagerDay();
      if (day !== weekPagerDay) {
        weekPagerDay = day;
        markWeekStrip();
      }
    });
    // Height follows once the swipe has settled on a day
    clearTimeout(weekPagerSettle);
    weekPagerSettle = setTimeout(() => updateWeekPagerHeight(true), 90);
  }, { passive: true });
  if (typeof ResizeObserver === 'function') {
    weekPagerResize = new ResizeObserver(() => {
      if (weekPagerOn()) updateWeekPagerHeight(true);
    });
  }
  // Switch between pager and columns in the resize event itself: js/mobile.js keeps the
  // reading position in the next animation frame, which must already see the new layout
  // (a media query "change" event can come after that frame)
  const resync = () => {
    if (isWeekPager() !== weekPagerOn()) syncWeekPager(true);
  };
  window.addEventListener('resize', resync);
  if (weekPagerMedia.addEventListener) weekPagerMedia.addEventListener('change', resync);
  else if (weekPagerMedia.addListener) weekPagerMedia.addListener(resync);
}

// After every render of the week and when the layout changes: pager + strip on phones,
// columns (as before) on wider screens and the desktop
function syncWeekPager(instant) {
  if (!els.weekKanban) return;
  if (!weekPagerReady) setupWeekPager();
  const pager = isWeekPager();
  const section = els.weekKanban.closest('.week-overview-section');
  section.classList.toggle('week-pager', pager);
  els.weekKanban.classList.toggle('is-pager', pager);
  if (weekPagerResize) weekPagerResize.disconnect();
  if (!pager) {
    clearTimeout(weekPagerSettle);
    cancelAnimationFrame(weekPagerFrame);
    els.weekKanban.style.height = '';
    const strip = document.getElementById('weekStrip');
    if (strip) strip.remove();
    return;
  }
  if (weekPagerDay === null) {
    weekPagerDay = mondayOf(currentWeekDate).getTime() === mondayOf(new Date()).getTime() ? todayWeekdayIndex() : 0;
  }
  renderWeekStrip();
  scrollWeekPagerTo(weekPagerDay, !instant);
  updateWeekPagerHeight(!instant);
  if (weekPagerResize) weekPagerColumns().forEach(col => weekPagerResize.observe(col));
}

function createKanbanCard(task, colName, index, isWeekBased, isFromCalendar = false, sourceDate = null) {
  const div = document.createElement("div");
  div.className = `kanban-card ${task.done ? 'done' : ''}`;
  if (task.priority) div.classList.add(`priority-${task.priority}`);
  if (isFromCalendar) div.classList.add('from-calendar');
  div.dataset.index = index;
  div.dataset.isFromCalendar = isFromCalendar;
  div.dataset.colName = colName;

  // Add 'past' class for calendar events from dates before today
  if (isFromCalendar && sourceDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(sourceDate);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      div.classList.add('past');
    }
  }

  div.draggable = true; // All tasks can be dragged

  const textSpan = document.createElement("span");
  textSpan.className = "kanban-card-text";
  textSpan.textContent = task.text;

  // Calendar entries: dot in the calendar's colour and the time, as in the calendar
  if (isFromCalendar) {
    const calendar = CalendarCore.calendarOf(db.getCalendars(), task);
    paintCalendarColor(div, calendar.color);
    div.title = calendar.name;
    const range = CalendarCore.formatRange(task);
    if (range) {
      const time = document.createElement('span');
      time.className = 'kanban-card-time';
      time.textContent = range;
      textSpan.prepend(time);
    }
    div.appendChild(calendarDot(calendar, 'kanban-card-dot'));
  }

  // Only show checkbox for tasks added in weekly overview, not calendar events
  if (!isFromCalendar) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "task-checkbox";
    cb.checked = task.done;
    cb.onclick = (e) => {
      e.stopPropagation();
      task.done = cb.checked;
      updateKanbanItem(colName, index, task, isWeekBased);

      if (cb.checked) {
        sounds.success();
        div.classList.add('completing');
        setTimeout(() => div.classList.remove('completing'), 400);
      }
      div.classList.toggle('done', task.done);
    };
    div.appendChild(cb);
    // Touch screens: tapping the text ticks the task (editing is in the "⋯" menu)
    textSpan.onclick = () => {
      if (window.MobileUI && MobileUI.isTouch()) cb.click();
    };
  }

  div.appendChild(textSpan);

  const setPriority = (priority) => {
    if (isFromCalendar && sourceDate) {
      // The entry lives in the calendar: change it there (found again by text/time/calendar)
      const tasks = db.getCalendarTasks(sourceDate);
      const at = findCalendarEntry(tasks, index, task);
      if (at === -1) return;
      tasks[at] = Object.assign({}, tasks[at], { priority });
      db.setCalendarTasks(sourceDate, tasks);
      renderCalendar();
    } else {
      task.priority = priority;
      updateKanbanItem(colName, index, task, isWeekBased);
    }
    renderKanban();
  };

  const removeTask = () => {
    if (isFromCalendar && sourceDate) deleteCalendarEntry(sourceDate, index, task);
    else deleteKanbanItem(colName, index, isWeekBased);
  };

  const editTask = async () => {
    // Calendar entries open in the calendar editor (title, time, calendar)
    if (isFromCalendar && sourceDate) {
      openCalendarEditor({ date: sourceDate, index, entry: task });
      return;
    }
    const newText = await showInputModal('Edit Card', 'Update your card...', task.text);
    if (newText && newText.trim() && newText.trim() !== task.text) {
      task.text = newText.trim();
      updateKanbanItem(colName, index, task, isWeekBased);
      renderKanban();
    }
  };

  // Right-click to set priority
  textSpan.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const priorities = [null, 'high', 'medium', 'low'];
    const currentIdx = priorities.indexOf(task.priority);
    setPriority(priorities[(currentIdx + 1) % priorities.length]);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "kanban-card-delete";
  deleteBtn.innerHTML = "&times;";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    removeTask();
  };

  div.appendChild(deleteBtn);

  // Touch screens: edit / priority / move / delete in a menu instead of
  // double-click, right-click, hover and drag & drop
  if (window.MobileUI) {
    div.appendChild(MobileUI.moreButton(`Actions for ${task.text}`, () => {
      const menuItems = [
        { id: 'edit', label: 'Edit…', icon: 'pencil', onSelect: editTask },
        MobileUI.priorityMenu(task.priority, setPriority)
      ];
      if (isWeekBased) {
        menuItems.push({
          id: 'move', label: 'Move to Day', icon: 'calendar',
          submenu: {
            items: weekdays.map((day, dayIdx) => ({
              id: 'day-' + day,
              label: getDateForWeekday(dayIdx).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric' }),
              checked: day === colName,
              onSelect: () => moveKanbanCardToDay({ task, colName, index, isWeekBased, isFromCalendar, sourceDate }, day)
            }))
          }
        });
      }
      menuItems.push('-', { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, onSelect: removeTask });
      return { title: task.text, items: menuItems };
    }));
  }

  // Enable dragging for all tasks
  div.ondragstart = (e) => {
    div.classList.add('dragging');
    e.dataTransfer.setData("text/plain", JSON.stringify({
      type: 'kanban',
      col: colName,
      idx: index,
      task,
      isWeekBased,
      isFromCalendar,
      sourceDate: sourceDate ? sourceDate.toISOString() : null
    }));
  };
  div.ondragend = () => {
    div.classList.remove('dragging');
    document.querySelectorAll('.kanban-items.drag-over').forEach(el => el.classList.remove('drag-over'));
  };

  div.ondblclick = editTask;

  return div;
}

// Touch alternative to dragging a card onto another day column: appends it there.
// Mirrors the "different column" branch of handleKanbanDrop.
function moveKanbanCardToDay(card, targetCol) {
  const { task, colName, index, isWeekBased, isFromCalendar, sourceDate } = card;
  if (targetCol === colName) return;

  if (isFromCalendar && sourceDate) {
    const targetColIndex = weekdays.indexOf(targetCol);
    if (targetColIndex === -1) return;
    const targetDate = getDateForWeekday(targetColIndex);

    const sourceTasks = db.getCalendarTasks(sourceDate);
    const at = findCalendarEntry(sourceTasks, index, task);
    if (at === -1) return;
    const [moved] = sourceTasks.splice(at, 1);
    db.setCalendarTasks(sourceDate, sourceTasks);

    const targetTasks = db.getCalendarTasks(targetDate);
    targetTasks.push(moved);
    db.setCalendarTasks(targetDate, targetTasks);

    renderCalendar();
    renderKanban();
    return;
  }

  const board = getKanbanBoard(isWeekBased);
  if (!board[colName] || board[colName][index] === undefined) return;
  const [moved] = board[colName].splice(index, 1);
  if (!board[targetCol]) board[targetCol] = [];
  board[targetCol].push(moved);
  setKanbanBoard(board, isWeekBased);
  renderKanban();
}

function getKanbanBoard(isWeekBased) {
  return isWeekBased ? db.getKanban() : db.get('backlog', {});
}

function setKanbanBoard(board, isWeekBased) {
  if (isWeekBased) {
    db.setKanban(board);
  } else {
    db.setBacklog(board);
  }
}

function updateKanbanItem(col, index, task, isWeekBased) {
  const board = getKanbanBoard(isWeekBased);
  if (board[col] && board[col][index] !== undefined) {
    board[col][index] = task;
    setKanbanBoard(board, isWeekBased);
  }
}

function editKanbanItem(col, index, newText, isWeekBased) {
  const board = getKanbanBoard(isWeekBased);
  if (board[col] && board[col][index] !== undefined) {
    const task = typeof board[col][index] === 'string'
      ? { text: newText, done: false, priority: null }
      : { ...board[col][index], text: newText };
    board[col][index] = task;
    setKanbanBoard(board, isWeekBased);
    renderKanban();
  }
}

function handleKanbanDrop(e, targetCol, isWeekBased) {
  e.preventDefault();
  const itemsContainer = e.currentTarget;
  document.querySelectorAll(".kanban-items.drag-over").forEach(el => el.classList.remove('drag-over'));

  try {
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (data.type !== 'kanban') return;

    // Only allow drop within same board type
    if (data.isWeekBased !== isWeekBased) return;

    // Calculate drop position based on mouse position
    const cardElements = [...itemsContainer.querySelectorAll('.kanban-card:not(.dragging)')];
    let insertIndex = cardElements.length;

    for (let i = 0; i < cardElements.length; i++) {
      const rect = cardElements[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertIndex = i;
        break;
      }
    }

    // Handle calendar-sourced task move
    if (data.isFromCalendar && data.sourceDate) {
      const sourceDate = new Date(data.sourceDate);
      const sourceCol = data.col;

      // Get the target date based on the column
      const targetColIndex = weekdays.indexOf(targetCol);
      if (targetColIndex === -1) return;
      const targetDate = getDateForWeekday(targetColIndex);

      const sourceKey = db.calKey(sourceDate);
      const targetKey = db.calKey(targetDate);

      // Same column - reorder within the day
      if (sourceCol === targetCol && sourceKey === targetKey) {
        const tasks = db.getCalendarTasks(targetDate);
        let adjustedInsertIndex = insertIndex;

        // Adjust for moved item
        if (adjustedInsertIndex > data.idx) adjustedInsertIndex--;
        if (adjustedInsertIndex === data.idx) return; // No change

        const [movedTask] = tasks.splice(data.idx, 1);
        tasks.splice(adjustedInsertIndex, 0, movedTask);
        db.setCalendarTasks(targetDate, tasks);

        renderCalendar();
        renderKanban();
        return;
      }

      // Different column - move between days
      const sourceTasks = db.getCalendarTasks(sourceDate);
      sourceTasks.splice(data.idx, 1);
      db.setCalendarTasks(sourceDate, sourceTasks);

      const targetTasks = db.getCalendarTasks(targetDate);
      targetTasks.splice(insertIndex, 0, data.task);
      db.setCalendarTasks(targetDate, targetTasks);

      renderCalendar();
      renderKanban();
      return;
    }

    // Handle normal kanban task move/reorder
    const board = getKanbanBoard(isWeekBased);

    // Count calendar items in the target column (they appear first visually)
    let calendarCardCount = 0;
    if (isWeekBased) {
      calendarCardCount = itemsContainer.querySelectorAll('.kanban-card.from-calendar').length;
    }

    // Adjust insertIndex for kanban items (subtract calendar items)
    let kanbanInsertIndex = Math.max(0, insertIndex - calendarCardCount);

    // Same column - reorder
    if (data.col === targetCol) {
      const items = board[targetCol] || [];

      // Clamp to valid range
      kanbanInsertIndex = Math.min(kanbanInsertIndex, items.length);

      // Adjust for moved item position
      if (kanbanInsertIndex > data.idx) kanbanInsertIndex--;
      if (kanbanInsertIndex === data.idx) return; // No change

      const [movedTask] = items.splice(data.idx, 1);
      items.splice(kanbanInsertIndex, 0, movedTask);
      board[targetCol] = items;
    } else {
      // Different column - move
      if (board[data.col]) board[data.col].splice(data.idx, 1);
      if (!board[targetCol]) board[targetCol] = [];

      // Clamp to valid range
      kanbanInsertIndex = Math.min(kanbanInsertIndex, board[targetCol].length);
      board[targetCol].splice(kanbanInsertIndex, 0, data.task || data.text);
    }

    setKanbanBoard(board, isWeekBased);
    renderKanban();
  } catch (err) { console.error('[Kanban] Drop error:', err); }
}

function addKanbanItem(col, text, isWeekBased) {
  const board = getKanbanBoard(isWeekBased);
  if (!board[col]) board[col] = [];
  board[col].push(text);
  setKanbanBoard(board, isWeekBased);
  renderKanban();
}

function deleteKanbanItem(col, index, isWeekBased) {
  const board = getKanbanBoard(isWeekBased);
  if (board[col]) {
    board[col].splice(index, 1);
    setKanbanBoard(board, isWeekBased);
    renderKanban();
  }
}

// ===== EXPORT / IMPORT =====
// Supabase stores the login session (incl. refresh token) under "sb-<project>-auth-token".
// It must never end up in a backup file and must survive an import.
const isAuthStorageKey = (key) => key.startsWith('sb-');

window.exportData = () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isAuthStorageKey(key)) continue;
    data[key] = localStorage.getItem(key);
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dalis-dashboard-backup-${getTodayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  sounds.click();
};

window.importData = async (event) => {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = ''; // allow choosing the same file again
  if (!file) return;

  const fail = (message) => showNotification('❌ Import failed', message, 'info', 8000);
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    return fail('The file is not a valid JSON backup.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('Unexpected backup format.');
  const entries = Object.entries(data).filter(([key]) => !isAuthStorageKey(key));
  if (entries.length === 0) return fail('The backup is empty.');
  if (entries.some(([, value]) => typeof value !== 'string')) return fail('Unexpected backup format (values must be text).');

  const uploads = isSupabaseAvailable();
  const confirmed = await showConfirmModal('Import backup?',
    `All dashboard data on this device will be replaced by the ${entries.length} entries from "${file.name}"` +
    (uploads ? ' and then uploaded to the cloud.' : '.'), { confirmLabel: 'Import' });
  if (!confirmed) return;

  // Keep the login session, replace everything else
  const session = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isAuthStorageKey(key)) session.push([key, localStorage.getItem(key)]);
  }
  try {
    localStorage.clear();
    session.forEach(([key, value]) => localStorage.setItem(key, value));
    entries.forEach(([key, value]) => localStorage.setItem(key, value));
  } catch (err) {
    return fail('Not enough storage space on this device: ' + describeError(err));
  }

  // Without the upload, the next sync would replace the restored data with the cloud version
  if (uploads) {
    const result = await db.pushToCloud();
    if (result.errors.length > 0) console.warn('[Import] Upload errors:', result.errors);
  }
  sounds.success();
  location.reload();
};

// ===== START =====
// Export init for auth module to call after login
window.initDashboard = init;
window.addEventListener('DOMContentLoaded', init);
window.toggleDark = toggleDark;

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Sync Pomodoro timer when tab becomes visible (for background accuracy)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pomo.isRunning && pomo.endTime) {
    const remaining = Math.max(0, Math.ceil((pomo.endTime - Date.now()) / 1000));
    pomo.timeLeft = remaining;
    updatePomoDisplay();
    updateFocusDisplay();
    if (pomo.timeLeft <= 0) {
      completePomodoro();
    }
  }
});

// Restore timer on page load if it was running
window.addEventListener('load', () => {
  const savedEndTime = localStorage.getItem('pomoEndTime');
  const wasRunning = localStorage.getItem('pomoRunning') === 'true';
  const savedMode = localStorage.getItem('pomoMode');

  if (wasRunning && savedEndTime) {
    const endTime = parseInt(savedEndTime);
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

    if (remaining > 0) {
      // Timer still has time left - restore it
      if (savedMode) {
        pomo.currentMode = savedMode;
      }
      pomo.endTime = endTime;
      pomo.timeLeft = remaining;
      startPomodoro();
    } else {
      // Timer already finished while page was closed
      localStorage.removeItem('pomoEndTime');
      localStorage.removeItem('pomoRunning');
      localStorage.removeItem('pomoMode');
    }
  }
});

// ===== SIDEBAR DATE TIME =====
function updateSidebarDateTime() {
  const el = document.getElementById('sidebarDateTime');
  if (!el) return;
  const now = new Date();
  // Format: 07.01.2026
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  // Format: 09:16:45
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${day}.${month}.${year} - ${hours}:${minutes}:${seconds}`;
}

// Start the clock
updateSidebarDateTime();
setInterval(updateSidebarDateTime, 1000);

// ===== GYM HUB =====
const gymQuotes = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Discipline is choosing between what you want now and what you want most.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Success isn't always about greatness. It's about consistency.",
  "Don't wish for it. Work for it.",
  "The body achieves what the mind believes.",
  "Sweat is just fat crying.",
  "Push yourself because no one else is going to do it for you.",
  "The only way to define your limits is by going beyond them."
];

function toggleGymHub() {
  const content = document.getElementById('gymHubContent');
  const toggle = document.getElementById('gymHubToggle');

  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    toggle.textContent = '▲';
    window.loadGymData();
    updateGymQuote();
  } else {
    content.classList.add('collapsed');
    toggle.textContent = '▼';
  }

  // Save state (local UI preference, not synced)
  localStorage.setItem('gymHubOpen', JSON.stringify(!content.classList.contains('collapsed')));
}

function updateGymQuote() {
  const quoteEl = document.getElementById('gymQuote');
  if (quoteEl) {
    const randomQuote = gymQuotes[Math.floor(Math.random() * gymQuotes.length)];
    quoteEl.textContent = `"${randomQuote}"`;
  }
}

// ===== DATE NAVIGATION STATE =====
let trainingDateOffset = 0;  // 0 = today, -1 = yesterday, etc.
let nutritionDateOffset = 0;
let supplementsWeekOffset = 0;  // 0 = this week, -1 = last week, etc.

function getDateKeyWithOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const dateStr = date.toLocaleDateString('en-US', options);

  if (offset === 0) return 'Today';
  return dateStr;
}

function formatWeekDisplay(weekOffset) {
  // Calculate the Monday of the target week
  const today = new Date();
  const currentDay = today.getDay();
  const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff + (weekOffset * 7));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const options = { month: 'short', day: 'numeric' };
  const weekRange = `${monday.toLocaleDateString('en-US', options)} - ${sunday.toLocaleDateString('en-US', options)}`;

  if (weekOffset === 0) return 'This Week';
  return weekRange;
}

// ===== TRAINING DATE NAVIGATION =====
function navigateTrainingDate(direction) {
  trainingDateOffset += direction;

  // Don't allow going into the future
  if (trainingDateOffset > 0) {
    trainingDateOffset = 0;
  }

  updateTrainingDateDisplay();
  loadTrainingDataForDate(getDateKeyWithOffset(trainingDateOffset));
}

function goToTrainingToday() {
  trainingDateOffset = 0;
  updateTrainingDateDisplay();
  loadTrainingDataForDate(getDateKeyWithOffset(0));
}

function updateTrainingDateDisplay() {
  const display = document.getElementById('trainingDateDisplay');
  if (display) {
    display.textContent = formatDateDisplay(trainingDateOffset);
  }

  // Disable "next" button if at today
  const nextBtn = document.getElementById('trainingNextBtn');
  if (nextBtn) {
    nextBtn.disabled = trainingDateOffset >= 0;
  }

  // Toggle Today button
  const todayBtn = document.getElementById('trainingTodayBtn');
  if (todayBtn) {
    todayBtn.style.display = trainingDateOffset === 0 ? 'none' : 'flex';
  }
}

function loadTrainingDataForDate(dateKey) {
  const gymData = db.get('gymHubData', {});
  const dayData = gymData[dateKey] || {};

  console.log('Loading training data for:', dateKey, dayData);

  // Load workout log
  const workoutLogEl = document.getElementById('workoutLog');
  if (workoutLogEl) {
    workoutLogEl.value = dayData.workoutLog || '';
  }

  // Load progress
  const progressWeightEl = document.getElementById('progressWeight');
  const progressBodyFatEl = document.getElementById('progressBodyFat');
  const progressNotesEl = document.getElementById('progressNotes');

  if (progressWeightEl) progressWeightEl.value = dayData.progress?.weight || '';
  if (progressBodyFatEl) progressBodyFatEl.value = dayData.progress?.bodyFat || '';
  if (progressNotesEl) progressNotesEl.value = dayData.progress?.notes || '';

  // Make inputs readonly if viewing historical data
  const isHistorical = trainingDateOffset < 0;
  const inputs = [workoutLogEl, progressWeightEl, progressBodyFatEl, progressNotesEl];

  inputs.forEach(input => {
    if (input) {
      input.readOnly = isHistorical;
      input.style.opacity = isHistorical ? '0.7' : '1';
    }
  });
}

// ===== NUTRITION DATE NAVIGATION =====
function navigateNutritionDate(direction) {
  nutritionDateOffset += direction;

  // Don't allow going into the future
  if (nutritionDateOffset > 0) {
    nutritionDateOffset = 0;
  }

  updateNutritionDateDisplay();
  loadNutritionDataForDate(getDateKeyWithOffset(nutritionDateOffset));
}

function goToNutritionToday() {
  nutritionDateOffset = 0;
  updateNutritionDateDisplay();
  loadNutritionDataForDate(getDateKeyWithOffset(0));
}

function updateNutritionDateDisplay() {
  const display = document.getElementById('nutritionDateDisplay');
  if (display) {
    display.textContent = formatDateDisplay(nutritionDateOffset);
  }

  // Disable "next" button if at today
  const nextBtn = document.getElementById('nutritionNextBtn');
  if (nextBtn) {
    nextBtn.disabled = nutritionDateOffset >= 0;
  }

  // Toggle Today button
  const todayBtn = document.getElementById('nutritionTodayBtn');
  if (todayBtn) {
    todayBtn.style.display = nutritionDateOffset === 0 ? 'none' : 'flex';
  }
}

function loadNutritionDataForDate(dateKey) {
  const gymData = db.get('gymHubData', {});
  const dayData = gymData[dateKey] || {};

  // Load macros for the specific date
  if (dayData.macros) {
    document.getElementById('macroCalories').value = dayData.macros.calories || '';
    document.getElementById('macroProtein').value = dayData.macros.protein || '';
    document.getElementById('macroCarbs').value = dayData.macros.carbs || '';
    document.getElementById('macroFat').value = dayData.macros.fat || '';
  } else {
    document.getElementById('macroCalories').value = '';
    document.getElementById('macroProtein').value = '';
    document.getElementById('macroCarbs').value = '';
    document.getElementById('macroFat').value = '';
  }

  // Update charts
  updateMacroChart();

  // Make inputs readonly if viewing historical data
  const isHistorical = nutritionDateOffset < 0;
  ['macroCalories', 'macroProtein', 'macroCarbs', 'macroFat'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.readOnly = isHistorical;
      input.style.opacity = isHistorical ? '0.7' : '1';
    }
  });
}

// ===== SUPPLEMENTS WEEK NAVIGATION =====
function navigateSupplementsDate(direction) {
  supplementsWeekOffset += direction;

  // Don't allow going into the future
  if (supplementsWeekOffset > 0) {
    supplementsWeekOffset = 0;
  }

  updateSupplementsDateDisplay();
  renderSupplementsForWeek(supplementsWeekOffset);
}

function goToSupplementsToday() {
  supplementsWeekOffset = 0;
  updateSupplementsDateDisplay();
  renderSupplementsForWeek(0);
}

function updateSupplementsDateDisplay() {
  const display = document.getElementById('supplementsDateDisplay');
  if (display) {
    display.textContent = formatWeekDisplay(supplementsWeekOffset);
  }

  // Disable "next" button if at current week
  const nextBtn = document.getElementById('supplementsNextBtn');
  if (nextBtn) {
    nextBtn.disabled = supplementsWeekOffset >= 0;
  }

  // Toggle Today button
  const todayBtn = document.getElementById('supplementsTodayBtn');
  if (todayBtn) {
    todayBtn.style.display = supplementsWeekOffset === 0 ? 'none' : 'flex';
  }
}

function renderSupplementsForWeek(weekOffset) {
  const container = document.getElementById('supplementList');
  if (!container) return;

  const gymData = db.get('gymHubData', {});
  const supplements = gymData.supplements || [];
  const history = gymData.supplementsTaken || {};

  // Calculate week keys for the specified week offset
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sun, 1=Mon
  const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff + (weekOffset * 7));

  const weekKeys = [];
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    // Use local date format to match getTodayKey()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    weekKeys.push(key);
  }

  // Header
  let html = `
    <div class="supp-tracker-header">
      <span class="supp-header-spacer"></span>
      <div class="supp-header-days">
        ${weekDays.map(d => `<div class="supp-header-day">${d}</div>`).join('')}
      </div>
    </div>
  `;

  if (supplements.length === 0) {
    container.innerHTML = '<div class="empty-state">No supplements added</div>';
    return;
  }

  const isHistorical = weekOffset < 0;

  supplements.forEach((name, idx) => {
    html += `<div class="supp-row">
      <div style="display:flex; align-items:center; flex:1; min-width:0;">
        <span class="supp-name">${escapeHtml(name)}</span>
        <button class="delete-btn" style="margin-left:6px; opacity:0; transition:opacity 0.2s; flex-shrink:0;" onclick="event.stopPropagation(); deleteSupplement(${idx})">×</button>
      </div>
      <div class="supp-days-grid">`;

    weekKeys.forEach(key => {
      const takenList = history[key] || [];
      const isActive = takenList.includes(name);
      const activeClass = isActive ? 'active' : '';
      // Names are looked up by index on click (see listener below), never embedded in JS
      html += `<div class="day-circle ${activeClass}" data-supp-index="${idx}" data-date="${key}" title="${key}"></div>`;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll('.day-circle[data-supp-index]').forEach(circle => {
    circle.onclick = () => {
      const suppName = supplements[parseInt(circle.dataset.suppIndex)];
      if (suppName !== undefined) toggleSupplementDay(suppName, circle.dataset.date);
    };
  });

  // Quick fix for delete visibility
  const rows = container.querySelectorAll('.supp-row');
  rows.forEach(row => {
    row.onmouseenter = () => row.querySelector('.delete-btn').style.opacity = '1';
    row.onmouseleave = () => row.querySelector('.delete-btn').style.opacity = '0';
  });
}

// Make navigation functions global
window.navigateTrainingDate = navigateTrainingDate;
window.navigateNutritionDate = navigateNutritionDate;
window.navigateSupplementsDate = navigateSupplementsDate;
window.goToTrainingToday = goToTrainingToday;
window.goToNutritionToday = goToNutritionToday;
window.goToSupplementsToday = goToSupplementsToday;

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function saveGymData(type) {
  const todayKey = getTodayKey();
  let gymData = db.get('gymHubData', {});

  if (!gymData[todayKey]) {
    gymData[todayKey] = {};
  }

  switch (type) {
    case 'nutritionNotes':
      gymData[todayKey].nutritionNotes = document.getElementById('nutritionNotes').value;
      break;
    case 'macros':
      gymData[todayKey].macros = {
        calories: document.getElementById('macroCalories').value,
        protein: document.getElementById('macroProtein').value,
        carbs: document.getElementById('macroCarbs').value,
        fat: document.getElementById('macroFat').value
      };
      break;
    case 'workoutLog':
      gymData[todayKey].workoutLog = document.getElementById('workoutLog').value;
      break;
    case 'progress':
      gymData[todayKey].progress = {
        weight: document.getElementById('progressWeight').value,
        bodyFat: document.getElementById('progressBodyFat').value,
        notes: document.getElementById('progressNotes').value
      };
      break;
    case 'inspirationNotes':
      // Inspiration is global, not per-day
      gymData.inspiration = document.getElementById('inspirationNotes').value;
      break;
  }

  db.set('gymHubData', gymData);
  syncGymData();

  // Visual feedback
  showNotification('Saved! 💪', '', 'success');
}

// Sets an input's value if the element exists (several Health Hub fields were removed from the page)
function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value === undefined || value === null ? '' : value;
}

function loadGymData() {
  const todayKey = getTodayKey();
  const gymData = db.get('gymHubData', {});
  const todayData = gymData[todayKey] || {};

  setInputValue('nutritionNotes', todayData.nutritionNotes);

  const macros = todayData.macros || {};
  setInputValue('macroCalories', macros.calories);
  setInputValue('macroProtein', macros.protein);
  setInputValue('macroCarbs', macros.carbs);
  setInputValue('macroFat', macros.fat);

  setInputValue('workoutLog', todayData.workoutLog);

  const progress = todayData.progress || {};
  setInputValue('progressWeight', progress.weight);
  setInputValue('progressBodyFat', progress.bodyFat);
  setInputValue('progressNotes', progress.notes);

  setInputValue('inspirationNotes', gymData.inspiration);
}

// Restore Gym Hub state on load
document.addEventListener('DOMContentLoaded', () => {
  const isOpen = db.get('gymHubOpen', false);
  if (isOpen) {
    const content = document.getElementById('gymHubContent');
    const toggle = document.getElementById('gymHubToggle');
    if (content && toggle) {
      content.classList.remove('collapsed');
      toggle.textContent = '▲';
      updateGymQuote();
    }
  }

  // The hero row (streak, water, macros, supplements) is always visible: load today's values
  try { window.loadGymData(); } catch (e) { console.error('[Health Hub] load failed', e); }
  updateHeroSupplementButtons();
});

// Make functions global
window.toggleGymHub = toggleGymHub;
window.saveGymData = saveGymData;
window.loadGymData = loadGymData;

// ===== WATER TRACKER =====
let currentWater = 0;
const waterGoal = 3000;

function addWater(amount) {
  const todayData = db.get('gymHubData', {})[getTodayKey()] || {};
  currentWater = (Number(todayData.water) || 0) + amount;
  updateWaterDisplay();
  saveGymData('water');
}

function resetWater() {
  currentWater = 0;
  updateWaterDisplay();
  saveGymData('water');
}

function updateWaterDisplay() {
  const amountEl = document.getElementById('waterAmount');
  const fillEl = document.getElementById('waterProgressFill');
  const amountCardEl = document.getElementById('waterAmountCard');
  const fillCardEl = document.getElementById('waterProgressFillCard');
  const percentage = Math.min((currentWater / waterGoal) * 100, 100);

  if (amountEl) amountEl.textContent = currentWater;
  if (fillEl) fillEl.style.width = `${percentage}%`;
  if (amountCardEl) amountCardEl.textContent = currentWater;
  if (fillCardEl) fillCardEl.style.width = `${percentage}%`;
}

window.addWater = addWater;
window.resetWater = resetWater;

// ===== SLEEP TRACKER =====
let currentSleepQuality = 0;

function setSleepQuality(quality) {
  currentSleepQuality = quality;
  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.quality) === quality);
  });
}

window.setSleepQuality = setSleepQuality;

// ===== PR TRACKER =====
function renderPRList() {
  const gymData = db.get('gymHubData', {});
  const prs = gymData.personalRecords || [];
  const container = document.getElementById('prList');
  if (!container) return;

  container.innerHTML = prs.map((pr, i) => `
    <div class="pr-item">
      <span class="pr-exercise">${escapeHtml(pr.exercise)}</span>
      <span class="pr-weight">${escapeHtml(pr.weight)}</span>
      <button class="pr-delete" onclick="deletePR(${i})">×</button>
    </div>
  `).join('');
}

function addPR() {
  const exercise = document.getElementById('prExercise').value.trim();
  const weight = document.getElementById('prWeight').value.trim();
  if (!exercise || !weight) return;

  const gymData = db.get('gymHubData', {});
  if (!gymData.personalRecords) gymData.personalRecords = [];
  gymData.personalRecords.push({ exercise, weight, date: getTodayKey() });
  db.set('gymHubData', gymData);

  document.getElementById('prExercise').value = '';
  document.getElementById('prWeight').value = '';
  renderPRList();
  syncGymData();
}

function deletePR(index) {
  const gymData = db.get('gymHubData', {});
  gymData.personalRecords.splice(index, 1);
  db.set('gymHubData', gymData);
  renderPRList();
  syncGymData();
}

window.addPR = addPR;
window.deletePR = deletePR;

// ===== SUPPLEMENT TRACKER =====
// ===== SUPPLEMENT TRACKER =====
function renderSupplements() {
  renderSupplementsForWeek(supplementsWeekOffset);
}

window.toggleSupplementDay = function (name, dateKey) {
  console.log('toggleSupplementDay called:', name, dateKey);
  const gymData = db.get('gymHubData', {});
  if (!gymData.supplementsTaken) gymData.supplementsTaken = {};
  if (!gymData.supplementsTaken[dateKey]) gymData.supplementsTaken[dateKey] = [];

  const list = gymData.supplementsTaken[dateKey];
  const idx = list.indexOf(name);

  if (idx > -1) {
    list.splice(idx, 1);
    console.log('Removed', name, 'from', dateKey);
  } else {
    list.push(name);
    console.log('Added', name, 'to', dateKey);
  }

  db.set('gymHubData', gymData);
  db.set('gymHubData', gymData);
  renderSupplementsForWeek(supplementsWeekOffset);
  syncGymData();
};

async function addSupplement() {
  const name = await showInputModal("Add Supplement", "Creatine, Vitamin D...");
  if (!name || !name.trim()) return;

  const gymData = db.get('gymHubData', {});
  if (!gymData.supplements) gymData.supplements = [];
  gymData.supplements.push(name.trim());
  db.set('gymHubData', gymData);

  renderSupplements();
  syncGymData();
}

function deleteSupplement(index) {
  const gymData = db.get('gymHubData', {});
  gymData.supplements.splice(index, 1);
  db.set('gymHubData', gymData);
  renderSupplements();
  syncGymData();
}

function toggleSupplement(name) {
  const gymData = db.get('gymHubData', {});
  const todayKey = getTodayKey();
  if (!gymData.supplementsTaken) gymData.supplementsTaken = {};
  if (!gymData.supplementsTaken[todayKey]) gymData.supplementsTaken[todayKey] = [];

  const idx = gymData.supplementsTaken[todayKey].indexOf(name);
  if (idx > -1) {
    gymData.supplementsTaken[todayKey].splice(idx, 1);
  } else {
    gymData.supplementsTaken[todayKey].push(name);
  }

  db.set('gymHubData', gymData);
  renderSupplements();
  updateHeroSupplementButtons();
  syncGymData();
}

// Quick toggle supplement from hero section
function quickToggleSupplement(name) {
  const gymData = db.get('gymHubData', {});
  const todayKey = getTodayKey();
  if (!gymData.supplementsTaken) gymData.supplementsTaken = {};
  if (!gymData.supplementsTaken[todayKey]) gymData.supplementsTaken[todayKey] = [];

  const idx = gymData.supplementsTaken[todayKey].indexOf(name);
  if (idx > -1) {
    gymData.supplementsTaken[todayKey].splice(idx, 1);
    showNotification(`${name} unmarked`, '', 'info');
  } else {
    gymData.supplementsTaken[todayKey].push(name);
    showNotification(`${name} ✓`, '', 'success');
  }

  db.set('gymHubData', gymData);
  renderSupplements();
  updateHeroSupplementButtons();
  syncGymData();
}

// Update hero supplement buttons to reflect taken state
function updateHeroSupplementButtons() {
  const gymData = db.get('gymHubData', {});
  const todayKey = getTodayKey();
  const takenToday = gymData.supplementsTaken?.[todayKey] || [];

  document.querySelectorAll('.supp-quick-btn').forEach(btn => {
    const suppName = btn.dataset.supp;
    if (takenToday.includes(suppName)) {
      btn.classList.add('taken');
    } else {
      btn.classList.remove('taken');
    }
  });
}

window.addSupplement = addSupplement;
window.deleteSupplement = deleteSupplement;
window.toggleSupplement = toggleSupplement;
window.quickToggleSupplement = quickToggleSupplement;
window.updateHeroSupplementButtons = updateHeroSupplementButtons;

// ===== WORKOUT STREAK =====
function calculateStreak() {
  const gymData = db.get('gymHubData', {});
  const workoutDays = gymData.workoutDays || [];

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

    if (workoutDays.includes(dateKey)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function updateStreakDisplay() {
  const streak = calculateStreak();
  const streakEl = document.getElementById('streakNumber');
  if (streakEl) streakEl.textContent = streak;

  // Render last 14 days
  const gymData = db.get('gymHubData', {});
  const workoutDays = gymData.workoutDays || [];
  const historyEl = document.getElementById('streakHistory');
  if (!historyEl) return;

  let dots = '';
  for (let i = 13; i >= 0; i--) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    dots += `<div class="streak-dot ${workoutDays.includes(dateKey) ? 'active' : ''}"></div>`;
  }
  historyEl.innerHTML = dots;
}

function logWorkoutDay() {
  const gymData = db.get('gymHubData', {});
  if (!gymData.workoutDays) gymData.workoutDays = [];

  const todayKey = getTodayKey();
  if (!gymData.workoutDays.includes(todayKey)) {
    gymData.workoutDays.push(todayKey);
    db.set('gymHubData', gymData);
    showNotification('Workout logged! 🔥', '', 'success');
  } else {
    showNotification('Already logged today!', '', 'info');
  }

  updateStreakDisplay();
  syncGymData();
}

window.logWorkoutDay = logWorkoutDay;

// ===== REST TIMER =====
let timerSeconds = 90;
let timerInterval = null;
let timerRunning = false;

function setTimer(seconds) {
  timerSeconds = seconds;
  timerRunning = false;
  if (timerInterval) clearInterval(timerInterval);
  updateTimerDisplay();

  document.querySelectorAll('.timer-preset').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  const startBtn = document.getElementById('timerStartBtn');
  if (startBtn) {
    startBtn.textContent = 'Start';
    startBtn.classList.remove('running');
  }
}

function toggleTimer() {
  if (timerRunning) {
    // Pause
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStartBtn').textContent = 'Start';
    document.getElementById('timerStartBtn').classList.remove('running');
  } else {
    // Start
    timerRunning = true;
    document.getElementById('timerStartBtn').textContent = 'Pause';
    document.getElementById('timerStartBtn').classList.add('running');
    document.getElementById('timerDisplay').classList.add('running');
    document.getElementById('timerDisplay').classList.remove('finished');

    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById('timerStartBtn').textContent = 'Start';
        document.getElementById('timerStartBtn').classList.remove('running');
        document.getElementById('timerDisplay').classList.remove('running');
        document.getElementById('timerDisplay').classList.add('finished');

        // Play sound or vibrate
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showNotification('Rest complete! 💪', '', 'success');
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 90;
  updateTimerDisplay();

  const startBtn = document.getElementById('timerStartBtn');
  const displayEl = document.getElementById('timerDisplay');
  if (startBtn) {
    startBtn.textContent = 'Start';
    startBtn.classList.remove('running');
  }
  if (displayEl) {
    displayEl.classList.remove('running', 'finished');
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  const displayEl = document.getElementById('timerDisplay');
  if (displayEl) displayEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

window.setTimer = setTimer;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;

// ===== WEEKLY GOALS =====
function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum}`;
}

function renderWeeklyGoals() {
  const gymData = db.get('gymHubData', {});
  const weekKey = getWeekKey();
  const goals = gymData.weeklyGoals?.[weekKey] || [];
  const container = document.getElementById('weeklyGoalsList');
  if (!container) return;

  container.innerHTML = goals.map((goal, i) => `
    <div class="weekly-goal-item ${goal.done ? 'done' : ''}" onclick="toggleWeeklyGoal(${i})">
      <div class="goal-check">${goal.done ? '✓' : ''}</div>
      <span class="goal-text">${escapeHtml(goal.text)}</span>
      <button class="goal-delete" onclick="event.stopPropagation(); deleteWeeklyGoal(${i})">×</button>
    </div>
  `).join('');
}

function addWeeklyGoal() {
  const text = document.getElementById('newWeeklyGoal').value.trim();
  if (!text) return;

  const gymData = db.get('gymHubData', {});
  const weekKey = getWeekKey();
  if (!gymData.weeklyGoals) gymData.weeklyGoals = {};
  if (!gymData.weeklyGoals[weekKey]) gymData.weeklyGoals[weekKey] = [];
  gymData.weeklyGoals[weekKey].push({ text, done: false });
  db.set('gymHubData', gymData);

  document.getElementById('newWeeklyGoal').value = '';
  renderWeeklyGoals();
  syncGymData();
}

function toggleWeeklyGoal(index) {
  const gymData = db.get('gymHubData', {});
  const weekKey = getWeekKey();
  gymData.weeklyGoals[weekKey][index].done = !gymData.weeklyGoals[weekKey][index].done;
  db.set('gymHubData', gymData);
  renderWeeklyGoals();
  syncGymData();
}

function deleteWeeklyGoal(index) {
  const gymData = db.get('gymHubData', {});
  const weekKey = getWeekKey();
  gymData.weeklyGoals[weekKey].splice(index, 1);
  db.set('gymHubData', gymData);
  renderWeeklyGoals();
  syncGymData();
}

window.addWeeklyGoal = addWeeklyGoal;
window.toggleWeeklyGoal = toggleWeeklyGoal;
window.deleteWeeklyGoal = deleteWeeklyGoal;

// ===== TRAINING GOALS (Checklist) =====
function renderTrainingGoals() {
  const gymData = db.get('gymHubData', {});
  const goals = gymData.trainingGoals || [];
  const container = document.getElementById('trainingGoalsList');
  if (!container) return;

  container.innerHTML = goals.map((goal, i) => `
    <div class="weekly-goal-item ${goal.done ? 'done' : ''}" onclick="toggleTrainingGoal(${i})">
      <div class="goal-check">${goal.done ? '✓' : ''}</div>
      <span class="goal-text">${escapeHtml(goal.text)}</span>
      <button class="delete-goal-btn" onclick="event.stopPropagation(); deleteTrainingGoal(${i})">×</button>
    </div>
  `).join('');
}

function addTrainingGoal() {
  const text = document.getElementById('newTrainingGoal').value.trim();
  if (!text) return;

  const gymData = db.get('gymHubData', {});
  if (!gymData.trainingGoals) gymData.trainingGoals = [];
  gymData.trainingGoals.push({ text, done: false });
  db.set('gymHubData', gymData);

  document.getElementById('newTrainingGoal').value = '';
  renderTrainingGoals();
  syncGymData();
}

function toggleTrainingGoal(index) {
  const gymData = db.get('gymHubData', {});
  if (gymData.trainingGoals && gymData.trainingGoals[index]) {
    gymData.trainingGoals[index].done = !gymData.trainingGoals[index].done;
    db.set('gymHubData', gymData);
    renderTrainingGoals();
    syncGymData();
  }
}

function deleteTrainingGoal(index) {
  const gymData = db.get('gymHubData', {});
  if (gymData.trainingGoals) {
    gymData.trainingGoals.splice(index, 1);
    db.set('gymHubData', gymData);
    renderTrainingGoals();
    syncGymData();
  }
}

window.addTrainingGoal = addTrainingGoal;
window.toggleTrainingGoal = toggleTrainingGoal;
window.deleteTrainingGoal = deleteTrainingGoal;

// ===== SYNC HELPER =====
function syncGymData() {
  const gymData = db.get('gymHubData', {});
  db.lastLocalChange = Date.now();
  db.pushKey('gymHubData', () => window.supabaseDB.setSetting('gymHubData', gymData));
}

// ===== ENHANCED LOAD GYM DATA =====
const originalLoadGymData = loadGymData;
window.loadGymData = function () {
  originalLoadGymData();
  renderWeeklyGoals();
  renderTrainingGoals();
  renderSupplements();

  const todayKey = getTodayKey();
  const gymData = db.get('gymHubData', {});
  const todayData = gymData[todayKey] || {};

  // Load water
  currentWater = todayData.water || 0;
  updateWaterDisplay();

  // Load sleep
  if (todayData.sleep) {
    setInputValue('sleepHours', todayData.sleep.hours);
    if (todayData.sleep.quality) setSleepQuality(todayData.sleep.quality);
  }

  // Load measurements
  if (todayData.measurements) {
    setInputValue('measureChest', todayData.measurements.chest);
    setInputValue('measureWaist', todayData.measurements.waist);
    setInputValue('measureArms', todayData.measurements.arms);
    setInputValue('measureLegs', todayData.measurements.legs);
  }

  // Load weekly split
  if (gymData.weeklySplit) {
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      const input = document.getElementById(`split${day}`);
      if (input) input.value = gymData.weeklySplit[day.toLowerCase()] || '';
    });
  }

  // Render dynamic lists
  renderPRList();
  renderSupplements();
  updateStreakDisplay();
  renderWeeklyGoals();
};

// ===== ENHANCED SAVE GYM DATA =====
const originalSaveGymData = saveGymData;
window.saveGymData = function (type) {
  const todayKey = getTodayKey();
  let gymData = db.get('gymHubData', {});
  if (!gymData[todayKey]) gymData[todayKey] = {};

  switch (type) {
    case 'water':
      gymData[todayKey].water = currentWater;
      break;
    case 'sleep':
      gymData[todayKey].sleep = {
        hours: document.getElementById('sleepHours').value,
        quality: currentSleepQuality
      };
      break;
    case 'measurements':
      gymData[todayKey].measurements = {
        chest: document.getElementById('measureChest').value,
        waist: document.getElementById('measureWaist').value,
        arms: document.getElementById('measureArms').value,
        legs: document.getElementById('measureLegs').value
      };
      break;
    case 'weeklySplit':
      if (!gymData.weeklySplit) gymData.weeklySplit = {};
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
        const input = document.getElementById(`split${day}`);
        if (input) gymData.weeklySplit[day.toLowerCase()] = input.value;
      });
      break;
    default:
      originalSaveGymData(type);
      return;
  }

  db.set('gymHubData', gymData);
  syncGymData();
  showNotification('Saved! 💪', '', 'success');
};

// ===== MACRO CHART =====
function updateMacroChart() {
  // Get current values
  const calories = parseFloat(document.getElementById('macroCalories')?.value) || 0;
  const protein = parseFloat(document.getElementById('macroProtein')?.value) || 0;
  const carbs = parseFloat(document.getElementById('macroCarbs')?.value) || 0;
  const fat = parseFloat(document.getElementById('macroFat')?.value) || 0;

  // Get goals (use placeholder values if empty)
  const goalCalories = parseFloat(document.getElementById('goalCalories')?.value) || 2000;
  const goalProtein = parseFloat(document.getElementById('goalProtein')?.value) || 150;
  const goalCarbs = parseFloat(document.getElementById('goalCarbs')?.value) || 200;
  const goalFat = parseFloat(document.getElementById('goalFat')?.value) || 70;

  // Update goal displays
  const goalCalDisplay = document.getElementById('goalCalDisplay');
  const goalProtDisplay = document.getElementById('goalProtDisplay');
  const goalCarbDisplay = document.getElementById('goalCarbDisplay');
  const goalFatDisplay = document.getElementById('goalFatDisplay');

  if (goalCalDisplay) goalCalDisplay.textContent = goalCalories;
  if (goalProtDisplay) goalProtDisplay.textContent = goalProtein;
  if (goalCarbDisplay) goalCarbDisplay.textContent = goalCarbs;
  if (goalFatDisplay) goalFatDisplay.textContent = goalFat;

  // Calculate percentages
  const calPercent = Math.min((calories / goalCalories) * 100, 100);
  const proPercent = Math.min((protein / goalProtein) * 100, 100);
  const carbPercent = Math.min((carbs / goalCarbs) * 100, 100);
  const fatPercent = Math.min((fat / goalFat) * 100, 100);

  // Ring circumference = 2 * PI * radius = 2 * 3.14159 * 42 = 264
  const circumference = 264;

  // Update ring charts (stroke-dashoffset = circumference - (percent * circumference / 100))
  const ringCalories = document.getElementById('ringCalories');
  const ringProtein = document.getElementById('ringProtein');
  const ringCarbs = document.getElementById('ringCarbs');
  const ringFat = document.getElementById('ringFat');

  if (ringCalories) ringCalories.style.strokeDashoffset = circumference - (calPercent * circumference / 100);
  if (ringProtein) ringProtein.style.strokeDashoffset = circumference - (proPercent * circumference / 100);
  if (ringCarbs) ringCarbs.style.strokeDashoffset = circumference - (carbPercent * circumference / 100);
  if (ringFat) ringFat.style.strokeDashoffset = circumference - (fatPercent * circumference / 100);

  // Update ring center values
  const ringCalValue = document.getElementById('ringCalValue');
  const ringProValue = document.getElementById('ringProValue');
  const ringCarbValue = document.getElementById('ringCarbValue');
  const ringFatValue = document.getElementById('ringFatValue');

  if (ringCalValue) ringCalValue.textContent = calories;
  if (ringProValue) ringProValue.textContent = protein;
  if (ringCarbValue) ringCarbValue.textContent = carbs;
  if (ringFatValue) ringFatValue.textContent = fat;

  // ===== UPDATE DONUT SUMMARY CHART =====
  // Calculate calories from macros: protein=4cal/g, carbs=4cal/g, fat=9cal/g
  const proteinCals = protein * 4;
  const carbCals = carbs * 4;
  const fatCals = fat * 9;
  const totalCals = proteinCals + carbCals + fatCals;

  // Update total calories display
  const totalCalEl = document.getElementById('totalCalories');
  if (totalCalEl) totalCalEl.textContent = Math.round(totalCals);

  // Calculate donut percentages
  const totalMacroCals = proteinCals + carbCals + fatCals || 1; // avoid division by zero
  const donutProPercent = Math.round((proteinCals / totalMacroCals) * 100);
  const donutCarbPercent = Math.round((carbCals / totalMacroCals) * 100);
  const donutFatPercent = Math.round((fatCals / totalMacroCals) * 100);

  // Update legend
  const legendPro = document.getElementById('legendProtein');
  const legendCarb = document.getElementById('legendCarbs');
  const legendFat = document.getElementById('legendFat');
  const legendRemaining = document.getElementById('legendRemaining');

  if (legendPro) legendPro.textContent = `${protein}g (${donutProPercent}%)`;
  if (legendCarb) legendCarb.textContent = `${carbs}g (${donutCarbPercent}%)`;
  if (legendFat) legendFat.textContent = `${fat}g (${donutFatPercent}%)`;

  const remaining = Math.max(0, goalCalories - totalCals);
  if (legendRemaining) legendRemaining.textContent = `${Math.round(remaining)} kcal`;

  // Update donut segments
  // Circumference = 2 * PI * 40 = 251.3
  const donutCircumference = 251.3;

  // Calculate segment lengths based on percentages (outside if-block for reuse)
  const proteinLen = (donutProPercent / 100) * donutCircumference;
  const carbLen = (donutCarbPercent / 100) * donutCircumference;
  const fatLen = (donutFatPercent / 100) * donutCircumference;

  const donutProtein = document.getElementById('donutProtein');
  const donutCarbs = document.getElementById('donutCarbs');
  const donutFat = document.getElementById('donutFat');

  if (donutProtein && donutCarbs && donutFat) {
    // Set dasharray for each segment (length, remaining)
    donutProtein.style.strokeDasharray = `${proteinLen} ${donutCircumference}`;
    donutProtein.style.strokeDashoffset = '0';

    donutCarbs.style.strokeDasharray = `${carbLen} ${donutCircumference}`;
    donutCarbs.style.strokeDashoffset = `-${proteinLen}`;

    donutFat.style.strokeDasharray = `${fatLen} ${donutCircumference}`;
    donutFat.style.strokeDashoffset = `-${proteinLen + carbLen}`;
  }

  // ===== UPDATE HERO MINI DONUT =====
  const heroTotalCal = document.getElementById('heroTotalCal');
  const heroLegendPro = document.getElementById('heroLegendPro');
  const heroLegendCarb = document.getElementById('heroLegendCarb');
  const heroLegendFat = document.getElementById('heroLegendFat');

  if (heroTotalCal) heroTotalCal.textContent = Math.round(totalCals);
  if (heroLegendPro) heroLegendPro.textContent = `${protein}g`;
  if (heroLegendCarb) heroLegendCarb.textContent = `${carbs}g`;
  if (heroLegendFat) heroLegendFat.textContent = `${fat}g`;

  const heroDonutPro = document.getElementById('heroDonutPro');
  const heroDonutCarb = document.getElementById('heroDonutCarb');
  const heroDonutFat = document.getElementById('heroDonutFat');

  if (heroDonutPro && heroDonutCarb && heroDonutFat) {
    heroDonutPro.style.strokeDasharray = `${proteinLen} ${donutCircumference}`;
    heroDonutPro.style.strokeDashoffset = '0';

    heroDonutCarb.style.strokeDasharray = `${carbLen} ${donutCircumference}`;
    heroDonutCarb.style.strokeDashoffset = `-${proteinLen}`;

    heroDonutFat.style.strokeDasharray = `${fatLen} ${donutCircumference}`;
    heroDonutFat.style.strokeDashoffset = `-${proteinLen + carbLen}`;
  }

  // Update calorie status indicator
  updateCalorieStatusNow(goalCalories, Math.max(calories, totalCals));
}

// ===== CALORIE STATUS UPDATE =====
function updateCalorieStatusNow(goalCalories, totalCals) {
  const remaining = goalCalories - totalCals;
  const percentUsed = (totalCals / goalCalories) * 100;

  const statusBadge = document.getElementById('statusBadge');
  const statusDetail = document.querySelector('.status-detail');

  if (statusBadge && statusDetail) {
    statusBadge.classList.remove('on-track', 'deficit', 'surplus', 'over');

    if (percentUsed >= 100) {
      statusBadge.classList.add('over');
      statusBadge.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">Over Goal</span>';
      statusDetail.innerHTML = `<span id="statusRemaining">${Math.round(-remaining)}</span> kcal over`;
    } else if (percentUsed >= 80) {
      statusBadge.classList.add('on-track');
      statusBadge.innerHTML = '<span class="status-icon">✓</span><span class="status-text">On Track</span>';
      statusDetail.innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    } else if (percentUsed >= 50) {
      statusBadge.classList.add('deficit');
      statusBadge.innerHTML = '<span class="status-icon">📉</span><span class="status-text">Deficit</span>';
      statusDetail.innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    } else {
      statusBadge.classList.add('surplus');
      statusBadge.innerHTML = '<span class="status-icon">🍽️</span><span class="status-text">Eat More</span>';
      statusDetail.innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    }
  }
}

function updateCalorieStatus() {
  const calories = parseFloat(document.getElementById('macroCalories')?.value) || 0;
  const protein = parseFloat(document.getElementById('macroProtein')?.value) || 0;
  const carbs = parseFloat(document.getElementById('macroCarbs')?.value) || 0;
  const fat = parseFloat(document.getElementById('macroFat')?.value) || 0;
  const goalCalories = parseFloat(document.getElementById('goalCalories')?.value) || 2000;

  // Calculate total from macros
  const totalCals = Math.max(calories, (protein * 4) + (carbs * 4) + (fat * 9));
  const remaining = goalCalories - totalCals;
  const percentUsed = (totalCals / goalCalories) * 100;

  const statusBadge = document.getElementById('statusBadge');
  const statusRemaining = document.getElementById('statusRemaining');

  if (statusRemaining) statusRemaining.textContent = Math.abs(Math.round(remaining));

  if (statusBadge) {
    statusBadge.classList.remove('on-track', 'deficit', 'surplus', 'over');

    if (percentUsed >= 100) {
      statusBadge.classList.add('over');
      statusBadge.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">Over Goal</span>';
      document.querySelector('.status-detail').innerHTML = `<span id="statusRemaining">${Math.round(-remaining)}</span> kcal over`;
    } else if (percentUsed >= 80) {
      statusBadge.classList.add('on-track');
      statusBadge.innerHTML = '<span class="status-icon">✓</span><span class="status-text">On Track</span>';
      document.querySelector('.status-detail').innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    } else if (percentUsed >= 50) {
      statusBadge.classList.add('deficit');
      statusBadge.innerHTML = '<span class="status-icon">📉</span><span class="status-text">Deficit</span>';
      document.querySelector('.status-detail').innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    } else {
      statusBadge.classList.add('surplus');
      statusBadge.innerHTML = '<span class="status-icon">🍽️</span><span class="status-text">Eat More</span>';
      document.querySelector('.status-detail').innerHTML = `<span id="statusRemaining">${Math.round(remaining)}</span> kcal left`;
    }
  }
}

// ===== QUICK ADD FOOD =====
function quickAddFood(name, cals, protein, carbs, fat) {
  // Get current values
  const currentCals = parseFloat(document.getElementById('macroCalories')?.value) || 0;
  const currentProtein = parseFloat(document.getElementById('macroProtein')?.value) || 0;
  const currentCarbs = parseFloat(document.getElementById('macroCarbs')?.value) || 0;
  const currentFat = parseFloat(document.getElementById('macroFat')?.value) || 0;

  // Add new values
  document.getElementById('macroCalories').value = Math.round(currentCals + cals);
  document.getElementById('macroProtein').value = Math.round((currentProtein + protein) * 10) / 10;
  document.getElementById('macroCarbs').value = Math.round((currentCarbs + carbs) * 10) / 10;
  document.getElementById('macroFat').value = Math.round((currentFat + fat) * 10) / 10;

  // Update charts
  updateMacroChart();

  // Show notification
  showNotification(`Added ${name}! 🍽️`, '', 'success');
}

window.quickAddFood = quickAddFood;


// Add event listeners to goal inputs
document.addEventListener('DOMContentLoaded', () => {
  ['goalCalories', 'goalProtein', 'goalCarbs', 'goalFat'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => window.updateMacroChart());
    }
  });

  // Highlight today in split
  highlightTodaySplit();
});

window.updateMacroChart = updateMacroChart;

// ===== HABITS TOGGLE =====
function toggleHabitsSection() {
  const habitsSection = document.querySelector('.habits-section');
  if (habitsSection) {
    habitsSection.classList.toggle('collapsed');

    // Save state (optional)
    const isCollapsed = habitsSection.classList.contains('collapsed');
    localStorage.setItem('habitsCollapsed', isCollapsed);
  }
}

// Restore habits state on load
document.addEventListener('DOMContentLoaded', () => {
  const isCollapsed = localStorage.getItem('habitsCollapsed') === 'true';
  const habitsSection = document.querySelector('.habits-section');
  if (habitsSection && isCollapsed) {
    habitsSection.classList.add('collapsed');
  }
});

// ===== WEEKLY REVIEW TOGGLE =====
function toggleWeeklyReviewSection() {
  const reviewSection = document.querySelector('.weekly-review-section');
  if (reviewSection) {
    reviewSection.classList.toggle('collapsed');

    // Save state
    const isCollapsed = reviewSection.classList.contains('collapsed');
    localStorage.setItem('weeklyReviewCollapsed', isCollapsed);
  }
}

window.toggleWeeklyReviewSection = toggleWeeklyReviewSection;

// Restore weekly review state on load
document.addEventListener('DOMContentLoaded', () => {
  const isCollapsed = localStorage.getItem('weeklyReviewCollapsed') === 'true';
  const reviewSection = document.querySelector('.weekly-review-section');
  if (reviewSection && isCollapsed) {
    reviewSection.classList.add('collapsed');
  }
});

// ===== CALENDAR TOGGLE =====
function toggleCalendarSection() {
  const calendarSection = document.querySelector('.calendar-section');
  if (calendarSection) {
    calendarSection.classList.toggle('collapsed');

    // Save state
    const isCollapsed = calendarSection.classList.contains('collapsed');
    localStorage.setItem('calendarCollapsed', isCollapsed);
  }
}

window.toggleCalendarSection = toggleCalendarSection;

// Restore calendar state on load
document.addEventListener('DOMContentLoaded', () => {
  const isCollapsed = localStorage.getItem('calendarCollapsed') === 'true';
  const calendarSection = document.querySelector('.calendar-section');
  if (calendarSection && isCollapsed) {
    calendarSection.classList.add('collapsed');
  }
});

// ===== HERO DASHBOARD UPDATES =====
function highlightTodaySplit() {
  const today = new Date().getDay(); // 0 = Sunday
  document.querySelectorAll('.split-day-compact').forEach(el => {
    el.classList.toggle('today', parseInt(el.dataset.day) === today);
  });
}

function updateTodaySplit() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const todayName = days[today];

  const gymData = db.get('gymHubData', {});
  const split = gymData.weeklySplit || {};
  const todaySplitEl = document.getElementById('todaySplit');

  if (todaySplitEl) {
    todaySplitEl.textContent = split[todayName.toLowerCase()] || days[today];
  }
}

function updateHeroMacros() {
  const calories = parseFloat(document.getElementById('macroCalories')?.value) || 0;
  const protein = parseFloat(document.getElementById('macroProtein')?.value) || 0;
  const carbs = parseFloat(document.getElementById('macroCarbs')?.value) || 0;
  const fat = parseFloat(document.getElementById('macroFat')?.value) || 0;

  const heroCal = document.getElementById('heroCalories');
  const heroPro = document.getElementById('heroProtein');
  const heroCarb = document.getElementById('heroCarbs');
  const heroFat = document.getElementById('heroFat');

  if (heroCal) heroCal.textContent = calories;
  if (heroPro) heroPro.textContent = protein;
  if (heroCarb) heroCarb.textContent = carbs;
  if (heroFat) heroFat.textContent = fat;
}

// Update hero when macros change
const originalUpdateMacroChart = updateMacroChart;
window.updateMacroChart = function () {
  originalUpdateMacroChart();
  updateHeroMacros();
  updateCalorieStatus();
};

// Update hero when gym hub loads
const originalLoadGymDataHero = window.loadGymData;
window.loadGymData = function () {
  originalLoadGymDataHero();
  highlightTodaySplit();
  updateTodaySplit();
  renderSupplements();
  setTimeout(() => {
    updateHeroMacros();
    window.updateMacroChart();
  }, 100);
};

window.highlightTodaySplit = highlightTodaySplit;
window.updateTodaySplit = updateTodaySplit;
window.updateHeroMacros = updateHeroMacros;

/* Nutrition Settings Modal */
window.openNutritionSettings = function () {
  const modal = document.getElementById('nutritionSettingsModal');
  if (modal) modal.classList.add('active');
};

window.closeNutritionSettings = function () {
  const modal = document.getElementById('nutritionSettingsModal');
  if (modal) modal.classList.remove('active');
};
