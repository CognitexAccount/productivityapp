// Vercel Serverless Function: geteilter Cloud-Speicher für den Zeittracker
// (/tracker). Speichert EINEN gemeinsamen Datenstand (Projekte + Einträge).
// Kein Login: alle Geräte, die dieselbe Website öffnen, teilen denselben Stand.
// Speicherlogik (Supabase oder Redis) liegt in lib/store.js.

const store = require("../lib/store.js");

const APP = "zeittracker";
const CODE = "zt4m9qk7x2p1v"; // fester, zufälliger Ablage-Schlüssel (kein Passwort)

function clean(body) {
  body = body || {};
  return {
    projects: Array.isArray(body.projects) ? body.projects : [],
    entries: Array.isArray(body.entries) ? body.entries : [],
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const z = store.zugang();
  if (!z) { res.status(200).json({ configured: false, meldung: "keine-datenbank" }); return; }

  try {
    if (req.method === "GET") {
      const eintrag = await store.lesen(z, APP, CODE);
      const daten = eintrag ? clean(eintrag.daten) : { projects: [], entries: [] };
      res.status(200).json({
        configured: true,
        data: { projects: daten.projects, entries: daten.entries, updatedAt: (eintrag && eintrag.aktualisiert) || 0 },
      });
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const daten = clean(await store.readBody(req));
      if (JSON.stringify(daten).length > store.MAX_BYTES) {
        res.status(413).json({ configured: true, ok: false, fehler: "zu-gross" });
        return;
      }
      const aktualisiert = Date.now();
      await store.schreiben(z, APP, CODE, daten, aktualisiert);
      res.status(200).json({ configured: true, ok: true, updatedAt: aktualisiert });
      return;
    }
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ configured: true, ok: false, fehler: "methode" });
  } catch (e) {
    if (e && e.fehlt) {
      res.status(200).json({ configured: false, meldung: "keine-tabelle: einmal tools/supabase.sql ausführen" });
      return;
    }
    res.status(200).json({ configured: false, meldung: String((e && e.message) || e) });
  }
};

module.exports.zugang = store.zugang;
