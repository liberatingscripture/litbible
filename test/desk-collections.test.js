// test/desk-collections.test.js
//
// Collections (STUDY-DESK.md, D13; STUDY-DESK-FORMAT.md, "Collections (kind
// 12)"): the model in src/lib/desk-collections.mjs. Making one, every change
// it takes and how a change is planned and written, the three orders and a
// rule's bookmarks in each, moving in My order, the ways in (the five used
// most recently, which collections hold a verse), and the highlight carry at
// the model's level (planHighlight's side is in test/desk-highlights.test.js).
// The record's own check is test/desk-collection-format.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import { canEdit, createRecord, trashRecord, validateRecord } from "../src/lib/desk-records.mjs";
import { COLLECTION_FORMAT, COLLECTION_LIMITS } from "../src/lib/desk-collection-format.mjs";
import {
  ADD_MENU_COLLECTIONS,
  addHeading,
  addItems,
  addMenuCollections,
  addPassage,
  addRule,
  addableCollections,
  bringBack,
  carryHighlights,
  collectionCount,
  collectionName,
  collectionOutline,
  collectionRows,
  collectionTooBig,
  collectionsHolding,
  createCollection,
  editHeading,
  holdsPassage,
  labelBookmarks,
  leaveOut,
  moveRow,
  moveTarget,
  needsAllCollections,
  passageMember,
  planAddItems,
  planAddPassage,
  planCollectionChange,
  planLabelRulesToItems,
  pruneMembers,
  removeItem,
  removeMember,
  removeRule,
  ruleToItems,
  rulesUsing,
  sameVerses,
  setCollectionFields,
  setOrder,
} from "../src/lib/desk-collections.mjs";
import { describeEntry, makeEntry } from "../src/lib/desk-history.mjs";
import { planWrite } from "../src/lib/desk-store-core.mjs";

const VERSION = "v20261118.1a2b3c4d";
const T0 = "2026-11-18T09:00:00.000Z";
const T1 = "2026-11-18T10:00:00.000Z";
const T2 = "2026-11-18T11:00:00.000Z";
const ctx = { now: T0, client: "web/2026.11", contentVersion: VERSION };
const at = (now) => ({ ...ctx, now });

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const make = (kind, fields, now = T0) => createRecord(kind, fields, { ...ctx, now, id: nextId() });

const label = (name) => make("label", { name });
const bookmark = (bookKey, chapter, verse, labels = [], now = T0) =>
  make("bookmark", { bookKey, chapter, verse, endVerse: verse, label: "", labels }, now);
const note = (bookKey, chapter, verse, now = T0) => make("note", { bookKey, chapter, verse, endVerse: verse, body: "A note", marker: "note" }, now);
const highlight = (bookKey, chapter, verse, now = T0) => make("highlight", { bookKey, chapter, verse, endVerse: verse, color: "yellow" }, now);
const sheet = (title, now = T0) => make("sheet", { title, sheetFormat: 1, modules: [] }, now);
const gloss = (now = T0) => make("note", { glossaryEntry: "hupotasso", targetTitle: "Hupotasso", body: "No verse", marker: "note" }, now);

/** What a row stands for, in a few characters, so an order reads at a glance. */
function show(row) {
  if (row.type === "group") return `[${row.title}]`;
  if (row.type === "heading") return `# ${row.text}`;
  if (row.type === "passage") {
    const m = row.member;
    return `P ${m.bookKey} ${m.chapter}:${m.verse}${m.endVerse && m.endVerse !== m.verse ? `-${m.endVerse}` : ""}`;
  }
  const r = row.record;
  const where = r.bookKey ? ` ${r.bookKey} ${r.chapter}:${r.verse}` : r.kind === "sheet" ? ` ${r.title}` : "";
  return `${r.kind}${where}${row.rule ? " (rule)" : ""}`;
}
const shown = (c, records, order) => collectionRows(c, records, { order }).rows.map(show);

/* ── Making one ──────────────────────────────────────────────────────── */

test("createCollection: a named collection in Bible order, with no members", () => {
  const c = createCollection({ name: "  Advent \n series ", description: "  Four weeks\r\nwith the group  " }, ctx);
  assert.equal(c.kind, "collection");
  assert.equal(c.collectionFormat, COLLECTION_FORMAT);
  assert.equal(c.name, "Advent series", "whitespace is collapsed and trimmed");
  assert.equal(c.description, "Four weeks\nwith the group");
  assert.equal(c.order, "bible");
  assert.deepEqual(c.members, []);
  assert.equal(c.created, T0);
  assert.deepEqual(validateRecord(c), []);

  assert.equal("description" in createCollection({ name: "Lent" }, ctx), false, "no description, no field");
  assert.throws(() => createCollection({ name: "   " }, ctx), /needs a name/);
  assert.throws(() => createCollection({ name: "​" }, ctx), /needs a name/);
  assert.throws(() => createCollection({ name: "x".repeat(201) }, ctx), /at most 200/);
  assert.throws(() => createCollection({ name: "Lent", description: "x".repeat(1001) }, ctx), /at most 1000/);
  assert.equal(collectionName(c), "Advent series");
  assert.equal(collectionName({ name: "" }), "Untitled collection");
});

test("passageMember keeps whole verses and the verse copy, and leaves a sheet passage's quote behind", () => {
  const m = passageMember({
    bookKey: "luke",
    chapter: 1,
    verse: 26,
    endVerse: 38,
    verseCopy: "In the sixth month",
    verseCopyAsOf: VERSION,
    quote: { exact: "sixth", prefix: "", suffix: "" },
    blanks: [],
    footnotes: [],
  });
  assert.deepEqual(Object.keys(m).sort(), ["bookKey", "chapter", "endVerse", "id", "type", "verse", "verseCopy", "verseCopyAsOf"]);
  assert.equal(m.type, "passage");
  assert.equal("endVerse" in passageMember({ bookKey: "luke", chapter: 1, verse: 26 }), false);
  assert.ok(sameVerses({ bookKey: "luke", chapter: 1, verse: 3 }, { bookKey: "luke", chapter: 1, verse: 3, endVerse: 3 }), "no endVerse is the first verse");
  assert.ok(!sameVerses({ bookKey: "luke", chapter: 1, verse: 3 }, { bookKey: "luke", chapter: 1, verse: 3, endVerse: 4 }));
});

/* ── Changing one ────────────────────────────────────────────────────── */

test("setCollectionFields renames and describes; the same words change nothing", () => {
  const c = createCollection({ name: "Advent", description: "Four weeks" }, ctx);
  assert.equal(setCollectionFields(c, { name: " Advent " }, at(T1)), c, "the very same object");
  assert.equal(setCollectionFields(c, { description: "Four weeks" }, at(T1)), c);
  const renamed = setCollectionFields(c, { name: "Advent, year C" }, at(T1));
  assert.equal(renamed.name, "Advent, year C");
  assert.equal(renamed.modified, T1);
  const bare = setCollectionFields(c, { description: "  " }, at(T1));
  assert.equal("description" in bare, false, "an empty description takes the field away");
  assert.deepEqual(validateRecord(bare), []);
  assert.throws(() => setCollectionFields(c, { order: "mine" }, at(T1)), /isn't a field to set here/);
  assert.throws(() => setCollectionFields(c, { name: "" }, at(T1)), /needs a name/);
});

test("addItems appends what isn't held yet, once each, at the end", () => {
  const [a, b] = [note("john", 3, 16), note("romans", 8, 3)];
  const c = createCollection({ name: "Love" }, ctx);
  const one = addItems(c, [a.id, a.id], at(T1));
  assert.deepEqual(one.members.map((m) => m.recordId), [a.id], "a repeat in one call goes in once");
  const two = addItems(one, [a.id, b.id], at(T2));
  assert.deepEqual(two.members.map((m) => m.recordId), [a.id, b.id]);
  assert.equal(addItems(two, [a.id, b.id], at(T2)), two, "all held: nothing changes");
  assert.deepEqual(validateRecord(two), []);
});

test("addPassage refuses the same verses twice and never writes a quote", () => {
  const c = createCollection({ name: "Annunciation" }, ctx);
  const one = addPassage(c, { bookKey: "luke", chapter: 1, verse: 26, endVerse: 38, quote: { exact: "x", prefix: "", suffix: "" } }, at(T1));
  assert.equal(one.members.length, 1);
  assert.equal("quote" in one.members[0], false);
  assert.ok(holdsPassage(one, { bookKey: "luke", chapter: 1, verse: 26, endVerse: 38 }));
  assert.equal(addPassage(one, { bookKey: "luke", chapter: 1, verse: 26, endVerse: 38 }, at(T2)), one);
  const two = addPassage(one, { bookKey: "luke", chapter: 1, verse: 26, endVerse: 27 }, at(T2));
  assert.equal(two.members.length, 2, "other verses are another passage");
  const three = addPassage(two, { bookKey: "luke", chapter: 1, verse: 46 }, at(T2));
  assert.equal(addPassage(three, { bookKey: "luke", chapter: 1, verse: 46, endVerse: 46 }, at(T2)), three, "46 is 46–46");
});

test("addRule adds one rule per label, whichever of its ids is named", () => {
  const advent = label("Advent");
  const twin = { ...label("advent"), created: T1 }; // the same label, kept as two records
  const records = [advent, twin];
  const c = createCollection({ name: "Advent" }, ctx);
  const one = addRule(c, advent.id, records, at(T1));
  assert.deepEqual(one.members[0].match, { kind: "bookmark", label: advent.id });
  assert.deepEqual(one.members[0].except, []);
  assert.equal(addRule(one, twin.id, records, at(T2)), one);
  assert.deepEqual(validateRecord(one), []);
});

test("removing: a member, a rule (its items stay), and every item for a record", () => {
  const advent = label("Advent");
  const b = bookmark("luke", 2, 7, [advent.id]);
  const n = note("luke", 2, 8);
  const records = [advent, b, n];
  let c = createCollection({ name: "Advent" }, ctx);
  c = addItems(c, [b.id, n.id], at(T1));
  c = addRule(c, advent.id, records, at(T1));
  const ruleId = c.members[2].id;
  const noRule = removeRule(c, ruleId, at(T2));
  assert.deepEqual(noRule.members.map((m) => m.type), ["item", "item"]);
  assert.throws(() => removeRule(c, c.members[0].id, at(T2)), /is not a rule/);
  assert.deepEqual(removeMember(c, c.members[0].id, at(T2)).members.map((m) => m.recordId ?? m.type), [n.id, "rule"]);
  assert.throws(() => removeMember(c, "nope", at(T2)), /no member/);
  assert.deepEqual(removeItem(c, n.id, at(T2)).members.map((m) => m.recordId ?? m.type), [b.id, "rule"]);
  assert.equal(removeItem(c, "not-held", at(T2)), c);
});

test("leaving a bookmark out, and bringing it back", () => {
  const advent = label("Advent");
  const b1 = bookmark("luke", 1, 26, [advent.id]);
  const b2 = bookmark("luke", 2, 7, [advent.id]);
  const records = [advent, b1, b2];
  let c = createCollection({ name: "Advent" }, ctx);
  c = addRule(c, advent.id, records, at(T1));
  c = addItems(c, [b1.id], at(T1));
  assert.deepEqual(shown(c, records, "bible"), ["bookmark luke 1:26 (rule)", "bookmark luke 2:7 (rule)"]);

  const out = leaveOut(c, b1.id, records, at(T2));
  assert.deepEqual(out.members.find((m) => m.type === "rule").except, [b1.id]);
  assert.equal(out.members.some((m) => m.recordId === b1.id), false, "its item goes too");
  assert.deepEqual(shown(out, records, "bible"), ["bookmark luke 2:7 (rule)"]);
  const info = collectionRows(out, records).rules[0];
  assert.deepEqual(info.leftOut.map((r) => r.id), [b1.id]);
  assert.equal(leaveOut(out, b1.id, records, at(T2)), out, "already out");

  const back = bringBack(out, b1.id, at(T2));
  assert.deepEqual(back.members.find((m) => m.type === "rule").except, []);
  assert.deepEqual(shown(back, records, "bible"), ["bookmark luke 1:26 (rule)", "bookmark luke 2:7 (rule)"]);
  assert.equal(bringBack(back, b1.id, at(T2)), back);
});

test("ruleToItems: the rule's bookmarks become items at the end, in Bible order, and the rule goes", () => {
  const advent = label("Advent");
  const late = bookmark("matthew", 2, 1, [advent.id]);
  const early = bookmark("matthew", 1, 18, [advent.id]);
  const left = bookmark("luke", 1, 5, [advent.id]);
  const n = note("john", 1, 14);
  const records = [advent, late, early, left, n];
  let c = createCollection({ name: "Advent" }, ctx);
  c = addRule(c, advent.id, records, at(T1));
  c = addItems(c, [n.id, late.id], at(T1));
  c = leaveOut(c, left.id, records, at(T1));
  const before = shown(c, records, "mine");
  const turned = ruleToItems(c, c.members[0].id, records, at(T2));
  assert.deepEqual(turned.members.map((m) => m.type), ["item", "item", "item"]);
  assert.deepEqual(turned.members.map((m) => m.recordId), [n.id, late.id, early.id], "only one not held already, and none left out");
  assert.deepEqual(shown(turned, records, "mine"), before.map((s) => s.replace(" (rule)", "")), "My order looks the same");
});

test("deleting a label a rule uses: the rules that use it, turned into items in one plan", () => {
  const advent = label("Advent");
  const lent = label("Lent");
  const b = bookmark("luke", 2, 7, [advent.id]);
  let one = createCollection({ name: "Advent series" }, at(T0));
  one = addRule(one, advent.id, [advent], at(T0));
  let two = createCollection({ name: "Seasons" }, at(T0));
  two = addRule(addRule(two, lent.id, [lent], at(T0)), advent.id, [advent], at(T0));
  const records = [advent, lent, b, one, two];
  assert.deepEqual(rulesUsing(records, advent.id).map((u) => u.collection.name), ["Advent series", "Seasons"]);
  assert.deepEqual(labelBookmarks(records, advent.id).map((r) => r.id), [b.id]);
  const plan = planLabelRulesToItems(records, advent.id, at(T1));
  assert.deepEqual(plan.refused, []);
  assert.equal(plan.put.length, 2);
  for (const c of plan.put) {
    assert.equal(c.members.some((m) => m.type === "rule" && m.match.label === advent.id), false);
    assert.ok(c.members.some((m) => m.type === "item" && m.recordId === b.id));
  }
  assert.ok(plan.put.find((c) => c.name === "Seasons").members.some((m) => m.type === "rule"), "the Lent rule stays");
  assert.doesNotThrow(() => planWrite(plan));
});

test("headings: added at the end or before a row, edited, and each switches to My order", () => {
  const n1 = note("luke", 1, 26);
  const n2 = note("luke", 2, 7);
  const records = [n1, n2];
  let c = createCollection({ name: "Advent" }, ctx);
  c = addItems(c, [n1.id, n2.id], at(T1));
  const end = addHeading(c, "  Later ", null, records, at(T2));
  assert.equal(end.order, "mine");
  assert.deepEqual(shown(end, records, "mine"), ["note luke 1:26", "note luke 2:7", "# Later"]);
  const second = c.members[1].id;
  const mid = addHeading(c, "Week two", second, records, at(T2));
  assert.deepEqual(shown(mid, records, "mine"), ["note luke 1:26", "# Week two", "note luke 2:7"]);
  assert.deepEqual(shown(mid, records, "bible"), ["note luke 1:26", "note luke 2:7"], "headings show in My order only");
  const h = mid.members[1].id;
  assert.equal(editHeading(mid, h, "Week two", at(T2)), mid);
  assert.equal(editHeading(mid, h, "Week 2", at(T2)).members[1].text, "Week 2");
  assert.throws(() => editHeading(mid, h, "x".repeat(201), at(T2)), /at most 200/);
  assert.throws(() => editHeading(mid, mid.members[0].id, "x", at(T2)), /is not a heading/);
});

test("setOrder: one of the three, and the same order changes nothing", () => {
  const c = createCollection({ name: "Advent" }, ctx);
  assert.equal(setOrder(c, "bible", at(T1)), c);
  assert.equal(setOrder({ ...c, order: undefined }, "bible", at(T1)).order, undefined, "absent is Bible order already");
  assert.equal(setOrder(c, "type", at(T1)).order, "type");
  assert.throws(() => setOrder(c, "date", at(T1)), /not one of/);
});

/* ── The planner ─────────────────────────────────────────────────────── */

test("planCollectionChange: gone, refused, unchanged, and a change written whole", () => {
  const n = note("john", 3, 16);
  const c = createCollection({ name: "Love" }, ctx);
  const records = [n, c];
  assert.deepEqual(planCollectionChange(records, "missing", (x) => x), { gone: true });
  assert.deepEqual(planCollectionChange(records, n.id, (x) => x), { gone: true }, "not a collection");
  const newer = { ...c, id: nextId(), collectionFormat: COLLECTION_FORMAT + 1 };
  assert.deepEqual(planCollectionChange([newer], newer.id, (x) => x), { gone: true }, "a newer format can't be changed here");
  const trash = trashRecord(c, at(T1));
  assert.deepEqual(planCollectionChange([n, trash], c.id, (x) => x), { gone: true }, "deleted meanwhile");

  assert.deepEqual(planCollectionChange(records, c.id, (x) => setOrder(x, "bible", at(T1))), { collection: c, changed: false });
  const refused = planCollectionChange(records, c.id, (x) => setOrder(x, "date", at(T1)));
  assert.match(refused.refused.message, /not one of/);

  const plan = planCollectionChange(records, c.id, (x) => addItems(x, [n.id], at(T1)));
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.put, [plan.collection]);
  assert.deepEqual(plan.remove, []);
  assert.equal(plan.collection.modified, T1);
  assert.doesNotThrow(() => planWrite(plan));
});

test("the 1,001st member is refused, and a collection past 512 KB isn't saved", () => {
  const ids = Array.from({ length: COLLECTION_LIMITS.members }, nextId);
  const c = createCollection({ name: "Everything" }, ctx);
  const full = addItems(c, ids, at(T1));
  assert.equal(full.members.length, 1000);
  const records = [full];
  const plan = planAddItems(records, full.id, [nextId()], at(T2));
  assert.ok(collectionTooBig(plan.refused), "the member limit, in words collectionTooBig knows");
  assert.deepEqual(plan.added, []);
  assert.ok(collectionTooBig(planAddPassage(records, full.id, { bookKey: "luke", chapter: 1, verse: 1 }, at(T2)).refused));
  assert.ok(collectionTooBig(planCollectionChange(records, full.id, (x) => addHeading(x, "More", null, records, at(T2))).refused));

  const roomy = createCollection({ name: "Long passages" }, ctx);
  const big = { ...roomy, members: Array.from({ length: 8 }, (_, i) => ({ ...passageMember({ bookKey: "luke", chapter: 1, verse: i + 1 }), verseCopy: "x".repeat(64000) })) };
  assert.throws(
    () => planAddPassage([big], big.id, { bookKey: "luke", chapter: 1, verse: 9, verseCopy: "x".repeat(64000) }, at(T2)),
    (err) => collectionTooBig(err),
    "over 512 KB, planSave throws and nothing is written",
  );
});

test("planAddItems reports what was new; planAddPassage says when the verses were there already", () => {
  const [a, b] = [note("john", 3, 16), note("john", 3, 17)];
  let c = createCollection({ name: "Love" }, ctx);
  c = addItems(c, [a.id], at(T0));
  const plan = planAddItems([a, b, c], c.id, [a.id, b.id], at(T1));
  assert.deepEqual(plan.added, [b.id]);
  const none = planAddItems([a, b, plan.collection], c.id, [a.id, b.id], at(T2));
  assert.deepEqual([none.changed, none.added], [false, []]);

  const p = planAddPassage([c], c.id, { bookKey: "john", chapter: 3, verse: 16, endVerse: 17 }, at(T1));
  assert.deepEqual([p.changed, p.again], [true, false]);
  const again = planAddPassage([p.collection], c.id, { bookKey: "john", chapter: 3, verse: 16, endVerse: 17 }, at(T2));
  assert.deepEqual([again.changed, again.again], [false, true]);
});

test("every write drops items whose record is gone for good, and keeps those in the trash or not here", () => {
  const [a, b, d] = [note("john", 3, 16), note("john", 3, 17), note("john", 3, 18)];
  let c = createCollection({ name: "Love" }, ctx);
  c = addItems(c, [a.id, b.id, d.id, "not-synced-yet"], at(T0));
  const inTrash = trashRecord(a, at(T1));
  const tombstone = (() => {
    const t = trashRecord(b, at(T1));
    delete t.record;
    return t;
  })();
  const records = [inTrash, tombstone, d, c];
  assert.deepEqual(pruneMembers(c, records).members.map((m) => m.recordId), [a.id, d.id, "not-synced-yet"]);
  assert.equal(pruneMembers(c, [d, c]), c, "nothing gone, the same object");

  const plan = planCollectionChange(records, c.id, (x) => setOrder(x, "type", at(T2)));
  assert.deepEqual(plan.collection.members.map((m) => m.recordId), [a.id, d.id, "not-synced-yet"]);
  const still = planCollectionChange(records, c.id, (x) => x);
  assert.equal(still.changed, false, "pruning alone is never a write");
});

/* ── What it shows ───────────────────────────────────────────────────── */

/** A collection with one of everything, for the order tests. */
function everything() {
  const advent = label("Advent");
  const s1 = sheet("Week one", T1);
  const s2 = sheet("Week two", T0);
  const n = note("luke", 1, 26);
  const h = highlight("luke", 1, 26);
  const g = gloss();
  const m1 = bookmark("matthew", 1, 18, [advent.id]);
  const lukeB = bookmark("luke", 2, 7, [advent.id]);
  const pin = make("footnotePin", { bookKey: "john", chapter: 1, verse: 1, endVerse: 1, footnote: "Or Word" });
  const lbl = label("Not holdable");
  const records = [advent, s1, s2, n, h, g, m1, lukeB, pin, lbl];
  let c = createCollection({ name: "Advent" }, ctx);
  c = addItems(c, [s1.id, h.id, g.id, lbl.id, "not-here"], at(T1));
  c = addPassage(c, { bookKey: "luke", chapter: 1, verse: 26, endVerse: 38 }, at(T1));
  c = addItems(c, [n.id, s2.id, pin.id, lukeB.id], at(T1));
  c = addRule(c, advent.id, records, at(T1));
  c = { ...c, members: [...c.members, { id: nextId(), type: "search", query: "light" }] };
  records.push(c);
  return { c, records, advent, s1, s2, n, h, g, m1, lukeB, pin };
}

test("Bible order: sheets first, then the verses in Bible order (a passage first), then what has no verse", () => {
  const { c, records } = everything();
  assert.deepEqual(shown(c, records, "bible"), [
    "[Sheets]",
    "sheet Week one",
    "sheet Week two",
    "bookmark matthew 1:18 (rule)",
    "P luke 1:26-38",
    "note luke 1:26", // two records on one verse: made first, then the smaller id
    "highlight luke 1:26",
    "bookmark luke 2:7 (rule)",
    "footnotePin john 1:1",
    "note",
  ]);
});

test("By type: Sheets, Passages, Notes, Highlights, Bookmarks, Pinned footnotes, each in Bible order", () => {
  const { c, records } = everything();
  assert.deepEqual(shown(c, records, "type"), [
    "[Sheets]",
    "sheet Week one",
    "sheet Week two",
    "[Passages]",
    "P luke 1:26-38",
    "[Notes]",
    "note luke 1:26",
    "note",
    "[Highlights]",
    "highlight luke 1:26",
    "[Bookmarks]",
    "bookmark matthew 1:18 (rule)",
    "bookmark luke 2:7 (rule)",
    "[Pinned footnotes]",
    "footnotePin john 1:1",
  ]);
  const { records: r2 } = everything();
  const notesOnly = createCollection({ name: "Notes" }, ctx);
  assert.deepEqual(shown(addItems(notesOnly, [r2[3].id], ctx), r2, "type"), ["[Notes]", "note luke 1:26"], "empty groups are left out");
});

test("My order: the members as they stand, then the rule's bookmarks not held, in Bible order", () => {
  const { c, records } = everything();
  assert.deepEqual(shown(c, records, "mine"), [
    "sheet Week one",
    "highlight luke 1:26",
    "note",
    "P luke 1:26-38",
    "note luke 1:26",
    "sheet Week two",
    "footnotePin john 1:1",
    "bookmark luke 2:7 (rule)",
    "bookmark matthew 1:18 (rule)",
  ]);
});

test("a collection's own order is used when none is asked for, and shown counts each thing once", () => {
  const { c, records } = everything();
  assert.equal(collectionRows(c, records).order, "bible");
  assert.equal(collectionRows({ ...c, order: "date" }, records).order, "bible", "an order this code doesn't know");
  assert.equal(collectionRows({ ...c, order: "mine" }, records).order, "mine");
  // Nine things: two sheets, a passage, a highlight, two notes, a pin, two bookmarks
  // (the Luke one held as an item and reached by the rule, shown once).
  assert.equal(collectionCount(c, records), 9);
  for (const order of ["bible", "type", "mine"]) {
    const rows = collectionRows(c, records, { order }).rows.filter((r) => r.type === "record");
    assert.equal(new Set(rows.map((r) => r.record.id)).size, rows.length, `${order}: each record once`);
  }
});

test("left out of the view but kept: the trash, kinds a collection can't hold, unknown member types", () => {
  const { c, records, n } = everything();
  const trashed = records.filter((r) => r.id !== n.id).concat(trashRecord(n, at(T2)));
  assert.equal(shown(c, trashed, "bible").includes("note luke 1:26"), false);
  assert.equal(c.members.length, 12, "every member is still there");
  assert.deepEqual(validateRecord(c), []);
});

test("a rule's bookmarks: tagged in every order, and a deleted label matches nothing and says so", () => {
  const { c, records, advent, lukeB, m1 } = everything();
  const rows = collectionRows(c, records, { order: "bible" }).rows.filter((r) => r.type === "record" && r.record.kind === "bookmark");
  assert.deepEqual(rows.map((r) => [r.record.id, Boolean(r.member), r.rule?.type]), [
    [m1.id, false, "rule"],
    [lukeB.id, true, "rule"],
  ]);
  const [info] = collectionRows(c, records).rules;
  assert.deepEqual([info.known, info.gone, info.label.name, info.bookmarks.length], [true, false, "Advent", 2]);

  const noLabel = records.filter((r) => r.id !== advent.id);
  const [goneInfo] = collectionRows(c, noLabel).rules;
  assert.deepEqual([goneInfo.known, goneInfo.gone, goneInfo.label, goneInfo.bookmarks.length], [true, true, null, 0]);
  assert.equal(shown(c, noLabel, "bible").includes("bookmark matthew 1:18 (rule)"), false);
  assert.ok(shown(c, noLabel, "bible").includes("bookmark luke 2:7"), "a bookmark held as an item stays");

  const unknown = { ...c, members: [...c.members, { id: nextId(), type: "rule", match: { kind: "highlight", color: "pink" } }] };
  const infos = collectionRows(unknown, records).rules;
  assert.deepEqual(infos.map((i) => i.known), [true, false]);
});

/* ── Moving in My order ──────────────────────────────────────────────── */

test("moveRow places a row exactly, switches to My order, and keeps hidden members in their place", () => {
  const { c, records } = everything();
  const rows = collectionRows(c, records, { order: "mine" }).rows;
  const note = rows.find((r) => show(r) === "note luke 1:26");
  const first = rows[0];
  const moved = moveRow(c, note.key, first.key, records, at(T2));
  assert.equal(moved.order, "mine");
  assert.deepEqual(shown(moved, records, "mine").slice(0, 3), ["note luke 1:26", "sheet Week one", "highlight luke 1:26"]);
  assert.equal(moved.members.length, c.members.length, "nothing materialized, nothing lost");
  assert.deepEqual(new Set(moved.members.map((m) => m.id)), new Set(c.members.map((m) => m.id)));
  assert.deepEqual(validateRecord(moved), []);
  assert.equal(moveRow(c, first.key, rows[1].key, records, at(T2)), c, "already there");
  assert.throws(() => moveRow(c, "nope", null, records, at(T2)), /shows no row/);
});

test("moving a rule's bookmark makes it an item at that spot; the rest stay at the end", () => {
  const { c, records, m1 } = everything();
  const rows = collectionRows(c, records, { order: "mine" }).rows;
  const ruleRow = rows.find((r) => r.key === `rule:${m1.id}`);
  const moved = moveRow(c, ruleRow.key, rows[0].key, records, at(T2));
  const view = collectionRows(moved, records, { order: "mine" }).rows;
  assert.equal(view[0].record.id, m1.id);
  assert.ok(view[0].member, "held as an item now");
  assert.equal(view[0].rule?.type, "rule", "still tagged from the rule");
  assert.equal(moved.members.length, c.members.length + 1);
  assert.equal(view.filter((r) => r.type === "record" && r.record.id === m1.id).length, 1, "shown once");
  // To the bottom: past the other rule bookmark, at the very end.
  const rows2 = collectionRows(c, records, { order: "mine" }).rows;
  const toEnd = moveRow(c, rows2[0].key, null, records, at(T2));
  assert.deepEqual(shown(toEnd, records, "mine").slice(-3), ["bookmark luke 2:7 (rule)", "bookmark matthew 1:18 (rule)", "sheet Week one"]);
  assert.equal(toEnd.members.filter((m) => m.type === "item" && m.recordId === m1.id).length, 1, "what it passed became an item where it stands");
});

test("moveTarget: up, down, to top, to bottom, and nowhere to go", () => {
  const rows = ["a", "b", "c", "d"].map((key) => ({ type: "record", key }));
  assert.deepEqual(moveTarget(rows, "c", "up"), { before: "b" });
  assert.deepEqual(moveTarget(rows, "b", "down"), { before: "d" });
  assert.deepEqual(moveTarget(rows, "c", "down"), { before: null });
  assert.deepEqual(moveTarget(rows, "c", "top"), { before: "a" });
  assert.deepEqual(moveTarget(rows, "b", "bottom"), { before: null });
  assert.equal(moveTarget(rows, "a", "up"), null);
  assert.equal(moveTarget(rows, "a", "top"), null);
  assert.equal(moveTarget(rows, "d", "down"), null);
  assert.equal(moveTarget(rows, "d", "bottom"), null);
  assert.equal(moveTarget(rows, "z", "up"), null);
  assert.throws(() => moveTarget(rows, "a", "sideways"), /not a way to move/);
});

/* ── Ways in ─────────────────────────────────────────────────────────── */

test("the five changed last, then All collections…; a newer format or a full one can't take more", () => {
  const made = ["A", "B", "C", "D", "E", "F"].map((name, i) => createCollection({ name }, { ...ctx, now: `2026-11-1${i}T09:00:00.000Z` }));
  const newer = { ...createCollection({ name: "Newer" }, at(T2)), collectionFormat: COLLECTION_FORMAT + 1 };
  const full = { ...createCollection({ name: "Full" }, at(T2)), members: Array.from({ length: 1000 }, () => ({ id: nextId(), type: "item", recordId: nextId() })) };
  const records = [...made, newer, full, note("john", 3, 16)];
  const all = addableCollections(records);
  assert.deepEqual(all.map((c) => c.name), ["F", "E", "D", "C", "B", "A"]);
  assert.equal(ADD_MENU_COLLECTIONS, 5);
  assert.deepEqual(addMenuCollections(records).map((c) => c.name), ["F", "E", "D", "C", "B"]);
  assert.equal(needsAllCollections(all), true);
  assert.equal(needsAllCollections(all.slice(0, 5)), false);
  assert.equal(canEdit(newer), false);
  // Two of one name, changed at the same time, keep a steady order.
  const twins = [createCollection({ name: "Same" }, at(T1)), createCollection({ name: "Same" }, at(T1))];
  assert.deepEqual(addableCollections(twins).map((c) => c.id), twins.map((c) => c.id).sort());
});

test("which collections hold a verse: a passage over it, an item on it, a rule's bookmark on it", () => {
  const advent = label("Advent");
  const b = bookmark("luke", 2, 7, [advent.id]);
  const n = note("john", 3, 16);
  const s = sheet("Week one");
  const byPassage = addPassage(createCollection({ name: "Birth" }, ctx), { bookKey: "luke", chapter: 2, verse: 1, endVerse: 20 }, ctx);
  const byRule = addRule(createCollection({ name: "Advent" }, ctx), advent.id, [advent], ctx);
  const byItem = addItems(createCollection({ name: "Love" }, ctx), [n.id, s.id], ctx);
  const records = [advent, b, n, s, byPassage, byRule, byItem];
  assert.deepEqual(collectionsHolding(records, { bookKey: "luke", chapter: 2, verse: 7 }).map((c) => c.name), ["Advent", "Birth"]);
  assert.deepEqual(collectionsHolding(records, { bookKey: "luke", chapter: 2, verse: 21 }), []);
  assert.deepEqual(collectionsHolding(records, { bookKey: "john", chapter: 3, verse: 16 }).map((c) => c.name), ["Love"]);
});

/* ── The Markdown outline ────────────────────────────────────────────── */

test("collectionOutline lists the members in My order: headings, passages, records, rules", () => {
  const { c, records, advent } = everything();
  const withHeading = addHeading(c, "Week one", null, records, at(T2));
  const outline = collectionOutline(withHeading, records);
  assert.deepEqual(
    outline.map((o) => o.type),
    ["record", "record", "record", "passage", "record", "record", "record", "record", "rule", "heading"],
  );
  assert.equal(outline.find((o) => o.type === "rule").label.id, advent.id);
  const gone = collectionOutline(withHeading, records.filter((r) => r.id !== advent.id)).find((o) => o.type === "rule");
  assert.deepEqual([gone.label, gone.gone], [null, true]);
});

/* ── The highlight carry, at the model's level ───────────────────────── */

test("carryHighlights re-points, drops a duplicate, inserts a split's piece, and leaves a newer format alone", () => {
  const [old, survivor, original, piece, other] = [nextId(), nextId(), nextId(), nextId(), nextId()];
  let c = createCollection({ name: "Marks" }, ctx);
  c = addItems(c, [other, old, original], at(T0));
  let both = createCollection({ name: "Both" }, ctx);
  both = addItems(both, [survivor, old], at(T0));
  const newer = { ...addItems(createCollection({ name: "Newer" }, ctx), [old], ctx), collectionFormat: COLLECTION_FORMAT + 1 };
  const untouched = addItems(createCollection({ name: "Other" }, ctx), [other], ctx);
  const records = [c, both, newer, untouched];
  const out = carryHighlights(records, { moved: new Map([[old, survivor]]), split: new Map([[original, piece]]) }, at(T1));
  assert.deepEqual(out.map((x) => x.name), ["Marks", "Both"]);
  const [marks, dup] = out;
  assert.deepEqual(marks.members.map((m) => m.recordId), [other, survivor, original, piece]);
  assert.equal(marks.members[1].id, c.members[1].id, "the member keeps its id");
  assert.equal(marks.modified, T1);
  assert.deepEqual(dup.members.map((m) => m.recordId), [survivor], "held already: the duplicate goes");
  assert.deepEqual(carryHighlights(records, {}, at(T1)), []);
});

test("carryHighlights puts a new colour beside the highlight it took part of, on its side (E182)", () => {
  const [kept, left, cut, piece, mark, other] = [nextId(), nextId(), nextId(), nextId(), nextId(), nextId()];
  let c = createCollection({ name: "Marks" }, ctx);
  c = addItems(c, [other, kept, left, cut], at(T0));
  const joined = new Map([
    [kept, { id: mark, before: false }],
    [left, { id: mark, before: true }],
    [cut, { id: mark, before: false }],
  ]);
  // The mark goes in once, after the first highlight that names it.
  const [one] = carryHighlights([c], { joined }, at(T1));
  assert.deepEqual(one.members.map((m) => m.recordId), [other, kept, mark, left, cut]);
  assert.equal(one.members[1].id, c.members[1].id, "the old member keeps its id");

  // Before it when only its right part is left; a split's two pieces take it between them.
  let d = createCollection({ name: "Ends" }, ctx);
  d = addItems(d, [left, other, cut], at(T0));
  const [ends] = carryHighlights([d], {
    joined: new Map([[left, { id: mark, before: true }]]),
    split: new Map([[cut, piece]]),
  }, at(T1));
  assert.deepEqual(ends.members.map((m) => m.recordId), [mark, left, other, cut, piece]);
  const [between] = carryHighlights([d], {
    joined: new Map([[cut, { id: mark, before: false }]]),
    split: new Map([[cut, piece]]),
  }, at(T1));
  assert.deepEqual(between.members.map((m) => m.recordId), [left, other, cut, mark, piece]);

  // A collection that holds the mark already isn't written.
  const holds = addItems(createCollection({ name: "Holds" }, ctx), [kept, mark], at(T0));
  assert.deepEqual(carryHighlights([holds], { joined: new Map([[kept, { id: mark, before: false }]]) }, at(T1)), []);
});

test("carryHighlights leaves a split's piece out of a full collection rather than fail", () => {
  const original = nextId();
  const full = { ...createCollection({ name: "Full" }, ctx), members: [{ id: nextId(), type: "item", recordId: original }, ...Array.from({ length: 999 }, () => ({ id: nextId(), type: "item", recordId: nextId() }))] };
  assert.deepEqual(carryHighlights([full], { split: new Map([[original, nextId()]]) }, at(T1)), []);
});

/* ── Through the history ─────────────────────────────────────────────── */

test("a change to a collection reads as one in the history", () => {
  const c = createCollection({ name: "Advent series" }, ctx);
  const next = setCollectionFields(c, { name: "Advent, year C" }, at(T1));
  const entry = makeEntry({ put: [next], remove: [] }, [{ id: c.id, record: c }], "e1");
  assert.equal(describeEntry(entry), "Collection “Advent, year C” changed.");
  const added = makeEntry({ put: [c], remove: [] }, [], "e2");
  assert.equal(describeEntry(added), "Collection “Advent series” added.");
});
