// Einstellungen: Benachrichtigungen, Leitfragen, Bereiche, Zeittracker-Import, Backup, PIN.

import { h, icon, modal, toast, confirmDialog } from "./ui.js";
import { todayKey, fmtH } from "./model.js";
import { store, live, areas, settings, setSingleton, upsert, patch, removeItem, uid, importState, setPin, notify, assignableProjects, vName } from "./state.js";
import { HINT_FIELDS, hintsFor, defaultHints } from "./fields.js";
import { notifyState, requestNotify, notify as sysNotify, ensureAudio, unlockAudio, ringNow, cancelAlarm } from "./alarm.js";
import { downloadCsv } from "./export.js";

/* ── Daten aus dem alten Zeittracker (über /api/data weiterhin lesbar) ── */
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
  const hit = vs.find((v) => (v.name || "").toLowerCase().includes(n) || (v.title || "").toLowerCase().includes(n));
  return hit ? hit.id : "";
}

export async function openTrackerImport() {
  const body = h("div", { class: "import" }, h("p", { class: "muted" }, "Lade Daten aus dem Zeittracker …"));
  const close = modal({ title: "Zeittracker-Daten übernehmen", body, wide: true });
  const data = await trackerData();
  const vs = assignableProjects();
  if (!data.entries.length) {
    body.replaceChildren(h("p", null, "Im Zeittracker sind (in diesem Browser und in der Cloud) keine Einträge gefunden worden."));
    return;
  }
  const rows = data.projects.map((p) => {
    const entries = data.entries.filter((e) => e.projectId === p.id);
    const done = entries.length ? live("timeEntries").find((e) => e.id === "trk_" + entries[0].id) : null;
    const sel = h("select", { class: "sel small", value: done ? done.vorhabenId : guess(p.name, vs), "aria-label": "Vorhaben für " + p.name },
      h("option", { value: "" }, "– nicht übernehmen –"),
      vs.map((v) => h("option", { value: v.id }, vName(v))));
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

/* ── Benachrichtigungen & Ton ── */
function notifyBlock(redraw) {
  const st = notifyState();
  const label = { granted: "erlaubt ✓", denied: "blockiert", default: "noch nicht gefragt", unsupported: "von diesem Browser nicht unterstützt" }[st] || st;
  return h("div", null,
    h("p", { class: "small" }, "Systembenachrichtigung bei Ablauf eines Timers: ", h("strong", null, label)),
    st === "denied" ? h("p", { class: "muted small" }, "Du hast Benachrichtigungen für diese Seite blockiert. Erlauben kannst du sie in den Website-Einstellungen des Browsers (Schloss-Symbol neben der Adresse).") : null,
    st === "unsupported" ? h("p", { class: "muted small" }, "Auf dem iPhone gehen Benachrichtigungen nur, wenn die App über „Teilen → Zum Home-Bildschirm“ installiert und von dort geöffnet wird.") : null,
    h("div", { class: "row-wrap" },
      st === "default" ? h("button", { class: "btn primary", onclick: async () => { await requestNotify(); redraw(); } }, "Benachrichtigungen erlauben") : null,
      st === "granted" ? h("button", { class: "btn", onclick: async () => {
        const ok = await sysNotify("⏰ Test", "So sieht die Benachrichtigung aus, wenn ein Timer abläuft.");
        if (!ok) toast("Benachrichtigung konnte nicht angezeigt werden");
      } }, "Test-Benachrichtigung") : null,
      h("button", { class: "btn", onclick: () => { ensureAudio(); unlockAudio(); ringNow(); setTimeout(cancelAlarm, 3000); } }, "Signalton testen (3 s)")),
    h("p", { class: "muted small" }, "Tipp: Am Handy muss die App geöffnet bleiben (Bildschirm an), damit der Ton klingelt – bei gesperrtem Bildschirm unterdrücken iOS und Android Töne von Webseiten."));
}

/* ── Einstellungen-Dialog ── */
export function openSettings() {
  const body = h("div", { class: "settings" });
  let close;
  const draw = () => {
    const s = settings();
    const newArea = h("input", { class: "txt", placeholder: "Neuer Bereich …", "aria-label": "Neuer Bereich" });
    const addArea = () => {
      const name = newArea.value.trim();
      if (!name) return;
      upsert("areas", { id: uid(), name, order: areas().length });
      draw();
    };
    newArea.addEventListener("keydown", (e) => { if (e.key === "Enter") addArea(); });

    body.replaceChildren(
      h("section", null, h("h4", null, "Benachrichtigungen & Ton"),
        notifyBlock(draw)),
      h("section", null, h("h4", null, "Link zu deinen Zielen"),
        h("p", { class: "muted small" }, "Erscheint bei den Leitfragen zum „Strategie-Bezug“ (z. B. dein Google-Drive-Ordner). Wird in deiner Datenbank gespeichert, nicht im Code."),
        h("input", { class: "txt", type: "url", value: s.strategieLink || "", placeholder: "https://…",
          onchange: (e) => setSingleton("settings", { ...settings(), strategieLink: e.target.value.trim() }) })),
      h("section", null, h("h4", null, "Leitfragen"),
        h("p", { class: "muted small" }, "Eine Frage pro Zeile. Die Leitfragen erscheinen bei jedem Vorhaben ausklappbar über dem Feld."),
        HINT_FIELDS.map((f) => {
          const own = Array.isArray((s.hints || {})[f.key]) && s.hints[f.key].length;
          const ta = h("textarea", { class: "txt hints-edit", rows: Math.max(2, hintsFor(f.key).length + 1), value: hintsFor(f.key).join("\n"), "aria-label": "Leitfragen " + f.label });
          ta.addEventListener("change", () => {
            const lines = ta.value.split("\n").map((x) => x.trim()).filter(Boolean);
            const hints = { ...(settings().hints || {}) };
            if (!lines.length || JSON.stringify(lines) === JSON.stringify(defaultHints(f.key))) delete hints[f.key];
            else hints[f.key] = lines;
            setSingleton("settings", { ...settings(), hints });
            draw();
          });
          return h("div", { class: "hint-edit" },
            h("div", { class: "hint-edit-head" }, h("strong", null, f.label), own ? h("span", { class: "tag" }, "angepasst") : null,
              own ? h("button", { class: "link-btn small", onclick: () => {
                const hints = { ...(settings().hints || {}) }; delete hints[f.key];
                setSingleton("settings", { ...settings(), hints }); draw();
              } }, "Standard wiederherstellen") : null),
            ta);
        })),
      h("section", null, h("h4", null, "Bereiche"),
        areas().map((a) => {
          const n = live("vorhaben").filter((v) => !v.system && v.areaId === a.id).length;
          return h("div", { class: "area-edit" },
            h("input", { class: "txt", value: a.name, "aria-label": "Bereichsname", onchange: (e) => { const t = e.target.value.trim(); if (t) patch("areas", a.id, { name: t }); } }),
            h("span", { class: "muted small" }, n + " Vorhaben"),
            h("button", { class: "icon-btn ghost tiny", title: n ? "Bereich enthält Vorhaben" : "Bereich löschen", "aria-label": "Bereich löschen", disabled: n > 0,
              onclick: async () => { if (await confirmDialog("Bereich „" + a.name + "“ löschen?", { ok: "Löschen", danger: true })) { removeItem("areas", a.id); draw(); } } }, icon("trash")));
        }),
        h("div", { class: "area-edit" }, newArea, h("button", { class: "btn small", onclick: addArea }, icon("plus"), "Hinzufügen"))),
      h("section", null, h("h4", null, "Zeiten"),
        h("div", { class: "row-wrap" },
          h("button", { class: "btn", onclick: () => downloadCsv() }, "Alle Zeiten als CSV (Excel)"),
          h("button", { class: "btn", onclick: () => { close(); openTrackerImport(); } }, "Daten aus altem Zeittracker zuordnen …")),
        h("p", { class: "muted small" }, "Der alte Zeittracker ist abgeschaltet; seine Einträge sind übernommen. Über „zuordnen“ kannst du sie einem anderen Vorhaben zuweisen – die Einträge werden dabei verschoben, nicht verdoppelt.")),
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
