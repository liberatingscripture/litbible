// src/scripts/desk/note-settings.js
//
// The reader's settings for their own notes, bookmarks, and highlights
// (STUDY-DESK.md, "Decisions", 2026-10-07: the margin switch, and the margin
// notes' look; SITE-FEATHERBOA.md, "Display": "Your marks"):
//   - "Your marks" (DI-11), one switch in the Display tray's View, which H
//     flips: on while anything of the reader's shows, and off is "Hide my
//     marks" (M1; decision 8 under "the margin switch"), which remembers what
//     showed, turns it all off, and puts it back. It merged the tray's and the
//     Notebook panel's four switches with no key of its own, so no reader lost
//     a setting; src/lib/desk-marks.mjs is the rule.
//   - Its finer choices, on All settings (/settings; DI-13): "Notes in the
//     margin" (shown by default), "Bookmarks" (their marks in the margin; BVJ,
//     2026-10-08: a switch of their own, apart from notes), and "Highlights"
//     (whether the page draws them). The most recent action wins without more
//     code: turning one on while the marks are hidden brings back that one
//     alone, and the switch is on again.
//   - Read View's own highlights (`readHighlights`, hidden by default; audit
//     C2/H1), which no page offers since Read View retired, but which the hide
//     still remembers and puts back with the rest (queue Q88).
//     `highlightSetting()` names the one this page uses.
//   - "Handwriting / Plain": Playpen Sans or the text face for margin notes
//     (handwriting by default), in the Notebook panel's Settings tab until
//     Playpen Sans goes (DI-17, Phase 5). The reader's own font choice,
//     Atkinson Hyperlegible or OpenDyslexic, still wins: global.css sets
//     every element to it under html[data-font].
//
// Like the tray's own settings, each is an attribute on <html>, absent for the
// default, with one localStorage key; unlike them there is no pre-paint
// script, since nothing of the desk paints before this file runs.

// The desk's first stage carries this file, so the Display tray's switch is
// there before the shell (Audit 3, LG3-2): it imports only light modules,
// none of which reaches the store or the page's text. Keep it that way
// (test/desk-first-stage.test.js holds it).
import { announce } from "./undo-bar.js";
import { prosePage, readBook } from "./page-kind.js";
import { FINER_MARKS, HIDE_KEY, MARK_SETTINGS, hideMarks, marksOn, readHidden, showMarks } from "../../lib/desk-marks.mjs";

const SETTINGS = {
  notes: { attr: "data-desk-notes", key: MARK_SETTINGS.notes.key, fallback: MARK_SETTINGS.notes.fallback },
  noteFont: { attr: "data-desk-note-font", key: "lit-desk-note-font", fallback: "handwriting" },
  bookmarks: { attr: "data-desk-bookmarks", key: MARK_SETTINGS.bookmarks.key, fallback: MARK_SETTINGS.bookmarks.fallback },
  highlights: { attr: "data-desk-highlights", key: MARK_SETTINGS.highlights.key, fallback: MARK_SETTINGS.highlights.fallback },
  readHighlights: {
    attr: "data-desk-read-highlights",
    key: MARK_SETTINGS.readHighlights.key,
    fallback: MARK_SETTINGS.readHighlights.fallback,
  },
};

// "Show the Notebook" left the Display tray (DI-16): the place line's Notebook
// button opens and folds the Notebook, and a stored "off" is read as shown
// (src/lib/desk-start.mjs), so the key is removed as the desk starts.
const OLD_SHOW_KEY = "lit-desk-show";

export const SETTINGS_EVENT = "desk:settings";

/** Sent when "Your marks" hides or shows everything: { hidden, from }. */
export const HIDE_EVENT = "desk:hide";

// What the switch stands for. Both views' highlights go, since "everything of
// the reader's" doesn't depend on the page. Read View's is off by default, so
// it is usually off already: that counts as hidden, and the state remembered
// for the way back includes it, so it stays off when the rest returns.
const HIDDEN_BY_M1 = Object.keys(MARK_SETTINGS);

/** What each of All settings' finer choices is called (DI-13): no "My." */
const FINER_LABELS = { notes: "Notes in the margin", bookmarks: "Bookmarks", highlights: "Highlights" };

/**
 * The setting that switches highlights on this page: Read View's own in Read
 * View, and the Read page's everywhere else. Callers needn't know which view
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

const markValues = () => Object.fromEntries(HIDDEN_BY_M1.map((name) => [name, getSetting(name)]));

/** Whether "Your marks" is on: anything of the reader's shows. */
export function marksShown() {
  return marksOn(markValues());
}

/** Whether everything of the reader's is hidden, which is when "Your marks" is off. */
export function allHidden() {
  return !marksShown();
}

function readHideRecord() {
  try { return readHidden(localStorage.getItem(HIDE_KEY)); } catch (_) { return null; }
}

/**
 * Hide everything of the reader's, remembering what showed, or put back what
 * was hidden (desk-marks.mjs). A remembered state that would show nothing
 * brings back the defaults, so showing always shows something. `from` says
 * where the reader did it ("tray", "settings", "key", "notice").
 */
export function setHideAll(hide, { from = null } = {}) {
  if (hide) {
    const plan = hideMarks(markValues(), readHideRecord());
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(plan.saved)); } catch (_) {}
    for (const name of HIDDEN_BY_M1) setSetting(name, plan.values[name]);
  } else {
    const back = showMarks(readHideRecord());
    try { localStorage.removeItem(HIDE_KEY); } catch (_) {}
    for (const name of HIDDEN_BY_M1) setSetting(name, back[name]);
  }
  // The key and the command change a page with nothing to read out, unlike a
  // switch, whose own state is announced (NB-15).
  if (from === "key") {
    announce(hide ? "Your notes, bookmarks, and highlights are hidden." : "Your notes, bookmarks, and highlights are showing again.");
  }
  document.dispatchEvent(new CustomEvent(HIDE_EVENT, { detail: { hidden: hide, from } }));
}

/**
 * What to tell a reader who has just saved a note or bookmark that the page
 * won't show because its finer choice is off, or because "Your marks" is off:
 * the sentence, and a button that shows it. null when it shows. A visible
 * notice, not only a spoken one, and the setting is never switched back on for
 * them, since that could put private notes on a shared screen (NB-15).
 * @param {"notes" | "bookmarks"} name
 * @param {string} saved the sentence that says what was saved
 */
export function hiddenNotice(name, saved) {
  if (getSetting(name) === "on") return null;
  const off = allHidden();
  const reason = off ? "“Your marks” is off" : `“${FINER_LABELS[name]}” is off in All settings`;
  return {
    message: `${saved} It’s hidden because ${reason}.`,
    label: name === "notes" ? "Show notes" : "Show bookmarks",
    show: () => (off ? setHideAll(false, { from: "notice" }) : setSetting(name, "on")),
  };
}

/** Read the stored settings onto <html>, and follow changes made in other tabs. */
let started = false;
export function initNoteSettings() {
  // Once a page: the first stage starts it, and the shell's call then finds
  // the tray's switch already there (Audit 3, LG3-2).
  if (started) return;
  started = true;
  for (const name of Object.keys(SETTINGS)) {
    let v = null;
    try { v = localStorage.getItem(SETTINGS[name].key); } catch (_) {}
    applyAttr(name, v || SETTINGS[name].fallback);
  }
  try { localStorage.removeItem(OLD_SHOW_KEY); } catch (_) {}
  window.addEventListener("storage", (e) => {
    const name = Object.keys(SETTINGS).find((n) => SETTINGS[n].key === e.key);
    if (!name) return;
    const value = e.newValue || SETTINGS[name].fallback;
    applyAttr(name, value);
    document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { name, value } }));
  });
  document.addEventListener("lit:desk-hide", () => setHideAll(marksShown(), { from: "key" }));
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

/** Whether the single-key shortcuts are on (keyboard-shortcuts.js; WCAG 2.1.4), told again whenever they change. */
function followShortcuts(update) {
  const on = () => {
    try { return localStorage.getItem("lit-shortcuts") !== "off"; } catch (_) { return true; }
  };
  update(on());
  document.addEventListener("lit:shortcuts-changed", () => update(on()));
  window.addEventListener("storage", (e) => { if (e.key === "lit-shortcuts") update(on()); });
}

/** A kit switch (`button[role=switch]`) whose state is `isOn()`, pressed to `toggle()`. */
function kitSwitch(label, { isOn, toggle }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kit-switch";
  button.setAttribute("role", "switch");
  button.textContent = label;
  const sync = () => button.setAttribute("aria-checked", String(isOn()));
  button.addEventListener("click", () => {
    toggle();
    sync();
  });
  sync();
  document.addEventListener(SETTINGS_EVENT, sync);
  return button;
}

/**
 * "Your marks" (DI-11, DI-12): the switch, and the line under it that says
 * what marks are, since this is where a reader first meets the word (CP-11),
 * and that H flips them, said only while the shortcuts are on (NB-18).
 * `from` names where it is ("tray", "settings"); `hintClass` is its host's.
 */
function marksSwitch({ from, hintClass }) {
  const button = kitSwitch("Your marks", { isOn: marksShown, toggle: () => setHideAll(marksShown(), { from }) });
  const hint = document.createElement("p");
  hint.className = hintClass;
  hint.id = `deskMarksHint${++uid}`;
  button.setAttribute("aria-describedby", hint.id);
  followShortcuts((keys) => {
    if (keys) button.setAttribute("aria-keyshortcuts", "H");
    else button.removeAttribute("aria-keyshortcuts");
    hint.textContent = keys
      ? "Your notes, highlights, and bookmarks. Press H to hide or show them; nothing is deleted."
      : "Your notes, highlights, and bookmarks. Hiding them deletes nothing.";
  });
  return { button, hint };
}

/**
 * The tray's part (BVJ, 2026-11-07: opening the tray must not load the desk):
 * on a chapter's page, "Your marks" ends View, and a line under "Verse and
 * chapter numbers" says that a selection reaches the same actions as a verse
 * number (audit C10: hiding the numbers mustn't hide the way in). /desk's tray
 * has no View: "Highlights," the one mark that means anything there, is on
 * each LIT pane's bar and is that pane's own (E108; lit-show.js), and "Your
 * marks" still hides the highlights in every pane (lit-marks.js). An article
 * or the glossary would get a View of its own (injectProseView).
 */
function injectIntoTray() {
  const view = document.querySelector("#fontTray [data-tray-view]");
  if (!view) {
    if (prosePage()) injectProseView();
    return;
  }
  // A draft's entry has no text, so nothing of the reader's is drawn on it.
  if (!document.querySelector(".chapter-paragraphs")) return;
  const vn = view.querySelector('[data-tray-switch="vn"]');
  if (vn) {
    const hint = document.createElement("p");
    hint.className = "font-tray__hint";
    hint.id = "deskVerseNumbersHint";
    hint.dataset.desk = "";
    hint.textContent = "With verse and chapter numbers off, select any words for the same actions.";
    vn.after(hint);
    vn.setAttribute("aria-describedby", hint.id);
  }
  const { button, hint } = marksSwitch({ from: "tray", hintClass: "font-tray__hint" });
  button.dataset.traySwitch = "marks";
  button.dataset.desk = "";
  hint.dataset.desk = "";
  view.append(button, hint);
}

/**
 * An article or the glossary (N11) has no View in the tray, since it has no
 * verse numbers, so "Your marks" gets one of its own before the tray's foot.
 * Never called in version 1, where N11 is off and prosePage() is null.
 */
function injectProseView() {
  const foot = document.querySelector("#fontTray .font-tray__foot");
  if (!foot) return;
  const row = document.createElement("div");
  row.className = "font-tray__row";
  row.dataset.desk = "";
  row.setAttribute("role", "group");
  row.setAttribute("aria-labelledby", "deskTrayView");
  row.innerHTML = `<p class="font-tray__legend" id="deskTrayView">View</p><div class="font-tray__switches"></div>`;
  const { button, hint } = marksSwitch({ from: "tray", hintClass: "font-tray__hint" });
  button.dataset.traySwitch = "marks";
  row.lastElementChild.append(button, hint);
  foot.before(row);
}

/**
 * All settings' marks (DI-13): "Your marks," then its finer choices, "Notes
 * in the margin," "Bookmarks," and "Highlights," as kit switches that follow
 * their settings wherever they change. /settings isn't Read View, so its
 * "Highlights" is the Read page's.
 */
export function settingsMarkControls() {
  const wrap = document.createElement("div");
  wrap.className = "settings-page__switches";
  const master = marksSwitch({ from: "settings", hintClass: "settings-page__hint" });
  master.button.dataset.settingsSwitch = "marks";
  wrap.append(master.button, master.hint);
  const finer = document.createElement("div");
  finer.className = "settings-page__finer";
  finer.setAttribute("role", "group");
  // "Marks" only in "your marks" (NB-19).
  finer.setAttribute("aria-label", "Which of your marks show");
  for (const name of FINER_MARKS) {
    const unsupported = name === "highlights" && !highlightsSupported();
    const button = kitSwitch(unsupported ? "Highlights (this browser can’t draw them)" : FINER_LABELS[name], {
      isOn: () => getSetting(name) === "on",
      toggle: () => setSetting(name, getSetting(name) === "on" ? "off" : "on"),
    });
    button.dataset.settingsSwitch = name;
    // This browser can't draw highlights (LG-5): said rather than a switch that does nothing.
    if (unsupported) button.disabled = true;
    finer.append(button);
  }
  wrap.append(finer);
  return wrap;
}

/**
 * The notes' lettering for the Notebook panel's Settings tab, the one of its
 * switches left there (Featherboa moved the rest to the tray and All settings;
 * the lettering goes with Playpen Sans, DI-17): Handwriting or Plain, as a
 * pill of two radio buttons that follows its setting wherever it changes.
 */
export function panelLettering() {
  const n = ++uid;
  const seg = document.createElement("div");
  seg.className = "desk-seg";
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", "Notes’ lettering");
  seg.innerHTML = ["handwriting", "plain"]
    .map(
      (v) => `<label class="desk-seg__option">
        <input type="radio" class="desk-seg__input" name="desk-note-font-${n}" value="${v}" />
        <span class="desk-seg__text">${v === "handwriting" ? "Handwriting" : "Plain"}</span>
      </label>`,
    )
    .join("");
  const radios = Array.from(seg.querySelectorAll("input"));
  for (const r of radios) r.addEventListener("change", () => r.checked && setSetting("noteFont", r.value));
  const sync = () => {
    const font = getSetting("noteFont");
    for (const r of radios) r.checked = r.value === font;
  };
  sync();
  document.addEventListener(SETTINGS_EVENT, sync);
  const wrap = document.createElement("div");
  wrap.className = "desk-panel__settings";
  wrap.append(seg);
  return wrap;
}
