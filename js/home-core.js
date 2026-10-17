/**
 * Home: the day at a glance (greeting, weather, today's events, tasks, goals, matrix, steps,
 * habits). Pure rules without DOM or storage, used by js/home-ui.js in the browser and by
 * tests/unit/home-core.test.js in Node.
 *
 * Home only summarises what the other sections own: it reads their stored shapes
 * (js/app.js: calendar days, the week board, today's goals, habits; js/matrix-core.js: the
 * matrix; js/steps-core.js: the Step Challenge) and never keeps a copy of them. Its own
 * settings (name, weather location) are one settings key, "home":
 *   { name?: string, location?: { name, latitude, longitude, timezone? } }
 *
 * Days are 'YYYY-MM-DD' strings in local time; times "HH:MM".
 */
(function (root, factory) {
  const calendar = typeof module === 'object' && module.exports ? require('./calendar-core.js') : root.CalendarCore;
  const matrix = typeof module === 'object' && module.exports ? require('./matrix-core.js') : root.MatrixCore;
  const api = factory(calendar, matrix);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomeCore = api;
})(typeof self !== 'undefined' ? self : this, function (CalendarCore, MatrixCore) {
  'use strict';

  const MAX_NAME = 40;
  const COLUMNS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
  const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // fixed: ICU versions differ on "Mi" / "Mi."
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const WEATHER_REFRESH_MS = 30 * 60 * 1000;   // fetch again after half an hour
  const WEATHER_MAX_AGE_MS = 6 * 60 * 60 * 1000; // older cached weather is not shown as current

  // ===== Greeting and date =====
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function cleanName(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
  }

  /** "Good morning" from 5:00, "Good afternoon" from 12:00, "Good evening" from 18:00. */
  function greeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function greetingLine(name, hour) {
    const who = cleanName(name);
    return who ? `${greeting(hour)}, ${who}.` : `${greeting(hour)}.`;
  }

  /** "Friday, 16 October" - English like the rest of Home, day before month as read here. */
  function dateLabel(date) {
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    return `${weekday}, ${date.getDate()} ${month}`;
  }

  /** "08:00:26" - the clock next to the date (24 hours, with seconds as before). */
  function clockLabel(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  }

  /** 0 = Monday … 6 = Sunday, the index of the week board's columns. */
  function weekdayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  // ===== Today's events (the calendar day of js/app.js) =====
  function entryObject(entry) {
    if (typeof entry === 'string') return { text: entry, done: false, priority: null };
    return entry && typeof entry === 'object' ? entry : null;
  }

  function minutesOf(now) {
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * The entries of today in their calendar order, each with its state against the clock:
   * 'allday', 'past', 'now' or 'later'. nextUp is the first entry that is running or still
   * ahead. { events, nextUp, count, open }
   */
  function todayEvents(entries, now) {
    const nowMin = minutesOf(now);
    const list = Array.isArray(entries) ? entries : [];
    const events = CalendarCore.displayOrder(list).map(index => {
      const e = entryObject(list[index]);
      const start = CalendarCore.normalizeTime(e.start);
      const end = CalendarCore.normalizeTime(e.end) || start;
      let state = 'allday';
      if (start) {
        const s = CalendarCore.toMinutes(start);
        const t = Math.max(CalendarCore.toMinutes(end), s);
        if (t <= nowMin && !(s === t && s === nowMin)) state = 'past';
        else if (s <= nowMin) state = 'now';
        else state = 'later';
      }
      return {
        index,
        text: typeof e.text === 'string' ? e.text : '',
        done: !!e.done,
        priority: e.priority || null,
        calendarId: e.calendarId || null,
        allDay: !start,
        start,
        end: start ? end : null,
        timeLabel: start ? CalendarCore.formatRange(e) : 'all-day',
        state
      };
    });
    const nextUp = events.find(ev => ev.state === 'now' || ev.state === 'later') || null;
    return { events, nextUp, count: events.length, open: events.filter(ev => ev.state !== 'past').length };
  }

  /** "in 25 min", "in 1 h", "in 1 h 20 min", "until 10:30" (running) - for the next event. */
  function nextUpLabel(event, now) {
    if (!event || event.allDay) return '';
    if (event.state === 'now') return `until ${event.end}`;
    const diff = CalendarCore.toMinutes(event.start) - minutesOf(now);
    if (diff <= 0) return 'now';
    if (diff < 60) return `in ${diff} min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m ? `in ${h} h ${m} min` : `in ${h} h`;
  }

  // ===== Week tasks (the week board of js/app.js) =====
  function priorityRank(priority) {
    return priority in PRIORITY_RANK ? PRIORITY_RANK[priority] : 3;
  }

  function taskObject(item) {
    if (typeof item === 'string') return { text: item, done: false, priority: null };
    return item && typeof item === 'object' && typeof item.text === 'string' ? item : null;
  }

  /**
   * The week board sorted for the day: overdue tasks (open, on a past day of this week),
   * then today's open tasks, then what comes next this week - high priority first within a
   * day; today's done tasks fill the remaining places. Rows carry column and index, so a
   * tick in Home changes the same task on the board.
   * { rows, todayOpen, todayDone, overdue, weekOpen, weekDone }
   */
  function triageTasks(board, todayIndex, limit) {
    const max = limit || 6;
    const all = [];
    COLUMNS.forEach((column, dayIndex) => {
      const items = board && Array.isArray(board[column]) ? board[column] : [];
      items.forEach((item, index) => {
        const task = taskObject(item);
        if (!task || !task.text.trim()) return;
        const kind = dayIndex < todayIndex ? 'overdue' : dayIndex === todayIndex ? 'today' : 'upcoming';
        all.push({
          column,
          index,
          dayIndex,
          text: task.text,
          done: !!task.done,
          priority: task.priority || null,
          kind,
          dayLabel: DAY_LABELS[dayIndex]
        });
      });
    });
    const open = all.filter(t => !t.done);
    const byPriority = (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.dayIndex - b.dayIndex || a.index - b.index;
    const byDay = (a, b) => a.dayIndex - b.dayIndex || priorityRank(a.priority) - priorityRank(b.priority) || a.index - b.index;
    const overdue = open.filter(t => t.kind === 'overdue').sort(byPriority);
    const today = open.filter(t => t.kind === 'today').sort(byPriority);
    const upcoming = open.filter(t => t.kind === 'upcoming').sort(byDay);
    const todayDone = all.filter(t => t.kind === 'today' && t.done);
    const rows = overdue.concat(today, upcoming, todayDone).slice(0, max);
    return {
      rows,
      todayOpen: today.length,
      todayDone: todayDone.length,
      overdue: overdue.length,
      weekOpen: open.length,
      weekDone: all.length - open.length,
      hidden: Math.max(0, overdue.length + today.length + upcoming.length + todayDone.length - max)
    };
  }

  // ===== Today's goals =====
  function goalObject(goal) {
    if (typeof goal === 'string') return { text: goal, done: false, urgency: null };
    return goal && typeof goal === 'object' && typeof goal.text === 'string' ? goal : null;
  }

  /**
   * Today's goals with one focus: the first open goal by urgency (high, medium, low, none)
   * and then by place in the list - the goal chosen with "Urgency: High" in the goals.
   * { focus, rest, open, done, total }
   */
  function goalsSummary(goals) {
    const list = (Array.isArray(goals) ? goals : []).map((g, index) => {
      const goal = goalObject(g);
      return goal && goal.text.trim() ? { index, text: goal.text, done: !!goal.done, urgency: goal.urgency || null } : null;
    }).filter(Boolean);
    const open = list.filter(g => !g.done);
    const ordered = open.slice().sort((a, b) => priorityRank(a.urgency) - priorityRank(b.urgency) || a.index - b.index);
    const focus = ordered[0] || null;
    return {
      focus,
      rest: open.filter(g => g !== focus),
      done: list.filter(g => g.done),
      open: open.length,
      doneCount: list.length - open.length,
      total: list.length
    };
  }

  // ===== Matrix (js/matrix-core.js) =====
  /**
   * The four areas with their open count and the task to look at first: the earliest due
   * day (so an overdue one comes first), then the first task without a day.
   */
  function matrixSummary(entry, tasks, todayKey) {
    const clean = MatrixCore.normalizeEntry(entry);
    const list = MatrixCore.normalizeTasks(tasks);
    const areas = clean.areas.map(area => {
      const open = MatrixCore.openTasks(list, area.id);
      // Plain string order: a day sorts before "none", an earlier day before a later one
      const first = open.slice().sort((a, b) => ((a.due || '\uffff') < (b.due || '\uffff') ? -1 : (a.due || '\uffff') > (b.due || '\uffff') ? 1 : 0))[0] || null;
      return {
        id: area.id,
        title: area.title,
        open: open.length,
        task: first ? { id: first.id, text: first.text, due: first.due ? MatrixCore.dueInfo(first.due, todayKey) : null } : null
      };
    });
    return { areas, open: areas.reduce((n, a) => n + a.open, 0) };
  }

  // ===== Step Challenge (stats of js/steps-core.js computeStats) =====
  function stepsSummary(stats) {
    if (!stats || !stats.todayInYear) return null;
    const todaySteps = stats.todayLogged ? stats.todaySteps : null;
    const target = Number.isFinite(stats.todayTarget) ? stats.todayTarget : null;
    const walked = todaySteps || 0;
    return {
      todaySteps,
      target,
      remaining: target !== null ? Math.max(0, target - walked) : null,
      percent: target ? Math.min(100, Math.round((walked / target) * 100)) : null,
      ytd: stats.ytd,
      goal: stats.goal,
      yearPercent: Math.min(100, Math.round(stats.progressPercent)),
      goalReached: !!stats.goalReached,
      status: stats.status
    };
  }

  // ===== Habits =====
  /** isChecked(index) says whether habit index is ticked today. */
  function habitsSummary(habits, isChecked) {
    const list = (Array.isArray(habits) ? habits : []).map((h, index) => {
      const name = typeof h === 'string' ? h : h && typeof h === 'object' ? h.name : '';
      return typeof name === 'string' && name.trim() ? { index, name, done: !!isChecked(index) } : null;
    }).filter(Boolean);
    return { habits: list, total: list.length, done: list.filter(h => h.done).length };
  }

  // ===== Weather (Open-Meteo, WMO weather interpretation codes as the API documents them) =====
  const WEATHER_CODES = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall', 77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 97: 'Heavy thunderstorm', 99: 'Thunderstorm with heavy hail'
  };

  function weatherDescription(code) {
    return WEATHER_CODES[code] || 'Unknown';
  }

  /** The symbol for a code: sun, moon, cloud-sun, cloud-moon, cloud, fog, drizzle, rain, snow, thunder. */
  function weatherIcon(code, isDay) {
    const day = isDay !== false;
    if (code === 0 || code === 1) return day ? 'sun' : 'moon';
    if (code === 2) return day ? 'cloud-sun' : 'cloud-moon';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95 && code <= 99) return 'thunder';
    return 'cloud';
  }

  function formatTemperature(value) {
    return Number.isFinite(value) ? `${Math.round(value)}°` : '–';
  }

  /** "07:21" from the API's local ISO time "2026-10-17T07:21" (no Date: the offset is the place's). */
  function timeOfIso(iso) {
    const m = typeof iso === 'string' ? /T(\d{2}):(\d{2})/.exec(iso) : null;
    return m ? `${m[1]}:${m[2]}` : '';
  }

  /**
   * The forecast response reduced to what Home shows, or null when the shape is not the
   * documented one (current.temperature_2m, current.weather_code, current.is_day,
   * daily.sunrise[0], daily.sunset[0], daily.temperature_2m_max[0], daily.temperature_2m_min[0]).
   */
  function parseForecast(json) {
    if (!json || typeof json !== 'object' || !json.current || typeof json.current !== 'object') return null;
    const c = json.current;
    if (!Number.isFinite(c.temperature_2m) || !Number.isInteger(c.weather_code)) return null;
    const daily = json.daily && typeof json.daily === 'object' ? json.daily : {};
    const sunrise = Array.isArray(daily.sunrise) ? timeOfIso(daily.sunrise[0]) : '';
    const sunset = Array.isArray(daily.sunset) ? timeOfIso(daily.sunset[0]) : '';
    const dailyNumber = (key) => (Array.isArray(daily[key]) && Number.isFinite(daily[key][0]) ? daily[key][0] : null);
    return {
      temperature: c.temperature_2m,
      code: c.weather_code,
      isDay: c.is_day === undefined ? true : c.is_day === 1 || c.is_day === true,
      time: typeof c.time === 'string' ? c.time : '',
      sunrise,
      sunset,
      high: dailyNumber('temperature_2m_max'),
      low: dailyNumber('temperature_2m_min'),
      unit: json.current_units && typeof json.current_units.temperature_2m === 'string' ? json.current_units.temperature_2m : '°C'
    };
  }

  /** 'fresh' within half an hour, 'ok' until the cached weather is too old, else 'stale'. */
  function weatherAge(fetchedAt, now) {
    const age = now - fetchedAt;
    if (!Number.isFinite(age) || age < 0) return 'stale';
    if (age < WEATHER_REFRESH_MS) return 'fresh';
    if (age < WEATHER_MAX_AGE_MS) return 'ok';
    return 'stale';
  }

  // ===== Home settings =====
  function validLocation(loc) {
    return !!loc && typeof loc === 'object' && typeof loc.name === 'string' && loc.name.trim() !== '' &&
      Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) &&
      Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180;
  }

  function normalizeSettings(value) {
    const v = value && typeof value === 'object' ? value : {};
    const settings = { name: cleanName(v.name) };
    if (validLocation(v.location)) {
      settings.location = {
        name: v.location.name.replace(/\s+/g, ' ').trim().slice(0, 80),
        latitude: Math.round(v.location.latitude * 10000) / 10000,
        longitude: Math.round(v.location.longitude * 10000) / 10000
      };
      if (typeof v.location.timezone === 'string' && v.location.timezone) settings.location.timezone = v.location.timezone;
    } else {
      settings.location = null;
    }
    return settings;
  }

  /** "Wien, Österreich" from a geocoding result (name, admin1, country). */
  function placeLabel(result) {
    if (!result || typeof result !== 'object') return '';
    const parts = [result.name, result.admin1, result.country].filter(p => typeof p === 'string' && p.trim());
    return parts.filter((p, i) => parts.indexOf(p) === i).join(', ');
  }

  return {
    MAX_NAME,
    COLUMNS,
    DAY_LABELS,
    WEATHER_CODES,
    WEATHER_REFRESH_MS,
    WEATHER_MAX_AGE_MS,
    dayKey,
    cleanName,
    greeting,
    greetingLine,
    dateLabel,
    clockLabel,
    mondayOf,
    weekdayIndex,
    todayEvents,
    nextUpLabel,
    triageTasks,
    goalsSummary,
    matrixSummary,
    stepsSummary,
    habitsSummary,
    weatherDescription,
    weatherIcon,
    formatTemperature,
    timeOfIso,
    parseForecast,
    weatherAge,
    validLocation,
    normalizeSettings,
    placeLabel
  };
});
