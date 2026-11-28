// src/lib/desk-study.mjs
//
// Study's model of places, panes, and tabs (Featherboa, Phase 9; SITE-FEATHERBOA.md,
// "The Study Desk" and "Study and its places"). It replaces desk-layout.mjs's
// tree of split panes. Pure: no DOM, no storage, no imports from the page's
// scripts; every function takes plain data and returns new plain data, and a
// function that can't do what it is asked returns the state it was given. The
// page reads and writes the key (`STATE_KEY`) with `readState` and `writeState`.
//
// WHAT THE STATE HOLDS
//
//   { v: 2,
//     open: { kind, id? },          the place on screen
//     scripture, notebook, trash,   one state each, always there
//     sheets: [place, ...],         one per sheet the reader has opened, the
//     collections: [place, ...] }   most recent first, at most MAX_KEPT each
//
// A place (`kind`: "scripture", "notebook", "sheet", "collection", "trash"):
//
//   { id?,             a sheet's or collection's record id
//     count,           what the title row's "Panes" control says
//     panes: [{ tabs: [tab], open: tabId|null }],
//     working,         index of the working pane (the green underline), or null in the Trash
//     widths: { "2": [fractions], "3": [...] },   each count's own widths
//     side?,           beside a sheet: the pane's width in pixels (SIDE_WIDTH when absent)
//     lit,             id of the LIT tab the reader last moved in, or null
//     at,              the passage the following tabs share ("john 3:16"), or null
//     seq }            the next tab number
//
// Scripture's `panes` are its `count` panes (1 to 3). The Notebook, a sheet,
// and a collection have their own pane (the list, the editor, the collection)
// which is not a row of tabs, so `panes` holds exactly the one pane beside it
// and `count` (1 or 2) says whether it is shown. A pane that is hidden keeps
// its tabs, so 2 to 1 to 2 returns them. The Trash is one pane with no tabs
// and no count control: `panes` is empty.
//
// A tab: { id: "t3", kind, ...what that kind keeps }. The kinds are "lit"
// (`at`, a passage; `hide`, the marks its text hides, E108), "greek"
// (`word`: { verse, t } when it was opened at a word), "footnotes", "verse",
// "mine" (the Notes tab; kept under the id the old layouts used; `scope`),
// "search", "collection" (`collection`, a record id) and "sheet" (`sheet`).
// A tab that follows the LIT (Notes, Footnotes, This verse, Greek) has `pin:
// { at }` when it is pinned to a passage and no `pin` while it follows. That
// one field is both "Pin to this passage" and the "Follow reading" switch.
//
// Widths are kept as fractions of the room the panes share, one list per
// count, because a fraction means the same thing in a window of another size
// (pixels would be clamped on every read and would drift each time the window
// changed). The one pixel width is the pane beside a sheet, which the record
// fixes at 320px while the sheet takes the rest. `columnWidths` turns either
// into pixels for the room given, never under MIN_WIDTH.

import { MARK_IDS, markList } from "./desk-lit-marks.mjs";
import { formatPassage, parsePassage, parsePlaceParam } from "./desk-passage.mjs";

/** The localStorage key. It is the old layout's, named in /privacy. */
export const STATE_KEY = "lit-desk-layout";
export const STATE_VERSION = 2;
/** Scripture holds one to three panes (the fourth went with Phase 9). */
export const MAX_PANES = 3;
/** The narrowest a pane can be. */
export const MIN_WIDTH = 280;
/** The line between two panes. */
export const HANDLE = 6;
/** The pane beside a sheet at first. */
export const SIDE_WIDTH = 320;
/** How many sheets, and how many collections, keep a state of their own. */
export const MAX_KEPT = 20;
/** The reason key for a count the window can't hold (desk-layout's NEEDS_TEXT key, "Needs a wider window"). */
export const NEEDS_WIDER = "wider";

export const PLACES = Object.freeze(["scripture", "notebook", "sheet", "collection", "trash"]);
export const KINDS = Object.freeze(["lit", "greek", "footnotes", "verse", "mine", "search", "collection", "sheet"]);
/** Kinds that follow the LIT tab the reader last moved in, unless pinned. */
export const FOLLOWERS = Object.freeze(["mine", "verse", "footnotes", "greek"]);
/** Kinds the old layouts called by another name (desk-layout's RETIRED_KINDS). */
export const RETIRED_KINDS = Object.freeze({ kept: "mine", intro: "verse" });

/** What a place's pane may offer ("What each place shows beside it"), in the order its list shows. */
const OFFERS = {
  scripture: ["lit", "greek", "footnotes", "verse", "mine", "search"],
  notebook: ["lit", "verse", "greek", "search"],
  collection: ["lit", "search", "mine"],
  sheet: ["lit", "search", "mine", "collection", "sheet"],
  trash: [],
};

const SIDE_PLACES = new Set(["notebook", "sheet", "collection"]);
/** Widths within a tenth of a percent of even count as even (as desk-layout's isEven did). */
const EVEN_TOL = 0.001;
const RECORD_ID = /^[A-Za-z0-9_-]{1,80}$/;
const TAB_ID = /^t\d{1,6}$/;

const clone = (v) => structuredClone(v);
const isFollower = (kind) => FOLLOWERS.includes(kind);
const validId = (id) => typeof id === "string" && RECORD_ID.test(id);
const validAt = (at) => {
  const p = parsePassage(at);
  return p ? formatPassage(p) : null;
};
const even = (n) => Array.from({ length: n }, () => 1 / n);

// ---- what a place may show ------------------------------------------------

/** The kinds a place's pane may offer, in order; none for the Trash and for a place this code doesn't know. */
export const offers = (place) => [...(OFFERS[place] ?? [])];

/** Whether a kind may appear in a place. */
export const kindAllowed = (place, kind) => (OFFERS[place] ?? []).includes(kind);

/**
 * "Open in this pane ▸" and the empty pane's list, grouped as the record
 * groups Scripture's: Scripture, Yours, and Search on its own line. The other
 * places offer one flat group. Group keys only; the words are the page's.
 */
export function offerGroups(place) {
  const all = offers(place);
  if (place !== "scripture") return all.length ? [{ group: "all", kinds: all }] : [];
  return [
    { group: "scripture", kinds: all.filter((k) => ["lit", "greek", "footnotes", "verse"].includes(k)) },
    { group: "yours", kinds: all.filter((k) => k === "mine") },
    { group: "search", kinds: all.filter((k) => k === "search") },
  ];
}

/** The number of panes a place can be set to, or [] where it has no count (the Trash). */
export const countsFor = (place) => (place === "scripture" ? [1, 2, 3] : SIDE_PLACES.has(place) ? [1, 2] : []);

// ---- the room a count needs -----------------------------------------------

/** The window width a count of panes needs (SD-16): each at least MIN_WIDTH, with the lines between. */
export const neededWidth = (count) => count * MIN_WIDTH + (count - 1) * HANDLE;

/**
 * Which counts the room holds: `[{ count, fits, reason }]`, `reason` null or
 * "wider" (NEEDS_WIDER). `available` is the width the panes share, which the
 * page works out (the sidebar open or folded is its arithmetic, not the model's).
 */
export function countFits(place, available) {
  return countsFor(place).map((count) => {
    const fits = Number.isFinite(available) && available >= neededWidth(count);
    return { count, fits, reason: fits ? null : NEEDS_WIDER };
  });
}

/** The largest count of a place the room holds, or 1 when none does. */
export const largestFit = (place, available) =>
  countFits(place, available).filter((c) => c.fits).reduce((m, c) => Math.max(m, c.count), 1);

/** The names a pane can have in "Move this tab to", for a count: left, then middle (only with three), then right. */
export const paneNames = (count) => (count >= 3 ? ["left", "middle", "right"] : count === 2 ? ["left", "right"] : ["left"]);

// ---- building ---------------------------------------------------------------

const emptyPane = () => ({ tabs: [], open: null });

function shell(kind, id = null) {
  const trash = kind === "trash";
  const p = { count: 1, panes: trash ? [] : [emptyPane()], working: trash ? null : 0, widths: {}, lit: null, at: null, seq: 1 };
  if (id) p.id = id;
  return p;
}

function mkTab(p, kind, fields = {}) {
  return { id: `t${p.seq++}`, kind, ...fields };
}

function put(p, paneIndex, tab, open = true) {
  p.panes[paneIndex].tabs.push(tab);
  if (open || p.panes[paneIndex].open === null) p.panes[paneIndex].open = tab.id;
  return tab;
}

/**
 * A place as it opens the first time ("Opens with"). `ctx`: `passage` (where
 * the LIT starts, "john 3:16"; without one the page starts it at Continue
 * reading), and for a sheet `memberOf` (the ids of the collections it is in,
 * the one it was added to last at the end) and `from` (the place the reader
 * came from, `{ kind, id }`).
 */
export function openingPlace(kind, id = null, ctx = {}) {
  const p = shell(kind, SIDE_PLACES.has(kind) && kind !== "notebook" ? id : null);
  const at = validAt(ctx.passage);
  if (at) p.at = at;
  const litFields = at ? { at } : {};
  const lit = () => {
    const t = mkTab(p, "lit", litFields);
    p.lit = t.id;
    return t;
  };
  if (kind === "scripture") {
    // A new reader: the LIT, and beside it the reading page's own panel.
    p.count = 2;
    p.panes = [emptyPane(), emptyPane()];
    put(p, 0, lit());
    ["mine", "footnotes", "verse", "greek"].forEach((k, i) => put(p, 1, mkTab(p, k), i === 0));
    p.working = 1;
  } else if (kind === "notebook") {
    p.count = 2;
    put(p, 0, lit());
    put(p, 0, mkTab(p, "verse"), false);
  } else if (kind === "collection") {
    p.count = 2;
    put(p, 0, lit());
    put(p, 0, mkTab(p, "search"), false);
  } else if (kind === "sheet") {
    const members = Array.isArray(ctx.memberOf) ? ctx.memberOf.filter(validId) : [];
    const from = ctx.from?.kind === "collection" && members.includes(ctx.from.id) ? ctx.from.id : null;
    const chosen = from ?? members.at(-1) ?? null;
    if (chosen) {
      p.count = 2;
      put(p, 0, mkTab(p, "collection", { collection: chosen }));
      put(p, 0, lit(), false);
      put(p, 0, mkTab(p, "search"), false);
      put(p, 0, mkTab(p, "mine"), false);
    }
    // A sheet in no collection starts with one pane, and its second opens empty.
  }
  return p;
}

/**
 * A new reader's state (no saved state, or nothing usable): Scripture with
 * two panes, the LIT, and beside it Notes, Footnotes, This verse, and Greek;
 * the Notebook and the Trash as they open; Scripture on screen.
 */
export function freshState(ctx = {}) {
  return {
    v: STATE_VERSION,
    open: { kind: "scripture" },
    scripture: openingPlace("scripture", null, ctx),
    notebook: openingPlace("notebook", null, ctx),
    trash: shell("trash"),
    sheets: [],
    collections: [],
  };
}

// ---- finding a place ---------------------------------------------------------

const refOf = (state, ref) => ref ?? state.open;

/** The state of a place (`{ kind, id? }`, default the open one), or null for a sheet or collection with none yet. */
export function getPlace(state, ref = null) {
  const r = refOf(state, ref);
  if (r.kind === "sheet") return state.sheets.find((e) => e.id === r.id) ?? null;
  if (r.kind === "collection") return state.collections.find((e) => e.id === r.id) ?? null;
  return state[r.kind] ?? null;
}

function putPlace(state, r, p) {
  if (r.kind === "sheet") return { ...state, sheets: state.sheets.map((e) => (e.id === r.id ? p : e)) };
  if (r.kind === "collection") return { ...state, collections: state.collections.map((e) => (e.id === r.id ? p : e)) };
  return { ...state, [r.kind]: p };
}

/** Run `fn` on a copy of a place and put the copy back; `fn` returns false to refuse (the state comes back unchanged). */
function edit(state, ref, fn) {
  const r = refOf(state, ref);
  const cur = r.kind === "trash" ? null : getPlace(state, r);
  if (!cur) return state;
  const c = clone(cur);
  if (fn(c, r) === false) return state;
  return putPlace(state, r, c);
}

// ---- reading a place ---------------------------------------------------------

/** Every tab of a place in reading order (left to right, then along each row), each with its pane and index. */
export function tabsOf(p) {
  return p.panes.flatMap((pane, paneIndex) => pane.tabs.map((tab, index) => ({ tab, pane: paneIndex, index })));
}

/** One tab of a place by id: `{ tab, pane, index }` or null. */
export const findTab = (p, id) => tabsOf(p).find((t) => t.tab.id === id) ?? null;

/** The LIT tab the following tabs follow: the one the reader last moved in, else the first. Null with none. */
export function leadLit(p) {
  const all = tabsOf(p).filter((t) => t.tab.kind === "lit");
  return (all.find((t) => t.tab.id === p.lit) ?? all[0])?.tab ?? null;
}

/** The passage the following tabs share: the lead LIT tab's, else the place's own (set with the picker). Null with neither. */
export const followedPassage = (p) => leadLit(p)?.at ?? p.at ?? null;

/** Whether a tab follows the LIT (it is a follower and not pinned). */
export const isFollowing = (tab) => isFollower(tab.kind) && !tab.pin;

/** The passage a tab shows: a pinned tab's own, a following tab's the shared one; null for kinds with none. */
export function passageOf(p, tab) {
  if (!isFollower(tab.kind)) return tab.kind === "lit" ? tab.at ?? null : null;
  return tab.pin ? tab.pin.at ?? null : followedPassage(p);
}

/** The pane count the title row shows for a place. */
export const paneCount = (p) => (p.panes.length ? p.count : 0);

/** The marks a LIT tab hides, in the table's order; none for another kind. */
export const tabHides = (tab) => (tab?.kind === "lit" ? markList(tab.hide) : []);

// ---- opening, selecting, moving, closing -------------------------------------

/** Whether an existing tab is the thing being opened. */
function sameThing(tab, thing) {
  if (tab.kind !== thing.kind) return false;
  if (thing.kind === "sheet") return tab.sheet === thing.sheet;
  if (thing.kind === "collection") return tab.collection === thing.collection;
  if (thing.kind === "lit" && thing.at) {
    const a = parsePassage(tab.at);
    const b = parsePassage(thing.at);
    return Boolean(a && b && a.bookKey === b.bookKey && a.chapter === b.chapter);
  }
  return true;
}

/** The fields a new tab of a kind starts with, from the thing opened. */
function fieldsFor(thing) {
  if (thing.kind === "lit") return thing.at ? { at: thing.at } : {};
  if (thing.kind === "sheet") return { sheet: thing.sheet };
  if (thing.kind === "collection") return { collection: thing.collection };
  if (thing.kind === "greek" && thing.word) return { word: thing.word };
  return {};
}

const cleanWord = (w) =>
  w && Number.isInteger(w.verse) && Number.isInteger(w.t) && w.verse > 0 && w.t > 0 && w.verse < 1000 && w.t < 1000
    ? { verse: w.verse, t: w.t }
    : null;

function cleanThing(thing) {
  if (!thing || typeof thing.kind !== "string" || !KINDS.includes(thing.kind)) return null;
  const t = { kind: thing.kind };
  if (t.kind === "lit" && thing.at != null) {
    const at = validAt(thing.at);
    if (!at) return null;
    t.at = at;
  }
  if (t.kind === "sheet") {
    if (!validId(thing.sheet)) return null;
    t.sheet = thing.sheet;
  }
  if (t.kind === "collection") {
    if (!validId(thing.collection)) return null;
    t.collection = thing.collection;
  }
  if (t.kind === "greek" && thing.word) {
    const word = cleanWord(thing.word);
    if (word) t.word = word;
  }
  return t;
}

/** Put a place's lead LIT and passage where a LIT tab's reader is. */
function moveLead(p, tab) {
  p.lit = tab.id;
  if (tab.at) p.at = tab.at;
}

/** Show the pane beside a place's own (the Notebook, a sheet, a collection) once something opens in it. */
function showSide(p, kind) {
  if (SIDE_PLACES.has(kind) && p.count < 2) p.count = 2;
}

/**
 * Open a thing in a place (SD-30). `thing`: `{ kind, at? }` for the LIT,
 * `{ kind: "sheet", sheet }`, `{ kind: "collection", collection }`, or just
 * a kind. If a tab for it is open in any pane its tab comes forward (a LIT tab
 * of the same chapter takes the passage's verse); otherwise a new tab goes to
 * the working pane, or to `pane` when one is named. Nothing is replaced, and
 * the working pane does not change. `fresh` adds a tab even when one is open
 * (two LIT tabs to compare, two searches). In the Notebook, a sheet, and a
 * collection the second pane opens if there was one pane. A thing the place
 * can't show, or a sheet beside itself, leaves the state as it was.
 */
export function openThing(state, ref, thing, { pane = null, fresh = false } = {}) {
  const want = cleanThing(thing);
  return edit(state, ref, (c, r) => {
    if (!want || !kindAllowed(r.kind, want.kind)) return false;
    if (want.kind === "sheet" && want.sheet === r.id) return false;
    const found = fresh ? null : tabsOf(c).find((t) => sameThing(t.tab, want));
    if (found) {
      c.panes[found.pane].open = found.tab.id;
      if (want.kind === "lit" && want.at) {
        found.tab.at = want.at;
        moveLead(c, found.tab);
      }
      if (want.kind === "greek" && want.word) found.tab.word = want.word;
      showSide(c, r.kind);
      return true;
    }
    const index = Number.isInteger(pane) && pane >= 0 && pane < c.panes.length ? pane : c.working;
    const tab = put(c, index, mkTab(c, want.kind, fieldsFor(want)));
    if (want.kind === "lit" && (want.at || !c.lit)) moveLead(c, tab);
    showSide(c, r.kind);
    return true;
  });
}

/**
 * Take the LIT to a passage: the lead LIT tab comes forward and moves there,
 * else a LIT tab opens at it (the Notebook's "choosing a note takes the LIT
 * tab beside it to the note's verse," and with one pane it opens the second).
 */
export function goTo(state, ref, at) {
  const to = validAt(at);
  if (!to) return state;
  return edit(state, ref, (c, r) => {
    if (!kindAllowed(r.kind, "lit")) return false;
    const lead = leadLit(c);
    if (!lead) {
      const tab = put(c, c.working, mkTab(c, "lit", { at: to }));
      moveLead(c, tab);
    } else {
      const loc = findTab(c, lead.id);
      c.panes[loc.pane].open = lead.id;
      loc.tab.at = to;
      moveLead(c, loc.tab);
    }
    c.at = to;
    showSide(c, r.kind);
  });
}

/** The reader's click on a tab: it comes forward in its pane, the pane becomes the working one, and a LIT tab is the one followed. */
export function selectTab(state, ref, tabId) {
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (!loc) return false;
    c.panes[loc.pane].open = tabId;
    c.working = loc.pane;
    if (loc.tab.kind === "lit") moveLead(c, loc.tab);
  });
}

/** Choose the working pane (where something new opens). */
export function setWorking(state, ref, index) {
  return edit(state, ref, (c) => {
    if (!Number.isInteger(index) || index < 0 || index >= c.panes.length) return false;
    c.working = index;
  });
}

/**
 * Move a tab to a pane at an index (the end by default): between panes, or
 * within one to reorder it. The tab opens in its new pane, and that pane
 * becomes the working one. `index` is the tab's place in the row afterward.
 */
export function moveTab(state, ref, tabId, toPane, index = Infinity) {
  return edit(state, ref, (c, r) => {
    const loc = findTab(c, tabId);
    if (!loc || !Number.isInteger(toPane) || toPane < 0 || toPane >= c.panes.length) return false;
    const from = c.panes[loc.pane];
    from.tabs.splice(loc.index, 1);
    if (from.open === tabId) from.open = (from.tabs[loc.index] ?? from.tabs[loc.index - 1])?.id ?? null;
    const to = c.panes[toPane];
    const at = Math.min(Math.max(Number.isFinite(index) ? Math.trunc(index) : to.tabs.length, 0), to.tabs.length);
    to.tabs.splice(at, 0, loc.tab);
    to.open = tabId;
    c.working = toPane;
    showSide(c, r.kind);
  });
}

/** "Move this tab to" Left, Middle, or Right (`paneNames`): to the end of that pane. */
export function moveTabTo(state, ref, tabId, name) {
  const p = getPlace(state, ref);
  const i = p ? paneNames(p.panes.length).indexOf(name) : -1;
  return i < 0 ? state : moveTab(state, ref, tabId, i);
}

/** The panes a tab can be moved to from where it is: `[{ name, pane }]`, empty where the place has one pane of tabs. */
export function moveTargets(state, ref, tabId) {
  const p = getPlace(state, ref);
  const loc = p && findTab(p, tabId);
  if (!loc || p.panes.length < 2) return [];
  return paneNames(p.panes.length).map((name, pane) => ({ name, pane })).filter((t) => t.pane !== loc.pane);
}

/**
 * Close a tab. If it was open, its neighbor opens (the next, else the
 * previous). A pane with no tabs stays, empty, showing the list. Closing the
 * lead LIT hands the lead to the first LIT left; the shared passage stays.
 */
export function closeTab(state, ref, tabId) {
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (!loc) return false;
    const pane = c.panes[loc.pane];
    pane.tabs.splice(loc.index, 1);
    if (pane.open === tabId) pane.open = (pane.tabs[loc.index] ?? pane.tabs[loc.index - 1])?.id ?? null;
    if (c.lit === tabId) {
      if (loc.tab.at) c.at = loc.tab.at;
      c.lit = tabsOf(c).find((t) => t.tab.kind === "lit")?.tab.id ?? null;
    }
  });
}

// ---- the count -----------------------------------------------------------------

/**
 * Set a place's pane count (SD-33). Scripture keeps everything: going down
 * moves the closed panes' tabs into the last pane still open, in order, with
 * that pane's open tab still open; a new pane opens empty. The Notebook, a
 * sheet, and a collection show or hide their one pane beside (hidden, it
 * keeps its tabs). A count the place doesn't have, or one `available` (the
 * room the panes share) can't hold, leaves the state as it was.
 */
export function setCount(state, ref, count, { available = null } = {}) {
  return edit(state, ref, (c, r) => {
    if (!countsFor(r.kind).includes(count) || count === c.count) return false;
    if (available !== null && !(available >= neededWidth(count))) return false;
    if (r.kind === "scripture") {
      while (c.panes.length < count) c.panes.push(emptyPane());
      while (c.panes.length > count) {
        const gone = c.panes.pop();
        const last = c.panes[c.panes.length - 1];
        last.tabs.push(...gone.tabs);
        if (last.open === null) last.open = gone.open;
      }
      if (c.working >= count) c.working = count - 1;
    }
    c.count = count;
  });
}

// ---- widths ----------------------------------------------------------------------

/** Whole-pixel widths for weights over `room`, none under MIN_WIDTH, summing to `room` exactly. */
function fit(weights, room) {
  const n = weights.length;
  const px = Array(n).fill(0);
  const fixed = new Set();
  for (;;) {
    const free = [...weights.keys()].filter((i) => !fixed.has(i));
    const total = free.reduce((a, i) => a + weights[i], 0) || free.length;
    const left = room - fixed.size * MIN_WIDTH;
    let again = false;
    for (const i of free) {
      px[i] = ((weights[i] || 1 / free.length) / total) * left;
      if (px[i] < MIN_WIDTH) {
        fixed.add(i);
        again = true;
      }
    }
    if (!again) break;
  }
  for (const i of fixed) px[i] = MIN_WIDTH;
  const whole = px.map(Math.floor);
  let rest = room - whole.reduce((a, b) => a + b, 0);
  [...px.keys()].sort((a, b) => px[b] - whole[b] - (px[a] - whole[a]) || a - b).forEach((i) => {
    if (rest > 0) {
      whole[i] += 1;
      rest -= 1;
    }
  });
  return whole;
}

const weightsOf = (p) => {
  const w = p.widths?.[String(p.count)];
  return Array.isArray(w) && w.length === p.count ? w : even(p.count);
};

/**
 * The pixel width of each column in the room `available`, left to right: the
 * panes, and in the Notebook, a sheet, and a collection the place's own pane
 * first and the one beside it second. They sum to `available` less the lines
 * between (HANDLE each), none under MIN_WIDTH. Where the room can't hold
 * them, every column is MIN_WIDTH and the page scrolls. Beside a sheet the
 * pane beside keeps its own width and the sheet takes the rest.
 */
export function columnWidths(state, ref, available) {
  const p = getPlace(state, ref);
  if (!p || !p.panes.length || p.count < 2) return [Math.max(0, Math.floor(available))];
  const n = p.count;
  const room = Math.floor(available) - HANDLE * (n - 1);
  if (room < n * MIN_WIDTH) return Array(n).fill(MIN_WIDTH);
  const r = refOf(state, ref);
  if (r.kind === "sheet") {
    const side = Math.min(Math.max(Math.round(p.side ?? SIDE_WIDTH), MIN_WIDTH), room - MIN_WIDTH);
    return [room - side, side];
  }
  return fit(weightsOf(p), room);
}

/**
 * How far the line after column `index` can go: `{ min, max, value }`, the
 * left column's width in pixels (the line's menu stops where the line does,
 * E189). Null where there is no such line or the room can't hold the columns.
 */
export function lineBounds(state, ref, index, available) {
  const p = getPlace(state, ref);
  if (!p || p.count < 2 || !Number.isInteger(index) || index < 0 || index >= p.count - 1) return null;
  if (Math.floor(available) - HANDLE * (p.count - 1) < p.count * MIN_WIDTH) return null;
  const px = columnWidths(state, ref, available);
  const pair = px[index] + px[index + 1];
  return { min: MIN_WIDTH, max: pair - MIN_WIDTH, value: px[index] };
}

function storeWidths(c, r, px) {
  const room = px.reduce((a, b) => a + b, 0);
  if (r.kind === "sheet") {
    const side = px[1];
    if (side === SIDE_WIDTH) delete c.side;
    else c.side = side;
    return;
  }
  const f = px.map((w) => Math.round((w / room) * 10000) / 10000);
  f[f.length - 1] = Math.round((1 - f.slice(0, -1).reduce((a, b) => a + b, 0)) * 10000) / 10000;
  const key = String(c.count);
  if (f.every((x) => Math.abs(x - 1 / f.length) < EVEN_TOL)) delete c.widths[key];
  else c.widths[key] = f;
}

/**
 * Drag the line after column `index` by `deltaPx` (also the menu's steps).
 * Only the two columns beside it change, and neither goes under MIN_WIDTH.
 * The count remembers its own widths.
 */
export function dragLine(state, ref, index, deltaPx, available) {
  const bounds = lineBounds(state, ref, index, available);
  if (!bounds || !Number.isFinite(deltaPx)) return state;
  const px = columnWidths(state, ref, available);
  const pair = px[index] + px[index + 1];
  const left = Math.min(Math.max(Math.round(px[index] + deltaPx), bounds.min), bounds.max);
  px[index] = left;
  px[index + 1] = pair - left;
  return edit(state, ref, (c, r) => storeWidths(c, r, px));
}

/** Whether a line already stands at its default (its pane pair shares evenly; beside a sheet, 320px): for a Reset that has nothing to do. */
export function lineIsDefault(state, ref, index) {
  const p = getPlace(state, ref);
  const r = refOf(state, ref);
  if (!p || p.count < 2 || index < 0 || index >= p.count - 1) return true;
  if (r.kind === "sheet") return (p.side ?? SIDE_WIDTH) === SIDE_WIDTH;
  const w = weightsOf(p);
  return Math.abs(w[index] - w[index + 1]) < EVEN_TOL;
}

/** Reset one line (E189): its two panes share their room evenly again; beside a sheet, the pane returns to 320px. */
export function resetLine(state, ref, index) {
  if (lineIsDefault(state, ref, index)) return state;
  return edit(state, ref, (c, r) => {
    if (r.kind === "sheet") {
      delete c.side;
      return;
    }
    const w = weightsOf(c).slice();
    const half = (w[index] + w[index + 1]) / 2;
    w[index] = half;
    w[index + 1] = half;
    if (w.every((x) => Math.abs(x - 1 / w.length) < EVEN_TOL)) delete c.widths[String(c.count)];
    else c.widths[String(c.count)] = w;
  });
}

// ---- following -------------------------------------------------------------------

/** A LIT tab's reader moved to a passage: the tab keeps it, and it becomes the tab the others follow. */
export function setLitAt(state, ref, tabId, at) {
  const to = validAt(at);
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (!to || !loc || loc.tab.kind !== "lit") return false;
    loc.tab.at = to;
    c.lit = tabId;
    c.at = to;
  });
}

/** The place's own passage, chosen with the picker when no LIT tab leads (the followers share it). */
export function setPlacePassage(state, ref, at) {
  const to = validAt(at);
  return edit(state, ref, (c) => {
    if (!to || c.at === to) return false;
    c.at = to;
  });
}

/**
 * The one state behind "Pin to this passage" and "Follow reading": a following
 * tab with `follows` false is pinned to the passage it is on now; with true it
 * follows again. Only a follower can be pinned.
 */
export function setFollowing(state, ref, tabId, follows) {
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (!loc || !isFollower(loc.tab.kind) || isFollowing(loc.tab) === Boolean(follows)) return false;
    if (follows) delete loc.tab.pin;
    else loc.tab.pin = { at: followedPassage(c) };
  });
}

/** Show or hide one mark in one LIT tab (its "Show" menu, E108). Unchanged for another kind, an unknown mark, or a mark already so. */
export function setTabMark(state, ref, tabId, mark, on) {
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (loc?.tab.kind !== "lit" || !MARK_IDS.includes(mark)) return false;
    const hidden = markList(loc.tab.hide);
    if (hidden.includes(mark) === !on) return false;
    const next = markList(on ? hidden.filter((m) => m !== mark) : [...hidden, mark]);
    if (next.length) loc.tab.hide = next;
    else delete loc.tab.hide;
  });
}

/** Set a Notes tab's scope: "chapter" or the default. Unchanged for another kind. */
export function setTabScope(state, ref, tabId, scope) {
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (loc?.tab.kind !== "mine" || (loc.tab.scope === "chapter") === (scope === "chapter")) return false;
    if (scope === "chapter") loc.tab.scope = "chapter";
    else delete loc.tab.scope;
  });
}

/** Set the Greek tab's word (`{ verse, t }`), or clear it with null. */
export function setGreekWord(state, ref, tabId, word) {
  const w = word === null ? null : cleanWord(word);
  return edit(state, ref, (c) => {
    const loc = findTab(c, tabId);
    if (loc?.tab.kind !== "greek" || (word !== null && !w)) return false;
    if (w) loc.tab.word = w;
    else delete loc.tab.word;
  });
}

// ---- places ----------------------------------------------------------------------

const sameRef = (a, b) => a.kind === b.kind && (a.id ?? null) === (b.id ?? null);

function checkRef(ref) {
  if (!ref || !PLACES.includes(ref.kind)) return null;
  if (ref.kind === "sheet" || ref.kind === "collection") return validId(ref.id) ? { kind: ref.kind, id: ref.id } : null;
  return { kind: ref.kind };
}

/** Move an entry to the front of a most-recent-first list and keep the list within MAX_KEPT. */
const front = (list, entry) => [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_KEPT);

/** Make a collection's tab the one open beside a sheet: forward if it is in a pane, else opened there. */
function collectionBeside(c, collectionId) {
  const found = tabsOf(c).find((t) => t.tab.kind === "collection" && t.tab.collection === collectionId);
  if (found) c.panes[found.pane].open = found.tab.id;
  else put(c, 0, mkTab(c, "collection", { collection: collectionId }));
  c.count = 2;
}

/**
 * Open a place. A sheet or collection seen for the first time starts as it
 * "Opens with" (`openingPlace`); after that it is as the reader left it, and
 * it moves to the front of the ones kept, the oldest past MAX_KEPT forgotten.
 * `ctx`: `passage`; for a sheet `memberOf` (the collections it is in, the
 * one added last at the end) and `from` (the place the reader came from): from
 * a collection's own place the sheet always opens with that collection beside
 * it. A place that isn't one leaves the state as it was.
 */
export function openPlace(state, ref, ctx = {}) {
  const r = checkRef(ref);
  if (!r) return state;
  if (r.kind === "sheet" || r.kind === "collection") {
    const key = r.kind === "sheet" ? "sheets" : "collections";
    let entry = state[key].find((e) => e.id === r.id);
    entry = entry ? clone(entry) : openingPlace(r.kind, r.id, ctx);
    if (r.kind === "sheet" && ctx.from?.kind === "collection" && Array.isArray(ctx.memberOf) && ctx.memberOf.includes(ctx.from.id) && validId(ctx.from.id)) {
      collectionBeside(entry, ctx.from.id);
    }
    return { ...state, open: r, [key]: front(state[key], entry) };
  }
  return sameRef(state.open, r) ? state : { ...state, open: r };
}

/** Forget a sheet's or collection's kept state (it was deleted, E.g.). If it was open, Scripture is. */
export function forgetPlace(state, ref) {
  const r = checkRef(ref);
  if (!r || (r.kind !== "sheet" && r.kind !== "collection")) return state;
  const key = r.kind === "sheet" ? "sheets" : "collections";
  const next = { ...state, [key]: state[key].filter((e) => e.id !== r.id) };
  return sameRef(state.open, r) ? { ...next, open: { kind: "scripture" } } : next;
}

/**
 * "Open in Scripture" (the LIT tab's More menu, for anything a place doesn't
 * hold): Scripture comes up and the thing opens there (`openThing`'s rules).
 */
export function openInScripture(state, thing) {
  return openThing(openPlace(state, { kind: "scripture" }), { kind: "scripture" }, thing);
}

/**
 * The header's magnifier and "/": in Scripture the Search tab comes forward
 * or opens in the working pane; in the Notebook, a sheet, or a collection it
 * opens beside the place's own pane (making the second pane if there was
 * one); in the Trash it opens in Scripture.
 */
export function searchFromHeader(state) {
  const r = state.open;
  if (r.kind === "trash") return openInScripture(state, { kind: "search" });
  return openThing(state, r, { kind: "search" });
}

// ---- addresses and arrival --------------------------------------------------------

/** A Greek word's param, "16.7", as `{ verse, t }`; null for anything else. */
function parseWord(value) {
  const m = /^(\d{1,3})\.(\d{1,3})$/.exec(String(value ?? ""));
  return m ? cleanWord({ verse: Number(m[1]), t: Number(m[2]) }) : null;
}

/**
 * What an address names (`location.pathname` and `location.search`):
 * `{ place, at, greek, list }`. `place` is `{ kind, id? }` or null; `at` a
 * passage ("john 3:16") from `?place=`, and `greek` `{ verse, t }` from
 * `&greek=16.7` (only with a passage); `list` is "sheets" or "collections"
 * for the address of their pages with no `?id=`, which names no place.
 * The Study page's own path is data so its rename is one line: `studyPath`
 * (default "/desk", /study from the rename). `&layout=reading` is ignored, so
 * an old link opens the passage (RP-43). Unknown addresses give nothing.
 */
export function parseAddress(pathname, search = "", { studyPath = "/desk" } = {}) {
  const path = String(pathname ?? "").replace(/\/+$/, "").toLowerCase() || "/";
  const q = new URLSearchParams(String(search ?? ""));
  const at = validAt(parsePlaceParam(q.get("place")));
  const out = { place: null, at, greek: at ? parseWord(q.get("greek")) : null, list: null };
  const id = q.get("id");
  if (path === studyPath.replace(/\/+$/, "").toLowerCase()) {
    const sheet = q.get("sheet");
    const collection = q.get("collection");
    if (validId(sheet)) out.place = { kind: "sheet", id: sheet };
    else if (validId(collection)) out.place = { kind: "collection", id: collection };
    else out.place = { kind: "scripture" };
  } else if (path === "/notebook") {
    out.place = { kind: "notebook" };
  } else if (path === "/sheets") {
    if (validId(id)) out.place = { kind: "sheet", id };
    else out.list = "sheets";
  } else if (path === "/collections") {
    if (validId(id)) out.place = { kind: "collection", id };
    else out.list = "collections";
  } else {
    return { place: null, at: null, greek: null, list: null };
  }
  return out;
}

/**
 * Arrive: Study reached at an address (`parseAddress`'s result), with the
 * `ctx` `openPlace` takes. The place opens; a passage takes the lead LIT tab
 * there (or opens one; the Notebook's second pane with it). A Greek word brings
 * a following Greek tab forward at that word, adding one where a place that
 * holds the Greek has none or only pinned ones. Returns the state to save.
 */
export function arrive(state, address, ctx = {}) {
  let s = state;
  const ref = address?.place ? checkRef(address.place) : null;
  if (ref) s = openPlace(s, ref, ctx);
  if (!ref || ref.kind === "trash") return s;
  const at = validAt(address.at);
  if (at) s = goTo(s, ref, at);
  if (at && address.greek && kindAllowed(ref.kind, "greek")) {
    const word = cleanWord(address.greek);
    if (word) {
            s = edit(s, ref, (c, r) => {
        const loc = tabsOf(c).find((t) => t.tab.kind === "greek" && isFollowing(t.tab));
        if (loc) {
          loc.tab.word = word;
          c.panes[loc.pane].open = loc.tab.id;
        } else {
          put(c, c.working, mkTab(c, "greek", { word }));
        }
        showSide(c, r.kind);
      });
    }
  }
  return s;
}

// ---- keeping it -------------------------------------------------------------------

/** Tabs of a place, checked: kinds the place offers, ids once each, fields of each kind only. */
function checkTab(t, kind, id, used) {
  if (!t || typeof t !== "object") return null;
  const tabKind = Object.hasOwn(RETIRED_KINDS, t.kind) ? RETIRED_KINDS[t.kind] : t.kind;
  if (typeof t.id !== "string" || !TAB_ID.test(t.id) || used.has(t.id) || !kindAllowed(kind, tabKind)) return null;
  const out = { id: t.id, kind: tabKind };
  if (tabKind === "lit") {
    const at = validAt(t.at);
    if (at) out.at = at;
    const hide = markList(t.hide);
    if (hide.length) out.hide = hide;
  }
  if (isFollower(tabKind) && t.pin && typeof t.pin === "object") out.pin = { at: validAt(t.pin.at) };
  if (tabKind === "mine" && t.scope === "chapter") out.scope = "chapter";
  if (tabKind === "greek") {
    const word = cleanWord(t.word);
    if (word) out.word = word;
  }
  if (tabKind === "sheet") {
    if (!validId(t.sheet) || t.sheet === id) return null;
    out.sheet = t.sheet;
  }
  if (tabKind === "collection") {
    if (!validId(t.collection)) return null;
    out.collection = t.collection;
  }
  used.add(t.id);
  return out;
}

function checkPlace(v, kind, id, ctx) {
  const base = openingPlace(kind, id, ctx);
  if (kind === "trash") return shell("trash");
  if (!v || typeof v !== "object" || !Array.isArray(v.panes) || !v.panes.length) return base;
  const used = new Set();
  let panes = v.panes.slice(0, SIDE_PLACES.has(kind) ? 1 : 64).map((pane) => {
    const tabs = Array.isArray(pane?.tabs) ? pane.tabs.map((t) => checkTab(t, kind, id, used)).filter(Boolean) : [];
    return { tabs, open: tabs.some((t) => t.id === pane?.open) ? pane.open : (tabs[0]?.id ?? null) };
  });
  if (!SIDE_PLACES.has(kind) && panes.length > MAX_PANES) {
    const extra = panes.splice(MAX_PANES - 1);
    const last = extra[0];
    for (const e of extra.slice(1)) last.tabs.push(...e.tabs);
    panes.push(last);
  }
  const count = SIDE_PLACES.has(kind) ? (v.count === 1 ? 1 : 2) : panes.length;
  const out = shell(kind, id);
  out.panes = panes;
  out.count = count;
  out.working = SIDE_PLACES.has(kind) ? 0 : Number.isInteger(v.working) && v.working >= 0 && v.working < panes.length ? v.working : 0;
  const widths = {};
  for (const n of countsFor(kind).filter((x) => x > 1)) {
    const w = v.widths?.[String(n)];
    if (Array.isArray(w) && w.length === n && w.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) {
      const sum = w.reduce((a, b) => a + b, 0);
      const f = w.map((x) => Math.round((x / sum) * 10000) / 10000);
      f[n - 1] = Math.round((1 - f.slice(0, -1).reduce((a, b) => a + b, 0)) * 10000) / 10000;
      if (f.every((x) => x > 0) && !f.every((x) => Math.abs(x - 1 / n) < EVEN_TOL)) widths[String(n)] = f;
    }
  }
  out.widths = kind === "sheet" ? {} : widths;
  if (kind === "sheet" && typeof v.side === "number" && Number.isFinite(v.side)) {
    const side = Math.min(Math.max(Math.round(v.side), MIN_WIDTH), 20000);
    if (side !== SIDE_WIDTH) out.side = side;
  }
  const all = panes.flatMap((p) => p.tabs);
  out.lit = all.some((t) => t.id === v.lit && t.kind === "lit") ? v.lit : null;
  out.at = validAt(v.at);
  const top = Math.max(0, ...all.map((t) => Number(t.id.slice(1))));
  out.seq = Math.max(top + 1, Number.isInteger(v.seq) && v.seq > 0 && v.seq < 1e6 ? v.seq : 1);
  return out;
}

function checkEntries(list, kind, ctx) {
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    if (!e || !validId(e.id) || seen.has(e.id) || out.length >= MAX_KEPT) continue;
    seen.add(e.id);
    out.push(checkPlace(e, kind, e.id, ctx));
  }
  return out;
}

/**
 * Whatever a state value holds, made valid, never throwing: tabs of kinds a
 * place doesn't offer, repeats, and unusable fields are dropped, counts and
 * widths are brought into range, and anything missing comes from the opening
 * state. `ctx.passage` starts a new place's LIT.
 */
export function checkState(value, ctx = {}) {
  const v = value && typeof value === "object" ? value : {};
  const state = {
    v: STATE_VERSION,
    open: { kind: "scripture" },
    scripture: checkPlace(v.scripture, "scripture", null, ctx),
    notebook: checkPlace(v.notebook, "notebook", null, ctx),
    trash: shell("trash"),
    sheets: checkEntries(v.sheets, "sheet", ctx),
    collections: checkEntries(v.collections, "collection", ctx),
  };
  const open = checkRef(v.open);
  if (open && (open.kind !== "sheet" && open.kind !== "collection" ? true : getPlace(state, open))) state.open = open;
  return state;
}

// ---- migrating today's layouts ------------------------------------------------------

/** The old layout's leaves in reading order, left to right and top to bottom: a leaf of a tree is its pane. */
function oldPanes(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return [];
  if (node.pane && typeof node.pane === "object") return [node.pane];
  return Array.isArray(node.children) ? node.children.flatMap((c) => oldPanes(c, depth + 1)) : [];
}

/**
 * A layout saved by the tree of split panes (desk-layout.mjs: `{ root, active,
 * place, reading }`), as a state, or null when nothing in it survives.
 * Panes flatten in reading order, one pane each, at most three (the extra
 * ones' tabs join the last). A tab keeps its `at`, pin, scope, and marks; a
 * retired kind maps by RETIRED_KINDS. Sheets and collections are places now,
 * so their panes are dropped, and so is a pane with nothing left; so are
 * kinds this code doesn't know. A Reading layout's turned-off marks stay off
 * (its `readingHid` joins `hide`), and "My default" is not read.
 */
export function migrateLayout(old, ctx = {}) {
  try {
    const raw = oldPanes(old?.root);
    const items = raw
      .map((p) => ({ p, kind: Object.hasOwn(RETIRED_KINDS, p.kind) ? RETIRED_KINDS[p.kind] : p.kind }))
      .filter((i) => ["lit", "mine", "verse", "footnotes", "greek", "search"].includes(i.kind));
    if (!items.length) return null;
    const place = shell("scripture");
    const rows = items.map((i) => [i]);
    while (rows.length > MAX_PANES) rows[MAX_PANES - 1].push(...rows.pop());
    const onlyLit = raw.length === 1 && raw[0].kind === "lit";
    place.count = rows.length;
    place.panes = rows.map((row) => {
      const tabs = row.map(({ p, kind }) => {
        const fields = {};
        if (kind === "lit") {
          const at = validAt(p.at);
          if (at) fields.at = at;
          let hide = markList(p.hide);
          if (old.reading === true && onlyLit) {
            hide = markList([...hide, ...markList(p.readingHid)]);
            // An older Reading layout listed nothing and had all four off.
            if (!Array.isArray(p.hide) && !Array.isArray(p.readingHid)) hide = [...MARK_IDS];
          }
          if (hide.length) fields.hide = hide;
        }
        if (isFollower(kind) && p.pin && typeof p.pin === "object") fields.pin = { at: validAt(p.pin.at) };
        if (kind === "mine" && p.scope === "chapter") fields.scope = "chapter";
        const tab = mkTab(place, kind, fields);
        tab.old = p.id;
        return tab;
      });
      return { tabs, open: tabs[0].id };
    });
    const activeLoc = tabsOf(place).find((t) => t.tab.old === old.active && t.tab.kind === "lit")
      ?? tabsOf(place).find((t) => t.tab.kind === "lit");
    for (const t of tabsOf(place)) delete t.tab.old;
    place.working = activeLoc?.pane ?? 0;
    const at = validAt(old.place);
    if (activeLoc) {
      place.lit = activeLoc.tab.id;
      place.at = at ?? activeLoc.tab.at ?? null;
    } else {
      place.at = at;
    }
    // Columns the reader had dragged keep their widths when every pane came through.
    const root = old.root;
    if (root?.split === "columns" && Array.isArray(root.children) && root.children.length === rows.length && rows.length > 1
      && root.children.every((c) => c?.pane) && rows.every((r) => r.length === 1) && raw.length === items.length
      && Array.isArray(root.sizes) && root.sizes.length === rows.length) {
      place.widths[String(rows.length)] = root.sizes;
    }
    const state = { ...freshState(ctx), scripture: place };
    return checkState(state, ctx);
  } catch (_) {
    return null;
  }
}

/**
 * What the key holds, as a valid state, whatever it is: this version's state,
 * today's layout (the key's `{ v: 1, last, mine, start }` or a bare layout),
 * junk, an empty string, or null. Never throws.
 */
export function readState(stored, ctx = {}) {
  let data = stored;
  if (typeof stored === "string") {
    try {
      data = JSON.parse(stored);
    } catch (_) {
      data = null;
    }
  }
  if (!data || typeof data !== "object") return freshState(ctx);
  if (data.v === STATE_VERSION && data.open) return checkState(data, ctx);
  const legacy = data.root ? data : data.last?.root ? data.last : null;
  return (legacy && migrateLayout(legacy, ctx)) || freshState(ctx);
}

/** The state as text for the key; `readState` of it gives the state back. */
export const writeState = (state) => JSON.stringify(checkState(state));
