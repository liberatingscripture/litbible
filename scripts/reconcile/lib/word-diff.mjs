// Word-level change-shape classification for build-ledger.mjs.
//
// Why this exists (plan, "Phase 2"): the v1 audit's `characterize()`
// (docx-audit/lib/classify.mjs) uses substring CONTAINMENT, so `"Or 'man'."`
// reads as "repo has extra content" relative to `"Or 'man'"` - true at the
// character level, but it can't tell a bare trailing-period addition (227 of
// 232 "repo has extra content" findings) from a genuine rewrite. This module
// diffs at WORD granularity via LCS instead, so a shared word sequence with
// one added punctuation token reads as exactly that, not as an opaque
// "different string."
//
// Direction is relative to MASTER, matching how the ledger will use this:
// "added" = a token the repo has that the master doesn't (something the
// import/edits introduced); "removed" = a token the master has that the
// repo doesn't (something lost in the import). Restoring from master would
// undo "added" tokens and bring back "removed" ones.

/** Words (letters/digits, with internal hyphens/apostrophes) and individual
 *  punctuation marks as separate tokens, so "man." tokenizes as ["man", "."]
 *  and a trailing-period addition shows up as one punctuation token, not a
 *  changed word. */
export function tokenize(text) {
  return String(text ?? "").match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g) || [];
}

const isWordToken = (t) => /[A-Za-z0-9]/.test(t);

/**
 * Word-level LCS diff between master and repo text. Case-insensitive for
 * the ALIGNMENT decision (so "Or"/"or" match as the same token - the 227
 * defect records are capitalized AND given a trailing period together), but
 * every op still carries the original-cased token so case-only changes are
 * still visible in `caseChanges`.
 * @returns {{
 *   ops: Array<{type:'equal'|'added'|'removed', master?:string, repo?:string, token?:string}>,
 *   addedWords: number, addedPunct: number,
 *   removedWords: number, removedPunct: number,
 *   caseChanges: number,
 *   masterTokenCount: number, repoTokenCount: number,
 * }}
 */
export function computeWordDiff(masterText, repoText) {
  const masterTokens = tokenize(masterText);
  const repoTokens = tokenize(repoText);
  const masterKey = masterTokens.map((t) => t.toLowerCase());
  const repoKey = repoTokens.map((t) => t.toLowerCase());
  const n = masterTokens.length;
  const m = repoTokens.length;

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = masterKey[i - 1] === repoKey[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (masterKey[i - 1] === repoKey[j - 1]) {
      ops.push({ type: "equal", master: masterTokens[i - 1], repo: repoTokens[j - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: "removed", token: masterTokens[i - 1] });
      i--;
    } else {
      ops.push({ type: "added", token: repoTokens[j - 1] });
      j--;
    }
  }
  while (i > 0) ops.push({ type: "removed", token: masterTokens[--i] });
  while (j > 0) ops.push({ type: "added", token: repoTokens[--j] });
  ops.reverse();

  let addedWords = 0;
  let addedPunct = 0;
  let removedWords = 0;
  let removedPunct = 0;
  let caseChanges = 0;
  for (const op of ops) {
    if (op.type === "added") {
      if (isWordToken(op.token)) addedWords++;
      else addedPunct++;
    } else if (op.type === "removed") {
      if (isWordToken(op.token)) removedWords++;
      else removedPunct++;
    } else if (op.master !== op.repo) {
      caseChanges++;
    }
  }

  return {
    ops,
    addedWords,
    addedPunct,
    removedWords,
    removedPunct,
    caseChanges,
    masterTokenCount: n,
    repoTokenCount: m,
  };
}

// Known literal fragments from the import damage the plan documents by
// example (titus-1.json fn-f/h/l/r/u, and the "See note ..." stubs in
// luke-4/john-6/john-12/1timothy-1). Matched case-sensitively against the
// RAW repo text (not tokens) since these are fixed phrases, not a shape.
const PLACEHOLDER_PATTERNS = [
  /\(full text preserved exactly as provided\)/i,
  /\(full text preserved\)/i,
  /^see note\b/i,
  /\bsee note\b.{0,20}$/i,
];

/**
 * Classify a master/repo text pair's change shape into one of the plan's
 * bucket-A subclasses (placeholder / truncated-or-summarized /
 * punctuation-or-case / rewritten), plus the raw word-diff numbers a ledger
 * record carries in `shape`. Thresholds below are principled defaults
 * reasoned from the plan's description, not calibrated against a live run
 * (build-ledger.mjs is write-only in this session per the task - see
 * scripts/reconcile/README.md) - re-check them against real ledger output
 * before trusting the bucket-A subclass split at scale.
 */
export function classifyShape(masterText, repoText) {
  const diff = computeWordDiff(masterText, repoText);
  const { addedWords, addedPunct, removedWords, removedPunct, caseChanges, masterTokenCount, repoTokenCount } = diff;

  if (PLACEHOLDER_PATTERNS.some((re) => re.test(repoText))) {
    return { subclass: "placeholder", diff };
  }

  // Truncated/summarized: the repo lost a large fraction of the master's
  // words with little or nothing added back - a shortened paraphrase or
  // stub, not a like-for-like rewrite.
  if (masterTokenCount > 0 && removedWords / masterTokenCount > 0.4 && addedWords <= removedWords * 0.3) {
    return { subclass: "truncated-or-summarized", diff };
  }

  // Punctuation/case: every word token aligns (nothing added or removed at
  // word granularity); the only differences are punctuation tokens and/or
  // casing. This is the 227-trailing-period shape ("Or 'man'" -> "Or
  // 'man'.") and its siblings.
  if (addedWords === 0 && removedWords === 0 && (addedPunct > 0 || removedPunct > 0 || caseChanges > 0)) {
    return { subclass: "punctuation-or-case", diff };
  }

  if (addedWords === 0 && removedWords === 0 && addedPunct === 0 && removedPunct === 0) {
    // Word-diff sees no difference at all - normalize() must have found one
    // anyway (this function is only called once the cosmetic gate already
    // passed the pair through as non-cosmetic), most likely a difference in
    // markup this tokenizer doesn't reach. Report as rewritten rather than
    // silently calling it identical - the caller should also check
    // `matchesValidatorPredicate`/HTML-level diffs; this is a strings-only
    // shape signal.
    return { subclass: "rewritten", diff };
  }

  return { subclass: "rewritten", diff };
}
