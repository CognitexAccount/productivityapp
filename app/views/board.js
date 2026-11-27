// Board: Vorhaben als Karten in Status-Spalten. Status ändern per Drag & Drop.

import { h, icon } from "../ui.js";
import { STATUS, STATUS_LABEL, fmtShort, fmtH } from "../model.js";
import { projects, areaName, todosOf, minutesOf, vName } from "../state.js";
import { ui, openVorhaben } from "../nav.js";
import { deadlineBadge, statusClass, changeStatus } from "../components.js";
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
  const dates = v.start || v.end ? (fmtShort(v.start) || "?") + " – " + (fmtShort(v.end) || "?") : "";
  const c = h("article", {
    class: "card", draggable: "true", tabindex: "0", "data-id": v.id,
    onclick: () => openVorhaben(v.id),
    onkeydown: (e) => { if (e.key === "Enter") openVorhaben(v.id); },
    ondragstart: (e) => { e.dataTransfer.setData("text/plain", v.id); e.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); },
    ondragend: () => c.classList.remove("dragging"),
  },
    h("div", { class: "card-top" }, h("span", { class: "area-tag" }, areaName(v.areaId))),
    h("div", { class: "card-name" + ((v.name || "").trim() ? "" : " clamp3") }, (v.name || "").trim() || v.title || "Ohne Titel"),
    v.name && v.title ? h("div", { class: "card-title clamp3" }, v.title) : null,
    h("div", { class: "card-meta" },
      dates ? h("span", { class: "meta-item" }, dates) : null,
      deadlineBadge(v),
      open ? h("span", { class: "meta-item" }, "☐ " + open) : null,
      min >= 1 ? h("span", { class: "meta-item" }, icon("clock"), fmtH(min)) : null));
  return c;
}

export function boardView() {
  const all = projects().filter(inArea);
  const board = h("div", { class: "board" });

  STATUS.forEach((s) => {
    const items = all.filter((v) => v.status === s).sort(sortFor(s));
    const col = h("section", { class: "col " + statusClass(s), "data-status": s, "aria-label": STATUS_LABEL[s] || s });
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop"); });
    col.addEventListener("drop", (e) => {
      e.preventDefault(); col.classList.remove("drop");
      const id = e.dataTransfer.getData("text/plain");
      if (id) changeStatus(id, s);
    });
    col.append(h("div", { class: "col-head" },
      h("span", { class: "col-dot" }),
      h("span", { class: "col-title" }, STATUS_LABEL[s] || s),
      h("span", { class: "col-count" }, String(items.length)),
      s === "Idee" ? h("button", { class: "icon-btn ghost tiny", title: "Idee parken", "aria-label": "Idee parken", onclick: () => openCapture() }, icon("plus")) : null));
    const list = h("div", { class: "col-list" });
    items.forEach((v) => list.append(card(v)));
    if (!items.length) list.append(h("div", { class: "col-empty" }, s === "Idee" ? "Noch keine Ideen geparkt." : "—"));
    col.append(list);
    board.append(col);
  });
  return h("div", { class: "view-board" }, board);
}
