// src/scripts/desk/note-settings.js
//
// The reader's settings for their own notes and bookmarks (STUDY-DESK.md, "Decisions",
// 2026-10-07: the margin switch, and the margin notes' look):
//   - "My notes": whether the margin shows them (shown by default);
//   - "Handwriting / Plain": Playpen Sans or Inter for margin notes
//     (handwriting by default). The reader's own font choice, Atkinson
//     Hyperlegible or OpenDyslexic, still wins: global.css sets every element
//     to it under html[data-font];
//   - "My bookmarks": whether the margin shows bookmarks' marks (shown by
//     default; BVJ, 2026-10-08: their own switch, apart from notes);
//   - whether the Notebook panel's list shows notes in full or at two lines
//     (two lines by default);
//   - "Hide my notes" (M1; decision 8 under "the margin switch"), which hides
//     everything of the reader's at once, for sharing a screen: it remembers
//     "My notes" and "My bookmarks" (and highlights, once they exist), turns
//     them off, and puts them back when it is turned off. It is no setting of
//     its own, so the most recent action wins without more code: turning "My
//     notes" back on while everything is hidden brings back the notes only,
//     and M1's box shows checked exactly when everything is hidden. The key H
//     does the same (keyboard-shortcuts.js sends lit:desk-hide).
//
// The first three have a control in the Display tray's Show group and another
// in the Notebook panel, both full switches for one setting, kept in step
// (BVJ). Like the tray's own settings, each is an attribute on <html>, absent
// for the default, with one localStorage key; unlike them there is no
// pre-paint script, since nothing of the desk paints before this file runs.

import { resetWidthsButton } from "./widths.js";

const SETTINGS = {
  notes: { attr: "data-desk-notes", key: "lit-desk-notes", fallback: "on" },
  noteFont: { attr: "data-desk-note-font", key: "lit-desk-note-font", fallback: "handwriting" },
  bookmarks: { attr: "data-desk-bookmarks", key: "lit-desk-bookmarks", fallback: "on" },
  listFull: { attr: "data-desk-list", key: "lit-desk-list", fallback: "lines" },
};

export const SETTINGS_EVENT = "desk:settings";

/** Sent when "Hide my notes" hides or shows everything: { hidden, from }. */
export const HIDE_EVENT = "desk:hide";
const HIDE_KEY = "lit-desk-hide";
// What M1 hides. Highlights join when they are built.
const HIDDEN_BY_M1 = ["notes", "bookmarks"];

export function getSetting(name) {
  const { attr, fallback } = SETTINGS[name];
  return document.documentElement.getAttribute(attr) || fallback;
}

function applyAttr(name, value) {
  const { attr, fallback } = SETTINGS[name];
  if (value === fallback) document.documentElement.removeAttribute(attr);
  else document.documentElement.setAttribute(attr, value);
}

export function setSetting(name, value) {
  const { key, fallback } = SETTINGS[name];
  applyAttr(name, value);
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { name, value } }));
}

/** Whether everything of the reader's is hidden, which is when M1's box is checked. */
export function allHidden() {
  return HIDDEN_BY_M1.every((name) => getSetting(name) === "off");
}

/**
 * Hide everything of the reader's, remembering what showed, or put back what
 * was hidden. A remembered state that would show nothing (both switches were
 * already off) brings back the defaults, so showing always shows something.
 * `from` says where the reader did it ("panel", "tray", "key").
 */
export function setHideAll(hide, { from = null } = {}) {
  if (hide) {
    const saved = Object.fromEntries(HIDDEN_BY_M1.map((name) => [name, getSetting(name)]));
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(saved)); } catch (_) {}
    for (const name of HIDDEN_BY_M1) setSetting(name, "off");
  } else {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(HIDE_KEY) || "null"); } catch (_) {}
    try { localStorage.removeItem(HIDE_KEY); } catch (_) {}
    const back = (name) => (saved?.[name] === "on" || saved?.[name] === "off" ? saved[name] : SETTINGS[name].fallback);
    const showsNothing = HIDDEN_BY_M1.every((name) => back(name) === "off");
    for (const name of HIDDEN_BY_M1) setSetting(name, showsNothing ? SETTINGS[name].fallback : back(name));
  }
  document.dispatchEvent(new CustomEvent(HIDE_EVENT, { detail: { hidden: hide, from } }));
}

/** Read the stored settings onto <html>, and follow changes made in other tabs. */
export function initNoteSettings() {
  for (const name of Object.keys(SETTINGS)) {
    let v = null;
    try { v = localStorage.getItem(SETTINGS[name].key); } catch (_) {}
    applyAttr(name, v || SETTINGS[name].fallback);
  }
  window.addEventListener("storage", (e) => {
    const name = Object.keys(SETTINGS).find((n) => SETTINGS[n].key === e.key);
    if (!name) return;
    const value = e.newValue || SETTINGS[name].fallback;
    applyAttr(name, value);
    document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { name, value } }));
  });
  document.addEventListener("lit:desk-hide", () => setHideAll(!allHidden(), { from: "key" }));
  injectIntoTray();
}

let uid = 0;

/**
 * The "My notes" box, the Handwriting / Plain choice, the "My bookmarks" box
 * and the "Hide my notes" box, as controls that follow their settings
 * wherever they change. `classes` names the host's own styles, so the same
 * controls sit naturally in the tray and in the panel, and `from` names the
 * host.
 */
function noteControls(classes) {
  const n = ++uid;
  const check = document.createElement("label");
  check.className = classes.check;
  check.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskNotesCheck${n}" />
    <span class="${classes.checkLabel}">My notes</span>`;
  const box = check.querySelector("input");
  box.addEventListener("change", () => setSetting("notes", box.checked ? "on" : "off"));

  const marks = document.createElement("label");
  marks.className = classes.check;
  marks.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskBookmarksCheck${n}" />
    <span class="${classes.checkLabel}">My bookmarks</span>`;
  const marksBox = marks.querySelector("input");
  marksBox.addEventListener("change", () => setSetting("bookmarks", marksBox.checked ? "on" : "off"));

  const hide = document.createElement("label");
  hide.className = classes.check;
  hide.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskHideCheck${n}" aria-keyshortcuts="h" />
    <span class="${classes.checkLabel}">Hide my notes</span>`;
  const hideBox = hide.querySelector("input");
  hideBox.addEventListener("change", () => setHideAll(hideBox.checked, { from: classes.from }));

  const seg = document.createElement("div");
  seg.className = classes.seg;
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "My notes’ lettering");
  seg.innerHTML = ["handwriting", "plain"]
    .map(
      (v) => `<label class="${classes.segOption}">
        <input type="radio" class="${classes.segInput}" name="desk-note-font-${n}" value="${v}" />
        <span class="${classes.segText}">${v === "handwriting" ? "Handwriting" : "Plain"}</span>
      </label>`,
    )
    .join("");
  const radios = Array.from(seg.querySelectorAll("input"));
  for (const r of radios) r.addEventListener("change", () => r.checked && setSetting("noteFont", r.value));

  const sync = () => {
    box.checked = getSetting("notes") === "on";
    marksBox.checked = getSetting("bookmarks") === "on";
    hideBox.checked = allHidden();
    const font = getSetting("noteFont");
    for (const r of radios) r.checked = r.value === font;
  };
  sync();
  document.addEventListener(SETTINGS_EVENT, sync);
  return { check, seg, marks, hide, sync };
}

/**
 * The controls in the Display tray's Show group: all of them on a Study View
 * chapter, and only "My bookmarks" and "Hide my notes" in Read View, which
 * shows no notes. Also H in the tray's list of keys, and on a chapter a line
 * under the Show group saying that a selection reaches the same actions as a
 * verse number (audit C10: hiding the numbers mustn't hide the way in), and
 * "Reset widths" while the reader has dragged the notebook's widths.
 */
function injectIntoTray() {
  const vn = document.querySelector("#fontTray [data-vn-check]");
  const checks = vn?.closest(".font-tray__checks");
  const show = checks?.closest("fieldset");
  const study = Boolean(document.querySelector("#fontTray [data-terms-check]") && document.querySelector(".chapter-paragraphs"));
  const read = vn?.getAttribute("data-vn-view") === "read";
  if (!checks || !show || !(study || read)) return;
  const { check, seg, marks, hide } = noteControls({
    check: "font-tray__check",
    checkInput: "font-tray__check-input",
    checkLabel: "font-tray__check-label",
    seg: "font-tray__seg",
    segOption: "font-tray__seg-option",
    segInput: "font-tray__seg-input",
    segText: "font-tray__seg-text",
    from: "tray",
  });
  marks.dataset.desk = "";
  hide.dataset.desk = "";
  const keys = document.getElementById("fontTrayKeys");
  if (keys) {
    const li = document.createElement("li");
    li.dataset.desk = "";
    li.innerHTML = "<kbd>h</kbd> Hide or show my notes";
    keys.append(li);
  }
  if (read) {
    checks.append(marks, hide);
    return;
  }
  check.dataset.desk = "";
  checks.append(check, marks, hide);
  const hint = document.createElement("p");
  hint.className = "font-tray__hint";
  hint.id = "deskVerseNumbersHint";
  hint.dataset.desk = "";
  hint.textContent = "With verse numbers off, select any words for the same actions.";
  checks.after(hint);
  vn.setAttribute("aria-describedby", hint.id);
  // The widths the reader dragged beside the notebook (widths.js), shown
  // only while any are kept.
  const reset = resetWidthsButton("font-tray__reset");
  reset.dataset.desk = "";
  hint.after(reset);
  const row = document.createElement("fieldset");
  row.className = "font-tray__row";
  row.dataset.desk = "";
  row.innerHTML = `<legend class="font-tray__legend">My notes’ lettering</legend>`;
  seg.removeAttribute("role");
  seg.removeAttribute("aria-label");
  row.append(seg);
  show.after(row);
}

/**
 * The same controls for the Notebook panel's foot; with `notes: false`
 * (Read View), only "My bookmarks" and "Hide my notes".
 */
export function panelNoteControls({ notes = true } = {}) {
  const { check, seg, marks, hide } = noteControls({
    check: "desk-setting",
    checkInput: "desk-setting__input",
    checkLabel: "desk-setting__label",
    seg: "desk-seg",
    segOption: "desk-seg__option",
    segInput: "desk-seg__input",
    segText: "desk-seg__text",
    from: "panel",
  });
  const wrap = document.createElement("div");
  wrap.className = "desk-panel__settings";
  if (notes) wrap.append(check, seg, marks, hide);
  else wrap.append(marks, hide);
  return wrap;
}
