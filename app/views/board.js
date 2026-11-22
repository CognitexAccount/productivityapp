// Board: Vorhaben als Karten in Status-Spalten. WIP-Grenze für „Läuft“.

import { h, icon } from "../ui.js";
import { STATUS, STATUS_LABEL, fmtShort, fmtH } from "../model.js";
import { live, settings, areaName, todosOf, minutesOf, setSingleton } from "../state.js";
import { ui, openVorhaben, rerender } from "../nav.js";
import { statusSelect, deadlineBadge, preview, statusClass, changeStatus } from "../components.js";
import { openCapture } from "../capture.js";

const inArea = (v) => ui.area === "all" || v.areaId === ui.area;

function sortFor(s) {
  if (s === "Idee") return (a, b) => (b.created || 0) - (a.created || 0);
  if (s === "Abgeschlossen") return (a, b) => ((b.end || "") > (a.end || "") ? 1 : -1);
  return (a, b) => ((a.end || "9999") < (b.end || "9999") ? -1 : 1);
}

function card(v) {
  const open = todosOf(v.id).filter((t) => !t.done).length;
  const min = minutesOf(v.id);
  const killMissing = !preview((v.erfolg || {}).kill) && v.status !== "Idee" && v.status !== "Abgeschlossen";
  const dates = v.start || v.end ? (fmtShort(v.start) || "?") + " – " + (fmtShort(v.end) || "?") : "";
  const c = h("article", {
    class: "card", draggable: "true", tabindex: "0", "data-id": v.id,
    onclick: () => openVorhaben(v.id),
    onkeydown: (e) => { if (e.key === "Enter") openVorhaben(v.id); },
    ondragstart: (e) => { e.dataTransfer.setData("text/plain", v.id); e.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); },
    ondragend: () => c.classList.remove("dragging"),
  },
    h("div", { class: "card-top" },
      h("span", { class: "area-tag" }, areaName(v.areaId)),
      v.gruppe ? h("span", { class: "grp" }, v.gruppe) : null),
    h("div", { class: "card-title clamp4" }, v.title || "Ohne Titel"),
    h("div", { class: "card-meta" },
      dates ? h("span", { class: "meta-item" }, dates) : null,
      deadlineBadge(v),
      open ? h("span", { class: "meta-item" }, "☐ " + open) : null,
      min >= 1 ? h("span", { class: "meta-item" }, icon("clock"), fmtH(min)) : null,
      killMissing ? h("span", { class: "meta-item warn-txt", title: "Killkriterium fehlt" }, icon("warn"), "Kill") : null),
    h("div", { class: "card-actions", onclick: (e) => e.stopPropagation() },
      statusSelect(v, "small"),
      v.status === "Idee" ? h("button", { class: "btn small primary", onclick: () => changeStatus(v.id, "Vorbereitung") }, "Befördern →") : null));
  return c;
}

export function boardView() {
  const all = live("vorhaben").filter(inArea);
  const wip = settings().wipLimit || 3;
  const board = h("div", { class: "board" });

  STATUS.forEach((s) => {
    const items = all.filter((v) => v.status === s).sort(sortFor(s));
    const over = s === "Läuft" && items.length > wip;
    const col = h("section", { class: "col " + statusClass(s) + (over ? " over" : ""), "data-status": s, "aria-label": STATUS_LABEL[s] || s });
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop"); });
    col.addEventListener("drop", (e) => {
      e.preventDefault(); col.classList.remove("drop");
      const id = e.dataTransfer.getData("text/plain");
      if (id) changeStatus(id, s);
    });

    const head = h("div", { class: "col-head" },
      h("span", { class: "col-dot" }),
      h("span", { class: "col-title" }, STATUS_LABEL[s] || s),
      h("span", { class: "col-count" + (over ? " over" : "") }, s === "Läuft" ? items.length + " / " + wip : String(items.length)),
      s === "Läuft" ? h("button", { class: "link-btn small", title: "WIP-Grenze ändern", onclick: () => {
        const n = parseInt(prompt("Wie viele Vorhaben dürfen höchstens gleichzeitig laufen?", String(wip)), 10);
        if (n > 0) setSingleton("settings", { ...settings(), wipLimit: n });
      } }, "WIP") : null,
      s === "Idee" ? h("button", { class: "icon-btn ghost tiny", title: "Idee parken", "aria-label": "Idee parken", onclick: () => openCapture() }, icon("plus")) : null);
    col.append(head);
    if (over) col.append(h("div", { class: "wip-warn" }, icon("warn"), "Mehr als " + wip + " Vorhaben laufen parallel – Verzettelungsgefahr."));

    const list = h("div", { class: "col-list" });
    if (s === "Abgeschlossen" && !ui.boardDoneOpen && items.length) {
      list.append(h("button", { class: "link-btn", onclick: () => { ui.boardDoneOpen = true; rerender(); } }, items.length + " abgeschlossen – anzeigen"));
    } else {
      items.forEach((v) => list.append(card(v)));
      if (!items.length) list.append(h("div", { class: "col-empty" }, s === "Idee" ? "Noch keine Ideen geparkt." : "—"));
    }
    col.append(list);
    board.append(col);
  });
  return h("div", { class: "view-board" }, board);
}
