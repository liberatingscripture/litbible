// "Bring back" returns a left-out item to its place (BVJ, 2026-11-20, E201):
// "Leave it out" keeps the place in the rule's `exceptAt`, so it outlives the
// visit, and "Bring back" reads it and forgets it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecord } from "../src/lib/desk-records.mjs";
import { COLLECTION_LIMITS, validateCollection } from "../src/lib/desk-collection-format.mjs";
import { addItems, addRule, bringBack, createCollection, keptPlace, leaveOut, leftOutPlace, removeMember } from "../src/lib/desk-collections.mjs";

const ctx = { now: "2026-11-20T09:00:00.000Z", client: "web/2026.11", contentVersion: "v1" };
const later = { ...ctx, now: "2026-11-20T10:00:00.000Z" };
let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const make = (kind, fields) => createRecord(kind, fields, { ...ctx, id: nextId() });
const bookmark = (verse, labels = []) => make("bookmark", { bookKey: "luke", chapter: 1, verse, endVerse: verse, label: "", labels });

const advent = make("label", { name: "Advent" });
const a = bookmark(1);
const b = bookmark(2, [advent.id]);
const c3 = bookmark(3);
const d = bookmark(4);
const records = [advent, a, b, c3, d];
const order = (c) => c.members.map((m) => m.recordId ?? m.type);
const ruleOf = (c) => c.members.find((m) => m.type === "rule");

function built() {
  let c = createCollection({ name: "Advent" }, ctx);
  c = addItems(c, [a.id, b.id, c3.id], ctx);
  c = addRule(c, advent.id, records, ctx);
  return c; // a, b, c3, rule
}

test("leftOutPlace names the item and its neighbors, or null", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  assert.equal(place.memberId, c.members[1].id);
  assert.equal(place.after, c.members[0].id);
  assert.equal(place.before, c.members[2].id);
  assert.equal(leftOutPlace(c, a.id).after, null, "first item has nothing before it");
  assert.equal(leftOutPlace(c, d.id), null, "no item names it");
  assert.equal(leftOutPlace(c, advent.id), null);
});

test("leave out, then bring back with the place restores the exact order and id", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  const out = leaveOut(c, b.id, records, later);
  assert.deepEqual(order(out), [a.id, c3.id, "rule"]);
  const back = bringBack(out, b.id, later, place);
  assert.deepEqual(back.members.map((m) => m.id), c.members.map((m) => m.id), "same members in the same order, same ids");
  assert.deepEqual(back.members.find((m) => m.type === "rule").except, []);
});

test("leaveOut keeps the place in the rule's exceptAt; bringBack reads it and forgets it", () => {
  const c = built();
  const out = leaveOut(c, b.id, records, later);
  assert.deepEqual(ruleOf(out).exceptAt, { [b.id]: leftOutPlace(c, b.id) });
  assert.deepEqual(keptPlace(out, b.id), leftOutPlace(c, b.id));
  assert.deepEqual(validateCollection(out), [], "the record passes its check");
  const back = bringBack(out, b.id, later);
  assert.deepEqual(back.members.map((m) => m.id), c.members.map((m) => m.id), "same members in the same order, same ids");
  assert.equal("exceptAt" in ruleOf(back), false, "no field once nothing is left out");
});

test("the place outlives the visit: a record read back from JSON brings the item back there", () => {
  const c = built();
  const stored = JSON.parse(JSON.stringify(leaveOut(c, b.id, records, later)));
  assert.deepEqual(order(bringBack(stored, b.id, later)), [a.id, b.id, c3.id, "rule"]);
});

test("a null place, or a bookmark only the rule brought in, comes back by the rule alone", () => {
  const c = built();
  const out = leaveOut(c, b.id, records, later);
  const back = bringBack(out, b.id, later, null);
  assert.deepEqual(order(back), [a.id, c3.id, "rule"]);
  assert.equal("exceptAt" in ruleOf(back), false, "the place is forgotten all the same");
  // d is reached by no item: leaving it out keeps no place.
  const dLabeled = { ...d, labels: [advent.id] };
  const recs = [advent, a, b, c3, dLabeled];
  const outD = leaveOut(c, d.id, recs, later);
  assert.deepEqual(ruleOf(outD).except, [d.id]);
  assert.equal("exceptAt" in ruleOf(outD), false);
  assert.equal(keptPlace(outD, d.id), null);
});

test("two left out keep a place each; held again and left out again, the newer place wins", () => {
  const c = built();
  const two = leaveOut(leaveOut(c, b.id, records, later), a.id, records, later);
  // a carried no label, so only b was ever excepted: a's item just goes.
  assert.deepEqual(Object.keys(ruleOf(two).exceptAt), [b.id]);
  const held = addItems(leaveOut(c, b.id, records, later), [b.id], later); // b held again at the end, still excepted
  const again = leaveOut(held, b.id, records, later);
  assert.equal(again.members.filter((m) => m.recordId === b.id).length, 0);
  assert.equal(keptPlace(again, b.id).after, c.members[3].id, "the newer place: after the rule, where it was held again");
});

test("a place is read only for a bookmark the rule leaves out now", () => {
  const c = built();
  const out = leaveOut(c, b.id, records, later);
  const stale = { ...out, members: out.members.map((m) => (m.type === "rule" ? { ...m, except: [] } : m)) };
  assert.equal(keptPlace(stale, b.id), null);
  const odd = { ...out, members: out.members.map((m) => (m.type === "rule" ? { ...m, exceptAt: { [b.id]: { after: 7 } } } : m)) };
  assert.deepEqual(keptPlace(odd, b.id), { memberId: null, after: null, before: null }, "a field that isn't an id is read as none");
});

test("neighbors gone: before wins, then after, then the end", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  const out = leaveOut(c, b.id, records, later);
  const [mA, mC] = [c.members[0].id, c.members[2].id];
  // before gone, after kept: just after it
  assert.deepEqual(order(bringBack(removeMember(out, mC, later), b.id, later, place)), [a.id, b.id, "rule"]);
  // after gone, before kept: just before it
  assert.deepEqual(order(bringBack(removeMember(out, mA, later), b.id, later, place)), [b.id, c3.id, "rule"]);
  // both gone: the end
  const bare = removeMember(removeMember(out, mA, later), mC, later);
  assert.deepEqual(order(bringBack(bare, b.id, later, place)), ["rule", b.id]);
});

test("an id already taken is not reused, and an item already held is not doubled", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  const out = leaveOut(c, b.id, records, later);
  const taken = { ...place, memberId: c.members[0].id };
  const back = bringBack(out, b.id, later, taken);
  assert.equal(new Set(back.members.map((m) => m.id)).size, back.members.length);
  assert.equal(back.members.filter((m) => m.recordId === b.id).length, 1);
  const held = addItems(out, [b.id], later); // held again by hand, still excepted
  const again = bringBack(held, b.id, later, place);
  assert.equal(again.members.filter((m) => m.recordId === b.id).length, 1);
});

test("unchanged returns the same object", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  assert.equal(bringBack(c, b.id, later, place), c, "never left out");
  assert.equal(bringBack(c, d.id, later, null), c);
});

test("a full collection refuses an item back", () => {
  const c = built();
  const place = leftOutPlace(c, b.id);
  const out = leaveOut(c, b.id, records, later);
  const full = { ...out, members: [...out.members, ...Array.from({ length: COLLECTION_LIMITS.members - out.members.length }, (_, i) => ({ id: `fill-${i}`, type: "heading", text: "x" }))] };
  assert.throws(() => bringBack(full, b.id, later, place), /too many|members|limit/i);
});
