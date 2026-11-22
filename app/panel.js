// Seitenpanel: eine Zelle groß lesen und bearbeiten (Mobil: Vollbild).

import { h, icon } from "./ui.js";
import { FIELDS } from "./model.js";
import { byId, areaName } from "./state.js";
import { ui, openPanel, closePanel, openVorhaben } from "./nav.js";
import { fieldEditor } from "./fields.js";
import { statusPill } from "./components.js";

const PANEL_FIELDS = [{ key: "titel", label: "Hypothese" }, ...FIELDS, { key: "abschluss", label: "Sauberer Abschluss" }];

export function panelView() {
  const p = ui.panel;
  if (!p) return null;
  const v = byId("vorhaben", p.vid);
  if (!v) { ui.panel = null; return null; }
  const cur = PANEL_FIELDS.find((f) => f.key === p.field) || PANEL_FIELDS[0];
  return h("aside", { class: "panel", role: "dialog", "aria-label": cur.label },
    h("div", { class: "panel-head" },
      h("div", { class: "panel-info" },
        h("div", { class: "muted small" }, areaName(v.areaId) + (v.gruppe ? " · " + v.gruppe : ""), " ", statusPill(v.status)),
        h("div", { class: "panel-title clamp2" }, v.title || "Ohne Titel")),
      h("button", { class: "icon-btn", "aria-label": "Panel schließen", onclick: closePanel }, icon("close"))),
    h("div", { class: "chips scroll" },
      PANEL_FIELDS.map((f) => h("button", { class: "chip" + (f.key === cur.key ? " on" : ""), onclick: () => openPanel(v.id, f.key) }, f.label))),
    h("div", { class: "panel-body" }, h("h3", { class: "panel-field" }, cur.label), fieldEditor(v, cur.key, { big: true })),
    h("div", { class: "panel-foot" },
      h("button", { class: "btn", onclick: () => { ui.panel = null; openVorhaben(v.id); } }, "Ganzes Vorhaben als Dokument öffnen →")));
}
