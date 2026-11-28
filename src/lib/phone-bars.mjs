// src/lib/phone-bars.mjs
//
// The phone's two bars (SITE-FEATHERBOA.md, "The phone"): a reading page's
// one row at the top and its bar at the thumb hide together on a scroll down
// and come back on any scroll up, one rule for both, as Safari's own two
// bars do. Pure: numbers in, the bars' state out. src/scripts/phone-bars.js
// reads the page and writes the state on <html> as data-bars, which
// header.css turns into the bars' movement; test/phone-bars.test.js holds
// the rule.

/** The phone is under 700 ("Sizes, space, and the measure"). */
export const PHONE_QUERY = "(max-width: 699px)";

/**
 * How far the page must move one way, in pixels, before the bars answer. A
 * thumb resting on the glass, an image or a font settling the page, and the
 * browser's own toolbar coming and going all move the page a few pixels,
 * and the bars should not flicker with them. Eight is under a line of text,
 * so any scroll a reader means still counts.
 */
export const NUDGE = 8;

/**
 * The rule (Site 2.0's, kept; FEATHERBOA-LEDGER.md, "Phase 3: the phone's
 * bars"). y and lastY: the scroll position now and before; home: the scroll
 * position at which the bars leave their own place in the page (the top
 * row's foot); away: whether they were hidden; held: true while search, the
 * picker, the Display tray, or the menu is open, or a keyboard's focus is in
 * either bar.
 *
 * @param {{ y: number, lastY: number, home: number, away: boolean, held: boolean }} s
 * @returns {{ afloat: boolean, away: boolean }}
 */
export function barState({ y, lastY, home, away, held }) {
  const afloat = y > home;
  if (!afloat || held) return { afloat, away: false };
  if (y > lastY) return { afloat, away: true }; // scrolling down: hide
  if (y < lastY) return { afloat, away: false }; // any scroll up: return
  return { afloat, away };
}

/**
 * The attribute's value: "away afloat" (hidden), "afloat" (shown over the
 * text), or "" (in their own place at the top of the page).
 *
 * @param {{ afloat: boolean, away: boolean }} s
 */
export function barValue({ afloat, away }) {
  return [away && afloat ? "away" : "", afloat ? "afloat" : ""].filter(Boolean).join(" ");
}

/**
 * One scroll, with the nudge: the bars' state, and the point to measure the
 * next scroll from. `mark` is where the bars last answered, kept at the
 * furthest the page has gone since in the way they answered (the lowest
 * point while they are away, the highest while they show), so a slow scroll
 * still adds up to the nudge, and a jitter under it either way changes
 * nothing.
 *
 * @param {{ y: number, mark: number, home: number, away: boolean, held: boolean, nudge?: number }} s
 * @returns {{ afloat: boolean, away: boolean, mark: number }}
 */
export function scrolled({ y, mark, home, away, held, nudge = NUDGE }) {
  if (y > home && !held && Math.abs(y - mark) < nudge) {
    return { afloat: true, away, mark: away ? Math.max(mark, y) : Math.min(mark, y) };
  }
  return { ...barState({ y, lastY: mark, home, away, held }), mark: y };
}
