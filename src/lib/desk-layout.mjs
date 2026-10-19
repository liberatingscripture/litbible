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
//   rows, and dragging a pane to an edge of another splits it as well;
// - a pane needs at least 280px across and 160px high, so an arrangement
//   that can't fit the window is grayed out with the reason;
// - several panes of a kind may be open. The LIT pane leads; This verse,
//   Greek, and Footnotes follow the LIT pane last worked in (the active one),
//   unless pinned with "Stay here", which the saved layout remembers;
// - (3d) until the LIT pane comes (3e), the following panes share one place,
//   `layout.place`, chosen with a passage picker; a pinned pane keeps its own
//   (`pin.at`). Both are passage strings, "john 3:16" (desk-passage.mjs);
// - the original layout is the LIT text beside My Notes, 60/40, and the
//   layout is kept in this browser.

export const MAX_PANES = 4;
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 160;
/** The width of the line between two panes, which the reader drags. */
export const HANDLE = 6;

/**
 * Every kind of pane, in the order a new slot is filled with one not yet
 * open. `follows`: it follows the active LIT pane unless pinned. The page's
 * registry (desk-panes.js) says what each one draws.
 */
export const KINDS = [
  { kind: "lit", label: "The LIT", follows: false },
  { kind: "mine", label: "My Notes", follows: false },
  { kind: "verse", label: "This verse", follows: true },
  { kind: "greek", label: "Greek", follows: true },
  { kind: "footnotes", label: "Footnotes", follows: true },
  { kind: "sheet", label: "Sheet", follows: false },
  { kind: "kept", label: "What I’ve kept", follows: false },
];

const KIND_INFO = new Map(KINDS.map((k) => [k.kind, k]));

/** True for a kind that follows the active LIT pane. */
export const isFollower = (kind) => Boolean(KIND_INFO.get(kind)?.follows);

/** A kind's name for a reader, or the kind itself for one this code doesn't know. */
export const kindLabel = (kind) => KIND_INFO.get(kind)?.label ?? kind;

// ---- arrangements ---------------------------------------------------------

const P = { slot: true };
const cols = (...children) => ({ split: "columns", children });
const rows = (...children) => ({ split: "rows", children });

/**
 * The Layout menu, in its order. `shape` uses slots, filled in reading order
 * (left to right, then top to bottom) by `applyArrangement`.
 */
export const ARRANGEMENTS = [
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
  return ARRANGEMENTS.find((a) => sig(a.shape) === s)?.id ?? null;
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

/** The layout every reader starts with: the LIT beside My Notes, 60/40. */
export function originalLayout() {
  return {
    root: {
      split: "columns",
      sizes: [0.6, 0.4],
      children: [
        { pane: { id: "p1", kind: "lit", pin: null } },
        { pane: { id: "p2", kind: "mine", pin: null } },
      ],
    },
    active: "p1",
  };
}

/** The active LIT pane, settled: kept if it is still a LIT pane, else the first one. */
function settleActive(layout) {
  const lits = panes(layout.root).filter((p) => p.kind === "lit");
  if (!lits.some((p) => p.id === layout.active)) layout.active = lits[0]?.id ?? null;
  return layout;
}

/**
 * Change to an arrangement from the menu. The open panes keep their reading
 * order and their pins; a pane the arrangement has no room for is closed
 * from the end; an empty slot gets the first kind not yet open (My Notes
 * again once every kind is). Sizes start even.
 */
export function applyArrangement(layout, id) {
  const arrangement = ARRANGEMENT_BY_ID.get(id);
  if (!arrangement) return layout;
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
  return settleActive({ ...layout, root: normalize(build(arrangement.shape)) });
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

/** Show another kind in a pane. A pin is dropped when the new kind doesn't follow. */
export function setKind(layout, id, kind) {
  const next = clone(layout);
  const pane = findPane(next.root, id);
  if (!pane || pane.kind === kind) return layout;
  pane.kind = kind;
  if (!isFollower(kind)) pane.pin = null;
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

/** Make a LIT pane the active one, the one the following panes follow. */
export function setActive(layout, id) {
  if (layout.active === id || findPane(layout.root, id)?.kind !== "lit") return layout;
  return { ...layout, active: id };
}

/**
 * Set the place the following panes share (3d): a passage string, "john
 * 3:16". Unchanged when it is already there or isn't a string.
 */
export function setPlace(layout, at) {
  if (typeof at !== "string" || !at || layout.place === at) return layout;
  return { ...layout, place: at };
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
 * A layout read back from storage, checked: a tree of one to four panes
 * with string ids (each once), string kinds, and well-formed splits. Kinds
 * this code doesn't know are kept, for a pane from a later version. Anything
 * else is null, and the caller falls back.
 */
export function checkLayout(value) {
  if (!value || typeof value !== "object") return null;
  const ids = new Set();
  const check = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6) return null;
    if (node.pane) {
      const { id, kind, pin } = node.pane;
      if (typeof id !== "string" || !id || ids.has(id) || typeof kind !== "string" || !kind) return null;
      ids.add(id);
      const keepPin = pin && typeof pin === "object" && isFollower(kind)
        ? { at: typeof pin.at === "string" ? pin.at : null }
        : null;
      return { pane: { id, kind, pin: keepPin } };
    }
    if ((node.split !== "columns" && node.split !== "rows") || !Array.isArray(node.children) || node.children.length < 2) return null;
    const children = node.children.map((c) => check(c, depth + 1));
    if (children.some((c) => !c)) return null;
    const sizes = Array.isArray(node.sizes) && node.sizes.length === children.length
      && node.sizes.every((s) => typeof s === "number" && s > 0 && Number.isFinite(s))
      ? node.sizes
      : even(children.length);
    return { split: node.split, sizes, children };
  };
  const root = check(value.root, 0);
  if (!root || ids.size > MAX_PANES) return null;
  const layout = settleActive({ root: normalize(root), active: typeof value.active === "string" ? value.active : null });
  if (typeof value.place === "string" && value.place) layout.place = value.place;
  return layout;
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

/** The layout the page opens with. */
export function openingLayout(saved) {
  if (saved.start === "default" && saved.mine) return saved.mine;
  return saved.last ?? saved.mine ?? originalLayout();
}
