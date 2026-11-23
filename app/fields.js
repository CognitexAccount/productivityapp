// Feld-Editoren eines Vorhabens (geteilt von Dokument-Ansicht und Seitenpanel).
// Jedes Feld: ausklappbare Leitfragen + leere Schreibfläche (ohne Platzhaltertext).

import { h } from "./ui.js";
import { FIELD, FIELDS, TITLE_HINTS, ERFOLG_PARTS } from "./model.js";
import { patch, setField, setErfolg, settings } from "./state.js";
import { editor, autoText } from "./editor.js";

// Eigene Beschreibung „Resistance oder Personal End Point?“ (Einstellungen) – erscheint bei „Ergebnis“
export const resistanceText = () => (settings().resistanceText || "").trim();

// Leitfragen: eigene Fassung aus den Einstellungen, sonst Standard
export const defaultHints = (key) => (key === "titel" ? TITLE_HINTS : (FIELD[key] || {}).hints || []);
export function hintsFor(key) {
  const own = (settings().hints || {})[key];
  return Array.isArray(own) && own.length ? own : defaultHints(key);
}
export const HINT_FIELDS = [{ key: "titel", label: "Hypothese" }, ...FIELDS.map((f) => ({ key: f.key, label: f.label }))];

export function hintsBox(key) {
  const hints = hintsFor(key);
  const link = key === "strategie" ? (settings().strategieLink || "").trim() : "";
  const extra = key === "ergebnis" ? resistanceText() : "";
  if (!hints.length && !link && !extra) return null;
  return h("details", { class: "hints" },
    h("summary", null, "Leitfragen"),
    h("ul", null, hints.map((q) => (/:$/.test(q.trim()) ? h("li", { class: "hint-head" }, q) : h("li", null, q)))),
    extra ? h("p", { class: "hint-extra" }, extra) : null,
    link ? h("a", { href: link, target: "_blank", rel: "noopener", class: "hint-link" }, "Meine Ziele öffnen ↗") : null);
}

export function titleEditor(v, { big } = {}) {
  return h("div", { class: "field" },
    hintsBox("titel"),
    autoText({
      value: v.title, cls: big ? "title-edit big" : "title-edit",
      onChange: (val) => patch("vorhaben", v.id, { title: val }, { silent: true }),
    }));
}

export function fieldEditor(v, key, { big = false } = {}) {
  if (key === "titel") return titleEditor(v, { big: true });
  const f = FIELD[key];
  if (f.special === "erfolg") return h("div", { class: "field" }, hintsBox(key), erfolgEditor(v, { big }));
  const ed = editor({
    html: (v.fields || {})[key] || "", minHeight: big ? "46vh" : "110px",
    onChange: (val) => setField(v.id, key, val),
  });
  return h("div", { class: "field" }, hintsBox(key), ed);
}

export function erfolgEditor(v, { big = false } = {}) {
  return h("div", { class: "erfolg-grid" },
    ERFOLG_PARTS.map((p) => h("div", { class: "erfolg-part part-" + p.key },
      h("div", { class: "part-label" }, p.label),
      editor({ html: (v.erfolg || {})[p.key] || "", minHeight: big ? "16vh" : "64px", onChange: (val) => setErfolg(v.id, p.key, val) }))));
}
