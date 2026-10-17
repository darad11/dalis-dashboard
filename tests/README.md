# Tests

Keine Abhängigkeiten im Dashboard selbst; die Tests nutzen nur Werkzeuge auf dem Entwicklungsrechner.
Keiner der Tests spricht mit dem echten Supabase-Projekt.

| Suite | Prüft | Befehl |
|---|---|---|
| Unit | Berechnungslogik Step Challenge (`js/steps-core.js`); Home (`js/home-core.js`: Begrüßung nach Uhrzeit, Termine mit Zustand und „nächster“, Aufgaben-Triage und Zähler, Focus der Ziele, Matrix-Zähler, Schritte, Habits, WMO-Wettercodes und Antwort von Open-Meteo, Einstellungen); Matrix (`js/matrix-core.js`: Platz unter den Listen, Bereiche umbenennen, Aufgaben prüfen, Abhaken und Wiederholung, Fälligkeitstext); Kalender-Regeln: Uhrzeiten, Kalender, Reihenfolge, Farben, Editor-Eingaben (`js/calendar-core.js`); Sync-Fingerabdruck mit Uhrzeiten (`js/data-utils.js`); Edge Function `health-steps` (Anfragen prüfen, Zahlen/Daten aus dem Kurzbefehl, Fehlerantworten nennen leere/fehlende Felder und was ankam, Aufruf der Datenbankfunktion, Antworten ohne interne Details) | `node --test "tests/unit/*.test.js"` |
| Vertrag | `js/supabase.js` erzeugt die erwarteten PostgREST-Requests (echte supabase-js, abgefangenes `fetch`), u. a. Uhrzeit-Spalten nur wenn gesetzt, `"HH:MM:SS"` → `"HH:MM"`, Upload-Schlüssel: nur der Hash wird gesendet und nie zurückgelesen | `npm install --no-save @supabase/supabase-js@2.117.2 && node --test "tests/contract/*.test.js"` |
| SQL | Migrationen (Step Challenge, Kalender-Uhrzeiten, Apple-Health-Upload), RLS, Trigger, Constraints, Rechte der Funktion `submit_health_steps` (nur `service_role`) gegen ein **lokales Wegwerf-PostgreSQL** | `tests/sql/run.sh "host=/tmp port=5432 user=postgres"` |
| E2E | Dashboard in Chromium mit In-Memory-Supabase-Mock (Step Challenge, Sync, bestehende Funktionen, durchgehende Seite mit Abschnittsleiste und Glas-Linse, Menüs, iPhone/iPhone-Duo/iPad-Layout, Kalender mit Uhrzeiten und eigenen Kalendern, Matrix, Sheets mit Tastatur, Home mit Wetter-Mock, Desktop unverändert) | `node tests/e2e/run.js` (optional Filter: `node tests/e2e/run.js foldable`) |

Voraussetzungen:
- Node.js ≥ 20 (Unit, Vertrag, E2E)
- E2E: Playwright inkl. Chromium (`npm install --no-save playwright && npx playwright install chromium`
  oder eine globale Installation)
- SQL: PostgreSQL ≥ 14 lokal; das Skript legt eine temporäre Datenbank an und löscht sie wieder.
  `tests/sql/supabase-shim.sql` bildet nur die benötigten Supabase-Teile nach (Rollen, `auth.uid()`).

E2E-Hinweise:
- `tests/e2e/demo-data.js` füllt den In-Memory-Mock mit Beispielinhalten (Ziele, Woche, Habits,
  Listen) für Layout-Tests – nie die echte Datenbank.
- Jedes Szenario bekommt einen **neuen** In-Memory-Store, keinen zurückgesetzten: Eine Anfrage,
  die eine gerade geschlossene Seite noch abgeschickt hat, steckt beim Szenariowechsel noch in der
  simulierten Latenz und landete sonst in den Daten des nächsten Szenarios (so fehlte in
  `6 year change` gelegentlich das Setup-Formular: die Step-Challenge-Einstellung aus
  `5 day change…` kam dort an).
- Woche auf dem Handy: Gemessen wird erst, wenn die Zeile mit den Tageskarten steht (6 Bilder lang
  unverändert). Eine Karte liegt schon ganz im Bild, während das Einrasten noch die letzten Pixel
  gleitet – beim Sprung über sechs Tage (Montag → Sonntag) maß der Test sonst gelegentlich mitten
  in der Bewegung (2 von 6 Läufen „Sunday aligned too“ mit 2 bzw. 10 px Versatz; danach 10 von 10 grün).
- `scroll: a short last section…` braucht einen kurzen Lists-Abschnitt: Die Matrix steht in der App immer
  dort, für diese Prüfung wird ihr Panel nach dem Leeren der Listen entfernt.
- Touch-Geräte werden mit `isMobile` + `hasTouch` emuliert (`pointer: coarse`, `hover: none`).
  Keine `fullPage`-Screenshots in diesen Tests: Chromium verliert dabei die Touch-Emulation
  (`pointer: coarse` wird falsch); für lange Seiten den Viewport vergrößern.
- `store.healthUpload(token, date, steps)` spielt die Edge Function `health-steps` samt
  `submit_health_steps` nach (Upload aus dem Kurzbefehl, „niedriger ersetzt nie höher“).
- Das iPhone Duo wird über geschätzte Viewports simuliert (466×678 zugeklappt, 890×626
  aufgeklappt); Auf-/Zuklappen = `page.setViewportSize`.
- Der Mock gibt Zeitspalten wie Postgres zurück (`"10:00:00"`); `store.missingColumns`
  simuliert eine Datenbank ohne Migration (PostgREST-Fehler `PGRST204`).

Szenarien für Apple Health, Handy/Tablet und Kalender (`tests/e2e/run.js`):

| Szenario | Prüft |
|---|---|
| `16 Apple Health: upload key…` | Schlüssel entsteht im Browser (43 Zeichen), in der Cloud nur der SHA-256-Hash, nicht im localStorage; Kopieren; Upload des Kurzbefehls erscheint sofort (Realtime), niedrigerer Wert ändert nichts; „Done“ vergisst den Schlüssel, Status „last upload today, 10:10“; Liste unter „Manage“; Widerrufen mit Rückfrage, danach wird der Schlüssel abgelehnt, Schritte bleiben |
| `17 Apple Health without the database update…` | ohne Migration klarer Hinweis, kein Schlüssel erzeugbar, manuelle Eingabe und Upload laufen weiter |
| `setup: a rebuild while typing…` | Neuaufbau der Schritte-Karte (Daten von einem anderen Gerät) während des Tippens: Auswahl und Cursor bleiben, Tippen ersetzt den markierten Vorschlag (vorher hing es ihn an, z. B. `4.018.4052.233.411`; daran scheiterte `7+8` gelegentlich, wenn der erste Sync während `page.fill` fertig wurde) |
| `scroll: phones show one continuous page…` | alle Abschnitte sichtbar in der Reihenfolge Week → Lists; Kalender direkt unter der Leiste oben, dann Weekly Overview, Today's Goals, Focus (auf dem Bildschirm und im DOM, Leiste unten in derselben Reihenfolge), Markierung folgt dem Scrollen, Antippen springt (Fokus wandert mit), „+“/„⋯“ oben, Dark Mode aus dem Menü, Bedienelemente ≥ 44 pt |
| `phones: the calendar stands first already while the scripts load` | Reihenfolge steht schon, solange die Skripte am Seitenende noch laden (Supabase-Skript zurückgehalten) – kein Umspringen |
| `dark mode shows from the first paint…` | `darkMode` gespeichert, Supabase-Skript zurückgehalten: `body.dark`, schwarzer Hintergrund und dunkle `theme-color` stehen, bevor die Skripte am Seitenende laufen, und bleiben nach Anmeldung und Sync; ohne Einstellung bleibt die Seite hell |
| `scroll: a short last section…` | Seitenende markiert den kurzen letzten Abschnitt; ein gewählter Abschnitt bleibt markiert |
| `scroll: the steps link and #section- links…` | `?steps=` öffnet Health, `#section-lists` öffnet Lists |
| `section bar: a finger lifts the selection…` | Glas-Linse: hebt sich beim Berühren (größer als die Leiste, Leiste wächst), nur Dekoration (`aria-hidden`, keine zusätzlichen Links), folgt beim Ziehen dem Finger, wählt erst beim Loslassen (Sprung + Fokus), fällt in die Markierung zurück; kurzes Ziehen auf dem gewählten Abschnitt springt nicht (auch nicht durch den Klick, den Chromium danach schickt); Abbruch durch das System wählt nichts; Tipp ans runde Ende wählt den nächsten; Tastatur ohne Linse |
| `section bar: with Reduce Motion…` | Linse hebt sich weiter, aber Leiste wächst nicht, kein Nachschwingen/Dehnen |
| `touch: menus replace hover…` | Menü am Knopf, Untermenüs, Escape/Tipp daneben schließt ohne Aktion, Fokus zurück (und bleibt dort, wenn die Liste neu aufgebaut wird), Verschieben (Tag, Liste), Editor aus der Tagesliste, Rückfrage mit „Delete“ |
| `foldable: …` | Leseposition beim Auf-/Zuklappen (der in der Tagesleiste gewählte Samstag bleibt an seiner Stelle und bleibt nach dem Zuklappen der gezeigte Tag), offenes Menü bleibt im Bild, iPad quer = Desktop mit Desktop-Reihenfolge (Focus, Ziele, Woche, Kalender) und zurück, der Fokus auf „+ Add Goal“ bleibt |
| `calendar on phones: …` | farbige Punkte, Tagesliste mit Zeiten, neuer Eintrag mit Uhrzeit in eigenem Kalender (Upload `16:30:00`), Dauer bleibt beim Verschieben des Beginns, Ende vor Beginn gesperrt, „Discard Changes“, Monatswechsel am 31. |
| `calendar: white as a calendar colour…` | Weiß als letzte Farbe in der Liste, neuer Kalender in Weiß (Upload `white`), Eintrag hineinverschoben; weiße Punkte in Monatsraster, Tagesliste, Tagesleiste und Tageskarte mit grauem Rand (hell), rein weiß im Dark Mode; Desktop: Punkte im Monatsraster und auf der Karte ebenso |
| `calendar: own calendars … (desktop)` | Kalender anlegen, Eintrag mit Zeit/Kalender/Priorität, Sortierung, Woche, Datum ändern = verschieben, Kalender löschen → Standardkalender, Löschen mit Rückfrage |
| `calendar: without the database migration…` | Eintrag mit Uhrzeit bleibt lokal (Fehler sichtbar), Tage ohne Uhrzeit laufen weiter, nach Migration hochgeladen |
| `week on phones: day strip…` | Tagesleiste (7 Tage, heute markiert, Punkte in Kalenderfarben + grau für offene Aufgaben, VoiceOver-Texte), genau ein Tag auf dem Bildschirm, bündig mit dem Panel darüber und ohne hereinschauende Nachbarn (Freitag, Samstag, Sonntag), Zeile so hoch wie dieser Tag (weniger als halb so hoch wie alle Tage untereinander); Wischen → nächster Tag; Tipp in der Leiste → Montag; neue Aufgabe dort lässt die Zeile wachsen; nächste Woche behält den Wochentag, „Today“ springt zurück; aufgeklappt: Spalten ohne Leiste und ohne feste Höhe |
| `health hub: Step Challenge first…` | Handy/Tablet: Step Challenge direkt unter „Health Hub“, über der Hero-Zeile; KPI-Zahlen („1.794.994“) einzeilig und innerhalb ihrer Kachel; Desktop unverändert darunter; iPad hochkant ↔ quer verschiebt die Karte hin und zurück, der Fokus im Eingabefeld bleibt |
| `habits: "+ New Habit" keeps a gap…` | ≥ 16 px Abstand zu den Wochentagen (Desktop und Handy) |
| `matrix on phones: …` | Matrix ganz oben in Lists, vier Bereiche, erst mit der ersten Änderung gespeichert; „+“: Text, Notiz, Today, Repeat weekly (Upload mit allen Feldern); gleicher Text in „to do“ eigene Aufgabe; Abhaken: wiederholte springt eine Woche weiter, andere erledigt und aus der Karte; Bereich: Zahl, Completed (wieder öffnen), Umbenennen mit Stift (Upload), Escape bricht nur das Umbenennen ab, großer Knopf fügt hinzu; Bearbeiten: Bereich wechseln, Löschen mit Rückfrage; ⋯ Move Down / Move Up (Reihenfolge in der Cloud); alle Bedienelemente ≥ 44 pt |
| `matrix: the same text in several areas survives a merge…` | zweimal „test“ aus der Cloud, offline ein drittes „test“ in waiting, danach Sync mit Zusammenführen → drei Aufgaben in drei Bereichen |
| `sheets on phones: a new entry gets the keyboard where its field stays…` | Matrix „+“ (weit unten in Lists) und Kalender „New Event“: das Textfeld ist beim Fokus schon auf dem Bildschirm und bleibt dort (Sheet blendet an seinem Platz ein), Tippen landet im Feld; die Seite dahinter springt beim Öffnen nicht, die Leiste oben bleibt oben, ein Scrollen durch den Browser (wie iOS zum Feld) bewegt sie nicht; nach dem Schließen dieselbe Scrollposition und derselbe Abschnitt; Bearbeiten ohne Tastatur gleitet weiter hoch; Aufgaben-Sheet über dem Bereichs-Sheet: Seite bleibt fest, bis das letzte Sheet zu ist; Lists in der unteren Bildschirmhälfte: die Abschnittsleiste wechselt beim Öffnen und Tippen nicht |
| `foldable: unfolding while a sheet is open…` | Samstag 120 px unter dem Rand, dann Kalenderliste (ohne Tastatur) offen und aufklappen bzw. neuer Termin (mit Tastatur) offen und zuklappen: Samstag bleibt hinter dem Sheet und nach dem Schließen an seiner Stelle |
| `matrix on the desktop: …` | Aufgaben aus der Cloud ohne gespeicherten Platz kommen an; Matrix über die ganze Breite, zwei Spalten; Dialog, Enter fügt hinzu (Seite dahinter wird am Desktop nicht festgehalten), danach Fokus wieder auf dem „+“ der neu gezeichneten Karte; per Drag & Drop ans Ende der Listen |
| `home on phones: …` | Seite öffnet auf Home; „Good morning, Dali.“, „Friday, 16 October“ und die tickende Uhr daneben (keine zweite Uhr mehr über den Zielen); Termine von heute in Kalenderreihenfolge; Aufgaben: überfällig (Mi) zuerst, heute nach Priorität, Samstag danach, Zähler und Wochenstand; Abhaken in Home → Board in der Cloud und im Week-Abschnitt erledigt, Zähler folgen, erledigte zuletzt; Focus = erstes offenes Ziel (Kreis und Text in einer Spalte mit den übrigen Zielen, „FOCUS“ bündig mit den Kreisen), Abhaken rückt nach und erscheint in der Zielliste, „+“ legt ein Ziel an; Habit-Chip hakt heute ab (Upload `habitChecks`, Raster zeigt Freitag); Matrix: Zähler, frühester Termin je Bereich, überfällig rot, Kachel öffnet das Bereichs-Sheet; Steps „8.420 steps“, „Target 23.312“, „14.892 to go“, Balken 36 %, „Year 56 % · …“; Kartenköpfe: alle Links gleich breit und rechtsbündig, alle „+“ in einer Spalte (VoiceOver liest nur das eigene Label); Links springen zu Week/Habits, ein Termin öffnet den Kalender-Editor; ⋯ › „Your Name…“ (mit dem Namen als Untertitel) ändert den Namen (Begrüßung und Cloud); alle Bedienelemente ≥ 44 pt, kein Überlauf |
| `home with empty data: …` | ohne Daten: „Good morning.“ / „Add your name“, „No events today.“, „No tasks this week yet.“, „What do you want to accomplish today?“, Matrix 0/0/0/0, Steps-Hinweis statt Zahl, keine Habits-Karte, Wetter „Set location“; „+“ bei Today öffnet den Editor für heute, „+“ bei Tasks legt in der Spalte von heute an (Cloud und Board); Steps-Link führt zu Health; 19:30 Uhr → „Good evening.“ |
| `home: weather …` | Ortssuche im Sheet (Geocoding-Mock, „Wien, Österreich“), Wetterkarte „14°“, „Partly cloudy“, „H:14° L:6°“, 07:21/18:12; genau eine Anfrage mit nur Koordinaten und den dokumentierten Parametern; Ort in der Einstellung `home` (gerundet); Reload zeigt den Cache ohne neue Anfrage; offline bleibt die letzte Antwort mit „Offline · from hh:mm“, online erneut geholt; Fehler 500 → „Could not update · from hh:mm“, neuer Ort ohne Cache → „could not be loaded“ + Retry (kein erfundener Wert); „Remove location“ → leere Karte |
| `home follows changes …` | Abhaken im Week-Abschnitt, Ziel im Goals-Abschnitt, Habit-Haken von einem anderen Gerät (Realtime) → Home folgt; nach Reload dasselbe Bild |
| `home on the desktop: …` | `#section-home` zuerst, keine Leiste; Today + Tasks in einer Zeile, Goals + Matrix + Steps in einer, Habits darunter; Leertaste hakt ab, Fokus bleibt, Focus-Timer startet nicht; Links scrollen zu Week und Lists |

Gegenproben (Fehler absichtlich eingebaut, Test muss rot werden): Schließen des Editors am
Desktop, Seitenende-Regel, gewählter Abschnitt am Seitenende, alter Habit-Abstand,
fehlende Umrechnung `"HH:MM:SS"` (Vertragstest); Glas-Linse: ohne Klick-Unterdrückung nach dem
Ziehen, ohne Prüfung „schon gewählt“, ohne Tipp-Ersatz an den Enden, Leiste wächst trotz
„Bewegung reduzieren“, ohne Abbruch-Behandlung (`pointercancel` und `lostpointercapture`);
Today's Goals ohne Fokus-Erhalt beim Neuaufbau der Liste.
Schritte-Karte: Cursor nach dem Neuaufbau wieder ans Ende (alte Logik) → `setup: a rebuild while typing…` rot.
Health Hub: ohne Verschieben der Karte bzw. ohne Fokus-Erhalt → `health hub: Step Challenge first…` rot; alte
KPI-CSS (`overflow-wrap: anywhere`) → dieselbe Szene rot („1.794.99“ / „4“).
Weiß als Kalenderfarbe: ohne die Rand-Regel in `css/calendar.css` → `calendar: white…` rot (Punkte ohne Rand).
Matrix: Zusammenführen wieder über den Text → `matrix: the same text…` rot; Download nur für gespeicherte Listen → `matrix on the desktop` rot; Escape ohne Abfangen im Umbenennen-Feld (schließt das Sheet) → `matrix on phones` rot. Ohne Zurückgeben des Fokus an das neu gezeichnete „+“ → `matrix on the desktop` rot.
Sheets und Tastatur (vor der Korrektur rot: Feld beim Fokus bei y = 939 px auf 852 px Höhe; Seite hinter dem Sheet um 600 px verschiebbar und danach dort):
Fokus wieder während des Hochgleitens → `sheets on phones…` rot (Feld unter dem Bildschirm); ohne `lockPage` → rot („cannot be scrolled“) und
`foldable: unfolding while…` rot; ohne `top`-Ausgleich → rot (Sprung beim Öffnen); ohne Sperre des Scroll-Spy → rot (Leiste wechselt);
ohne Zurückscrollen → beide rot; Freigabe schon beim ersten geschlossenen Sheet → rot („still held under the area sheet“);
Leseposition ohne Rücksicht auf die festgehaltene Seite bzw. wie vorher übersprungen, wenn ein Feld im Sheet den Fokus hat → `foldable: unfolding while…` rot
(Samstag bei 30 px bzw. 210 px; der Originalcode: 298 px).
Dark Mode beim Start: ohne das Inline-Skript am Anfang von `<body>` (alter Stand) → `dark mode shows from the first paint…` rot („dark before the scripts run“).
Home: überfällige Aufgaben nicht zuerst → `home on phones` rot; Ort ungerundet gespeichert → `home: weather` rot (Einstellung passt nicht); Leertaste ohne Abfangen (Focus-Timer startet statt abzuhaken) → `home on the desktop` rot; `db.set` ohne Änderungsmeldung → `home follows changes` rot (Home folgt erst nach dem Echo der Cloud, über 5 s); Wetter-Cache beim Laden ignoriert → `home: weather` rot („no second request while fresh“); Matrix-Kachel ohne Öffnen → `home on phones` rot. Focus-Kasten ohne Ausgleich nach außen bzw. „FOCUS“ wieder auf den Text eingerückt → `home on phones` rot (Kreise bei 33/21/21 px bzw. 33 px Versatz). Links ohne gemeinsame Breite (jeder nur so breit wie sein Label) → `home on phones` und `home on the desktop` rot (Breiten 101/74/… px, „+“ bei 109/82 px vom Rand).
Reihenfolge auf Handy/Tablet: ohne Aufruf vor dem ersten Zeichnen → `phones: the calendar stands first…` rot; ohne Fokus-Erhalt beim Verschieben → `foldable…` rot; Kalender mit altem Abstand oben bzw. Leiste noch mit Today zuerst → `scroll: phones…` rot.
Woche auf dem Handy: ohne Höhenanpassung → `week on phones…` rot; Leseposition ohne die Regel für seitlich
weggewischte Karten → `foldable…` rot (Samstag landet nach dem Aufklappen bei 336 px statt 120 px).
`openDashboard` nimmt dafür zusätzlich `reducedMotion` an.
Apple Health: Klartext-Schlüssel statt Hash gespeichert, Schlüssel nach „Done“ noch sichtbar,
keine Aktualisierung von „last upload“ nach einem Upload (E2E); „niedriger ersetzt nie
höher“ entfernt, Funktion für API-Rollen aufrufbar, Schlüssel-Limit entfernt, Schutz gegen
vorgehende Geräteuhr entfernt (SQL).
Fehlerantworten der Edge Function: alte Fassung (nur „date must be a day like …“) → Unit-Test
„error answers say what arrived“ rot; ebenso der Hinweis bei leerem Datum aus Version 3 (nennt
nur „Aktuelles Datum“, nicht „Angepasstes Datum“ für den Kurzbefehl für gestern).
Testumgebung: Seite schließt, während ihre Einstellungs-Anfrage noch läuft (nachgestellt mit 300 ms
Latenz) → mit dem alten `env.store.reset()` steht die Einstellung danach im nächsten Szenario und
das Setup-Formular fehlt; mit einem neuen Store pro Szenario bleibt es leer.
