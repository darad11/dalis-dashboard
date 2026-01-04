/**
 * Dali's Dashboard
 * Full-featured productivity system
 */

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

// ===== STATE MANAGEMENT =====
const db = {
  get: (key, def = null) => {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  del: (key) => localStorage.removeItem(key),

  calKey: (d) => `cal-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  goalKey: (d) => `goals-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  notesKey: (d) => `notes-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  weekKey: (d) => `week-${d.getFullYear()}-W${getWeekNumber(d)}`,
  reviewKey: (d) => `review-${d.getFullYear()}-W${getWeekNumber(d)}`,
  habitsKey: (d) => `habitsData-${d.getFullYear()}-W${getWeekNumber(d)}`,

  getAllHabits: () => db.get('habits', []),
  setHabits: (habits) => db.set('habits', habits),
  getKanban: (weekDate) => db.get(db.weekKey(weekDate || currentWeekDate), {}),
  setKanban: (data, weekDate) => db.set(db.weekKey(weekDate || currentWeekDate), data),
  getGoals: (date) => db.get(db.goalKey(date || currentGoalDate), []),
  setGoals: (goals, date) => db.set(db.goalKey(date || currentGoalDate), goals),
  getNotes: (date) => db.get(db.notesKey(date || currentNotesDate), ''),
  setNotes: (text, date) => db.set(db.notesKey(date || currentNotesDate), text),
  getWeeklyReview: (weekDate) => db.get(db.reviewKey(weekDate || currentReviewWeekDate), ''),
  setWeeklyReview: (text, weekDate) => db.set(db.reviewKey(weekDate || currentReviewWeekDate), text),
  getStats: () => db.get('stats', { pomos: 0, tasks: 0, streak: 0, lastActive: null }),
  setStats: (stats) => db.set('stats', stats)
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
  sessions: 0
};

const weekdays = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];

// ===== INITIALIZATION =====
function init() {
  // Get DOM elements
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

  initTheme();
  initPomodoro();
  initAmbient();
  initStats();
  renderCalendar();
  renderHabits();
  renderKanban();
  rolloverIncompleteGoals(); // Move incomplete goals from previous days to today
  renderGoals();
  loadNotes();
  renderAllLists();
  loadWeeklyReview();
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

window.changeWeek = (delta) => {
  currentWeekDate.setDate(currentWeekDate.getDate() + (delta * 7));
  renderKanban();
  renderHabits();
  loadWeeklyReview();
  updateStats();
  updateTitles();
};

window.goToWeekToday = () => {
  currentWeekDate = new Date();
  renderKanban();
  renderHabits();
  loadWeeklyReview();
  updateStats();
  updateTitles();
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
  if (els.btnDark) els.btnDark.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}

// ===== STATISTICS =====
function initStats() {
  updateStats();
  updateStatsTitle();
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
  statsTitle.textContent = `📊 ${formatWeekRange(currentStatsWeekDate)}`;
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

function togglePomodoro() {
  if (pomo.isRunning) {
    pausePomodoro();
  } else {
    startPomodoro();
  }
}

function startPomodoro() {
  pomo.isRunning = true;
  els.pomoStart.textContent = '⏸ Pause';
  document.getElementById('focusStart').textContent = '⏸ Pause';

  // Start ambient sound
  const ambientType = document.getElementById('ambientSelect').value;
  if (ambientType !== 'none') {
    startAmbient(ambientType);
  }

  pomo.interval = setInterval(() => {
    pomo.timeLeft--;
    updatePomoDisplay();
    updateFocusDisplay();

    if (pomo.timeLeft <= 0) {
      completePomodoro();
    }
  }, 1000);
}

function pausePomodoro() {
  pomo.isRunning = false;
  els.pomoStart.textContent = '▶ Start';
  document.getElementById('focusStart').textContent = '▶ Start';
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
  els.pomoTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const total = pomo.modes[pomo.currentMode];
  const progress = (total - pomo.timeLeft) / total;
  const circumference = 283;
  els.pomoRing.style.strokeDashoffset = circumference * (1 - progress);
  els.pomoCount.textContent = pomo.sessions;
}

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
        db.set(db.calKey(dateObj), tasks);
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

  const fromTasks = db.get(fromKey, []);
  fromTasks.splice(fromIndex, 1);
  db.set(fromKey, fromTasks);

  const toTasks = db.get(toKey, []);
  toTasks.push(task);
  db.set(toKey, toTasks);

  renderCalendar();
  renderKanban(); // Update weekly overview
}

function updateTask(dateObj, index, newTask) {
  const tasks = db.get(db.calKey(dateObj), []);
  tasks[index] = newTask;
  db.set(db.calKey(dateObj), tasks);
}

function deleteTask(dateObj, index) {
  const tasks = db.get(db.calKey(dateObj), []);
  tasks.splice(index, 1);
  db.set(db.calKey(dateObj), tasks);
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

    const nameText = document.createElement("span");
    nameText.className = "habit-name-text";
    nameText.textContent = habit;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-delete-btn";
    deleteBtn.innerHTML = "✕";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHabit(hIdx);
    };

    nameEl.append(nameText, deleteBtn);
    nameEl.ondblclick = async () => {
      const newName = await showInputModal('Rename Habit', 'Enter new name...', habit);
      if (newName && newName.trim()) {
        habits[hIdx] = newName.trim();
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
        if (check.classList.contains("done")) {
          localStorage.setItem(key, "1");
          sounds.click();

          // Check if all habits are done for a day (only celebrate on Sunday)
          if (dayIdx === 6) {
            let allDayDone = true;
            for (let h = 0; h < habits.length; h++) {
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
        } else {
          localStorage.removeItem(key);
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

function deleteHabit(index) {
  if (!confirm("Delete habit?")) return;
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
  renderHabits();
  updateHabitsTitle();
};

window.goToHabitsToday = () => {
  currentHabitsWeekDate = new Date();
  renderHabits();
  updateHabitsTitle();
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
  const habits = db.getAllHabits();
  if (habits.length === 0) {
    document.getElementById('habitAnalytics').style.display = 'none';
    return;
  }
  document.getElementById('habitAnalytics').style.display = 'block';

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
  document.getElementById('habitOverallRate').textContent = `${thisWeekRate}%`;

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
  document.getElementById('habitMonthlyRate').textContent = `${monthlyRate}%`;

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
  document.getElementById('habitCurrentStreak').textContent = currentStreak;

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
  document.getElementById('habitBestStreak').textContent = bestStreak;

  // Per-habit breakdown (last 4 weeks)
  const breakdownContainer = document.getElementById('habitBreakdown');
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
        const alreadyExists = todayGoals.some(g => g.text === incompleteGoal.text);
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
  const goals = db.getGoals();
  els.goalsList.innerHTML = "";

  if (goals.length === 0) {
    els.goalsList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">What do you want to accomplish today?</div>';
    return;
  }

  goals.forEach((goal, idx) => {
    const item = document.createElement("div");
    item.className = `focus-item ${goal.done ? 'done' : ''}`;

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
        }, 400);
      } else {
        item.classList.remove('done');
      }
    };

    // Goal text
    const textDiv = document.createElement("div");
    textDiv.className = "focus-text";
    textDiv.textContent = typeof goal === 'string' ? goal : goal.text;
    textDiv.ondblclick = async () => {
      const currentText = typeof goal === 'string' ? goal : goal.text;
      const newText = await showInputModal('Edit Goal', 'Update your goal...', currentText);
      if (newText && newText.trim()) {
        const goals = db.getGoals();
        goals[idx] = { text: newText.trim(), done: goal.done || false };
        db.setGoals(goals);
        renderGoals();
      }
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
const listConfigs = {
  goals2026: { key: 'list-goals2026', elementId: 'goals2026List' },
  shopping: { key: 'list-shopping', elementId: 'shoppingList' },
  chores: { key: 'list-chores', elementId: 'choresList' }
};

function getListItems(listName) {
  return db.get(listConfigs[listName].key, []);
}

function setListItems(listName, items) {
  db.set(listConfigs[listName].key, items);
}

function renderSimpleList(listName) {
  const config = listConfigs[listName];
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

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `simple-list-item ${item.done ? 'done' : ''}`;

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
  const prompts = {
    goals2026: "What's your goal for 2026?",
    shopping: "What do you need to buy?",
    chores: "What chore needs doing?"
  };

  const text = await showInputModal(
    listName === 'goals2026' ? 'New 2026 Goal' :
      listName === 'shopping' ? 'Add to Shopping List' : 'New Chore',
    prompts[listName]
  );

  if (!text || !text.trim()) return;

  const items = getListItems(listName);
  items.push({ text: text.trim(), done: false });
  setListItems(listName, items);
  renderSimpleList(listName);
  sounds.click();
};

function renderAllLists() {
  renderSimpleList('goals2026');
  renderSimpleList('shopping');
  renderSimpleList('chores');
}

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
    header.textContent = colName;

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
        const taskObj = typeof task === 'string' ? { text: task, done: false, priority: null } : task;
        const card = createKanbanCard(taskObj, colName, idx, isWeekBased, true, dayDate);
        itemsDiv.appendChild(card);
      });
    }

    // Then add kanban-only tasks
    const items = boardData[colName] || [];
    items.forEach((item, idx) => {
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
    db.set('backlog', board);
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
window.addEventListener('DOMContentLoaded', init);
window.toggleDark = toggleDark;

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
