// „Zeit nachtragen“ – von überall erreichbar (übernommen aus dem alten Zeittracker).

import { h, modal, toast } from "./ui.js";
import { todayKey, fmtHM } from "./model.js";
import { live, isActive, addEntry, sortTodos } from "./state.js";
import { ui } from "./nav.js";

export function openTimeEntry(preVid) {
  const vs = live("vorhaben").filter((v) => v.status !== "Idee")
    .sort((a, b) => (isActive(b) ? 1 : 0) - (isActive(a) ? 1 : 0) || (a.title || "").localeCompare(b.title || ""));
  if (!vs.length) { toast("Lege zuerst ein Vorhaben an."); return; }
  const start = preVid && vs.some((v) => v.id === preVid) ? preVid : (ui.lastVorhaben && vs.some((v) => v.id === ui.lastVorhaben) ? ui.lastVorhaben : vs[0].id);

  const vSel = h("select", { class: "sel", value: start, "aria-label": "Vorhaben" },
    vs.map((v) => h("option", { value: v.id }, (v.title || "Ohne Titel").slice(0, 90))));
  const tSel = h("select", { class: "sel", "aria-label": "To-Do" });
  const fillTodos = () => {
    tSel.replaceChildren(h("option", { value: "" }, "– ohne To-Do –"),
      sortTodos(live("todos").filter((t) => t.vorhabenId === vSel.value)).map((t) => h("option", { value: t.id }, (t.done ? "✓ " : "") + t.title)));
  };
  vSel.addEventListener("change", fillTodos);
  fillTodos();
  const date = h("input", { type: "date", class: "date-in", value: todayKey(), "aria-label": "Datum" });
  const hh = h("input", { type: "number", class: "num-in", min: "0", max: "24", value: "0", "aria-label": "Stunden", inputmode: "numeric" });
  const mm = h("input", { type: "number", class: "num-in", min: "0", max: "59", value: "30", "aria-label": "Minuten", inputmode: "numeric" });
  const note = h("input", { class: "txt", placeholder: "z. B. Investoren-Call", "aria-label": "Notiz" });
  const quick = h("div", { class: "row-wrap" }, h("span", { class: "muted small" }, "Schnell:"),
    [15, 30, 45, 60, 90, 120].map((m) => h("button", { type: "button", class: "chip", onclick: () => { hh.value = Math.floor(m / 60); mm.value = m % 60; } }, m < 60 ? m + " Min" : (m / 60).toLocaleString("de-DE") + " h")));

  const save = (close) => {
    const min = (parseInt(hh.value, 10) || 0) * 60 + (parseInt(mm.value, 10) || 0);
    if (min <= 0) { toast("Bitte eine Dauer größer als 0 angeben."); return; }
    ui.lastVorhaben = vSel.value;
    addEntry({ vorhabenId: vSel.value, todoId: tSel.value || null, date: date.value || todayKey(), min, note: note.value.trim() });
    close();
    toast(fmtHM(min) + " h nachgetragen");
  };
  modal({
    title: "Zeit nachtragen",
    body: h("div", { class: "form-grid" },
      h("label", { class: "f" }, h("span", null, "Vorhaben"), vSel),
      h("label", { class: "f" }, h("span", null, "To-Do (optional)"), tSel),
      h("div", { class: "f-row" },
        h("label", { class: "f" }, h("span", null, "Datum"), date),
        h("label", { class: "f" }, h("span", null, "Stunden"), hh),
        h("label", { class: "f" }, h("span", null, "Minuten"), mm)),
      quick,
      h("label", { class: "f" }, h("span", null, "Notiz (optional)"), note)),
    actions: [{ label: "Abbrechen", onClick: (c) => c() }, { label: "Eintragen", primary: true, onClick: save }],
  });
}
