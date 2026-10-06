// test/desk-records.test.js
//
// src/lib/desk-records.mjs: the Study Desk's record kinds (STUDY-DESK-FORMAT.md,
// draft 1). The tests that matter most guard the format's principles: unknown
// fields and kinds survive untouched (6), `modified` moves only on an edit (4),
// and a client never rewrites an anchor made on newer text (7).

import { test } from "node:test";
import assert from "node:assert/strict";

import { chapterAnchorText } from "../scripts/lib/anchor-text.mjs";
import {
  COLORS,
  KINDS,
  MARKERS,
  SCHEMA_VERSION,
  TRASH_DAYS,
  canEdit,
  compareContentVersions,
  createRecord,
  editRecord,
  emptyTrashRecord,
  mayRewriteAnchor,
  migrateRecord,
  placeRecord,
  quoteFields,
  restoreFromTrash,
  trashRecord,
  validateRecord,
  verseCopyFor,
} from "../src/lib/desk-records.mjs";

const ctx = {
  now: "2026-10-05T12:00:00.000Z",
  client: "web/2026.10",
  contentVersion: "v20261005.5d2c847d",
  id: "00000000-0000-4000-8000-000000000001",
};

const chapter = chapterAnchorText([
  '<p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup>&nbsp;Love</span> is patient, love is kind.<sup class="fn-ref"><a href="#fn-a">a</a></sup> <span class="vglue"><sup id="v2" class="vn">2</sup>&nbsp;It</span> is not envious.</p>',
  '<p id="t-1-p2">It does not boast. <span class="vglue"><sup id="v3" class="vn">3</sup>&nbsp;Love</span> never fails.</p>',
]);

function highlight(extra = {}) {
  const s = chapter.text.indexOf("patient");
  return createRecord(
    "highlight",
    {
      bookKey: "1corinthians",
      chapter: 13,
      ...quoteFields(chapter, s, s + "patient".length),
      color: "yellow",
      verseCopy: verseCopyFor(chapter, 1),
      verseCopyAsOf: ctx.contentVersion,
      ...extra,
    },
    ctx,
  );
}

test("the constants are the format's lists", () => {
  assert.equal(SCHEMA_VERSION, 1);
  assert.equal(KINDS.length, 10);
  assert.deepEqual(COLORS, ["yellow", "green", "blue", "pink"]);
  assert.equal(MARKERS.length, 7);
});

test("createRecord fills in the fields every record carries", () => {
  const h = highlight();
  assert.deepEqual(
    { id: h.id, kind: h.kind, schema: h.schema, created: h.created, modified: h.modified, client: h.client, contentVersion: h.contentVersion, labels: h.labels },
    { id: ctx.id, kind: "highlight", schema: 1, created: ctx.now, modified: ctx.now, client: ctx.client, contentVersion: ctx.contentVersion, labels: [] },
  );
  assert.deepEqual(h.quote, { exact: "patient", prefix: "Love is ", suffix: ", love is kind. It is not enviou" });
  assert.equal(h.verse, 1);
  assert.equal(h.endVerse, 1);
  assert.equal(h.verseCopy, "Love is patient, love is kind.");
  assert.deepEqual(validateRecord(h), []);
});

test("createRecord makes a random UUID when none is given", () => {
  const { id, ...rest } = ctx;
  const a = createRecord("label", { name: "Lent" }, rest);
  const b = createRecord("label", { name: "Lent" }, rest);
  assert.match(a.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a.id, b.id);
  void id;
});

test("createRecord refuses an unknown kind, a trash record, and fixed fields passed in", () => {
  assert.throws(() => createRecord("scribble", {}, ctx));
  assert.throws(() => createRecord("trash", {}, ctx));
  assert.throws(() => createRecord("label", { name: "x", id: "mine" }, ctx));
});

test("editRecord moves modified and keeps every field it wasn't told to change, known or not", () => {
  const h = { ...highlight(), futureField: { kept: true } };
  const later = "2026-10-06T09:30:00.000Z";
  const e = editRecord(h, { color: "green" }, { now: later, client: "web/2026.11" });
  assert.equal(e.color, "green");
  assert.equal(e.modified, later);
  assert.equal(e.created, h.created);
  assert.equal(e.client, "web/2026.11");
  assert.deepEqual(e.futureField, { kept: true });
  assert.deepEqual(e.quote, h.quote);
  assert.equal(h.color, "yellow", "the original is not mutated");
});

test("editRecord refuses to change a fixed field", () => {
  assert.throws(() => editRecord(highlight(), { created: "2020-01-01T00:00:00Z" }, ctx));
});

test("a record of an unknown kind or a newer schema can't be edited, and survives validation whole", () => {
  const future = { ...highlight(), schema: 2, color: "teal" };
  const alien = { ...highlight(), kind: "voiceMemo", audio: "…" };
  for (const r of [future, alien]) {
    assert.equal(canEdit(r), false);
    assert.throws(() => editRecord(r, { color: "pink" }, ctx));
    assert.deepEqual(validateRecord(r), [], "its own fields aren't this code's to judge");
    assert.equal(migrateRecord(r), r);
  }
  assert.equal(canEdit({ ...highlight(), kind: "trash" }), false);
});

test("validateRecord names the problems with known fields", () => {
  const bad = { ...highlight(), color: "teal", chapter: 99, quote: { exact: "", prefix: "", suffix: "" } };
  const problems = validateRecord(bad);
  assert.ok(problems.some((p) => p.startsWith('color "teal"')), problems.join("; "));
  assert.ok(problems.some((p) => p.startsWith("chapter")), problems.join("; "));
  assert.ok(problems.some((p) => p.startsWith("quote.exact")), problems.join("; "));
});

test("a note on a glossary term needs no verse", () => {
  const n = createRecord("note", { glossaryId: "flesh-body", body: "Paul's word for the self turned inward.", marker: "note" }, ctx);
  assert.deepEqual(validateRecord(n), []);
});

test("placeRecord: a quoted record resolves; a whole-verse record is found while its verses exist", () => {
  const h = highlight();
  assert.deepEqual(placeRecord(chapter, h), { status: "found", start: 8, end: 15 });
  const n = createRecord("note", { bookKey: "1corinthians", chapter: 13, verse: 2, endVerse: 3, body: "", marker: "question" }, ctx);
  const r = placeRecord(chapter, n);
  assert.equal(r.status, "found");
  assert.equal(chapter.text.slice(r.start, r.end), "It is not envious. It does not boast. Love never fails.");
  assert.equal(placeRecord(chapter, { ...n, verse: 9, endVerse: 9 }).status, "lost");
});

test("content versions order by date; one day's two publishes can't be ordered", () => {
  assert.equal(compareContentVersions("v20261004.aaaaaaaa", "v20261005.bbbbbbbb"), -1);
  assert.equal(compareContentVersions("v20261005.bbbbbbbb", "v20261004.aaaaaaaa"), 1);
  assert.equal(compareContentVersions("v20261005.bbbbbbbb", "v20261005.bbbbbbbb"), 0);
  assert.equal(compareContentVersions("v20261005.aaaaaaaa", "v20261005.bbbbbbbb"), null);
  assert.equal(compareContentVersions("garbage", "v20261005.bbbbbbbb"), null);
});

test("mayRewriteAnchor: never on older text than the record, nor when it can't tell", () => {
  const h = highlight();
  assert.equal(mayRewriteAnchor(h, "v20261005.5d2c847d"), true);
  assert.equal(mayRewriteAnchor(h, "v20261101.00000000"), true);
  assert.equal(mayRewriteAnchor(h, "v20261001.00000000"), false);
  assert.equal(mayRewriteAnchor(h, "v20261005.00000000"), false);
});

/* ── Deleting (provisional: STUDY-DESK.md, talk-through item 20) ───────── */

const later = "2026-10-06T09:30:00.000Z";
const trashCtx = { now: later, client: "web/2026.10", contentVersion: ctx.contentVersion };

test("trashRecord holds the whole record, unknown fields included, under a new id", () => {
  const h = { ...highlight(), futureField: { kept: true } };
  const t = trashRecord(h, { ...trashCtx, id: "trash-1" });
  assert.equal(t.id, "trash-1");
  assert.equal(t.kind, "trash");
  assert.equal(t.schema, SCHEMA_VERSION);
  assert.equal(t.created, later);
  assert.equal(t.modified, later);
  assert.equal(t.deletedId, h.id);
  assert.equal(t.deletedAt, later);
  assert.deepEqual(t.record, h);
  assert.deepEqual(validateRecord(t), []);
  assert.equal(canEdit(t), false, "a trash record is written whole, never edited");
});

test("trashRecord makes its own id, and refuses to delete a trash record", () => {
  const t = trashRecord(highlight(), trashCtx);
  assert.notEqual(t.id, ctx.id);
  assert.throws(() => trashRecord(t, ctx));
  assert.throws(() => trashRecord(null, ctx));
});

test("restoreFromTrash brings the record back with modified moved, since undoing is the reader acting", () => {
  const h = { ...highlight(), futureField: 1 };
  const t = trashRecord(h, trashCtx);
  const back = restoreFromTrash(t, { now: "2026-10-06T09:31:00.000Z", client: "web/2026.11" });
  assert.equal(back.id, h.id);
  assert.equal(back.created, h.created);
  assert.equal(back.modified, "2026-10-06T09:31:00.000Z");
  assert.equal(back.client, "web/2026.11");
  assert.equal(back.futureField, 1);
  assert.deepEqual(back.quote, h.quote);
});

test("restoreFromTrash returns a record it can't edit exactly as it was deleted", () => {
  const alien = { ...highlight(), kind: "voiceMemo", audio: "…" };
  const t = trashRecord(alien, trashCtx);
  assert.equal(restoreFromTrash(t, { now: "2026-10-07T00:00:00.000Z" }), alien);
  assert.throws(() => restoreFromTrash(highlight(), ctx));
});

test("emptyTrashRecord keeps only the tombstone, and only after 30 days", () => {
  const t = trashRecord(highlight(), { ...trashCtx, now: "2026-10-01T00:00:00.000Z" });
  assert.equal(TRASH_DAYS, 30);
  assert.equal(emptyTrashRecord(t, "2026-10-30T23:59:59.000Z"), t, "not due on day 29");
  const empty = emptyTrashRecord(t, "2026-10-31T00:00:00.000Z");
  assert.equal("record" in empty, false);
  assert.equal(empty.deletedId, t.deletedId);
  assert.equal(empty.deletedAt, t.deletedAt);
  assert.equal(empty.modified, t.modified, "emptying isn't the reader changing anything");
  assert.equal(emptyTrashRecord(empty, "2027-01-01T00:00:00.000Z"), empty);
  assert.equal(restoreFromTrash(empty, ctx), null, "nothing left to bring back");
  const h = highlight();
  assert.equal(emptyTrashRecord(h, "2030-01-01T00:00:00.000Z"), h, "only trash records are emptied");
});
