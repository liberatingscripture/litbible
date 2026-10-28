// src/lib/desk-announce.mjs
//
// What the Study Desk says aloud, through the undo bar's live region
// (src/scripts/desk/undo-bar.js `announce`), when the reader makes something:
// a note saved, a verse bookmarked, words highlighted (BA18, WCAG 4.1.3).
// Deleting, undoing and pinning already speak through the bar's own notices;
// these are the makers, which have no bar to show and so were silent.
//
// The reference is the one the page names the place by ("Romans 8:3",
// "Romans 8:4–5", "a footnote in Romans 8:3"), as the bar's notices use it.

/** After a note is saved, new or edited. `where` is recordWhere's sentence part. */
export function noteSavedMessage(where) {
  return `Note saved on ${where}.`;
}

/** After a bookmark is added. */
export function bookmarkedMessage(ref) {
  return `Bookmarked ${ref}.`;
}

/** After words are highlighted. `colorWord` is "yellow", "green", "blue" or "pink" (COLOR_WORDS). */
export function highlightedMessage(colorWord, ref) {
  return `Highlighted ${colorWord}: ${ref}.`;
}
