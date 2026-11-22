// Rich-Text-Editor (contenteditable) mit Werkzeugleiste.
// Unterstützt: Fett, Kursiv, Zwischenüberschrift, Aufzählung, nummerierte Liste,
// Checkliste, Links. Markdown-Kürzel am Zeilenanfang: "- " / "* " → Aufzählung,
// "1. " → Nummerierung, "[] " → Checkliste.

import { h, icon } from "./ui.js";

const ALLOWED = new Set(["P", "BR", "B", "I", "U", "H3", "H4", "UL", "OL", "LI", "A"]);

export function sanitize(html) {
  const doc = new DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
  const out = document.createElement("div");
  (function walk(src, dst) {
    for (const n of Array.from(src.childNodes)) {
      if (n.nodeType === 3) { const t = n.textContent.replace(/​/g, ""); if (t) dst.append(t); continue; }
      if (n.nodeType !== 1) continue;
      let tag = n.tagName;
      if (tag === "DIV") tag = "P";
      if (tag === "STRONG") tag = "B";
      if (tag === "EM") tag = "I";
      if (tag === "H1" || tag === "H2") tag = "H3";
      if (tag === "H5" || tag === "H6") tag = "H4";
      if (!ALLOWED.has(tag)) { walk(n, dst); continue; }
      // Block in Block (z. B. <p> in <p>) vermeiden
      if (tag === "P" && dst.closest && dst.closest("p,h3,h4,li")) { walk(n, dst); if (n.nextSibling) dst.append(document.createElement("br")); continue; }
      const el = document.createElement(tag);
      if (tag === "A") {
        const href = n.getAttribute("href") || "";
        if (!/^(https?:|mailto:)/i.test(href)) { walk(n, dst); continue; }
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
      if (tag === "UL" && n.classList.contains("cl")) el.className = "cl";
      if (tag === "LI" && (n.hasAttribute("data-c") || (dst.tagName === "UL" && dst.classList.contains("cl")))) {
        el.setAttribute("data-c", n.getAttribute("data-c") === "1" ? "1" : "0");
      }
      walk(n, el);
      dst.append(el);
    }
  })(doc.body, out);
  if (!out.textContent.trim() && !out.querySelector("li")) return "";
  return out.innerHTML.trim();
}

// Gliederung aus Leitfragen: Überschrift + leerer Absatz je Frage
export function outlineHtml(hints) {
  return hints.map((q) => "<h4>" + window.TextKit.esc(q) + "</h4><p><br></p>").join("");
}
// Enthält das Feld nur die Gliederung (Überschriften), aber noch keinen eigenen Text?
export function onlyHeadings(html) {
  if (!html) return true;
  const d = document.createElement("div");
  d.innerHTML = html;
  d.querySelectorAll("h3,h4").forEach((x) => x.remove());
  return !d.textContent.trim() && !d.querySelector("li");
}

function blockOf(node, root) {
  let n = node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== root) {
    if (/^(P|H3|H4|LI|DIV)$/.test(n.tagName)) return n;
    n = n.parentNode;
  }
  return null;
}

export function editor({ html = "", onChange, placeholder = "", minHeight, autofocus }) {
  const area = h("div", { class: "rte-area", contenteditable: "true", spellcheck: "true", "data-ph": placeholder, "data-live-edit": "1" });
  if (minHeight) area.style.minHeight = minHeight;
  area.innerHTML = sanitize(html);
  let last = sanitize(html), timer = null;

  const isEmpty = () => !area.textContent.trim() && !area.querySelector("li");
  const refreshEmpty = () => area.classList.toggle("empty", isEmpty());
  refreshEmpty();

  function commit() {
    clearTimeout(timer);
    const v = sanitize(area.innerHTML);
    if (v !== last) { last = v; onChange && onChange(v); }
  }
  const later = () => { refreshEmpty(); clearTimeout(timer); timer = setTimeout(commit, 450); };

  function exec(cmd, arg) {
    if (document.activeElement !== area) area.focus();
    document.execCommand(cmd, false, arg);
    later();
  }
  function selectionList() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.getRangeAt(0).startContainer;
    while (n && n !== area) { if (n.tagName === "UL" || n.tagName === "OL") return n; n = n.parentNode; }
    return null;
  }
  function makeChecklist() {
    let list = selectionList();
    if (!list || list.tagName !== "UL") { exec("insertUnorderedList"); list = selectionList(); }
    if (!list) return;
    if (list.classList.contains("cl")) {
      list.classList.remove("cl");
      list.querySelectorAll(":scope > li").forEach((li) => li.removeAttribute("data-c"));
    } else {
      list.classList.add("cl");
      list.querySelectorAll(":scope > li").forEach((li) => { if (!li.hasAttribute("data-c")) li.setAttribute("data-c", "0"); });
    }
    later();
  }
  function toggleHeading() {
    const sel = getSelection();
    const b = sel.rangeCount ? blockOf(sel.getRangeAt(0).startContainer, area) : null;
    exec("formatBlock", b && b.tagName === "H4" ? "P" : "H4");
  }
  function addLink() {
    const sel = getSelection();
    const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const url = prompt("Link-Adresse (https://…):", "https://");
    if (!url || !/^(https?:|mailto:)/i.test(url.trim())) return;
    area.focus();
    if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
    if (sel.isCollapsed) document.execCommand("insertHTML", false, '<a href="' + url.trim().replace(/"/g, "%22") + '">' + window.TextKit.esc(url.trim()) + "</a>&nbsp;");
    else document.execCommand("createLink", false, url.trim());
    later();
  }

  const btn = (label, title, fn, cls) =>
    h("button", { type: "button", class: "rte-btn" + (cls ? " " + cls : ""), title, "aria-label": title, onmousedown: (e) => { e.preventDefault(); fn(); } }, label);
  const bar = h("div", { class: "rte-bar" },
    btn(h("b", null, "B"), "Fett (Strg+B)", () => exec("bold")),
    btn(h("i", null, "I"), "Kursiv (Strg+I)", () => exec("italic")),
    btn("H", "Zwischenüberschrift", toggleHeading),
    btn("•", "Aufzählung (oder „- “ tippen)", () => exec("insertUnorderedList")),
    btn("1.", "Nummerierte Liste (oder „1. “ tippen)", () => exec("insertOrderedList")),
    btn("☑", "Checkliste (oder „[] “ tippen)", makeChecklist),
    btn("🔗", "Link einfügen", addLink),
    btn("⌫", "Formatierung entfernen", () => exec("removeFormat"), "muted"));

  area.addEventListener("focus", () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* alt */ } });
  area.addEventListener("input", later);
  area.addEventListener("blur", commit);

  // Markdown-Kürzel am Zeilenanfang
  area.addEventListener("keydown", (e) => {
    if (e.key !== " ") return;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const r = sel.getRangeAt(0), node = r.startContainer;
    if (node.nodeType !== 3) return;
    const before = node.textContent.slice(0, r.startOffset);
    if (!["-", "*", "•", "1.", "[]"].includes(before)) return;
    const block = blockOf(node, area);
    if (block && block.tagName === "LI") return;
    const first = block ? block.firstChild === node : node.parentNode === area;
    if (!first) return;
    e.preventDefault();
    node.textContent = node.textContent.slice(r.startOffset) || "​";
    const nr = document.createRange();
    nr.setStart(node, 0); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    if (before === "1.") exec("insertOrderedList");
    else if (before === "[]") makeChecklist();
    else exec("insertUnorderedList");
  });

  // Checkbox abhaken (Klick auf das Kästchen vor dem Listenpunkt)
  area.addEventListener("click", (e) => {
    const li = e.target.closest && e.target.closest("ul.cl > li");
    if (!li || e.target !== li) return;
    const x = e.clientX - li.getBoundingClientRect().left;
    if (x > 26) return;
    li.setAttribute("data-c", li.getAttribute("data-c") === "1" ? "0" : "1");
    commit();
  });

  // Links: außerhalb der Bearbeitung (oder mit Strg/⌘) direkt öffnen
  area.addEventListener("mousedown", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (document.activeElement !== area || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.open(a.href, "_blank", "noopener");
    }
  });

  // Einfügen als sauberer Text (Listen/Absätze bleiben erhalten)
  area.addEventListener("paste", (e) => {
    const text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (text == null) return;
    e.preventDefault();
    if (!/\n/.test(text)) document.execCommand("insertText", false, text);
    else document.execCommand("insertHTML", false, window.TextKit.textToHtml(text, { headings: false }));
    later();
  });

  const box = h("div", { class: "rte" }, bar, area);
  box.setValue = (v) => { area.innerHTML = sanitize(v); last = sanitize(v); refreshEmpty(); };
  box.focusEnd = () => {
    area.focus();
    const r = document.createRange();
    r.selectNodeContents(area); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  if (autofocus) setTimeout(() => box.focusEnd(), 40);
  return box;
}

// Einzeiliges/mehrzeiliges Klartextfeld (für Titel), wächst mit dem Inhalt
export function autoText({ value = "", onChange, placeholder = "", cls = "" }) {
  const ta = h("textarea", { class: "autotext " + cls, rows: 1, placeholder, "data-live-edit": "1" });
  ta.value = value || "";
  const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  let last = ta.value, t;
  const commit = () => { clearTimeout(t); const v = ta.value.trim(); if (v !== last) { last = v; onChange(v); } };
  ta.addEventListener("input", () => { fit(); clearTimeout(t); t = setTimeout(commit, 450); });
  ta.addEventListener("blur", commit);
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.blur(); } });
  requestAnimationFrame(fit);
  return ta;
}

export { icon };
