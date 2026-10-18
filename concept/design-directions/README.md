# Designrichtungen A, B, C (Designstudie)

Drei visuelle Richtungen für Dali’s Dashboard auf **derselben Grundlage**: Layout, Komponenten,
Bedienung und Beispieldaten des Premium-Prototyps (`../prototype-premium/`). Geändert wird nur das
Aussehen über je eine Theme-Datei. Kein Teil der produktiven App, keine Verbindung zu Supabase, keine
Anmeldung, nur Beispieldaten. Beide bestehenden Prototypen (`../prototype/`, `../prototype-premium/`)
sind unverändert.

Öffnen: im Ordner `concept/` einen lokalen Server starten (`python3 -m http.server 8080`) und
`http://localhost:8080/design-directions/` aufrufen. Die Galerie zeigt die Richtungen nebeneinander
(live, bedienbar) oder eine Richtung in allen Ansichten; darunter die gerenderten Bilder und der
Vergleich auf einen Blick. `a.html`, `b.html`, `c.html` öffnen je eine Richtung als ganze App.
Ein Doppelklick auf die Dateien funktioniert nicht zuverlässig, weil Chrome lokale Schriften und
iframes aus `file://` blockiert.

## 1. Der erste Prototyp – was tatsächlich im Code steht

Quelle: `concept/prototype/styles.css` (Tokens auf `:root`, dunkle Werte im Block
`:root[data-theme="dark"]`) und `concept/prototype/index.html`.

| Merkmal | Erster Prototyp (dunkel) |
|---|---|
| Schrift | `-apple-system, BlinkMacSystemFont, "SF Pro Text" / "SF Pro Display", system-ui, "Helvetica Neue", "Segoe UI", Arial` – also die Systemschrift: SF Pro auf iPhone, iPad und Mac. In der Linux-Sandbox löst Chromium diesen Stapel auf **Inter** auf (per CDP `CSS.getPlatformFontsForNode` geprüft); die Screenshots im Konzeptbericht zeigten daher Inter. |
| Schriftschnitte | Begrüßung 700 · 30 px / 1,1 · −0,025 em; Ansichtstitel 700 · 28 px · −0,02 em; „Nächster Schritt“ 600 · 21 px; Fließtext 17 px / 1,35 |
| Grund | `#000000` (reines Schwarz, iOS-Dunkelmodus) |
| Flächen | `#1c1c1e` (Karten), `#2c2c2e`, `#3a3a3c`; Karten 20 px Radius, Zeilen 12 px, Chips als Kapseln |
| Text | `#ffffff`, `rgba(235,235,245,0.64)`, `rgba(235,235,245,0.38)` |
| Akzent | Indigo `#6155f5` (hell `#564ade`), Akzenttext `#9aa3ff`, weiche Akzentfläche `rgba(140,150,255,0.16)` |
| Bedeutungsfarben | Rot `#ff4245`, Orange `#ff9230`, Grün `#30d158` |
| Projekte / Kalender | `#4c8cf5`, `#d27a35`, `#12a596`, `#a867d8` / `#a1a7b3`, `#5fc27f` |
| Effekte | Kopfleiste und Tab-Leiste mit `backdrop-filter: blur(18px) saturate(160%)`, Karten-Schatten, „Nächster Schritt“ als Karte mit 1,5 px Indigo-Rahmen, Kapazitätsbalken 8 px in Indigo |

Was davon in die neue Gestaltung übernommen werden kann: die dunkle Grundstimmung mit reinem Schwarz
und `#1c1c1e`-Flächen, Indigo als Akzent mit hellem Akzenttext, die kräftigen, eng laufenden Titel
der Systemschrift, die Karte mit Akzentrahmen für den nächsten Schritt, farbige Projektpunkte, der
Tab-Leisten-Stil mit Unschärfe. Nicht übernommen werden die Schwächen des ersten Entwurfs (Karten
überall, Chip-Ketten unter jeder Aufgabe, sechs Knöpfe je Eingangseintrag, Warnbanner).

## 2. Die drei Richtungen

Alle drei sind dunkel angelegt (eine helle Fassung ist nicht Teil der Studie), nutzen dieselben
Zeilen, Sheets, Leisten und Beispieldaten und unterscheiden sich in Farbe, Schrift, Flächen,
Radien, Dichte und Akzentlogik. Nur `themes/a.css`, `themes/b.css`, `themes/c.css` sind verschieden.

| | A · Original DNA Refined | B · Obsidian Power OS | C · Midnight Momentum |
|---|---|---|---|
| Schrift | Systemschrift wie im ersten Prototyp (SF Pro auf Apple-Geräten; **Inter** als Ersatz und in den Renderings) | **Instrument Sans** (OFL, lokal) | **Manrope** (OFL, lokal) |
| Titel | 700, −0,025 em (Begrüßung 30 px) | 600, −0,02 em (30 px) | 700, −0,03 em (32 px) |
| Fließtext | 400 · 17 px | 400 · 16 px, Zeilen 44 px | 500 · 17 px |
| Grund | `#000000` | `#141518` Graphit | `#0b0d14` Blauschwarz |
| Flächen | `#1c1c1e`, `#2c2c2e` (Karten 20 px) | `#1c1f24`, `#272b32` (Hairlines, 6–10 px) | `#141827`, `#1f2438` (12–16 px) |
| Text | `#fff`, `rgba(235,235,245,.72)`, `rgba(235,235,245,.6)` | `#e9ebee`, `#a8adb6`, `#9096a0` | `#f2f3f8`, `#b4b9cc`, `#8b92ab` |
| Akzent | Indigo `#6155f5`, Text `#9aa3ff` | Mint `#4fd1a5`, Text `#7de3bf`, Schrift auf Mint `#0b1512` | Bernstein `#ffb347`, Text `#ffc46b`, Schrift auf Bernstein `#1a1206`; zweiter Akzent Blau `#6fa8e6` nur für Termine/Zeitachse |
| Rot | `#ff4245` | `#ff6b66` | `#ff5d6c` |
| Jetzt-Block | Karte `#1c1c1e` mit 1,5 px Indigo-Rahmen, Fokus-Knopf Indigo | Fläche eine Stufe heller, 3 px Mint-Leiste links, Umriss | getönte Bernstein-Fläche mit Rahmen und weichem Schatten |
| Häkchen | 26 px Kreis, Indigo | 20 px abgerundetes Quadrat, Mint | 22 px Kreis, Bernstein |
| Knöpfe / Chips | 12 px / Kapseln | 8 px Umriss / 6 px | 12 px / 10 px, aktiv Bernstein |
| Tab-Leiste | Unschärfe, aktiver Tab Indigo | flach, 2 px Mint-Marke oben | Unschärfe, Bernstein-Pille hinter dem Symbol |
| Charakter | vertraut, iOS-nah, mittlere Dichte | instrumentenhaft, höchste Dichte | lebendig, wärmste Farbigkeit |

Kontraste (WCAG, rechnerisch aus den Tokens): Fließtext ≥ 11,9:1,
Zweittext ≥ 6,3:1, Metadaten ≥ 4,77:1 (knappster Wert: B auf der dritten Flächenstufe, wo Metadaten
praktisch nicht vorkommen), Akzenttext ≥ 6,0:1, Rot ≥ 4,96:1 auf Karten (A) bzw. ≥ 5,1:1 (B, C),
Schrift auf Akzentknöpfen 5,09:1 (A), 9,73:1 (B), 10,41:1 (C).

## 3. Was gerendert und geprüft wurde

`node screenshots.js <ordner>` erzeugt je Richtung zehn Vergleichsansichten (30 insgesamt) und acht
Prüfansichten (24 insgesamt). Chromium (Playwright) mit Touch-Emulation, 2-fache Auflösung, dunkel.

| Ansicht | Viewport |
|---|---|
| Home, Aufgaben, Eingang, Woche | iPhone Duo geschlossen **466 × 678** (Annahme) |
| Home, Aufgaben, Eingang, Woche | iPhone Duo geöffnet hoch **626 × 890** (Annahme) |
| Home, Woche | Desktop 1440 × 900 |
| Prüfansichten | viele lange Aufgaben (zu und auf), Aufgabe-Sheet, Notieren mit Tastatur-Simulation, Einordnen-Dialog (auf), Tagesabschluss, Einplanen am Desktop, leerer Zustand |

Ergebnis des letzten Laufs: 54 Bilder, kein horizontaler Überlauf (Seite und Hauptbereich), 0
Seitenfehler; gerenderte Schrift laut CDP: A „Inter“ (Systemstapel, Sandbox), B „Instrument Sans“
(Webfont), C „Manrope“ (Webfont; CDP meldet den internen Namen der variablen Schrift
„Manrope ExtraLight“, die Schnitte 500/700 sind in den Bildern sichtbar korrekt).

Alle 54 Bilder wurden angesehen. Behoben: in C brach die Datumszeile am geschlossenen Duo um
(Sperrung verringert); in A lag der Wochenüberblick auf Home nicht in einer Karte (ergänzt); in B
lag der Metadaten-Kontrast auf der dritten Flächenstufe unter 4,5:1 (Farbe angehoben).

Die 30 Vergleichsansichten liegen in `renders/` (2-fach, auf 256 Farben reduziert), die
Prüfansichten als drei Übersichtsbilder (`renders/_qa-*.png`).

## 4. Grenzen

- Die iPhone-Duo-Maße sind Annahmen Dritter (siehe `docs/MOBILE.md`); physische Displaygrößen
  (7,6" innen, 5,4" außen) sind nicht die CSS-Viewports. Nichts wurde auf echter Hardware geprüft.
- Nur Chromium, kein Safari. Auf Apple-Geräten erscheint Richtung A in SF Pro statt Inter; B und C
  bringen ihre Schrift mit. Die deutsche Silbentrennung in den sieben Wochenspalten ist in diesem
  Chromium nicht prüfbar (kein Wörterbuch), lange Wörter brechen dort mitten im Wort.
- Nur dunkel. Eine helle Fassung je Richtung wäre ein nächster Schritt, keine der drei ist darauf
  ausgelegt.
- Die Studie ändert keine Logik: Die Vorschläge des Premium-Prototyps (Eingang, nächster Schritt,
  Projekte, Kapazität, Tagesabschluss) sind weiter als „Vorschlag“ markiert und nicht beschlossen.

## Dateien

- `index.html` – Galerie (Richtungswahl, Ansichtswahl, gerenderte Bilder, Vergleich auf einen Blick)
- `a.html`, `b.html`, `c.html` – je eine Richtung als ganze App (laden `../prototype-premium/`)
- `themes/a.css`, `themes/b.css`, `themes/c.css` – die Richtungen (nur Gestaltung)
- `fonts.css`, `fonts/` – Inter, Instrument Sans, Manrope (Latin, OFL, mit Lizenztexten)
- `screenshots.js` – Renderings und Prüfbericht (`_report.json`)
- `renders/` – die gerenderten Ansichten des letzten Laufs
