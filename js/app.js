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

  // Extract emoji from title if present
  const emojiMatch = title.match(/^(\p{Emoji})/u);
  const icon = emojiMatch ? emojiMatch[1] : '🔔';
  const titleText = emojiMatch ? title.replace(emojiMatch[0], '').trim() : title;

  banner.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">
      <div class="notification-title">${titleText}</div>
      <div class="notification-body">${body}</div>
    </div>
    <button class="notification-close" aria-label="Close">×</button>
    <div class="notification-progress"></div>
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
function showInputModal(title, placeholder = '', defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('inputModal');
    const titleEl = document.getElementById('inputModalTitle');
    const input = document.getElementById('inputModalField');
    const submitBtn = document.getElementById('inputModalSubmit');
    const cancelBtn = document.getElementById('inputModalCancel');

    titleEl.textContent = title;
    input.placeholder = placeholder || 'Type here...';
    input.value = defaultValue;
    modal.classList.add('active');

    // Focus input after animation
    setTimeout(() => input.focus(), 50);

    const cleanup = () => {
      modal.classList.remove('active');
      submitBtn.onclick = null;
      cancelBtn.onclick = null;
      input.onkeydown = null;
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

// Custom confirm modal (replaces native confirm())
function showConfirmModal(title, message = 'Are you sure?') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
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

// Sync Status Tracking
let lastSyncError = null;
function updateSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  let dirtyCount = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('dirty_')) dirtyCount++;
  }

  if (lastSyncError) {
    el.textContent = '☁️❌';
    el.title = 'Sync Error: ' + lastSyncError;
    el.style.cssText = 'color: #ff4444 !important; filter: drop-shadow(0 0 2px rgba(255,0,0,0.5));';
  } else if (dirtyCount > 0) {
    el.textContent = '☁️⏳';
    el.title = 'Pending Uploads: ' + dirtyCount;
    el.style.cssText = 'color: #ffcc00 !important; filter: drop-shadow(0 0 2px rgba(255,200,0,0.5));';
  } else {
    el.textContent = '☁️✅';
    el.title = 'Synced';
    el.style.cssText = 'color: #44ff44 !important;';
  }
}

window.showSyncDetails = () => {
  let dirtyCount = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if ((localStorage.key(i) || '').startsWith('dirty_')) dirtyCount++;
  }

  let msg = `Sync Status:\n`;
  msg += `State: ${lastSyncError ? 'Error ❌' : (dirtyCount > 0 ? 'Pending Uploads ⏳' : 'Synced ✅')}\n`;
  msg += `Pending Items: ${dirtyCount}\n`;
  if (lastSyncError) msg += `Last Error: ${lastSyncError}\n`;
  msg += `\nClick OK to Force Sync (Upload & Download).`;

  if (confirm(msg)) forceSync();
};

const db = {
  // === Local storage (cache/fallback) ===
  get: (key, def = null) => {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  },

  // Update set to handle dirty flagging (Gold Standard Sync)
  set: (key, val, fromCloud = false) => {
    localStorage.setItem(key, JSON.stringify(val));
    if (!fromCloud) {
      localStorage.setItem('dirty_' + key, '1');
    }
    updateSyncStatus();
  },

  del: (key, fromCloud = false) => {
    localStorage.removeItem(key);
    if (fromCloud) {
      localStorage.removeItem('dirty_' + key);
    } else {
      localStorage.removeItem('dirty_' + key);
    }
    updateSyncStatus();
  },

  // Dirty Flag Helpers
  clearDirty: (key) => {
    localStorage.removeItem('dirty_' + key);
    updateSyncStatus();
  },
  isDirty: (key) => localStorage.getItem('dirty_' + key) === '1',

  // === Key generators ===
  calKey: (d) => `cal-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  goalKey: (d) => `goals-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  notesKey: (d) => `notes-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  weekKey: (d) => `week-${d.getFullYear()}-W${getWeekNumber(d)}`,
  reviewKey: (d) => `review-${d.getFullYear()}-W${getWeekNumber(d)}`,
  habitsKey: (d) => `habitsData-${d.getFullYear()}-W${getWeekNumber(d)}`,

  // === Local getters (sync, use cache) ===
  getAllHabits: () => db.get('habits', []),
  setHabits: (habits) => {
    db.set('habits', habits);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setHabits(habits)
        .then(err => { if (!err) db.clearDirty('habits'); });
    }
  },
  getKanban: (weekDate) => db.get(db.weekKey(weekDate || currentWeekDate), {}),
  setKanban: (data, weekDate) => {
    const key = db.weekKey(weekDate || currentWeekDate);
    db.set(key, data);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setKanban(key, data)
        .then(err => { if (!err) db.clearDirty(key); });
    }
  },
  getGoals: (date) => db.get(db.goalKey(date || currentGoalDate), []),
  setGoals: (goals, date) => {
    const key = db.goalKey(date || currentGoalDate);
    db.set(key, goals);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setGoals(key, goals)
        .then(err => { if (!err) db.clearDirty(key); })
        .catch(e => console.error('[Sync] setGoals failed:', e));
    }
  },
  getNotes: (date) => db.get(db.notesKey(date || currentGoalDate), ''),
  setNotes: (text, date) => {
    const key = db.notesKey(date || currentGoalDate);
    db.set(key, text);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setNotes(key, text)
        .then(err => { if (!err) db.clearDirty(key); })
        .catch(e => console.error('[Sync] setNotes failed:', e));
    }
  },
  getWeeklyReview: (date) => db.get(db.reviewKey(date || currentNoteDate), ''),
  setWeeklyReview: (text, date) => {
    const key = db.reviewKey(date || currentNoteDate);
    db.set(key, text);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setNotes(key, text)
        .then(err => { if (!err) db.clearDirty(key); })
        .catch(e => console.error('[Sync] setWeeklyReview failed:', e));
    }
  },
  getBacklog: () => db.get('backlog', {}),
  setBacklog: (backlog) => {
    db.set('backlog', backlog);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setBacklog(backlog)
        .then(err => { if (!err) db.clearDirty('backlog'); })
        .catch(e => console.error('[Sync] setBacklog failed:', e));
    }
  },

  // Update Habit Checks (uses db.get/set logic internally)
  setHabitCheck: (key, value) => {
    // 1. Update LocalStorage
    if (value) localStorage.setItem(key, '1'); else localStorage.removeItem(key);

    // 2. Update In-Memory Cache (for Cloud Upload)
    const checks = db.get('habitChecks', {});
    if (value) checks[key] = true; else delete checks[key];
    db.set('habitChecks', checks); // Marks dirty

    // 3. Sync to Cloud
    if (isSupabaseAvailable()) {
      window.supabaseDB.setSetting('habitChecks', checks)
        .then(err => { if (!err) db.clearDirty('habitChecks'); })
        .catch(e => console.error('[Sync] setHabitCheck failed:', e));
    }
  },
  getCalendarTasks: (date) => db.get(db.calKey(date), []),
  setCalendarTasks: (date, tasks) => {
    const key = db.calKey(date);
    db.set(key, tasks);
    if (isSupabaseAvailable()) {
      window.supabaseDB.setGoals(key, tasks)
        .then(err => { if (!err) db.clearDirty(key); })
        .catch(e => console.error('[Sync] setCalendarTasks failed:', e));
    }
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

  // === Cloud sync functions ===
  async loadFromCloud() {
    if (!isSupabaseAvailable() || !window.currentUserId) return;
    console.log('[Sync] Starting Sync...');

    // --- Phase 1: Push Dirty Items (Client Changes) ---
    // Iterate 'dirty_' keys and push them.
    const dirtyKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dirty_')) dirtyKeys.push(k.substring(6)); // remove 'dirty_'
    }

    if (dirtyKeys.length > 0) {
      console.log(`[Sync] Pushing ${dirtyKeys.length} dirty items...`);
      for (const key of dirtyKeys) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          let err = null;

          if (key.startsWith('goals-') || key.startsWith('cal-')) err = await window.supabaseDB.setGoals(key, val);
          else if (key.startsWith('notes-') || key.startsWith('review-')) err = await window.supabaseDB.setNotes(key, val);
          else if (key === 'habits') err = await window.supabaseDB.setHabits(val);
          else if (key === 'habitChecks' || key === 'customListsMeta') err = await window.supabaseDB.setSetting(key, val);
          else if (key === 'backlog') err = await window.supabaseDB.setBacklog(val);
          else if (key.startsWith('week-')) err = await window.supabaseDB.setKanban(key, val);
          else if (key.startsWith('list-')) {
            // Extract list name from key 'list-NAME'
            const name = key.substring(5);
            const icon = db.get(`listIcon_${name}`, '📝');
            await window.supabaseDB.setList(name, val, icon); // Assuming no err return in setList yet
          }

          if (!err) db.clearDirty(key);
        } catch (e) {
          console.error('Failed to auto-push dirty key: ' + key, e);
          lastSyncError = e.message;
        }
      }
    }
    if (!lastSyncError) updateSyncStatus();

    // --- Phase 2: Pull Cloud & Prune Clean (Server State) ---

    // 0. Metadata (Lists, Checks)
    const habitChecks = await window.supabaseDB.getSetting('habitChecks', {});
    if (habitChecks) db.set('habitChecks', habitChecks, true);
    db.loadHabitChecks(db.get('habitChecks', {}));

    const listMeta = await window.supabaseDB.getSetting('customListsMeta', []);
    if (listMeta && listMeta.length > 0) db.set('customListsMeta', listMeta, true);

    // 1. Goals
    const allGoals = await window.supabaseDB.getAllGoals();
    const cloudGoalKeys = new Set(Object.keys(allGoals));

    // Update Local from Cloud (Clean Write)
    Object.entries(allGoals).forEach(([k, v]) => db.set(k, v, true));

    // Handle Deletions (Prune Clean Local Keys missing from Cloud)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('goals-') || key.startsWith('cal-'))) {
        if (!cloudGoalKeys.has(key) && !db.isDirty(key)) {
          db.del(key, true); // Delete locally (Remote deletion)
        }
      }
    }

    // 2. Notes & Reviews (Simplified: fetch today/week only + list logic?)
    // Fetching ALL notes is expensive if many. 
    // SupabaseDB methods currently get specific keys. 
    // We should implement getAllNotes() if we want full sync!
    // For now, let's sync Today and Current Week only + any Dirty pushes done above.
    // If user deleted a note via another device, we might miss pruning it locally if we don't fetch all keys.
    // But notes are date-bound.

    const todayNotesKey = db.notesKey(new Date());
    const notes = await window.supabaseDB.getNotes(todayNotesKey);
    if (notes) db.set(todayNotesKey, notes, true);

    const reviewKey = db.reviewKey(new Date());
    const review = await window.supabaseDB.getNotes(reviewKey);
    if (review) db.set(reviewKey, review, true);

    // 3. Habits & Checks
    const habits = await window.supabaseDB.getHabits();
    if (habits && habits.length > 0) db.set('habits', habits, true);



    // 4. Kanban & Backlog
    const weekKey = db.weekKey(new Date());
    const kanban = await window.supabaseDB.getKanban(weekKey);
    if (kanban && Object.keys(kanban).length > 0) db.set(weekKey, kanban, true);

    const backlog = await window.supabaseDB.getBacklog();
    if (backlog && Object.keys(backlog).length > 0) db.set('backlog', backlog, true);

    // 5. Lists - load items from cloud and match to metadata
    const lists = await window.supabaseDB.getAllLists();
    if (lists.length > 0) {
      // Update list items (match by title/name)
      const meta = db.get('customListsMeta', []);

      lists.forEach(cloudList => {
        // Find matching local list by title
        const localList = meta.find(m => m.title === cloudList.name);
        if (localList) {
          // Update items for this list
          db.set(`list-${localList.id}`, cloudList.items || [], true);
        }
      });
    }

    // Clear lastSyncError and update status on success
    lastSyncError = null;
    updateSyncStatus();
  },

  // === Manual Push to Cloud (Recovery) ===
  async pushToCloud() {
    if (!isSupabaseAvailable() || !window.currentUserId) throw new Error("Not logged in (User ID missing). Please sign out and sign in again.");

    console.log('[Sync] Starting manual upload...');
    let count = 0;
    const errors = [];

    // 1. Goals & Calendar
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('goals-') || key.startsWith('cal-'))) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          const err = await window.supabaseDB.setGoals(key, val);
          if (err) throw err;
          count++;
        } catch (e) {
          console.error('Failed to sync goal ' + key, e);
          errors.push(`Goal ${key}: ${e.message || e.code}`);
        }
      }
    }

    // 2. Notes & Reviews
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('notes-') || key.startsWith('review-'))) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          const err = await window.supabaseDB.setNotes(key, val);
          if (err) throw err;
          count++;
        } catch (e) {
          console.error('Failed to sync note ' + key, e);
          errors.push(`Note ${key}: ${e.message || e.code}`);
        }
      }
    }

    // 3. Habits (Setters return error now)
    try {
      const err = await window.supabaseDB.setHabits(db.getAllHabits());
      if (err) throw err;
    } catch (e) { errors.push(`Habits: ${e.message}`); }

    // 4. Habit Checks
    try {
      await window.supabaseDB.setSetting('habitChecks', db.get('habitChecks', {}));
    } catch (e) { errors.push(`HabitChecks: ${e.message}`); }

    // 5. Backlog
    try {
      const err = await window.supabaseDB.setBacklog(db.get('backlog', {}));
      if (err) throw err;
    } catch (e) { errors.push(`Backlog: ${e.message}`); }

    // 6. Current Week Kanban
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('week-')) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          const err = await window.supabaseDB.setKanban(key, val);
          if (err) throw err;
          count++;
        } catch (e) { errors.push(`Kanban ${key}: ${e.message}`); }
      }
    }

    // 7. Lists (using new customListsMeta format)
    const listMeta = db.get('customListsMeta', []);

    // Sync the list metadata first
    try {
      await window.supabaseDB.setSetting('customListsMeta', listMeta);
    } catch (e) { errors.push(`List Metadata: ${e.message}`); }

    // Then sync each list's items
    for (const list of listMeta) {
      try {
        const items = db.get(`list-${list.id}`, []);
        const err = await window.supabaseDB.setList(list.title, items, '📝');
        if (err) throw new Error(err.message || 'Unknown error');
        count++;
      } catch (e) { errors.push(`List ${list.title}: ${e.message}`); }
    }

    return { count, errors };
  }
};

// Force Sync Button Handler
window.forceSync = async () => {
  const action = prompt("Type 'download' (or 'd') to get data from cloud.\nType 'upload' (or 'u') to save local data to cloud.\n\nChoose 'upload' on the device that has the data.");

  if (!action) return;
  const mode = action.toLowerCase().trim();

  if (mode === 'download' || mode === 'd') {
    try {
      alert('Syncing (Download)... please wait.');
      // Call init() which handles element binding and full rendering
      await init();
      alert('✅ Download complete! Data refreshed.');
    } catch (e) {
      alert('❌ Download failed: ' + e.message);
      console.error(e);
    }
  }
  else if (mode === 'upload' || mode === 'u') {
    if (!confirm("⚠️ This will overwrite cloud data with your local data. Are you sure?")) return;
    try {
      alert('Uploading to cloud... please wait.');
      const result = await db.pushToCloud();
      const count = result.count || 0;
      const errors = result.errors || [];

      let msg = `✅ Upload complete! (${count} items synced).`;
      if (errors.length > 0) {
        msg += `\n⚠️ BUT with ${errors.length} errors:\n` + errors.slice(0, 5).join('\n');
      }
      msg += `\n\nNow use 'download' on your other devices.`;

      alert(msg);
    } catch (e) {
      alert('❌ Upload failed: ' + e.message);
      console.error(e);
    }
  }
  else {
    alert("Invalid option. Please type 'download' or 'upload'.");
  }
};

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
// ===== INITIALIZATION =====
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
  setupKeyboardShortcuts();
  setupConfetti();
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

  // Notes title (date-based)
  const notesTitle = document.getElementById('notesTitle');
  const notesDate = new Date(currentNotesDate);
  notesDate.setHours(0, 0, 0, 0);

  if (notesDate.getTime() === today.getTime()) {
    notesTitle.textContent = "📝 Quick Notes";
  } else {
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    notesTitle.textContent = `📝 Notes - ${currentNotesDate.toLocaleDateString('en-US', options)}`;
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
  updateTitles();
  try { renderKanban(); } catch (e) { console.error(e); }
  try { renderHabits(); } catch (e) { console.error(e); }
  try { loadWeeklyReview(); } catch (e) { console.error(e); }
  try { updateStats(); } catch (e) { console.error(e); }
};


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
    // Don't trigger if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        togglePomodoro();
        break;
      case 'r':
        resetPomodoro();
        break;
      case 'q':
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
async function quickCapture() {
  const text = await showInputModal('Quick Add', 'Add a task, idea, or note...');
  if (!text || !text.trim()) return;

  sounds.click();

  // Add to today's calendar
  const today = new Date();
  const key = db.calKey(today);
  const tasks = db.get(key, []);
  tasks.push({ text: text.trim(), done: false, priority: null });
  db.set(key, tasks);

  // Re-render if viewing current month
  if (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()) {
    renderCalendar();
  }
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
  if (els.btnDark) els.btnDark.textContent = isDark ? "☀️" : "🌙";
}

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

    if (Notification.permission === 'granted') {
      new Notification('🍅 Pomodoro Complete!', { body: 'Time for a break.' });
    }
  } else {
    switchPomoMode('work');
    if (Notification.permission === 'granted') {
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
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

window.goToToday = () => {
  currentDate = new Date();
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

function renderCalendar() {
  els.calList.innerHTML = "";
  els.calTitle.textContent = currentDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

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

    const tasksContainer = document.createElement("div");
    tasksContainer.className = "tasks-list";
    const tasks = db.get(db.calKey(dateObj), []);
    tasks.forEach((t, idx) => tasksContainer.appendChild(createTaskEl(t, dateObj, idx)));

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
    addBtn.onclick = async (e) => {
      e.stopPropagation();
      const text = await showInputModal('New Task', 'What needs to be done?');
      if (text && text.trim()) {
        tasks.push({ text: text.trim(), done: false, priority: null });
        db.setCalendarTasks(dateObj, tasks);
        renderCalendar();
        renderKanban(); // Update weekly overview
      }
    };

    box.append(num, tasksContainer, addBtn);
    els.calList.appendChild(box);
  }
}

function createTaskEl(task, dateObj, index) {
  const el = document.createElement("div");
  el.className = `task-item ${task.done ? 'done' : ''}`;
  if (task.priority) el.classList.add(`priority-${task.priority}`);
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

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "task-checkbox";
  cb.checked = task.done;
  cb.onclick = (e) => {
    e.stopPropagation();
    task.done = cb.checked;
    updateTask(dateObj, index, task);

    if (cb.checked) {
      sounds.success();
      el.classList.add('completing');
      setTimeout(() => el.classList.remove('completing'), 400);
      updateStats();
    }
    el.classList.toggle('done', task.done);
  };

  const span = document.createElement("span");
  span.className = "task-text";
  span.textContent = task.text;

  // Double-click to edit task
  span.ondblclick = async (e) => {
    e.stopPropagation();
    const newText = await showInputModal('Edit Task', 'Update your task...', task.text);
    if (newText && newText.trim() && newText.trim() !== task.text) {
      task.text = newText.trim();
      updateTask(dateObj, index, task);
      renderCalendar();
      renderKanban(); // Update weekly overview
    }
  };

  // Right-click to set priority
  span.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const priorities = [null, 'high', 'medium', 'low'];
    const currentIdx = priorities.indexOf(task.priority);
    task.priority = priorities[(currentIdx + 1) % priorities.length];
    updateTask(dateObj, index, task);
    renderCalendar();
    renderKanban(); // Update weekly overview
  };

  const del = document.createElement("button");
  del.className = "task-delete";
  del.innerHTML = "&times;";
  del.onclick = (e) => {
    e.stopPropagation();
    deleteTask(dateObj, index);
  };

  el.append(cb, span, del);
  return el;
}

function handleCalendarDrop(e, targetDate, box) {
  e.preventDefault();
  box.classList.remove('drag-over');

  if (!draggedTask || draggedTaskSource !== 'calendar') return;

  const { task, dateObj: fromDate, index: fromIndex } = draggedTask;
  const fromKey = db.calKey(fromDate);
  const toKey = db.calKey(targetDate);

  if (fromKey === toKey) return;

  const fromTasks = db.getCalendarTasks(fromDate);
  fromTasks.splice(fromIndex, 1);
  db.setCalendarTasks(fromDate, fromTasks);

  const toTasks = db.getCalendarTasks(targetDate);
  toTasks.push(task);
  db.setCalendarTasks(targetDate, toTasks);

  renderCalendar();
  renderKanban(); // Update weekly overview
}

function updateTask(dateObj, index, newTask) {
  const tasks = db.getCalendarTasks(dateObj);
  tasks[index] = newTask;
  db.setCalendarTasks(dateObj, tasks);
}

function deleteTask(dateObj, index) {
  const tasks = db.getCalendarTasks(dateObj);
  tasks.splice(index, 1);
  db.setCalendarTasks(dateObj, tasks);
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
    nameEl.ondblclick = async () => {
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
            if (isSupabaseAvailable()) window.supabaseDB.setSetting('habitChecks', checks);
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

    row.appendChild(nameEl);

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const check = document.createElement("div");
      check.className = "habit-check";
      if (isCurrentWeek && dayIdx === todayIndex) {
        check.classList.add("today");
      }
      const key = getHabitKey(hIdx, dayIdx);
      if (localStorage.getItem(key)) check.classList.add("done");

      check.onclick = () => {
        check.classList.toggle("done");
        const isDone = check.classList.contains("done");

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
  const confirmed = await showConfirmModal('Delete Habit', 'Are you sure you want to delete this habit? This action cannot be undone.');
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
    habits.push(name.trim());
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

function getHabitKeyForWeek(weekDate, hIdx, dayIdx) {
  const monday = getMondayOfWeek(weekDate);
  const year = monday.getFullYear();

  // Calculate week number for the Monday
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (monday - firstDayOfYear) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  return `habitsData-${year}-W${weekNum}-h${hIdx}-d${dayIdx}`;
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

    const item = document.createElement('div');
    item.className = 'habit-breakdown-item';
    item.innerHTML = `
      <div class="habit-breakdown-name" title="${habit}">${habit}</div>
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
      db.set(pastKey, completed);

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
    db.set(todayKey, todayGoals);
  }
}

function renderGoals() {
  const rawGoals = db.getGoals();
  // Map to preserve original indices then sort: Done (true/1) first
  const displayGoals = rawGoals.map((g, i) => ({ task: g, idx: i }));
  displayGoals.sort((a, b) => (b.task.done ? 1 : 0) - (a.task.done ? 1 : 0));

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

    // Double-click to edit
    textDiv.ondblclick = async () => {
      const currentText = typeof goal === 'string' ? goal : goal.text;
      const newText = await showInputModal('Edit Goal', 'Update your goal...', currentText);
      if (newText && newText.trim()) {
        const goals = db.getGoals();
        goals[idx] = { text: newText.trim(), done: goal.done || false, urgency: goal.urgency || null };
        db.setGoals(goals);
        renderGoals();
      }
    };

    // Right-click to set urgency
    textDiv.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const urgencies = [null, 'high', 'medium', 'low'];
      const currentIdx = urgencies.indexOf(goal.urgency || null);
      goal.urgency = urgencies[(currentIdx + 1) % urgencies.length];
      const goals = db.getGoals();
      goals[idx] = goal;
      db.setGoals(goals);
      renderGoals();
    };

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "focus-delete";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = () => deleteGoal(idx);

    item.append(cb, textDiv, deleteBtn);
    els.goalsList.appendChild(item);
  });
}

window.addGoal = async () => {
  const text = await showInputModal("Today's Goal", "What do you want to accomplish?");
  if (!text || !text.trim()) return;

  const goals = db.getGoals();
  goals.push({ text: text.trim(), done: false });
  db.setGoals(goals);
  renderGoals();
};

window.deleteGoal = (idx) => {
  const goals = db.getGoals();
  goals.splice(idx, 1);
  db.setGoals(goals);
  renderGoals();
};

// ===== QUICK NOTES =====
let notesDebounceTimer = null;

function loadNotes() {
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
  // Sync to Supabase
  if (isSupabaseAvailable()) {
    window.supabaseDB.setList(listName, items)
      .then(() => db.clearDirty(config.key))
      .catch(e => console.error('[Sync] setListItems failed:', e));
  }
}

function renderSimpleList(listName) {
  const config = getListConfig(listName);
  const container = document.getElementById(config.elementId);
  if (!container) return;

  const items = getListItems(listName);
  container.innerHTML = '';

  if (items.length === 0) {
    const emptyMessages = {
      goals2026: 'No goals yet',
      shopping: 'No groceries yet',
      chores: 'No chores yet'
    };
    const message = emptyMessages[listName] || 'No items yet';
    container.innerHTML = `<div style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 0.85rem;">${message}</div>`;
    return;
  }

  // Setup drop zone for drag reordering
  container.ondragover = (e) => {
    e.preventDefault();
    const dragging = container.querySelector('.dragging');
    const siblings = [...container.querySelectorAll('.simple-list-item:not(.dragging)')];
    const afterElement = siblings.find(sibling => {
      const box = sibling.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    if (afterElement) {
      container.insertBefore(dragging, afterElement);
    } else if (dragging) {
      container.appendChild(dragging);
    }
  };

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `simple-list-item ${item.done ? 'done' : ''}`;
    div.draggable = true;
    div.dataset.idx = idx;

    // Drag events for reordering
    div.ondragstart = (e) => {
      div.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idx);
    };
    div.ondragend = () => {
      div.classList.remove('dragging');
      // Save new order
      const newOrder = [...container.querySelectorAll('.simple-list-item')].map(el => {
        const i = parseInt(el.dataset.idx);
        return items[i];
      });
      setListItems(listName, newOrder);
    };

    const span = document.createElement('span');
    span.textContent = item.text;

    // Click to toggle done state
    span.onclick = () => {
      item.done = !item.done;
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
    container.appendChild(div);
  });
}

window.addListItem = async (listName) => {
  const defaults = {
    goals2026: "What's your goal for 2026?",
    shopping: "What do you need to buy?",
    chores: "What chore needs doing?"
  };

  let modalTitle = 'New List Item';
  if (listName === 'goals2026') modalTitle = 'New 2026 Goal';
  else if (listName === 'shopping') modalTitle = 'Add to Shopping List';
  else if (listName === 'chores') modalTitle = 'New Chore';

  const promptText = defaults[listName] || "Add item to list";

  const text = await showInputModal(modalTitle, promptText);

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

  // Seed defaults
  const defaults = [
    { id: 'goals2026', title: '🚀 Goals 2026' },
    { id: 'shopping', title: '🛒 Shopping List' },
    { id: 'chores', title: '🧹 Weekly Chores' }
  ];

  // Merge with any existing custom lists (from previous step testing)
  const existing = db.get('customListsMeta', []);
  // Filter out duplicates if somehow present
  const final = [...defaults, ...existing.filter(e => !defaults.find(d => d.id === e.id))];

  db.set('customListsMeta', final);
  localStorage.setItem('unifiedListsInited', 'true');
};

window.createNewCustomList = async () => {
  const name = await showInputModal('New List', 'Enter a name for your new list');
  if (!name || !name.trim()) return;

  const meta = db.get('customListsMeta', []);
  const id = 'custom-' + Date.now();
  meta.push({ id, title: name.trim() });
  db.set('customListsMeta', meta);

  // Sync to Supabase
  if (isSupabaseAvailable()) {
    window.supabaseDB.setSetting('customListsMeta', meta)
      .then(err => { if (!err) db.clearDirty('customListsMeta'); })
      .catch(e => console.error('[Sync] createNewCustomList failed:', e));
  }

  renderUnifiedLists();
};

window.renderUnifiedLists = () => {
  const container = document.getElementById('unifiedListsGrid');
  if (!container) return;
  container.innerHTML = '';

  const meta = db.get('customListsMeta', []);
  meta.forEach(list => {
    const div = document.createElement('div');
    div.className = 'glass-panel list-panel';
    div.innerHTML = `
            <button class="delete-list-btn" onclick="deleteList('${list.id}')" title="Delete List">×</button>
            <h3 contenteditable="true" 
                id="title-${list.id}"
                onblur="updateListTitle('${list.id}', this)"
                style="outline:none; cursor:text; padding-bottom:2px; 
                       border-bottom: ${list.title === 'Custom List' ? '1px dashed rgba(255,255,255,0.2)' : 'none'};"
                title="Click to edit">${list.title}</h3>
            <div class="simple-list" id="${list.id}List"></div>
            <button class="btn" onclick="addListItem('${list.id}')" style="margin-top:auto;">+ Add Item</button>
        `;
    container.appendChild(div);

    renderSimpleList(list.id);
  });
};

window.updateListTitle = (id, el) => {
  const meta = db.get('customListsMeta', []);
  const list = meta.find(m => m.id === id);
  if (list) {
    list.title = el.innerText;
    db.set('customListsMeta', meta);
    // Toggle border
    el.style.borderBottom = list.title === 'Custom List' ? '1px dashed rgba(255,255,255,0.2)' : 'none';

    // Sync to Supabase
    if (isSupabaseAvailable()) {
      window.supabaseDB.setSetting('customListsMeta', meta)
        .then(err => { if (!err) db.clearDirty('customListsMeta'); })
        .catch(e => console.error('[Sync] updateListTitle failed:', e));
    }
  }
};

window.deleteList = async (id) => {
  // Find list name for better UX
  const meta = db.get('customListsMeta', []);
  const list = meta.find(m => m.id === id);
  const listName = list ? list.title : 'this list';

  const confirmed = await showConfirmModal('Delete List', `Are you sure you want to delete "${listName}"? This action cannot be undone.`);
  if (!confirmed) return;

  const newMeta = meta.filter(m => m.id !== id);
  db.set('customListsMeta', newMeta);
  localStorage.removeItem('list-' + id);

  // Sync deletion to Supabase
  if (isSupabaseAvailable()) {
    try {
      // Delete the list from cloud using its title (which is the name in Supabase)
      await window.supabaseDB.deleteList(listName);
      // Also update the customListsMeta setting
      await window.supabaseDB.setSetting('customListsMeta', newMeta);
      db.clearDirty('customListsMeta');
    } catch (e) {
      console.error('[Sync] deleteList failed:', e);
    }
  }

  renderUnifiedLists();
};

// ===== WEEKLY REVIEW =====
let reviewDebounceTimer = null;

function loadWeeklyReview() {
  els.weeklyReview.value = db.getWeeklyReview(currentReviewWeekDate);
  updateReviewTitle();

  // Set up auto-save on input
  els.weeklyReview.oninput = () => {
    clearTimeout(reviewDebounceTimer);
    reviewDebounceTimer = setTimeout(() => {
      db.setWeeklyReview(els.weeklyReview.value, currentReviewWeekDate);
    }, 500);
  };
}

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
  // Backlog is permanent (not week-based)
  renderKanbanBoard(els.longKanban, ["To Do", "Waiting", "Ideas"], false);
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
  container.innerHTML = "";
  const boardData = isWeekBased ? db.getKanban() : db.get('backlog', {});

  columns.forEach((colName, colIndex) => {
    const colDiv = document.createElement("div");
    colDiv.className = "kanban-column";

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
    }

    const titleSpan = document.createElement("div");
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

      calendarTasks.forEach((task, idx) => {
        if (!task) return;
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
}

function createKanbanCard(task, colName, index, isWeekBased, isFromCalendar = false, sourceDate = null) {
  const div = document.createElement("div");
  div.className = `kanban-card ${task.done ? 'done' : ''}`;
  if (task.priority) div.classList.add(`priority-${task.priority}`);
  if (isFromCalendar) div.classList.add('from-calendar');
  div.draggable = true; // All tasks can be dragged

  // Checkbox
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "task-checkbox";
  cb.checked = task.done;
  cb.onclick = (e) => {
    e.stopPropagation();
    task.done = cb.checked;

    if (isFromCalendar && sourceDate) {
      // Update the calendar task
      const key = db.calKey(sourceDate);
      const tasks = db.get(key, []);
      if (tasks[index]) {
        tasks[index] = task;
        db.set(key, tasks);
        renderCalendar(); // Refresh calendar to reflect change
      }
    } else {
      updateKanbanItem(colName, index, task, isWeekBased);
    }

    if (cb.checked) {
      sounds.success();
      div.classList.add('completing');
      setTimeout(() => div.classList.remove('completing'), 400);
    }
    div.classList.toggle('done', task.done);
  };

  const textSpan = document.createElement("span");
  textSpan.className = "kanban-card-text";
  textSpan.textContent = task.text;

  // Right-click to set priority
  textSpan.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const priorities = [null, 'high', 'medium', 'low'];
    const currentIdx = priorities.indexOf(task.priority);
    task.priority = priorities[(currentIdx + 1) % priorities.length];

    if (isFromCalendar && sourceDate) {
      const key = db.calKey(sourceDate);
      const tasks = db.get(key, []);
      if (tasks[index]) {
        tasks[index] = task;
        db.set(key, tasks);
        renderCalendar();
      }
    } else {
      updateKanbanItem(colName, index, task, isWeekBased);
    }
    renderKanban();
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "kanban-card-delete";
  deleteBtn.innerHTML = "&times;";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (isFromCalendar && sourceDate) {
      // Delete from calendar
      const key = db.calKey(sourceDate);
      const tasks = db.get(key, []);
      tasks.splice(index, 1);
      db.set(key, tasks);
      renderCalendar();
      renderKanban();
    } else {
      deleteKanbanItem(colName, index, isWeekBased);
    }
  };

  div.append(cb, textSpan, deleteBtn);

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

  div.ondblclick = async () => {
    const newText = await showInputModal('Edit Card', 'Update your card...', task.text);
    if (newText && newText.trim() && newText.trim() !== task.text) {
      task.text = newText.trim();

      if (isFromCalendar && sourceDate) {
        const key = db.calKey(sourceDate);
        const tasks = db.get(key, []);
        if (tasks[index]) {
          tasks[index] = task;
          db.set(key, tasks);
          renderCalendar();
        }
      } else {
        updateKanbanItem(colName, index, task, isWeekBased);
      }
      renderKanban();
    }
  };

  return div;
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
  document.querySelectorAll(".kanban-items.drag-over").forEach(el => el.classList.remove('drag-over'));

  try {
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (data.type !== 'kanban') return;

    // Only allow drop within same board type
    if (data.isWeekBased !== isWeekBased) return;

    // Handle calendar-sourced task move
    if (data.isFromCalendar && data.sourceDate) {
      const sourceDate = new Date(data.sourceDate);
      const sourceCol = data.col;

      // If dropping to same column, do nothing
      if (sourceCol === targetCol) return;

      // Get the target date based on the column
      const targetColIndex = weekdays.indexOf(targetCol);
      if (targetColIndex === -1) return;
      const targetDate = getDateForWeekday(targetColIndex);

      // Remove from source date in calendar
      const sourceKey = db.calKey(sourceDate);
      const sourceTasks = db.get(sourceKey, []);
      sourceTasks.splice(data.idx, 1);
      db.set(sourceKey, sourceTasks);

      // Add to target date in calendar
      const targetKey = db.calKey(targetDate);
      const targetTasks = db.get(targetKey, []);
      targetTasks.push(data.task);
      db.set(targetKey, targetTasks);

      renderCalendar();
      renderKanban();
      return;
    }

    // Handle normal kanban task move
    const board = getKanbanBoard(isWeekBased);
    if (board[data.col]) board[data.col].splice(data.idx, 1);
    if (!board[targetCol]) board[targetCol] = [];
    board[targetCol].push(data.task || data.text);

    setKanbanBoard(board, isWeekBased);
    renderKanban();
  } catch (err) { }
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
window.exportData = () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dalis-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  sounds.click();
};

window.importData = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!confirm("This will replace all your current data. Continue?")) return;

      localStorage.clear();
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      sounds.success();
      alert("Data imported successfully! Refreshing...");
      location.reload();
    } catch (err) {
      alert("Failed to import: Invalid file format");
    }
  };
  reader.readAsText(file);
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
