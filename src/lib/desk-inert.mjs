// src/lib/desk-inert.mjs
//
// A fetched page's parts, made inert before anything of them is imported into
// the live document (audit 3 SEC3-2; before it, sheet-lit.js scrubbed a
// passage's words alone). The Study Desk reads a chapter's or an intro's
// built page for its panes, sheets and handouts (desk/chapter-page.js,
// desk/intro-pane.js). The page is the site's own, parsed with DOMParser so
// nothing in it runs or loads, and `chapterPath` / `introPath` refuse any
// address off the site before the fetch. This is the second lock, for the
// day that guard fails as SEC-1 once did: whatever the parts hold, nothing
// imported from them can load a resource, run, or carry a script address.
//
// Applied once, to the parts kept of the fetched document, so every reader
// of those parts (a passage's words, its footnotes, the LIT pane's blocks,
// the Book Intro pane) gets it. It takes any element tree with the DOM's
// `querySelectorAll`, `remove`, `getAttributeNames`, `getAttribute` and
// `removeAttribute`, so a test can run it over a small DOM of its own.

/**
 * Elements that load, run, submit, or change how addresses resolve. A chapter
 * or intro page's text holds none of them; the list is what to strip, not
 * what to keep, since an allowlist written wrong would silently drop a
 * part of the text.
 */
const REMOVE = [
  "script", "style", "link", "meta", "base", "template", "noscript",
  "iframe", "frame", "frameset", "object", "embed", "applet", "portal",
  "img", "picture", "source", "svg", "math", "canvas", "map", "area",
  "audio", "video", "track",
  "form", "input", "button", "textarea", "select", "option", "datalist", "output",
  "dialog", "slot",
].join(", ");

/** Attributes that name a resource, a style sheet's worth of CSS (`url()`), or a target to send to. */
const DROP = new Set([
  "style", "background", "poster", "srcset", "sizes", "ping", "data", "codebase", "classid",
  "action", "formaction", "manifest", "usemap", "itemtype", "contenteditable",
]);

/** Attributes that carry an address, which must be a plain web address. */
const ADDRESS = new Set(["href", "src", "xlink:href", "cite", "longdesc"]);

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Whether an address attribute's value is a plain web address, read as a
 * browser reads it: control characters and spaces anywhere in the scheme are
 * dropped before it is parsed ("java\tscript:" is `javascript:`), and the
 * scheme is what `URL` makes of it against a page on the site, so a relative
 * address and a fragment are fine and `javascript:`, `data:`, `vbscript:` and
 * every other scheme are not.
 */
export function plainAddress(value) {
  const cleaned = String(value ?? "").replace(/[\u0000- \u007f]/g, "");
  try {
    return SAFE_SCHEMES.has(new URL(cleaned, "https://litbible.net/").protocol);
  } catch {
    return false;
  }
}

/**
 * Make an element tree inert, in place: every element in REMOVE goes, every
 * `on*` handler and every attribute in DROP goes, and an address attribute
 * that isn't a plain web address goes. Returns the root.
 */
export function makeInert(root) {
  if (!root) return root;
  for (const el of root.querySelectorAll(REMOVE)) el.remove();
  const scrub = (el) => {
    if (typeof el.getAttributeNames === "function") {
      for (const name of el.getAttributeNames()) {
        const key = name.toLowerCase();
        if (key.startsWith("on") || DROP.has(key) || (ADDRESS.has(key) && !plainAddress(el.getAttribute(name)))) {
          el.removeAttribute(name);
        }
      }
    }
    for (const child of el.children ?? []) scrub(child);
  };
  scrub(root);
  return root;
}
