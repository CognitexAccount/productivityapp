/* Text-Hilfen (Browser: window.TextKit, Node: require).
   - textToHtml: Klartext (z. B. aus Google Sheets) → strukturierter Rich Text.
     Zeilen mit "-", "–", "•", "*" oder ">>" am Anfang werden Aufzählungen,
     kurze Zeilen, die auf "?" oder ":" enden, werden Zwischenüberschriften
     (so werden deine Leitfragen im Text zu Gliederungspunkten), URLs zu Links.
   - htmlToText: Rich Text → Klartext für Vorschau und Suche.
   - splitErfolg: "Erfolg: … Neutral: … Misserfolg: … Killkriterium: …" in vier Teile. */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) {
    return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]"'])/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>";
    });
  }

  function textToHtml(text, opts) {
    opts = opts || {};
    if (text == null) return "";
    var lines = String(text).replace(/\r/g, "").split("\n");
    var html = [], inList = false;
    function close() { if (inList) { html.push("</ul>"); inList = false; } }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { close(); return; }
      var m = line.match(/^(?:[-–•*]+|>>?)\s*(.*)$/);
      if (m && m[1]) {
        if (!inList) { html.push("<ul>"); inList = true; }
        html.push("<li>" + inline(m[1]) + "</li>");
        return;
      }
      close();
      if (opts.headings !== false && /[:?]$/.test(line) && line.length <= 140) {
        html.push("<h4>" + inline(line) + "</h4>");
        return;
      }
      html.push("<p>" + inline(line) + "</p>");
    });
    close();
    return html.join("");
  }

  function htmlToText(html) {
    return String(html || "")
      .replace(/<li[^>]*data-c="1"[^>]*>/gi, "\n☑ ")
      .replace(/<li[^>]*data-c="0"[^>]*>/gi, "\n☐ ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<(br|\/p|\/h[1-6]|\/div|\/ul|\/ol)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  }

  function splitErfolg(text) {
    var parts = { erfolg: [], neutral: [], misserfolg: [], kill: [] }, cur = null, rest = [];
    var keys = [
      [/^erfolg\s*:\s*/i, "erfolg"], [/^neutral\s*:\s*/i, "neutral"],
      [/^misserfolg\s*:\s*/i, "misserfolg"], [/^kill-?kriterium\s*:\s*/i, "kill"],
    ];
    String(text || "").replace(/\r/g, "").split("\n").forEach(function (line) {
      var t = line.trim(), hit = null;
      for (var i = 0; i < keys.length; i++) if (keys[i][0].test(t)) { hit = keys[i]; break; }
      if (hit) { cur = hit[1]; t = t.replace(hit[0], ""); if (t) parts[cur].push(t); return; }
      if (cur) parts[cur].push(line); else rest.push(line);
    });
    var out = {};
    Object.keys(parts).forEach(function (k) { out[k] = parts[k].join("\n").trim(); });
    if (rest.join("").trim()) out.erfolg = (rest.join("\n").trim() + (out.erfolg ? "\n" + out.erfolg : "")).trim();
    return out;
  }

  var api = { esc: esc, textToHtml: textToHtml, htmlToText: htmlToText, splitErfolg: splitErfolg };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TextKit = api;
})(typeof self !== "undefined" ? self : this);
