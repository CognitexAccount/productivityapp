// Signalton & Benachrichtigung für Countdown-To-Dos.
//
// Der Ton wird beim Start des Countdowns über die Web-Audio-Uhr im Voraus
// eingeplant. Dadurch klingelt er pünktlich, auch wenn der Tab im Hintergrund
// liegt (Browser bremsen dort JavaScript-Timer, aber nicht geplante Töne).
// Er läuft ALARM_SEC Sekunden, wenn er nicht vorher ausgestellt wird.

export const ALARM_SEC = 120;

let actx = null, osc = null, gain = null, scheduledFor = 0;

export function ensureAudio() {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
  } catch (e) { return null; }
  return actx;
}

/* Zweiter Weg für den Ton: ein echtes <audio>-Element mit erzeugtem WAV-Signal.
   Wird bei sichtbarer Seite genutzt, weil iOS Web-Audio bei eingeschaltetem
   Stummschalter verstummen lässt, normale Audio-Wiedergabe aber nicht. */
let audioEl = null, audioStop = null;
function beepWav() {
  const rate = 22050, secs = 1.6, n = Math.floor(rate * secs);
  const buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); };
  w(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); d.setUint32(16, 16, true);
  d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, rate, true); d.setUint32(28, rate * 2, true);
  d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, "data"); d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    [[0, 988], [0.22, 988], [0.44, 1320]].forEach(([s0, f]) => {
      const x = t - s0;
      if (x >= 0 && x < 0.18) v += Math.sin(2 * Math.PI * f * x) * Math.min(1, x / 0.01) * Math.max(0, 1 - x / 0.18);
    });
    d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v * 0.8)) * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
function getAudioEl() {
  if (!audioEl) { audioEl = new Audio(beepWav()); audioEl.loop = true; audioEl.preload = "auto"; }
  return audioEl;
}
// Im Klick auf „Start“ aufrufen: gibt die Wiedergabe für später frei (Autoplay-Regeln)
export function unlockAudio() {
  try {
    const a = getAudioEl();
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
  } catch (e) { /* egal */ }
}
// Jetzt klingeln (bei sichtbarer Seite): <audio>-Schleife für ALARM_SEC Sekunden
export function ringNow() {
  try {
    const a = getAudioEl();
    a.muted = false; a.currentTime = 0;
    const p = a.play();
    // Spielt das Audio-Element, den vorab geplanten Web-Audio-Ton abschalten (sonst doppelt)
    if (p && p.then) p.then(stopOsc).catch(() => {});
    clearTimeout(audioStop);
    audioStop = setTimeout(() => { try { a.pause(); } catch (e) { /* egal */ } if (window.__alarm) window.__alarm.active = false; }, ALARM_SEC * 1000);
    window.__alarm = { ...(window.__alarm || {}), active: true, audioEl: true, seconds: ALARM_SEC };
  } catch (e) { /* egal */ }
}

function stopOsc() {
  try { if (osc) { osc.stop(); osc.disconnect(); } } catch (e) { /* schon gestoppt */ }
  try { if (gain) gain.disconnect(); } catch (e) { /* egal */ }
  osc = null; gain = null;
}
export function cancelAlarm() {
  clearTimeout(audioStop);
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) { /* egal */ }
  stopOsc();
  scheduledFor = 0;
  if (window.__alarm) window.__alarm.active = false;
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* egal */ }
}

// Ton für Zeitpunkt atMs (ms seit 1970) einplanen
export function scheduleAlarm(atMs) {
  if (!ensureAudio()) return false;
  if (osc && scheduledFor === atMs) return true;
  cancelAlarm();
  const now = actx.currentTime;
  const t0 = now + Math.max(0, (atMs - Date.now()) / 1000);
  gain = actx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.connect(actx.destination);
  osc = actx.createOscillator();
  osc.type = "triangle";
  // Muster: drei kurze Töne, dann Pause – alle 1,6 s, ALARM_SEC lang
  for (let t = 0; t < ALARM_SEC; t += 1.6) {
    [0, 0.22, 0.44].forEach((k, i) => {
      const s = t0 + t + k;
      osc.frequency.setValueAtTime(i === 2 ? 1320 : 988, s);
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.linearRampToValueAtTime(0.5, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
    });
  }
  osc.start(t0);
  osc.stop(t0 + ALARM_SEC + 0.5);
  scheduledFor = atMs;
  window.__alarm = { scheduledFor: atMs, seconds: ALARM_SEC, active: true }; // für Tests sichtbar
  return true;
}

export const isScheduled = () => !!osc;
export const scheduledAt = () => scheduledFor;

// Läuft ein geplanter (noch nicht klingelnder) Ton zu einem Countdown, den es
// nicht mehr gibt – z. B. auf einem anderen Gerät gestoppt? Dann absagen.
export function syncAlarm(endAt) {
  if (!osc || Date.now() >= scheduledFor) return; // klingelt schon: weiterlaufen lassen
  if (endAt !== scheduledFor) cancelAlarm();
}

export function vibrate() {
  try { if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500, 250, 500]); } catch (e) { /* egal */ }
}

export function askNotify() {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch (e) { /* egal */ }
}
export const notifyState = () => ("Notification" in window ? Notification.permission : "unsupported");
export function requestNotify() {
  try {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    return Notification.requestPermission();
  } catch (e) { return Promise.resolve("unsupported"); }
}
// Systembenachrichtigung – über den Service Worker (Pflicht bei Chrome auf Android), sonst direkt
export async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const opts = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "projektsystem-timer", renotify: true, requireInteraction: true, vibrate: [400, 200, 400, 200, 400] };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, opts); return true; }
    }
  } catch (e) { /* weiter mit direktem Weg */ }
  try { new Notification(title, opts); return true; } catch (e) { return false; }
}
