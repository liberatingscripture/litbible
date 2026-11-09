// test/desk-bookmark-change.test.js
//
// src/lib/desk-bookmark-change.mjs: naming a bookmark and turning "Move as I
// read" on or off, over the records the notebook holds at the write
// (STUDY-DESK-AUDIT-1.md BA102; STUDY-DESK-FIXES.md E9). The store is a fake whose
// `get` waits a turn, as a real read does, and whose records can change
// between the form opening and the write.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createRecord } from "../src/lib/desk-records.mjs";
import { MAX_FOLLOWING } from "../src/lib/desk-bookmarks.mjs";
import {
  BOOKMARK_GONE,
  BOOKMARK_NEWER,
  FOLLOW_LIMIT_REACHED,
  NOT_A_VERSE,
  bookmarkPlace,
  kindTakenAt,
  planBookmarkEdit,
  roomAt,
} from "../src/lib/desk-bookmark-change.mjs";
import { parseReference } from "../src/scripts/search-core.js";

const ctx = { now: "2026-10-28T12:00:00.000Z", client: "web/2026.10", contentVersion: "v20261028.aaaaaaaa" };
const later = { now: "2026-10-28T13:00:00.000Z", client: "web/2026.10" };
const bookmark = (id, extra = {}, verse = 1) =>
  createRecord("bookmark", { bookKey: "john", chapter: 3, verse, endVerse: verse, ...extra }, { ...ctx, id });

/** A store's `{ get, all }` over a mutable list of records; both wait a turn. */
function fake(records) {
  const wait = () => new Promise((resolve) => setImmediate(resolve));
  return {
    records,
    get: async (id) => {
      await wait();
      return records.find((r) => r.id === id) ?? null;
    },
    all: async () => {
      await wait();
      return records.slice();
    },
  };
}

const trashed = (r) => ({ id: `trash-${r.id}`, kind: "trash", schema: r.schema, held: r });

test("a name is tidied and written over the record as it is now", async () => {
  const s = fake([bookmark("a", { label: "Thursday" })]);
  s.records[0] = { ...s.records[0], verse: 16, endVerse: 16 };
  const out = await planBookmarkEdit(s, "a", { name: "  Friday  group " }, later);
  assert.equal(out.problem, null);
  assert.equal(out.plan.put[0].label, "Friday group");
  assert.equal(out.plan.put[0].verse, 16, "a move made meanwhile is kept");
  assert.equal(out.plan.put[0].modified, later.now);
});

test("two bookmarks may share a name, and a bookmark needs none", async () => {
  const s = fake([bookmark("a", { label: "Thursday" }), bookmark("b")]);
  const out = await planBookmarkEdit(s, "b", { name: "thursday" }, later);
  assert.equal(out.problem, null);
  assert.equal(out.plan.put[0].label, "thursday");
});

test("an emptied name removes the label, and nothing else", async () => {
  const s = fake([bookmark("a", { label: "Thursday", follow: true })]);
  const out = await planBookmarkEdit(s, "a", { name: "   " }, later);
  assert.equal("label" in out.plan.put[0], false);
  assert.equal(out.plan.put[0].follow, true);
});

test("the same values over themselves write nothing", async () => {
  const s = fake([bookmark("a", { label: "Thursday", follow: true })]);
  assert.equal((await planBookmarkEdit(s, "a", { name: "Thursday", follow: true }, later)).plan, null);
  const plain = fake([bookmark("a")]);
  assert.equal((await planBookmarkEdit(plain, "a", { name: "", follow: false }, later)).plan, null);
});

test("turning the switch off takes `follow` out, so a plain bookmark is as it was", async () => {
  const s = fake([bookmark("a", { follow: true })]);
  const out = await planBookmarkEdit(s, "a", { follow: false }, later);
  assert.equal("follow" in out.plan.put[0], false);
  const on = await planBookmarkEdit(fake([bookmark("b")]), "b", { follow: true }, later);
  assert.equal(on.plan.put[0].follow, true);
});

test("a bookmark deleted before the change is written is not brought back", async () => {
  const held = bookmark("a");
  const s = fake([held]);
  s.records.splice(0, 1, trashed(held));
  const out = await planBookmarkEdit(s, "a", { name: "Friday" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_GONE);
  assert.equal((await planBookmarkEdit(fake([]), "a", { name: "x" }, later)).plan, null);
});

test("a record that is not a bookmark is refused", async () => {
  const note = createRecord("note", { body: "hi", bookKey: "john", chapter: 3, verse: 1, endVerse: 1 }, { ...ctx, id: "a" });
  const out = await planBookmarkEdit(fake([note]), "a", { name: "Friday" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_GONE);
});

test("a bookmark from a newer schema is refused rather than thrown on", async () => {
  const newer = { ...bookmark("a"), schema: 99 };
  const out = await planBookmarkEdit(fake([newer]), "a", { name: "x" }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, BOOKMARK_NEWER);
});

test("only the bookmarks that move count against the limit of six", async () => {
  const moving = Array.from({ length: MAX_FOLLOWING }, (_, i) => bookmark(`m${i}`, { follow: true }, i + 1));
  const plain = Array.from({ length: 10 }, (_, i) => bookmark(`p${i}`, {}, i + 20));
  const s = fake([...moving, ...plain]);
  const out = await planBookmarkEdit(s, "p0", { follow: true }, later);
  assert.equal(out.plan, null);
  assert.equal(out.problem, FOLLOW_LIMIT_REACHED);
  // A plain bookmark can be renamed at the limit, and one that moves may keep moving.
  assert.equal((await planBookmarkEdit(s, "p0", { name: "x" }, later)).problem, null);
  assert.equal((await planBookmarkEdit(s, "m0", { follow: true, name: "x" }, later)).problem, null);
  // Turning one off makes room.
  const off = await planBookmarkEdit(s, "m0", { follow: false }, later);
  assert.equal(off.problem, null);
});

test("the limit is checked against the notebook at the write, not the form's list", async () => {
  const s = fake([bookmark("p0")]);
  // Another tab turned six on after the form opened.
  for (let i = 0; i < MAX_FOLLOWING; i++) s.records.push(bookmark(`m${i}`, { follow: true }, i + 1));
  const out = await planBookmarkEdit(s, "p0", { follow: true }, later);
  assert.equal(out.problem, FOLLOW_LIMIT_REACHED);
});

/* ── E46: changing the verse ─────────────────────────────────────────── */

const stampNow = { ...later, contentVersion: "v20261105.bbbbbbbb" };

test("E46: a typed reference reads as one verse, the way Go to passage reads it", () => {
  const read = (text) => bookmarkPlace(parseReference(text));
  assert.deepEqual(read("Rom 8:28").place, { bookKey: "romans", chapter: 8, verse: 28, endVerse: 28 });
  assert.deepEqual(read("jn 3.16").place, { bookKey: "john", chapter: 3, verse: 16, endVerse: 16 });
  assert.equal(read("John 3:16-18").place.verse, 16, "a range keeps its first verse");
  assert.equal(read("Romans 8").place.verse, 1, "a chapter alone is its first verse");
  assert.equal(read("Hesitations 2:1").problem, NOT_A_VERSE);
  assert.equal(read("").problem, NOT_A_VERSE);
  assert.equal(read("Jude 2").problem, "Jude has 1 chapter.");
  assert.equal(read("Romans 17:1").problem, "Romans has 16 chapters.");
  assert.equal(read("Romans 8:40").problem, "Romans 8 has 39 verses.");
  // A gap inside a chapter is inside its count (verse-counts.js), but the LIT has no verse there (GF8c-5).
  assert.equal(read("Matthew 17:21").problem, "Matthew 17:21 isn’t in the LIT.");
  assert.ok(read("Matthew 17:20").place);
});

test("E46: a bookmark moves to the verse asked for, its anchor rebuilt as a new bookmark's", async () => {
  const s = fake([bookmark("a", { label: "Thursday" }, 16)]);
  const out = await planBookmarkEdit(s, "a", { place: { bookKey: "romans", chapter: 8, verse: 28 } }, stampNow);
  assert.equal(out.problem, null);
  assert.equal(out.moved, true);
  const r = out.plan.put[0];
  assert.deepEqual([r.bookKey, r.chapter, r.verse, r.endVerse], ["romans", 8, 28, 28]);
  assert.equal(r.contentVersion, stampNow.contentVersion, "the text it is on now");
  assert.equal(r.label, "Thursday");
  assert.equal(r.id, "a", "the same bookmark, so one change undoes it");
  assert.equal(r.created, ctx.now);
  assert.equal(r.modified, later.now);
  assert.equal(out.plan.remove.length, 0);
});

test("E46: the verse it is on already, or no verse sent, writes nothing and keeps a move made meanwhile", async () => {
  const s = fake([bookmark("a", { follow: true }, 16)]);
  const same = await planBookmarkEdit(s, "a", { place: { bookKey: "john", chapter: 3, verse: 16 } }, stampNow);
  assert.equal(same.plan, null);
  assert.equal(same.moved, false);
  // The follower moved it while the form was open; a rename leaves it there.
  s.records[0] = { ...s.records[0], verse: 20, endVerse: 20 };
  const renamed = await planBookmarkEdit(s, "a", { name: "Advent" }, stampNow);
  assert.equal(renamed.plan.put[0].verse, 20);
  assert.equal(renamed.plan.put[0].contentVersion, ctx.contentVersion, "no new verse, no new text");
});

test("E46: a verse that doesn't read is refused and nothing is written", async () => {
  const s = fake([bookmark("a")]);
  const out = await planBookmarkEdit(s, "a", { place: null, name: "x" }, stampNow);
  assert.equal(out.plan, null);
  assert.equal(out.problem, NOT_A_VERSE);
  const past = await planBookmarkEdit(s, "a", { place: { bookKey: "john", chapter: 3, verse: 99 } }, stampNow);
  assert.equal(past.problem, "John 3 has 36 verses.");
});

test("E46: a verse that already holds one of its kind refuses, saying which", async () => {
  const stays = bookmark("s", {}, 5);
  const moves = bookmark("m", { follow: true }, 6);
  const s = fake([bookmark("a", {}, 1), bookmark("b", { follow: true }, 2), stays, moves]);
  const onStays = await planBookmarkEdit(s, "a", { place: { bookKey: "john", chapter: 3, verse: 5 } }, stampNow);
  assert.equal(onStays.plan, null);
  assert.equal(onStays.problem, kindTakenAt({ bookKey: "john", chapter: 3, verse: 5 }, false));
  assert.equal(onStays.problem, "John 3:5 already has a bookmark that stays put.");
  const onMoves = await planBookmarkEdit(s, "b", { place: { bookKey: "john", chapter: 3, verse: 6 } }, stampNow);
  assert.equal(onMoves.problem, "John 3:6 already has a bookmark that moves as you read.");
  // The other kind is welcome: a verse holds one of each.
  assert.equal((await planBookmarkEdit(s, "b", { place: { bookKey: "john", chapter: 3, verse: 5 } }, stampNow)).problem, null);
  assert.equal((await planBookmarkEdit(s, "a", { place: { bookKey: "john", chapter: 3, verse: 6 } }, stampNow)).problem, null);
  // The switch and the verse change together: the kind it will be is the one checked.
  const turned = await planBookmarkEdit(s, "a", { follow: true, place: { bookKey: "john", chapter: 3, verse: 6 } }, stampNow);
  assert.equal(turned.problem, "John 3:6 already has a bookmark that moves as you read.");
  const both = await planBookmarkEdit(s, "a", { follow: true, place: { bookKey: "john", chapter: 3, verse: 5 } }, stampNow);
  assert.equal(both.problem, null);
  assert.equal(both.plan.put[0].follow, true);
  assert.equal(both.plan.put[0].verse, 5);
});

test("E46: the bookmark this tab is following only rests where it is, so it doesn't fill that verse", async () => {
  const resting = bookmark("f", { follow: true }, 6);
  const s = fake([bookmark("b", { follow: true }, 2), resting]);
  const to6 = { place: { bookKey: "john", chapter: 3, verse: 6 } };
  assert.equal((await planBookmarkEdit(s, "b", to6, stampNow)).problem, "John 3:6 already has a bookmark that moves as you read.");
  assert.equal((await planBookmarkEdit(s, "b", to6, stampNow, { except: "f" })).problem, null);
  // And the followed one may itself be moved, which moves where it rests.
  const moved = await planBookmarkEdit(s, "f", { place: { bookKey: "mark", chapter: 1, verse: 1 } }, stampNow, { except: "f" });
  assert.equal(moved.problem, null);
  assert.equal(moved.plan.put[0].bookKey, "mark");
  assert.equal(moved.plan.put[0].follow, true);
});

test("E46: roomAt on the bookmark's own verse is followChoices; elsewhere, only what that verse lacks", () => {
  const a = bookmark("a", { follow: true }, 1);
  const dup = bookmark("d", { follow: true }, 1);
  const stays = bookmark("s", {}, 2);
  // Two of a kind on one verse (a sync brought one): each may still be edited where it is.
  assert.deepEqual(roomAt([a, dup], a), { moves: true, stays: true });
  assert.deepEqual(roomAt([a, dup, stays], a, { bookKey: "john", chapter: 3, verse: 2 }), { moves: true, stays: false });
  assert.deepEqual(roomAt([a, dup], stays, { bookKey: "john", chapter: 3, verse: 1 }), { moves: false, stays: true });
});
