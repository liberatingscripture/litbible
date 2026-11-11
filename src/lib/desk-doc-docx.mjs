// src/lib/desk-doc-docx.mjs
//
// A sheet's copy as a Word document (STUDY-DESK-FIXES.md, E37), written by
// hand from the document model (desk-sheet-doc.mjs) and zipped by
// desk-zip.mjs: no library. Loaded by sheet-page.js's "Save as" only when
// "Word document (.docx)" is chosen.
//
// What it writes, and why:
//   - Real Heading 1 to 3 styles (the sheet's name, the passages and "Key
//     terms", a sheet's own headings), so Word's navigation pane works.
//   - Lists through numbering.xml: one bullet definition, and a numbered
//     definition per ordered list, so every list counts from 1 on its own.
//   - Ruled lines and a rule as paragraph borders. Word draws one box around
//     neighboring paragraphs whose borders match, so lines to write on carry a
//     "between" border too, or only the last would be ruled.
//   - Highlights as shading, since Word's own highlight takes only its
//     sixteen colors; links as hyperlink relationships; codes to scan as PNG
//     (the caller draws them) beside their caption.
//   - Fonts named, never embedded (BVJ, 2026-11-06): Crimson Text, with
//     Georgia as its stand-in, and Cardo for Greek and Hebrew. Hebrew runs are
//     marked right to left (`w:rtl`) with a Hebrew language.
//   - Page numbers as the printed copy has them: page 1's centered in a
//     first-page footer (w:titlePg), every later page's at the right of the
//     default header, each a PAGE field, set in the middle of the margin.
//   - LIT_CREDIT_LINE as the final paragraph, and in the file's properties:
//     its description (core.xml) and a custom "Rights" property. Word's core
//     properties have no rights field, and an element outside their schema
//     makes Word call the file damaged.
//
// Word refuses a file over small faults, so the order of every element inside
// w:pPr and w:rPr below is the schema's order. Keep it when adding one.

import { CODE_CM, DOC_BOX, DOC_CREDIT, DOC_FONTS, DOC_PAGE_NUMBER, DOC_PAPERS, docDate, docRuns, pageNumberAt, xmlEscape as x } from "./desk-sheet-doc.mjs";
import { zipFiles } from "./desk-zip.mjs";

const NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const BASE_HALF_POINTS = 24; // 12pt
const EMU_PER_CM = 360000;
const ALIGN = { left: "left", center: "center", right: "right", justify: "both" };
const BULLETS = ["•", "◦", "▪"];
const NUMBERS = [["decimal", "%N."], ["lowerLetter", "%N."], ["lowerRoman", "%N."]];
const hex = (color) => color.replace("#", "").toUpperCase();

/* ── The parts that never change ───────────────────────────────────────── */

const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>
</Types>`;

const PACKAGE_RELS = `${XML}<Relationships xmlns="${NS.rel}">
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="${REL}/custom-properties" Target="docProps/custom.xml"/>
</Relationships>`;

const FONT_TABLE = `${XML}<w:fonts xmlns:w="${NS.w}">
<w:font w:name="${DOC_FONTS.text}"><w:altName w:val="${DOC_FONTS.textFallback}"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>
<w:font w:name="${DOC_FONTS.textFallback}"><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>
<w:font w:name="${DOC_FONTS.ancient}"><w:altName w:val="${DOC_FONTS.ancientFallback}"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>
<w:font w:name="${DOC_FONTS.small}"><w:altName w:val="${DOC_FONTS.smallFallback}"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>
</w:fonts>`;

/** A paragraph style. `p` and `r` are w:pPr's and w:rPr's insides. */
const pStyle = (id, name, { p = "", r = "", next = null, based = "Normal" } = {}) =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
  (based ? `<w:basedOn w:val="${based}"/>` : "") +
  (next ? `<w:next w:val="${next}"/>` : "") +
  `<w:qFormat/>${p ? `<w:pPr>${p}</w:pPr>` : ""}${r ? `<w:rPr>${r}</w:rPr>` : ""}</w:style>`;

const RULED = '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="888888"/><w:between w:val="single" w:sz="4" w:space="1" w:color="888888"/></w:pBdr><w:spacing w:before="360" w:after="0"/>';

const STYLES = `${XML}<w:styles xmlns:w="${NS.w}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${DOC_FONTS.text}" w:hAnsi="${DOC_FONTS.text}" w:eastAsia="${DOC_FONTS.text}" w:cs="${DOC_FONTS.ancient}"/><w:sz w:val="${BASE_HALF_POINTS}"/><w:szCs w:val="${BASE_HALF_POINTS}"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="he-IL"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${pStyle("Heading1", "heading 1", { next: "Normal", p: '<w:keepNext/><w:spacing w:before="0" w:after="120"/><w:outlineLvl w:val="0"/>', r: '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>' })}
${pStyle("Heading2", "heading 2", { next: "Normal", p: '<w:keepNext/><w:spacing w:before="280" w:after="80"/><w:outlineLvl w:val="1"/>', r: '<w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/>' })}
${pStyle("Heading3", "heading 3", { next: "Normal", p: '<w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/>', r: '<w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/>' })}
${pStyle("Subtitle", "Subtitle", { next: "Normal", r: '<w:i/><w:iCs/><w:color w:val="555555"/>' })}
${pStyle("PartTag", "Part tag", { p: '<w:keepNext/>', r: '<w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/>' })}
${pStyle("Footnote", "Sheet footnote", { p: '<w:ind w:left="240"/>', r: '<w:sz w:val="20"/><w:szCs w:val="20"/>' })}
${pStyle("Quote", "Quote", { p: '<w:ind w:left="720" w:right="720"/>' })}
${pStyle("ListParagraph", "List Paragraph", { p: '<w:spacing w:after="60"/><w:contextualSpacing/>' })}
${pStyle("Rule", "Rule", { p: '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="888888"/></w:pBdr>' })}
${pStyle("Ruled", "Lines to write on", { p: RULED })}
${pStyle("Answer", "Answer", { p: '<w:keepNext/><w:ind w:left="240"/>', r: "<w:b/><w:bCs/>" })}
${pStyle("CodeArt", "Code to scan", { p: '<w:keepNext/><w:spacing w:after="0"/><w:jc w:val="right"/>' })}
${pStyle("CodeCaption", "Code caption", { p: '<w:jc w:val="right"/>', r: `<w:rFonts w:ascii="${DOC_FONTS.small}" w:hAnsi="${DOC_FONTS.small}"/><w:sz w:val="14"/><w:szCs w:val="14"/>` })}
${pStyle("Foot", "Sheet foot", { p: '<w:spacing w:after="60"/>', r: '<w:sz w:val="20"/><w:szCs w:val="20"/>' })}
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1D4FB8"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

/**
 * A header or footer part: `root` is "hdr" or "ftr", `align` where the page
 * number goes, or null for an empty one (the first page's header, so it
 * doesn't fall back to the default header's number).
 */
function headerFooter(root, align) {
  const half = DOC_PAGE_NUMBER.pt * 2;
  const number = align
    ? `<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:rFonts w:ascii="${DOC_FONTS.small}" w:hAnsi="${DOC_FONTS.small}"/>` +
      `<w:color w:val="${hex(DOC_PAGE_NUMBER.color)}"/><w:sz w:val="${half}"/><w:szCs w:val="${half}"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`
    : "";
  return (
    `${XML}<w:${root} xmlns:w="${NS.w}" xmlns:r="${NS.r}"><w:p><w:pPr>` +
    `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${align ? `<w:jc w:val="${align}"/>` : ""}` +
    `</w:pPr>${number}</w:p></w:${root}>`
  );
}

/** The size each paragraph style sets its text at, in half-points, for a run's relative size. */
const STYLE_SIZE = { Heading1: 40, Heading2: 30, Heading3: 26, PartTag: 20, Footnote: 20, Foot: 20, CodeCaption: 14 };

/* ── Runs and paragraphs ───────────────────────────────────────────────── */

function runXml(run, halfPoints) {
  const p = [];
  if (run.href) p.push('<w:rStyle w:val="Hyperlink"/>');
  if (run.script) p.push(`<w:rFonts w:ascii="${DOC_FONTS.ancient}" w:hAnsi="${DOC_FONTS.ancient}" w:cs="${DOC_FONTS.ancient}"/>`);
  if (run.b) p.push("<w:b/><w:bCs/>");
  if (run.i) p.push("<w:i/><w:iCs/>");
  if (run.s) p.push("<w:strike/>");
  if (run.color) p.push(`<w:color w:val="${hex(run.color)}"/>`);
  if (run.size && run.size !== 1) {
    const sz = Math.max(2, Math.round(halfPoints * run.size));
    p.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
  }
  if (run.u) p.push('<w:u w:val="single"/>');
  if (run.mark) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${hex(run.mark)}"/>`);
  if (run.sup) p.push('<w:vertAlign w:val="superscript"/>');
  else if (run.sub) p.push('<w:vertAlign w:val="subscript"/>');
  if (run.script === "hebrew") p.push("<w:rtl/>");
  if (run.script === "hebrew") p.push('<w:lang w:bidi="he-IL"/>');
  else if (run.script === "greek") p.push('<w:lang w:val="el-GR"/>');
  return `<w:r>${p.length ? `<w:rPr>${p.join("")}</w:rPr>` : ""}<w:t xml:space="preserve">${x(run.text)}</w:t></w:r>`;
}

/**
 * Paragraph XML: `style` a style id, `runs` from docRuns (plus any runs
 * written ahead of them), `pPr` the paragraph's own settings after the style.
 */
function paragraph(ctx, { style = null, runs = [], align = null, indent = 0, right = 0, hanging = 0, numbering = null, flush = false, pre = "" }) {
  const p = [];
  if (style) p.push(`<w:pStyle w:val="${style}"/>`);
  if (numbering) p.push(`<w:numPr><w:ilvl w:val="${numbering.level}"/><w:numId w:val="${numbering.id}"/></w:numPr>`);
  if (flush) p.push('<w:spacing w:before="0"/>');
  if (indent || right) p.push(`<w:ind w:left="${indent}"${right ? ` w:right="${right}"` : ""}${hanging ? ` w:hanging="${hanging}"` : ""}/>`);
  if (align && ALIGN[align]) p.push(`<w:jc w:val="${ALIGN[align]}"/>`);
  const size = STYLE_SIZE[style] ?? BASE_HALF_POINTS;
  let body = pre;
  let link = null; // the open hyperlink: { href, runs }
  const close = () => {
    if (!link) return;
    body += `<w:hyperlink r:id="${ctx.rel("hyperlink", link.href)}" w:history="1">${link.xml}</w:hyperlink>`;
    link = null;
  };
  for (const run of runs) {
    if (run.br) {
      close();
      body += "<w:r><w:br/></w:r>";
      continue;
    }
    if (run.href) {
      if (link && link.href !== run.href) close();
      link ??= { href: run.href, xml: "" };
      link.xml += runXml(run, size);
    } else {
      close();
      body += runXml(run, size);
    }
  }
  close();
  return `<w:p>${p.length ? `<w:pPr>${p.join("")}</w:pPr>` : ""}${body}</w:p>`;
}

/** A plain run of text, for the parts the writer words itself. */
// A heading or tag that is plain text: spaces as a browser shows them, and Greek or Hebrew marked.
const textRuns = (text) => docRuns([{ t: "text", text: text ?? "" }]);

function codeParagraphs(ctx, b) {
  if (!b.png) return "";
  const rId = ctx.image(b.png);
  const emu = Math.round(CODE_CM * EMU_PER_CM);
  const id = ++ctx.drawings;
  const drawing =
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu}" cy="${emu}"/>` +
    `<wp:docPr id="${id}" name="Code ${id}" descr="${x(b.label)}"/>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.pic}"><pic:pic xmlns:pic="${NS.pic}">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="code${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu}" cy="${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return paragraph(ctx, { style: "CodeArt", pre: drawing }) + paragraph(ctx, { style: "CodeCaption", runs: textRuns(b.caption) });
}

/* ── Lists ─────────────────────────────────────────────────────────────── */

function abstractNum(id, ordered) {
  let levels = "";
  for (let l = 0; l < 9; l++) {
    const [format, text] = ordered ? NUMBERS[l % 3] : ["bullet", BULLETS[l % 3]];
    levels +=
      `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${format}"/>` +
      `<w:lvlText w:val="${text.replace("N", String(l + 1))}"/><w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${720 + 360 * l}" w:hanging="360"/></w:pPr></w:lvl>`;
  }
  return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${levels}</w:abstractNum>`;
}

/** A quotation's indent on each side, as the Quote style sets it. */
const QUOTE_INDENT = 720;

function listParagraphs(ctx, b, level = 0, quoted = false) {
  // Bullets share one definition; each numbered list gets its own, so it counts from 1.
  const id = b.ordered ? ctx.numbered() : 1;
  const at = Math.min(level, 8);
  // Inside a quotation the list keeps the quotation's margins (DK3-4): its
  // level's indent moved in by the quote's, and the quote's on the right.
  const ind = quoted ? { indent: QUOTE_INDENT + 720 + 360 * at, right: QUOTE_INDENT, hanging: 360 } : {};
  let out = "";
  for (const item of b.items) {
    out += paragraph(ctx, { style: "ListParagraph", runs: docRuns(item.inlines), numbering: { id, level: at }, ...ind });
    for (const list of item.lists) out += listParagraphs(ctx, list, level + 1, quoted);
  }
  return out;
}

/* ── The key terms box ─────────────────────────────────────────────────── */

/**
 * A one-cell table ruled all round (E57): what Word keeps as a box, where bordered
 * paragraphs part at a list's indent. A table takes no space above it, so an
 * empty paragraph exactly `gap` points tall goes first.
 */
function boxTable(ctx, inner) {
  const line = `w:val="single" w:sz="${DOC_BOX.pt * 8}" w:space="0" w:color="${DOC_BOX.color}"`;
  const borders = ["top", "left", "bottom", "right"].map((side) => `<w:${side} ${line}/>`).join("");
  const pad = (side, pt) => `<w:${side} w:w="${pt * 20}" w:type="dxa"/>`;
  return (
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${DOC_BOX.gap * 20}" w:lineRule="exact"/></w:pPr></w:p>` +
    `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar>${pad("top", DOC_BOX.padY)}${pad("left", DOC_BOX.padX)}${pad("bottom", DOC_BOX.padY)}${pad("right", DOC_BOX.padX)}</w:tblCellMar>` +
    `<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid><w:gridCol w:w="${ctx.textWidth}"/></w:tblGrid>` +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="${ctx.textWidth}" w:type="dxa"/></w:tcPr>${inner || "<w:p/>"}</w:tc></w:tr></w:tbl>`
  );
}

/* ── The document ──────────────────────────────────────────────────────── */

function body(ctx, blocks, quoted = false) {
  let out = "";
  for (const b of blocks) {
    switch (b.type) {
      case "title": out += paragraph(ctx, { style: "Heading1", runs: textRuns(b.text) }); break;
      case "subtitle": out += paragraph(ctx, { style: "Subtitle", runs: textRuns(b.text) }); break;
      case "section": out += paragraph(ctx, { style: "Heading2", runs: textRuns(b.text), flush: b.flush }); break;
      case "tag": out += paragraph(ctx, { style: "PartTag", runs: textRuns(b.text) }); break;
      case "heading":
        out += paragraph(ctx, { style: `Heading${b.level}`, runs: docRuns(b.inlines), align: b.align, indent: b.poetry ? 480 : 0 });
        break;
      case "para":
        out += paragraph(ctx, { style: quoted ? "Quote" : null, runs: docRuns(b.inlines), align: b.align, indent: b.poetry ? 480 : 0 });
        break;
      case "quote": out += body(ctx, b.blocks, true); break;
      case "box": out += boxTable(ctx, body(ctx, b.blocks, quoted)); break;
      case "list": out += listParagraphs(ctx, b, 0, quoted); break;
      case "rule": out += paragraph(ctx, { style: "Rule" }); break;
      case "note": {
        const runs = [{ text: b.label, sup: true }, { text: " " }, ...docRuns(b.inlines)];
        out += paragraph(ctx, { style: "Footnote", runs });
        break;
      }
      case "answer": out += paragraph(ctx, { style: "Answer", runs: textRuns("Answer") }); break;
      case "lines":
        for (let i = 0; i < b.count; i++) out += paragraph(ctx, { style: "Ruled" });
        break;
      case "break": out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; break;
      case "foot":
        // The credit is written last, whatever the copy's foot holds.
        if (!b.credit) out += paragraph(ctx, { style: "Foot", runs: docRuns(b.inlines) });
        break;
      case "code": out += codeParagraphs(ctx, b); break;
      default: break; // gap
    }
  }
  return out;
}

/**
 * The parts of the .docx, as [{ name, data }] in the order they are zipped,
 * for the tests to read without unzipping as well as for docxFile.
 *
 * @param {{ title: string, blocks: object[] }} doc the model (readCopy)
 * @param {{ title?: string, version?: string, paper?: "letter" | "a4", date?: Date | number }} [opts]
 */
export function docxParts(doc, { title = doc.title, version = "", paper = "letter", date = Date.now() } = {}) {
  const rels = [
    { id: "rId1", type: "styles", target: "styles.xml" },
    { id: "rId2", type: "numbering", target: "numbering.xml" },
    { id: "rId3", type: "fontTable", target: "fontTable.xml" },
    { id: "rId4", type: "header", target: "header1.xml" },
    { id: "rId5", type: "header", target: "header2.xml" },
    { id: "rId6", type: "footer", target: "footer1.xml" },
  ];
  const media = [];
  const numbers = [];
  const ctx = {
    drawings: 0,
    rel(type, target) {
      const found = rels.find((r) => r.type === type && r.target === target);
      if (found) return found.id;
      const id = `rId${rels.length + 1}`;
      rels.push({ id, type, target, external: type === "hyperlink" });
      return id;
    },
    image(png) {
      const name = `media/code${media.length + 1}.png`;
      media.push({ name: `word/${name}`, data: png });
      return this.rel("image", name);
    },
    numbered() {
      numbers.push(numbers.length + 2);
      return numbers.at(-1);
    },
  };

  const page = DOC_PAPERS[paper] ?? DOC_PAPERS.letter;
  ctx.textWidth = page.width - 2 * page.margin;
  const at = pageNumberAt(page.margin);
  const content =
    body(ctx, doc.blocks) +
    paragraph(ctx, { style: "Foot", runs: textRuns(DOC_CREDIT) }) +
    // The page numbers: the default header's on every page but the first, whose
    // own header is empty and whose footer holds its number (w:titlePg).
    '<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:headerReference w:type="first" r:id="rId5"/>' +
    '<w:footerReference w:type="first" r:id="rId6"/>' +
    `<w:pgSz w:w="${page.width}" w:h="${page.height}"/>` +
    `<w:pgMar w:top="${page.margin}" w:right="${page.margin}" w:bottom="${page.margin}" w:left="${page.margin}" w:header="${at}" w:footer="${at}" w:gutter="0"/>` +
    "<w:titlePg/></w:sectPr>";
  const document =
    `${XML}<w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}">` +
    `<w:body>${content}</w:body></w:document>`;

  // Abstract 0 is the bullets; numbered list n is abstract n - 1 and num n.
  const numbering =
    `${XML}<w:numbering xmlns:w="${NS.w}">` +
    abstractNum(0, false) +
    numbers.map((n) => abstractNum(n - 1, true)).join("") +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    numbers.map((n) => `<w:num w:numId="${n}"><w:abstractNumId w:val="${n - 1}"/></w:num>`).join("") +
    "</w:numbering>";

  const documentRels =
    `${XML}<Relationships xmlns="${NS.rel}">` +
    rels
      .map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${x(r.target)}"${r.external ? ' TargetMode="External"' : ""}/>`)
      .join("") +
    "</Relationships>";

  const when = docDate(date);
  const core =
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${x(title)}</dc:title>${version ? `<dc:subject>${x(version)}</dc:subject>` : ""}` +
    `<dc:description>${x(DOC_CREDIT)}</dc:description><dc:language>en-US</dc:language>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified></cp:coreProperties>`;
  const custom =
    `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Rights"><vt:lpwstr>${x(DOC_CREDIT)}</vt:lpwstr></property></Properties>`;

  return [
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: PACKAGE_RELS },
    { name: "docProps/core.xml", data: core },
    { name: "docProps/custom.xml", data: custom },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: STYLES },
    { name: "word/numbering.xml", data: numbering },
    { name: "word/fontTable.xml", data: FONT_TABLE },
    { name: "word/header1.xml", data: headerFooter("hdr", "right") },
    { name: "word/header2.xml", data: headerFooter("hdr", null) },
    { name: "word/footer1.xml", data: headerFooter("ftr", "center") },
    { name: "word/_rels/document.xml.rels", data: documentRels },
    ...media,
  ];
}

/** The .docx's bytes. */
export async function docxFile(doc, opts = {}) {
  return zipFiles(docxParts(doc, opts), { date: opts.date });
}
