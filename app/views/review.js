// Wochenreview: Zeit pro Vorhaben (Soll/Ist), überfällige To-Dos, Vorhaben ohne
// Aktivität, Fristwächter und neue Ideen im Park.

import { h, icon } from "../ui.js";
import { todayKey, weekStartKey, addDays, fmtShort, fmtHM, fmtH, isoWeek, dateKey } from "../model.js";
import { live, byId, isActive, minutesOf, minutesRange, deadline, lastActivity, sortTodos } from "../state.js";
import { ui, rerender } from "../nav.js";
import { todoRow, vorhabenLink, section, deadlineBadge } from "../components.js";

const inArea = (v) => v && (ui.area === "all" || v.areaId === ui.area);

export function reviewView() {
  const tk = todayKey();
  const from = addDays(weekStartKey(tk), 7 * ui.reviewOffset), to = addDays(from, 6);
  const fromMs = new Date(from + "T00:00:00").getTime(), toMs = new Date(to + "T23:59:59").getTime();
  const vs = live("vorhaben").filter(inArea);

  const time = vs.map((v) => ({ v, min: minutesOf(v.id, from, to), target: v.weeklyTargetH ? v.weeklyTargetH * 60 : 0 }))
    .filter((x) => x.min >= 1 || (x.target && isActive(x.v)))
    .sort((a, b) => b.min - a.min);
  const max = Math.max(60, ...time.map((x) => Math.max(x.min, x.target)));
  const total = time.reduce((s, x) => s + x.min, 0);

  const todos = live("todos").filter((t) => inArea(byId("vorhaben", t.vorhabenId)));
  const overdue = sortTodos(todos.filter((t) => !t.done && t.due && t.due < tk));
  const doneWeek = todos.filter((t) => t.done && t.doneAt >= fromMs && t.doneAt <= toMs);
  const idle = vs.filter((v) => isActive(v) && Date.now() - lastActivity(v.id) > 14 * 864e5);
  const ideas = vs.filter((v) => v.status === "Idee" && v.created >= fromMs && v.created <= toMs);
  const watch = vs.filter((v) => deadline(v));

  const card = (num, lbl, cls) => h("div", { class: "stat " + (cls || "") }, h("div", { class: "stat-num" }, num), h("div", { class: "stat-lbl" }, lbl));

  return h("div", { class: "view-review" },
    h("div", { class: "toolbar" },
      h("button", { class: "btn ghost small", "aria-label": "Vorherige Woche", onclick: () => { ui.reviewOffset--; rerender(); } }, "‹"),
      h("strong", null, "KW " + isoWeek(from) + " · " + fmtShort(from) + " – " + fmtShort(to)),
      h("button", { class: "btn ghost small", "aria-label": "Nächste Woche", onclick: () => { ui.reviewOffset++; rerender(); } }, "›"),
      ui.reviewOffset ? h("button", { class: "btn ghost small", onclick: () => { ui.reviewOffset = 0; rerender(); } }, "Diese Woche") : null),
    h("div", { class: "stats" },
      card(fmtHM(minutesRange(from, to)) + " h", "erfasste Zeit"),
      card(String(doneWeek.length), "To-Dos erledigt"),
      card(String(overdue.length), "To-Dos überfällig", overdue.length ? "bad" : ""),
      card(String(ideas.length), "neue Ideen")),
    section("r-time", "Zeit pro Vorhaben (Ist / Soll)", time.length
      ? h("div", { class: "bars" }, time.map((x) => h("div", { class: "barrow" },
          h("div", { class: "bar-lbl clamp2" }, vorhabenLink(x.v)),
          h("div", { class: "bar" },
            h("span", { class: "bar-fill" + (x.target && x.min >= x.target ? " ok" : ""), style: { width: (x.min / max) * 100 + "%" } }),
            x.target ? h("span", { class: "bar-target", style: { left: (x.target / max) * 100 + "%" }, title: "Wochenziel " + fmtH(x.target) }) : null),
          h("div", { class: "bar-val num" }, fmtHM(x.min) + (x.target ? " / " + fmtHM(x.target) : "")))),
          h("div", { class: "muted small right" }, "Summe zugeordnet: " + fmtHM(total) + " h"))
      : h("p", { class: "muted small" }, "In dieser Woche wurde noch keine Zeit erfasst."), { ui }),
    section("r-watch", "Fristwächter", watch.length
      ? watch.map((v) => h("div", { class: "line-item" }, vorhabenLink(v), deadlineBadge(v), h("span", { class: "muted small" }, "bis " + fmtShort(v.end))))
      : h("p", { class: "muted small" }, "Alle Laufzeiten im Plan."), { ui, count: watch.length || null }),
    section("r-over", "Überfällige To-Dos", overdue.length ? overdue.map((t) => todoRow(t, { showVorhaben: true })) : h("p", { class: "muted small" }, "Keine. 👍"), { ui, count: overdue.length || null }),
    section("r-idle", "Aktive Vorhaben ohne Aktivität (14 Tage)", idle.length
      ? idle.map((v) => h("div", { class: "line-item" }, vorhabenLink(v), h("span", { class: "muted small" }, "zuletzt " + fmtShort(dateKey(new Date(lastActivity(v.id)))))))
      : h("p", { class: "muted small" }, "Alle aktiven Vorhaben haben sich bewegt."), { ui, count: idle.length || null }),
    section("r-ideas", "Neue Ideen im Park", ideas.length ? ideas.map((v) => h("div", { class: "line-item" }, icon("idea"), vorhabenLink(v))) : h("p", { class: "muted small" }, "Keine neuen Ideen in dieser Woche."), { ui, count: ideas.length || null }),
    section("r-done", "Erledigt in dieser Woche", doneWeek.length ? doneWeek.map((t) => todoRow(t, { showVorhaben: true })) : h("p", { class: "muted small" }, "Noch nichts abgehakt."), { ui, count: doneWeek.length || null }));
}
