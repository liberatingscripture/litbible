// Structural guards on a restore, applied after a patch is built and before
// it is offered for automatic application.
//
// WHY THESE EXIST. Bucket A means "the repo's text settled during the import
// window", which is good evidence that the repo is the damaged side - and it
// is exactly that, evidence, not proof. The records that reach these guards
// are the ones that were HELD for years by a coarser rule, so they are
// unusual by selection, and unusual turns out to correlate with the master
// having problems of its own. Each guard below is one shape found by
// inspecting the 63 records that became applicable when the quote-ambiguous
// hold was lifted; none is hypothetical.
//
// A guard HOLDS a record. It never edits one, and it never decides which side
// is right - it says "a machine must not settle this", which routes the record
// to `npm run review:reconcile` where a person can.

const flatten = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Does this verse restore move text across a verse boundary?
 *
 * John 8 is the case: the master ends verse 19 one sentence LATER than the
 * repo does, so restoring 19 appends "You don't recognize either me or my
 * Father..." to it while restoring 20 deletes the same sentence. Both patches
 * are individually well-formed and together they would rewrite where John 8:19
 * ends - silently invalidating every `#v19` deep link, alignment record, and
 * search result for the verses involved.
 *
 * That is a VERSIFICATION difference, not import damage, and it is unsurprising
 * where it was found: John 8 is where LIT retains the pericope adulterae that
 * SBLGNT omits, so the two sides are numbering around a passage they disagree
 * about carrying at all.
 *
 * The test is exact rather than heuristic: when one side's verse text is the
 * other's plus a run of text at one end, look for that same run at the
 * adjoining end of the ADJACENT verse on the other side. If it is there, the
 * two sides agree about the words and disagree about the boundary.
 */
export function verseBoundaryDisagreement(masterVerses, repoVerses, v) {
  const m = flatten(masterVerses.get(v));
  const r = flatten(repoVerses.get(v));
  if (!m || !r || m === r) return null;

  const near = (s) => s.slice(0, 40);
  const nearEnd = (s) => s.slice(-40);

  const check = (long, short, adjacent, atStart) => {
    if (!long.startsWith(short) && !long.endsWith(short)) return null;
    const extra = atStart ? long.slice(short.length).trim() : long.slice(0, long.length - short.length).trim();
    if (extra.length < 12) return null; // punctuation and stray words are not a boundary move
    const other = flatten(adjacent);
    if (!other) return null;
    return atStart ? other.startsWith(near(extra)) : other.endsWith(nearEnd(extra));
  };

  if (m.length > r.length) {
    if (m.startsWith(r) && check(m, r, repoVerses.get(v + 1), true)) {
      return `the master's verse ${v} runs on into text the repo carries in verse ${v + 1}`;
    }
    if (m.endsWith(r) && check(m, r, repoVerses.get(v - 1), false)) {
      return `the master's verse ${v} opens with text the repo carries in verse ${v - 1}`;
    }
  } else {
    if (r.startsWith(m) && check(r, m, masterVerses.get(v + 1), true)) {
      return `the repo's verse ${v} runs on into text the master carries in verse ${v + 1}`;
    }
    if (r.endsWith(m) && check(r, m, masterVerses.get(v - 1), false)) {
      return `the repo's verse ${v} opens with text the master carries in verse ${v - 1}`;
    }
  }
  return null;
}

const DOUBLED_WORD_RE = /\b(\w+)\s+\1\b/gi;

/**
 * Shapes that make a restore suspect on its face, whichever record it is.
 * `kind` is "verse" or "footnote" - two of these apply to one and not the
 * other, and the asymmetry is the point.
 *
 * @param {{kind:string, masterText:string, repoText:string}} rec
 * @returns {string|null} a hold reason, or null to allow
 */
export function suspectRestore({ kind, masterText, repoText }) {
  const m = flatten(masterText);
  const r = flatten(repoText);

  // A doubled word the repo does not have is a typo in the master. john-7-fn-q
  // reads "the path laid out in in Torah".
  const dupM = m.match(DOUBLED_WORD_RE) || [];
  const dupR = r.match(DOUBLED_WORD_RE) || [];
  const gained = dupM.filter((d) => !dupR.includes(d));
  if (gained.length) {
    return `restoring would introduce a doubled word the repo does not have (${gained.join(", ")}) - a typo in the master`;
  }

  // Square brackets in SCRIPTURE are an in-progress editorial mark, not
  // punctuation: John 11's master reads "[Miriam]" and "come to […] Miriam"
  // where the repo reads plainly. Across every published chapter the corpus has
  // two square brackets in verse text total, so introducing one is anomalous by
  // a wide margin. FOOTNOTES are the opposite - they quote sources, and an
  // elision or a gloss inside a quotation ("to arrange [troop divisions] in a
  // military fashion", from the TDNT) is ordinary and correct.
  if (kind === "verse") {
    const bracketsM = (m.match(/[[\]]/g) || []).length;
    const bracketsR = (r.match(/[[\]]/g) || []).length;
    if (bracketsM > bracketsR) {
      return "restoring would introduce square brackets into scripture text - the master is carrying an in-progress editorial mark";
    }
  }

  // The import's damage direction is truncation, so a restore normally
  // lengthens. One that more than halves the text is going the wrong way:
  // john-2-fn-w would replace the import's own "verify and complete this"
  // placeholder with the master's `This is 'they trusted the sc`, which is
  // itself cut off. Losing a warning to a fragment is worse than either.
  if (m.length && r.length && m.length * 2 < r.length) {
    return `restoring would cut this text to less than half its current length (${r.length} -> ${m.length} characters) - the master looks truncated here`;
  }

  return null;
}
