// Audit 8 decision 11 (BVJ, 2026-11-10):
//   NB8-6  Hide my marks pressed twice keeps the first hide's memory
//   DK8    reading on /desk writes Continue reading (desk-last-read.js)

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";

const { setHideAll, getSetting, setSetting, allHidden } = await import("../src/scripts/desk/note-settings.js");
const { createDeskLastRead, LAST_READ_WAIT_MS } = await import("../src/scripts/desk/desk-last-read.js");
const { loadLastRead } = await import("../src/scripts/last-read.js");

test("NB8-6: hiding twice, with one switch turned back on, still restores everything the first hide saw on", () => {
  localStorage.clear();
  setSetting("notes", "on");
  setSetting("bookmarks", "on");
  setHideAll(true);
  assert.equal(allHidden(), true);
  setSetting("notes", "on"); // the reader turns one back on
  setHideAll(true);
  assert.equal(getSetting("notes"), "off");
  setHideAll(false);
  assert.equal(getSetting("notes"), "on");
  assert.equal(getSetting("bookmarks"), "on");
});

test("desk-last-read: writes the study record after the wait, never a draft", async () => {
  localStorage.clear();
  const events = [];
  window.addEventListener("lit:last-read", (e) => events.push(e.detail));
  const w = createDeskLastRead({ acts: [2] });
  w.note({ book: "acts", chapter: 2, verse: 4 });
  w.flush();
  assert.equal(loadLastRead(), null);
  w.note({ book: "john", chapter: 3, verse: 16 });
  await new Promise((r) => setTimeout(r, LAST_READ_WAIT_MS + 100));
  const r = loadLastRead();
  assert.equal(r.book, "john");
  assert.equal(r.chapter, 3);
  assert.equal(r.verse, 16);
  assert.equal(r.view, "study");
  assert.equal(events.length, 1);
  w.destroy();
});
