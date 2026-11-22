// Strategie: 1-Jahres-Ziele und 10-Jahres-Vision. Vorhaben verlinken darauf.

import { h, icon, confirmDialog } from "../ui.js";
import { live, upsert, patch, removeItem, uid, isActive } from "../state.js";
import { vorhabenLink } from "../components.js";
import { autoText } from "../editor.js";

function column(type, title, help) {
  const goals = live("goals").filter((g) => g.type === type).sort((a, b) => (a.created || 0) - (b.created || 0));
  const vs = live("vorhaben");
  const inp = h("input", { class: "txt", placeholder: type === "10j" ? "Vision hinzufügen …" : "Ziel hinzufügen …", "aria-label": title });
  const add = () => { const t = inp.value.trim(); if (!t) return; upsert("goals", { id: uid(), type, text: t, created: Date.now() }); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  return h("section", { class: "goal-col card-like" },
    h("h3", null, title), h("p", { class: "muted small" }, help),
    goals.map((g) => {
      const linked = vs.filter((v) => (v.goalIds || []).includes(g.id));
      return h("div", { class: "goal" },
        h("div", { class: "goal-row" },
          autoText({ value: g.text, cls: "goal-text", onChange: (val) => patch("goals", g.id, { text: val }, { silent: true }) }),
          h("button", { class: "icon-btn ghost tiny", title: "Ziel löschen", "aria-label": "Ziel löschen", onclick: async () => {
            if (await confirmDialog("Ziel löschen? Verknüpfungen in Vorhaben werden entfernt.", { ok: "Löschen", danger: true })) {
              vs.filter((v) => (v.goalIds || []).includes(g.id)).forEach((v) => patch("vorhaben", v.id, { goalIds: v.goalIds.filter((x) => x !== g.id) }, { silent: true }));
              removeItem("goals", g.id);
            }
          } }, icon("trash"))),
        h("div", { class: "goal-links" }, linked.length ? linked.map((v) => vorhabenLink(v)) : h("span", { class: "muted small" }, "Noch kein Vorhaben verknüpft.")));
    }),
    h("div", { class: "goal-add" }, inp, h("button", { class: "btn small", onclick: add }, icon("plus"), "Hinzufügen")));
}

export function strategyView() {
  const unlinked = live("vorhaben").filter((v) => isActive(v) && !(v.goalIds || []).length);
  return h("div", { class: "view-strategy" },
    h("div", { class: "goal-cols" },
      column("1j", "1-Jahres-Ziele", "Worauf zahlen deine Vorhaben in den nächsten 12 Monaten ein?"),
      column("10j", "10-Jahres-Vision", "Das große Bild – wo willst du in zehn Jahren stehen?")),
    unlinked.length ? h("section", { class: "card-like" },
      h("h3", null, "Aktive Vorhaben ohne Ziel-Verknüpfung"),
      h("p", { class: "muted small" }, "Verknüpfe sie im Vorhaben unter „Verknüpfte Ziele“ – oder frag dich, ob sie gerade wirklich dran sind."),
      h("div", { class: "goal-links" }, unlinked.map((v) => vorhabenLink(v)))) : null);
}
