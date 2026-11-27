// Ansichts-Zustand (nicht synchronisiert) und Navigation.

const UIKEY = "projektsystem_ui";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(UIKEY) || "{}"); } catch (e) { saved = {}; }

export const ui = {
  route: "", param: null,
  area: saved.area || "all",
  showDone: !!saved.showDone,
  collapsed: saved.collapsed || {},
  panel: null,            // { vid, field }
  reviewOffset: 0,
  tlRange: saved.tlRange || "9m",
  tlStatus: Array.isArray(saved.tlStatus) ? saved.tlStatus : null,
  lessonsQuery: "",
  boardDoneOpen: false,
};
export function persistUi() {
  try {
    localStorage.setItem(UIKEY, JSON.stringify({ area: ui.area, showDone: ui.showDone, collapsed: ui.collapsed, tlRange: ui.tlRange, tlStatus: ui.tlStatus }));
  } catch (e) { /* ignorieren */ }
}

let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const rerender = () => renderFn();

export function go(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}
export function openPanel(vid, field) { ui.panel = { vid, field }; rerender(); }
export function closePanel() { ui.panel = null; rerender(); }
export const openVorhaben = (vid) => go("#/v/" + vid);
