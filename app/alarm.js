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

export function cancelAlarm() {
  try { if (osc) { osc.stop(); osc.disconnect(); } } catch (e) { /* schon gestoppt */ }
  try { if (gain) gain.disconnect(); } catch (e) { /* egal */ }
  osc = null; gain = null; scheduledFor = 0;
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
export function notify(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png", tag: "projektsystem-timer", requireInteraction: true });
    }
  } catch (e) { /* egal */ }
}
