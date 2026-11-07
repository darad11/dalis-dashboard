# Dali Life OS – Datensicherung und Migration

**Stand:** 7. November 2026 (Phase 0) · **Status:** Plan, noch nichts migriert.
Diese Datei beschreibt Formen und Schlüssel, **nie Inhalte**. Sicherungsdateien enthalten
persönliche Daten: nicht ins Repository, nicht an Dritte, nicht an KI-Dienste.

## 1. Grundsätze

1. **Erst sichern, dann ändern.** Vor jeder Migration liegt pro genutztem Gerät und für die Cloud
   eine geprüfte Sicherung vor (Backup v2, Abschnitt 4).
2. **Nichts löschen.** Alt-App, Alt-Tabellen und `localStorage` bleiben unangetastet; die Migration
   liest nur. Rückweg ist immer möglich.
3. **Idempotent.** Jeder importierte Datensatz bekommt eine deterministische UUID (UUIDv5 aus Quelle,
   Altschlüssel, Position und Inhalt). Ein zweiter Lauf legt nichts doppelt an.
4. **Vorschau vor dem Schreiben.** Jeder Import zeigt zuerst einen Bericht (Anzahl je Ziel, nicht
   zuordenbare Daten, Zweifelsfälle) und schreibt erst nach deiner Bestätigung.
5. **Nichts geht verloren.** Was das neue Modell noch nicht abbildet, kommt unverändert in ein
   Import-Archiv (Rohdaten als JSON) und kann später zugeordnet werden.
6. **Normaler Schreibweg.** Der Import schreibt über die Services der neuen App mit deinem Login
   (RLS), nicht mit einem Service-Key.

## 2. Bestand im Browser (`localStorage`)

Jedes Gerät **und jeder Browser** hat einen eigenen Stand: Safari, Chrome, die Home-Bildschirm-App
auf dem iPhone (in der Regel mit eigenem, von Safari getrenntem Speicher) und jedes Browser-Profil
am Mac. Monat in
`Y-M-D`-Schlüsseln ist **0-basiert** (`cal-2026-9-14` = 14. Oktober 2026), Wochen-Schlüssel nutzen
das ISO-Wochenjahr.

### 2.1 App-Daten, die mit der Cloud abgeglichen werden

| Schlüssel | Form | Cloud | Hinweis |
|---|---|---|---|
| `goals-Y-M-D` | Array; Eintrag Text oder `{text, done, priority?, urgency?, rolledFrom?, id?}` | `goals`, `date` = Schlüssel | Tagesziele; `rolledFrom` = UTC-Zeitstempel der lokalen Mitternacht |
| `cal-Y-M-D` | Array `{text, done, priority?, start?: "HH:MM", end?, calendarId?}` | `goals`, `date` = Schlüssel, `start_time`, `end_time`, `calendar_id` | Kalender; ohne `start` = ganztägig |
| `notes-Y-M-D` | Text | `notes` | Tagesnotiz, Oberfläche entfernt |
| `review-YYYY-Www` | Text | `notes` | Weekly Review |
| `week-YYYY-Www` | `{MO: […], DI: […], MI, DO, FR, SA, SO}`; Aufgabe Text oder `{text, done, priority, …}` | `kanban_tasks`, eine Zeile je Aufgabe, Objekt als JSON-Text | Wochenboard |
| `backlog` | `{<Spalte>: […]}` | `backlog_tasks` | Oberfläche entfernt |
| `habits` | Array `{id?, name, color, history}` (alt: Text) | `habits` | **Reihenfolge ist maßgeblich** für die Häkchen |
| `habitChecks` | `{"habitsData-YYYY-Www-h<Index>-d<Tag>": true}` | `settings` | Index = Position in `habits`, Tag 0 = Montag; ältere Form `<Habitname>_…` möglich |
| `habitsData-YYYY-Www-h<Index>-d<Tag>` | `"1"` | über `habitChecks` | Einzel-Spiegel der Häkchen |
| `customListsMeta` | Array `{id: "custom-<ms>", title}`; Matrix `{id: "matrix", type: "matrix", title, areas: [{id, title}]}` | `settings` | Reihenfolge der Listen |
| `list-<id>` | Array Text oder `{text, done}`; Matrix `{id, text, done, area, note?, due?, repeat?}` | `lists`, `name` = id, `items` (jsonb) | `area` ∈ todo, next, waiting, ideas; `repeat` ∈ daily, weekly, monthly, yearly |
| `listIcon_<id>` | Text | `lists.icon` | |
| `calendars` | Array `{id, name, color}`, Standard `default` zuerst | `settings` | Farben: red, orange, yellow, green, blue, purple, brown, white |
| `home` | `{name, location: {name, latitude, longitude, timezone?} \| null}` | `settings` | |
| `gymHubData` | je Tag `YYYY-MM-DD` (Monat 1–12): `{water, macros{calories, protein, carbs, fat}, nutritionNotes, workoutLog, progress{weight, bodyFat, notes}, sleep{hours, quality}, measurements{chest, waist, arms, legs}}`; dazu `inspiration`, `weeklySplit{mon…sun}`, `personalRecords[{exercise, weight, date}]`, `supplements[Name]`, `supplementsTaken{Tag: [Name]}`, `workoutDays[Tag]`, `weeklyGoals{"YYYY-W<n>": [{text, done}]}`, `trainingGoals[{text, done}]` | `settings`, **nur Upload** | Werte meist als Text aus Eingabefeldern; `weeklyGoals` nutzt eine eigene, **nicht ISO-konforme** Wochenformel |
| `stepChallenge.v1.<userId>.config` | `{version, years: {YYYY: {goal, baselineSteps, baselineDate, previousYearTotal}}, updatedAt, pending?}` | `settings` (`stepChallenge`) | |
| `stepChallenge.v1.<userId>.entries` | `{YYYY-MM-DD: {steps, updatedAt, deleted?, pending?}}` | `step_entries` | `deleted` = wieder „nicht erfasst“ |

### 2.2 Nur im Gerät

| Schlüssel | Form | Hinweis |
|---|---|---|
| `pomo-Y-M-D` | Zahl als Text | Pomodoros je Tag, nie in der Cloud |
| `pomoSessions`, `pomoDate`, `pomoRunning`, `pomoEndTime`, `pomoMode` | Text | laufender Timer |
| `stats` | `{pomos, tasks, streak, lastActive}` | Altlast, im heutigen Code nicht mehr beschrieben |
| `home.weather` | Wetter-Cache | wird neu geladen, nicht migrieren |
| `stepChallenge.ui` | UI-Zustand | nicht migrieren |
| `darkMode`, `calendarCollapsed`, `habitsCollapsed`, `analyticsCollapsed`, `weeklyReviewCollapsed`, `statsOpen`, `gymHubOpen`, `unifiedListsInited` | UI-Zustand | Dark Mode als Einstellung übernehmen, Rest nicht |

### 2.3 Abgleich-Metadaten und Anmeldung

| Schlüssel | Bedeutung | Behandlung |
|---|---|---|
| `dirty_<key>` | Änderung noch nicht hochgeladen | **wichtig für die Migration:** zeigt, wo das Gerät neuer ist als die Cloud |
| `ts_<key>` | Zeitpunkt der letzten lokalen Änderung (ms) | Hilfe bei Konflikten |
| `synced_<key>` | Fingerabdruck des zuletzt gesehenen Cloud-Stands | Hilfe bei Konflikten |
| `syncBackups` | bis zu 50 lokale Kopien `{key, value, reason, modifiedAt, savedAt}` aus früheren Konflikten | sichern, in der Vorschau anzeigen |
| `sb-<projekt>-auth-token` | Login-Sitzung inkl. Refresh-Token | **nie sichern, nie exportieren** |

## 3. Bestand in der Cloud (Projekt `dashboard`, gezählt am 7.11.2026)

| Tabelle | Spalten (Kurzform) | Zeilen | Besonderheit |
|---|---|---|---|
| `goals` | id, user_id, date (Text-Schlüssel), text, done, rolled_from, priority, urgency, position, start_time, end_time, calendar_id, created_at | 92 | 70 Kalender, 22 Ziele; 4 Zeilen ohne `user_id` (per Login nicht lesbar) |
| `habits` | id, user_id, name, color, history (jsonb), created_at | 10 | `history` leer |
| `notes` | id, user_id, date (Text-Schlüssel, global eindeutig), content | 2 | |
| `kanban_tasks` | id, user_id, week_key, column_name, text, sort_order | 8 | `text` enthält JSON |
| `backlog_tasks` | id, user_id, column_name, text, sort_order | 1 | |
| `lists` | id, user_id, name (global eindeutig), items (jsonb), icon | 9 | |
| `pomodoro_stats` | id, user_id, date, count | 0 | ungenutzt |
| `settings` | id, user_id, key (global eindeutig), value (jsonb) | 6 | |
| `step_entries` | user_id + date (PK), steps, deleted, updated_at, created_at | 23 | Herkunft (Kurzbefehl oder manuell) wird **nicht** gespeichert |
| `step_upload_tokens` | id, user_id, token_hash, label, created_at, last_used_at | 1 | Hash nie exportieren |

## 4. Sicherung

### 4.1 Sofort möglich, ohne Code (Stufe 0)

1. Auf **jedem** Gerät und in jedem genutzten Browser bzw. in der Home-Bildschirm-App:
   **⋯ → Sync & Backup → Export backup**. Die Datei `dalis-dashboard-backup-<Datum>.json` enthält
   alle `localStorage`-Einträge außer der Anmeldung.
2. Dateien sicher ablegen (z. B. verschlüsselter Ordner), nicht ins Repository.
3. Vorher nicht „Cloud → this device“ drücken: Das überschreibt nicht hochgeladene Änderungen.
4. Grenze: Die Cloud-Zeilen anderer Wochen und Tage sind nur enthalten, soweit sie auf dem Gerät
   liegen; eine Cloud-Sicherung gibt es heute nur über das Supabase-Dashboard (CSV je Tabelle).

### 4.2 Backup v2 (erster Umsetzungsschritt)

Erweiterung des bestehenden Exports in der Alt-App, ohne Schemaänderung:

```json
{
  "format": "dalis-dashboard-backup",
  "formatVersion": 2,
  "createdAt": "<ISO-Zeitpunkt>",
  "app": { "version": "<Version aus index.html>", "origin": "<Adresse der App>" },
  "device": { "userAgent": "<…>", "standalone": "<true|false>" },
  "local": { "entries": { "<Schlüssel>": "<Rohwert>" }, "count": "<n>", "sha256": "<…>" },
  "cloud": {
    "tables": { "<Tabelle>": [ "<Zeilen des eigenen Kontos>" ] },
    "counts": { "<Tabelle>": "<n>" },
    "sha256": { "<Tabelle>": "<…>" }
  },
  "excluded": ["sb-*", "step_upload_tokens.token_hash"]
}
```

- Cloud-Teil: alle 10 Tabellen, gelesen mit dem eigenen Login (RLS), seitenweise.
- Direkt danach Prüfbericht: Datei erneut lesen, Anzahl und Prüfsummen vergleichen, Ergebnis
  anzeigen; Zeitpunkt der letzten geprüften Sicherung lokal merken.
- Import-Vorschau (Dry-Run): zeigt, was eine Wiederherstellung ändern würde, schreibt nichts.
- Der bestehende Import (ersetzt das Gerät, lädt hoch) bleibt unverändert verfügbar.

## 5. Zuordnung Alt → Neu

Zieltabellen laut Spezifikation 13.4; angelegt werden sie erst in der Phase, die das Modul baut.

| Quelle | Ziel | Regel | Offen |
|---|---|---|---|
| `goals` mit `cal-…` | `calendar_events` **oder** `tasks` | Datum aus Schlüssel (+1 Monat), Uhrzeit → `timestamptz` in `Europe/Vienna` (Sommerzeit beachten), `calendar_id` → Kalender | **D8:** Heute haben alle 70 Einträge keine Uhrzeit und ein Häkchen – eher Aufgaben eines Tages als Termine |
| `goals` mit `goals-…` | `tasks` | Status aus `done`, Priorität aus `urgency`/`priority`, geplant für den Tag; `rolledFrom` → Notiz zur Herkunft | Top-Prioritäten (Spez. 5.1) |
| `kanban_tasks` / `week-…` | `tasks` | Montag der ISO-Woche + Spalte (MO = 0 … SO = 6) als geplanter Tag | **D6:** Feld „geplant für Tag“ |
| `backlog_tasks` / `backlog` | `inbox_items` | Text unverändert | |
| `lists` `matrix` | `tasks` | todo → `todo`, next → `todo` mit Priorität hoch, waiting → `waiting`, ideas → `inbox`; `done` → `done`; `due` → `due_date`; `note` → Beschreibung; `repeat` → Vorlage mit RRULE (`FREQ=DAILY…`) | Abbildung von „next“ bestätigen |
| `lists` `custom-*` | je Liste: `shopping_items` (Einkauf) oder `tasks` in einem Lebensbereich/Projekt | Vorschau je Liste | **D9:** Ziel je Liste |
| `notes` `review-…` | `weekly_reviews` | Wochenbeginn aus ISO-Woche | |
| `notes` `notes-…` | Import-Archiv oder Notiz am Tag | | klein (1 Zeile) |
| `habits` + `habitChecks` | `habit_definitions` + `habit_logs` | Index über die **lokale** Reihenfolge von `habits` zum Zeitpunkt der Sicherung auflösen; Tag = Montag der Woche + d | Zweifelsfälle (gelöschte/verschobene Habits) in der Vorschau bestätigen |
| `settings.calendars` | Kalender-Einstellungen | Farben übernehmen | eigene Tabelle oder Profil |
| `settings.home` | `profiles` | Name, Wetter-Ort | |
| `settings.stepChallenge` | Ziele (`targets`) | Jahresziel, Startwert, Vorjahr mit Gültigkeit | Zieltabelle in Phase 3 |
| `step_entries` / `stepChallenge.v1.*.entries` | `daily_metrics.steps` | Herkunft „Step Challenge (Altbestand)“, da Kurzbefehl und manuell nicht unterscheidbar; `deleted` → nicht übernehmen, aber archivieren | |
| `step_upload_tokens` | – | im neuen Projekt neue Schlüssel; Kurzbefehl auf neue Adresse umstellen | Umstellungstermin |
| `gymHubData` (Cloud + jedes Gerät) | `daily_metrics.water`, `supplements` + `supplement_logs`, `workout_sessions` (Trainingstage), `workout_programs` (Wochenplan), `sleep_logs`, Notizen | Supplements ohne Dosis werden **zur Prüfung markiert**, nichts erraten (Spez. 8.5) | **D10:** Gewicht, Körperfett, Maße, Rekorde, „Inspiration“ → eigene Tabellen oder Archiv |
| `pomo-*` | Import-Archiv | | **D11:** Fokus-Historie gewünscht? |
| `syncBackups` | Vorschau | nur zur Entscheidung bei Konflikten | |
| `pomodoro_stats`, `stats`, UI-Zustände, Caches | – | nicht migrieren | |

## 6. Ablauf eines Imports (ab Phase 2, pro Bereich)

1. **Sammeln:** Backup-v2-Dateien aller Geräte plus Cloud-Teil.
2. **Zusammenführen:** pro Schlüssel gilt die Cloud, außer ein Gerät hat eine nicht hochgeladene
   Änderung (`dirty_`) mit anderem Wert → Konflikt in die Vorschau. Reine Gerätedaten (`gymHubData`,
   `pomo-*`) werden pro Tag vereinigt, Widersprüche angezeigt.
3. **Umwandeln:** Datumsregeln (Abschnitt 7), deterministische UUIDs, Import-Batch-ID je Lauf.
4. **Vorschau:** Anzahl je Zieltabelle, Archiv-Einträge, Zweifelsfälle, Stichproben mit altem und
   neuem Datum nebeneinander.
5. **Bestätigen** durch dich.
6. **Schreiben** über die normalen Services, in kleinen Paketen, wiederholbar.
7. **Prüfen:** Anzahl Quelle = Ziel + Archiv; Prüfsummen der umgewandelten Mengen; Sichtprüfung in
   der neuen App auf Web und iPhone.
8. **Umschalten:** Bereich in der Alt-App als schreibgeschützt kennzeichnen.

**Rückweg:** Daten im neuen Projekt tragen die Import-Batch-ID und lassen sich gezielt
zurücknehmen; die Alt-App und ihre Daten sind unverändert und sofort wieder nutzbar.

## 7. Datumsregeln

| Quelle | Regel |
|---|---|
| `goals-`, `cal-`, `notes-`, `pomo-` + `Y-M-D` | Monat + 1, mit Nullen auffüllen → lokales Datum |
| `week-`, `review-`, `habitsData-` + `YYYY-Www` | ISO-8601: Montag der Woche im ISO-Wochenjahr (Woche 53 über Jahreswechsel beachten) |
| Wochenboard-Spalten | MO…SO → Montag + 0…6 |
| `gymHubData` Tages-Schlüssel, Matrix `due`, `step_entries.date` | bereits `YYYY-MM-DD` lokal |
| `gymHubData.weeklyGoals` `YYYY-W<n>` | eigene Formel der Alt-App nachrechnen, nicht als ISO-Woche lesen |
| `rolledFrom` | UTC-Zeitstempel → Datum in `Europe/Vienna` (nicht den UTC-Datumsteil nehmen) |
| Kalender-Uhrzeiten `HH:MM` | lokale Wanduhrzeit in `Europe/Vienna` → `timestamptz` |

Jede Regel bekommt Unit-Tests mit Grenzfällen (Monatsende, Woche 53, Sommerzeit-Umstellung).

## 8. Abnahmekriterien der Migration

- Für jede Quelle: Anzahl übernommen + archiviert + bewusst ausgelassen = Anzahl in der Sicherung.
- Kein Datensatz doppelt nach zweitem Lauf (deterministische UUIDs).
- Stichprobe von mindestens 10 Datensätzen je Bereich mit Datum, Status und Text geprüft.
- Habit-Zuordnung pro Woche von dir bestätigt, wo die Reihenfolge zweifelhaft ist.
- Alt-App und Alt-Daten nachweislich unverändert (Zählung vorher/nachher).

## 9. Offene Datenentscheidungen

| Nr. | Frage |
|---|---|
| D6 | Feld „geplant für Tag“ für Aufgaben ohne Uhrzeit |
| D8 | Ganztägige Kalendereinträge mit Häkchen: Aufgaben oder Termine? |
| D9 | Ziel jeder eigenen Liste (Einkauf, Aufgaben, Archiv) |
| D10 | Gewicht, Körperfett, Maße, Rekorde, „Inspiration“: eigene Tabellen oder Archiv |
| D11 | Pomodoro-Historie übernehmen? |
| – | Was mit den 4 besitzerlosen Zeilen in `goals` passiert (nur du kannst sie im SQL-Editor ansehen) und ob das zweite, leere Konto gelöscht werden soll |
