# Projekt-Zeittracker

Eine schlanke, eigenständige Web-App zum Erfassen von Arbeitszeit pro Projekt — eine einzige `index.html`, ohne Build-Schritt und ohne Server. Einfach im Browser öffnen.

## Funktionen

- **Projekte** anlegen (mit optionalem Wochenziel in Stunden)
- **Stoppuhr** pro Projekt (Start/Stopp) — erfasst die laufende Zeit live
- **Countdown-Timer**: Projekt auswählen, Zeit einstellen (Minuten/Sekunden oder Schnellwahl), bis 0 herunterzählen — **Signalton bei 0**
  - Läuft auch nach einem Neuladen der Seite weiter (Ablaufzeit wird gespeichert)
  - Optional: die abgelaufene Fokuszeit wird dem gewählten Projekt automatisch gutgeschrieben
- **Zeit manuell nachtragen**
- **Heute-** und **Wochenansicht** mit Tagesbalken und Soll/Ist gegen das Wochenziel
- **Export**: CSV (für deutsches Excel) und JSON-Backup, plus Backup-Import

## Hosting-Varianten & Cloud-Sync

Die App erkennt automatisch, wo sie läuft, und wählt den passenden Speicher:

| Umgebung | Daten-Sync über Geräte | Voraussetzung |
|---|---|---|
| **claude.ai-Artefakt** | ✅ automatisch | in claude.ai angemeldet (kein extra Login) |
| **Vercel / eigener Webserver** | ✅ via `api/data` + Redis | einmalig Speicher verbinden → **siehe `SETUP.md`** |
| **Lokale `index.html` (`file://`)** | — nur lokal | — |

Oben in der App zeigt eine Statuszeile den aktiven Modus (🟢 Cloud-Sync /
⚪ nur lokal).

> **Vercel-Sync ohne Login:** Es gibt keine Zugriffskontrolle – wer die URL
> kennt, teilt denselben Datenstand. URL privat halten. Details und
> Einrichtung in **`SETUP.md`**.

## Datenspeicherung

- **Cloud-Sync (ohne Login):** Als Artefakt auf claude.ai werden Projekte und
  erfasste Zeiten in der **Cloud-Datenbank des Artefakts** gespeichert und
  zwischen deinen Geräten synchronisiert. Es ist kein separater Login nötig —
  genutzt wird, dass du in claude.ai angemeldet bist; das Artefakt ist privat.
  Vorhandene lokale Daten werden beim ersten Start automatisch in die Cloud
  übernommen.
- **Lokale Kopie / Offline:** Zusätzlich liegt eine Kopie im Browser
  (`localStorage`). Ohne Cloud-Zugang (z. B. als reine `index.html` lokal
  geöffnet) arbeitet die App rein lokal weiter.
- **Backup/Export:** CSV (deutsches Excel) und JSON-Backup mit Import.

Der aktuelle Cloud-Status wird oben in der App angezeigt (grün = Cloud-Sync
aktiv, grau = nur lokal).

> Hinweis: Der *gerade laufende* Timer/Countdown-Zustand bleibt an das Gerät
> gebunden, auf dem gestartet wurde — die **Ergebnisse (Einträge)** werden in
> die Cloud synchronisiert.

## Nutzung

`index.html` im Browser öffnen — fertig. Die Datei kann auch z. B. über GitHub
Pages gehostet werden.
