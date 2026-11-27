// Zeit erfassen ohne Timer: „Zeit nachtragen“ (von überall) und die Frage nach
// der Dauer beim Abhaken eines To-Dos, das nicht über den Timer lief.

import { h, modal, toast, confirmDialog, isMobile } from "./ui.js";
import { todayKey, fmtHM, fmtShort, addDays, parseKey, DEFAULT_EST, EST_OPTIONS } from "./model.js";
import { store, live, byId, patch, removeItem, addEntry, sortTodos, toggleTodo, minutesTodo, assignableProjects, vName, notify, stopTimer } from "./state.js";
import { cancelAlarm } from "./alarm.js";
import { ui } from "./nav.js";

function durationInputs(preset) {
  const hh = h("input", { type: "number", class: "num-in", min: "0", max: "24", value: String(Math.floor(preset / 60)), "aria-label": "Stunden", inputmode: "numeric" });
  const mm = h("input", { type: "number", class: "num-in", min: "0", max: "59", value: String(preset % 60), "aria-label": "Minuten", inputmode: "numeric" });
  const chips = h("div", { class: "row-wrap" },
    [5, 15, 30, 45, 60, 90, 120].map((m) => h("button", { type: "button", class: "chip" + (m === preset ? " on" : ""), onclick: (e) => {
      hh.value = Math.floor(m / 60); mm.value = m % 60;
      chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
      e.currentTarget.classList.add("on");
    } }, m < 60 ? m + " Min" : (m / 60).toLocaleString("de-DE") + " h")));
  const read = () => (parseInt(hh.value, 10) || 0) * 60 + (parseInt(mm.value, 10) || 0);
  return { hh, mm, chips, read };
}

export function openTimeEntry(preVid) {
  const vs = assignableProjects();
  if (!vs.length) { toast("Lege zuerst ein Vorhaben an."); return; }
  const has = (id) => vs.some((v) => v.id === id);
  const start = preVid && has(preVid) ? preVid : ui.lastVorhaben && has(ui.lastVorhaben) ? ui.lastVorhaben : vs[0].id;

  const vSel = h("select", { class: "sel", value: start, "aria-label": "Projekt" }, vs.map((v) => h("option", { value: v.id }, vName(v))));
  const tSel = h("select", { class: "sel", "aria-label": "To-Do" });
  const fillTodos = () => {
    tSel.replaceChildren(h("option", { value: "" }, "– ohne To-Do –"),
      sortTodos(live("todos").filter((t) => t.vorhabenId === vSel.value)).map((t) => h("option", { value: t.id }, (t.done ? "✓ " : "") + t.title)));
  };
  vSel.addEventListener("change", fillTodos);
  fillTodos();
  const date = h("input", { type: "date", class: "date-in", value: todayKey(), "aria-label": "Datum" });
  const d = durationInputs(30);
  const note = h("input", { class: "txt", placeholder: "z. B. Investoren-Call", "aria-label": "Notiz" });

  const save = (close) => {
    const min = d.read();
    if (min <= 0) { toast("Bitte eine Dauer größer als 0 angeben."); return; }
    ui.lastVorhaben = vSel.value;
    addEntry({ vorhabenId: vSel.value, todoId: tSel.value || null, date: date.value || todayKey(), min, note: note.value.trim() });
    close();
    toast(fmtHM(min) + " h nachgetragen");
  };
  modal({
    title: "Zeit nachtragen",
    body: h("div", { class: "form-grid" },
      h("label", { class: "f" }, h("span", null, "Projekt"), vSel),
      h("label", { class: "f" }, h("span", null, "To-Do (optional)"), tSel),
      h("div", { class: "f-row" },
        h("label", { class: "f" }, h("span", null, "Datum"), date),
        h("label", { class: "f" }, h("span", null, "Stunden"), d.hh),
        h("label", { class: "f" }, h("span", null, "Minuten"), d.mm)),
      d.chips,
      h("label", { class: "f" }, h("span", null, "Notiz (optional)"), note)),
    actions: [{ label: "Abbrechen", onClick: (c) => c() }, { label: "Eintragen", primary: true, onClick: save }],
  });
}

// Beim Abhaken ohne vorherigen Timer: kurz die tatsächliche Dauer erfragen
export function openDoneTime(t) {
  const booked = minutesTodo(t.id);
  const d = durationInputs(booked >= 1 ? 0 : t.est || DEFAULT_EST);
  let decided = false;
  const finish = (close, withTime) => {
    decided = true;
    const min = withTime ? d.read() : 0;
    if (withTime && min <= 0 && booked < 1) { toast("Bitte eine Dauer angeben – oder „Ohne Zeit abhaken“."); decided = false; return; }
    if (min > 0) {
      addEntry({ vorhabenId: t.vorhabenId, todoId: t.id, date: todayKey(), min });
      toast("Erledigt – " + fmtHM(min) + " h gebucht");
    } else toast("Erledigt");
    toggleTodo(t.id, true);
    close();
  };
  modal({
    title: booked >= 1 ? "Noch Zeit dazubuchen?" : "Wie lange hat das gedauert?",
    body: h("div", { class: "form-grid" },
      h("p", { class: "done-what" }, t.title),
      booked >= 1 ? h("p", { class: "muted small" }, "Bisher erfasst: " + fmtHM(booked) + " h. Trag hier nur die zusätzliche Zeit ein – oder hake ohne weitere Zeit ab.") : null,
      d.chips,
      h("div", { class: "f-row" },
        h("label", { class: "f" }, h("span", null, "Stunden"), d.hh),
        h("label", { class: "f" }, h("span", null, "Minuten"), d.mm))),
    actions: [
      { label: booked >= 1 ? "Ohne weitere Zeit abhaken" : "Ohne Zeit abhaken", onClick: (c) => finish(c, false) },
      { label: "Abhaken & buchen", primary: true, onClick: (c) => finish(c, true) },
    ],
    onClose: () => { if (!decided) notify(); }, // abgebrochen → Häkchen zurücksetzen
  });
}

// Fälligkeit eines To-Dos ändern (z. B. wenn es überfällig ist)
export function openDueEdit(t) {
  const tk = todayKey();
  const wd = parseKey(tk).getDay(); // 0 = So
  const monday = addDays(tk, ((8 - wd) % 7) || 7);
  const set = (close, due) => {
    const cur = byId("todos", t.id);
    if (!cur) { close(); return; }
    patch("todos", t.id, { due });
    close();
    toast(due ? "Fällig am " + fmtShort(due) : "Fälligkeit entfernt");
  };
  const date = h("input", { type: "date", class: "date-in", value: t.due || tk, "aria-label": "Fällig am" });
  let close;
  const quick = [["Heute", tk], ["Morgen", addDays(tk, 1)], ["Übermorgen", addDays(tk, 2)], ["Nächster Montag", monday], ["In 1 Woche", addDays(tk, 7)]];
  close = modal({
    title: "Fällig am …",
    body: h("div", { class: "form-grid" },
      h("p", { class: "done-what" }, t.title),
      t.due ? h("p", { class: "muted small" }, "Bisher: " + fmtShort(t.due) + (t.due < tk ? " (überfällig)" : "")) : null,
      h("div", { class: "row-wrap due-quick" }, quick.map(([lbl, k]) =>
        h("button", { type: "button", class: "chip" + (t.due === k ? " on" : ""), onclick: () => set(close, k) }, lbl + " · " + fmtShort(k)))),
      h("label", { class: "inline-field" }, "Anderes Datum", date)),
    actions: [
      t.due ? { label: "Ohne Datum", onClick: (c) => set(c, "") } : null,
      { label: "Übernehmen", primary: true, onClick: (c) => set(c, date.value || "") },
    ].filter(Boolean),
  });
}

// Aufgabe bearbeiten (Titel, Projekt, Fälligkeit, Zeitangabe) oder löschen
export function openTodoEdit(t) {
  const vs = assignableProjects();
  const cur = byId("vorhaben", t.vorhabenId);
  if (cur && !vs.some((v) => v.id === cur.id)) vs.unshift(cur); // z. B. abgeschlossenes Projekt
  const title = h("textarea", { class: "txt todo-edit-title", rows: Math.min(5, Math.max(2, Math.ceil((t.title || "").length / 38))), "aria-label": "Titel", autofocus: !isMobile() });
  title.value = t.title || "";
  const vSel = h("select", { class: "sel", "aria-label": "Projekt", value: t.vorhabenId }, vs.map((v) => h("option", { value: v.id }, vName(v))));
  const due = h("input", { type: "date", class: "date-in", value: t.due || "", "aria-label": "Fällig am" });
  const est = h("select", { class: "sel", "aria-label": "Zeitangabe", value: String(t.est || DEFAULT_EST) },
    Array.from(new Set([...EST_OPTIONS, t.est || DEFAULT_EST])).sort((a, b) => a - b).map((m) => h("option", { value: String(m) }, m + " Min")));
  const booked = minutesTodo(t.id);
  const save = (close) => {
    const val = title.value.replace(/\s+/g, " ").trim();
    if (!val) { title.focus(); toast("Der Titel darf nicht leer sein."); return; }
    if (!byId("todos", t.id)) { close(); return; }
    patch("todos", t.id, { title: val, vorhabenId: vSel.value, due: due.value || "", est: parseInt(est.value, 10) || DEFAULT_EST });
    close();
    toast("Aufgabe gespeichert");
  };
  const del = async (close) => {
    close();
    const ok = await confirmDialog("Aufgabe „" + (t.title || "").slice(0, 80) + "“ löschen?" + (booked >= 1 ? " Die erfasste Zeit (" + fmtHM(booked) + " h) bleibt beim Projekt erhalten." : ""), { ok: "Löschen", danger: true });
    if (!ok) return;
    const r = store.state.running;
    if (r && r.start && r.todoId === t.id) { cancelAlarm(); stopTimer(); }
    removeItem("todos", t.id);
    toast("Aufgabe gelöscht");
  };
  let close;
  title.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(close); } });
  close = modal({
    title: "Aufgabe bearbeiten",
    body: h("div", { class: "form-grid" },
      h("label", { class: "f" }, h("span", null, "Titel"), title),
      h("label", { class: "f" }, h("span", null, "Projekt"), vSel),
      h("div", { class: "f-row" },
        h("label", { class: "f" }, h("span", null, "Fällig am"), due),
        h("label", { class: "f" }, h("span", null, "Zeitangabe"), est)),
      booked >= 1 ? h("p", { class: "muted small" }, "Erfasste Zeit: " + fmtHM(booked) + " h") : null),
    actions: [
      { label: "Löschen", danger: true, onClick: del },
      { label: "Abbrechen", onClick: (c) => c() },
      { label: "Speichern", primary: true, onClick: save },
    ],
  });
}
