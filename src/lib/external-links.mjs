// Opens every link that leaves the site in a new tab (owner, 2026-10-01).
//
// Run over rendered HTML at build time, like the scripture linker: the chapter
// JSON, the intro files and the articles keep their plain `<a href>`, because
// the apps read those and a `target` is a website decision. The pass adds
// `target="_blank"` and `rel="noopener noreferrer"` to an anchor whose href is
// an absolute http(s) address on another host, and touches nothing else:
//
//   - a link to litbible.net (any spelling) stays in the tab, since the site's
//     own articles sometimes write their own address in full;
//   - an anchor that already has a `target` keeps it (a hand-written one wins),
//     though a missing `rel` is still filled in;
//   - a `rel` that exists is kept and extended, never replaced, so `external`
//     on the app-store buttons survives.
//
// Pure: no fs, no Astro. The hand-written anchors in .astro files can't pass
// through it (they aren't a string at build time), so they carry the same two
// attributes by hand; keep the two in step.

const OWN_HOSTS = new Set(["litbible.net", "www.litbible.net"]);

const ANCHOR_RE = /<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const ATTR_RE = (name) => new RegExp(`(\\s${name}\\s*=\\s*)("([^"]*)"|'([^']*)')`, "i");

/** True when `href` is an absolute http(s) address on a host that isn't this site. */
export function isExternalHref(href) {
  const m = /^(?:https?:)?\/\/([^/?#:]+)/i.exec(href.trim());
  if (!m) return false;
  return !OWN_HOSTS.has(m[1].toLowerCase());
}

function attrValue(tag, name) {
  const m = ATTR_RE(name).exec(tag);
  return m ? (m[3] ?? m[4]) : null;
}

function withRel(tag) {
  const wanted = ["noopener", "noreferrer"];
  const m = ATTR_RE("rel").exec(tag);
  if (!m) return tag.replace(/\s*\/?>$/, (end) => ` rel="${wanted.join(" ")}"${end}`);
  const have = (m[3] ?? m[4]).split(/\s+/).filter(Boolean);
  const merged = [...have, ...wanted.filter((w) => !have.includes(w))];
  return tag.replace(ATTR_RE("rel"), `$1"${merged.join(" ")}"`);
}

/** Adds target="_blank" and rel="noopener noreferrer" to the external anchors in `html`. */
export function openExternalLinks(html) {
  if (!html || !html.includes("<a")) return html;
  return html.replace(ANCHOR_RE, (tag) => {
    const href = attrValue(tag, "href");
    if (href == null || !isExternalHref(href.replace(/&amp;/g, "&"))) return tag;
    let out = withRel(tag);
    if (attrValue(out, "target") == null) {
      out = out.replace(/\s*\/?>$/, (end) => ` target="_blank"${end}`);
    }
    return out;
  });
}
