# Premium-Prototyp: Dali’s Dashboard (Design-Exploration)

Eigenständige gestalterische Alternative zum Konzept-Prototyp in `../prototype/`. Nur Beispieldaten,
keine Verbindung zu Supabase, keine Anmeldung, keine Änderung an der produktiven App. Änderungen
bleiben im `localStorage` des Browsers (eigener Schlüssel) und gehen nirgendwohin.

Öffnen: `index.html` doppelklicken oder im Ordner `python3 -m http.server 8080` starten und
`http://localhost:8080/` öffnen. Oben links die Leiste „Prototyp“: Rahmen (frei, iPhone Duo zu/auf,
iPhone, iPad), Hell/Dunkel, Demo-Zeit, „Vorschläge markieren“, Beispieldaten zurücksetzen.

## Phase A – Analyse und Art Direction

### Was am bisherigen Prototyp gestalterisch nicht trägt

1. **Kartenstapel.** Jeder Bereich ist dieselbe weiße Karte auf iOS-Grau; Home hat sechs Blöcke
   untereinander. Die Form sagt nichts über den Inhalt.
2. **Merkmals-Ketten.** Unter jeder Aufgabe reihen sich Projektpunkt, Fälligkeit, Schätzung,
   ⇄-Markierung und „2× verschoben“ als Pillen auf. Bei vier Merkmalen wird die Zeile zur Kette.
3. **Eine Akzentfarbe für alles.** Indigo füllt Knöpfe, Häkchen, Navigation, Balken und Markierungen;
   das wirkt wie ein generisches Dashboard.
4. **Typografie ohne Stimme.** Systemschrift, fette Überschriften, sonst kaum Hierarchie; Zahlen
   und Uhrzeiten sind nicht als Zahlen gesetzt.
5. **Dichte Woche.** Sieben schmale Spalten, Silbentrennung in Aufgabennamen, Kapazitätsbalken mit
   Legende in jeder Spalte.
6. **Hinweis-Banner** in Warnfarbe als erstes Element der Seite.
7. **Sechs Knöpfe je Inbox-Eintrag**; der häufigste Fall („Heute“) ist nicht hervorgehoben.

### Untersuchte Richtungen

| Richtung | Stärke | Schwäche | Entscheidung |
|---|---|---|---|
| Präzisionsinstrument (dicht, monochrom, Tastatur-zuerst, wie Desktop-Werkzeuge) | effizient am Desktop | wirkt wie SaaS, auf dem Handy zu dicht | nur die Disziplin übernommen (Raster, Zahlen) |
| Tonale Flächen ohne Rahmen (Hierarchie nur über Helligkeitsstufen) | ruhig, modern | kann unfertig wirken, wenig Charakter | Flächenlogik übernommen |
| Zeitachse als Rückgrat (alles entlang einer Tagesleiste) | zeigt, wann etwas passt | Zeitblöcke sind laut Konzept zurückgestellt; Home als Zeitleiste wurde verworfen (A2) | nur als Zeitspalte im Tagesblatt |
| Schweizer Raster (Linien, große Ziffern, eine Signalfarbe) | unverwechselbar, zeitlos | kühl, plakativ | Linien und Ziffern übernommen |
| **Papier und Tinte** (warme Fläche, Serif als Stimme, Hairlines statt Karten, eine Tintenfarbe als Akzent) | ruhig, eigenständig, trägt beide Modi, passt zu einem persönlichen Planer | braucht Sorgfalt bei Kontrast und Dichte | **gewählt**, mit Raster und Zahlen aus den anderen |

### Die gewählte Richtung: „Papier und Tinte“

Dali’s Dashboard als sorgfältig gesetztes Tagesblatt – kein Cockpit, keine Widget-Wand.

- **Flächen:** warmes Papier statt iOS-Grau und reinem Weiß (hell `#F5F3EE`, dunkel `#161512` – ein
  warmes Fast-Schwarz, keine Umkehrung). Zwei Stufen darunter (Einsatz, Druck) und eine Stufe
  darüber (Sheets, Eingabefelder). Keine Karten – Gruppen entstehen durch Hairlines, Abstände und
  Abschnittsmarken. Genau ein hervorgehobener Block pro Bildschirm (auf Home: „Jetzt“).
- **Typografie als Hauptgestaltungsmittel.** *Source Serif 4* (optische Größen) ist die Stimme:
  Begrüßung, Tagesdatum, Bildschirmtitel. *Source Sans 3* ist das Werkzeug: Aufgaben, Zeiten,
  Zähler – mit tabellarischen Ziffern, damit Uhrzeiten und Zahlen untereinander stehen. Sechs
  Stufen: Display 32/36, Titel 24/28, Lead 20/26, Text 17/24, Zweittext 14/20, Marken 12/16 in
  Versalien mit Laufweite. Keine Überschrift ist größer, als ihr Informationswert rechtfertigt.
- **Farbe:** Tinte (fast schwarz) und zwei Grautöne mit warmem Stich; **eine** Akzentfarbe als grüne
  Tinte (`#1F6A4E` / dunkel `#63C195`) nur für die primäre Aktion, „heute/jetzt“ und Links; Rot
  (`#B4231B` / `#F0716A`) nur für „überfällig“ und „überladen“. Erledigt ist Tinte, nicht Grün.
  Projektfarben (Vorschlag) nur als kleine Punkte, nie als Text. Alle Textfarben ≥ 4,5 : 1 auf
  ihrer Fläche, in beiden Modi (geprüft, siehe Phase C).
- **Rhythmus:** 4-px-Raster, Zeilen 48 px, Berührungsziele ≥ 44 px, Seitenrand 20/24/32 px je
  Breite, Abschnittsabstand 32 px. Eine linke Spalte (56 px) für Uhrzeiten, Wochentage und Häkchen
  gibt jedem Bildschirm dieselbe Leseachse.
- **Form:** Radien klein (Bedienelemente 8 px, Felder 10 px, Sheets 16 px); keine Verläufe, kein
  Glas, kein Glühen; Schatten nur unter Sheets.
- **Bewegung:** kurz und sachlich (120–220 ms): Häkchen, Sheet von unten, Markierung der Leiste.
  Mit „Bewegung reduzieren“ keine Animation.

### Layoutstrategie

Ein Designsystem, drei Kompositionen – gewählt nach verfügbarer Breite des App-Containers, nicht
nach Gerätetyp (Container-Queries, daher funktionieren die Geräterahmen am Desktop):

| Breite des Containers | Komposition | Navigation |
|---|---|---|
| unter 600 px (iPhone, iPhone Duo geschlossen) | eine Spalte, Tagesblatt | Tab-Leiste unten (Heute, Aufgaben, Woche, Eingang), „+“ oben rechts |
| 600–959 px (iPhone Duo geöffnet, iPad hochkant) | zwei Spalten, wo es den Überblick verbessert (Home: Tagesblatt + Wochenstand; Woche: Wochenledger) | schmale Leiste links mit Symbolen |
| ab 960 px (iPad quer, Desktop) | Raster mit Seitenleiste; Woche als sieben Spalten, Aufgaben als vier Spalten | Seitenleiste mit Beschriftung |

Das iPhone Duo wird als zwei Viewports simuliert (Annahmen, siehe unten); der Web-Prototyp erkennt
keinen Faltzustand.

### Bestätigt vs. Vorschlag

Bestätigt (so in der produktiven App): Home mit Begrüßung, Wetter, Terminen, Aufgaben, Zielen,
Schritten, Habits; Kalender mit Uhrzeiten; Wochenboard Mo–So; Matrix (to do, up next, waiting,
ideas) mit Fälligkeit, Wiederholung, Notiz; Listen; Habits; Tastatur- und Touch-Bedienung; Hell/Dunkel.

Vorschläge aus den Konzeptberichten (im Prototyp mit „Vorschlag“ markiert, abschaltbar):
Inbox mit Einordnen (E1), nächster Schritt mit Regel (A1), Projekte als Merkmal und Filter (B1),
Schätzung und Kapazität (C1/A4), ein Aufgabenbestand für Matrix und Woche (B2),
Tagesabschluss (C4). Nichts davon ist eine beschlossene Produktänderung.

## Phase B – Umsetzung (Kurzüberblick)

Reines HTML/CSS/JS ohne Abhängigkeiten (`index.html`, `styles.css`, `app.js`, `data.js`, Schriften
in `fonts/`). Umgesetzt: Home als Zentrum (Jetzt-Block, Termine, Aufgaben des Tages, Wochenstand,
Eingang, Schritte, Habits), Navigation (Tab-Leiste / schmale Leiste / Seitenleiste), Eingang mit
Notieren und Einordnen, Aufgaben (Matrix-Bereiche, Projektfilter, Listen), Woche (Tagesblatt mit
Tagesleiste, Wochenbuch, sieben Spalten), Sheets (Notieren, Aufgabe, Einordnen, Einplanen, Filter,
Mehr, Fokus, Tagesabschluss), Hell/Dunkel, Abend-Zustand, leerer Zustand, Stresstest mit vielen
Aufgaben. Alle Bedienwege funktionieren mit Beispieldaten im Browser.

## Phase C – Visuelle Qualitätskontrolle

### Womit geprüft wurde

Playwright mit Chromium (headless) in einer Linux-Sandbox. **Kein Safari/WebKit, keine echten
Geräte.** Die Prüfung läuft mit echten Viewports (Chromium sieht die Seite, als wäre sie das Gerät),
für Duo, iPhone und iPad mit Touch-Emulation; der Geräterahmen in der Prototyp-Leiste ist nur zum
Anschauen am Desktop.

| Viewport | Maße (CSS-px) | Modus | Grundlage |
|---|---|---|---|
| iPhone Duo geschlossen | 466 × 678 | kompakt | **Annahme** (kein offizieller Wert) |
| iPhone Duo geöffnet, hoch | 626 × 890 | mittel | **Annahme** |
| iPhone Duo geöffnet, quer | 890 × 626 | mittel | **Annahme** |
| iPhone | 393 × 852 | kompakt | iPhone 15/16-Klasse |
| iPad hoch / quer | 820 × 1180 / 1180 × 820 | mittel / breit | iPad 10. Gen. |
| Desktop schmal / normal / breit | 1024 × 768 / 1440 × 900 / 1920 × 1080 | breit | – |

Ein echter Faltwechsel wird nicht erkannt; er wird als Wechsel des Viewports bei laufender App
simuliert (Sheet offen, Text getippt). Tastatur (300 px) und Safe Areas (59 px oben, 34 px unten)
sind Simulationen über Klassen, keine Systemwerte.

### Was tatsächlich geprüft wurde

- `node screenshots.js <ordner>` – **83 Screenshots**: alle vier Ansichten auf allen neun Viewports
  hell; Home und Woche je Viewport dunkel; Sheets (Notieren mit und ohne Tastatur, Aufgabe,
  Einordnen, Einplanen, Filter, Mehr, Tagesabschluss), Abend-Zustand, viele Aufgaben, leerer
  Zustand, Safe Areas, überladener Freitag. Ergebnis des letzten Laufs: kein horizontaler Überlauf
  (Seite und Hauptbereich), beide Schriften geladen, 0 Seitenfehler. Alle Bilder wurden angesehen.
- `node checks.js` – **38 Prüfpunkte**, alle bestanden: Faltwechsel zu → auf → zu mit offenem
  Notieren-Sheet (Text bleibt, Sheet bleibt, Sheet liegt am Duo zu unten an, am Duo auf mittig);
  Detail-Sheet bleibt nach Faltwechsel offen, gesetzte Schätzung bleibt; Navigation springt nicht;
  Escape schließt, Enter legt in den Eingang, Tab + Enter öffnet eine Zeile; Zwei-Tipp-Wege
  (Eingang → Heute, Jetzt → Erledigt mit Nachrücken); Berührungsziele ≥ 40 px für alle Knöpfe und
  Links in allen vier Ansichten, im Aufgabe-Sheet und im Tagesabschluss auf Duo zu, Duo auf und
  iPad quer; Häkchen (sichtbar 22 px) trifft 9 px neben dem Kreis (Berührungsfläche 44 px);
  Zeilen-Hauptteil ≥ 44 px; „Bewegung reduzieren“ schaltet die Sheet-Animation ab; dunkle Tokens
  greifen, der Hell-Schalter überstimmt das System.
- Kontraste (rechnerisch, WCAG): Fließtext ≥ 14:1, Zweittext ≥ 5,7:1, Metadaten hell ≥ 5,06:1 und
  dunkel ≥ 4,58:1 (knappster Wert: Metadaten auf Sheets), Akzent als Text ≥ 5,36:1, Rot ≥ 5,42:1,
  Schrift auf Akzentknöpfen 5,86:1 hell / 8,34:1 dunkel.

### In Phase C gefunden und behoben

- Container-Variablen auf `.app` griffen nicht (ein Container kann sich nicht selbst stylen) → auf
  die Kinder gesetzt.
- Kapazitätszeile brach „0,5 / h“ um → geschützte Leerzeichen; Wochenbuch-Vorspalte 84 px.
- Titel doppelt (Kopfleiste + Inhalt) → Kopfleiste zeigt den Titel erst beim Scrollen.
- Kompakte Aufgaben: Bereichsname doppelt; Eingangszeilen zu voll → „Einordnen“-Knopf auf kompakt
  weg, die Zeile selbst öffnet das Sheet.
- Sieben Wochenspalten bei 1024 px zu schmal → Spalten erst ab 1100 px Hauptbereich, sonst Wochenbuch;
  vier Aufgabenspalten erst ab 1200 px.
- Metadaten-Farbe hell 4,43:1 auf dem Einsatz → dunkler gesetzt (≥ 5,06:1).
- Prototyp-Leiste brach bei 393 px auf drei Zeilen → Hinweistext unter 520 px ausgeblendet.
- Berührungsziele: kleine Knöpfe, Filter, Segmente und Chips auf Touch/kompakt 40 px; Jetzt-Aufgabe
  und Zeilen-Hauptteil decken die ganze Zeile ab (ohne das Layout zu verschieben); Häkchen mit
  44-px-Fläche; „Mehr“ in der schmalen Leiste war 22 px breit; Textlink im Eingang 18 px hoch.
- Wochenspalten: Köpfe über alle Tage gleich hoch (Raster), „überladen“ steht über der Zahl statt
  umzubrechen.
- Ein Testfehler war keiner: das Sheet wurde während der 220-ms-Animation gemessen (680 statt
  678 px). Der Test wartet jetzt das Ende der Animation ab.

### Bekannte Grenzen und offene Punkte

- Nur Chromium. Safari-Eigenheiten (Gummiband-Scrollen, Tastatur-Viewport, `backdrop-filter`,
  Schriftglättung) sind **nicht geprüft**. Die Duo-Maße sind Annahmen; sobald echte Werte bekannt
  sind, reichen zwei Zahlen in `screenshots.js`, `checks.js` und `styles.css`.
- Deutsche Silbentrennung (`hyphens: auto`) ist gesetzt, aber in diesem Chromium ohne Wörterbuch
  **nicht prüfbar**: in den sieben Wochenspalten (iPad quer, Desktop) brechen lange zusammengesetzte
  Wörter in Chromium mitten im Wort („Finanzierungsgesprä|ch“). In Safari ist eine Trennung mit
  Bindestrich zu erwarten, das ist aber nicht nachgewiesen.
- Nicht gebaut: Wochenrückblick, Wischgesten, Drag & Drop, Fokus-Timer (nur angedeutet), echte
  Kurzbefehl-Anbindung („per Kurzbefehl diktieren“ ist eine Demo), „Termin heute 16:00“ im Einordnen
  ist eine Demo-Aktion. Wetter, Schritte und Habits sind Beispielwerte (Wetter mit „Demo“ markiert).
- Zeitabhängige Teile (Jetzt-Linie, „in 20 min“) sind auf die Demo-Zeit 09:40 / 18:30 fixiert.

### Prüfungen wiederholen

```
cd concept/prototype-premium
node screenshots.js /pfad/zum/ausgabeordner      # 83 Bilder + _report.json (Überlauf, Schriften, Fehler)
node screenshots.js /pfad/zum/ausgabeordner week  # nur Namen, die auf das Muster passen
node checks.js                                     # 38 Prüfpunkte, Exit-Code 1 bei Fehler
```

Voraussetzung: Node.js und Playwright mit Chromium (`npm i -g playwright` genügt; die Skripte finden
die globale Installation). Die Skripte starten einen lokalen Server auf 127.0.0.1 und greifen auf
nichts außerhalb des Ordners zu.

### Screenshots

`screenshots/` enthält zehn verkleinerte Übersichtsbilder des letzten Laufs (Duo zu/auf, iPhone,
iPad, Desktop, dunkel, Sheets, Tastatur, leerer Zustand, Stresstest, Safe Areas). Der vollständige
Satz in 2-facher Auflösung (83 Bilder, 17 MB) liegt nicht im Repo und lässt sich mit dem Befehl oben
jederzeit neu erzeugen.
