// src/lib/levenshtein.mjs
//
// Edit distance, shared by the verse search's typo correction and topic
// suggestions (src/scripts/search-core.js) and the Greek search's near
// misses (src/lib/greek-search.mjs). Import-free, so node --test reaches it.

export function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = d[0];
    d[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = d[i];
      d[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, d[i], d[i - 1]);
      prev = temp;
    }
  }
  return d[m];
}
