// src/scripts/phone-bars.js
//
// The phone's two bars on a reading page, a chapter or a book's introduction
// (SITE-FEATHERBOA.md, "The phone"): the header's reading row at the top
// (SiteHeader.astro: the emblem, the chapter's name as the picker, and Aa)
// and the bar at the thumb (PhoneBar.astro: Previous, Search, Menu, Next).
// Without JavaScript the bar is four links and never hides (PH-26). This
// adds, under 700px:
//
// - Search opens the page's search field in place of the top row (PH-09):
//   the toolbar's SearchBar, the page's only one, is moved into the row while
//   it is open and put back after. Its close button, or Escape once the
//   results are closed, puts it back and returns focus to Search.
// - Both bars hide together on a scroll down and come back on any scroll up
//   (PH-05), by src/lib/phone-bars.mjs's rule, written on <html> as
//   data-bars, which header.css turns into the bars' movement. Neither hides
//   while search, the picker, the Display tray, or the menu is open, or while
//   a keyboard's focus is in either, and nothing hides before the reader
//   first scrolls, touches, clicks, or types, so a link to a verse arrives
//   with both bars showing.
//
// Menu is header-menus.js's: it opens the menu sheet from any
// [data-menu-toggle]. It runs once as the page loads; test/phone-bars.test.js
// calls start() with its own page and window.

import { PHONE_QUERY, barValue, scrolled } from "../lib/phone-bars.mjs";
import { asButton } from "./link-button.js";

/**
 * Wires the bars of the page in `doc`.
 *
 * @param {{ doc?: Document, win?: Window }} [env]
 * @returns {() => void} takes the listeners away again (a test's next page)
 */
export function start({ doc = globalThis.document, win = globalThis.window } = {}) {
  const bar = doc?.querySelector("[data-phone-bar]");
  const row = doc?.querySelector(".site-header--reading");
  if (!bar || !row) return () => {};

  const page = new AbortController();
  const { signal } = page;
  const root = doc.documentElement;
  const phone = win.matchMedia?.(PHONE_QUERY) ?? { matches: false };

  // ---------- Search, in place of the top row (PH-09) ----------

  const find = row.querySelector("[data-phone-find]");
  const searchbar = doc.querySelector(".scripture-tools [data-searchbar]");
  const link = bar.querySelector("[data-bar-search]");
  const searchOpen = () => row.hasAttribute("data-search-open");
  let search = null;
  let origin = null;

  function openSearch() {
    if (searchOpen()) return;
    origin = { parent: searchbar.parentNode, next: searchbar.nextSibling };
    find.prepend(searchbar);
    find.hidden = false;
    row.setAttribute("data-search-open", "");
    search.setAttribute("aria-expanded", "true");
    draw();
    searchbar.querySelector("input[type='search']")?.focus({ preventScroll: true });
  }

  function closeSearch({ focus = true } = {}) {
    if (!searchOpen()) return;
    // The results close the way their own close button closes them
    // (searchbar.js), so its suggestion and tips go with them.
    const shut = searchbar.querySelector(".searchbar__close");
    if (shut) shut.click();
    else searchbar.dataset.open = "false";
    // Focus goes back before the field moves, so it is never lost with it.
    if (focus) search.focus({ preventScroll: true });
    origin.parent.insertBefore(searchbar, origin.next?.parentNode === origin.parent ? origin.next : null);
    find.hidden = true;
    row.removeAttribute("data-search-open");
    search.setAttribute("aria-expanded", "false");
    draw();
  }

  if (find && searchbar && link) {
    search = asButton(link, find.id);
    search.addEventListener(
      "click",
      (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        searchOpen() ? closeSearch() : openSearch();
      },
      { signal },
    );
    find.querySelector("[data-phone-find-close]")?.addEventListener("click", () => closeSearch(), { signal });
    // Capture, so this sees the results' state before searchbar.js closes
    // them: Escape closes the results first, then the field.
    find.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || searchbar.dataset.open === "true") return;
        event.preventDefault();
        closeSearch();
      },
      { capture: true, signal },
    );
  }

  // ---------- Hiding together (PH-05) ----------

  const main = doc.getElementById("main-content");
  let engaged = false;
  let state = { afloat: false, away: false, mark: 0 };
  let queued = false;

  /** Where the row's own place in the page ends: the top of the page's
   *  main content, below the app banner and the row. Measured at every
   *  draw, since the banner can leave at any time. */
  const home = () => (main ? main.getBoundingClientRect().top + win.scrollY : row.offsetHeight);

  /** The scroll position, held inside the page, so the bounce past either
   *  end of it is no scroll at all. */
  const position = () => {
    const max = Math.max(0, root.scrollHeight - win.innerHeight);
    return Math.min(Math.max(win.scrollY, 0), max);
  };

  const keyboardIn = (el) => {
    const active = doc.activeElement;
    if (!active || !el.contains(active)) return false;
    try {
      return active.matches(":focus-visible");
    } catch {
      return true;
    }
  };

  const held = () =>
    !engaged ||
    searchOpen() ||
    row.querySelector('[aria-expanded="true"]') !== null ||
    bar.querySelector('[aria-expanded="true"]') !== null ||
    keyboardIn(row) ||
    keyboardIn(bar);

  function draw() {
    if (!phone.matches) {
      state = { afloat: false, away: false, mark: position() };
      root.removeAttribute("data-bars");
      return;
    }
    state = scrolled({ y: position(), mark: state.mark, home: home(), away: state.away, held: held() });
    const value = barValue(state);
    if (value) root.setAttribute("data-bars", value);
    else root.removeAttribute("data-bars");
  }

  const soon = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  };

  for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
    win.addEventListener(type, () => (engaged = true), { capture: true, passive: true, signal });
  }
  win.addEventListener("scroll", soon, { passive: true, signal });
  win.addEventListener("resize", soon, { passive: true, signal });
  for (const el of [row, bar]) {
    el.addEventListener("focusin", draw, { signal });
    el.addEventListener("click", soon, { signal });
  }
  phone.addEventListener?.(
    "change",
    () => {
      if (!phone.matches) closeSearch({ focus: false });
      draw();
    },
    { signal },
  );

  state.mark = position();
  draw();

  return () => {
    page.abort();
    root.removeAttribute("data-bars");
  };
}

start();
