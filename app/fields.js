// Feld-Editoren eines Vorhabens (geteilt von Dokument-Ansicht, Seitenpanel und Assistent).

import { h } from "./ui.js";
import { FIELD, FIELDS, TITLE_HINTS, ERFOLG_PARTS, OUTCOMES, ABSCHLUSS_CHECKS, RESISTANCE_TEXT } from "./model.js";
import { patch, setField, setErfolg, setAbschluss, settings } from "./state.js";
import { editor, autoText } from "./editor.js";

let wizardOpener = () => {};
export const setWizardOpener = (fn) => { wizardOpener = fn; };

export const resistanceText = () => (settings().resistanceText || "").trim() || RESISTANCE_TEXT;

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
  if (!hints.length && !link) return null;
  return h("details", { class: "hints" },
    h("summary", null, "Leitfragen"),
    h("ul", null, hints.map((q) => h("li", null, q))),
    link ? h("a", { href: link, target: "_blank", rel: "noopener", class: "hint-link" }, "Meine Ziele öffnen ↗") : null);
}

export function titleEditor(v, { big } = {}) {
  return h("div", { class: "field" },
    hintsBox("titel"),
    autoText({
      value: v.title, placeholder: "Hypothese – SMART formuliert …", cls: big ? "title-edit big" : "title-edit",
      onChange: (val) => patch("vorhaben", v.id, { title: val }, { silent: true }),
    }));
}

export function fieldEditor(v, key, { big = false } = {}) {
  if (key === "titel") return titleEditor(v, { big: true });
  if (key === "abschluss") return abschlussBlock(v);
  const f = FIELD[key];
  if (f.special === "erfolg") return h("div", { class: "field" }, hintsBox(key), erfolgEditor(v, { big }));
  const ed = editor({
    html: (v.fields || {})[key] || "", placeholder: hintsFor(key)[0] || "", minHeight: big ? "46vh" : "110px",
    onChange: (val) => setField(v.id, key, val),
  });
  return h("div", { class: "field" }, hintsBox(key), ed);
}

const ERFOLG_PH = {
  erfolg: "Woran erkenne ich Erfolg – und was ist dann der nächste Schritt?",
  neutral: "Was ist ein neutrales Ergebnis – und wie geht es dann weiter?",
  misserfolg: "Wann ist es ein Misserfolg – und was mache ich dann?",
  kill: "Wann breche ich bewusst ab? (z. B. Datum, Zahl, Signal)",
};
export function erfolgEditor(v, { big = false } = {}) {
  return h("div", { class: "erfolg-grid" },
    ERFOLG_PARTS.map((p) => {
      const html = (v.erfolg || {})[p.key] || "";
      const missing = p.key === "kill" && !html && v.status !== "Idee";
      return h("div", { class: "erfolg-part part-" + p.key },
        h("div", { class: "part-label" }, p.label, missing ? h("span", { class: "badge warn" }, "fehlt noch") : null),
        editor({ html, placeholder: ERFOLG_PH[p.key], minHeight: big ? "16vh" : "64px", onChange: (val) => setErfolg(v.id, p.key, val) }));
    }));
}

export function abschlussBlock(v) {
  const a = v.abschluss || {};
  const radio = (name, val, label, on) =>
    h("label", { class: "radio" }, h("input", { type: "radio", name: name + "-" + v.id, checked: on, onchange: () => setAbschluss(v.id, { [name]: val }) }), label);
  const checks = a.outcome ? ABSCHLUSS_CHECKS[a.outcome] : null;
  return h("div", { class: "abschluss" },
    h("div", { class: "row-wrap" }, h("span", { class: "lbl" }, "Ergebnis"),
      OUTCOMES.map((o) => radio("outcome", o, o, a.outcome === o))),
    h("div", { class: "row-wrap" }, h("span", { class: "lbl" }, "Beendet aus"),
      radio("grund", "endpoint", "Personal End Point", a.grund === "endpoint"),
      radio("grund", "resistance", "Resistance", a.grund === "resistance")),
    h("details", { class: "hints" }, h("summary", null, "Resistance oder Personal End Point?"), h("p", null, resistanceText())),
    checks
      ? h("div", { class: "checklist" },
          h("div", { class: "lbl" }, "Checkliste bei " + a.outcome),
          checks.map(([k, q]) => h("label", { class: "check-item" },
            h("input", { type: "checkbox", checked: !!(a.checks || {})[k], onchange: (e) => setAbschluss(v.id, { checks: { ...((v.abschluss || {}).checks || {}), [k]: e.target.checked } }) }),
            h("span", null, q))))
      : h("p", { class: "muted small" }, "Wähle zuerst das Ergebnis – dann erscheint die passende Abschluss-Checkliste."),
    h("label", { class: "check-item strong" },
      h("input", { type: "checkbox", checked: !!a.done, onchange: (e) => setAbschluss(v.id, { done: e.target.checked }) }),
      h("span", null, "Sauberen Abschluss gemacht")),
    a.feier ? h("p", { class: "muted small" }, "🎉 Gefeiert: " + a.feier) : null,
    h("button", { type: "button", class: "btn", onclick: () => wizardOpener(v.id) }, "Abschluss-Assistent starten"));
}
