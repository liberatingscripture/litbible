// src/scripts/sheet-share-gate.js
//
// A shared sheet's link opened where the Study Desk doesn't run (STUDY-DESK.md,
// S8: "a phone or tablet is told to open it on a computer"; decision 4,
// computers only for now). The inline script on /sheets/ has already moved the
// link's fragment into this tab's history entry (history.state.litSharedSheet).
// Where the desk is on, sheet-page.js shows the sheet and this does nothing.
// Elsewhere it replaces the page's "preview isn't switched on" line with what
// to do: on a phone or tablet, send the link to a computer (a button copies
// it, since the address bar no longer shows it); on a computer without the
// preview, a link that switches the preview on and opens the sheet. Both
// rebuild the link from the history entry, so the fragment still never reaches
// a server.

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
    p.textContent =
      "Someone shared a sheet with you. Sheets open on a computer, so send yourself this link and open it there.";
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
        status.textContent = " Your browser didn’t allow the copy.";
      }
    });
    const row = document.createElement("p");
    row.append(copy, status);
    off?.replaceWith(p);
    p.after(row);
  } else {
    const on = document.createElement("a");
    on.href = `${location.pathname}?desk=on#${shared}`;
    on.textContent = "Switch the preview on and open the sheet";
    p.append(
      document.createTextNode("Someone shared a sheet with you. Sheets are part of a preview of new study tools, which isn’t switched on in this browser. "),
      on,
      document.createTextNode("."),
    );
    off?.replaceWith(p);
  }
}
