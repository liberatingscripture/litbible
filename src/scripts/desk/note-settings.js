// src/scripts/desk/note-settings.js
//
// The reader's settings for their own notes, bookmarks and highlights
// (STUDY-DESK.md, "Decisions", 2026-10-07: the margin switch, and the margin
// notes' look):
//   - "Notes in the margin": whether the margin shows them (shown by default);
//   - "Handwriting / Plain": Playpen Sans or Inter for margin notes
//     (handwriting by default). The reader's own font choice, Atkinson
//     Hyperlegible or OpenDyslexic, still wins: global.css sets every element
//     to it under html[data-font];
//   - "My bookmarks": whether the margin shows bookmarks' marks (shown by
//     default; BVJ, 2026-10-08: their own switch, apart from notes);
//   - "My highlights": whether the page draws the reader's highlights. Two
//     settings stand behind the one box, because the two views are for
//     different things (audit C2/H1): Chapter View's is shown by default, and
//     Read View, which is for reading a book straight through, keeps its own,
//     hidden by default. `highlightSetting()` names the one this page uses;
//   - whether the Notebook panel's list shows notes in full or at two lines
//     (two lines by default);
//   - "Hide my marks" (M1; decision 8 under "the margin switch"), which hides
//     everything of the reader's at once, for sharing a screen: it remembers
//     "Notes in the margin", "My bookmarks" and both views' highlights, turns them off,
//     and puts them back when it is turned off. It is no setting of its own,
//     so the most recent action wins without more code: turning "Notes in the margin"
//     back on while everything is hidden brings back the notes only, and
//     M1's box shows checked exactly when everything is hidden. The key H
//     does the same (keyboard-shortcuts.js sends lit:desk-hide).
//
// The first four have a control in the Display tray's Show group and another
// in the Notebook panel, both full switches for one setting, kept in step
// (BVJ). Like the tray's own settings, each is an attribute on <html>, absent
// for the default, with one localStorage key; unlike them there is no
// pre-paint script, since nothing of the desk paints before this file runs.

// The desk's first stage carries this file, so the Display tray's switches
// are there before the shell (Audit 3, LG3-2): it imports only light modules,
// none of which reaches the store or the page's text. Keep it that way
// (test/desk-first-stage.test.js holds it).
import { announce, undoModifier } from "./undo-bar.js";
import { prosePage, readBook } from "./page-kind.js";
import { resetWidthsButton } from "./widths.js";

const SETTINGS = {
  notes: { attr: "data-desk-notes", key: "lit-desk-notes", fallback: "on" },
  noteFont: { attr: "data-desk-note-font", key: "lit-desk-note-font", fallback: "handwriting" },
  bookmarks: { attr: "data-desk-bookmarks", key: "lit-desk-bookmarks", fallback: "on" },
  highlights: { attr: "data-desk-highlights", key: "lit-desk-highlights", fallback: "on" },
  readHighlights: { attr: "data-desk-read-highlights", key: "lit-desk-read-highlights", fallback: "off" },
  show: { attr: "data-desk-show", key: "lit-desk-show", fallback: "on" },
};

export const SETTINGS_EVENT = "desk:settings";

/** Sent when "Hide my marks" hides or shows everything: { hidden, from }. */
export const HIDE_EVENT = "desk:hide";
const HIDE_KEY = "lit-desk-hide";
// What M1 hides. Both views' highlights go, whichever view it is pressed in,
// since "everything of the reader's" doesn't depend on the page. Read View's
// is off by default, so it is usually off already: that counts as hidden, and
// the state remembered for the way back includes it, so it stays off when the
// rest returns.
const HIDDEN_BY_M1 = ["notes", "bookmarks", "highlights", "readHighlights"];

/**
 * The setting that switches highlights on this page: Read View's own in Read
 * View, and Chapter View's everywhere else. Callers needn't know which view
 * they are in; read it when you need it, never keep it.
 */
export function highlightSetting() {
  return readBook() ? "readHighlights" : "highlights";
}

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
    // The first hide's memory wins (NB8-6): hiding again with a record already
    // kept, after turning one switch back on, must not make Show bring back
    // only that one. A switch the first hide saw on stays on in the record.
    let before = null;
    try { before = JSON.parse(localStorage.getItem(HIDE_KEY) || "null"); } catch (_) {}
    const saved = Object.fromEntries(
      HIDDEN_BY_M1.map((name) => [name, before?.[name] === "on" ? "on" : getSetting(name)]),
    );
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
  // The key and the command change a page with nothing to read out, unlike the
  // checkbox, whose own state is announced (NB-15).
  if (from === "key") {
    announce(hide ? "Your notes, bookmarks, and highlights are hidden." : "Your notes, bookmarks, and highlights are showing again.");
  }
  document.dispatchEvent(new CustomEvent(HIDE_EVENT, { detail: { hidden: hide, from } }));
}

/**
 * What to tell a reader who has just saved a note or bookmark that the page
 * won't show because its switch is off, or because Hide my marks is on: the
 * sentence, and a button that shows it. null when it shows. A visible notice,
 * not only a spoken one, and the setting is never switched back on for them,
 * since that could put private notes on a shared screen (NB-15).
 * @param {"notes" | "bookmarks"} name
 * @param {string} saved the sentence that says what was saved
 */
export function hiddenNotice(name, saved) {
  if (getSetting(name) === "on") return null;
  const m1 = allHidden();
  const reason = m1 ? "“Hide my marks” is on" : name === "notes" ? "“Notes in the margin” is off" : "“My bookmarks” is off";
  return {
    message: `${saved} It’s hidden because ${reason}.`,
    label: name === "notes" ? "Show notes" : "Show bookmarks",
    show: () => (m1 ? setHideAll(false, { from: "notice" }) : setSetting(name, "on")),
  };
}

/** Read the stored settings onto <html>, and follow changes made in other tabs. */
let started = false;
export function initNoteSettings() {
  // Once a page: the first stage starts it, and the shell's call then finds
  // the tray's switches already there (Audit 3, LG3-2).
  if (started) return;
  started = true;
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

/**
 * Whether this browser can draw highlights at all (the CSS Custom Highlight
 * API: Chrome 105, Safari 17.2, Firefox 140). Where it can't, Highlight isn't
 * offered, so a reader never makes a mark that is never drawn (LG-5).
 */
export function highlightsSupported() {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

let uid = 0;

/**
 * The "Notes in the margin" box, the Handwriting / Plain choice, the "My bookmarks" box,
 * the "My highlights" box and the "Hide my marks" box, as controls that
 * follow their settings wherever they change. `classes` names the host's own
 * styles, so the same controls sit naturally in the tray and in the panel,
 * and `from` names the host.
 */
function noteControls(classes) {
  const n = ++uid;
  const check = document.createElement("label");
  check.className = classes.check;
  check.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskNotesCheck${n}" />
    <span class="${classes.checkLabel}">Notes in the margin</span>`;
  const box = check.querySelector("input");
  box.addEventListener("change", () => setSetting("notes", box.checked ? "on" : "off"));

  const marks = document.createElement("label");
  marks.className = classes.check;
  marks.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskBookmarksCheck${n}" />
    <span class="${classes.checkLabel}">My bookmarks</span>`;
  const marksBox = marks.querySelector("input");
  marksBox.addEventListener("change", () => setSetting("bookmarks", marksBox.checked ? "on" : "off"));

  // One box, whichever view's setting this page uses.
  const lightsName = highlightSetting();
  const lights = document.createElement("label");
  lights.className = classes.check;
  lights.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskHighlightsCheck${n}" />
    <span class="${classes.checkLabel}">My highlights</span>`;
  const lightsBox = lights.querySelector("input");
  // This browser can't draw highlights (LG-5): say so rather than offer a switch that does nothing.
  if (!highlightsSupported()) {
    lightsBox.disabled = true;
    lights.querySelector("span").textContent = "My highlights (this browser can’t draw them)";
  }
  lightsBox.addEventListener("change", () => setSetting(lightsName, lightsBox.checked ? "on" : "off"));

  // Whether the Notebook panel, its tab and the Read View button show at all.
  const panel = document.createElement("label");
  panel.className = classes.check;
  panel.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskShowCheck${n}" />
    <span class="${classes.checkLabel}">Show the Notebook</span>`;
  const panelBox = panel.querySelector("input");
  panelBox.addEventListener("change", () => setSetting("show", panelBox.checked ? "on" : "off"));

  const hide = document.createElement("label");
  hide.className = classes.check;
  hide.innerHTML = `<input type="checkbox" class="${classes.checkInput}" id="deskHideCheck${n}" data-desk-hide-check />
    <span class="${classes.checkLabel}">Hide my marks</span>`;
  const hideBox = hide.querySelector("input");
  // "Marks" is the umbrella word for notes, highlights, and bookmarks; this is
  // where a reader first meets it, so it is said here (CP-11).
  const marksMeaning = "Your marks are your notes, highlights, and bookmarks. Hiding them deletes nothing.";
  hide.title = marksMeaning;
  hideBox.setAttribute("aria-description", marksMeaning);
  hideBox.addEventListener("change", () => setHideAll(hideBox.checked, { from: classes.from }));
  // H hides only while the Keyboard switch is on (WCAG 2.1.4), so the box
  // advertises it only then (NB-18).
  const keys = () => {
    let on = true;
    try { on = localStorage.getItem("lit-shortcuts") !== "off"; } catch (_) {}
    if (on) hideBox.setAttribute("aria-keyshortcuts", "H");
    else hideBox.removeAttribute("aria-keyshortcuts");
  };
  keys();
  document.addEventListener("lit:shortcuts-changed", keys);
  window.addEventListener("storage", (e) => { if (e.key === "lit-shortcuts") keys(); });

  const seg = document.createElement("div");
  seg.className = classes.seg;
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "My Notes’ lettering");
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
    lightsBox.checked = getSetting(lightsName) === "on";
    panelBox.checked = getSetting("show") === "on";
    hideBox.checked = allHidden();
    const font = getSetting("noteFont");
    for (const r of radios) r.checked = r.value === font;
  };
  sync();
  document.addEventListener(SETTINGS_EVENT, sync);
  return { check, seg, marks, lights, hide, panel, sync };
}

/**
 * The controls in the Display tray's Show group: all of them on a Chapter View
 * chapter, only "My bookmarks", "My highlights" and "Hide my marks" in
 * Read View, which shows no notes, and none on /desk (E108). Also H
 * and Ctrl+Z in the tray's list of keys, and on a chapter a line under the Show group saying that a selection
 * reaches the same actions as a verse number (audit C10: hiding the numbers
 * mustn't hide the way in), and "Reset widths" while the reader has dragged
 * the notebook's widths. An article or the glossary gets a Show group of its own
 * (injectProseShow), without highlights, which it doesn't have yet.
 */
const TRAY_CLASSES = {
  check: "font-tray__check",
  checkInput: "font-tray__check-input",
  checkLabel: "font-tray__check-label",
  seg: "font-tray__seg",
  segOption: "font-tray__seg-option",
  segInput: "font-tray__seg-input",
  segText: "font-tray__seg-text",
  from: "tray",
};

function injectIntoTray() {
  const vn = document.querySelector("#fontTray [data-vn-check]");
  const checks = vn?.closest(".font-tray__checks");
  const show = checks?.closest("fieldset");
  const study = Boolean(document.querySelector("#fontTray [data-terms-check]") && document.querySelector(".chapter-paragraphs"));
  const read = vn?.getAttribute("data-vn-view") === "read";
  // /desk's tray has no Show group to add to: "My highlights," the one desk
  // switch that means anything there, is on each LIT pane's bar with the
  // other marks, and is that pane's own (E108; lit-show.js). "Hide my marks"
  // still hides the highlights in every pane (lit-marks.js).
  const prose = !study && !read && prosePage();
  if (prose) {
    injectProseShow();
    return;
  }
  if (!checks || !show || !(study || read)) return;
  const { check, seg, marks, lights, hide, panel } = noteControls(TRAY_CLASSES);
  panel.dataset.desk = "";
  marks.dataset.desk = "";
  lights.dataset.desk = "";
  hide.dataset.desk = "";
  addKeyLines();
  if (read) {
    checks.append(panel, marks, lights, hide);
    return;
  }
  check.dataset.desk = "";
  checks.append(panel, check, marks, lights, hide);
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
  row.innerHTML = `<legend class="font-tray__legend">My Notes’ lettering</legend>`;
  seg.removeAttribute("role");
  seg.removeAttribute("aria-label");
  row.append(seg);
  show.after(row);
}

/**
 * An article or the glossary (N11) has no Show group in the tray, since it
 * has no verse numbers, so the notes' switches get one of their own, before
 * the Keyboard group: "Notes in the margin" and "Hide my marks", then the lettering.
 * Never called in version 1, where N11 is off and prosePage() is null.
 */
function injectProseShow() {
  const tray = document.getElementById("fontTray");
  const keysRow = tray?.querySelector(".font-tray__row--keys");
  if (!tray || !keysRow) return;
  const { check, seg, hide, panel } = noteControls(TRAY_CLASSES);
  panel.dataset.desk = "";
  const show = document.createElement("fieldset");
  show.className = "font-tray__row";
  show.dataset.desk = "";
  show.innerHTML = `<legend class="font-tray__legend">Show</legend><div class="font-tray__checks"></div>`;
  show.querySelector(".font-tray__checks").append(panel, check, hide);
  const row = document.createElement("fieldset");
  row.className = "font-tray__row";
  row.dataset.desk = "";
  row.innerHTML = `<legend class="font-tray__legend">My Notes’ lettering</legend>`;
  seg.removeAttribute("role");
  seg.removeAttribute("aria-label");
  row.append(seg);
  keysRow.before(show, row);
  addKeyLines();
}

/**
 * The desk's lines in the tray's list of keys: H hides or shows my notes, and
 * Ctrl+Z (⌘Z on a Mac) undoes a change to the notebook and Ctrl+Y (⇧⌘Z on a
 * Mac) redoes it (BVJ, 2026-11-04). The list sits under
 * the Keyboard switch, but Ctrl+Z isn't one of its single-key shortcuts and
 * doesn't follow it (history.js). Like the other desk controls, they are
 * marked data-desk.
 */
function addKeyLines() {
  const keys = document.getElementById("fontTrayKeys");
  if (!keys) return;
  for (const html of [
    "<kbd>h</kbd> Hide or show my marks",
    `<kbd>${undoModifier()}</kbd> <kbd>Z</kbd> Undo a change to my notebook`,
    // Ctrl+Y on a computer with a Ctrl key; the Mac's redo is Shift+Command+Z.
    undoModifier() === "Ctrl"
      ? "<kbd>Ctrl</kbd> <kbd>Y</kbd> Redo a change to my notebook"
      : "<kbd>⇧</kbd> <kbd>⌘</kbd> <kbd>Z</kbd> Redo a change to my notebook",
  ]) {
    const li = document.createElement("li");
    li.dataset.desk = "";
    li.innerHTML = html;
    keys.append(li);
  }
}

/**
 * The same controls for the Notebook panel's foot; with `notes: false`
 * (Read View), only "My bookmarks", "My highlights" and "Hide my marks"; with
 * `bookmarks: false` (an article or the glossary, where nothing is
 * bookmarked or highlighted), all but "My bookmarks" and "My highlights".
 * `highlights` says it outright where a caller needs to; left out, it
 * follows `bookmarks`, since the two are drawn on the same pages.
 */
export function panelNoteControls({ notes = true, bookmarks = true, highlights = bookmarks } = {}) {
  const { check, seg, marks, lights, hide } = noteControls({
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
  const lit = highlights ? [lights] : [];
  if (notes) wrap.append(check, seg, ...(bookmarks ? [marks] : []), ...lit, hide);
  else wrap.append(marks, ...lit, hide);
  return wrap;
}
