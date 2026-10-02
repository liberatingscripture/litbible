// src/lib/lit-credit.mjs
//
// The attribution notice the LIT's license terms ask anyone quoting the text
// to carry (/read, the notice item under both "Noncommercial use" and
// "Quoting the LIT in a commercial work"). One copy, because three places print it: those terms themselves,
// the credit line on a printed page (PrintCredit.astro), and "Copy for a
// handout" in the verse menu (src/scripts/chapter-tools.js). It sits in
// src/lib/ because both the build and the client import it, the same
// arrangement as bracket-markers.mjs.

export const LIT_CREDIT_LINE =
  "Scripture and footnote quotations are from the LIT Bible (litbible.net), used by permission under CC BY-NC-ND 4.0.";

/**
 * A page's address as it should read on paper: no scheme, no trailing slash
 * ("litbible.net/john-3"). A reader types it, and the slashless form still
 * lands on the page.
 * @param {string} url an absolute URL
 */
export function printableUrl(url) {
  return String(url ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/(?=$|[?#])/, "");
}
