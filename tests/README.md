# Tests

Keine Abhängigkeiten im Dashboard selbst; die Tests nutzen nur Werkzeuge auf dem Entwicklungsrechner.
Keiner der Tests spricht mit dem echten Supabase-Projekt.

| Suite | Prüft | Befehl |
|---|---|---|
| Unit | Berechnungslogik Step Challenge (`js/steps-core.js`) | `node --test "tests/unit/*.test.js"` |
| Vertrag | `js/supabase.js` erzeugt die erwarteten PostgREST-Requests (echte supabase-js, abgefangenes `fetch`) | `npm install --no-save @supabase/supabase-js@2.117.2 && node --test "tests/contract/*.test.js"` |
| SQL | Migration, RLS, Trigger, Constraints gegen ein **lokales Wegwerf-PostgreSQL** | `tests/sql/run.sh "host=/tmp port=5432 user=postgres"` |
| E2E | Dashboard in Chromium mit In-Memory-Supabase-Mock (Step Challenge, Sync, bestehende Funktionen, iPhone/iPhone-Duo/iPad-Layout, Touch-Aktionen, Desktop unverändert) | `node tests/e2e/run.js` (optional Filter: `node tests/e2e/run.js foldable`) |

Voraussetzungen:
- Node.js ≥ 20 (Unit, Vertrag, E2E)
- E2E: Playwright inkl. Chromium (`npm install --no-save playwright && npx playwright install chromium`
  oder eine globale Installation)
- SQL: PostgreSQL ≥ 14 lokal; das Skript legt eine temporäre Datenbank an und löscht sie wieder.
  `tests/sql/supabase-shim.sql` bildet nur die benötigten Supabase-Teile nach (Rollen, `auth.uid()`).

E2E-Hinweise:
- `tests/e2e/demo-data.js` füllt den In-Memory-Mock mit Beispielinhalten (Ziele, Woche, Habits,
  Listen) für Layout-Tests – nie die echte Datenbank.
- Touch-Geräte werden mit `isMobile` + `hasTouch` emuliert (`pointer: coarse`, `hover: none`).
  Keine `fullPage`-Screenshots in diesen Tests: Chromium verliert dabei die Touch-Emulation
  (`pointer: coarse` wird falsch); für lange Seiten den Viewport vergrößern.
- Das iPhone Duo wird über geschätzte Viewports simuliert (466×678 zugeklappt, 890×626
  aufgeklappt); Auf-/Zuklappen = `page.setViewportSize`.
