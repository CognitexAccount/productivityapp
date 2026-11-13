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

## Datenspeicherung

Alle Daten liegen **lokal im Browser** (`localStorage`) auf dem jeweiligen Gerät.
Für Backup oder Gerätewechsel den **JSON-Export** nutzen.

> Hinweis: Eine echte geräteübergreifende Cloud-Synchronisation (gemeinsamer
> Account, automatischer Sync) ist noch nicht enthalten — dafür wäre ein
> Backend nötig. Der Code selbst ist über dieses Repository in der Cloud gesichert.

## Nutzung

`index.html` im Browser öffnen — fertig. Die Datei kann auch z. B. über GitHub
Pages gehostet werden.
