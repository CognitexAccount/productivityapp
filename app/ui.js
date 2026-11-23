// Kleine UI-Bausteine: Element-Helfer, Icons, Toast, Dialoge.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "value") value = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "checked" || k === "disabled" || k === "selected" || k === "open") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === "") continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  if (value !== undefined) el.value = value;
  return el;
}

const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  timeline: '<path d="M4 6h9M8 12h12M4 18h7"/>',
  review: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15.5l2 2 4-4"/>',
  lessons: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  strategy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  drive: '<path d="M8.5 4h7l6 10.5-3.5 6h-12L2.5 14.5z"/><path d="M8.5 4l6.5 11M15.5 4L9 15M2.5 14.5h19"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  tracker: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M10 2h4"/>',
};
export function icon(name, cls) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "ic" + (cls ? " " + cls : ""));
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name] || "";
  return s;
}

export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = h("div", { id: "toast", role: "status" }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2800);
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const back = h("div", { class: "modal-back" });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.remove();
    document.removeEventListener("keydown", onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const box = h("div", { class: "modal" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "modal-head" },
      h("h3", null, title),
      h("button", { class: "icon-btn", "aria-label": "Schließen", onclick: close }, icon("close"))),
    h("div", { class: "modal-body" }, body),
    actions.length ? h("div", { class: "modal-foot" },
      actions.map((a) => h("button", { class: "btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : ""), onclick: () => a.onClick(close) }, a.label))) : null);
  back.append(box);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  document.body.append(back);
  document.addEventListener("keydown", onKey);
  // Fokus nur, wo ausdrücklich gewünscht (autofocus) – und nicht, wenn schon im Dialog geklickt/getippt wurde.
  // (Sonst klappt am Handy bei jedem Dialog die Tastatur auf.)
  const first = box.querySelector("[autofocus]");
  if (first) setTimeout(() => { if (!box.contains(document.activeElement)) first.focus(); }, 30);
  return close;
}

export function confirmDialog(text, { ok = "OK", danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title: "Bitte bestätigen",
      body: h("p", null, text),
      actions: [
        { label: "Abbrechen", onClick: (c) => { answered = true; resolve(false); c(); } },
        { label: ok, primary: !danger, danger, onClick: (c) => { answered = true; resolve(true); c(); } },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

export function isMobile() { return window.matchMedia("(max-width: 760px)").matches; }
