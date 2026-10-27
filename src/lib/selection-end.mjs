// src/lib/selection-end.mjs
//
// Where a mouse selection of scripture ends when the drag finishes off the
// text (STUDY-DESK-AUDIT-1.md, BA23). A browser puts the end of a selection
// at the element under the pointer in document order, not on screen, so a drag
// that ends over something drawn over the page but written at the end of
// `<body>` (a Study Desk window, a margin note, the Notebook) or over another
// /desk pane puts the end after the rest of the chapter, and the selection
// panel then offers every verse to its end. Pure: chapter-tools.js measures and
// moves the selection.

/**
 * Whether to end a selection where the pointer last was over the text rather
 * than where the browser put it. Only when the browser's end lies outside the
 * text and the pointer didn't actually go past the text's end in the drag's
 * direction (below its bottom going down, above its top going up): there the
 * selection still runs to the end, as it always has, and is clamped to the
 * verses.
 *
 * @param {{ endInText: boolean, forward: boolean, pointerY: number,
 *   textTop: number, textBottom: number }} at
 *   `forward` is a selection running down the page; `pointerY`, `textTop` and
 *   `textBottom` are in one coordinate space.
 */
export function pullBackSelectionEnd({ endInText, forward, pointerY, textTop, textBottom }) {
  if (endInText) return false;
  return forward ? pointerY <= textBottom : pointerY >= textTop;
}
