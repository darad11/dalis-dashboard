/*
 * Home: the first section of the page - the day at a glance. Greeting, weather, today's
 * events, the tasks of the week, today's goals, the matrix, steps and habits.
 *
 * Rendering only; the rules are in js/home-core.js and the data stays where its section
 * keeps it (js/app.js: db and the render functions, js/steps.js: stepCounter, js/matrix-ui.js,
 * js/weather.js). Home re-renders when data changes ('dashboard:datachange', sent by db.set
 * and db.del, the Step Challenge and the weather), once a minute (greeting, countdown to the
 * next event) and after the first render of the dashboard. Every card leads to the section
 * that owns its data; a task, goal or habit ticked here changes the same entry there.
 */
(function () {
  'use strict';

  const Core = window.HomeCore;
  if (!Core) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EVENT_LIMIT = 4;
  const TASK_LIMIT = 6;
  const GOAL_LIMIT = 4;
  const MARKS = { high: '!!!', medium: '!!', low: '!' };

  // Shapes after SF Symbols, outlines like the menu symbols in js/mobile.js
  const ICONS = {
    chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M13.5 7.5l3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    location: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.4 4.6 4.6 0 0 0 7 18.5z"/>',
    'cloud-sun': '<circle cx="8" cy="7" r="2.6"/><path d="M8 2.5v1.3M3.5 7h1.3M4.8 3.8l.9.9M11.2 3.8l-.9.9"/><path d="M9.5 20h8a3.5 3.5 0 0 0 .3-7A5.2 5.2 0 0 0 8 12.5a3.8 3.8 0 0 0 1.5 7.5z"/>',
    'cloud-moon': '<path d="M11.5 4.5a3.5 3.5 0 0 0 4.2 4.3 3.5 3.5 0 1 1-4.2-4.3z"/><path d="M9.5 20h8a3.5 3.5 0 0 0 .3-7A5.2 5.2 0 0 0 8 12.5a3.8 3.8 0 0 0 1.5 7.5z"/>',
    fog: '<path d="M7 15h10.5a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 6.5 6.9 4.1 4.1 0 0 0 7 15z"/><path d="M5 18.5h13M7 21.5h9"/>',
    drizzle: '<path d="M7 15h10.5a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 6.5 6.9 4.1 4.1 0 0 0 7 15z"/><path d="M8.5 18.5v.01M12 18.5v.01M15.5 18.5v.01M10.2 21.5v.01M13.8 21.5v.01"/>',
    rain: '<path d="M7 15h10.5a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 6.5 6.9 4.1 4.1 0 0 0 7 15z"/><path d="M9 18l-1 3.5M12.5 18l-1 3.5M16 18l-1 3.5"/>',
    snow: '<path d="M7 15h10.5a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 6.5 6.9 4.1 4.1 0 0 0 7 15z"/><path d="M8.5 18v3.5M7 18.9l3 1.7M7 20.6l3-1.7M15.5 18v3.5M14 18.9l3 1.7M14 20.6l3-1.7"/>',
    thunder: '<path d="M7 15h10.5a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 6.5 6.9 4.1 4.1 0 0 0 7 15z"/><path d="M12.5 15.5l-2 4h3l-2 4"/>',
    sunrise: '<path d="M7.5 16.5a4.5 4.5 0 0 1 9 0"/><path d="M3 20h18M3.5 16.5h1.5M19 16.5h1.5M6 10.5l1 1M18 10.5l-1 1M12 3v6M9.5 5.5 12 3l2.5 2.5"/>',
    sunset: '<path d="M7.5 16.5a4.5 4.5 0 0 1 9 0"/><path d="M3 20h18M3.5 16.5h1.5M19 16.5h1.5M6 10.5l1 1M18 10.5l-1 1M12 3v6M9.5 6.5 12 9l2.5-2.5"/>'
  };

  let view = null;
  let refreshTimer = 0;
  let locationSheet = null;
  let locationKey = null; // the weather location handed to js/weather.js

  // ===== DOM helpers (all dynamic text goes through textContent) =====
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(key => {
        const value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'style') Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : String(value));
      });
    }
    children.flat(Infinity).forEach(child => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : String(child));
    });
    return node;
  }

  function icon(name, cls) {
    const span = h('span', { class: cls || 'home-icon', 'aria-hidden': 'true' });
    span.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${ICONS[name] || ''}</svg>`;
    return span;
  }

  function isTouch() {
    return !!(window.MobileUI && window.MobileUI.isTouchLayout());
  }

  function hasDb() {
    return typeof db !== 'undefined' && !!db && typeof db.get === 'function';
  }

  function read(what, fallback) {
    try { return what(); } catch (e) { console.error('[Home]', e); return fallback; }
  }

  // ===== The data of the other sections, read where they keep it =====
  function settings() {
    return Core.normalizeSettings(hasDb() ? db.get('home', null) : null);
  }

  // Stored in the clean shape (name trimmed, coordinates rounded), so every device reads the same
  function saveSettings(next) {
    if (hasDb() && typeof db.setHome === 'function') db.setHome(Core.normalizeSettings(next));
  }

  function collect() {
    const now = new Date();
    const todayIndex = Core.weekdayIndex(now);
    const todayKey = Core.dayKey(now);
    const d = { now, todayIndex, todayKey, settings: settings() };
    const ready = hasDb();
    d.calendars = ready ? read(() => db.getCalendars(), []) : [];
    d.events = ready ? read(() => Core.todayEvents(db.getCalendarTasks(now), now), Core.todayEvents([], now)) : Core.todayEvents([], now);
    d.tasks = ready ? read(() => Core.triageTasks(db.getKanban(now), todayIndex, TASK_LIMIT), Core.triageTasks(null, todayIndex, TASK_LIMIT)) : Core.triageTasks(null, todayIndex, TASK_LIMIT);
    d.goals = ready ? read(() => Core.goalsSummary(db.getGoals(now)), Core.goalsSummary([])) : Core.goalsSummary([]);
    d.matrix = ready ? read(() => Core.matrixSummary(listMeta().find(MatrixCore.isMatrix), getListItems(MatrixCore.MATRIX_ID), todayKey), null) : null;
    d.steps = read(() => {
      const s = window.stepCounter && typeof window.stepCounter.summary === 'function' ? window.stepCounter.summary() : null;
      return s ? { configured: s.configured, summary: Core.stepsSummary(s.stats) } : null;
    }, null);
    d.habits = ready ? read(() => {
      const weekKey = db.habitsKey(now);
      return Core.habitsSummary(db.getAllHabits(), i => !!localStorage.getItem(`${weekKey}-h${i}-d${todayIndex}`));
    }, Core.habitsSummary([], () => false)) : Core.habitsSummary([], () => false);
    d.weather = window.Weather ? window.Weather.current() : null;
    return d;
  }

  // ===== Pieces =====
  function card(cls, label, head, ...body) {
    return h('section', { class: `home-card glass-panel ${cls}`, 'aria-label': label }, head, ...body);
  }

  function cardHead(title, meta, actions) {
    return h('div', { class: 'home-card-head' },
      h('div', { class: 'home-card-titles' },
        h('h3', { class: 'home-card-title' }, title),
        meta ? h('p', { class: 'home-card-meta' }, meta) : null),
      h('div', { class: 'home-card-actions' }, ...(actions || [])));
  }

  function linkButton(label, target, key) {
    return h('button', { type: 'button', class: 'home-link', 'data-focus': key, onclick: () => goTo(target) },
      label, icon('chevron', 'home-link-icon'));
  }

  function addButton(label, key, onclick) {
    return h('button', { type: 'button', class: 'home-add', 'aria-label': label, title: label, 'data-focus': key, onclick },
      icon('plus', 'home-add-icon'));
  }

  // Space and Enter tick a control; Space must not also start the focus timer (the page-wide
  // shortcut in js/app.js), as with the habit checks
  function onKeyActivate(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.click();
  }

  function checkButton(checked, label, key, onclick) {
    return h('button', {
      type: 'button', class: 'home-check', role: 'checkbox', 'aria-checked': String(!!checked), 'aria-label': label,
      'data-focus': key, onclick, onkeydown: onKeyActivate
    });
  }

  function moreButton(label, target) {
    return h('button', { type: 'button', class: 'home-more', onclick: () => goTo(target) }, label, icon('chevron', 'home-link-icon'));
  }

  function timeLabel(ms) {
    return ms ? new Date(ms).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  // ===== Header: greeting and date =====
  function renderHeader(d) {
    const line = Core.greetingLine(d.settings.name, d.now.getHours());
    const edit = h('button', {
      type: 'button', class: 'home-name-btn', 'data-focus': 'name',
      'aria-label': d.settings.name ? 'Change your name' : 'Add your name', title: d.settings.name ? 'Change your name' : 'Add your name',
      onclick: editName
    }, icon('pencil', 'home-name-icon'));
    // The pencil stays with the last word: a line breaks before the word, never before the pencil
    const cut = line.lastIndexOf(' ');
    const head = cut > 0 ? line.slice(0, cut + 1) : '';
    const tail = cut > 0 ? line.slice(cut + 1) : line;
    return h('header', { class: 'home-header' },
      h('h1', { class: 'home-greeting' },
        h('span', { class: 'home-greeting-text' }, head, h('span', { class: 'home-greeting-tail' }, tail, edit))),
      h('p', { class: 'home-date' }, Core.dateLabel(d.now)));
  }

  // ===== Weather =====
  function placeButton(name, key) {
    return h('button', {
      type: 'button', class: 'home-weather-place', 'data-focus': key || 'weather-place', 'aria-haspopup': 'dialog',
      'aria-label': `Location: ${name}. Change`, onclick: () => openLocationSheet()
    }, name, icon('chevron', 'home-link-icon'));
  }

  function weatherNote(w) {
    const at = timeLabel(w.fetchedAt);
    if (w.status === 'offline') return `Offline · from ${at}`;
    if (w.status === 'error') return `Could not update · from ${at}`;
    if (w.status === 'loading') return `Updating · from ${at}`;
    return w.age === 'fresh' ? '' : `Updated ${at}`;
  }

  function renderWeather(d) {
    const w = d.weather;
    const loc = d.settings.location;
    if (!w || !loc || w.status === 'none') {
      return card('home-weather is-empty', 'Weather', null,
        h('div', { class: 'home-weather-empty' },
          icon('location', 'home-weather-empty-icon'),
          h('div', { class: 'home-weather-empty-text' },
            h('h3', { class: 'home-card-title' }, 'Weather'),
            h('p', { class: 'home-card-meta' }, 'Choose a place to see the weather with today’s sunrise and sunset.')),
          h('button', {
            type: 'button', class: 'btn home-weather-set', 'data-focus': 'weather-place', 'aria-haspopup': 'dialog',
            onclick: () => openLocationSheet()
          }, 'Set location')));
    }
    if (!w.data) {
      const text = w.status === 'loading' ? 'Loading weather…'
        : w.status === 'offline' ? 'Offline – the weather follows when you are back online.'
          : 'The weather could not be loaded.';
      return card('home-weather is-pending', 'Weather', null,
        h('div', { class: 'home-weather-row' },
          icon('cloud', 'home-weather-icon is-dim'),
          h('div', { class: 'home-weather-main' },
            h('p', { class: 'home-weather-text', 'aria-live': 'polite' }, text),
            placeButton(loc.name)),
          w.status === 'error'
            ? h('button', { type: 'button', class: 'btn home-weather-retry', 'data-focus': 'weather-retry', onclick: () => window.Weather.refresh(true) }, 'Retry')
            : null));
    }
    const data = w.data;
    const note = weatherNote(w);
    return card('home-weather', 'Weather', null,
      h('div', { class: 'home-weather-row' },
        icon(Core.weatherIcon(data.code, data.isDay), 'home-weather-icon'),
        h('div', { class: 'home-weather-main' },
          h('p', { class: 'home-weather-temp' }, Core.formatTemperature(data.temperature)),
          h('p', { class: 'home-weather-text' }, Core.weatherDescription(data.code)),
          placeButton(loc.name)),
        h('dl', { class: 'home-sun' },
          h('div', { class: 'home-sun-item' },
            h('dt', null, icon('sunrise', 'home-sun-icon'), h('span', { class: 'visually-hidden' }, 'Sunrise')),
            h('dd', null, data.sunrise || '–')),
          h('div', { class: 'home-sun-item' },
            h('dt', null, icon('sunset', 'home-sun-icon'), h('span', { class: 'visually-hidden' }, 'Sunset')),
            h('dd', null, data.sunset || '–')))),
      note ? h('p', { class: 'home-weather-note' }, note) : null);
  }

  // ===== Today's events =====
  function eventRow(e, d) {
    const calendar = CalendarCore.calendarOf(d.calendars, { calendarId: e.calendarId });
    const next = d.events.nextUp === e;
    const btn = h('button', {
      type: 'button', class: 'home-row home-event', 'data-focus': `event-${e.index}`, 'aria-haspopup': 'dialog',
      onclick: () => openCalendarEditor({ date: new Date(d.now), index: e.index, entry: db.getCalendarTasks(d.now)[e.index], returnFocus: btn })
    },
      h('span', { class: 'home-event-time' }, e.allDay ? 'all-day' : e.start),
      calendarDot(calendar, 'home-event-dot'),
      h('span', { class: 'home-event-text' }, e.text),
      next
        ? h('span', { class: 'home-event-next' }, Core.nextUpLabel(e, d.now))
        : (!e.allDay && e.end !== e.start ? h('span', { class: 'home-event-end' }, e.end) : null));
    return h('li', { class: `home-item is-${e.state}${next ? ' is-next' : ''}` }, btn);
  }

  function renderToday(d) {
    const ev = d.events;
    const meta = ev.count === 0 ? 'No events' : ev.count === 1 ? '1 event' : `${ev.count} events`;
    const rows = ev.events.slice(0, EVENT_LIMIT).map(e => eventRow(e, d));
    const add = addButton('New event', 'today-add', () => openCalendarEditor({ date: new Date(), returnFocus: add }));
    return card('home-today', 'Today', cardHead('Today', meta, [add, linkButton('Calendar', 'calendar', 'today-link')]),
      rows.length ? h('ul', { class: 'home-list' }, rows) : h('p', { class: 'home-empty' }, 'No events today.'),
      ev.count > EVENT_LIMIT ? moreButton(`${ev.count - EVENT_LIMIT} more`, 'calendar') : null);
  }

  // ===== Tasks of the week =====
  function taskRow(r) {
    const key = `task-${r.column}-${r.index}`;
    const meta = r.kind === 'overdue' ? `Overdue · ${r.dayLabel}` : r.kind === 'upcoming' ? r.dayLabel : '';
    return h('li', { class: `home-item home-task is-${r.kind}${r.done ? ' is-done' : ''}` },
      h('div', { class: 'home-row' },
        checkButton(r.done, r.text, key, () => toggleTask(r.column, r.index)),
        h('span', { class: 'home-row-text' }, r.text),
        r.priority ? h('span', { class: `home-priority is-${r.priority}`, 'aria-label': `Priority ${r.priority}` }, MARKS[r.priority]) : null,
        meta ? h('span', { class: 'home-row-meta' }, meta) : null));
  }

  function renderTasks(d) {
    const t = d.tasks;
    const parts = [];
    if (t.todayOpen || t.todayDone) parts.push(`${t.todayOpen} open today`);
    if (t.overdue) parts.push(`${t.overdue} overdue`);
    if (t.todayDone) parts.push(`${t.todayDone} done`);
    const total = t.weekOpen + t.weekDone;
    const meta = parts.length ? parts.join(' · ') : total ? 'Nothing planned for today' : '';
    const add = addButton('New task for today', 'tasks-add', addTask);
    return card('home-tasks', 'Tasks', cardHead('Tasks', meta, [add, linkButton('Week', 'week', 'tasks-link')]),
      t.rows.length ? h('ul', { class: 'home-list' }, t.rows.map(taskRow)) : h('p', { class: 'home-empty' }, 'No tasks this week yet.'),
      t.hidden ? moreButton(`${t.hidden} more this week`, 'week') : null,
      total ? h('p', { class: 'home-card-foot' }, `${t.weekDone} of ${total} done this week`) : null);
  }

  // ===== Today's goals =====
  function goalRow(g, isFocus) {
    return h('div', { class: `home-row${isFocus ? ' home-row-focus' : ''}` },
      checkButton(g.done, g.text, `goal-${g.index}`, () => toggleGoal(g.index)),
      h('span', { class: 'home-row-text' }, g.text),
      g.urgency ? h('span', { class: `home-priority is-${g.urgency}`, 'aria-label': `Urgency ${g.urgency}` }, MARKS[g.urgency]) : null);
  }

  function renderGoals(d) {
    const g = d.goals;
    const body = [];
    if (g.focus) body.push(h('div', { class: 'home-focus' }, h('p', { class: 'home-focus-label' }, 'Focus'), goalRow(g.focus, true)));
    const rest = g.rest.slice(0, GOAL_LIMIT - (g.focus ? 1 : 0));
    if (rest.length) body.push(h('ul', { class: 'home-list' }, rest.map(r => h('li', { class: 'home-item' }, goalRow(r, false)))));
    const hidden = g.rest.length - rest.length;
    if (hidden > 0) body.push(moreButton(`${hidden} more`, 'today'));
    if (!g.focus && !rest.length) {
      body.push(h('p', { class: 'home-empty' }, g.total ? 'All goals done – well done.' : 'What do you want to accomplish today?'));
    }
    const add = addButton('New goal', 'goals-add', addGoal);
    return card('home-goals', "Today's Goals",
      cardHead("Today's Goals", g.total ? `${g.doneCount} of ${g.total} done` : '', [add, linkButton('Goals', 'today', 'goals-link')]),
      ...body);
  }

  // ===== Matrix =====
  function areaIcon(id) {
    return window.MatrixUI && typeof window.MatrixUI.areaIcon === 'function'
      ? window.MatrixUI.areaIcon(id, 'home-tile-icon')
      : h('span', { class: 'home-tile-icon', 'aria-hidden': 'true' });
  }

  function renderMatrix(d) {
    const m = d.matrix;
    if (!m) return null;
    const tiles = m.areas.map(a => {
      const tile = h('button', {
        type: 'button', class: 'home-tile', 'data-area': a.id, 'data-focus': `tile-${a.id}`, 'aria-haspopup': 'dialog',
        'aria-label': `${a.title}, ${a.open} open${a.task ? `, first: ${a.task.text}` : ''}`,
        onclick: () => { if (window.MatrixUI) window.MatrixUI.openArea(a.id, tile); }
      },
        h('span', { class: 'home-tile-head' },
          areaIcon(a.id),
          h('span', { class: 'home-tile-title' }, a.title),
          h('span', { class: 'home-tile-count' }, String(a.open))),
        a.task
          ? h('span', { class: `home-tile-task${a.task.due && a.task.due.overdue ? ' is-overdue' : ''}` },
            h('span', { class: 'home-tile-text' }, a.task.text),
            a.task.due ? h('span', { class: 'home-tile-due' }, a.task.due.label) : null)
          : h('span', { class: 'home-tile-task is-empty' }, 'Nothing open'));
      return tile;
    });
    return card('home-matrix', 'Matrix', cardHead('Matrix', `${m.open} open`, [linkButton('Lists', 'lists', 'matrix-link')]),
      h('div', { class: 'home-tiles' }, tiles));
  }

  // ===== Steps =====
  function formatSteps(n) {
    if (n === null || n === undefined) return '–';
    return typeof StepCore !== 'undefined' && StepCore ? StepCore.formatSteps(n) : String(n);
  }

  function renderSteps(d) {
    const s = d.steps;
    if (!s) return null;
    if (!s.configured) {
      return card('home-steps is-setup', 'Steps',
        cardHead('Steps', 'Set up the Step Challenge in Health to see today’s steps here.', [linkButton('Health', 'health', 'steps-link')]));
    }
    const sum = s.summary;
    if (!sum) return null;
    const value = sum.todaySteps === null ? '–' : formatSteps(sum.todaySteps);
    const remaining = sum.todaySteps === null ? 'Not logged yet'
      : sum.target === null ? '' : sum.remaining === 0 ? 'Target reached' : `${formatSteps(sum.remaining)} to go`;
    return card('home-steps', 'Steps',
      cardHead('Steps', sum.target !== null ? `Target ${formatSteps(sum.target)}` : '', [linkButton('Health', 'health', 'steps-link')]),
      h('div', { class: 'home-steps-row' },
        h('p', { class: 'home-steps-value' }, value, h('span', { class: 'home-steps-unit' }, ' steps')),
        remaining ? h('p', { class: 'home-steps-remaining' }, remaining) : null),
      sum.percent !== null
        ? h('div', { class: 'home-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(sum.percent), 'aria-label': 'Today’s steps' },
          h('div', { class: 'home-meter-fill', style: { width: `${sum.percent}%` } }))
        : null,
      h('p', { class: 'home-card-foot' }, `Year ${sum.yearPercent} % · ${formatSteps(sum.ytd)} of ${formatSteps(sum.goal)}`));
  }

  // ===== Habits =====
  function renderHabits(d) {
    const hb = d.habits;
    if (hb.total === 0) return null;
    const chips = hb.habits.map(x => h('button', {
      type: 'button', class: `home-chip${x.done ? ' is-done' : ''}`, role: 'checkbox', 'aria-checked': String(x.done),
      'data-focus': `habit-${x.index}`, onclick: () => toggleHabit(x.index, d), onkeydown: onKeyActivate
    }, icon('check', 'home-chip-icon'), h('span', { class: 'home-chip-text' }, x.name)));
    return card('home-habits', 'Habits',
      cardHead('Habits', `${hb.done} of ${hb.total} done today`, [linkButton('Habits', 'habits', 'habits-link')]),
      h('div', { class: 'home-chips', role: 'group', 'aria-label': 'Habits today' }, chips));
  }

  // ===== Render =====
  function focusKey() {
    const active = document.activeElement;
    return active && view && view.contains(active) && active.dataset ? active.dataset.focus || null : null;
  }

  function restoreFocus(key) {
    if (!key || !view) return;
    const target = view.querySelector(`[data-focus="${CSS.escape(key)}"]`);
    if (target) target.focus({ preventScroll: true });
  }

  function render() {
    if (!view) return;
    const key = focusKey();
    const d = collect();
    const parts = [renderHeader(d), renderWeather(d), renderToday(d), renderTasks(d), renderGoals(d), renderMatrix(d), renderSteps(d), renderHabits(d)];
    view.replaceChildren(...parts.filter(Boolean));
    restoreFocus(key);
  }

  function schedule() {
    if (refreshTimer || !view) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = 0;
      render();
    }, 50);
  }

  // ===== Actions: they change the data where its section keeps it =====
  function goTo(target) {
    const section = target === 'calendar' ? 'week' : target;
    if (isTouch() && window.MobileUI) {
      window.MobileUI.scrollToSection(section, { focus: true });
    } else {
      const node = target === 'calendar' ? document.querySelector('.calendar-section') : document.getElementById('section-' + section);
      if (node) node.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }
    if (target === 'calendar' && typeof window.goToToday === 'function') window.goToToday();
    if (target === 'week' && typeof window.goToWeekToday === 'function') window.goToWeekToday();
  }

  function playSound(name) {
    if (typeof sounds === 'undefined' || !sounds || typeof sounds[name] !== 'function') return;
    try { sounds[name](); } catch (e) { /* audio blocked */ }
  }

  function rerender(fnName) {
    if (typeof window[fnName] !== 'function') return;
    try { window[fnName](); } catch (e) { console.error('[Home]', fnName, e); }
  }

  async function editName() {
    const s = settings();
    const name = await showInputModal('Your name', 'How should Home greet you?', s.name);
    if (name === null || name === undefined) return;
    saveSettings(Object.assign({}, s, { name: Core.cleanName(name) }));
  }

  async function addTask() {
    const now = new Date();
    const column = Core.COLUMNS[Core.weekdayIndex(now)];
    const text = await showInputModal(`New Task – ${now.toLocaleDateString('de-DE', { weekday: 'long' })}`, 'What needs to be done?');
    if (!text || !text.trim()) return;
    const board = db.getKanban(now);
    if (!Array.isArray(board[column])) board[column] = [];
    board[column].push({ text: text.trim(), done: false, priority: null });
    db.setKanban(board, now);
    rerender('renderKanban');
  }

  function toggleTask(column, index) {
    const now = new Date();
    const board = db.getKanban(now);
    const items = board[column];
    if (!Array.isArray(items) || items[index] === undefined || items[index] === null) return;
    const task = typeof items[index] === 'string' ? { text: items[index], done: false, priority: null } : items[index];
    task.done = !task.done;
    items[index] = task;
    db.setKanban(board, now);
    if (task.done) playSound('success');
    rerender('renderKanban');
  }

  async function addGoal() {
    const now = new Date();
    const text = await showInputModal("Today's Goal", 'What do you want to accomplish?');
    if (!text || !text.trim()) return;
    const goals = db.getGoals(now);
    goals.push({ text: text.trim(), done: false, urgency: null });
    db.setGoals(goals, now);
    rerender('renderGoals');
  }

  function toggleGoal(index) {
    const now = new Date();
    const goals = db.getGoals(now);
    if (goals[index] === undefined || goals[index] === null) return;
    const goal = typeof goals[index] === 'string' ? { text: goals[index], done: false, urgency: null } : goals[index];
    goal.done = !goal.done;
    goals[index] = goal;
    db.setGoals(goals, now);
    if (goal.done) playSound('success');
    rerender('renderGoals');
  }

  function toggleHabit(index, d) {
    const key = `${db.habitsKey(d.now)}-h${index}-d${d.todayIndex}`;
    const done = !localStorage.getItem(key);
    db.setHabitCheck(key, done);
    if (done) playSound('click');
    rerender('renderHabits');
    rerender('updateStats');
  }

  // ===== Weather location (a sheet like the calendar's, js/calendar-ui.js) =====
  function syncWeather() {
    if (!window.Weather) return;
    const loc = settings().location;
    const key = loc ? `${loc.latitude},${loc.longitude}` : '';
    if (key === locationKey) return;
    locationKey = key;
    window.Weather.setLocation(loc);
  }

  function buildLocationSheet() {
    const S = window.SheetUI;
    const el = S.el;
    const sheet = S.createSheet({ className: 'home-location-sheet' });
    sheet.title.textContent = 'Location';
    sheet.setButton(sheet.leading, 'xmark', 'Cancel');
    sheet.setButton(sheet.trailing, 'checkmark', 'Done');
    const input = el('input', {
      class: 'form-input', type: 'search', name: 'place', placeholder: 'City or place', 'aria-label': 'Search for a place',
      autocomplete: 'off', enterkeyhint: 'search', maxlength: '80'
    });
    const results = el('div', { class: 'form-group home-places', role: 'list', hidden: true });
    const status = el('p', { class: 'home-places-status', 'aria-live': 'polite' });
    const current = el('p', { class: 'home-place-current' });
    const useHere = el('button', { type: 'button', class: 'form-row form-row-button tinted', text: 'Use current location' });
    const remove = el('button', { type: 'button', class: 'form-row form-row-button destructive', text: 'Remove location' });
    const removeGroup = S.group(remove);
    const credit = el('p', { class: 'home-credit' });
    credit.append('Weather by ', el('a', { href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener', text: 'Open-Meteo' }), ' (CC BY 4.0). Only the coordinates of the place are sent.');
    sheet.body.append(S.group(el('div', { class: 'form-row' }, [input])), results, status, current, S.group(useHere), removeGroup, credit);

    const state = { timer: 0, seq: 0 };
    const showResults = (places) => {
      results.textContent = '';
      results.hidden = places.length === 0;
      places.forEach(place => {
        const btn = el('button', { type: 'button', class: 'form-row home-place', role: 'listitem', text: place.label || place.name });
        btn.addEventListener('click', () => choose(place));
        results.appendChild(btn);
      });
    };
    const search = async () => {
      const query = input.value.trim();
      const seq = ++state.seq;
      if (query.length < 2) {
        showResults([]);
        status.textContent = '';
        return;
      }
      status.textContent = 'Searching…';
      try {
        const places = await window.Weather.search(query);
        if (seq !== state.seq) return;
        showResults(places);
        status.textContent = places.length ? '' : 'No place found.';
      } catch (e) {
        if (seq !== state.seq) return;
        showResults([]);
        status.textContent = navigator.onLine === false ? 'Offline – the search needs a connection.' : 'The search did not work. Please try again.';
      }
    };
    const choose = (place) => {
      saveSettings(Object.assign({}, settings(), {
        location: { name: place.name, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone || undefined }
      }));
      S.closeSheet(sheet);
    };
    input.addEventListener('input', () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(search, 300);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      clearTimeout(state.timer);
      search();
    });
    useHere.addEventListener('click', () => {
      if (!navigator.geolocation) {
        status.textContent = 'Location is not available on this device.';
        return;
      }
      status.textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(
        pos => choose({ name: 'Current location', latitude: pos.coords.latitude, longitude: pos.coords.longitude, timezone: null }),
        () => { status.textContent = 'Your location could not be used. Search for a place instead.'; },
        { timeout: 15000, maximumAge: 600000 });
    });
    remove.addEventListener('click', () => {
      saveSettings(Object.assign({}, settings(), { location: null }));
      S.closeSheet(sheet);
    });
    sheet.leading.addEventListener('click', () => S.closeSheet(sheet));
    sheet.onDismiss = () => S.closeSheet(sheet);
    sheet.form.addEventListener('submit', (e) => {
      e.preventDefault();
      S.closeSheet(sheet);
    });
    locationSheet = { sheet, input, results, status, current, removeGroup, state };
  }

  function openLocationSheet() {
    if (!window.SheetUI || !window.Weather) return;
    if (!locationSheet) buildLocationSheet();
    const ls = locationSheet;
    const loc = settings().location;
    ls.state.seq++;
    ls.input.value = '';
    ls.results.textContent = '';
    ls.results.hidden = true;
    ls.status.textContent = '';
    ls.current.textContent = loc ? `Current: ${loc.name}` : 'No place chosen yet.';
    ls.removeGroup.hidden = !loc;
    window.SheetUI.openSheet(ls.sheet, document.activeElement, ls.input);
  }

  // ===== Start =====
  function start() {
    view = document.getElementById('homeView');
    if (!view) return;
    window.addEventListener('dashboard:datachange', (e) => {
      if (e.detail && e.detail.key === 'home') syncWeather();
      schedule();
    });
    window.addEventListener('dashboard:rendered', () => {
      syncWeather();
      render();
    });
    window.addEventListener('dashboard:layoutchange', schedule);
    // Greeting, date and the countdown to the next event follow the clock; the weather is
    // fetched again when it is older than half an hour
    setInterval(() => {
      render();
      if (window.Weather) window.Weather.refresh();
    }, 60000);
    syncWeather();
    render();
  }

  window.HomeUI = { refresh: schedule, render, goTo, openLocationSheet, editName };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
