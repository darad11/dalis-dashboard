# Dali Life OS – Architekturentscheidungen

**Stand:** 7. November 2026 (Phase 0). Jede Entscheidung hat einen Status:
**akzeptiert** (durch Spezifikation oder Freigabe festgelegt) · **vorgeschlagen** (Empfehlung, wartet
auf Freigabe bzw. den POC) · **offen** (braucht eine Entscheidung von dir).

Quellen der Prüfung: npm-Registry (Versionen, Abhängigkeiten, Veröffentlichungsdaten) und die
Quelltexte der offiziellen Dokumentation auf GitHub (`powersync-ja/powersync-docs`,
`expo/expo/docs`, `supabase/supabase/apps/docs`), abgerufen am 7.11.2026. Die Doku-Websites selbst
(docs.expo.dev, docs.powersync.com) sind im Netzwerk dieser Cloud-Sitzung gesperrt; eine Websuche
lieferte für Expo einen veralteten Stand (SDK 57), die Registry zeigt SDK 58 als `latest`.

| Nr. | Entscheidung | Status |
|---|---|---|
| ADR-001 | Neue App parallel aufbauen, Alt-App bis zur geprüften Migration weiterbetreiben | vorgeschlagen |
| ADR-002 | Expo SDK 58 mit Expo Router, React Native Web und TypeScript | vorgeschlagen, POC-Gate |
| ADR-003 | Local-first-Sync mit PowerSync auf Supabase Postgres | vorgeschlagen, POC-Gate |
| ADR-004 | Eigenes Supabase-Projekt für POC und neue App | vorgeschlagen |
| ADR-005 | Neues, normalisiertes Schema mit stabilen UUIDs; Altdaten per Import | vorgeschlagen |
| ADR-006 | Schreibweg und Konflikte | vorgeschlagen |
| ADR-007 | Anmeldung: Magic Link, optional Code, neue Supabase-Schlüssel | vorgeschlagen |
| ADR-008 | Web-Speicher und Hosting | offen (D1) |
| ADR-009 | Datenzugriff über typisierte Repositories, kein ORM vorab | vorgeschlagen |
| ADR-010 | Betrieb und Kosten (PowerSync Cloud oder selbst gehostet) | offen (D2) |
| ADR-011 | iOS-Builds | offen (D4) |
| ADR-012 | Apple Health: Kurzbefehl bleibt bis zur HealthKit-Phase | vorgeschlagen |
| ADR-013 | Datensicherung vor jeder Migration (Backup v2) | akzeptiert |
| ADR-014 | Design-Tokens zentral; Designrichtung A/B/C | offen (D5) |
| ADR-015 | Verschlüsselung der lokalen Datenbank | später (Phase 3) |

---

## ADR-001 – Parallel aufbauen statt umbauen

**Status:** vorgeschlagen

**Kontext.** Die bestehende App ist Vanilla-JavaScript mit DOM-Code (≈ 15.000 Zeilen) und einem
Speicher aus `localStorage`-Schlüsseln. Die Zielarchitektur (Expo/React Native, SQLite, PowerSync)
teilt keinen Oberflächen- oder Speichercode damit. Ein schrittweiser Umbau im selben Code würde
zwei Speichermodelle gleichzeitig pflegen.

**Entscheidung.** Die neue App entsteht in einem eigenen Projekt (eigener Ordner oder eigenes Repo,
eigenes Supabase-Projekt). Die Alt-App bleibt live und unverändert nutzbar. Übernommen werden
Daten (per geprüftem Import, siehe [DATA_MIGRATION.md](DATA_MIGRATION.md)) und die DOM-freien
Regeln samt Tests (`calendar-core`, `matrix-core`, `home-core`, `steps-core`, Feiertage), portiert
nach TypeScript. Umgeschaltet wird pro Lebensbereich erst, wenn die neue App ihn vollständig
abdeckt; dann wird die Alt-App für diesen Bereich schreibgeschützt und später abgeschaltet.

**Alternativen.** Umbau der Alt-App zur PWA mit SQLite/PowerSync-Web: kein iOS-nativer Weg,
HealthKit unmöglich. Komplett-Neubau mit Stichtag: hohes Risiko, lange Phase ohne nutzbare App.

**Konsequenzen.** Eine Übergangszeit mit zwei Apps; Regeln für den Wechsel (welcher Bereich wo
bearbeitet wird) müssen klar sein. Kein Big Bang, jede Phase endet mit einer nutzbaren App.

## ADR-002 – Expo SDK 58, Expo Router, React Native Web, TypeScript

**Status:** vorgeschlagen, wird im POC bestätigt

**Befund (npm-Registry, 7.11.2026).** `expo@latest` = 58.0.23; 58.0.0 erschien am 29.9.2026. Die
mitgelieferten Versionen (`bundledNativeModules.json`): `react-native` 0.88.1, `react`/`react-dom`
19.3.0, `react-native-web` ~0.21.4, `expo-router` ~58.0.30, `expo-linking` ~58.0.16,
`expo-secure-store` ~58.0.2, `expo-sqlite` ~58.0.15, `expo-dev-client` ~58.0.18. Laut Expo-Doku
läuft SDK 55 und neuer ausschließlich auf der New Architecture; jede native Bibliothek muss sie
unterstützen. Neue Vorlagen setzen in SDK 58 `web.output: "server"`; für einen statischen Host ist
`static` oder `single` explizit zu wählen.

**Entscheidung.** Eine Codebasis für iOS (iPhone, iPad) und Web (Mac, iPad); Expo-verwaltete Pakete
nur mit `npx expo install`; Lockfile committen; `npx expo-doctor` vor jeder nativen Abhängigkeit.
Keine Canary-, Beta- oder RC-SDKs.

**Konsequenzen.** iOS braucht einen Development Build (siehe ADR-011). Web und iOS teilen Logik,
aber nicht jede Bibliothek; plattformspezifische Dateien (`.web.ts` / `.native.ts`) sind eingeplant.

## ADR-003 – Local-first-Sync mit PowerSync

**Status:** vorgeschlagen; Übernahme für Produktivcode erst nach bestandenem POC (Spez. 13.1)

**Befund (offizielle Doku, Seite „Feature Status“).** Postgres-Anbindung **GA**, Sync Streams
**GA**, React-Native-SDK **GA**, JavaScript/Web-SDK **GA**, React Hooks **GA**, Open Edition
(selbst gehostet) **GA**, **React Native Web Support Beta**, **OP-SQLite Support Beta**, Drizzle
Beta. „Beta“ heißt bei PowerSync: produktionsreif für getestete Anwendungsfälle, API stabil, mit
SLA, Doku kann Lücken haben.

**Versionen für den POC (Registry, 7.11.2026):**

| Paket | Version | Hinweis |
|---|---|---|
| `@powersync/react-native` | 2.4.0 (2.11.2026) | Peer: `@op-engineering/op-sqlite` **≥ 17.1.0 < 19.0.0** |
| `@op-engineering/op-sqlite` | **18.2.5** festpinnen | `latest` ist 19.0.5 (19er-Reihe seit 26.10.2026) und passt nicht zum Peer-Bereich; `npx expo install` würde 19 wählen, weil op-sqlite nicht in Expos Versionsliste steht |
| `@powersync/web` | 2.6.0 | bringt `@journeyapps/wa-sqlite` 2.0.10 mit |
| `@powersync/react` | 2.2.0 | Hooks |
| `@powersync/common` | 2.5.0 | transitiv |
| `@supabase/supabase-js` | 2.119.0 | Alt-App bleibt auf 2.117.2 |

Die Installationsanleitung nennt `npx expo install @powersync/react-native @op-engineering/op-sqlite`;
op-sqlite läuft nicht in Expo Go (dafür gibt es einen JS-Adapter, der für dieses Projekt nicht
gebraucht wird). Für Watched Queries mit Async Iterator braucht Expo zusätzlich einen Polyfill und
ein Babel-Plugin (README des Pakets).

**Web-Einrichtung laut Doku „React Native Web Support“ (Beta):** `@powersync/web` zusätzlich
installieren; Worker-Dateien mit `npx @powersync/web copy-assets` nach `public/@powersync`
kopieren; Datenbank- und Sync-Worker beim Erzeugen angeben; Metro so konfigurieren, dass Web
`@powersync/web` und nativ `@powersync/react-native` auflöst; die Datenbank je Plattform erzeugen.

**Wie Konflikte grundsätzlich laufen (Doku „Consistency“, „Handling Update Conflicts“).** Der Client
schreibt in seine SQLite-Datenbank und in eine geordnete Upload-Queue (PUT/PATCH/DELETE). Die App
lädt die Queue über eigene Funktionen hoch (hier: `supabase-js` unter RLS). Solange die Queue nicht
leer ist, übernimmt der Client keinen neuen Server-Stand; der Server ist maßgeblich
(„server-authoritative“). Standardverhalten ist Last-Write-Wins pro Feld; Abweichendes muss das
Backend umsetzen. Die Queue blockiert, wenn das Backend eine Änderung nicht bestätigt – Validierungs-
fehler müssen daher bewusst behandelt werden.

**Alternativen (geprüft anhand des Expo-Leitfadens „Local-first“, nur als Ausweichplan).**

| Option | Passt? |
|---|---|
| Legend-State mit Supabase-Plugin | einfach, kleine Datenmengen; Persistenz nativ über AsyncStorage, im Web über Browser-Speicher; kein relationales lokales SQL – Ausweichkandidat Nr. 1 |
| RxDB mit Supabase-Replikation | ausgereift, NoSQL-Modell, nutzt `expo-sqlite`; Lizenzmodell einzelner Plugins prüfen |
| ElectricSQL | Postgres-Lesepfad; Schreibweg, lokale Datenbank und Konfliktlogik müssten selbst gebaut werden |
| TinyBase, Yjs, Jazz, LiveStore, Instant, Turso Offline Sync | eigene Datenmodelle bzw. eigene Backends oder (Turso) Offline-Sync noch Beta ohne automatische Konfliktlösung; widerspricht Supabase Postgres als Quelle der Wahrheit |
| Eigener Sync auf Supabase Realtime | laut Spezifikation **nicht** still als Ersatz zulässig; die Alt-App zeigt, wie aufwendig das wird |

**Konsequenzen.** Der POC muss die Beta-Bausteine beweisen (Testfälle in
[TEST_MATRIX.md](TEST_MATRIX.md)). Scheitert er, wird eine Ausweichlösung vorgeschlagen und nicht
heimlich umgesetzt.

## ADR-004 – Eigenes Supabase-Projekt für POC und neue App

**Status:** vorgeschlagen

**Kontext (lesender Befund im Produktionsprojekt `dashboard`).** Unique-Indizes ohne Nutzerbezug
(`settings.key`, `lists.name`, `notes.date`, `pomodoro_stats.date`) blockieren gleiche Schlüssel
für ein zweites Konto. PowerSync braucht eine Rolle mit `REPLICATION` und `BYPASSRLS`, eine
Publikation `powersync` und bindet einen Replikations-Slot, der WAL hält (Doku warnt vor vollen
Datenträgern im Free Plan). Das sind Rechte- und Betriebsänderungen an der Produktion. Testdaten
dürfen nicht in den produktiven Bestand.

**Entscheidung.** POC in einem **neuen** Free-Projekt (z. B. „lifeos-poc“). Für die neue App später
ein eigenes Projekt (z. B. „lifeos“). Das Projekt `dashboard` bleibt bis nach der Migration
unverändert und dient danach als Quelle des Imports. Laut Supabase-Doku hat jeder Nutzer zwei aktive
Free-Projekte; pausierte zählen nicht (ein zweites Projekt in der Organisation ist pausiert).

**Konsequenzen.** Getrennte Konten pro Projekt (dieselbe E-Mail-Adresse, aber ein neues Konto im
neuen Projekt); der Import liest aus `dashboard` und schreibt in das neue Projekt.

## ADR-005 – Neues Schema mit stabilen UUIDs, Altdaten per Import

**Status:** vorgeschlagen

**Kontext.** Das Altmodell speichert Tage als Text-Schlüssel (`cal-2026-9-14` = 14. **Oktober**,
Monat 0-basiert), mischt Ziele und Termine in `goals`, erzeugt bei jedem Speichern neue Zeilen-IDs,
legt Wochenaufgaben als JSON-Text ab und hängt Habit-Häkchen an die Position in der Liste.
PowerSync verlangt pro Tabelle eine stabile `id`.

**Entscheidung.** Tabellen nach Spezifikation 13.3/13.4, nur für das jeweils gebaute Modul:
UUID-Primärschlüssel (vom Client erzeugt), `user_id`, `created_at`, `updated_at`, `deleted_at`
(Soft Delete), bei Ereignissen `occurred_at` und `local_date`, Zeitzone `Europe/Vienna`.
Importierte Datensätze erhalten **deterministische UUIDs** (UUIDv5 aus Quelle + Altschlüssel +
Inhalt), damit ein wiederholter Import nichts doppelt anlegt.

**Konsequenzen.** Zuordnung und Validierung pro Bereich in [DATA_MIGRATION.md](DATA_MIGRATION.md).
Die Alt-Tabellen bleiben unangetastet.

## ADR-006 – Schreibweg und Konflikte

**Status:** vorgeschlagen

**Entscheidung.**

1. Uploads über `supabase-js` mit dem JWT des Nutzers; RLS prüft jede Änderung; kein Schreibweg mit
   Service-Key (Spez. 13.7).
2. Operationen idempotent: Upsert per `id`, DELETE auf bereits gelöschte Zeilen ist kein Fehler.
3. Planungsdaten: Last-Write-Wins pro Feld als Basis, plus `updated_at` vom Gerät und eine Tabelle
   für erkannte Konflikte (Muster „Server-Side Conflict Recording“ aus der PowerSync-Doku), damit
   gleichzeitige Änderungen nicht still verloren gehen (Spez. 13.7).
4. Löschen gewinnt; Soft Delete über `deleted_at`.
5. Aktivitäts-Logs (Habits, Training, Schritte, Essen) append-only; Korrekturen als nachvollziehbare
   Änderung.
6. Validierungsfehler blockieren die Queue nicht: Ablehnungen werden protokolliert und sichtbar
   gemacht statt still verworfen.

## ADR-007 – Anmeldung

**Status:** vorgeschlagen

**Befund.** Supabase empfiehlt für neue Projekte *publishable/secret keys* und asymmetrische
JWT-Signaturschlüssel; PowerSync prüft Supabase-JWTs dann per JWKS
(`https://<projekt>.supabase.co/auth/v1/.well-known/jwks.json`, Audience `authenticated`), alte
HS256-Secrets werden weiter unterstützt. Magic Link in einer nativen App braucht ein eigenes
URL-Schema, `expo-linking`, die Redirect-URL in „Additional Redirect URLs“ und das Übernehmen der
Sitzung aus dem Link. Die Expo-Anleitung speichert die Sitzung mit
`expo-sqlite/localStorage/install` und setzt `detectSessionInUrl: false`.

**Entscheidung.** Magic Link wie in der Spezifikation, zusätzlich der 6-stellige Code
(`verifyOtp`), weil ein Link, der auf dem Mac geöffnet wird, das iPhone nicht anmeldet. Neues Projekt
mit publishable key und asymmetrischen Signaturschlüsseln. Abmelden leert die lokale Datenbank
(`disconnectAndClear`), damit ein nächstes Konto nichts sieht (Szenario F).

**Im POC zu prüfen.** Ob `expo-sqlite` (nur für die Sitzung) neben op-sqlite in derselben App
Probleme macht; sonst Sitzung über AsyncStorage bzw. Secure Store.

## ADR-008 – Web-Speicher und Hosting

**Status:** offen (Entscheidung D1)

**Befund (PowerSync Web-SDK-Doku).** Standard ist IndexedDB (`IDBBatchAtomicVFS`); für Safari/iOS
mit mehreren Tabs wird `OPFSCoopSyncVFS` empfohlen. Beide brauchen **keine** COOP/COEP-Header (nur
der experimentelle In-Memory-Pool braucht Cross-Origin-Isolation). Auf iOS und in Safari nutzt das
SDK standardmäßig keine Shared Worker und fällt auf einen weniger zuverlässigen Broadcast-Mechanismus
zurück. OPFS hat
bekannte Probleme im privaten Safari-Modus. Worker-Dateien müssen statisch ausgeliefert werden.
Expo dokumentiert GitHub Pages (Unterpfad über das experimentelle `baseUrl`), Netlify, Vercel und
EAS Hosting.

**Empfehlung.** Für den POC ein **eigenes** Ziel (separates Repo mit Pages oder Netlify/Cloudflare
Pages), weil die Pages-Seite dieses Repos die Live-App ausliefert. Worker-Pfade mit Unterpfad
testen. `navigator.storage.persist()` anfragen und das Verhalten bei Speicher-Räumung durch den
Browser im POC prüfen.

## ADR-009 – Datenzugriff

**Status:** vorgeschlagen

Typisierte Repositories und Services pro Feature, SQL gegen die PowerSync-Datenbank, gemeinsame
Domänentypen; UI greift nie direkt auf die Datenbank zu (Spez. 20). Kein Drizzle vorab: die
PowerSync-Drizzle-Anbindung ist Beta, ein ORM kommt nur, wenn es Web und nativ nachweislich
vereinfacht. Postgres-Schema über SQL-Migrationen im neuen Projekt (`supabase/migrations`).

## ADR-010 – Betrieb und Kosten

**Status:** offen (Entscheidung D2)

**Befund.** PowerSync Cloud: ein Plan pro Organisation (Free, Pro, Team, Enterprise); **Free-
Instanzen ohne Deploy oder Client-Verbindung über 7 Tage werden abgebaut** und müssen neu deployt
werden (dann vollständiger Neu-Sync); Spending Caps gibt es noch nicht; EU-Region `eu-west-1`.
Open Edition (selbst gehostet, GA) braucht einen eigenen Container plus Bucket-Speicher. Supabase
Free pausiert inaktive Projekte; bezahlte Projekte werden nicht pausiert. Preise stehen nur auf den
Preisseiten (in dieser Sitzung nicht abrufbar).

**Empfehlung.** POC kostenlos (Supabase Free, PowerSync Cloud Free). Vor dem Dauerbetrieb Kosten
für PowerSync Pro bzw. Open Edition auf einem kleinen Server und Supabase Pro vergleichen.

## ADR-011 – iOS-Builds

**Status:** offen (Entscheidung D4)

op-sqlite ist nativ, deshalb Development Build statt Expo Go. Weg A: lokal mit Xcode auf deinem Mac
(`npx expo run:ios`). Weg B: EAS Build (laut Expo-Doku auch im Free Plan verfügbar). App Store und
TestFlight brauchen laut Expo-Doku das Apple Developer Program (99 USD/Jahr). Für den POC genügt
Weg A; ob und wie lange eine Installation mit kostenloser Apple-ID bzw. per interner Verteilung
funktioniert, ist im POC zu bestätigen.

## ADR-012 – Apple Health

**Status:** vorgeschlagen

Der bestehende Weg (Kurzbefehl → Edge Function `health-steps` → `submit_health_steps`) funktioniert
und wurde auf dem echten iPhone bestätigt. Er bleibt, bis die native HealthKit-Phase (Spez. 8.7/14.4)
umgesetzt ist. Beim Import und danach wird die Herkunft jedes Werts gespeichert (Kurzbefehl,
manuell, später HealthKit), damit nichts doppelt zählt.

## ADR-013 – Datensicherung vor jeder Migration

**Status:** akzeptiert (Spezifikation, Regel 3)

Vor jeder Änderung an einem Speicher: Backup v2 (Gerät + Cloud, Manifest, Prüfsummen, Prüfbericht,
Dry-Run) auf jedem genutzten Gerät. Kein Löschen von Altdaten als Teil einer Migration.
Einzelheiten: [DATA_MIGRATION.md](DATA_MIGRATION.md).

## ADR-014 – Design-Tokens und Designrichtung

**Status:** offen (Entscheidung D5)

Tokens für Farbe, Typografie, Abstände, Radien, Schatten, Bewegung und Breakpoints zentral (Spez.
4.2). Die Designstudie mit den Richtungen A, B und C liegt auf `concept/visual-prototype`
(`concept/design-directions/`); die Auswahl steht aus und wird vor Phase 2 gebraucht, nicht für den
POC.

## ADR-015 – Verschlüsselung der lokalen Datenbank

**Status:** später (vor Phase 3, Gesundheitsdaten)

PowerSync unterstützt Verschlüsselung im Ruhezustand: nativ über SQLCipher (op-sqlite) oder
SQLite3MultipleCiphers, im Web über SQLite3MultipleCiphers. Entscheidung zusammen mit dem
Schlüsselmanagement, bevor Gesundheits- und Ernährungsdaten lokal liegen.
