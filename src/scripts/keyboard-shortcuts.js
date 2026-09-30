// src/scripts/keyboard-shortcuts.js
//
// Keyboard shortcuts for reading (audit U4), on every page:
//   /          search (the page's own box, or the header's search strip)
//   g          Go to passage, where the page has the picker
//   ← → [ ]    previous and next chapter: Study View's Previous/Next links,
//              or the neighbouring chapter in Read View
//
// On by default, with a "Keyboard shortcuts" box in the Display tray to turn
// them off (localStorage["lit-shortcuts"] = "off"; absent = on). The off
// switch is required, not a nicety: single-key shortcuts fire when a
// speech-recognition user dictates a word (WCAG 2.1.4).
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
].join(", ");

function busy(target) {
  if (document.querySelector("dialog[open]")) return true;
  const el = target instanceof Element ? target : document.activeElement;
  return Boolean(el?.closest(KEYS_OWNED_BY));
}

const visible = (el) => Boolean(el) && el.offsetParent !== null;

function openSearch() {
  if (document.getElementById("headerSearch")) {
    document.dispatchEvent(new CustomEvent("lit:search-open"));
    return true;
  }
  // Study View's phone toolbar keeps its search behind a button.
  const toggle = document.querySelector(".tools-search-toggle");
  if (visible(toggle) && toggle.getAttribute("aria-expanded") !== "true") {
    toggle.click();
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
  // ReadMenu swaps its fallback link for a button of the same class.
  // Until then it is still the no-JS link, which would navigate away.
  const trigger = Array.from(document.querySelectorAll("button.read-menu__trigger")).find(visible);
  if (!trigger) return false;
  trigger.click();
  return true;
}

function goToChapter(step) {
  // Study View (and intros and drafts): the top Previous/Next links.
  const link = document.querySelector(`.chapter-nav a[rel="${step < 0 ? "prev" : "next"}"]`);
  if (link) {
    link.click();
    return true;
  }
  // Read View: the whole book is on the page, so move to the next chapter
  // heading. The picker's root tracks which chapter is being read.
  const current = Number(document.querySelector("[data-current-chapter]")?.dataset.currentChapter);
  if (!current) return false;
  const target = document.getElementById(`ch-${current + step}`);
  if (!target) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#ch-${current + step}`);
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
  }
  if (handled) event.preventDefault();
});
