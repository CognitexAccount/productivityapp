// Datenhaltung, Cloud-Sync und Aktionen des Projektsystems.
//
// Der komplette Stand liegt in store.state (Sammlungen: areas, vorhaben, todos,
// goals, timeEntries; Einzelwerte: settings, running). Jede Änderung bekommt
// einen Zeitstempel u, wird lokal gespeichert und (entprellt) an /api/system
// geschickt. Der Server führt pro Eintrag zusammen (shared/sync.js), dadurch
// können mehrere Geräte parallel arbeiten, ohne sich Änderungen zu überschreiben.

import { DEFAULT_AREAS, ACTIVE, DEFAULT_EST, todayKey, dateKey, diffDays } from "./model.js";

const S = window.SyncMerge;
const CACHE = "projektsystem_v1";
const PINKEY = "projektsystem_pin";

export const store = { state: S.empty(), sync: "checking" };

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);
function emit(reason) {
  listeners.forEach((f) => { try { f(reason); } catch (e) { console.error(e); } });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ── Lokaler Zwischenspeicher ── */
export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE);
    if (raw) store.state = S.merge(S.empty(), JSON.parse(raw));
  } catch (e) { /* leer starten */ }
}
function cache() {
  try { localStorage.setItem(CACHE, JSON.stringify(store.state)); } catch (e) { /* voll/gesperrt */ }
}

/* ── Schreiben ── */
const stamp = (prev) => Math.max(Date.now(), ((prev && prev.u) || 0) + 1);
function changed(opts) {
  cache();
  schedulePush();
  if (!opts || !opts.silent) emit("local");
}
export function upsert(coll, item, opts) {
  const list = store.state[coll];
  const i = list.findIndex((x) => x.id === item.id);
  const prev = i >= 0 ? list[i] : null;
  const t = stamp(prev);
  const next = { ...item, u: t };
  if (!next.del) {
    // Pro geändertem Feld merken, wann es geändert wurde (feldweises Zusammenführen)
    const fu = { ...((prev && !prev.del && prev.fu) || {}) };
    S.changedKeys(prev && !prev.del ? prev : null, item).forEach((k) => { fu[k] = t; });
    next.fu = fu;
  } else {
    delete next.fu;
  }
  if (i >= 0) list[i] = next; else list.push(next);
  changed(opts);
  return next;
}
export function patch(coll, id, changes, opts) {
  const cur = store.state[coll].find((x) => x.id === id);
  if (!cur) return null;
  return upsert(coll, { ...cur, ...changes }, opts);
}
export function removeItem(coll, id, opts) {
  return upsert(coll, { id, del: true }, opts);
}
export function setSingleton(key, val, opts) {
  store.state[key] = { ...val, u: stamp(store.state[key]) };
  changed(opts);
}
export function notify() { emit("local"); }

/* ── Lesen ── */
export const live = (coll) => store.state[coll].filter((x) => !x.del);
export const byId = (coll, id) => store.state[coll].find((x) => x.id === id && !x.del) || null;
export const settings = () => store.state.settings || {};
export const areas = () => live("areas").sort((a, b) => (a.order || 0) - (b.order || 0));
export const areaName = (id) => (byId("areas", id) || { name: "Ohne Bereich" }).name;
export const isActive = (v) => ACTIVE.includes(v.status);

// „Sonstiges“: festes Sammel-Projekt für To-Dos ohne eigenes Vorhaben (taucht nicht in Board/Tabelle/Zeitleiste auf)
export const SONSTIGES_ID = "v_sonstiges";
export const projects = () => live("vorhaben").filter((v) => !v.system);
// Projektname (kurz); ohne Namen: gekürzte Hypothese
export function vName(v) {
  if (!v) return "(gelöscht)";
  const n = (v.name || "").trim();
  if (n) return n;
  if (v.system) return "Sonstiges";
  const t = (v.title || "Ohne Titel").trim();
  return t.length > 48 ? t.slice(0, 46).trim() + " …" : t;
}
export function ensureSonstiges() {
  if (store.state.vorhaben.some((v) => v.id === SONSTIGES_ID)) return;
  upsert("vorhaben", { id: SONSTIGES_ID, system: true, name: "Sonstiges", title: "Sonstiges", status: "Läuft", areaId: null, fields: {}, erfolg: {}, created: 0 }, { silent: true });
}
// Auswahlliste für die Zuordnung von To-Dos/Zeiten: aktive Projekte zuerst, „Sonstiges“ immer am Ende
export function assignableProjects() {
  const list = projects().filter((v) => v.status !== "Abgeschlossen")
    .sort((a, b) => (isActive(b) ? 1 : 0) - (isActive(a) ? 1 : 0) || vName(a).localeCompare(vName(b), "de"));
  const s = byId("vorhaben", SONSTIGES_ID);
  return s ? [...list, s] : list;
}

function todoSort(a, b) {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  const da = a.due || "9999", db = b.due || "9999";
  if (da !== db) return da < db ? -1 : 1;
  return (a.created || 0) - (b.created || 0);
}
export const sortTodos = (list) => list.slice().sort(todoSort);
export const todosOf = (vid) => sortTodos(live("todos").filter((t) => t.vorhabenId === vid));

// Tatsächlich gelaufene Zeit des Timers in ms (ohne Pausen)
export function elapsedMs(r) {
  if (!r || !r.start) return 0;
  const now = r.pausedAt || Date.now();
  return Math.max(0, now - r.start - (r.pausedMs || 0));
}
export function runningMin(filter) {
  const r = store.state.running;
  if (!r || !r.start || !filter(r)) return 0;
  return elapsedMs(r) / 60000;
}
export function minutesOf(vid, fromKey, toKey) {
  let m = 0;
  for (const e of live("timeEntries")) {
    if (e.vorhabenId !== vid) continue;
    if (fromKey && e.date < fromKey) continue;
    if (toKey && e.date > toKey) continue;
    m += e.min || 0;
  }
  const k = todayKey();
  if ((!fromKey || k >= fromKey) && (!toKey || k <= toKey)) m += runningMin((r) => r.vorhabenId === vid);
  return m;
}
export function minutesTodo(tid) {
  let m = 0;
  for (const e of live("timeEntries")) if (e.todoId === tid) m += e.min || 0;
  return m + runningMin((r) => r.todoId === tid);
}
export function minutesRange(fromKey, toKey) {
  let m = 0;
  for (const e of live("timeEntries")) if (e.date >= fromKey && e.date <= toKey) m += e.min || 0;
  const k = todayKey();
  if (k >= fromKey && k <= toKey) m += runningMin(() => true);
  return m;
}

// Fristwächter: überschritten oder bald fällig
export function deadline(v) {
  if (!isActive(v) || !v.end) return null;
  const d = diffDays(todayKey(), v.end);
  if (d < 0) return { kind: "over", days: -d };
  if (d <= 7 && v.status === "Läuft") return { kind: "soon", days: d };
  return null;
}
export const overdueVorhaben = () => live("vorhaben").filter((v) => (deadline(v) || {}).kind === "over");

export function lastActivity(vid) {
  const v = byId("vorhaben", vid);
  let t = (v && v.u) || 0;
  for (const x of store.state.todos) if (x.vorhabenId === vid && !x.del) t = Math.max(t, x.u || 0);
  for (const e of store.state.timeEntries) if (e.vorhabenId === vid && !e.del) t = Math.max(t, e.end || e.u || 0);
  return t;
}

/* ── Aktionen ── */
export function createVorhaben({ areaId, status = "Idee", title = "", name = "", fields = {} }) {
  return upsert("vorhaben", {
    id: uid(), areaId, status, title, name, start: "", end: "",
    goalIds: [], fields, erfolg: {}, abschluss: {}, created: Date.now(),
  });
}
export function setField(vid, key, html) {
  const v = byId("vorhaben", vid);
  if (!v || (v.fields || {})[key] === html) return;
  patch("vorhaben", vid, { fields: { ...(v.fields || {}), [key]: html } }, { silent: true });
}
export function setErfolg(vid, key, html) {
  const v = byId("vorhaben", vid);
  if (!v || (v.erfolg || {})[key] === html) return;
  patch("vorhaben", vid, { erfolg: { ...(v.erfolg || {}), [key]: html } }, { silent: true });
}
export function setAbschluss(vid, changes, opts) {
  const v = byId("vorhaben", vid);
  if (!v) return;
  patch("vorhaben", vid, { abschluss: { ...(v.abschluss || {}), ...changes } }, opts);
}
export function addTodo(vorhabenId, title, due, est) {
  title = (title || "").trim();
  if (!title || !vorhabenId) return null;
  return upsert("todos", { id: uid(), vorhabenId, title, due: due || "", est: est || DEFAULT_EST, done: false, created: Date.now() });
}
export function toggleTodo(id, done) {
  patch("todos", id, done ? { done, doneAt: Date.now(), progressMs: 0 } : { done, doneAt: null });
}

// dur = Countdown-Dauer in Sekunden (To-Do), null = offene Stoppuhr (Vorhaben).
// Läuft schon ein Timer, wird er angehalten: Zeit gebucht, Stand am To-Do gemerkt.
// Ein To-Do mit gemerktem Stand setzt seinen Countdown dort fort.
export function startTimer({ vorhabenId, todoId = null, dur = null }) {
  const r = store.state.running;
  if (r && r.start) stopTimer({ silent: true });
  let offsetMs = 0;
  if (dur && todoId) {
    const t = byId("todos", todoId);
    const p = (t && t.progressMs) || 0;
    if (p > 0 && p < dur * 1000 - 1000) offsetMs = p;
  }
  setSingleton("running", { start: Date.now(), vorhabenId, todoId, dur: dur || null, offsetMs });
}
// Restzeit eines Countdowns in ms (berücksichtigt gemerkten Stand und Pausen)
export const remainingMs = (r) => (r && r.dur ? r.dur * 1000 - (r.offsetMs || 0) - elapsedMs(r) : 0);
export function pauseTimer() {
  const r = store.state.running;
  if (!r || !r.start || r.pausedAt) return;
  setSingleton("running", { ...r, pausedAt: Date.now() });
}
export function resumeTimer() {
  const r = store.state.running;
  if (!r || !r.start || !r.pausedAt) return;
  setSingleton("running", { ...r, pausedMs: (r.pausedMs || 0) + (Date.now() - r.pausedAt), pausedAt: null });
}
// Die Eintrags-ID hängt am Startzeitpunkt: stoppen zwei Geräte denselben Lauf,
// entsteht trotzdem nur ein Eintrag.
function bookRun(r, end, min) {
  return upsert("timeEntries", {
    id: "run_" + r.start, vorhabenId: r.vorhabenId, todoId: r.todoId || null,
    start: r.start, end, min, date: dateKey(new Date(r.start)),
  }, { silent: true });
}
export function stopTimer(opts) {
  const r = store.state.running;
  if (!r || !r.start) return null;
  const ms = r.dur ? Math.min(elapsedMs(r), r.dur * 1000 - (r.offsetMs || 0)) : elapsedMs(r);
  const min = ms / 60000;
  const entry = min >= 0.25 ? bookRun(r, Date.now(), min) : null;
  // Stand am To-Do merken, damit der Countdown später dort weiterläuft
  if (r.dur && r.todoId && byId("todos", r.todoId)) {
    const p = (r.offsetMs || 0) + ms;
    patch("todos", r.todoId, { progressMs: p >= r.dur * 1000 - 1000 ? 0 : p }, { silent: true });
  }
  setSingleton("running", { start: null }, opts);
  return { min, entry };
}
// Countdown abgelaufen: volle Dauer buchen und Timer beenden
export function finishCountdown() {
  const r = store.state.running;
  const end = countdownEnd();
  if (!end || Date.now() < end) return null;
  const entry = bookRun(r, end, (r.dur * 1000 - (r.offsetMs || 0)) / 60000);
  if (r.todoId && byId("todos", r.todoId)) patch("todos", r.todoId, { progressMs: 0 }, { silent: true });
  setSingleton("running", { start: null });
  return { ...r, end, entry };
}
export const countdownEnd = () => {
  const r = store.state.running;
  return r && r.start && r.dur && !r.pausedAt ? r.start + (r.pausedMs || 0) + r.dur * 1000 - (r.offsetMs || 0) : null; // pausiert: kein Ende
};
export function addEntry({ vorhabenId, todoId = null, date, min, note = "" }) {
  if (!vorhabenId || !(min > 0)) return null;
  return upsert("timeEntries", { id: uid(), vorhabenId, todoId, date: date || todayKey(), min, note, manual: true });
}

export function ensureDefaultAreas() {
  if (store.state.areas.length) return;
  DEFAULT_AREAS.forEach((a, i) => upsert("areas", { ...a, order: i }, { silent: true }));
  emit("local");
}

/* ── Cloud-Sync über /api/system ── */
let backend = false, pushTimer = null, pushing = false, again = false;
let pinHandler = null;
export const onPinRequired = (fn) => { pinHandler = fn; };
export function setPin(p) {
  try { localStorage.setItem(PINKEY, p); } catch (e) { /* ignorieren */ }
  return pull();
}
function headers(extra) {
  const h = { ...(extra || {}) };
  try { const p = localStorage.getItem(PINKEY); if (p) h["x-pin"] = p; } catch (e) { /* ignorieren */ }
  return h;
}
function setSync(s) { if (store.sync !== s) { store.sync = s; emit("sync"); } }

async function handlePin(r) {
  if (r.status !== 401) return false;
  const j = await r.json().catch(() => ({}));
  if (!j.pinRequired) return false;
  setSync("pin");
  if (pinHandler) pinHandler();
  return true;
}

export async function pull() {
  if (pushing) return;
  try {
    const r = await fetch("/api/system", { cache: "no-store", headers: headers() });
    if (await handlePin(r)) return;
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j.configured) { backend = false; setSync("local_nodb"); return; }
    backend = true;
    const remote = S.merge(S.empty(), j.data || {});
    const merged = S.merge(store.state, remote);
    const isNew = !S.same(merged, store.state);
    store.state = merged;
    cache();
    if (!S.same(merged, remote)) schedulePush(50);
    else setSync("cloud");
    if (isNew) emit("remote");
  } catch (e) {
    setSync(backend ? "cloud_slow" : "local_unreachable");
  }
}

export function schedulePush(delay) {
  if (!backend) return;
  clearTimeout(pushTimer);
  setSync("saving");
  pushTimer = setTimeout(push, delay == null ? 700 : delay);
}
async function push() {
  pushTimer = null;
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    const r = await fetch("/api/system", {
      method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(store.state),
    });
    if (await handlePin(r)) return;
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.meldung || "HTTP " + r.status);
    const merged = S.merge(store.state, j.data);
    const isNew = !S.same(merged, store.state);
    store.state = merged;
    cache();
    setSync(pushTimer ? "saving" : "cloud");
    if (isNew) emit("remote");
  } catch (e) {
    setSync("cloud_slow");
    setTimeout(() => schedulePush(0), 5000);
  } finally {
    pushing = false;
    if (again) { again = false; schedulePush(0); }
  }
}

export async function initSync() {
  if (!/^https?:$/.test(location.protocol)) { setSync("local_file"); return; }
  setSync("connecting");
  await pull();
  setInterval(() => { if (document.visibilityState === "visible") pull(); }, 8000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
  window.addEventListener("online", () => pull());
}

/* ── Backup ── */
export function importState(obj) {
  store.state = S.merge(store.state, obj);
  cache();
  schedulePush(0);
  emit("local");
}
