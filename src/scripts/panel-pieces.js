// src/scripts/panel-pieces.js
//
// The pieces the reader tools' panels are built from, shared so every panel
// behaves alike: the pointer that last pressed the page (a finger gets the
// chip layout, a mouse the rows of a computer's menu), copying, the buttons
// and their rows, the attribution line, snapping a selection to whole words,
// and placing a panel beside a touch selection clear of the phone's own
// selection UI. Study View's verse menu and selection panel
// (chapter-tools.js) and the glossary's selection panel
// (glossary-selection.js) use them. Moved here unchanged from
// chapter-tools.js when the glossary got a selection panel (2026-10-09).

import { closePanel } from "./lit-panel.js";

// The kind of pointer that last pressed the page: "mouse", "touch" or "pen".
// Both panels take their layout from it, not from the screen width: a finger
// gets the chip layout, a mouse the rows of a computer's menu.
let lastPointerType = "mouse";
document.addEventListener(
  "pointerdown",
  (e) => {
    lastPointerType = e.pointerType || "mouse";
  },
  true
);

/** The kind of pointer that last pressed the page ("mouse", "touch" or "pen"). */
export function pointerType() {
  return lastPointerType;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function menuButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lit-panel__btn";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    const done = await onClick();
    if (done === false) {
      // Clipboard can fail (permissions policy, embedded webviews) —
      // never fail silently.
      btn.textContent = "Couldn’t copy — try selecting the text";
      btn.classList.add("lit-panel__btn--error");
      return;
    }
    btn.textContent = "Copied ✓";
    btn.classList.add("lit-panel__btn--done");
    setTimeout(closePanel, 700);
  });
  return btn;
}

/**
 * Shared text with its attribution line. No added quotation marks — verses
 * containing dialogue would otherwise produce nested double quotes; the
 * attribution carries it.
 */
export function withReference(text, ref) {
  return text + "\n— " + ref + " (LIT)";
}

/**
 * Buttons that share one row. The row is invisible except in the chip layout
 * (either panel opened by a finger), where they sit side by side, a
 * pair in exact halves. A missing button (null: Share… where there is no
 * share sheet) leaves the rest the row.
 */
export function panelRow(...items) {
  const row = document.createElement("div");
  row.className = "lit-panel__row";
  const kept = items.filter(Boolean);
  if (kept.length === 2) row.classList.add("lit-panel__row--halves");
  row.append(...kept);
  return row;
}

// Word characters for snapping. An apostrophe or hyphen counts only between
// two of them ("don’t", "One-of-a-kind"), so a closing quote is never pulled
// into the selection.
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const WORD_JOINER = /['’-]/;

function isWordCharAt(text, i) {
  const ch = text[i];
  if (!ch) return false;
  if (WORD_CHAR.test(ch)) return true;
  return (
    WORD_JOINER.test(ch) &&
    WORD_CHAR.test(text[i - 1] || "") &&
    WORD_CHAR.test(text[i + 1] || "")
  );
}

/**
 * Widen a range that starts or ends mid-word to take in the whole word. Phones
 * already select whole words; a mouse drag often doesn't. Within one text node
 * only — a word split across nodes is rare enough to leave as selected.
 */
export function snapToWords(range) {
  const { startContainer: s, endContainer: e } = range;
  if (s.nodeType === Node.TEXT_NODE) {
    let i = range.startOffset;
    if (isWordCharAt(s.data, i - 1) && isWordCharAt(s.data, i)) {
      while (i > 0 && isWordCharAt(s.data, i - 1)) i--;
      range.setStart(s, i);
    }
  }
  if (e.nodeType === Node.TEXT_NODE) {
    let j = range.endOffset;
    if (isWordCharAt(e.data, j - 1) && isWordCharAt(e.data, j)) {
      while (j < e.data.length && isWordCharAt(e.data, j)) j++;
      range.setEnd(e, j);
    }
  }
}

// Room the phone's own selection UI needs, which a page can't measure: the
// drag handle hanging below the last line, and the Copy / Share bubble, which
// the OS puts above the selection when there's room and below it otherwise.
const HANDLE_CLEARANCE = 28;
const OS_BUBBLE_CLEARANCE = 64;
export const PANEL_EDGE = 12;

/**
 * Placement for a touch selection: beside it, where the reader is looking,
 * on whichever side the OS bubble isn't. Normally just below the selection;
 * below the bubble when a selection near the top pushes the bubble down; and
 * above the bubble when there's no room below. A selection filling the screen
 * leaves no clear side, so it falls back to the bottom edge.
 */
export function placeBesideTouchSelection(rect) {
  return (el) => {
    el.style.maxWidth = window.innerWidth - 2 * PANEL_EDGE + "px";
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const viewH = window.innerHeight;
    const bubbleAbove = rect.top >= OS_BUBBLE_CLEARANCE;

    const below = rect.bottom + HANDLE_CLEARANCE + (bubbleAbove ? 0 : OS_BUBBLE_CLEARANCE);
    const above = rect.top - height - PANEL_EDGE - (bubbleAbove ? OS_BUBBLE_CLEARANCE : 0);
    let top;
    if (below + height <= viewH - PANEL_EDGE) top = below;
    else if (above >= PANEL_EDGE) top = above;
    else top = viewH - height - PANEL_EDGE;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(PANEL_EDGE, Math.min(left, window.innerWidth - width - PANEL_EDGE));
    return { left: window.scrollX + left, top: window.scrollY + top };
  };
}
