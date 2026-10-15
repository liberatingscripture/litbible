// src/scripts/desk/release-notes-filter.js
//
// The "Verses in my notebook" filter on /release-notes (STUDY-DESK.md M10,
// phase 2a): one checkbox, beside the page's Book and Kind of change menus,
// that keeps the changes touching a verse the reader has marked. desk-gate.js
// loads this only when <html data-desk="on"> and the page carries
// [data-release-notes], so a reader without the preview downloads none of it
// and sees the page exactly as before.
//
// The page's own script (src/scripts/release-notes.js) knows nothing of the
// notebook. It only honours any `input[data-rn-flag="x"]` in its form: when
// checked, a change shows only if its row carries `data-rn-x`. This file
// reads the notebook (read-only, never creating it: readonly-notebook.js),
// puts that attribute on the rows that match, and adds the checkbox. Rows
// are matched to the feed by their entry's id and place in it (written at
// build as the entry's id and `data-index`), and by type, so a page and a
// feed from different publishes can't mislabel a row.
//
// A reader with nothing marked on a verse is shown no checkbox at all.

import { entryIds } from "../../lib/release-notes-view.mjs";
import { changeKey, hasVerseMarks, notebookChangeKeys } from "../../lib/desk-whats-new-view.mjs";
import { addDeskStyle } from "./boot.js";
import { loadReleaseNotes } from "./release-feed.js";
import { readRecords } from "./readonly-notebook.js";

async function start() {
  const form = document.getElementById("rn-filters");
  if (!form) return;

  const records = await readRecords();
  if (!hasVerseMarks(records)) return;
  const entries = await loadReleaseNotes();
  if (!entries) return;

  const keys = notebookChangeKeys(entries, records, entryIds(entries));
  for (const entry of document.querySelectorAll(".rn-entry")) {
    for (const change of entry.querySelectorAll(".rn-change")) {
      if (keys.has(changeKey(entry.id, change.dataset.index, change.dataset.type))) {
        change.setAttribute("data-rn-notebook", "");
      }
    }
  }

  addDeskStyle();
  const label = document.createElement("label");
  label.className = "rn-filter rn-filter--check";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.rnFlag = "notebook";
  label.append(box, document.createTextNode("Verses in my notebook"));
  form.insertBefore(label, form.querySelector("#rn-count"));
}

start();
