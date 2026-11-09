// The lists of sheets driven in a browser DOM (Audit 8): a row's buttons
// (my-sheets.js, shared by a Sheets pane and /sheets/) with a fake store, and
// /sheets/' own list (sheet-page.js) over the real notebook store on
// fake-indexeddb, with a second store on the same database as another tab.
//
// - SH8-1 (LV8-1): a save anywhere redraws /sheets/' rows alone, off the
//   page, and only when they changed; "New sheet…"'s chooser and focus stay.
// - SH8-5: a failed Delete says so, and a second press waits for the first.
// - XA8-4: "Save as template"'s accessible name starts with its visible words.
// - XA8-15: a row button that can't be used stays reachable and says why.
// - XA8-8: importing a shared sheet is announced through a region always on the page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle } from "./helpers/browser-env.mjs";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createSheet, makeModule, planSheetChange, setSheetFields, updateModule } from "../src/lib/desk-sheets.mjs";

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;
// An open channel keeps node alive; the stores here are never closed.
const RealChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class extends RealChannel {
  constructor(name) {
    super(name);
    this.unref?.();
  }
};
// The Sheets tour's offer has nothing to offer (its seen list says never).
localStorage.setItem("lit-desk-sheet-tour", "never");

const { mySheetsList } = await import("../src/scripts/desk/sheets/my-sheets.js");
const { openStore } = await import("../src/scripts/desk/store.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const opCtx = () => ({ now: new Date().toISOString(), ...ctx() });
const sheetOf = (title, modules = [makeModule("text", { html: "<p>Words</p>" })], extra = {}) =>
  ({ ...createSheet({ title, modules }, opCtx()), ...extra });

/** Waits until `fn()` is truthy, or fails after `ms`. */
async function until(fn, ms = 3000, what = "the condition") {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A Sheets pane's list, with a host whose store the test answers. */
function paneList(sheets, store = {}) {
  const content = document.createElement("div");
  const said = [];
  const host = {
    store: { remove: async () => null, get: async () => null, save: async () => {}, lastEntry: () => null, ...store },
    opCtx,
    idSuffix: "t",
    say: (t) => said.push(t),
    content,
    openSheet: async () => {},
    startFrom: () => {},
    showList: async () => {},
    onTour: null,
  };
  const { list } = mySheetsList(host, { sheets, mine: [] });
  content.append(list);
  document.body.replaceChildren(content);
  return { content, said, host };
}

const rowButton = (content, label) =>
  [...content.querySelectorAll(".desk-sheet__sheet button")].find((b) => b.textContent === label);

test("Save as template is named by its visible words first (XA8-4)", () => {
  const { content } = paneList([sheetOf("Romans 8 study")]);
  const keep = rowButton(content, "Save as template");
  assert.equal(keep.getAttribute("aria-label"), "Save as template, Romans 8 study");
  assert.ok(keep.getAttribute("aria-label").startsWith(keep.textContent));
});

test("a row button that can't be used stays reachable, says why, and does nothing when pressed (XA8-15)", async () => {
  // A sheet of passages alone can't make a template; one of a newer format can't be copied.
  let reads = 0;
  const passagesOnly = sheetOf("Readings", [makeModule("passage", { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 })]);
  const newer = sheetOf("From the future", undefined, { sheetFormat: 99 });
  const { content } = paneList([passagesOnly, newer], { get: async () => (reads++, null) });
  const rows = [...content.querySelectorAll(".desk-sheet__sheet")];
  const row = (title) => rows.find((li) => li.textContent.includes(title));
  const cases = [
    [row("Readings"), "Save as template", /only passages/],
    [row("From the future"), "Duplicate", /newer version/],
    [row("From the future"), "Save as template", /newer version/],
  ];
  for (const [li, label, why] of cases) {
    const b = [...li.querySelectorAll("button")].find((x) => x.textContent === label);
    assert.equal(b.disabled, false, `${label} is not disabled, so a keyboard reaches it`);
    assert.equal(b.getAttribute("aria-disabled"), "true");
    b.focus();
    assert.ok(document.activeElement === b, `${label} takes focus`);
    const hint = document.getElementById(b.getAttribute("aria-describedby"));
    assert.ok(hint && li.contains(hint), `${label}'s reason is in the row`);
    assert.match(hint.textContent, why);
    assert.ok(hint.classList.contains("sr-only"));
    b.click();
  }
  await settle();
  assert.equal(reads, 0, "no press reached Duplicate or Save as template");
});

test("a Delete that fails says so under the heading, and a second press while it runs sends nothing (SH8-5)", async () => {
  let calls = 0;
  let fail;
  const { content, said } = paneList([sheetOf("Psalm study")], {
    remove: () => {
      calls++;
      return new Promise((_, reject) => { fail = reject; });
    },
  });
  const del = rowButton(content, "Delete");
  del.click();
  del.click();
  await settle();
  assert.equal(calls, 1, "the second press waited for the first");
  assert.equal(del.getAttribute("aria-disabled"), "true", "busy while the delete runs");
  const error = console.error;
  console.error = () => {};
  try {
    fail(new Error("QuotaExceededError"));
    await settle();
  } finally {
    console.error = error;
  }
  const line = content.querySelector(".desk-sheet__list-head + .desk-sheet__made-not");
  assert.ok(line, "a problem line under the list's heading");
  assert.match(line.textContent, /The sheet couldn’t be deleted in this browser/);
  assert.ok(said.includes(line.textContent), "and it is heard");
  assert.equal(del.hasAttribute("aria-disabled"), false, "Delete can be pressed again");
  assert.ok(content.contains(del), "the row is still there");
});

/* ── /sheets/ itself (sheet-page.js), over the real store ─────────────── */

let page = null; // { root, other }

/** /sheets/ with two sheets, drawn by sheet-page.js; `other` is another tab's store. */
async function sheetsPage() {
  if (page) return page;
  const other = await openStore({ ctx });
  const one = sheetOf("Alpha study");
  const two = sheetOf("Beta study");
  await other.save(one);
  await other.save(two);
  document.body.replaceChildren();
  const root = document.createElement("div");
  root.dataset.sheetPage = "";
  document.body.append(root);
  document.documentElement.dataset.desk = "on";
  window.happyDOM.setURL("http://localhost/sheets/");
  await import("../src/scripts/desk/sheets/sheet-page.js");
  await until(() => root.querySelectorAll(".desk-sheet__sheet").length === 2, 5000, "the list's rows");
  page = { root, other, one, two };
  return page;
}

/** A change to a stored sheet, as another tab makes it. */
const elsewhere = (store, id, op) => store.change(async ({ get }) => planSheetChange(await get(id), op));
const rowNames = (root) => [...root.querySelectorAll(".desk-sheet__open-name")].map((n) => n.textContent);

test("on /sheets/, a save elsewhere that changes no row leaves the list as it is: the chooser open, focus in it (SH8-1)", async () => {
  const { root, other, one } = await sheetsPage();
  const fresh = [...root.querySelectorAll("button")].find((b) => b.textContent === "New sheet…");
  fresh.click();
  await until(() => root.querySelector(".desk-sheet__templates:not([hidden])"), 5000, "the template chooser");
  const chooser = root.querySelector(".desk-sheet__templates");
  const pick = chooser.querySelector("button");
  assert.ok(document.activeElement === pick, "the first template has focus");
  const rows = [...root.querySelectorAll(".desk-sheet__sheet")];
  // Another tab types in a part: nothing a row shows moves.
  const part = one.modules[0].id;
  await elsewhere(other, one.id, (s) => updateModule(s, part, { html: "<p>Other words</p>" }, opCtx()));
  await settle(150);
  assert.ok(root.contains(chooser) && !chooser.hidden, "the chooser is still open");
  assert.ok(document.activeElement === pick, "focus stayed on the template");
  assert.ok([...root.querySelectorAll(".desk-sheet__sheet")].every((li, i) => li === rows[i]), "the same rows, not drawn again");
});

test("on /sheets/, a rename elsewhere redraws the rows alone, keeping the chooser, and focus on a row's own button (SH8-1)", async () => {
  const { root, other, two } = await sheetsPage();
  const chooser = root.querySelector(".desk-sheet__templates");
  assert.ok(chooser && !chooser.hidden, "the chooser from the test before is open");
  // Focus on the Delete button of Alpha's row; another tab renames Beta.
  const deleteAlpha = () => [...root.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Delete Alpha study");
  const alphaDelete = deleteAlpha();
  alphaDelete.focus();
  await elsewhere(other, two.id, (s) => setSheetFields(s, { title: "Gamma study" }, opCtx()));
  await until(() => rowNames(root).includes("Gamma study"), 3000, "the renamed row");
  assert.ok(root.contains(chooser) && !chooser.hidden, "the chooser is untouched");
  assert.ok(document.activeElement !== alphaDelete, "the rows were drawn again");
  assert.ok(document.activeElement === deleteAlpha(), "focus is on Alpha's Delete, not the row's name or the page");
  assert.equal(root.querySelectorAll(".desk-sheet__sheet").length, 2);
});

test("importing a shared sheet on /sheets/ is announced through the undo bar's region (XA8-8)", async () => {
  const { root } = await sheetsPage();
  const { shareFragment } = await import("../src/lib/desk-sheet-share.mjs");
  const fragment = await shareFragment(sheetOf("Shared study"));
  history.replaceState({ litSharedSheet: fragment }, "", "/sheets/");
  window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  const take = await (async () => {
    let b = null;
    await until(() => (b = [...root.querySelectorAll("button")].find((x) => x.textContent === "Import into my notebook")), 5000, "the Import button");
    return b;
  })();
  take.click();
  await until(() => document.querySelector("[data-undo-live]")?.textContent, 5000, "the announcement");
  assert.equal(document.querySelector("[data-undo-live]").textContent, "Copied into your notebook. Change it here with Edit, or on the Study Desk.");
  assert.ok(!root.contains(document.querySelector("[data-undo-live]")), "the region was already in the page, outside the view");
  const line = [...root.querySelectorAll("p.sheets-page__shared")].find((p) => p.textContent.startsWith("Copied"));
  assert.ok(line, "the line is still shown");
  assert.equal(line.getAttribute("role"), null, "and isn't a second live region");
});
