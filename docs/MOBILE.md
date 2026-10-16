# Mobil, Tablet und iPhone Duo

Stand 16.10.2026 (zweite Ausbaustufe). Ziel: auf iPhone, iPhone Duo (zu- und aufgeklappt) und
iPad bedienbar wie eine iOS-App – durchgehend scrollbar, Bedienelemente im Stil von iOS 26/27
(Liquid Glass) nach den Apple Human Interface Guidelines (HIG). Der Desktop bleibt bis auf die
neue Abschnittsreihenfolge und die Kalender-Funktionen (siehe [CALENDAR.md](CALENDAR.md)) gleich.

## Was sich für dich ändert

**Touch-Geräte schmaler als 1100 px** (iPhone, iPhone Duo in beiden Zuständen, iPad hochkant,
iPhone quer):

- **Eine durchgehende Seite** in der Reihenfolge Today → Week → Health → Habits → Lists. Beim
  Scrollen springt die Markierung in der Leiste unten von selbst zum Abschnitt, der gerade auf
  dem Bildschirm ist. Antippen springt zum Anfang des Abschnitts.

  | Abschnitt | Inhalt |
  |---|---|
  | Today | Focus-Timer, Today's Goals |
  | Week | Weekly Overview & Tasks, Kalender |
  | Health | Health Hub inkl. Step Challenge |
  | Habits | Habits, Weekly Review |
  | Lists | eigene Listen |

- **Leiste oben** (bleibt stehen, Inhalt läuft weich darunter aus): Logo und Name, rechts eine
  Glas-Kapsel mit **+** (neuer Kalendereintrag für heute) und **⋯** (Dark Mode, Focus Mode,
  Sync & Backup, Abmelden). Ein Punkt am ⋯ zeigt ausstehende Uploads (orange) oder einen
  Sync-Fehler (rot), im Menü steht der Grund unter „Sync & Backup“.
- **Leiste unten**: schwebende Glas-Kapsel mit gefüllten Symbolen, die Markierung gleitet zum
  aktuellen Abschnitt (iOS 26 Tab Bar).
- **⋯ bei Einträgen** öffnet ein Menü direkt am Knopf (wie in iOS), mit Untermenüs für Priorität,
  Tag und Liste. Ein Tipp daneben schließt es nur, ohne etwas auszulösen.
- **Kalender** wie in Apple Kalender: Monatsraster mit farbigen Punkten, darunter die Einträge des
  Tages mit Uhrzeit; Antippen öffnet den Eintrag. Details in [CALENDAR.md](CALENDAR.md).
- **Dialoge**: Neuer/Bearbeiteter Eintrag und Kalenderliste als Sheet von unten (✕ und ✓ oben,
  nach unten wischen schließt, bei Änderungen „Discard Changes“). Rückfragen („Delete Habit“) als
  iOS-Alert mit benanntem Knopf („Delete“ statt „Confirm“), Texteingaben als Alert mit Feld,
  beide über der Tastatur zentriert.
- **Textgröße**: folgt in Safari der Einstellung „Textgröße“ von iOS (Dynamic Type).
- **Dark Mode**: echtes iOS-Schwarz (#000) mit Karten in #1C1C1E, die Browserleiste folgt.
- Mit **Maus/Trackpad oder ab 1100 px** (Desktop, iPad quer) bleibt das Desktop-Layout.

### Bedienung per Touch

| Element | Tippen | ⋯-Menü |
|---|---|---|
| Tagesziel | abhaken | Edit…, Urgency ›, Delete |
| Wochenaufgabe | abhaken | Edit…, Priority ›, Move to Day ›, Delete |
| Kalendereintrag (Woche) | – | Edit… (öffnet den Editor), Priority ›, Move to Day ›, Delete |
| Kalendereintrag (Tagesliste) | öffnet den Editor | – (Löschen im Editor) |
| Listeneintrag | abhaken | Edit…, Move Up/Down, Move to List ›, Delete |
| Liste | – | Rename…, Move Up/Down, Delete List (mit Rückfrage) |
| Habit | – | Rename…, Delete Habit (mit Rückfrage) |

- Hover-Effekte gelten nur mit Maus/Trackpad. Bedienelemente mindestens 44 × 44 pt,
  Eingabefelder mindestens 16 px (kein automatisches Zoomen in iOS). Pinch-Zoom bleibt erlaubt.
- „+ New Habit“ hat jetzt Abstand zu den Wochentagen (vorher 4 px, jetzt 20 px – auch am Desktop).

## Gestaltung nach den Apple-Richtlinien

| Thema | Umsetzung | Quelle |
|---|---|---|
| Liquid Glass nur für die Navigationsebene | Leiste oben (Knöpfe), Leiste unten, Menüs, Sheet-Knöpfe, Mini-Timer; Inhalt auf festen Karten ohne Glas | [Adopting Liquid Glass](https://developer.apple.com/tutorials/data/documentation/technologyoverviews/adopting-liquid-glass.md), [Materials](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.md) |
| Tab Bar | schwebend, Glas, Beschriftung je ein Wort, gefüllte Symbole, immer sichtbar, nur Navigation (das „+“ sitzt deshalb oben) | [Tab bars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.md) |
| Menüs | Titel-Schreibweise („Move to Day“), „…“ wenn danach eine Eingabe folgt, Symbole vorne und einheitlich je Gruppe, Untermenü mit Pfeil, Haken bei Auswahl, Löschen rot, Gruppen mit Trennlinie | [Menus](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/menus.md), [Apple Developer Forums: Symbol vorne ab iOS 26](https://developer.apple.com/forums/thread/793069) |
| Auswahl im Editor | Kalender und Priorität als Pop-up-Button (natives `<select>`: iOS zeigt sein eigenes Menü) | [Pop-up buttons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/pop-up-buttons.md) |
| Datum/Uhrzeit | native Felder `type="date"`/`type="time"` – Safari zeigt die kompakten iOS-Picker | [Pickers](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/pickers.md) |
| Schalter „All-day“ | `<input type="checkbox" switch>`: Safari 17.4+ zeigt den nativen iOS-Schalter, andere Browser eine Checkbox | [WebKit: HTML Switch Control](https://webkit.org/blog/15054/an-html-switch-control/) |
| Sheets | ✕ links, ✓ rechts (gefüllt), Wischen nach unten, Rückfrage bei Änderungen | [Sheets](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sheets.md) |
| Segmented Control | Focus/Break/Long als Kapsel mit hervorgehobenem Segment | [Segmented controls](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/segmented-controls.md) |
| Schrift | Systemschrift (SF Pro), Größen nach iOS-Textstilen (Body 17, Headline 17, Title 2 22 …), Dynamic Type über `-apple-system-body` | [Typography](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.md), [WebKit: System Font](https://webkit.org/?p=3709), [Dynamic Type on the Web](https://furbo.org/?p=2791) |
| Farben | iOS-Systemfarben hell/dunkel/erhöhter Kontrast, Akzent = Indigo (Markenfarbe) | [Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md) |

**Bewusste Abweichungen (Barrierefreiheit):** Apples Standardwerte für Sekundärtext
(`secondaryLabel`, 3,4 : 1 auf Weiß) und Indigo-Text auf grauen Knöpfen (4,4 : 1) liegen unter
dem WCAG-AA-Kontrast von 4,5 : 1. Verwendet werden daher etwas kräftigere Werte: Sekundärtext
5,6 : 1, Indigo hell = Systemvariante „erhöhter Kontrast“ (6,1 : 1 auf Weiß), Indigo dunkel
heller (6,4 : 1 auf #1C1C1E), Löschen-Rot hell 5,4 : 1. Rahmen leerer Kreise ≥ 3 : 1.
„Kontrast erhöhen“ und „Bewegung reduzieren“ von iOS werden berücksichtigt.

**Nicht nachbildbar im Web:** die Lichtbrechung von Liquid Glass (WebKit unterstützt keine
SVG-Filter für `backdrop-filter`); verwendet wird Unschärfe + Sättigung + Lichtkante.
Die Emojis in den Überschriften (🎯, ⚡, 📅 …) sind Teil deines Designs und bleiben.

## iPhone Duo

Apple hat das iPhone Duo am 9.9.2026 vorgestellt: Innendisplay 7,6", Außendisplay 5,4"
([Apple Newsroom](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/),
[MacRumors](https://www.macrumors.com/roundup/iphone-duo/)). CSS-Viewport-Größen sind nicht
offiziell; Schätzungen Dritter: ca. **466 × 678** zugeklappt, **890 × 626** aufgeklappt quer
([webmobilefirst](https://webmobilefirst.com/en/devices/apple-iphone-duo-folded-2026/),
[whatismyscreensize](https://whatismyscreensize.com/blog/will-your-website-work-on-iphone-duo-foldable-css-viewport-guide)).
Safari meldet nicht, ob das Gerät auf- oder zugeklappt ist – das Layout hängt nur von der Breite ab.

| Zustand (geschätzt) | Layout |
|---|---|
| zugeklappt ~466 px, Split View ~445 px | eine Spalte wie auf dem iPhone |
| aufgeklappt quer ~890 px | Focus neben den Zielen, Woche in 3 Spalten, Kalender neben der Tagesliste, Habits als Tabelle, Leiste mit Symbol neben Text |
| aufgeklappt hochkant ~626 px | eine Spalte, Listen zweispaltig |

Beim Auf-/Zuklappen bleibt die Stelle, die oben auf dem Bildschirm war, dort; offene Menüs
bleiben im sichtbaren Bereich. Safe Areas (Dynamic Island, Home-Indikator, Ränder) werden
an allen vier Seiten berücksichtigt.

## Technik

| Datei | Inhalt |
|---|---|
| `js/mobile.js` | Touch-Layout (`html.touch-layout`), Abschnittsleiste mit Scroll-Spy, Leiste oben, Menüs (`MobileUI.showMenu`, `moreButton`, `priorityMenu`), Lesepositions-Erhalt, sichtbare Höhe über der Tastatur (`--vv-height`), Theme-Farbe |
| `css/mobile.css` | iOS-Design im Touch-Layout (Farb- und Schrift-Tokens, Glas, Karten, Controls, Menüs, Alerts, Sheets) |
| `index.html` | fünf `section.page-section` (`#section-today` … `#section-lists`) in neuer Reihenfolge, Abschnittsleiste als Links, Leiste oben |
| `js/calendar-ui.js`, `css/calendar.css` | Kalender-Editor und Kalenderliste (Sheet bzw. Dialog), siehe CALENDAR.md |

- Touch-Layout = `(pointer: coarse) and (max-width: 1099px)`; steht im Inline-Skript in
  `index.html` und in `js/mobile.js` (`TOUCH_LAYOUT_QUERY`) und muss gleich bleiben.
- Abschnitt der Leiste: der letzte, dessen Anfang ein Viertel unter der oberen Leiste vorbei
  ist; am Seitenende der gewählte bzw. der letzte. Während eines Sprungs bleibt die Markierung
  stehen (kein Flackern), danach folgt sie wieder dem Inhalt.
- Links `#section-week` usw. funktionieren auch ohne JavaScript; ein Link mit `?steps=` öffnet
  auf dem Handy direkt Health.
- Neue Inhalte gehören in eine der fünf `page-section`s.

## Geprüft

Chromium (Playwright) mit Touch-Emulation und Beispieldaten nur im lokalen Test-Mock:

- 393 × 852 hell/dunkel, 375 × 667, 852 × 393 (quer), 890 × 626 (Duo auf), 744 × 1133 (iPad):
  Screenshots aller Abschnitte, Menüs, Editor, Kalenderliste, Alerts; kein horizontales Scrollen.
- Textgrößen 17/19/21/23 px (Standard bis xxxLarge) und 28/33 px (Bedienungshilfen-Größen):
  kein horizontales Scrollen, Timer-Ziffern bleiben im Ring.
- Scroll-Spy über die ganze Seite: Today → Week → Health → Habits → Lists.
- Desktop 1440/1280/1180, hell/dunkel, je Abschnitt verglichen: unverändert bis auf
  Reihenfolge, Kalender-Punkte/Uhrzeiten und den Habit-Abstand.
- E2E-Szenarien und Gegenproben siehe [tests/README.md](../tests/README.md).

## Grenzen / nicht geprüft

- **Kein Test auf echten Geräten und nicht in Safari/WebKit** – nur Chromium-Emulation. Nur auf
  dem iPhone zu sehen und daher noch zu prüfen: nativer Schalter, iOS-Picker, Dynamic Type,
  Glas-Darstellung, Tastatur über Alerts, Safe Areas im Home-Bildschirm-Modus.
- Duo-Viewport-Größen sind Schätzungen Dritter; Scharnier/halb aufgeklappt wird nicht erkannt.
- iPad hochkant nutzt wie das iPhone die Leiste unten (iPadOS platziert Tab Bars oben); das
  Web erkennt iPad und iPhone Duo nicht zuverlässig auseinander.
- Die Leiste unten minimiert sich beim Scrollen nicht (iOS-Option „minimize on scroll“), damit
  die Abschnittsmarkierung immer sichtbar bleibt.
