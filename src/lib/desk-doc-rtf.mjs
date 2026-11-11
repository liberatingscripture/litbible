// src/lib/desk-doc-rtf.mjs
//
// A sheet's copy as Rich Text (STUDY-DESK-FIXES.md, E37): plain 7-bit text
// that Word, WordPad, TextEdit, Pages and LibreOffice all open, written from
// the document model (desk-sheet-doc.mjs). No zip. Loaded by sheet-page.js's
// "Save as" only when "Rich text (.rtf)" is chosen.
//
// Every character past ASCII is written as \uN? (a UTF-16 unit, signed, with
// "?" for a reader that can't), so Greek and Hebrew survive. Hebrew runs are
// right to left (\rtlch) with Hebrew as their language. Headings use the
// built-in "heading 1" to "heading 3" names, so Word's navigation pane finds
// them. Lists are indented paragraphs with their own bullet or number, which
// every reader shows alike; ruled lines are paragraph borders, with a
// "between" border so neighbors don't join into one box. A code to scan is
// its PNG, as hex. Fonts are named, never embedded: Crimson Text with Georgia
// as its stand-in, and Cardo for Greek and Hebrew. LIT_CREDIT_LINE is the
// final paragraph and the document's comment (\doccomm).

import { DOC_BOX, DOC_COLORS, DOC_CREDIT, DOC_FONTS, DOC_MARKS, DOC_PAGE_NUMBER, DOC_PAPERS, CODE_CM, docRuns, pageNumberAt } from "./desk-sheet-doc.mjs";

const BASE_HALF_POINTS = 24;
const ALIGN = { left: "\\ql", center: "\\qc", right: "\\qr", justify: "\\qj" };
const GRAY = 1;
const LINK = 2;
const SUBTLE = 3;
// The color table: auto, then the fixed colors, then each sheet color and highlight.
const COLORS = ["#888888", "#1d4fb8", "#555555", ...Object.values(DOC_COLORS), ...Object.values(DOC_MARKS)];
const colorIndex = (hex) => COLORS.indexOf(hex) + 1;

/** Text for RTF: its control characters escaped and everything past ASCII as \uN?. */
export function rtfEscape(text) {
  let out = "";
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === "\\" || ch === "{" || ch === "}") out += `\\${ch}`;
    else if (ch === "\t") out += "\\tab ";
    else if (ch === "\u00a0") out += "\\~";
    else if (code < 0x20 || code === 0x7f) continue;
    else if (code < 0x80) out += ch;
    else {
      for (const unit of code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code]) {
        out += `\\u${unit > 0x7fff ? unit - 0x10000 : unit}?`;
      }
    }
  }
  return out;
}

const HEADER =
  "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n" +
  `{\\fonttbl{\\f0\\froman\\fcharset0 ${DOC_FONTS.text}{\\*\\falt ${DOC_FONTS.textFallback}};}` +
  `{\\f1\\froman\\fcharset0 ${DOC_FONTS.ancient}{\\*\\falt ${DOC_FONTS.ancientFallback}};}` +
  `{\\f2\\fswiss\\fcharset0 ${DOC_FONTS.small}{\\*\\falt ${DOC_FONTS.smallFallback}};}}\n` +
  `{\\colortbl;${COLORS.map((c) => `\\red${parseInt(c.slice(1, 3), 16)}\\green${parseInt(c.slice(3, 5), 16)}\\blue${parseInt(c.slice(5, 7), 16)};`).join("")}}\n` +
  "{\\stylesheet{\\s0\\f0\\fs24 Normal;}" +
  "{\\s1\\sbasedon0\\snext0\\keepn\\sa120\\outlinelevel0\\b\\f0\\fs40 heading 1;}" +
  "{\\s2\\sbasedon0\\snext0\\keepn\\sb280\\sa80\\outlinelevel1\\b\\f0\\fs30 heading 2;}" +
  "{\\s3\\sbasedon0\\snext0\\keepn\\sb200\\sa60\\outlinelevel2\\b\\f0\\fs26 heading 3;}}\n";

/** What each kind of paragraph starts with after \pard\plain, and its text size in half-points. */
const PARA = {
  normal: ["\\sa120\\f0\\fs24", 24],
  h1: ["\\s1\\keepn\\sa120\\outlinelevel0\\b\\f0\\fs40", 40],
  h2: ["\\s2\\keepn\\sb280\\sa80\\outlinelevel1\\b\\f0\\fs30", 30],
  h3: ["\\s3\\keepn\\sb200\\sa60\\outlinelevel2\\b\\f0\\fs26", 26],
  subtitle: [`\\sa120\\i\\cf${SUBTLE}\\f0\\fs24`, 24],
  tag: ["\\keepn\\sa60\\i\\f0\\fs20", 20],
  note: ["\\li240\\sa60\\f0\\fs20", 20],
  quote: ["\\li720\\ri720\\sa120\\f0\\fs24", 24],
  rule: [`\\sa120\\brdrb\\brdrs\\brdrw15\\brsp20\\brdrcf${GRAY}\\f0\\fs24`, 24],
  // Each line an exact 32pt tall, the .docx's 18pt above a line of text, with
  // no space before: LibreOffice drops \sb from the second paragraph of a run
  // ruled alike, which spaced the lines unevenly (DK3-10).
  ruled: [`\\sb0\\sa0\\sl-640\\slmult0\\brdrb\\brdrs\\brdrw10\\brsp20\\brdrcf${GRAY}\\brdrbtw\\brdrs\\brdrw10\\brsp20\\brdrcf${GRAY}\\f0\\fs24`, 24],
  answer: ["\\keepn\\li240\\sa60\\b\\f0\\fs24", 24],
  code: ["\\keepn\\qr\\sa0\\f0\\fs24", 24],
  caption: ["\\qr\\sa120\\f2\\fs14", 14],
  foot: ["\\sa60\\f0\\fs20", 20],
};

function runRtf(run, halfPoints) {
  const c = [];
  if (run.b) c.push("\\b");
  if (run.i) c.push("\\i");
  if (run.u) c.push("\\ul");
  if (run.s) c.push("\\strike");
  if (run.sup) c.push("\\super");
  else if (run.sub) c.push("\\sub");
  if (run.color) c.push(`\\cf${colorIndex(run.color)}`);
  if (run.mark) c.push(`\\chcbpat${colorIndex(run.mark)}\\highlight${colorIndex(run.mark)}`);
  if (run.size && run.size !== 1) c.push(`\\fs${Math.max(2, Math.round(halfPoints * run.size))}`);
  if (run.script === "greek") c.push("\\f1\\lang1032");
  if (run.script === "hebrew") c.push("\\rtlch\\af1\\alang1037\\f1");
  return `{${c.join("")}${c.length ? " " : ""}${rtfEscape(run.text)}}`;
}

function runsRtf(runs, halfPoints) {
  let out = "";
  let link = null;
  const close = () => {
    if (!link) return;
    // A field's address in quotes, so a quote or a space in it is percent-encoded.
    const url = link.href.replace(/["\s\\{}]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
    out += `{\\field{\\*\\fldinst{HYPERLINK "${rtfEscape(url)}"}}{\\fldrslt{\\ul\\cf${LINK} ${link.rtf}}}}`;
    link = null;
  };
  for (const run of runs) {
    if (run.br) {
      close();
      out += "\\line ";
      continue;
    }
    if (run.href) {
      if (link && link.href !== run.href) close();
      link ??= { href: run.href, rtf: "" };
      link.rtf += runRtf(run, halfPoints);
    } else {
      close();
      out += runRtf(run, halfPoints);
    }
  }
  close();
  return out;
}

function para(kind, runs = [], { align = null, indent = false, extra = "" } = {}) {
  const [start, halfPoints] = PARA[kind];
  const a = align && ALIGN[align] ? ALIGN[align] : "";
  return `\\pard\\plain${start}${a}${indent ? "\\li480" : ""}${extra} ${runsRtf(runs, halfPoints)}\\par\n`;
}

// A heading or tag that is plain text: spaces as a browser shows them, and Greek or Hebrew marked.
const textRuns = (text) => docRuns([{ t: "text", text: text ?? "" }]);

/** A quotation's indent on each side, in twips, as `quote` sets it. */
const QUOTE_INDENT = 720;

// A list number as lowercase letters, as Word and LibreOffice count them: 1 is a, 26 is z, 27 is aa, 28 is bb.
const letters = (n) => String.fromCharCode(97 + ((n - 1) % 26)).repeat(Math.ceil(n / 26));

// A list number as lowercase roman numerals: 1 is i, 4 is iv, 9 is ix.
function roman(n) {
  const digits = [[100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [value, text] of digits) while (n >= value) { s += text; n -= value; }
  return s;
}

function listRtf(b, depth = 0, quoted = false) {
  let out = "";
  let n = 0;
  for (const item of b.items) {
    // Ordered levels cycle decimal, letters, roman numerals, as the .docx and .odt writers do.
    const marker = b.ordered ? `${[String, letters, roman][depth % 3](++n)}.` : ["•", "◦", "▪"][depth % 3];
    // Inside a quotation the list keeps the quotation's margins (DK3-4).
    const left = (quoted ? QUOTE_INDENT : 0) + 720 + 360 * depth;
    const right = quoted ? `\\ri${QUOTE_INDENT}` : "";
    out += `\\pard\\plain\\sa60\\f0\\fs24\\fi-360\\li${left}${right}\\tx${left} ${rtfEscape(marker)}\\tab ${runsRtf(docRuns(item.inlines), BASE_HALF_POINTS)}\\par\n`;
    for (const list of item.lists) out += listRtf(list, depth + 1, quoted);
  }
  return out;
}

function hexOf(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
    if (i % 64 === 63) out += "\n";
  }
  return out;
}

function codeRtf(b) {
  if (!b.png) return "";
  const twips = Math.round((CODE_CM / 2.54) * 1440);
  const px = b.pixels ?? 0;
  const pict = `{\\pict\\pngblip\\picw${px}\\pich${px}\\picwgoal${twips}\\pichgoal${twips}\n${hexOf(b.png)}}`;
  return `\\pard\\plain${PARA.code[0]} ${pict}\\par\n` + para("caption", textRuns(b.caption));
}

/**
 * A one-cell table ruled all round (E57). Every paragraph in it is marked
 * \intbl and the last ends the cell instead of its paragraph; the \pard of
 * whatever follows leaves the table. A row takes no space above it, so an
 * empty paragraph exactly `gap` points tall goes first.
 */
function boxRtf(inner, width) {
  const line = `\\brdrs\\brdrw${Math.round(DOC_BOX.pt * 20)}`;
  const row =
    `\\trowd\\trgaph${DOC_BOX.padX * 20}\\trleft0` +
    `\\trpaddl${DOC_BOX.padX * 20}\\trpaddr${DOC_BOX.padX * 20}\\trpaddt${DOC_BOX.padY * 20}\\trpaddb${DOC_BOX.padY * 20}` +
    "\\trpaddfl3\\trpaddfr3\\trpaddft3\\trpaddfb3" +
    `\\clbrdrt${line}\\clbrdrl${line}\\clbrdrb${line}\\clbrdrr${line}\\cellx${width}\n`;
  const cell = (inner || para("normal")).replace(/\\pard(?=\\plain)/g, "\\pard\\intbl").replace(/\\par\n$/, "\\cell\n");
  const gap = `\\pard\\plain\\sb0\\sa0\\sl-${DOC_BOX.gap * 20}\\slmult0\\f0\\fs2 \\par\n`;
  return `${gap}${row}${cell}\\row\n`;
}

function body(blocks, quoted = false, width = 0) {
  let out = "";
  for (const b of blocks) {
    switch (b.type) {
      case "title": out += para("h1", textRuns(b.text)); break;
      case "subtitle": out += para("subtitle", textRuns(b.text)); break;
      case "section": out += para("h2", textRuns(b.text), { extra: b.flush ? "\\sb0" : "" }); break;
      case "tag": out += para("tag", textRuns(b.text)); break;
      case "heading": out += para(`h${b.level}`, docRuns(b.inlines), { align: b.align, indent: b.poetry }); break;
      case "para": out += para(quoted ? "quote" : "normal", docRuns(b.inlines), { align: b.align, indent: b.poetry }); break;
      case "quote": out += body(b.blocks, true, width); break;
      case "box": out += boxRtf(body(b.blocks, quoted, width), width); break;
      case "list": out += listRtf(b, 0, quoted); break;
      case "rule": out += para("rule"); break;
      case "note": out += para("note", [{ text: b.label, sup: true }, { text: " " }, ...docRuns(b.inlines)]); break;
      case "answer": out += para("answer", textRuns("Answer")); break;
      case "lines":
        for (let i = 0; i < b.count; i++) out += para("ruled");
        break;
      case "break": out += "\\page\n"; break;
      case "foot":
        // The credit is written last, whatever the copy's foot holds.
        if (!b.credit) out += para("foot", docRuns(b.inlines));
        break;
      case "code": out += codeRtf(b); break;
      default: break; // gap
    }
  }
  return out;
}

/**
 * Page numbers as the printed copy has them: page 1's centered in its own
 * footer (\titlepg), every later page's at the right of the header, each a
 * PAGE field in the middle of the margin. The first page's header is empty,
 * so it doesn't fall back to the later pages'.
 */
function pageNumbers(margin) {
  const at = pageNumberAt(margin);
  const number = (align) =>
    `\\pard\\plain\\${align}\\sb0\\sa0\\f2\\fs${DOC_PAGE_NUMBER.pt * 2}\\cf${colorIndex(DOC_PAGE_NUMBER.color)} ` +
    "{\\field{\\*\\fldinst PAGE}{\\fldrslt 1}}\\par";
  return (
    `\\sectd\\titlepg\\headery${at}\\footery${at}\n` +
    `{\\headerr ${number("qr")}}\n{\\headerf \\pard\\plain\\par}\n{\\footerf ${number("qc")}}\n`
  );
}

/**
 * The .rtf as text.
 *
 * @param {{ title: string, blocks: object[] }} doc the model (readCopy)
 * @param {{ title?: string, version?: string, paper?: "letter" | "a4" }} [opts]
 */
export function rtfText(doc, { title = doc.title, version = "", paper = "letter" } = {}) {
  const page = DOC_PAPERS[paper] ?? DOC_PAPERS.letter;
  return (
    HEADER +
    `{\\info{\\title ${rtfEscape(title)}}${version ? `{\\subject ${rtfEscape(version)}}` : ""}{\\doccomm ${rtfEscape(DOC_CREDIT)}}}\n` +
    `\\paperw${page.width}\\paperh${page.height}\\margl${page.margin}\\margr${page.margin}\\margt${page.margin}\\margb${page.margin}\\widowctrl\n` +
    pageNumbers(page.margin) +
    body(doc.blocks, false, page.width - 2 * page.margin) +
    para("foot", textRuns(DOC_CREDIT)) +
    "}\n"
  );
}

/** The .rtf's bytes (all ASCII). */
export async function rtfFile(doc, opts = {}) {
  return new TextEncoder().encode(rtfText(doc, opts));
}
