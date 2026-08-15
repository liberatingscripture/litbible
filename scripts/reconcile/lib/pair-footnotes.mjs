// Copied verbatim from the v1 audit (docx-audit/lib/pair-footnotes.mjs in the
// session scratchpad) - imports only ./normalize.mjs relatively, so nothing
// needed adapting. See scripts/reconcile/README.md.
//
// Pair a chapter's master footnote sequence against the repo's.
//
// Plain exact-text LCS (the first version of this module) breaks down when
// a stretch of footnotes has BOTH a genuine insertion/deletion AND ordinary
// paraphrasing nearby (verified case: 1corinthians 15, where the repo has
// two footnotes the master lacks, v29 and v44, and several neighbouring
// notes were also reworded) - since none of the reworded pairs count as
// "equal" for exact-match LCS, the whole stretch becomes one large
// unmatched island and gets paired by raw position, which is simply wrong
// (it paired master's "Traditionally, 'glory'" against repo's unrelated
// "entrope" footnote).
//
// This is a full Needleman-Wunsch global alignment instead: every
// (master[i], repo[j]) pair gets a similarity score (Jaccard over
// significant words - cheap, and robust to paraphrasing since most of a
// reworded footnote's vocabulary survives even when the wording changes),
// and the DP finds the highest-scoring alignment allowing gaps on either
// side. A weakly-similar "aligned" pair (near-zero shared vocabulary) is
// reclassified as two unrelated insertions after the fact, since that's
// really "master has one note here, repo has an unrelated one" rather than
// one note reworded into the other.
import { normalize } from "./normalize.mjs";

const GAP_PENALTY = -0.6;

function tokenSet(s) {
  const words = String(s || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  return new Set(words);
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

/**
 * @param {Array<{id:string, verse:number|null, orderIndex:number}>} masterList
 * @param {Array<{refId:string, verse:number|null, orderIndex:number, text:string}>} repoList
 * @param {Map<string,string>} footnoteTextMap master id -> raw text
 */
export function pairFootnotes(masterList, repoList, footnoteTextMap) {
  const n = masterList.length;
  const m = repoList.length;
  if (n === 0 && m === 0) return [];

  const masterNorm = masterList.map((x) => normalize(footnoteTextMap.get(x.id) || ""));
  const repoNorm = repoList.map((x) => normalize(x.text || ""));
  const masterSets = masterNorm.map(tokenSet);
  const repoSets = repoNorm.map(tokenSet);

  // score[i][j] = similarity between master[i-1] and repo[j-1] (1-indexed DP)
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) dp[i][0] = i * GAP_PENALTY;
  for (let j = 1; j <= m; j++) dp[0][j] = j * GAP_PENALTY;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = masterNorm[i - 1] === repoNorm[j - 1] ? 1 : jaccard(masterSets[i - 1], repoSets[j - 1]);
      const diag = dp[i - 1][j - 1] + matchScore;
      const up = dp[i - 1][j] + GAP_PENALTY;
      const left = dp[i][j - 1] + GAP_PENALTY;
      dp[i][j] = Math.max(diag, up, left);
    }
  }

  // Traceback from (n, m) to (0, 0).
  const steps = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const matchScore = masterNorm[i - 1] === repoNorm[j - 1] ? 1 : jaccard(masterSets[i - 1], repoSets[j - 1]);
      if (dp[i][j] === dp[i - 1][j - 1] + matchScore) {
        steps.push({ type: "align", i: i - 1, j: j - 1, score: matchScore });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP_PENALTY) {
      steps.push({ type: "master-only", i: i - 1 });
      i--;
      continue;
    }
    steps.push({ type: "repo-only", j: j - 1 });
    j--;
  }
  steps.reverse();

  const results = [];
  for (const s of steps) {
    if (s.type === "master-only") {
      results.push({ type: "master-only", master: masterList[s.i] });
    } else if (s.type === "repo-only") {
      results.push({ type: "repo-only", repo: repoList[s.j] });
    } else if (masterNorm[s.i] === repoNorm[s.j]) {
      results.push({ type: "match", master: masterList[s.i], repo: repoList[s.j] });
    } else {
      // The DP already prefers a real gap over forcing a low-similarity
      // alignment whenever that's the higher-scoring option OVERALL (a
      // genuinely inserted footnote would otherwise drag every subsequent
      // pair's score down too) - so an "align" step surviving to here,
      // however dissimilar, reflects the two occupying the same reading-
      // order/verse slot with no better global alignment available. Report
      // it as a rewritten note rather than splitting it into an unrelated
      // insertion + deletion (verified case: colossians-1 fn-y, where the
      // master's short "Traditionally, 'the church'" and the repo's long
      // rewritten note share almost no vocabulary but are still the same
      // slot - both anchored at v18, otherwise-perfect 1:1 alignment around
      // them on both sides).
      results.push({ type: "paired-differs", master: masterList[s.i], repo: repoList[s.j] });
    }
  }
  return results;
}
