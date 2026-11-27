// Export: Vorhaben als PDF (herunterladen, teilen, direkt in Google Drive)
// und Zeiteinträge als CSV für Excel.
//
// PDF: pdfmake (liegt unter /vendor, wird erst beim ersten Export geladen) –
// echter, durchsuchbarer Text statt Bild.
// Google Drive: Ist am Vercel-Projekt GOOGLE_CLIENT_ID gesetzt, lädt die App das
// PDF per Google-Anmeldung (Scope drive.file) direkt in den Drive-Ordner
// „Projektsystem“. Ohne Client-ID wird das System-Teilen-Menü genutzt (am Handy
// lässt sich dort Google Drive wählen).

import { h, modal, toast } from "./ui.js";
import { FIELDS, ERFOLG_PARTS, STATUS_LABEL, DEFAULT_EST, todayKey, fmtDate, fmtShort, fmtH, fmtHM } from "./model.js";
import { byId, live, areaName, todosOf, minutesOf, store, vName } from "./state.js";
import { sanitize } from "./editor.js";

/* ── Hilfen ── */
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error("Konnte " + src + " nicht laden")); };
      document.head.append(s);
    });
  }
  return loaded[src];
}
const loadPdfMake = () => loadScript("/vendor/pdfmake/pdfmake.min.js").then(() => loadScript("/vendor/pdfmake/vfs_fonts.js"));

let configPromise = null;
export function getConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return configPromise;
}
// Google-Skript vorab laden, damit die Anmeldung direkt im Klick starten kann (sonst Popup-Blocker)
export function preloadDrive() {
  getConfig().then((c) => { if (c.googleClientId) loadScript("https://accounts.google.com/gsi/client").catch(() => {}); });
}

function fileName(v) {
  const base = (vName(v) || "Vorhaben").replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  return base + " – " + todayKey() + ".pdf";
}
// Für Downloads: nur ASCII – manche Browser verwerfen sonst den Namen und speichern als „download“
function safeName(name) {
  return name.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[„“”]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim() || "export";
}

/* ── Rich Text → pdfmake ── */
function runs(node) {
  const out = [];
  (function walk(n, style) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.textContent) out.push({ text: c.textContent, ...style }); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName;
      if (t === "BR") { out.push({ text: "\n" }); continue; }
      if (t === "UL" || t === "OL") continue; // verschachtelte Listen werden separat behandelt
      const st = { ...style };
      if (t === "B" || t === "STRONG") st.bold = true;
      if (t === "I" || t === "EM") st.italics = true;
      if (t === "U") st.decoration = "underline";
      if (t === "A") { st.link = c.getAttribute("href"); st.color = "#2f6fde"; st.decoration = "underline"; }
      walk(c, st);
    }
  })(node, {});
  return out.length ? out : [{ text: "" }];
}
function listItems(list) {
  const cl = list.classList.contains("cl");
  return Array.from(list.children).filter((li) => li.tagName === "LI").map((li) => {
    const text = cl ? [{ text: li.getAttribute("data-c") === "1" ? "[x] " : "[  ] ", bold: true }, ...runs(li)] : runs(li);
    const nested = li.querySelector(":scope > ul, :scope > ol");
    if (!nested) return { text };
    return { stack: [{ text }, listBlock(nested)] };
  });
}
function listBlock(list) {
  if (list.classList.contains("cl")) return { stack: listItems(list), margin: [2, 0, 0, 5] };
  return { [list.tagName === "OL" ? "ol" : "ul"]: listItems(list), margin: [0, 0, 0, 5] };
}
function blocks(html) {
  const d = document.createElement("div");
  d.innerHTML = sanitize(html);
  const out = [];
  for (const n of d.childNodes) {
    if (n.nodeType === 3) { if (n.textContent.trim()) out.push({ text: n.textContent, margin: [0, 0, 0, 5] }); continue; }
    if (n.nodeType !== 1) continue;
    if (n.tagName === "UL" || n.tagName === "OL") out.push(listBlock(n));
    else if (n.tagName === "H3" || n.tagName === "H4") out.push({ text: runs(n), style: "sub" });
    else out.push({ text: runs(n), margin: [0, 0, 0, 5] });
  }
  return out;
}

/* ── PDF eines Vorhabens ── */
export async function buildPdf(vid) {
  await loadPdfMake();
  const v = byId("vorhaben", vid);
  if (!v) throw new Error("Vorhaben nicht gefunden");
  const content = [];
  content.push({ text: areaName(v.areaId), style: "crumb" });
  content.push({ text: vName(v), style: "title" });
  if (v.name && v.title) content.push({ text: [{ text: "Hypothese: ", bold: true }, v.title], margin: [0, 0, 0, 10] });
  const total = minutesOf(v.id);
  const meta = [
    ["Status", STATUS_LABEL[v.status] || v.status],
    ["Laufzeit", (v.start ? fmtDate(v.start) : "–") + "  bis  " + (v.end ? fmtDate(v.end) : "–")],
    ["Investierte Zeit", fmtH(total)],
  ];
  content.push({ table: { widths: [110, "*"], body: meta.map(([k, val]) => [{ text: k, style: "metaKey" }, { text: val }]) }, layout: "noBorders", margin: [0, 0, 0, 12] });

  const section = (label, body) => { content.push({ text: label, style: "h2" }); content.push(...body); };
  const todos = todosOf(v.id);

  if (todos.length) {
    section("To-Dos", [{
      table: {
        headerRows: 1, widths: [20, "*", 48, 52, 46],
        body: [
          [{ text: "", style: "th" }, { text: "Aufgabe", style: "th" }, { text: "Dauer", style: "th" }, { text: "Fällig", style: "th" }, { text: "Erfasst", style: "th" }],
          ...todos.map((t) => {
            const m = live("timeEntries").filter((e) => e.todoId === t.id).reduce((s, e) => s + (e.min || 0), 0);
            return [{ text: t.done ? "[x]" : "[  ]", bold: true, color: t.done ? "#1f9d57" : "#8a929e" }, { text: t.title, decoration: t.done ? "lineThrough" : undefined, color: t.done ? "#888" : undefined },
              (t.est || DEFAULT_EST) + " Min", t.due ? fmtShort(t.due) : "–", m >= 1 ? fmtHM(m) + " h" : "–"];
          }),
        ],
      },
      layout: "lightHorizontalLines", margin: [0, 2, 0, 6],
    }]);
  }

  FIELDS.forEach((f) => {
    if (f.special === "erfolg") {
      const parts = ERFOLG_PARTS.filter((p) => (v.erfolg || {})[p.key]);
      if (parts.length) section(f.label, parts.flatMap((p) => [{ text: p.label, style: "sub" }, ...blocks(v.erfolg[p.key])]));
      return;
    }
    const html = (v.fields || {})[f.key];
    if (html) section(f.label, blocks(html));
  });

  const docDef = {
    info: { title: vName(v), creator: "Projektsystem" },
    pageSize: "A4", pageMargins: [50, 50, 50, 60],
    content,
    footer: (page, count) => ({ text: "Projektsystem · Stand " + fmtDate(todayKey()) + " · Seite " + page + " von " + count, alignment: "center", fontSize: 8, color: "#8a929e", margin: [0, 18, 0, 0] }),
    defaultStyle: { fontSize: 10.5, lineHeight: 1.25, color: "#1a1f29" },
    styles: {
      crumb: { fontSize: 9, color: "#6b7482", margin: [0, 0, 0, 4] },
      title: { fontSize: 17, bold: true, lineHeight: 1.2, margin: [0, 0, 0, 10] },
      metaKey: { color: "#6b7482" },
      h2: { fontSize: 13, bold: true, color: "#2f6fde", margin: [0, 12, 0, 5] },
      sub: { bold: true, margin: [0, 5, 0, 2] },
      th: { bold: true, color: "#6b7482", fontSize: 9 },
    },
  };
  return { pdf: window.pdfMake.createPdf(docDef), name: fileName(v) };
}

const asBlob = (pdf) => new Promise((res) => pdf.getBlob(res));
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadPdf(vid) {
  const { pdf, name } = await buildPdf(vid);
  saveBlob(await asBlob(pdf), safeName(name));
  toast("PDF wird heruntergeladen");
}

/* ── Google Drive ── */
let token = null; // { value, exp }
function requestToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) { reject(new Error("Google-Anmeldung noch nicht geladen – bitte gleich noch einmal tippen.")); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (r) => {
        if (r.error) { reject(new Error(r.error_description || r.error)); return; }
        token = { value: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (e) => reject(new Error((e && (e.message || e.type)) || "Anmeldung abgebrochen")),
    });
    client.requestAccessToken({ prompt: token ? "" : "consent" });
  });
}
async function driveFetch(url, opts, tok) {
  const r = await fetch(url, { ...opts, headers: { ...(opts && opts.headers), Authorization: "Bearer " + tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Google Drive antwortete mit " + r.status);
  return j;
}
async function driveFolder(tok) {
  const KEY = "projektsystem_drive_folder";
  let id = null;
  try { id = localStorage.getItem(KEY); } catch (e) { /* egal */ }
  if (id) {
    try { const f = await driveFetch("https://www.googleapis.com/drive/v3/files/" + id + "?fields=id,trashed", {}, tok); if (!f.trashed) return id; } catch (e) { /* neu anlegen */ }
  }
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='Projektsystem' and trashed=false");
  const found = await driveFetch("https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id)", {}, tok);
  id = found.files && found.files[0] ? found.files[0].id : null;
  if (!id) {
    const made = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Projektsystem", mimeType: "application/vnd.google-apps.folder" }),
    }, tok);
    id = made.id;
  }
  try { localStorage.setItem(KEY, id); } catch (e) { /* egal */ }
  return id;
}

export async function sendToDrive(vid) {
  const cfg = await getConfig();
  if (cfg.googleClientId) {
    // Anmeldung zuerst (muss im Klick passieren), dann PDF erzeugen und hochladen
    const tok = token && token.exp > Date.now() + 60000 ? token.value : await requestToken(cfg.googleClientId);
    toast("Lade nach Google Drive hoch …");
    const { pdf, name } = await buildPdf(vid);
    const blob = await asBlob(pdf);
    const folder = await driveFolder(tok);
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify({ name, mimeType: "application/pdf", parents: [folder] })], { type: "application/json" }));
    form.append("file", blob, name);
    const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", body: form }, tok);
    modal({
      title: "In Google Drive gespeichert",
      body: h("div", null, h("p", null, "„" + name + "“ liegt jetzt im Drive-Ordner „Projektsystem“."),
        res.webViewLink ? h("a", { class: "btn primary", href: res.webViewLink, target: "_blank", rel: "noopener" }, "In Google Drive öffnen ↗") : null),
    });
    return "drive";
  }
  // Ohne Google-Client-ID: Teilen-Menü des Systems (am Handy → Google Drive wählbar)
  const { pdf, name } = await buildPdf(vid);
  const blob = await asBlob(pdf);
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return "share"; }
    catch (e) { if (e && e.name === "AbortError") return "abort"; }
  }
  saveBlob(blob, safeName(name));
  modal({
    title: "An Google Drive senden",
    body: h("div", null,
      h("p", null, "Dieser Browser kann Dateien nicht direkt an Google Drive weitergeben – das PDF wurde deshalb heruntergeladen. Du kannst es in Google Drive hochladen."),
      h("p", { class: "muted small" }, "Direktes Hochladen per Klick: In Vercel die Variable GOOGLE_CLIENT_ID setzen (Anleitung in SETUP.md). Am Handy klappt „An Google Drive senden“ auch ohne das über das Teilen-Menü.")),
  });
  return "download";
}

/* ── CSV der Zeiteinträge (für deutsches Excel) ── */
export function downloadCsv(fromKey, toKey) {
  const rows = [["Datum", "Projekt", "Bereich", "To-Do", "Minuten", "Stunden", "Notiz", "Quelle"]];
  live("timeEntries")
    .filter((e) => (!fromKey || e.date >= fromKey) && (!toKey || e.date <= toKey))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.start || 0) - (b.start || 0))
    .forEach((e) => {
      const v = byId("vorhaben", e.vorhabenId) || store.state.vorhaben.find((x) => x.id === e.vorhabenId) || {};
      const t = e.todoId ? byId("todos", e.todoId) : null;
      rows.push([e.date, v.id ? vName(v) : "(gelöscht)", v.areaId ? areaName(v.areaId) : "", t ? t.title : "",
        String(Math.round(e.min || 0)), ((e.min || 0) / 60).toFixed(2).replace(".", ","),
        (e.note || "").replace(/[\r\n]+/g, " "), e.source === "tracker" ? "alter Zeittracker" : e.manual ? "nachgetragen" : "Timer"]);
    });
  const csv = "﻿" + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\r\n");
  const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: "zeiten_" + (fromKey ? fromKey + "_bis_" + toKey : todayKey()) + ".csv" });
  document.body.append(a); a.click(); a.remove();
  toast("CSV wird heruntergeladen");
}
