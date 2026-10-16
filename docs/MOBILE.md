# Mobil, Tablet und iPhone Duo

Stand 16.10.2026. Ziel: auf iPhone, iPhone Duo (zu- und aufgeklappt) und iPad ohne Zoomen,
Querscrollen und Doppeltippen bedienbar – ohne den Desktop zu verändern.

## Was sich für dich ändert

**Touch-Geräte schmaler als 1100 px** (iPhone, iPhone Duo in beiden Zuständen, iPad hochkant,
iPhone quer) bekommen unten eine Tab-Leiste:

| Tab | Inhalt |
|---|---|
| Today | Focus-Timer, Today's Goals |
| Week | Weekly Overview & Tasks, Kalender |
| Health | Health Hub inkl. Step Challenge |
| Habits | Habits, Weekly Review |
| Lists | eigene Listen |

- Der zuletzt geöffnete Tab und die Scrollposition pro Tab bleiben erhalten (auch nach Neuladen).
  Nochmal auf den aktiven Tab tippen → zurück nach oben.
- Ein Link `?steps=…` (iOS-Kurzbefehl) öffnet direkt den Health-Tab.
- Menü (⋮) oben rechts mit Beschriftungen (Dark Mode, Focus Mode, Sync & Backup, Abmelden).
  Ein Punkt am ⋮ zeigt ausstehende Uploads (orange) oder einen Sync-Fehler (rot).
- „+“ (Quick Add, Eintrag für heute) unten rechts, nur in Today und Week.
- Mit **Maus/Trackpad oder ab 1100 px** (Desktop, iPad quer) bleibt alles wie bisher.

### Bedienung per Touch

Auf Touch-Geräten gab es kein Hover, keinen Doppelklick und keinen Rechtsklick – Bearbeiten,
Priorität und Verschieben waren dort nicht erreichbar. Die Löschknöpfe waren unsichtbar, aber
antippbar (versehentliches Löschen möglich). Jetzt hat jedes Element einen **„⋯“-Knopf**:

| Element | Aktionen |
|---|---|
| Tagesziel | Bearbeiten, Dringlichkeit, Löschen |
| Wochenaufgabe | Bearbeiten, Priorität, **auf anderen Tag verschieben**, Löschen |
| Kalendereintrag | Bearbeiten, Priorität, **auf anderes Datum verschieben** (Datumsauswahl), Löschen |
| Listeneintrag | Bearbeiten, nach oben/unten, **in andere Liste**, Löschen |
| Liste | Umbenennen, nach oben/unten, Löschen (mit Rückfrage) |
| Habit | Umbenennen, Löschen (mit Rückfrage) |

- Antippen des Textes hakt ein Ziel bzw. eine Wochenaufgabe ab (Listen wie bisher).
- Kalender: Monatsraster, Punkte markieren Tage mit Einträgen; Tag antippen → Einträge darunter,
  „+ Add entry“ fügt für diesen Tag hinzu. Aufgeklappt (ab 820 px) stehen Raster und Tagesliste
  nebeneinander.
- Hover-Effekte gelten nur noch mit Maus/Trackpad (vorher „klebten“ sie nach dem Antippen).
- Bedienelemente mindestens 44 × 44 pt (Apple-Empfehlung), Text mindestens 11 px,
  Eingabefelder 16 px (kein automatisches Zoomen in iOS). Pinch-Zoom ist wieder erlaubt.

## iPhone Duo

Apple hat das iPhone Duo am 9.9.2026 vorgestellt: Innendisplay 7,6", Außendisplay 5,4",
beide mit gleichem Seitenverhältnis, Vorbestellung ab 16.10., Verkauf ab 23.10.2026
([Apple Newsroom](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/),
[MacRumors](https://www.macrumors.com/roundup/iphone-duo/)).

- **CSS-Viewport-Größen** sind nicht offiziell veröffentlicht. Drittanbieter schätzen
  ca. **466 × 678** zugeklappt und **890 × 626** aufgeklappt (Querformat)
  ([webmobilefirst](https://webmobilefirst.com/en/devices/apple-iphone-duo-folded-2026/),
  [whatismyscreensize](https://whatismyscreensize.com/blog/will-your-website-work-on-iphone-duo-foldable-css-viewport-guide)).
  Das Layout hängt deshalb nur von Breitenbereichen ab, nicht von exakten Pixelwerten.
- **Safari meldet nicht, ob das Gerät auf- oder zugeklappt ist** (keine Viewport-Segments- bzw.
  Device-Posture-Unterstützung in WebKit). Es gibt daher keinen Duo-spezifischen Code.

| Zustand (geschätzt) | Layout |
|---|---|
| zugeklappt ~466 px, Split View ~445 px | eine Spalte wie auf dem iPhone |
| aufgeklappt quer ~890 px | Focus + Ziele nebeneinander, Woche in 3 Spalten, Kalender neben Tagesliste, Habits als Tabelle |
| aufgeklappt hochkant ~626 px | eine Spalte, Listen zweispaltig |

**Auf-/Zuklappen während der Nutzung:** Tab bleibt, die Stelle, die oben auf dem Bildschirm
war, bleibt dort (das Layout wechselt zwischen 1 und 3 Spalten, die reine Scrollposition würde
auf anderen Inhalt zeigen). Offene Menüs und Dialoge bleiben im sichtbaren Bereich.
Safe Areas (Notch/Dynamic Island, Home-Indikator, seitliche Ränder) werden oben, unten, links
und rechts getrennt berücksichtigt.

## Zum Home-Bildschirm

Safari → Teilen → „Zum Home-Bildschirm“: eigenes Icon (Logo „d.“), Start ohne Browserleisten.
Die Farbe der Browserleiste folgt dem Dark Mode.

## Technik

| Datei | Inhalt |
|---|---|
| `js/mobile.js` | Tabs, Aktionsmenüs (`MobileUI.showActionSheet`, `moreButton`), Lesepositions-Erhalt bei Breitenwechsel, Theme-Farbe |
| `css/mobile.css` | gesamtes Phone/Tablet-Layout; Desktop-Regeln unverändert |
| `index.html` | `data-tab-section` an den Bereichen, Tab-Leiste, Inline-Skript setzt `html.tabs-on` vor dem ersten Rendern, Manifest/Icons |
| `js/app.js` | „⋯“-Aktionen in den Render-Funktionen, Tagesliste des Kalenders, Datumsauswahl |
| `css/style.css` | alle 87 `:hover`-Regeln in `@media (hover: hover)` (mechanisch, Inhalt unverändert) |

- Tab-Modus = `(pointer: coarse) and (max-width: 1099px)`; die Abfrage steht im Inline-Skript in
  `index.html` und in `js/mobile.js` (`TAB_MODE_QUERY`) und muss gleich bleiben.
- Neuer Bereich: `data-tab-section="today|week|health|habits|lists"` setzen, sonst ist er auf
  Phones in keinem Tab sichtbar.
- Breiten: < 700 px eine Spalte, 700–1099 px mehrspaltig, ab 820 px Kalender zweigeteilt,
  Höhe < 500 px (Handy quer) kompakte Tab-Leiste.

## Geprüft

Chromium (Playwright) mit Touch-Emulation und Beispieldaten nur im lokalen Test-Mock:

- Viewports 375×667, 393×852, 430×932, 445×626, 466×678, 626×890, 744×1133, 852×393, 890×626
  in allen fünf Tabs: kein horizontales Scrollen, kein Text unter 11 px.
- iPhone 15 (393 px) vorher/nachher: Seite 9.540 px → je Tab 1.100–2.330 px; Bedienelemente
  unter 44 px: 145 von 152 → 35 von 242 (Rest: Habit-Kreise mit 40 px, weil 7 Spalten in die
  Breite passen müssen, Checkboxen in antippbaren Zeilen, Tagesbalken der Step Challenge mit 43 px).
  iPhone Duo zu- und aufgeklappt: 12 von 242 (nur die Checkboxen).
- Aufgeklapptes Duo vorher: Habits-Bereich 22.534 px hoch (Kreise in voller Breite) – behoben.
- Desktop 1440/1280/1180 px, hell und dunkel: alle 854 Elemente in Position, Größe, Farbe,
  Schrift identisch zum Stand vorher (Layout-Vergleich per Skript).
- E2E-Tests: `tabs:`, `touch:`, `foldable:`, `calendar on phones`, `desktop with mouse`
  (siehe `tests/README.md`); Gegenprobe: ohne Positions-Erhalt bzw. ohne Monats-Fix schlagen
  sie fehl.

## Grenzen / nicht geprüft

- **Kein Test auf echten Geräten** (iPhone, iPad, iPhone Duo) und nicht in Safari/WebKit –
  nur Chromium-Emulation. Safari-Details (Tastatur, Safe Areas, Home-Bildschirm-Modus) sind
  nach dem Deploy auf dem Gerät zu prüfen.
- Duo-Viewport-Größen sind Schätzungen Dritter; Scharnier/halb aufgeklappt wird nicht erkannt.
- Die iOS-Tastatur öffnet sich beim Bearbeiten nur, weil das Feld direkt beim Antippen
  fokussiert wird – auf dem Gerät noch zu bestätigen.
- Drag & Drop bleibt auf Touch technisch möglich, ist aber nicht mehr der vorgesehene Weg.
