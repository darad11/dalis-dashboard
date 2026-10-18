/*
 * Beispieldaten des Premium-Prototyps – alles erfunden. Demo-Woche 42 (Mo 12. – So 18. Oktober
 * 2026), heute ist Mittwoch, der 14. (Index 2). Dieselbe erfundene Welt wie im Konzept-Prototyp,
 * damit beide Entwürfe vergleichbar bleiben. Nichts davon stammt aus einer Datenbank.
 */
window.PremiumData = (function () {
  'use strict';

  const TODAY = 2;
  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const DAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const CAPACITY_MIN = 6 * 60; // Vorschlag C1: Tageskapazität als Einstellung (Demo 6 h)

  // Vorschlag B1: Projekte als Merkmal (Farben nur als Punkt)
  const PROJECTS = [
    { id: 'au', name: 'AllesUni', short: 'AU' },
    { id: 'ra', name: 'Radl', short: 'RA' },
    { id: 'db', name: 'Dashboard', short: 'DB' },
    { id: 'pr', name: 'Privat', short: 'PR' }
  ];
  // Bestätigt: die vier Bereiche der Matrix
  const AREAS = [
    { id: 'todo', name: 'to do' },
    { id: 'next', name: 'up next' },
    { id: 'waiting', name: 'waiting' },
    { id: 'ideas', name: 'ideas' }
  ];
  const ESTIMATES = [15, 30, 60, 120];

  // Aufgabe: { id, text, project, area, due (Tagesindex, <0 = Vorwoche), planned (Tagesindex),
  //            est (Minuten), done, rolls (Verschiebungen), waiting {who, until}, note }
  function seed() {
    return {
      tasks: [
        { id: 1, text: 'Angebot Baustelle Nord nachfassen', project: 'ra', area: 'next', due: 0, planned: 2, est: 30, done: false, rolls: 2, waiting: null, note: 'Angebot vom 6.10., Rückfrage zu Position 4' },
        { id: 2, text: 'Landingpage AllesUni überarbeiten', project: 'au', area: 'next', due: null, planned: 3, est: 120, done: false, rolls: 0, waiting: null, note: '' },
        { id: 3, text: 'Semesterstart-Newsletter schreiben', project: 'au', area: 'todo', due: 2, planned: 2, est: 60, done: false, rolls: 0, waiting: null, note: '' },
        { id: 4, text: 'Nachunternehmer Elektrik: Zeitplan bestätigen', project: 'ra', area: 'waiting', due: null, planned: null, est: null, done: false, rolls: 0, waiting: { who: 'Fa. Lichtblick', until: 4 }, note: '' },
        { id: 5, text: 'Stabile IDs im Datenmodell', project: 'db', area: 'next', due: null, planned: null, est: 120, done: false, rolls: 0, waiting: null, note: '' },
        { id: 6, text: 'Steuerberater: Unterlagen Q3 zusammenstellen', project: 'pr', area: 'todo', due: 4, planned: 4, est: 45, done: false, rolls: 0, waiting: null, note: '' },
        { id: 7, text: 'Community-Call vorbereiten', project: 'au', area: 'todo', due: 2, planned: 2, est: 30, done: false, rolls: 0, waiting: null, note: '' },
        { id: 8, text: 'Rechnung Bauabschnitt 2 stellen', project: 'ra', area: 'todo', due: 2, planned: 2, est: 45, done: false, rolls: 0, waiting: null, note: '' },
        { id: 9, text: 'Laufen 5 km', project: 'pr', area: 'todo', due: null, planned: 2, est: null, done: false, rolls: 0, waiting: null, note: '' },
        { id: 10, text: 'Materialliste Dachgeschoss prüfen', project: 'ra', area: 'next', due: 5, planned: null, est: 60, done: false, rolls: 0, waiting: null, note: '' },
        { id: 11, text: 'Interview mit der Studierendenvertretung', project: 'au', area: 'waiting', due: null, planned: null, est: null, done: false, rolls: 0, waiting: { who: 'ÖH', until: 7 }, note: '' },
        { id: 12, text: 'Idee: Wochenbrief per Kurzbefehl', project: 'db', area: 'ideas', due: null, planned: null, est: null, done: false, rolls: 0, waiting: null, note: '' },
        { id: 13, text: 'Idee: Mentoring-Programm für Erstsemester', project: 'au', area: 'ideas', due: null, planned: null, est: null, done: false, rolls: 0, waiting: null, note: '' },
        { id: 14, text: 'Geschenk für Mama bestellen', project: 'pr', area: 'todo', due: 6, planned: null, est: 15, done: false, rolls: 0, waiting: null, note: '' },
        { id: 15, text: 'Präsentation Investorengespräch', project: 'au', area: 'next', due: 4, planned: 4, est: 120, done: false, rolls: 0, waiting: null, note: '' },
        { id: 16, text: 'Bauleiter-Meeting: Protokoll verschicken', project: 'ra', area: 'todo', due: 1, planned: 1, est: 20, done: true, rolls: 0, waiting: null, note: '' },
        { id: 17, text: 'Supabase-Wachhalten als Workflow', project: 'db', area: 'todo', due: null, planned: 0, est: 30, done: true, rolls: 0, waiting: null, note: '' },
        { id: 18, text: 'Zahnarzttermin vereinbaren', project: 'pr', area: 'todo', due: null, planned: 3, est: null, done: false, rolls: 2, waiting: null, note: '' },
        { id: 19, text: 'Sponsoren-Mail Semesterfest', project: 'au', area: 'todo', due: 1, planned: 1, est: 30, done: true, rolls: 0, waiting: null, note: '' },
        { id: 20, text: 'Bauzeitenplan aktualisieren', project: 'ra', area: 'todo', due: 0, planned: 0, est: 60, done: true, rolls: 0, waiting: null, note: '' }
      ],
      events: [
        { id: 'e1', title: 'Jour fixe Radl', day: 0, start: '09:00', end: '10:00', cal: 'work' },
        { id: 'e2', title: 'Baustellenbesuch Nord', day: 1, start: '13:00', end: '15:30', cal: 'work' },
        { id: 'e3', title: 'Team-Call AllesUni', day: 2, start: '10:00', end: '11:00', cal: 'work' },
        { id: 'e4', title: 'Mittagessen mit Lena', day: 2, start: '12:30', end: '13:30', cal: 'personal' },
        { id: 'e5', title: 'Community-Call', day: 2, start: '17:00', end: '18:00', cal: 'work' },
        { id: 'e6', title: 'Bank: Finanzierungsgespräch', day: 3, start: '11:00', end: '12:00', cal: 'work' },
        { id: 'e7', title: 'Gym', day: 3, start: '18:30', end: '19:30', cal: 'personal' },
        { id: 'e8', title: 'Abnahme Bauabschnitt 2', day: 4, start: '09:00', end: '13:00', cal: 'work' },
        { id: 'e9', title: 'Bauernmarkt', day: 5, start: '09:30', end: '10:30', cal: 'personal' }
      ],
      // Vorschlag E1: Eingang (Inbox)
      inbox: [
        { id: 'i1', text: 'Mail an die Hausverwaltung wegen der Heizungsablesung', project: null, when: 'heute 08:12', via: 'app' },
        { id: 'i2', text: 'Zement für Abschnitt 3 nachbestellen', project: 'ra', when: 'gestern 17:40', via: 'shortcut' },
        { id: 'i3', text: 'Blog-Idee: Lernen in Gruppen – warum es wirkt', project: 'au', when: 'gestern 21:05', via: 'shortcut' }
      ],
      habits: [
        { id: 'h1', name: 'Meditation', week: [true, true, false, false, false, false, false] },
        { id: 'h2', name: '10k Schritte', week: [true, false, false, false, false, false, false] },
        { id: 'h3', name: 'Kein Zucker', week: [true, true, true, false, false, false, false] },
        { id: 'h4', name: 'Lesen', week: [false, true, false, false, false, false, false] }
      ],
      steps: { today: 6180, target: 11900, yearPct: 58 },
      lists: [
        { id: 'einkauf', name: 'Einkauf', items: [
          { id: 'l1', text: 'Kaffee', done: false }, { id: 'l2', text: 'Hafermilch', done: false },
          { id: 'l3', text: 'Batterien AA', done: true }, { id: 'l4', text: 'Zitronen', done: false }
        ] },
        { id: 'lesen', name: 'Lesen', items: [
          { id: 'l5', text: 'Deep Work – Kapitel 3', done: false }, { id: 'l6', text: 'Artikel: Kapazitätsplanung in kleinen Teams', done: false },
          { id: 'l7', text: 'Bauordnung Wien, Neuerungen 2026', done: false }
        ] }
      ],
      notes: [{ day: 0, text: 'Guter Start, zu viele Anrufe am Nachmittag.' }, { day: 1, text: 'Baustelle Nord läuft, Angebot bleibt offen.' }],
      nextId: 21,
      filter: null,
      area: 'todo',
      selectedDay: TODAY,
      evening: false,
      closed: null
    };
  }

  // Stresstest (nur über die Prototyp-Leiste): zusätzliche Aufgaben mit langen Namen
  function stressTasks(startId) {
    const texts = [
      'Nachunternehmer für den Innenausbau im dritten Obergeschoss anfragen und Angebote bis Ende der Woche vergleichen',
      'Vorlesungsfolien für die Einführungsveranstaltung aktualisieren (Teil 2: Methoden und Beispiele aus der Praxis)',
      'Versicherungsunterlagen für den Baustellencontainer heraussuchen und an die Maklerin schicken',
      'Zusammenfassung des Finanzierungsgesprächs an alle Beteiligten verschicken',
      'Prüfen, ob die Bauordnungsnovelle Auswirkungen auf den Dachgeschossausbau hat',
      'Elternabend-Termin mit den anderen Mentorinnen und Mentoren abstimmen',
      'Wartungsvertrag für die Heizungsanlage kündigen oder verlängern (Frist 31.10.)',
      'Fotos von der Baustelle sortieren und in den Projektordner legen',
      'Werkzeugliste für Abschnitt 3 ergänzen: Bohrhammer, Kernbohrgerät, Gerüstteile',
      'Dankesmail an die Sponsoren des Semesterfests',
      'Lesezeichen aus dem Browser in die Leseliste übertragen',
      'Jahresabschluss: fehlende Belege September nachreichen'
    ];
    const projects = ['ra', 'au', 'ra', 'ra', 'ra', 'au', 'pr', 'ra', 'ra', 'au', 'pr', 'pr'];
    return texts.map((text, i) => ({
      id: startId + i, text, project: projects[i], area: i % 3 === 0 ? 'todo' : 'next',
      due: i % 4 === 0 ? 2 : (i % 4 === 1 ? 3 : null), planned: i % 2 === 0 ? 2 : (i % 3 === 0 ? 3 : null),
      est: [15, 30, 60, null][i % 4], done: false, rolls: i === 5 ? 3 : 0, waiting: null, note: ''
    }));
  }

  return { TODAY, DAYS, DAY_LONG, CAPACITY_MIN, PROJECTS, AREAS, ESTIMATES, seed, stressTasks };
})();
