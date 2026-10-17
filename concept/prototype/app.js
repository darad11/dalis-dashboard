/*
 * Dali's Dashboard – Konzept-Prototyp (app.js)
 * Alles hier ist Simulation: Beispieldaten im Speicher (optional im localStorage dieses
 * Browsers), keine Anmeldung, kein Supabase, keine echten Kurzbefehle. Der Prototyp zeigt
 * Abläufe und Layouts der Konzepte A–G aus dem Bericht "Product Discovery & Roadmap".
 */
(function () {
  'use strict';

  // ===== Demo-Zeit: Mittwoch, 14. Oktober 2026 (Woche 42: Mo 12. – So 18.) =====
  const TODAY = 2;                 // Index in der Woche (Mo = 0)
  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const DAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const CAPACITY_MIN = 6 * 60;     // Einstellung "Tageskapazität" (Demo: 6 h)
  const PROJECTS = [
    { id: 'au', name: 'AllesUni', short: 'AU' },
    { id: 'ra', name: 'Radl', short: 'RA' },
    { id: 'db', name: 'Dashboard', short: 'DB' },
    { id: 'pr', name: 'Privat', short: 'PR' }
  ];
  const AREAS = [
    { id: 'todo', name: 'to do' },
    { id: 'next', name: 'up next' },
    { id: 'waiting', name: 'waiting' },
    { id: 'ideas', name: 'ideas' }
  ];
  const ESTIMATES = [15, 30, 60, 120];
  const STORE_KEY = 'dali-concept-prototype-v1';

  // ----- Beispieldaten (frei erfunden) -----
  // Aufgabe: { id, text, project, area, due (Tagesindex, <0 = Vorwoche), planned (Tagesindex),
  //            est (Minuten), done, rolls (Verschiebungen), block {day,start,end}, waiting {who,until}, note }
  function seed() {
    return {
      tasks: [
        { id: 1, text: 'Angebot Baustelle Nord nachfassen', project: 'ra', area: 'next', due: 0, planned: 2, est: 30, done: false, rolls: 2, block: null, waiting: null, note: 'Angebot vom 6.10., Rückfrage zu Position 4' },
        { id: 2, text: 'Landingpage AllesUni überarbeiten', project: 'au', area: 'next', due: null, planned: 3, est: 120, done: false, rolls: 0, block: { day: 3, start: '14:00', end: '16:00' }, waiting: null, note: '' },
        { id: 3, text: 'Semester­start-Newsletter schreiben', project: 'au', area: 'todo', due: 2, planned: 2, est: 60, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 4, text: 'Nachunternehmer Elektrik: Zeitplan bestätigen', project: 'ra', area: 'waiting', due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: { who: 'Fa. Lichtblick', until: 4 }, note: '' },
        { id: 5, text: 'Stabile IDs im Datenmodell', project: 'db', area: 'next', due: null, planned: null, est: 120, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 6, text: 'Steuerberater: Unterlagen Q3 zusammen­stellen', project: 'pr', area: 'todo', due: 4, planned: 4, est: 45, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 7, text: 'Community-Call vorbereiten', project: 'au', area: 'todo', due: 2, planned: 2, est: 30, done: false, rolls: 0, block: { day: 2, start: '15:30', end: '16:00' }, waiting: null, note: '' },
        { id: 8, text: 'Rechnung Bauabschnitt 2 stellen', project: 'ra', area: 'todo', due: 2, planned: 2, est: 45, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 9, text: 'Laufen 5 km', project: 'pr', area: 'todo', due: null, planned: 2, est: null, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 10, text: 'Materialliste Dachgeschoss prüfen', project: 'ra', area: 'next', due: 5, planned: null, est: 60, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 11, text: 'Interview mit der Studierenden­vertretung', project: 'au', area: 'waiting', due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: { who: 'ÖH', until: 7 }, note: '' },
        { id: 12, text: 'Idee: Wochenbrief per Kurzbefehl', project: 'db', area: 'ideas', due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 13, text: 'Idee: Mentoring-Programm für Erstsemester', project: 'au', area: 'ideas', due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 14, text: 'Geschenk für Mama bestellen', project: 'pr', area: 'todo', due: 6, planned: null, est: 15, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 15, text: 'Präsentation Investoren­gespräch', project: 'au', area: 'next', due: 4, planned: 4, est: 120, done: false, rolls: 0, block: null, waiting: null, note: '' },
        { id: 16, text: 'Bauleiter-Meeting: Protokoll verschicken', project: 'ra', area: 'todo', due: 1, planned: 1, est: 20, done: true, rolls: 0, block: null, waiting: null, note: '' },
        { id: 17, text: 'Supabase-Wachhalten als Workflow', project: 'db', area: 'todo', due: null, planned: 0, est: 30, done: true, rolls: 0, block: null, waiting: null, note: '' },
        { id: 18, text: 'Zahnarzttermin vereinbaren', project: 'pr', area: 'todo', due: null, planned: 3, est: null, done: false, rolls: 2, block: null, waiting: null, note: '' },
        { id: 19, text: 'Sponsoren-Mail Semesterfest', project: 'au', area: 'todo', due: 1, planned: 1, est: 30, done: true, rolls: 0, block: null, waiting: null, note: '' },
        { id: 20, text: 'Bauzeitenplan aktualisieren', project: 'ra', area: 'todo', due: 0, planned: 0, est: 60, done: true, rolls: 0, block: null, waiting: null, note: '' }
      ],
      events: [
        { id: 'e1', title: 'Jour fixe Radl', day: 0, start: '09:00', end: '10:00', cal: 'work' },
        { id: 'e2', title: 'Baustellenbesuch Nord', day: 1, start: '13:00', end: '15:30', cal: 'work' },
        { id: 'e3', title: 'Team-Call AllesUni', day: 2, start: '10:00', end: '11:00', cal: 'work' },
        { id: 'e4', title: 'Mittagessen mit Lena', day: 2, start: '12:30', end: '13:30', cal: 'personal' },
        { id: 'e5', title: 'Community-Call', day: 2, start: '17:00', end: '18:00', cal: 'work' },
        { id: 'e6', title: 'Bank: Finanzierungs­gespräch', day: 3, start: '11:00', end: '12:00', cal: 'work' },
        { id: 'e7', title: 'Gym', day: 3, start: '18:30', end: '19:30', cal: 'personal' },
        { id: 'e8', title: 'Abnahme Bauabschnitt 2', day: 4, start: '09:00', end: '12:00', cal: 'work' },
        { id: 'e9', title: 'Bauernmarkt', day: 5, start: '09:30', end: '10:30', cal: 'personal' }
      ],
      inbox: [
        { id: 'i1', text: 'Mail an die Hausverwaltung wegen der Heizungsablesung', project: null, when: 'heute 08:12', via: 'app' },
        { id: 'i2', text: 'Zement für Abschnitt 3 nachbestellen', project: 'ra', when: 'gestern 17:40', via: 'shortcut' },
        { id: 'i3', text: 'Blog-Idee: Lernen in Gruppen – warum es wirkt', project: 'au', when: 'gestern 21:05', via: 'shortcut' }
      ],
      habits: [
        { id: 'h1', name: 'Meditation', week: [true, true, false, false, false, false, false], history: [71, 64, 86, 0] },
        { id: 'h2', name: '10k Schritte', week: [true, false, false, false, false, false, false], history: [57, 71, 43, 0] },
        { id: 'h3', name: 'Kein Zucker', week: [true, true, true, false, false, false, false], history: [86, 86, 71, 0] },
        { id: 'h4', name: 'Lesen', week: [false, true, false, false, false, false, false], history: [43, 57, 57, 0] }
      ],
      steps: { today: 6180, target: 11900, weekSoFar: 24380, yearPct: 58, yearDone: 2519230, yearGoal: 4343500 },
      focus: [
        { task: 5, project: 'db', min: 75, day: 0 },
        { task: 2, project: 'au', min: 50, day: 1 },
        { task: 16, project: 'ra', min: 25, day: 1 },
        { task: 8, project: 'ra', min: 25, day: 2 }
      ],
      lists: { Einkauf: 4, Lesen: 7 },
      notes: [{ day: 0, text: 'Guter Start, zu viele Anrufe am Nachmittag.' }, { day: 1, text: 'Baustelle Nord läuft, Angebot bleibt offen.' }],
      nextId: 21,
      filter: null,
      area: 'todo',
      selectedDay: TODAY,
      weekMode: 'week',
      variants: { home: 'tasks', projects: 'chips', day: 'linear', close: 'compact' },
      evening: false,
      closeDecisions: {},
      closeStep: 0,
      sentence: '',
      closed: null,
      device: 'desktop'
    };
  }

  let state = load() || seed();
  let ui = { picker: null, wf: null, wfStep: 0, panel: false, focusTimer: null, focusLeft: 0 };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && Array.isArray(s.tasks) ? s : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ohne Speicher geht es auch */ }
  }
  function reset() {
    state = seed();
    ui.picker = null; ui.wf = null; ui.wfStep = 0;
    closeSheet();
    save();
    render();
    toast('Beispieldaten zurückgesetzt');
  }

  // ===== Helfer =====
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const proj = id => PROJECTS.find(p => p.id === id) || null;
  const task = id => state.tasks.find(t => t.id === Number(id));
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const nowMin = () => (state.evening ? toMin('18:30') : toMin('09:40'));
  const fmtH = min => { const h = Math.round(min / 30) / 2; return `${String(h).replace('.', ',')} h`; };
  const fmtNum = n => new Intl.NumberFormat('de-DE').format(n);
  const dateOf = i => 12 + i; // Mo 12.10. + i (auch für Vor-/Folgewoche)
  const dayLabel = i => (i === null || i === undefined) ? '' : `${DAYS[((i % 7) + 7) % 7]} ${dateOf(i)}.10.`;
  const dayShort = i => `${DAYS[((i % 7) + 7) % 7]} ${dateOf(i)}.`;
  const taskId = t => `#T-${String(t.id).padStart(2, '0')}`;

  function projChip(id, full) {
    const p = proj(id);
    if (!p) return `<span class="proj" data-project="">ohne Projekt</span>`;
    return `<span class="proj${full ? ' full' : ''}" data-project="${p.id}">${esc(full ? p.name : p.short)}</span>`;
  }
  function estTag(t) {
    return t.est ? `<span class="tag num">${t.est} min</span>` : `<span class="tag" title="ohne Schätzung">–</span>`;
  }
  function dueTag(t) {
    if (t.due === null || t.due === undefined) return '';
    const cls = !t.done && t.due < TODAY ? 'over' : (t.due === TODAY ? 'today' : '');
    const txt = !t.done && t.due < TODAY ? `überfällig seit ${dayShort(t.due)}` : (t.due === TODAY ? 'fällig heute' : `fällig ${dayShort(t.due)}`);
    return `<span class="due ${cls}">${txt}</span>`;
  }
  function plannedTag(t, impliedDay) {
    if (t.planned === null || t.planned === undefined || t.planned === impliedDay) return '';
    return `<span class="link-id" title="Dieselbe Aufgabe steht in der Woche">${esc(dayShort(t.planned))}</span>`;
  }
  function rollsTag(t) {
    return t.rolls >= 2 ? `<span class="tag warn">${t.rolls}× verschoben</span>` : '';
  }
  function waitingTag(t) {
    return t.waiting ? `<span>wartet auf ${esc(t.waiting.who)} · bis ${esc(dayShort(t.waiting.until))}</span>` : '';
  }
  const open = t => !t.done;
  const overdue = t => !t.done && t.due !== null && t.due !== undefined && t.due < TODAY;
  const inFilter = t => !state.filter || t.project === state.filter;

  // ===== Abgeleitete Daten =====
  function todayTasks() {
    const list = state.tasks.filter(t => open(t) && inFilter(t) && (overdue(t) || t.due === TODAY || t.planned === TODAY));
    return list.sort((a, b) => {
      const ra = overdue(a) ? 0 : (a.due === TODAY ? 1 : 2);
      const rb = overdue(b) ? 0 : (b.due === TODAY ? 1 : 2);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (b.rolls - a.rolls) || (a.due - b.due);
      return (b.est || 0) - (a.est || 0);
    });
  }
  function eventsOf(day) { return state.events.filter(e => e.day === day).sort((a, b) => toMin(a.start) - toMin(b.start)); }
  function tasksOf(day) { return state.tasks.filter(t => t.planned === day && inFilter(t)); }

  function nextStep() {
    const candidates = state.tasks.filter(t => open(t) && inFilter(t));
    const over = candidates.filter(overdue).sort((a, b) => (b.rolls - a.rolls) || (a.due - b.due));
    if (over.length) {
      const t = over[0];
      return { task: t, why: `Überfällig seit ${dayShort(t.due)}${t.rolls >= 2 ? ` · zum ${t.rolls}. Mal verschoben` : ''}` };
    }
    const dueToday = candidates.filter(t => t.due === TODAY).sort((a, b) => (b.est || 0) - (a.est || 0));
    if (dueToday.length) return { task: dueToday[0], why: 'Fällig heute' };
    const planned = candidates.filter(t => t.planned === TODAY).sort((a, b) => (b.est || 0) - (a.est || 0));
    if (planned.length) return { task: planned[0], why: `Heute eingeplant${planned[0].est ? ` · ${planned[0].est} min` : ''}` };
    const ev = eventsOf(TODAY).find(e => toMin(e.start) > nowMin());
    if (ev) return { task: null, event: ev, why: `Nächster Termin um ${ev.start}: Vorbereitung` };
    return { task: null, why: 'Nichts offen – ein guter Moment für die Matrix.' };
  }

  function capacity(day) {
    const evs = eventsOf(day);
    const eventsMin = evs.reduce((s, e) => s + (toMin(e.end) - toMin(e.start)), 0);
    const ts = state.tasks.filter(t => t.planned === day && !t.done);
    const estMin = ts.reduce((s, t) => s + (t.est || 0), 0);
    const unknown = ts.filter(t => !t.est).length;
    const used = eventsMin + estMin;
    return { eventsMin, estMin, unknown, taskCount: ts.length, eventCount: evs.length, free: Math.max(0, CAPACITY_MIN - used), used, over: used > CAPACITY_MIN };
  }

  function projectCounts() {
    return PROJECTS.map(p => {
      const ts = state.tasks.filter(t => t.project === p.id);
      return { ...p, open: ts.filter(open).length, over: ts.filter(overdue).length, waiting: ts.filter(t => open(t) && t.waiting).length, done: ts.filter(t => t.done).length };
    });
  }

  function weeklyNumbers() {
    const perProject = PROJECTS.map(p => {
      const ts = state.tasks.filter(t => t.project === p.id && t.planned !== null && t.planned !== undefined);
      const focusMin = state.focus.filter(f => f.project === p.id).reduce((s, f) => s + f.min, 0);
      return { ...p, planned: ts.length, done: ts.filter(t => t.done).length, focusMin };
    });
    const rolled = state.tasks.filter(t => open(t) && t.rolls >= 2).sort((a, b) => b.rolls - a.rolls);
    const daysElapsed = TODAY + 1;
    const habitChecks = state.habits.reduce((s, h) => s + h.week.slice(0, daysElapsed).filter(Boolean).length, 0);
    const habitQuota = Math.round(100 * habitChecks / (state.habits.length * daysElapsed));
    return { perProject, rolled, habitQuota, focusTotal: state.focus.reduce((s, f) => s + f.min, 0) };
  }

  // ===== Timeline eines Tages (Termine + Zeitblöcke + freie Zeit) =====
  function timeline(day) {
    const items = [];
    eventsOf(day).forEach(e => items.push({ kind: 'event', start: toMin(e.start), end: toMin(e.end), e }));
    state.tasks.filter(t => t.block && t.block.day === day && !t.done).forEach(t => items.push({ kind: 'block', start: toMin(t.block.start), end: toMin(t.block.end), t }));
    items.sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = toMin('08:00');
    items.forEach(it => {
      if (it.start - cursor >= 45) out.push({ kind: 'gap', start: cursor, end: it.start });
      out.push(it);
      cursor = Math.max(cursor, it.end);
    });
    if (toMin('19:00') - cursor >= 45) out.push({ kind: 'gap', start: cursor, end: toMin('19:00') });
    return out;
  }

  // ===== Rendering =====
  const NAV = [
    { id: 'home', label: 'Home' }, { id: 'inbox', label: 'Inbox' }, { id: 'tasks', label: 'Aufgaben' },
    { id: 'week', label: 'Woche' }, { id: 'close', label: 'Abschluss' }, { id: 'review', label: 'Rückblick' }, { id: 'ios', label: 'iOS' }
  ];
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><path d="M4 13h5l1.5 2h3L15 13h5"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>'
  };

  function route() {
    const h = (location.hash || '#home').replace('#', '');
    return NAV.some(n => n.id === h) ? h : 'home';
  }

  function render() {
    const r = route();
    $('#nav').innerHTML = NAV.map(n => `<a href="#${n.id}" ${r === n.id ? 'aria-current="page"' : ''}>${n.label}${n.id === 'inbox' && state.inbox.length ? ` <span class="badge">${state.inbox.length}</span>` : ''}</a>`).join('');
    const tabs = [
      { id: 'home', label: 'Home' }, { id: 'inbox', label: 'Inbox', badge: state.inbox.length }, { id: 'tasks', label: 'Aufgaben' }, { id: 'week', label: 'Woche' }, { id: 'more', label: 'Mehr' }
    ];
    $('#tabbar').innerHTML = tabs.map(t => t.id === 'more'
      ? `<a href="#more" data-action="more" ${['close', 'review', 'ios'].includes(r) ? 'aria-current="page"' : ''}>${ICONS.more}<span>${t.label}</span></a>`
      : `<a href="#${t.id}" ${r === t.id ? 'aria-current="page"' : ''}>${ICONS[t.id]}<span>${t.label}</span>${t.badge ? `<span class="badge">${t.badge}</span>` : ''}</a>`).join('');
    $('#demoClock').textContent = state.evening ? '18:30' : '09:40';
    $$('#deviceSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === state.device)));
    $('#stage').classList.toggle('phone-frame', state.device === 'phone' && window.innerWidth > 760);
    const views = { home: viewHome, inbox: viewInbox, tasks: viewTasks, week: viewWeek, close: viewClose, review: viewReview, ios: viewIOS };
    $('#view').innerHTML = views[r]();
    renderWfBar();
    save();
  }

  // ----- Bausteine -----
  function projectChips(withAll) {
    const counts = projectCounts();
    const all = withAll ? `<button type="button" class="chip" data-action="filter" data-project="" aria-pressed="${state.filter ? 'false' : 'true'}">Alle</button>` : '';
    return `<div class="chips pchips" role="group" aria-label="Projekt">${all}${counts.map(p => `
      <button type="button" class="chip pchip" data-action="filter" data-project="${p.id}" aria-pressed="${state.filter === p.id ? 'true' : 'false'}">${esc(p.name)} <span class="count">${p.open}</span>${p.over ? ` <span class="over">· ${p.over} überfällig</span>` : ''}</button>`).join('')}</div>`;
  }
  function projectCards() {
    return `<div class="project-cards">${projectCounts().map(p => `
      <div class="pcard" data-project="${p.id}" role="button" tabindex="0" data-action="filter" aria-pressed="${state.filter === p.id ? 'true' : 'false'}">
        <div class="pn">${esc(p.name)}</div>
        <div class="pm">${p.open} offen${p.over ? ` · <span class="over">${p.over} überfällig</span>` : ''}${p.waiting ? ` · ${p.waiting} wartet` : ''}</div>
        <div class="pm">${p.done} erledigt diese Woche</div>
      </div>`).join('')}</div>`;
  }
  function taskRow(t, opts) {
    opts = opts || {};
    const meta = [projChip(t.project), dueTag(t), opts.est !== false ? estTag(t) : '', plannedTag(t, opts.day), rollsTag(t), waitingTag(t)].filter(Boolean).join('');
    return `<li class="row clickable${t.done ? ' done' : ''}" data-action="detail" data-id="${t.id}">
      <button type="button" class="check" role="checkbox" aria-checked="${t.done}" aria-label="${esc(t.text)} erledigt" data-action="toggle" data-id="${t.id}"></button>
      <div class="main"><div class="text">${esc(t.text)}</div><div class="meta">${meta}</div></div>
      <div class="side">${opts.side || ''}</div>
    </li>`;
  }
  function eventRow(e, opts) {
    opts = opts || {};
    const past = opts.today && toMin(e.end) <= nowMin();
    const next = opts.today && !past && toMin(e.start) > nowMin() && opts.nextId === e.id;
    return `<li class="event${past ? ' past' : ''}${next ? ' next' : ''}" data-cal="${e.cal}">
      <div class="time"><b>${e.start}</b><span>${e.end}</span></div><span class="bar"></span>
      <div class="title">${esc(e.title)}${next ? `<span class="sub">als Nächstes · in ${toMin(e.start) - nowMin()} min</span>` : ''}</div>
    </li>`;
  }
  function capacityBlock(day, compact) {
    const c = capacity(day);
    const pct = v => `${Math.min(100, Math.round(100 * v / Math.max(CAPACITY_MIN, c.used)))}%`;
    const line = `<div class="line"><span><b>${c.eventCount}</b> Termine · ${fmtH(c.eventsMin)}</span><span><b>${c.taskCount}</b> Aufgaben · ${c.estMin ? `≈ ${fmtH(c.estMin)} geschätzt` : 'nicht geschätzt'}${c.unknown ? ` <span class="muted">(+${c.unknown} ohne Schätzung)</span>` : ''}</span><span>${c.over ? `<span class="over">überladen · ${fmtH(c.used)} von ${fmtH(CAPACITY_MIN)}</span>` : `frei ≈ <b>${fmtH(c.free)}</b> von ${fmtH(CAPACITY_MIN)}`}</span></div>`;
    const bar = `<div class="capbar${c.over ? ' over' : ''}" aria-hidden="true"><i class="ev" style="width:${pct(c.eventsMin)}"></i><i class="est" style="width:${pct(c.estMin)}"></i>${c.unknown ? `<i class="unk" style="width:${c.unknown * 4}%"></i>` : ''}</div>`;
    const legend = compact ? '' : `<div class="cap-legend"><span><i style="background:var(--cal-work)"></i>Termine</span><span><i style="background:var(--accent)"></i>Schätzungen</span><span><i style="background:repeating-linear-gradient(135deg,var(--accent-soft) 0 3px,transparent 3px 6px)"></i>ohne Schätzung</span><span>Kapazität ${fmtH(CAPACITY_MIN)} (Einstellung)</span></div>`;
    return `<div class="capacity">${line}${bar}${legend}</div>`;
  }

  // ===== Home =====
  function viewHome() {
    const hour = state.evening ? 18 : 9;
    const greet = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    const ns = nextStep();
    const today = todayTasks();
    const evs = eventsOf(TODAY);
    const nextEv = evs.find(e => toMin(e.start) > nowMin());
    const openCount = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t) || t.due === TODAY)).length;
    const habitsOpen = state.habits.filter(h => !h.week[TODAY]).length;
    const nextCard = ns.task ? `
      <section class="card next-step" id="nextStep" aria-label="Nächster Schritt">
        <div class="label">Nächster Schritt</div>
        <div class="task">${esc(ns.task.text)}</div>
        <div class="why">${projChip(ns.task.project, true)}<span>${esc(ns.why)}</span>${ns.task.est ? `<span class="tag num">${ns.task.est} min</span>` : ''}<span class="link-id">${taskId(ns.task)}</span></div>
        <div class="actions"><button type="button" class="btn primary" data-action="focus" data-id="${ns.task.id}">Fokus starten</button><button type="button" class="btn" data-action="toggle" data-id="${ns.task.id}">Erledigt</button><button type="button" class="btn quiet" data-action="detail" data-id="${ns.task.id}">Details</button></div>
      </section>` : `
      <section class="card next-step" id="nextStep"><div class="label">Nächster Schritt</div><div class="task">${ns.event ? esc(ns.event.title) : 'Alles erledigt'}</div><div class="why"><span>${esc(ns.why)}</span></div></section>`;
    const eveningCard = state.evening ? `
      <section class="card" style="border:1.5px solid var(--good)">
        <div class="card-head"><div class="card-title">Tag abschließen</div><div class="card-meta">18:30</div></div>
        <p class="muted" style="font-size:15px">${openCount} offene Aufgabe${openCount === 1 ? '' : 'n'}, ${state.inbox.length} in der Inbox, ${habitsOpen} Habit${habitsOpen === 1 ? '' : 's'} offen – zwei Minuten.</p>
        <div class="actions" style="margin-top:12px"><a class="btn primary" href="#close">Tagesabschluss</a></div>
      </section>` : '';
    const tasksCard = `
      <section class="card" id="todayCard">
        <div class="card-head"><div class="card-title">Heute</div><div class="card-meta">${today.length} offen${state.filter ? ` · ${esc(proj(state.filter).name)}` : ''}</div></div>
        ${today.length ? `<ul class="rows">${today.map(t => taskRow(t, { day: TODAY })).join('')}</ul>` : '<p class="empty">Nichts mehr offen für heute.</p>'}
        <div style="margin-top:10px"><a class="card-link" href="#week">Woche ansehen ›</a></div>
      </section>`;
    const planCard = `
      <section class="card" id="todayCard">
        <div class="card-head"><div class="card-title">Tagesplan</div><div class="card-meta">08–19 Uhr</div></div>
        ${timelineHtml(TODAY)}
        ${(() => { const rest = tasksOf(TODAY).filter(t => open(t) && !t.block); return rest.length ? `<div class="card-head" style="margin-top:14px"><div class="card-title" style="font-size:15px">Ohne Uhrzeit</div><div class="card-meta">${rest.length}</div></div><ul class="rows">${rest.map(t => taskRow(t, { day: TODAY })).join('')}</ul>` : ''; })()}
      </section>`;
    const eventsCard = `
      <section class="card">
        <div class="card-head"><div class="card-title">Termine heute</div><div class="card-meta">${evs.length}</div></div>
        ${evs.length ? `<ul class="rows">${evs.map(e => eventRow(e, { today: true, nextId: nextEv && nextEv.id })).join('')}</ul>` : '<p class="empty">Keine Termine.</p>'}
      </section>`;
    const stepsCard = `
      <section class="card"><div class="card-head"><div class="card-title">Schritte</div><div class="card-meta">Jahr ${state.steps.yearPct} %</div></div>
        <div class="steps-line"><div class="nums num"><span><b>${fmtNum(state.steps.today)}</b> heute</span><span class="muted">Ziel ${fmtNum(state.steps.target)}</span></div><div class="meter"><i style="width:${Math.min(100, Math.round(100 * state.steps.today / state.steps.target))}%"></i></div><div class="small muted">Noch ${fmtNum(state.steps.target - state.steps.today)} bis zum Tagesziel · aus Apple Health per Kurzbefehl</div></div>
      </section>`;
    const habitsCard = `
      <section class="card" id="habitsCard"><div class="card-head"><div class="card-title">Habits</div><div class="card-meta">${state.habits.filter(h => h.week[TODAY]).length} von ${state.habits.length} heute</div></div>
        <div class="habit-chips">${state.habits.map(h => `<button type="button" class="habit" aria-pressed="${h.week[TODAY]}" data-action="habit" data-id="${h.id}"><span class="dot"></span>${esc(h.name)}</button>`).join('')}</div>
      </section>`;
    const left = state.variants.home === 'plan' ? planCard : tasksCard;
    const right = state.variants.home === 'plan' ? `${stepsCard}${habitsCard}` : `${eventsCard}${stepsCard}${habitsCard}`;
    return `
      <div class="greeting"><div><h1>${greet}, Dali.</h1><div class="date"><span>${DAY_LONG[TODAY]}, ${dateOf(TODAY)}. Oktober</span><span class="num">${state.evening ? '18:30' : '09:40'}</span><span class="weather">12° · leichter Regen <span class="tag">Demo</span></span></div></div></div>
      ${state.inbox.length ? `<a class="inbox-pill" href="#inbox" id="inboxPill"><span><b>Inbox</b> · ${state.inbox.length} unsortiert</span><span class="go">Sortieren ›</span></a>` : ''}
      ${eveningCard}
      <div class="col">
        ${nextCard}
        <section class="card" id="capacityCard"><div class="card-head"><div class="card-title">Heute</div><div class="card-meta">Kapazität</div></div>${capacityBlock(TODAY, false)}</section>
        <div id="projectChips">${projectChips(true)}</div>
        <div class="grid-2"><div class="col">${left}</div><div class="col">${right}</div></div>
      </div>`;
  }

  function timelineHtml(day) {
    const items = timeline(day);
    if (!items.length) return '<p class="empty">Keine Termine und keine Zeitblöcke.</p>';
    return `<div class="timeline">${items.map(it => {
      if (it.kind === 'gap') return `<div class="slot gap"><div class="t num">${fromMin(it.start)}</div><div class="body">frei · ${fmtH(it.end - it.start)}</div></div>`;
      if (it.kind === 'event') return `<div class="slot"><div class="t num">${fromMin(it.start)}</div><div class="body"><div class="block ev-block" data-cal="${it.e.cal}"><div class="bt">${esc(it.e.title)}</div><div class="bm">${it.e.start}–${it.e.end} · Termin</div></div></div></div>`;
      return `<div class="slot"><div class="t num">${fromMin(it.start)}</div><div class="body"><div class="block task-block clickable" data-action="detail" data-id="${it.t.id}" role="button" tabindex="0"><div class="bt">${esc(it.t.text)}</div><div class="bm">${it.t.block.start}–${it.t.block.end} · Zeitblock · ${projChip(it.t.project)} <span class="link-id">${taskId(it.t)}</span></div></div></div></div>`;
    }).join('')}</div>`;
  }

  // ===== Inbox =====
  function viewInbox() {
    const items = state.inbox;
    const pick = ui.picker;
    return `
      <div class="view-head"><div><h1 class="view-title">Inbox</h1><p class="view-sub">${items.length ? `${items.length} unsortiert · sortieren, wenn du Zeit hast` : 'Leer – alles hat seinen Platz'}</p></div></div>
      <section class="card" id="captureCard">
        <form class="capture" data-action="capture-form" autocomplete="off">
          <div class="field"><input type="text" id="captureInput" placeholder="Was ist dir eingefallen?" aria-label="Neuer Eintrag" enterkeyhint="done"><button type="submit" class="btn primary">Hinzufügen</button></div>
          <div class="chips" role="group" aria-label="Projekt (optional)">${PROJECTS.map(p => `<button type="button" class="chip pchip" data-project="${p.id}" data-action="capture-project" aria-pressed="false">${esc(p.name)}</button>`).join('')}</div>
          <div class="hint">Projekt und Datum sind optional. Unterwegs: <button type="button" class="card-link" data-action="shortcut-demo">per Kurzbefehl diktieren (Demo)</button></div>
        </form>
      </section>
      <section class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">Unsortiert</div><div class="card-meta">neueste zuerst</div></div>
        ${items.length ? `<ul>${items.map(it => `
          <li class="inbox-item" data-inbox="${it.id}">
            <div class="text">${esc(it.text)}</div>
            <div class="meta"><span class="chips" style="gap:4px">${PROJECTS.map(p => `<button type="button" class="chip pchip" style="min-height:26px;padding:0 9px;font-size:12px" data-project="${p.id}" data-action="inbox-project" data-id="${it.id}" aria-pressed="${it.project === p.id}">${esc(p.short)}</button>`).join('')}</span><span>${esc(it.when)}</span>${it.via === 'shortcut' ? '<span class="tag">per Kurzbefehl</span>' : ''}</div>
            <div class="triage" role="group" aria-label="Einordnen">
              <button type="button" class="btn sm" data-action="triage" data-kind="today" data-id="${it.id}">Heute</button>
              <button type="button" class="btn sm" data-action="pick" data-kind="week" data-id="${it.id}" aria-expanded="${pick && pick.id === it.id && pick.kind === 'week'}">Woche ▾</button>
              <button type="button" class="btn sm" data-action="pick" data-kind="matrix" data-id="${it.id}" aria-expanded="${pick && pick.id === it.id && pick.kind === 'matrix'}">Matrix ▾</button>
              <button type="button" class="btn sm" data-action="triage" data-kind="event" data-id="${it.id}">Termin</button>
              <button type="button" class="btn sm" data-action="pick" data-kind="list" data-id="${it.id}" aria-expanded="${pick && pick.id === it.id && pick.kind === 'list'}">Liste ▾</button>
              <button type="button" class="btn sm danger" data-action="triage" data-kind="delete" data-id="${it.id}">Löschen</button>
            </div>
            ${pick && pick.id === it.id ? pickerHtml(pick.kind, it.id) : ''}
          </li>`).join('')}</ul>` : '<p class="empty">Nichts zu sortieren. Neue Einträge landen hier – vom „+“, vom Kurzbefehl oder vom Teilen-Menü.</p>'}
      </section>`;
  }
  function pickerHtml(kind, id) {
    if (kind === 'week') return `<div class="picker"><span class="lbl">Welcher Tag?</span>${[2, 3, 4, 5, 6].map(d => `<button type="button" class="btn sm${d === TODAY ? ' today' : ''}" data-action="triage" data-kind="week" data-day="${d}" data-id="${id}">${DAYS[d]} ${dateOf(d)}.</button>`).join('')}</div>`;
    if (kind === 'matrix') return `<div class="picker"><span class="lbl">Welcher Bereich?</span>${AREAS.map(a => `<button type="button" class="btn sm" data-action="triage" data-kind="matrix" data-area="${a.id}" data-id="${id}">${a.name}</button>`).join('')}</div>`;
    if (kind === 'list') return `<div class="picker"><span class="lbl">Welche Liste?</span>${Object.keys(state.lists).map(l => `<button type="button" class="btn sm" data-action="triage" data-kind="list" data-list="${esc(l)}" data-id="${id}">${esc(l)} <span class="muted">${state.lists[l]}</span></button>`).join('')}</div>`;
    return '';
  }

  // ===== Aufgaben (Matrix) =====
  function viewTasks() {
    const areaCols = AREAS.map(a => {
      const ts = state.tasks.filter(t => t.area === a.id && open(t) && inFilter(t)).sort((x, y) => (overdue(y) - overdue(x)) || ((x.due ?? 99) - (y.due ?? 99)));
      return `<section class="area" data-area="${a.id}"><div class="area-head"><span class="name">${a.name}</span><span class="n">${ts.length}</span></div>${ts.length ? `<ul class="rows">${ts.map(t => taskRow(t)).join('')}</ul>` : '<p class="empty">leer</p>'}<button type="button" class="btn sm quiet" style="margin-top:6px" data-action="new-task" data-area="${a.id}">+ Aufgabe</button></section>`;
    }).join('');
    const doneCount = state.tasks.filter(t => t.done && inFilter(t)).length;
    return `
      <div class="view-head"><div><h1 class="view-title">Aufgaben</h1><p class="view-sub">Ein Bestand: die Matrix verwaltet, die Woche terminiert – dieselbe Aufgabe an beiden Orten.</p></div><div class="view-actions desktop-only"><a class="btn" href="#week">Woche ›</a></div></div>
      <div id="projectFilter" style="margin-bottom:16px">${state.variants.projects === 'cards' ? projectCards() : projectChips(true)}</div>
      <div class="phone-only area-seg"><div class="seg" role="tablist" aria-label="Bereich">${AREAS.map(a => `<button type="button" role="tab" data-action="area" data-area="${a.id}" aria-pressed="${state.area === a.id}">${a.name} <span class="count">${state.tasks.filter(t => t.area === a.id && open(t) && inFilter(t)).length}</span></button>`).join('')}</div></div>
      <div class="areas" data-area="${state.area}">${areaCols}</div>
      <p class="small muted" style="margin-top:14px">${doneCount} erledigt diese Woche · ⇄ markiert Aufgaben, die in der Woche eingeplant sind.</p>`;
  }

  function detailSheet(id) {
    const t = task(id);
    if (!t) return;
    const body = `
      <div class="field"><label for="dtText">Aufgabe</label><input type="text" id="dtText" value="${esc(t.text)}" data-action="edit-text" data-id="${t.id}"></div>
      <div class="identity"><span>${taskId(t)} · eine Aufgabe, zwei Sichten${t.planned !== null && t.planned !== undefined ? ` · in der Woche am <b>${dayShort(t.planned)}</b>` : ' · noch nicht eingeplant'}</span>${t.planned !== null && t.planned !== undefined ? `<button type="button" class="card-link" data-action="show-in-week" data-id="${t.id}">in der Woche zeigen ›</button>` : ''}</div>
      <div class="field"><label>Projekt</label><div class="chips">${PROJECTS.map(p => `<button type="button" class="chip pchip" data-project="${p.id}" data-action="set-project" data-id="${t.id}" aria-pressed="${t.project === p.id}">${esc(p.name)}</button>`).join('')}</div></div>
      <div class="field"><label>Bereich</label><div class="chips">${AREAS.map(a => `<button type="button" class="chip" data-action="set-area" data-area="${a.id}" data-id="${t.id}" aria-pressed="${t.area === a.id}">${a.name}</button>`).join('')}</div></div>
      <div class="field"><label>Fällig</label><div class="chips"><button type="button" class="chip" data-action="set-due" data-day="" data-id="${t.id}" aria-pressed="${t.due === null || t.due === undefined}">keine</button>${[2, 3, 4, 5, 6].map(d => `<button type="button" class="chip" data-action="set-due" data-day="${d}" data-id="${t.id}" aria-pressed="${t.due === d}">${DAYS[d]} ${dateOf(d)}.</button>`).join('')}${t.due !== null && t.due !== undefined && t.due < TODAY ? `<span class="tag danger">${esc(dayShort(t.due))} · überfällig</span>` : ''}</div></div>
      <div class="field"><label>Schätzung (optional)</label><div class="chips"><button type="button" class="chip" data-action="set-est" data-est="" data-id="${t.id}" aria-pressed="${!t.est}">keine</button>${ESTIMATES.map(e => `<button type="button" class="chip num" data-action="set-est" data-est="${e}" data-id="${t.id}" aria-pressed="${t.est === e}">${e} min</button>`).join('')}</div></div>
      <div class="field"><label>Für Tag einplanen</label><div class="chips"><button type="button" class="chip" data-action="plan" data-day="" data-id="${t.id}" aria-pressed="${t.planned === null || t.planned === undefined}">nicht eingeplant</button>${[2, 3, 4, 5, 6].map(d => `<button type="button" class="chip" data-action="plan" data-day="${d}" data-id="${t.id}" aria-pressed="${t.planned === d}">${DAYS[d]} ${dateOf(d)}.</button>`).join('')}</div></div>
      ${t.planned !== null && t.planned !== undefined ? `<div class="field"><label>Zeit blocken (optional)</label><div class="chips"><button type="button" class="chip" data-action="block" data-start="" data-id="${t.id}" aria-pressed="${!t.block}">kein Block</button>${['09:00', '11:00', '14:00', '16:00'].map(s => `<button type="button" class="chip num" data-action="block" data-start="${s}" data-id="${t.id}" aria-pressed="${t.block && t.block.start === s}">${s}</button>`).join('')}<span class="muted small">Dauer = Schätzung${t.est ? ` (${t.est} min)` : ' (ohne: 30 min)'}</span></div></div>` : ''}
      ${t.waiting ? `<div class="field"><label>Wartet auf</label><div class="chips"><span class="tag">${esc(t.waiting.who)} · bis ${esc(dayShort(t.waiting.until))}</span></div></div>` : ''}
      <div class="field"><label for="dtNote">Notiz</label><textarea id="dtNote" data-action="edit-note" data-id="${t.id}" placeholder="Kontext, Links, Gedanken">${esc(t.note || '')}</textarea></div>
      <div class="actions"><button type="button" class="btn primary" data-action="focus" data-id="${t.id}">Fokus starten</button><button type="button" class="btn" data-action="toggle" data-id="${t.id}">${t.done ? 'Wieder öffnen' : 'Erledigt'}</button><button type="button" class="btn danger" data-action="delete-task" data-id="${t.id}">Löschen</button></div>`;
    openSheet('Aufgabe', body, { id: 'detail', taskId: t.id });
  }

  // ===== Woche =====
  function viewWeek() {
    const head = `<div class="view-head"><div><h1 class="view-title">Woche 42</h1><p class="view-sub">12.–18. Oktober · Kapazität ${fmtH(CAPACITY_MIN)} pro Tag (Einstellung)</p></div><div class="view-actions"><div class="seg" role="group" aria-label="Ansicht"><button type="button" data-action="week-mode" data-mode="week" aria-pressed="${state.weekMode === 'week'}">Woche</button><button type="button" data-action="week-mode" data-mode="day" aria-pressed="${state.weekMode === 'day'}">Tag</button></div><button type="button" class="btn primary" data-action="plan-sheet" data-day="${state.selectedDay}">+ Einplanen</button></div></div>`;
    const weekGrid = `<div class="week" id="weekGrid">${DAYS.map((d, i) => {
      const c = capacity(i);
      const ts = tasksOf(i).sort((a, b) => (a.done - b.done) || ((b.est || 0) - (a.est || 0)));
      return `<section class="day${i === TODAY ? ' today' : ''}" data-day="${i}">
        <div class="day-head"><span class="d">${d}${i === TODAY ? ' · heute' : ''}</span><span class="n">${dateOf(i)}.10.</span></div>
        <div class="cap${c.over ? ' over' : ''}"><span>${c.over ? `überladen · ${fmtH(c.used)} / ${fmtH(CAPACITY_MIN)}` : `${fmtH(c.used)} / ${fmtH(CAPACITY_MIN)}`}${c.unknown ? ` · +${c.unknown} ohne` : ''}</span><div class="capbar${c.over ? ' over' : ''}"><i class="ev" style="width:${Math.min(100, Math.round(100 * c.eventsMin / CAPACITY_MIN))}%"></i><i class="est" style="width:${Math.min(100, Math.round(100 * c.estMin / CAPACITY_MIN))}%"></i></div></div>
        ${eventsOf(i).length ? `<ul class="rows">${eventsOf(i).map(e => eventRow(e)).join('')}</ul>` : ''}
        ${ts.length ? `<ul class="rows">${ts.map(t => taskRow(t, { day: i })).join('')}</ul>` : ''}
        <button type="button" class="add" data-action="plan-sheet" data-day="${i}">+ Aufgabe</button>
      </section>`;
    }).join('')}</div>`;
    const strip = `<div class="day-strip" role="tablist">${DAYS.map((d, i) => { const c = capacity(i); return `<button type="button" role="tab" data-action="select-day" data-day="${i}" aria-current="${state.selectedDay === i ? 'date' : 'false'}"><span>${d}</span><b>${dateOf(i)}</b><span class="dots">${c.over ? '<i class="over"></i>' : ''}${eventsOf(i).length ? '<i></i>' : ''}${tasksOf(i).filter(open).length ? '<i></i>' : ''}</span></button>`; }).join('')}</div>`;
    const day = state.selectedDay;
    const dayTasks = tasksOf(day).filter(t => open(t) && !t.block);
    const dayCard = `<section class="card"><div class="card-head"><div class="card-title">${DAY_LONG[day]}, ${dateOf(day)}. Oktober</div><div class="card-meta">${day === TODAY ? 'heute' : ''}</div></div>${capacityBlock(day, true)}<div style="margin-top:14px">${timelineHtml(day)}</div></section>`;
    const listCard = `<section class="card"><div class="card-head"><div class="card-title">Ohne Uhrzeit</div><div class="card-meta">${dayTasks.length}</div></div>${dayTasks.length ? `<ul class="rows">${dayTasks.map(t => taskRow(t, { day, side: `<button type="button" class="btn sm" data-action="detail" data-id="${t.id}">Zeit ▾</button>` })).join('')}</ul>` : '<p class="empty">Alle Aufgaben des Tages haben eine Uhrzeit – oder es gibt keine.</p>'}<button type="button" class="btn sm quiet" style="margin-top:8px" data-action="plan-sheet" data-day="${day}">+ Aus der Matrix einplanen</button></section>`;
    const dayView = state.variants.day === 'two'
      ? `${strip}<div class="two-col">${dayCard}${listCard}</div>`
      : `${strip}<div class="col">${dayCard}${listCard}</div>`;
    const weekList = `<section class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">Diese Woche</div><div class="card-meta">belegt / Kapazität</div></div><ul class="rows">${DAYS.map((d, i) => { const c = capacity(i); return `<li class="row clickable" data-action="select-day" data-day="${i}"><span class="check-pad" style="width:auto;font-weight:700;font-size:14px">${d} <span class="muted num">${dateOf(i)}.</span></span><div class="main"><div class="meta" style="font-size:13px"><span>${c.eventCount} Termine</span><span>${c.taskCount} Aufgaben</span>${c.over ? '<span class="due over">überladen</span>' : ''}</div></div><span class="num small ${c.over ? 'due over' : 'muted'}">${fmtH(c.used)} / ${fmtH(CAPACITY_MIN)}</span></li>`; }).join('')}</ul></section>`;
    return `${head}<div class="desktop-only" data-mode="${state.weekMode}">${state.weekMode === 'week' ? weekGrid : dayView}</div><div class="phone-only">${dayView}${weekList}</div>`;
  }

  function planSheet(day) {
    const candidates = state.tasks.filter(t => open(t) && (t.planned === null || t.planned === undefined) && t.area !== 'ideas').sort((a, b) => (AREAS.findIndex(x => x.id === a.area) - AREAS.findIndex(x => x.id === b.area)) || (overdue(b) - overdue(a)));
    const c = capacity(day);
    const body = `
      <p class="muted" style="font-size:15px">${DAY_LONG[day]}, ${dateOf(day)}. Oktober · belegt ${fmtH(c.used)} von ${fmtH(CAPACITY_MIN)}${c.over ? ' · <b style="color:var(--danger)">schon überladen</b>' : ''}</p>
      ${candidates.length ? `<ul class="rows" style="margin-top:8px">${candidates.map(t => `<li class="row"><span class="check-pad"></span><div class="main"><div class="text">${esc(t.text)}</div><div class="meta">${projChip(t.project)}<span class="tag">${AREAS.find(a => a.id === t.area).name}</span>${dueTag(t)}${estTag(t)}</div></div><div class="side"><button type="button" class="btn sm primary" data-action="plan" data-day="${day}" data-id="${t.id}" data-close="1">Einplanen</button></div></li>`).join('')}</ul>` : '<p class="empty">Nichts Offenes in der Matrix.</p>'}`;
    openSheet('Aus der Matrix einplanen', body, { id: 'plan' });
  }

  // ===== Tagesabschluss =====
  function viewClose() {
    const openToday = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t)));
    const dec = state.closeDecisions;
    const section = (title, meta, inner) => `<section class="card"><div class="card-head"><div class="card-title">${title}</div><div class="card-meta">${meta}</div></div>${inner}</section>`;
    const tasksInner = openToday.length ? openToday.map(t => `
      <div class="close-row"><div class="t"><span>${esc(t.text)}</span>${projChip(t.project)}${t.rolls >= 2 ? `<span class="tag warn">${t.rolls}× verschoben</span>` : ''}</div>
        <div class="decide" role="group" aria-label="Entscheidung">${[['tomorrow', 'Morgen'], ['week', 'Woche ▾'], ['matrix', 'Matrix'], ['done', 'Erledigt'], ['delete', 'Löschen']].map(([k, l]) => `<button type="button" class="${k === 'delete' ? 'danger' : ''}" data-action="decide" data-kind="${k}" data-id="${t.id}" aria-pressed="${dec[t.id] && dec[t.id].kind === k}">${l}</button>`).join('')}</div>
        ${dec[t.id] && dec[t.id].kind === 'week' ? `<div class="picker"><span class="lbl">Welcher Tag?</span>${[3, 4, 5, 6].map(d => `<button type="button" class="btn sm" data-action="decide" data-kind="week" data-day="${d}" data-id="${t.id}" ${dec[t.id].day === d ? 'style="outline:1.5px solid var(--accent)"' : ''}>${DAYS[d]} ${dateOf(d)}.</button>`).join('')}</div>` : ''}
      </div>`).join('') : '<p class="empty">Alles erledigt – nur noch Habits und ein Satz.</p>';
    const inboxInner = state.inbox.length ? `<p style="font-size:15px">${state.inbox.length} unsortiert.</p><div class="actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="#inbox">Jetzt sortieren</a><span class="muted small" style="align-self:center">oder morgen – nichts geht verloren</span></div>` : '<p class="empty">Leer.</p>';
    const habitsInner = `<div class="habit-chips">${state.habits.map(h => `<button type="button" class="habit" aria-pressed="${h.week[TODAY]}" data-action="habit" data-id="${h.id}"><span class="dot"></span>${esc(h.name)}</button>`).join('')}</div>`;
    const sentenceInner = `<textarea class="sentence" id="sentence" data-action="sentence" placeholder="Was war heute wichtig?">${esc(state.sentence)}</textarea>`;
    const decided = Object.keys(dec).length;
    const finish = `<button type="button" class="btn primary block" data-action="finish-close" ${openToday.length && decided < openToday.length ? 'disabled' : ''}>Tag abschließen${openToday.length && decided < openToday.length ? ` · ${openToday.length - decided} Entscheidung${openToday.length - decided === 1 ? '' : 'en'} offen` : ''}</button>`;
    const summary = state.closed ? `<section class="card"><div class="summary"><div>Tag abgeschlossen.</div><div class="small" style="font-weight:500;color:var(--fg)">${esc(state.closed)}</div></div><div class="actions" style="margin-top:12px"><a class="btn" href="#home">Zur Startseite</a><a class="btn quiet" href="#review">Wochenrückblick ›</a></div></section>` : '';
    const head = `<div class="view-head"><div><h1 class="view-title">Tagesabschluss</h1><p class="view-sub">${DAY_LONG[TODAY]}, ${dateOf(TODAY)}. Oktober · ${state.evening ? '18:30' : 'Demo: gedacht für den Abend'}</p></div></div>`;
    if (state.closed) return `<div class="narrow">${head}${summary}</div>`;
    if (state.variants.close === 'steps') {
      const steps = [
        ['Offen heute', `${openToday.length} · je eine Entscheidung`, tasksInner],
        ['Inbox', `${state.inbox.length} unsortiert`, inboxInner],
        ['Habits heute', `${state.habits.filter(h => h.week[TODAY]).length} von ${state.habits.length}`, habitsInner],
        ['Ein Satz zum Tag', 'optional', sentenceInner]
      ];
      const i = Math.min(state.closeStep, 3);
      const s = steps[i];
      return `<div class="narrow">${head}<div class="steps-dots" aria-hidden="true">${steps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>${section(s[0], s[1], s[2])}
        <div class="actions" style="display:flex;gap:8px;margin-top:16px">${i > 0 ? '<button type="button" class="btn" data-action="close-step" data-dir="-1">Zurück</button>' : ''}${i < 3 ? `<button type="button" class="btn primary" data-action="close-step" data-dir="1" ${i === 0 && openToday.length && decided < openToday.length ? 'disabled' : ''}>Weiter</button>` : finish}</div></div>`;
    }
    return `<div class="narrow">${head}<div class="col">${section('Offen heute', `${openToday.length} · je eine Entscheidung`, tasksInner)}${section('Inbox', `${state.inbox.length}`, inboxInner)}${section('Habits heute', `${state.habits.filter(h => h.week[TODAY]).length} von ${state.habits.length}`, habitsInner)}${section('Ein Satz zum Tag', 'optional', sentenceInner)}${finish}</div></div>`;
  }

  // ===== Wochenrückblick =====
  function viewReview() {
    const w = weeklyNumbers();
    const maxPlanned = Math.max(1, ...w.perProject.map(p => p.planned));
    const maxFocus = Math.max(1, ...w.perProject.map(p => p.focusMin));
    const histLabels = ['W39', 'W40', 'W41', 'W42'];
    const habitHist = [0, 1, 2].map(i => Math.round(state.habits.reduce((s, h) => s + h.history[i], 0) / state.habits.length)).concat([w.habitQuota]);
    const weekSoll = state.steps.target * (TODAY + 1);
    return `
      <div class="view-head"><div><h1 class="view-title">Wochenrückblick</h1><p class="view-sub">Woche 42 · 12.–18. Oktober · Stand ${DAY_LONG[TODAY]} (Demo)</p></div><div class="view-actions"><a class="btn primary" href="#week" data-action="plan-next">Nächste Woche planen</a></div></div>
      <div class="stat-grid">
        <section class="card"><div class="card-head"><div class="card-title">Geplant und erledigt</div><div class="card-meta">je Projekt</div></div>
          <div class="bars">${w.perProject.map(p => `<div class="barrow"><span class="proj full" data-project="${p.id}">${esc(p.name)}</span><div class="track"><i style="width:${Math.round(100 * p.done / maxPlanned)}%"></i><i class="plan" style="width:${Math.round(100 * (p.planned - p.done) / maxPlanned)}%"></i></div><span class="v">${p.done} von ${p.planned}</span></div>`).join('')}</div>
          <p class="small muted" style="margin-top:10px">Gefüllt = erledigt, hell = noch offen. Nur Aufgaben, die diese Woche eingeplant waren.</p>
        </section>
        <section class="card"><div class="card-head"><div class="card-title">Mehrfach verschoben</div><div class="card-meta">${w.rolled.length}</div></div>
          ${w.rolled.length ? `<ul class="rows">${w.rolled.map(t => taskRow(t, { est: false })).join('')}</ul><p class="small muted" style="margin-top:8px">Antippen und entscheiden: Termin, Matrix oder löschen. Kein Urteil, nur die Zahl.</p>` : '<p class="empty">Nichts wandert seit zwei Tagen mit.</p>'}
        </section>
        <section class="card"><div class="card-head"><div class="card-title">Habits</div><div class="card-meta">Quote je Woche</div></div>
          <div class="spark" aria-label="Habit-Quote der letzten vier Wochen">${habitHist.map((v, i) => `<i class="${i === 3 ? 'cur' : ''}" style="height:${Math.max(6, v)}%"><span class="num">${v} %</span></i>`).join('')}</div>
          <div class="spark-labels">${histLabels.map(l => `<span>${l}</span>`).join('')}</div>
          <div class="chips" style="margin-top:12px">${state.habits.map(h => `<span class="chip" style="min-height:28px;font-size:13px">${esc(h.name)} <span class="count">${h.week.slice(0, TODAY + 1).filter(Boolean).length}/${TODAY + 1}</span></span>`).join('')}</div>
        </section>
        <section class="card"><div class="card-head"><div class="card-title">Fokuszeit</div><div class="card-meta">${fmtH(w.focusTotal)} · ${state.focus.length} Sessions</div></div>
          <div class="bars">${w.perProject.map(p => `<div class="barrow"><span class="proj full" data-project="${p.id}">${esc(p.name)}</span><div class="track"><i style="width:${Math.round(100 * p.focusMin / maxFocus)}%"></i></div><span class="v">${p.focusMin} min</span></div>`).join('')}</div>
          <p class="small muted" style="margin-top:10px">Aus Fokus-Sessions, die an Aufgaben hängen – ohne Stoppuhr.</p>
        </section>
        <section class="card"><div class="card-head"><div class="card-title">Schritte</div><div class="card-meta">Jahr ${state.steps.yearPct} %</div></div>
          <div class="steps-line"><div class="nums num"><span><b>${fmtNum(state.steps.weekSoFar)}</b> bis ${DAYS[TODAY]}</span><span class="muted">Soll ${fmtNum(weekSoll)}</span></div><div class="meter"><i style="width:${Math.min(100, Math.round(100 * state.steps.weekSoFar / weekSoll))}%"></i></div><div class="small muted">Tagesziel ${fmtNum(state.steps.target)} · ${fmtNum(state.steps.yearDone)} von ${fmtNum(state.steps.yearGoal)} im Jahr</div></div>
        </section>
        <section class="card"><div class="card-head"><div class="card-title">Sätze der Woche</div><div class="card-meta">aus den Tagesabschlüssen</div></div>
          <ul class="rows">${state.notes.map(n => `<li class="row"><span class="check-pad" style="width:auto;font-weight:700;font-size:13px;color:var(--fg-2)">${DAYS[n.day]}</span><div class="main"><div class="text" style="font-size:15px">${esc(n.text)}</div></div></li>`).join('')}</ul>
          <div class="field"><label for="reviewText">Rückblick</label><textarea id="reviewText" placeholder="Was hat funktioniert, was nicht?"></textarea></div>
        </section>
      </div>`;
  }

  // ===== iOS-Konzepte (statische Mockups) =====
  function viewIOS() {
    const ns = nextStep();
    const nsText = ns.task ? esc(ns.task.text) : 'Alles erledigt';
    const phone = (inner, cls) => `<div class="phone ${cls || ''}"><div class="wall"></div>${inner}</div>`;
    const concepts = [
      {
        title: 'Home-Bildschirm-Widgets', tag: 'nativ', why: 'Der Blick ohne Öffnen: nächster Schritt, Termine, Schritte. Die Web-App kann keine Widgets.',
        html: phone(`<div class="island"></div><div class="screen"><div class="widgets">
          <div class="widget"><div class="wl">Nächster Schritt</div><div class="wt">${nsText}</div><div class="wm">${ns.task ? esc(ns.why) : ''}</div></div>
          <div class="widget"><div class="wl">Schritte</div><div class="ring"><b class="num">52 %</b></div><div class="wm" style="text-align:center">${fmtNum(state.steps.today)} von ${fmtNum(state.steps.target)}</div></div>
          <div class="widget medium"><div class="wl">Heute</div>${eventsOf(TODAY).slice(0, 2).map(e => `<div class="wrow"><span>${e.start} ${esc(e.title)}</span><span style="opacity:.7">Termin</span></div>`).join('')}${todayTasks().slice(0, 2).map(t => `<div class="wrow"><span>○ ${esc(t.text)}</span><span style="opacity:.7">${proj(t.project) ? proj(t.project).short : ''}</span></div>`).join('')}</div>
        </div></div>`)
      },
      {
        title: 'Sperrbildschirm', tag: 'nativ', why: 'Unter der Uhr: der nächste Schritt und die Schritte-Pace, ohne zu entsperren.',
        html: phone(`<div class="island"></div><div class="screen"><div class="clock"><div class="date">${DAY_LONG[TODAY]}, ${dateOf(TODAY)}. Oktober</div><div class="time num">09:41</div></div><div class="lock-widgets"><div class="lw"><span>Nächster Schritt</span><b>${ns.task ? esc(ns.task.text.slice(0, 26)) + (ns.task.text.length > 26 ? '…' : '') : '–'}</b></div><div class="lw"><span>Schritte</span><b class="num">${fmtNum(state.steps.today)} · 52 %</b></div></div><div class="lock-inline">${eventsOf(TODAY).length} Termine · ${todayTasks().length} Aufgaben offen</div></div>`)
      },
      {
        title: 'Siri und Action Button', tag: 'beide', why: 'Heute per Kurzbefehl und Edge Function machbar, in der App als App Intent. Diktieren, fertig – die Inbox sortiert später.',
        html: phone(`<div class="island"></div><div class="screen"><div class="clock"><div class="time num" style="font-size:40px">09:41</div></div></div><div class="siri"><div style="display:flex;gap:10px;align-items:center"><div class="orb"></div><div class="q">„Dali, notieren: Zement für Abschnitt 3 nachbestellen“</div></div><div class="a"><span>In der Inbox gespeichert</span><span class="proj">Projekt später zuordnen · 1 Tipp</span></div></div>`)
      },
      {
        title: 'Fokus-Timer mit Live Activity', tag: 'nativ', why: 'Der Timer läuft in der Dynamic Island weiter; die Session hängt an der Aufgabe und zählt für das Projekt.',
        html: phone(`<div class="island wide"><span class="dotp"></span><span>Fokus · 18:42</span><span style="opacity:.7">Radl</span></div><div class="focus-screen"><div class="ring-big"><b class="num">18:42</b></div><div class="ft">${nsText}</div><div class="fm">Session 2 von 4 · ${ns.task && proj(ns.task.project) ? esc(proj(ns.task.project).name) : ''}</div><div style="display:flex;gap:10px;margin-top:6px"><span class="tag" style="background:rgba(255,255,255,.14);color:#fff">Pause</span><span class="tag" style="background:rgba(255,255,255,.14);color:#fff">Beenden</span></div></div>`)
      },
      {
        title: 'Teilen-Menü in die Inbox', tag: 'beide', why: 'Ein Link aus Safari oder Mail landet in der Inbox. Per Kurzbefehl schon heute, nativ als Share Extension.',
        html: phone(`<div class="island"></div><div class="screen"><div class="clock"><div class="time num" style="font-size:40px">09:41</div></div></div><div class="share"><div style="font-size:13px;opacity:.8">Link aus Safari teilen</div><div class="apps"><div class="app-icon mine"><i>d.</i><span>Inbox</span></div><div class="app-icon"><i>✉︎</i><span>Mail</span></div><div class="app-icon"><i>✎</i><span>Notizen</span></div><div class="app-icon"><i>…</i><span>Mehr</span></div></div></div>`)
      },
      {
        title: 'Home auf dem iPhone', tag: 'beide', why: 'Dieselbe Startseite wie im Web – nativ nur schneller, mit Haptik und ohne Safari-Leiste. Im Prototyp: oben „iPhone“ wählen.',
        html: phone(`<div class="island"></div><div class="screen" style="gap:8px"><div style="font:600 24px/1.1 var(--font-display)">Guten Morgen, Dali.</div><div style="font-size:12px;opacity:.75">${DAY_LONG[TODAY]}, ${dateOf(TODAY)}. Oktober · 09:41</div><div class="widget" style="min-height:0;border:1.5px solid #8c96ff"><div class="wl">Nächster Schritt</div><div class="wt">${nsText}</div><div class="wm">${ns.task ? esc(ns.why) : ''}</div><div style="display:flex;gap:6px;margin-top:6px"><span class="tag" style="background:#6155f5;color:#fff">Fokus starten</span><span class="tag" style="background:rgba(255,255,255,.14);color:#fff">Erledigt</span></div></div><div class="widget" style="min-height:0"><div class="wl">Heute</div><div class="wm">3 Termine · 3,5 h · 4 Aufgaben · frei ≈ 0,5 h</div></div></div>`)
      }
    ];
    return `
      <div class="view-head"><div><h1 class="view-title">Native iOS-Konzepte</h1><p class="view-sub">Statische Entwürfe, keine Implementierung. <span class="tag native">nativ</span> = nur mit der iOS-App sinnvoll, <span class="tag">beide</span> = Web und iOS.</p></div></div>
      <div class="ios-grid">${concepts.map(c => `<div class="concept"><div class="ch"><h3>${c.title}</h3><span class="tag ${c.tag === 'nativ' ? 'native' : ''}">${c.tag}</span></div>${c.html}<p class="why">${c.why}</p></div>`).join('')}</div>`;
  }

  // ===== Sheets, Toasts, Panel =====
  function openSheet(title, body, meta) {
    closeSheet();
    const layer = $('#layer');
    layer.insertAdjacentHTML('beforeend', `<div class="backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-sheet="${meta && meta.id || ''}" data-task="${meta && meta.taskId || ''}"><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="x" aria-label="Schließen" data-action="close-sheet">✕</button></div><div class="sheet-body">${body}</div></div>`);
  }
  function closeSheet() {
    $$('#layer .backdrop, #layer .sheet').forEach(n => n.remove());
    if (ui.focusTimer) { clearInterval(ui.focusTimer); ui.focusTimer = null; }
  }
  function refreshSheet() {
    const s = $('#layer .sheet');
    if (!s) return;
    if (s.dataset.sheet === 'detail') detailSheet(s.dataset.task);
  }
  let toastTimer = 0;
  function toast(msg) {
    let t = $('#layer .toast');
    if (!t) { $('#layer').insertAdjacentHTML('beforeend', '<div class="toast" role="status"></div>'); t = $('#layer .toast'); }
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2600);
  }
  function openPanel() {
    closePanel();
    const v = state.variants;
    const opt = (key, label, options, help) => `<div class="opt"><h3>${label}</h3><div class="seg">${options.map(([val, l]) => `<button type="button" data-action="variant" data-key="${key}" data-val="${val}" aria-pressed="${v[key] === val}">${l}</button>`).join('')}</div><p>${help}</p></div>`;
    $('#layer').insertAdjacentHTML('beforeend', `<div class="backdrop" data-action="close-panel"></div><aside class="panel" role="dialog" aria-label="Varianten und Einstellungen">
      <div class="sheet-head"><h2>Varianten</h2><button type="button" class="x" aria-label="Schließen" data-action="close-panel">✕</button></div>
      ${opt('home', 'Home', [['tasks', 'Aufgaben-Fokus'], ['plan', 'Tagesplanung']], 'Aufgaben-Fokus: Liste der heutigen Aufgaben vorn. Tagesplanung: Zeitleiste mit Terminen und Zeitblöcken vorn.')}
      ${opt('projects', 'Projekte', [['chips', 'Chips'], ['cards', 'Karten']], 'Chips: eine Zeile mit Zählern. Karten: je Projekt eine Kachel mit offen, überfällig, wartet.')}
      ${opt('day', 'Tagesansicht (Desktop)', [['linear', 'Linear'], ['two', 'Zwei Spalten']], 'Linear: Zeitleiste, darunter Aufgaben ohne Uhrzeit. Zwei Spalten: beides nebeneinander.')}
      ${opt('close', 'Tagesabschluss', [['compact', 'Kompakt'], ['steps', 'Schrittweise']], 'Kompakt: alles auf einer Seite. Schrittweise: vier Schritte mit Weiter.')}
      <div class="opt"><h3>Demo-Zeit</h3><div class="seg"><button type="button" data-action="evening" data-val="0" aria-pressed="${!state.evening}">09:40</button><button type="button" data-action="evening" data-val="1" aria-pressed="${state.evening}">18:30 (Abend)</button></div><p>Ab 18 Uhr rückt Home den Tagesabschluss nach oben.</p></div>
      <div class="opt"><h3>Erscheinungsbild</h3><div class="seg"><button type="button" data-action="theme" data-val="" aria-pressed="${!document.documentElement.dataset.theme}">System</button><button type="button" data-action="theme" data-val="light" aria-pressed="${document.documentElement.dataset.theme === 'light'}">Hell</button><button type="button" data-action="theme" data-val="dark" aria-pressed="${document.documentElement.dataset.theme === 'dark'}">Dunkel</button></div></div>
      <div class="opt"><h3>Beispieldaten</h3><button type="button" class="btn" data-action="reset">Zurücksetzen</button><p>Änderungen bleiben nur in diesem Browser (localStorage) und gehen nirgendwohin.</p></div>
    </aside>`);
  }
  function closePanel() { $$('#layer .backdrop, #layer .panel').forEach(n => n.remove()); }
  function moreSheet() {
    openSheet('Mehr', `<ul class="rows">${[['close', 'Tagesabschluss', 'Entscheidungen für offene Aufgaben, Habits, ein Satz'], ['review', 'Wochenrückblick', 'Fünf Zahlen, keine Scores'], ['ios', 'iOS-Konzepte', 'Widgets, Sperrbildschirm, Siri, Fokus-Timer']].map(([id, l, s]) => `<li class="row clickable" data-action="goto" data-view="${id}"><span class="check-pad"></span><div class="main"><div class="text">${l}</div><div class="meta">${s}</div></div></li>`).join('')}<li class="row clickable" data-action="open-workflows"><span class="check-pad"></span><div class="main"><div class="text">Workflows</div><div class="meta">Drei Abläufe Schritt für Schritt</div></div></li><li class="row clickable" data-action="open-panel"><span class="check-pad"></span><div class="main"><div class="text">Varianten</div><div class="meta">Layouts vergleichen, Demo-Zeit, Erscheinungsbild</div></div></li></ul>`);
  }

  // ===== Fokus-Session (simuliert) =====
  function focusSheet(id) {
    const t = task(id);
    if (!t) return;
    ui.focusLeft = 25 * 60;
    openSheet('Fokus', `<div style="text-align:center;display:grid;gap:10px;justify-items:center;padding:8px 0 4px"><div class="focus-ring" style="width:160px;height:160px;border-radius:50%;background:conic-gradient(var(--accent) 0 0%,var(--surface-2) 0 100%);display:grid;place-items:center"><b class="num" id="focusTime" style="width:140px;height:140px;border-radius:50%;background:var(--surface);display:grid;place-items:center;font:600 40px/1 var(--font-display)">25:00</b></div><div style="font-weight:600;font-size:17px">${esc(t.text)}</div><div class="muted small">${projChip(t.project, true)} · Session wird dieser Aufgabe und dem Projekt zugeschrieben</div></div><div class="actions"><button type="button" class="btn primary" data-action="focus-done" data-id="${t.id}">Session beenden · 25 min gutschreiben (Demo)</button><button type="button" class="btn" data-action="close-sheet">Abbrechen</button></div>`, { id: 'focus' });
    ui.focusTimer = setInterval(() => {
      ui.focusLeft = Math.max(0, ui.focusLeft - 1);
      const el = $('#focusTime');
      if (!el) { clearInterval(ui.focusTimer); ui.focusTimer = null; return; }
      el.textContent = fromMin(Math.floor(ui.focusLeft / 60)).slice(3) === '' ? '' : `${String(Math.floor(ui.focusLeft / 60)).padStart(2, '0')}:${String(ui.focusLeft % 60).padStart(2, '0')}`;
      const ring = $('.focus-ring');
      if (ring) ring.style.background = `conic-gradient(var(--accent) 0 ${Math.round(100 * (1 - ui.focusLeft / 1500))}%, var(--surface-2) 0 100%)`;
    }, 1000);
  }

  // ===== Aktionen =====
  function addInbox(text, project, via) {
    const item = { id: `i${Date.now()}`, text, project: project || null, when: state.evening ? 'heute 18:31' : 'heute 09:41', via: via || 'app' };
    state.inbox.unshift(item);
    return item;
  }
  function triage(id, kind, extra) {
    const idx = state.inbox.findIndex(i => i.id === id);
    if (idx === -1) return;
    const it = state.inbox[idx];
    const base = { id: state.nextId++, text: it.text, project: it.project, area: 'todo', due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: null, note: '' };
    let msg = '';
    if (kind === 'today') { base.planned = TODAY; state.tasks.push(base); msg = `→ Heute${it.project ? ` · ${proj(it.project).name}` : ''}`; }
    else if (kind === 'week') { base.planned = Number(extra.day); state.tasks.push(base); msg = `→ ${dayLabel(base.planned)}`; }
    else if (kind === 'matrix') { base.area = extra.area; state.tasks.push(base); msg = `→ Matrix · ${AREAS.find(a => a.id === extra.area).name}${it.project ? ` · ${proj(it.project).name}` : ''}`; }
    else if (kind === 'event') { state.events.push({ id: `e${Date.now()}`, title: it.text, day: TODAY, start: '16:00', end: '16:30', cal: 'work' }); msg = '→ Termin heute 16:00 (Demo: Uhrzeit im Editor wählbar)'; }
    else if (kind === 'list') { state.lists[extra.list] = (state.lists[extra.list] || 0) + 1; msg = `→ Liste ${extra.list}`; }
    else if (kind === 'delete') { msg = 'Gelöscht'; }
    state.inbox.splice(idx, 1);
    ui.picker = null;
    toast(msg);
    render();
    return base.id;
  }

  function act(action, el) {
    const d = el.dataset;
    const id = d.id;
    switch (action) {
      case 'filter': state.filter = d.project || null; render(); break;
      case 'area': state.area = d.area; render(); break;
      case 'toggle': { const t = task(id); if (t) { t.done = !t.done; toast(t.done ? 'Erledigt' : 'Wieder offen'); } closeSheet(); render(); break; }
      case 'detail': detailSheet(id); break;
      case 'habit': { const h = state.habits.find(x => x.id === id); if (h) h.week[TODAY] = !h.week[TODAY]; render(); break; }
      case 'focus': focusSheet(id); break;
      case 'focus-done': { const t = task(id); if (t) { state.focus.push({ task: t.id, project: t.project, min: 25, day: TODAY }); toast(`25 min · ${t.project ? proj(t.project).name : 'ohne Projekt'}`); } closeSheet(); render(); break; }
      case 'close-sheet': closeSheet(); break;
      case 'close-panel': closePanel(); break;
      case 'open-panel': closeSheet(); openPanel(); break;
      case 'open-workflows': closeSheet(); closePanel(); workflowsSheet(); break;
      case 'more': moreSheet(); break;
      case 'goto': closeSheet(); location.hash = d.view; break;
      case 'variant': state.variants[d.key] = d.val; closePanel(); openPanel(); render(); break;
      case 'evening': state.evening = d.val === '1'; closePanel(); openPanel(); render(); break;
      case 'theme': if (d.val) document.documentElement.dataset.theme = d.val; else delete document.documentElement.dataset.theme; try { localStorage.setItem(STORE_KEY + '-theme', d.val); } catch (e) { /* egal */ } closePanel(); openPanel(); break;
      case 'reset': closePanel(); reset(); break;
      case 'capture-project': { const pressed = el.getAttribute('aria-pressed') === 'true'; $$('#captureCard [data-action="capture-project"]').forEach(b => b.setAttribute('aria-pressed', 'false')); if (!pressed) el.setAttribute('aria-pressed', 'true'); break; }
      case 'shortcut-demo': addInbox('Nachunternehmer Elektrik anrufen wegen Zeitplan', 'ra', 'shortcut'); toast('Per Kurzbefehl diktiert (Demo) → Inbox'); render(); break;
      case 'inbox-project': { const it = state.inbox.find(i => i.id === id); if (it) it.project = it.project === d.project ? null : d.project; render(); break; }
      case 'pick': ui.picker = (ui.picker && ui.picker.id === id && ui.picker.kind === d.kind) ? null : { id, kind: d.kind }; render(); break;
      case 'triage': triage(id, d.kind, { day: d.day, area: d.area, list: d.list }); break;
      case 'set-project': { const t = task(id); if (t) t.project = t.project === d.project ? null : d.project; refreshSheet(); render(); break; }
      case 'set-area': { const t = task(id); if (t) t.area = d.area; refreshSheet(); render(); break; }
      case 'set-due': { const t = task(id); if (t) t.due = d.day === '' ? null : Number(d.day); refreshSheet(); render(); break; }
      case 'set-est': { const t = task(id); if (t) { t.est = d.est === '' ? null : Number(d.est); if (t.block) t.block.end = fromMin(toMin(t.block.start) + (t.est || 30)); } refreshSheet(); render(); break; }
      case 'plan': { const t = task(id); if (t) { t.planned = d.day === '' ? null : Number(d.day); if (t.planned === null) t.block = null; else if (t.block) t.block.day = t.planned; toast(t.planned === null ? 'Nicht mehr eingeplant' : `Eingeplant: ${dayLabel(t.planned)} · ${taskId(t)}`); } if (d.close) closeSheet(); else refreshSheet(); render(); break; }
      case 'block': { const t = task(id); if (t) { t.block = d.start ? { day: t.planned, start: d.start, end: fromMin(toMin(d.start) + (t.est || 30)) } : null; } refreshSheet(); render(); break; }
      case 'edit-text': { const t = task(id); if (t) t.text = el.value.trim() || t.text; render(); break; }
      case 'edit-note': { const t = task(id); if (t) t.note = el.value; save(); break; }
      case 'delete-task': state.tasks = state.tasks.filter(t => t.id !== Number(id)); closeSheet(); toast('Gelöscht'); render(); break;
      case 'show-in-week': { const t = task(id); closeSheet(); state.selectedDay = t.planned; state.weekMode = 'week'; location.hash = 'week'; setTimeout(() => highlight(`.day[data-day="${t.planned}"] [data-id="${t.id}"]`), 80); break; }
      case 'new-task': { const text = ($('#captureInput') || {}).value; const t = { id: state.nextId++, text: 'Neue Aufgabe', project: state.filter, area: d.area, due: null, planned: null, est: null, done: false, rolls: 0, block: null, waiting: null, note: '' }; state.tasks.push(t); render(); detailSheet(t.id); setTimeout(() => { const i = $('#dtText'); if (i) { i.select(); } }, 50); void text; break; }
      case 'week-mode': state.weekMode = d.mode; render(); break;
      case 'select-day': state.selectedDay = Number(d.day); state.weekMode = 'day'; render(); break;
      case 'plan-sheet': planSheet(Number(d.day)); break;
      case 'plan-next': state.weekMode = 'week'; location.hash = 'week'; setTimeout(() => planSheet(3), 60); break;
      case 'decide': { const dec = state.closeDecisions; if (d.kind === 'week' && d.day === undefined) { dec[id] = { kind: 'week', day: null }; } else dec[id] = { kind: d.kind, day: d.day ? Number(d.day) : null }; render(); break; }
      case 'sentence': state.sentence = el.value; save(); break;
      case 'close-step': state.closeStep = Math.max(0, Math.min(3, state.closeStep + Number(d.dir))); render(); break;
      case 'finish-close': finishClose(); break;
      case 'wf-next': wfNext(); break;
      case 'wf-end': wfEnd(); break;
      case 'wf-start': startWorkflow(Number(d.wf)); break;
      default: break;
    }
  }

  function finishClose() {
    const dec = state.closeDecisions;
    const counts = { tomorrow: 0, week: 0, matrix: 0, done: 0, delete: 0 };
    Object.keys(dec).forEach(k => {
      const t = task(k);
      if (!t) return;
      const dcs = dec[k];
      counts[dcs.kind]++;
      if (dcs.kind === 'tomorrow') { t.planned = TODAY + 1; t.rolls++; }
      else if (dcs.kind === 'week') { t.planned = dcs.day === null ? TODAY + 1 : dcs.day; t.rolls++; }
      else if (dcs.kind === 'matrix') { t.planned = null; t.block = null; if (t.area === 'todo') t.area = 'next'; t.rolls++; }
      else if (dcs.kind === 'done') t.done = true;
      else if (dcs.kind === 'delete') state.tasks = state.tasks.filter(x => x.id !== t.id);
    });
    if (state.sentence.trim()) state.notes.push({ day: TODAY, text: state.sentence.trim() });
    const parts = [];
    if (counts.tomorrow) parts.push(`${counts.tomorrow} nach morgen`);
    if (counts.week) parts.push(`${counts.week} in die Woche`);
    if (counts.matrix) parts.push(`${counts.matrix} in die Matrix`);
    if (counts.done) parts.push(`${counts.done} erledigt`);
    if (counts.delete) parts.push(`${counts.delete} gelöscht`);
    state.closed = `${parts.length ? parts.join(', ') : 'Keine offenen Aufgaben'} · ${state.habits.filter(h => h.week[TODAY]).length} von ${state.habits.length} Habits · ${state.inbox.length} in der Inbox${state.sentence.trim() ? ' · Satz gespeichert' : ''}`;
    state.closeDecisions = {};
    state.closeStep = 0;
    state.sentence = '';
    render();
  }

  // ===== Workflows =====
  const WORKFLOWS = [
    {
      title: 'Ein neuer Gedanke', sub: 'Erfassen → Inbox → Projekt → Priorität → Woche',
      steps: [
        { view: 'inbox', text: 'Unterwegs fällt dir ein: „Zement für Abschnitt 3 nachbestellen“. Im Web tippst du es ins Feld, am iPhone sagst du es Siri.', hl: '#captureCard', run() { const i = $('#captureInput'); if (i) { i.value = 'Zement für Abschnitt 3 nachbestellen'; i.focus(); } } },
        { view: 'inbox', text: 'Ein Tipp auf Hinzufügen. Kein Projekt, kein Datum nötig – der Eintrag wartet in der Inbox.', hl: '.inbox-item', run() { const it = addInbox('Zement für Abschnitt 3 nachbestellen', null, 'app'); ui.wfItem = it.id; render(); } },
        { view: 'inbox', text: 'Abends sortierst du: Projekt Radl, dann „Matrix → up next“. Daraus wird eine Aufgabe mit ID.', hl: '[data-area="next"]', run() { const it = state.inbox.find(i => i.id === ui.wfItem) || state.inbox[0]; if (it) { it.project = 'ra'; ui.wfTask = triage(it.id, 'matrix', { area: 'next' }); } location.hash = 'tasks'; } },
        { view: 'tasks', text: 'In der Matrix bekommt sie, was sie braucht: Schätzung 30 min, fällig Freitag. Beides optional.', hl: '.sheet', run() { const t = task(ui.wfTask); if (t) { t.est = 30; t.due = 4; } render(); detailSheet(ui.wfTask); } },
        { view: 'week', text: '„Für Tag einplanen“ → Donnerstag. In der Woche steht dieselbe Aufgabe mit derselben ID – kein zweiter Eintrag.', hl: null, run() { const t = task(ui.wfTask); if (t) t.planned = 3; closeSheet(); state.weekMode = 'week'; location.hash = 'week'; setTimeout(() => highlight(`.day[data-day="3"] [data-id="${ui.wfTask}"]`), 120); } }
      ]
    },
    {
      title: 'Ein produktiver Arbeitstag', sub: 'Home → nächster Schritt → Fokus → erledigt → Überblick',
      steps: [
        { view: 'home', text: 'Home öffnen: der nächste Schritt steht oben – mit dem Grund, warum gerade dieser.', hl: '#nextStep', run() { state.evening = false; location.hash = 'home'; } },
        { view: 'home', text: 'Fokus starten: 25 Minuten für genau diese Aufgabe. Der Timer kennt die Aufgabe und das Projekt.', hl: '.sheet', run() { const ns = nextStep(); if (ns.task) { ui.wfTask = ns.task.id; focusSheet(ns.task.id); } } },
        { view: 'home', text: 'Session beendet (im Prototyp sofort): 25 Minuten werden der Aufgabe und dem Projekt gutgeschrieben.', hl: '#nextStep', run() { const t = task(ui.wfTask); if (t) state.focus.push({ task: t.id, project: t.project, min: 25, day: TODAY }); closeSheet(); render(); toast('25 min gutgeschrieben'); } },
        { view: 'home', text: 'Erledigt – der nächste Schritt rückt nach, nach denselben Regeln.', hl: '#nextStep', run() { const t = task(ui.wfTask); if (t) t.done = true; render(); } },
        { view: 'home', text: 'Der Rest des Tages auf einen Blick: Kapazität, Termine, offene Aufgaben – ohne Scrollen durch sieben Karten.', hl: '#capacityCard', run() { render(); } }
      ]
    },
    {
      title: 'Tages- und Wochenabschluss', sub: 'Offenes entscheiden → Habits → Wochenbericht → nächste Woche',
      steps: [
        { view: 'close', text: '18:30 – Home zeigt „Tag abschließen“. Jede offene Aufgabe des Tages will eine Entscheidung.', hl: '.card', run() { state.evening = true; state.closed = null; state.closeDecisions = {}; location.hash = 'close'; } },
        { view: 'close', text: 'Je Aufgabe ein Tipp: nach morgen, in die Woche, zurück in die Matrix, erledigt oder löschen. Verschiebungen werden gezählt.', hl: '.card', run() { const openToday = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t))); openToday.forEach((t, i) => { state.closeDecisions[t.id] = i === 0 ? { kind: 'tomorrow', day: null } : i === 1 ? { kind: 'matrix', day: null } : { kind: 'done', day: null }; }); render(); } },
        { view: 'close', text: 'Habits abhaken, ein Satz zum Tag, „Tag abschließen“. Zwei Minuten.', hl: '.summary', run() { state.habits.forEach(h => { h.week[TODAY] = true; }); state.sentence = 'Angebot Nord endlich raus, Nachmittag zu voll.'; finishClose(); } },
        { view: 'review', text: 'Sonntag: der Wochenrückblick zeigt fünf Zahlen – geplant/erledigt, verschoben, Habits, Fokuszeit, Schritte. Keine Scores.', hl: '.stat-grid', run() { location.hash = 'review'; } },
        { view: 'week', text: '„Nächste Woche planen“: aus „up next“ auf Tage verteilen, die Kapazität je Tag bleibt sichtbar.', hl: '.sheet', run() { state.weekMode = 'week'; location.hash = 'week'; setTimeout(() => planSheet(3), 120); } }
      ]
    }
  ];
  function workflowsSheet() {
    openSheet('Workflows', `<p class="muted" style="font-size:15px;margin-bottom:10px">Drei Abläufe, Schritt für Schritt. „Weiter“ führt die Aktion aus und zeigt die Stelle.</p><div class="wf-list">${WORKFLOWS.map((w, i) => `<button type="button" data-action="wf-start" data-wf="${i}"><b>${i + 1} · ${w.title}</b><span>${w.sub}</span></button>`).join('')}</div>`);
  }
  function startWorkflow(i) {
    closeSheet();
    ui.wf = i; ui.wfStep = 0;
    runStep();
  }
  function runStep() {
    const wf = WORKFLOWS[ui.wf];
    const st = wf.steps[ui.wfStep];
    if (location.hash.replace('#', '') !== st.view) location.hash = st.view;
    st.run();
    render();
    renderWfBar();
    if (st.hl) setTimeout(() => highlight(st.hl), 150);
  }
  function wfNext() {
    const wf = WORKFLOWS[ui.wf];
    if (ui.wfStep >= wf.steps.length - 1) { wfEnd(); return; }
    ui.wfStep++;
    runStep();
  }
  function wfEnd() { ui.wf = null; ui.wfStep = 0; closeSheet(); renderWfBar(); toast('Workflow beendet'); }
  function renderWfBar() {
    const old = $('#layer .wfbar');
    if (old) old.remove();
    if (ui.wf === null || ui.wf === undefined) return;
    const wf = WORKFLOWS[ui.wf];
    const st = wf.steps[ui.wfStep];
    $('#layer').insertAdjacentHTML('beforeend', `<div class="wfbar" role="status"><span class="step">${ui.wfStep + 1} / ${wf.steps.length}</span><div class="txt"><b>${esc(wf.title)}</b>${esc(st.text)}</div><div class="ctl"><button type="button" data-action="wf-end">Beenden</button><button type="button" class="go" data-action="wf-next">${ui.wfStep >= wf.steps.length - 1 ? 'Fertig' : 'Weiter'}</button></div></div>`);
  }
  function highlight(sel) {
    $$('.wf-highlight').forEach(n => n.classList.remove('wf-highlight'));
    const el = $(sel);
    if (!el) return;
    el.classList.add('wf-highlight');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ===== Ereignisse =====
  document.addEventListener('click', e => {
    const dev = e.target.closest('#deviceSeg button');
    if (dev) { state.device = dev.dataset.device; render(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'capture-form' || action === 'sentence' || action === 'edit-text' || action === 'edit-note') return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#more') e.preventDefault();
    if (el.tagName === 'A' && action === 'plan-next') { e.preventDefault(); }
    // Ein Klick auf das Häkchen darf nicht zugleich die Zeile öffnen
    if (action === 'toggle' || action === 'show-in-week' || action === 'plan' || action === 'pick' || action === 'triage' || action === 'inbox-project') e.stopPropagation();
    act(action, el);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-action="capture-form"]');
    if (!f) return;
    e.preventDefault();
    const input = $('#captureInput');
    const text = (input.value || '').trim();
    if (!text) { input.focus(); return; }
    const p = $('#captureCard [data-action="capture-project"][aria-pressed="true"]');
    addInbox(text, p ? p.dataset.project : null, 'app');
    toast('In der Inbox');
    render();
    const again = $('#captureInput');
    if (again) again.focus();
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-action="edit-text"], [data-action="edit-note"]');
    if (el) act(el.dataset.action, el);
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-action="sentence"], [data-action="edit-note"]');
    if (el) act(el.dataset.action, el);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheet(); closePanel(); }
    if (e.key === 'Enter' && e.target.matches('.row.clickable, .pcard')) act(e.target.dataset.action, e.target);
  });
  window.addEventListener('hashchange', () => { closeSheet(); closePanel(); ui.picker = null; render(); });
  window.addEventListener('resize', () => $('#stage').classList.toggle('phone-frame', state.device === 'phone' && window.innerWidth > 760));

  // Für Screenshots und Tests
  window.Proto = {
    setVariants(v) { Object.keys(v).forEach(k => { if (k === 'evening') state.evening = !!v[k]; else state.variants[k] = v[k]; }); render(); },
    demoAction(name) {
      if (name === 'triage') { ui.picker = { id: state.inbox[0].id, kind: 'matrix' }; render(); }
      if (name === 'detail') detailSheet(2);
      if (name === 'plan') planSheet(3);
      if (name === 'workflow') { startWorkflow(0); }
      if (name === 'focus') focusSheet(nextStep().task.id);
      if (name === 'evening') { state.evening = true; render(); }
      if (name === 'closed') { state.evening = true; const openToday = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t))); openToday.forEach((t, i) => { state.closeDecisions[t.id] = i === 0 ? { kind: 'tomorrow' } : i === 1 ? { kind: 'matrix' } : { kind: 'done' }; }); render(); }
      if (name === 'panel') openPanel();
      if (name === 'more') moreSheet();
      if (name === 'day') { state.weekMode = 'day'; render(); }
      if (name === 'finished') { state.evening = true; const openToday = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t))); openToday.forEach((t, i) => { state.closeDecisions[t.id] = i === 0 ? { kind: 'tomorrow' } : i === 1 ? { kind: 'matrix' } : { kind: 'done' }; }); state.habits.forEach(h => { h.week[TODAY] = true; }); state.sentence = 'Angebot Nord endlich raus, Nachmittag zu voll.'; finishClose(); }
      if (name === 'workflow2') startWorkflow(1);
      if (name === 'workflow3') startWorkflow(2);
    },
    wfNext,
    reset,
    state: () => state
  };

  // ===== Start =====
  try { const th = localStorage.getItem(STORE_KEY + '-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* egal */ }
  if (window.innerWidth <= 760) state.device = 'desktop';
  render();
})();
