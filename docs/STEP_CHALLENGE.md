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
- Kommen Daten an, während man tippt (erster Sync nach dem Öffnen, Realtime von einem anderen
  Gerät), wird die Karte neu aufgebaut; **Markierung und Cursor bleiben dabei erhalten**. Vorher
  sprang der Cursor ans Ende – wer den Vorschlag markiert hatte und überschrieb, bekam
  beide Zahlen hintereinander (z. B. `4.018.4052.233.411`, Fehlermeldung „Only digits are
  allowed“). Aufgefallen, weil ein E2E-Test gelegentlich daran scheiterte.
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

## Automatisch aus Apple Health

Eine Webseite kann Apple Health nicht lesen (HealthKit gibt es nur für Apps auf dem Gerät). Ein
**Kurzbefehl** auf dem iPhone kann es: Er liest die heutigen Schritte und schickt sie an das
Dashboard – per Automation mehrmals am Tag, ohne Eintippen. Offene Dashboards zeigen den neuen
Wert sofort (wie eine Änderung von einem anderen Gerät).

### 1. Upload-Schlüssel im Dashboard

Health → Step Challenge → **Apple Health** → **Set up** → **Create upload key**. Angezeigt
werden der **Schlüssel** (nur dieses eine Mal) und die **Adresse** – beide mit **Copy**
kopieren und in den Kurzbefehl einsetzen. Danach **Done**.

### 2. Kurzbefehl bauen

App **Kurzbefehle** → **+**. Die Aktionen findest du über die Suche (z. B. „Health“, „Statistik“,
„Datum“, „URL“). Die deutschen Namen stammen aus Screenshots eines iPhones (Oktober 2026); in
Klammern steht der englische Name. Ein **blasser** Eintrag in einer Aktion ist ein leerer
Platzhalter – er muss angetippt und belegt werden.

1. Health-Messungen suchen (*Find Health Samples*): Typ ist **Steps** (Schritte), Startdatum
   **ist heute**, über **Filter hinzufügen**: **Quelle ist Apple Watch**; Gruppieren nach
   **Ohne**. Ohne diesen Filter zählt der Kurzbefehl iPhone und Apple Watch doppelt: Die
   Health-App nimmt pro Zeitabschnitt nur eine Quelle (Watch vor iPhone), der Kurzbefehl addiert
   alle Messungen, auch mit „Gruppieren nach Tag“. Stehen mehrere Watch-Einträge in der Liste,
   den nehmen, der die Zahl der Health-App ergibt (Test: „Hinweis zeigen“ mit der Summe direkt
   nach Schritt 2, danach wieder löschen). „Quelle ist nicht“ iPhone geht auch, ist aber
   riskanter: Ein neues iPhone oder eine weitere App mit Schritten zählt dann wieder doppelt, und
   ein zu hoher Wert bleibt stehen; ein nicht mehr passender Watch-Filter liefert nur 0.
2. Statistik berechnen (*Calculate Statistics*): **Summe** – erscheint als „Summe von
   Health-Messungen berechnen“.
3. Datum formatieren (*Format Date*):
   - das blasse **Datum** oben antippen → **Aktuelles Datum** wählen (bleibt es blass, ist das
     Datum leer);
   - **Datumsformat: ISO 8601** – dann ist kein eigenes Format nötig (mit oder ohne Uhrzeit,
     beides wird angenommen). Wer **Eigenes** wählt: im Feld „Zeichenketten formatieren“ muss
     genau `yyyy-MM-dd` stehen (das erste `y` klein – die Tastatur schreibt es gern groß) und
     keine Variable wie „Summe“.
4. Inhalte von URL abrufen (*Get Contents of URL*): URL = die kopierte Adresse,
   Methode **POST**, Haupttext anfordern **JSON**, über „neues Feld hinzufügen“ drei Felder:

   | Schlüssel | Typ | Wert |
   |---|---|---|
   | `token` | Text | der kopierte Upload-Schlüssel |
   | `date` | Text | Formatiertes Datum (aus Schritt 3) |
   | `steps` | Zahl | Summe (aus Schritt 2) |

5. Einmal ausführen (▶︎). Die Antwort lautet `Saved: … steps on …`. **Vergleiche die Zahl mit
   der Health-App** – gleich oder knapp darunter ist richtig. Fast doppelt so hoch: Der
   Quellenfilter aus Schritt 1 fehlt. Ein zu hoher Wert, der schon
   gespeichert ist, wird von späteren Läufen **nicht** gesenkt (siehe Regeln) – den Tag dann im
   Dashboard einmal von Hand korrigieren. Bei einer Fehlermeldung: [Fehlersuche](#fehlersuche).

### 3. Automation

Kurzbefehle → **Automation** → **+** → **Tageszeit**, z. B. 12:00, täglich → **Sofort
ausführen** → deinen Kurzbefehl wählen. Für mehrere Zeitpunkte je eine Automation anlegen
(z. B. 12:00, 18:00, 21:00, 23:45). Zuverlässiger, weil das iPhone dabei entsperrt ist:
zusätzlich eine Automation „App → wird geöffnet“ (z. B. Safari oder die Fitness-App).

### Regeln

- Übertragen wird die **Tagessumme** von heute; jeder Lauf ersetzt den Wert des Tages durch
  den höheren. **Ein niedrigerer Wert ersetzt nie einen höheren** (ein Lauf auf dem
  gesperrten iPhone oder ein halber Tag löscht also nichts). Ein von Hand eingetragener
  höherer Wert bleibt; ein niedrigerer wird beim nächsten Lauf auf den Health-Wert angehoben.
- Ein Tag, der auf „nicht erfasst“ gesetzt wurde, wird durch einen Upload wieder gefüllt.
- Angenommen werden Tage der letzten 31 Tage (und morgen, wegen der Zeitzone), 0 bis 200.000
  Schritte. Tage bis zum Startdatum der Challenge zählen wie immer nicht (im Startwert).
- Die Karte zeigt, wann zuletzt übertragen wurde („last upload today, 18:02“); unter
  **Manage** stehen alle Schlüssel mit Erstellung und letzter Übertragung.

### Sicherheit

- Der Schlüssel entsteht im Browser (32 Zufallsbytes). Gespeichert wird **nur sein
  SHA-256-Hash** (Tabelle `step_upload_tokens`, RLS: nur eigene Zeilen, der Hash ist über die
  API nicht lesbar). Der Schlüssel selbst steht nur im Kurzbefehl – weder im Dashboard noch
  auf dem Gerät gespeichert.
- Er kann **nur Schritte des eigenen Kontos schreiben**, nichts lesen. **Revoke** sperrt
  ihn sofort; bereits übertragene Schritte bleiben. Höchstens 5 Schlüssel pro Konto.
- Der Kurzbefehl ruft die Edge Function `health-steps` auf (ohne Supabase-Anmeldung). Sie
  prüft den Schlüssel über die Datenbankfunktion `submit_health_steps`, die **nur** mit dem
  geheimen Server-Schlüssel aufrufbar ist. Dieser bleibt in der Edge Function (von Supabase
  bereitgestellt) und steht weder im Code noch im Frontend.
- Wer den Schlüssel hat, kann Schrittzahlen in dein Konto schreiben – deshalb nicht teilen
  und bei Verdacht widerrufen und neu erstellen.

### Grenzen

- **Gesperrtes iPhone:** Apple verschlüsselt die Health-Daten, solange das Gerät gesperrt ist
  („the device encrypts the HealthKit store when the user locks the device“, [HealthKit:
  Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)).
  Läuft eine Automation dann, kann der Kurzbefehl nichts lesen; der nächste Lauf holt es nach.
- Übertragen wird nur **heute**. Schritte nach dem letzten erfolgreichen Lauf eines Tages
  (z. B. nach 23:45) fehlen – bei Bedarf von Hand nachtragen.
- Mit „Quelle ist Apple Watch“ zählt der Kurzbefehl nur die Watch. Die Health-App ergänzt
  iPhone-Schritte aus Zeiten ohne Watch – deshalb liegt der Wert gleich oder knapp darunter. Ein
  Tag ganz ohne Watch ergibt 0 (ändert nichts) – dann von Hand eintragen.
- Ein Kurzbefehl auf einem echten iPhone erreicht die Edge Function (Log vom 16.10.2026, erster
  Lauf mit leerem Datum, siehe [Fehlersuche](#fehlersuche)); ein erfolgreicher Upload und die
  Automation sind noch nicht bestätigt. Geprüft sind Datenbank, Edge Function und Dashboard
  (siehe [tests/README.md](../tests/README.md)).

### Fehlersuche

Die Edge Function sagt in der Antwort, was angekommen ist (die Kurzbefehle-App zeigt sie beim
Ausführen im Editor an):

| Antwort | Ursache → Lösung |
|---|---|
| `date is empty: in "Format Date" …` | „Datum formatieren“ hat kein Datum (blasses **Datum**) → antippen, **Aktuelles Datum** |
| `date must be a day like 2026-10-16, received "…"` | falsches Datumsformat (z. B. „Kurz“: `16.10.26`) → **Datumsformat: ISO 8601** |
| `date is missing … fields received: …` | Feld heißt nicht genau `date` (klein geschrieben) |
| `steps is empty: …` | keine Schritte gelesen – z. B. Lauf auf dem gesperrten iPhone; der nächste Lauf holt es nach |
| `steps must be a number, received "…"` | im Feld `steps` steht nicht die **Summe** |
| `Unknown upload token …` / `Unknown or revoked upload token …` | Schlüssel unvollständig kopiert oder widerrufen → im Dashboard neu erzeugen und einsetzen |
| `date must be within the last 31 days` | Datum weit daneben, z. B. `YYYY` statt `yyyy` im eigenen Format → **ISO 8601** |
| `Received 7 steps for …, kept the stored 29341: …` | Lauf erfolgreich, aber dieser Lauf hat weniger gezählt als gespeichert ist; gespeichert bleibt der höhere Wert. Ist der gespeicherte Wert falsch (z. B. doppelt gezählt), im Dashboard von Hand korrigieren; zählt der Lauf fast nichts, passt der Quellenfilter in Aktion 1 nicht |

Der erste echte Lauf (16.10.2026, 20:29) brachte `date must be a day like 2026-10-16`: Im
Kurzbefehl war bei „Datum formatieren“ kein Datum gesetzt, und im Formatfeld stand die Variable
„Summe“. Die Anfrage war 79 Bytes groß – mit Schlüssel (43 Zeichen) und fünfstelliger Schrittzahl
genau ein leeres `date`. Deshalb nennt die Funktion ein leeres Datum ausdrücklich (`date is empty`).

Der erste erfolgreiche Lauf (21:54) speicherte **29.341** Schritte – die Health-App zeigte 15.073:
ohne Quellenfilter zählt der Kurzbefehl iPhone und Apple Watch doppelt (die Health-App rechnet
überlappende Schritte nur einmal; „Gruppieren nach Tag“ verhindert das nicht). Der nächste Lauf
mit Quellenfilter „Apple Watch“ schickte nur eine einstellige Zahl (Anfrage 85 Bytes); die
Antwort zeigte aber nur den gespeicherten Wert („29341 steps … already stored“) und sah aus wie
das Ergebnis dieses Laufs. Deshalb nennt die Antwort beides: `received` (dieser Lauf) und
`steps` (gespeichert). Mit „Hinweis zeigen“ (Variable Summe) direkt nach der Summe
ergab sich am selben Abend: Filter „Quelle ist Apple Watch von Dalibor“ → keine einzige Messung
(mit und ohne Gruppieren), „Quelle ist“ iPhone → 14.499, „Quelle ist nicht“ iPhone → 14.988
(Health-App: 15.073). Die Quellenliste enthielt zwei Watch-Einträge: „Apple Watch von
Dalibor“ fand nichts, „Apple Watch“ ergab den richtigen Wert – daher der Filter „Quelle ist
Apple Watch“.

### Technik

| Teil | Datei |
|---|---|
| Datenbank: Tabelle `step_upload_tokens`, Funktion `submit_health_steps` (nur `service_role`) | `migrations/2026-10-16_step_health_sync.sql` |
| Edge Function `health-steps` (ohne JWT-Prüfung, der Upload-Schlüssel authentifiziert) | `supabase/functions/health-steps/` |
| Einrichtung im Dashboard | `js/steps.js` („Apple Health“), `js/supabase.js` |

Anfrage: `POST https://<projekt>.supabase.co/functions/v1/health-steps` mit
`{"token": "…", "date": "2026-10-16", "steps": 12345}`. Antworten: `200` gespeichert
(bzw. höherer Wert behalten; `received` = dieser Lauf, `steps` = gespeichert), `400` Datum/Zahl fehlt, leer oder ungültig (die Antwort nennt,
was ankam, siehe [Fehlersuche](#fehlersuche)), `401` Schlüssel fehlt, unbekannt oder widerrufen,
`405` nicht POST, `502` Datenbank nicht erreichbar. `steps` darf auch Text
sein (`"12.345"`), `date` auch `16.10.2026`.

Einmalig in Supabase: Migration ausführen (idempotent, ändert nichts Bestehendes) und die
Function veröffentlichen: `supabase functions deploy health-steps --no-verify-jwt`.

## Schnelleingabe per Link (optional, z. B. iOS-Kurzbefehl)

Ein Aufruf von `https://darad11.github.io/dalis-dashboard/?steps=12345&date=2026-10-16`
füllt das Formular nur **vor**; gespeichert wird erst nach Tippen auf **Save**. So kann
ein fremder Link keine Daten schreiben. Für die automatische Übertragung ohne Tippen siehe
[Automatisch aus Apple Health](#automatisch-aus-apple-health).

Kurzbefehl (nicht auf einem echten iPhone getestet):
1. „Health-Beispiele suchen“ → Typ *Schritte*, Startdatum *ist heute*
2. „Statistik berechnen“ → *Summe*
3. „Datum formatieren“ → *Aktuelles Datum*, Format `yyyy-MM-dd`
4. „URL öffnen“ → `https://darad11.github.io/dalis-dashboard/?steps=[Summe]&date=[Formatiertes Datum]`

## Grenzen

- Werte werden von Hand, per Link vorbefüllt oder per Kurzbefehl aus Apple Health erfasst;
  das Dashboard selbst misst nichts.
- Ein Wert pro Tag; Zwischenstände am Tag einfach überschreiben.
- Die Startwerte für 2026 stehen als Vorschlag im (öffentlichen) Quellcode
  (`SETUP_SUGGESTION` in `js/steps.js`); nach der Einrichtung werden sie nicht mehr gebraucht.
