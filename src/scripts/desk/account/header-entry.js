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
// The menu is a disclosure, as the header's Learn, Study, and About are
// (src/scripts/header-menus.js): a button with aria-expanded over plain links
// and at most one button. Arrow Down or Up on the button opens it at its
// first or last item, the arrows, Home, and End move among them, Escape closes
// it and returns to the button, and a press elsewhere or Tab out closes it.

import { SLOT_EVENT, peekLink } from "../../../lib/desk-sync-link.mjs";
import { setTip } from "../../tip.js";

const parts = (entry) => ({
  link: entry.querySelector("[data-account-signin]"),
  button: entry.querySelector("[data-account-button]"),
  menu: entry.querySelector("[data-account-menu]"),
});

/** What the arrows move among: the menu's links and buttons that show and can be used. */
const itemsOf = (menu) => [...menu.querySelectorAll("a, button")].filter((el) => el.closest("[hidden]") == null && el.getAttribute("aria-disabled") !== "true");

/**
 * Draws each entry for this browser, and wires the menu where there is one.
 *
 * @param {{ doc?: Document, idb?: IDBFactory }} [env]
 * @returns {Promise<"in" | "out" | null>} which the header shows; null where the page has no entry
 */
export async function start({ doc = globalThis.document, idb = globalThis.indexedDB } = {}) {
  const entries = [...doc.querySelectorAll("[data-account-entry]")];
  if (!entries.length) return null;
  let linked = false;
  try {
    linked = idb ? (await peekLink({ idb })) != null : false;
  } catch {
    linked = false; // no notebook to read: “Sign in”
  }

  for (const entry of entries) {
    const { link, button } = parts(entry);
    if (linked && link && button) {
      // The button is narrower than the words. The entry keeps their width, so the tools beside it stay where they were painted.
      const width = entry.getBoundingClientRect?.().width ?? 0;
      if (width) entry.style.minWidth = `${Math.ceil(width)}px`;
      link.hidden = true;
      button.hidden = false;
      setTip(button, "Account");
    }
    entry.setAttribute("data-account-state", linked ? "in" : "out");
  }
  if (linked) wire(entries, doc);
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
