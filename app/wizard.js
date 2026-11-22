// Abschluss-Assistent: führt Schritt für Schritt durch den sauberen Abschluss.

import { h, modal, toast } from "./ui.js";
import { FIELD, OUTCOMES, ABSCHLUSS_CHECKS } from "./model.js";
import { byId, patch, setField, setAbschluss } from "./state.js";
import { editor, outlineHtml } from "./editor.js";
import { hintsBox, resistanceText } from "./fields.js";

const STEPS = ["Ergebnis", "Warum beendet?", "Checkliste", "Lessons Learned", "Feiern"];

export function openWizard(vid) {
  let step = 0;
  const body = h("div", { class: "wizard" });
  let close;

  const v = () => byId("vorhaben", vid);
  const ab = () => (v() && v().abschluss) || {};

  function fieldStep(key) {
    const f = FIELD[key];
    const html = (v().fields || {})[key] || "";
    const ed = editor({ html, placeholder: f.hints[0], minHeight: "180px", onChange: (val) => setField(vid, key, val) });
    const insert = () => { const o = outlineHtml(f.hints); ed.setValue(o); setField(vid, key, o); ed.focusEnd(); };
    return h("div", null, hintsBox(f, ed, html, insert), ed);
  }

  function radio(name, val, label, on) {
    return h("label", { class: "radio big" },
      h("input", { type: "radio", name: "wz-" + name, checked: on, onchange: () => { setAbschluss(vid, { [name]: val }); draw(); } }), label);
  }

  function content() {
    const a = ab();
    switch (step) {
      case 0: return h("div", null,
        h("p", null, "Wie ist das Vorhaben ausgegangen – gemessen an deiner vorher definierten Erfolgsdefinition?"),
        h("div", { class: "row-wrap" }, OUTCOMES.map((o) => radio("outcome", o, o, a.outcome === o))),
        h("div", { class: "lbl" }, "Ergebnis (was ist konkret herausgekommen?)"),
        fieldStep("ergebnis"));
      case 1: {
        const note = h("textarea", { class: "txt", rows: 3, placeholder: "Woran merkst du das? (optional)" });
        note.value = a.grundNotiz || "";
        note.addEventListener("change", () => setAbschluss(vid, { grundNotiz: note.value.trim() }, { silent: true }));
        return h("div", null,
          h("p", null, "Habe ich das Projekt aus Resistance beendet – oder weil ich meinen Personal End Point erreicht habe?"),
          h("div", { class: "explain" }, resistanceText()),
          h("div", { class: "row-wrap" },
            radio("grund", "endpoint", "Personal End Point", a.grund === "endpoint"),
            radio("grund", "resistance", "Resistance", a.grund === "resistance")),
          a.grund === "resistance" ? h("div", { class: "warn-box" }, "Resistance ist ein Signal zum Durchpushen, nicht zum Aufhören. Willst du das Vorhaben wirklich jetzt beenden? Du kannst den Assistenten auch schließen und weitermachen.") : null,
          note);
      }
      case 2: {
        if (!a.outcome) return h("p", null, "Wähle in Schritt 1 zuerst das Ergebnis – dann erscheint die passende Checkliste.");
        return h("div", null,
          h("p", null, "Checkliste bei " + a.outcome + ":"),
          ABSCHLUSS_CHECKS[a.outcome].map(([k, q]) => h("label", { class: "check-item" },
            h("input", { type: "checkbox", checked: !!(a.checks || {})[k], onchange: (e) => setAbschluss(vid, { checks: { ...(ab().checks || {}), [k]: e.target.checked } }, { silent: true }) }),
            h("span", null, q))));
      }
      case 3: return h("div", null, h("p", null, "Was nimmst du mit? Die Learnings landen in der Lessons-Bibliothek und werden dir bei künftigen Vorhaben vorgeschlagen."), fieldStep("lessons"));
      case 4: {
        const inp = h("input", { class: "txt", placeholder: "z. B. Abendessen mit Freunden, ein freier Tag …", value: a.feier || "" });
        inp.addEventListener("change", () => setAbschluss(vid, { feier: inp.value.trim() }, { silent: true }));
        return h("div", { class: "celebrate" },
          h("div", { class: "big-emoji" }, "🎉"),
          h("p", null, "Ein Vorhaben sauber abzuschließen ist eine Leistung – egal wie das Ergebnis ausgefallen ist."),
          h("label", { class: "lbl" }, "Wie feierst du den Abschluss?"), inp);
      }
    }
    return null;
  }

  function draw() {
    body.replaceChildren(
      h("div", { class: "steps" }, STEPS.map((s, i) => h("button", { class: "step" + (i === step ? " on" : i < step ? " done" : ""), onclick: () => { step = i; draw(); } }, h("span", { class: "step-n" }, i + 1), h("span", { class: "step-l" }, s)))),
      h("div", { class: "wizard-title clamp2" }, (v() && v().title) || ""),
      content(),
      h("div", { class: "wizard-nav" },
        step > 0 ? h("button", { class: "btn", onclick: () => { step--; draw(); } }, "Zurück") : h("span"),
        step < STEPS.length - 1
          ? h("button", { class: "btn primary", onclick: () => { step++; draw(); } }, "Weiter")
          : h("button", { class: "btn primary", onclick: finish }, "Vorhaben abschließen ✓")));
  }

  function finish() {
    const cur = v();
    if (!cur) return close();
    patch("vorhaben", vid, { status: "Abgeschlossen", abschluss: { ...(cur.abschluss || {}), done: true, doneAt: Date.now() } });
    close();
    confetti();
    toast("Vorhaben abgeschlossen – gut gemacht!");
  }

  draw();
  close = modal({ title: "Abschluss-Assistent", body, wide: true });
}

function confetti() {
  const box = h("div", { class: "confetti", "aria-hidden": "true" });
  const colors = ["#2f6fde", "#1f9d57", "#e07b1a", "#d14343", "#8b5cf6", "#0ea5b7"];
  for (let i = 0; i < 80; i++) {
    box.append(h("i", { style: {
      left: Math.random() * 100 + "vw", background: colors[i % colors.length],
      animationDelay: Math.random() * 0.6 + "s", animationDuration: 1.6 + Math.random() * 1.4 + "s",
      transform: "rotate(" + Math.random() * 360 + "deg)",
    } }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3600);
}
