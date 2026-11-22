// Heute / Fokus (mobil zuerst): fällige To-Dos mit großem Start-Button für den Timer.

import { h, icon } from "../ui.js";
import { todayKey, addDays, fmtHM, fmtDate, fmtClock } from "../model.js";
import { store, live, byId, isActive, sortTodos, addTodo, minutesRange } from "../state.js";
import { ui, rerender } from "../nav.js";
import { todoRow, timerButton, section } from "../components.js";

const inArea = (v) => v && (ui.area === "all" || v.areaId === ui.area);

export function todayView() {
  const tk = todayKey(), wk = addDays(tk, 7);
  const todos = sortTodos(live("todos").filter((t) => inArea(byId("vorhaben", t.vorhabenId))));
  const open = todos.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due && t.due < tk);
  const today = open.filter((t) => t.due === tk);
  const week = open.filter((t) => t.due && t.due > tk && t.due <= wk);
  const noDate = open.filter((t) => !t.due && isActive(byId("vorhaben", t.vorhabenId)));
  const doneToday = todos.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString());

  // Schnell ein To-Do anlegen
  const vs = live("vorhaben").filter((v) => inArea(v) && v.status !== "Abgeschlossen")
    .sort((a, b) => (isActive(b) ? 1 : 0) - (isActive(a) ? 1 : 0) || (a.title || "").localeCompare(b.title || ""));
  const inp = h("input", { class: "todo-new", placeholder: "To-Do für heute …", "data-live-edit": "1", "data-focus-key": "today-new", "aria-label": "Neues To-Do" });
  const sel = h("select", { class: "sel small", "aria-label": "Vorhaben", value: ui.lastVorhaben && vs.some((v) => v.id === ui.lastVorhaben) ? ui.lastVorhaben : (vs[0] || {}).id },
    vs.map((v) => h("option", { value: v.id }, (v.title || "Ohne Titel").slice(0, 70))));
  const due = h("input", { type: "date", class: "date-in small", value: tk, "aria-label": "Fällig am" });
  const add = () => {
    if (!inp.value.trim() || !sel.value) return;
    ui.lastVorhaben = sel.value;
    addTodo(sel.value, inp.value, due.value);
    ui.focusAfter = "today-new";
    inp.value = "";
    inp.blur();
  };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });

  const r = store.state.running;
  const runV = r && r.start ? byId("vorhaben", r.vorhabenId) : null;
  const runT = r && r.start && r.todoId ? byId("todos", r.todoId) : null;

  const list = (items, opts) => items.length ? items.map((t) => todoRow(t, { showVorhaben: true, ...(opts || {}) })) : h("p", { class: "muted small" }, "Nichts offen.");

  return h("div", { class: "view-today" },
    h("div", { class: "today-head" },
      h("div", null,
        h("div", { class: "today-date" }, new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })),
        h("div", { class: "muted small" }, "Heute erfasst: " + fmtHM(minutesRange(tk, tk)) + " h · " + doneToday.length + " erledigt"))),
    runV ? h("div", { class: "focus-card" },
      h("div", { class: "focus-lbl" }, "Du arbeitest gerade an"),
      h("div", { class: "focus-what" }, runT ? runT.title : "dem Vorhaben"),
      h("a", { class: "focus-v", href: "#/v/" + runV.id }, runV.title),
      h("div", { class: "focus-time", id: "focusTime" }, fmtClock((Date.now() - r.start) / 1000)),
      timerButton({ todoId: r.todoId, vorhabenId: r.vorhabenId, big: true, label: "Stopp" })) : null,
    h("div", { class: "todo-add today-add card-like" }, inp, sel, due, h("button", { class: "btn primary small", onclick: add }, icon("plus"), "Hinzufügen")),
    overdue.length ? section("t-over", "Überfällig", list(overdue), { ui, count: overdue.length }) : null,
    section("t-today", "Heute fällig", list(today), { ui, count: today.length || null }),
    section("t-week", "Nächste 7 Tage", list(week), { ui, count: week.length || null }),
    section("t-nodate", "Ohne Datum (aktive Vorhaben)", list(noDate), { ui, count: noDate.length || null }),
    doneToday.length ? section("t-done", "Heute erledigt", list(doneToday), { ui, count: doneToday.length }) : null,
    !open.length && !vs.length ? h("div", { class: "empty-state" }, "Lege zuerst ein Vorhaben an – im ", h("a", { href: "#/board" }, "Board"), " oder in der ", h("a", { href: "#/tabelle" }, "Tabelle"), ".") : null,
    h("p", { class: "muted small center" }, "Stand " + fmtDate(tk)));
}
