// src/lib/desk-present.mjs
//
// Present mode (STUDY-DESK.md, S6, M2, M3; "Order of work", 3j): a sheet shown
// to a room, full screen, one part at a time, with the reveal, a code on its
// first screen, and a presenter view in a second window. The rules only;
// /sheets/ draws them (src/scripts/desk/sheet-present.js). Pure, so they can
// be tested without a page.
//
// Nothing here is stored. Where the room is (which screen, how much of each
// screen is revealed, whether its footnotes are up) lives in the two windows
// for as long as they are open, and travels between them as messages
// (`presentMessage`), never as a record.

import { MODULE_TYPES } from "./desk-sheet-format.mjs";
import { htmlToText, traditionalWord } from "./desk-sheet-lit.mjs";
import { passageReference, sheetName } from "./desk-sheet-passages.mjs";
import { chapterCodes, modulesForCopy } from "./desk-sheet-copy.mjs";

/** The parts that get a screen of their own. A space to write and a page break are paper's. */
export const SHOWN_TYPES = Object.freeze(["passage", "text", "question", "keyTerms"]);

/** The most codes the first screen shows (M3); the rest are named in words. */
export const ROOM_CODES_MAX = 4;

/** The version of the messages the two windows send each other. */
export const MESSAGE_VERSION = 1;

/**
 * A sheet's screens, in order. The first is always the start screen (the
 * sheet's name and the codes to scan); then one screen per part the room sees,
 * in the sheet's order. A part marked Leader only never reaches the room: it
 * goes with the screen before it as the leader's notes (`notes`), or with the
 * start screen when nothing comes before it. Spaces, page breaks and parts of
 * a type this version doesn't know have no screen.
 *
 * @param {{ modules?: object[] }} sheet
 * @returns {{ kind: "start" | "passage" | "text" | "question" | "keyTerms", module: object | null, notes: object[] }[]}
 */
export function presentScreens(sheet) {
  const screens = [{ kind: "start", module: null, notes: [] }];
  for (const m of sheet?.modules ?? []) {
    if (!m || !MODULE_TYPES.includes(m.type)) continue;
    if (m.leaderOnly === true) {
      screens[screens.length - 1].notes.push(m);
      continue;
    }
    if (!SHOWN_TYPES.includes(m.type)) continue;
    screens.push({ kind: m.type, module: m, notes: [] });
  }
  return screens;
}

/** The first words of a sheet's formatted text, for a screen's name: at most eight, with "…" when cut. */
export function firstWords(html, n = 8) {
  const words = htmlToText(html).split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words.length > n ? `${words.slice(0, n).join(" ")}…` : words.join(" ");
}

/**
 * What a screen is called in the presenter view ("Next: Romans 8:1–4") and
 * when it is announced.
 */
export function screenTitle(screen, sheet) {
  switch (screen?.kind) {
    case "start":
      return sheetName(sheet);
    case "passage":
      return passageReference(screen.module);
    case "question":
      return firstWords(screen.module.html) ? `Question: ${firstWords(screen.module.html)}` : "Question";
    case "text":
      return firstWords(screen.module.html) || "Text";
    case "keyTerms":
      return "Key terms";
    default:
      return "";
  }
}

/**
 * The codes the start screen shows (M3): S5's code for each chapter the room
 * reads, in the order the sheet first quotes it, at most `ROOM_CODES_MAX`.
 * `more` is the chapters past that, which the screen names in words only.
 *
 * @returns {{ codes: ReturnType<typeof chapterCodes>, more: ReturnType<typeof chapterCodes> }}
 */
export function roomCodes(sheet, max = ROOM_CODES_MAX) {
  const all = chapterCodes(modulesForCopy(sheet, "participant"));
  return { codes: all.slice(0, max), more: all.slice(max) };
}

/**
 * How a blank looks on the screen before it is revealed (S6). A blank whose
 * hint is the traditional word shows that word, the reveal then putting the
 * LIT's rendering in its place; any other blank is a line, with the leader's
 * own hint beneath it when there is one.
 *
 * @param {{ hint?: string, hintText?: string }} blank
 * @param {{ traditional?: string } | null} term the glossary term the blanked words carry, if any
 * @returns {{ kind: "word", text: string } | { kind: "line", hint: string | null }}
 */
export function blankCover(blank, term) {
  if (blank?.hint === "traditional") {
    const word = traditionalWord(term);
    if (word) return { kind: "word", text: word };
    return { kind: "line", hint: null };
  }
  if (blank?.hint === "custom") return { kind: "line", hint: blank.hintText?.trim() || null };
  return { kind: "line", hint: null };
}

/* ── Where the room is ───────────────────────────────────────────────── */

/** Where a presentation starts: the start screen, nothing revealed, no footnotes up. */
export function initialState() {
  return { screen: 0, revealed: {}, notes: {} };
}

const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

/**
 * A state made safe for the sheet as it is now: the screen within range, each
 * screen's reveal within its number of blanks, footnotes only on passage
 * screens. Used on every state that arrives from the other window, and after
 * the sheet changes on /desk.
 *
 * @param {unknown} state
 * @param {{ kinds: string[], blanks: number[] }} shape each screen's kind and its number of blanks
 */
export function checkState(state, { kinds, blanks }) {
  const total = kinds.length;
  const out = initialState();
  if (!state || typeof state !== "object" || !total) return out;
  const screen = Number(state.screen);
  out.screen = Number.isInteger(screen) ? Math.min(Math.max(screen, 0), total - 1) : 0;
  for (const [k, v] of Object.entries(state.revealed ?? {})) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= total) continue;
    const n = Math.min(count(v), count(blanks[i]));
    if (n) out.revealed[i] = n;
  }
  for (const [k, v] of Object.entries(state.notes ?? {})) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < total && kinds[i] === "passage" && v === true) out.notes[i] = true;
  }
  return out;
}

/**
 * The state after one action:
 * - `next` / `prev`: the next or previous screen; `first` / `last`; `go` to
 *   screen `to`.
 * - `reveal`: the next hidden blank on this screen, in reading order; `hide`
 *   covers the last one revealed again.
 * - `notes`: the screen's footnotes up or down (passage screens only).
 * An action that can't move anything returns the same state object, so a
 * caller can tell nothing changed.
 *
 * @param {{ screen: number, revealed: Record<number, number>, notes: Record<number, boolean> }} state
 * @param {{ type: string, to?: number }} action
 * @param {{ kinds: string[], blanks: number[] }} shape
 */
export function stepState(state, action, { kinds, blanks }) {
  const total = kinds.length;
  const i = state.screen;
  const go = (to) => {
    const next = Math.min(Math.max(to, 0), total - 1);
    return next === i ? state : { ...state, screen: next };
  };
  switch (action?.type) {
    case "next":
      return go(i + 1);
    case "prev":
      return go(i - 1);
    case "first":
      return go(0);
    case "last":
      return go(total - 1);
    case "go":
      return Number.isInteger(action.to) ? go(action.to) : state;
    case "reveal": {
      const n = count(state.revealed[i]);
      if (n >= count(blanks[i])) return state;
      return { ...state, revealed: { ...state.revealed, [i]: n + 1 } };
    }
    case "hide": {
      const n = count(state.revealed[i]);
      if (!n) return state;
      const revealed = { ...state.revealed };
      if (n === 1) delete revealed[i];
      else revealed[i] = n - 1;
      return { ...state, revealed };
    }
    case "notes": {
      if (kinds[i] !== "passage") return state;
      const notes = { ...state.notes };
      if (notes[i]) delete notes[i];
      else notes[i] = true;
      return { ...state, notes };
    }
    default:
      return state;
  }
}

/** Two states alike, field by field. */
export function sameState(a, b) {
  if (a === b) return true;
  if (!a || !b || a.screen !== b.screen) return false;
  const same = (x, y) => {
    const kx = Object.keys(x ?? {});
    const ky = Object.keys(y ?? {});
    return kx.length === ky.length && kx.every((k) => x[k] === y?.[k]);
  };
  return same(a.revealed, b.revealed) && same(a.notes, b.notes);
}

/**
 * The words of every blank revealed so far, across the whole presentation:
 * what the key terms box and the footnotes may now show.
 *
 * @param {string[][]} words each screen's blanks' words, in reading order
 * @param {Record<number, number>} revealed
 */
export function revealedWords(words, revealed) {
  const out = new Set();
  words.forEach((list, i) => {
    for (const w of (list ?? []).slice(0, count(revealed?.[i]))) out.add(w);
  });
  return out;
}

/**
 * The footnotes a passage screen shows when they are up (S6: "then the LIT's
 * rendering and its footnote"). A footnote the leader chose to print shows; one
 * left out only because it gives a blank away (flagged, never decided) shows
 * once every blank it gives away has been revealed. `held` is how many are
 * still waiting on the reveal; one the leader chose to leave out never shows.
 *
 * @param {{ id: string, print: boolean, decided: boolean, givesAway: { exact: string }[] }[]} rows footnoteRows
 * @param {Set<string>} revealed revealedWords
 * @returns {{ shown: string[], held: number }}
 */
export function screenFootnotes(rows, revealed) {
  const shown = [];
  let held = 0;
  for (const r of rows ?? []) {
    if (r.print) shown.push(r.id);
    else if (!r.decided && r.givesAway?.length) {
      if (r.givesAway.every((b) => revealed.has(b.exact))) shown.push(r.id);
      else held += 1;
    }
  }
  return { shown, held };
}

/** The footnotes a passage screen could ever show: the ones it prints, and the ones the reveal lets out. */
export function footnotesInPlay(rows) {
  return (rows ?? []).filter((r) => r.print || (!r.decided && r.givesAway?.length)).map((r) => r.id);
}

/* ── Keys ────────────────────────────────────────────────────────────── */

/**
 * The action a key stands for, in both windows, or null. Arrows, Page Up and
 * Page Down (what a presentation clicker sends), Space and Shift+Space move
 * between screens; Home and End go to the first and last; R reveals and
 * Shift+R covers again; F puts the footnotes up and down. Up and Down are left
 * to scroll a screen too long to fit, and Escape to leave. A key held with
 * Ctrl, Alt or Cmd is the browser's.
 *
 * @param {{ key: string, shiftKey?: boolean, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean }} e
 * @returns {{ type: string } | null}
 */
export function presentKey(e) {
  if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
  switch (e.key) {
    case "ArrowRight":
    case "PageDown":
      return { type: "next" };
    case "ArrowLeft":
    case "PageUp":
      return { type: "prev" };
    case " ":
    case "Spacebar":
      return { type: e.shiftKey ? "prev" : "next" };
    case "Home":
      return { type: "first" };
    case "End":
      return { type: "last" };
    case "r":
    case "R":
      return { type: e.shiftKey ? "hide" : "reveal" };
    case "f":
    case "F":
      return e.shiftKey ? null : { type: "notes" };
    default:
      return null;
  }
}

/* ── Fitting a screen ────────────────────────────────────────────────── */

/**
 * The largest whole-pixel type size in [min, max] at which a screen fits,
 * found by halving (`fits(size)` lays the screen out at that size and says
 * whether it fits). When even `min` doesn't fit, `min`: the screen then
 * scrolls rather than going smaller than the room can read.
 *
 * @param {{ min: number, max: number, fits: (size: number) => boolean }} opts
 */
export function fitSize({ min, max, fits }) {
  let lo = Math.ceil(min);
  let hi = Math.floor(max);
  if (hi < lo) return lo;
  if (fits(hi)) return hi;
  if (!fits(lo)) return lo;
  // fits(lo) is true and fits(hi) false: narrow the gap between them.
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/* ── The two windows ─────────────────────────────────────────────────── */

/** The channel the presentation and the presenter view share, one per sheet. */
export const channelName = (sheetId) => `lit-present:${sheetId}`;

/**
 * A message from the other window, checked: { type: "state", state, from, role },
 * { type: "hello", from, role } (a window that just opened asks where the
 * room is, and says which window it is, so a presenter view hearing the
 * presentation's hello knows it is open; BA84), or { type: "bye", from, role }
 * (a window closing); anything else is null. `role` is "presenter" or, unless
 * the message says so, "stage". `state` still goes through checkState before
 * it is used.
 */
export function presentMessage(data) {
  if (!data || typeof data !== "object" || data.v !== MESSAGE_VERSION) return null;
  const from = typeof data.from === "string" ? data.from : null;
  if (!from) return null;
  const role = data.role === "presenter" ? "presenter" : "stage";
  if (data.type === "hello") return { type: "hello", from, role };
  if (data.type === "bye") return { type: "bye", from, role };
  if (data.type === "state" && data.state && typeof data.state === "object") {
    return { type: "state", from, state: data.state, role };
  }
  return null;
}

/** A message to send: the same shape presentMessage reads. */
export function makeMessage(type, from, fields = {}) {
  return { v: MESSAGE_VERSION, type, from, ...fields };
}

/** Time since the presentation began, as a clock: "4:05", "1:02:09". */
export function clockWords(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The line under the key terms screen while some of its terms wait on the reveal. */
export function hiddenTermsNote(n) {
  if (!n) return "";
  return n === 1 ? "One term is left blank until it is revealed." : `${n} terms are left blank until they are revealed.`;
}

/** "Screen 3 of 8", as the presenter view and the announcement say it. */
export const screenCount = (i, total) => `Screen ${i + 1} of ${total}`;
