// What a sheet shows beside its parts, driven in a browser DOM (Audit 8):
// the license card's commercial check (sheet-lit.js), the formatting
// toolbar's Paragraph style button (sheet-text.js), and the presenter view
// (sheet-present.js). These replace the source checks that stood in
// desk-audit8-b-writers.test.js.
//
// - GF8b-1: the commercial check's live region changes only when its counts do.
// - GF8b-2: unticking the box while a count runs leaves the check empty.
// - GF8b-13: a share just over half shows a tenth, so "over" has a reason.
// - XA8-5: the Paragraph style button's name holds the style it shows.
// - SH8-6, XA8-9: the presenter view moves focus off a control it is about to disable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

// The presenter view's clock ticks every second; it mustn't keep node alive.
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms, ...args) => {
  const t = realInterval(fn, ms, ...args);
  t.unref?.();
  return t;
};
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};

const words = (n, w = "word") => Array.from({ length: n }, () => w).join(" ");
// John 3:1, as a chapter page the passages are read from: 126 words of LIT.
const LIT_WORDS = 126;
globalThis.fetch = window.fetch = async (url) => {
  if (!/\/john-3\/?$/.test(String(url))) return new Response("", { status: 404 });
  return new Response(
    `<!doctype html><html data-content-version="v1"><body><article class="chapter"><div class="chapter-paragraphs">` +
      `<p><span data-verse="1"><sup class="vn" id="v1">1</sup> ${words(LIT_WORDS, "grace")}</span></p>` +
      `</div></article></body></html>`,
    { status: 200, headers: { "content-type": "text/html" } },
  );
};

const { createLicenseCard } = await import("../src/scripts/desk/sheets/sheet-lit.js");
const { createSheetText } = await import("../src/scripts/desk/sheets/sheet-text.js");
const { showPresenterView } = await import("../src/scripts/desk/sheets/sheet-present.js");

const ctx = () => ({ now: new Date().toISOString(), client: "web/test", contentVersion: "v1" });

async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** The license card on a sheet the test changes, as the editor would. */
function licenseCard(sheet) {
  let current = sheet;
  const card = createLicenseCard({ getSheet: () => current, readOnly: false, setCommercial: async () => true, idPrefix: "t" });
  document.body.replaceChildren(card.el);
  const check = card.el.querySelector(".desk-sheet__check");
  return {
    check,
    change(next) {
      current = next;
      card.sheetChanged();
    },
  };
}

const textSheet = (html, extra = {}) => ({ ...createSheet({ title: "Study", modules: [makeModule("text", { html })] }, ctx()), commercial: true, ...extra });

test("the commercial check's live region is left alone by a save that changes no count, and redrawn by one that does (GF8b-1)", async () => {
  const first = textSheet("<p>one two three</p>");
  const { check, change } = licenseCard(first);
  await until(() => check.querySelector("ul"), 3000, "the check");
  const list = check.querySelector("ul");
  const seen = [];
  const watch = new MutationObserver((records) => seen.push(...records));
  watch.observe(check, { childList: true, subtree: true, characterData: true });
  // Autosaves while typing: the modules change, the counts don't.
  change({ ...first, modules: [{ ...first.modules[0], html: "<p>four five six</p>" }] });
  await settle(50);
  change({ ...first, modules: [{ ...first.modules[0], html: "<p>seven eight nine</p>" }] });
  await settle(50);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(seen.length, 0, "nothing in the live region moved");
  assert.ok(check.querySelector("ul") === list);
  // A word more: the count moved, so the list is new.
  change({ ...first, modules: [{ ...first.modules[0], html: "<p>seven eight nine ten</p>" }] });
  await until(() => check.querySelector("ul") !== list, 3000, "the redrawn check");
  watch.disconnect();
});

test("unticking the commercial box while a count runs leaves the check empty (GF8b-2)", async () => {
  const on = textSheet("<p>one two</p>");
  const { check, change } = licenseCard({ ...on, commercial: false });
  change(on); // a count starts
  change({ ...on, commercial: false }); // unticked before it ends
  await settle(100);
  assert.equal(check.childElementCount, 0);
});

test("a LIT share just over half shows a tenth of a percent, not a round 50% marked over (GF8b-13)", async () => {
  // 126 words of LIT against 124 of the leader's own: 50.4%.
  const passage = makeModule("passage", { bookKey: "john", chapter: 3, verse: 1, endVerse: 1 });
  const own = makeModule("text", { html: `<p>${words(124 - 1, "mine")}</p>` });
  const sheet = { ...createSheet({ title: "Study", modules: [passage, own] }, ctx()), commercial: true };
  const { check } = licenseCard(sheet);
  await until(() => check.querySelector("li"), 3000, "the check");
  const line = check.querySelector("li").textContent;
  assert.match(line, /LIT material: 126 of 250 words \(50\.4%\)\. The commercial terms allow at most 50%\./);
  assert.ok(check.querySelector("li").classList.contains("is-over"));
});

test("the Paragraph style button's name follows the style its words show (XA8-5)", async () => {
  const ed = createSheetText({ html: "<h2>A heading</h2><p>Some words</p>", label: "Your text", placeholder: "", idPrefix: "x", onChange: () => {} });
  document.body.replaceChildren(ed.el);
  const block = [...ed.el.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Paragraph style"));
  const caretIn = (node) => {
    const r = document.createRange();
    r.setStart(node.firstChild, 1);
    r.collapse(true);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  };
  const text = ed.el.querySelector(".desk-rich");
  caretIn(text.querySelector("h2"));
  assert.match(block.textContent, /Heading/);
  assert.equal(block.getAttribute("aria-label"), "Paragraph style: Heading");
  caretIn(text.querySelector("p"));
  assert.equal(block.getAttribute("aria-label"), "Paragraph style: Paragraph");
  ed.destroy();
});

test("the presenter view moves focus to Blank before it disables the focused Next or Previous (SH8-6, XA8-9)", async () => {
  const sheet = createSheet({
    title: "Study",
    modules: [makeModule("text", { html: "<p>First part</p>" }), makeModule("text", { html: "<p>Second part</p>" })],
  }, ctx());
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  await showPresenterView({ root, sheet, store: null });
  const controls = root.querySelector(".present-presenter__controls");
  const named = (label) => [...controls.querySelectorAll("button")].find((b) => b.textContent === label);
  const next = named("Next ›");
  const prev = named("‹ Previous");
  const blank = named("Blank the room’s screen");
  next.focus();
  while (!next.disabled) next.click();
  assert.ok(document.activeElement === blank, "Next went off at the last screen, and focus went to Blank first");
  prev.focus();
  while (!prev.disabled) prev.click();
  assert.ok(document.activeElement === blank, "Previous went off at the first screen, and focus went to Blank first");
  // XA8-6: the label stays put and the pressed state says whether the room is dark.
  assert.equal(blank.getAttribute("aria-pressed"), "false");
  blank.click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(blank.getAttribute("aria-pressed"), "true");
  assert.equal(blank.textContent, "Blank the room’s screen");
  window.dispatchEvent(new Event("pagehide")); // closes its channel
});
