// src/lib/desk-notes.mjs
//
// The rules behind the reader's notes in Study View's left margin
// (STUDY-DESK.md, "Decisions", 2026-10-07: the margin switch, and the margin
// notes' look). Pure: positions in, positions out, so Node can test what the
// page does. src/scripts/desk/notes-margin.js measures the page and draws.
//
// What the decisions ask of the margin:
//   - each note sits level with the first word it was made on;
//   - shown in full where there is about 230px of room (C9), and as its glyph
//     in a circle where there isn't, whatever the reader's setting;
//   - a note in full may run past the text it hangs on, and nothing changes
//     for that alone; only one that would run into the note below is cut off
//     where that note begins;
//   - circles sit level with their first word too, and go side by side only
//     where two would overlap, while the row has room; past that, they stack;
//   - a note opened from its circle opens above or below, whichever keeps its
//     words clear and fits the window.

/** Free space beside the column a note in full needs (audit C9). */
export const FULL_ROOM = 230;
/** Gap between a note in full and the text. */
export const NOTE_GAP = 24;
/** The widest a note in full grows, however wide the margin. */
export const NOTE_MAX_WIDTH = 260;
/** Space kept between a note and the window's edge. */
export const EDGE = 16;
/** A circle's diameter, and the gap between circles. */
export const CIRCLE = 28;
export const CIRCLE_GAP = 6;
/** Gap between a circle row's last circle and the text. */
export const CIRCLE_INSET = 14;
/** Below this there is no margin at all: the notes stay in the panel. */
export const CIRCLE_ROOM = CIRCLE + CIRCLE_INSET + 8;
/** Space between stacked notes in full. */
export const STACK_GAP = 6;
/**
 * A bookmark's mark (a trial, BVJ 2026-10-07): its glyph in red, not in a
 * circle, level with the verse and right-aligned in the notes' column, the
 * side nearest the text. A note in full that a mark is in the way of makes
 * RIBBON_LANE of room for it (roomForMarks); where notes show as circles, a
 * mark takes a place in their rows like a circle.
 */
export const RIBBON = 14;
export const RIBBON_LANE = RIBBON + 6;

/**
 * Which notes in full a bookmark's mark is in the way of, and how each makes
 * room (BVJ, 2026-10-08: only those notes, and further left rather than
 * narrower where the margin allows). `notes` are as shown: `y` and `height`
 * (the height after any cut). `marks` are the marks' tops. `spare` is the
 * room left of the notes' column, before the window's edge. Returns a Map of
 * id to { shift, narrow }: move left by `shift`, lose `narrow` of width.
 */
export function roomForMarks(notes, marks, { lane = RIBBON_LANE, size = RIBBON, spare = 0 } = {}) {
  const out = new Map();
  const shift = Math.max(0, Math.min(lane, spare));
  for (const n of notes) {
    const hit = marks.some((top) => top < n.y + n.height && top + size > n.y);
    if (hit) out.set(n.id, { shift, narrow: lane - shift });
  }
  return out;
}

/**
 * How the margin shows notes: "full", "circles", or "none" when even a circle
 * has no room. `free` is the space from the window's edge to the text, in px.
 */
export function marginMode(free) {
  if (free >= FULL_ROOM) return "full";
  if (free >= CIRCLE_ROOM) return "circles";
  return "none";
}

/** The width a note in full takes, given the free space. */
export function noteWidth(free) {
  return Math.max(0, Math.min(NOTE_MAX_WIDTH, free - NOTE_GAP - EDGE));
}

/**
 * Notes in full, top to bottom. Each item gives the top of its first word's
 * line (`top`), that line's height (`lineHeight`), the note's own line height
 * (`noteLine`) and its height when shown whole (`height`). Returns, in the
 * same order, each note's `y`, and `cut` with the `maxHeight` it is cut to
 * when it would run into the note below.
 *
 * A note whose word shares a line with the note above starts below that
 * note's first line, so two notes on one line never overlap.
 */
export function layoutFull(items, { gap = STACK_GAP } = {}) {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const placed = [];
  let floor = -Infinity;
  for (const it of sorted) {
    let y = it.top + (it.lineHeight - it.noteLine) / 2;
    if (y < floor) y = floor;
    placed.push({ id: it.id, y, height: it.height, noteLine: it.noteLine });
    floor = y + it.noteLine + gap;
  }
  return placed.map((p, i) => {
    const next = placed[i + 1];
    const room = next ? next.y - p.y - gap : Infinity;
    const cut = p.height > room + 0.5;
    return { id: p.id, y: p.y, cut, maxHeight: cut ? Math.max(room, p.noteLine) : null };
  });
}

/**
 * Circles, top to bottom. Each item gives its first word's line `top` and
 * `lineHeight`. `perRow` is how many circles fit side by side. Returns each
 * circle's `y` and its `slot` counted from the text outward (0 is nearest the
 * text), in reading order.
 */
export function layoutCircles(items, { perRow = 1, size = CIRCLE, gap = CIRCLE_GAP } = {}) {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const rows = [];
  for (const it of sorted) {
    const want = it.top + (it.lineHeight - size) / 2;
    const row = rows[rows.length - 1];
    if (!row || want >= row.y + size + 2) rows.push({ y: want, ids: [it.id] });
    else if (row.ids.length < Math.max(1, perRow)) row.ids.push(it.id);
    else rows.push({ y: row.y + size + gap, ids: [it.id] });
  }
  const out = [];
  for (const row of rows) {
    // Reading order runs left to right, so the last in the row sits nearest
    // the text.
    row.ids.forEach((id, k) => out.push({ id, y: row.y, slot: row.ids.length - 1 - k }));
  }
  return out;
}

/** How many circles fit side by side in `width` px. */
export function circlesPerRow(width, { size = CIRCLE, gap = CIRCLE_GAP, inset = CIRCLE_INSET } = {}) {
  return Math.max(1, Math.floor((width - inset + gap) / (size + gap)));
}

/**
 * Where a note opened from its circle goes: below the circle when that keeps
 * its words clear and fits the window, otherwise above, otherwise whichever
 * side has more room. All in viewport px. `words` is the top and bottom of
 * the text the note hangs on.
 *
 * @returns {{ side: "below" | "above", top: number }}
 */
export function popoverPlace({ circleTop, size = CIRCLE, words, height, viewTop = 0, viewBottom, pad = 8 }) {
  const below = Math.max(circleTop + size + pad, words.bottom + 6);
  const above = Math.min(circleTop - pad, words.top - 6) - height;
  const roomBelow = viewBottom - pad - (below + height);
  const roomAbove = above - (viewTop + pad);
  if (roomBelow >= 0) return { side: "below", top: below };
  if (roomAbove >= 0) return { side: "above", top: above };
  return roomBelow >= roomAbove ? { side: "below", top: below } : { side: "above", top: above };
}

/**
 * A quotation short enough to read before every note: the first `words`
 * words, then "…" when there were more.
 */
export function shortQuote(text, words = 10) {
  const all = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (all.length <= words) return all.join(" ");
  return all.slice(0, words).join(" ") + "…";
}

/**
 * What a screen reader hears before a note's own words (BVJ, 2026-10-07):
 * "My note on ‘nothing is now a verdict’, Romans 8:1: ". A note on whole
 * verses, with no quote, names only the reference.
 */
export function noteOpening(record, ref) {
  const q = record?.quote?.exact ? shortQuote(record.quote.exact) : "";
  return q ? `My note on ‘${q}’, ${ref}: ` : `My note on ${ref}: `;
}

/** Each marker as a reader names it (the apps' words). */
export const MARKER_NAMES = Object.freeze({
  note: "Note",
  emphasis: "Emphasis",
  question: "Question",
  heart: "Heart",
  bookmark: "Bookmark",
  lightbulb: "Lightbulb",
  flame: "Flame",
});
