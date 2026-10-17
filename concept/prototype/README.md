# Konzept-Prototyp: Dali’s Dashboard

Interaktiver Klick-Prototyp zu den Konzepten A–G aus dem Bericht „Product Discovery & Roadmap“:
Home, Inbox & Quick Capture, Projekte mit gemeinsamem Aufgabenpool, Tages-/Wochenplanung,
Tagesabschluss, Wochenrückblick und native iOS-Ideen.

**Das ist kein Teil der produktiven App.** Der Ordner `concept/` ist bewusst vom Rest des
Repositories getrennt:

- keine Verbindung zu Supabase, keine Anmeldung, keine API-Schlüssel
- keine Änderung an Datenmodell, Sync, Authentifizierung oder Deployment
- ausschließlich erfundene Beispieldaten (Demo-Zeit: Mittwoch, 14. Oktober 2026, 09:40 Uhr)
- Änderungen im Prototyp bleiben im `localStorage` des jeweiligen Browsers und gehen nirgendwohin

## Öffnen

Variante 1 – Doppelklick auf `index.html` (läuft direkt aus dem Dateisystem).

Variante 2 – kleiner lokaler Server, z. B. aus diesem Ordner:

```sh
python3 -m http.server 8080
# dann http://localhost:8080/ im Browser öffnen
```

Am iPhone ausprobieren: entweder die private claude.ai-Seite verwenden (Link im Konzeptbericht)
oder den lokalen Server im selben WLAN über die IP des Rechners aufrufen.

## Ausprobieren

- **Desktop / iPhone** oben rechts: schaltet zwischen Desktop-Layout und einem iPhone-Rahmen (393 × 852).
  Auf einem echten Smartphone wird automatisch das Touch-Layout mit Tab-Leiste gezeigt.
- **Workflows**: drei geführte Abläufe (neuer Gedanke, produktiver Arbeitstag, Tages- und
  Wochenabschluss). „Weiter“ führt den jeweiligen Schritt wirklich aus und markiert die Stelle.
- **Varianten**: Home „Aufgaben-Fokus“ vs. „Tagesplanung“, Projekte als Chips vs. Karten,
  Tagesansicht linear vs. zwei Spalten, Tagesabschluss kompakt vs. schrittweise, Demo-Zeit
  (09:40 / 18:30), Hell/Dunkel, Beispieldaten zurücksetzen.
- Aufgaben lassen sich anlegen (Inbox → Einordnen), bearbeiten (Antippen → Detail), auf Tage
  planen, mit Zeitblöcken versehen, abhaken, löschen und im Tagesabschluss entscheiden.

## Was nur simuliert ist

| Bereich | Im Prototyp | In Wirklichkeit nötig |
|---|---|---|
| „per Kurzbefehl diktieren“, Siri, Teilen-Menü | legt einen vorbereiteten Inbox-Eintrag an | Kurzbefehl → Edge Function bzw. App Intent / Share Extension |
| Termine | feste Beispieltermine | Kalender aus der App (vorhanden) oder EventKit |
| Schritte, Wetter | feste Zahlen, als „Demo“ markiert | Apple-Health-Kurzbefehl (vorhanden), Wetterdienst |
| Fokus-Session | Timer läuft, „Beenden“ schreibt 25 min gut | echte Dauer, Persistenz, Live Activity nur nativ |
| Widgets, Sperrbildschirm, Live Activity | statische Mockups unter „iOS“ | nur mit einer nativen iOS-App |
| Speichern | `localStorage` dieses Browsers | Supabase-Tabellen mit stabilen IDs |

## Dateien

- `index.html` – Rahmen (Demo-Banner, Kopfzeile, Tab-Leiste)
- `styles.css` – Design-Tokens (hell/dunkel), Komponenten, Phone-Layout über Container-Queries
- `app.js` – Beispieldaten, abgeleitete Regeln (nächster Schritt, Kapazität, Zeitleiste), Ansichten, Workflows
- `screenshots.js` – erzeugt die Screenshots für den Bericht (`node screenshots.js <ordner> [filter]`, braucht Playwright + Chromium)

Für Tests und Screenshots gibt es `window.Proto` mit `setVariants`, `demoAction`, `wfNext`, `reset` und `state`.
