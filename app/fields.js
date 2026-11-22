// Feld-Editoren eines Vorhabens (geteilt von Dokument-Ansicht, Seitenpanel und Assistent).

import { h } from "./ui.js";
import { FIELD, FIELDS, TITLE_HINTS, ERFOLG_PARTS, OUTCOMES, ABSCHLUSS_CHECKS, RESISTANCE_TEXT } from "./model.js";
import { patch, setField, setErfolg, setAbschluss, settings } from "./state.js";

export const resistanceText = () => (settings().resistanceText || "").trim() || RESISTANCE_TEXT;
const fieldLink = (f) => (f.key === "strategie" ? (settings().strategieLink || "").trim() : f.link) || null;
import { editor, autoText, outlineHtml, onlyHeadings } from "./editor.js";

let wizardOpener = () => {};
export const setWizardOpener = (fn) => { wizardOpener = fn; };

export function outlineFields(existing) {
  const f = { ...(existing || {}) };
  FIELDS.filter((x) => x.outline).forEach((x) => { if (!f[x.key]) f[x.key] = outlineHtml(x.hints); });
  return f;
}

export function hintsBox(f, ed, html, onInsert) {
  const hints = f.hints;
  const link = f.key ? fieldLink(f) : f.link;
  const canOutline = ed && onInsert && (!html || onlyHeadings(html)) && !(html && html.includes("<h4>"));
  return h("details", { class: "hints" },
    h("summary", null, "Leitfragen"),
    h("ul", null, hints.map((q) => h("li", null, q))),
    link ? h("a", { href: link, target: "_blank", rel: "noopener", class: "hint-link" }, "Meine Ziele öffnen ↗") : null,
    canOutline ? h("button", { type: "button", class: "btn small", onclick: () => onInsert() }, "Als Gliederung ins Feld einfügen") : null);
}

export function titleEditor(v, { big } = {}) {
  return h("div", { class: "field" },
    hintsBox({ hints: TITLE_HINTS }),
    autoText({
      value: v.title, placeholder: "Hypothese – SMART formuliert …", cls: big ? "title-edit big" : "title-edit",
      onChange: (val) => patch("vorhaben", v.id, { title: val }, { silent: true }),
    }));
}

export function fieldEditor(v, key, { big = false } = {}) {
  if (key === "titel") return titleEditor(v, { big: true });
  if (key === "abschluss") return abschlussBlock(v);
  const f = FIELD[key];
  if (f.special === "erfolg") return erfolgEditor(v, { big });
  const html = (v.fields || {})[key] || "";
  const ed = editor({
    html, placeholder: f.hints[0] || "", minHeight: big ? "46vh" : "110px",
    onChange: (val) => setField(v.id, key, val),
  });
  const insert = () => { const o = outlineHtml(f.hints); ed.setValue(o); setField(v.id, key, o); ed.focusEnd(); };
  return h("div", { class: "field" }, hintsBox(f, ed, html, insert), ed);
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
