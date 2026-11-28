// src/scripts/keyboard-shortcuts.js
//
// Keyboard shortcuts for reading (audit U4), on every page:
//   /          search (the place line's Search on a chapter or an
//              introduction, the phone bar's there on a phone, the page's
//              own box, or the header's search strip; on /desk, a Search pane)
//   g          the passage picker (passage-picker.js)
//   ← → [ ]    previous and next chapter: the place line's ‹ › (on a
//              chapter's page, the start of the chapter before or after the
//              one being read, loaded first: read-on.js), or on /desk the
//              pane being read (the leading LIT pane)
//   h          hide or show your marks ("Your marks"), where Study is on (M1)
//
// On by default, with a "Keyboard shortcuts" switch on All settings
// (/settings, settings-page.js; the Display tray's box until Featherboa's
// Phase 4) to turn them off (localStorage["lit-shortcuts"] = "off"; absent =
// on). The off switch is required, not a nicety: single-key shortcuts fire
// when a speech-recognition user dictates a word (WCAG 2.1.4).
//
// They never act while the reader is typing or working a control that uses
// these keys itself (a radio group, a menu, a grid, an open dialog), and
// never with Ctrl, Alt or Cmd held, so browser shortcuts like Alt+← are
// untouched. The arrows also stand down whenever the page scrolls sideways,
// since that is how someone zoomed in reads along a line.

const STORAGE_KEY = "lit-shortcuts";

function enabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const KEYS_OWNED_BY = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='dialog']",
  "[role='menu']",
  "[role='listbox']",
  "[role='grid']",
  "[role='radiogroup']",
  "[role='tablist']",
  "[role='slider']",
  "dialog",
  // The passage picker on /read, whose books and chapters take the arrows.
  "[data-picker]",
  // The Study Desk's docked panel owns its keys: lists, tabs and, later,
  // its own search.
  "[data-desk-dock]",
].join(", ");

function busy(target) {
  if (document.querySelector("dialog[open]")) return true;
  const el = target instanceof Element ? target : document.activeElement;
  return Boolean(el?.closest(KEYS_OWNED_BY));
}

const visible = (el) => Boolean(el) && el.offsetParent !== null;

function openSearch() {
  // /desk has no search box in its header: it answers with a Search pane
  // (focused if one is open, else opened), and says why when it can't (3m).
  // Only where the desk is on; the page that listens is the desk's.
  if (document.documentElement.hasAttribute("data-desk")) {
    const ev = new CustomEvent("lit:desk-search", { cancelable: true });
    document.dispatchEvent(ev);
    if (ev.defaultPrevented) return true;
  }
  if (document.getElementById("headerSearch")) {
    document.dispatchEvent(new CustomEvent("lit:search-open"));
    return true;
  }
  // A phone's reading page keeps its search behind the bar's Search, which
  // opens the field in place of the top row (phone-bars.js; still a link to
  // /search until that script has made it a button).
  const barSearch = document.querySelector("[data-bar-search]");
  if (visible(barSearch) && barSearch.getAttribute("aria-expanded") === "false") {
    barSearch.click();
    return true;
  }
  // From 700px the place line's Search opens the same field in place of the
  // line (place-line.js; a link to /search until that script runs). Once
  // open, the field below takes the key.
  const lineSearch = document.querySelector("[data-line-search]");
  if (visible(lineSearch) && lineSearch.getAttribute("aria-expanded") === "false") {
    lineSearch.click();
    return true;
  }
  const input = document.getElementById("site-search-input");
  if (visible(input)) {
    input.focus();
    input.select();
    return true;
  }
  return false;
}

function openPicker() {
  // The passage picker answers (passage-picker.js): the panel or the phone's
  // sheet opens at the books, or /read's field takes focus. Nothing answers
  // before its script runs, or on /desk.
  const ev = new CustomEvent("lit:picker-open", { cancelable: true });
  document.dispatchEvent(ev);
  return ev.defaultPrevented;
}

function goToChapter(step) {
  // A chapter, an introduction, or a draft: the place line's ‹ › (in the
  // page at every width; under 700px the phone's bar shows the same two). On
  // a chapter's page they follow the chapter being read, and read-on.js
  // answers their click by loading the next chapter and landing on it.
  const link = document.querySelector(`.place-line a[rel="${step < 0 ? "prev" : "next"}"]`);
  if (link) {
    link.click();
    return true;
  }
  // /desk has no Previous/Next of the page: the pane being read steps, as its
  // passage bar's arrows would. Only where the desk is on; the page that
  // listens is the desk's, so nothing of the desk is imported here.
  if (document.documentElement.hasAttribute("data-desk")) {
    const ev = new CustomEvent("lit:desk-chapter", { cancelable: true, detail: { step } });
    document.dispatchEvent(ev);
    if (ev.defaultPrevented) return true;
  }
  return false;
}

// Study's "Your marks" (M1, "Hide my marks" until Featherboa's Phase 4),
// only where the desk is on: the desk
// itself listens for the event, so with the preview off the key does nothing.
function toggleDeskHide() {
  if (!document.documentElement.hasAttribute("data-desk")) return false;
  document.dispatchEvent(new CustomEvent("lit:desk-hide"));
  return true;
}

const scrollsSideways = () =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!enabled() || busy(event.target)) return;

  let handled = false;
  switch (event.key) {
    case "/":
      handled = openSearch();
      break;
    case "g":
      handled = openPicker();
      break;
    case "ArrowLeft":
    case "ArrowRight":
      if (event.shiftKey || scrollsSideways()) return;
      handled = goToChapter(event.key === "ArrowLeft" ? -1 : 1);
      break;
    case "[":
    case "]":
      handled = goToChapter(event.key === "[" ? -1 : 1);
      break;
    // Lowercase only: the switch matches event.key exactly, so Shift+H ("H")
    // never reaches this case.
    case "h":
      handled = toggleDeskHide();
      break;
  }
  if (handled) event.preventDefault();
});
