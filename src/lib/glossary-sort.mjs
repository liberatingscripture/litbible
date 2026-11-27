// The glossary's alphabetical order (/glossary, both sorts and its jump
// menu). A label is filed under the word after a leading article, as a
// library files a title: "The Adversary" sits under A and
// "The heavens / Sky" under H. Only the order changes; every label is shown
// as written.
//
// One rule for the build and the browser: glossary.astro sorts with it and
// writes each entry's key into data-sort-lit / data-sort-traditional (its
// inline sort script compares those keys). Change it here and both follow.

// "The", "An" or "A" as a whole word followed by a space, so "Angel" and
// "Atonement" keep their first letters.
const LEADING_ARTICLE = /^(?:the|an|a)\s+/i;

/** The text a glossary label is alphabetized by: the label without a
 *  leading article. */
export function glossarySortKey(label) {
  return String(label).replace(LEADING_ARTICLE, "");
}

/** Compares two glossary labels in the page's order. */
export function compareGlossaryLabels(a, b) {
  return glossarySortKey(a).localeCompare(glossarySortKey(b));
}
