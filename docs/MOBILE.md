# Ein Look für iPhone, iPad und Desktop

Stand 17.10.2026 (dritte Ausbaustufe: Glas-Linse in der Leiste unten; das iPad auch quer; seit
dem Abend desselben Tages derselbe Look auch am Desktop, wo sich die Leiste unten beim
Runterscrollen zu einem Kreis rechts unten minimiert). Ziel: auf iPhone, iPhone Duo (zu- und
aufgeklappt), iPad und am Desktop bedienbar wie eine iOS-App – durchgehend scrollbar,
Bedienelemente im Stil von iOS 26/27 (Liquid Glass) nach den Apple Human Interface Guidelines
(HIG). Was nur der Finger braucht (Wischen, Antippen zum Abhaken), hängt an der Eingabe, nicht
am Look; die Maus behält Doppelklick, Rechtsklick und Drag & Drop (Abschnitt „Desktop“).

## Was sich für dich ändert

**Alle Geräte** (iPhone, iPhone Duo in beiden Zuständen, iPad hochkant und quer, iPhone quer,
Desktop):

- **Eine durchgehende Seite** in der Reihenfolge Week → Today → Health → Habits → Lists: ganz
  oben der **Kalender**, dann **Weekly Overview & Tasks**, **Today's Goals** und zuletzt der
  **Focus-Timer** (ab 700 px Breite stehen Ziele und Focus nebeneinander, die Ziele links). Beim
  Scrollen springt die Markierung in der Leiste unten von selbst zum Abschnitt, der gerade auf
  dem Bildschirm ist; die Leiste hat dieselbe Reihenfolge. Antippen springt zum Anfang des
  Abschnitts.

  | Abschnitt | Inhalt |
  |---|---|
  | Week | Kalender, Weekly Overview & Tasks |
  | Today | Today's Goals, Focus-Timer |
  | Health | Health Hub, Step Challenge ganz oben |
  | Habits | Habits, Weekly Review |
  | Lists | Matrix (to do, up next, waiting, ideas – siehe [MATRIX.md](MATRIX.md)), eigene Listen |

  Diese Reihenfolge steht so im HTML (`index.html`); kein Skript verschiebt mehr Blöcke (bis
  17.10.2026 hatte der Desktop eine eigene Reihenfolge, das Handy wurde per
  `window.placePageOrder` umgestellt). VoiceOver und Tastatur folgen dem Bildschirm, nichts
  springt beim Laden, Drehen oder Wechsel der Eingabe.

- **Woche (Handy, unter 700 px):** Oben im Kopf der Woche eine **Tagesleiste** wie in Apple
  Kalender – Wochentag, Datum, heute in der Akzentfarbe, der gezeigte Tag gefüllt, darunter bis
  zu drei Punkte (Farben der Kalender des Tages, grau für offene Aufgaben). Darunter die Tage als
  **Karten nebeneinander**: ein Wisch = ein Tag (Scroll-Snap, also das Scrollen von iOS selbst),
  geblättert wie in Apple Kalender – die Karte ist genau so breit wie das Panel darüber und
  steht mittig, die Nachbartage warten knapp außerhalb des Bildschirms und gleiten beim Wischen
  herein; ein Tipp auf einen Tag in der Leiste springt dorthin.
  Die Zeile ist so hoch wie der gezeigte Tag – ein voller Tag macht die Seite nicht für alle
  anderen länger. Beim Wochenwechsel bleibt der Wochentag, „Today“ springt zu heute. Ab 700 px
  (aufgeklappt, iPad, Desktop) alle Tage als Spalten. Für VoiceOver nennt jeder
  Tag der Leiste Datum, „today“ und die Zahl der Termine und offenen Aufgaben.
- **Health Hub:** Die Step Challenge steht auf jedem Gerät ganz oben, vor Streak, Wasser und
  Supplements – so steht sie im HTML (bis 17.10.2026 verschob `placeStepCard` sie auf Handy und
  Tablet nach oben).
- **Zahlen in der Step Challenge** (Remaining, Needed per day, Today) brechen nicht mehr mitten
  in der Zahl um (vorher „1.794.99“ / „4“ auf iPhone-Breite): Sie bleiben einzeilig, und die
  Schriftgröße folgt der Kachelbreite (18 % per Container-Query, höchstens so groß wie am
  Desktop) – wie UIKit-Labels mit „adjustsFontSizeToFitWidth“.
- **Leiste oben** (bleibt stehen, Inhalt läuft weich darunter aus): Logo und Name, rechts eine
  Glas-Kapsel mit **+** (neuer Kalendereintrag für heute) und **⋯** (Dark Mode, Focus Mode,
  Sync & Backup, Abmelden; seit Home auch „Your Name…“ für die Begrüßung). Ein Punkt am ⋯ zeigt ausstehende Uploads (orange) oder einen
  Sync-Fehler (rot), im Menü steht der Grund unter „Sync & Backup“.
- **Leiste unten**: schwebende Glas-Kapsel mit gefüllten Symbolen, die Markierung gleitet zum
  aktuellen Abschnitt (iOS 26 Tab Bar). Die Markierung ist im Dark Mode dunkler als die Leiste.
- **Glas-Linse** wie in deiner Bildschirmaufnahme der iOS-26-Tab-Bar: Finger auf die Leiste →
  die Markierung hebt sich als klare Linse ab (etwas größer als die Leiste, Symbole darunter
  vergrößert, am Rand leicht verzerrt mit Farbsäumen und Lichtkante), die Leiste wird kurz etwas
  größer und hellt unter dem Finger auf. **Ziehen** über die Leiste: die Linse folgt dem Finger;
  **Loslassen** wählt den Abschnitt unter der Linse, sie fällt dort in die Markierung zurück.
  **Antippen**: die Linse wandert zum getippten Abschnitt (≈ 0,3 s wie im Video). Ziehen und
  Loslassen auf dem schon gewählten Abschnitt springt nicht.
- **⋯ bei Einträgen** öffnet ein Menü direkt am Knopf (wie in iOS), mit Untermenüs für Priorität,
  Tag und Liste. Ein Tipp daneben schließt es nur, ohne etwas auszulösen.
- **Kalender** wie in Apple Kalender: Monatsraster mit farbigen Punkten, darunter die Einträge des
  Tages mit Uhrzeit; Antippen öffnet den Eintrag. Details in [CALENDAR.md](CALENDAR.md).
- **Dialoge**: Neuer/Bearbeiteter Eintrag und Kalenderliste als Sheet von unten (✕ und ✓ oben,
  nach unten wischen schließt, bei Änderungen „Discard Changes“). Rückfragen („Delete Habit“) als
  iOS-Alert mit benanntem Knopf („Delete“ statt „Confirm“), Texteingaben als Alert mit Feld,
  beide über der Tastatur zentriert.
- **Sheets mit Tastatur** (neuer Termin, neue Aufgabe in der Matrix): Das Sheet steht sofort an
  seinem Platz und blendet ein (0,2 s), statt hochzugleiten; die Tastatur kommt dazu. Solange ein
  Sheet offen ist, bleibt die Seite dahinter stehen, und nach dem Schließen steht sie an
  derselben Stelle wie vorher (siehe unten „Sheets und Tastatur“).
- **Textgröße**: folgt in Safari der Einstellung „Textgröße“ von iOS (Dynamic Type).
- **Dark Mode**: echtes iOS-Schwarz (#000) mit Karten in #1C1C1E, die Browserleiste folgt. Seit
  17.10.2026 gilt das gespeicherte Theme ab dem ersten Bild: Ein Inline-Skript am Anfang von
  `<body>` setzt `dark` (und die Farbe der Browserleiste), bevor etwas gezeichnet wird. Vorher
  kam die Klasse erst aus `initTheme` in `js/app.js` – nach der Anmeldung und dem ersten
  Sync –, sodass die Seite auf einem dunklen Gerät bei jedem Start etwa eine Sekunde hell war
  (Aufnahme vom 17.10., 07:36).
- **iPad quer (17.10.2026):** Bis dahin endete der iOS-Look bei 1099 px Breite. Das iPad ist
  quer 1133–1376 px breit und bekam deshalb das alte Desktop-Layout, hochkant aber das neue.
  Zuerst entschied dann nur die Haupteingabe (Safari auf dem iPad meldet immer Touch,
  `pointer: coarse`, auch mit Magic Keyboard, Trackpad oder Maus – WebKit,
  `WebPageIOS.mm`, `pointerCharacteristicsOfPrimaryPointingDevice`); seit dem Desktop-Umbau gilt
  der Look überall. Die Breite wählt nur die Anordnung (unter 700 px eine Spalte, darüber
  mehrspaltig, ab 1100 px das breite Home-Raster). Das folgt den HIG (Layout): „Determine
  layout based on size classes, not device type or orientation“ und „People expect your
  experience to remain familiar when they rotate their device“.

### Desktop (seit 17.10.2026)

Derselbe Look wie auf iPhone und iPad, mit Maus und Tastatur:

- **Leisten:** Leiste unten mit den sechs Abschnitten (Klick springt, die Markierung folgt dem
  Scrollen), Leiste oben mit **+** und **⋯**. Das **⋯-Menü** ersetzt das schwebende Desktop-Menü
  (Dark Mode, Your Name…, Focus Mode, Keyboard Shortcuts, Sync & Backup, Abmelden – „Keyboard
  Shortcuts“ nur mit Maus oder Trackpad, also auch am iPad mit Magic Keyboard), **+** den
  schwebenden Schnell-Knopf; die Tasten **Q** (neuer Eintrag) und **?** (Kurzbefehle) gehen
  weiterhin.
- **Leiste unten minimiert sich beim Runterscrollen** (seit 17.10.2026, wie eine Tab Bar in
  iOS 26 mit „minimize on scroll“, nach deiner Bildschirmaufnahme): Sie schrumpft in gut einer
  Viertelsekunde zu einem runden Glas-Knopf (48 px) ganz rechts unten im Fenster (auf deinen
  Wunsch; iOS legt ihn an den vorderen, linken Rand), der das Symbol
  des Abschnitts auf dem Bildschirm zeigt; die übrigen Einträge verschwimmen und blenden aus. Der
  Inhalt, den die Leiste vorher verdeckte, ist frei. Die volle Leiste kommt zurück beim
  Hochscrollen, ganz oben auf der Seite, per Klick auf den Knopf (wählt nichts, die Seite bleibt
  stehen) und wenn die Tastatur (Tab) in die Leiste kommt – solange sie dort ist, bleibt die
  Leiste offen. Es zählt nur das eigene Scrollen (Mausrad, Trackpad, Tasten, gedrückte Maustaste
  an der Scrollleiste), nicht Sprünge über die Leiste oder die Home-Links und nicht die Seite,
  die sich durch Sync oder Wetter von selbst verschiebt. Mit „Bewegung reduzieren“ ohne
  Animation. iPhone und iPad behalten die volle Leiste (siehe Grenzen).
- **Breite:** Ab 1376 px (13″-iPad quer) bleibt die Seite so breit und steht mittig – Zeilen und
  Karten ziehen sich auf großen Monitoren nicht in die Länge.
- **⋯ an jedem Eintrag** statt der Löschen-Kreuze, die erst beim Überfahren erschienen: Bearbeiten,
  Priorität, Verschieben, Löschen. Die Maus behält zusätzlich **Doppelklick** (bearbeiten),
  **Rechtsklick** (Priorität/Dringlichkeit weiterschalten) und **Drag & Drop** (Ziele, Aufgaben
  der Woche, Listeneinträge, Listen). Eine Aufgabe lässt sich jetzt auf den ganzen Tag ziehen,
  auch auf einen leeren (vorher nur auf die Kartenliste des Tages, die im iOS-Look bei einem
  leeren Tag 0 px hoch ist). Ein Klick auf den Text hakt nicht ab – das ist die Abkürzung des
  Fingers.
- **Kalender:** wie auf dem iPad – das Monatsraster wählt einen Tag, seine Einträge stehen in der
  Liste daneben; ein Klick öffnet den Editor. Verschieben über das Datum im Editor oder per Drag &
  Drop in der Woche (Einträge im Monatsraster zu ziehen gibt es im iOS-Look nicht mehr).
- **Sheets** statt Dialogen, ab 700 px über dem unteren Rand schwebend wie auf dem iPad. Mit
  Hardware-Tastatur hat das erste Feld den Fokus und **Return speichert**; nur mit Bildschirm-
  tastatur (Touch als Haupteingabe) blendet Return die Tastatur aus. Die Seite dahinter wird nur
  bei Touch festgehalten (wegen der Bildschirmtastatur) – mit der Maus bliebe sonst die
  Scrollleiste weg und der Inhalt spränge zur Seite.
- **Hover** im selben Look: Knöpfe werden leicht blasser (gedrückt 0,55, darüber 0,8), ⋯, Leiste,
  Kalendertage, Agenda- und Menüzeilen bekommen die halbe Füllung des Gedrückt-Zustands. Nichts
  wächst, kippt oder färbt sich mehr um (die Hover-Effekte des alten Desktop-Looks sind aus
  `css/style.css` entfernt: Karten-Zoom, Logo-Drehung, Spalten-Zoom, farbige Ränder,
  Feiertage rot, Zahnrad-Drehung).
- **Wischen zum Löschen** bleibt dem Finger (und Stift) vorbehalten; ein Mausziehen über eine
  Zeile verschiebt und löscht nichts.

### Bedienung per Touch

| Element | Tippen | Nach links wischen | ⋯-Menü |
|---|---|---|---|
| Tagesziel | abhaken | Delete | Edit…, Urgency ›, Delete |
| Wochenaufgabe | abhaken | Delete (nicht in der Tagesleiste des Handys, s. u.) | Edit…, Priority ›, Move to Day ›, Delete |
| Kalendereintrag (Woche) | – | Delete (ebenso) | Edit… (öffnet den Editor), Priority ›, Move to Day ›, Delete |
| Kalendereintrag (Tagesliste) | öffnet den Editor | Delete | – (Löschen im Editor) |
| Listeneintrag | abhaken | Delete | Edit…, Move Up/Down, Move to List ›, Delete |
| Matrix-Aufgabe (Karte und Bereich) | öffnet die Aufgabe | Delete | – (Löschen im Sheet der Aufgabe) |
| Home: Termin, Aufgabe, Ziel | Termin: Editor; Kreis: abhaken | Delete (dort, wo der Eintrag gespeichert ist) | – |
| Gym-Ziel (Health) | abhaken | Delete | – |
| Liste | – | – | Rename…, Move Up/Down, Delete List (mit Rückfrage) |
| Habit | – | – | Rename…, Delete Habit (mit Rückfrage) |

**Wischen zum Löschen** (`js/swipe.js`, `css/swipe.css`, wie in iOS 26):

- Kurz nach links wischen: Die Zeile gleitet als Ganzes nach links – über die ganze Breite
  ihrer Karte, wie eine Zelle über ihren Abschnitt – und gibt ein rotes „Delete“ frei: eine
  Kapsel 6 px innerhalb des Kartenrands und der Zeile, die unter der Zeile hervorkommt.
  Antippen löscht.
- Weiterziehen dehnt „Delete“ mit. Über 60 % der Kartenbreite rückt „Delete“ neben die Zeile
  (voller Wisch), Loslassen löscht sofort; zurück unter 52 % gibt es wieder frei (kein Flackern
  an der Schwelle). Von einem offenen „Delete“ aus weiterwischen geht genauso.
- Beim Loslassen entscheidet, wohin der Schwung des Fingers die Zeile trägt (120 ms weiter): ein
  kurzer schneller Wisch öffnet, ein schneller Wisch zurück schließt, auch wenn die Zeile noch
  mehr als halb offen ist. Ein Finger, der vor dem Loslassen stillhält (60 ms), hat keinen
  Schwung.
- Öffnen, Schließen und Hinausgleiten folgen einer Feder (wie SwiftUI
  `spring(response: 0.38, dampingFraction: 0.86)`), die mit der Geschwindigkeit des Fingers
  startet; eine Zeile lässt sich mitten in der Bewegung wieder greifen.
- Gelöscht wird ohne Rückfrage und ohne Undo-Leiste, wie in Erinnerungen und Mail: Die Zeile
  gleitet hinaus, die Zeilen darunter rücken schon dabei nach (zusammen etwa 0,5 s). Apple sieht
  Rückgängig auf dem iPhone über Schütteln und das Wischen mit drei Fingern vor, eigene
  Undo-Knöpfe nur „wenn nötig“ und dann in der Symbolleiste (HIG „Undo and redo“). Das kann eine
  Web-App nicht anbieten – die Undo-Leiste der ersten Fassung ist deshalb wieder weg.
- Farbe: systemRed von iOS 26 laut HIG (hell 255/56/60, dunkel 255/66/69; mit „Kontrast
  erhöhen“ 233/21/45 bzw. 255/97/101), Beschriftung weiß.
- Antippen woanders, Scrollen (auch mit dem Finger auf der offenen Zeile oder mit dem Trackpad)
  oder Zurückwischen schließt. Bewegt sich die Seite von selbst – ein Abschnitt darüber wird
  neu gezeichnet, der Browser hält die Stelle –, bleibt die Zeile offen (vorher schloss sie sich
  dabei: im Test direkt nach dem Löschen eines Ziels, weil Home oben neu zeichnete). Es ist
  immer nur eine Zeile offen; ein Tippen auf eine andere Zeile schließt nur und hakt nichts ab.
- Während des Wischens fällt der Gedrückt-Zustand der Zeile weg (wie die Markierung einer Zelle
  in iOS); ganz abgeblendete Zeilen (vergangene Termine in der Woche, erledigte Gym-Ziele)
  blenden dann nur ihren Inhalt ab, „Delete“ bleibt kräftig rot.
- Auf- und Abwärtsziehen scrollt wie bisher (die Richtung entscheidet sich nach 10 px).
- **Nicht in der Tagesleiste der Woche auf dem Handy**: Dort blättert ein Wisch zum nächsten
  Tag – beides auf derselben Geste wäre nicht eindeutig. Löschen dort über ⋯ → Delete, oder per
  Wisch in Home bzw. in der Tagesliste des Kalenders. Aufgeklappt und auf dem Tablet (Woche in
  Spalten) lassen sich die Aufgaben wischen.
- Nicht bei Habits, Listen und Kalendern: Ihr Löschen nimmt den Verlauf bzw. alle Einträge mit
  und fragt deshalb nach.
- Nur mit dem Finger (oder Stift). Mit Maus/Trackpad, VoiceOver und Tastatur bleibt „Delete“
  im ⋯-Menü; das rote „Delete“ ist für VoiceOver ausgeblendet.
- Kein spürbares Tippen (Haptik) beim vollen Wisch wie in iOS: Safari bietet Web-Seiten keine
  Vibration an.
- Ein Sync baut die Listen neu auf. Liegt dabei ein Finger auf einer Zeile oder steht „Delete“
  offen, wartet der Neuaufbau, bis die Zeile losgelassen und geschlossen ist – sonst würde die
  Zeile unter dem Finger ersetzt (im Test baute der Sync die Zielliste zweimal neu auf, direkt
  nachdem der Finger aufsetzte; die Geste lief dann auf einer Zeile, die nicht mehr da war).

- Hover-Effekte gelten nur mit Maus/Trackpad. Bedienelemente mindestens 44 × 44 pt,
  Eingabefelder mindestens 16 px (kein automatisches Zoomen in iOS). Pinch-Zoom bleibt erlaubt.
- „+ New Habit“ hat jetzt Abstand zu den Wochentagen (vorher 4 px, jetzt 20 px – auch am Desktop).
- Tastatur/VoiceOver: In „Today's Goals“ bleibt der Fokus auf demselben Knopf, wenn die Liste
  neu aufgebaut wird (Umsortieren 0,4 s nach dem Abhaken, Aktualisieren nach einem Sync) –
  vorher fiel er auf den Seitenanfang zurück (auch am Desktop). Gefunden, weil der Menü-Test
  dadurch zufällig rot wurde (auch schon vor der Glas-Linse, 2 von 5 Läufen).

## Gestaltung nach den Apple-Richtlinien

| Thema | Umsetzung | Quelle |
|---|---|---|
| Liquid Glass nur für die Navigationsebene | Leiste oben (Knöpfe), Leiste unten, Menüs, Sheet-Knöpfe, Mini-Timer; Inhalt auf festen Karten ohne Glas | [Adopting Liquid Glass](https://developer.apple.com/tutorials/data/documentation/technologyoverviews/adopting-liquid-glass.md), [Materials](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.md) |
| Tab Bar | schwebend, Glas, Beschriftung je ein Wort, gefüllte Symbole, immer sichtbar (am Desktop beim Runterscrollen minimiert, siehe nächste Zeile), nur Navigation (das „+“ sitzt deshalb oben) | [Tab bars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.md) |
| Tab Bar minimieren (Desktop) | beim Runterscrollen zum Kreis mit dem gewählten Symbol am rechten Rand (bewusste Abweichung: iOS legt ihn an den vorderen, linken Rand), zurück beim Hochscrollen, oben auf der Seite und per Klick – wie `tabBarMinimizeBehavior(.onScrollDown)`: „minimizes the tab bar as soon as someone scrolls down … and restores it when they scroll back up“; HIG: „A person can exit the minimized state by tapping a tab or scrolling to the top of the view.“ Größe (48 pt, mittig auf der Linie der Leiste) und Dauer aus deiner Aufnahme gemessen; Apple bietet das nur auf dem iPhone an („Minimizing is supported for tab bars on only iPhone“) und nennt keine Schwellen | [TabBarMinimizeBehavior](https://developer.apple.com/documentation/swiftui/tabbarminimizebehavior), [tabBarMinimizeBehavior(_:)](https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)), [Tab bars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.md) |
| Glas reagiert auf Berührung | Linse unter dem Finger, Leiste wächst und hellt auf; Maße und Zeiten aus deiner Bildschirmaufnahme gemessen (Apple beschreibt nur, *dass* Liquid Glass in Echtzeit auf Berührung reagiert, nicht wie genau) | [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views), [`Glass.interactive(_:)`](https://developer.apple.com/documentation/swiftui/glass/interactive(_:)) |
| Menüs | Titel-Schreibweise („Move to Day“), „…“ wenn danach eine Eingabe folgt, Symbole vorne und einheitlich je Gruppe, Untermenü mit Pfeil, Haken bei Auswahl, Löschen rot, Gruppen mit Trennlinie | [Menus](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/menus.md), [Apple Developer Forums: Symbol vorne ab iOS 26](https://developer.apple.com/forums/thread/793069) |
| Auswahl im Editor | Kalender und Priorität als Pop-up-Button (natives `<select>`: iOS zeigt sein eigenes Menü) | [Pop-up buttons](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/pop-up-buttons.md) |
| Datum/Uhrzeit | native Felder `type="date"`/`type="time"` – Safari zeigt die kompakten iOS-Picker | [Pickers](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/pickers.md) |
| Schalter „All-day“ | `<input type="checkbox" switch>`: Safari 17.4+ zeigt den nativen iOS-Schalter, andere Browser eine Checkbox | [WebKit: HTML Switch Control](https://webkit.org/blog/15054/an-html-switch-control/) |
| Sheets | ✕ links, ✓ rechts (gefüllt), Wischen nach unten, Rückfrage bei Änderungen | [Sheets](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sheets.md) |
| Wischen zum Löschen | voller Wisch führt „Delete“ aus (Standard in iOS), Rot nach Rolle „destructive“, systemRed von iOS 26, keine eigene Undo-Leiste; Kapsel und abgerundete Zeile wie in iOS 26 (Apple veröffentlicht dafür keine Maße: Abstände und Schwellen sind Annahmen, siehe Grenzen) | [swipeActions (SwiftUI)](https://developer.apple.com/tutorials/data/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:).md), [Undo and redo](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/undo-and-redo.md), [Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md), Aussehen in iOS 26: [Apple Developer Forums](https://developer.apple.com/forums/thread/811328) |
| Segmented Control | Focus/Break/Long als Kapsel mit hervorgehobenem Segment | [Segmented controls](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/segmented-controls.md) |
| Schrift | Systemschrift (SF Pro), Größen nach iOS-Textstilen (Body 17, Headline 17, Title 2 22 …), Dynamic Type über `-apple-system-body` | [Typography](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.md), [WebKit: System Font](https://webkit.org/?p=3709), [Dynamic Type on the Web](https://furbo.org/?p=2791) |
| Farben | iOS-Systemfarben hell/dunkel/erhöhter Kontrast, Akzent = Indigo (Markenfarbe) | [Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md) |

**Bewusste Abweichungen (Barrierefreiheit):** Apples Standardwerte für Sekundärtext
(`secondaryLabel`, 3,4 : 1 auf Weiß) und Indigo-Text auf grauen Knöpfen (4,4 : 1) liegen unter
dem WCAG-AA-Kontrast von 4,5 : 1. Verwendet werden daher etwas kräftigere Werte: Sekundärtext
5,6 : 1, Indigo hell = Systemvariante „erhöhter Kontrast“ (6,1 : 1 auf Weiß), Indigo dunkel
heller (6,4 : 1 auf #1C1C1E), Löschen-Rot hell 5,4 : 1. Rahmen leerer Kreise ≥ 3 : 1.
„Kontrast erhöhen“ und „Bewegung reduzieren“ von iOS werden berücksichtigt (die Linse
bewegt sich dann ohne Nachschwingen und Dehnen, die Leiste wächst nicht).

**Nicht nachbildbar im Web:** die echte Lichtbrechung von Liquid Glass (WebKit unterstützt keine
SVG-Filter für `backdrop-filter`); verwendet wird Unschärfe + Sättigung + Lichtkante. Die
Linse bricht deshalb nur die Symbole der Leiste (Kopien, vergrößert bzw. am Rand verkleinert und
in Farbkanäle versetzt) und zeigt am Rand die Kante der Leiste und den Seitenhintergrund wie
dickes Glas – nicht den tatsächlichen Seiteninhalt dahinter.
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
| zugeklappt ~466 px, Split View ~445 px | eine Spalte wie auf dem iPhone (Woche: Tagesleiste + ein Tag pro Wisch) |
| aufgeklappt quer ~890 px | Ziele neben dem Focus-Timer (Ziele links), Woche in 3 Spalten, Kalender neben der Tagesliste, Habits als Tabelle, Leiste mit Symbol neben Text |
| aufgeklappt hochkant ~626 px | eine Spalte, Listen zweispaltig |

Beim Auf-/Zuklappen bleibt die Stelle, die oben auf dem Bildschirm war, dort (seitlich
weggewischte Tageskarten zählen dabei nicht – es bleibt der Tag, der zu sehen war); offene Menüs
bleiben im sichtbaren Bereich. Safe Areas (Dynamic Island, Home-Indikator, Ränder) werden
an allen vier Seiten berücksichtigt.

## Technik

| Datei | Inhalt |
|---|---|
| `js/mobile.js` | iOS-Look (`html.touch-layout`), Abschnittsleiste mit Scroll-Spy und Glas-Linse, Leiste oben, Menüs (`MobileUI.showMenu`, `moreButton`, `priorityMenu`), Seite hinter einem Sheet festhalten (`MobileUI.lockPage` / `unlockPage`, nur bei Touch), Lesepositions-Erhalt (auch hinter einem Sheet), sichtbare Höhe über der Tastatur (`--vv-height`), Theme-Farbe |
| `css/mobile.css` | iOS-Design auf jedem Gerät (Farb- und Schrift-Tokens, Glas, Karten, Controls, Menüs, Alerts, Sheets, Hover mit der Maus) |
| `index.html` | `<html class="touch-layout">`; sechs `section.page-section` (`#section-home`, `#section-week`, `#section-today`, `#section-health` … `#section-lists`) in der einen Reihenfolge (Kalender, Woche, Ziele, Focus; Step Challenge oben im Health Hub); Abschnittsleiste als Links (Home, dann Week), Leiste oben |
| `js/home-ui.js`, `css/home.css` | Home: der Tag auf einen Blick als erster Abschnitt, siehe HOME.md |
| `js/calendar-ui.js`, `css/calendar.css` | Kalender-Editor und Kalenderliste (Sheet bzw. Dialog), siehe CALENDAR.md |
| `js/swipe.js`, `css/swipe.css` | Wischen zum Löschen (`SwipeActions.enable(row, { label, remove })`, Feder als CSS-`linear()`-Kurve, `whenIdle` für den Neuaufbau nach einem Sync); die Karte einer Zeile ist ihr erster Vorfahr mit Hintergrund (eine Zeile mit eigener abgerundeter Kachel ist ihre eigene Karte); die Zeilen melden sich in `js/app.js` (`swipeToDelete`, `swipeRemove…`), `js/matrix-ui.js` und `js/home-ui.js` an |

- Der Look steht im Markup (`<html class="touch-layout">`) und wechselt nie; der Name der
  Klasse stammt aus der Zeit, als nur Touch-Geräte ihn hatten (bis 17.10.2026 per Media-Query
  `(pointer: coarse) and (max-width: 1099px)`, danach kurz `(pointer: coarse)`).
- Was von der Eingabe abhängt, fragt `(hover: none)` (`MobileUI.isTouch()`,
  `SheetUI.isTouchInput()`): Antippen des Textes hakt ab, Return blendet die Bildschirmtastatur
  aus, Sheets öffnen beim Bearbeiten ohne Tastatur, die Seite hinter einem Sheet wird
  festgehalten. Wischen erkennt `js/swipe.js` am Pointer-Typ (Maus nie).
- Die Seite öffnet auf **Home** ([HOME.md](HOME.md)); die Leiste hat sechs Einträge (Home, Week,
  Today, Health, Habits, Lists), jeder mindestens 44 × 44 pt, die Beschriftungen ungekürzt (Test
  `scroll: phones…`).
- Abschnitt der Leiste: der letzte, dessen Anfang ein Viertel unter der oberen Leiste vorbei
  ist; am Seitenende der gewählte bzw. der letzte. Während eines Sprungs bleibt die Markierung
  stehen (kein Flackern), danach folgt sie wieder dem Inhalt.
- Links `#section-week` usw. funktionieren auch ohne JavaScript; ein Link mit `?steps=` öffnet
  auf dem Handy direkt Health.
- Glas-Linse (`js/mobile.js`, Abschnitt „Section bar: glass lens“; `css/mobile.css`):
  - Gemessen aus der Aufnahme (iPhone, 3×): Linse 1,22 × so breit wie die Markierung und 3,5 px
    über die Leiste hinaus, Inhalt 1,15 × vergrößert, Leiste beim Berühren ≈ 4 % größer,
    Markierung 4 px breiter als ihr Eintrag (an den Enden bis zum Rand der Leiste).
  - Bewegung über Federn (Ansprechzeit/Dämpfung wie SwiftUI `spring(response:dampingFraction:)`);
    die Kante in Bewegungsrichtung ist schneller → die Linse dehnt sich und holt auf.
  - Die Linse zeigt Kopien der Einträge (`aria-hidden`, nicht fokussierbar); die echten Links
    bekommen darunter ein Loch in Linsenform (CSS-Maske) und bleiben die einzigen Links.
  - Antippen läuft weiter über den `click` des Links (auch Tastatur, VoiceOver); Ziehen wählt beim
    Loslassen. Ein Klick, den der Browser nach kurzem Ziehen trotzdem schickt, wird ignoriert –
    sonst würde zweimal gewählt (Chromium schickte ihn im Test nach 10 und 12 px Bewegung noch,
    nach 16 px nicht mehr).
  - Bricht das System die Berührung ab (z. B. Wisch-Geste vom Rand), kehrt die Linse ohne
    Auswahl zurück. Tippen zwischen die Einträge oder an die runden Enden wählt den nächsten.
- Minimieren am Desktop (`js/mobile.js`, Abschnitt „Section bar: minimize while scrolling
  down“; `css/mobile.css`, Klassen `.minimized` und `.collapsed`):
  - Nur wenn Maus oder Trackpad die Haupteingabe ist (`(hover: hover)`); wechselt sie zu Touch
    (Convertible), ist die Leiste sofort wieder voll.
  - Gemessen aus der Aufnahme (60 fps, 3×): Kreis 48 pt, mittig auf der Linie der Leiste, am
    vorderen (linken) Rand; Symbol unverändert groß; Übergang rund 0,25 s. Hier: Kreis am
    rechten Rand des Fensters (Abstand wie die Seite, 24 px bzw. 16 px unter 700 px Breite),
    0,4 s mit schnellem Anfang (`--morph-ease`), ohne Überschwingen – der Kreis darf das
    Fenster nicht verlassen.
  - Schwellen (eigene Werte, Apple nennt keine): 12 px nach unten bzw. oben, ganz oben (≤ 8 px)
    immer voll. Ein Scrollen zählt, wenn es bis 0,6 s nach Mausrad, Taste, Berührung oder
    Ziehen kommt oder während eine Maustaste gedrückt ist (Scrollleiste); ein Klick allein
    zählt nicht. Sprünge zu einem Abschnitt und eine festgehaltene Seite zählen nie.
  - Die Einträge behalten beim Schrumpfen und Wachsen die Breite der vollen Leiste
    (`--items-w`) und werden so verschoben, dass das gewählte Symbol in der Kreismitte sitzt
    (`--icon-x`, `--icon-dy`, gemessen an der vollen Leiste); der Kreis schneidet sie ab
    (`overflow: clip`). Die übrigen Einträge sind danach `visibility: hidden` (Maus, Tastatur,
    VoiceOver). Erst wenn die Breiten-Animation der Leiste fertig ist
    (`getAnimations().finished`), bekommen sie ihre normale Anordnung zurück und die Markierung
    blendet ein.
  - Ändert sich die Fenstergröße, während die Leiste klein ist, wird die volle Leiste ohne
    Animation neu vermessen.
- Sheets und Tastatur (`openSheet` in `js/calendar-ui.js`, `lockPage` in `js/mobile.js`),
  gefunden in zwei Bildschirmaufnahmen vom 17.10.2026 (neuer Termin, „+“ in der Matrix):
  - Ursache 1: iOS zeigt die Tastatur nur bei einem Fokus während des Tippens und scrollt dann
    zum Feld. Das Feld bekam den Fokus, während das Sheet noch unterhalb des Bildschirms lag (es
    glitt erst hoch; im Test: Feld bei y = 939 px auf einem 852 px hohen Bildschirm). iOS
    scrollte dorthin: etwa eine Sekunde dunkler Bildschirm, „Repeat“ oben. Jetzt steht ein
    Sheet mit Textfeld (`focusField`) ab dem ersten Bild an seinem Platz und blendet ein; das
    Feld bekommt den Fokus dort, wo es bleibt. Sheets ohne Tastatur (Bearbeiten, Bereich,
    Kalenderliste) gleiten weiter hoch.
  - Ursache 2: `overflow: hidden` hält nur die Person vom Scrollen ab, nicht den Browser. Das
    Scrollen zum Feld verschob die Seite hinter dem Sheet, und das blieb nach dem Schließen
    (Lists → Habits; im Test ließ sich die Seite hinter dem Sheet um 600 px verschieben und
    blieb dort). Jetzt hält `lockPage` die Seite fest: `body` wird `position: fixed` mit
    `top` = minus Scrollposition (sieht gleich aus, hat aber nichts zu scrollen); beim Schließen
    des letzten Sheets kommt die Scrollposition zurück. Die Abschnittsleiste bleibt so lange
    stehen; die Leseposition beim Auf-/Zuklappen wird auch hinter einem Sheet gehalten
    (vorher nicht, solange im Sheet ein Feld den Fokus hatte).
- Neue Inhalte gehören in eine der fünf `page-section`s.

## Geprüft

Chromium (Playwright) mit Touch-Emulation und Beispieldaten nur im lokalen Test-Mock:

- 393 × 852 hell/dunkel, 375 × 667, 852 × 393 (quer), 890 × 626 (Duo auf), 744 × 1133 (iPad):
  Screenshots aller Abschnitte, Menüs, Editor, Kalenderliste, Alerts; kein horizontales Scrollen.
- Textgrößen 17/19/21/23 px (Standard bis xxxLarge) und 28/33 px (Bedienungshilfen-Größen):
  kein horizontales Scrollen, Timer-Ziffern bleiben im Ring.
- Scroll-Spy über die ganze Seite: Home → Week → Today → Health → Habits → Lists.
- Glas-Linse: Bild-für-Bild-Sequenzen (60 fps, angehaltene Uhr) von Antippen und Ziehen in hell
  und dunkel, neben die Einzelbilder deiner Aufnahme gelegt; 402 × 874, 890 × 626, 852 × 393;
  „Bewegung reduzieren“, „Transparenz reduzieren“, „Kontrast erhöhen“ (emuliert).
- iPad hochkant und quer (17.10.2026): iPad mini 744 × 1133, iPad Air 11″ 820 × 1180,
  iPad Pro 11″ 834 × 1210, iPad Pro 13″ 1032 × 1376 (Punkte = Auflösung bei @2x) und jeweils
  quer: Touch-Layout, Screenshots aller Abschnitte, kein horizontales Scrollen; Drehen behält
  Layout und Abschnitt (Test `ipad: …`).
- Desktop mit Maus (17.10.2026, nach dem Umbau): 1280 × 800, 1440 × 900, 1920 × 1080 und
  2560 × 1440, hell und dunkel, Screenshots aller Abschnitte, kein horizontales Scrollen, Seite
  ab 1376 px mittig. Jede `:hover`-Regel, die mit der Maus greift, einmal überfahren und die
  Änderung gemessen (die alten Effekte sind weg, die neuen wie oben). Doppelklick, Rechtsklick,
  ⋯-Menü per Klick, Drag & Drop auf einen leeren Tag und auf den Kopf eines Tages, Return
  speichert im Editor, Mausziehen löscht nichts (Test `desktop with mouse: …`).
- Minimierende Leiste am Desktop (17.10.2026): 1440 × 900 hell und dunkel, 2560 × 1440,
  1180 und 600 px breit; Bildfolge verlangsamt aufgenommen und mit den Einzelbildern deiner
  Aufnahme verglichen; Lage, Größe und Symbol je Bild gemessen (die Einträge behalten beim
  Wachsen in jedem Bild ihre Breite); Mausrad, Bild ab, Pos1, Klick auf den Kreis, Shift+Tab in die
  Leiste, Fenstergröße ändern, Wechsel zu Touch, Handy, „Bewegung reduzieren“ (Test
  `desktop: the section bar minimizes…`).
- E2E-Szenarien und Gegenproben siehe [tests/README.md](../tests/README.md).

## Grenzen / nicht geprüft

- **Kein Test auf echten Geräten und nicht in Safari/WebKit** – nur Chromium-Emulation. Nur auf
  dem iPhone zu sehen und daher noch zu prüfen: nativer Schalter, iOS-Picker, Dynamic Type,
  Glas-Darstellung, Glas-Linse (Flüssigkeit der Bewegung, Farbsäume, Masken), Tastatur über
  Alerts, Safe Areas im Home-Bildschirm-Modus. Die verwendeten CSS-Funktionen unterstützt
  Safari laut MDN-Kompatibilitätsdaten (`mask-composite` ab 15.4, `mix-blend-mode` ab 8,
  `touch-action: none` ab 13).
- **Wischen zum Löschen**: geprüft mit Touch-Ereignissen über das DevTools-Protokoll in
  Chromium (Flicks als Pointer-Ereignisse im Abstand von 8 ms direkt in der Seite, weil das
  Protokoll hier etwa 50 ms je Berührung braucht). Apple veröffentlicht keine Maße für die
  Wisch-Aktionen von iOS 26 – Kapsel 6 px vom Rand, Schwellen (10 px Richtung, halbe Breite von
  „Delete“ zum Offenbleiben, 60 % der Karte zum Löschen) und die Feder sind Annahmen nach
  Beschreibungen und dem bisherigen Verhalten. Auf dem iPhone noch zu prüfen: das Gefühl der
  Schwellen und der Feder, der Vergleich mit Erinnerungen/Mail, dass der Gedrückt-Zustand
  beim Wischen wegfällt (Chromium setzt `:active` bei simulierten Berührungen nicht) und dass
  senkrechtes Scrollen auf den Zeilen wie bisher geht. Safari: `@property` ab 16.4,
  `linear()` ab 17.2 (davor eine feste Kurve statt der Feder), `overflow: clip` ab 16.
- **Tastatur in Sheets**: Chromium hat keine Bildschirmtastatur. Die Tests prüfen die
  Bedingungen (Feld beim Fokus an seinem Platz, Seite dahinter nicht verschiebbar und danach an
  derselben Stelle); dass iOS dabei nicht mehr springt, zeigt erst das iPhone.
- Keine Haptik beim Wechsel zwischen Abschnitten (Safari unterstützt `navigator.vibrate` nicht).
- „Transparenz reduzieren“ kennt Safari als Media-Query nicht (`prefers-reduced-transparency`,
  MDN); dort bleibt die Linse durchsichtig.
- Duo-Viewport-Größen sind Schätzungen Dritter; Scharnier/halb aufgeklappt wird nicht erkannt.
- Das iPad nutzt hochkant und quer wie das iPhone die Leiste unten (iPadOS platziert Tab Bars
  oben); das Web erkennt iPad und iPhone Duo nicht zuverlässig auseinander.
- iPad quer nur in Chromium mit Touch-Emulation geprüft, nicht auf dem Gerät. Den Wechsel der
  Haupteingabe (Convertible) prüfen die Tests über die Touch-Emulation von Chromium; ein iPad
  wechselt sie nie.
- **Desktop** nur in Chromium geprüft, nicht in Safari oder Firefox am Mac/PC. Firefox lässt
  `<button>`-Elemente nicht ziehen (betrifft keine der ziehbaren Zeilen, das sind `div`s).
  Monatsraster-Einträge per Drag & Drop zu verschieben gibt es im iOS-Look nicht mehr (Datum im
  Editor oder Ziehen in der Woche).
- Die Leiste unten minimiert sich nur am Desktop (Maus oder Trackpad). Auf iPhone und iPad
  bleibt sie voll, damit die Abschnittsmarkierung immer sichtbar bleibt; Apple bietet das
  Minimieren selbst nur auf dem iPhone an, es ließe sich dort also ebenfalls einschalten. Die
  HIG nennt es bei Tab Bars mit Zubehör (z. B. dem Mini-Player in Music); Apples
  SwiftUI-Beispiel verwendet es ohne.
- Minimieren nur in Chromium geprüft. Nicht geprüft: ob Safari und Firefox die Breite (`min()`
  mit Prozent → 48 px) weich animieren (sonst springt sie, der Zustand stimmt trotzdem); ob das
  Ziehen einer klassischen Scrollleiste zählt (nur wenn der Browser dabei `pointerdown` meldet –
  die Testumgebung hat keine klassische Scrollleiste); der Wechsel von Touch zurück zur Maus
  (Chromium meldet nach dem Abschalten der Touch-Emulation gar kein Zeigegerät, also
  `(hover: none)`). Schwellen und Dauer sind eigene Werte bzw. aus der Aufnahme gemessen.
