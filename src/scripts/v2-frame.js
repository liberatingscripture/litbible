// Site 2.0's page frame (SITE-2.0.md, "The system"): marks the contents
// rail's current item as the reader scrolls, with aria-current, which
// v2/base.css draws as the rail's green marker. Used by the pages that have a
// contents column (About, Privacy, the Commitments' longer text) and by the
// podcast page's list of seasons.
// It does nothing without the restyle's stamp, and nothing on a page with no
// rail, so a page may load it always.

/** Which section is current: the last one whose heading has reached `line`
 *  (a little under the top of the window), the first while none has, and the
 *  last once the page is scrolled to its end, where a short final section
 *  could never reach the line. `tops` are the headings' viewport tops, in
 *  page order. Returns -1 for an empty list. */
export function currentIndex(tops, line, atEnd = false) {
  if (!tops.length) return -1;
  if (atEnd) return tops.length - 1;
  let hit = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= line) hit = i;
    else break;
  }
  return hit;
}

function init() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-restyle")) return;
  // The page frame's contents column, or another list of in-page links that
  // asks for the same marking (the podcast's seasons): [data-v2-rail].
  const toc = document.querySelector(".v2-frame__toc, [data-v2-rail]");
  if (!toc) return;
  const pairs = [];
  for (const link of toc.querySelectorAll('a[href^="#"]')) {
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    } catch {
      // A malformed fragment names nothing.
    }
    if (target) pairs.push([link, target]);
  }
  if (!pairs.length) return;

  let current = null;
  const mark = () => {
    // The line sits under the sticky header: the page's own scroll padding,
    // and a little more so a heading counts once it is comfortably in view.
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const atEnd = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    // Only the links that are drawn count: About's sub-headings are in the
    // rail on a computer and out of the small card below that.
    const live = pairs.filter(([link]) => link.getClientRects().length > 0);
    const index = currentIndex(
      live.map(([, target]) => target.getBoundingClientRect().top),
      pad + 96,
      atEnd,
    );
    const link = live[index]?.[0] ?? null;
    if (link === current) return;
    current?.removeAttribute("aria-current");
    link?.setAttribute("aria-current", "location");
    current = link;
  };

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
  mark();
}

if (typeof document !== "undefined") init();
