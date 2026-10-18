/*
 * Dali's Dashboard – Premium-Prototyp (app.js). Alles ist Simulation: Beispieldaten aus data.js,
 * Zustand im Speicher (optional im localStorage dieses Browsers, eigener Schlüssel), keine
 * Anmeldung, kein Supabase. Vier Ansichten (Heute, Aufgaben, Woche, Eingang), Sheets für
 * Erfassen, Aufgabe, Einordnen, Einplanen und Tagesabschluss. Vorschläge aus den Konzeptberichten
 * sind im Markup mit <span class="prop">Vorschlag</span> gekennzeichnet (abschaltbar).
 */
(function () {
  'use strict';
  const D = window.PremiumData;
  const { TODAY, DAYS, DAY_LONG, CAPACITY_MIN, PROJECTS, AREAS, ESTIMATES } = D;
  const STORE_KEY = 'dali-premium-prototype-v1';

  let state = load() || D.seed();
  const ui = { mode: 'compact', sheet: null, lists: { einkauf: true, lesen: false }, decisions: {}, sentence: '', stress: false };

  // ===== Speicher (nur dieser Browser) =====
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); const s = raw && JSON.parse(raw); return s && Array.isArray(s.tasks) ? s : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ohne Speicher geht es auch */ } }
  function pref(key, val) {
    try { if (val === null || val === undefined || val === '') localStorage.removeItem(STORE_KEY + ':' + key); else localStorage.setItem(STORE_KEY + ':' + key, String(val)); } catch (e) { /* egal */ }
  }
  function getPref(key) { try { return localStorage.getItem(STORE_KEY + ':' + key); } catch (e) { return null; } }

  // ===== Helfer =====
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const proj = id => PROJECTS.find(p => p.id === id) || null;
  const area = id => AREAS.find(a => a.id === id) || AREAS[0];
  const task = id => state.tasks.find(t => t.id === Number(id));
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const nowMin = () => (state.evening ? toMin('18:30') : toMin('09:40'));
  const nowText = () => (state.evening ? '18:30' : '09:40');
  const fmtH = min => `${String(Math.round(min / 30) / 2).replace('.', ',')}\u00a0h`;
  const fmtNum = n => new Intl.NumberFormat('de-DE').format(n);
  const dateOf = i => 12 + i;
  const dayShort = i => `${DAYS[((i % 7) + 7) % 7]} ${dateOf(i)}.`;
  const open = t => !t.done;
  const overdue = t => !t.done && t.due !== null && t.due !== undefined && t.due < TODAY;
  const inFilter = t => !state.filter || t.project === state.filter;
  const hasDay = v => v !== null && v !== undefined;

  // ===== Abgeleitete Daten =====
  function eventsOf(day) { return state.events.filter(e => e.day === day).sort((a, b) => toMin(a.start) - toMin(b.start)); }
  function tasksOf(day) { return state.tasks.filter(t => t.planned === day && inFilter(t)); }
  function todayTasks() {
    return state.tasks.filter(t => open(t) && inFilter(t) && (overdue(t) || t.due === TODAY || t.planned === TODAY)).sort((a, b) => {
      const ra = overdue(a) ? 0 : (a.due === TODAY ? 1 : 2);
      const rb = overdue(b) ? 0 : (b.due === TODAY ? 1 : 2);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return (b.rolls - a.rolls) || (a.due - b.due);
      return (b.est || 0) - (a.est || 0);
    });
  }
  // Vorschlag A1: eine feste, nachvollziehbare Regel
  function nextStep() {
    const list = todayTasks();
    if (!list.length) {
      const ev = eventsOf(TODAY).find(e => toMin(e.start) > nowMin());
      return ev ? { task: null, event: ev, why: `Nächster Termin um ${ev.start}` } : { task: null, why: 'Nichts offen für heute.' };
    }
    const t = list[0];
    const why = overdue(t) ? `Überfällig seit ${dayShort(t.due)}${t.rolls >= 2 ? ` · ${t.rolls}× verschoben` : ''}` : (t.due === TODAY ? 'Fällig heute' : 'Heute eingeplant');
    return { task: t, why: why + (t.est ? ` · ${t.est} min` : '') };
  }
  // Vorschlag C1/A4: Kapazität aus Terminen und groben Schätzungen
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
    return PROJECTS.map(p => { const ts = state.tasks.filter(t => t.project === p.id); return { ...p, open: ts.filter(open).length, over: ts.filter(overdue).length }; });
  }
  function inboxCount() { return state.inbox.length; }

  // ===== Symbole (Linien, 1,75 px) =====
  const I = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5l1.8 1.8L9.5 4.5M4 12.5l1.8 1.8 3.7-3.8M4 18.5l1.8 1.8 3.7-3.8M13 6.5h7M13 12.5h7M13 18.5h7"/></svg>',
    week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M9 4.5v16M15 4.5v16"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v13H4z"/><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/></svg>'
  };

  const NAV = [
    { id: 'home', label: 'Heute', icon: 'today' },
    { id: 'tasks', label: 'Aufgaben', icon: 'tasks' },
    { id: 'week', label: 'Woche', icon: 'week' },
    { id: 'inbox', label: 'Eingang', icon: 'inbox', badge: () => inboxCount(), prop: true }
  ];

  // ===== Bausteine =====
  const prop = code => `<span class="prop" title="Vorschlag aus dem Konzept (${esc(code)}), keine beschlossene Produktänderung">Vorschlag</span>`;
  const projMeta = (id) => { const p = proj(id); return p ? `<span class="proj" data-project="${p.id}">${esc(p.short)}</span>` : ''; };
  function taskMeta(t, opts) {
    const o = opts || {};
    const parts = [];
    if (overdue(t)) parts.push(`<span class="over">überfällig seit ${esc(dayShort(t.due))}</span>`);
    else if (t.due === TODAY && o.day !== TODAY) parts.push('<span class="today">fällig heute</span>');
    else if (hasDay(t.due) && t.due !== o.day && !t.done) parts.push(`<span>fällig ${esc(dayShort(t.due))}</span>`);
    if (t.waiting) parts.push(`<span>wartet auf ${esc(t.waiting.who)} · bis ${esc(dayShort(t.waiting.until))}</span>`);
    if (t.project && !o.noProject) parts.push(projMeta(t.project));
    if (t.est && !o.noEst) parts.push(`<span class="num">${t.est}\u00a0min</span>`);
    if (t.rolls >= 2) parts.push(`<span>${t.rolls}× verschoben</span>`);
    if (hasDay(t.planned) && o.showPlanned && t.planned !== o.day) parts.push(`<span>${esc(dayShort(t.planned))}</span>`);
    return parts.slice(0, 3).join('');
  }
  function taskRow(t, opts) {
    const o = opts || {};
    const meta = taskMeta(t, o);
    return `<li class="row task clickable${t.done ? ' done' : ''}" data-id="${t.id}">
      <div class="lead-col"><button type="button" class="check${o.small ? ' sm' : ''}" role="checkbox" aria-checked="${t.done}" aria-label="${esc(t.text)} erledigt" data-action="toggle" data-id="${t.id}"></button></div>
      <div class="main" data-action="detail" data-id="${t.id}" tabindex="0" role="button"><div class="text">${esc(t.text)}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>
      <div class="side">${o.side || ''}</div>
    </li>`;
  }
  function eventRow(e, opts) {
    const o = opts || {};
    const past = o.today && toMin(e.end) <= nowMin();
    const isNext = o.today && !past && o.nextId === e.id;
    return `<li class="row event${past ? ' past' : ''}${isNext ? ' next-up' : ''}" data-cal="${e.cal}">
      <div class="lead-col"><span class="time"><b>${e.start}</b><span>${e.end}</span></span></div>
      <div class="main"><div class="text">${esc(e.title)}</div>${isNext ? `<div class="meta"><span class="today">in ${toMin(e.start) - nowMin()} min</span></div>` : ''}</div>
      <div class="side"></div>
    </li>`;
  }
  function nowLine() { return `<div class="now-line" aria-hidden="true"><span class="num">${nowText()}</span><i></i></div>`; }
  function capLine(day, opts) {
    const c = capacity(day);
    const o = opts || {};
    const pct = v => `${Math.min(100, Math.round(100 * v / Math.max(CAPACITY_MIN, c.used)))}%`;
    const text = `<span><b>${c.eventCount}</b> Termine · ${fmtH(c.eventsMin)}</span><span> · <b>${c.taskCount}</b> Aufgaben${c.estMin ? ` ≈ ${fmtH(c.estMin)}` : ''}${c.unknown ? ` · ${c.unknown} ohne Schätzung` : ''}</span><span> · ${c.over ? `<span class="over">überladen · ${fmtH(c.used)} von ${fmtH(CAPACITY_MIN)}</span>` : `frei ≈ <b>${fmtH(c.free)}</b>`}</span>`;
    return `<div class="cap" data-proposal="C1"><div>${text}${o.noProp ? '' : prop('C1')}</div><div class="cap-bar${c.over ? ' over' : ''}" aria-hidden="true"><i class="ev" style="width:${pct(c.eventsMin)}"></i><i class="est" style="width:${pct(c.estMin)}"></i>${c.unknown ? `<i class="unk" style="width:${Math.min(20, c.unknown * 5)}%"></i>` : ''}</div></div>`;
  }
  function capMini(day, stacked) {
    const c = capacity(day);
    const over = c.over ? (stacked ? '<span class="over-word">überladen</span>' : 'überladen · ') : '';
    return `<span class="cap-mini${c.over ? ' over' : ''} num">${over}<span class="nowrap">${fmtH(c.used)} / ${fmtH(CAPACITY_MIN)}</span></span>`;
  }
  function filterButton(withProp) {
    const p = proj(state.filter);
    return `<button type="button" class="filter-btn${p ? ' active' : ''}" data-action="filter-sheet" aria-haspopup="dialog">${p ? esc(p.name) : 'Alle Projekte'} ${I.down}${withProp === false ? '' : prop('B1')}</button>`;
  }
  function sectionHead(label, meta, actions) {
    return `<div class="section-head"><span class="label">${label}</span>${meta ? `<span class="section-meta">${meta}</span>` : ''}${actions ? `<span class="section-actions">${actions}</span>` : ''}</div>`;
  }
  function habitsRow() {
    const done = state.habits.filter(h => h.week[TODAY]).length;
    return `${sectionHead('Habits', `${done} von ${state.habits.length} heute`)}<div class="habits">${state.habits.map(h => `<button type="button" class="habit" aria-pressed="${h.week[TODAY]}" data-action="habit" data-id="${h.id}"><span class="check" aria-checked="${h.week[TODAY]}" aria-hidden="true"></span>${esc(h.name)}</button>`).join('')}</div>`;
  }
  function stepsLine() {
    const s = state.steps;
    return `${sectionHead('Schritte', `Jahr ${s.yearPct} %`)}<div class="steps-line"><div class="nums num"><span><b>${fmtNum(s.today)}</b> von ${fmtNum(s.target)}</span><span class="muted">noch ${fmtNum(Math.max(0, s.target - s.today))}</span></div><div class="meter" aria-hidden="true"><i style="width:${Math.min(100, Math.round(100 * s.today / s.target))}%"></i></div><div class="meta"><span>aus Apple Health per Kurzbefehl</span><span class="prop" style="margin-left:0">Demo-Zahlen</span></div></div>`;
  }
  function weekMini() {
    return `${sectionHead('Diese Woche', 'Mo 12. – So 18.')}<ul class="rows week-mini">${DAYS.map((d, i) => {
      const c = capacity(i); const ts = tasksOf(i).filter(open); const evs = eventsOf(i);
      return `<li class="row clickable" data-action="goto-day" data-day="${i}"><div class="lead-col"><span class="day-key${i === TODAY ? ' today' : ''}">${d}<b class="num">${dateOf(i)}</b></span></div><div class="main" data-action="goto-day" data-day="${i}" tabindex="0" role="button"><div class="text">${evs.length ? `${evs.length} Termin${evs.length === 1 ? '' : 'e'}` : 'keine Termine'}${ts.length ? ` · ${ts.length} Aufgabe${ts.length === 1 ? '' : 'n'}` : ''}</div><div class="meta">${c.over ? '<span class="over">überladen</span>' : `<span>${fmtH(c.used)} belegt</span>`}</div></div><div class="side">${I.chev.replace('<svg', '<svg width="16" height="16" style="color:var(--ink-3)"')}</div></li>`;
    }).join('')}</ul>`;
  }

  // ===== Ansicht: Heute (Home) =====
  function viewHome() {
    const hour = state.evening ? 18 : 9;
    const greet = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    const ns = nextStep();
    const tasks = todayTasks();
    const evs = eventsOf(TODAY);
    const nextEv = evs.find(e => toMin(e.start) > nowMin());
    const upcoming = evs.filter(e => toMin(e.end) > nowMin());
    const past = evs.length - upcoming.length;
    const openCount = tasks.length;
    const habitsOpen = state.habits.filter(h => !h.week[TODAY]).length;
    const head = `<div class="home-head"><p class="caps"><span>${DAY_LONG[TODAY]}</span><span>${dateOf(TODAY)}. Oktober</span><span class="num">${nowText()}</span><span>12° · leichter Regen<span class="prop">Demo</span></span></p><h1 class="display">${greet}, Dali.</h1></div>`;
    const evening = state.evening && !state.closed ? `<a class="linkrow accent" href="#close" data-action="close-day" data-proposal="C4"><span>Tag abschließen · ${openCount} offen, ${inboxCount()} im Eingang, ${habitsOpen} Habit${habitsOpen === 1 ? '' : 's'}${prop('C4')}</span><span class="go">Zwei Minuten ›</span></a>` : '';
    const closed = state.closed ? `<div class="closed-note">Tag abgeschlossen · ${esc(state.closed)}</div>` : '';
    const now = ns.task ? `<section class="now" aria-label="Jetzt" data-proposal="A1">
        <div class="label"><span>Jetzt</span>${prop('A1')}</div>
        <div class="now-task" data-action="detail" data-id="${ns.task.id}" role="button" tabindex="0">${esc(ns.task.text)}</div>
        <div class="now-why">${esc(ns.why)}${ns.task.project ? ` · ${esc(proj(ns.task.project).name)}` : ''}</div>
        <div class="now-actions"><button type="button" class="check" role="checkbox" aria-checked="false" aria-label="Erledigt" data-action="toggle" data-id="${ns.task.id}"></button><button type="button" class="btn btn-sm" data-action="focus" data-id="${ns.task.id}">Fokus 25 min</button><button type="button" class="btn btn-sm btn-quiet" data-action="detail" data-id="${ns.task.id}">Details</button></div>
      </section>` : `<section class="now" aria-label="Jetzt"><div class="label"><span>Jetzt</span>${prop('A1')}</div><div class="now-task">${ns.event ? esc(ns.event.title) : 'Alles erledigt.'}</div><div class="now-why">${esc(ns.why)}</div></section>`;
    const eventsSection = `<section class="section">${sectionHead('Termine', `${evs.length} heute${past ? ` · ${past} vorbei` : ''}`)}${upcoming.length ? `<ul class="rows">${nowLine()}${upcoming.map(e => eventRow(e, { today: true, nextId: nextEv && nextEv.id })).join('')}</ul>` : '<p class="empty">Keine weiteren Termine heute.</p>'}</section>`;
    const rest = tasks.filter(t => !ns.task || t.id !== ns.task.id);
    const tasksSection = `<section class="section">${sectionHead('Aufgaben', `${openCount} offen`, filterButton(false))}${capLine(TODAY)}${rest.length ? `<ul class="rows">${rest.map(t => taskRow(t, { day: TODAY })).join('')}</ul>` : (ns.task ? '<p class="empty">Sonst nichts mehr für heute.</p>' : '<p class="empty">Nichts offen – ein guter Moment für die Aufgaben.</p>')}</section>`;
    const inboxLine = inboxCount() ? `<section class="section"><a class="linkrow" href="#inbox"><span>Eingang · ${inboxCount()} unsortiert${prop('E1')}</span><span class="go">Einordnen ›</span></a></section>` : '';
    const progress = `<section class="section">${stepsLine()}</section><section class="section">${habitsRow()}</section>`;
    const left = `${now}${ui.mode === 'compact' ? eventsSection : ''}${tasksSection}${ui.mode === 'compact' ? inboxLine : ''}`;
    const right = ui.mode === 'compact' ? progress : `${eventsSection}${weekMini()}${inboxLine}${progress}`;
    return `<div class="screen">${head}${closed}${evening}<div class="home-grid"><div class="home-main">${left}</div><aside class="home-aside">${right}</aside></div></div>`;
  }

  // ===== Ansicht: Aufgaben (Matrix + Listen) =====
  function viewTasks() {
    const areaTasks = a => state.tasks.filter(t => t.area === a.id && open(t) && inFilter(t)).sort((x, y) => (overdue(y) - overdue(x)) || ((x.due ?? 99) - (y.due ?? 99)));
    const areaBlock = a => { const ts = areaTasks(a); return `<section class="area" data-area="${a.id}"><div class="area-head"><span class="label">${a.name}</span><span class="count">${ts.length}</span></div>${ts.length ? `<ul class="rows">${ts.map(t => taskRow(t, { showPlanned: true })).join('')}</ul>` : '<p class="empty">Nichts hier.</p>'}<button type="button" class="add" data-action="new-task" data-area="${a.id}">${I.plus} Aufgabe</button></section>`; };
    const doneCount = state.tasks.filter(t => t.done && inFilter(t)).length;
    const head = `<div class="screen-head"><div><h1 class="title">Aufgaben</h1><p class="sub">${state.tasks.filter(open).length} offen · ${doneCount} erledigt diese Woche${prop('B2')}</p></div><div class="head-actions">${filterButton()}</div></div>`;
    let matrix;
    if (ui.mode === 'compact') {
      const seg = `<div class="seg" role="tablist" aria-label="Bereich">${AREAS.map(a => `<button type="button" role="tab" aria-selected="${state.area === a.id}" data-action="area" data-area="${a.id}">${a.name}<span class="count num">${areaTasks(a).length}</span></button>`).join('')}</div>`;
      matrix = `${seg}<div class="areas single">${areaBlock(area(state.area))}</div>`;
    } else {
      matrix = `<div class="areas">${AREAS.map(areaBlock).join('')}</div>`;
    }
    const lists = `<section class="section">${sectionHead('Listen', `${state.lists.length} Listen`)}${state.lists.map(l => {
      const openItems = l.items.filter(i => !i.done).length;
      return `<div class="list-group${ui.lists[l.id] ? ' open' : ''}" data-list="${l.id}"><button type="button" class="list-head" aria-expanded="${!!ui.lists[l.id]}" data-action="toggle-list" data-list="${l.id}"><span>${esc(l.name)}</span><span class="count num">${openItems} offen</span><span class="chev">${I.chev}</span></button><ul class="rows">${l.items.map(i => `<li class="row list-item${i.done ? ' done' : ''}"><div class="lead-col"><button type="button" class="check" role="checkbox" aria-checked="${i.done}" aria-label="${esc(i.text)} erledigt" data-action="toggle-item" data-list="${l.id}" data-id="${i.id}"></button></div><div class="main"><div class="text">${esc(i.text)}</div></div><div class="side"></div></li>`).join('')}</ul></div>`;
    }).join('')}</section>`;
    return `<div class="screen${ui.mode === 'wide' ? '-wide' : ''}">${head}${matrix}${lists}</div>`;
  }

  // ===== Ansicht: Woche =====
  function dayRows(i, opts) {
    const o = opts || {};
    const evs = eventsOf(i);
    const ts = tasksOf(i).sort((a, b) => (a.done - b.done) || (overdue(b) - overdue(a)) || ((b.est || 0) - (a.est || 0)));
    const items = [...evs.map(e => eventRow(e, { today: i === TODAY, nextId: null })), ...ts.map(t => taskRow(t, { day: i, small: o.small, noProject: o.small }))];
    return items.join('');
  }
  function viewWeek() {
    const head = `<div class="screen-head"><div><h1 class="title">Woche 42</h1><p class="sub">12. – 18. Oktober · Kapazität ${fmtH(CAPACITY_MIN)} je Tag${prop('C1')}</p></div><div class="head-actions">${filterButton()}<button type="button" class="btn btn-sm btn-primary" data-action="plan-sheet" data-day="${state.selectedDay}">${I.plus} Einplanen</button></div></div>`;
    if (ui.mode === 'compact') {
      const d = state.selectedDay;
      const strip = `<div class="strip" role="tablist" aria-label="Tag">${DAYS.map((dd, i) => { const c = capacity(i); return `<button type="button" role="tab" class="strip-day${i === TODAY ? ' today' : ''}" aria-current="${state.selectedDay === i ? 'date' : 'false'}" data-action="select-day" data-day="${i}"><span>${dd}</span><b class="dom">${dateOf(i)}</b><span class="dots" aria-hidden="true">${c.over ? '<i class="over"></i>' : ''}${eventsOf(i).length ? '<i></i>' : ''}${tasksOf(i).filter(open).length ? '<i></i>' : ''}</span></button>`; }).join('')}</div>`;
      const rows = dayRows(d);
      const body = `<div class="day-title"><h2 class="title">${DAY_LONG[d]}, ${dateOf(d)}. Oktober</h2>${d === TODAY ? '<span class="caps" style="color:var(--accent)">heute</span>' : ''}</div>${capLine(d)}${rows ? `<ul class="rows">${rows}</ul>` : '<p class="empty">Noch nichts eingeplant.</p>'}<button type="button" class="btn btn-sm btn-quiet" style="margin-top:8px" data-action="plan-sheet" data-day="${d}">${I.plus} Aus den Aufgaben einplanen</button>`;
      return `<div class="screen">${head}${strip}${body}</div>`;
    }
    if (ui.mode === 'medium' || $('#main').clientWidth < 1100) {
      const ledger = `<div class="ledger">${DAYS.map((dd, i) => { const rows = dayRows(i, { small: true }); return `<div class="ledger-row${i === TODAY ? ' today' : ''}"><div class="lead-col"><span class="day-key${i === TODAY ? ' today' : ''}">${dd}<b class="num">${dateOf(i)}</b>${capMini(i, true)}</span></div><div class="ledger-body">${rows ? `<ul class="rows">${rows}</ul>` : '<p class="empty" style="padding-top:6px">–</p>'}<button type="button" class="add" data-action="plan-sheet" data-day="${i}">${I.plus} Aufgabe</button></div></div>`; }).join('')}</div>`;
      return `<div class="screen">${head}${ledger}</div>`;
    }
    const cols = `<div class="week-cols">${DAYS.map((dd, i) => { const rows = dayRows(i, { small: true }); return `<section class="daycol${i === TODAY ? ' today' : ''}" data-day="${i}"><div class="daycol-head"><span class="dow">${dd}</span><span class="dom">${dateOf(i)}.</span><span class="cap-wrap">${capMini(i, true)}</span></div><div class="daycol-body">${rows ? `<ul class="rows">${rows}</ul>` : '<p class="empty">–</p>'}<button type="button" class="add" data-action="plan-sheet" data-day="${i}">${I.plus} Aufgabe</button></div></section>`; }).join('')}</div>`;
    return `<div class="screen-wide">${head}${cols}</div>`;
  }

  // ===== Ansicht: Eingang (Vorschlag E1) =====
  function viewInbox() {
    const items = state.inbox;
    const head = `<div class="screen-head"><div><h1 class="title">Eingang</h1><p class="sub">${items.length ? `${items.length} unsortiert · einordnen, wenn du Zeit hast` : 'Leer – alles hat seinen Platz'}${prop('E1')}</p></div></div>`;
    const capture = `<form class="capture" data-action="capture-form" autocomplete="off"><input type="text" class="input" id="captureInput" placeholder="Was ist dir eingefallen?" aria-label="Neuer Eintrag" enterkeyhint="done"><button type="submit" class="btn btn-primary">Hinzufügen</button></form><div class="capture-hint"><span>Nur Text. Projekt und Tag kommen beim Einordnen.</span><span>Unterwegs: <button type="button" class="btn-link" data-action="shortcut-demo">per Kurzbefehl diktieren (Demo)</button></span></div>`;
    const list = items.length ? `<ul class="rows">${items.map(it => `<li class="row inbox-item" data-inbox="${it.id}"><div class="lead-col"><span class="via" title="${it.via === 'shortcut' ? 'per Kurzbefehl' : 'in der App'}">${it.via === 'shortcut' ? I.mic : I.note}</span></div><div class="main" data-action="triage-sheet" data-id="${it.id}" role="button" tabindex="0" aria-haspopup="dialog"><div class="text">${esc(it.text)}</div><div class="meta"><span>${esc(it.when)}</span>${it.project ? projMeta(it.project) : ''}${it.via === 'shortcut' ? '<span>per Kurzbefehl</span>' : ''}</div></div><div class="side"><button type="button" class="btn btn-sm btn-primary" data-action="triage" data-kind="today" data-id="${it.id}">Heute</button><button type="button" class="btn btn-sm btn-more" data-action="triage-sheet" data-id="${it.id}" aria-haspopup="dialog">Einordnen</button></div></li>`).join('')}</ul>` : '<p class="empty">Nichts zu sortieren. Neue Einträge landen hier – vom „+“, vom Kurzbefehl oder aus dem Teilen-Menü.</p>';
    return `<div class="screen">${head}${capture}<section class="section">${sectionHead('Unsortiert', 'neueste zuerst')}${list}</section></div>`;
  }

  // ===== Rahmen: Navigation =====
  function route() { const h = (location.hash || '#home').replace('#', ''); return NAV.some(n => n.id === h) ? h : 'home'; }
  function navItems(cls) {
    const r = route();
    return NAV.map(n => { const b = n.badge ? n.badge() : 0; return `<a class="${cls}" href="#${n.id}" ${r === n.id ? 'aria-current="page"' : ''} aria-label="${n.label}${b ? `, ${b} unsortiert` : ''}">${I[n.icon]}<span>${n.label}</span>${b ? `<b class="badge num" aria-hidden="true">${b}</b>` : ''}</a>`; }).join('');
  }
  function renderFrame() {
    const r = route();
    const titles = { home: `${DAY_LONG[TODAY]} · ${dateOf(TODAY)}. Oktober`, tasks: 'Aufgaben', week: 'Woche 42', inbox: 'Eingang' };
    $('#topbar').innerHTML = `<div class="topbar-title">${titles[r]}</div><div class="topbar-actions"><button type="button" class="icon-btn" data-action="capture" aria-label="Notieren">${I.plus}</button><button type="button" class="icon-btn" data-action="more" aria-label="Mehr">${I.more}</button></div>`;
    $('#tabbar').innerHTML = navItems('tab');
    $('#rail').innerHTML = `<a class="rail-brand" href="#home"><span class="brand-mark">d.</span><span class="brand-name">Dali’s Dashboard</span></a><button type="button" class="rail-capture" data-action="capture">${I.plus}<span>Notieren</span></button>${navItems('rail-item')}<div class="rail-foot"><button type="button" class="rail-item" data-action="more">${I.more}<span>Mehr</span></button></div>`;
  }
  function modeOf() { const w = $('#app').clientWidth; return w < 600 ? 'compact' : (w < 960 ? 'medium' : 'wide'); }
  function render() {
    ui.mode = modeOf();
    $('#app').dataset.mode = ui.mode;
    renderFrame();
    const views = { home: viewHome, tasks: viewTasks, week: viewWeek, inbox: viewInbox };
    $('#view').innerHTML = views[route()]();
    $('#protoClock').textContent = nowText();
    save();
  }

  // ===== Sheets =====
  function openSheet(title, body, opts) {
    const o = opts || {};
    closeSheet();
    ui.sheet = o.id || 'sheet';
    $('#layer').insertAdjacentHTML('beforeend', `<div class="backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-sheet="${esc(ui.sheet)}" data-ref="${esc(o.ref || '')}"><div class="sheet-head"><h2 class="sheet-title">${title}</h2>${o.headAction || ''}<button type="button" class="sheet-close" data-action="close-sheet">${o.closeLabel || 'Fertig'}</button></div><div class="sheet-body">${body}</div>${o.foot ? `<div class="sheet-foot">${o.foot}</div>` : ''}</div>`);
    if (o.focus) { const f = $(o.focus); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } if (o.select) f.select(); } }
  }
  function closeSheet() { $$('#layer .backdrop, #layer .sheet').forEach(n => n.remove()); ui.sheet = null; }
  function refreshSheet() {
    const s = $('#layer .sheet');
    if (!s) return;
    const scroll = $('.sheet-body', s).scrollTop;
    if (s.dataset.sheet === 'detail') detailSheet(s.dataset.ref);
    else if (s.dataset.sheet === 'close') closeDaySheet();
    else if (s.dataset.sheet === 'plan') planSheet(Number(s.dataset.ref));
    const n = $('#layer .sheet .sheet-body');
    if (n) n.scrollTop = scroll;
  }
  let toastTimer = 0;
  function toast(msg) {
    let t = $('#layer .toast');
    if (!t) { $('#layer').insertAdjacentHTML('beforeend', '<div class="toast" role="status"></div>'); t = $('#layer .toast'); }
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2400);
  }
  const dayChips = (action, id, current, allowNone, noneLabel) => `<div class="chips">${allowNone ? `<button type="button" class="chip" data-action="${action}" data-day="" data-id="${id}" aria-pressed="${!hasDay(current)}">${noneLabel}</button>` : ''}${[2, 3, 4, 5, 6].map(d => `<button type="button" class="chip" data-action="${action}" data-day="${d}" data-id="${id}" aria-pressed="${current === d}">${d === TODAY ? 'Heute' : `${DAYS[d]} ${dateOf(d)}.`}</button>`).join('')}</div>`;

  // Erfassen: ein Feld, Enter = Eingang. „Heute“ ist der kurze Weg (zwei Tipps).
  function captureSheet() {
    openSheet('Notieren', `<form class="capture" id="captureForm" data-action="capture-form" autocomplete="off" style="margin-top:4px"><input type="text" class="input" id="captureInput" placeholder="Was ist dir eingefallen?" aria-label="Neuer Eintrag" enterkeyhint="done"></form><p class="meta" style="margin-top:10px"><span>Enter legt den Eintrag in den Eingang.</span><span>Projekt und Tag kommen beim Einordnen.</span></p>`, {
      id: 'capture', closeLabel: 'Abbrechen', focus: '#captureInput',
      foot: `<button type="button" class="btn btn-primary" data-action="capture-submit" data-kind="inbox">In den Eingang</button><button type="button" class="btn" data-action="capture-submit" data-kind="today">Gleich für heute</button>`
    });
  }
  function detailSheet(id) {
    const t = task(id);
    if (!t) return;
    const body = `
      <div class="field" style="margin-top:4px"><label for="dtText">Aufgabe</label><input type="text" id="dtText" value="${esc(t.text)}" data-action="edit-text" data-id="${t.id}"></div>
      <div class="field"><span class="label">Einplanen</span>${dayChips('plan', t.id, t.planned, true, 'kein Tag')}</div>
      <div class="field"><span class="label">Fällig</span>${dayChips('set-due', t.id, t.due, true, 'keine')}${overdue(t) ? `<p class="meta"><span class="over">überfällig seit ${esc(dayShort(t.due))}</span></p>` : ''}</div>
      <div class="field"><span class="label">Bereich</span><div class="chips">${AREAS.map(a => `<button type="button" class="chip" data-action="set-area" data-area="${a.id}" data-id="${t.id}" aria-pressed="${t.area === a.id}">${a.name}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Projekt${prop('B1')}</span><div class="chips">${PROJECTS.map(p => `<button type="button" class="chip" data-project="${p.id}" data-action="set-project" data-id="${t.id}" aria-pressed="${t.project === p.id}"><span class="pdot"></span>${esc(p.name)}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Schätzung${prop('C1')}</span><div class="chips"><button type="button" class="chip" data-action="set-est" data-est="" data-id="${t.id}" aria-pressed="${!t.est}">keine</button>${ESTIMATES.map(e => `<button type="button" class="chip num" data-action="set-est" data-est="${e}" data-id="${t.id}" aria-pressed="${t.est === e}">${e} min</button>`).join('')}</div></div>
      ${t.waiting ? `<div class="field"><span class="label">Wartet auf</span><p>${esc(t.waiting.who)} · bis ${esc(dayShort(t.waiting.until))}</p></div>` : ''}
      <div class="field"><label for="dtNote">Notiz</label><textarea id="dtNote" data-action="edit-note" data-id="${t.id}" placeholder="Kontext, Links, Gedanken">${esc(t.note || '')}</textarea></div>`;
    openSheet('Aufgabe', body, {
      id: 'detail', ref: t.id,
      headAction: `<button type="button" class="check" role="checkbox" aria-checked="${t.done}" aria-label="Erledigt" data-action="toggle" data-id="${t.id}" data-keep="1"></button>`,
      foot: `<button type="button" class="btn btn-sm" data-action="focus" data-id="${t.id}">Fokus 25 min</button><span class="spacer"></span><button type="button" class="btn btn-sm btn-danger" data-action="delete-task" data-id="${t.id}">Löschen</button>`
    });
  }
  function triageSheet(id) {
    const it = state.inbox.find(i => i.id === id);
    if (!it) return;
    const body = `<p style="font-size:17px;line-height:24px;margin-top:4px">${esc(it.text)}</p>
      <div class="field"><span class="label">Projekt${prop('B1')}</span><div class="chips">${PROJECTS.map(p => `<button type="button" class="chip" data-project="${p.id}" data-action="inbox-project" data-id="${it.id}" aria-pressed="${it.project === p.id}"><span class="pdot"></span>${esc(p.name)}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Woche</span>${dayChips('triage-day', it.id, null, false)}</div>
      <div class="field"><span class="label">Aufgaben</span><div class="chips">${AREAS.map(a => `<button type="button" class="chip" data-action="triage" data-kind="matrix" data-area="${a.id}" data-id="${it.id}">${a.name}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Woanders</span><div class="chips"><button type="button" class="chip" data-action="triage" data-kind="event" data-id="${it.id}">Termin heute 16:00</button>${state.lists.map(l => `<button type="button" class="chip" data-action="triage" data-kind="list" data-list="${l.id}" data-id="${it.id}">Liste ${esc(l.name)}</button>`).join('')}</div></div>`;
    openSheet('Einordnen', body, { id: 'triage', ref: it.id, closeLabel: 'Abbrechen', foot: `<span class="spacer"></span><button type="button" class="btn btn-sm btn-danger" data-action="triage" data-kind="delete" data-id="${it.id}">Löschen</button>` });
  }
  function planSheet(day) {
    const candidates = state.tasks.filter(t => open(t) && !hasDay(t.planned) && t.area !== 'ideas').sort((a, b) => (AREAS.findIndex(x => x.id === a.area) - AREAS.findIndex(x => x.id === b.area)) || (overdue(b) - overdue(a)));
    const body = `<p class="sub" style="margin-top:4px">${DAY_LONG[day]}, ${dateOf(day)}. Oktober</p>${capLine(day)}${candidates.length ? `<ul class="rows" style="margin-top:8px">${candidates.map(t => `<li class="row"><div class="lead-col"><span class="caps">${esc(area(t.area).name)}</span></div><div class="main"><div class="text">${esc(t.text)}</div><div class="meta">${taskMeta(t)}</div></div><div class="side"><button type="button" class="btn btn-sm" data-action="plan" data-day="${day}" data-id="${t.id}" data-close="1">Einplanen</button></div></li>`).join('')}</ul>` : '<p class="empty">Alles Offene hat schon einen Tag.</p>'}`;
    openSheet('Einplanen', body, { id: 'plan', ref: day, closeLabel: 'Schließen' });
  }
  function filterSheet() {
    const counts = projectCounts();
    const body = `<div class="menu" style="margin-top:4px"><button type="button" class="menu-item" data-action="filter" data-project="">Alle Projekte<span class="hint">${state.tasks.filter(open).length} offen</span></button>${counts.map(p => `<button type="button" class="menu-item" data-action="filter" data-project="${p.id}"><span class="proj" data-project="${p.id}" style="display:inline-flex;align-items:center;gap:8px"><span class="pdot" style="width:8px;height:8px;border-radius:50%;background:var(--pc)"></span>${esc(p.name)}</span><span class="hint">${p.open} offen${p.over ? ` · <span style="color:var(--danger)">${p.over} überfällig</span>` : ''}</span></button>`).join('')}</div><p class="meta" style="margin-top:12px"><span>Projekte als Merkmal und Filter sind ein Vorschlag (B1).</span></p>`;
    openSheet('Projekt', body, { id: 'filter', closeLabel: 'Schließen' });
  }
  function moreSheet() {
    const body = `<div class="menu" style="margin-top:4px">
      <button type="button" class="menu-item" data-action="close-day">Tag abschließen${prop('C4')}<span class="hint">${state.evening ? '18:30' : 'gedacht für den Abend'}</span></button>
      <button type="button" class="menu-item" data-action="theme-toggle">Erscheinungsbild<span class="hint">${document.documentElement.dataset.theme === 'dark' ? 'Dunkel' : document.documentElement.dataset.theme === 'light' ? 'Hell' : 'System'}</span></button>
      <button type="button" class="menu-item" data-action="proto-settings">Prototyp-Einstellungen<span class="hint">Rahmen, Demo-Zeit, Vorschläge</span></button>
    </div>`;
    openSheet('Mehr', body, { id: 'more', closeLabel: 'Schließen' });
  }
  function focusSheet(id) {
    const t = task(id);
    if (!t) return;
    openSheet('Fokus', `<p class="lead" style="margin-top:4px">${esc(t.text)}</p><p class="sub" style="margin-top:6px">25 Minuten für genau diese Aufgabe. Der Timer ist im Prototyp nur angedeutet; in der App läuft der Focus-Timer bereits.</p><p class="display num" style="margin-top:20px">25:00</p>`, { id: 'focus', closeLabel: 'Abbrechen', foot: `<button type="button" class="btn btn-primary" data-action="close-sheet">Starten (Demo)</button>` });
  }
  // Vorschlag C4: Tagesabschluss – je offene Aufgabe eine Entscheidung
  function closeDaySheet() {
    const openToday = state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t)));
    const dec = ui.decisions;
    const undecided = openToday.filter(t => !dec[t.id]).length;
    const rows = openToday.length ? `<ul class="rows" style="margin-top:4px">${openToday.map(t => `<li class="row" style="grid-template-columns:minmax(0,1fr)"><div class="main"><div class="text">${esc(t.text)}</div><div class="meta">${taskMeta(t, { day: TODAY })}</div><div class="decide" style="margin-top:8px">${[['tomorrow', 'Morgen'], ['matrix', 'Zurück in die Aufgaben'], ['done', 'Erledigt']].map(([k, l]) => `<button type="button" class="chip" data-action="decide" data-kind="${k}" data-id="${t.id}" aria-pressed="${dec[t.id] === k}">${l}</button>`).join('')}</div></div></li>`).join('')}</ul>` : '<p class="empty">Nichts mehr offen – nur noch Habits und ein Satz.</p>';
    const body = `<p class="sub" style="margin-top:4px">${openToday.length} offen${undecided ? ` · ${undecided} Entscheidung${undecided === 1 ? '' : 'en'} offen` : ' · alles entschieden'}${prop('C4')}</p>${rows}${undecided > 1 ? `<button type="button" class="btn btn-sm" style="margin-top:12px" data-action="decide-rest">Rest nach morgen</button>` : ''}
      <div class="field"><span class="label">Habits heute</span><div class="habits" style="padding-top:4px">${state.habits.map(h => `<button type="button" class="habit" aria-pressed="${h.week[TODAY]}" data-action="habit" data-id="${h.id}" data-keep="1"><span class="check" aria-checked="${h.week[TODAY]}" aria-hidden="true"></span>${esc(h.name)}</button>`).join('')}</div></div>
      <div class="field"><label for="sentence">Ein Satz zum Tag (optional)</label><textarea id="sentence" data-action="sentence" placeholder="Was war heute wichtig?">${esc(ui.sentence)}</textarea></div>`;
    openSheet('Tag abschließen', body, { id: 'close', closeLabel: 'Später', foot: `<button type="button" class="btn btn-primary btn-block" data-action="finish-close" ${undecided ? 'disabled' : ''}>Tag abschließen</button>` });
  }
  function finishClose() {
    const dec = ui.decisions;
    const counts = { tomorrow: 0, matrix: 0, done: 0 };
    Object.keys(dec).forEach(k => {
      const t = task(k); if (!t) return;
      counts[dec[k]]++;
      if (dec[k] === 'tomorrow') { t.planned = TODAY + 1; t.rolls++; }
      else if (dec[k] === 'matrix') { t.planned = null; if (t.area === 'todo') t.area = 'next'; t.rolls++; }
      else if (dec[k] === 'done') t.done = true;
    });
    if (ui.sentence.trim()) state.notes.push({ day: TODAY, text: ui.sentence.trim() });
    const parts = [];
    if (counts.tomorrow) parts.push(`${counts.tomorrow} nach morgen`);
    if (counts.matrix) parts.push(`${counts.matrix} zurück in die Aufgaben`);
    if (counts.done) parts.push(`${counts.done} erledigt`);
    state.closed = `${parts.length ? parts.join(', ') : 'keine offenen Aufgaben'} · ${state.habits.filter(h => h.week[TODAY]).length} von ${state.habits.length} Habits${ui.sentence.trim() ? ' · Satz gespeichert' : ''}`;
    ui.decisions = {}; ui.sentence = '';
    closeSheet();
    location.hash = 'home';
    render();
    toast('Tag abgeschlossen');
  }

  // ===== Aktionen =====
  function addInbox(text, project, via) {
    const item = { id: `i${Date.now()}`, text, project: project || null, when: state.evening ? 'heute 18:31' : 'heute 09:41', via: via || 'app' };
    state.inbox.unshift(item);
    return item;
  }
  function newTask(text, extra) {
    const t = Object.assign({ id: state.nextId++, text, project: state.filter || null, area: 'todo', due: null, planned: null, est: null, done: false, rolls: 0, waiting: null, note: '' }, extra || {});
    state.tasks.push(t);
    return t;
  }
  function triage(id, kind, extra) {
    const idx = state.inbox.findIndex(i => i.id === id);
    if (idx === -1) return;
    const it = state.inbox[idx];
    let msg = '';
    if (kind === 'today') { newTask(it.text, { project: it.project, planned: TODAY }); msg = 'Für heute eingeplant'; }
    else if (kind === 'week') { newTask(it.text, { project: it.project, planned: Number(extra.day) }); msg = `Eingeplant: ${DAYS[Number(extra.day)]} ${dateOf(Number(extra.day))}.`; }
    else if (kind === 'matrix') { newTask(it.text, { project: it.project, area: extra.area }); msg = `Aufgabe in „${area(extra.area).name}“`; }
    else if (kind === 'event') { state.events.push({ id: `e${Date.now()}`, title: it.text, day: TODAY, start: '16:00', end: '16:30', cal: 'work' }); msg = 'Termin heute 16:00 (Demo)'; }
    else if (kind === 'list') { const l = state.lists.find(x => x.id === extra.list); if (l) l.items.push({ id: `l${Date.now()}`, text: it.text, done: false }); msg = `In Liste ${l ? l.name : ''}`; }
    else if (kind === 'delete') msg = 'Gelöscht';
    state.inbox.splice(idx, 1);
    closeSheet();
    toast(msg);
    render();
  }
  function submitCapture(kind) {
    const input = $('#captureInput');
    const text = ((input && input.value) || '').trim();
    if (!text) { if (input) input.focus(); return; }
    if (kind === 'today') { newTask(text, { planned: TODAY }); toast('Für heute eingeplant'); }
    else { addInbox(text, null, 'app'); toast('Im Eingang'); }
    if (ui.sheet === 'capture') closeSheet(); else if (input) { input.value = ''; }
    render();
    if (route() === 'inbox') { const again = $('#captureInput'); if (again && kind !== 'today') again.focus(); }
  }

  function act(action, el) {
    const d = el.dataset;
    const id = d.id;
    switch (action) {
      case 'toggle': { const t = task(id); if (t) { t.done = !t.done; toast(t.done ? 'Erledigt' : 'Wieder offen'); } if (d.keep) refreshSheet(); render(); break; }
      case 'toggle-item': { const l = state.lists.find(x => x.id === d.list); const it = l && l.items.find(x => x.id === id); if (it) it.done = !it.done; render(); break; }
      case 'toggle-list': ui.lists[d.list] = !ui.lists[d.list]; render(); break;
      case 'detail': detailSheet(id); break;
      case 'habit': { const h = state.habits.find(x => x.id === id); if (h) h.week[TODAY] = !h.week[TODAY]; if (d.keep) refreshSheet(); else render(); break; }
      case 'focus': focusSheet(id); break;
      case 'capture': captureSheet(); break;
      case 'capture-submit': submitCapture(d.kind); break;
      case 'shortcut-demo': addInbox('Nachunternehmer Elektrik anrufen wegen Zeitplan', 'ra', 'shortcut'); toast('Per Kurzbefehl diktiert (Demo) → Eingang'); render(); break;
      case 'triage-sheet': triageSheet(id); break;
      case 'triage': triage(id, d.kind, { area: d.area, list: d.list }); break;
      case 'triage-day': triage(id, 'week', { day: d.day }); break;
      case 'inbox-project': { const it = state.inbox.find(i => i.id === id); if (it) it.project = it.project === d.project ? null : d.project; triageSheet(id); render(); break; }
      case 'filter-sheet': filterSheet(); break;
      case 'filter': state.filter = d.project || null; closeSheet(); render(); break;
      case 'area': state.area = d.area; render(); break;
      case 'new-task': { const t = newTask('Neue Aufgabe', { area: d.area }); render(); detailSheet(t.id); const i = $('#dtText'); if (i) { i.focus(); i.select(); } break; }
      case 'set-project': { const t = task(id); if (t) t.project = t.project === d.project ? null : d.project; refreshSheet(); render(); break; }
      case 'set-area': { const t = task(id); if (t) t.area = d.area; refreshSheet(); render(); break; }
      case 'set-due': { const t = task(id); if (t) t.due = d.day === '' ? null : Number(d.day); refreshSheet(); render(); break; }
      case 'set-est': { const t = task(id); if (t) t.est = d.est === '' ? null : Number(d.est); refreshSheet(); render(); break; }
      case 'plan': { const t = task(id); if (t) { t.planned = d.day === '' ? null : Number(d.day); toast(hasDay(t.planned) ? `Eingeplant: ${t.planned === TODAY ? 'heute' : dayShort(t.planned)}` : 'Kein Tag mehr'); } if (d.close) closeSheet(); else refreshSheet(); render(); break; }
      case 'edit-text': { const t = task(id); if (t) t.text = el.value.trim() || t.text; render(); break; }
      case 'edit-note': { const t = task(id); if (t) t.note = el.value; save(); break; }
      case 'delete-task': state.tasks = state.tasks.filter(t => t.id !== Number(id)); closeSheet(); toast('Gelöscht'); render(); break;
      case 'select-day': state.selectedDay = Number(d.day); render(); break;
      case 'goto-day': state.selectedDay = Number(d.day); location.hash = 'week'; break;
      case 'plan-sheet': planSheet(Number(d.day)); break;
      case 'more': moreSheet(); break;
      case 'close-day': closeSheet(); closeDaySheet(); break;
      case 'decide': ui.decisions[id] = d.kind; refreshSheet(); break;
      case 'decide-rest': state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t))).forEach(t => { if (!ui.decisions[t.id]) ui.decisions[t.id] = 'tomorrow'; }); refreshSheet(); break;
      case 'sentence': ui.sentence = el.value; break;
      case 'finish-close': finishClose(); break;
      case 'theme-toggle': { const cur = document.documentElement.dataset.theme || ''; const next = cur === '' ? 'light' : cur === 'light' ? 'dark' : ''; setTheme(next); $('#themeSel').value = next; moreSheet(); break; }
      case 'proto-settings': closeSheet(); $('#protoCtl').classList.add('open'); $('#protoToggle').setAttribute('aria-expanded', 'true'); layoutStage(); $('#frameSel').focus(); break;
      case 'close-sheet': closeSheet(); break;
      default: break;
    }
  }

  // ===== Prototyp-Leiste =====
  function setTheme(v) { if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; pref('theme', v); }
  function setFrame(v) { $('#stage').dataset.frame = v || 'free'; pref('frame', v); requestAnimationFrame(render); }
  function setEvening(on) { state.evening = !!on; $('#timeSel').value = on ? 'evening' : 'morning'; render(); }
  function setStress(on) {
    ui.stress = !!on;
    state.tasks = state.tasks.filter(t => t.id < 100);
    if (on) state.tasks.push(...D.stressTasks(100));
    render();
  }
  function layoutStage() { document.documentElement.style.setProperty('--proto-h', `${$('#proto').offsetHeight}px`); }
  function resetAll() { state = D.seed(); ui.decisions = {}; ui.sentence = ''; ui.stress = false; $('#stressToggle').checked = false; closeSheet(); render(); toast('Beispieldaten zurückgesetzt'); }
  function setupProto() {
    $('#protoToggle').addEventListener('click', () => { const c = $('#protoCtl'); const o = c.classList.toggle('open'); $('#protoToggle').setAttribute('aria-expanded', String(o)); layoutStage(); });
    $('#frameSel').addEventListener('change', e => setFrame(e.target.value));
    $('#themeSel').addEventListener('change', e => setTheme(e.target.value));
    $('#timeSel').addEventListener('change', e => setEvening(e.target.value === 'evening'));
    $('#propToggle').addEventListener('change', e => { document.body.classList.toggle('hide-props', !e.target.checked); pref('props', e.target.checked ? '' : 'off'); });
    $('#safeToggle').addEventListener('change', e => $('#app').classList.toggle('safe', e.target.checked));
    $('#kbdToggle').addEventListener('change', e => $('#app').classList.toggle('kbd-open', e.target.checked));
    $('#stressToggle').addEventListener('change', e => setStress(e.target.checked));
    $('#resetBtn').addEventListener('click', resetAll);
    const th = getPref('theme'); if (th) { setTheme(th); $('#themeSel').value = th; }
    const fr = getPref('frame'); if (fr && $(`#frameSel option[value="${fr}"]`) && window.innerWidth > 900) { $('#stage').dataset.frame = fr; $('#frameSel').value = fr; }
    if (getPref('props') === 'off') { document.body.classList.add('hide-props'); $('#propToggle').checked = false; }
    $('#timeSel').value = state.evening ? 'evening' : 'morning';
    layoutStage();
    window.addEventListener('resize', layoutStage);
  }

  // ===== Ereignisse =====
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !$('#app').contains(el)) return;
    const action = el.dataset.action;
    if (['capture-form', 'edit-text', 'edit-note', 'sentence'].includes(action)) return;
    if (el.tagName === 'A' && action === 'close-day') e.preventDefault();
    if (action === 'toggle' || action === 'toggle-item' || action === 'plan') e.stopPropagation();
    act(action, el);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-action="capture-form"]');
    if (!f) return;
    e.preventDefault();
    submitCapture('inbox');
  });
  document.addEventListener('change', e => { const el = e.target.closest('[data-action="edit-text"], [data-action="edit-note"]'); if (el) act(el.dataset.action, el); });
  document.addEventListener('input', e => { const el = e.target.closest('[data-action="sentence"], [data-action="edit-note"]'); if (el) act(el.dataset.action, el); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.main[role="button"], .now-task[role="button"]')) { e.preventDefault(); act(e.target.dataset.action, e.target); }
  });
  window.addEventListener('hashchange', () => { closeSheet(); render(); $('#main').scrollTop = 0; });
  $('#main').addEventListener('scroll', () => { $('#main').classList.toggle('scrolled', $('#main').scrollTop > 48); }, { passive: true });
  // Breite des Containers ändert sich (Fenster, Rahmen, Faltzustand): Komposition neu, Sheet bleibt
  if (window.ResizeObserver) new ResizeObserver(() => { if (modeOf() !== ui.mode) render(); }).observe($('#app'));
  else window.addEventListener('resize', () => { if (modeOf() !== ui.mode) render(); });

  // ===== Für Screenshots und Tests =====
  window.Proto = {
    setFrame, setTheme, setEvening, setStress,
    setProps(on) { document.body.classList.toggle('hide-props', !on); },
    setSafe(on) { $('#app').classList.toggle('safe', !!on); },
    setKeyboard(on) { $('#app').classList.toggle('kbd-open', !!on); },
    demo(name, arg) {
      if (name === 'capture') captureSheet();
      if (name === 'typed') { captureSheet(); const i = $('#captureInput'); if (i) i.value = arg || 'Zement für Abschnitt 3 nachbestellen'; }
      if (name === 'detail') detailSheet(arg || 2);
      if (name === 'triage') triageSheet(arg || state.inbox[0].id);
      if (name === 'plan') planSheet(arg === undefined ? 3 : arg);
      if (name === 'filter') filterSheet();
      if (name === 'more') moreSheet();
      if (name === 'close') { state.evening = true; closeDaySheet(); }
      if (name === 'closed') { state.evening = true; state.tasks.filter(t => open(t) && (t.planned === TODAY || overdue(t))).forEach((t, i) => { ui.decisions[t.id] = i === 0 ? 'tomorrow' : i === 1 ? 'matrix' : 'done'; }); finishClose(); }
      if (name === 'day') { state.selectedDay = arg === undefined ? 4 : arg; render(); }
      if (name === 'area') { state.area = arg || 'next'; render(); }
      if (name === 'empty') { state.tasks.forEach(t => { if (t.planned === TODAY || overdue(t) || t.due === TODAY) t.done = true; }); state.inbox = []; render(); }
      if (name === 'filterSet') { state.filter = arg || 'ra'; render(); }
    },
    reset: resetAll,
    state: () => state,
    mode: () => ui.mode
  };

  // ===== Start =====
  setupProto();
  render();
})();
