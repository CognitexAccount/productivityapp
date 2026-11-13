# Cloud-Sync auf Vercel aktivieren (ohne Login)

Die Website kann ihre Daten (Projekte + Zeiten) geräteübergreifend
synchronisieren – **ohne Login**. Dafür braucht sie einen kleinen
Cloud-Speicher. Der Code dafür ist bereits enthalten
(`api/data.js` + die Website). Es fehlt nur **ein einmaliger Schritt in
deinem Vercel-Konto**: einen (kostenlosen) Redis-Speicher mit dem Projekt
verbinden.

## Schritte (ca. 2 Minuten)

1. Öffne dein Projekt auf **vercel.com**.
2. Reiter **Storage** → **Create Database** (bzw. **Connect Store**).
3. Wähle **Upstash for Redis** (im Marketplace) und folge dem Dialog
   (der kostenlose Free-Plan genügt). Am Ende **Connect** / mit dem
   Projekt verbinden.
   → Vercel legt dabei automatisch die nötigen Umgebungsvariablen an
   (`KV_REST_API_URL` und `KV_REST_API_TOKEN`).
4. **Neu deployen:** Vercel bietet das meist direkt an. Sonst:
   Reiter **Deployments** → neuestes Deployment → **… → Redeploy**.
   (Jeder neue Git-Push deployt ebenfalls neu.)
5. Website öffnen und neu laden. Oben wechselt die Statusanzeige auf
   **🟢 „Cloud-Sync aktiv"**. Ab jetzt sind Handy und Laptop synchron.

## Vorher / ohne diesen Schritt

Solange kein Speicher verbunden ist, antwortet `/api/data` mit
„nicht konfiguriert" und die Website arbeitet einfach **lokal pro Browser**
weiter (Status ⚪ „Nur lokal"). Nichts geht kaputt.

## Wichtiger Hinweis (kein Login = offener Zugriff)

Ohne Login gibt es **keine Zugriffskontrolle**: Wer die Adresse der Website
kennt, sieht und bearbeitet **denselben** Datenstand. Für eine private,
persönliche Nutzung ist das meist okay – **halte die URL aber privat** und
teile sie nicht öffentlich. Wenn du später getrennte Nutzerkonten brauchst,
ist dafür ein echter Login nötig (separater Ausbau).

## Technisch

- `api/data.js` ist eine Vercel Serverless Function. Sie liest/schreibt
  **einen** gemeinsamen JSON-Datensatz in Redis (Key `zeittracker:shared:v1`).
  Der Zugriffs-Token bleibt serverseitig und wird nie an den Browser gegeben.
- Die Website lädt beim Start von `/api/data`, speichert Änderungen dorthin
  (entprellt) und pollt alle ~5 s auf Änderungen anderer Geräte.
  Zusätzlich bleibt eine lokale Kopie (Offline-Puffer).
- Mehrere Geräte gleichzeitig: Es gilt „last write wins" (der letzte
  Speichervorgang gewinnt) – für Einzelnutzung über mehrere Geräte
  unproblematisch.
