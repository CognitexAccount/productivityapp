// Vercel Serverless Function: geteilter Cloud-Speicher für den Zeittracker.
//
// Speichert EINEN gemeinsamen Datenstand (Projekte + Einträge) in einem
// Redis-Key. Kein Login: alle Geräte, die dieselbe Website öffnen, teilen
// denselben Datenstand. Der Zugriffs-Token liegt serverseitig (Env-Var) und
// wird NIE an den Browser ausgeliefert.
//
// Benötigt eine Redis-REST-Anbindung über Umgebungsvariablen. Diese werden
// automatisch gesetzt, wenn in Vercel unter "Storage" ein Upstash-Redis-
// Speicher mit dem Projekt verbunden wird:
//   KV_REST_API_URL / KV_REST_API_TOKEN   (Vercel-KV / Upstash-Integration)
//   oder UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//
// Ohne diese Variablen antwortet der Endpunkt mit { configured:false } – die
// Website läuft dann einfach lokal weiter (kein Fehler).

const KEY = "zeittracker:shared:v1";

function conn() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return { url: url.replace(/\/+$/, ""), token };
}

async function redis(cmd) {
  const { url, token } = conn();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json();
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

function clean(body) {
  const projects = Array.isArray(body.projects) ? body.projects : [];
  const entries = Array.isArray(body.entries) ? body.entries : [];
  return { projects, entries, updatedAt: Date.now() };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { url, token } = conn();
  if (!url || !token) { res.status(200).json({ configured: false }); return; }

  try {
    if (req.method === "GET") {
      const out = await redis(["GET", KEY]);
      const data = out && out.result ? JSON.parse(out.result) : { projects: [], entries: [], updatedAt: 0 };
      res.status(200).json({ configured: true, data: data });
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body = await readBody(req);
      const data = clean(body);
      await redis(["SET", KEY, JSON.stringify(data)]);
      res.status(200).json({ configured: true, ok: true, updatedAt: data.updatedAt });
      return;
    }
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
