// Vercel Serverless Function: geteilter Cloud-Speicher für den Zeittracker.
//
// Speichert EINEN gemeinsamen Datenstand (Projekte + Einträge). Kein Login:
// alle Geräte, die dieselbe Website öffnen, teilen denselben Stand. Der
// Datenbank-Schlüssel bleibt serverseitig und wird nie an den Browser gegeben.
//
// Ohne Abhängigkeiten. Unterstützt – wie beim Psychologie-Aufnahmetest –
// Supabase (Postgres über PostgREST) UND Redis (Vercel KV / Upstash); die
// Funktion nimmt, was am Vercel-Projekt hängt. Beim Verbinden einer Datenbank
// legt Vercel die passenden Environment-Variablen selbst an.
//
// Nutzt dieselbe Tabelle `fortschritt` wie der Psychologie-Aufnahmetest
// (Spalten: app, code, daten, aktualisiert) — nur mit app = "zeittracker".
// Existiert die Tabelle in der verbundenen Supabase-DB bereits, ist KEIN
// weiterer Schritt nötig. Sonst einmal tools/supabase.sql ausführen.

const APP = "zeittracker";
const CODE = "zt4m9qk7x2p1v"; // fester, zufälliger Ablage-Schlüssel (kein Passwort)
const TABELLE = "fortschritt";
const MAX_BYTES = 2 * 1024 * 1024;

function zugang() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (supabaseUrl && supabaseKey) {
    return { art: "supabase", url: supabaseUrl.replace(/\/+$/, ""), key: supabaseKey };
  }
  const redisUrl =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || "";
  const redisToken =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || "";
  if (redisUrl && redisToken) {
    return { art: "redis", url: redisUrl.replace(/\/+$/, ""), token: redisToken };
  }
  return null;
}

/* ── Supabase (PostgREST) ── */
async function supabase(z, pfad, optionen) {
  const antwort = await fetch(z.url + "/rest/v1/" + pfad, {
    ...optionen,
    headers: {
      apikey: z.key,
      Authorization: "Bearer " + z.key,
      "Content-Type": "application/json",
      ...(optionen && optionen.headers),
    },
  });
  const inhalt = await antwort.json().catch(() => null);
  if (!antwort.ok) {
    const fehler = new Error((inhalt && (inhalt.message || inhalt.hint)) || "HTTP " + antwort.status);
    if (antwort.status === 404 || (inhalt && /relation .* does not exist/i.test(inhalt.message || ""))) {
      fehler.fehlt = true;
    }
    throw fehler;
  }
  return inhalt;
}
const filter = () => "?app=eq." + APP + "&code=eq." + CODE;
async function supabaseLesen(z) {
  const zeilen = await supabase(z, TABELLE + filter() + "&select=daten,aktualisiert&limit=1", { method: "GET" });
  if (!Array.isArray(zeilen) || zeilen.length === 0) return null;
  return { daten: zeilen[0].daten, aktualisiert: Date.parse(zeilen[0].aktualisiert) || null };
}
async function supabaseSchreiben(z, daten, aktualisiert) {
  await supabase(z, TABELLE, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ app: APP, code: CODE, daten, aktualisiert: new Date(aktualisiert).toISOString() }]),
  });
}

/* ── Redis (Vercel KV / Upstash) ── */
async function redis(z, befehl) {
  const antwort = await fetch(z.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + z.token, "Content-Type": "application/json" },
    body: JSON.stringify(befehl),
  });
  const ergebnis = await antwort.json().catch(() => null);
  if (!antwort.ok) throw new Error("Speicher antwortete mit " + antwort.status);
  if (ergebnis && ergebnis.error) throw new Error(ergebnis.error);
  return ergebnis ? ergebnis.result : null;
}
const redisSchluessel = () => "zeittracker:" + APP + ":" + CODE;
async function redisLesen(z) {
  const roh = await redis(z, ["GET", redisSchluessel()]);
  if (!roh) return null;
  const e = typeof roh === "string" ? JSON.parse(roh) : roh;
  return { daten: e.daten, aktualisiert: e.aktualisiert || null };
}
async function redisSchreiben(z, daten, aktualisiert) {
  await redis(z, ["SET", redisSchluessel(), JSON.stringify({ daten, aktualisiert })]);
}

/* ── Hilfen ── */
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
function clean(body) {
  return {
    projects: Array.isArray(body.projects) ? body.projects : [],
    entries: Array.isArray(body.entries) ? body.entries : [],
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const z = zugang();
  if (!z) { res.status(200).json({ configured: false, meldung: "keine-datenbank" }); return; }

  try {
    if (req.method === "GET") {
      const eintrag = z.art === "supabase" ? await supabaseLesen(z) : await redisLesen(z);
      const daten = eintrag ? clean(eintrag.daten || {}) : { projects: [], entries: [] };
      res.status(200).json({
        configured: true,
        data: { projects: daten.projects, entries: daten.entries, updatedAt: (eintrag && eintrag.aktualisiert) || 0 },
      });
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      const daten = clean(await readBody(req));
      if (JSON.stringify(daten).length > MAX_BYTES) { res.status(413).json({ configured: true, ok: false, fehler: "zu-gross" }); return; }
      const aktualisiert = Date.now();
      if (z.art === "supabase") await supabaseSchreiben(z, daten, aktualisiert);
      else await redisSchreiben(z, daten, aktualisiert);
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

module.exports.zugang = zugang;
