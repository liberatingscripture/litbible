// src/lib/bracket-markers.mjs
//
// Contested passages are wrapped in literal `[|` and `|]` characters in the
// paragraph HTML (see "Bracketed passages" in CLAUDE.md). They are plain text
// rather than markup, and they are MEANT to be visible to a reader on the page
// — but they must never survive into extracted plain text, where they read as
// junk to someone who never saw the page.
//
// Lives in src/lib/ (not scripts/lib/) because both worlds need it: the
// build-time extractors under scripts/ and the client-side reader tools under
// src/scripts/. That is the same arrangement as src/lib/word-stem.mjs, which
// build-verse-index.mjs and search-core.js share so the build and the client
// can never disagree.
//
// Three consumers today:
//   scripts/lib/verse-index-core.mjs  — the scripture search index
//   scripts/lib/release-notes-core.mjs — the changelog the apps show
//   src/scripts/chapter-tools.js      — Copy verse / Share… on a chapter page
//
// Two rules for any new consumer:
//   1. Strip BEFORE collapsing whitespace, or the gap a removed marker leaves
//      ships as a double space. A closing marker is not always paragraph-final
//      (John 9:39 reads `Jesus said, |] “I came…`).
//   2. Stripping also repairs attribution. An opening `[|` leads its paragraph
//      AHEAD of that paragraph's first verse marker, so a verse-boundary split
//      files it under the PREVIOUS verse; with the marker gone there is nothing
//      left to misfile.

/** Remove the `[|` / `|]` markers that wrap contested passages. */
export function stripBracketMarkers(text) {
  return String(text ?? "").replace(/\[\||\|\]/g, "");
}
