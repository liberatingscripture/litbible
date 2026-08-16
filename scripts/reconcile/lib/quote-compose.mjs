// Composing a restore for master text that `curlify()` refused.
//
// WHY THIS EXISTS. `curl-quotes.mjs` converts the masters' straight quotes to
// the repo's curly convention and REFUSES rather than guessing when a
// quotation is unbalanced or a quote's direction can't be determined. That
// refusal is correct, but build-ledger.mjs used to let it kill the whole
// record: `patch.newValue` stayed null, so 92 bucket-A records - by far the
// largest held group - could never be applied or even reviewed, including ones
// whose only real damage was a stripped macron three words away from the
// offending quote.
//
// The refusal is about the master's PUNCTUATION. It says nothing about the
// master's WORDS, which are the thing a restore exists to recover. So instead
// of converting the master's string, compose one: diff it against the repo's
// current text and take each side per span.
//
//   quote-only span  -> REPO. The two sides differ in nothing but quote
//                       characters, and the repo's are already validator-clean
//                       while the master's are precisely what curlify refused.
//   structural span  -> REPO. Markup the Word master never had.
//   anything else    -> MASTER. The author's wording, plus the diacritics and
//                       spacing the import damaged.
//
// "Quote-only" is tested by deleting every quote character from both sides and
// comparing exactly - no whitespace or diacritic folding, so a span that
// differs in a macron AND a quote is NOT quote-only and correctly takes the
// master. It is deliberately a different question from `classifyHunk`'s
// `mechanical`, which folds ' against " and so reads a wrong-direction pair
// (`message'` for `message"`) as a word-level difference.
//
// TWO GATES, either of which keeps the record held rather than degrading it.
// Both compare the composed result against the repo's CURRENT text, so a
// restore can never introduce a defect the repo did not already have:
//
//   1. `matchesValidatorPredicate` - mirrors `curly_quotes_in_prose` in
//      validate-chapters.mjs, which is FATAL. A straight quote riding along
//      inside a master span this composer took would otherwise fail the build.
//   2. `auditWrongDirectionPairs` must not report MORE of any finding kind
//      than the repo's own text already does. The masters carry real
//      wrong-direction pairs (`"triumphant message'`), and taking a span
//      containing one would import the very defect the back-port list exists
//      to fix. Pre-existing findings are tolerated - this reconciliation is
//      not the place they get fixed - but never increased.
import { diffSegments, compose } from "../review/review-core.mjs";
import { matchesValidatorPredicate, auditWrongDirectionPairs } from "./curl-quotes.mjs";

// Every character either side might use as a quote, straight or curly. Kept
// literal and explicit rather than derived from curl-quotes.mjs's constants,
// because this set includes the STRAIGHT forms that module exists to remove.
// U+2032 PRIME is deliberately absent: the 1corinthians-11 chiasm labels use
// it as notation, not punctuation, and it must never be treated as a quote.
const QUOTE_CHAR = /["'‘’‚‛“”„‟]/;
const QUOTE_CHARS_G = /["'‘’‚‛“”„‟]/g;

const stripQuotes = (s) => String(s ?? "").replace(QUOTE_CHARS_G, "");

/**
 * Do these two sides of a hunk differ in nothing but quote characters?
 *
 * Requires at least one quote character to be present, so a whitespace-only
 * hunk (both sides strip to "") is NOT reported as quote-only - that one is
 * ordinary import spacing damage and must still take the master.
 */
export function isQuoteOnly(from, to) {
  if (!QUOTE_CHAR.test(String(from ?? "")) && !QUOTE_CHAR.test(String(to ?? ""))) return false;
  return stripQuotes(from) === stripQuotes(to);
}

function countKinds(findings) {
  const out = {};
  for (const f of findings) out[f.kind] = (out[f.kind] || 0) + 1;
  return out;
}

/**
 * Compose a restore of `masterHtml` into `repoHtml` per the rules above.
 *
 * @param {string} repoHtml    the repo's current value (a footnote's html, or
 *                             a verse's own span within its paragraph)
 * @param {string} masterHtml  the master's synthesized HTML for the same thing
 * @param {{quoteAmbiguous?: boolean}} [opts]
 *   `quoteAmbiguous` says `masterHtml` is the PRE-curlify text, because
 *   curlify() refused it - which is what turns on the quote-only rule above.
 *   Left false (the default) the master's quotes have already been converted
 *   and are taken like any other punctuation; that is the mode the
 *   continuation-verse patch uses, where composing is about merging the
 *   repo's paragraph markup with the master's words rather than about quotes
 *   at all.
 * @returns {{ok:true, value:string, unchanged:boolean}
 *          |{ok:false, reason:string}}
 *   `unchanged` is true when every span resolved to the repo, i.e. the master
 *   contributes no words here and the two differ only in punctuation the repo
 *   already has right. Callers must not write a patch in that case; see
 *   build-ledger.mjs for what such a record means on each side.
 */
export function composeRestore(repoHtml, masterHtml, opts = {}) {
  const { quoteAmbiguous = false } = opts;
  const segments = diffSegments(repoHtml, masterHtml);

  const verdicts = {};
  for (const seg of segments) {
    if (seg.type !== "hunk") continue;
    const takeRepo = seg.kind === "structural" || (quoteAmbiguous && isQuoteOnly(seg.from, seg.to));
    verdicts[seg.index] = takeRepo ? "repo" : "master";
  }

  const { resolved, undecided } = compose(segments, verdicts);
  if (undecided.length) {
    // Every hunk was just given a verdict, so this is unreachable unless
    // compose()'s hunk indexing and diffSegments' stop agreeing.
    throw new Error(`composeRestore: ${undecided.length} hunk(s) left undecided after a verdict was set for every hunk`);
  }

  if (!matchesValidatorPredicate(resolved)) {
    return {
      ok: false,
      reason:
        "composed restore still carries a straight quote from the master - " +
        "curly_quotes_in_prose in validate-chapters.mjs is fatal, so this record stays held",
    };
  }

  const before = countKinds(auditWrongDirectionPairs(repoHtml));
  const after = countKinds(auditWrongDirectionPairs(resolved));
  for (const kind of Object.keys(after)) {
    if ((after[kind] || 0) > (before[kind] || 0)) {
      return {
        ok: false,
        reason:
          `composed restore would introduce a quote pair the repo's current text does not have ` +
          `(${kind}: ${before[kind] || 0} -> ${after[kind]}) - this record stays held`,
      };
    }
  }

  return { ok: true, value: resolved, unchanged: resolved === repoHtml };
}
