# Dali's Dashboard

**Stand: 17.10.2026 (abends)** · live: <https://darad11.github.io/dalis-dashboard/>

Persönliches Dashboard im Browser für den Tag und die Woche: Kalender, Wochenaufgaben, Ziele,
Fokus-Timer, Gesundheit mit Schritten aus Apple Health, Gewohnheiten und Listen. Es läuft auf
iPhone, iPad und Desktop im selben Look (iOS 26, „Liquid Glass“), speichert alles zuerst im
Gerät und gleicht es mit Supabase ab. Anmeldung mit E-Mail und Passwort oder per Magic Link;
über „Zum Home-Bildschirm“ läuft es wie eine App.

Diese Datei ist die Übersicht. Die Details stehen in den Dateien unter
[Dokumentation](#dokumentation).

## Die Seite auf einen Blick

Eine durchgehende Seite in sechs Abschnitten. Die Leiste unten zeigt, wo du gerade bist, und
springt per Tippen oder Klick zu einem Abschnitt.

| Abschnitt | Inhalt |
|---|---|
| **Home** | Begrüßung mit Datum und Uhr, Wetter (Open-Meteo, Ort frei wählbar), Termine von heute, Aufgaben der Woche (überfällige zuerst), Focus-Ziel und Ziele, Matrix-Zähler, Schritte, Habits – jede Karte führt in ihren Bereich ([HOME.md](docs/HOME.md)) |
| **Week** | Kalender: Monatsraster mit farbigen Punkten, daneben bzw. darunter die Einträge des Tages, österreichische Feiertage markiert; Uhrzeiten, eigene Kalender mit Farben ([CALENDAR.md](docs/CALENDAR.md)). Darunter **Weekly Overview & Tasks**: das Wochenboard Montag bis Sonntag, auf dem Handy als Tagesleiste mit einer Tageskarte pro Wisch |
| **Today** | **Today's Goals** mit Dringlichkeit; unerledigte Ziele der letzten 30 Tage rücken auf heute. **Focus-Timer** (Focus / Break / Long, Hintergrundgeräusche, Mini-Timer als Bild-im-Bild bzw. schwebend auf der Seite, Wochenstatistik, Focus Mode) |
| **Health** | **Step Challenge** ganz oben ([STEP_CHALLENGE.md](docs/STEP_CHALLENGE.md)), dann Streak, Wasser, Supplements, Ernährung und Training |
| **Habits** | Gewohnheiten im Wochenraster mit Auswertung, **Weekly Review** (Text je Woche) |
| **Lists** | **Matrix** mit to do, up next, waiting und ideas ([MATRIX.md](docs/MATRIX.md)), darunter die eigenen Listen |

## Bedienung

Ein Look auf jedem Gerät ([MOBILE.md](docs/MOBILE.md)); die Breite bestimmt nur die
Anordnung (unter 700 px eine Spalte, darüber mehrere, ab 1100 px das breite Home-Raster, ab
1376 px bleibt die Seite mittig).

- **Leiste oben:** **+** legt einen Kalendereintrag für heute an, **⋯** enthält Dark Mode, deinen
  Namen für die Begrüßung, Focus Mode, Keyboard Shortcuts (nur mit Maus oder Trackpad),
  Sync & Backup und Abmelden. Ein Punkt am ⋯ zeigt ausstehende Uploads (orange) oder einen
  Sync-Fehler (rot).
- **Leiste unten:** schwebende Glas-Kapsel; die Markierung folgt dem Scrollen. Ein Finger auf
  der Leiste hebt die Auswahl als Glas-Linse an, Ziehen wählt beim Loslassen.
- **Am Desktop minimiert sich die Leiste unten** beim Runterscrollen zu einem runden Knopf
  rechts unten mit dem Symbol des aktuellen Abschnitts (neu seit 17.10.2026). Sie kommt zurück
  beim Hochscrollen, ganz oben, per Klick auf den Knopf oder mit der Tab-Taste. Auf iPhone und
  iPad bleibt sie immer voll.
- **⋯ an jedem Eintrag:** Bearbeiten, Priorität bzw. Dringlichkeit, Verschieben, Löschen.
- **Finger:** Antippen hakt ab; **nach links wischen** zeigt ein rotes „Delete“ wie in iOS 26
  (ein voller Wisch löscht sofort, ohne Undo-Leiste).
- **Maus:** Doppelklick bearbeitet, Rechtsklick schaltet die Priorität weiter, Drag & Drop für
  Ziele, Wochenaufgaben (auch auf einen leeren Tag), Listeneinträge und Listen.
- **Eingaben** öffnen als Sheet von unten (✕ links, ✓ rechts), Rückfragen als iOS-Alert.
- **Barrierefreiheit:** Bedienelemente mindestens 44 × 44 pt, Dynamic Type in Safari,
  „Bewegung reduzieren“, „Kontrast erhöhen“; Text mit mindestens 4,5 : 1 Kontrast (bewusst
  kräftiger als einige Standardwerte von Apple).

### Tastenkürzel

| Taste | Wirkung |
|---|---|
| Leertaste | Focus-Timer starten / pausieren |
| R | Focus-Timer zurücksetzen |
| Q | neuer Eintrag (Kalender, heute) |
| F | Focus Mode |
| D | Dark Mode |
| ? | Kürzel anzeigen |
| Esc | Dialog schließen / Focus Mode beenden |

## Daten und Sync

- **Zuerst im Gerät:** Jede Änderung landet sofort im Browser (localStorage) und geht danach
  an Supabase. Offline bleibt alles erhalten und wird später hochgeladen.
- **Konflikte:** Hat sich die Cloud seit dem letzten Abgleich nicht geändert, wird die
  Änderung des Geräts hochgeladen. Hat sie sich geändert, gilt die Cloud, und die Kopie des
  Geräts bleibt als Sicherung (exportierbar) – mit Hinweis. Bei den Schritten gewinnt pro Tag
  die neueste Änderung.
- **Andere Geräte** sehen Änderungen sofort (Realtime), sonst beim nächsten Öffnen.
- **Backup:** ⋯ → Sync & Backup: Export und Import als Datei (ohne Anmelde-Token).

| Bereich | Supabase |
|---|---|
| Ziele und Kalendereinträge | Tabelle `goals` |
| Wochenboard | `kanban_tasks` |
| Weekly Review | `notes` |
| Habits | `habits`, Haken in `settings` (`habitChecks`) |
| Listen und Matrix | `lists`, Reihenfolge in `settings` (`customListsMeta`) |
| Kalenderliste, Name und Wetterort | `settings` (`calendars`, `home`) |
| Health Hub (Wasser, Supplements, Training …) | `settings` (`gymHubData`) – wird nur hochgeladen, nicht heruntergeladen (offen, siehe unten) |
| Schritte | `step_entries`; Einstellungen in `settings` (`stepChallenge`) |
| Upload-Schlüssel für Apple Health | `step_upload_tokens` (nur der Hash) |
| Pomodoro-Zähler, letztes Wetter | nur im Gerät |

## Schritte aus Apple Health

Eine Webseite kann Apple Health nicht lesen. Ein **iOS-Kurzbefehl** liest die Schritte des
Tages und schickt sie mit einem Upload-Schlüssel an die Supabase Edge Function `health-steps`;
eine App-Automation startet ihn (z. B. beim Öffnen einer oft genutzten App). Ein zweiter
Kurzbefehl schickt die Endsumme von gestern nach. Das funktioniert nur, solange der Kurzbefehl
auf dem iPhone eingerichtet ist und läuft – das Dashboard misst selbst nichts.

- Ein niedrigerer Wert ersetzt nie einen höheren; angenommen werden die letzten 31 Tage.
- Gespeichert wird nur der Hash des Schlüssels; er darf nur Schritte des eigenen Kontos
  schreiben und lässt sich jederzeit widerrufen.
- Auf dem echten iPhone bestätigt: Uploads über die App-Automation (16./17.10.2026). Der
  Nachtrag für gestern ist noch nicht auf dem echten iPhone bestätigt.
- Einrichtung Schritt für Schritt und Fehlersuche: [STEP_CHALLENGE.md](docs/STEP_CHALLENGE.md).

## Technik

- Kein Build-Schritt: `index.html`, Vanilla-JavaScript in `js/`, CSS in `css/`.
- Supabase (Datenbank mit Row Level Security je Nutzer, Auth, Realtime, eine Edge Function);
  `supabase-js` fest auf 2.117.2. Im Frontend steht nur der öffentliche Anon-Key – das ist
  so vorgesehen, der Schutz liegt in den RLS-Regeln. Der geheime Server-Schlüssel bleibt in
  der Edge Function.
- Veröffentlichung über **GitHub Pages aus `main`**; gearbeitet wird auf
  `claude/mobile-optimization`, `main` wird danach vorgespult. Neue Dateiversionen
  erzwingt `?v=…` in `index.html`.
- Datenbank-Änderungen liegen als idempotente Skripte in `migrations/` (eingespielt:
  Step Challenge, Kalender-Uhrzeiten, Apple-Health-Upload).

| Datei | Inhalt |
|---|---|
| `js/app.js` | Kern: Daten (`db`), Sync, Ziele, Woche, Kalender, Habits, Health Hub, Listen, Timer |
| `js/supabase.js`, `js/auth.js` | Cloud-Zugriff, Anmeldung |
| `js/mobile.js`, `css/mobile.css` | iOS-Look, Abschnittsleiste (Linse, Minimieren am Desktop), Menüs, Seite hinter einem Sheet festhalten |
| `js/home-core.js`, `js/home-ui.js`, `js/weather.js`, `css/home.css` | Home und Wetter |
| `js/calendar-core.js`, `js/calendar-ui.js`, `css/calendar.css` | Kalender-Regeln, Editor und die Sheets (`SheetUI`) |
| `js/matrix-core.js`, `js/matrix-ui.js`, `css/matrix.css` | Matrix |
| `js/steps-core.js`, `js/steps.js` | Step Challenge |
| `js/swipe.js`, `css/swipe.css` | Wischen zum Löschen |
| `js/data-utils.js` | Fingerabdrücke und Abgleich für den Sync |
| `supabase/functions/health-steps/` | Edge Function für den Kurzbefehl |

## Tests

Keiner der Tests spricht mit dem echten Supabase-Projekt ([tests/README.md](tests/README.md)).

| Suite | Ergebnis (17.10.2026) |
|---|---|
| Unit | 58 / 58 |
| Vertrag (Requests an Supabase, echte `supabase-js`) | 11 / 11 |
| E2E in Chromium mit Supabase-Mock | 52 / 52 |
| SQL (Migrationen gegen ein lokales PostgreSQL) | heute nicht ausgeführt; die Migrationen sind seit dem 16.10.2026 unverändert |

Alles läuft in Chromium mit Emulation von iPhone, iPad und Desktop – **nicht in Safari und
nicht auf echten Geräten**. Auf dem iPhone zu prüfen bleiben unter anderem: Glas-Darstellung
und Linse, Wischen zum Löschen, Tastatur in Sheets, Dynamic Type.

## Offen und Grenzen

Aus dem Code-Audit vom 16.10.2026 ([AUDIT.md](docs/AUDIT.md)), seitdem nicht bearbeitet:

- **Health Hub** wird nur hochgeladen, nie heruntergeladen: Jedes Gerät hat seinen eigenen
  Stand, der letzte Upload überschreibt die Cloud (P1-8).
- **Andere Wochen** (Board, Weekly Review) werden nicht aus der Cloud geladen (P1-9).
- **Offline-Start mit abgelaufener Anmeldung** zeigt den Login statt der lokalen Daten (P1-12).
- **Habit-Haken** hängen an der Position des Habits, nicht an seiner ID (P1-11, teilweise).
- **RLS in der echten Datenbank** für alle Tabellen prüfen, mit
  `migrations/2026-10-16_health_check.sql` (nur lesend); für `goals` am 16.10.2026 bestätigt
  (P1-14).
- Bleibt die Seite über Mitternacht offen, bleiben „Today's Goals“ und Heute-Markierungen
  auf dem Vortag; Home und die Step Challenge wechseln den Tag (P2-3).
- Pomodoro-Statistik nur im Gerät (P2-9); Abmelden lässt die Daten im Browser (P2-10).
- Der Keep-Alive-Workflow macht nur leere Commits: Supabase hält er nicht wach (pausiert laut
  Audit nach 7 Tagen ohne Zugriff), und GitHub Pages braucht ihn nicht (P2-12).

Weitere Grenzen:

- Kalender: keine Wiederholungen, keine mehrtägigen Termine, keine Erinnerungen, keine
  Verbindung zu Apple Kalender.
- Das iPad nutzt wie das iPhone die Leiste unten (iPadOS setzt Tab Bars sonst nach oben).
- Keine Haptik, keine echte Lichtbrechung von Liquid Glass im Web.
- Der Kreis der minimierten Leiste sitzt rechts; iOS legt ihn an den linken Rand.

**Sicherheit:** Im Code stehen keine geheimen Schlüssel (Suche am 17.10.2026; der öffentliche
Anon-Key gehört ins Frontend, in den Unit-Tests stehen nur Platzhalter). Eine frühere
Übergabedatei außerhalb des Repositorys nannte ein persönliches GitHub-Token; dessen Anfang
stand bis 17.10.2026 in `docs/AUDIT.md` und ist noch in der Git-Historie. Ist das Token noch
gültig, sollte es widerrufen und – falls nötig – mit minimalen Rechten und Ablaufdatum neu
erstellt werden.

## Dokumentation

| Datei | Thema |
|---|---|
| [docs/MOBILE.md](docs/MOBILE.md) | Ein Look für iPhone, iPad und Desktop: Leisten, Linse, Minimieren, Sheets, Wischen, Apple-Richtlinien, Prüfungen |
| [docs/HOME.md](docs/HOME.md) | Home und Wetter |
| [docs/CALENDAR.md](docs/CALENDAR.md) | Kalender mit Uhrzeiten und eigenen Kalendern |
| [docs/MATRIX.md](docs/MATRIX.md) | Matrix in Lists |
| [docs/STEP_CHALLENGE.md](docs/STEP_CHALLENGE.md) | Step Challenge und Apple Health per Kurzbefehl |
| [docs/AUDIT.md](docs/AUDIT.md) | Code-Audit vom 16.10.2026 mit offenen Punkten |
| [tests/README.md](tests/README.md) | Tests, Szenarien und Gegenproben |

Ein visueller Konzept-Prototyp mit Beispieldaten liegt getrennt auf dem Branch
`concept/visual-prototype` (nicht live, nicht mit echten Daten verbunden).

## Verlauf

**16.10.2026**

- Code-Audit; behobene Fehler, durch die Daten still verloren gehen konnten (offline,
  Fehler beim Abgleich); Tests für Logik, Requests, Datenbank und Oberfläche.
- Step Challenge im Health Hub.
- Layout für Handy, Tablet und iPhone Duo; durchgehende Seite mit Abschnittsleiste und
  Glas-Linse.
- Kalender mit Uhrzeiten und eigenen Kalendern (Datenbank-Migration eingespielt).
- Schritte aus Apple Health per Kurzbefehl, Nachtrag für gestern.
- Woche auf dem Handy als Tagesleiste mit einer Tageskarte pro Wisch.

**17.10.2026**

- Weiß als Kalenderfarbe; die Matrix in Lists.
- Sheets mit Tastatur öffnen an ihrem Platz, die Seite dahinter springt nicht mehr.
- Home als erster Abschnitt (Wetter mit Höchst- und Tiefstwert, Uhr neben dem Datum).
- Dark Mode ab dem ersten Bild.
- Wischen zum Löschen wie in iOS 26.
- Das iPad behält den Look auch quer; danach derselbe Look auch am Desktop.
- Am Desktop minimiert sich die Leiste unten beim Runterscrollen zu einem Kreis rechts unten.
