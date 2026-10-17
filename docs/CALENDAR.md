# Kalender: Uhrzeiten und eigene Kalender

Stand 17.10.2026.

## Funktionen

- **Uhrzeiten**: Ein Eintrag ist ganztägig (wie alle bisherigen Einträge) oder hat Beginn und
  Ende am selben Tag. Ein neuer Eintrag mit Uhrzeit beginnt heute zur nächsten vollen Stunde
  (an anderen Tagen um 09:00) und dauert eine Stunde; wird der Beginn verschoben, bleibt die
  Dauer gleich. Ein Ende vor dem Beginn kann nicht gespeichert werden.
- **Eigene Kalender** mit Namen und Farbe (Rot, Orange, Gelb, Grün, Blau, Lila, Braun – die
  iOS-Systemfarben, inkl. Varianten für Dark Mode und „Kontrast erhöhen“ – und Weiß). Weiß
  verschwände im hellen Design auf den weißen Karten: Weiße Punkte haben dort einen grauen Rand
  (3,2:1 gegen Weiß, mit „Kontrast erhöhen“ dunkler); im Dark Mode sind sie rein weiß. Es gibt
  immer einen Standardkalender („Personal“, blau, umbenennbar, nicht löschbar).
- **Farbige Punkte**: im Monatsraster bis zu drei Punkte je Tag in den Farben der Kalender
  des Tages; in der Tagesliste und in der Wochenübersicht ein Punkt je Eintrag. Ab zwei Kalendern steht der Kalendername zusätzlich als Text da
  (Farbe nicht als einziges Merkmal).
- **Reihenfolge** innerhalb eines Tages: ganztägige Einträge zuerst (eigene Reihenfolge, per
  Drag & Drop in der Wochenübersicht), dann nach Uhrzeit.
- **Editor** (Titel, Ganztägig, Datum, Beginn, Ende, Kalender, Priorität, Löschen):
  - Jedes Gerät (seit 17.10.2026 auch der Desktop): Sheet von unten; öffnen über „+“ oben,
    „New Event“ unter der Tagesliste oder Antippen/Klick auf einen Eintrag; Kalenderliste über
    „Calendars“ unter der Tagesliste; Taste Q (für heute). Ein neuer Eintrag öffnet mit der
    Tastatur im Titel; das Sheet steht dabei sofort an seinem Platz und blendet ein (warum:
    [MOBILE.md](MOBILE.md), „Sheets und Tastatur“). Mit Hardware-Tastatur hat der Titel auch beim
    Bearbeiten den Fokus und Return speichert.
  - Bis 17.10.2026 am Desktop: Dialog, Einträge im Monatsfeld (Doppelklick, „+“ im Tagesfeld,
    Rechtsklick für die Priorität, Ziehen auf einen anderen Tag).
  - Neues Datum = Eintrag wird auf diesen Tag verschoben.
- **Kalender löschen**: Die Einträge bleiben erhalten und gehören danach zum Standardkalender
  (die Rückfrage nennt die Anzahl). Anders als Apple Kalender, das die Termine mitlöscht.

## Datenmodell

| Wo | Inhalt |
|---|---|
| localStorage `cal-JJJJ-M-T` (Monat 0-basiert) | `[{ text, done, priority, start?, end?, calendarId? }]` – `start`/`end` als `"HH:MM"`; fehlend = ganztägig bzw. Standardkalender |
| Supabase `goals` | wie bisher eine Zeile je Eintrag (`date` = Schlüssel), neu `start_time`/`end_time` (`time`) und `calendar_id` (`text`) |
| localStorage/Supabase `settings`, Schlüssel `calendars` | `[{ id, name, color }]`, Standardkalender zuerst |

- Ein Eintrag mit unbekannter `calendarId` (Kalender gelöscht, auch auf einem anderen Gerät)
  zählt zum Standardkalender (`js/calendar-core.js`, `calendarOf`).
- Uhrzeit-Spalten werden nur gesendet, wenn gesetzt: Tage ohne Uhrzeiten schreiben genau die
  Spalten wie vorher. Der Fingerabdruck für die Konflikterkennung ist für Einträge ohne
  Uhrzeit unverändert (ausstehende Änderungen vom Stand vor dem Update werden nicht als
  Konflikt gewertet).
- Gleicher Text zweimal an einem Tag gilt nur noch als Duplikat (alte Doppelzeilen), wenn auch
  Uhrzeit und Kalender gleich sind – „Meeting 10:00“ und „Meeting 14:00“ bleiben beide.
- Die Kalenderliste synchronisiert wie die anderen Einstellungen: ohne eigene ausstehende
  Änderung gilt die Cloud, sonst wird die eigene Version hochgeladen (letzte Änderung gewinnt).

## Datenbank-Migration

`migrations/2026-10-16_calendar_times.sql` (idempotent): drei Spalten, Prüfregeln
`end_time ≥ start_time` (Ende braucht Beginn) und Länge der Kalender-ID. Bestehende Zeilen und
RLS-Policies bleiben unverändert. Lokal getestet (`tests/sql/calendar_times.test.sql`).

**Am 16.10.2026 im Supabase-Projekt eingespielt** und geprüft: Zeilenzahl und Prüfsumme der
Tabelle `goals` vorher/nachher gleich, neue Spalten leer, RLS aktiv, die vier Policies
unverändert. Ohne Migration bleibt ein Eintrag mit Uhrzeit auf dem Gerät (ausstehend, Fehler im
Sync-Status) und wird nach der Migration beim nächsten Sync hochgeladen; Einträge ohne Uhrzeit
funktionieren mit und ohne Migration.

## Grenzen

- Keine mehrtägigen Termine, keine Wiederholungen, keine Erinnerungen/Mitteilungen, keine
  Zeitzonen (Uhrzeiten sind die lokale Uhrzeit des Tages).
- **Keine Verbindung zu Apple Kalender/iCloud** – die Kalender existieren nur im Dashboard.
- Kalender lassen sich nicht ausblenden (Apple Kalender: Häkchen in der Kalenderliste).
