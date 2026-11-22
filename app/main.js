// Einstieg: App-Rahmen, Routing, Rendern, laufender Timer, Fristwächter.

import { h, icon, toast, confirmDialog, isMobile } from "./ui.js";
import { STATUS_LABEL, todayKey, fmtClock, fmtShort } from "./model.js";
import {
  store, subscribe, loadCache, initSync, ensureDefaultAreas, byId, live, areas, patch, settings,
  overdueVorhaben, onPinRequired,
} from "./state.js";
import { ui, setRender, go, persistUi } from "./nav.js";
import { setStatusChanger, timerButton } from "./components.js";
import { setWizardOpener, outlineFields } from "./fields.js";
import { openWizard } from "./wizard.js";
import { openCapture } from "./capture.js";
import { openSettings, pinPrompt } from "./settings.js";
import { panelView } from "./panel.js";
import { tableView } from "./views/table.js";
import { boardView } from "./views/board.js";
import { docView } from "./views/doc.js";
import { todayView } from "./views/today.js";
import { timelineView } from "./views/timeline.js";
import { reviewView } from "./views/review.js";
import { lessonsView } from "./views/lessons.js";
import { strategyView } from "./views/strategy.js";

const NAV = [
  { r: "heute", label: "Heute", ic: "today" },
  { r: "tabelle", label: "Tabelle", ic: "table" },
  { r: "board", label: "Board", ic: "board" },
  { r: "zeitleiste", label: "Zeitleiste", ic: "timeline" },
  { r: "review", label: "Wochenreview", ic: "review" },
  { r: "lessons", label: "Lessons", ic: "lessons" },
  { r: "strategie", label: "Strategie", ic: "strategy" },
];
const MOBILE_TABS = ["heute", "board", "tabelle", "zeitleiste"];
const VIEWS = {
  heute: todayView, tabelle: tableView, board: boardView, zeitleiste: timelineView,
  review: reviewView, lessons: lessonsView, strategie: strategyView, v: () => docView(ui.param),
};
const SYNC = {
  checking: ["", "prüfe Speicher …"], connecting: ["", "verbinde …"], saving: ["busy", "speichert …"],
  cloud: ["ok", "synchron"], cloud_slow: ["warn", "Cloud langsam – lokal gesichert"],
  local_nodb: ["warn", "nur lokal – keine Datenbank"], local_unreachable: ["warn", "offline – lokal gesichert"],
  local_file: ["", "nur lokal"], pin: ["warn", "PIN nötig"],
};

/* ── Status-Wechsel mit Begleitlogik ── */
setStatusChanger(async (vid, status) => {
  const v = byId("vorhaben", vid);
  if (!v || v.status === status) return;
  const changes = { status };
  const promoted = v.status === "Idee" && status !== "Idee";
  if (promoted) {
    changes.fields = outlineFields(v.fields);
    if (!v.start && (status === "Vorbereitung" || status === "Läuft")) changes.start = todayKey();
  }
  patch("vorhaben", vid, changes);
  if (promoted) toast("Befördert – die Leitfragen sind als Gliederung angelegt");
  if (status === "Läuft") {
    const n = live("vorhaben").filter((x) => x.status === "Läuft").length, wip = settings().wipLimit || 3;
    if (n > wip) toast("Achtung: " + n + " Vorhaben laufen parallel (WIP-Grenze " + wip + ")");
  }
  if (status === "Abschluss-Review" && !(v.abschluss || {}).done) {
    if (await confirmDialog("„" + (v.title || "Vorhaben").slice(0, 90) + "“ ist im Abschluss-Review. Abschluss-Assistenten jetzt starten?", { ok: "Assistent starten" })) openWizard(vid);
  }
});
setWizardOpener(openWizard);
onPinRequired(pinPrompt);

/* ── Rendern ── */
const root = document.getElementById("app");
let pendingRender = false;
const isEditing = () => {
  const a = document.activeElement;
  return !!(a && a.closest && a.closest("#app [data-live-edit]"));
};
function requestRender() {
  if (isEditing()) { pendingRender = true; return; }
  render();
}
document.addEventListener("focusout", () => setTimeout(() => {
  if (pendingRender && !isEditing()) { pendingRender = false; render(); }
}, 0));

function parseRoute() {
  const m = location.hash.match(/^#\/([^/]+)(?:\/(.+))?/);
  if (!m || !VIEWS[m[1]]) { ui.route = isMobile() ? "heute" : "tabelle"; ui.param = null; return; }
  ui.route = m[1];
  ui.param = m[2] ? decodeURIComponent(m[2]) : null;
}

function syncBadge(cls) {
  const [k, label] = SYNC[store.sync] || ["", store.sync];
  return h("span", { class: "sync-badge " + k + (cls ? " " + cls : ""), title: "Speicherstatus" }, h("span", { class: "sync-dot" }), h("span", { class: "sync-label" }, label));
}
function updateSyncBadges() {
  document.querySelectorAll(".sync-badge").forEach((el) => {
    const mini = el.classList.contains("mini");
    el.replaceWith(syncBadge(mini ? "mini" : ""));
  });
}

function areaFilter(cls) {
  return h("select", { class: "sel area-sel " + (cls || ""), value: ui.area, "aria-label": "Bereich filtern",
    onchange: (e) => { ui.area = e.target.value; persistUi(); render(); } },
    h("option", { value: "all" }, "Alle Bereiche"),
    areas().map((a) => h("option", { value: a.id }, a.name)));
}

function runbar() {
  const r = store.state.running;
  if (!r || !r.start) return null;
  const v = byId("vorhaben", r.vorhabenId), t = r.todoId ? byId("todos", r.todoId) : null;
  return h("div", { class: "runbar" },
    h("span", { class: "pulse" }),
    h("div", { class: "run-info" },
      h("div", { class: "run-what clamp1" }, t ? t.title : "Am Vorhaben"),
      v ? h("a", { class: "run-v clamp1", href: "#/v/" + v.id }, v.title) : null),
    h("span", { class: "run-time num", id: "runTime" }, fmtClock((Date.now() - r.start) / 1000)),
    timerButton({ todoId: r.todoId, vorhabenId: r.vorhabenId, label: "Stopp" }));
}

function banner() {
  if (!["heute", "board", "tabelle", "zeitleiste"].includes(ui.route)) return null;
  const over = overdueVorhaben().filter((v) => ui.area === "all" || v.areaId === ui.area);
  if (!over.length) return null;
  return h("div", { class: "banner" }, icon("warn"),
    h("span", null, h("strong", null, "Fristwächter: "), over.length === 1 ? "1 Vorhaben ist über seiner Laufzeit – " : over.length + " Vorhaben sind über ihrer Laufzeit – ",
      over.map((v, i) => [i ? ", " : "", h("a", { href: "#/v/" + v.id }, (v.title || "Ohne Titel").slice(0, 48) + ((v.title || "").length > 48 ? "…" : "")), " (bis " + fmtShort(v.end) + ")"])),
    h("span", { class: "muted small" }, "Verlängern, abschließen oder bewusst beenden?"));
}

function moreSheet() {
  const back = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === back) back.remove(); } });
  const pick = (fn) => () => { back.remove(); fn(); };
  back.append(h("div", { class: "sheet" },
    NAV.filter((n) => !MOBILE_TABS.includes(n.r)).map((n) => h("button", { class: "sheet-item", onclick: pick(() => go("#/" + n.r)) }, icon(n.ic), n.label)),
    h("a", { class: "sheet-item", href: "/tracker" }, icon("tracker"), "Alter Zeittracker"),
    h("button", { class: "sheet-item", onclick: pick(openSettings) }, icon("settings"), "Einstellungen"),
    h("button", { class: "sheet-item muted", onclick: () => back.remove() }, "Schließen")));
  document.body.append(back);
}

function viewTitle() {
  if (ui.route === "v") return "Vorhaben";
  return (NAV.find((n) => n.r === ui.route) || {}).label || "";
}

function shell() {
  const navLinks = NAV.map((n) => h("a", { class: "nav-item" + (ui.route === n.r ? " on" : ""), href: "#/" + n.r }, icon(n.ic), h("span", null, n.label)));
  const side = h("aside", { class: "side" },
    h("div", { class: "brand" }, h("span", { class: "brand-mark" }), "Projektsystem"),
    h("nav", { class: "nav", "aria-label": "Ansichten" }, navLinks),
    h("div", { class: "side-sec" }, h("div", { class: "side-lbl" }, "Bereich"), areaFilter()),
    h("button", { class: "btn idea-btn", onclick: openCapture }, icon("idea"), "Idee parken"),
    h("div", { class: "side-foot" },
      h("a", { class: "nav-item small", href: "/tracker" }, icon("tracker"), h("span", null, "Alter Zeittracker")),
      h("button", { class: "nav-item small", onclick: openSettings }, icon("settings"), h("span", null, "Einstellungen")),
      syncBadge()));

  const top = h("header", { class: "topbar" },
    ui.route === "v" ? null : h("h1", { class: "view-title" }, viewTitle()),
    h("div", { class: "spacer" }),
    ui.route === "v" ? null : areaFilter("top"),
    syncBadge("mini"));

  const viewFn = VIEWS[ui.route] || VIEWS.tabelle;
  const main = h("main", { class: "main route-" + ui.route, id: "view" }, viewFn());

  const tabs = h("nav", { class: "tabbar", "aria-label": "Ansichten" },
    MOBILE_TABS.map((r) => { const n = NAV.find((x) => x.r === r); return h("a", { class: "tab" + (ui.route === r ? " on" : ""), href: "#/" + r }, icon(n.ic), h("span", null, n.label)); }),
    h("button", { class: "tab", onclick: moreSheet }, icon("more"), h("span", null, "Mehr")));

  const panel = panelView();
  return h("div", { class: "shell" + (panel ? " has-panel" : "") },
    side,
    h("div", { class: "content" }, top, runbar(), banner(), main),
    tabs,
    h("button", { class: "fab", "aria-label": "Idee parken", title: "Idee parken", onclick: openCapture }, icon("idea")),
    panel);
}

function render() {
  pendingRender = false;
  const keep = {};
  ["tablewrap", "board", "timeline"].forEach((c) => { const el = root.querySelector("." + c); if (el) keep[c] = [el.scrollLeft, el.scrollTop]; });
  const panelBody = root.querySelector(".panel-body");
  const panelScroll = panelBody ? panelBody.scrollTop : 0;
  const y = window.scrollY;
  root.replaceChildren(shell());
  Object.entries(keep).forEach(([c, [l, t]]) => { const el = root.querySelector("." + c); if (el) { el.scrollLeft = l; el.scrollTop = t; } });
  const pb = root.querySelector(".panel-body");
  if (pb) pb.scrollTop = panelScroll;
  window.scrollTo(0, y);
  document.title = (ui.route === "v" && byId("vorhaben", ui.param) ? (byId("vorhaben", ui.param).title || "Vorhaben").slice(0, 40) + " · " : viewTitle() ? viewTitle() + " · " : "") + "Projektsystem";
  if (ui.focusAfter) {
    const el = root.querySelector('[data-focus-key="' + ui.focusAfter + '"]');
    ui.focusAfter = null;
    if (el) el.focus();
  }
}
setRender(render);

subscribe((reason) => {
  if (reason === "sync") { updateSyncBadges(); return; }
  requestRender();
});

window.addEventListener("hashchange", () => {
  parseRoute();
  ui.panel = null;
  pendingRender = false;
  render();
  window.scrollTo(0, 0);
});

// Uhr für laufenden Timer
setInterval(() => {
  const r = store.state.running;
  if (!r || !r.start) return;
  const txt = fmtClock((Date.now() - r.start) / 1000);
  ["runTime", "focusTime"].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = txt; });
}, 1000);

// Start
loadCache();
parseRoute();
render();
initSync().then(() => { ensureDefaultAreas(); });

// Tastenkürzel: "i" = Idee parken (außerhalb von Eingabefeldern)
document.addEventListener("keydown", (e) => {
  if (e.key !== "i" || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  if (document.querySelector(".modal-back")) return;
  e.preventDefault();
  openCapture();
});

export { STATUS_LABEL };
