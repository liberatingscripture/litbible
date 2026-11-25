// src/scripts/account-gate.js
//
// The account pages' gate (the plan's step 4h). /account/, /account/connect/
// and /delete-account/ load this file and nothing else of the account: the
// page's code (./desk/account/page.js) is a dynamic import, made only where
// accounts are open in this browser or the Study Desk is on, so no other
// reader downloads it.
//
// ACCOUNTS ARE CLOSED FOR EVERYONE UNTIL LAUNCH (BVJ, 2026-11-24). One
// browser opens them with ?account=preview, and ?account=off closes them
// again; ?account=local points a page served from this computer at
// `wrangler dev`. The choice is one local storage value, named on /privacy,
// and it retires at launch as lit-desk-preview does. A browser whose
// notebook is already linked to an account uses its link, whatever this says
// (page.js reads that).
//
// THE PARAMETER WORKS ON EVERY PAGE, as ?desk= does: Layout.astro's
// pre-paint script reads it first, stores the choice, and takes it out of
// the address, so by the time this file runs there is usually nothing left
// in the address to read. readSwitch still reads it, for a page that runs
// without that script and for a value the script doesn't know, which is
// taken out of the address here and stores nothing.
//
// The key and the values are src/lib/desk-account-words.mjs's (SWITCH_KEY,
// SWITCH_VALUES), repeated here because shared reader code never imports a
// desk module statically; test/desk-account-page.test.js holds the two
// together.

const KEY = "lit-desk-account";
const VALUES = ["preview", "local"];

/** Reads `?account=` into storage, takes it out of the address, and returns the stored choice ("preview", "local", or null). */
export function readSwitch(win = window) {
  let stored = null;
  try {
    const url = new URL(win.location.href);
    const asked = url.searchParams.get("account");
    if (asked === "off") win.localStorage.removeItem(KEY);
    else if (VALUES.includes(asked)) win.localStorage.setItem(KEY, asked);
    if (asked !== null) {
      url.searchParams.delete("account");
      win.history.replaceState(win.history.state, "", url.pathname + url.search + url.hash);
    }
    stored = win.localStorage.getItem(KEY);
  } catch {
    /* no storage, or no address to read: accounts stay closed */
  }
  return VALUES.includes(stored) ? stored : null;
}

const root = typeof document === "undefined" ? null : document.querySelector("[data-account-page]");
if (root) {
  const open = readSwitch();
  // Layout.astro stamped data-account before paint from what was stored then. Where the page
  // turns out closed (?account=off just now, a service this page may not reach, a page that
  // didn't load), the stamp comes off, so the page's own note shows again.
  const closed = () => document.documentElement.removeAttribute("data-account");
  if (open || document.documentElement.dataset.desk === "on") {
    import("./desk/account/page.js")
      .then((page) => page.start({ root, open }))
      .then((started) => {
        if (!started) closed();
      })
      .catch((err) => {
        console.error("LIT Bible account: the page didn't load", err);
        closed();
      });
  } else {
    closed();
  }
}
