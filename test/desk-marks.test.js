// test/desk-marks.test.js
//
// "Your marks" (src/lib/desk-marks.mjs; DI-11, DI-13, DI-18): the four
// switches it merged become one switch and its finer choices with no key
// renamed and nothing rewritten, so every reader keeps what they had. Run
// over every combination of the four stored settings, with and without a
// record an earlier hide kept.

import { test } from "node:test";
import assert from "node:assert/strict";

import { FINER_MARKS, HIDE_KEY, MARK_SETTINGS, hideMarks, marksOn, readHidden, showMarks } from "../src/lib/desk-marks.mjs";

const NAMES = Object.keys(MARK_SETTINGS);

/** Every combination of "on" and "off" over the four settings (16). */
function everyCombination() {
  const out = [];
  for (let bits = 0; bits < 1 << NAMES.length; bits++) {
    out.push(Object.fromEntries(NAMES.map((name, i) => [name, bits & (1 << i) ? "on" : "off"])));
  }
  return out;
}
const ALL = everyCombination();
const anyOn = (values) => NAMES.some((name) => values[name] === "on");
const DEFAULTS = Object.fromEntries(NAMES.map((name) => [name, MARK_SETTINGS[name].fallback]));

test("the keys are the ones the four switches wrote, so nothing is migrated", () => {
  assert.deepEqual(
    Object.fromEntries(NAMES.map((name) => [name, MARK_SETTINGS[name].key])),
    {
      notes: "lit-desk-notes",
      bookmarks: "lit-desk-bookmarks",
      highlights: "lit-desk-highlights",
      readHighlights: "lit-desk-read-highlights",
    },
  );
  assert.equal(HIDE_KEY, "lit-desk-hide");
  assert.deepEqual(DEFAULTS, { notes: "on", bookmarks: "on", highlights: "on", readHighlights: "off" });
  // All settings offers the three a page draws; Read View's own is no page's.
  assert.deepEqual([...FINER_MARKS], ["notes", "bookmarks", "highlights"]);
});

test("the switch is on exactly when “Hide my marks” was unchecked: while anything shows", () => {
  assert.equal(ALL.length, 16);
  for (const values of ALL) assert.equal(marksOn(values), anyOn(values), JSON.stringify(values));
  // The brief's reader: highlights off and notes on today; the switch on, highlights still off.
  const reader = { notes: "on", bookmarks: "on", highlights: "off", readHighlights: "off" };
  assert.equal(marksOn(reader), true);
  assert.equal(reader.highlights, "off");
  assert.equal(marksOn(DEFAULTS), true);
});

test("H flips the whole: hiding turns every one off, and showing brings back exactly what showed", () => {
  for (const values of ALL) {
    if (!anyOn(values)) continue;
    const hidden = hideMarks(values);
    assert.equal(marksOn(hidden.values), false, JSON.stringify(values));
    for (const name of NAMES) assert.equal(hidden.values[name], "off");
    assert.deepEqual(hidden.saved, values, "the record is what showed");
    // Kept as JSON and read back, as lit-desk-hide is.
    const back = showMarks(readHidden(JSON.stringify(hidden.saved)));
    assert.deepEqual(back, values, `the way back restores ${JSON.stringify(values)}`);
    assert.equal(marksOn(back), true);
  }
});

test("a switch already off, with no record, comes on at the defaults, so it always shows something", () => {
  const nothing = ALL.find((values) => !anyOn(values));
  assert.equal(marksOn(nothing), false);
  assert.deepEqual(showMarks(null), DEFAULTS);
  // A record that would show nothing does the same.
  assert.deepEqual(showMarks(hideMarks(nothing).saved), DEFAULTS);
});

test("a second hide keeps the first hide's memory, over every combination (NB8-6)", () => {
  for (const before of ALL) {
    for (const values of ALL) {
      const { saved } = hideMarks(values, before);
      for (const name of NAMES) {
        const want = before[name] === "on" || values[name] === "on" ? "on" : "off";
        assert.equal(saved[name], want, `${name}: before ${before[name]}, now ${values[name]}`);
      }
    }
  }
});

test("a finer choice turned on while the marks are hidden shows that one alone, and the switch is on again", () => {
  const values = { notes: "on", bookmarks: "on", highlights: "off", readHighlights: "off" };
  const hidden = hideMarks(values);
  const after = { ...hidden.values, bookmarks: "on" }; // All settings' Bookmarks, pressed
  assert.equal(marksOn(after), true);
  // H then hides again and the way back still brings the first record's notes.
  const again = hideMarks(after, hidden.saved);
  assert.deepEqual(showMarks(again.saved), values);
});

test("a record that can't be read is none", () => {
  for (const text of [null, "", "not json", "3", "[]", "null", '"on"']) assert.equal(readHidden(text), null, String(text));
  assert.deepEqual(readHidden('{"notes":"on"}'), { notes: "on" });
  // A record from before a setting existed brings that one back at its default.
  assert.deepEqual(showMarks({ notes: "off", bookmarks: "on" }), { notes: "off", bookmarks: "on", highlights: "on", readHighlights: "off" });
});
