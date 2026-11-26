// src/scripts/desk/account/header-entry.js
//
// The header's way into an account (the plan's step 4h; BVJ, 2026-11-24):
// “Sign in” at the end of the header's tools, and, once this browser's
// notebook is linked to an account, a small account button whose menu holds
// the sync's status, “Account and devices,” and “Sign out.”
//
// desk-gate.js loads this only on a computer with the Study Desk on and with
// accounts opened in this browser. It is one small read (does the notebook
// carry a link?) and a disclosure. It brings no encryption and starts no
// sync: test/desk-sync-gate.test.js holds what it may import.
//
// The status in the menu is the status line's own slot
// (`data-desk-sync-slot`; ../sync/status-line.js), which a page that syncs
// fills by itself, with “Reconnect” where there is something to try. So on a
// page that runs no connector (About, say) the menu holds its two links
// alone. The dot on the button while the sync is stopped is
// ../sync/stopped-notice.js's, drawn by desk-sync.css.
//
// “Sign out” is a link to the account page, which asks first and says the
// notebook stays in this browser: one place signs out.
//
// THE ENTRY IS AS WIDE AS WHAT IT SHOWS (E231; BVJ, 2026-11-25: with the
// button holding “Sign in”'s width there was a gap beside it, and “the rest
// of the header scoots over to stay next to it”). The button is narrower than
// the words, and which of the two a browser gets is read from the notebook,
// after the page has painted. So this module leaves a note of what it showed
// (LAST_KEY, in local storage), Layout.astro's pre-paint script stamps it on
// <html> (LAST_ATTR), and global.css holds the button's room from the first
// paint where it says “in.” Nothing beside the entry moves on a page load,
// in either case. The note is only that: what shows always comes from the
// notebook. Where the two differ (another tab linked this browser, or signed
// it out), the tools move once, the note is put right, and TOOLS_EVENT has
// the header's title fitted again, since the room for it changed.
//
// The menu is a disclosure, as the header's Learn, Study, and About are
// (src/scripts/header-menus.js): a button with aria-expanded over plain links
// and at most one button. Arrow Down or Up on the button opens it at its
// first or last item, the arrows, Home, and End move among them, Escape closes
// it and returns to the button, and a press elsewhere or Tab out closes it.

import { SLOT_EVENT, peekLink } from "../../../lib/desk-sync-link.mjs";
import { setTip } from "../../tip.js";

/** What the header showed in this browser last: "in" while its notebook is linked to an account; absent otherwise. */
export const LAST_KEY = "lit-desk-account-last";

/** The same on `<html>`, stamped before paint by Layout.astro, which repeats the key since it can't import. */
export const LAST_ATTR = "data-account-last";

/** Sent on `document` when the header's tools changed width after they were painted (SiteHeader.astro's title script hears it). */
export const TOOLS_EVENT = "lit:header-tools";

function ownStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage is blocked: no note, and the tools move once on each page
  }
}

const parts = (entry) => ({
  link: entry.querySelector("[data-account-signin]"),
  button: entry.querySelector("[data-account-button]"),
  menu: entry.querySelector("[data-account-menu]"),
});

/** What the arrows move among: the menu's links and buttons that show and can be used. */
const itemsOf = (menu) => [...menu.querySelectorAll("a, button")].filter((el) => el.closest("[hidden]") == null && el.getAttribute("aria-disabled") !== "true");

/** The entries whose menu is wired: once each, however often they are drawn. */
const wired = new WeakSet();

/**
 * Draws each entry for this browser, and wires the menu where there is one.
 * It can be called again: the account page does when it opens accounts in a
 * browser for the first time (no stamp before paint, so desk-gate.js never
 * called this), and when it links the browser or stops syncing in it.
 *
 * @param {{ doc?: Document, idb?: IDBFactory, storage?: Storage | null }} [env]
 * @returns {Promise<"in" | "out" | null>} which the header shows; null where the page has no entry
 */
export async function start({ doc = globalThis.document, idb = globalThis.indexedDB, storage = ownStorage() } = {}) {
  const entries = [...doc.querySelectorAll("[data-account-entry]")];
  if (!entries.length) return null;
  let linked = false;
  try {
    linked = idb ? (await peekLink({ idb })) != null : false;
  } catch {
    linked = false; // no notebook to read: “Sign in”
  }

  const root = doc.documentElement;
  const now = linked ? "in" : "out";
  // What an entry not yet drawn has held room for since the first paint (global.css).
  const stamped = root.getAttribute(LAST_ATTR) === "in" ? "in" : "out";
  let moved = false;
  for (const entry of entries) {
    const { link, button, menu } = parts(entry);
    if ((entry.getAttribute("data-account-state") ?? stamped) !== now) moved = true;
    if (linked && link && button) {
      link.hidden = true;
      button.hidden = false;
      setTip(button, "Account");
    } else if (link && button) {
      // Signed out of a browser that was linked when the page drew: the words again, and the menu shut.
      link.hidden = false;
      button.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
    }
    entry.setAttribute("data-account-state", now);
  }

  // The note for the next page's first paint, and the stamp kept in step with it.
  try {
    if (linked) storage?.setItem(LAST_KEY, "in");
    else storage?.removeItem(LAST_KEY);
  } catch {
    /* storage is full or blocked: the next page moves its tools once */
  }
  if (linked) root.setAttribute(LAST_ATTR, "in");
  else root.removeAttribute(LAST_ATTR);
  if (moved) doc.dispatchEvent(new CustomEvent(TOOLS_EVENT));
  const fresh = linked ? entries.filter((entry) => !wired.has(entry)) : [];
  if (fresh.length) {
    for (const entry of fresh) wired.add(entry);
    wire(fresh, doc);
  }
  return linked ? "in" : "out";
}

function wire(entries, doc) {
  let open = null;

  function close({ focus = false } = {}) {
    if (!open) return;
    const { button, menu } = parts(open);
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    open = null;
    if (focus) button.focus();
  }

  function show(entry, at) {
    if (open !== entry) close();
    const { button, menu } = parts(entry);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    open = entry;
    // The status line fills its slot when the page says one is showing (a page that syncs; elsewhere nothing hears this).
    doc.dispatchEvent(new CustomEvent(SLOT_EVENT));
    const items = itemsOf(menu);
    if (at === "first") items[0]?.focus();
    else if (at === "last") items.at(-1)?.focus();
  }

  for (const entry of entries) {
    const { button, menu } = parts(entry);
    if (!button || !menu) continue;

    button.addEventListener("click", () => {
      if (open === entry) close();
      else show(entry);
    });

    button.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        show(entry, "first");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        show(entry, "last");
      }
    });

    menu.addEventListener("keydown", (e) => {
      const items = itemsOf(menu);
      if (!items.length) return;
      const i = items.indexOf(doc.activeElement);
      let next = null;
      if (e.key === "ArrowDown") next = items[(i + 1) % items.length];
      else if (e.key === "ArrowUp") next = items[(i - 1 + items.length) % items.length];
      else if (e.key === "Home") next = items[0];
      else if (e.key === "End") next = items.at(-1);
      if (!next) return;
      e.preventDefault();
      next.focus();
    });

    entry.addEventListener("focusout", (e) => {
      if (open === entry && e.relatedTarget && !entry.contains(e.relatedTarget)) close();
    });
  }

  doc.addEventListener("click", (e) => {
    if (open && !open.contains(e.target)) close();
  });
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) close({ focus: open.contains(doc.activeElement) });
  });
}
