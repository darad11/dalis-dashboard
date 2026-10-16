# Step Challenge

Karte im Health Hub (immer sichtbar, unter der Hero-Zeile). Ziel: den Vorjahresrekord
bis 31.12. übertreffen und jeden Tag sehen, ob man im Plan liegt.

## Einrichtung

Beim ersten Öffnen erscheint ein Formular mit den Werten aus der letzten Berechnung
(15.10.2026): **2.223.411 Schritte bis einschließlich 15.10.2026**, Vorjahr **4.018.404**,
Ziel **4.018.405** (= Rekord + 1). Die Werte sind nur Vorschläge – angezeigt und
gerechnet wird erst nach **Confirm & start**. Alles lässt sich später über ⚙️ ändern.

Wichtig: „bis einschließlich“ bedeutet, dass der Startwert den ganzen 15.10. enthält.
Falls der Wert mitten am 15.10. erhoben wurde, den Startwert auf den vollständigen
Tageswert korrigieren – sonst fehlen die restlichen Schritte des 15.10.

Am 1.1. erscheint automatisch die Einrichtung für das neue Jahr (Startwert 0 bis 31.12.,
Rekord = Gesamtwert des Vorjahres). Der 31.12. des Vorjahres kann dort noch nachgetragen werden.

## Tägliche Eingabe

- „Today's steps“: Zahl eintragen, **Save** (oder Enter). Erlaubt: `12345`, `12.345`,
  `12,345`, `12 345`. Abgelehnt: negative Werte, Dezimalzahlen (`12,5`), Text, > 200.000.
- Korrigieren: neuen Wert eintragen → **Update**. Es gibt pro Tag genau einen Wert,
  er wird ersetzt, nie addiert. **Undo** stellt den vorherigen Wert wieder her.
- Frühere Tage: Pfeile ‹ ›, Datumsfeld, ein Tag in „This week“ oder im Kalender (Details).
- ✕ entfernt einen Eintrag → der Tag gilt wieder als **nicht erfasst**. Das ist etwas
  anderes als ein bestätigter Wert **0**.
- Tage bis einschließlich Startdatum sind gesperrt (im Startwert enthalten), Zukunft ebenso.

## Berechnung

```
Gesamt (YTD)        = Startwert + Summe der Tageswerte nach dem Startdatum bis heute
Verbleibend         = max(0, Ziel − Gesamt)
Fortschritt         = Gesamt / Ziel × 100
Ø pro Tag nötig     = Verbleibend / verbleibende Kalendertage   (aufgerundet)
```

- **Verbleibende Tage**: Ist heute noch nichts eingetragen, zählt heute mit
  („incl. today“). Sobald heute eingetragen ist, gilt der Wert ab morgen („from tomorrow“).
- **Tagesziel heute**: der Bedarf zu Beginn des Tages; der Balken „Today“ vergleicht damit.
- **Plan (Soll)**: Gerade vom Startwert am Startdatum zum Ziel am 31.12.
  (bei 15.10.: 1.794.994 Schritte in 77 Tagen = 23.312 pro Tag).
- **Status**: Abweichung Ist − Soll bis gestern (bzw. inkl. heute, wenn heute eingetragen).
  „On plan“ innerhalb von ±10 % eines Tages-Solls, sonst „Ahead“/„Behind“.
- **Prognose 31.12.**: Gesamt + Ø der letzten 7 erfassten Tage × verbleibende Tage.
- **Fehlende Tage** zählen als 0, werden aber ausdrücklich aufgelistet („Not logged yet“),
  damit der Gesamtwert nicht unbemerkt zu niedrig ist.
- Datumslogik in lokaler Zeit; Tagesdifferenzen über UTC-Tagesnummern (keine
  Sommerzeit-Fehler). Um Mitternacht und beim Zurückkehren in die App wird neu berechnet.

Die Herleitung des Gesamtwerts steht in den Details unter „How the total is calculated“
(Startwert + n Tageswerte = Gesamt). Tage bis zum Startdatum werden nie doppelt gezählt.

## Daten & Synchronisierung

| Was | Lokal (localStorage) | Cloud |
|---|---|---|
| Tageswerte | `stepChallenge.v1.<user-id>.entries` | Tabelle `step_entries` (1 Zeile pro Nutzer und Tag) |
| Einstellungen (Ziel, Startwert, Vorjahr) | `stepChallenge.v1.<user-id>.config` | `settings`, Key `stepChallenge` |
| Ansicht (Details offen) | `stepChallenge.ui` | – |

- Jede Änderung wird **zuerst lokal** gespeichert (pro Nutzer-ID getrennt), dann hochgeladen.
- Konflikte pro Tag: **die neueste Änderung gewinnt** (`updated_at`). Ein Datenbank-Trigger
  verhindert zusätzlich, dass ein älterer Upload (z. B. vom Gerät, das offline war) einen
  neueren Wert überschreibt. Hat ein anderes Gerät denselben Tag neuer geändert, zeigt die
  Karte einen Hinweis mit beiden Werten.
- Andere Geräte erhalten Änderungen per Realtime sofort, sonst beim nächsten Öffnen.
- Offline / Cloud-Fehler: Daten bleiben lokal, Badge zeigt „Offline“ bzw. „Sync error“,
  Upload wird automatisch wiederholt (bei Rückkehr online, beim Öffnen, alle 60 s).
- Fehlt die Tabelle (Migration noch nicht ausgeführt): Badge „Device only“; das Sync-Panel
  (☁️) nennt die Migrationsdatei. Nach der Migration wird alles automatisch hochgeladen.
- **Export/Import** (☁️ → Sync & Backup) enthält die Schrittdaten; ein Import lädt sie
  wieder hoch.

## Einmalige Einrichtung in Supabase

`migrations/2026-10-16_step_entries.sql` im Supabase SQL Editor ausführen. Das Skript ist
idempotent und ändert keine bestehenden Tabellen. Es legt an: Tabelle, RLS-Policies
(nur eigene Zeilen), Rechte (`authenticated`, kein `anon`), Last-write-wins-Trigger und
Realtime-Freigabe. Geprüft mit `tests/sql/run.sh` gegen ein lokales PostgreSQL 16.

## Schnelleingabe per Link (optional, z. B. iOS-Kurzbefehl)

Ein Aufruf von `https://darad11.github.io/dalis-dashboard/?steps=12345&date=2026-10-16`
füllt das Formular nur **vor**; gespeichert wird erst nach Tippen auf **Save**. Damit kann
ein Kurzbefehl die Tagessumme aus Apple Health übergeben, ohne dass ein fremder Link Daten
schreiben könnte. Es gibt **keine** direkte Apple-Health-Anbindung – eine Web-App auf
GitHub Pages kann Health-Daten nicht selbst lesen.

Kurzbefehl (nicht auf einem echten iPhone getestet):
1. „Health-Beispiele suchen“ → Typ *Schritte*, Startdatum *ist heute*
2. „Statistik berechnen“ → *Summe*
3. „Datum formatieren“ → *Aktuelles Datum*, Format `yyyy-MM-dd`
4. „URL öffnen“ → `https://darad11.github.io/dalis-dashboard/?steps=[Summe]&date=[Formatiertes Datum]`

## Grenzen

- Werte werden manuell (oder per Link vorbefüllt) erfasst, nicht automatisch gemessen.
- Ein Wert pro Tag; Zwischenstände am Tag einfach überschreiben.
- Die Startwerte für 2026 stehen als Vorschlag im (öffentlichen) Quellcode
  (`SETUP_SUGGESTION` in `js/steps.js`); nach der Einrichtung werden sie nicht mehr gebraucht.
