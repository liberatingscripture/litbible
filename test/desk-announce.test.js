import { test } from "node:test";
import assert from "node:assert/strict";
import { bookmarkedMessage, highlightedMessage, noteSavedMessage } from "../src/lib/desk-announce.mjs";
import { COLOR_WORDS } from "../src/lib/desk-highlights.mjs";

test("making a note, a bookmark or a highlight is announced with its place (BA18)", () => {
  assert.equal(noteSavedMessage("Romans 8:3"), "Note saved on Romans 8:3.");
  assert.equal(noteSavedMessage("a footnote in Romans 8:3"), "Note saved on a footnote in Romans 8:3.");
  assert.equal(bookmarkedMessage("Romans 8:28"), "Bookmarked Romans 8:28.");
  assert.equal(highlightedMessage("yellow", "Romans 8:4–5"), "Highlighted yellow: Romans 8:4–5.");
});

test("a highlight is announced in every colour the page draws", () => {
  for (const word of Object.values(COLOR_WORDS)) {
    assert.match(highlightedMessage(word, "John 3:16"), new RegExp(`^Highlighted ${word}: John 3:16\\.$`));
  }
});
