/*
 * Realistic demo content for layout tests and screenshots. It is written only
 * into the in-memory CloudStore of the e2e harness, never to a real Supabase
 * project. Dates match the fixed test clock (Friday 16.10.2026, ISO week 42).
 */
'use strict';

const USER = '00000000-0000-4000-8000-000000000001';

function goalRows(key, items) {
  return items.map((g, position) => Object.assign({ user_id: USER, date: key, done: false, priority: null, urgency: null, rolled_from: null, position }, g));
}

function seedDemo(store, opts = {}) {
  const withSteps = opts.steps !== false;

  store.seed('goals', [
    ...goalRows('goals-2026-9-16', [
      { text: 'Steuererklärung abschicken', priority: 'high' },
      { text: '30 Minuten lesen', done: true },
      { text: 'Mail an die Hausverwaltung wegen der Heizungsablesung im Stiegenhaus schreiben' },
      { text: 'Wocheneinkauf planen', priority: 'low' },
      { text: 'Gym: Push-Day', done: true }
    ]),
    ...goalRows('cal-2026-9-14', [{ text: 'Zahnarzt 14:30' }]),
    ...goalRows('cal-2026-9-16', [{ text: 'Team-Meeting 10:00' }, { text: 'Paket abholen' }]),
    ...goalRows('cal-2026-9-20', [{ text: 'Geburtstag Mama 🎂' }]),
    ...goalRows('cal-2026-9-28', [{ text: 'Flug nach Berlin 07:15' }])
  ]);

  const week = 'week-2026-W42';
  const kanban = {
    MO: [{ text: 'Rechnungen bezahlen', done: true, priority: null }],
    DI: [{ text: 'Gym: Pull', done: true, priority: null }, { text: 'Auto zum Service bringen', done: true, priority: 'medium' }],
    MI: [{ text: 'Präsentation Entwurf', done: false, priority: 'high' }],
    DO: [],
    FR: [{ text: 'Präsentation für Montag fertigstellen', done: false, priority: 'high' }, { text: 'Laufen 5 km', done: false, priority: null }],
    SA: [{ text: 'Bauernmarkt', done: false, priority: null }],
    SO: []
  };
  const kanbanRows = [];
  for (const [column, tasks] of Object.entries(kanban)) {
    tasks.forEach((task, sort) => kanbanRows.push({ user_id: USER, week_key: week, column_name: column, text: JSON.stringify(task), sort_order: sort }));
  }
  store.seed('kanban_tasks', kanbanRows);

  store.seed('habits', [
    { user_id: USER, name: 'Meditation', color: '#6366f1', history: {} },
    { user_id: USER, name: '10k Schritte', color: '#10b981', history: {} },
    { user_id: USER, name: 'Kein Zucker', color: '#f59e0b', history: {} },
    { user_id: USER, name: 'Lesen', color: '#ec4899', history: {} }
  ]);

  const checks = {};
  const days = { 0: [0, 1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 3], 3: [1], 4: [0] }; // Mon..Fri of W42
  for (const [day, habits] of Object.entries(days)) {
    for (const h of habits) checks[`habitsData-2026-W42-h${h}-d${day}`] = true;
  }

  const lists = [
    { id: 'custom-1', title: 'Einkaufsliste', items: [{ text: 'Hafermilch', done: false }, { text: 'Bananen', done: true }, { text: 'Vollkornbrot', done: false }, { text: 'Kaffeebohnen (Espresso)', done: false }] },
    { id: 'custom-2', title: 'Ziele 2026', items: [{ text: 'Rekord bei den Schritten brechen', done: false }, { text: 'Halbmarathon laufen', done: true }, { text: '12 Bücher lesen', done: false }] },
    { id: 'custom-3', title: 'Haushalt', items: [{ text: 'Fenster putzen', done: false }, { text: 'Steuerunterlagen sortieren', done: false }] }
  ];

  const settings = [
    { user_id: USER, key: 'habitChecks', value: checks },
    { user_id: USER, key: 'customListsMeta', value: lists.map(l => ({ id: l.id, title: l.title })) }
  ];
  if (withSteps) {
    settings.push({
      user_id: USER, key: 'stepChallenge',
      value: { version: 1, updatedAt: 1, years: { 2026: { goal: 4018405, baselineSteps: 2223411, baselineDate: '2026-10-15', previousYearTotal: 4018404, confirmedAt: 1 } } }
    });
  }
  store.seed('settings', settings);
  store.seed('lists', lists.map(l => ({ user_id: USER, name: l.id, items: l.items, icon: '📝' })));
}

module.exports = { seedDemo, DEMO_USER: USER };
