// Tabellen-Ansicht: wie das Sheet, kompakt. Klick auf eine Zelle öffnet sie groß im Seitenpanel.

import { h, icon } from "../ui.js";
import { FIELDS, ERFOLG_PARTS } from "../model.js";
import { projects, areas, patch, minutesOf, todosOf, createVorhaben } from "../state.js";
import { ui, openPanel, openVorhaben, rerender, persistUi } from "../nav.js";
import { statusSelect, deadlineBadge, preview, statusClass } from "../components.js";
import { fmtH } from "../model.js";

const COLS = FIELDS.map((f) => f.key);
const LABEL = Object.fromEntries(FIELDS.map((f) => [f.key, f.label]));

const byStartThenCreated = (a, b) => ((a.start || "9999") < (b.start || "9999") ? -1 : (a.start || "9999") > (b.start || "9999") ? 1 : (a.created || 0) - (b.created || 0));

function textCell(v, key, text, extraCls) {
  const active = ui.panel && ui.panel.vid === v.id && ui.panel.field === key;
  return h("td", { class: "c-text" + (active ? " active" : "") + (extraCls ? " " + extraCls : ""), tabindex: "0",
    onclick: () => openPanel(v.id, key), onkeydown: (e) => { if (e.key === "Enter") openPanel(v.id, key); } },
    h("div", { class: "clamp2" }, text || h("span", { class: "muted" }, "—")));
}

function erfolgCell(v) {
  const e = v.erfolg || {};
  const lines = ERFOLG_PARTS.filter((p) => preview(e[p.key])).map((p) => p.label + ": " + preview(e[p.key]));
  const active = ui.panel && ui.panel.vid === v.id && ui.panel.field === "erfolg";
  return h("td", { class: "c-text" + (active ? " active" : ""), tabindex: "0", onclick: () => openPanel(v.id, "erfolg"),
    onkeydown: (ev) => { if (ev.key === "Enter") openPanel(v.id, "erfolg"); } },
    h("div", { class: "clamp2" }, lines.join(" · ") || h("span", { class: "muted" }, "—")));
}

function dateIn(v, key, label) {
  return h("input", { type: "date", class: "date-in small", value: v[key] || "", "aria-label": label, title: label,
    onchange: (e) => patch("vorhaben", v.id, { [key]: e.target.value }) });
}

function row(v) {
  const open = todosOf(v.id).filter((t) => !t.done).length;
  const min = minutesOf(v.id);
  const titleActive = ui.panel && ui.panel.vid === v.id && ui.panel.field === "titel";
  const nameActive = ui.panel && ui.panel.vid === v.id && ui.panel.field === "name";
  return h("tr", { class: "row " + statusClass(v.status) + (v.status === "Abgeschlossen" ? " is-done" : "") },
    h("td", { class: "c-name sticky" + (nameActive ? " active" : ""), onclick: () => openPanel(v.id, "name") },
      h("div", { class: "clamp3 name-text" }, (v.name || "").trim() || h("span", { class: "muted" }, "Name vergeben …")),
      h("div", { class: "title-meta" },
        deadlineBadge(v),
        h("button", { class: "icon-btn ghost tiny", title: "Als Dokument öffnen", "aria-label": "Als Dokument öffnen",
          onclick: (e) => { e.stopPropagation(); openVorhaben(v.id); } }, icon("open")))),
    h("td", { class: "c-title" + (titleActive ? " active" : ""), tabindex: "0", onclick: () => openPanel(v.id, "titel") },
      h("div", { class: "clamp3" }, v.title || h("span", { class: "muted" }, "—"))),
    h("td", { class: "c-status" }, statusSelect(v, "small")),
    v.status === "Idee"
      ? h("td", { class: "c-dates" }, h("span", { class: "muted" }, "—"))
      : h("td", { class: "c-dates" }, dateIn(v, "start", "Laufzeit ab"), dateIn(v, "end", "Laufzeit bis")),
    COLS.map((k) => (k === "erfolg" ? erfolgCell(v) : textCell(v, k, preview((v.fields || {})[k])))),
    h("td", { class: "c-small num" }, min >= 1 ? fmtH(min) : h("span", { class: "muted" }, "—")),
    h("td", { class: "c-small num" }, h("a", { href: "#/v/" + v.id, onclick: (e) => e.stopPropagation() }, open ? open + " offen" : "—")));
}

// Tabelle mit Pfeilen links/rechts, um durch alle Spalten zu blättern
let updateArrows = null;
window.addEventListener("resize", () => { if (updateArrows) updateArrows(); });
// Nach jedem Zeichnen (auch nach wiederhergestellter Scroll-Position) aufrufen
export function refreshTableArrows() { if (updateArrows && document.contains(document.querySelector(".tablewrap"))) updateArrows(); }
function scroller(table) {
  const wrap = h("div", { class: "tablewrap" }, table);
  const step = (dir) => {
    const sticky = wrap.querySelector("th.sticky");
    const visible = wrap.clientWidth - (sticky ? sticky.offsetWidth : 0);
    wrap.scrollBy({ left: dir * Math.max(220, visible * 0.8), behavior: "smooth" });
  };
  const left = h("button", { class: "tbl-arrow left", title: "Spalten nach links", "aria-label": "Spalten nach links", onclick: () => step(-1) }, icon("back"));
  const right = h("button", { class: "tbl-arrow right", title: "Weitere Spalten rechts", "aria-label": "Spalten nach rechts", onclick: () => step(1) }, icon("next"));
  const update = () => {
    const max = wrap.scrollWidth - wrap.clientWidth - 2;
    left.classList.toggle("hidden", wrap.scrollLeft <= 2);
    right.classList.toggle("hidden", wrap.scrollLeft >= max);
  };
  wrap.addEventListener("scroll", update, { passive: true });
  updateArrows = update;
  left.classList.add("hidden");
  return h("div", { class: "table-scroller" }, wrap, left, right);
}

export function tableView() {
  const ncol = 4 + COLS.length + 2;
  const tbody = h("tbody");
  const shown = areas().filter((a) => ui.area === "all" || a.id === ui.area);
  let any = false;

  shown.forEach((a) => {
    const all = projects().filter((v) => v.areaId === a.id);
    const hiddenDone = ui.showDone ? 0 : all.filter((v) => v.status === "Abgeschlossen").length;
    const main = all.filter((v) => v.status !== "Idee" && (ui.showDone || v.status !== "Abgeschlossen")).sort(byStartThenCreated);
    const ideas = all.filter((v) => v.status === "Idee").sort((x, y) => (x.created || 0) - (y.created || 0));

    tbody.append(h("tr", { class: "area-row" },
      h("td", { colspan: ncol },
        h("div", { class: "area-head" },
          h("span", { class: "area-name" }, a.name),
          h("span", { class: "muted small" }, all.length + " Vorhaben"),
          h("button", { class: "btn small", onclick: () => { const v = createVorhaben({ areaId: a.id, status: "Vorbereitung" }); openVorhaben(v.id); } },
            icon("plus"), "Vorhaben")))));

    main.forEach((v) => { tbody.append(row(v)); any = true; });
    if (hiddenDone) {
      tbody.append(h("tr", { class: "hint-row" }, h("td", { colspan: ncol },
        h("button", { class: "link-btn stick", onclick: () => { ui.showDone = true; persistUi(); rerender(); } },
          hiddenDone + " abgeschlossene" + (hiddenDone === 1 ? "s Vorhaben" : " Vorhaben") + " ausgeblendet – anzeigen"))));
    }
    if (ideas.length) {
      tbody.append(h("tr", { class: "group-row ideas" }, h("td", { colspan: ncol }, h("span", { class: "stick" }, "Ideen-Park"))));
      ideas.forEach((v) => { tbody.append(row(v)); any = true; });
    }
  });

  const table = h("table", { class: "grid" },
    h("thead", null, h("tr", null,
      h("th", { class: "sticky" }, "Projektname"),
      h("th", null, "Hypothese"),
      h("th", null, "Status"),
      h("th", null, "Laufzeit"),
      COLS.map((k) => h("th", null, LABEL[k])),
      h("th", null, "Zeit"),
      h("th", null, "To-Dos"))),
    tbody);

  return h("div", { class: "view-table" },
    h("div", { class: "toolbar" },
      h("label", { class: "toggle" },
        h("input", { type: "checkbox", checked: ui.showDone, onchange: (e) => { ui.showDone = e.target.checked; persistUi(); rerender(); } }),
        "Abgeschlossene zeigen"),
      h("span", { class: "muted small" }, "Klick auf eine Zelle öffnet sie groß zum Lesen und Bearbeiten.")),
    any || shown.length ? scroller(table) : h("div", { class: "empty-state" }, "Noch keine Vorhaben."));
}
