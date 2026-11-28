// The Notebook panel on a chapter's page, driven over the real notebook store
// (Featherboa's Phase 5; SITE-FEATHERBOA.md, "The Notebook panel"): its three
// tabs, its title menu, Notes' head and empty state, the Footnotes tab, both
// following the chapter in view as the page reads on, Go deeper's "This
// chapter," Start here, the foot line, and the margin giving its notes to the
// panel while it shows (BS-15).
//
// One page and one panel for the whole file, in order: page.js reads whether
// the page reads on once, as it loads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createRecord } from "../src/lib/desk-records.mjs";
import { FEEDBACK_HREF, FEEDBACK_LABEL, HELP_HREF } from "../src/lib/desk-first-use.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
// An open channel keeps node alive; the store here is never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

let n = 0;
const ctx = () => ({ client: "web/test", contentVersion: "v1", now: new Date(Date.now() - 60_000 + n * 10).toISOString() });
const make = (kind, fields) => createRecord(kind, fields, { ...ctx(), id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });

resetDom("http://localhost/john-3/");
localStorage.clear();
sessionStorage.clear();
// Expanded from the start, as a reader who restored it left it.
localStorage.setItem("lit-desk-min", "0");
document.body.innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <button type="button" data-desk-toggle aria-expanded="false">Notebook</button>
  <main id="main"><div class="scripture-layout scripture-layout--scripture"><div class="scripture-main">
    <h1 id="chapter-title">John 3</h1>
    <article class="chapter" data-last-read-book="john" data-last-read-chapter="3">
      <div class="chapter-paragraphs"><div class="p">
        <span data-verse="16"><sup class="vn" id="v16" tabindex="-1">16</sup>For God so loved the world.<sup class="fn-ref"><a href="#fn-a" id="fnref-a">a</a></sup></span>
        <span data-verse="17"><sup class="vn" id="v17" tabindex="-1">17</sup>God did not send the Son to judge.<sup class="fn-ref"><a href="#fn-b" id="fnref-b">b</a></sup></span>
      </div></div>
      <section class="go-deeper" aria-labelledby="go-deeper-title"><h2 id="go-deeper-title">Go deeper</h2>
        <div class="go-deeper__rows"><a class="go-deeper__row" href="/glossary/#cosmos">Cosmos</a></div></section>
      <section class="footnotes-wrap"><ol class="footnotes">
        <li id="fn-a"><div class="fn-body"><a href="#fnref-a" class="footnote-backlink">a</a> <span>The world, here the whole of it.</span></div></li>
        <li id="fn-b"><div class="fn-body"><a href="#fnref-b" class="footnote-backlink">b</a> <span>Or condemn.</span></div></li>
      </ol></section>
    </article>
    <script type="application/json" id="read-on-data">{}</script>
    <article class="read-on__chapter" data-book="john" data-chapter="4" aria-labelledby="john-4-heading">
      <div class="read-on__head"><h2 id="john-4-heading">John 4</h2></div>
      <div class="chapter-paragraphs"><div class="p">
        <span data-verse="1"><sup class="vn" id="john-4-v1" tabindex="-1">1</sup>Jesus learned of it.<sup class="fn-ref"><a href="#john-4-fn-a">a</a></sup></span>
      </div></div>
      <section class="footnotes-wrap"><ol class="footnotes">
        <li id="john-4-fn-a"><div class="fn-body"><a class="footnote-backlink" href="#john-4-fnref-a">a</a> <span>A note in John 4.</span></div></li>
      </ol></section>
    </article>
  </div></div></main>`;

const { openStore } = await import("../src/scripts/desk/store.js");
const { createPanel } = await import("../src/scripts/desk/panel.js");
const { initCommands } = await import("../src/scripts/desk/commands.js");
const { COMMAND_EVENT } = await import("../src/scripts/desk/first-use.js");

const store = await openStore({ ctx });
// Something kept elsewhere, so the notebook holds a record and John 3 none.
await store.save(make("note", { bookKey: "romans", chapter: 8, verse: 28, body: "All things.", marker: "note" }));

// The shell starts the pins before the panel (shell.js), so a footnote's Pin can be drawn.
const { initPins } = await import("../src/scripts/desk/pins.js");
initPins({ store, ctx });

const printed = [];
const panel = createPanel({
  store,
  ctx,
  printRoom: { can: () => true, print: async () => printed.push("room") },
  printNotes: { can: () => true, print: async () => printed.push("notes") },
});
initCommands({ panel });
// happy-dom has no layout, so the rail may start it floating and folded:
// expand it, as a reader would.
panel.restore({ ...panel.snapshot(), hidden: false, collapsed: false });
await settle(30);

const root = document.documentElement;
const el = document.getElementById("deskPanel");
const $ = (s) => el.querySelector(s);
const $$ = (s) => Array.from(el.querySelectorAll(s));
const tabButton = (id) => $(`[role="tab"][data-tab="${id}"]`);
const activeIs = (pred) => Boolean(document.activeElement && pred(document.activeElement));
const key = (target, k) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
async function until(fn, what, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await settle(10);
  }
  assert.fail(`timed out waiting for ${what}`);
}
/** The tour asks, every way in, by one event (requestTour). */
function tourAsks() {
  const asked = [];
  const on = (e) => e.detail?.id === "tour" && asked.push(e.detail);
  document.addEventListener(COMMAND_EVENT, on);
  return { asked, stop: () => document.removeEventListener(COMMAND_EVENT, on) };
}

test("a chapter's Notebook has three tabs, Notes first, and the arrow keys move among them", async () => {
  assert.equal(panel.isOpen(), true, "the panel shows");
  assert.deepEqual($$('[role="tab"]').map((b) => b.textContent), ["Notes", "Footnotes", "This verse"]);
  assert.equal($$('[role="tab"]').every((b) => b.classList.contains("kit-tab")), true, "the kit's tabs");
  assert.equal(tabButton("mine").getAttribute("aria-selected"), "true");
  tabButton("mine").focus();
  key(tabButton("mine"), "ArrowRight");
  assert.equal(tabButton("footnotes").getAttribute("aria-selected"), "true");
  assert.equal(activeIs((a) => a.dataset.tab === "footnotes"), true, "focus moved with the choice");
  key(tabButton("footnotes"), "End");
  assert.equal(tabButton("verse").getAttribute("aria-selected"), "true");
  key(tabButton("verse"), "ArrowRight");
  assert.equal(tabButton("mine").getAttribute("aria-selected"), "true", "the row wraps");
  assert.equal(document.getElementById("deskTabpanel-mine").hidden, false);
  assert.equal(document.getElementById("deskTabpanel-footnotes").hidden, true);
});

test("Notes heads its list with the chapter in view and a link to the whole notebook", async () => {
  await until(() => $(".desk-mine__all") && !$(".desk-mine__all").hidden, "the notebook link");
  assert.equal($(".desk-mine__chapter").textContent, "John 3");
  assert.match($(".desk-mine__title").textContent, /^This chapter/);
  assert.equal($(".desk-mine__all").textContent, "1 in the Notebook");
  assert.equal($(".desk-mine__all").getAttribute("href"), "/notebook/");
});

test("a chapter holding nothing says so in one sentence, with Show me how, which asks for the tour", async () => {
  const empty = await until(() => $$("#deskTabpanel-mine .desk-panel__empty").find((p) => !p.hidden), "the empty line");
  assert.equal(empty.textContent, "No notes on John 3 yet. Select a verse number or any words, then choose Note, Highlight, or Bookmark.");
  const how = $(".desk-mine__how");
  assert.equal(how.hidden, false);
  assert.equal(how.textContent, "Show me how");
  assert.equal(how.classList.contains("kit-btn") && how.classList.contains("kit-btn--tinted"), true);
  const tour = tourAsks();
  how.click();
  tour.stop();
  assert.equal(tour.asked.length, 1, "Show me how asks for the tour");
});

test("Notes and Footnotes follow the chapter in view as the page reads on", async () => {
  await store.save(make("note", { bookKey: "john", chapter: 4, verse: 1, body: "At the well.", marker: "note" }));
  document.dispatchEvent(new CustomEvent("lit:read-on", { detail: { type: "place", book: "john", chapter: 4 } }));
  await until(() => $(".desk-mine__chapter").textContent === "John 4", "Notes to follow");
  await until(() => $$("#deskTabpanel-mine .desk-list .desk-item").length === 1, "John 4's note");
  assert.match($("#deskTabpanel-mine .desk-list").textContent, /At the well\./);
  await until(() => $(".desk-mine__all").textContent === "All 2 in the Notebook", "the count");
  assert.equal($(".desk-mine__how").hidden, true, "no Show me how under a chapter that holds something");

  tabButton("footnotes").click();
  const items = await until(() => {
    const li = $$("#deskTabpanel-footnotes .desk-fns__item");
    return li.length ? li : null;
  }, "John 4's footnotes");
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /A note in John 4\./);
  assert.equal(items[0].querySelector(".desk-fns__verse").textContent, "Verse 1");

  document.dispatchEvent(new CustomEvent("lit:read-on", { detail: { type: "place", book: "john", chapter: 3 } }));
  await until(() => $$("#deskTabpanel-footnotes .desk-fns__item").length === 2, "John 3's footnotes");
  const notes = $$("#deskTabpanel-footnotes .desk-fns__item");
  assert.deepEqual(notes.map((li) => li.querySelector(".desk-fns__label").textContent), ["a", "b"]);
  assert.deepEqual(notes.map((li) => li.querySelector(".desk-fns__verse").textContent), ["Verse 16", "Verse 17"]);
  assert.match(notes[0].querySelector(".desk-fns__body").textContent, /The world, here the whole of it\./, "each note whole");
  assert.equal(notes[0].querySelector(".desk-fns__body .footnote-backlink"), null, "without the page's way back");
  assert.ok(notes[0].querySelector("button[data-desk-pin]"), "with its Pin");
  notes[0].querySelector(".desk-fns__verse").click();
  assert.equal(activeIs((a) => a.id === "v16"), true, "Verse 16 takes the reader to the verse");
  tabButton("mine").click();
});

test("a pinned footnote's link shows its note in the Footnotes tab where the page's list is out of sight", async () => {
  const { revealFootnote, setFootnoteHome } = await import("../src/scripts/desk/pins.js");
  // The shell names the tab as the note's place once the panel is up (shell.js).
  setFootnoteHome(panel.showFootnote);
  const pin = make("footnotePin", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16, footnote: "The world, here the whole of it." });
  const pageNote = document.getElementById("fn-a");
  try {
    // Where the Notebook runs, the list leaves the flow (reading-page.css, WB-18): no boxes.
    pageNote.getClientRects = () => [];
    assert.equal(revealFootnote(pin), true, "it was shown");
    assert.equal(tabButton("footnotes").getAttribute("aria-selected"), "true", "on the Footnotes tab");
    const shown = $('#deskTabpanel-footnotes li[data-fn="fn-a"]');
    assert.ok(shown, "the note is in the tab");
    assert.equal(shown.classList.contains("desk-fns__item--current"), true, "marked");
    assert.equal(activeIs((a) => a.dataset.fn === "fn-a"), true, "with focus on it");

    // Where the list is on the page, the link goes to the page's note, as before.
    tabButton("mine").click();
    pageNote.getClientRects = () => [{ top: 0, height: 20 }];
    assert.equal(revealFootnote(pin), true);
    assert.equal(tabButton("mine").getAttribute("aria-selected"), "true", "the Notebook's tab stays");
    assert.equal(activeIs((a) => a.id === "fn-a"), true, "focus on the page's note");
  } finally {
    delete pageNote.getClientRects;
    setFootnoteHome(null);
  }
});

test("while the panel shows, the margin draws no notes; minimizing gives them back and moves no text", async () => {
  assert.equal(root.hasAttribute("data-desk-shown"), true);
  assert.equal(root.getAttribute("data-desk-panel"), "open");
  $(".desk-panel__collapse").click();
  await settle(20);
  assert.equal(panel.isOpen(), false, "minimized");
  assert.equal(root.hasAttribute("data-desk-shown"), false, "the margin's notes come back");
  assert.equal(root.getAttribute("data-desk-panel"), "open", "still open, as a tab");
  assert.equal(root.hasAttribute("data-desk-expanded"), true, "the column keeps the open notebook's measure (BS-15)");
  panel.restore({ ...panel.snapshot(), hidden: false, collapsed: false });
  await settle(20);
  assert.equal(root.hasAttribute("data-desk-shown"), true);
});

test("the title is the Notebook's menu: its rows in order, the arrows, and Escape back to the title", async () => {
  const title = $(".desk-panel__title-button");
  assert.equal(title.getAttribute("aria-haspopup"), "menu");
  assert.equal(title.getAttribute("aria-expanded"), "false");
  assert.equal(title.textContent.trim(), "Notebook");
  title.click();
  const menu = document.getElementById(title.getAttribute("aria-controls"));
  assert.equal(menu.hidden, false);
  assert.equal(menu.getAttribute("role"), "menu");
  assert.equal(title.getAttribute("aria-expanded"), "true");
  const rows = Array.from(menu.querySelectorAll('[role="menuitem"]'));
  const label = (r) => r.querySelector(".desk-panel__menu-label").firstChild.textContent;
  assert.deepEqual(rows.map(label), ["Print…", "Whole notebook", "Notebook actions", "Take the tour", "Help", FEEDBACK_LABEL]);
  assert.equal(rows.every((r) => r.classList.contains("kit-row")), true, "the kit's rows");
  assert.equal(rows[1].getAttribute("href"), "/notebook/");
  assert.equal(rows[4].getAttribute("href"), HELP_HREF);
  assert.equal(rows[5].getAttribute("href"), FEEDBACK_HREF);
  assert.equal(rows[5].getAttribute("target"), "_blank");
  assert.equal(rows[5].getAttribute("rel"), "noopener noreferrer");
  assert.match(rows[5].textContent, /opens in a new tab/);
  assert.equal(activeIs((a) => a === rows[0]), true, "focus goes to the first row");
  key(document.activeElement, "ArrowDown");
  assert.equal(activeIs((a) => a === rows[1]), true);
  key(document.activeElement, "End");
  assert.equal(activeIs((a) => a === rows[5]), true);
  key(document.activeElement, "ArrowDown");
  assert.equal(activeIs((a) => a === rows[0]), true, "the rows wrap");
  key(document.activeElement, "ArrowUp");
  assert.equal(activeIs((a) => a === rows[5]), true);
  key(document.activeElement, "Home");
  assert.equal(activeIs((a) => a === rows[0]), true);
  key(document.activeElement, "Escape");
  assert.equal(menu.hidden, true, "Escape closes it");
  assert.equal(activeIs((a) => a === title), true, "and gives focus back to the title");
  assert.equal(panel.isOpen(), true, "the menu's Escape doesn't minimize the Notebook");

  title.click();
  const tour = tourAsks();
  rows[3].click();
  tour.stop();
  assert.equal(tour.asked.length, 1, "Take the tour asks for it");
  assert.equal(menu.hidden, true, "and the menu closes");
});

test("Go deeper's This chapter opens This verse at the chapter's rows, with focus on its heading", async () => {
  document.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: { id: "show-this-chapter", book: "john", chapter: 3 } }));
  const part = await until(() => $("#deskTabpanel-verse .desk-chapter"), "This chapter", 300);
  assert.equal(tabButton("verse").getAttribute("aria-selected"), "true");
  assert.equal(document.getElementById("deskTabpanel-verse").hidden, false);
  assert.equal(part.querySelector(".desk-verse__subhead").textContent, "This chapter");
  assert.equal(part.querySelector(".desk-chapter__open").textContent, "John 3");
  assert.equal(part.querySelector(".desk-chapter__rows a").textContent, "Cosmos");
  assert.equal(activeIs((a) => a.classList.contains("desk-verse__subhead") && part.contains(a)), true, "focus on its heading");
  tabButton("mine").click();
});

test("Start here heads the Notebook, and I know my way around takes it away, giving focus to the title", async () => {
  const start = $(".desk-start");
  assert.ok(start, "Start here is drawn");
  assert.equal(start.previousElementSibling?.classList.contains("desk-panel__head"), true, "right under the head");
  assert.equal(start.hidden, false, "until the tour is taken");
  assert.equal(start.querySelector(".desk-start__lead").textContent, "Start here:");
  assert.equal(start.querySelector(".desk-start__take").classList.contains("kit-btn--filled"), true);
  start.querySelector(".desk-start__skip").click();
  assert.equal(start.hidden, true);
  assert.equal(activeIs((a) => a.classList.contains("desk-panel__title-button")), true);
  assert.match(localStorage.getItem("lit-desk-tour") ?? "", /never/, "the choice is kept");
});

test("the foot line sits under every tab and says where the notebook is kept", async () => {
  const foot = $(".desk-panel__foot");
  assert.ok(foot, "the foot line is drawn");
  assert.equal(foot.parentElement === el && !foot.nextElementSibling?.classList.contains("desk-panel__body"), true, "after the tabs' bodies");
  await until(() => $(".desk-panel__foot-text").textContent, "the foot's words");
  assert.equal($(".desk-panel__foot-text").textContent, "Kept in this browser only.");
  const backUp = $(".desk-panel__backup");
  assert.equal(backUp.hidden, false, "the notebook holds something to back up");
  assert.equal(backUp.textContent, "Back up…");
  assert.equal(backUp.getAttribute("href"), "/notebook/#backup");
  assert.equal(foot.hasAttribute("data-due"), false, "nothing is due for a notebook begun a minute ago");
});
