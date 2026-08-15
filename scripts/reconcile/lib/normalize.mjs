// Copied verbatim from the v1 audit (docx-audit/lib/normalize.mjs in the
// session scratchpad) - self-contained, nothing to adapt. See
// scripts/reconcile/README.md.
//
// Shared text normalization for both docx and repo sides.
// NFC, curly quotes -> straight, dashes -> hyphen, whitespace collapse/trim.
// Case-fold only as an explicit secondary pass (capitalization diffs matter).
//
// NOTE: U+2032 (prime) is deliberately NOT folded to an apostrophe - CLAUDE.md
// documents it as intentional chiasm-label notation (1corinthians-11 fn-b),
// not a quote mark.

export function normalize(text) {
  let t = String(text ?? "").normalize("NFC");
  t = t
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

export function normalizeCaseFold(text) {
  return normalize(text).toLowerCase();
}

/** True if a and b differ only pre-normalization (cosmetic), false if they
 *  differ after normalization too (real), null if identical even raw. */
export function classifyDiff(rawA, rawB) {
  if (rawA === rawB) return "identical";
  const na = normalize(rawA);
  const nb = normalize(rawB);
  if (na === nb) return "cosmetic";
  return "real";
}
