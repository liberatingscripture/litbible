// src/scripts/place-line.js
//
// Search on the place line (PlaceLine.astro; SITE-FEATHERBOA.md, "Search on
// a reading page"; FP-27, FP-28, FP-30): "Search" opens the page's one
// search field in place of the line, reading "Search the LIT, or go to a
// passage," its results dropping below. Its ×, or Escape once the results
// are closed, closes it and gives focus back to Search; `/` presses Search
// (keyboard-shortcuts.js). Without JavaScript Search is a link to /search.
// Under 700px the line isn't drawn, and the phone's top row borrows the same
// field (phone-bars.js), so the search closes here when the window narrows.
//
// It also gives the line's icon-only controls (‹ › and ×) the shared
// tooltip. It runs once as the page loads; test/featherboa-picker.test.js
// calls start() with its own page.

import { asButton } from "./link-button.js";
import { setTip } from "./tip.js";

const PHONE_QUERY = "(max-width: 699px)";

/**
 * Wires the place line of the page in `doc`.
 *
 * @param {{ doc?: Document, win?: Window }} [env]
 * @returns {() => void} takes the listeners away again (a test's next page)
 */
export function start({ doc = globalThis.document, win = globalThis.window } = {}) {
  const line = doc?.querySelector("[data-place-line]");
  const link = line?.querySelector("[data-line-search]");
  const find = line?.querySelector("[data-line-find]");
  if (!line || !link || !find) return () => {};

  const page = new AbortController();
  const { signal } = page;
  const phone = win.matchMedia?.(PHONE_QUERY) ?? { matches: false };

  for (const el of line.querySelectorAll(".kit-icon[aria-label]")) setTip(el, el.getAttribute("aria-label"));

  const search = asButton(link, find.id);
  const isOpen = () => line.hasAttribute("data-search-open");
  // The field is the page's one SearchBar, which the phone's row may be
  // holding; it is looked for each time.
  const searchbar = () => find.querySelector("[data-searchbar]");

  function open() {
    const bar = searchbar();
    if (isOpen() || !bar) return;
    find.hidden = false;
    line.setAttribute("data-search-open", "");
    search.setAttribute("aria-expanded", "true");
    bar.querySelector("input[type='search']")?.focus({ preventScroll: true });
  }

  function close({ focus = true } = {}) {
    if (!isOpen()) return;
    // The results close the way their own close button closes them
    // (searchbar.js), so its suggestion and tips go with them.
    const bar = searchbar();
    const shut = bar?.querySelector(".searchbar__close");
    if (shut) shut.click();
    else if (bar) bar.dataset.open = "false";
    find.hidden = true;
    line.removeAttribute("data-search-open");
    search.setAttribute("aria-expanded", "false");
    if (focus) search.focus({ preventScroll: true });
  }

  search.addEventListener(
    "click",
    (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      isOpen() ? close() : open();
    },
    { signal },
  );
  find.querySelector("[data-line-find-close]")?.addEventListener("click", () => close(), { signal });
  // Capture, so this sees the results' state before searchbar.js closes
  // them: Escape closes the results first, then the field.
  find.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || searchbar()?.dataset.open === "true") return;
      event.preventDefault();
      close();
    },
    { capture: true, signal },
  );
  phone.addEventListener?.("change", () => phone.matches && close({ focus: false }), { signal });

  return () => page.abort();
}

start();
