// src/lib/desk-sheet-copy.mjs
//
// A sheet on paper (STUDY-DESK.md, "Order of work", 3i): what the leader's and
// the participant's copies hold (S4), the code printed for each chapter (S5),
// how the key terms box reads where its words are blanked, the paper (Letter or
// A4, C27), and how a sheet's own words are shown. The rules only; /sheets/
// draws them (src/scripts/desk/sheet-copy.js). Pure, so the copies can be
// tested without a page.
//
// Nothing here is stored. A copy is worked out from the sheet record and
// today's text every time it is shown, printed or copied, as the format asks
// (STUDY-DESK-FORMAT.md, "Sheets (kind 9)", rule 1).

import { bookKeyToLabel } from "../data/books.js";
import { printableUrl } from "./lit-credit.mjs";
import { MODULE_TYPES, sanitizeSheetHtml } from "./desk-sheet-format.mjs";
import { blanksGivenAway } from "./desk-sheet-lit.mjs";
import { linkScriptureRefs } from "./scripture-refs.mjs";
import { openExternalLinks } from "./external-links.mjs";

/** The two copies of a sheet (S4). */
export const COPIES = Object.freeze(["leader", "participant"]);

/** What each copy is called, on the page and on paper ("Participant copy", as the mock had it). */
export const COPY_NAMES = Object.freeze({ leader: "Leader copy", participant: "Participant copy" });

/** The site's address for codes and the foot of a copy: the apex host (STUDY-DESK-FORMAT.md, "Addresses"). */
export const SITE = "https://litbible.net";

/**
 * The modules a copy prints, in order. The participant's copy leaves out every
 * module marked Leader only; the leader's has them all. A module of a type
 * this version doesn't know prints on neither, since nothing here knows how
 * to draw it (the editor keeps it and says so).
 *
 * @param {{ modules?: object[] }} sheet
 * @param {"leader" | "participant"} copy
 */
export function modulesForCopy(sheet, copy) {
  return (sheet?.modules ?? []).filter(
    (m) => m && MODULE_TYPES.includes(m.type) && (copy === "leader" || m.leaderOnly !== true),
  );
}

/** A chapter's address with a verse or range: "https://litbible.net/romans-8/#v1-4". */
export function verseUrl(bookKey, chapter, verse, endVerse = verse) {
  const end = endVerse ?? verse;
  const frag = verse ? `#v${verse}${end > verse ? `-${end}` : ""}` : "";
  return `${SITE}/${bookKey}-${chapter}/${frag}`;
}

/**
 * One code per chapter the copy quotes (S5), in the order the copy first
 * quotes each: { key, bookKey, chapter, label, url, printable, moduleId }.
 * The code opens the chapter at the first passage the copy takes from it
 * ("https://litbible.net/romans-8/#v1-4"); `printable` is the chapter's
 * address as the foot of the page prints it ("litbible.net/romans-8"), and
 * `moduleId` the passage the code is printed beside. Both apps claim these
 * addresses, so a phone opens the app where it is installed.
 *
 * @param {object[]} modules the copy's modules (modulesForCopy)
 */
export function chapterCodes(modules) {
  const out = [];
  const seen = new Set();
  for (const m of modules ?? []) {
    if (m?.type !== "passage" || !m.bookKey || !Number.isInteger(m.chapter)) continue;
    const key = `${m.bookKey}-${m.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      bookKey: m.bookKey,
      chapter: m.chapter,
      label: `${bookKeyToLabel(m.bookKey)} ${m.chapter}`,
      url: verseUrl(m.bookKey, m.chapter, m.verse, m.endVerse ?? m.verse),
      printable: printableUrl(`${SITE}/${key}/`),
      moduleId: m.id,
    });
  }
  return out;
}

/**
 * The key terms box as a copy prints it. On the participant's copy a rendering
 * that would give a blank away prints as a blank too, by the rule the footnote
 * picker uses (a shared word stem, desk-sheet-lit's blanksGivenAway), and the
 * box says how many terms are left blank. The leader's copy prints every
 * rendering. Omitted terms are left out of both.
 *
 * @param {{ id: string, renderings: string[], traditional: string, greek: string, omitted?: boolean }[]} terms
 * @param {{ exact: string }[]} blanks the blanks that print on this copy
 * @param {"leader" | "participant"} copy
 * @returns {{ terms: { id: string, renderings: { text: string, blank: boolean }[], traditional: string, greek: string }[], blanked: number }}
 */
export function keyTermsForCopy(terms, blanks, copy) {
  let blanked = 0;
  const out = [];
  for (const t of terms ?? []) {
    if (t.omitted) continue;
    const renderings = t.renderings.map((text) => ({
      text,
      blank: copy === "participant" && blanksGivenAway(text, blanks ?? []).length > 0,
    }));
    if (renderings.some((r) => r.blank)) blanked += 1;
    out.push({ id: t.id, renderings, traditional: t.traditional, greek: t.greek });
  }
  return { terms: out, blanked };
}

/** The line under the participant's key terms box when some are blank. */
export function blankedTermsNote(n) {
  if (!n) return "";
  return n === 1
    ? "One term is left blank here. Its answer is on the leader copy."
    : `${n} terms are left blank here. Their answers are on the leader copy.`;
}

/**
 * A sheet's own formatted words as they are shown and printed: sanitized again
 * (the format sanitizes on the way out as well as in), with scripture
 * references linked and links leaving the site opening in a new tab, as a
 * note's are (noteBodyHtml). Neither of the last two is ever stored.
 */
export function sheetHtmlForShow(html) {
  return openExternalLinks(linkScriptureRefs(sanitizeSheetHtml(html ?? "")));
}

/* ── Paper ──────────────────────────────────────────────────────────── */

/** The two papers a sheet prints on (C27), with their margins. */
export const PAPERS = Object.freeze({
  letter: Object.freeze({ name: "US Letter", size: "letter", margin: "0.75in", width: "8.5in" }),
  a4: Object.freeze({ name: "A4", size: "A4", margin: "18mm", width: "210mm" }),
});

// Where Letter is the usual paper: the United States and Canada, and the parts
// of Latin America and Asia that follow them. Everywhere else uses A4.
const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "CR", "GT", "PA", "DO", "PR", "SV", "NI"]);

/**
 * The paper a reader most likely has, from their languages: the first that
 * names (or implies) a region decides. "en" alone is taken as the United
 * States, the way the browser's own region guess would.
 *
 * @param {readonly string[]} locales e.g. navigator.languages
 * @returns {"letter" | "a4"}
 */
export function defaultPaper(locales) {
  for (const tag of locales ?? []) {
    let region = null;
    try {
      region = new Intl.Locale(tag).maximize().region ?? null;
    } catch (_) {
      continue;
    }
    if (region) return LETTER_REGIONS.has(region) ? "letter" : "a4";
  }
  return "letter";
}

/** A remembered paper name, or null when it isn't one. */
export const paperName = (value) => (Object.hasOwn(PAPERS, value) ? value : null);

/** The @page rule for a paper. */
export function pageRule(paper) {
  const p = PAPERS[paperName(paper) ?? "letter"];
  return `@page { size: ${p.size}; margin: ${p.margin}; }`;
}

/* ── Plain text (the Word copy's second flavor) ─────────────────────── */

/** A blank in plain text: a line, and its hint after it in brackets. */
export function plainBlank(hint) {
  return hint ? `________ (${hint})` : "________";
}
