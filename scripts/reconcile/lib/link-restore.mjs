// Restore the repo's real <a> attributes onto a master-derived hyperlink,
// the same way build-ledger.mjs's restoreAnchors restores footnote-ref
// anchors - by substituting the repo's own markup BEFORE compose ever runs,
// so the diff sees no hunk there at all and no verdict can strip it.
//
// WHY THIS EXISTS. lib/docx-runs.mjs synthesizes a hyperlink only when the
// visible text IS an absolute http(s) URL, and always as the bare shape
// `<a href="X">X</a>` - it has no way to know the repo's target="_blank",
// rel="noopener", or a visible label that differs from the URL, because
// none of that is recoverable from a plain scan of the run text. Composing
// straight from that bare tag is fine when the whole tag falls inside a
// hunk the compose verdict sends to the repo - but when wording changed
// nearby, the tag can fall inside a hunk that resolves to master instead,
// and the attributes are silently dropped. That happened to two of the
// three links in 1corinthians-14 fn-ee: the surviving one was inside a
// hunk that happened to resolve to the repo, not because anything treated
// links specially.
//
// THE FIX. Before compose runs, find every master `<a href="X">X</a>` and
// replace it wholesale with the repo's own `<a href="X" ...>...</a>` for
// the same href. After this, master and repo are byte-identical at every
// link position, so no hunk can ever form there.
//
// SCOPE. Only the shape lib/docx-runs.mjs actually produces: href equals
// the visible text. A repo link whose visible text differs from its href
// (a hand-authored label like "Read more") has no master counterpart to
// find by this method - structuredHtmlReason in build-ledger.mjs still
// forces those to hand-review, and rightly so.

const MASTER_LINK_RE = /<a href="([^"]*)">\1<\/a>/g;
const REPO_LINK_RE = /<a\s+href="([^"]*)"[^>]*>[\s\S]*?<\/a>/g;

/**
 * @param {string} masterHtml  master-extracted HTML, as produced by
 *   lib/docx-runs.mjs (may contain zero or more bare auto-links)
 * @param {string} repoHtml    the repo's current text for the same span
 * @returns {{ok:true, html:string} | {ok:false, reason:string}}
 *   ok:false means at least one master link's href has no repo counterpart
 *   to restore attributes from - held rather than guessed, same as a
 *   footnote-anchor count mismatch.
 */
export function restoreLinkAttributes(masterHtml, repoHtml) {
  MASTER_LINK_RE.lastIndex = 0;
  if (!MASTER_LINK_RE.test(masterHtml)) return { ok: true, html: masterHtml };

  const repoByHref = new Map();
  REPO_LINK_RE.lastIndex = 0;
  let m;
  while ((m = REPO_LINK_RE.exec(repoHtml))) {
    if (!repoByHref.has(m[1])) repoByHref.set(m[1], []);
    repoByHref.get(m[1]).push(m[0]);
  }

  let refusal = null;
  MASTER_LINK_RE.lastIndex = 0;
  const html = masterHtml.replace(MASTER_LINK_RE, (whole, href) => {
    if (refusal) return whole;
    const queue = repoByHref.get(href);
    if (!queue || queue.length === 0) {
      refusal = `restoring would carry a link (${href}) whose attributes the repo has no counterpart for`;
      return whole;
    }
    return queue.shift();
  });

  if (refusal) return { ok: false, reason: refusal };
  return { ok: true, html };
}
