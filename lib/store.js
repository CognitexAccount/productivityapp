// Gemeinsame Speicherlogik für alle Serverless-Funktionen (Zeittracker und
// Projektsystem). Ohne Abhängigkeiten. Erkennt — wie beim Psychologie-
// Aufnahmetest — Supabase (Postgres über PostgREST) oder Redis (Vercel KV /
// Upstash) anhand der Environment-Variablen, die Vercel beim Verbinden einer
// Datenbank selbst anlegt.
//
// Abgelegt wird in der Tabelle `fortschritt` (Spalten app, code, daten,
// aktualisiert); jede App hat dort genau eine Zeile (app + code).

const TABELLE = "fortschritt";
const MAX_BYTES = 3 * 1024 * 1024;

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
    // Tabelle fehlt noch: kein Ausfall, sondern ein fehlender Einrichtungsschritt.
    if (antwort.status === 404 || (inhalt && /relation .* does not exist/i.test(inhalt.message || ""))) {
      fehler.fehlt = true;
    }
    throw fehler;
  }
  return inhalt;
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
const redisSchluessel = (app, code) => "zeittracker:" + app + ":" + code;

/* ── Lesen / Schreiben ── */
async function lesen(z, app, code) {
  if (z.art === "supabase") {
    const zeilen = await supabase(
      z,
      TABELLE + "?app=eq." + encodeURIComponent(app) + "&code=eq." + encodeURIComponent(code) +
        "&select=daten,aktualisiert&limit=1",
      { method: "GET" }
    );
    if (!Array.isArray(zeilen) || zeilen.length === 0) return null;
    return { daten: zeilen[0].daten, aktualisiert: Date.parse(zeilen[0].aktualisiert) || null };
  }
  const roh = await redis(z, ["GET", redisSchluessel(app, code)]);
  if (!roh) return null;
  const e = typeof roh === "string" ? JSON.parse(roh) : roh;
  return { daten: e.daten, aktualisiert: e.aktualisiert || null };
}

async function schreiben(z, app, code, daten, aktualisiert) {
  if (z.art === "supabase") {
    await supabase(z, TABELLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ app, code, daten, aktualisiert: new Date(aktualisiert).toISOString() }]),
    });
    return;
  }
  await redis(z, ["SET", redisSchluessel(app, code), JSON.stringify({ daten, aktualisiert })]);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

module.exports = { zugang, lesen, schreiben, readBody, MAX_BYTES, TABELLE };
