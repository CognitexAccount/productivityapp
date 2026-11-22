# Cloud-Sync auf Vercel (ohne Login)

> Gilt für beide Teile: das **Projektsystem** (`/api/system`) und den
> **Zeittracker** (`/api/data`). Beide nutzen dieselbe Datenbank und dieselbe
> Tabelle `fortschritt` – jeweils eine eigene Zeile. Ist der Zeittracker schon
> synchron, ist es das Projektsystem automatisch auch.
>
> **Optionaler PIN:** Setze in Vercel → Settings → Environment Variables
> `PROJEKTSYSTEM_PIN` (z. B. eine 6-stellige Zahl) und deploye neu. Das
> Projektsystem fragt dann einmal pro Gerät nach diesem PIN. Ohne die Variable
> ist es – wie der Zeittracker – für jeden mit der Adresse erreichbar.

Die Website synchronisiert ihre Daten (Projekte + Zeiten) geräteübergreifend
**ohne Login** – über denselben Mechanismus wie der Psychologie-Aufnahmetest:
eine kleine Serverless-Funktion (`api/data.js`), die den am Vercel-Projekt
hängenden Speicher nutzt. **Supabase** und **Redis** (Vercel KV / Upstash)
werden automatisch erkannt.

## Hast du Supabase schon verbunden?

Dann ist fast nichts zu tun. Die Funktion liest `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY`, die Vercel beim Verbinden selbst setzt, und nutzt
die Tabelle `fortschritt` (Spalten `app, code, daten, aktualisiert`) mit
`app = "zeittracker"`.

1. **Status prüfen:** `https://<deine-domain>/api/status` öffnen.
   - `"bereit": true` → **fertig**, Sync läuft (oben in der App 🟢).
   - `"bereit": false` mit Hinweis auf die fehlende Tabelle → Schritt 2.
   - `"speicher": "keiner"` → Datenbank verbinden (siehe unten) und neu deployen.
2. **Nur falls die Tabelle fehlt:** Im Supabase-Dashboard → **SQL Editor** den
   Inhalt von [`tools/supabase.sql`](tools/supabase.sql) einmal ausführen.
   (Zeigt dein Zeittracker-Projekt auf **dieselbe** Supabase-DB wie der
   Psychologie-Aufnahmetest, existiert sie schon – dann entfällt auch das.)
3. Fertig. Seite neu laden → Status oben wird 🟢 „Cloud-Sync aktiv".

## Noch keine Datenbank verbunden?

Vercel → dein Projekt → **Storage** → **Create Database** → **Supabase**
(oder Upstash for Redis) mit dem Projekt verbinden. Vercel legt die
Environment-Variablen selbst an. Danach **einmal neu deployen**, dann Schritt 1.

## Vorher / ohne Datenbank

Antwortet `/api/data` mit „nicht konfiguriert", läuft die Website einfach
**lokal pro Browser** weiter (Status ⚪). Nichts geht kaputt.

## Wichtig: kein Login = offener Zugriff

Ohne Login gibt es keine Zugriffskontrolle – **wer die Adresse der Website
kennt, sieht und bearbeitet denselben Datenstand**. Für private Nutzung okay,
aber URL privat halten. (Der `code` in `api/data.js` ist nur ein fester,
zufälliger Ablage-Schlüssel, kein Passwort.)

## Technisch

- `api/data.js` – Serverless Function, ohne Abhängigkeiten. GET liefert den
  gemeinsamen Stand, POST legt ihn ab. Speichert in Supabase (PostgREST) oder
  Redis; Schlüssel/Token bleiben serverseitig.
- `api/status.js` – zeigt erkannten Speicher und ob die Tabelle steht.
- Die Website lädt beim Start von `/api/data`, speichert Änderungen dorthin
  (entprellt) und pollt ~alle 5 s auf Änderungen anderer Geräte; lokale Kopie
  als Offline-Puffer. Mehrere Geräte: „last write wins".


## Optional: „An Google Drive senden“ mit einem Klick

Ohne Einrichtung öffnet der Button das Teilen-Menü des Geräts (am Handy lässt
sich dort **Google Drive** wählen); am Desktop wird das PDF heruntergeladen.
Für direktes Hochladen per Klick (auch am Desktop):

1. <https://console.cloud.google.com/> → Projekt anlegen (oder vorhandenes wählen).
2. **APIs & Dienste → Bibliothek** → „Google Drive API“ aktivieren.
3. **OAuth-Zustimmungsbildschirm** einrichten (Typ „Extern“, App-Name z. B.
   „Projektsystem“, deine E-Mail als Testnutzer eintragen).
4. **Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID** → Typ
   „Webanwendung“, unter **Autorisierte JavaScript-Quellen** eintragen:
   `https://productivityapp-alpha.vercel.app`
5. Die angezeigte **Client-ID** (endet auf `.apps.googleusercontent.com`) in
   Vercel unter Settings → Environment Variables als `GOOGLE_CLIENT_ID` speichern
   und neu deployen.

Beim ersten Senden fragt Google einmal nach der Erlaubnis. Die App bekommt nur
Zugriff auf Dateien, die sie selbst anlegt (Scope `drive.file`) – nicht auf den
Rest deines Drives. Die PDFs landen im Ordner **„Projektsystem“**.
