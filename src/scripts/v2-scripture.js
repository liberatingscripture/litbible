// Site 2.0's scripture pages (SITE-2.0.md): on a phone the toolbar row (the
// passage picker and search) stays at the top of the window over the text,
// slides away on a scroll down and comes back on any scroll up (BVJ,
// 2026-11-16). It never goes while its search or the picker is open or holds
// focus. v2/scripture.css draws the states; this only names them, on the row
// as data-v2-bar ("afloat", "away"). It does nothing without the restyle's
// stamp, so ScriptureLayout loads it always.

/**
 * The row's state after a scroll. `y` and `lastY` are the window's scroll
 * position now and before; `home` is the scroll position at which the row
 * reaches the top of the window (its own place in the page); `away` is
 * whether it was slid away; `held` is true while its search or the picker is
 * open or focus is in it. Afloat means the row has left its place and sits
 * over the text; only then can it go away.
 *
 * @param {{ y: number, lastY: number, home: number, away: boolean, held: boolean }} s
 * @returns {{ afloat: boolean, away: boolean }}
 */
export function barState({ y, lastY, home, away, held }) {
  const afloat = y > home;
  if (!afloat || held) return { afloat, away: false };
  if (y > lastY) return { afloat, away: true };
  if (y < lastY) return { afloat, away: false };
  return { afloat, away };
}

/** The attribute's value for a state: "afloat", "away afloat", or "". */
export function barValue({ afloat, away }) {
  return [away && afloat ? "away" : "", afloat ? "afloat" : ""].filter(Boolean).join(" ");
}

function init() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-restyle")) return;
  const row = document.querySelector(".scripture-layout .scripture-tools[data-compact]");
  if (!row) return;
  const phone = window.matchMedia("(max-width: 640px)");
  const ATTR = "data-v2-bar";
  let lastY = window.scrollY;
  let state = { afloat: false, away: false };

  const held = () =>
    row.hasAttribute("data-search-open") ||
    row.contains(document.activeElement) ||
    Boolean(row.querySelector('[aria-expanded="true"]'));

  const update = () => {
    const y = window.scrollY;
    if (!phone.matches) {
      lastY = y;
      state = { afloat: false, away: false };
      row.removeAttribute(ATTR);
      return;
    }
    // The row is the layout's first child: the layout's top is its place.
    const home = row.parentElement.getBoundingClientRect().top + y;
    state = barState({ y, lastY, home, away: state.away, held: held() });
    lastY = y;
    const value = barValue(state);
    if (value) row.setAttribute(ATTR, value);
    else row.removeAttribute(ATTR);
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  // Focus coming into the row (a keyboard's Tab) brings it back.
  row.addEventListener("focusin", update);
  row.addEventListener("click", update);
  update();
}

if (typeof document !== "undefined") init();
