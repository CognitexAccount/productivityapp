// Dokument-Ansicht: ein Vorhaben als Seite mit allen Kapiteln (einklappbar).

import { h, icon, toast, confirmDialog } from "../ui.js";
import { FIELDS, todayKey, weekStartKey, addDays, fmtDate, fmtHM, fmtH, diffDays } from "../model.js";
import {
  byId, live, areas, patch, removeItem, todosOf, minutesOf, addTodo, addEntry, sortTodos,
} from "../state.js";
import { ui, go, rerender } from "../nav.js";
import { statusSelect, deadlineBadge, todoRow, timerButton, section, preview, changeStatus } from "../components.js";
import { fieldEditor, titleEditor, abschlussBlock } from "../fields.js";
import { sanitize } from "../editor.js";

const STOP = new Set(("aber alle allem auch beim bereits bevor damit dann dass dazu denn diese dieser dieses durch eine einem einen einer eines etwas habe haben hier immer jetzt kann kein keine machen mehr meine meinen meiner meines mich mind möchte nach nicht noch oder ohne schon sehr sich sind soll sowie über unter viel weil weiter wenn werden wieder wird zwischen schaffe bis zum zur").split(" "));
function tokens(s) {
  return Array.from(new Set(String(s || "").toLowerCase().replace(/[^a-zäöüß0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 5 && !STOP.has(w))));
}
function relatedLessons(v) {
  const words = tokens(v.title + " " + preview((v.fields || {}).lernen));
  if (!words.length) return [];
  return live("vorhaben")
    .filter((o) => o.id !== v.id && preview((o.fields || {}).lessons))
    .map((o) => {
      const text = (o.title + " " + preview(o.fields.lessons) + " " + preview(o.fields.ergebnis)).toLowerCase();
      return { o, score: words.filter((w) => text.includes(w)).length };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function parseDur(s) {
  s = String(s || "").trim().replace(",", ".");
  if (!s) return 0;
  if (s.includes(":")) { const [hh, mm] = s.split(":"); return (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0); }
  if (/h$/i.test(s)) return Math.round(parseFloat(s) * 60) || 0;
  return parseFloat(s) || 0;
}

function todosBlock(v) {
  const list = todosOf(v.id);
  const open = list.filter((t) => !t.done), done = list.filter((t) => t.done);
  const inp = h("input", { class: "todo-new", placeholder: "Neues To-Do … (Enter)", "data-live-edit": "1", "data-focus-key": "todo-new-" + v.id, "aria-label": "Neues To-Do" });
  const due = h("input", { type: "date", class: "date-in small", "aria-label": "Fällig am" });
  const add = () => {
    if (!inp.value.trim()) return;
    addTodo(v.id, inp.value, due.value);
    ui.focusAfter = "todo-new-" + v.id;
    inp.value = "";
    inp.blur();
  };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  const doneOpen = !!ui.collapsed["done-" + v.id];
  return h("div", { class: "todos" },
    open.map((t) => todoRow(t, { editable: true })),
    h("div", { class: "todo-add" }, inp, due, h("button", { class: "btn small", onclick: add }, icon("plus"), "Hinzufügen")),
    done.length ? h("div", null,
      h("button", { class: "link-btn small", onclick: () => { ui.collapsed["done-" + v.id] = !doneOpen; rerender(); } },
        (doneOpen ? "Erledigte ausblenden" : "Erledigte anzeigen") + " (" + done.length + ")"),
      doneOpen ? done.map((t) => todoRow(t, { editable: true })) : null) : null);
}

function timeBlock(v) {
  const wk = weekStartKey(todayKey());
  const week = minutesOf(v.id, wk, addDays(wk, 6));
  const total = minutesOf(v.id);
  const target = v.weeklyTargetH ? v.weeklyTargetH * 60 : 0;
  const entries = live("timeEntries").filter((e) => e.vorhabenId === v.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.start || 0) - (a.start || 0));
  const showAll = !!ui.collapsed["entries-" + v.id];
  const todos = sortTodos(live("todos").filter((t) => t.vorhabenId === v.id));

  const dIn = h("input", { type: "date", class: "date-in small", value: todayKey(), "aria-label": "Datum" });
  const mIn = h("input", { class: "dur-in", placeholder: "1:30", "aria-label": "Dauer (h:mm oder Minuten)" });
  const tSel = h("select", { class: "sel small", "aria-label": "To-Do" },
    h("option", { value: "" }, "– ohne To-Do –"), todos.map((t) => h("option", { value: t.id }, t.title)));
  const addManual = () => {
    const min = parseDur(mIn.value);
    if (!(min > 0)) { toast("Bitte Dauer angeben, z. B. 1:30 oder 45"); return; }
    addEntry({ vorhabenId: v.id, todoId: tSel.value || null, date: dIn.value, min });
    toast(fmtHM(min) + " h nachgetragen");
  };

  return h("div", { class: "timeblock" },
    h("div", { class: "stats" },
      h("div", { class: "stat" }, h("div", { class: "stat-num" }, fmtH(total)), h("div", { class: "stat-lbl" }, "investiert gesamt")),
      h("div", { class: "stat" + (target && week >= target ? " ok" : "") },
        h("div", { class: "stat-num" }, fmtH(week) + (target ? " / " + fmtH(target) : "")),
        h("div", { class: "stat-lbl" }, "diese Woche" + (target ? " (Soll/Ist)" : ""))),
      h("label", { class: "stat edit" },
        h("input", { type: "number", min: "0", step: "0.5", class: "num-in", value: v.weeklyTargetH || "", placeholder: "–",
          onchange: (e) => patch("vorhaben", v.id, { weeklyTargetH: parseFloat(e.target.value) || null }) }),
        h("div", { class: "stat-lbl" }, "Wochenziel (h)"))),
    entries.length ? h("div", { class: "entries" },
      (showAll ? entries : entries.slice(0, 6)).map((e) => {
        const t = e.todoId ? byId("todos", e.todoId) : null;
        return h("div", { class: "entry" },
          h("span", { class: "muted" }, fmtDate(e.date)),
          h("span", { class: "entry-what" }, t ? t.title : e.note || (e.source === "tracker" ? "aus Zeittracker" : "am Vorhaben")),
          h("span", { class: "num" }, fmtHM(e.min)),
          h("button", { class: "icon-btn ghost tiny", title: "Eintrag löschen", "aria-label": "Eintrag löschen", onclick: () => removeItem("timeEntries", e.id) }, icon("trash")));
      }),
      entries.length > 6 ? h("button", { class: "link-btn small", onclick: () => { ui.collapsed["entries-" + v.id] = !showAll; rerender(); } },
        showAll ? "weniger anzeigen" : "alle " + entries.length + " Einträge anzeigen") : null) : h("p", { class: "muted small" }, "Noch keine Zeit erfasst. Starte den Timer an einem To-Do."),
    h("div", { class: "manual" }, h("span", { class: "muted small" }, "Nachtragen:"), dIn, mIn, tSel, h("button", { class: "btn small", onclick: addManual }, "Eintragen")));
}

function goalsBlock(v) {
  const goals = live("goals");
  if (!goals.length) return h("p", { class: "muted small" }, "Noch keine Ziele angelegt – unter ", h("a", { href: "#/strategie" }, "Strategie"), " kannst du 1-Jahres-Ziele und deine 10-Jahres-Vision anlegen und hier verknüpfen.");
  const ids = v.goalIds || [];
  return h("div", { class: "goal-chips" },
    goals.map((g) => {
      const on = ids.includes(g.id);
      return h("button", { class: "chip goal" + (on ? " on" : ""), title: on ? "Verknüpfung lösen" : "Mit Ziel verknüpfen",
        onclick: () => patch("vorhaben", v.id, { goalIds: on ? ids.filter((x) => x !== g.id) : [...ids, g.id] }) },
        h("span", { class: "goal-type" }, g.type === "10j" ? "10 J" : "1 J"), g.text || "Ziel");
    }));
}

export function docView(vid) {
  const v = byId("vorhaben", vid);
  if (!v) return h("div", { class: "empty-state" }, "Dieses Vorhaben gibt es nicht (mehr). ", h("a", { href: "#/board" }, "Zum Board"));

  const areaSel = h("select", { class: "sel small", value: v.areaId, "aria-label": "Bereich", onchange: (e) => patch("vorhaben", v.id, { areaId: e.target.value }) },
    areas().map((a) => h("option", { value: a.id }, a.name)));
  const gruppe = h("input", { class: "txt small", value: v.gruppe || "", placeholder: "Gruppe (z. B. Cognitex)", "aria-label": "Gruppe",
    onchange: (e) => patch("vorhaben", v.id, { gruppe: e.target.value.trim() }) });
  const dur = v.start && v.end ? diffDays(v.start, v.end) : null;
  const related = ["Idee", "Vorbereitung"].includes(v.status) ? relatedLessons(v) : [];

  const sections = [];
  FIELDS.forEach((f) => {
    sections.push(section("f-" + f.key, f.label, fieldEditor(v, f.key), { ui }));
    if (f.key === "naechste") {
      const open = todosOf(v.id).filter((t) => !t.done).length;
      sections.push(section("todos", "To-Dos", todosBlock(v), { ui, count: open || null }));
      sections.push(section("zeit", "Zeit", timeBlock(v), { ui }));
    }
    if (f.key === "strategie") sections.push(section("goals", "Verknüpfte Ziele", goalsBlock(v), { ui }));
    if (f.key === "ergebnis") sections.push(section("abschluss", "Sauberer Abschluss", abschlussBlock(v), { ui }));
  });

  return h("div", { class: "view-doc" },
    h("div", { class: "doc-top" },
      h("button", { class: "btn ghost", onclick: () => (history.length > 1 ? history.back() : go("#/board")) }, icon("back"), "Zurück"),
      h("div", { class: "spacer" }),
      timerButton({ vorhabenId: v.id, label: "Am Vorhaben arbeiten" })),
    h("div", { class: "doc-head card-like" },
      h("div", { class: "doc-meta" }, areaSel, gruppe, statusSelect(v), deadlineBadge(v)),
      titleEditor(v, { big: true }),
      h("div", { class: "doc-meta" },
        h("label", { class: "inline-field" }, "Laufzeit ab", h("input", { type: "date", class: "date-in", value: v.start || "", onchange: (e) => patch("vorhaben", v.id, { start: e.target.value }) })),
        h("label", { class: "inline-field" }, "bis", h("input", { type: "date", class: "date-in", value: v.end || "", onchange: (e) => patch("vorhaben", v.id, { end: e.target.value }) })),
        dur != null ? h("span", { class: "muted small" }, dur + " Tage") : null,
        v.status === "Idee" ? h("button", { class: "btn primary small", onclick: () => changeStatus(v.id, "Vorbereitung") }, "Zum Vorhaben befördern →") : null)),
    related.length ? h("div", { class: "related card-like" },
      h("div", { class: "related-title" }, "💡 Passende Learnings aus früheren Vorhaben"),
      related.map(({ o }) => h("details", { class: "related-item" },
        h("summary", null, o.title),
        h("div", { class: "rich", html: sanitize(o.fields.lessons) })))) : null,
    h("div", { class: "doc-sections" }, sections),
    h("div", { class: "doc-danger" },
      h("button", { class: "btn ghost danger-txt", onclick: async () => {
        if (await confirmDialog("Vorhaben „" + (v.title || "Ohne Titel").slice(0, 80) + "“ mit allen To-Dos löschen? Erfasste Zeiten bleiben erhalten.", { ok: "Löschen", danger: true })) {
          live("todos").filter((t) => t.vorhabenId === v.id).forEach((t) => removeItem("todos", t.id, { silent: true }));
          removeItem("vorhaben", v.id);
          go("#/board");
          toast("Vorhaben gelöscht");
        }
      } }, icon("trash"), "Vorhaben löschen")));
}
