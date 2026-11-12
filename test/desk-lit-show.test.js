// "Show" on the LIT pane's bar (src/scripts/desk/lit-show.js; E108), driven in
// a browser DOM: the four switches that mark up the LIT text are set on the
// pane, each pane has its own, each press changes that pane and leaves the
// menu open, and the Display tray on /desk no longer carries them. What the
// layout keeps for each pane, and what Reading does to it, is
// test/desk-layout.test.js's.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./helpers/browser-env.mjs";

const { createShowButton } = await import("../src/scripts/desk/lit-show.js");
const { createPassageBar } = await import("../src/scripts/desk/passage-bar.js");
const { highlightsShownIn, stampMarks, undoOldReading } = await import("../src/scripts/desk/lit-marks.js");
const { SETTINGS_EVENT, allHidden, getSetting, setHideAll, setSetting } = await import("../src/scripts/desk/note-settings.js");

const root = document.documentElement;
const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const menu = () => document.querySelector('[role="menu"].desk-lit-show');
const items = () => [...menu().querySelectorAll('[role="menuitemcheckbox"]')];
const item = (label) => items().find((b) => b.querySelector(".desk-title__label").textContent === label);
const checked = () => Object.fromEntries(items().map((b) => [b.querySelector(".desk-title__label").textContent, b.getAttribute("aria-checked")]));

// Where focus is, as a place in the menu (or -1), or the button. Comparing
// the elements themselves makes a failed assertion print a whole DOM.
const focusAt = () => items().indexOf(document.activeElement);
const onButton = () => document.activeElement === show.el;

// A browser that can draw highlights, unless a test takes it away. The code
// reads the global `CSS`, which the helper set once from the window's.
function highlights(on) {
  if (on) {
    globalThis.CSS.highlights = new Map();
    globalThis.Highlight = class {};
  } else {
    delete globalThis.CSS.highlights;
    delete globalThis.Highlight;
  }
}

/** A pane's own switches, as the LIT pane hands them to its button. */
function switches() {
  const hidden = new Set();
  return {
    hidden,
    isOn: (id) => !hidden.has(id),
    set: (id, on) => (on ? hidden.delete(id) : hidden.add(id)),
  };
}

// What Chapter View's switches set, which a pane must never touch.
const PAGE_ATTRS = ["data-vn", "data-fn", "data-terms"];
const NOTE_ATTRS = ["data-desk-notes", "data-desk-bookmarks", "data-desk-highlights", "data-desk-read-highlights"];

let show;
let pane;

beforeEach(() => {
  show?.destroy();
  for (const attr of [...PAGE_ATTRS, ...NOTE_ATTRS]) root.removeAttribute(attr);
  localStorage.clear();
  highlights(true);
  pane = switches();
  show = createShowButton(pane);
  document.body.replaceChildren(show.el);
});

test("the button is worded, names what it is about, and opens a menu of four checkboxes, all on by default", () => {
  assert.equal(show.el.textContent.trim(), "Show");
  assert.equal(show.el.dataset.tip, show.el.getAttribute("aria-label"), "the tooltip says the name, for the narrow pane's glyph");
  assert.match(show.el.getAttribute("aria-label"), /^Show\b/, "the name starts with the word on the button");
  assert.match(show.el.getAttribute("aria-label"), /this pane/, "and says it is this pane's");
  assert.equal(show.el.getAttribute("aria-haspopup"), "menu");
  assert.equal(show.el.getAttribute("aria-expanded"), "false");
  assert.equal(menu(), null, "nothing is on the page until it is pressed");

  show.el.click();
  assert.equal(show.el.getAttribute("aria-expanded"), "true");
  assert.equal(show.el.getAttribute("aria-controls"), menu().id);
  assert.deepEqual(checked(), {
    "Verse and chapter numbers": "true",
    "Footnote letters": "true",
    "Key terms": "true",
    "My highlights": "true",
  });
  assert.equal(focusAt(), 0, "focus goes to the first checkbox");
});

test("a press turns that mark off and on in its own pane, and leaves the menu open", () => {
  show.el.click();
  item("Verse and chapter numbers").click();
  assert.deepEqual([...pane.hidden], ["vn"]);
  assert.equal(item("Verse and chapter numbers").getAttribute("aria-checked"), "false");
  assert.ok(menu(), "still open, for the next one");

  item("Footnote letters").click();
  item("Key terms").click();
  item("My highlights").click();
  assert.deepEqual([...pane.hidden], ["vn", "fn", "terms", "highlights"]);

  item("Verse and chapter numbers").click();
  assert.deepEqual([...pane.hidden], ["fn", "terms", "highlights"], "on again");
  assert.equal(item("Verse and chapter numbers").getAttribute("aria-checked"), "true");
});

test("a pane's switches are its own: the chapter pages' settings are never touched", () => {
  show.el.click();
  for (const b of items()) b.click();
  for (const attr of [...PAGE_ATTRS, "data-desk-highlights"]) assert.equal(root.hasAttribute(attr), false, attr);
  assert.equal(localStorage.length, 0, "and nothing is kept under the Display tray's keys");
});

test("two panes' buttons keep two sets of switches", () => {
  const other = switches();
  const second = createShowButton(other);
  document.body.append(second.el);
  show.el.click();
  item("Footnote letters").click();
  show.close();
  second.el.click();
  assert.equal(checked()["Footnote letters"], "true", "the second pane still shows them");
  item("Key terms").click();
  second.close();
  assert.deepEqual([...pane.hidden], ["fn"]);
  assert.deepEqual([...other.hidden], ["terms"]);
  second.destroy();
});

test("the menu opens showing what its pane shows now, and follows a change made while it is open", () => {
  pane.hidden.add("fn");
  show.el.click();
  assert.equal(checked()["Footnote letters"], "false");
  assert.equal(checked()["Key terms"], "true");
  // The Reading arrangement turns the rest off behind the open menu.
  for (const id of ["vn", "terms", "highlights"]) pane.hidden.add(id);
  show.sync();
  assert.deepEqual(Object.values(checked()), ["false", "false", "false", "false"]);
});

test("“Hide my marks” hides highlights in every pane; checking the box brings them back", () => {
  show.el.click();
  assert.equal(checked()["My highlights"], "true");
  setHideAll(true); // the key H
  assert.equal(allHidden(), true);
  assert.equal(checked()["My highlights"], "false", "the open menu follows: nothing is drawn now");
  assert.equal(pane.isOn("highlights"), true, "the pane's own switch is as it was");

  item("My highlights").click();
  assert.equal(allHidden(), false, "asking for highlights shows highlights again");
  assert.equal(getSetting("highlights"), "on");
  assert.equal(checked()["My highlights"], "true");
  assert.equal(pane.isOn("highlights"), true);

  // Off in this pane and hidden everywhere: one press turns both around.
  pane.hidden.add("highlights");
  setHideAll(true);
  item("My highlights").click();
  assert.equal(pane.isOn("highlights"), true);
  assert.equal(allHidden(), false);
});

test("a browser that can't draw highlights gets the line disabled, with the reason seen and heard", () => {
  highlights(false);
  show.el.click();
  const b = item("My highlights");
  assert.equal(b.getAttribute("aria-disabled"), "true");
  assert.match(b.querySelector(".desk-title__hint").textContent, /can’t draw them/);
  b.click();
  assert.equal(pane.isOn("highlights"), true, "a press changes nothing");
  const note = document.getElementById(menu().getAttribute("aria-describedby"));
  assert.match(note.textContent, /My highlights is unavailable/);
  // The arrows pass over it.
  items()[2].focus();
  key(items()[2], "ArrowDown");
  assert.equal(focusAt(), 0);
});

test("arrows, Home and End move among the checkboxes; Escape closes and returns focus to the button", () => {
  show.el.click();
  const list = items();
  key(list[0], "ArrowDown");
  assert.equal(focusAt(), 1);
  key(list[1], "End");
  assert.equal(focusAt(), 3);
  key(list[3], "ArrowDown");
  assert.equal(focusAt(), 0, "it wraps");
  key(list[0], "ArrowUp");
  assert.equal(focusAt(), 3, "both ways");
  key(list[3], "Home");
  assert.equal(focusAt(), 0);
  key(list[0], "Escape");
  assert.equal(menu(), null);
  assert.equal(show.el.getAttribute("aria-expanded"), "false");
  assert.ok(onButton());
});

test("a second press of the button, a press elsewhere, and Tab each close the menu", () => {
  show.el.click();
  show.el.click();
  assert.equal(menu(), null, "the button toggles");

  show.el.click();
  menu().dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.ok(menu(), "a press in the menu keeps it");
  document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  assert.equal(menu(), null, "a press elsewhere closes it");

  show.el.click();
  key(items()[0], "Tab");
  assert.equal(menu(), null);
  assert.ok(onButton(), "so Tab moves on from the bar");
});

test("a scroll that leaves the button where it is keeps the menu; one that moves it, or a new window size, closes it", () => {
  // The pane puts its verse back with a scroll of its own when numbers go,
  // and its text scrolls under the open menu.
  show.el.click();
  window.dispatchEvent(new window.Event("scroll"));
  assert.ok(menu(), "the button hasn't moved");
  show.el.getBoundingClientRect = () => ({ left: 0, top: 60, right: 40, bottom: 90, width: 40, height: 30 });
  window.dispatchEvent(new window.Event("scroll"));
  assert.equal(menu(), null, "the page scrolled the button away");

  show.el.click();
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(menu(), null);
});

test("the LIT pane's bar takes Show after its other control, before the error line", () => {
  const openPage = document.createElement("a");
  const bar = createPassageBar({ id: "t", set: () => {}, extra: [openPage, show.el] });
  const kids = [...bar.el.children];
  assert.equal(kids.indexOf(show.el), kids.indexOf(openPage) + 1);
  assert.equal(kids.at(-1).className, "desk-passage__error");
  // One control still works, as the Book Intro pane and the Print menu pass none or one.
  const one = createPassageBar({ id: "u", set: () => {}, extra: document.createElement("a") });
  assert.equal(one.el.querySelectorAll("a").length, 1);
});

// ---- the pane itself ----------------------------------------------------------

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= FakeResizeObserver;
window.ResizeObserver ??= FakeResizeObserver;

/** A LIT pane with the page behind it: a change is kept, then handed back, as desk-page.js does. */
async function litPane(paneId, hide = []) {
  globalThis.fetch = () => new Promise(() => {}); // no chapter ever arrives; the bar doesn't wait for one
  const { createLitPane } = await import("../src/scripts/desk/lit-pane.js");
  let kept = [...hide];
  const asked = [];
  const made = createLitPane({
    paneId,
    start: { bookKey: "john", chapter: 3, verse: null },
    drafts: {},
    onPlace: () => {},
    hide,
    onMark: (id, on) => {
      asked.push([id, on]);
      kept = on ? kept.filter((m) => m !== id) : [...kept, id];
      made.setMarks(kept);
    },
  });
  // The page's own changes (Reading, an undo) go through its layout as well.
  const setMarks = (list) => {
    kept = [...list];
    made.setMarks(list);
  };
  return { ...made, setMarks, asked, kept: () => kept };
}
const marksOn = (el) => ["data-vn", "data-fn", "data-terms", "data-highlights"].map((a) => el.getAttribute(a));

test("every LIT pane carries Show on its bar, whatever the layout, and takes its menu away when it closes", async () => {
  // A layout only says which panes there are: Reading's one pane is this same
  // pane (BVJ, 2026-11-12: "every layout, including Reading").
  const made = await litPane("p9");
  document.body.replaceChildren(made.el);
  const button = made.el.querySelector(".desk-passage > .desk-lit__show");
  assert.ok(button, "on the bar, beside the passage");
  assert.equal(button.previousElementSibling.className, "desk-passage__step desk-lit__open", "after Open on its page");

  button.click();
  assert.equal(items().length, 4);
  made.destroy();
  assert.equal(menu(), null, "a closed pane leaves no menu on the page");
});

test("two LIT panes open at once show different marks, each from its own Show", async () => {
  // BVJ, 2026-11-12: "Different LIT panes open at the same time should be
  // able to have different settings active simultaneously."
  const a = await litPane("p1");
  const b = await litPane("p2", ["terms"]);
  document.body.replaceChildren(a.el, b.el);
  assert.deepEqual(marksOn(a.el), [null, null, null, null], "a pane shows everything until told otherwise");
  assert.deepEqual(marksOn(b.el), [null, null, "off", null], "and opens as the layout kept it");

  a.el.querySelector(".desk-lit__show").click();
  item("Verse and chapter numbers").click();
  item("My highlights").click();
  assert.deepEqual(a.asked, [["vn", false], ["highlights", false]], "the page hears each change, to keep with the pane");
  assert.deepEqual(marksOn(a.el), ["off", null, null, "off"]);
  assert.deepEqual(marksOn(b.el), [null, null, "off", null], "the other pane is as it was");
  assert.deepEqual(Object.values(checked()), ["false", "true", "true", "false"], "the open menu follows its pane");
  for (const attr of PAGE_ATTRS) assert.equal(root.hasAttribute(attr), false, `${attr} is the chapter pages', and stays theirs`);

  // The other pane's menu says what the other pane shows. The press that
  // opens it lands outside the first menu, which closes.
  b.el.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  b.el.querySelector(".desk-lit__show").click();
  assert.deepEqual(Object.values(checked()), ["true", "true", "false", "true"]);
  a.destroy();
  b.destroy();
});

test("the page sets a pane's marks too (Reading, an undo), and the pane tells whoever draws on its text", async () => {
  const made = await litPane("p3");
  document.body.replaceChildren(made.el);
  let heard = 0;
  const hear = (e) => { if (e.detail?.name === "paneMarks" && e.detail.paneId === "p3") heard++; };
  document.addEventListener(SETTINGS_EVENT, hear);
  made.setMarks(["vn", "fn", "terms", "highlights"]); // choosing Reading
  assert.deepEqual(marksOn(made.el), ["off", "off", "off", "off"]);
  assert.equal(heard, 1);
  made.setMarks(["highlights", "terms", "fn", "vn"]);
  assert.equal(heard, 1, "the same marks again change nothing");
  assert.deepEqual(made.kept().toSorted(), ["fn", "highlights", "terms", "vn"]);
  // In Reading, Show says the four are off and turns any of them back on.
  made.el.querySelector(".desk-lit__show").click();
  assert.deepEqual(Object.values(checked()), ["false", "false", "false", "false"]);
  item("Footnote letters").click();
  assert.deepEqual(marksOn(made.el), ["off", null, "off", "off"]);
  assert.deepEqual(made.kept().toSorted(), ["highlights", "terms", "vn"]);
  document.removeEventListener(SETTINGS_EVENT, hear);
  made.destroy();
});

test("a pane's highlights are drawn by its own switch, and by none while “Hide my marks” is on", () => {
  const a = document.createElement("div");
  a.className = "desk-lit";
  const b = a.cloneNode();
  for (const el of [a, b]) el.innerHTML = `<div class="chapter-paragraphs"><p>text</p></div>`;
  document.body.replaceChildren(a, b);
  stampMarks(b, ["highlights"]);
  assert.equal(highlightsShownIn(a.querySelector("p")), true);
  assert.equal(highlightsShownIn(b.querySelector("p")), false);
  setHideAll(true);
  assert.equal(highlightsShownIn(a.querySelector("p")), false);
  setHideAll(false);
  assert.equal(highlightsShownIn(a.querySelector("p")), true);
  stampMarks(b, []);
  assert.equal(highlightsShownIn(b.querySelector("p")), true, "and a mark taken off the list shows again");
});

test("a Reading left on from before panes kept their own marks gives the chapter pages their switches back, once", () => {
  // The old Reading turned Chapter View's switches off and listed them.
  for (const [attr, k] of [["data-vn", "lit-verse-numbers"], ["data-fn", "lit-fn-letters"], ["data-terms", "lit-terms"]]) {
    root.setAttribute(attr, "off");
    localStorage.setItem(k, "off");
  }
  setSetting("highlights", "off");
  localStorage.setItem("lit-desk-reading-off", JSON.stringify(["vn", "terms", "highlights"]));
  undoOldReading();
  assert.equal(root.hasAttribute("data-vn"), false);
  assert.equal(localStorage.getItem("lit-verse-numbers"), null);
  assert.equal(root.hasAttribute("data-terms"), false);
  assert.equal(getSetting("highlights"), "on");
  assert.equal(root.getAttribute("data-fn"), "off", "what Reading hadn't turned off is the reader's own choice");
  assert.equal(localStorage.getItem("lit-fn-letters"), "off");
  assert.equal(localStorage.getItem("lit-desk-reading-off"), null, "and the list is gone");
  // With no list, nothing is touched.
  undoOldReading();
  assert.equal(root.getAttribute("data-fn"), "off");
  for (const bad of ["{}", "nope", "7"]) {
    localStorage.setItem("lit-desk-reading-off", bad);
    undoOldReading();
    assert.equal(localStorage.getItem("lit-desk-reading-off"), null, bad);
    assert.equal(root.getAttribute("data-fn"), "off", bad);
  }
});

// ---- what the browser can't be asked here: the page's markup and the stylesheets ----

test("/desk's Display tray carries no Show group: the page passes no scriptureControls", () => {
  // The tray is drawn at build by SiteHeader.astro, which happy-dom can't run.
  const page = readFileSync(new URL("../src/pages/desk.astro", import.meta.url), "utf8");
  assert.doesNotMatch(page, /scriptureControls=/);
});

test("a pane's text follows its pane's switches, never the chapter pages' (the stylesheets)", () => {
  const css = (name) => readFileSync(new URL(`../src/styles/${name}`, import.meta.url), "utf8");
  const global = css("global.css");
  const desk = css("desk.css");
  // Chapter View's rules leave out a text with switches of its own. Every
  // rule keyed on the page's switch says so, or a pane would follow the page.
  const pageRules = global.match(/html\[data-(?:vn|fn|terms)="off"\][^{,]*/g) ?? [];
  assert.equal(pageRules.length, 4, "numbers, letters, the gap after a number, and key terms");
  for (const rule of pageRules) assert.match(rule, /\.chapter-paragraphs:not\(\[data-own-marks\]\)/, rule.trim());
  // The pane's own, one for each mark the text itself draws.
  for (const sel of [
    '.desk-lit[data-vn="off"] .chapter-paragraphs sup.vn:not(:focus-visible)',
    '.desk-lit[data-fn="off"] .chapter-paragraphs sup.fn-ref:not(:focus-within)',
    '.desk-lit[data-vn="off"] .chapter-paragraphs sup.vn:not(:focus-visible) + .vn-gap',
    '.desk-lit[data-terms="off"] .chapter-paragraphs .term',
    '.desk-lit[data-vn="off"] .desk-lit__heading',
  ]) assert.ok(desk.includes(sel), sel);
  assert.doesNotMatch(desk, /html\[data-(?:vn|fn|terms)=/, "nothing in the desk's stylesheet reads the page's switches");
  // And the pane marks each chapter's text as its own.
  const pane = readFileSync(new URL("../src/scripts/desk/lit-pane.js", import.meta.url), "utf8");
  assert.match(pane, /box\.dataset\.ownMarks = ""/);
});
