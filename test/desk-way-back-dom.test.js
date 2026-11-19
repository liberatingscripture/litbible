// A LIT pane's way back after a jump (E168), driven in a browser DOM: the
// LIT pane (lit-pane.js) with its button (lit-back.js), the passage bar's
// typed place against its arrows (passage-bar.js), and the routes in
// desk-panes.js and intro-pane.js that mark a move as a jump.
//
// Chapter pages are fetched, so `fetch` is stubbed: the chapters a test goes
// to answer at once, and any other (the pane filling in around its place)
// waits forever, so a pane holds one chapter and happy-dom's zero-sized
// layout puts its last verse at the reading line.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, window } from "./helpers/browser-env.mjs";

const ANSWER = new Set(["/john-3", "/romans-8", "/acts-2", "/mark-1", "/mark-2"]);
globalThis.fetch = (url) => {
  const path = String(url).split("?")[0].replace(/\/$/, "");
  const [, book, chapter] = /^\/([0-9a-z]+)-(\d+)$/.exec(path) ?? [];
  if (!ANSWER.has(path)) return new Promise(() => {});
  const verse = (n) => `<span data-verse="${n}"><sup class="vn" id="v${n}">${n}</sup>Words of ${book} ${chapter}:${n}. </span>`;
  const html = `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">
    <p>${verse(1)}${verse(4)}${verse(16)}</p></div></article></body></html>`;
  return Promise.resolve({ ok: true, status: 200, text: async () => html });
};

class FakeResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
globalThis.ResizeObserver ??= FakeResizeObserver;
window.ResizeObserver ??= FakeResizeObserver;

const { createLitPane } = await import("../src/scripts/desk/lit-pane.js");
const { mountPane } = await import("../src/scripts/desk/desk-panes.js");
const { createIntroPane } = await import("../src/scripts/desk/intro-pane.js");
const { initUndo } = await import("../src/scripts/desk/undo-bar.js");
initUndo();

const at = (bookKey, chapter, verse = null) => ({ bookKey, chapter, verse });

function litPane(start = at("john", 3, 16)) {
  const told = [];
  const pane = createLitPane({ paneId: `p${Math.random().toString(36).slice(2, 7)}`, start, drafts: {}, onPlace: (p) => told.push(p) });
  document.body.append(pane.el);
  return { pane, told, ...partsOf(pane.el) };
}

function partsOf(root) {
  return {
    back: root.querySelector(".desk-lit__back"),
    scroller: root.querySelector(".desk-lit__scroll"),
    field: root.querySelector(".desk-passage__field"),
    steps: () => [...root.querySelectorAll(".desk-passage__step[data-step]")],
    form: root.querySelector("form.desk-passage"),
  };
}

const showing = (back) => Boolean(back) && !back.hidden;

/** The reader scrolls the text: a wheel, then the scroll it makes. */
async function scrollAsReader(scroller) {
  scroller.dispatchEvent(new window.WheelEvent("wheel", { bubbles: true }));
  scroller.dispatchEvent(new window.Event("scroll"));
  await settle(20);
}

function type(field, form, text) {
  field.value = text;
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

test("the bar has no way back until a jump, then names where the pane was", async () => {
  const { pane, back } = litPane();
  await settle(20);
  assert.ok(back, "the button is in the bar");
  assert.equal(back.parentElement.className, "desk-passage", "first on the passage bar");
  assert.equal(back.parentElement.firstElementChild, back);
  assert.equal(showing(back), false, "absent before a jump");

  pane.goTo(at("romans", 8, 1), { jump: true });
  await settle(20);
  assert.equal(showing(back), true);
  assert.equal(back.textContent.trim(), "John 3:16");
  assert.equal(back.getAttribute("aria-label"), "Back to John 3:16");
  assert.equal(back.getAttribute("data-tip"), "Back to John 3:16", "the shared tooltip, for the arrow alone");
  assert.equal(back.getAttribute("title"), "", "never the browser's own tooltip");
  assert.deepEqual(pane.backPlace(), at("john", 3, 16));
  pane.destroy();
});

test("a move that isn't a jump makes no way back", async () => {
  const { pane, back } = litPane();
  await settle(20);
  pane.goTo(at("romans", 8, 1));
  await settle(20);
  assert.equal(showing(back), false);
  pane.destroy();
});

test("scrolling at a result keeps the way back (BVJ: “What if I search, jump to a result, scroll to see the context, and then want to go back?”)", async () => {
  const { pane, back, scroller, told } = litPane();
  await settle(20);
  pane.goTo(at("romans", 8, 1), { jump: true });
  await settle(20);
  await scrollAsReader(scroller);
  assert.deepEqual(told.at(-1), at("romans", 8, 16), "the reader's scroll reported a place");
  assert.equal(showing(back), true, "still there after scrolling");
  assert.equal(back.textContent.trim(), "John 3:16");

  told.length = 0;
  back.click();
  await settle(20);
  assert.deepEqual(told, [at("john", 3, 16)], "Back reports the place, so the panes that follow come too");
  assert.equal(pane.el.querySelector(".desk-passage__field").value, "John 3:16");
  assert.equal(showing(back), false, "nothing older: gone");
  pane.destroy();
});

test("read on at a result and jump again: Back steps through both places, then goes", async () => {
  const { pane, back, scroller } = litPane();
  await settle(20);
  pane.goTo(at("romans", 8, 1), { jump: true });
  await settle(20);
  await scrollAsReader(scroller); // read on to Romans 8:16
  pane.goTo(at("acts", 2, 1), { jump: true });
  await settle(20);
  assert.equal(back.textContent.trim(), "Romans 8:16", "the place read on to is the newest");

  back.focus();
  back.click();
  await settle(20);
  assert.equal(back.textContent.trim(), "John 3:16", "then the place before it");
  assert.equal(document.activeElement, back, "still there, so it keeps the focus for another press");

  back.click();
  await settle(70);
  assert.equal(showing(back), false);
  assert.equal(document.activeElement, scroller, "gone, it hands the focus to the text it brought back");
  assert.equal(document.querySelector("[data-undo-live]")?.textContent, "Back at John 3:16.");
  pane.destroy();
});

test("clicking through results with no reading between keeps the place before the first", async () => {
  const { pane, back } = litPane();
  await settle(20);
  pane.goTo(at("romans", 8, 1), { jump: true });
  pane.goTo(at("acts", 2, 1), { jump: true });
  pane.goTo(at("mark", 1, 1), { jump: true });
  await settle(20);
  assert.equal(back.textContent.trim(), "John 3:16");
  back.click();
  await settle(20);
  assert.equal(showing(back), false, "one press goes all the way back");
  pane.destroy();
});

test("a place typed in the bar is a jump; the chapter arrows are not", async () => {
  const { pane, back, field, form, steps } = litPane();
  await settle(20);
  steps()[1].click(); // John 4
  await settle(20);
  assert.equal(showing(back), false, "an arrow makes no way back");

  type(field, form, "Mark 1:4");
  await settle(20);
  assert.equal(showing(back), true);
  assert.equal(back.textContent.trim(), "John 4", "the place the arrow reached");

  steps()[1].click(); // Mark 2
  await settle(20);
  assert.equal(back.textContent.trim(), "John 4", "an arrow after a jump keeps the way back");
  pane.destroy();
});

test("forgetBack drops the way back (a tour starting or ending)", async () => {
  const { pane, back } = litPane();
  await settle(20);
  pane.goTo(at("romans", 8, 1), { jump: true });
  await settle(20);
  pane.forgetBack();
  assert.equal(showing(back), false);
  assert.equal(pane.backPlace(), null);
  pane.destroy();
});

test("desk-panes passes a jump to the LIT pane, and only a jump", async () => {
  const body = document.createElement("div");
  document.body.append(body);
  const pane = { id: "lit9", get: () => at("john", 3, 16), set: () => {}, getHide: () => [], setMark: () => {} };
  const lit = mountPane("lit", body, { drafts: {}, showPassage: () => {} }, pane);
  await settle(20);
  const back = body.querySelector(".desk-lit__back");
  lit.setPassage(at("romans", 8, 1));
  await settle(20);
  assert.equal(showing(back), false, "a following move");
  lit.setPassage(at("acts", 2, 1), { jump: true });
  await settle(20);
  assert.equal(showing(back), true);
  assert.equal(back.textContent.trim(), "Romans 8:1");
  assert.deepEqual(lit.backPlace(), at("romans", 8, 1));
  lit.forgetBack();
  assert.equal(showing(back), false);
  lit.destroy();
  body.remove();
});

test("a following pane's typed place asks for a jump, and its arrows don't", async () => {
  const body = document.createElement("div");
  document.body.append(body);
  const asked = [];
  const pane = { id: "fn9", get: () => at("john", 3, 16), set: (p, how) => asked.push({ p, jump: Boolean(how?.jump) }) };
  const fns = mountPane("footnotes", body, { store: null, showPassage: () => {} }, pane);
  await settle(20);
  const { field, form, steps } = partsOf(body);
  type(field, form, "Romans 8");
  steps()[1].click();
  assert.deepEqual(asked.map((a) => a.jump), [true, false]);
  assert.deepEqual(asked[0].p, at("romans", 8));
  fns.destroy();
  body.remove();
});

test("a book picked from the Book Intro pane's list asks for a jump, and its arrows don't", async () => {
  const asked = [];
  const pane = createIntroPane({
    paneId: "in9",
    start: at("john", 3, 16),
    set: (p, how) => asked.push({ p, jump: Boolean(how?.jump) }),
    showPassage: () => {},
  });
  document.body.append(pane.el);
  await settle(20);
  const select = pane.el.querySelector("select");
  select.value = "romans";
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  const next = [...pane.el.querySelectorAll("button")].find((b) => /next/i.test(b.getAttribute("aria-label") ?? ""));
  assert.ok(next, "the next-book arrow");
  next.click();
  assert.deepEqual(asked.map((a) => a.jump), [true, false]);
  assert.deepEqual(asked[0].p, at("romans", 1));
  pane.destroy();
});
