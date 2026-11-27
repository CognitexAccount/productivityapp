// To-Do (mobil zuerst): fällige To-Dos mit großem Start-Button, dazu „Heute gearbeitet“ nach Projekten.

import { h, icon } from "../ui.js";
import { todayKey, addDays, fmtHM, fmtDate, DEFAULT_EST } from "../model.js";
import { store, live, byId, isActive, sortTodos, addTodo, minutesRange, runningMin, assignableProjects, vName } from "../state.js";
import { ui } from "../nav.js";
import { todoRow, timerButton, section, estSelect, pauseButton, runClock, runPct } from "../components.js";
import { openTimeEntry } from "../timeentry.js";

const inArea = (v) => v && (v.system || ui.area === "all" || v.areaId === ui.area);

// Heute erfasste Zeit je Projekt (inkl. laufendem Timer)
function workedToday(tk) {
  const per = {};
  for (const e of live("timeEntries")) if (e.date === tk) per[e.vorhabenId] = (per[e.vorhabenId] || 0) + (e.min || 0);
  const r = store.state.running;
  if (r && r.start) per[r.vorhabenId] = (per[r.vorhabenId] || 0) + runningMin(() => true);
  return Object.entries(per).map(([vid, min]) => ({ v: byId("vorhaben", vid) || store.state.vorhaben.find((x) => x.id === vid), vid, min }))
    .filter((x) => x.min >= 0.5).sort((a, b) => b.min - a.min);
}

export function todayView() {
  const tk = todayKey(), tm = addDays(tk, 1), wk = addDays(tk, 7);
  const todos = sortTodos(live("todos").filter((t) => inArea(byId("vorhaben", t.vorhabenId))));
  const open = todos.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due && t.due < tk);
  const today = open.filter((t) => t.due === tk);
  const tomorrow = open.filter((t) => t.due === tm);
  const week = open.filter((t) => t.due && t.due > tm && t.due <= wk);
  const noDate = open.filter((t) => !t.due && isActive(byId("vorhaben", t.vorhabenId)));
  const doneToday = todos.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString());

  // Schnell ein To-Do anlegen – Zuordnung: Projekte, immer auch „Sonstiges“
  const vs = assignableProjects().filter((v) => inArea(v));
  const has = (id) => vs.some((v) => v.id === id);
  const inp = h("input", { class: "todo-new", placeholder: "Neues To-Do …", "data-live-edit": "1", "data-focus-key": "today-new", "aria-label": "Neues To-Do" });
  const sel = h("select", { class: "sel small", "aria-label": "Projekt", value: ui.lastVorhaben && has(ui.lastVorhaben) ? ui.lastVorhaben : (vs[0] || {}).id },
    vs.map((v) => h("option", { value: v.id }, vName(v))));
  const due = h("input", { type: "date", class: "date-in small", value: tk, "aria-label": "Fällig am" });
  let est = ui.lastEst || DEFAULT_EST;
  const estSel = estSelect(est, (m) => { est = m; ui.lastEst = m; });
  const add = () => {
    if (!inp.value.trim() || !sel.value) return;
    ui.lastVorhaben = sel.value;
    addTodo(sel.value, inp.value, due.value, est);
    ui.focusAfter = "today-new";
    inp.value = "";
    inp.blur();
  };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });

  const r = store.state.running;
  const runV = r && r.start ? byId("vorhaben", r.vorhabenId) : null;
  const runT = r && r.start && r.todoId ? byId("todos", r.todoId) : null;

  const worked = workedToday(tk);
  const total = worked.reduce((s, x) => s + x.min, 0);
  const max = Math.max(1, ...worked.map((x) => x.min));
  const workedBlock = worked.length
    ? h("div", { class: "bars" },
        worked.map((x) => h("div", { class: "barrow" },
          h("div", { class: "bar-lbl clamp1" }, vName(x.v)),
          h("div", { class: "bar" }, h("span", { class: "bar-fill", style: { width: (x.min / max) * 100 + "%" } })),
          h("div", { class: "bar-val num" }, fmtHM(x.min) + " h"))),
        h("div", { class: "muted small right" }, "Gesamt heute: " + fmtHM(total) + " h"))
    : h("p", { class: "muted small" }, "Heute noch keine Zeit erfasst.");

  const list = (items) => items.length ? items.map((t) => todoRow(t, { showVorhaben: true })) : h("p", { class: "muted small" }, "Nichts offen.");

  return h("div", { class: "view-today", id: "timer" },
    h("div", { class: "today-head" },
      h("div", null,
        h("div", { class: "today-date" }, new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })),
        h("div", { class: "muted small" }, "Heute erfasst: " + fmtHM(total) + " h · " + doneToday.length + " erledigt")),
      h("button", { class: "btn small", onclick: () => openTimeEntry() }, icon("clock"), "Zeit nachtragen")),
    runV ? h("div", { class: "focus-card" },
      h("div", { class: "focus-lbl" }, "Du arbeitest gerade an"),
      h("div", { class: "focus-what" }, runT ? runT.title : "Stoppuhr"),
      runV.system ? h("span", { class: "focus-v" }, vName(runV)) : h("a", { class: "focus-v", href: "#/v/" + runV.id }, vName(runV)),
      h("div", { class: "focus-lbl" }, r.pausedAt ? "Pausiert" : r.dur ? "Countdown – noch" : "Stoppuhr läuft seit"),
      h("div", { class: "focus-time" + (r.pausedAt ? " paused" : ""), id: "focusTime" }, runClock(r)),
      r.dur ? h("div", { class: "bar focus-bar" }, h("span", { class: "bar-fill", id: "focusBar", style: { width: runPct(r) + "%" } })) : null,
      h("div", { class: "focus-btns" }, pauseButton({ big: true }), timerButton({ todoId: r.todoId, vorhabenId: r.vorhabenId, big: true, label: "Stopp" }))) : null,
    h("div", { class: "todo-add today-add card-like" }, inp, sel, estSel, due, h("button", { class: "btn primary small", onclick: add }, icon("plus"), "Hinzufügen")),
    overdue.length ? section("t-over", "Überfällig", list(overdue), { ui, count: overdue.length }) : null,
    section("t-today", "Heute fällig", list(today), { ui, count: today.length || null }),
    section("t-tomorrow", "Morgen fällig", list(tomorrow), { ui, count: tomorrow.length || null }),
    section("t-week", "Nächste 7 Tage", list(week), { ui, count: week.length || null }),
    section("t-nodate", "Ohne Datum", list(noDate), { ui, count: noDate.length || null }),
    doneToday.length ? section("t-done", "Heute erledigt", list(doneToday), { ui, count: doneToday.length }) : null,
    section("t-worked", "Heute gearbeitet", workedBlock, { ui, count: total >= 1 ? fmtHM(total) + " h" : null }),
    h("p", { class: "muted small center" }, "Stand " + fmtDate(tk)));
}
