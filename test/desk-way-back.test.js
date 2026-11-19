// The rules of a LIT pane's way back after a jump on /desk (E168,
// src/lib/desk-way-back.mjs): what a jump keeps, what reading on does (never
// takes it away; BVJ, 2026-11-19: “Scrolling shouldn't automatically clear the
// history of jumps.”), and how Back steps through the history.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BACK, NO_WAY_BACK, afterJump, afterMove, backPlace, goBack, samePlace } from "../src/lib/desk-way-back.mjs";
import { passageMoveMessage } from "../src/lib/desk-search-pane.mjs";

const at = (bookKey, chapter, verse = null) => ({ bookKey, chapter, verse });
const john = at("john", 3, 16);
const romans = at("romans", 8, 1);
const acts = at("acts", 2, 1);
const mark = at("mark", 1, 1);

test("samePlace compares the book, the chapter and the verse, a missing verse as none", () => {
  assert.equal(samePlace(john, at("john", 3, 16)), true);
  assert.equal(samePlace(john, at("john", 3, 17)), false);
  assert.equal(samePlace(at("john", 3), { bookKey: "john", chapter: 3 }), true);
  assert.equal(samePlace(john, null), false);
});

test("nothing to go back to before a jump, and reading on never makes a way back", () => {
  assert.equal(backPlace(NO_WAY_BACK), null);
  let s = afterMove(NO_WAY_BACK, romans);
  s = afterMove(s, acts);
  assert.equal(backPlace(s), null);
});

test("a jump keeps where the pane was", () => {
  const s = afterJump(NO_WAY_BACK, john, romans);
  assert.deepEqual(backPlace(s), john);
});

test("a jump to where the pane already is, or from no place, keeps nothing", () => {
  assert.equal(backPlace(afterJump(NO_WAY_BACK, john, at("john", 3, 16))), null);
  assert.equal(backPlace(afterJump(NO_WAY_BACK, null, romans)), null);
});

test("the reader's scenario: jump to a result, scroll for its context, and Back still goes to where they were", () => {
  let s = afterJump(NO_WAY_BACK, john, romans);
  s = afterMove(s, at("romans", 8, 4)); // scrolling at the result
  s = afterMove(s, at("romans", 8, 9));
  assert.deepEqual(backPlace(s), john, "scrolling keeps the way back");
  const { place, state } = goBack(s);
  assert.deepEqual(place, john);
  assert.equal(backPlace(state), null, "nothing older: the button goes");
});

test("clicking through several results with no reading between goes back to the place before the first", () => {
  let s = afterJump(NO_WAY_BACK, john, romans);
  s = afterJump(s, romans, acts);
  s = afterJump(s, acts, mark);
  assert.deepEqual(backPlace(s), john);
  assert.deepEqual(s.places, [john], "the results passed through aren't kept");
});

test("reading on at a result and jumping again keeps both places, newest first", () => {
  let s = afterJump(NO_WAY_BACK, john, romans);
  const read = at("romans", 8, 11);
  s = afterMove(s, read);
  s = afterJump(s, read, acts);
  assert.deepEqual(backPlace(s), read, "the place read on to is the next way back");
  let step = goBack(s);
  assert.deepEqual(step.place, read);
  assert.deepEqual(backPlace(step.state), john, "the place before it is still there");
  step = goBack(step.state);
  assert.deepEqual(step.place, john);
  assert.equal(backPlace(step.state), null);
});

test("after Back, the next jump keeps the place Back went to", () => {
  let s = afterJump(NO_WAY_BACK, john, romans);
  const { place, state } = goBack(s);
  s = afterMove(state, place); // the pane arrives there
  s = afterJump(s, john, acts);
  assert.deepEqual(s.places, [john]);
});

test("reaching the newest place by any route takes it off", () => {
  let s = afterJump(NO_WAY_BACK, john, romans);
  assert.equal(backPlace(afterMove(s, at("john", 3, 16))), null, "scrolled or stepped back there");
  s = afterJump(s, romans, john);
  assert.equal(backPlace(s), null, "a jump that lands there");
  s = afterJump(s, john, acts);
  assert.deepEqual(backPlace(s), john, "the next jump keeps it again");
});

test("the history keeps at most MAX_BACK places, dropping the oldest", () => {
  let s = NO_WAY_BACK;
  for (let v = 1; v <= MAX_BACK + 5; v++) {
    const here = at("luke", 1, v);
    s = afterMove(s, here); // read there
    s = afterJump(s, here, at("acts", 1, v));
  }
  assert.equal(s.places.length, MAX_BACK);
  assert.equal(s.places[0].verse, 6);
  assert.equal(backPlace(s).verse, MAX_BACK + 5);
});

test("Back with nothing kept does nothing", () => {
  const { place, state } = goBack(NO_WAY_BACK);
  assert.equal(place, null);
  assert.equal(backPlace(state), null);
});

test("the Search pane's note line names the way back when given it, and only for a move", () => {
  assert.equal(passageMoveMessage("moved", "Romans 8:1"), "The LIT pane moved to Romans 8:1.");
  assert.equal(
    passageMoveMessage("moved", "Romans 8:1", "John 3:16"),
    "The LIT pane moved to Romans 8:1. To go back to John 3:16, press ← on its bar.",
  );
  assert.equal(passageMoveMessage("opened", "Romans 8:1", "John 3:16"), "A LIT pane opened at Romans 8:1.");
  assert.equal(passageMoveMessage("placed", "Romans 8:1", "John 3:16"), "");
});
