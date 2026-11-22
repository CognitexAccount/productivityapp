// Vercel Serverless Function: Cloud-Speicher des Projektsystems.
//
// GET  /api/system  → { configured, data, updatedAt }
// POST /api/system  → führt den mitgeschickten Stand mit dem gespeicherten
//                     zusammen (pro Eintrag gewinnt die neuere Änderung, siehe
//                     shared/sync.js), speichert und gibt das Ergebnis zurück.
//
// Kein Login. Optionaler Schutz: Ist am Vercel-Projekt die Environment-
// Variable PROJEKTSYSTEM_PIN gesetzt, verlangt die Funktion diesen PIN im
// Header "x-pin" (die App fragt ihn einmal ab und merkt ihn sich im Browser).

const store = require("../lib/store.js");
const sync = require("../shared/sync.js");

const APP = "projektsystem";
const CODE = "ps8v3n6r1q5t"; // fester, zufälliger Ablage-Schlüssel (kein Passwort)

function pinOk(req) {
  const pin = process.env.PROJEKTSYSTEM_PIN;
  if (!pin) return true;
  const h = (req.headers && (req.headers["x-pin"] || req.headers["X-Pin"])) || "";
  return String(h) === String(pin);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const z = store.zugang();
  if (!z) { res.status(200).json({ configured: false, meldung: "keine-datenbank" }); return; }
  if (!pinOk(req)) { res.status(401).json({ configured: true, ok: false, pinRequired: true }); return; }

  try {
    if (req.method === "GET") {
      const e = await store.lesen(z, APP, CODE);
      res.status(200).json({ configured: true, data: e ? e.daten : null, updatedAt: (e && e.aktualisiert) || 0 });
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = await store.readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        res.status(400).json({ configured: true, ok: false, fehler: "kein-json" });
        return;
      }
      const e = await store.lesen(z, APP, CODE);
      const merged = sync.prune(sync.merge(e ? e.daten : null, body));
      if (JSON.stringify(merged).length > store.MAX_BYTES) {
        res.status(413).json({ configured: true, ok: false, fehler: "zu-gross" });
        return;
      }
      const t = Date.now();
      await store.schreiben(z, APP, CODE, merged, t);
      res.status(200).json({ configured: true, ok: true, data: merged, updatedAt: t });
      return;
    }
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ configured: true, ok: false, fehler: "methode" });
  } catch (err) {
    if (err && err.fehlt) {
      res.status(200).json({ configured: false, meldung: "keine-tabelle: einmal tools/supabase.sql ausführen" });
      return;
    }
    res.status(502).json({ configured: true, ok: false, meldung: String((err && err.message) || err) });
  }
};
