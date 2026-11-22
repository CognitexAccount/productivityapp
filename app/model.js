// Datenmodell-Konstanten, Leitfragen und Datums-Helfer des Projektsystems.

export const STATUS = ["Idee", "Vorbereitung", "Läuft", "Abschluss-Review", "Abgeschlossen"];
export const EST_OPTIONS = [5, 15, 30, 60]; // Zeitangabe eines To-Dos in Minuten
export const DEFAULT_EST = 30;
export const STATUS_LABEL = { "Idee": "Ideen-Park" };
export const ACTIVE = ["Vorbereitung", "Läuft"];

export const DEFAULT_AREAS = [
  { id: "area_business", name: "Business" },
  { id: "area_akademisch", name: "Akademische Projekte" },
  { id: "area_lifestyle", name: "Lifestyle/Sonstiges" },
  { id: "area_kuenstler", name: "Künstler" },
];

export const TITLE_HINTS = [
  "Die Hypothese sollte nach SMART-Kriterien definiert sein:",
  "Spezifisch · Messbar · Attraktiv · Realistisch · Terminiert",
];

// Felder eines Vorhabens. hints = Leitfragen (aus den Kommentaren im Sheet).
// outline = wird beim Befördern einer Idee als Gliederung vorbefüllt.
export const FIELDS = [
  { key: "naechste", label: "Nächste Schritte", hints: [
    "Was ist der nächste konkrete Schritt? (Tipp: konkrete Schritte als To-Do mit Datum anlegen – dann landen sie in „Heute“.)",
  ] },
  { key: "strategie", label: "Strategie-Bezug", hints: [
    "Wie zahlt dieses Projekt auf meine definierten Ziele ein?",
  ] },
  { key: "ressourcen", label: "Ressourcenplanung", outline: true, hints: [
    "Welche Fähigkeiten, Personen und anderen Assets habe ich bereits für dieses Projekt und kann ich nutzen?",
    "Welche Ressourcen benötige ich noch, um das Projekt erfolgreich durchzuziehen? (z. B. Personen, Zertifikate, Informationsquellen, Tools)",
  ] },
  { key: "lernen", label: "Was möchte ich lernen?", outline: true, hints: [
    "Warum sollte ich dieses Projekt verfolgen?",
    "Warum sollte ich dieses Projekt jetzt verfolgen und nicht parken?",
    "Lernziele: Welche Skills möchte ich am Ende erreicht haben?",
    "Wie kann ich die erreichten Skills für die Zukunft nutzen? Warum sind sie sinnvoll?",
    "Signalling: Welche Außenwirkung haben die erreichten Dinge? Kann ich das für meine Außenwirkung nutzen?",
  ] },
  { key: "versuch", label: "Versuchsdesign", outline: true, hints: [
    "Welche konkreten Schritte muss ich unternehmen? In welchen Zeiträumen?",
    "Was sind Dinge, die mich aufhalten können?",
  ] },
  { key: "erfolg", label: "Erfolg / Misserfolg", special: "erfolg", hints: [
    "Woran erkenne ich Erfolg, ein neutrales Ergebnis und Misserfolg – und was ist jeweils der nächste Schritt?",
    "Killkriterium: Wann breche ich bewusst ab?",
  ] },
  { key: "uebergabe", label: "Übergabestrategie", outline: true, hints: [
    "Sollte sich der Versuch als erfolgreich herausstellen, wie kann ich eine erfolgreiche Übergabe gestalten? Ist eine Übergabe überhaupt das Richtige?",
    "Welche Dokumentation muss ich während des Prozesses erstellen?",
    "Welches Profil benötige ich für einen Nachfolger?",
  ] },
  { key: "ergebnis", label: "Ergebnis", hints: [
    "Habe ich das Projekt aus Resistance abgeschlossen oder weil ich meinen Personal End Point erreicht habe?",
  ] },
  { key: "lessons", label: "Lessons Learned", hints: [
    "Was waren die wichtigsten Learnings?",
    "Was habe ich gut gemacht, was würde ich heute anders machen?",
    "Welche Fähigkeiten und welches Wissen habe ich jetzt, die ich vorher noch nicht hatte?",
    "Habe ich Drift während dieses Projektes gespürt?",
  ] },
];
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export const ERFOLG_PARTS = [
  { key: "erfolg", label: "Erfolg" },
  { key: "neutral", label: "Neutral" },
  { key: "misserfolg", label: "Misserfolg" },
  { key: "kill", label: "Killkriterium" },
];

// Neutraler Standardtext. Die eigene Beschreibung liegt in der Datenbank
// (Einstellungen → „Resistance oder Personal End Point?“) und hat Vorrang.
export const RESISTANCE_TEXT =
  "Resistance: ein plötzlicher innerer Widerstand – das Projekt fühlt sich sinnlos an, andere Optionen wirken viel verlockender. " +
  "Personal End Point: die ruhige, sich verfestigende Gewissheit, dass die vorab definierten Kriterien erfüllt sind oder das Lernziel erreicht ist " +
  "und das Projekt guten Gewissens beendet werden kann.";

export const OUTCOMES = ["Erfolg", "Neutral", "Misserfolg"];
export const ABSCHLUSS_CHECKS = {
  Misserfolg: [
    ["m1", "Habe ich Stakeholder persönlich informiert, oder gibt es noch offene Gespräche?"],
    ["m2", "Habe ich Stakeholder so informiert, dass offen bleibt, was als Nächstes passiert (statt schon den Erfolg des nächsten Projekts vorwegzunehmen)?"],
    ["m3", "Habe ich einen zuverlässigen Eindruck hinterlassen und mich bei wichtigen Stakeholdern persönlich bedankt?"],
    ["m4", "Habe ich noch offene Commitments eingelöst?"],
    ["m5", "Habe ich vorhandene Assets übertragen oder archiviert?"],
    ["m6", "Habe ich entsprechende Tools gekündigt?"],
  ],
  Erfolg: [
    ["e1", "Habe ich einen eindeutigen Übergabeplan oder bereits eine neue Person eingearbeitet?"],
  ],
  Neutral: [
    ["n1", "Habe ich klare Kriterien für eine Fortsetzung bzw. Neuadjustierung des Projektes definiert?"],
    ["n2", "Habe ich die Ergebnisse und Daten sauber dokumentiert?"],
  ],
};

/* ── Datum & Zeit ── */
export const pad = (n) => (n < 10 ? "0" : "") + n;
export const dateKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const todayKey = () => dateKey(new Date());
export function parseKey(k) {
  if (!k) return null;
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const fmtDate = (k) => (k ? k.slice(8, 10) + "." + k.slice(5, 7) + "." + k.slice(0, 4) : "");
export const fmtShort = (k) => (k ? k.slice(8, 10) + "." + k.slice(5, 7) + "." : "");
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5); // b − a in Tagen
export function weekStartKey(k) {
  const d = parseKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}
export function fmtHM(min) {
  min = Math.max(0, Math.round(min || 0));
  return Math.floor(min / 60) + ":" + pad(min % 60);
}
export function fmtH(min) {
  const h = (min || 0) / 60;
  return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10).toLocaleString("de-DE") + " h";
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" + pad(m) : m) + ":" + pad(s);
}
export function isoWeek(k) {
  const t = parseKey(k);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
  const first = new Date(t.getFullYear(), 0, 4);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7) + 3);
  return 1 + Math.round((t - first) / (7 * 864e5));
}
export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
