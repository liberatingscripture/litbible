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
//
// Images go too, by default (every `img`, `picture` and `source`). The one
// exception is opt-in, `{ siteImages: true }`, which only the Book Intro pane
// passes (E120: Matthew's introduction carries a chart, an `img` of
// /images/matthew-chiasm.png). With it an `img` stays only when its raw `src`
// is a root-relative path under the site's own /images/ folder (SITE_IMAGE:
// no scheme, host, `//`, backslash, `%` or `..`), and it keeps only `src` and
// `alt`. That is safe because the address can name nothing but a file on this
// origin (the CSP's `img-src 'self'` says the same), no attribute that could
// redirect, resize from elsewhere or run survives, and an image that fails
// the check is removed exactly as before. Chapter pages and the search pane
// never pass it.

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

const REMOVE_NO_IMG = REMOVE.replace("img, ", "");

/** A root-relative path under /images/, in plain path characters only. */
const SITE_IMAGE = /^\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Whether an `img`'s raw `src` is one of the site's own images. */
export function siteImageSrc(value) {
  return typeof value === "string" && SITE_IMAGE.test(value) && !value.includes("//") && !value.split("/").includes("..");
}

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
 * that isn't a plain web address goes. With `siteImages`, an `img` of the
 * site's own /images/ folder is kept with its `src` and `alt` alone (see the
 * header). Returns the root.
 */
export function makeInert(root, options = {}) {
  if (!root) return root;
  const siteImages = Boolean(options && options.siteImages);
  for (const el of root.querySelectorAll(siteImages ? REMOVE_NO_IMG : REMOVE)) el.remove();
  if (siteImages) {
    for (const img of root.querySelectorAll("img")) {
      if (!siteImageSrc(img.getAttribute("src"))) {
        img.remove();
        continue;
      }
      for (const name of img.getAttributeNames()) {
        if (name !== "src" && name !== "alt") img.removeAttribute(name);
      }
      img.setAttribute("decoding", "async");
      img.setAttribute("loading", "lazy");
    }
  }
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
