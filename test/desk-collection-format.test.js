// test/desk-collection-format.test.js
//
// The collection record (STUDY-DESK-FORMAT.md, "Collections (kind 12)"): the
// check in src/lib/desk-collection-format.mjs, reached through validateRecord
// as the store reaches it, and what canEdit says of a newer format. The model
// (making, changing and showing a collection) is test/desk-collections.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { KINDS, canEdit, createRecord, editRecord, validateRecord } from "../src/lib/desk-records.mjs";
import {
  COLLECTION_FORMAT,
  COLLECTION_LIMITS,
  COLLECTION_ORDERS,
  MEMBER_TYPES,
  collectionOrder,
  collectionTooBig,
  validateCollection,
} from "../src/lib/desk-collection-format.mjs";
import { planSave } from "../src/lib/desk-store-core.mjs";

const ctx = { now: "2026-11-18T09:00:00.000Z", client: "web/2026.11", contentVersion: "v20261118.1a2b3c4d" };
let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const passage = (fields = {}) => ({ id: nextId(), type: "passage", bookKey: "luke", chapter: 1, verse: 26, endVerse: 38, ...fields });
const item = (recordId = nextId()) => ({ id: nextId(), type: "item", recordId });
const rule = (label = nextId(), except = []) => ({ id: nextId(), type: "rule", match: { kind: "bookmark", label }, except });
const heading = (text = "Week one") => ({ id: nextId(), type: "heading", text });

function collection(fields = {}) {
  return createRecord(
    "collection",
    { collectionFormat: COLLECTION_FORMAT, name: "Advent series", order: "bible", members: [], ...fields },
    ctx,
  );
}

const problemsOf = (r) => validateRecord(r);

test("collection is a kind a record can be, with its member types, orders and limits", () => {
  assert.ok(KINDS.includes("collection"));
  assert.deepEqual(MEMBER_TYPES, ["item", "passage", "rule", "heading"]);
  assert.deepEqual(COLLECTION_ORDERS, ["bible", "type", "mine"]);
  assert.deepEqual(
    { ...COLLECTION_LIMITS },
    { bytes: 524288, members: 1000, name: 200, description: 1000, heading: 200 },
  );
});

test("a collection with one member of each type passes", () => {
  const c = collection({
    description: "Four weeks with the Thursday group",
    order: "mine",
    members: [heading(), passage(), item(), rule(), passage({ verse: 39, endVerse: undefined })],
  });
  assert.deepEqual(problemsOf(c), []);
  assert.deepEqual(problemsOf(collection()), [], "an empty collection is a collection");
});

test("a name is required, 1 to 200 characters, and needn't be unique", () => {
  assert.ok(problemsOf(collection({ name: "" })).some((p) => /name/.test(p)));
  assert.ok(problemsOf(collection({ name: 7 })).some((p) => /name/.test(p)));
  assert.deepEqual(problemsOf(collection({ name: "x".repeat(200) })), []);
  assert.ok(problemsOf(collection({ name: "x".repeat(201) })).some((p) => /name/.test(p)));
  // Characters, not UTF-16 units: 200 emoji are 200 characters.
  assert.deepEqual(problemsOf(collection({ name: "🕯".repeat(200) })), []);
  // Two collections may share a name: nothing in the format compares them.
  assert.deepEqual([problemsOf(collection()), problemsOf(collection())], [[], []]);
});

test("a description is optional and at most 1,000 characters", () => {
  assert.deepEqual(problemsOf(collection({ description: "x".repeat(1000) })), []);
  assert.ok(problemsOf(collection({ description: "x".repeat(1001) })).some((p) => /description/.test(p)));
  assert.ok(problemsOf(collection({ description: 5 })).some((p) => /description/.test(p)));
});

test("an order this code doesn't know is kept, and shown as Bible order", () => {
  const c = collection({ order: "date" });
  assert.deepEqual(problemsOf(c), []);
  assert.equal(collectionOrder(c), "bible");
  assert.equal(collectionOrder(collection({ order: undefined })), "bible");
  assert.equal(collectionOrder(collection({ order: "type" })), "type");
  assert.equal(collectionOrder(collection({ order: "mine" })), "mine");
  assert.ok(problemsOf(collection({ order: 3 })).some((p) => /order/.test(p)));
});

test("collectionFormat must be a positive integer", () => {
  assert.ok(problemsOf(collection({ collectionFormat: 0 })).some((p) => /collectionFormat/.test(p)));
  assert.ok(problemsOf(collection({ collectionFormat: "1" })).some((p) => /collectionFormat/.test(p)));
});

test("members: a list of objects with unique ids and a type", () => {
  assert.ok(problemsOf(collection({ members: {} })).some((p) => /members is not a list/.test(p)));
  assert.ok(problemsOf(collection({ members: [null] })).some((p) => /Member 1 is not an object/.test(p)));
  const a = item();
  assert.ok(problemsOf(collection({ members: [a, { ...item(), id: a.id }] })).some((p) => /repeats the id/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ id: nextId() }] })).some((p) => /has no type/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ type: "item", recordId: "r" }] })).some((p) => /has no id/.test(p)));
});

test("an item names a record; a heading's text is at most 200 characters", () => {
  assert.ok(problemsOf(collection({ members: [{ id: nextId(), type: "item", recordId: "" }] })).some((p) => /recordId/.test(p)));
  assert.deepEqual(problemsOf(collection({ members: [heading("x".repeat(200))] })), []);
  assert.ok(problemsOf(collection({ members: [heading("x".repeat(201))] })).some((p) => /heading/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ id: nextId(), type: "heading" }] })).some((p) => /heading/.test(p)));
});

test("a passage is checked as a sheet's verses are, and a quote on one is kept, not read", () => {
  assert.deepEqual(problemsOf(collection({ members: [passage({ verseCopy: "words", verseCopyAsOf: ctx.contentVersion })] })), []);
  assert.ok(problemsOf(collection({ members: [passage({ bookKey: "genesis" })] })).some((p) => /bookKey/.test(p)));
  assert.ok(problemsOf(collection({ members: [passage({ chapter: 25 })] })).some((p) => /chapter/.test(p)));
  assert.ok(problemsOf(collection({ members: [passage({ verse: 0 })] })).some((p) => /verse/.test(p)));
  assert.ok(problemsOf(collection({ members: [passage({ endVerse: 20 })] })).some((p) => /endVerse/.test(p)));
  assert.ok(problemsOf(collection({ members: [passage({ verse: 201, endVerse: 201 })] })).some((p) => /past 200/.test(p)));
  assert.ok(problemsOf(collection({ members: [passage({ verseCopy: 3 })] })).some((p) => /verseCopy/.test(p)));
  // No blanks or footnotes are needed, and a quote (even a malformed one) isn't read.
  assert.deepEqual(problemsOf(collection({ members: [passage({ quote: { exact: "Greetings" } })] })), []);
  assert.deepEqual(problemsOf(collection({ members: [passage({ quote: 12 })] })), []);
});

test("a bookmark rule names a label and lists what it leaves out", () => {
  assert.ok(problemsOf(collection({ members: [{ id: nextId(), type: "rule" }] })).some((p) => /match/.test(p)));
  assert.ok(problemsOf(collection({ members: [rule("")] })).some((p) => /match\.label/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ ...rule(), except: "x" }] })).some((p) => /except/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ ...rule(), except: [1] }] })).some((p) => /except/.test(p)));
});

test("a bookmark rule's exceptAt, where a left-out item stood, is a map of places (E201)", () => {
  const place = { memberId: nextId(), after: nextId(), before: null };
  assert.deepEqual(problemsOf(collection({ members: [{ ...rule(), exceptAt: { [nextId()]: place } }] })), []);
  assert.deepEqual(problemsOf(collection({ members: [{ ...rule(), exceptAt: { [nextId()]: {} } }] })), [], "every id may be absent");
  assert.ok(problemsOf(collection({ members: [{ ...rule(), exceptAt: [] }] })).some((p) => /exceptAt/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ ...rule(), exceptAt: { x: "after" } }] })).some((p) => /exceptAt/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ ...rule(), exceptAt: { x: { after: 3 } } }] })).some((p) => /exceptAt/.test(p)));
  assert.ok(problemsOf(collection({ members: [{ ...rule(), exceptAt: { x: { before: "" } } }] })).some((p) => /exceptAt/.test(p)));
});

test("what this code doesn't know is kept, not refused (principle 6)", () => {
  const c = collection({
    members: [
      { id: nextId(), type: "search", query: "liberation" },
      { id: nextId(), type: "rule", match: { kind: "highlight", color: "yellow" } },
      { ...rule(), weight: 3 },
    ],
    cover: { color: "sky" },
  });
  assert.deepEqual(problemsOf(c), []);
});

test("past 1,000 members, or past 512 KB, a collection is refused in words collectionTooBig knows", () => {
  const full = collection({ members: Array.from({ length: 1000 }, () => item()) });
  assert.deepEqual(problemsOf(full), []);
  const over = collection({ members: [...full.members, item()] });
  const many = problemsOf(over);
  assert.ok(many.some((p) => /at most 1000 members/.test(p)));
  assert.throws(() => planSave(over), (err) => collectionTooBig(err));

  // A thousand passages of a few verses with their words fit; a few huge ones don't.
  const copy = "word ".repeat(60);
  const thousand = collection({ members: Array.from({ length: 1000 }, (_, i) => passage({ verse: (i % 190) + 1, endVerse: (i % 190) + 1, verseCopy: copy })) });
  assert.deepEqual(problemsOf(thousand), [], "a thousand one-verse passages fit in 512 KB");
  const huge = collection({ members: Array.from({ length: 10 }, () => passage({ verseCopy: "x".repeat(60000) })) });
  const big = validateCollection(huge);
  assert.deepEqual(big, ["a collection is at most 512 KB"], "too big is reason enough; members aren't listed");
  assert.throws(() => planSave(huge), (err) => collectionTooBig(err));
  assert.equal(collectionTooBig(new Error("something else")), false);
});

test("a collection in a newer format is carried, never edited", () => {
  const newer = collection({ collectionFormat: COLLECTION_FORMAT + 1, members: [{ id: nextId(), type: "search" }] });
  assert.equal(canEdit(newer), false);
  assert.throws(() => editRecord(newer, { name: "Lent" }, ctx), /can't be edited/);
  assert.deepEqual(problemsOf(newer), []);
  assert.equal(canEdit(collection()), true);
});

test("the shared merge vectors' collections pass the check", () => {
  const vectors = JSON.parse(readFileSync(new URL("./fixtures/merge-vectors.json", import.meta.url), "utf8"));
  const found = [];
  for (const c of vectors.cases) {
    for (const r of [...c.local, ...c.incoming, ...c.expect]) {
      const record = r.kind === "trash" ? r.record : r;
      if (record?.kind !== "collection") continue;
      found.push(c.name);
      assert.deepEqual(validateRecord(record), [], `${c.name}: ${record.id}`);
    }
  }
  assert.deepEqual(
    [...new Set(found)].sort(),
    ["a-collection-newer-wins-whole", "b-collection-deleted-after-edit", "keep-collection-newer-format"],
  );
});
