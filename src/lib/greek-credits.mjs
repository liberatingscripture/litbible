// src/lib/greek-credits.mjs
//
// Who the Greek comes from, in one place (CLAUDE.md desk rules 14 and 15).
// The Notebook's Greek tab lists SOURCES in full; every place that shows Greek
// search results (the search tray, /search) carries SEARCH_CREDIT, a one-line
// credit with the same names and links (BA46). The licenses behind both are
// public/greek/LICENSE.txt, written by scripts/build-greek.mjs.
//
// Pure: parts go out as plain data, and each caller draws them with its own
// escaping (`creditHtml`) or as elements.

const SBLGNT = "https://github.com/LogosBible/SBLGNT";
const MORPHGNT = "https://github.com/morphgnt/sblgnt";
const MACULA = "https://github.com/Clear-Bible/macula-greek";
const UBS = "https://github.com/ubsicap/ubs-open-license";
// Credited as STEPBible's README asks: "STEP Bible" linked to www.STEPBible.org.
const STEP = "https://www.stepbible.org/";

/** The license note for everything under public/greek/. */
export const GREEK_LICENSE_HREF = "/greek/LICENSE.txt";

/** The Greek tab's "Sources and licenses": [label, href] each. */
export const SOURCES = [
  ["SBL Greek New Testament (SBLGNT), © 2010 Society of Biblical Literature and Logos Bible Software, CC BY 4.0", SBLGNT],
  ["Lemmas and parsing: MorphGNT, CC BY-SA 3.0", MORPHGNT],
  ["Parsing for John 7:53–8:11 and Romans 16:25–27: MACULA Greek, Clear Bible, CC BY 4.0", MACULA],
  ["UBS Dictionary of the Greek New Testament, United Bible Societies, CC BY-SA 4.0", UBS],
  ["STEP Bible: brief lexicon (TBESG) and full LSJ (TFLSJ), Tyndale House Cambridge, CC BY 4.0, reformatted", STEP],
];

/**
 * The credit under a group of Greek search results, as parts: a string is
 * text, `{ text, href }` a link. The search index draws on every source the
 * tab lists but the LSJ: MACULA gives the Strong's numbers and two passages'
 * parsing, and most glosses a result can match are STEP Bible's brief ones.
 */
export const SEARCH_CREDIT = [
  "Greek: ",
  { text: "SBLGNT", href: SBLGNT },
  "; parsing: ",
  { text: "MorphGNT", href: MORPHGNT },
  " and ",
  { text: "MACULA Greek", href: MACULA },
  "; glosses: ",
  { text: "UBS", href: UBS },
  " and ",
  { text: "STEP Bible", href: STEP },
  " (",
  { text: "licenses", href: GREEK_LICENSE_HREF },
  ").",
];

/** Whether a credit link leaves the site (and so opens in a new tab). */
export const isExternal = (href) => /^https?:\/\//.test(href);

/** The credit's plain text. */
export function creditText(parts = SEARCH_CREDIT) {
  return parts.map((p) => (typeof p === "string" ? p : p.text)).join("");
}

/**
 * The credit as HTML, through the caller's `escape`. A link that leaves the
 * site opens in a new tab with rel="noopener noreferrer", as every such link
 * on the site does.
 */
export function creditHtml(escape, parts = SEARCH_CREDIT) {
  return parts
    .map((p) => {
      if (typeof p === "string") return escape(p);
      const away = isExternal(p.href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escape(p.href)}"${away}>${escape(p.text)}</a>`;
    })
    .join("");
}
