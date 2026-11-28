// src/scripts/settings-page.js
//
// All settings (/settings; src/pages/settings.astro): the part every reader
// gets, the keyboard shortcuts' switch (DI-20). The switch is required, not a
// nicety: single-key shortcuts fire when a speech-recognition user dictates a
// word (WCAG 2.1.4). It was the Display tray's "Keyboard shortcuts" box until
// Featherboa's Phase 4 (DI-01), and it writes what that box wrote:
// localStorage["lit-shortcuts"] = "off" while they're off, nothing while
// they're on (keyboard-shortcuts.js reads it on every key), then tells the
// page (`lit:shortcuts-changed`), so "Your marks" can say whether H works.
// Study's parts are desk/settings-page.js's, which desk-gate.js loads only
// where Study is on; this file imports nothing of the desk.

export const SHORTCUTS_KEY = "lit-shortcuts";
export const SHORTCUTS_EVENT = "lit:shortcuts-changed";

/** Whether the single-key shortcuts are on (absent, or anything but "off"). */
export function shortcutsOn() {
  try {
    return localStorage.getItem(SHORTCUTS_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Turn the shortcuts on or off, and tell the page. */
export function setShortcuts(on) {
  try {
    if (on) localStorage.removeItem(SHORTCUTS_KEY);
    else localStorage.setItem(SHORTCUTS_KEY, "off");
  } catch {
    /* storage refused: the keys stay on, and the switch reads that back */
  }
  document.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT));
}

/** Wire the page's switch: shown once this runs, since it does nothing without it. */
export function initSettingsPage(doc = document) {
  const box = doc.querySelector("[data-settings-keys]");
  const button = box?.querySelector('[data-settings-switch="shortcuts"]');
  if (!box || !button || button.dataset.wired) return;
  button.dataset.wired = "";
  // The switch shows what keyboard-shortcuts.js will do, read back after
  // each press: where the browser refuses storage, the keys stay on, and so
  // does the switch.
  const sync = () => button.setAttribute("aria-checked", String(shortcutsOn()));
  button.addEventListener("click", () => {
    setShortcuts(button.getAttribute("aria-checked") !== "true");
    sync();
  });
  // Another tab's switch.
  window.addEventListener("storage", (e) => {
    if (e.key === SHORTCUTS_KEY || e.key === null) sync();
  });
  sync();
  box.hidden = false;
}

initSettingsPage();
