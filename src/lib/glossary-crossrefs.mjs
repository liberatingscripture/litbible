// src/lib/glossary-crossrefs.mjs
//
// Links a glossary body's cross-references on /glossary: in "See the entry
// for “good [2]” below", the quoted label becomes a jump to that entry.
//
// Website only. The source files and the apps' feed keep the phrase exactly as
// written, because iOS turns the literal `the entry for "X"` into in-app
// navigation by matching X against the entry labels (see The Glossary Feed in
// CLAUDE.md). This runs over the RENDERED HTML, where smartypants has already
// curled the quotes, so it accepts both kinds. Labels resolve through the
// feed's own normalizer, so the page and the apps agree on where each phrase
// points. The "above"/"below" wording stays: it is the author's, and it is
// only wrong once a reader flips the sort order, which the link now survives.

import { mapHtmlText } from "./scripture-refs.mjs";

const Q = String.raw`[“"]([^”"]+)[”"]`;
const PHRASE_RE = new RegExp(
  String.raw`(the entr(?:y|ies) (?:for|on) )(${Q.replace("(", "(?:")}` +
    String.raw`(?:(?:\s+(?:above|below))?(?:,\s*and\s+|,\s*|\s+and\s+)${Q.replace("(", "(?:")})*)`,
  "g"
);
const LABEL_RE = new RegExp(Q, "g");

/**
 * @param {string} html  Rendered entry body.
 * @param {(label: string) => string | null} resolve  Label → entry id.
 */
export function linkGlossaryCrossRefs(html, resolve) {
  return mapHtmlText(html, (text) =>
    text.replace(PHRASE_RE, (_, lead, labels) =>
      lead +
      labels.replace(LABEL_RE, (quoted, label) => {
        const id = resolve(label);
        return id ? `<a href="#${id}">${quoted}</a>` : quoted;
      })
    )
  );
}
