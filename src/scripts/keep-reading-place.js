// src/scripts/keep-reading-place.js
//
// Keep the reader's place through a change that reflows the page. The
// Display tray's text size, spacing and numbers settings reflow it, and so
// does opening or closing the Study Desk's docked panel, which narrows the
// page. Either would carry a reader's place away (in Read View, a whole
// book's worth).
//
// It pins the line of text at the reading line (30% down, just inside the
// text column) and scrolls it back to where it was. A paragraph's top is not
// enough: a long paragraph grows below its top, so the line being read still
// drifts. Moved here from SiteHeader.astro's Display tray when the desk's
// panel needed the same thing (phase 1b).

// In order of preference (a selector list would return whichever comes
// first in the document, which is always <main>).
const READING_SURFACES = [".chapter-paragraphs", ".intro", ".rm-text", ".article__body", "main"];

let holding = false;

/**
 * True for the moment the one corrective scroll is under way, so a panel that
 * closes on scroll (the Display tray) can let it through.
 */
export function isHoldingPlace() {
  return holding;
}

// The text at the reading line, as a one-character range. `overlay`, if
// given, is taken out of hit-testing while measuring, since it can sit over
// the text (the tray on a phone).
function lineAt(overlay) {
  const surface = READING_SURFACES.map((s) => document.querySelector(s)).find(Boolean);
  if (!surface) return null;
  const x = surface.getBoundingClientRect().left + 24;
  const y = window.innerHeight * 0.3;
  if (overlay) overlay.style.pointerEvents = "none";
  let node = null;
  let offset = 0;
  try {
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) ({ offsetNode: node, offset } = pos);
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range) ({ startContainer: node, startOffset: offset } = range);
    }
  } finally {
    if (overlay) overlay.style.pointerEvents = "";
  }
  if (node?.nodeType !== Node.TEXT_NODE || !node.length) return null;
  const range = document.createRange();
  const start = Math.min(offset, node.length - 1);
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  return range;
}

/** Run `change`, then scroll the line that was at the reading line back to it. */
export function keepReadingPlace(change, { overlay = null } = {}) {
  const line = lineAt(overlay);
  const before = line?.getClientRects()[0]?.top;
  change();
  const after = line?.getClientRects()[0]?.top;
  if (before === undefined || after === undefined) return;
  const delta = after - before;
  if (Math.abs(delta) < 1) return;
  holding = true;
  window.scrollBy({ top: delta, behavior: "instant" });
  requestAnimationFrame(() => requestAnimationFrame(() => { holding = false; }));
}
