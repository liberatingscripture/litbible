// Step 4k, notes from the Greek (STUDY-DESK.md, "Order of work", 4k; BVJ,
// 2026-11-23): a note started from the Greek tab or pane is an ordinary note
// on its verse, with the Greek the reader chose in its body. Both ways in are
// BVJ's: one word chosen, or a run of the Greek selected.
//
// The pure rules (src/lib/desk-note-from-greek.mjs), then the tab and the
// note editor driven in happy-dom: the button, what it hands the editor, and
// that the saved record is a plain note with nothing new in it.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import {
  greekNoteBody, greekNoteLabel, greekQuote, greekVerses, noteFromGreek,
} from "../src/lib/desk-note-from-greek.mjs";
import { W } from "../src/lib/desk-greek.mjs";

// A word as the chapter files give it: [verse, t, text, pre, post, …].
const word = (verse, t, text, pre = "", post = " ") => {
  const w = [];
  w[W.verse] = verse;
  w[W.t] = t;
  w[W.text] = text;
  w[W.pre] = pre;
  w[W.post] = post;
  return { w, verse };
};

// ── The rules ──────────────────────────────────────────────────────────────

test("one chosen word is the word alone, without the punctuation after it", () => {
  assert.equal(greekQuote([word(16, 3, "ἠγάπησεν", "", ", ")]), "ἠγάπησεν");
});

test("a run keeps the punctuation between its words, not at its edges, unless the selection holds it", () => {
  const run = [word(16, 1, "Οὕτως", "⸀", " "), word(16, 2, "γὰρ", "", "·  "), word(16, 3, "ἠγάπησεν", "", ", ")];
  // The raised dot between two words stays; the comma touching the last word
  // and the sign before the first don't come in by themselves.
  assert.equal(greekQuote(run), "Οὕτως γὰρ· ἠγάπησεν");
  // Selected along with the words, they do (the sign still left out).
  assert.equal(greekQuote(run, { lead: "⸀", trail: ", " }), "Οὕτως γὰρ· ἠγάπησεν,");
  assert.equal(greekQuote([run[2]], { trail: ";" }), "ἠγάπησεν;");
});

test("a run into another verse carries that verse's number", () => {
  const run = [word(1, 9, "λόγος", "", ". "), word(2, 1, "οὗτος", "", " "), word(2, 2, "ἦν", "", " ")];
  assert.equal(greekQuote(run), "λόγος. 2 οὗτος ἦν");
  assert.deepEqual(greekVerses(run), { verse: 1, endVerse: 2 });
});

test("the body is the Greek in curly quotes, then a new line for the reader's words", () => {
  assert.equal(greekNoteBody("λόγος"), "“λόγος”\n");
  assert.equal(greekNoteBody("   "), "");
});

test("a quote too long for a note is cut with an ellipsis, leaving room to write", () => {
  const body = greekNoteBody("α".repeat(10_000), 6000);
  assert.ok(body.length <= 6000 - 4000 + 4, `${body.length}`);
  assert.match(body, /…”\n$/);
});

test("noteFromGreek: a whole-verse draft on the chapter shown, and its body", () => {
  const here = { bookKey: "john", chapter: 3, label: "John 3" };
  assert.deepEqual(noteFromGreek(here, [word(16, 3, "ἠγάπησεν")]), {
    draft: { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 },
    body: "“ἠγάπησεν”\n",
  });
  assert.equal(noteFromGreek(here, []), null);
  assert.equal(noteFromGreek(null, [word(16, 3, "ἠγάπησεν")]), null);
});

test("the button says where the note goes and what it starts with", () => {
  assert.equal(greekNoteLabel({ verse: 16, endVerse: 16 }, "word"), "Add a note on verse 16 with this word");
  assert.equal(greekNoteLabel({ verse: 16, endVerse: 17 }, "selection"), "Add a note on verses 16–17 with the selected Greek");
});

// ── The tab, driven ────────────────────────────────────────────────────────

// The real committed Greek files, served to the tab's fetches.
const publicRoot = new URL("../public/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").split("?")[0];
  const file = new URL(path, publicRoot);
  if (!path.startsWith("greek/") || !existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const { createGreekTab } = await import("../src/scripts/desk/tab-greek.js");
const { openNoteEditor } = await import("../src/scripts/desk/note-editor.js");
const { closePanel } = await import("../src/scripts/lit-panel.js");

const HERE = { bookKey: "john", chapter: 3, label: "John 3" };

beforeEach(() => {
  closePanel({ force: true });
  sessionStorage.removeItem("lit-desk-note-draft");
});

async function tab(onAddNote) {
  resetDom();
  document.body.innerHTML = `<div class="chapter-paragraphs"></div>`;
  const t = createGreekTab({ here: HERE, visible: () => true, openVerse: () => {}, onAddNote });
  document.body.append(t.el);
  await t.render();
  await settle(30);
  return t;
}

const noteButton = (t) => t.el.querySelector(".desk-greek__note");

test("without a way to keep notes (a draft chapter, no notebook) there is no button", async () => {
  const t = await tab(null);
  assert.equal(noteButton(t), null);
});

test("a chosen word: the button names its verse, and hands the editor a plain verse draft and the word", async () => {
  const calls = [];
  const t = await tab((draft, trigger, opts) => calls.push({ draft, trigger, opts }));
  const b = noteButton(t);
  assert.equal(b.hidden, true, "nothing chosen, nothing to note");
  assert.equal(await t.selectWord(16, 3), true);
  assert.equal(b.hidden, false);
  assert.equal(b.getAttribute("aria-label"), "Add a note on verse 16 with this word");
  assert.equal(b.dataset.tip, "Add a note on verse 16 with this word", "the tooltip says the same");
  assert.equal(b.textContent.trim(), "", "the glyph alone shows");
  assert.ok(b.querySelector("svg.desk-greek__note-glyph"), "the note glyph");
  assert.equal(b.nextElementSibling, t.el.querySelector(".desk-greek__close"), "just before the ×");
  const chosen = t.el.querySelector(".desk-greek__w.is-selected").textContent;
  b.click();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].draft, { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  assert.equal(calls[0].trigger, b, "the editor opens beside the button");
  assert.equal(calls[0].opts.body, `“${chosen}”\n`);
  // Letting the word go takes the button away.
  t.el.querySelector(".desk-greek__close").click();
  assert.equal(b.hidden, true);
});

test("a selection of the Greek: the button covers its verses and the words it touches, ahead of a chosen word", async () => {
  const calls = [];
  const t = await tab((draft, trigger, opts) => calls.push({ draft, opts }));
  await t.selectWord(1, 1);
  const words = [...t.el.querySelectorAll(".desk-greek__w")];
  const verseOf = (b) => {
    // A word's verse is the last verse number before it.
    let n = b;
    while (n) {
      n = n.previousElementSibling ?? n.parentElement?.previousElementSibling?.lastElementChild ?? null;
      if (n?.classList?.contains("desk-greek__vn")) return Number(n.dataset.vn);
    }
    return null;
  };
  // From the second-to-last word of verse 1 into the first word of verse 2,
  // starting partway into a word and ending at the very start of the next
  // word, which must not come in.
  const firstOf2 = words.findIndex((b) => verseOf(b) === 2);
  const from = words[firstOf2 - 2];
  const to = words[firstOf2 + 1];
  const sel = document.getSelection();
  const range = document.createRange();
  range.setStart(from.firstChild, 1);
  range.setEnd(to.firstChild, 0);
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
  const b = noteButton(t);
  assert.equal(b.getAttribute("aria-label"), "Add a note on verses 1–2 with the selected Greek");
  b.click();
  assert.deepEqual(calls[0].draft, { bookKey: "john", chapter: 3, verse: 1, endVerse: 2 });
  const body = calls[0].opts.body;
  assert.ok(body.startsWith(`“${from.textContent}`), body);
  assert.ok(body.includes(` 2 ${words[firstOf2].textContent}`), `verse 2's number before its first word: ${body}`);
  assert.ok(!body.includes(to.textContent), "a word at the selection's very edge stays out");
  // Clearing the selection goes back to the chosen word.
  sel.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
  assert.equal(b.getAttribute("aria-label"), "Add a note on verse 1 with this word");
});

test("a selection also gets a small menu beside it, with that one choice", async () => {
  const calls = [];
  const t = await tab((draft, trigger, opts) => calls.push({ draft, trigger, opts }));
  await t.selectWord(16, 1);
  const menu = () => t.el.querySelector(".desk-greek__selmenu");
  // A chosen word alone gets no menu: the button beside the × serves it.
  assert.equal(menu(), null);
  const words = [...t.el.querySelectorAll(".desk-greek__w")];
  const scroller = t.el.querySelector(".desk-greek__scroller");
  const i = words.findIndex((b) => b.textContent === "ἠγάπησεν");
  const sel = document.getSelection();
  const select = () => {
    const range = document.createRange();
    range.setStart(words[i].firstChild, 0);
    range.setEnd(words[i + 2].firstChild, words[i + 2].firstChild.length);
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  };
  // Mid-drag it waits for the mouse button to come up.
  scroller.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  select();
  await settle(120);
  assert.equal(menu(), null, "no menu while the button is held");
  document.dispatchEvent(new window.PointerEvent("pointerup", { bubbles: true }));
  await settle(120);
  assert.ok(menu(), "the menu shows once the button comes up");
  assert.ok(scroller.contains(menu()), "inside the scroller, so it scrolls with the words");
  const item = menu().querySelector("button");
  assert.equal(item.textContent, "Add a note on verse 16");
  assert.ok(item.querySelector("svg.desk-greek__selmenu-glyph"));
  assert.equal(item.tabIndex, -1, "never a tab stop: the button beside the × is the keyboard's way");
  item.click();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].draft, { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  assert.ok(calls[0].opts.body.startsWith(`“${words[i].textContent} `));
  assert.ok(calls[0].opts.restoreFocus === words[i], "focus comes back to the first selected word");
  // Escape closes it, and it stays closed for that selection.
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(menu(), null);
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
  assert.equal(menu(), null, "the same selection doesn't bring it back");
  // Clearing the selection takes it away for good; a new one brings it back.
  sel.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
  select();
  await settle(120);
  assert.ok(menu(), "a new selection shows it again");
  sel.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
  assert.equal(menu(), null, "gone with the selection");
});

test("a comma touching the selection's last word comes in only when the selection holds it", async () => {
  const calls = [];
  const t = await tab((draft, trigger, opts) => calls.push(opts.body));
  await t.selectWord(16, 1);
  const words = [...t.el.querySelectorAll(".desk-greek__w")];
  // The first word in John 3 with a comma after it, and two words before it.
  const at = words.findIndex((w) => w.nextSibling?.textContent.startsWith(","));
  const from = words[at - 2];
  const to = words[at];
  const plain = [from, words[at - 1], to].map((w) => w.textContent).join(" ");
  const sel = document.getSelection();
  const pick = async (endNode, endOffset) => {
    const range = document.createRange();
    range.setStart(from.firstChild, 0);
    range.setEnd(endNode, endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await settle(120);
    noteButton(t).click();
  };
  await pick(to.firstChild, to.firstChild.length);
  assert.ok(calls.at(-1).startsWith(`“${plain}”`), calls.at(-1));
  await pick(to.nextSibling, 1);
  assert.ok(calls.at(-1).startsWith(`“${plain},”`), calls.at(-1));
});

test("destroy lets go of the document's selection events", async () => {
  const t = await tab(() => {});
  t.destroy();
  await t.selectWord(16, 3).catch(() => {});
  // A selection event after destroy changes nothing and throws nothing.
  document.dispatchEvent(new Event("selectionchange"));
  await settle(120);
});

// ── The note editor, opened with the Greek ─────────────────────────────────

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const DRAFT = { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 };

function editor({ startBody = null, saved = [] } = {}) {
  resetDom();
  const trigger = document.body.appendChild(document.createElement("button"));
  const store = { save: async (r) => saved.push(r) };
  const panel = openNoteEditor({ trigger, store, ctx, ref: "John 3:16", draft: DRAFT, text: () => null, startBody });
  return { panel, body: panel.querySelector("textarea"), saved };
}

test("the editor opens with the Greek and the cursor after it", () => {
  const { body } = editor({ startBody: "“ἠγάπησεν”\n" });
  assert.equal(body.value, "“ἠγάπησεν”\n");
  assert.equal(document.activeElement, body);
  assert.equal(body.selectionStart, body.value.length);
  assert.equal(body.selectionEnd, body.value.length);
});

test("closing with nothing added asks nothing: the Greek is the starting point", () => {
  const { panel } = editor({ startBody: "“ἠγάπησεν”\n" });
  panel.querySelector(".desk-editor__cancel").click();
  assert.equal(panel.isConnected, false);
});

test("the saved note is the same kind with the same fields as one made from a verse number", async () => {
  const fromGreek = editor({ startBody: "“ἠγάπησεν”\n" });
  fromGreek.body.value += "Loved: an aorist.";
  fromGreek.panel.querySelector(".desk-editor__save").click();
  await settle(10);
  const [g] = fromGreek.saved;
  assert.ok(g, "saved");
  assert.equal(g.body, "“ἠγάπησεν”\nLoved: an aorist.");

  const plain = editor();
  plain.body.value = "Loved: an aorist.";
  plain.panel.querySelector(".desk-editor__save").click();
  await settle(10);
  const [p] = plain.saved;
  assert.equal(g.kind, p.kind);
  assert.deepEqual(Object.keys(g).sort(), Object.keys(p).sort(), "no field of its own");
  assert.equal(g.verse, 16);
  assert.equal(g.endVerse, 16);
  assert.equal("quote" in g, false, "a whole-verse note: no quote of LIT words");
});

test("a note saved with only the Greek drops the blank line after it", async () => {
  const { panel, saved } = editor({ startBody: "“ἠγάπησεν”\n" });
  panel.querySelector(".desk-editor__save").click();
  await settle(10);
  assert.equal(saved[0].body, "“ἠγάπησεν”");
});

test("a kept draft for the verse comes back only when it began with the same Greek", () => {
  const kept = (body) =>
    sessionStorage.setItem("lit-desk-note-draft", JSON.stringify({ key: draftKey(), body, marker: "note" }));
  // The key the editor writes for this draft, read back from a first editor.
  let key = null;
  const draftKey = () => key;
  {
    const { body } = editor();
    body.value = "x";
    body.dispatchEvent(new Event("input", { bubbles: true }));
    key = JSON.parse(sessionStorage.getItem("lit-desk-note-draft")).key;
    closePanel({ force: true });
  }
  kept("“λόγος”\nmy earlier words");
  assert.equal(editor({ startBody: "“ἠγάπησεν”\n" }).body.value, "“ἠγάπησεν”\n", "another word's draft stays put");
  closePanel({ force: true });
  kept("“ἠγάπησεν”\nmy earlier words");
  assert.equal(editor({ startBody: "“ἠγάπησεν”\n" }).body.value, "“ἠγάπησεν”\nmy earlier words");
});
