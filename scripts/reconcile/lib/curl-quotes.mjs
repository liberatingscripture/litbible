// Straight-to-curly quote normalization for restored master text.
//
// Why this exists: `curly_quotes_in_prose` in `scripts/validate-chapters.mjs`
// (the FATAL check covering both `paragraphs` and `footnotes[].html`) rejects
// any straight ASCII quote or quote entity in prose text (tags stripped
// first, so tag attributes are exempt). Text pulled from the Word masters
// carries straight quotes throughout - 188 master footnotes have straight
// doubles, 91 have straight singles, and the masters mix straight and curly
// **within one sentence** - so whatever restores master text into the repo
// must curl it first, and must be idempotent over characters that are
// already curly.
//
// Design, per the approved plan ("Phase 4"):
//   - Apostrophe rule runs first (`don't` -> `don't` with U+2019), because
//     English overloads U+2019 for both the closing single quote AND the
//     apostrophe, and the two are indistinguishable by local context alone
//     in the end-of-word case (`Jesus' sake` vs. `the boys' toys'`). That
//     ambiguity is resolved with quote-nesting state (see below), never by
//     guessing from punctuation alone.
//   - State-based, direction-aware: doubleOpen / singleOpen booleans track
//     whether a “ ” or ‘ ’ pair is currently open, resolving each straight
//     quote to the correct member of its pair. The two are tracked
//     INDEPENDENTLY rather than as a required outer/inner nesting - CLAUDE.md
//     documents singles as used "nested," but real corpus usage (e.g.
//     jude-1.json fn-ff: "Traditionally, ‘saints’ or ‘holy ones.’ “People who
//     were dedicated…” serves…") also uses ‘ ’ standalone for short
//     glosses/scare-quotes with no enclosing double at all. A same-family
//     double-open (a second “ before the first closes, or a second ‘ before
//     the first closes) is still treated as an error independent of that
//     question.
//   - Never touches or emits U+2032 PRIME - the chiasm labels in
//     `1corinthians-11` fn-b (`A B C D D′ C′ B′ A′`) use it deliberately, and
//     it is a different codepoint from U+2019 that this module never reads
//     as a quote character in the first place, so there is nothing to
//     special-case beyond asserting the count never changes (defense against
//     a future edit to this file breaking that invariant silently).
//   - Refuses to auto-apply when the result would be unbalanced or when a
//     straight quote's direction can't be determined with confidence -
//     returns `{ok:false, subclass:"quote-ambiguous", ...}` rather than
//     guessing. A per-string refusal is expected and correct for a
//     legitimately multi-paragraph quotation (opens in one paragraph,
//     closes pages later) - that string just needs hand review, which is
//     exactly what the ledger workflow (build-ledger.mjs) routes it to.
//   - Self-asserts the validator's own predicate on any produced result
//     before returning `ok:true` - if curlify() ever produces a string that
//     would still fail `curly_quotes_in_prose`, that is an internal bug in
//     this module, not a property of the input, and it throws rather than
//     returning a result that would fail validation downstream.
//
// Tag-aware: input values are HTML strings (`<em>`, `<sup>`, footnote
// anchors, etc.), and only PROSE text is ever inspected or rewritten -
// everything inside a `<...>` tag (including attribute quotes like
// `id="v1"`) passes through completely untouched, matching the validator's
// own tag-stripping before it checks for straight quotes. Context lookups
// (is the character before/after this quote a letter?) skip over tag spans
// entirely, so `<em>word</em>'s` sees "d" and "s" as the neighbors of the
// apostrophe, not ">" and "s".

const OPEN_DOUBLE = "“"; // “
const CLOSE_DOUBLE = "”"; // ”
const OPEN_SINGLE = "‘"; // ‘
const CLOSE_SINGLE = "’"; // ’
const PRIME = "′"; // ′ - never touched, never emitted

// Leading straight-apostrophe elisions where there is no enclosing quote
// context to lean on. Deliberately small and conservative - this is
// scholarly/translation prose, not colloquial dialogue, so these are rare;
// anything not on this list and not resolvable by nesting state is refused
// rather than guessed.
const LEADING_ELISIONS = new Set(["tis", "twas", "til", "cause", "em", "n", "n'"]);

function isWordChar(c) {
  return c !== undefined && /[A-Za-z0-9]/.test(c);
}

function findTagSpans(text) {
  const spans = [];
  const re = /<[^>]*>/g;
  let m;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length });
  return spans;
}

function tagSpanAt(spans, pos) {
  for (const s of spans) {
    if (pos >= s.start && pos < s.end) return s;
  }
  return null;
}

/** Nearest prose character before `i`, skipping backward over any tag span. */
function prevProseChar(text, spans, i) {
  let pos = i - 1;
  while (pos >= 0) {
    const span = tagSpanAt(spans, pos);
    if (span) {
      pos = span.start - 1;
      continue;
    }
    return text[pos];
  }
  return undefined;
}

/** Nearest prose character after `i`, skipping forward over any tag span. */
function nextProseChar(text, spans, i) {
  let pos = i + 1;
  while (pos < text.length) {
    const span = tagSpanAt(spans, pos);
    if (span) {
      pos = span.end;
      continue;
    }
    return text[pos];
  }
  return undefined;
}

/** Word (letters only, apostrophe-stripped) immediately following position i,
 *  used only to check LEADING_ELISIONS. Looks at raw text, not prose-only -
 *  good enough for a short fixed dictionary check. */
function leadingWordAfter(text, i) {
  const m = /^[A-Za-z']*/.exec(text.slice(i + 1, i + 8));
  return (m ? m[0] : "").toLowerCase();
}

/**
 * Curl the straight quotes in `text` (an HTML string: a paragraph or
 * footnote `html` value). Returns:
 *   { ok: true, result: string }
 *   { ok: false, subclass: "quote-ambiguous", reason: string, position: number }
 * Never throws for ordinary ambiguous input - refusal is the expected,
 * correct outcome for text this module can't confidently resolve. It DOES
 * throw for an internal invariant violation (the self-assert at the end, or
 * the PRIME-count guard), which indicates a bug in this module itself.
 */
export function curlify(text) {
  if (typeof text !== "string") {
    throw new Error(`curlify: expected a string, got ${typeof text}`);
  }

  const spans = findTagSpans(text);
  const primeCountBefore = countOccurrences(text, PRIME);

  let out = "";
  let inTag = false;
  let doubleOpen = false;
  let singleOpen = false;

  const refuse = (reason, position) => ({ ok: false, subclass: "quote-ambiguous", reason, position });

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inTag) {
      out += c;
      if (c === ">") inTag = false;
      continue;
    }
    if (c === "<") {
      inTag = true;
      out += c;
      continue;
    }

    if (c === OPEN_DOUBLE) {
      // Pre-existing curly content: pass through unchanged, but update
      // state from it so later straight quotes in the same string resolve
      // against accurate context (the masters mix straight and curly
      // within one sentence). Doubles and singles are tracked
      // INDEPENDENTLY, not as a required outer/inner nesting - real corpus
      // usage (e.g. jude-1.json fn-ff) uses ‘ ’ standalone for short
      // glosses/scare-quotes ("Traditionally, ‘saints’ or ‘holy ones.’
      // “People who were dedicated…” serves…") with no enclosing double at
      // all, alongside separate genuinely-nested usage elsewhere. Only a
      // same-family double-open (“ before a prior “ closes) is treated as
      // an error; that is a real defect independent of the single/double
      // question.
      if (doubleOpen) return refuse("a second “ opens while a double quote is already open (double-inside-double)", i);
      doubleOpen = true;
      out += c;
      continue;
    }
    if (c === CLOSE_DOUBLE) {
      if (!doubleOpen) return refuse("” closes but no double quote is open", i);
      doubleOpen = false;
      out += c;
      continue;
    }
    if (c === OPEN_SINGLE) {
      if (singleOpen) return refuse("a second ‘ opens while a single quote is already open (single-inside-single)", i);
      singleOpen = true;
      out += c;
      continue;
    }
    if (c === CLOSE_SINGLE) {
      // U+2019 is also the apostrophe glyph - do NOT treat every occurrence
      // as a stack pop (that would false-positive on nearly every
      // contraction/possessive already in the text). While a single is
      // open, treat this as closing it UNLESS it's unambiguously a
      // mid-word apostrophe (letters/digits on both sides) - American
      // convention puts closing punctuation inside the quote
      // ("‘holy ones.’"), so the character right before a genuine close is
      // often "." or "," rather than a letter, and requiring
      // word-char-before was the actual bug this replaced. This can
      // misjudge an apostrophe inside still-open quoted text as an early
      // close (e.g. "the boys’ toys" mid-quotation); the safe failure mode
      // is that the quote then ends unbalanced at the true close and this
      // whole string is refused for hand review, never silently wrong.
      if (singleOpen) {
        const prev = prevProseChar(text, spans, i);
        const next = nextProseChar(text, spans, i);
        const midWord = isWordChar(prev) && isWordChar(next);
        if (!midWord) singleOpen = false;
      }
      out += c;
      continue;
    }
    if (c === PRIME) {
      out += c;
      continue;
    }

    if (c === '"') {
      if (!doubleOpen) {
        doubleOpen = true;
        out += OPEN_DOUBLE;
      } else {
        doubleOpen = false;
        out += CLOSE_DOUBLE;
      }
      continue;
    }

    if (c === "'") {
      const prev = prevProseChar(text, spans, i);
      const next = nextProseChar(text, spans, i);
      const prevWord = isWordChar(prev);
      const nextWord = isWordChar(next);

      if (prevWord && nextWord) {
        // Word-internal: unambiguous apostrophe (don't, it's, 90's).
        out += CLOSE_SINGLE;
        continue;
      }
      if (singleOpen) {
        // A single is currently open: prefer state over local punctuation
        // when deciding this is the close, since American convention puts
        // closing punctuation inside the quote ("'holy ones.'" - the
        // character before the closer is "." not a letter, so requiring
        // prevWord here would miss it, which was the actual bug this
        // replaced). Risk: an apostrophe mid-quotation (the boys' toys)
        // can close early; the safe failure mode is the quote then ends
        // unbalanced at its true close and this string is refused for
        // hand review, never silently wrong - see CLOSE_SINGLE above for
        // the same tradeoff on already-curly input.
        singleOpen = false;
        out += CLOSE_SINGLE;
        continue;
      }
      if (prevWord && !nextWord) {
        // End of word, nothing open: a trailing possessive apostrophe
        // (Jesus' sake).
        out += CLOSE_SINGLE;
        continue;
      }
      if (!prevWord && nextWord) {
        // Start of word, nothing open: opens a single quote - covers both
        // a standalone gloss/scare-quote ('saints') and the start of a
        // nested quotation-within-a-quotation, which this module does not
        // need to distinguish since both open the same way.
        const word = leadingWordAfter(text, i);
        if (LEADING_ELISIONS.has(word) || /^[0-9]/.test(next)) {
          // 'tis, 'til, 'cause, 'em, '90s, ... - a leading elision/decade,
          // not a quote delimiter.
          out += CLOSE_SINGLE;
          continue;
        }
        singleOpen = true;
        out += OPEN_SINGLE;
        continue;
      }
      // Neither neighbor is a word character, and nothing is open - no
      // local evidence either way (e.g. a bare ' between two punctuation
      // marks).
      return refuse("' is not adjacent to a word character on either side, and no single quote is open; direction can't be determined from context", i);
    }

    out += c;
  }

  if (doubleOpen || singleOpen) {
    return refuse(
      `unbalanced at end of string (doubleOpen=${doubleOpen}, singleOpen=${singleOpen}) - a quotation may span past this string (e.g. a multi-paragraph quotation), which this module deliberately does not resolve across strings`,
      text.length,
    );
  }

  const primeCountAfter = countOccurrences(out, PRIME);
  if (primeCountAfter !== primeCountBefore) {
    throw new Error(
      `curlify: internal invariant violated - PRIME (U+2032) count changed from ${primeCountBefore} to ${primeCountAfter}. This module must never touch that character.`,
    );
  }

  assertMatchesValidatorPredicate(out);

  return { ok: true, result: out };
}

function countOccurrences(text, char) {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === char) n++;
  return n;
}

// Mirrors `checkProse` in scripts/validate-chapters.mjs exactly (tags
// stripped, then no straight ASCII quote characters and no quote entities).
// Self-asserted on every curlify() result before it's returned as ok:true -
// see module header.
const STRAIGHT_QUOTE_ENTITY_RE = /&(?:quot|apos|#0*3[49]|#x2[27]);/i;

export function matchesValidatorPredicate(html) {
  const prose = html.replace(/<[^>]+>/g, "");
  if (prose.includes('"') || prose.includes("'")) return false;
  if (STRAIGHT_QUOTE_ENTITY_RE.test(prose)) return false;
  return true;
}

function assertMatchesValidatorPredicate(result) {
  if (!matchesValidatorPredicate(result)) {
    throw new Error(
      "curlify: internal invariant violated - the produced result still fails the validator's curly_quotes_in_prose predicate. This is a bug in curl-quotes.mjs, not a property of the input.",
    );
  }
}

// ---------------------------------------------------------------------
// Wrong-direction pair audit (plan: "Add a wrong-direction-pair audit
// (‘lord”) over restored *and* untouched strings in each file, so
// pre-existing imbalances are attributed to history rather than this
// change"). Read-only - reports, never modifies. Intended to be run by
// build-ledger.mjs (or the gate report) across every paragraph/footnote
// string in a chapter, both strings this tool touched and strings it
// didn't, so a pre-existing mismatched pair anywhere in the file is
// surfaced and dated to before this reconciliation rather than blamed on it.
// ---------------------------------------------------------------------

/**
 * Find curly-quote pairs whose opener and closer are from different quote
 * families (an opening ‘ closed by a ” instead of a ’, or an opening “
 * closed by a ’ instead of a ”) - e.g. the `‘lord”` defect CLAUDE.md names.
 * Read-only; does not require or use straight quotes at all, since it exists
 * to find mismatches in text that is ALREADY fully curly.
 * @returns {Array<{opener:string, openPos:number, closer:string, closePos:number, kind:string}>}
 */
export function auditWrongDirectionPairs(text) {
  const spans = findTagSpans(text);
  const findings = [];
  const stack = []; // {char, pos} for “ and ‘ only

  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inTag) {
      if (c === ">") inTag = false;
      continue;
    }
    if (c === "<") {
      inTag = true;
      continue;
    }

    if (c === OPEN_DOUBLE || c === OPEN_SINGLE) {
      stack.push({ char: c, pos: i });
      continue;
    }
    if (c === CLOSE_DOUBLE) {
      const top = stack.pop();
      if (!top) {
        findings.push({ opener: null, openPos: null, closer: c, closePos: i, kind: "orphan-close-double" });
      } else if (top.char !== OPEN_DOUBLE) {
        findings.push({ opener: top.char, openPos: top.pos, closer: c, closePos: i, kind: "wrong-direction" });
      }
      continue;
    }
    if (c === CLOSE_SINGLE) {
      // Same apostrophe-vs-close ambiguity as curlify(), resolved the same
      // way: with something open on the stack, treat this as closing it
      // UNLESS it's unambiguously mid-word (letters/digits on both sides) -
      // American convention puts closing punctuation inside the quote
      // ("‘holy ones.’"), so requiring a word character immediately before
      // would miss real closes. Only report a mismatch when the stack top
      // is specifically the DOUBLE opener (i.e. this ’ is closing something
      // that was opened with “ - the wrong-direction case). When the top is
      // ‘, this is the expected, correctly-paired close and nothing is
      // reported.
      if (stack.length === 0) continue; // ordinary apostrophe with nothing open - not this audit's concern
      const prev = prevProseChar(text, spans, i);
      const next = nextProseChar(text, spans, i);
      if (isWordChar(prev) && isWordChar(next)) continue; // unambiguously mid-word apostrophe, skip
      const top = stack[stack.length - 1];
      if (top.char === OPEN_DOUBLE) {
        stack.pop();
        findings.push({ opener: top.char, openPos: top.pos, closer: c, closePos: i, kind: "wrong-direction" });
      } else {
        stack.pop(); // correctly paired ‘ ... ’
      }
      continue;
    }
  }

  return findings;
}
