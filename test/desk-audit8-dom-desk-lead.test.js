// What /desk's leading LIT pane tells the page, driven (Audit 8, LG8-8: cut
// from desk-page.js into desk/desk-lead.js). The follow's own rules are
// bookmark-follow's; these hold the reporting: only a move of the leading
// pane's place is told, the opening place isn't, and a tour tells nothing.
// Continue reading (desk-last-read.js) is what shows it here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, resetDom } from "./helpers/browser-env.mjs";

const { createLeadReporter } = await import("../src/scripts/desk/desk-lead.js");
const { originalLayout, panes, setLitAt } = await import("../src/lib/desk-layout.mjs");
const { LAST_READ_WAIT_MS } = await import("../src/scripts/desk/desk-last-read.js");

const ctx = () => ({ client: "web/test", contentVersion: "v1" });
const lastRead = () => JSON.parse(localStorage.getItem("lit_last_read") ?? "null");

function desk({ frozen = false } = {}) {
  resetDom("http://localhost/desk/");
  localStorage.clear();
  let layout = originalLayout("john 3:16");
  const lit = panes(layout.root).find((p) => p.kind === "lit");
  const reporter = createLeadReporter({ store: null, ctx, drafts: { mark: [16] }, getLayout: () => layout, frozen: () => frozen });
  return { reporter, move: (at) => { layout = setLitAt(layout, lit.id, at); }, unfreeze: () => { frozen = false; } };
}

test("the leading pane's place, in last-read's shape", () => {
  const { reporter } = desk();
  assert.deepEqual(reporter.position(), { book: "john", chapter: 3, verse: 16, view: "desk" });
});

test("a commit that doesn't move the leading pane tells nothing; one that does is kept for Continue reading", async () => {
  const { reporter, move } = desk();
  reporter.tell();
  await settle(LAST_READ_WAIT_MS + 50);
  assert.equal(lastRead(), null, "the opening place isn't reading");
  move("romans 8:3");
  reporter.tell();
  await settle(LAST_READ_WAIT_MS + 50);
  assert.equal(lastRead()?.book, "romans");
  assert.equal(lastRead()?.chapter, 8);
  assert.equal(lastRead()?.verse, 3);
});

test("while a tour has the panes, nothing is told; a draft chapter is never kept", async () => {
  const t = desk({ frozen: true });
  t.move("romans 8:3");
  t.reporter.tell();
  await settle(LAST_READ_WAIT_MS + 50);
  assert.equal(lastRead(), null, "frozen");
  t.unfreeze();
  t.move("mark 16:9");
  t.reporter.tell();
  await settle(LAST_READ_WAIT_MS + 50);
  assert.equal(lastRead(), null, "a draft");
});
