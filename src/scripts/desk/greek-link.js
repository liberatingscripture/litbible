// src/scripts/desk/greek-link.js
//
// Where a Greek search result lands (STUDY-DESK.md, "Order of work", 1h,
// step 4). A result is the ordinary verse link with one parameter naming the
// word, `/john-3/?greek=16.7#v16` (greekHref in src/lib/greek-search.mjs).
// On a Study View chapter this opens the Notebook to the Greek tab at that
// word, opening the panel even if the reader closed it (they asked for the
// Greek; BVJ, 2026-10-13) and restoring it if minimized, then takes the
// parameter off the address, so what the reader keeps or shares is the plain
// verse link. A result for the chapter already on screen doesn't reload: the
// search box sends a cancelable `lit:greek-word` on `document` with
// { verse, t }, and follows its link only if nothing here took it.
//
// Without the Notebook (a phone or a tablet, or the preview off) none of this
// loads, and the parameter is ignored: the reader lands on the verse, as any
// verse link does.

import { parseGreekParam } from "../../lib/greek-search.mjs";

/** @param {{ panel: { showGreekWord: ((verse: number, t: number) => Promise<void>) | null } }} options */
export function initGreekLink({ panel }) {
  const show = panel.showGreekWord;
  const url = new URL(window.location.href);
  const word = parseGreekParam(url.searchParams.get("greek"));
  if (url.searchParams.has("greek")) {
    url.searchParams.delete("greek");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  if (!show) return;
  if (word) show(word.verse, word.t);
  document.addEventListener("lit:greek-word", (e) => {
    const { verse, t } = e.detail ?? {};
    if (!Number.isInteger(verse) || !Number.isInteger(t)) return;
    // Tells the sender the word was shown, so it keeps its link from loading.
    e.preventDefault();
    show(verse, t);
  });
}
