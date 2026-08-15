// Copied verbatim from the v1 audit (docx-audit/lib/classify.mjs in the
// session scratchpad) - self-contained, nothing to adapt. See
// scripts/reconcile/README.md. NOTE: `characterize()`'s "repo has extra
// content" / "master has extra content" labels are substring-containment
// only - the approved plan's "Two corrections to the agreed rules" section
// found this mislabels 227 of 232 "repo has extra content" findings that are
// really just an added trailing period. build-ledger.mjs must NOT trust this
// label alone; see its word-level LCS shape classification instead.
//
// Characterize a text difference and score its severity for "worst first"
// sorting in the report.

export function characterize(normMaster, normRepo) {
  if (normMaster === normRepo) return null;
  if (!normMaster) return "present in repo only";
  if (!normRepo) return "present in master only";
  if (normRepo.includes(normMaster) && normRepo.length > normMaster.length) return "repo has extra content";
  if (normMaster.includes(normRepo) && normMaster.length > normRepo.length) return "master has extra content";
  return "wording differs";
}

// Small Levenshtein distance, fine for footnote/verse-length strings (a few
// hundred chars) at the volumes this audit produces.
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** 0 = identical, 1 = maximally different (relative to the longer string). */
export function severity(normMaster, normRepo) {
  const maxLen = Math.max(normMaster.length, normRepo.length, 1);
  return levenshtein(normMaster, normRepo) / maxLen;
}
