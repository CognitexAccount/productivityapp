// Lessons-Bibliothek: alle Lessons Learned (und Ergebnisse) durchsuchbar an einem Ort.

import { h } from "../ui.js";
import { fmtShort, STATUS_LABEL } from "../model.js";
import { live, areaName } from "../state.js";
import { ui, openVorhaben } from "../nav.js";
import { preview, statusPill } from "../components.js";
import { sanitize } from "../editor.js";

export function lessonsView() {
  const items = live("vorhaben")
    .filter((v) => preview((v.fields || {}).lessons) || preview((v.fields || {}).ergebnis))
    .sort((a, b) => ((b.end || "") > (a.end || "") ? 1 : -1));
  const results = h("div", { class: "lessons" });

  const draw = () => {
    const q = ui.lessonsQuery.trim().toLowerCase();
    results.replaceChildren();
    const hits = items.filter((v) => !q || (v.title + " " + preview(v.fields.lessons) + " " + preview(v.fields.ergebnis)).toLowerCase().includes(q));
    if (!hits.length) {
      results.append(h("div", { class: "empty-state" }, items.length ? "Keine Treffer." : "Noch keine Lessons Learned erfasst. Sie entstehen beim Abschluss eines Vorhabens."));
      return;
    }
    hits.forEach((v) => results.append(h("article", { class: "lesson card-like" },
      h("div", { class: "lesson-head" },
        h("button", { class: "link-btn strong", onclick: () => openVorhaben(v.id) }, v.title || "Ohne Titel"),
        h("div", { class: "muted small" }, areaName(v.areaId), " · ", statusPill(v.status), v.end ? " · bis " + fmtShort(v.end) : "")),
      preview(v.fields.lessons) ? h("div", { class: "rich", html: sanitize(v.fields.lessons) }) : null,
      preview(v.fields.ergebnis) ? h("details", { class: "hints" }, h("summary", null, "Ergebnis"), h("div", { class: "rich", html: sanitize(v.fields.ergebnis) })) : null)));
  };

  const search = h("input", { type: "search", class: "txt search", placeholder: "Learnings durchsuchen …", value: ui.lessonsQuery, "aria-label": "Suche", "data-live-edit": "1",
    oninput: (e) => { ui.lessonsQuery = e.target.value; draw(); } });
  draw();
  return h("div", { class: "view-lessons" },
    h("div", { class: "toolbar" }, search, h("span", { class: "muted small" }, items.length + " Vorhaben mit Learnings")),
    h("p", { class: "muted small" }, "Beim Anlegen eines neuen Vorhabens zeigt dir das Tool automatisch passende frühere Learnings (" + (STATUS_LABEL.Idee) + " & Vorbereitung)."),
    results);
}
