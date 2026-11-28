// src/scripts/keep-reading-place.js
//
// Keep the reader's place through a change that reflows the page. The
// Display tray's face, text size, spacing, Justify and numbers settings reflow it, and so
// does opening or closing the Study Desk's docked panel, which narrows the
// page. Either would carry a reader's place away (on a chapter's page that
// has read on, several chapters' worth).
//
// It pins the line of text at the reading line (10% down, as last-read.js's;
// BVJ, 2026-11-04, it was 30%, just inside the text column) and scrolls it back to where it was. A paragraph's top is not
// enough: a long paragraph grows below its top, so the line being read still
// drifts. Moved here from SiteHeader.astro's Display tray when the desk's
// panel needed the same thing (phase 1b).

// In order of preference (a selector list would return whichever comes
// first in the document, which is always <main>). Only the surface's left
// edge is read, which every chapter on a reading page shares.
const READING_SURFACES = [".chapter-paragraphs", ".intro", ".article__body", "main"];

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
  const y = window.innerHeight * 0.1;
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

// Scroll `line` back to where it was (`before`, its top in the window).
function putBack(line, before) {
  const after = line?.getClientRects()[0]?.top;
  if (before === undefined || after === undefined) return;
  const delta = after - before;
  if (Math.abs(delta) < 1) return;
  holding = true;
  window.scrollBy({ top: delta, behavior: "instant" });
  requestAnimationFrame(() => requestAnimationFrame(() => { holding = false; }));
}

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// The newest hold that waits for fonts; an older one stands down.
let waiting = 0;

/**
 * Run `change`, then scroll the line that was at the reading line back to it.
 *
 * `fonts` is for a change of face (the Display tray's Text): the text reflows
 * twice, once with the attribute and again when the face's files arrive, so
 * the line is put back at once and again each time the fonts named (CSS
 * `font` strings) and then every font the page now asks for have loaded. A
 * reader who scrolls, presses a key, or touches the page outside `overlay`
 * in the meantime has taken the page back, and is left alone; so is a hold
 * a newer one has replaced.
 */
export function keepReadingPlace(change, { overlay = null, fonts = null } = {}) {
  const line = lineAt(overlay);
  const before = line?.getClientRects()[0]?.top;
  change();
  putBack(line, before);
  if (!fonts?.length || before === undefined || !document.fonts) return;
  const mine = ++waiting;
  let taken = false;
  const take = (e) => {
    if (!(overlay && e.target instanceof Node && overlay.contains(e.target))) taken = true;
  };
  const events = ["wheel", "touchmove", "keydown", "pointerdown"];
  for (const type of events) window.addEventListener(type, take, { capture: true, passive: true });
  const stillMine = () => mine === waiting && !taken;
  (async () => {
    try { await Promise.all(fonts.map((font) => document.fonts.load(font))); } catch (_) {}
    // A face's other files (its bold, its italic) can follow the first.
    for (let i = 0; i < 4; i += 1) {
      await frame();
      if (!stillMine()) return;
      putBack(line, before);
      if (document.fonts.status === "loaded") return;
      try { await document.fonts.ready; } catch (_) {}
    }
  })().finally(() => {
    for (const type of events) window.removeEventListener(type, take, { capture: true });
  });
}
