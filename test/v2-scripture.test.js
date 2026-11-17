// Site 2.0's scripture pages: the phone toolbar's hide and return
// (src/scripts/v2-scripture.js). The rule is pure, so it is tested without a
// page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { barState, barValue } from "../src/scripts/v2-scripture.js";

const at = (y, lastY, away = false, held = false) => barState({ y, lastY, home: 100, away, held });

test("in its own place the row is neither afloat nor away", () => {
  assert.deepEqual(at(0, 0), { afloat: false, away: false });
  assert.deepEqual(at(100, 40), { afloat: false, away: false });
  // Scrolling up into its place brings it home, even if it was away.
  assert.deepEqual(at(60, 400, true), { afloat: false, away: false });
});

test("past its place, a scroll down sends it away", () => {
  assert.deepEqual(at(101, 100), { afloat: true, away: true });
  assert.deepEqual(at(900, 400), { afloat: true, away: true });
});

test("any scroll up brings it back, and it stays afloat over the text", () => {
  assert.deepEqual(at(899, 900, true), { afloat: true, away: false });
});

test("no movement keeps the state it had", () => {
  assert.deepEqual(at(500, 500, true), { afloat: true, away: true });
  assert.deepEqual(at(500, 500, false), { afloat: true, away: false });
});

test("held (search or picker open, or focus in it) it never goes away", () => {
  assert.deepEqual(at(900, 400, false, true), { afloat: true, away: false });
  assert.deepEqual(at(900, 400, true, true), { afloat: true, away: false });
});

test("the attribute names afloat, and away only while afloat", () => {
  assert.equal(barValue({ afloat: false, away: false }), "");
  assert.equal(barValue({ afloat: true, away: false }), "afloat");
  assert.equal(barValue({ afloat: true, away: true }), "away afloat");
  assert.equal(barValue({ afloat: false, away: true }), "");
});
