// src/lib/desk-sheet-doc.mjs
//
// A sheet's copy as a document (STUDY-DESK-FIXES.md, E37; STUDY-DESK.md, S9):
// the neutral model every way out of /sheets/ writes from, so Copy and the
// files under "Save as" can't disagree about what the copy says. The DOM walk
// that reads the copy on screen into this model is `readCopy` in
// src/scripts/desk/sheets/sheet-word.js; this file is pure and tested.
//
// The model is the copy's parts in order, as blocks, and each block's words
// as a small tree of inline pieces. It keeps the copy's own shapes (a passage
// reference, a "Leader only" tag, ruled lines, a footnote under its passage)
// rather than flattening them to paragraphs, because each writer sets them
// differently: Copy as the HTML a word processor pastes (docHtml) and plain
// text (docText), and the files as WordprocessingML (desk-doc-docx.mjs),
// OpenDocument (desk-doc-odt.mjs) and RTF (desk-doc-rtf.mjs), each reading
// the inline tree as runs (docRuns).
//
// Blocks:
//   { type: "title", text }      the sheet's name (h1)
//   { type: "subtitle", text }   its subtitle and version
//   { type: "section", text, flush? }  a passage's reference, or "Key terms" (h2);
//                                flush: no space above it, at the top of a box
//   { type: "tag", text }        "Leader only"
//   { type: "heading", level, inlines, align?, poetry? }   a sheet's own h2 or h3
//   { type: "para", inlines, align?, poetry? }             poetry: a line of an hbq quotation
//   { type: "quote", blocks }    a blockquote that isn't poetry
//   { type: "box", blocks }      a ruled box around its blocks: the key terms (E57)
//   { type: "list", ordered, items: [{ inlines, lists: [list blocks] }] }
//   { type: "rule" }             a horizontal rule
//   { type: "note", label, inlines }   a footnote, under its passage
//   { type: "answer" }           the "Answer" label on the leader's version
//   { type: "lines", count }     lines to write on
//   { type: "break" }            a page break
//   { type: "gap" }              a blank line in the plain text only
//   { type: "foot", inlines, credit? }   the copy's foot; credit marks LIT_CREDIT_LINE's line
//   { type: "code", svg, caption, label }   a code to scan; a file writer
//                                           needs `png` and `pixels` added
// Inline pieces:
//   { t: "text", text }   as the page holds it (the writers collapse its spaces)
//   { t: "em" | "strong" | "u" | "s" | "sub" | "sup", kids }   sup: the reader's
//                         own superscript ("1st"), never a footnote letter (DK3-5)
//   { t: "link", href, kids }   href absolute (http, https or mailto), a valid
//                               URI (docHref)
//   { t: "style", color?, mark?, size?, kids }   names from DOC_COLORS, DOC_MARKS, DOC_SIZES
//   { t: "blank", answer, hint }   answer null on the participant's version
//   { t: "vn", text }   a verse number;  { t: "fn", text }   a footnote letter
//   { t: "br" }

import { plainBlank } from "./desk-sheet-copy.mjs";
import { LIT_CREDIT_LINE } from "./lit-credit.mjs";

/** A sheet's named colors as they print on white. */
export const DOC_COLORS = Object.freeze({ red: "#b3261e", blue: "#1d4fb8", green: "#0f6b33", purple: "#6b3fa0", gray: "#595e57" });
/** The highlight tints as they look on white, which is what sheets-page.css prints. */
export const DOC_MARKS = Object.freeze({ yellow: "#ffeea3", green: "#ddefb2", blue: "#cfe4ff", pink: "#ffd9e9" });
/** A sheet's text sizes, against the text around them. */
export const DOC_SIZES = Object.freeze({ small: 0.85, large: 1.2, larger: 1.45 });
/** A blank's hint, against the text around it. */
export const HINT_SIZE = 0.8;
/** A participant's blank: underlined no-break spaces, as Copy has always pasted it. */
export const BLANK_SPACES = 16;
/** The key terms box's rule, as the paper copy draws it (sheets-page.css): 0.75pt, 8pt by 10pt inside, and `gap` points of space above it. */
export const DOC_BOX = Object.freeze({ color: "1D231C", pt: 0.75, padY: 8, padX: 10, gap: 10 });
const BOX_CSS = `border:${DOC_BOX.pt}pt solid #${DOC_BOX.color};padding:${DOC_BOX.padY}pt ${DOC_BOX.padX}pt`;
/** One line to write on, in the plain text. */
const RULE = "_".repeat(60);

/**
 * The "Save as" menu (E37): its groups, in order, and their items. Phase A is
 * the document group; a later "Slides" group goes in this list, and the menu
 * draws whatever is here. An item with `print` runs the toolbar's Print
 * instead of writing a file, and its `hint` says what to choose there.
 */
export const SAVE_GROUPS = Object.freeze([
  Object.freeze({
    id: "document",
    label: "A document",
    items: Object.freeze([
      Object.freeze({ id: "docx", label: "Word document (.docx)", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      Object.freeze({ id: "odt", label: "OpenDocument text (.odt)", ext: "odt", mime: "application/vnd.oasis.opendocument.text" }),
      Object.freeze({ id: "rtf", label: "Rich text (.rtf)", ext: "rtf", mime: "application/rtf" }),
      Object.freeze({ id: "pdf", label: "PDF…", print: true, hint: "Opens Print. Choose “Save as PDF” there." }),
    ]),
  }),
  // E37 phase B: the room's screens as slides, whichever version is on screen,
  // with the leader's notes as speaker notes in the leader's version only
  // (desk-slides.mjs; SEC3-3).
  Object.freeze({
    id: "slides",
    label: "Slides",
    items: Object.freeze([
      Object.freeze({ id: "pptx", label: "PowerPoint (.pptx)", ext: "pptx", slides: true, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
      Object.freeze({ id: "odp", label: "OpenDocument slides (.odp)", ext: "odp", slides: true, mime: "application/vnd.oasis.opendocument.presentation" }),
      Object.freeze({ id: "slides-pdf", label: "PDF…", slides: true, print: true, hint: "Opens Print with one slide a page. Choose “Save as PDF” there." }),
    ]),
  }),
]);

/**
 * A link's address as the files and Copy write it: absolute (http, https or
 * mailto) and a valid URI, with a space or a non-ASCII character
 * percent-encoded as a browser would, since Word and other Open XML readers
 * may refuse a relationship target that isn't (DK3-9). Null for an address
 * that isn't one of those or can't be read.
 */
export function docHref(href) {
  const abs = String(href ?? "").trim();
  if (!/^(https?:|mailto:)/i.test(abs)) return null;
  try {
    return new URL(abs).href;
  } catch (_) {
    return null;
  }
}

/* ── Copy: HTML and plain text ─────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
/** Collapse source whitespace the way a browser would. */
const squash = (s) => s.replace(/[ \t\r\n]+/g, " ");

/** A blank's hint after it, in brackets: a word processor can't stack it beneath. */
const hintHtml = (hint) => (hint ? ` <span style="font-size:${HINT_SIZE}em">(${esc(hint)})</span>` : "");

function inlineHtml(nodes) {
  let out = "";
  for (const n of nodes) {
    if (n.t === "text") out += esc(n.text);
    else if (n.t === "br") out += "<br>";
    else if (n.t === "vn") out += `<sup><b>${esc(n.text)}</b></sup>&nbsp;`;
    else if (n.t === "fn") out += `<sup>${esc(n.text)}</sup>`;
    else if (n.t === "blank") {
      out += n.answer != null ? `<u><b>${esc(n.answer)}</b></u>` : `<u>${"&nbsp;".repeat(BLANK_SPACES)}</u>`;
      out += hintHtml(n.hint);
    } else if (n.t === "link") out += `<a href="${attr(n.href)}">${inlineHtml(n.kids)}</a>`;
    else if (n.t === "style") {
      const style = [];
      if (n.color) style.push(`color:${DOC_COLORS[n.color]}`);
      if (n.mark) style.push(`background-color:${DOC_MARKS[n.mark]}`);
      if (n.size) style.push(`font-size:${DOC_SIZES[n.size]}em`);
      out += `<span style="${style.join(";")}">${inlineHtml(n.kids)}</span>`;
    } else out += `<${n.t}>${inlineHtml(n.kids)}</${n.t}>`;
  }
  return out;
}

function blockStyle(b) {
  const style = [];
  if (b.poetry) style.push("margin:0 0 0 2em");
  if (b.align) style.push(`text-align:${b.align}`);
  return style.length ? ` style="${style.join(";")}"` : "";
}

/**
 * The copy as HTML with inline styles, the one form every word processor
 * reads, for the clipboard. Codes are left out; the chapters' addresses at the
 * foot say the same thing in words.
 */
export function docHtml(doc) {
  const html = [];
  const block = (b) => {
    switch (b.type) {
      case "title": return html.push(`<h1>${esc(b.text)}</h1>`);
      case "subtitle":
      case "tag": return html.push(`<p><i>${esc(b.text)}</i></p>`);
      case "section": return html.push(`<h2${b.flush ? ' style="margin-top:0"' : ""}>${esc(b.text)}</h2>`);
      case "heading": return html.push(`<h${b.level}${blockStyle(b)}>${inlineHtml(b.inlines)}</h${b.level}>`);
      case "para": return html.push(`<p${blockStyle(b)}>${inlineHtml(b.inlines)}</p>`);
      case "quote":
        html.push("<blockquote>");
        b.blocks.forEach(block);
        return html.push("</blockquote>");
      case "box":
        // A one-cell table, the box every word processor keeps on a paste.
        html.push(`<table style="border-collapse:collapse;width:100%;margin-top:${DOC_BOX.gap}pt"><tr><td style="${BOX_CSS}">`);
        b.blocks.forEach(block);
        return html.push("</td></tr></table>");
      case "list":
        html.push(b.ordered ? "<ol>" : "<ul>");
        for (const item of b.items) {
          html.push(`<li>${inlineHtml(item.inlines)}`);
          item.lists.forEach(block);
          html.push("</li>");
        }
        return html.push(b.ordered ? "</ol>" : "</ul>");
      case "rule": return html.push("<hr>");
      case "note": return html.push(`<p style="font-size:0.85em;margin-left:1em"><sup>${esc(b.label)}</sup> ${inlineHtml(b.inlines)}</p>`);
      case "answer": return html.push(`<p style="margin-left:1em"><b>Answer</b></p>`);
      case "lines":
        for (let i = 0; i < b.count; i++) html.push(`<p style="color:#888">${RULE}</p>`);
        return;
      case "break": return html.push('<br clear="all" style="page-break-before:always">');
      case "foot": return html.push(`<p style="font-size:0.85em">${inlineHtml(b.inlines)}</p>`);
      default: return; // gap, code
    }
  };
  doc.blocks.forEach(block);
  // A sheet at another text size than the standard says so (E101); the rest
  // of its sizes are relative to this.
  const size = doc.size && doc.size !== 12 ? `;font-size:${doc.size}pt` : "";
  return `<meta charset="utf-8"><div style="font-family:Georgia,'Times New Roman',serif${size}">${html.join("\n")}</div>`;
}

/**
 * The copy as plain text: verse numbers inline, footnote letters in
 * brackets, a blank as a line with its hint after it, a list item with its
 * marker, and a blank line between parts.
 */
export function docText(doc) {
  const text = [];
  let line = "";
  const flush = () => {
    const t = line.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
    if (t) text.push(t);
    line = "";
  };
  const inline = (nodes) => {
    for (const n of nodes) {
      if (n.t === "text") line += squash(n.text);
      else if (n.t === "br") line += "\n";
      else if (n.t === "vn") line += `${n.text} `;
      else if (n.t === "fn") line += `[${n.text}]`;
      else if (n.t === "blank") line += n.answer != null ? `[${n.answer}]${n.hint ? ` (${n.hint})` : ""}` : plainBlank(n.hint);
      else inline(n.kids);
    }
  };
  const block = (b, depth = 0) => {
    switch (b.type) {
      case "title":
      case "subtitle": return text.push(b.text);
      case "section": return text.push("", b.text);
      case "tag": return text.push(`(${b.text})`);
      case "heading":
      case "para":
      case "foot":
        inline(b.inlines);
        return flush();
      case "quote":
      case "box": return b.blocks.forEach((x) => block(x));
      case "list":
        for (const [at, item] of b.items.entries()) {
          const before = line;
          line = "";
          inline(item.inlines);
          const t = line.trim();
          line = before;
          flush();
          if (t) text.push(`${"  ".repeat(depth)}${b.ordered ? `${at + 1}.` : "•"} ${t}`); // numbered and nested as on paper (GF8c-7)
          item.lists.forEach((l) => block(l, depth + 1));
        }
        return;
      case "rule":
        flush();
        return text.push("* * *");
      case "note":
        inline(b.inlines);
        line = `[${b.label}] ${line}`;
        return flush();
      case "answer": return text.push("Answer:");
      case "lines":
        for (let i = 0; i < b.count; i++) text.push(RULE);
        return;
      case "break":
      case "gap": return text.push("");
      default: return; // code
    }
  };
  doc.blocks.forEach((b) => block(b));
  return text.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ── The files: runs ───────────────────────────────────────────────────── */

const LETTERS_HE = "\\u0590-\\u05FF\\uFB1D-\\uFB4F";
const LETTERS_EL = "\\u0370-\\u03FF\\u1F00-\\u1FFF";
/**
 * A stretch of Hebrew or of Greek, with the spaces and punctuation between
 * its words, so "שָׁלוֹם עֲלֵיכֶם" is one right-to-left run and not three.
 */
const SCRIPT = new RegExp(
  `(?<he>[${LETTERS_HE}]+(?:[ \\u00a0'".,;:!?\\-]+[${LETTERS_HE}]+)*)` +
    `|(?<el>[${LETTERS_EL}][${LETTERS_EL}\\u0300-\\u036F]*(?:[ \\u00a0'’·.,;:\\-]+[${LETTERS_EL}][${LETTERS_EL}\\u0300-\\u036F]*)*)`,
  "g",
);

/** Text split into [{ text, script }], script "hebrew", "greek" or null. */
export function scriptSegments(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(SCRIPT)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), script: null });
    out.push({ text: m[0], script: m.groups.he ? "hebrew" : "greek" });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), script: null });
  return out;
}

/**
 * A block's inline pieces as runs for a file: [{ text, b, i, u, s, sup, sub,
 * color, mark, size, href, script }] (each format field present only when
 * set; colors as "#rrggbb", size a factor of the paragraph's own) or
 * { br: true }. Whitespace reads as a browser shows it: collapsed, and none
 * at the start or end of a line. A verse number is bold and raised with a
 * no-break space after it, a blank is Copy's (the answer underlined and bold,
 * or a line of underlined no-break spaces) with its hint after it in brackets.
 */
export function docRuns(inlines) {
  const raw = [];
  const push = (text, fmt) => {
    if (text) raw.push({ text, ...fmt });
  };
  const walk = (nodes, fmt) => {
    for (const n of nodes) {
      if (n.t === "text") push(squash(n.text), fmt);
      else if (n.t === "br") raw.push({ br: true });
      else if (n.t === "vn") {
        push(n.text, { ...fmt, b: true, sup: true });
        push(" ", fmt);
      } else if (n.t === "fn") push(n.text, { ...fmt, sup: true });
      else if (n.t === "blank") {
        if (n.answer != null) push(n.answer, { ...fmt, u: true, b: true });
        else push(" ".repeat(BLANK_SPACES), { ...fmt, u: true });
        if (n.hint) {
          push(" ", fmt);
          push(`(${n.hint})`, { ...fmt, size: (fmt.size ?? 1) * HINT_SIZE });
        }
      } else if (n.t === "em") walk(n.kids, { ...fmt, i: true });
      else if (n.t === "strong") walk(n.kids, { ...fmt, b: true });
      else if (n.t === "u") walk(n.kids, { ...fmt, u: true });
      else if (n.t === "s") walk(n.kids, { ...fmt, s: true });
      else if (n.t === "sub") walk(n.kids, { ...fmt, sub: true });
      else if (n.t === "sup") walk(n.kids, { ...fmt, sup: true });
      else if (n.t === "link") walk(n.kids, { ...fmt, href: n.href });
      else if (n.t === "style") {
        const next = { ...fmt };
        if (n.color && DOC_COLORS[n.color]) next.color = DOC_COLORS[n.color];
        if (n.mark && DOC_MARKS[n.mark]) next.mark = DOC_MARKS[n.mark];
        if (n.size && DOC_SIZES[n.size]) next.size = (fmt.size ?? 1) * DOC_SIZES[n.size];
        walk(n.kids, next);
      } else if (n.kids) walk(n.kids, fmt);
    }
  };
  walk(inlines, {});

  // One space at most between words, across runs, and none at a line's ends:
  // one pass forward with the line's last text so far, one back with whether
  // any text follows before a break, so a long paragraph stays linear (DK3-11).
  let lineStart = true;
  let before = ""; // the text of the last run with text on this line
  for (const r of raw) {
    if (r.br) {
      lineStart = true;
      before = "";
      continue;
    }
    if (lineStart || / $/.test(before)) r.text = r.text.replace(/^ /, "");
    if (r.text) {
      lineStart = false;
      before = r.text;
    }
  }
  let lineEnd = true; // no run with text follows this one before a break or the end
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i];
    if (r.br) {
      lineEnd = true;
      continue;
    }
    const had = r.text;
    if (lineEnd) r.text = r.text.replace(/ $/, "");
    if (had) lineEnd = false;
  }

  const out = [];
  for (const r of raw) {
    if (r.br) {
      out.push(r);
      continue;
    }
    if (!r.text) continue;
    for (const seg of scriptSegments(r.text)) {
      const run = { ...r, text: seg.text };
      if (seg.script) run.script = seg.script;
      out.push(run);
    }
  }
  return out;
}

/* ── The files: what every writer shares ───────────────────────────────── */

/** The notice every file ends with, and carries in its properties. */
export const DOC_CREDIT = LIT_CREDIT_LINE;

/** Text for an XML text node or attribute, with characters XML 1.0 refuses removed. */
export function xmlEscape(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    // A lone surrogate goes, a pair stays. No lookbehind: the phone viewer
    // loads this file, and Safari before 16.4 can't parse one (LG8-9).
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (m) => (m.length === 2 ? m : ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A date as the files write it: "2026-11-06T14:03:00Z". */
export function docDate(date) {
  return new Date(date).toISOString().replace(/\.\d+Z$/, "Z");
}

/** The paper a file is set on, in twips: Letter or A4 (desk-sheet-copy's PAPERS), and its margin. */
export const DOC_PAPERS = Object.freeze({
  letter: Object.freeze({ width: 12240, height: 15840, margin: 1080, odf: { width: "8.5in", height: "11in", margin: "0.75in" } }),
  a4: Object.freeze({ width: 11906, height: 16838, margin: 1020, odf: { width: "210mm", height: "297mm", margin: "18mm" } }),
});

/**
 * Page numbers, as the printed copy has them (BVJ, 2026-11-10; pageRule in
 * desk-sheet-copy.mjs): page 1's centered in the bottom margin, every later
 * page's at the top right, in 9pt Inter gray. `line` is the number's line in
 * twips; `pageNumberAt(margin)` is how far its line sits from the paper's
 * edge, so it is centered in the margin and the text area is the copy's.
 */
export const DOC_PAGE_NUMBER = Object.freeze({ pt: 9, color: "#595e57", line: 216 });
export const pageNumberAt = (margin) => Math.round((margin - DOC_PAGE_NUMBER.line) / 2);

/** The fonts the files name (never embed): the print face, then what stands in. */
export const DOC_FONTS = Object.freeze({
  text: "Crimson Text",
  textFallback: "Georgia",
  // Crimson Text has no Greek or Hebrew; the site prints both in Cardo.
  ancient: "Cardo",
  ancientFallback: "Times New Roman",
  small: "Inter",
  smallFallback: "Arial",
});

/** The width a code to scan prints at on the copy (sheets-page.css, .sheet-copy__code). */
export const CODE_CM = 2.3;

/**
 * A file's name: the sheet's name and the version, "Romans 8 study
 * (leader).docx". Characters a file name can't hold on Windows, macOS or
 * Linux are dropped, and so are dots and spaces at its ends.
 *
 * @param {string} title the sheet's name (sheetName)
 * @param {"leader" | "participant"} copy
 * @param {string} ext without the dot
 */
export function documentFileName(title, copy, ext) {
  const name = String(title ?? "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 80)
    .trim();
  return `${name || "Sheet"} (${copy}).${ext}`;
}
