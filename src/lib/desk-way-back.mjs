// src/lib/desk-way-back.mjs
//
// A LIT pane's way back after a jump on /desk (STUDY-DESK-FIXES.md, E168;
// BVJ, 2026-11-19, choosing Fable's design). Pure, so its rules are tested
// without a pane; `desk/lit-back.js` draws the button and `desk/lit-pane.js`
// tells it each move.
//
// - **A jump** is a move the reader asked for from somewhere else: a Search
//   pane result, a record's reference in My Notes, a scripture reference in a
//   Book Intro or a footnote, or a place typed or chosen in a picker. It keeps
//   where the pane was, so the bar can offer “← John 3:16.”
// - **Any other move** is reading on: the reader's own scrolling, the chapter
//   arrows and the keys that press them, the panes that lead back (This verse's
//   Previous and Next, the Greek's scrolling), a layout put back. It never
//   makes a way back, **and never takes one away** (BVJ, 2026-11-19, during
//   the build: “Scrolling shouldn't automatically clear the history of
//   jumps.”). It only ends a run of jumps, so the next jump keeps the place
//   the reader read on to, above the ones before it.
// - **A run of jumps with no reading between** keeps only the place before the
//   first, so clicking through several results goes back to where the reader
//   was before them, not to each result in turn.
// - **The places are a history**: Back goes to the newest, and the button then
//   names the one before it, until none is left (no Forward). At most
//   `MAX_BACK` are kept.
// - **Reaching the newest place** by any route takes it off, since the pane is
//   there.
//
// A state is `{ places, chained }`: `places` the history, oldest first, and
// `chained` that the last move was a jump. It is kept in memory for the visit
// only; nothing is stored.

/** How many places back a pane keeps. */
export const MAX_BACK = 20;

/** Whether two passages name the same place: the book, the chapter and the verse. */
export function samePlace(a, b) {
  return Boolean(a && b && a.bookKey === b.bookKey && a.chapter === b.chapter && (a.verse ?? null) === (b.verse ?? null));
}

/** A pane before any jump: nothing to go back to, and no jump running. */
export const NO_WAY_BACK = Object.freeze({ places: Object.freeze([]), chained: false });

/** The place Back goes to now, or null. */
export function backPlace(state) {
  return state.places.at(-1) ?? null;
}

/** The history less a newest place equal to `to`, where the pane now is. */
function without(places, to) {
  return samePlace(places.at(-1), to) ? places.slice(0, -1) : places;
}

/**
 * The pane jumped from `from` to `to`. Where the reader was goes on the
 * history, unless they never read there (the last move was a jump too, and
 * the history already holds the place before it).
 * @param {{ places: object[], chained: boolean }} state
 * @param {object | null} from  where the pane was, or null when it had no place yet
 * @param {object} to
 */
export function afterJump(state, from, to) {
  let places = state.places;
  const keep = from && (!state.chained || !places.length) && !samePlace(places.at(-1), from);
  if (keep) places = [...places, from].slice(-MAX_BACK);
  return { places: without(places, to), chained: true };
}

/**
 * The pane reached `to` any other way. The history stays (the reader may read
 * on at a result before going back), less its newest place if `to` is that.
 * @param {{ places: object[], chained: boolean }} state
 * @param {object} to
 */
export function afterMove(state, to) {
  return { places: without(state.places, to), chained: false };
}

/**
 * Back is pressed: the newest place, and the state once the pane is there.
 * @param {{ places: object[], chained: boolean }} state
 * @returns {{ place: object | null, state: { places: object[], chained: boolean } }}
 */
export function goBack(state) {
  const place = backPlace(state);
  return { place, state: { places: place ? state.places.slice(0, -1) : state.places, chained: false } };
}
