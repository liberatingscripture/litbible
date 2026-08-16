// Pure hunk logic for the reconciliation review tool. No fs, no DOM - this
// module is imported by BOTH server.mjs and the browser, so the UI groups and
// composes with the same code the server writes decisions from, rather than
// keeping a second copy of a rule that has to agree with it.
//
// WHY HUNKS AND NOT RECORDS. Buckets B and C were dated per footnote and per
// verse, which is too coarse: a note edited in August carries whatever import
// damage it still had into bucket B alongside the edit. So one record routinely
// contains both. 1corinthians-10-fn-g is the canonical example - stripped
// macrons (the master is right) and "reflects" -> "highlights" (the repo is
// right) in the same footnote. Asking "master or repo?" about that record has
// no correct answer. Asking it about each hunk does.
//
// WHAT IS DIFFED. Hunks run between `patch.oldValue` and `patch.newValue`, NOT
// between `text.master` and `text.current`. Those two patch fields are the
// actual splice-able strings: for a footnote, oldValue is the repo's HTML and
// newValue is the master's already run through curlify(); for a verse they are
// whole paragraphs with the vglue wrapper rebuilt and the repo's footnote
// anchors re-inserted. Diffing the display texts instead would produce hunks
// that cannot be composed back into something safe to write.

const COMBINING = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

function deaccent(s) {
  return s.normalize("NFD").replace(COMBINING, "").normalize("NFC");
}

function foldQuotes(s) {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, "-");
}

/** Everything the import is known to damage mechanically: diacritics, quote
 *  characters, and spacing. Two strings equal under this differ in no word. */
export function mechanicalNormalize(s) {
  return foldQuotes(deaccent(String(s ?? ""))).replace(/\s+/g, " ").trim();
}

/** Split into alternating word/whitespace tokens, so a token list rejoins to
 *  the original string exactly. Composition depends on that being lossless. */
/** Markup removed, so two sides can be compared on the words a reader sees. */
export function stripTags(s) {
  return String(s ?? "").replace(/<[^>]*>/g, "");
}

/**
 * Which of the three questions this span is.
 *
 *   mechanical - the two sides differ in no word at all: diacritics, quote
 *                characters, spacing. The master is right by construction,
 *                because those are the import's known damage classes.
 *   structural - the words a reader sees are the same; only HTML differs.
 *                Defaults to the REPO, and that direction matters: the repo's
 *                markup is hand-authored and the master, being Word text, has
 *                none of it. 1corinthians-11-fn-b builds its chiasm out of
 *                <span class="chiasm-key">/<span class="chiasm-text">, and
 *                "restoring" the master there would delete the whole
 *                structure while changing not one word.
 *   judgment   - the words differ. The only kind that needs a person, and the
 *                answer runs both ways: the repo has a typo in
 *                1corinthians-10-fn-ee (arazeloo for parazeloo) and the master
 *                has one in 1corinthians-2-fn-q (Life-breah for Life-breath).
 */
export function classifyHunk(from, to) {
  if (mechanicalNormalize(from) === mechanicalNormalize(to)) return "mechanical";
  if (mechanicalNormalize(stripTags(from)) === mechanicalNormalize(stripTags(to))) return "structural";
  return "judgment";
}

export function tokenize(s) {
  // Backslash-free construction: space/tab/LF/CR by code point, so the
  // pattern survives every editing path this file has been through.
  const WS = String.fromCharCode(32, 9, 10, 13);
  const TOKEN = new RegExp("(<[^>]*>|[" + WS + "]+)");
  return String(s ?? "").split(TOKEN).filter((t) => t !== "");
}

/**
 * Word-level diff of two strings as a list of segments in order:
 *   { type: "same", text }              - shared, never shown as a choice
 *   { type: "hunk", index, from, to, kind } - a place they differ
 * `from` is the repo's text, `to` is the master's. `kind` is "mechanical" when
 * the two sides differ in no word (diacritics/quotes/spacing only) and
 * "judgment" otherwise.
 */
export function diffSegments(oldValue, newValue) {
  const A = tokenize(oldValue);
  const B = tokenize(newValue);
  const n = A.length;
  const m = B.length;

  // LCS table. Records here are a footnote or a paragraph - hundreds of tokens
  // at most, so the quadratic table is not worth avoiding.
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments = [];
  let i = 0;
  let j = 0;
  let same = "";
  let from = "";
  let to = "";
  let hunkIndex = 0;

  const flushHunk = () => {
    if (from === "" && to === "") return;
    segments.push({
      type: "hunk",
      index: hunkIndex++,
      from,
      to,
      kind: classifyHunk(from, to),
    });
    from = "";
    to = "";
  };
  const flushSame = () => {
    if (same === "") return;
    segments.push({ type: "same", text: same });
    same = "";
  };

  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      flushHunk();
      same += A[i];
      i++;
      j++;
      continue;
    }
    flushSame();
    if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) from += A[i++];
    else to += B[j++];
  }
  flushSame();
  flushHunk();
  return markShuffleRuns(segments);
}

/** Most groups are two or three hunks; the longest real one in the corpus is
 *  Luke's `soter` split into five per-character italic runs. The cap keeps
 *  this from degenerating on a record that differs everywhere. */
const MAX_SHUFFLE_RUN = 8;

/**
 * Text that merely crossed a tag boundary is not an editorial question.
 *
 * Two shapes produce this, and both were amber before it existed:
 *
 *   1. The `vglue` wrapper. Rebuilding a verse puts its first word inside the
 *      span; five verses in the corpus close the span before the word instead.
 *      The diff sees one hunk gaining "Finally," and another losing it.
 *   2. Word's run boundaries. The masters routinely split one italic word into
 *      several runs - `soter` arrives as five `<em>` pairs, one per letter,
 *      and `hesed</em>,` as `hesed,</em>`. Extraction is faithful to that, so
 *      the diff reports a cluster of hunks that between them change no letter.
 *
 * So runs of consecutive hunks are classified as well as single hunks: when
 * the repo side of the whole run carries the same reader-visible text as the
 * master side, the run is markup, and every hunk in it takes the kind the
 * concatenation earns. The SHORTEST cancelling run wins, so this stays the
 * least aggressive reading of the evidence.
 *
 * Two guards make it safe. Only `judgment` hunks are eligible, so a macron fix
 * beside a markup move keeps its own "take the master" default. And the sides
 * are concatenated in order with the untouched text between them included, so
 * a genuine transposition ("cat...dog" against "dog...cat") does not cancel -
 * only text that is actually identical does. Hunk indices are never touched;
 * stored verdicts and `compose` key on them.
 */
function markShuffleRuns(segments) {
  const positions = [];
  for (let p = 0; p < segments.length; p++) if (segments[p].type === "hunk") positions.push(p);

  const spanText = (fromIdx, toIdx) => {
    let s = "";
    for (let m = fromIdx; m < toIdx; m++) s += segments[m].text;
    return s;
  };

  for (let a = 0; a < positions.length; a++) {
    if (segments[positions[a]].kind !== "judgment") continue;

    let repo = segments[positions[a]].from;
    let master = segments[positions[a]].to;
    let matched = -1;
    let kind = null;

    for (let b = a + 1; b < positions.length && b - a < MAX_SHUFFLE_RUN; b++) {
      if (segments[positions[b]].kind !== "judgment") break;
      const between = spanText(positions[b - 1] + 1, positions[b]);
      repo += between + segments[positions[b]].from;
      master += between + segments[positions[b]].to;
      const k = classifyHunk(repo, master);
      if (k !== "judgment") {
        matched = b;
        kind = k;
        break; // shortest cancelling run
      }
    }

    if (matched < 0) continue;
    for (let m = a; m <= matched; m++) {
      segments[positions[m]].kind = kind;
      segments[positions[m]].shuffle = true;
    }
    a = matched; // a hunk belongs to at most one run
  }
  return segments;
}

/**
 * Rebuild the string from a per-hunk verdict map.
 * @param {Array} segments  from diffSegments
 * @param {Record<number, "master"|"repo">} verdicts  by hunk index
 * @returns {{ resolved: string, undecided: number[] }}
 *   `undecided` lists hunk indices with no verdict; the caller must not write
 *   a resolved value while any remain.
 */
export function compose(segments, verdicts) {
  let resolved = "";
  const undecided = [];
  for (const seg of segments) {
    if (seg.type === "same") {
      resolved += seg.text;
      continue;
    }
    const v = verdicts[seg.index];
    if (v !== "master" && v !== "repo") {
      undecided.push(seg.index);
      resolved += seg.from; // provisional, never written while undecided is non-empty
      continue;
    }
    resolved += v === "master" ? seg.to : seg.from;
  }
  return { resolved, undecided };
}

/** Mechanical hunks default to the master: diacritics and lost spacing are
 *  import damage, and the quote characters on the master side have already
 *  been through curlify(), so taking them keeps the repo's curly convention.
 *  Structural hunks default to the repo, so markup the master never had is
 *  never deleted by a default. Judgment hunks get no default - that is the
 *  whole point of the tool. */
export function defaultVerdicts(segments) {
  const out = {};
  for (const seg of segments) {
    if (seg.type !== "hunk") continue;
    if (seg.kind === "mechanical") out[seg.index] = "master";
    else if (seg.kind === "structural") out[seg.index] = "repo";
  }
  return out;
}

/** A record is reviewable here only if it has both sides of a patch to diff. */
export function isReviewable(record) {
  return record.patch?.oldValue != null && record.patch?.newValue != null && Array.isArray(record.jsonPath);
}

/**
 * The verdict a fully-decided record carries into out/decisions.json.
 * "approved" means there is something to write; "rejected" means every hunk
 * kept the repo, so the record is settled and apply.mjs must skip it.
 */
export function decisionFor(resolved, oldValue) {
  return resolved === oldValue ? "rejected" : "approved";
}

/** Counts for the progress readout, over a list of records' segment lists. */
export function summarize(segmentLists) {
  const counts = { mechanical: 0, structural: 0, judgment: 0 };
  for (const segs of segmentLists) {
    for (const s of segs) {
      if (s.type === "hunk") counts[s.kind]++;
    }
  }
  return { ...counts, total: counts.mechanical + counts.structural + counts.judgment };
}
