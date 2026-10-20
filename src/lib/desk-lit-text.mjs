// src/lib/desk-lit-text.mjs
//
// A chapter's Study View text made ready for /desk's LIT pane (STUDY-DESK.md,
// D9; "Order of work", 3e). The pane shows many chapters in one scroll, and
// two LIT panes can be open at once, so the ids a chapter's page carries
// (`v16`, `fnref-a`, `john-3-p4`) would repeat. Every id is given a prefix
// naming the pane and the chapter, an `aria-describedby` or
// `aria-labelledby` that pointed at one of them follows it, and a footnote
// letter's link keeps the footnote it names in `data-fn`, since the pane
// opens the note in a popover rather than jumping to a list it doesn't show.
//
// Only attributes change. The text, the `data-verse` spans and the markup are
// the page's own, so the anchor text read off the pane is Study View's
// character for character (test/desk-anchor-dom.test.js sweeps every
// published chapter through this). Pure: it needs only childNodes,
// getAttribute and setAttribute, so the tests run it on their small DOM.

const ELEMENT = 1;
const REFS = ["aria-describedby", "aria-labelledby"];

function elements(node, out) {
  for (const child of node.childNodes) {
    if (child.nodeType !== ELEMENT) continue;
    out.push(child);
    elements(child, out);
  }
  return out;
}

const classes = (el) => ` ${el.getAttribute("class") ?? ""} `;

/**
 * Prefix every id in the given blocks (and the links and references that
 * name one), in place.
 *
 * @param {Iterable<Node>} blocks a chapter's `.p` containers
 * @param {string} prefix e.g. "p1-john-3-"
 */
export function prepareLitBlocks(blocks, prefix) {
  const all = [];
  for (const b of blocks) {
    if (b.nodeType !== ELEMENT) continue;
    all.push(b);
    elements(b, all);
  }
  const renamed = new Set();
  for (const el of all) {
    const id = el.getAttribute("id");
    if (!id) continue;
    renamed.add(id);
    el.setAttribute("id", prefix + id);
  }
  for (const el of all) {
    for (const name of REFS) {
      const v = el.getAttribute(name);
      if (!v) continue;
      el.setAttribute(name, v.split(/\s+/).map((t) => (renamed.has(t) ? prefix + t : t)).join(" "));
    }
    if (String(el.tagName).toLowerCase() !== "a") continue;
    const href = el.getAttribute("href") ?? "";
    if (!href.startsWith("#")) continue;
    const target = href.slice(1);
    const parent = el.parentNode;
    if (parent?.getAttribute && classes(parent).includes(" fn-ref ")) el.setAttribute("data-fn", target);
    if (renamed.has(target)) el.setAttribute("href", `#${prefix}${target}`);
  }
}

/** The prefix for one chapter in one pane: "p1-john-3-". */
export const litPrefix = (paneId, bookKey, chapter) => `${paneId}-${bookKey}-${chapter}-`;
