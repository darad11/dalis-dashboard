# Matrix

Stand 17.10.2026. Im Bereich **Lists** steht ganz oben die **Matrix** mit vier Bereichen:
**to do** (rot, Flamme), **up next** (blau, Kalender), **waiting** (orange, Blitz) und
**ideas** (grau, Liste). Die bestehenden Listen folgen darunter.

## Bedienung

- **Karte eines Bereichs:** Titel mit Pfeil (öffnet den Bereich), **+** (neue Aufgabe), darunter
  die offenen Aufgaben. Der Kreis hakt eine Aufgabe ab, der Text öffnet sie zum Bearbeiten. Eine
  Karte zeigt bis zu 6 Aufgaben, weitere stehen hinter „… more“.
- **Bereich (Antippen des Titels):** großer Titel mit der Zahl der offenen Aufgaben und einem
  **Stift** zum Umbenennen (Enter speichert, Escape bricht ab; leer geht nicht, höchstens 40
  Zeichen). Darunter die offenen Aufgaben, erledigte unter **Completed** (antippen = wieder
  offen, **Clear** löscht sie nach Rückfrage) und unten der große Knopf **Add Task** in der Farbe
  des Bereichs.
- **Neue Aufgabe (+):** Aufgabe, Notiz (optional), **Due Date** mit **Today / Tomorrow /
  Custom** (Custom zeigt ein Datumsfeld; erneutes Antippen des gewählten Chips entfernt das
  Datum) und **Repeat** (Daily, Weekly, Monthly, Yearly). Eine wiederholte Aufgabe braucht ein
  Datum: ohne Auswahl bekommt sie heute, wie in Erinnerungen.
- **Bearbeiten (Text antippen):** dieselben Felder, dazu **Area** (verschiebt die Aufgabe in einen
  anderen Bereich, ans Ende) und **Delete Task** mit Rückfrage. Schließen mit Änderungen fragt
  nach („Discard Changes“).
- **Abhaken:** Die Aufgabe ist erledigt und verschwindet aus der Karte. Eine wiederholte Aufgabe
  springt stattdessen auf ihren nächsten Termin und bleibt offen – gerechnet vom Termin aus und
  nach heute (wöchentlich am 1.10., erledigt am 17.10. → 22.10.; monatlich vom 31.1. → 28.2. →
  31.3.).
- **Fälligkeit** neben der Aufgabe: „Today“ (fett), „Tomorrow“, „Yesterday“ oder ein kurzes
  Datum („Di., 20. Okt.“); überfällig in Rot. Wiederholung und Notiz als kleine Symbole.
- **Die Matrix verschieben** wie eine Liste: auf Handy und Tablet über **⋯** neben „Matrix“ →
  **Move Up / Move Down**, am Desktop per Drag & Drop (Griff links oben, auf den Titel einer Liste
  ziehen).

Handy und Tablet: iOS-Sheets von unten (✕ links, ✓ rechts, nach unten wischen schließt). „+“
öffnet mit der Tastatur; das Sheet steht dann sofort an seinem Platz und blendet ein, die Seite
dahinter bleibt stehen (warum: [MOBILE.md](MOBILE.md), „Sheets und Tastatur“). Desktop:
derselbe Inhalt als Dialog. Beide nutzen das Sheet des Kalender-Editors (`window.SheetUI`).

## Daten und Sync

Die Matrix ist technisch eine Liste, so gelten Reihenfolge, Sync, Backup und Import wie bei den
anderen Listen:

| Teil | Wo |
|---|---|
| Platz unter den Listen und Titel der Bereiche | Eintrag `{ id: 'matrix', type: 'matrix', title, areas: [{ id, title }] }` in `customListsMeta` (Tabelle `settings`) |
| Aufgaben | Liste `matrix` (localStorage `list-matrix`, Tabelle `lists`, Spalte `items` als JSON) |
| Aufgabe | `{ id, text, done, area, note?, due?, repeat? }` – `area`: todo/next/waiting/ideas, `due`: Tag `YYYY-MM-DD` |

- Bis zur ersten Änderung steht die Matrix oben, ohne gespeichert zu sein; so übernimmt ein neues
  Gerät die Reihenfolge aus der Cloud. Mit der ersten Aufgabe (oder dem ersten Umbenennen /
  Verschieben) wird ihr Platz gespeichert.
- Aufgaben aus der Cloud kommen auch an, wenn ihr Platz in der Reihenfolge noch nicht da ist.
- **Abgleich beim Sync:** Hatte ein Gerät ungesendete Änderungen, werden die Einträge einer Liste
  zusammengeführt. Bisher geschah das über den Text – zweimal „test“ in zwei Bereichen wäre dabei
  zu einer Aufgabe geworden. Einträge mit `id` (die Aufgaben der Matrix) werden jetzt über die
  `id` zusammengeführt; normale Listen ohne `id` unverändert über den Text.
- Ältere Versionen des Dashboards zeigen die Matrix als normale Liste „Matrix“; dort angelegte
  Einträge landen in „to do“.
- Keine Datenbank-Migration nötig.

## Technik

| Datei | Inhalt |
|---|---|
| `js/matrix-core.js` | Regeln ohne DOM: Bereiche, Eintrag in der Reihenfolge, Aufgaben prüfen, Abhaken, nächster Termin, Fälligkeitstext (Unit-Tests: `tests/unit/matrix-core.test.js`) |
| `js/matrix-ui.js` | Karte, Bereichs-Sheet mit Umbenennen, Aufgaben-Sheet |
| `css/matrix.css` | Aussehen (hell/dunkel, Handy/Desktop) |
| `js/app.js` | `listMeta()` (Reihenfolge mit Matrix), Darstellung in `renderUnifiedLists`, Verschieben, Sync |

Farben der Bereiche: Titel und Symbole mit mindestens 4,5:1 gegen die Karte (hell: Rot 5,4,
Blau 4,7, Orange 5,4, Grau 5,2; dunkel: 5,0 / 5,3 / 7,6 / 5,9); der große Knopf weißer Text auf der
dunkleren Variante (mindestens 4,7:1). Alle Bedienelemente mindestens 44 × 44 pt.

Tests: siehe [tests/README.md](../tests/README.md) (`matrix …`).
