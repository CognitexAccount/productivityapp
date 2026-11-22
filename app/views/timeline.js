// Zeitleiste: Laufzeiten als Balken. Zeigt Überlappungen (Verzettelungs-Check)
// und überzogene Laufzeiten.

import { h } from "../ui.js";
import { STATUS_LABEL, todayKey, addDays, diffDays, parseKey, dateKey, fmtShort, MONTHS } from "../model.js";
import { live, areas, isActive, deadline } from "../state.js";
import { ui, openVorhaben, rerender, persistUi } from "../nav.js";
import { statusClass } from "../components.js";

const RANGES = { "6m": [-2, 4], "9m": [-3, 6], "12m": [-4, 8] };

function monthStart(k, add) {
  const d = parseKey(k);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + add, 1));
}

export function timelineView() {
  const tk = todayKey();
  const vs = live("vorhaben").filter((v) => (ui.area === "all" || v.areaId === ui.area) && v.status !== "Idee");
  const dated = vs.filter((v) => v.start || v.end);
  let from, to;
  if (ui.tlRange === "alle" && dated.length) {
    const ks = dated.flatMap((v) => [v.start, v.end].filter(Boolean)).concat([tk]).sort();
    from = monthStart(ks[0], 0);
    to = monthStart(ks[ks.length - 1], 1);
  } else {
    const [a, b] = RANGES[ui.tlRange] || RANGES["9m"];
    from = monthStart(tk, a);
    to = monthStart(tk, b + 1);
  }
  const span = Math.max(1, diffDays(from, to));
  const pct = (k) => Math.max(0, Math.min(100, (diffDays(from, k) / span) * 100));

  const months = [];
  for (let k = from; k < to; k = monthStart(k, 1)) months.push(k);

  const parallel = vs.filter((v) => isActive(v) && (!v.start || v.start <= tk) && (!v.end || v.end >= tk)).length;

  const header = h("div", { class: "tl-row tl-header" },
    h("div", { class: "tl-label" }),
    h("div", { class: "tl-track" },
      months.map((m) => h("div", { class: "tl-month", style: { left: pct(m) + "%" } },
        MONTHS[parseKey(m).getMonth()] + (parseKey(m).getMonth() === 0 ? " " + m.slice(0, 4) : "")))));

  const body = h("div", { class: "tl-body" });
  const gridLines = () => months.map((m) => h("div", { class: "tl-line", style: { left: pct(m) + "%" } }));
  const todayLine = () => (tk >= from && tk <= to ? h("div", { class: "tl-today", style: { left: pct(tk) + "%" } }) : null);

  areas().filter((a) => ui.area === "all" || a.id === ui.area).forEach((a) => {
    const rows = dated.filter((v) => v.areaId === a.id).sort((x, y) => ((x.start || x.end) < (y.start || y.end) ? -1 : 1));
    if (!rows.length) return;
    body.append(h("div", { class: "tl-area" }, a.name));
    rows.forEach((v) => {
      const s = v.start || null, e = v.end || null;
      const dl = deadline(v);
      const track = h("div", { class: "tl-track" }, gridLines(), todayLine());
      if (s && e) {
        const left = pct(s), right = pct(e);
        track.append(h("div", { class: "tl-bar " + statusClass(v.status), style: { left: left + "%", width: Math.max(0.8, right - left) + "%" },
          title: fmtShort(s) + " – " + fmtShort(e) }));
        if (dl && dl.kind === "over" && tk > e) {
          track.append(h("div", { class: "tl-overrun", style: { left: right + "%", width: Math.max(0.5, pct(tk) - right) + "%" }, title: "überzogen seit " + fmtShort(e) }));
        }
      } else if (s) {
        const left = pct(s), right = pct(tk > s ? tk : s);
        track.append(h("div", { class: "tl-bar open " + statusClass(v.status), style: { left: left + "%", width: Math.max(0.8, right - left) + "%" }, title: "ab " + fmtShort(s) + " (kein Enddatum)" }));
      } else {
        track.append(h("div", { class: "tl-marker " + statusClass(v.status), style: { left: pct(e) + "%" }, title: "bis " + fmtShort(e) + " (kein Startdatum)" }));
      }
      body.append(h("div", { class: "tl-row" + (v.status === "Abgeschlossen" ? " is-done" : ""), onclick: () => openVorhaben(v.id), tabindex: "0",
        onkeydown: (ev) => { if (ev.key === "Enter") openVorhaben(v.id); } },
        h("div", { class: "tl-label" },
          h("div", { class: "clamp2" }, v.title || "Ohne Titel"),
          h("div", { class: "muted tiny-txt" }, (STATUS_LABEL[v.status] || v.status) + (dl && dl.kind === "over" ? " · Frist überschritten" : ""))),
        track));
    });
  });

  const undated = vs.filter((v) => !v.start && !v.end && v.status !== "Abgeschlossen");

  return h("div", { class: "view-timeline" },
    h("div", { class: "toolbar" },
      h("div", { class: "seg" }, ["6m", "9m", "12m", "alle"].map((r) =>
        h("button", { class: "seg-btn" + (ui.tlRange === r ? " on" : ""), onclick: () => { ui.tlRange = r; persistUi(); rerender(); } },
          r === "alle" ? "Alles" : r.replace("m", " Monate")))),
      h("div", { class: "spacer" }),
      h("div", { class: "parallel" + (parallel > 3 ? " warn" : "") },
        h("strong", null, String(parallel)), " Vorhaben heute parallel aktiv")),
    dated.length ? h("div", { class: "timeline card-like" }, header, body) : h("div", { class: "empty-state" }, "Noch keine Vorhaben mit Laufzeit."),
    undated.length ? h("div", { class: "card-like undated" },
      h("div", { class: "lbl" }, "Ohne Laufzeit"),
      undated.map((v) => h("button", { class: "chip", onclick: () => openVorhaben(v.id) }, v.title || "Ohne Titel"))) : null);
}
