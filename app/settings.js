// Einstellungen: WIP-Grenze, Bereiche, Zeittracker-Import, Backup, PIN.

import { h, icon, modal, toast, confirmDialog } from "./ui.js";
import { todayKey, fmtH } from "./model.js";
import { store, live, areas, settings, setSingleton, upsert, patch, removeItem, uid, importState, setPin, notify } from "./state.js";

/* ── Daten aus dem bisherigen Zeittracker (/tracker) ── */
async function trackerData() {
  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  let local = { projects: [], entries: [] };
  try {
    const raw = localStorage.getItem("zeittracker_v1");
    if (raw) { const d = JSON.parse(raw); local = { projects: d.projects || [], entries: d.entries || [] }; }
  } catch (e) { /* ignorieren */ }
  let cloud = { projects: [], entries: [] };
  try {
    const r = await fetch("/api/data", { cache: "no-store" });
    const j = await r.json();
    if (j.configured && j.data) cloud = j.data;
  } catch (e) { /* offline */ }
  return {
    projects: Object.values({ ...byId(local.projects), ...byId(cloud.projects) }),
    entries: Object.values({ ...byId(local.entries), ...byId(cloud.entries) }),
  };
}

function guess(name, vs) {
  const n = (name || "").toLowerCase();
  const hit = vs.find((v) => (v.title || "").toLowerCase().includes(n) || (v.gruppe || "").toLowerCase() === n);
  return hit ? hit.id : "";
}

export async function openTrackerImport() {
  const body = h("div", { class: "import" }, h("p", { class: "muted" }, "Lade Daten aus dem Zeittracker …"));
  const close = modal({ title: "Zeittracker-Daten übernehmen", body, wide: true });
  const data = await trackerData();
  const vs = live("vorhaben").filter((v) => v.status !== "Idee");
  if (!data.entries.length) {
    body.replaceChildren(h("p", null, "Im Zeittracker sind (in diesem Browser und in der Cloud) keine Einträge gefunden worden."));
    return;
  }
  const rows = data.projects.map((p) => {
    const entries = data.entries.filter((e) => e.projectId === p.id);
    const sel = h("select", { class: "sel small", value: guess(p.name, vs), "aria-label": "Vorhaben für " + p.name },
      h("option", { value: "" }, "– nicht übernehmen –"),
      vs.map((v) => h("option", { value: v.id }, (v.title || "Ohne Titel").slice(0, 80))));
    return { p, entries, sel };
  }).filter((r) => r.entries.length);
  body.replaceChildren(
    h("p", null, "Ordne jedes Tracker-Projekt einem Vorhaben zu. Die Zeiten werden dort als Zeiteinträge übernommen. Mehrfaches Importieren erzeugt keine Dubletten."),
    h("div", { class: "import-rows" }, rows.map((r) => h("div", { class: "import-row" },
      h("span", { class: "dot", style: { background: r.p.color || "#888" } }),
      h("span", { class: "import-name" }, r.p.name),
      h("span", { class: "muted small" }, r.entries.length + " Einträge · " + fmtH(r.entries.reduce((s, e) => s + (e.min || 0), 0))),
      r.sel))),
    h("div", { class: "modal-foot inline" },
      h("button", { class: "btn primary", onclick: () => {
        let n = 0;
        rows.forEach((r) => {
          if (!r.sel.value) return;
          r.entries.forEach((e) => {
            upsert("timeEntries", { id: "trk_" + e.id, vorhabenId: r.sel.value, todoId: null, date: e.date || todayKey(), min: e.min || 0, note: e.note || "", source: "tracker" }, { silent: true });
            n++;
          });
        });
        notify();
        close();
        toast(n + " Zeiteinträge übernommen");
      } }, "Übernehmen")));
}

/* ── Einstellungen-Dialog ── */
export function openSettings() {
  const body = h("div", { class: "settings" });
  let close;
  const draw = () => {
    const s = settings();
    const wip = h("input", { type: "number", min: "1", max: "20", class: "num-in", value: s.wipLimit || 3, "aria-label": "WIP-Grenze",
      onchange: (e) => { const n = parseInt(e.target.value, 10); if (n > 0) setSingleton("settings", { ...settings(), wipLimit: n }); } });
    const newArea = h("input", { class: "txt", placeholder: "Neuer Bereich …", "aria-label": "Neuer Bereich" });
    const addArea = () => {
      const name = newArea.value.trim();
      if (!name) return;
      upsert("areas", { id: uid(), name, order: areas().length });
      draw();
    };
    newArea.addEventListener("keydown", (e) => { if (e.key === "Enter") addArea(); });

    body.replaceChildren(
      h("section", null, h("h4", null, "Fokus"),
        h("label", { class: "inline-field" }, "Höchstens", wip, "Vorhaben gleichzeitig auf „Läuft“ (WIP-Grenze)")),
      h("section", null, h("h4", null, "Persönliche Texte"),
        h("p", { class: "muted small" }, "Werden in deiner Datenbank gespeichert (nicht im Code) und im Abschluss bzw. beim Strategie-Bezug angezeigt."),
        h("label", { class: "lbl" }, "Resistance oder Personal End Point? – deine Beschreibung"),
        h("textarea", { class: "txt", rows: 5, value: s.resistanceText || "", placeholder: "Wie fühlt sich Resistance bei dir an – und wie dein Personal End Point?",
          onchange: (e) => setSingleton("settings", { ...settings(), resistanceText: e.target.value.trim() }) }),
        h("label", { class: "lbl" }, "Link zu deinen Zielen (z. B. Google-Drive-Ordner)"),
        h("input", { class: "txt", type: "url", value: s.strategieLink || "", placeholder: "https://…",
          onchange: (e) => setSingleton("settings", { ...settings(), strategieLink: e.target.value.trim() }) })),
      h("section", null, h("h4", null, "Bereiche"),
        areas().map((a) => {
          const n = live("vorhaben").filter((v) => v.areaId === a.id).length;
          return h("div", { class: "area-edit" },
            h("input", { class: "txt", value: a.name, "aria-label": "Bereichsname", onchange: (e) => { const t = e.target.value.trim(); if (t) patch("areas", a.id, { name: t }); } }),
            h("span", { class: "muted small" }, n + " Vorhaben"),
            h("button", { class: "icon-btn ghost tiny", title: n ? "Bereich enthält Vorhaben" : "Bereich löschen", "aria-label": "Bereich löschen", disabled: n > 0,
              onclick: async () => { if (await confirmDialog("Bereich „" + a.name + "“ löschen?", { ok: "Löschen", danger: true })) { removeItem("areas", a.id); draw(); } } }, icon("trash")));
        }),
        h("div", { class: "area-edit" }, newArea, h("button", { class: "btn small", onclick: addArea }, icon("plus"), "Hinzufügen"))),
      h("section", null, h("h4", null, "Zeittracker"),
        h("p", { class: "muted small" }, "Der bisherige Zeittracker läuft weiter unter ", h("a", { href: "/tracker" }, "/tracker"), ". Seine Einträge kannst du hier einem Vorhaben zuordnen und übernehmen."),
        h("button", { class: "btn", onclick: () => { close(); openTrackerImport(); } }, "Zeittracker-Daten übernehmen …")),
      h("section", null, h("h4", null, "Backup"),
        h("div", { class: "row-wrap" },
          h("button", { class: "btn", onclick: () => {
            const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
            const a = h("a", { href: URL.createObjectURL(blob), download: "projektsystem_" + todayKey() + ".json" });
            document.body.append(a); a.click(); a.remove();
          } }, "Backup herunterladen (JSON)"),
          h("label", { class: "btn" }, "Backup einspielen …",
            h("input", { type: "file", accept: "application/json,.json", style: { display: "none" }, onchange: (e) => {
              const f = e.target.files[0];
              if (!f) return;
              const rd = new FileReader();
              rd.onload = () => {
                try { importState(JSON.parse(rd.result)); toast("Backup eingespielt (zusammengeführt)"); draw(); }
                catch (err) { toast("Datei konnte nicht gelesen werden"); }
              };
              rd.readAsText(f);
            } }))),
        h("p", { class: "muted small" }, "Ein eingespieltes Backup wird mit dem aktuellen Stand zusammengeführt – pro Eintrag gewinnt die neuere Änderung.")),
      h("section", null, h("h4", null, "Zugriffsschutz (optional)"),
        h("p", { class: "muted small" }, "Ohne Login kann jeder mit der Adresse die Daten abrufen. Setzt du im Vercel-Projekt die Environment-Variable PROJEKTSYSTEM_PIN, fragt die App einmal pro Gerät nach diesem PIN.")));
  };
  draw();
  close = modal({ title: "Einstellungen", body, wide: true });
}

let pinOpen = false;
export function pinPrompt() {
  if (pinOpen) return;
  pinOpen = true;
  const inp = h("input", { type: "password", class: "txt", placeholder: "PIN", "aria-label": "PIN", autofocus: true, inputmode: "numeric" });
  const save = (close) => { const p = inp.value.trim(); if (!p) return; setPin(p); close(); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") save(closeFn); });
  const closeFn = modal({
    title: "PIN eingeben",
    body: h("div", null, h("p", null, "Dein Projektsystem ist mit einem PIN geschützt. Er wird auf diesem Gerät gespeichert."), inp),
    actions: [{ label: "Entsperren", primary: true, onClick: save }],
    onClose: () => { pinOpen = false; },
  });
}
