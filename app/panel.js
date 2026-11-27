// Seitenpanel: eine Zelle groß lesen und bearbeiten (Mobil: Vollbild).
// Mit ‹ › blättert man durch alle Felder des Vorhabens.

import { h, icon } from "./ui.js";
import { FIELDS } from "./model.js";
import { byId, areaName, vName } from "./state.js";
import { ui, openPanel, closePanel, openVorhaben } from "./nav.js";
import { fieldEditor } from "./fields.js";
import { statusPill } from "./components.js";

const PANEL_FIELDS = [{ key: "name", label: "Projektname" }, { key: "titel", label: "Hypothese" }, ...FIELDS];

// Aktives Feld in der Auswahl mittig sichtbar machen (nach dem Einhängen ins DOM aufrufen)
export function centerActiveChip(root) {
  const c = root.querySelector(".panel .chips"), a = c && c.querySelector('[data-active="1"]');
  if (a) c.scrollLeft = Math.max(0, a.offsetLeft - c.clientWidth / 2 + a.offsetWidth / 2);
}

export function panelView() {
  const p = ui.panel;
  if (!p) return null;
  const v = byId("vorhaben", p.vid);
  if (!v) { ui.panel = null; return null; }
  let idx = PANEL_FIELDS.findIndex((f) => f.key === p.field);
  if (idx < 0) idx = 0;
  const cur = PANEL_FIELDS[idx];
  const go = (i) => openPanel(v.id, PANEL_FIELDS[Math.max(0, Math.min(PANEL_FIELDS.length - 1, i))].key);

  const chips = h("div", { class: "chips scroll" },
    PANEL_FIELDS.map((f, i) => h("button", { class: "chip" + (i === idx ? " on" : ""), "data-active": i === idx ? "1" : null, onclick: () => go(i) }, f.label)));

  return h("aside", { class: "panel", role: "dialog", "aria-label": cur.label },
    h("div", { class: "panel-head" },
      h("div", { class: "panel-info" },
        h("div", { class: "muted small" }, areaName(v.areaId), " ", statusPill(v.status)),
        h("div", { class: "panel-title clamp2" }, vName(v))),
      h("button", { class: "icon-btn", "aria-label": "Panel schließen", onclick: closePanel }, icon("close"))),
    h("div", { class: "chipnav" },
      h("button", { class: "icon-btn ghost", title: "Vorheriges Feld", "aria-label": "Vorheriges Feld", disabled: idx === 0, onclick: () => go(idx - 1) }, icon("back")),
      chips,
      h("button", { class: "icon-btn ghost", title: "Nächstes Feld", "aria-label": "Nächstes Feld", disabled: idx === PANEL_FIELDS.length - 1, onclick: () => go(idx + 1) }, icon("next"))),
    h("div", { class: "panel-body" },
      h("div", { class: "panel-field-row" },
        h("h3", { class: "panel-field" }, cur.label),
        h("span", { class: "muted small" }, (idx + 1) + " / " + PANEL_FIELDS.length)),
      fieldEditor(v, cur.key, { big: true })),
    h("div", { class: "panel-foot" },
      h("button", { class: "btn small", disabled: idx === 0, onclick: () => go(idx - 1) }, icon("back"), "Zurück"),
      h("button", { class: "btn small", onclick: () => { ui.panel = null; openVorhaben(v.id); } }, "Als Dokument öffnen"),
      h("button", { class: "btn small primary", disabled: idx === PANEL_FIELDS.length - 1, onclick: () => go(idx + 1) }, "Weiter", icon("next"))));
}
