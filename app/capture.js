// Schnellerfassung „Idee parken“: ein Satz rein, landet mit Datum im Ideen-Park.

import { h, modal, toast } from "./ui.js";
import { areas, createVorhaben } from "./state.js";
import { ui } from "./nav.js";

export function areaSelect(value, attrs) {
  const list = areas();
  return h("select", { class: "sel", value: value || (list[0] && list[0].id), ...(attrs || {}) },
    list.map((a) => h("option", { value: a.id }, a.name)));
}

export function openCapture() {
  const ta = h("textarea", { class: "capture-ta", rows: 3, placeholder: "Idee in einem Satz …", "aria-label": "Idee", autofocus: true });
  const sel = areaSelect(ui.area !== "all" ? ui.area : (areas()[0] || {}).id, { "aria-label": "Bereich" });
  const name = h("input", { class: "txt", placeholder: "z. B. Keynote-Vortrag", "aria-label": "Projektname" });
  let close;
  const save = () => {
    const t = ta.value.trim();
    if (!t) { ta.focus(); return; }
    createVorhaben({ areaId: sel.value, status: "Idee", title: t, name: name.value.trim() });
    close();
    toast("Idee geparkt – liegt jetzt im Ideen-Park");
  };
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } });
  close = modal({
    title: "Idee parken",
    body: h("div", { class: "capture" }, ta,
      h("label", { class: "inline-field" }, "Projektname (optional)", name),
      h("label", { class: "inline-field" }, "Bereich", sel),
      h("p", { class: "muted small" }, "Landet als Idee im Ideen-Park – du bleibst bei deiner laufenden Arbeit. Enter speichert.")),
    actions: [{ label: "Abbrechen", onClick: (c) => c() }, { label: "Parken", primary: true, onClick: save }],
  });
}
