// Bausteine, die mehrere Ansichten teilen.

import { h, icon, toast } from "./ui.js";
import { STATUS, STATUS_LABEL, EST_OPTIONS, DEFAULT_EST, fmtShort, fmtHM, fmtClock, todayKey, diffDays } from "./model.js";
import { ensureAudio, scheduleAlarm, cancelAlarm, askNotify, unlockAudio } from "./alarm.js";
import { store, byId, deadline, minutesTodo, toggleTodo, startTimer, stopTimer, pauseTimer, resumeTimer, elapsedMs, remainingMs, countdownEnd, patch, removeItem, vName } from "./state.js";
import { openDoneTime } from "./timeentry.js";
import { openVorhaben, persistUi } from "./nav.js";
import { onlyHeadings } from "./editor.js";

const T = () => window.TextKit;

export const statusClass = (s) => "st-" + STATUS.indexOf(s);
export function statusPill(s) {
  return h("span", { class: "pill " + statusClass(s) }, STATUS_LABEL[s] || s);
}

let statusChanger = null; // wird von main.js gesetzt (Abschluss-Assistent etc.)
export const setStatusChanger = (fn) => { statusChanger = fn; };
export const changeStatus = (vid, status) => statusChanger(vid, status);

export function statusSelect(v, cls) {
  return h("select", {
    class: "status-sel " + statusClass(v.status) + (cls ? " " + cls : ""), "aria-label": "Status",
    value: v.status, onclick: (e) => e.stopPropagation(), onchange: (e) => changeStatus(v.id, e.target.value),
  }, STATUS.map((s) => h("option", { value: s }, STATUS_LABEL[s] || s)));
}

export function deadlineBadge(v) {
  const d = deadline(v);
  if (!d) return null;
  if (d.kind === "over") return h("span", { class: "badge danger", title: "Laufzeit bis " + fmtShort(v.end) + " überschritten" }, icon("warn"), "Frist +" + d.days + " T");
  return h("span", { class: "badge warn", title: "Laufzeit endet bald" }, d.days === 0 ? "endet heute" : "endet in " + d.days + " T");
}

// Vorschau eines Rich-Text-Feldes als Klartext
export function preview(html) {
  if (!html || onlyHeadings(html)) return "";
  return T().htmlToText(html);
}

export function dueClass(due, done) {
  if (!due || done) return "";
  const d = diffDays(todayKey(), due);
  return d < 0 ? "over" : d === 0 ? "today" : d <= 2 ? "soon" : "";
}

export function isRunning(todoId, vorhabenId) {
  const r = store.state.running;
  if (!r || !r.start) return false;
  if (todoId) return r.todoId === todoId;
  return r.vorhabenId === vorhabenId && !r.todoId;
}

// Timer starten: mit dur (Sekunden) als Countdown inkl. eingeplantem Signalton,
// ohne dur als offene Stoppuhr.
export function startTimerUI({ vorhabenId, todoId = null, dur = null }) {
  startTimer({ vorhabenId, todoId, dur });
  if (dur) {
    ensureAudio();
    unlockAudio();
    scheduleAlarm(countdownEnd());
    askNotify();
    const r = store.state.running;
    toast(r.offsetMs ? "Weiter bei „noch " + runClock(r) + "“" : "Countdown läuft – " + Math.round(dur / 60) + " Min");
  } else {
    cancelAlarm();
    toast("Stoppuhr läuft");
  }
}
export function stopTimerUI() {
  cancelAlarm();
  const r = stopTimer();
  if (r && r.entry) toast("Gestoppt – " + fmtHM(r.min) + " h gebucht");
  else toast("Gestoppt");
}

export function timerButton({ todoId = null, vorhabenId, dur = null, big = false, label }) {
  const on = isRunning(todoId, vorhabenId);
  return h("button", {
    class: "play" + (on ? " on" : "") + (big ? " big" : ""),
    title: on ? "Timer stoppen" : dur ? "Countdown starten (" + Math.round(dur / 60) + " Min)" : "Stoppuhr starten",
    "aria-label": on ? "Timer stoppen" : "Timer starten",
    onclick: (e) => {
      e.stopPropagation();
      if (on) stopTimerUI();
      else startTimerUI({ vorhabenId, todoId, dur });
    },
  }, icon(on ? "stop" : "play"), label ? h("span", null, on ? "Stopp" : label) : null);
}

// Anzeige des laufenden Timers: Countdown (Restzeit) oder Stoppuhr (gelaufene Zeit), ohne Pausen
export function runClock(r) {
  // Countdown aufrunden (wie eine Küchenuhr: „4:00“ direkt nach dem Start einer Minute), Stoppuhr abrunden
  return r.dur ? fmtClock(Math.ceil(remainingMs(r) / 1000)) : fmtClock(elapsedMs(r) / 1000);
}
export function runText(r) {
  return (r.pausedAt ? "pausiert · " : "") + (r.dur ? "noch " : "") + runClock(r);
}
export const runPct = (r) => (r.dur ? Math.min(100, (((r.offsetMs || 0) + elapsedMs(r)) / (r.dur * 1000)) * 100) : 0);

export function pauseButton({ big = false } = {}) {
  const r = store.state.running;
  if (!r || !r.start) return null;
  const paused = !!r.pausedAt;
  return h("button", {
    class: "play pause" + (paused ? " paused" : "") + (big ? " big" : ""),
    title: paused ? "Weiter" : "Pause", "aria-label": paused ? "Timer fortsetzen" : "Timer pausieren",
    onclick: (e) => {
      e.stopPropagation();
      if (paused) {
        resumeTimer();
        const end = countdownEnd();
        if (end) { ensureAudio(); scheduleAlarm(end); }
        toast("Weiter geht's");
      } else {
        pauseTimer();
        cancelAlarm();
        toast("Pausiert – die Pause wird nicht gebucht");
      }
    },
  }, icon(paused ? "play" : "pause"), h("span", null, paused ? "Weiter" : "Pause"));
}

export function estSelect(value, onchange, attrs) {
  return h("select", { class: "est-sel", title: "Zeitangabe für das To-Do", "aria-label": "Zeitangabe", value: String(value || DEFAULT_EST),
    onclick: (e) => e.stopPropagation(), onchange: (e) => onchange(parseInt(e.target.value, 10)), ...(attrs || {}) },
    EST_OPTIONS.map((m) => h("option", { value: String(m) }, m + " Min")));
}

// Abhaken: läuft der Timer daran, wird er gestoppt und gebucht; wurde noch keine
// Zeit erfasst, fragt ein kurzes Feld nach der Dauer.
export function completeTodo(t) {
  if (isRunning(t.id)) { stopTimerUI(); toggleTodo(t.id, true); return; }
  if (minutesTodo(t.id) < 1) { openDoneTime(t); return; }
  toggleTodo(t.id, true);
}

export function todoRow(t, { showVorhaben = false, editable = false } = {}) {
  const v = byId("vorhaben", t.vorhabenId);
  const progress = !t.done && !isRunning(t.id) ? t.progressMs || 0 : 0;
  const min = minutesTodo(t.id);
  const title = editable
    ? h("input", {
        class: "todo-input", value: t.title, "data-live-edit": "1", "aria-label": "To-Do",
        onchange: (e) => { const val = e.target.value.trim(); if (val) patch("todos", t.id, { title: val }); },
        onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); },
      })
    : h("div", { class: "todo-title" }, t.title);
  return h("div", { class: "todo" + (t.done ? " done" : "") + (isRunning(t.id) ? " running" : "") },
    h("label", { class: "chk" },
      h("input", { type: "checkbox", checked: !!t.done, "aria-label": "Erledigt", onchange: (e) => (e.target.checked ? completeTodo(t) : toggleTodo(t.id, false)) }),
      h("span")),
    h("div", { class: "todo-main" },
      title,
      showVorhaben && v ? (v.system ? h("span", { class: "todo-v" }, vName(v)) : h("a", { class: "todo-v", href: "#/v/" + v.id }, vName(v))) : null),
    editable
      ? h("input", { type: "date", class: "date-in small", value: t.due || "", "aria-label": "Fällig", onchange: (e) => patch("todos", t.id, { due: e.target.value }) })
      : t.due ? h("span", { class: "due " + dueClass(t.due, t.done) }, fmtShort(t.due)) : null,
    min >= 1 ? h("span", { class: "todo-min", title: "Erfasste Zeit" }, fmtHM(min)) : null,
    progress > 0 ? h("span", { class: "todo-progress", title: "Angefangen – der Countdown läuft beim nächsten Start hier weiter" },
      "noch " + fmtClock(Math.ceil(((t.est || DEFAULT_EST) * 60000 - progress) / 1000))) : null,
    estSelect(t.est, (m) => patch("todos", t.id, { est: m })),
    !t.done && v ? timerButton({ todoId: t.id, vorhabenId: t.vorhabenId, dur: (t.est || DEFAULT_EST) * 60 }) : null,
    editable ? h("button", { class: "icon-btn ghost", title: "To-Do löschen", "aria-label": "To-Do löschen", onclick: () => removeItem("todos", t.id) }, icon("trash")) : null);
}

export function vorhabenLink(v) {
  if (v.system) return h("span", { class: "vlink" }, vName(v));
  return h("a", { class: "vlink", href: "#/v/" + v.id, title: v.title || "", onclick: (e) => { e.preventDefault(); openVorhaben(v.id); } }, vName(v));
}

export function section(key, title, content, { ui, extra, count } = {}) {
  const collapsed = ui && ui.collapsed[key];
  const det = h("details", { class: "sec", open: !collapsed, "data-key": key },
    h("summary", null, h("span", { class: "sec-title" }, title), count != null ? h("span", { class: "sec-count" }, count) : null, extra || null),
    h("div", { class: "sec-body" }, content));
  det.addEventListener("toggle", () => { if (ui) { ui.collapsed[key] = !det.open; persistUi(); } });
  return det;
}
