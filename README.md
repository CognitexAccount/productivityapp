# Projektsystem

Persönliches Betriebs- und Projektsystem: Vorhaben planen, To-Dos fokussiert
abarbeiten, Zeit erfassen – am Desktop wie am Handy. Ohne Build-Schritt, ohne
Login, gehostet auf Vercel, Daten in Supabase.

| Pfad | Inhalt |
|---|---|
| `/` | **Projektsystem** (Startseite; `/tracker` leitet hierher weiter) |
| `/api/system` | Cloud-Speicher des Projektsystems |
| `/api/data` | Daten des alten Zeittrackers (nur noch zum Zuordnen/Import) |
| `/api/config` | öffentliche Konfiguration (Google-Client-ID für Drive, optional) |
| `/api/status` | zeigt, welche Datenbank erkannt wurde und ob die Tabelle steht |

## Datenmodell

1. **Bereiche** (Business, Akademische Projekte, Lifestyle/Sonstiges, Künstler …)
2. **Vorhaben** (Hypothesen) mit Lebenszyklus: Idee → Vorbereitung → Läuft →
   Abschluss-Review → Abgeschlossen. Optional einer **Gruppe** zugeordnet (z. B. „Cognitex“).
3. **To-Dos** an einem Vorhaben, mit Fälligkeit und **Zeitangabe (5 / 15 / 30 / 60 Min)**.
4. **Zeiteinträge** an To-Do und Vorhaben (Countdown, Stoppuhr oder nachgetragen).
5. **Ziele**: 1-Jahres-Ziele und 10-Jahres-Vision.

Alle Textfelder sind Rich Text (Aufzählungen, Checklisten, Überschriften, Links).
Jedes Feld zeigt seine **Leitfragen** als ausklappbaren Hinweis – die Leitfragen
lassen sich in den Einstellungen bearbeiten. Erfolg / Neutral / Misserfolg /
**Killkriterium** sind vier eigene Felder – ein fehlendes Killkriterium wird markiert.

## Ansichten

- **Heute** (mobil zuerst): überfällige, heutige und kommende To-Dos mit großem Start-Button
- **Tabelle**: wie das Sheet, Zellen gekürzt – Klick öffnet die Zelle groß im Seitenpanel
- **Board**: Kanban nach Status, Drag & Drop, **WIP-Grenze** für „Läuft“, Ideen-Park
- **Dokument**: ein Vorhaben als Seite mit allen Kapiteln, To-Dos, Zeit; PDF-Export & Drive
- **Zeitleiste**: Laufzeiten als Balken, „heute parallel aktiv“, überzogene Laufzeiten
- **Wochenreview**: Zeit pro Tag und pro Vorhaben (Soll/Ist über das Wochenziel), alle
  Zeiteinträge der Woche, überfällige To-Dos, Vorhaben ohne Aktivität, Fristwächter, neue Ideen
- **Lessons**: alle Lessons Learned durchsuchbar
- **Strategie**: 1-Jahres-Ziele und 10-Jahres-Vision

Dazu: **Countdown am To-Do** (läuft die Zeitangabe herunter, bucht automatisch,
**Signalton bis zu 2 Minuten**, bis er ausgestellt wird; „+5 Min“ / „Erledigt“),
**Stoppuhr** am Vorhaben, **Zeit nachtragen** (überall), Tagesübersicht und
Wocheneinträge im Wochenreview, **CSV-Export** für Excel, **PDF-Export** pro Vorhaben,
**An Google Drive senden**, **Idee parken** (überall, Taste `i`), **Fristwächter**,
**Abschluss-Assistent** (Ergebnis → Resistance oder Personal End Point →
Stakeholder-Checkliste → Lessons Learned → Feiern), JSON-Backup.

> Signalton: wird beim Start des Countdowns eingeplant und klingelt auch bei Tab im
> Hintergrund. Am Handy klingelt er nur, solange der Browser/die App geöffnet ist
> (bei gesperrtem Bildschirm unterbinden iOS/Android den Ton).

Am Handy über „Zum Home-Bildschirm“ als App installierbar.

## Speicherung & Sync

- Die App liest/schreibt über `/api/system` in die am Vercel-Projekt verbundene
  Datenbank (Supabase oder Redis, siehe `SETUP.md`), Tabelle `fortschritt`,
  Zeile `app = "projektsystem"`.
- **Mehrere Geräte**: Jede Änderung trägt einen Zeitstempel *pro Feld*. Server und
  Browser führen Stände feldweise zusammen (`shared/sync.js`) – parallele Änderungen
  an verschiedenen Feldern (z. B. Status am Laptop, Text offline am Handy) gehen
  nicht verloren. Andere Geräte gleichen alle ~8 s ab.
- Lokale Kopie im Browser als Offline-Puffer.
- **Kein Login.** Optionaler Schutz über die Environment-Variable
  `PROJEKTSYSTEM_PIN` (siehe `SETUP.md`).

## Aufbau

```
index.html            Projektsystem (lädt app/main.js als ES-Modul)
app/                  Frontend: state.js (Daten & Sync), views/*, editor.js, …
shared/sync.js        Zusammenführen von Ständen (Browser + Server)
shared/text.js        Text ↔ Rich Text
api/system.js         Speicher Projektsystem
api/data.js           Speicher Zeittracker
api/status.js         Diagnose
lib/store.js          gemeinsame Speicherlogik (Supabase / Redis)
api/config.js         öffentliche Konfiguration (Google-Client-ID)
vendor/pdfmake/       PDF-Erzeugung (MIT), wird erst beim Export geladen
tools/supabase.sql    Tabelle anlegen (falls noch nicht vorhanden)
```
