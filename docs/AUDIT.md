# Code-Audit Dali's Dashboard – 16.10.2026

Grundlage: Commit `018db37` (`main`). Gelesen: `index.html`, `css/style.css`, `js/app.js`,
`js/auth.js`, `js/supabase.js`, beide SQL-Migrationen, `.github/workflows/keep-alive.yml`.
Verifiziert im echten Chromium mit gemocktem Supabase (Playwright), SQL gegen lokales
PostgreSQL 16, Request-Format gegen die echte supabase-js 2.117.2. **Kein Zugriff auf die
Produktivdatenbank** – alles, was dort liegt (RLS-Status, Duplikate), ist mit
`migrations/2026-10-16_health_check.sql` (nur lesend) selbst zu prüfen.

## Kurzfazit

Die Grundidee (local-first, Dirty-Flags, RLS pro Nutzer, kein Build) ist richtig und für
ein persönliches Dashboard gut gewählt. Die Sync-Logik hatte aber mehrere Pfade, auf denen
**Daten still verloren gingen** – genau in den Situationen, für die local-first gedacht ist
(offline, pausiertes Supabase, App im Hintergrund beendet). Diese P0-Fehler sind behoben und
mit Tests abgesichert. Größte offene Punkte: Health-Hub-Daten synchronisieren nur in eine
Richtung (P1-8), andere Wochen werden nicht aus der Cloud geladen (P1-9), Offline-Start nach
Token-Ablauf (P1-12). Das mobile Layout (P2-6) ist inzwischen überarbeitet, siehe
[`MOBILE.md`](MOBILE.md).

## Datenbereiche: Speicherung und Synchronisierung

Stand vor den Änderungen; Spalte „jetzt“ nennt die Änderung.

| Bereich | localStorage | Cloud | Upload | Download | Probleme (vorher) | jetzt |
|---|---|---|---|---|---|---|
| Tagesziele | `goals-J-M-T` (Monat 0-basiert!) | `goals` | sofort, delete+insert | alle (Phase 2) | Offline-Verlust, Prune bei Fehler, Rennen | behoben |
| Kalender | `cal-J-M-T` | `goals` | nur über Kalender-„+“; Quick Capture & Wochen-Kanban **nie** | alle | nie hochgeladen → nach Reload weg | behoben |
| Wochenreview | `review-J-Wn` | `notes` | sofort (500 ms Debounce) | nur aktuelle Woche | andere Wochen nicht geladen | Key-Fix Jahreswechsel; P1-9 offen |
| Notizen (UI entfernt) | `notes-…` | `notes` | sofort | nur heute | – | – |
| Wochen-Kanban | `week-J-Wn` | `kanban_tasks` | sofort, delete+insert | nur aktuelle Woche | andere Wochen; Jahreswechsel-Key | Key-Fix; P1-9 offen |
| Backlog (UI entfernt) | `backlog` | `backlog_tasks` | sofort | ja | – | – |
| Habits | `habits` | `habits` | select/delete/update/insert | Merge nach Name | IDs nie lokal gespeichert (Churn) | IDs werden gespeichert |
| Habit-Häkchen | `habitsData-J-Wn-hX-dY` + Blob `habitChecks` | `settings.habitChecks` | sofort | ja | Fehler → `{}` überschrieb Cache | behoben; Index-Kopplung offen (P1-11) |
| Listen | `customListsMeta`, `list-<id>` | `settings`, `lists` | sofort | Merge | Dirty-Flag bei Fehler gelöscht | behoben |
| Health Hub (Training, Makros, Wasser, Supplements, Streak) | `gymHubData` | `settings.gymHubData` | sofort | **nie** | Geräte divergieren | Upload-Bookkeeping behoben; Download offen (P1-8) |
| Pomodoro-Zähler | `pomo-J-M-T`, `pomoSessions` | (`pomodoro_stats` ungenutzt) | – | – | nur lokal | offen (P2-9) |
| UI-Zustände | `darkMode`, `*Collapsed`, `statsOpen`, `gymHubOpen` | – | – | – | `gymHubOpen` erzeugte dauerhaft „Pending“ | behoben |
| **Step Challenge (neu)** | `stepChallenge.v1.<uid>.*` | `step_entries`, `settings.stepChallenge` | pro Tag, LWW | ja + Realtime | – | neu |

## Befunde

Aufwand: S ≤ 1 h, M ≈ ½ Tag, L ≥ 1 Tag. Risiko = Risiko der Änderung.

### P0 – Kritisch (Datenverlust)

| ID | Problem | Auswirkung | Lösung | Aufwand / Risiko | Status · Nachweis |
|---|---|---|---|---|---|
| P0-1 | Phase 0 von `loadFromCloud` löschte jedes Dirty-Flag aus einer früheren Sitzung; danach überschrieb bzw. löschte der Pull die lokalen Daten. | Offline oder bei Fehler gemachte Änderungen verschwinden beim nächsten Öffnen still. | Fingerprint des zuletzt synchronisierten Cloud-Stands (`synced_<key>`). Unveränderte Cloud → lokale Änderung wird hochgeladen; geänderte Cloud → Cloud gewinnt wie bisher, lokale Kopie in `syncBackups` (exportierbar) + Hinweis. | M / mittel | **behoben** · E2E „sync fixes“ (vorher reproduziert: Offline-Ziel nach Reload weg) |
| P0-2 | Getter lieferten bei Fehlern leere Daten (`{}`); Prune löschte daraufhin alle lokalen Ziele/Kalendertage. `habitChecks` wurde durch `{}` ersetzt. | Bei pausiertem Supabase oder Netzfehler leeren sich Ziele und Kalender; Habit-Historie in der Cloud kann zerstört werden. | Getter liefern `null` bei Fehlern; betroffene Bereiche werden übersprungen, Fehler angezeigt. | S / niedrig | **behoben** · E2E + Vertragstest (vorher reproduziert) |
| P0-3 | Quick Capture (Q, „+“) und Bearbeiten/Priorität/Löschen/Verschieben von Kalenderaufgaben im Wochen-Kanban schrieben nur lokal; Phase 1 ließ `cal-`-Keys aus. | Diese Änderungen erreichen nie die Cloud und sind nach dem nächsten Laden weg. | Alle Pfade über `setCalendarTasks`; Phase 1 lädt auch `cal-`-Keys hoch. | S / niedrig | **behoben** · E2E (vorher reproduziert) |
| P0-4 | `setListItems` löschte das Dirty-Flag auch bei Upload-Fehler. | Fehlgeschlagene Listenänderungen werden nie wiederholt und später überschrieben. | Einheitliches `pushKey`/`afterPush`: Flag nur nach bestätigtem Upload und nur, wenn sich der Wert währenddessen nicht geändert hat. | S / niedrig | **behoben** · Code + E2E |

### P1 – Hoch

| ID | Problem | Auswirkung | Lösung | Aufwand / Risiko | Status |
|---|---|---|---|---|---|
| P1-1 | Schreibvorgänge desselben Schlüssels liefen parallel (delete+insert bzw. select+insert); `settings`/`notes`/`lists` ohne Unique-Index. | Doppelte oder wiederauftauchende Ziele; doppelte Settings-Zeilen ließen `.single()` scheitern → Einstellungen wirkten „leer“, jeder Save fügte eine Zeile hinzu. | Serialisierung pro Schlüssel in `supabase.js`; „update all, insert if none“; Lesen toleriert Duplikate. Unique-Indizes optional (Health-Check-SQL). | S / niedrig | **behoben** · Vertragstest inkl. Mutationstest |
| P1-2 | `init()` lief doppelt (DOMContentLoaded + Login). | Tastatur-Listener doppelt: **Space und D wirkungslos**, parallele Syncs. | Einmal-Setup mit Guard; Sync serialisiert. | S / niedrig | **behoben** · mit 300 ms Auth-Latenz reproduziert, E2E |
| P1-3 | Zwei Supabase-Clients auf demselben Session-Speicher. | Konkurrierende Token-Refreshes möglich (Abmeldungen). | Ein gemeinsamer Client. | S / niedrig | **behoben** |
| P1-4 | `innerHTML` mit Nutzertext (Listentitel, Habit-Namen, Supplements, Trainingsziele, Benachrichtigungen). | Skriptausführung durch Titel oder importierte Backups. | Escaping bzw. DOM-APIs; keine Nutzertexte mehr in Inline-Handlern. | S / niedrig | **behoben** · E2E mit `<img onerror>`-Titel |
| P1-5 | `loadGymData` stürzte an nicht mehr existierenden Feldern ab. | Health Hub lud Wasser/Streak/Trainingsziele nicht; Wasser nach Reload 0 und der nächste Klick überschrieb den Tageswert. | Null-sichere Felder; Hero-Werte beim Start laden; Wasser immer vom gespeicherten Wert fortschreiben. | S / niedrig | **behoben** · reproduziert, E2E |
| P1-6 | Export/Import/Reset im UI nicht erreichbar (Übergabe-Doku beschreibt Buttons, die es nicht gibt); Export enthielt Login-Token; Import wurde beim nächsten Laden von der Cloud überschrieben. | Kein funktionierendes Backup. | Sync-&-Backup-Panel; Export ohne `sb-*`; Import validiert, behält Login, lädt hoch. | M / niedrig | **behoben** · E2E |
| P1-7 | Sync-Anzeige: lokale UI-Keys dauerhaft „Pending“, Upload-Fehler nicht angezeigt, kein Retry. | Anzeige unglaubwürdig, echte Probleme fallen nicht auf. | Nur synchronisierbare Keys zählen, Fehler anzeigen, Retry bei „online“ und beim Zurückkehren in die App, Offline-Meldung. | S / niedrig | **behoben** |
| P1-8 | `gymHubData` wird hochgeladen, aber nie heruntergeladen. | Jedes Gerät hat seinen eigenen Health-Hub-Stand; der letzte Upload überschreibt die Cloud. | Download mit einmaligem Merge (Vereinigung von Trainingstagen/Supplements je Tag) und danach Fingerprint-Regeln wie P0-1. | M / mittel | **offen** – braucht Merge-Entscheidung |
| P1-9 | Kanban/Review/Notizen anderer Wochen werden nicht aus der Cloud geladen. | Bearbeiten einer anderen Woche auf Gerät B überschreibt den Cloud-Stand von Gerät A. | Beim Wochenwechsel Cloud-Stand laden (nur wenn lokal nicht dirty). | M / niedrig | **offen** |
| P1-10 | Realtime-Events innerhalb von 5 s nach lokaler Änderung wurden verworfen. | Änderungen anderer Geräte fehlen bis zum Reload. | Verschieben statt verwerfen; ein gemeinsamer Refresh. | S / niedrig | **behoben** |
| P1-11 | Habits: IDs neuer Habits nie lokal gespeichert; Häkchen hängen am Index (`hX`). | Churn in der Cloud; Löschen eines Habits verschiebt die Historie aller folgenden. | IDs speichern (**behoben**); Häkchen an Habit-ID statt Index binden (Datenmigration). | M / mittel | teilweise |
| P1-12 | Offline-Start mit abgelaufenem Access-Token zeigt den Login statt der lokalen Daten. | Offline-first gilt nur, solange das Token (1 h) gültig ist. | Gespeicherte Session bei Netzfehler als Offline-Modus akzeptieren. | M / mittel | **offen** |
| P1-13 | supabase-js ungepinnt (`@2` → aktuell 2.118.0 vom 15.10.). | Jede neue Version geht ungeprüft live. | Auf 2.117.2 gepinnt (explizite Datei). | S / niedrig | **behoben** |
| P1-14 | Schema nicht versioniert (Tabellen-DDL fehlt), keine Unique-Constraints, `ENABLE ROW LEVEL SECURITY` nicht im Repo belegt. | Sicherheitsstatus nicht nachprüfbar. | `migrations/2026-10-16_health_check.sql` ausführen; ggf. Unique-Indizes. | S / niedrig | **zu prüfen** |
| P1-15 | Weekly Review speichert 500 ms verzögert; ein Neuladen des Felds (Wochenwechsel, zweites `init()` nach Login, Schließen) verwarf den Text bzw. ordnete ihn der falschen Woche zu. | Gerade getippte Reflexion geht verloren. | Ausstehenden Text vor jedem Neuladen und bei `pagehide` der Woche zuordnen, in der er getippt wurde. | S / niedrig | **behoben** · E2E (gegen alten Stand rot) |

### P2 – Mittel

| ID | Problem | Lösung | Status |
|---|---|---|---|
| P2-1 | Wochen-Keys mit Kalenderjahr: 28.12.2026–03.01.2027 wechselte am 1.1. auf `week-2027-W53` (Kanban, Review, Häkchen „verschwinden“). | ISO-Wochenjahr. Folge: Ansichten früherer Jahreswechselwochen zeigen den Januar-Teil; nichts wird gelöscht. | **behoben** |
| P2-2 | Habit-Analytics rechnete Wochen anders als die Speicherung (falsch ab 2027). | Gleicher Schlüssel wie das Raster. | **behoben** |
| P2-3 | Bleibt die App über Mitternacht offen, bleiben „Today's Goals“, Rollover und Heute-Markierungen auf dem Vortag. | Tageswechsel-Handler wie in der Step Challenge. | offen |
| P2-4 | Uneinheitliche Datumsformate (0-basierter Monat ohne Nullen, ISO, UTC-`rolledFrom`). | Bei nächster Migration vereinheitlichen. | offen |
| P2-5 | ~1.000 Zeilen toter Code + CSS (Sleep, PR, Maße, Weekly Goals, Rest-Timer, Quick Notes, Backlog, Monkey-Patching von `saveGymData`/`loadGymData`). | Entfernen in eigenem Schritt. | offen |
| P2-6 | Mobil: Titel liegen unter den Navigationsbuttons (Weekly Overview, Kalender), FAB verdeckt Inhalte, Kalender als ~3.000 px lange Liste, Kanban-Schrift 0,55 rem, Touch-Ziele < 44 px; Habits zwischen 769 und 900 px als bildschirmbreite Kreise (Seite > 20.000 px hoch, betrifft auch das aufgeklappte iPhone Duo). | Tab-Layout für Touch-Geräte < 1100 px (seit 17.10.2026 ohne Breitengrenze, auch iPad quer), Monatsraster + Tagesliste, Touch-Ziele ≥ 44 px (siehe `MOBILE.md`). | **behoben** |
| P2-7 | Barrierefreiheit: klickbare `div`s ohne Tastatur, Dialoge ohne `role="dialog"`/Fokusführung, Bearbeiten nur per Doppel-/Rechtsklick (auf Touch nicht erreichbar). | Touch: sichtbare „⋯“-Aktionen; Habit-Häkchen als Checkbox mit Tastatur; Dialog-Rollen; Aktionsmenü mit Fokusführung. Eingabedialoge noch ohne Fokusfalle. | teilweise |
| P2-8 | Sync über `confirm`/`prompt` („download“ eintippen). | Sync-&-Backup-Panel. | **behoben** |
| P2-9 | Pomodoro-Statistik nur lokal (`pomodoro_stats` ungenutzt). | Anbinden oder Tabelle entfernen. | offen |
| P2-10 | Logout lässt alle Daten im Browser (geteilte Geräte). | Beim Logout ausstehende Änderungen prüfen, dann lokale Daten löschen. | offen (Step-Daten sind pro Nutzer getrennt) |
| P2-11 | Performance: `console.trace` bei jedem Speichern, O(n²)-Statusberechnung beim Pull, jedes Realtime-Event lädt alle Ziele aller Zeiten. | Trace entfernt, Status gebündelt (**behoben**); inkrementelle Pulls offen. | teilweise |
| P2-12 | Keep-Alive-Workflow erzeugt leere Commits, hält aber Supabase (Pause nach 7 Tagen) nicht wach; GitHub Pages wird nicht wegen Inaktivität abgeschaltet. | Workflow, der z. B. alle 3 Tage eine leichte Supabase-Abfrage macht. | offen (braucht `workflow`-Scope) |
| P2-13 | `setGoals`/`setKanban` = delete + insert ohne Transaktion. | Bei Fehler zwischen den Schritten ist der Tag kurz leer (lokal bleibt er dirty und wird erneut gesendet). RPC mit Transaktion. | offen |
| P2-14 | Kalender: ◀/▶ am 29.–31. eines Monats übersprang Monate (`setMonth` auf den 31.10. + 1 = 1.12.). | Monatswechsel vom 1. aus. | **behoben** (gefunden bei der Mobil-Überarbeitung) |

### P3 – Optional

- Dark Mode folgt nicht `prefers-color-scheme`; Notification-Erlaubnis wird beim Laden ohne Nutzeraktion angefragt.
- `Notification` existiert in iOS-Safari-Tabs nicht → Fehler am Pomodoro-Ende (**behoben**).
- `.glass-panel:hover { scale(1.01) }` auf allen Panels (auf Touch „klebt“ der Zustand) – **behoben**: alle Hover-Effekte gelten nur noch für Maus/Trackpad; `prefers-reduced-motion` fehlt in älteren Bereichen weiterhin.
- CSS-Duplikate (Supplement-Styles in `index.html` und `style.css`), widersprüchliche Kanban-Media-Queries (900 px vs. 768 px).
- Kein Web-App-Manifest / Apple-Touch-Icon (**behoben**); Buttons im Dark Mode (`#818cf8` + Weiß) unter 3:1 Kontrast.
- `showNotification('Saved', 'success')` zeigte „success“ als Text (**behoben**).

## Was gut umgesetzt ist

- Klare, abhängigkeitsfreie Architektur ohne Build-Schritt; schnell, leicht zu deployen.
- RLS-Policies für alle acht Tabellen, getrennt nach SELECT/INSERT/UPDATE/DELETE; nur der öffentliche Anon-Key im Code, keine Service-Role-Keys oder Tokens im Repository.
- Pomodoro mit Wanduhr-Endzeit (übersteht Tab-Wechsel und Reload).
- Österreichische Feiertage inkl. beweglicher Feiertage.
- Konsistentes Design-System (Tokens, Dark Mode) und robuste Renderer mit `try/catch`.

## Sicherheit – Zusammenfassung

- Anon-Key im Frontend ist zulässig; Schutz hängt an RLS → mit dem Health-Check prüfen, dass `rls_enabled = true` für **alle** Tabellen gilt und keine „Allow all“-Policy übrig ist.
- Die Übergabedatei nennt einen gekürzten PAT (`ghp_pnNf…`). Sie ist nicht im Repository – so lassen; Token mit minimalen Rechten und Ablaufdatum verwenden.
- XSS-Senken beseitigt; Backups enthalten keine Login-Tokens mehr.

## Nachträge

- Handy/Tablet/iPhone Duo, iOS-Gestaltung und durchgehende Seite: [MOBILE.md](MOBILE.md)
- Kalender mit Uhrzeiten und eigenen Kalendern (inkl. Migration): [CALENDAR.md](CALENDAR.md)
