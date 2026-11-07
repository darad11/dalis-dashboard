# Dali Life OS – Testmatrix

**Stand:** 7. November 2026 (Phase 0). Hier steht nur, was tatsächlich ausgeführt wurde, und was
geplant ist. „geplant“ heißt: noch nicht getestet.

## 1. Plattformen und wer testen kann

| Plattform | Automatisch in dieser Cloud-Sitzung | Braucht dich bzw. ein Gerät |
|---|---|---|
| Chromium Desktop | ja (Playwright) | – |
| Chromium mit Emulation von iPhone, iPad, iPhone Duo | ja (Viewport + Touch-Emulation; Duo-Maße sind Schätzungen Dritter) | – |
| Safari am Mac | nein (kein WebKit hier) | ja |
| Safari auf iPhone/iPad, Home-Bildschirm-App | nein | ja |
| iOS-App (Development Build) auf iPhone, iPad, iPhone Duo | nein (kein macOS/Xcode hier) | ja, Mac mit Xcode oder EAS Build |
| Supabase-Produktionsprojekt `dashboard` | **nie für Tests** | – |
| Lokales PostgreSQL für SQL-Tests | in dieser Sitzung nicht vorhanden | Entwicklungsrechner |

## 2. Ausgangsstand der bestehenden App (ausgeführt am 7.11.2026)

Umgebung: Node 22.22.0, Playwright mit Chromium (globale Installation), `@supabase/supabase-js`
2.117.2 nur für den Vertragstest; Branch `lifeos/phase-0-audit` = Stand von `main`.

| Suite | Befehl | Ergebnis | Bemerkung |
|---|---|---|---|
| Unit | `node --test "tests/unit/*.test.js"` | 58 / 58 bestanden | Step Challenge, Home, Matrix, Kalender, Datenabgleich, Edge Function |
| Vertrag | `node --test "tests/contract/*.test.js"` | 11 / 11 bestanden | echte `supabase-js`, abgefangenes `fetch`, kein Netz |
| E2E | `node tests/e2e/run.js` | 51 / 52 bestanden | rot: „swipe: calendar entries, lists and gym goals; week tasks on wide screens…“ – `TypeError: Cannot read properties of null (reading 'getBoundingClientRect')` in `tests/e2e/run.js:2534` |
| E2E, nur das rote Szenario | `node tests/e2e/run.js "swipe: calendar entries"` | 1 / 1 bestanden, zweimal hintereinander | instabil unter Last, nicht reproduzierbar einzeln |
| SQL | `tests/sql/run.sh "host=… port=5432 user=postgres"` | **nicht ausgeführt** | kein lokales PostgreSQL |

Nicht geprüft: Safari, echte Geräte, die Produktionsdatenbank (nur lesend inspiziert, siehe
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), Abschnitt 8).

## 3. Backup v2 (erster Umsetzungsschritt) – geplante Tests

| Nr. | Prüfung | Art | Status |
|---|---|---|---|
| B1 | Manifest enthält Format-Version, Zeitpunkt, Gerät, Anzahl und SHA-256 je Bereich | Unit | geplant |
| B2 | Kein `sb-*`-Schlüssel und kein `token_hash` in der Datei | Unit + E2E | geplant |
| B3 | Cloud-Teil enthält alle 10 Tabellen des eigenen Kontos, auch über mehrere Seiten | E2E mit Mock (große Datenmenge) | geplant |
| B4 | Prüfbericht erkennt eine manipulierte Datei (Prüfsumme falsch) | Unit | geplant |
| B5 | Dry-Run schreibt nichts (Mock zählt Schreibzugriffe = 0, `localStorage` unverändert) | E2E | geplant |
| B6 | Bestehender Export/Import funktioniert unverändert | E2E (bestehendes Szenario) | geplant |
| B7 | Export auf jedem eigenen Gerät/Browser, Prüfbericht ok | manuell durch dich | geplant |

## 4. POC (Phase 1) – Testmatrix

Spalten: **W-C** Web Chromium · **W-S** Web Safari Mac · **W-i** Safari iPhone/iPad · **N-P** iOS-App
iPhone · **N-T** iOS-App iPad. Jede Zelle braucht einen Nachweis (Testlauf, Log oder Bildschirmfoto).

| Nr. | Szenario | W-C | W-S | W-i | N-P | N-T |
|---|---|---|---|---|---|---|
| P1 | Anmeldung mit Magic Link | geplant | geplant | geplant | geplant | geplant |
| P2 | Anmeldung mit 6-stelligem Code (Mail auf anderem Gerät geöffnet) | geplant | – | – | geplant | – |
| P3 | Anlegen, Ändern, Löschen online; erscheint auf dem zweiten Gerät | geplant | geplant | geplant | geplant | geplant |
| P4 | Dasselbe offline (Flugmodus bzw. Netz aus), dann wieder online: beide Geräte gleich | geplant | geplant | geplant | geplant | geplant |
| P5 | Zwei Geräte ändern denselben Datensatz offline: Ergebnis nach Regel, Konflikt protokolliert | geplant | – | – | geplant | – |
| P6 | Dieselbe Änderung doppelt hochgeladen: kein Duplikat | geplant (automatisch) | – | – | – | – |
| P7 | Browser neu laden und neu starten: lokale Datenbank bleibt | geplant | geplant | geplant | – | – |
| P8 | Zwei Tabs gleichzeitig (IndexedDB bzw. `OPFSCoopSyncVFS`) | geplant | geplant | – | – | – |
| P9 | App beenden und offline neu starten: Daten sofort da | – | – | – | geplant | geplant |
| P10 | Offline-Start mit abgelaufenem Access-Token: lokale Daten statt Login-Sperre | geplant | geplant | geplant | geplant | – |
| P11 | Abmelden leert die lokale Datenbank; ein zweites Konto sieht nichts | geplant | geplant | – | geplant | – |
| P12 | RLS: Konto B kann Konto A weder lesen noch ändern (automatisiert gegen das POC-Projekt) | geplant | – | – | – | – |
| P13 | Vom Backend abgelehnte Änderung blockiert die Upload-Queue nicht und wird angezeigt | geplant | – | – | geplant | – |
| P14 | Worker-Dateien unter dem gewählten Host und Unterpfad erreichbar | geplant | geplant | geplant | – | – |
| P15 | `navigator.storage.persist()` und Verhalten nach Speicher-Räumung (Daten neu synchronisiert, nichts verloren, was hochgeladen war) | geplant | geplant | geplant | – | – |
| P16 | iOS-Build mit `@powersync/react-native` 2.4.0 + op-sqlite 18.2.5 auf React Native 0.88 (`expo-doctor` ohne Fehler) | – | – | – | geplant | geplant |
| P17 | Datum/Uhrzeit in `Europe/Vienna` über Sommerzeit-Umstellung (Hin- und Rückweg) | geplant (automatisch) | – | – | geplant | – |
| P18 | Startseite rendert aus der lokalen Datenbank ohne Netz | geplant | geplant | geplant | geplant | geplant |
| P19 | Bereitstellung auf dem gewählten Web-Host (nur nach Freigabe) | geplant | geplant | geplant | – | – |

**POC bestanden**, wenn P1, P3, P4, P6, P7, P9, P11, P12, P16 und P18 auf allen markierten Plattformen
grün sind und P5, P8, P10, P13–P15 dokumentiert sind (grün oder mit bewerteter Einschränkung).
Sonst: Ausweich-Empfehlung laut [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md), ADR-003.

## 5. Abnahmeszenarien der Spezifikation (18.2)

| Szenario | Inhalt | Phase | Status |
|---|---|---|---|
| A | Aufgabe erfassen, zuordnen, offline erledigen, ohne Duplikat synchronisieren | 2 | geplant |
| B | Wochenplanung mit allen aktiven Projekten, Fokusprojekte, Überlastungswarnung | 2 | geplant |
| C | Training offline erfassen, Verlauf nach Sync, keine erfundenen Gerätedaten | 3 | geplant |
| D | Essensplan → geprüfte Einkaufsliste, nur kompatible Einheiten abziehen | 4 | geplant |
| E | KI-Wochenrückblick nur mit freigegebenen Kategorien, Vorschläge mit Quellen, Freigabe nötig | 6 | geplant |
| F | iPhone offline, Web nutzbar, beide konvergieren; Neustart löscht nichts; Abmelden schützt Daten | 1 (Grundlage) und 2 | geplant |

## 6. Testebenen für die neue App

| Ebene | Inhalt | Werkzeug (vor Einsatz Kompatibilität prüfen) |
|---|---|---|
| Unit | Datumsregeln, Wiederholungen, Import-Umwandlung, Prüfsummen, später Nährwerte und Einkaufslisten | Test-Runner von `jest-expo` oder Node-Testrunner für reine Module |
| Repository/Service | CRUD, Besitzregeln, Idempotenz | gegen lokale PowerSync-Datenbank |
| RLS | Isolation zweier Konten | gegen das POC- bzw. Staging-Projekt, nie Produktion |
| Sync | offline, Wiederverbindung, Doppel-Upload, Löschen, zwei Geräte, Konflikte | Web automatisiert, iOS manuell mit Protokoll |
| UI | Tageserfassung, Wochenplanung | Web: Playwright; iOS: Werkzeug im POC festlegen |
| Barrierefreiheit | Kontrast, Beschriftungen, Fokus, Dynamic Type | automatisiert im Web, manuell auf iOS |
| Smoke | Web-Produktionsbuild, iOS Development/Release Build | bei jeder Phase |

## 7. Definition of Done je Phase (aus Spez. 18.3)

Abnahmekriterien bestanden · keine neuen TypeScript-Fehler · Lint und Format sauber · relevante
Tests grün · Migrationen dokumentiert und wo möglich umkehrbar · keine Geheimnisse committet · Web-
und iOS-Build gesund · Doku und Log aktualisiert · bekannte Grenzen benannt.
