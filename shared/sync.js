/* Zusammenführen von Datenständen (Projektsystem) — läuft identisch im Browser
   (window.SyncMerge) und in der Serverless-Funktion (require).

   Prinzip: Jeder Eintrag einer Sammlung hat eine id und einen Zeitstempel u
   (letzte Änderung). Beim Zusammenführen gewinnt pro id der neuere Eintrag.
   Gelöschte Einträge bleiben als „Grabstein" ({id, u, del:true}) erhalten,
   damit eine Löschung auf einem Gerät nicht von einem anderen Gerät wieder
   zurückkommt. Einzelwerte (settings, running) werden genauso über u verglichen.
   Das Ergebnis ist unabhängig von der Reihenfolge — beide Seiten kommen zum
   selben Stand. */
(function (root) {
  "use strict";
  var COLLECTIONS = ["areas", "vorhaben", "todos", "goals", "timeEntries"];
  var SINGLETONS = ["settings", "running"];

  // JSON mit sortierten Schlüsseln: Vergleiche hängen nicht von der Feldreihenfolge ab
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  function newer(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    var ua = a.u || 0, ub = b.u || 0;
    if (ub > ua) return b;
    if (ua > ub) return a;
    // Gleichstand: deterministisch entscheiden, damit alle Seiten gleich enden
    return stable(b) > stable(a) ? b : a;
  }

  // Verschachtelte Objekte, die pro Unterfeld zusammengeführt werden
  var NESTED = { fields: 1, erfolg: 1, abschluss: 1 };

  /* Zwei Fassungen desselben Eintrags feldweise zusammenführen. fu hält pro
     Feld den Zeitpunkt der letzten Änderung ("status", "fields.lernen", …).
     So gehen parallele Änderungen an verschiedenen Feldern nicht verloren –
     z. B. Status am Laptop und „Was möchte ich lernen?“ offline am Handy. */
  function mergeItem(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.del || b.del) return newer(a, b);
    if (stable(a) === stable(b)) return a;
    var fa = a.fu || {}, fb = b.fu || {}, ua = a.u || 0, ub = b.u || 0;
    var out = { id: a.id }, fu = {};
    function choose(va, vb, key) {
      var ta = fa[key] || 0, tb = fb[key] || 0, useB;
      if (ta !== tb) useB = tb > ta;
      else if (va === undefined) useB = true;
      else if (vb === undefined) useB = false;
      else if (ua !== ub) useB = ub > ua;
      else useB = stable(vb) > stable(va);
      var t = Math.max(ta, tb);
      if (t) fu[key] = t;
      return useB ? vb : va;
    }
    var keys = {};
    Object.keys(a).forEach(function (k) { keys[k] = 1; });
    Object.keys(b).forEach(function (k) { keys[k] = 1; });
    delete keys.id; delete keys.u; delete keys.fu;
    Object.keys(keys).forEach(function (k) {
      var va = a[k], vb = b[k];
      var isObj = function (x) { return x && typeof x === "object" && !Array.isArray(x); };
      if (NESTED[k] && (isObj(va) || isObj(vb))) {
        va = isObj(va) ? va : {}; vb = isObj(vb) ? vb : {};
        var sub = {}, sk = {};
        Object.keys(va).forEach(function (s) { sk[s] = 1; });
        Object.keys(vb).forEach(function (s) { sk[s] = 1; });
        Object.keys(sk).forEach(function (s) {
          var v = choose(va[s], vb[s], k + "." + s);
          if (v !== undefined) sub[s] = v;
        });
        out[k] = sub;
      } else {
        var v = choose(va, vb, k);
        if (v !== undefined) out[k] = v;
      }
    });
    out.u = Math.max(ua, ub);
    if (Object.keys(fu).length || a.fu || b.fu) out.fu = fu;
    return out;
  }

  function mergeList(a, b) {
    var map = {}, order = [];
    function take(x) {
      if (!x || typeof x !== "object" || !x.id) return;
      if (!Object.prototype.hasOwnProperty.call(map, x.id)) order.push(x.id);
      map[x.id] = mergeItem(map[x.id], x);
    }
    (Array.isArray(a) ? a : []).forEach(take);
    (Array.isArray(b) ? b : []).forEach(take);
    return order.map(function (id) { return map[id]; });
  }

  function empty() {
    var s = { v: 1 };
    COLLECTIONS.forEach(function (c) { s[c] = []; });
    s.settings = { wipLimit: 3, u: 0 };
    s.running = { start: null, u: 0 };
    return s;
  }

  function merge(a, b) {
    a = a && typeof a === "object" ? a : {};
    b = b && typeof b === "object" ? b : {};
    var base = empty();
    var out = { v: 1 };
    COLLECTIONS.forEach(function (c) { out[c] = mergeList(a[c], b[c]); });
    SINGLETONS.forEach(function (k) { out[k] = newer(newer(base[k], a[k]), b[k]); });
    return out;
  }

  // Alte Grabsteine aufräumen (Standard: älter als 90 Tage)
  function prune(s, maxAgeMs) {
    var cut = Date.now() - (maxAgeMs || 90 * 864e5);
    COLLECTIONS.forEach(function (c) {
      s[c] = (s[c] || []).filter(function (x) { return !(x.del && (x.u || 0) < cut); });
    });
    return s;
  }

  // Inhaltlicher Vergleich unabhängig von der Reihenfolge der Einträge
  function canon(s) {
    s = s || {};
    var out = {};
    COLLECTIONS.forEach(function (c) {
      out[c] = (s[c] || []).slice().sort(function (x, y) { return x.id < y.id ? -1 : x.id > y.id ? 1 : 0; });
    });
    SINGLETONS.forEach(function (k) { out[k] = s[k] || null; });
    return stable(out);
  }
  function same(a, b) { return canon(a) === canon(b); }

  // Welche Felder haben sich zwischen zwei Fassungen geändert? (für fu-Zeitstempel)
  function changedKeys(prev, next) {
    var out = [];
    Object.keys(next).forEach(function (k) {
      if (k === "id" || k === "u" || k === "fu") return;
      var a = prev ? prev[k] : undefined, b = next[k];
      if (NESTED[k] && b && typeof b === "object" && !Array.isArray(b)) {
        var ao = a && typeof a === "object" ? a : {}, sk = {};
        Object.keys(ao).forEach(function (s) { sk[s] = 1; });
        Object.keys(b).forEach(function (s) { sk[s] = 1; });
        Object.keys(sk).forEach(function (s) { if (stable(ao[s]) !== stable(b[s])) out.push(k + "." + s); });
      } else if (stable(a) !== stable(b)) out.push(k);
    });
    return out;
  }

  var api = { COLLECTIONS: COLLECTIONS, SINGLETONS: SINGLETONS, empty: empty, merge: merge, mergeItem: mergeItem, changedKeys: changedKeys, prune: prune, same: same };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SyncMerge = api;
})(typeof self !== "undefined" ? self : this);
