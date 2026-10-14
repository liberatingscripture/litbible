// src/lib/handout-rich.mjs
//
// "Copy with footnotes" and "Copy text" are built as plain text (see
// assembleHandout and joinPieces in src/scripts/chapter-tools.js), and plain
// text has no italics, so a copy pasted into Word, Docs or Mail lost the
// emphasis on every transliterated Greek word in its notes. The fix is a
// second clipboard flavor, not a second pipeline: the text pipeline marks each
// italic or bold run with private-use characters, and this module reads the
// marked text two ways.
//
//   handoutPlain — the markers removed: exactly the text the copy always was
//   handoutHtml  — the markers as <em> and <strong>, for a paste target that
//                  takes HTML
//
// The markers are private-use code points because they can't occur in the
// scripture or its notes, and they pass through the pipeline's whitespace
// collapsing and bracket stripping untouched (neither is whitespace). They are
// not "\n"-style sentinels: only the copies that paste as rich text ever insert
// them, so Share…, a verse image and a link never see one.
//
// Italics and bold only (bold is rare, but a few verses and notes carry it).
// Links and the rest of the markup stay plain on purpose: this is quoted text
// for a bulletin or study guide, and emphasis is what carries meaning there.

export const ITALIC_ON = "\uE000";
export const ITALIC_OFF = "\uE001";
export const BOLD_ON = "\uE002";
export const BOLD_OFF = "\uE003";

/**
 * Bracket each italic and bold run in an element's clone with the markers, so
 * that its `textContent` carries them through to the text. Works on a clone
 * the caller is about to read and discard: it edits the tree it is given.
 */
export function markEmphasis(clone) {
  clone.querySelectorAll("em, i").forEach((el) => {
    el.before(ITALIC_ON);
    el.after(ITALIC_OFF);
  });
  clone.querySelectorAll("strong, b").forEach((el) => {
    el.before(BOLD_ON);
    el.after(BOLD_OFF);
  });
}

const MARKERS = /[\uE000-\uE003]/g;

/** The text as plain text: every marker removed. */
export function handoutPlain(marked) {
  return marked.replace(MARKERS, "");
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/**
 * The text as HTML. A blank line starts a paragraph and a single newline is a
 * line break inside it, which is the shape assembleHandout and Copy text write:
 * verses, then the reference, then (for a handout) the notes one line each,
 * the credit and the link. Empty pairs (an emphasized run that held only a
 * space or a stripped bracket) are dropped rather than pasted as stray
 * formatting.
 */
export function handoutHtml(marked) {
  const body = marked
    .replace(/[&<>]/g, (c) => ESCAPES[c])
    .replaceAll(ITALIC_ON, "<em>")
    .replaceAll(ITALIC_OFF, "</em>")
    .replaceAll(BOLD_ON, "<strong>")
    .replaceAll(BOLD_OFF, "</strong>")
    .replace(/<(em|strong)>(\s*)<\/\1>/g, "$2");
  return body
    .split("\n\n")
    .map((paragraph) => "<p>" + paragraph.replace(/\n/g, "<br>") + "</p>")
    .join("");
}
