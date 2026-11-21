// The verses a hand-written scripture link names in its words
// (src/lib/ref-text-verses.mjs), which the reference preview shows when the
// link's href is only the chapter. The cases are the link texts the articles
// actually use (grep `<a href="/book-N">` in src/content/articles).

import { test } from "node:test";
import assert from "node:assert/strict";
import { versesFromLinkText, previewNumbers } from "../src/lib/ref-text-verses.mjs";

const read = (text, chapter) => versesFromLinkText(text, chapter);

test("a plain range", () => {
  assert.deepEqual(read("Romans 13:6-10 LIT", 13), { spans: [[6, 10]], cited: "6–10" });
  assert.deepEqual(read("Romans 13:1-5 LIT", 13), { spans: [[1, 5]], cited: "1–5" });
});

test("a single verse, and a range typed with an en dash", () => {
  assert.deepEqual(read("Galatians 3:9 LIT", 3), { spans: [[9, 9]], cited: "9" });
  assert.deepEqual(read("Hebrews 10:32–34", 10), { spans: [[32, 34]], cited: "32–34" });
});

test("a list of spans in one chapter", () => {
  assert.deepEqual(read("Galatians 3:11, 14-17 LIT", 3), {
    spans: [[11, 11], [14, 17]],
    cited: "11, 14–17",
  });
  assert.deepEqual(read("Mark 14:45-49, 55-64 LIT", 14), {
    spans: [[45, 49], [55, 64]],
    cited: "45–49, 55–64",
  });
  assert.deepEqual(read("Galatians 5:13-14, 22-25 LIT", 5), {
    spans: [[13, 14], [22, 25]],
    cited: "13–14, 22–25",
  });
});

test("a part letter is kept in the heading and ignored in the numbers", () => {
  assert.deepEqual(read("Romans 7:15b-24 LIT", 7), { spans: [[15, 24]], cited: "15b–24" });
});

test("a range into the next chapter runs to this chapter's end", () => {
  assert.deepEqual(read("Mark 12:38-13:2 LIT", 12), {
    spans: [[38, Infinity]],
    cited: "38–13:2",
  });
});

test("a list stops at a different chapter's reference", () => {
  assert.deepEqual(read("Romans 8:28, 9:1", 8), { spans: [[28, 28]], cited: "28" });
});

test("it never guesses: another chapter, no verse, no words", () => {
  // The link text names Mark 7 but points at Mark 14 (a typo in an article).
  assert.equal(read("Mark 7:21-22 LIT", 14), null);
  assert.equal(read("Romans 13", 13), null);
  assert.equal(read("Read the whole of Romans 13 LIT", 13), null);
  assert.equal(read("Romans 13:10-6", 13), null);
  assert.equal(read("", 13), null);
  assert.equal(read(undefined, 13), null);
  assert.equal(read(null, 13), null);
});

test("a number that is only the tail of a longer one is not a chapter", () => {
  assert.equal(read("Romans 113:6", 13), null);
  assert.equal(read("1 Corinthians 13:4-7", 13)?.cited, "4–7");
});

test("the numbers a preview lists", () => {
  // Exactly what was cited, when it fits.
  assert.deepEqual(previewNumbers([[6, 10]], 14, 6), { numbers: [6, 7, 8, 9, 10], more: false });
  // A long passage shows its first six and says there is more.
  assert.deepEqual(previewNumbers([[1, 21]], 21, 6), { numbers: [1, 2, 3, 4, 5, 6], more: true });
  // A list keeps its order and its gap (the caller marks the gap).
  assert.deepEqual(previewNumbers([[11, 11], [14, 17]], 29, 6), {
    numbers: [11, 14, 15, 16, 17],
    more: false,
  });
  // Repeats are dropped; verses past the chapter's end are not asked for.
  assert.deepEqual(previewNumbers([[3, 5], [4, 6]], 6, 6), { numbers: [3, 4, 5, 6], more: false });
  assert.deepEqual(previewNumbers([[38, Infinity]], 40, 6), { numbers: [38, 39, 40], more: false });
  assert.deepEqual(previewNumbers([[50, 52]], 40, 6), { numbers: [], more: false });
});
