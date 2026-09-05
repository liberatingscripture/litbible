// src/lib/bracket-markers.mjs
//
// Contested passages are wrapped in literal `⟦` (U+27E6) and `⟧` (U+27E7)
// characters in the paragraph HTML (see "Bracketed passages" in CLAUDE.md) —
// the standard double-bracket notation critical editions use for text of
// doubtful authenticity. They are plain text rather than markup, and they are
// MEANT to be visible to a reader on the page — but they must never survive
// into extracted plain text, where they read as junk to someone who never saw
// the page.
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
//      (John 9:39 reads `Jesus said, ⟧ “I came…`).
//   2. Stripping also repairs attribution. An opening `⟦` leads its paragraph
//      AHEAD of that paragraph's first verse marker, so a verse-boundary split
//      files it under the PREVIOUS verse; with the marker gone there is nothing
//      left to misfile.

// The retired two-character forms `[|` and `|]` are stripped too, and must
// stay that way. They are what the WORD MASTERS still carry — the repo moved
// to ⟦/⟧ in 2026-09, the masters did not, exactly like the en-dash rule (see
// "Bracketed passages" in CLAUDE.md). Two consequences: the reconciliation
// pipeline strips master-derived text through this helper to make it
// comparable to repo text, and any old-form marker that finds its way back
// into a chapter — an approved restore, a fresh `import:chapter` of a
// bracketed book, a hand-copy out of Word — stays harmless to every extractor
// instead of shipping as junk. `old_bracket_markers` in the chapter validator
// is what stops it reaching the corpus in the first place; this is the
// belt-and-braces half.

/** Remove the `⟦` / `⟧` markers that wrap contested passages (and the retired
 *  `[|` / `|]` forms the Word masters still use). */
export function stripBracketMarkers(text) {
  return String(text ?? "").replace(/[⟦⟧]|\[\||\|\]/g, "");
}
