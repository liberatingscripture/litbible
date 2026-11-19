// A verse the LIT leaves out, in This verse (E157; BVJ, 2026-11-18, "3 and A").
// Asked for by name (a /desk pane's passage bar at Matthew 17:21), a gap gets a
// view of its own rather than being refused: its reference, "The LIT has no
// Matthew 17:21." where the words would be, "The SBLGNT has no Matthew 17:21."
// under Greek, the LIT's own note that explains the gap, and no My Notes. The
// note is found on the page beside the gap (`gapNote`), never listed by
// letter, so every published gap is opened here to prove it is found.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { settle } from "./helpers/browser-env.mjs";
import { prepareStudyParagraph } from "../src/lib/chapter-html.ts";
import { gapNote } from "../src/lib/desk-verse.mjs";
import { VERSE_GAPS } from "../src/data/verse-gaps.js";
import { bookKeyToLabel } from "../src/data/books.js";

// The real committed Greek files, served to the tab's fetches.
const publicRoot = new URL("../public/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").split("?")[0];
  const file = new URL(path, publicRoot);
  if (!path.startsWith("greek/") || !existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const { createVerseTab } = await import("../src/scripts/desk/tab-verse.js");

const chapterJson = (book, ch) =>
  JSON.parse(readFileSync(new URL(`../src/data/chapters/${book}-${ch}.json`, import.meta.url), "utf8"));
const greekJson = (book, ch) =>
  JSON.parse(readFileSync(new URL(`../public/greek/text/${book}-${ch}.json`, import.meta.url), "utf8"));

/** Every published gap as [book, chapter, verse]. */
const GAPS = Object.entries(VERSE_GAPS).flatMap(([book, chs]) =>
  Object.entries(chs).flatMap(([ch, vs]) => vs.map((v) => [book, Number(ch), v])),
);

/** The chapter as Chapter View renders it, footnote list included, and a This verse tab over it. */
function tabOn(book, ch) {
  const c = chapterJson(book, ch);
  const seen = new Set();
  const state = { currentVerse: null };
  const body = c.paragraphs.map((p) => `<div class="p">${prepareStudyParagraph(p, book, ch, seen, state)}</div>`).join("");
  const notes = c.footnotes
    .map((fn) => `<li id="${fn.id}"><div class="fn-body"><a href="#${fn.refId}" class="footnote-backlink">${fn.label}</a> <span>${fn.html}</span></div></li>`)
    .join("");
  document.body.innerHTML = `<div class="chapter-paragraphs">${body}</div><ol class="footnotes">${notes}</ol>`;
  const label = `${bookKeyToLabel(book)} ${ch}`;
  const tab = createVerseTab({
    store: null,
    here: { bookKey: book, chapter: ch, label },
    visible: () => true,
    panelOpen: () => false,
    greek: { open() {} },
  });
  document.body.append(tab.el);
  return { tab, label, c };
}

const q = (tab, sel) => tab.el.querySelector(sel);
const shown = (el) => Boolean(el) && !el.hidden && !el.closest("[hidden]");

test("gapNote: the note beside a gap that names it, in either form", () => {
  const beside = [
    { id: "fn-o", text: "o Literally “in front of.” See Psalm 22:21." },
    { id: "fn-p", text: "p The most reliable manuscripts don’t have what was historically Matthew 17:21." },
  ];
  assert.equal(gapNote(beside, 17, 21), "fn-p", "17:21, not Psalm 22:21");
  assert.equal(gapNote([{ id: "fn-k", text: "What was traditionally verse 14 is…" }], 23, 14), "fn-k");
  assert.equal(gapNote([{ id: "fn-o", text: "Verse 16 seems to be a later addition" }], 7, 16), "fn-o");
  assert.equal(gapNote([{ id: "a", text: "verse 140" }, { id: "b", text: "17:210" }], 17, 14), null, "a longer number is not the verse");
  assert.equal(gapNote([{ id: "a", text: "Verse 44 seems…" }, { id: "b", text: "Verse 46 seems…" }], 9, 46), "b");
  assert.equal(gapNote([], 17, 21), null);
  assert.equal(gapNote(null, 17, 21), null);
  assert.equal(gapNote([{ id: "a", text: "verse 21" }], "17", 21), null, "a chapter that isn't a number");
});

test("every LIT gap is a verse the SBLGNT has no words for, so This verse's Greek line is true", () => {
  for (const [book, ch, v] of GAPS) {
    const have = new Set(greekJson(book, ch).paragraphs.flat().map((w) => w[0]));
    assert.equal(have.has(v), false, `${book} ${ch}:${v} has Greek words`);
  }
});

for (const [book, ch, v] of GAPS) {
  test(`This verse at the gap ${book} ${ch}:${v}: the LIT and the SBLGNT say they lack it, with the LIT's note`, async () => {
    const { tab, label } = tabOn(book, ch);
    tab.setVerse(v);
    await settle(30);
    const ref = `${label}:${v}`;
    assert.equal(q(tab, ".desk-verse__ref").textContent, ref);
    const text = q(tab, ".desk-verse__text");
    assert.equal(text.textContent, `The LIT has no ${ref}.`);
    assert.ok(text.classList.contains("desk-verse__absent"), "the tab's own words, in its look");

    // The Greek section is there, saying the SBLGNT has no such verse, with no words.
    assert.ok(shown(q(tab, ".desk-verse__greek")), "the Greek section shows");
    assert.equal(q(tab, ".desk-verse__greek .desk-verse__absent").textContent, `The SBLGNT has no ${ref}.`);
    assert.equal(tab.el.querySelectorAll(".desk-verse__gw").length, 0);

    // Exactly one footnote: the one that explains this gap.
    const fns = [...tab.el.querySelectorAll(".desk-verse__fn")];
    assert.equal(fns.length, 1, "one note");
    const words = fns[0].querySelector(".desk-verse__fn-body").textContent;
    assert.match(words, new RegExp(`(?:verse\\s+|${ch}:)${v}(?!\\d)`, "i"), `the note names verse ${v}`);

    // No marks on a verse with no words.
    assert.equal(shown(q(tab, ".desk-verse__notes")), false, "My Notes hidden");

    // Previous and Next step to the verses on either side.
    const [prev, next] = tab.el.querySelectorAll(".desk-verse__step");
    assert.match(prev.getAttribute("aria-label"), new RegExp(`^Previous verse, ${label}:${v - 1}$`));
    assert.match(next.getAttribute("aria-label"), new RegExp(`^Next verse, ${label}:${v + 1}$`));
    tab.destroy();
  });
}

test("a printed verse after a gap shows its words and Greek again, and its notes section", async () => {
  const { tab } = tabOn("matthew", 17);
  tab.setVerse(21);
  await settle(30);
  tab.setVerse(22);
  await settle(30);
  const text = q(tab, ".desk-verse__text");
  assert.ok(text.textContent.startsWith("When Jesus and his students"), text.textContent);
  assert.equal(text.classList.contains("desk-verse__absent"), false);
  assert.ok(tab.el.querySelectorAll(".desk-verse__gw").length > 0, "the Greek words are back");
  assert.equal(shown(q(tab, ".desk-verse__greek .desk-verse__absent")), false);
  assert.ok(shown(q(tab, ".desk-verse__notes")), "My Notes shows");
  tab.destroy();
});

test("the Greek pane at a verse the SBLGNT lacks says so under its bar, until it next moves", async () => {
  const { mountPane } = await import("../src/scripts/desk/desk-panes.js");
  document.body.innerHTML = "";
  const body = document.createElement("div");
  document.body.append(body);
  let passage = { bookKey: "matthew", chapter: 17, verse: 21 };
  let mounted = null;
  const pane = { id: "g1", get: () => passage, set: (p) => { passage = p; mounted?.setPassage(p); } };
  mounted = mountPane("greek", body, {}, pane);
  const line = body.querySelector(".desk-dp__missing");
  assert.ok(line, "the line is in the pane from the start");
  assert.equal(line.getAttribute("role"), "status", "a polite status, heard by a screen reader");
  assert.ok(line.previousElementSibling?.classList.contains("desk-passage"), "right under the passage bar");
  await settle(60);
  assert.equal(line.textContent, "No verse 21 in the SBLGNT. Showing 17:20.");

  mounted.setPassage({ ...passage, verse: 22 });
  await settle(30);
  assert.equal(line.textContent, "", "gone once the pane moves to a verse the Greek has");

  mounted.setPassage({ ...passage, verse: 21 });
  await settle(30);
  assert.equal(line.textContent, "No verse 21 in the SBLGNT. Showing 17:20.", "and back when asked again in the same chapter");

  mounted.setPassage({ bookKey: "mark", chapter: 9, verse: 44 });
  await settle(60);
  assert.equal(line.textContent, "No verse 44 in the SBLGNT. Showing 9:43.", "a new chapter says it too");

  mounted.setPassage({ bookKey: "mark", chapter: 9, verse: null });
  await settle(30);
  assert.equal(line.textContent, "", "a whole chapter names no verse");
  mounted.destroy();
});

test("a verse number that is neither on the page nor a gap is still refused", async () => {
  const { tab } = tabOn("matthew", 17);
  tab.setVerse(20);
  await settle(30);
  tab.setVerse(99);
  await settle(30);
  assert.equal(q(tab, ".desk-verse__ref").textContent, "Matthew 17:20");
  tab.destroy();
});
