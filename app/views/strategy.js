// Strategie: 1-Jahres-Ziele und 10-Jahres-Vision als eigene kleine Listen.

import { h, icon, confirmDialog } from "../ui.js";
import { live, upsert, patch, removeItem, uid } from "../state.js";
import { autoText } from "../editor.js";

function column(type, title, help) {
  const goals = live("goals").filter((g) => g.type === type).sort((a, b) => (a.created || 0) - (b.created || 0));
  const inp = h("input", { class: "txt", placeholder: type === "10j" ? "Vision hinzufügen …" : "Ziel hinzufügen …", "aria-label": title });
  const add = () => { const t = inp.value.trim(); if (!t) return; upsert("goals", { id: uid(), type, text: t, created: Date.now() }); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  return h("section", { class: "goal-col card-like" },
    h("h3", null, title), h("p", { class: "muted small" }, help),
    goals.length ? null : h("p", { class: "muted small" }, "Noch nichts eingetragen."),
    goals.map((g) => h("div", { class: "goal" },
      h("div", { class: "goal-row" },
        autoText({ value: g.text, cls: "goal-text", onChange: (val) => patch("goals", g.id, { text: val }, { silent: true }) }),
        h("button", { class: "icon-btn ghost tiny", title: "Ziel löschen", "aria-label": "Ziel löschen", onclick: async () => {
          if (await confirmDialog("Ziel „" + (g.text || "").slice(0, 80) + "“ löschen?", { ok: "Löschen", danger: true })) removeItem("goals", g.id);
        } }, icon("trash"))))),
    h("div", { class: "goal-add" }, inp, h("button", { class: "btn small", onclick: add }, icon("plus"), "Hinzufügen")));
}

export function strategyView() {
  return h("div", { class: "view-strategy" },
    h("div", { class: "goal-cols" },
      column("1j", "1-Jahres-Ziele", "Worauf sollen deine Vorhaben in den nächsten 12 Monaten einzahlen?"),
      column("10j", "10-Jahres-Vision", "Das große Bild – wo willst du in zehn Jahren stehen?")));
}
