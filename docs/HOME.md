# Home

Stand 17.10.2026. **Home** ist der erste Abschnitt der Seite (Handy, Tablet und Desktop) und der
erste Eintrag der Abschnittsleiste. Er fasst den Tag zusammen; die Details bleiben in ihren
Bereichen, jede Karte führt dorthin.

## Was Home zeigt

| Karte | Inhalt | Quelle (so gespeichert wie bisher) |
|---|---|---|
| **Begrüßung** | „Good morning / afternoon / evening, ‹Name›.“ nach der Uhrzeit (ab 5, 12, 18 Uhr) und das Datum („Freitag, 16. Oktober“). Der Stift ändert den Namen; ohne Namen „Good morning.“ und „Add your name“. | Name: Einstellung `home` (Tabelle `settings`), wie `calendars` synchronisiert |
| **Weather** | Temperatur, Wetterlage mit Symbol, Sonnenaufgang und -untergang, Ort. Ohne Ort: „Set location“. | Open-Meteo (unten) |
| **Today** | Die Einträge von heute in der Reihenfolge des Kalenders (ganztägig zuerst, dann nach Uhrzeit), vergangene gedämpft, der nächste hervorgehoben mit „in 20 min“ / „until 10:30“. **+** = neuer Termin für heute, Antippen öffnet den Eintrag im Kalender-Editor. | Kalendertag `cal-…` von heute |
| **Tasks** | Aus dem Wochenboard („Weekly Overview & Tasks“): **überfällige** Aufgaben (offen, an einem vergangenen Tag dieser Woche, rot mit „Overdue · Mi“) zuerst, dann die von **heute** nach Priorität (`!!!`, `!!`, `!`), dann die **nächsten Tage**; erledigte von heute zuletzt; höchstens 6 Zeilen, Rest als „… more this week“. Zähler „2 open today · 1 overdue · 1 done“, Fuß „3 of 7 done this week“. Abhaken ändert die Aufgabe auf dem Board. **+** legt eine Aufgabe in der Spalte von heute an. | Board `week-JJJJ-Wnn` der aktuellen Woche |
| **Today's Goals** | Der **Focus**: das erste offene Ziel nach Dringlichkeit (High, Medium, Low, keine) und Reihenfolge – bewusst wählen über „Urgency: High“ im ⋯-Menü des Ziels. Darunter die weiteren offenen Ziele (bis 4 Zeilen), „2 of 5 done“. Abhaken und **+** wirken auf die Zielliste von heute. | `goals-…` von heute |
| **Matrix** | Je Bereich die Zahl offener Aufgaben und die Aufgabe mit dem frühesten Termin (überfällig rot), sonst die erste ohne Termin. Antippen öffnet den Bereich (dasselbe Sheet wie in Lists). | Liste `matrix`, Titel aus `customListsMeta` |
| **Steps** | Heutige Schritte, Tagesziel („Target 23.312“ – was heute nötig ist, damit das Jahresziel erreichbar bleibt), „14.892 to go“, Balken; „Year 56 % · 2.231.831 of 4.018.405“. Ohne eingerichtete Challenge ein Hinweis mit Link zu Health. | Step Challenge (`js/steps.js`, `stepCounter.summary()`) |
| **Habits** | „1 of 4 done today“ und ein Chip je Gewohnheit; Antippen hakt heute ab (derselbe Haken wie im Raster). Ohne Gewohnheiten keine Karte. | `habits` und die Haken `habitsData-…` |

Reihenfolge: zuerst, was an die Uhr gebunden ist (Wetter, Termine), dann das Tun (Aufgaben,
Ziele, Matrix), dann der Fortschritt (Schritte, Gewohnheiten). Auf dem Handy untereinander, ab
700 px zwei Spalten (Wetter neben der Begrüßung), ab 1100 px (Desktop): Begrüßung + Wetter, Today
+ Tasks, Goals + Matrix + Steps, Habits.

Home aktualisiert sich bei jeder Änderung der Daten (`db.set`/`db.del` melden
`dashboard:datachange`, ebenso die Step Challenge und das Wetter), nach jedem Sync, jede Minute
(Begrüßung, Datum, Countdown) und nach dem Auf-/Zuklappen. Tastatur: Leertaste und Enter haken ab,
der Fokus bleibt nach dem Neuzeichnen auf demselben Element; die Leertaste startet dabei nicht den
Focus-Timer.

Sprache: Englisch wie die übrige Oberfläche („Today's Goals“, „New Event“), Datum deutsch wie im
Kalender. Die Begrüßung steht in `js/home-core.js` (`greeting`) – eine Zeile, falls sie deutsch
sein soll.

## Wetter

- Dienst: [Open-Meteo](https://open-meteo.com) – kostenlos für nicht-kommerzielle Nutzung
  (unter 10.000 Anfragen pro Tag), **ohne API-Schlüssel**, Daten CC BY 4.0 (Nennung im
  Standort-Sheet). Es wird nichts im Frontend hinterlegt, was geheim wäre.
- Anfrage nur mit den Koordinaten des gewählten Orts: `…/v1/forecast?latitude&longitude&
  current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`.
  Zeiten kommen in der Ortszeit des Orts (`timezone=auto`) und werden als Text übernommen.
- Ort wählen: Wetterkarte (bzw. „Set location“) → Sheet mit Ortssuche (Open-Meteo Geocoding,
  Treffer wie „Wien, Österreich“), „Use current location“ (Standort des Geräts, mit
  Berechtigungsabfrage; gespeichert als „Current location“) und „Remove location“. Der Ort
  liegt in der Einstellung `home` und gilt so auf allen Geräten.
- Aktualisierung: nach einer halben Stunde, beim Zurückkehren in den Vordergrund und wenn die
  Verbindung wiederkommt. Die letzte Antwort bleibt im Gerät (`localStorage` `home.weather`):
  offline oder bei einem Fehler wird sie mit ihrer Uhrzeit gezeigt („Offline · from 09:30“,
  „Could not update · from 09:30“); ohne gespeicherte Antwort steht „The weather could not be
  loaded.“ mit **Retry**. Es werden nie erfundene Werte gezeigt.
- Wettercodes: die WMO-Codes, wie Open-Meteo sie dokumentiert (`WEATHER_CODES` in
  `js/home-core.js`), Symbole nach Tag/Nacht (`is_day`).

## Daten

| Teil | Wo |
|---|---|
| Name und Ort | Einstellung `home` = `{ name, location: { name, latitude, longitude, timezone? } }` (Tabelle `settings`, lokal `home`), synchronisiert wie `calendars`: Download beim Sync, Upload sofort und beim Nachholen (`js/data-utils.js` kennt den Schlüssel) |
| Letztes Wetter | nur lokal, `home.weather` |
| Alles andere | unverändert in seinen Bereichen – Home hält keine Kopie |

Keine Datenbank-Migration nötig (die Tabelle `settings` nimmt den Schlüssel `home` wie jeden anderen).

## Technik

| Datei | Inhalt |
|---|---|
| `js/home-core.js` | Regeln ohne DOM: Begrüßung, Termine mit Zustand, Aufgaben-Triage, Focus, Matrix-Zähler, Schritte, Habits, Wettercodes und -antwort, Einstellungen (Unit-Tests: `tests/unit/home-core.test.js`) |
| `js/weather.js` | Open-Meteo: Abruf, Cache, Ortssuche (`window.Weather`) |
| `js/home-ui.js` | Darstellung, Aktionen (Abhaken, +, Name, Ort), Navigation (`window.HomeUI`) |
| `css/home.css` | Aussehen (Karten sind `.glass-panel`, also Glas am Desktop und iOS-Karten auf Handy/Tablet) |
| `index.html` | `#section-home` vor `#section-today`, Tab „Home“ zuerst |
| `js/app.js` | `db.getHome/setHome`, `notifyDataChange` in `db.set/del`, Sync des Schlüssels `home`, `renderHome` in `refreshAllViews` |
| `js/steps.js` | `stepCounter.summary()` und die Meldung nach jedem Zeichnen |
| `js/matrix-ui.js`, `css/matrix.css` | `MatrixUI.areaIcon`, Bereichsfarben auch für `.home-tile` |
| `js/mobile.js` | `SECTIONS` beginnt mit `home` |

Gekoppelt an die bestehende Architektur: Home liest `db`, `listMeta`, `getListItems`,
`renderKanban`/`renderGoals`/`renderHabits`, `showInputModal`, `openCalendarEditor` aus
`js/app.js` (globale Funktionen) und `window.stepCounter`. Unabhängig davon ist alles in
`js/home-core.js`; es nimmt die gespeicherten Formen als Eingabe und kennt weder DOM noch Speicher.

Tests: siehe [tests/README.md](../tests/README.md) (`home …`).

## Bewusst nicht gebaut

- **Tagesfokus als eigenes Feld:** Ein Ziel „zum Fokus machen“ bräuchte entweder eine neue
  Spalte in `goals` (Migration) oder einen zweiten Speicher neben den Zielen. Der Focus ist
  daher abgeleitet (Dringlichkeit, dann Reihenfolge) und wird mit „Urgency: High“ gewählt.
- **Schnellaktionen über die „+“ je Karte hinaus** (die Leiste oben hat auf dem Handy schon „+“).
- **Pomodoro-Zahl** (steht in der Focus-Karte) und **Wochenstatistik** (im Focus-Panel) nicht
  noch einmal; der Wochenstand steht nur als eine Zeile unter Tasks.
