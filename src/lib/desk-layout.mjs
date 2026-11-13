// src/lib/desk-layout.mjs
//
// The rules behind /desk's panes (STUDY-DESK.md, D9 and "Order of work",
// 3c): what a layout is, the arrangements the Layout menu offers, splitting a
// pane by dragging another to its edge, closing one, resizing, whether a
// layout fits the window, which LIT pane the following panes follow, and how
// a layout is kept in localStorage. Pure and unit-tested; the page that draws
// it is src/scripts/desk/desk-page.js.
//
// A layout is a tree. A leaf is a pane, `{ pane: { id, kind, pin } }`; a
// split is `{ split: "columns" | "rows", sizes, children }`, where "columns"
// sets its children side by side and "rows" stacks them, and `sizes` are
// fractions of the split that sum to 1. Splits are kept normal: no split
// with one child, and no split directly inside another of the same
// direction (its children join the outer one), so one shape has one tree.
//
// BVJ's answers (2026-10-18, D9, "Phase 3a's answers"):
// - one to four panes; the menu offers every arrangement mocked except four
//   rows, and dragging a pane to an edge of another splits it as well (the
//   middle of another swaps the two, E25);
// - a pane needs at least 280px across and 160px high, so an arrangement
//   that can't fit the window is grayed out with the reason;
// - several panes of a kind may be open. The LIT pane leads; This verse,
//   Greek, Footnotes, and Book Intro follow the LIT pane last worked in (the
//   active one), unless pinned with "Stay here", which the saved layout
//   remembers (Book Intro follows its book alone, E53);
// - the following panes that aren't pinned share one place, `layout.place`;
//   a pinned pane keeps its own (`pin.at`). Each LIT pane keeps where its
//   reader is too (`at`, 3e), and the active one's is the shared place, so
//   the following panes follow it; with no LIT pane open the place is chosen
//   with their passage picker (3d). All are passage strings, "john 3:16"
//   (desk-passage.mjs);
// - a Sheets pane keeps which sheet it shows (`sheet`, a record id, 3f), or
//   none for its list of sheets;
// - a layout the reader chose as Reading says so (`reading: true`, E107), for
//   as long as it is one LIT pane; any other way to one LIT pane is One pane;
// - a LIT pane keeps what its text shows (E108; desk-lit-marks.mjs): `hide`,
//   the marks its "Show" turned off, absent while it shows them all. Each
//   pane has its own, so two LIT panes can differ. Reading turns its pane's
//   off and lists the ones it turned off on the pane (`readingHid`), which
//   come back on when Reading ends, whatever ends it;
// - the original layout is the LIT text beside My Notes, 60/40, and the
//   layout is kept in this browser.

import { MARK_IDS, markList } from "./desk-lit-marks.mjs";
import { parsePassage } from "./desk-passage.mjs";

export const MAX_PANES = 4;
/**
 * Why no pane can be added once there are MAX_PANES (D9): built from the
 * constant, so the words can't drift from the limit (CP3-4).
 */
export const FULL_TEXT = `${["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][MAX_PANES] ?? MAX_PANES} is the most`;
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 160;
/** The width of the line between two panes, which the reader drags. */
export const HANDLE = 6;

/**
 * Every kind of pane, in the order the menus list them and a new slot is
 * filled with one not yet open (BVJ's order, 2026-11-08: the LIT's own
 * company first, the Greek after it, then the two that stand alone).
 * `follows`: it follows the active LIT pane unless pinned. `about`: one
 * short line under the label in the menus that list kinds (SH5-5), after the
 * help page's words for each; it says what the pane is on the desk, not what
 * the site's pages do. The page's registry (desk-panes.js) says what each one draws.
 */
export const KINDS = [
  { kind: "lit", label: "The LIT", follows: false, about: "The text; the other panes follow it" },
  { kind: "mine", label: "My Notes", follows: true, about: "What you have kept: notes, highlights, and bookmarks" },
  { kind: "verse", label: "This verse", follows: true, about: "Everything for the verse you are on" },
  { kind: "footnotes", label: "Footnotes", follows: true, about: "The chapter’s footnotes as a list" },
  // A book's introduction (E53; BVJ, 2026-11-06): the book of the passage it
  // follows, so its place is a passage like the others' and only the book is read.
  { kind: "intro", label: "Book Intro", follows: true, about: "The book’s introduction" },
  { kind: "greek", label: "Greek", follows: true, about: "The Greek text behind the LIT" },
  { kind: "sheet", label: "Sheets", follows: false, about: "A handout to print, present, or share" },
  // Searches by itself (3m, BVJ 2026-11-01): no passage bar and no pin; its
  // book menu offers "The book I’m reading" and keeps the book it was set to.
  { kind: "search", label: "Search", follows: false, about: "Scripture, the glossary, and your notes" },
];

const KIND_INFO = new Map(KINDS.map((k) => [k.kind, k]));

/**
 * Kinds that no longer exist, and the kind that took their place. "What I've
 * kept" was folded into My Notes (E17, 2026-11-02), which now searches,
 * filters and groups its list the way that pane did. A layout saved with the
 * old kind reads back as the new one (`checkLayout`), so no reader is left with
 * a pane that says it needs a newer copy of the page.
 */
export const RETIRED_KINDS = Object.freeze({ kept: "mine" });

/** True for a kind that follows the active LIT pane. */
export const isFollower = (kind) => Boolean(KIND_INFO.get(kind)?.follows);

/** A kind's name for a reader, or the kind itself for one this code doesn't know. */
export const kindLabel = (kind) => KIND_INFO.get(kind)?.label ?? kind;

/** A kind's one-line description for the kind menus, or "" for a kind this code doesn't know. */
export const kindAbout = (kind) => KIND_INFO.get(kind)?.about ?? "";

// ---- arrangements ---------------------------------------------------------

const P = { slot: true };
const cols = (...children) => ({ split: "columns", children });
const rows = (...children) => ({ split: "rows", children });

/**
 * The Layout menu, in its order. `shape` uses slots, filled in reading order
 * (left to right, then top to bottom) by `applyArrangement`.
 */
export const ARRANGEMENTS = [
  // Reading (E8): one LIT pane, whatever else was open, for a reader who wants
  // to read. It is One pane's shape; the layout's `reading` mark, set by
  // choosing this row, tells the two apart (E107).
  { id: "reading", label: "Reading", shape: P },
  { id: "one", label: "One pane", shape: P },
  { id: "cols-2", label: "Two columns", shape: cols(P, P) },
  { id: "rows-2", label: "Two rows", shape: rows(P, P) },
  { id: "cols-3", label: "Three columns", shape: cols(P, P, P) },
  { id: "rows-3", label: "Three rows", shape: rows(P, P, P) },
  { id: "one-left-two", label: "One beside two stacked", shape: cols(P, rows(P, P)) },
  { id: "two-one-right", label: "Two stacked beside one", shape: cols(rows(P, P), P) },
  { id: "one-over-two", label: "One above two", shape: rows(P, cols(P, P)) },
  { id: "two-over-one", label: "Two above one", shape: rows(cols(P, P), P) },
  { id: "cols-4", label: "Four columns", shape: cols(P, P, P, P) },
  { id: "grid", label: "Two by two", shape: cols(rows(P, P), rows(P, P)) },
];

const ARRANGEMENT_BY_ID = new Map(ARRANGEMENTS.map((a) => [a.id, a]));

const countSlots = (shape) => (shape.slot ? 1 : shape.children.reduce((n, c) => n + countSlots(c), 0));

/** How many panes an arrangement holds. */
export const slotCount = (id) => countSlots(ARRANGEMENT_BY_ID.get(id)?.shape ?? P);

// ---- reading the tree -----------------------------------------------------

/** The panes in reading order. */
export function panes(node) {
  if (!node) return [];
  if (node.pane) return [node.pane];
  return node.children.flatMap(panes);
}

/** The pane with this id, or null. */
export const findPane = (node, id) => panes(node).find((p) => p.id === id) ?? null;

/** The node at a path of child indexes ([] is the root), or null. */
export function nodeAt(node, path) {
  let n = node;
  for (const i of path) {
    if (!n?.children?.[i]) return null;
    n = n.children[i];
  }
  return n ?? null;
}

/** The path to a pane's leaf, or null. */
export function pathTo(node, id, path = []) {
  if (node.pane) return node.pane.id === id ? path : null;
  for (let i = 0; i < node.children.length; i++) {
    const found = pathTo(node.children[i], id, [...path, i]);
    if (found) return found;
  }
  return null;
}

/**
 * Which arrangement a layout is, or null when dragging made a shape the
 * menu doesn't list (four rows, or a deeper nesting).
 */
export function arrangementOf(layout) {
  const sig = (n) => (n.pane || n.slot ? "p" : `${n.split}(${n.children.map(sig).join(",")})`);
  const s = sig(layout.root);
  // Reading and One pane are one shape. Reading is the one the reader chose
  // as Reading (E107; BVJ, 2026-11-12): one LIT pane reached any other way
  // (One pane, closing the rest, a pane's kind) is One pane, with the text
  // and the Display tray's marks left as they are.
  if (layout.root.pane) return isReading(layout) ? "reading" : "one";
  return ARRANGEMENTS.find((a) => sig(a.shape) === s)?.id ?? null;
}

/** Whether a layout is Reading: one LIT pane that carries the mark. */
const isReading = (layout) => layout.reading === true && layout.root?.pane?.kind === "lit";

/**
 * Whether a change of layout leaves Reading: from Reading to anything else
 * (more panes, the one pane showing another kind, or One pane chosen over
 * it). Every way out counts, not only the Layout window's rows (DK3-2).
 */
export const leavesReading = (before, next) =>
  Boolean(before?.root && next?.root) && arrangementOf(before) === "reading" && arrangementOf(next) !== "reading";

/**
 * Each pane's accessible name, in the tree's order: its kind, and where a kind
 * is open more than once, its place among them ("The LIT, 2 of 2"), so a
 * screen reader's list of regions can tell them apart (DK3-8).
 */
export function regionNames(layout) {
  const all = panes(layout?.root);
  const total = new Map();
  for (const p of all) total.set(p.kind, (total.get(p.kind) ?? 0) + 1);
  const seen = new Map();
  return new Map(all.map((p) => {
    const n = (seen.get(p.kind) ?? 0) + 1;
    seen.set(p.kind, n);
    const name = kindLabel(p.kind);
    return [p.id, total.get(p.kind) > 1 ? `${name}, ${n} of ${total.get(p.kind)}` : name];
  }));
}

// ---- making and changing --------------------------------------------------

const clone = (x) => JSON.parse(JSON.stringify(x));
const even = (n) => Array.from({ length: n }, () => 1 / n);

function nextId(used) {
  for (let n = 1; ; n++) if (!used.has(`p${n}`)) return `p${n}`;
}

/** A new pane of a kind, with an id not in `layout`. */
export function newPane(layout, kind) {
  return { id: nextId(new Set(panes(layout?.root).map((p) => p.id))), kind, pin: null };
}

/**
 * Keep a tree normal: splits of one child become that child, a split inside
 * one of the same direction joins it (its sizes scaled by its share), and
 * sizes are made to sum to 1.
 */
export function normalize(node) {
  if (node.pane) return node;
  const kids = [];
  const sizes = [];
  const given = node.sizes?.length === node.children.length ? node.sizes : even(node.children.length);
  const total = given.reduce((a, b) => a + b, 0) || 1;
  node.children.forEach((child, i) => {
    const c = normalize(child);
    const share = given[i] / total;
    if (!c.pane && c.split === node.split) {
      c.children.forEach((cc, j) => { kids.push(cc); sizes.push(share * c.sizes[j]); });
    } else {
      kids.push(c);
      sizes.push(share);
    }
  });
  if (kids.length === 1) return kids[0];
  return { split: node.split, sizes, children: kids };
}

/**
 * The layout every reader starts with: the LIT beside My Notes, 60/40. Given
 * a place ("john 3:16"), the LIT pane starts there, so "Reset to the original
 * layout" keeps the reader's place (BA55); without one, the page starts it at
 * Continue reading.
 */
export function originalLayout(place = null) {
  const lit = { id: "p1", kind: "lit", pin: null };
  const layout = {
    root: {
      split: "columns",
      sizes: [0.6, 0.4],
      children: [
        { pane: lit },
        { pane: { id: "p2", kind: "mine", pin: null } },
      ],
    },
    active: "p1",
  };
  if (typeof place === "string" && place) {
    lit.at = place;
    layout.place = place;
  }
  return layout;
}

/**
 * The active LIT pane, settled: kept if it is still a LIT pane, else the
 * first one. A newly active pane brings its place with it, so the following
 * panes move to where its reader is. Every change to the panes or their kinds
 * ends here, so this is also where Reading ends (E107): its mark comes off a
 * layout that is no longer one LIT pane, and closing back down to one never
 * brings it back.
 */
function settleActive(layout) {
  if (layout.reading !== undefined && !isReading(layout)) delete layout.reading;
  // The marks Reading turned off come back with it (E8; DK3-2). The tree may
  // be shared with the layout this one was made from, so it is copied first.
  if (!isReading(layout) && panes(layout.root).some((p) => p.readingHid)) {
    layout.root = clone(layout.root);
    endReading(layout.root);
  }
  const lits = panes(layout.root).filter((p) => p.kind === "lit");
  if (!lits.some((p) => p.id === layout.active)) {
    const next = lits[0] ?? null;
    layout.active = next?.id ?? null;
    if (next?.at) layout.place = next.at;
  }
  if (layout.place) placeLitPanes(layout.root, layout.place);
  return layout;
}

/** Set the marks a pane hides: a checked list, or no field for none. Mutates `pane`. */
function setHide(pane, ids) {
  const list = markList(ids);
  if (list.length) pane.hide = list;
  else delete pane.hide;
}

/**
 * Reading is over: a LIT pane gets back the marks Reading turned off, those
 * still off (one the reader turned back on by hand is on already), and the
 * list is forgotten. Mutates `root`.
 */
function endReading(root) {
  for (const p of panes(root)) {
    if (!p.readingHid) continue;
    if (p.kind === "lit") setHide(p, markList(p.hide).filter((id) => !p.readingHid.includes(id)));
    delete p.readingHid;
  }
}

/**
 * Each LIT pane keeps where its reader is (BA52): one with no place of its
 * own yet, new or saved before it had one, is given `place` (the shared
 * place it shows) and keeps it, rather than following the active pane until
 * its reader scrolls it. Mutates `root`.
 */
function placeLitPanes(root, place) {
  for (const p of panes(root)) if (p.kind === "lit" && !p.at) p.at = place;
}

/**
 * Change to an arrangement from the menu. The open panes keep their reading
 * order and their pins; a pane the arrangement has no room for is closed
 * from the end; an empty slot gets the first kind not yet open (My Notes
 * again once every kind is). Sizes start even. Any row but Reading ends
 * Reading, One pane over the LIT included (E107).
 */
export function applyArrangement(layout, id) {
  const arrangement = ARRANGEMENT_BY_ID.get(id);
  if (!arrangement) return layout;
  if (id === "reading") return readingLayout(layout);
  const keep = panes(layout.root).slice(0, countSlots(arrangement.shape)).map(clone);
  const used = new Set(keep.map((p) => p.id));
  const open = new Set(keep.map((p) => p.kind));
  const fill = () => {
    if (keep.length) return keep.shift();
    const kind = KINDS.find((k) => !open.has(k.kind))?.kind ?? "mine";
    const pane = { id: nextId(used), kind, pin: null };
    used.add(pane.id);
    open.add(kind);
    return pane;
  };
  const build = (shape) =>
    shape.slot
      ? { pane: fill() }
      : { split: shape.split, sizes: even(shape.children.length), children: shape.children.map(build) };
  const next = { ...layout, root: normalize(build(arrangement.shape)) };
  delete next.reading;
  return settleActive(next);
}

/**
 * The Reading arrangement (E8): a single LIT pane, the active one if there is
 * one (else the first, else a new one at the shared place), with its place kept. The other panes close; nothing of theirs is
 * lost but their position, since a layout holds no records. The layout is
 * marked `reading`, which is what makes it Reading and not One pane (E107).
 *
 * Reading is the text with nothing between the reader and the words (BVJ,
 * 2026-11-04), so the pane's four marks go off, and the ones this turned off
 * are listed on the pane (`readingHid`) to come back when Reading ends
 * (settleActive). Choosing Reading again adds to that list, never replaces it
 * (LV3-2): a second press finds the marks off already and would forget them.
 */
export function readingLayout(layout) {
  const all = panes(layout.root);
  const active = findPane(layout.root, layout.active);
  const lit = active?.kind === "lit" ? active : all.find((p) => p.kind === "lit");
  const pane = lit ? clone(lit) : newPane(layout, "lit");
  pane.pin = null;
  if (!lit && layout.place) pane.at = layout.place;
  const hidden = markList(pane.hide);
  const earlier = isReading(layout) ? markList(pane.readingHid) : [];
  const turnedOff = markList([...earlier, ...MARK_IDS.filter((id) => !hidden.includes(id))]);
  pane.hide = [...MARK_IDS];
  if (turnedOff.length) pane.readingHid = turnedOff;
  else delete pane.readingHid;
  return settleActive({ ...layout, root: { pane }, active: pane.id, reading: true });
}

/**
 * The layout a link to /desk with a place opens (E8, `/desk/?place=romans-8`):
 * whatever the page would have opened (the reader's last layout, their
 * default, or the original LIT beside My Notes for a first visit), with only
 * the active LIT pane and the shared place moved to `place` (BVJ, 2026-11-02:
 * a link never forces an arrangement, Reading included, save the Read View
 * links' `layout=reading`, `readingArrival`). Nothing is written here: the
 * page saves it as it saves any move.
 */
export function arrivalLayout(saved, place, reading = null) {
  const opening = openingLayout(saved, reading);
  const at = parsePassage(place) ? place : null;
  if (!at) return opening;
  const next = clone(opening);
  const lit = findPane(next.root, next.active)?.kind === "lit"
    ? findPane(next.root, next.active)
    : panes(next.root).find((p) => p.kind === "lit");
  if (lit) {
    lit.at = at;
    next.active = lit.id;
  }
  next.place = at;
  return next;
}

/**
 * A link that stood for Read View (E114; BVJ, 2026-11-12), with the preview
 * on: `/desk/?place=romans-8&layout=reading`, from the search's jump and the
 * chapter picker's footer. Arriving is choosing the Reading row: what the link
 * would otherwise have opened (`arrivalLayout`) goes to Reading as the row
 * takes it, its pane's marks off and listed in `readingHid`. Already Reading,
 * only the place moves and the list is kept. `want` other than "reading", or
 * a place that names no passage, adds nothing to `arrivalLayout`. Returns
 * `before`, what the page would have opened (for Undo), and `layout`, what it
 * opens (the same object when nothing changed). Nothing is written here.
 */
export function readingArrival(saved, place, reading = null, want = null) {
  const before = arrivalLayout(saved, place, reading);
  const asked = typeof want === "string" && want.trim().toLowerCase() === "reading";
  if (!asked || !parsePassage(place) || isReading(before)) return { before, layout: before };
  return { before, layout: readingLayout(before) };
}

/** Close a pane. Its neighbors take its room. The last pane can't be closed. */
export function closePane(layout, id) {
  if (panes(layout.root).length <= 1) return layout;
  const remove = (node) => {
    if (node.pane) return node.pane.id === id ? null : node;
    const kids = [];
    const sizes = [];
    node.children.forEach((c, i) => {
      const r = remove(c);
      if (r) { kids.push(r); sizes.push(node.sizes[i]); }
    });
    if (!kids.length) return null;
    return { split: node.split, sizes, children: kids };
  };
  return settleActive({ ...layout, root: normalize(remove(clone(layout.root))) });
}

const EDGES = {
  left: { split: "columns", before: true },
  right: { split: "columns", before: false },
  top: { split: "rows", before: true },
  bottom: { split: "rows", before: false },
};

/**
 * Split pane `targetId` at one of its edges ("left", "right", "top",
 * "bottom") with `moving`: the id of an open pane, which leaves its place,
 * or a new pane object. The target and the newcomer share the target's
 * room. Returns the layout unchanged when the drop means nothing (a pane
 * onto itself) or would make more than four panes.
 */
export function splitPane(layout, targetId, edge, moving) {
  const how = EDGES[edge];
  if (!how) return layout;
  const movingId = typeof moving === "string" ? moving : null;
  if (movingId === targetId) return layout;
  let pane;
  let base = layout;
  if (movingId) {
    pane = clone(findPane(layout.root, movingId));
    if (!pane) return layout;
    // It leaves its place first, so its old room goes to its neighbors and
    // the target is split afresh, 50/50 (a pane dropped back where it was
    // keeps its place but not its old size).
    base = closePane(layout, movingId);
    if (base === layout) return layout;
  } else {
    if (panes(layout.root).length >= MAX_PANES) return layout;
    pane = clone(moving);
  }
  const root = clone(base.root);
  const replace = (node) => {
    if (node.pane) {
      if (node.pane.id !== targetId) return node;
      const halves = how.before ? [{ pane }, node] : [node, { pane }];
      return { split: how.split, sizes: [0.5, 0.5], children: halves };
    }
    return { ...node, children: node.children.map(replace) };
  };
  if (!findPane(root, targetId)) return layout;
  return settleActive({ ...base, root: normalize(replace(root)) });
}

/**
 * Swap two open panes' places (E25, BVJ 2026-11-02). Each pane keeps its
 * kind, pin, place and sheet; the two slots keep their sizes, so a pane that
 * lands in a smaller slot is not made smaller than that slot already was,
 * and the swap always fits whatever the window gave the slots. Returns the
 * layout unchanged for a pane onto itself or an id that isn't open.
 */
export function swapPanes(layout, aId, bId) {
  if (aId === bId || !findPane(layout.root, aId) || !findPane(layout.root, bId)) return layout;
  const root = clone(layout.root);
  const leaves = [];
  const collect = (node) => (node.pane ? leaves.push(node) : node.children.forEach(collect));
  collect(root);
  const a = leaves.find((l) => l.pane.id === aId);
  const b = leaves.find((l) => l.pane.id === bId);
  [a.pane, b.pane] = [b.pane, a.pane];
  return { ...layout, root };
}

/** How far into a pane, in the pane's own pixels, a drop zone's edge band reaches. */
export const DROP_BAND = { x: 120, y: 80, share: 0.3, hold: 8 };

/**
 * Where dropping a dragged pane over another would land, from the pointer's
 * place in the target (`x`, `y` from its top left; `width`, `height` its
 * size): "left", "right", "top" or "bottom" in a band along that edge, which
 * splits the target there, and "swap" in the middle (E25, BVJ 2026-11-02).
 * The bands are a fixed depth, not a share of the pane, so a wide pane's
 * middle doesn't shrink to nothing; on a small pane they stop at 30%, so the
 * middle stays. Distances are measured in band depths, so a corner goes to
 * whichever edge the pointer is nearer in those terms.
 *
 * `previous` is the zone this pointer was in over the same pane a moment
 * ago, which holds for `DROP_BAND.hold` pixels past its own edge, so a
 * pointer resting on the line between two zones doesn't flip between them
 * (a corner holds the same way, until the pointer is clearly nearer the
 * other edge).
 */
export function dropZone(width, height, x, y, previous = null) {
  const bx = Math.min(DROP_BAND.x, width * DROP_BAND.share) || 1;
  const by = Math.min(DROP_BAND.y, height * DROP_BAND.share) || 1;
  const band = { left: bx, right: bx, top: by, bottom: by };
  const px = { left: x, right: width - x, top: y, bottom: height - y };
  const d = (e) => px[e] / band[e];
  const edge = Object.keys(px).reduce((a, b) => (d(b) < d(a) ? b : a));
  const zone = d(edge) >= 1 ? "swap" : edge;
  if (previous && previous !== zone) {
    const hold = DROP_BAND.hold;
    if (previous === "swap") {
      if (Object.keys(px).every((e) => px[e] >= band[e] - hold)) return "swap";
    } else if (px[previous] < band[previous] + hold && d(previous) <= d(edge) + hold / band[previous]) {
      return previous;
    }
  }
  return zone;
}

/**
 * The open pane beside `id` in a direction ("left", "right", "up", "down"),
 * from the panes' drawn rectangles (`{ id, left, top, right, bottom }`): the
 * one past that side that shares the most of the pane's length along it, the
 * nearer breaking a tie. For "Move left" and the rest in a pane's menu.
 */
export function neighborIn(rects, id, direction) {
  const me = rects.find((r) => r.id === id);
  if (!me) return null;
  const slack = HANDLE + 2;
  const across = direction === "left" || direction === "right";
  const beside = [];
  for (const r of rects) {
    if (r.id === id) continue;
    const gap = {
      left: me.left - r.right,
      right: r.left - me.right,
      up: me.top - r.bottom,
      down: r.top - me.bottom,
    }[direction];
    if (gap === undefined || gap < -slack) continue;
    const shared = across
      ? Math.min(me.bottom, r.bottom) - Math.max(me.top, r.top)
      : Math.min(me.right, r.right) - Math.max(me.left, r.left);
    if (shared > 0) beside.push({ id: r.id, shared, gap });
  }
  // Only the panes touching it count (a pane past another is not beside it,
  // however much length it shares); of those, the one sharing the most.
  const nearest = Math.min(...beside.map((b) => b.gap));
  let best = null;
  for (const b of beside) {
    if (b.gap > nearest + slack) continue;
    if (!best || b.shared > best.shared || (b.shared === best.shared && b.gap < best.gap)) best = b;
  }
  return best?.id ?? null;
}

/** Show another kind in a pane. A pin is dropped when the new kind doesn't follow. */
export function setKind(layout, id, kind) {
  const next = clone(layout);
  const pane = findPane(next.root, id);
  if (!pane || pane.kind === kind) return layout;
  pane.kind = kind;
  if (!isFollower(kind)) pane.pin = null;
  // A LIT pane's place is its own; a new one starts at the shared place
  // (settleActive gives it).
  delete pane.at;
  // So is the sheet a Sheets pane shows (3f); another kind has none.
  delete pane.sheet;
  // And what a LIT pane's text shows (E108): a new one shows everything.
  delete pane.hide;
  delete pane.readingHid;
  // And a My Notes pane's choice of This chapter (E119).
  delete pane.scope;
  return settleActive(next);
}

/**
 * Pin a following pane where it is ("Stay here"), or let it follow again
 * (`at` null with `pinned` false). `at` is the passage it stays on, a
 * reference string, or null until it has one.
 */
export function setPin(layout, id, pinned, at = null) {
  const next = clone(layout);
  const pane = findPane(next.root, id);
  if (!pane || !isFollower(pane.kind)) return layout;
  pane.pin = pinned ? { at: typeof at === "string" ? at : null } : null;
  return next;
}

/**
 * Make a LIT pane the active one, the one the following panes follow. Its
 * place becomes the shared one, so they move to where its reader is.
 */
export function setActive(layout, id) {
  const pane = findPane(layout.root, id);
  if (layout.active === id || pane?.kind !== "lit") return layout;
  return pane.at ? { ...layout, active: id, place: pane.at } : { ...layout, active: id };
}

/**
 * Where a LIT pane's reader is (3e): a passage string, "john 3:16". The
 * active pane's is also the shared place, so the following panes follow it.
 * Unchanged for anything but a LIT pane, or a place it already has.
 */
export function setLitAt(layout, id, at) {
  const pane = findPane(layout.root, id);
  if (typeof at !== "string" || !at || pane?.kind !== "lit") return layout;
  const place = layout.active === id ? at : layout.place;
  if (pane.at === at && layout.place === place) return layout;
  const next = clone(layout);
  // A LIT pane with no place of its own stays at the one it shows (BA52).
  if (layout.place) placeLitPanes(next.root, layout.place);
  findPane(next.root, id).at = at;
  if (place) next.place = place;
  return next;
}

/**
 * The sheet a Sheets pane shows (3f): a sheet record's id, or null for the
 * pane's list of sheets. Unchanged for anything but a Sheets pane, or the
 * sheet it already shows.
 */
export function setPaneSheet(layout, id, sheetId) {
  const pane = findPane(layout.root, id);
  const want = typeof sheetId === "string" && sheetId ? sheetId : null;
  if (pane?.kind !== "sheet" || (pane.sheet ?? null) === want) return layout;
  const next = clone(layout);
  const p = findPane(next.root, id);
  if (want) p.sheet = want;
  else delete p.sheet;
  return next;
}

/** What a My Notes pane lists (E119): "chapter" (the leading LIT pane's) or "everything", the default. */
export function paneScope(layout, id) {
  const pane = findPane(layout?.root, id);
  return pane?.kind === "mine" && pane.scope === "chapter" ? "chapter" : "everything";
}

/** Set a My Notes pane's scope. Unchanged for another kind of pane or a scope it already has. */
export function setPaneScope(layout, id, scope) {
  const pane = findPane(layout?.root, id);
  if (pane?.kind !== "mine" || paneScope(layout, id) === (scope === "chapter" ? "chapter" : "everything")) return layout;
  const next = clone(layout);
  const p = findPane(next.root, id);
  if (scope === "chapter") p.scope = "chapter";
  else delete p.scope;
  return next;
}

/** The marks a LIT pane hides (desk-lit-marks.mjs), in the table's order; none for any other pane. */
export function paneHides(layout, id) {
  const pane = findPane(layout?.root, id);
  return pane?.kind === "lit" ? markList(pane.hide) : [];
}

/**
 * Show or hide one mark in one LIT pane ("Show" on its bar, E108). Unchanged
 * for another kind of pane, a mark the table lacks, or a mark already so.
 */
export function setPaneMark(layout, id, mark, on) {
  const pane = findPane(layout?.root, id);
  if (pane?.kind !== "lit" || !MARK_IDS.includes(mark)) return layout;
  const hidden = markList(pane.hide);
  if (hidden.includes(mark) === !on) return layout;
  const next = clone(layout);
  setHide(findPane(next.root, id), on ? hidden.filter((m) => m !== mark) : [...hidden, mark]);
  return next;
}

/**
 * What a change of layout did to the marks of the LIT pane being read, as
 * mark ids: the ones it turned on and the ones it turned off. The pane is
 * `before`'s leading LIT pane, found again by its id in `next`; where it is
 * gone or no longer the LIT, `next`'s leading one stands in (Reset's new
 * pane), and a pane `before` never had counts as having shown everything.
 * For the sentence that says what entering or leaving Reading did.
 */
export function marksTurned(before, next) {
  const lead = (layout) => {
    const active = findPane(layout?.root, layout?.active);
    return active?.kind === "lit" ? active : panes(layout?.root).find((p) => p.kind === "lit") ?? null;
  };
  const from = lead(before);
  const same = from ? findPane(next?.root, from.id) : null;
  const to = same?.kind === "lit" ? same : lead(next);
  if (!to) return { on: [], off: [] };
  const was = from ? markList(from.hide) : [];
  const now = markList(to.hide);
  return { on: was.filter((m) => !now.includes(m)), off: now.filter((m) => !was.includes(m)) };
}

/**
 * Show a sheet in the layout (M5, "Open it in the Study Desk"): in the first
 * Sheets pane there is, else a new Sheets pane or one that takes the place of
 * another pane, by the one rule `makeWayFor` holds (E127). `width` is the
 * panes' width in pixels (BA60): the new pane is split off only when the
 * layout still fits it, so a narrow window never scrolls sideways for it. A
 * split to the right never raises the height a layout needs, so only the
 * width is asked. `keep` names a pane that mustn't give its place (3m: the
 * Search pane a new sheet came from, whose results would be lost).
 * Returns `{ layout, outcome, paneId, replaced, reason }`: `outcome` "shown"
 * (a Sheets pane was there), "opened", "replaced" (`replaced` is `{ id,
 * kind }` of the pane it took the place of), or "none" (`reason`, as
 * `makeWayFor` gives it, and the layout the same object). Unchanged ("none",
 * `reason` null) for an empty id.
 */
export function showSheet(layout, sheetId, width, keep = null) {
  const none = (reason) => ({ layout, outcome: "none", paneId: null, replaced: null, reason });
  if (typeof sheetId !== "string" || !sheetId) return none(null);
  const all = panes(layout.root);
  if (!all.length) return none(null);
  const existing = all.find((p) => p.kind === "sheet");
  if (existing) return { layout: setPaneSheet(layout, existing.id, sheetId), outcome: "shown", paneId: existing.id, replaced: null, reason: null };
  const way = makeWayFor(layout, "sheet", { keep, width });
  if (way.outcome === "none") return way;
  return { ...way, layout: setPaneSheet(way.layout, way.paneId, sheetId) };
}

/**
 * The one rule for a pane the desk opens by itself (E127; BVJ, 2026-11-12):
 * a Sheets pane for a sheet, a Book Intro pane for an introduction, a LIT
 * pane for a passage result, a Greek pane for a Greek result, a Search pane
 * for `/`. The caller first uses a pane of that kind already open (each kind
 * has its own choice of which). Then this: a new pane of `kind` split beside
 * `beside` (else the active pane, else the first) on its `edge` (default
 * "right") where there is room (four panes at most, and `width` and `height`,
 * the panes' room in pixels, hold it; a side left out is not asked about),
 * else it takes the place of the last pane that isn't a LIT pane, in the
 * order `panes` gives, never `keep` (the pane the request came from, or a
 * list of panes: a Greek result keeps its Greek pane while its LIT pane makes
 * way) and never a pane set to "Stay here". A LIT pane never gives its place.
 * `replace: false` stops after the room step.
 *
 * Returns `{ layout, outcome, paneId, replaced, reason }`: `outcome` is
 * "opened", "replaced" (`replaced` is `{ id, kind }` of the pane that gave
 * its place; the new pane has the same id) or "none", the layout then the same
 * object and `reason` "full" (four panes are open) or "window" (fewer are,
 * and the window can't hold another). `paneId` is the new pane's.
 *
 * @param {object} layout
 * @param {string} kind
 * @param {{ keep?: string | (string | null)[] | null, beside?: string | null, edge?: string, width?: number, height?: number, replace?: boolean }} [options]
 */
export function makeWayFor(layout, kind, { keep = null, beside = null, edge = "right", width, height, replace = true } = {}) {
  const all = panes(layout.root);
  const none = (reason) => ({ layout, outcome: "none", paneId: null, replaced: null, reason });
  if (!all.length || typeof kind !== "string" || !kind) return none("full");
  if (all.length < MAX_PANES) {
    const target = (beside && findPane(layout.root, beside)) || findPane(layout.root, layout.active) || all[0];
    const made = newPane(layout, kind);
    const split = splitPane(layout, target.id, edge, made);
    if (split !== layout && fits(split, width, height)) return { layout: split, outcome: "opened", paneId: made.id, replaced: null, reason: null };
  }
  const kept = [keep].flat();
  const give = replace ? [...all].reverse().find((p) => !kept.includes(p.id) && p.kind !== "lit" && !p.pin) : null;
  if (!give) return none(all.length >= MAX_PANES ? "full" : "window");
  return { layout: setKind(layout, give.id, kind), outcome: "replaced", paneId: give.id, replaced: { id: give.id, kind: give.kind }, reason: null };
}

/**
 * Open a new pane of a kind beside a pane (`besideId`), else the active pane,
 * else the first, as a split to its right (3m: `/` on the desk opens a Search
 * pane this way, and a Greek result a Greek pane beside the search). Returns
 * the layout unchanged, the same object, when there is no room: four panes are
 * open, or the window can't give the new pane its 280 by 160. `width` and
 * `height` are the panes' room in pixels; either left out is not asked
 * about. Room only: the desk's openings go through `makeWayFor`, which
 * goes on to take another pane's place (E127).
 */
export function openKind(layout, kind, width, height, besideId = null) {
  return makeWayFor(layout, kind, { beside: besideId, width, height, replace: false }).layout;
}

/**
 * Add a pane of `kind` beside pane `id`, on its "left" or "right", "above" or
 * "below" (the Add pane flyout of its menu). The newcomer joins the nearest
 * row or column running that way, or what is there becomes one half of a new
 * stack; either way the room is shared evenly. Unchanged, the same object,
 * when the pane isn't open, four panes are open or the window can't give
 * every pane its 280 by 160.
 */
export function addBeside(layout, id, side, kind, width, height) {
  const WAYS = { right: ["columns", false], left: ["columns", true], below: ["rows", false], above: ["rows", true] };
  const way = WAYS[side];
  if (!way || typeof kind !== "string" || !kind || !findPane(layout.root, id)) return layout;
  if (panes(layout.root).length >= MAX_PANES) return layout;
  const [want, before] = way;
  const root = clone(layout.root);
  const pane = { pane: newPane(layout, kind) };
  const at = pathTo(root, id);
  if (!at) return layout;
  // The nearest split round the pane that runs the way asked for, and which of
  // its children holds the pane.
  let depth = at.length - 1;
  while (depth >= 0 && nodeAt(root, at.slice(0, depth)).split !== want) depth--;
  const parent = depth >= 0 ? nodeAt(root, at.slice(0, depth)) : null;
  let next;
  if (parent) {
    // The newcomer goes in beside the pane (or the group holding it), and the
    // room is shared evenly among all the rows (or columns) there are then.
    const n = parent.children.length;
    const i = at[depth];
    const sizes = even(n + 1);
    parent.children.splice(before ? i : i + 1, 0, pane);
    parent.sizes = sizes;
    next = root;
  } else {
    // Nothing runs that way yet: what is there becomes one row (or column) of
    // a stack, and the newcomer the other.
    next = { split: want, sizes: [0.5, 0.5], children: before ? [pane, root] : [root, pane] };
  }
  const result = settleActive({ ...layout, root: normalize(next) });
  return fits(result, width, height) ? result : layout;
}

/** Why `addBeside` can't add one, as `addPaneNeeds` says it; null when it can. */
export function addBesideNeeds(layout, id, side, width, height) {
  if (panes(layout.root).length >= MAX_PANES) return "full";
  const probe = addBeside(layout, id, side, "lit", Infinity, Infinity);
  if (probe === layout) return "full";
  const ok = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!ok(width) && !ok(height)) return null;
  return needs(probe.root, ok(width) ? width : Infinity, ok(height) ? height : Infinity);
}

/**
 * Add a pane along an edge of the whole page, from the title menu's "Add pane"
 * (E14; BVJ, 2026-11-02): a "column" is a full-height pane at the right edge,
 * a "row" a full-width pane along the bottom. Pane widths and heights already
 * there are kept in proportion and the newcomer takes an even share. The new
 * pane shows `kind`, chosen in the menu. Unchanged, the same object, when
 * `addPaneNeeds` says there is no room.
 */
export function addPane(layout, direction, kind, width, height) {
  if (addPaneNeeds(layout, direction, width, height) || typeof kind !== "string" || !kind) return layout;
  const split = direction === "row" ? "rows" : "columns";
  const root = clone(layout.root);
  const pane = { pane: newPane(layout, kind) };
  let grown;
  if (!root.pane && root.split === split) {
    const n = root.children.length;
    grown = {
      split,
      sizes: [...(root.sizes?.length === n ? root.sizes : even(n)).map((s) => (s * n) / (n + 1)), 1 / (n + 1)],
      children: [...root.children, pane],
    };
  } else {
    grown = { split, sizes: [0.5, 0.5], children: [root, pane] };
  }
  return settleActive({ ...clone(layout), root: normalize(grown) });
}

/**
 * Why `addPane` can't add one along an edge: "full" (four panes are open, the
 * most the page holds), or "wider", "taller" or "larger" when the window can't
 * give every pane its 280 by 160, as `needs` says it. null when it can. A side
 * of the window left out is not asked about.
 */
export function addPaneNeeds(layout, direction, width, height) {
  const all = panes(layout.root);
  if (!all.length || all.length >= MAX_PANES) return "full";
  const split = direction === "row" ? "rows" : "columns";
  const probe = { pane: {} };
  const root = !layout.root.pane && layout.root.split === split
    ? { ...layout.root, children: [...layout.root.children, probe] }
    : { split, children: [layout.root, probe] };
  const ok = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!ok(width) && !ok(height)) return null;
  return needs(root, ok(width) ? width : Infinity, ok(height) ? height : Infinity);
}

/**
 * Which Sheets pane the command row's "New sheet…" opens its template chooser
 * in (Audit 5, SH5-5; Audit 6, LG6-3): the first one open, else a new one
 * added as a column, else as a row. `{ layout, paneId }`: the same layout
 * object when a Sheets pane is already open, and `paneId` null, the layout
 * unchanged, when neither side has room.
 */
export function sheetPaneFor(layout, width, height) {
  const there = panes(layout.root).find((p) => p.kind === "sheet");
  if (there) return { layout, paneId: there.id };
  const direction = addPaneNeeds(layout, "column", width, height) ? "row" : "column";
  const next = addPane(layout, direction, "sheet", width, height);
  if (next === layout) return { layout, paneId: null };
  const had = new Set(panes(layout.root).map((p) => p.id));
  return { layout: next, paneId: panes(next.root).find((p) => !had.has(p.id))?.id ?? null };
}

/** What a menu says under a line that needs more room: "Needs a wider window" and its kin. */
export const NEEDS_TEXT = {
  wider: "Needs a wider window",
  taller: "Needs a taller window",
  larger: "Needs a larger window",
};

/**
 * The words for one `addPaneNeeds` or `addBesideNeeds` reason: FULL_TEXT for
 * "full", the NEEDS_TEXT for "wider", "taller" or "larger", null for no reason
 * (the line is usable).
 */
export function whyText(reason) {
  return reason === "full" ? FULL_TEXT : reason ? (NEEDS_TEXT[reason] ?? null) : null;
}

/**
 * The words for a menu line that opens a choice of sides (Add pane: column or
 * row, or left, right, above, below), given the reason each side is refused
 * (null where it is not). The line is only grayed when every side is: FULL_TEXT
 * if any says "full", else "Needs a larger window"; null when one side is open.
 */
export function addWhy(reasons) {
  if (!reasons.every(Boolean)) return null;
  return reasons.includes("full") ? FULL_TEXT : NEEDS_TEXT.larger;
}

/** A pane menu's "Make this pane wider" and its kin: which way a step goes along which kind of split. */
export const SIZINGS = [
  { label: "Make this pane wider", split: "columns", grow: true, word: "wide" },
  { label: "Make this pane narrower", split: "columns", grow: false, word: "wide" },
  { label: "Make this pane taller", split: "rows", grow: true, word: "tall" },
  { label: "Make this pane shorter", split: "rows", grow: false, word: "tall" },
];

/**
 * The nearest split round a pane that runs the way a sizing needs (one of
 * SIZINGS): its path, the pane's place in it, and how many children it has.
 * null when the pane has no such split round it (the only pane, or in rows
 * when asked to widen).
 */
export function sizingFor(root, id, z) {
  const at = pathTo(root, id);
  if (!at) return null;
  for (let d = at.length - 1; d >= 0; d--) {
    const path = at.slice(0, d);
    const node = nodeAt(root, path);
    if (node?.split === z.split) return { path, index: at[d], count: node.children.length };
  }
  return null;
}

/**
 * Open a LIT pane to the left of a pane (3m: a search result's verse needs a
 * LIT pane to land in, and there is none). It becomes the active pane and
 * starts at the shared place. Unchanged, the same object, when the pane isn't
 * there, four panes are open or there is no room (see `openKind`; room only,
 * as `makeWayFor` with `replace: false`).
 */
export function openLitBeside(layout, besideId, width, height) {
  if (!findPane(layout.root, besideId)) return layout;
  const way = makeWayFor(layout, "lit", { beside: besideId, edge: "left", width, height, replace: false });
  return way.outcome === "none" ? layout : setActive(way.layout, way.paneId);
}

/**
 * A book's introduction shown in a Book Intro pane (E53; BVJ, 2026-11-06): from
 * a Search pane's intro result (`besideId`, which keeps its place) and
 * `/desk/?intro=romans`. The pane used is the first that follows, else the
 * first open, else a new one by the one rule for a pane the desk opens
 * (`makeWayFor`, E127). One that follows shows the book the LIT pane is in, so
 * the leading LIT pane (or, with none, the shared place) moves to chapter 1
 * unless it is in that book already; one that stays put is moved alone.
 * Returns `{ layout, outcome, moved, replaced, reason }`: `outcome` is
 * "shown" (a pane was there), "opened", "replaced" (`replaced` is `{ id,
 * kind }` of the pane that gave its place) or "none" (the layout unchanged,
 * `reason` "full" or "window" as `makeWayFor` says it), and `moved` the place
 * the LIT moved to, or null.
 */
export function showIntroIn(layout, bookKey, width, height, besideId = null) {
  const at = parsePassage(`${bookKey} 1`) ? `${bookKey} 1` : null;
  const none = (reason) => ({ layout, outcome: "none", moved: null, replaced: null, reason });
  if (!at || !panes(layout.root).length) return none(null);
  const intros = panes(layout.root).filter((p) => p.kind === "intro");
  let next = layout;
  let pane = intros.find((p) => !p.pin) ?? intros[0] ?? null;
  let outcome = "shown";
  let replaced = null;
  if (!pane) {
    const way = makeWayFor(layout, "intro", { keep: besideId, beside: besideId, width, height });
    if (way.outcome === "none") return none(way.reason);
    next = way.layout;
    pane = findPane(next.root, way.paneId);
    outcome = way.outcome;
    replaced = way.replaced;
  }
  const done = (layoutOut, moved) => ({ layout: layoutOut, outcome, moved, replaced, reason: null });
  if (pane.pin) return done(setPin(next, pane.id, true, at), null);
  const leading = findPane(next.root, next.active)?.kind === "lit";
  const now = parsePassage(leading ? litPlace(next, next.active) : next.place);
  if (now?.bookKey === bookKey) return done(next, null);
  next = leading ? setLitAt(next, next.active, at) : setPlace(next, at);
  return done(next, at);
}

/** Whether a layout fits a space; a side left out is not asked about. */
function fits(layout, width, height) {
  const ok = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!ok(width) && !ok(height)) return true;
  return needs(layout.root, ok(width) ? width : Infinity, ok(height) ? height : Infinity) === null;
}

/**
 * The passage a LIT pane shows: its own place, else the shared one. Every
 * LIT pane is given a place of its own once there is a shared one
 * (placeLitPanes), so the second is only for a layout made by hand.
 */
export function litPlace(layout, id) {
  const pane = findPane(layout.root, id);
  if (pane?.kind !== "lit") return null;
  return pane.at ?? layout.place ?? null;
}

/**
 * Set the place the following panes share (3d): a passage string, "john
 * 3:16". Unchanged when it is already there or isn't a string.
 */
export function setPlace(layout, at) {
  if (typeof at !== "string" || !at || layout.place === at) return layout;
  const next = { ...layout, place: at };
  // A LIT pane with no place of its own yet starts here, and keeps it (BA52).
  if (panes(layout.root).some((p) => p.kind === "lit" && !p.at)) {
    next.root = clone(layout.root);
    placeLitPanes(next.root, at);
  }
  return next;
}

/**
 * The passage a following pane shows: its pin's own when it stays put, else
 * the place the following panes share; null for a pane that doesn't follow,
 * or when neither is set yet (the page then starts it somewhere).
 */
export function placeFor(layout, id) {
  const pane = findPane(layout.root, id);
  if (!pane || !isFollower(pane.kind)) return null;
  return pane.pin?.at ?? layout.place ?? null;
}

/** The pane a following pane follows: the active LIT pane, or null when none is open or it is pinned. */
export function leaderFor(layout, id) {
  const pane = findPane(layout.root, id);
  if (!pane || !isFollower(pane.kind) || pane.pin) return null;
  return layout.active;
}

// ---- sizes ----------------------------------------------------------------

/** The smallest width and height a node can take, handles included. */
export function minSize(node) {
  if (node.pane) return { w: MIN_WIDTH, h: MIN_HEIGHT };
  const kids = node.children.map(minSize);
  const gaps = HANDLE * (kids.length - 1);
  if (node.split === "columns") {
    return { w: kids.reduce((a, k) => a + k.w, 0) + gaps, h: Math.max(...kids.map((k) => k.h)) };
  }
  return { w: Math.max(...kids.map((k) => k.w)), h: kids.reduce((a, k) => a + k.h, 0) + gaps };
}

/**
 * Whether a tree (or an arrangement's id) fits a space: null when it does,
 * else "wider", "taller" or "larger", which the menu says as "Needs a wider
 * window" and so on.
 */
export function needs(nodeOrId, width, height) {
  const node = typeof nodeOrId === "string" ? ARRANGEMENT_BY_ID.get(nodeOrId)?.shape : nodeOrId;
  if (!node) return null;
  const m = minSize(withPanes(node));
  const w = m.w > width;
  const h = m.h > height;
  return w && h ? "larger" : w ? "wider" : h ? "taller" : null;
}

const withPanes = (shape) =>
  shape.slot ? { pane: {} } : shape.pane ? shape : { split: shape.split, children: shape.children.map(withPanes) };

/**
 * Move the line after child `index` of the split at `path` by `deltaPx`,
 * given the split's length in pixels along its direction. Only the two
 * children beside the line change, and neither is made smaller than it can
 * be (`minSize`), so the line stops rather than crushing a pane.
 */
export function resize(layout, path, index, deltaPx, lengthPx) {
  const next = clone(layout);
  const node = nodeAt(next.root, path);
  if (!node || node.pane || index < 0 || index >= node.children.length - 1 || !(lengthPx > 0)) return layout;
  const usable = lengthPx - HANDLE * (node.children.length - 1);
  if (usable <= 0) return layout;
  const along = node.split === "columns" ? "w" : "h";
  const minA = minSize(node.children[index])[along] / usable;
  const minB = minSize(node.children[index + 1])[along] / usable;
  const pair = node.sizes[index] + node.sizes[index + 1];
  let a = node.sizes[index] + deltaPx / usable;
  // Where the two can't both have their minimum, split the pair evenly by
  // their minimums rather than favoring one.
  if (minA + minB > pair) a = pair * (minA / (minA + minB));
  else a = Math.min(Math.max(a, minA), pair - minB);
  node.sizes[index] = a;
  node.sizes[index + 1] = pair - a;
  return next;
}

/**
 * Sizes that give every pane its minimum in a space `width` by `height`,
 * kept as close to the reader's as that allows: a child short of its minimum
 * is raised to it, and the room comes from its siblings in proportion to what
 * each has to spare. Where the space can't hold every minimum, the children
 * share it in proportion to their minimums (the page then scrolls). A new
 * tree; the layout's own sizes are left alone.
 */
export function fitSizes(node, width, height) {
  if (node.pane) return node;
  const n = node.children.length;
  const columns = node.split === "columns";
  const usable = Math.max(1, (columns ? width : height) - HANDLE * (n - 1));
  const mins = node.children.map((c) => minSize(c)[columns ? "w" : "h"] / usable);
  const minTotal = mins.reduce((a, b) => a + b, 0);
  let sizes;
  if (minTotal >= 1) {
    sizes = mins.map((m) => m / minTotal);
  } else {
    sizes = node.sizes.slice();
    const deficit = sizes.reduce((d, s, i) => d + Math.max(0, mins[i] - s), 0);
    if (deficit > 0) {
      const slack = sizes.map((s, i) => Math.max(0, s - mins[i]));
      const slackTotal = slack.reduce((a, b) => a + b, 0);
      sizes = sizes.map((s, i) => (s < mins[i] ? mins[i] : s - (deficit * slack[i]) / slackTotal));
    }
  }
  const children = node.children.map((c, i) =>
    columns ? fitSizes(c, usable * sizes[i], height) : fitSizes(c, width, usable * sizes[i]),
  );
  return { split: node.split, sizes, children };
}

/** Share a split's room evenly again (double-clicking a line). */
export function evenOut(layout, path) {
  const next = clone(layout);
  const node = nodeAt(next.root, path);
  if (!node || node.pane) return layout;
  node.sizes = even(node.children.length);
  return next;
}

// ---- keeping it -----------------------------------------------------------

/** The localStorage key, named in /privacy's paragraph. */
export const LAYOUT_KEY = "lit-desk-layout";

/**
 * The ids nextId makes. A stored id goes into markup and selectors, so one of
 * any other form is refused, never escaped (BA59).
 */
const PANE_ID = /^p\d{1,3}$/;

/**
 * A layout read back from storage, checked: a tree of one to four panes
 * with ids of nextId's form (each once), string kinds, and well-formed splits. Kinds
 * this code doesn't know are kept, for a pane from a later version. Anything
 * else is null, and the caller falls back. The Reading mark is kept only as
 * `true` on one LIT pane (E107); one LIT pane saved before layouts carried it
 * reads as One pane. A LIT pane keeps the marks it hides (E108).
 */
export function checkLayout(value) {
  if (!value || typeof value !== "object") return null;
  const ids = new Set();
  const check = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6) return null;
    if (node.pane) {
      const { id, pin } = node.pane;
      const kind = Object.hasOwn(RETIRED_KINDS, node.pane.kind) ? RETIRED_KINDS[node.pane.kind] : node.pane.kind;
      if (typeof id !== "string" || !PANE_ID.test(id) || ids.has(id) || typeof kind !== "string" || !kind) return null;
      ids.add(id);
      const keepPin = pin && typeof pin === "object" && isFollower(kind)
        ? { at: typeof pin.at === "string" ? pin.at : null }
        : null;
      const kept = { id, kind, pin: keepPin };
      // A LIT pane's place that isn't a passage is dropped, so the shared
      // place (or Continue reading) stands in for it.
      if (kind === "lit" && parsePassage(node.pane.at)) kept.at = node.pane.at;
      // What a LIT pane's text hides (E108), and what Reading turned off in
      // it: only marks the table has. settleActive ends a Reading that isn't.
      if (kind === "lit") {
        setHide(kept, node.pane.hide);
        const readingHid = markList(node.pane.readingHid);
        if (readingHid.length) kept.readingHid = readingHid;
      }
      // A My Notes pane keeps "This chapter" when the reader chose it (E119);
      // no field is Everything, the default.
      if (kind === "mine" && node.pane.scope === "chapter") kept.scope = "chapter";
      if (kind === "sheet" && typeof node.pane.sheet === "string" && node.pane.sheet) kept.sheet = node.pane.sheet;
      return { pane: kept };
    }
    if ((node.split !== "columns" && node.split !== "rows") || !Array.isArray(node.children) || node.children.length < 2) return null;
    const children = node.children.map((c) => check(c, depth + 1));
    if (children.some((c) => !c)) return null;
    // Each size is a finite number above zero, and so is their sum: two sizes
    // of 1e308 are each fine and add to Infinity, which normalize turns into
    // nothing at all (BA58).
    const sizes = Array.isArray(node.sizes) && node.sizes.length === children.length
      && node.sizes.every((s) => typeof s === "number" && s > 0 && Number.isFinite(s))
      && Number.isFinite(node.sizes.reduce((a, b) => a + b, 0))
      ? node.sizes
      : even(children.length);
    return { split: node.split, sizes, children };
  };
  const root = check(value.root, 0);
  if (!root || ids.size > MAX_PANES) return null;
  const layout = { root: normalize(root), active: typeof value.active === "string" ? value.active : null };
  if (value.reading === true) layout.reading = true; // settleActive drops it off anything but one LIT pane
  // Set before settleActive, which gives it to any LIT pane without a place
  // (BA52); one that isn't a passage is dropped, so it isn't passed on.
  if (parsePassage(value.place)) layout.place = value.place;
  // A Reading layout saved before a pane kept its own marks (E108) had them
  // off through Chapter View's switches, and its pane lists nothing. It opens
  // with the pane's four off, all to come back when Reading ends, which is
  // what it was. (One made since always lists something: what it hides, or
  // what Reading turned off.)
  const only = layout.root.pane;
  if (isReading(layout) && !only.hide && !only.readingHid) {
    only.hide = [...MARK_IDS];
    only.readingHid = [...MARK_IDS];
  }
  return settleActive(layout);
}

/**
 * What the key holds: the last layout, the reader's own default (null until
 * set), and which one the page opens with ("last" or "default").
 */
export function readSaved(text) {
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  const last = checkLayout(data?.last);
  const mine = checkLayout(data?.mine);
  const start = data?.start === "default" && mine ? "default" : "last";
  return { last, mine, start };
}

/** The saved state as text for the key. */
export function writeSaved({ last, mine, start }) {
  return JSON.stringify({ v: 1, start: start === "default" ? "default" : "last", last: last ?? null, mine: mine ?? null });
}

/**
 * A layout's arrangement at a place (BA53): its panes, kinds, sizes, pins and
 * sheets kept, and every place in it (the shared one, each LIT pane's and
 * each "Stay here" pane's) set to `place`, a passage string. Without one,
 * the places are cleared, for the page to start them.
 */
export function atPlace(layout, place) {
  const next = clone(layout);
  const ok = parsePassage(place) ? place : null;
  for (const p of panes(next.root)) {
    if (p.kind === "lit") {
      if (ok) p.at = ok;
      else delete p.at;
    }
    if (p.pin) p.pin.at = ok;
  }
  if (ok) next.place = ok;
  else delete next.place;
  return next;
}

/**
 * The layout the page opens with. "My last layout" is the desk as it was
 * left, places and all. "My default" is an arrangement, not a passage (BVJ,
 * 2026-10-26; BA53): its panes open at the place the reader was last on the
 * desk, or else at `reading` (the page's Continue reading place), never at
 * the one it was made at.
 */
export function openingLayout(saved, reading = null) {
  const from = parsePassage(saved.last?.place) ? saved.last.place : reading;
  if (saved.start === "default" && saved.mine) return atPlace(saved.mine, from);
  if (saved.last) return saved.last;
  return saved.mine ? atPlace(saved.mine, from) : originalLayout(from);
}
