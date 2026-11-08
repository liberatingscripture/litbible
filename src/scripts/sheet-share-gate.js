// src/scripts/sheet-share-gate.js
//
// A shared sheet's link opened where the Study Desk doesn't run (STUDY-DESK.md,
// S8: "a phone or tablet is told to open it on a computer"; decision 4,
// computers only for now). The inline script on /sheets/ has already moved the
// link's fragment into this tab's history entry (history.state.litSharedSheet).
// Where the desk is on, sheet-page.js shows the sheet and this does nothing.
// On a phone or tablet it shows the sheet to read, present, print and share,
// and nothing that saves (BVJ, 2026-11-08, Audit 6 NB6-8): a dynamic import of
// sheet-page.js's `showSharedOnPhone`, made only here, for a shared link, so
// no other page a phone opens downloads any of the desk. If that import fails
// (offline, an old page after a deploy), it says so and offers the link to
// copy (a button, since the address bar no longer shows it). On a computer
// without the preview it offers a link that switches the preview on and opens
// the sheet. Both rebuild the link from the history entry, so the fragment
// still never reaches a server.

import { isAppPlatform } from "../lib/app-platform.mjs";

const shared = history.state?.litSharedSheet;
const box = document.querySelector("[data-sheet-page]");

if (typeof shared === "string" && shared && box && document.documentElement.dataset.desk !== "on") {
  const link = `${location.origin}${location.pathname}#${shared}`;
  const off = box.querySelector(".sheets-page__off");
  const p = document.createElement("p");
  p.className = "sheets-page__off";
  const title = box.querySelector(".sheets-page__title");
  if (title) title.textContent = "A shared sheet";

  if (isAppPlatform(navigator)) {
    p.textContent = "Loading the sheet…";
    off?.replaceWith(p);
    import("./desk/sheets/sheet-page.js")
      .then((page) => page.showSharedOnPhone(box, shared))
      .catch((err) => {
        console.error("The shared sheet couldn't load", err);
        couldNotLoad();
      });
  } else {
    const on = document.createElement("a");
    on.href = `${location.pathname}?desk=on#${shared}`;
    on.textContent = "Switch the preview on and open the sheet";
    p.append(
      document.createTextNode("Someone shared a sheet with you. Sheets are part of the Study Desk preview, which isn’t switched on in this browser. "),
      on,
      document.createTextNode("."),
    );
    off?.replaceWith(p);
  }

  /** The phone's way out when the sheet's code didn't load: reload, or take the link elsewhere. */
  function couldNotLoad() {
    p.textContent = "The sheet couldn’t load. Check your connection and reload the page, or copy the link to open it later.";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "sheets-page__copy-link";
    copy.textContent = "Copy the link";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = " Copied.";
      } catch (_) {
        status.textContent = " Your browser didn’t allow the copy. Open the message that held this link again instead.";
      }
    });
    const row = document.createElement("p");
    row.append(copy, status);
    p.after(row);
  }
}
