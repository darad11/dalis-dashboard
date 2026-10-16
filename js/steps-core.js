/**
 * Step Challenge - pure calculation and data logic (no DOM, no storage).
 * Used by js/steps.js in the browser and by tests/unit/steps-core.test.js in Node.
 *
 * Dates are local calendar days as 'YYYY-MM-DD' strings. Day arithmetic runs on
 * UTC day numbers, so daylight-saving changes never shift a day.
 *
 * Year-to-date total:
 *   ytd = baselineSteps                                  (Jan 1 .. baselineDate, entered once)
 *       + sum of daily entries with baselineDate < date <= today
 * Entries on or before baselineDate are already part of baselineSteps and are
 * never counted again.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StepCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_DAILY_STEPS = 200000;
  const MAX_TOTAL_STEPS = 100000000;
  const DAY_MS = 86400000;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // ===== Dates =====
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDateKey(key) {
    const m = typeof key === 'string' ? DATE_RE.exec(key) : null;
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
    return { y, m: mo, d };
  }

  function isValidDateKey(key) {
    return parseDateKey(key) !== null;
  }

  function dayNumber(key) {
    const p = parseDateKey(key);
    if (!p) throw new Error('Invalid date key: ' + key);
    return Date.UTC(p.y, p.m - 1, p.d) / DAY_MS;
  }

  function fromDayNumber(n) {
    const d = new Date(n * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function addDays(key, n) {
    return fromDayNumber(dayNumber(key) + n);
  }

  // Number of days from a to b (b - a); same day = 0
  function daysBetween(a, b) {
    return dayNumber(b) - dayNumber(a);
  }

  function yearOf(key) {
    return Number(key.slice(0, 4));
  }

  function yearEnd(year) {
    return `${year}-12-31`;
  }

  function daysInYear(year) {
    return daysBetween(`${year}-01-01`, `${year}-12-31`) + 1;
  }

  // Monday of the week containing key
  function weekStart(key) {
    const weekday = (new Date(dayNumber(key) * DAY_MS).getUTCDay() + 6) % 7; // Mon=0
    return addDays(key, -weekday);
  }

  function maxKey(a, b) {
    return a > b ? a : b;
  }

  function minKey(a, b) {
    return a < b ? a : b;
  }

  // ===== Input =====
  // Accepts "12345", "12.345", "12,345", "12 345", "12'345" (grouped by 3).
  // Rejects decimals ("12,5"), negatives, text and implausible values.
  function parseStepInput(raw, options) {
    const max = options && options.max !== undefined ? options.max : MAX_DAILY_STEPS;
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (text === '') return { ok: false, error: 'empty' };
    if (/^-/.test(text)) return { ok: false, error: 'negative' };
    const compact = text.replace(/[\s  ]/g, ' ');
    let digits = null;
    if (/^\d+$/.test(compact)) digits = compact;
    else if (/^\d{1,3}([.,' ’]\d{3})+$/.test(compact)) digits = compact.replace(/[.,' ’]/g, '');
    if (digits === null) {
      if (/^\d+[.,]\d+$/.test(compact)) return { ok: false, error: 'decimal' };
      return { ok: false, error: 'format' };
    }
    const value = Number(digits);
    if (!Number.isSafeInteger(value)) return { ok: false, error: 'too_large', max };
    if (value > max) return { ok: false, error: 'too_large', max };
    return { ok: true, value };
  }

  // ===== Entries =====
  // entries: { 'YYYY-MM-DD': { steps, updatedAt, deleted?, pending? } }
  function activeSteps(entry) {
    if (!entry || entry.deleted) return null;
    return Number.isFinite(entry.steps) ? entry.steps : null;
  }

  // Entries counted for a year: after the baseline day, up to and including uptoKey
  function countedEntries(entries, baselineDate, uptoKey) {
    const out = [];
    Object.keys(entries || {}).forEach(date => {
      if (!isValidDateKey(date) || date <= baselineDate || date > uptoKey) return;
      const steps = activeSteps(entries[date]);
      if (steps !== null) out.push({ date, steps });
    });
    out.sort((a, b) => (a.date < b.date ? -1 : 1));
    return out;
  }

  function validateYearConfig(cfg, year) {
    if (!cfg) return 'missing';
    if (!Number.isInteger(cfg.goal) || cfg.goal <= 0 || cfg.goal > MAX_TOTAL_STEPS) return 'goal';
    if (!Number.isInteger(cfg.baselineSteps) || cfg.baselineSteps < 0 || cfg.baselineSteps > MAX_TOTAL_STEPS) return 'baselineSteps';
    if (!isValidDateKey(cfg.baselineDate)) return 'baselineDate';
    // Baseline covers Jan 1 .. baselineDate; Dec 31 of the previous year means "start from zero"
    if (cfg.baselineDate < `${year - 1}-12-31` || cfg.baselineDate > `${year}-12-31`) return 'baselineDate';
    if (cfg.baselineDate === `${year - 1}-12-31` && cfg.baselineSteps !== 0) return 'baselineSteps';
    if (cfg.previousYearTotal !== null && cfg.previousYearTotal !== undefined &&
      (!Number.isInteger(cfg.previousYearTotal) || cfg.previousYearTotal < 0 || cfg.previousYearTotal > MAX_TOTAL_STEPS)) return 'previousYearTotal';
    return null;
  }

  /**
   * All numbers the Step Challenge shows for one year, as of todayKey.
   * cfg: { goal, baselineSteps, baselineDate, previousYearTotal }
   */
  function computeStats(cfg, entries, todayKey, year) {
    const y = year || yearOf(todayKey);
    const end = yearEnd(y);
    const baselineDate = cfg.baselineDate;
    const goal = cfg.goal;
    const baselineSteps = cfg.baselineSteps;

    // "As of" day: today, clamped to the challenge year
    const asOf = minKey(maxKey(todayKey, baselineDate), end);
    const yearFinished = todayKey > end;
    const todayInYear = todayKey >= `${y}-01-01` && todayKey <= end;
    const todayCoveredByBaseline = todayKey <= baselineDate;

    const counted = countedEntries(entries, baselineDate, asOf);
    const entriesSum = counted.reduce((sum, e) => sum + e.steps, 0);
    const ytd = baselineSteps + entriesSum;

    const todayEntry = entries ? entries[todayKey] : null;
    const todaySteps = todayInYear && !todayCoveredByBaseline ? activeSteps(todayEntry) : null;
    const todayLogged = todaySteps !== null;

    const remaining = Math.max(0, goal - ytd);
    const progressPercent = goal > 0 ? (ytd / goal) * 100 : 0;
    const goalReached = ytd >= goal;

    // Remaining calendar days. Today still counts while nothing is logged for it.
    const daysLeftIncludingToday = todayInYear ? daysBetween(todayKey, end) + 1 : 0;
    const countsToday = todayInYear && !todayLogged && !todayCoveredByBaseline;
    const remainingDays = todayInYear
      ? (countsToday ? daysLeftIncludingToday : daysLeftIncludingToday - 1)
      : 0;
    let requiredDailyAverage = null;
    if (remaining === 0) requiredDailyAverage = 0;
    else if (remainingDays > 0) requiredDailyAverage = Math.ceil(remaining / remainingDays);

    // Today's target, as of the start of today (before today's steps)
    let todayTarget = null;
    if (todayInYear && !todayCoveredByBaseline) {
      const remainingBeforeToday = Math.max(0, goal - (ytd - (todaySteps || 0)));
      todayTarget = Math.ceil(remainingBeforeToday / daysLeftIncludingToday);
    }

    // Linear plan from the baseline to the goal on Dec 31
    const planDays = daysBetween(baselineDate, end);
    const planDailyRate = planDays > 0 ? (goal - baselineSteps) / planDays : 0;
    const planAt = (key) => {
      const elapsed = Math.min(Math.max(daysBetween(baselineDate, key), 0), planDays);
      return baselineSteps + planDailyRate * elapsed;
    };

    // Compare with the plan through the last complete day (or today once it is logged)
    let evalDate = todayLogged ? todayKey : addDays(todayKey, -1);
    evalDate = minKey(maxKey(evalDate, baselineDate), end);
    const actualAtEval = baselineSteps + counted.filter(e => e.date <= evalDate).reduce((s, e) => s + e.steps, 0);
    const planAtEval = Math.round(planAt(evalDate));
    const deviation = actualAtEval - planAtEval;
    // "On plan" only within 10 % of one day's plan; a weaker day already shows as behind
    let status;
    if (goalReached) status = 'reached';
    else if (evalDate === baselineDate) status = 'start';
    else if (Math.abs(deviation) <= 0.1 * planDailyRate) status = 'on_track';
    else status = deviation > 0 ? 'ahead' : 'behind';

    // Days since the baseline without an entry (today is never "missing")
    const lastCompleteDay = minKey(addDays(todayKey, -1), end);
    const missingDays = [];
    for (let k = addDays(baselineDate, 1); k <= lastCompleteDay; k = addDays(k, 1)) {
      if (activeSteps(entries ? entries[k] : null) === null) missingDays.push(k);
    }

    const loggedDays = counted.length;
    const averagePerLoggedDay = loggedDays > 0 ? Math.round(entriesSum / loggedDays) : null;
    let bestDay = null;
    counted.forEach(e => { if (!bestDay || e.steps > bestDay.steps) bestDay = e; });

    // Projection with the average of the last 7 logged days
    const recent = counted.slice(-7);
    const recentAverage = recent.length > 0 ? Math.round(recent.reduce((s, e) => s + e.steps, 0) / recent.length) : null;
    const projectedYearEnd = recentAverage !== null ? ytd + recentAverage * remainingDays : null;

    const previousYearTotal = Number.isInteger(cfg.previousYearTotal) ? cfg.previousYearTotal : null;

    return {
      year: y,
      todayKey,
      asOf,
      goal,
      baselineSteps,
      baselineDate,
      challengeStart: addDays(baselineDate, 1),
      yearEnd: end,
      yearFinished,
      todayInYear,
      todayCoveredByBaseline,
      entriesSum,
      loggedDays,
      ytd,
      todaySteps,
      todayLogged,
      todayTarget,
      remaining,
      progressPercent,
      goalReached,
      surplus: Math.max(0, ytd - goal),
      remainingDays,
      countsToday,
      requiredDailyAverage,
      goalOutOfReach: remaining > 0 && remainingDays === 0,
      planDailyRate,
      planDays,
      planAt,
      evalDate,
      actualAtEval,
      planAtEval,
      deviation,
      status,
      missingDays,
      averagePerLoggedDay,
      bestDay,
      recentAverage,
      projectedYearEnd,
      previousYearTotal,
      recordDiff: previousYearTotal !== null ? ytd - previousYearTotal : null,
      recordBeaten: previousYearTotal !== null && ytd > previousYearTotal,
      projectedVsRecord: previousYearTotal !== null && projectedYearEnd !== null ? projectedYearEnd - previousYearTotal : null
    };
  }

  // One Monday-Sunday week, with plan target per counted day
  function weekSummary(stats, entries, weekStartKey) {
    const days = [];
    let total = 0;
    let logged = 0;
    let planned = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStartKey, i);
      const inChallenge = date > stats.baselineDate && date <= stats.yearEnd;
      const steps = inChallenge ? activeSteps(entries ? entries[date] : null) : null;
      if (steps !== null) {
        total += steps;
        logged++;
      }
      if (inChallenge) planned += stats.planDailyRate;
      days.push({
        date,
        steps,
        inChallenge,
        isToday: date === stats.todayKey,
        isFuture: date > stats.todayKey,
        coveredByBaseline: date <= stats.baselineDate && date >= `${stats.year}-01-01`
      });
    }
    return {
      start: weekStartKey,
      days,
      total,
      logged,
      average: logged > 0 ? Math.round(total / logged) : null,
      planTotal: Math.round(planned)
    };
  }

  // Totals of the last `count` weeks up to the week containing todayKey (only weeks touching the challenge)
  function weeklyTotals(stats, entries, count) {
    const thisWeek = weekStart(minKey(stats.todayKey, stats.yearEnd));
    const firstWeek = weekStart(stats.challengeStart);
    const weeks = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      if (start < firstWeek) continue;
      weeks.push(weekSummary(stats, entries, start));
    }
    return weeks;
  }

  // Cumulative actual vs plan from the baseline day to the evaluation day
  function cumulativeSeries(stats, entries) {
    const points = [];
    let running = stats.baselineSteps;
    const last = stats.todayLogged ? stats.todayKey : stats.evalDate;
    for (let k = stats.baselineDate; k <= minKey(last, stats.yearEnd); k = addDays(k, 1)) {
      if (k > stats.baselineDate) {
        const steps = activeSteps(entries ? entries[k] : null);
        if (steps !== null) running += steps;
      }
      points.push({ date: k, actual: running, plan: Math.round(stats.planAt(k)) });
    }
    return points;
  }

  // Total of a finished (or running) year, if a configuration exists for it
  function yearTotal(cfg, entries, year) {
    if (!cfg) return null;
    const counted = countedEntries(entries, cfg.baselineDate, yearEnd(year));
    return cfg.baselineSteps + counted.reduce((s, e) => s + e.steps, 0);
  }

  // ===== Sync merge rules (last write wins per day) =====
  // local:  { steps, updatedAt (ms), deleted?, pending? } or undefined
  // remote: { steps, updatedAt (ms), deleted }
  // Returns { entry, conflict } - conflict: a pending local change lost to a newer remote one
  function mergeRemoteEntry(local, remote) {
    const fromRemote = { steps: remote.steps, updatedAt: remote.updatedAt };
    if (remote.deleted) fromRemote.deleted = true;
    if (!local) return { entry: fromRemote, conflict: false };
    if (remote.updatedAt > local.updatedAt) {
      const differs = !!local.pending && (activeSteps(local) !== activeSteps(fromRemote));
      return { entry: fromRemote, conflict: differs };
    }
    if (remote.updatedAt === local.updatedAt) return { entry: fromRemote, conflict: false };
    // Local is newer: keep it and make sure it gets uploaded
    return { entry: Object.assign({}, local, { pending: true }), conflict: false };
  }

  function rowToRemote(row) {
    return {
      date: row.date,
      steps: Number(row.steps) || 0,
      deleted: !!row.deleted,
      updatedAt: Date.parse(row.updated_at)
    };
  }

  function entryToRow(date, entry) {
    return {
      date,
      steps: entry.deleted ? 0 : entry.steps,
      deleted: !!entry.deleted,
      updated_at: new Date(entry.updatedAt).toISOString()
    };
  }

  // ===== Formatting =====
  const numberFormat = new Intl.NumberFormat('de-DE');
  const percentFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function formatSteps(n) {
    return n === null || n === undefined || !Number.isFinite(n) ? '–' : numberFormat.format(Math.round(n));
  }

  function formatSigned(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const rounded = Math.round(n);
    return (rounded > 0 ? '+' : rounded < 0 ? '−' : '±') + numberFormat.format(Math.abs(rounded));
  }

  function formatPercent(p) {
    return percentFormat.format(p) + ' %';
  }

  // Compact axis/bar labels: 950, 14k, 2,2 Mio.
  function formatCompact(n) {
    if (!Number.isFinite(n)) return '–';
    const abs = Math.abs(n);
    if (abs >= 1000000) return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n / 1000000) + ' Mio.';
    if (abs >= 1000) return new Intl.NumberFormat('de-DE', { maximumFractionDigits: abs >= 10000 ? 0 : 1 }).format(n / 1000) + 'k';
    return numberFormat.format(Math.round(n));
  }

  // Card labels are English like the rest of the dashboard; numbers and short
  // dates use the German format (2.223.411, 16.10.)
  function formatDay(key, withWeekday) {
    const p = parseDateKey(key);
    if (!p) return key;
    const short = `${pad(p.d)}.${pad(p.m)}.`;
    if (!withWeekday) return short;
    const weekday = new Date(p.y, p.m - 1, p.d).toLocaleDateString('en-GB', { weekday: 'short' });
    return `${weekday} ${short}`;
  }

  return {
    MAX_DAILY_STEPS,
    MAX_TOTAL_STEPS,
    toDateKey,
    parseDateKey,
    isValidDateKey,
    dayNumber,
    addDays,
    daysBetween,
    yearOf,
    yearEnd,
    daysInYear,
    weekStart,
    parseStepInput,
    activeSteps,
    countedEntries,
    validateYearConfig,
    computeStats,
    weekSummary,
    weeklyTotals,
    cumulativeSeries,
    yearTotal,
    mergeRemoteEntry,
    rowToRemote,
    entryToRow,
    formatSteps,
    formatSigned,
    formatPercent,
    formatCompact,
    formatDay
  };
});
