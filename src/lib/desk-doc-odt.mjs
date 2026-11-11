// src/lib/desk-doc-odt.mjs
//
// A sheet's copy as an OpenDocument text file (STUDY-DESK-FIXES.md, E37), for
// LibreOffice and anything else that reads ODF 1.2, written by hand from the
// document model (desk-sheet-doc.mjs) and zipped by desk-zip.mjs. Loaded by
// sheet-page.js's "Save as" only when "OpenDocument text (.odt)" is chosen.
//
// It sets the copy as the .docx does (desk-doc-docx.mjs): real headings,
// lists that each count from 1 (every text:list restarts unless told to
// continue), ruled lines as borders that don't join (style:join-border),
// highlights as a background, links, and codes to scan as PNG. The paper is
// the page layout, and the page numbers are its master pages' (page 1's
// centered in the footer, every later page's at the top right). Fonts are named, never embedded: Crimson Text with Georgia
// declared beside it, and Cardo for Greek and Hebrew. ODF has no run
// direction: Hebrew is marked as Hebrew (its complex-script language), and the
// reading program's bidirectional algorithm sets it right to left.
// LIT_CREDIT_LINE is the final paragraph, and in meta.xml as the description
// and a user-defined "Rights" field (ODF's metadata has no rights element).
//
// The zip's first entry is `mimetype`, stored, as ODF requires.

import { CODE_CM, DOC_BOX, DOC_CREDIT, DOC_FONTS, DOC_PAGE_NUMBER, DOC_PAPERS, docDate, docRuns, pageNumberAt, xmlEscape as x } from "./desk-sheet-doc.mjs";
import { zipFiles } from "./desk-zip.mjs";

export const ODT_MIME = "application/vnd.oasis.opendocument.text";
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" ' +
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
const BASE_PT = 12;
const ALIGN = { left: "start", center: "center", right: "end", justify: "justify" };

const FONT_FACES =
  "<office:font-face-decls>" +
  `<style:font-face style:name="${DOC_FONTS.text}" svg:font-family="'${DOC_FONTS.text}'" style:font-family-generic="roman" style:font-pitch="variable"/>` +
  `<style:font-face style:name="${DOC_FONTS.textFallback}" svg:font-family="${DOC_FONTS.textFallback}" style:font-family-generic="roman" style:font-pitch="variable"/>` +
  `<style:font-face style:name="${DOC_FONTS.ancient}" svg:font-family="${DOC_FONTS.ancient}" style:font-family-generic="roman" style:font-pitch="variable"/>` +
  `<style:font-face style:name="${DOC_FONTS.small}" svg:font-family="${DOC_FONTS.small}" style:font-family-generic="swiss" style:font-pitch="variable"/>` +
  "</office:font-face-decls>";

/** A paragraph style in office:styles. */
const pStyle = (name, display, { p = "", t = "", next = null, parent = "Standard", outline = null } = {}) =>
  `<style:style style:name="${name}" style:display-name="${display}" style:family="paragraph"` +
  (parent ? ` style:parent-style-name="${parent}"` : "") +
  (next ? ` style:next-style-name="${next}"` : "") +
  (outline ? ` style:default-outline-level="${outline}"` : "") +
  ` style:class="text">` +
  (p ? `<style:paragraph-properties ${p}/>` : "") +
  (t ? `<style:text-properties ${t}/>` : "") +
  "</style:style>";

const bold = 'fo:font-weight="bold" style:font-weight-complex="bold"';
const italic = 'fo:font-style="italic" style:font-style-complex="italic"';
const size = (pt) => `fo:font-size="${pt}pt" style:font-size-complex="${pt}pt"`;
const RULED_BORDER = 'fo:border-bottom="0.5pt solid #888888" fo:padding-bottom="0.02in" style:join-border="false"';

/** The size each paragraph style sets its text at, for a run's relative size. */
const STYLE_PT = { Heading_20_1: 20, Heading_20_2: 15, Heading_20_3: 13, Tag: 10, Note: 10, Foot: 10, Code_20_Caption: 7 };

/** A list's levels; `inset` moves every level in, for a list inside a quotation (inches). */
function listStyle(name, ordered, inset = 0) {
  let levels = "";
  for (let l = 1; l <= 10; l++) {
    const at = inset + 0.5 + 0.25 * (l - 1);
    const place =
      `<style:list-level-properties text:list-level-position-and-space-mode="label-alignment">` +
      `<style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${at}in" ` +
      `fo:text-indent="-0.25in" fo:margin-left="${at}in"/></style:list-level-properties>`;
    levels += ordered
      ? `<text:list-level-style-number text:level="${l}" style:num-suffix="." style:num-format="${["1", "a", "i"][(l - 1) % 3]}">${place}</text:list-level-style-number>`
      : `<text:list-level-style-bullet text:level="${l}" text:bullet-char="${["•", "◦", "▪"][(l - 1) % 3]}">${place}</text:list-level-style-bullet>`;
  }
  return `<text:list-style style:name="${name}">${levels}</text:list-style>`;
}

function stylesXml(paper) {
  const sheet = DOC_PAPERS[paper] ?? DOC_PAPERS.letter;
  const page = sheet.odf;
  return (
    `${XML}<office:document-styles ${NS} office:version="1.2">${FONT_FACES}<office:styles>` +
    `<style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-top="0in" fo:margin-bottom="0.08in" fo:line-height="110%"/>` +
    `<style:text-properties style:font-name="${DOC_FONTS.text}" ${size(BASE_PT)} fo:language="en" fo:country="US" ` +
    `style:font-name-complex="${DOC_FONTS.ancient}" style:language-complex="he" style:country-complex="IL"/></style:default-style>` +
    pStyle("Standard", "Standard", { parent: null }) +
    pStyle("Heading_20_1", "Heading 1", { next: "Standard", outline: 1, p: 'fo:margin-bottom="0.08in" fo:keep-with-next="always"', t: `${bold} ${size(20)}` }) +
    pStyle("Heading_20_2", "Heading 2", { next: "Standard", outline: 2, p: 'fo:margin-top="0.19in" fo:margin-bottom="0.06in" fo:keep-with-next="always"', t: `${bold} ${size(15)}` }) +
    pStyle("Heading_20_3", "Heading 3", { next: "Standard", outline: 3, p: 'fo:margin-top="0.14in" fo:margin-bottom="0.04in" fo:keep-with-next="always"', t: `${bold} ${size(13)}` }) +
    pStyle("Subtitle", "Subtitle", { next: "Standard", t: `${italic} fo:color="#555555"` }) +
    pStyle("Tag", "Part tag", { p: 'fo:keep-with-next="always"', t: `${italic} ${size(10)}` }) +
    pStyle("Note", "Sheet footnote", { p: 'fo:margin-left="0.17in"', t: size(10) }) +
    pStyle("Quote", "Quotations", { p: 'fo:margin-left="0.5in" fo:margin-right="0.5in"' }) +
    pStyle("List_20_Paragraph", "List Paragraph", { p: 'fo:margin-bottom="0.04in"' }) +
    pStyle("Rule", "Rule", { p: 'fo:border-bottom="0.75pt solid #888888" fo:padding-bottom="0.02in"' }) +
    pStyle("Ruled", "Lines to write on", { p: `fo:margin-top="0.25in" fo:margin-bottom="0in" ${RULED_BORDER}` }) +
    pStyle("Answer", "Answer", { p: 'fo:margin-left="0.17in" fo:keep-with-next="always"', t: bold }) +
    pStyle("Break", "Page break", { p: 'fo:break-before="page"' }) +
    pStyle("Code", "Code to scan", { p: 'fo:text-align="end" fo:margin-bottom="0in" fo:keep-with-next="always"' }) +
    pStyle("Code_20_Caption", "Code caption", { p: 'fo:text-align="end"', t: `style:font-name="${DOC_FONTS.small}" ${size(7)}` }) +
    pStyle("Foot", "Sheet foot", { p: 'fo:margin-bottom="0.04in"', t: size(10) }) +
    pStyle("Page_20_Number", "Page number", {
      parent: null,
      p: 'fo:margin-top="0in" fo:margin-bottom="0in" fo:line-height="100%" fo:text-align="end"',
      t: `style:font-name="${DOC_FONTS.small}" ${size(DOC_PAGE_NUMBER.pt)} fo:color="${DOC_PAGE_NUMBER.color}"`,
    }) +
    pStyle("Page_20_Number_20_First", "Page number, first page", { parent: "Page_20_Number", p: 'fo:text-align="center"' }) +
    `</office:styles><office:automatic-styles>` +
    pageLayout("pm1", page, sheet, "footer") +
    pageLayout("pm2", page, sheet, "header") +
    `</office:automatic-styles><office:master-styles>` +
    // Page numbers as the printed copy has them. A document opens on the
    // master page named Standard, so that is the first page's (its number
    // centered in the footer), and it hands every later page to the next.
    `<style:master-page style:name="Standard" style:page-layout-name="pm1" style:next-style-name="Later_20_Pages">` +
    `<style:footer><text:p text:style-name="Page_20_Number_20_First">${PAGE_FIELD}</text:p></style:footer></style:master-page>` +
    `<style:master-page style:name="Later_20_Pages" style:display-name="Later pages" style:page-layout-name="pm2">` +
    `<style:header><text:p text:style-name="Page_20_Number">${PAGE_FIELD}</text:p></style:header></style:master-page>` +
    `</office:master-styles></office:document-styles>`
  );
}

const PAGE_FIELD = '<text:page-number text:select-page="current">1</text:page-number>';

/**
 * A page layout with the page number's header or footer in one margin. The
 * text area is the copy's: the number's line sits in the middle of that margin
 * (pageNumberAt), and the space from it to the text makes up the rest.
 */
function pageLayout(name, page, sheet, where) {
  const inch = (twips) => `${(twips / 1440).toFixed(4)}in`;
  const at = pageNumberAt(sheet.margin);
  const gap = sheet.margin - at - DOC_PAGE_NUMBER.line;
  const near = where === "header" ? "top" : "bottom";
  const far = where === "header" ? "bottom" : "top";
  return (
    `<style:page-layout style:name="${name}"><style:page-layout-properties ` +
    `fo:page-width="${page.width}" fo:page-height="${page.height}" style:print-orientation="portrait" ` +
    `fo:margin-${near}="${inch(at)}" fo:margin-${far}="${page.margin}" fo:margin-left="${page.margin}" fo:margin-right="${page.margin}"/>` +
    `<style:${where}-style><style:header-footer-properties fo:min-height="${inch(DOC_PAGE_NUMBER.line)}" ` +
    `fo:margin-${where === "header" ? "bottom" : "top"}="${inch(gap)}" style:dynamic-spacing="false"/></style:${where}-style>` +
    `</style:page-layout>`
  );
}

/* ── Content ───────────────────────────────────────────────────────────── */

/** The automatic styles a document needs: one per run look and per paragraph variant, made as they are met. */
function autoStyles(boxWidth) {
  const text = new Map();
  const para = new Map();
  let boxes = 0;
  let quotedLists = false;
  return {
    box() {
      return ++boxes;
    },
    /** A list inside a quotation is drawn, so its list styles are written too. */
    quotedList() {
      quotedLists = true;
    },
    text(run, basePt) {
      const props = [];
      if (run.b) props.push(bold);
      if (run.i) props.push(italic);
      if (run.u) props.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
      if (run.s) props.push('style:text-line-through-style="solid"');
      if (run.sup) props.push('style:text-position="super 58%"');
      else if (run.sub) props.push('style:text-position="sub 58%"');
      if (run.color) props.push(`fo:color="${run.color}"`);
      if (run.mark) props.push(`fo:background-color="${run.mark}"`);
      if (run.size && run.size !== 1) props.push(size(Math.round(basePt * run.size * 10) / 10));
      if (run.script === "greek") props.push(`style:font-name="${DOC_FONTS.ancient}" fo:language="el" fo:country="GR"`);
      if (run.script === "hebrew") props.push(`style:font-name-complex="${DOC_FONTS.ancient}" style:language-complex="he" style:country-complex="IL"`);
      if (!props.length) return null;
      const key = props.join(" ");
      if (!text.has(key)) text.set(key, `T${text.size + 1}`);
      return text.get(key);
    },
    para(parent, { align = null, indent = false, flush = false, right = false } = {}) {
      if (!align && !indent && !flush && !right) return parent;
      const key = `${parent}|${align}|${indent}|${flush}|${right}`;
      if (!para.has(key)) para.set(key, { name: `P${para.size + 1}`, parent, align, indent, flush, right });
      return para.get(key).name;
    },
    xml() {
      let out = "";
      for (const { name, parent, align, indent, flush, right } of para.values()) {
        const props = [];
        if (align && ALIGN[align]) props.push(`fo:text-align="${ALIGN[align]}"`);
        if (indent) props.push('fo:margin-left="0.33in"');
        if (right) props.push(`fo:margin-right="${QUOTE_INSET}in"`);
        if (flush) props.push('fo:margin-top="0in"');
        out += `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}"><style:paragraph-properties ${props.join(" ")}/></style:style>`;
      }
      for (const [props, name] of text) out += `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`;
      out += listStyle("LB", false) + listStyle("LN", true);
      if (quotedLists) out += listStyle("LBQ", false, QUOTE_INSET) + listStyle("LNQ", true, QUOTE_INSET);
      if (boxes) {
        // The key terms box (E57): a one-cell table at the text's full width, ruled all round.
        out +=
          `<style:style style:name="Box" style:family="table"><style:table-properties style:width="${boxWidth}" table:align="margins" fo:margin-top="${DOC_BOX.gap}pt"/></style:style>` +
          `<style:style style:name="Box.A" style:family="table-column"><style:table-column-properties style:column-width="${boxWidth}"/></style:style>` +
          `<style:style style:name="Box.A1" style:family="table-cell"><style:table-cell-properties ` +
          `fo:padding-top="${DOC_BOX.padY}pt" fo:padding-bottom="${DOC_BOX.padY}pt" fo:padding-left="${DOC_BOX.padX}pt" fo:padding-right="${DOC_BOX.padX}pt" ` +
          `fo:border="${DOC_BOX.pt}pt solid #${DOC_BOX.color}"/></style:style>`;
      }
      return out;
    },
  };
}

function runsXml(ctx, runs, basePt) {
  let out = "";
  let link = null;
  const close = () => {
    if (!link) return;
    out += `<text:a xlink:type="simple" xlink:href="${x(link.href)}">${link.xml}</text:a>`;
    link = null;
  };
  for (const run of runs) {
    if (run.br) {
      close();
      out += "<text:line-break/>";
      continue;
    }
    const style = ctx.styles.text(run, basePt);
    const piece = style ? `<text:span text:style-name="${style}">${x(run.text)}</text:span>` : x(run.text);
    if (run.href) {
      if (link && link.href !== run.href) close();
      link ??= { href: run.href, xml: "" };
      link.xml += piece;
    } else {
      close();
      out += piece;
    }
  }
  close();
  return out;
}

function p(ctx, style, runs = [], opts = {}) {
  const name = ctx.styles.para(style, opts);
  return `<text:p text:style-name="${name}">${runsXml(ctx, runs, STYLE_PT[style] ?? BASE_PT)}</text:p>`;
}

function h(ctx, level, runs, opts = {}) {
  const style = `Heading_20_${level}`;
  const name = ctx.styles.para(style, opts);
  return `<text:h text:style-name="${name}" text:outline-level="${level}">${runsXml(ctx, runs, STYLE_PT[style])}</text:h>`;
}

// A heading or tag that is plain text: spaces as a browser shows them, and Greek or Hebrew marked.
const textRuns = (text) => docRuns([{ t: "text", text: text ?? "" }]);

/** A quotation's indent on each side, in inches, as the Quote style sets it. */
const QUOTE_INSET = 0.5;

function listXml(ctx, b, nested = false, quoted = false) {
  // Inside a quotation a list keeps the quotation's margins (DK3-4): list
  // styles moved in by the quote's indent, and its right margin on each item.
  if (quoted) ctx.styles.quotedList();
  const style = nested ? "" : ` text:style-name="${b.ordered ? "LN" : "LB"}${quoted ? "Q" : ""}"`;
  let out = `<text:list${style}>`;
  for (const item of b.items) {
    out += `<text:list-item>${p(ctx, "List_20_Paragraph", docRuns(item.inlines), { right: quoted })}`;
    // A nested list of the other kind names its own style; one of the same kind takes the outer list's next level.
    for (const list of item.lists) out += listXml(ctx, list, list.ordered === b.ordered, quoted);
    out += "</text:list-item>";
  }
  return out + "</text:list>";
}

function codeXml(ctx, b) {
  if (!b.png) return "";
  const n = ctx.images.length + 1;
  const path = `Pictures/code${n}.png`;
  ctx.images.push({ name: path, data: b.png });
  const frame =
    `<draw:frame draw:name="Code ${n}" text:anchor-type="as-char" svg:width="${CODE_CM}cm" svg:height="${CODE_CM}cm">` +
    `<draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
    `<svg:desc>${x(b.label)}</svg:desc></draw:frame>`;
  return `<text:p text:style-name="Code">${frame}</text:p>` + p(ctx, "Code_20_Caption", textRuns(b.caption));
}

function body(ctx, blocks, quoted = false) {
  let out = "";
  for (const b of blocks) {
    switch (b.type) {
      case "title": out += h(ctx, 1, textRuns(b.text)); break;
      case "subtitle": out += p(ctx, "Subtitle", textRuns(b.text)); break;
      case "section": out += h(ctx, 2, textRuns(b.text), { flush: b.flush }); break;
      case "tag": out += p(ctx, "Tag", textRuns(b.text)); break;
      case "heading": out += h(ctx, b.level, docRuns(b.inlines), { align: b.align, indent: b.poetry }); break;
      case "para": out += p(ctx, quoted ? "Quote" : "Standard", docRuns(b.inlines), { align: b.align, indent: b.poetry }); break;
      case "quote": out += body(ctx, b.blocks, true); break;
      case "box": {
        const n = ctx.styles.box();
        out +=
          `<table:table table:name="Box${n}" table:style-name="Box"><table:table-column table:style-name="Box.A"/>` +
          `<table:table-row><table:table-cell table:style-name="Box.A1" office:value-type="string">` +
          `${body(ctx, b.blocks, quoted) || p(ctx, "Standard")}</table:table-cell></table:table-row></table:table>`;
        break;
      }
      case "list": out += listXml(ctx, b, false, quoted); break;
      case "rule": out += p(ctx, "Rule"); break;
      case "note": out += p(ctx, "Note", [{ text: b.label, sup: true }, { text: " " }, ...docRuns(b.inlines)]); break;
      case "answer": out += p(ctx, "Answer", textRuns("Answer")); break;
      case "lines":
        for (let i = 0; i < b.count; i++) out += p(ctx, "Ruled");
        break;
      case "break": out += p(ctx, "Break"); break;
      case "foot":
        // The credit is written last, whatever the copy's foot holds.
        if (!b.credit) out += p(ctx, "Foot", docRuns(b.inlines));
        break;
      case "code": out += codeXml(ctx, b); break;
      default: break; // gap
    }
  }
  return out;
}

/**
 * The entries of the .odt, as [{ name, data, store? }] in the order they are
 * zipped, `mimetype` first.
 *
 * @param {{ title: string, blocks: object[] }} doc the model (readCopy)
 * @param {{ title?: string, version?: string, paper?: "letter" | "a4", date?: Date | number }} [opts]
 */
export function odtParts(doc, { title = doc.title, version = "", paper = "letter", date = Date.now() } = {}) {
  const sheet = DOC_PAPERS[paper] ?? DOC_PAPERS.letter;
  const ctx = { styles: autoStyles(`${((sheet.width - 2 * sheet.margin) / 1440).toFixed(3)}in`), images: [] };
  const text = body(ctx, doc.blocks) + p(ctx, "Foot", textRuns(DOC_CREDIT));
  const content =
    `${XML}<office:document-content ${NS} office:version="1.2">${FONT_FACES}` +
    `<office:automatic-styles>${ctx.styles.xml()}</office:automatic-styles>` +
    `<office:body><office:text>${text}</office:text></office:body></office:document-content>`;

  const when = docDate(date).replace(/Z$/, "");
  const meta =
    `${XML}<office:document-meta ${NS} office:version="1.2"><office:meta>` +
    `<meta:generator>LIT Bible Study Desk</meta:generator><dc:title>${x(title)}</dc:title>` +
    (version ? `<dc:subject>${x(version)}</dc:subject>` : "") +
    `<dc:description>${x(DOC_CREDIT)}</dc:description><dc:language>en-US</dc:language>` +
    `<meta:creation-date>${when}</meta:creation-date><dc:date>${when}</dc:date>` +
    `<meta:user-defined meta:name="Rights">${x(DOC_CREDIT)}</meta:user-defined>` +
    `</office:meta></office:document-meta>`;

  const manifest =
    `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
    `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODT_MIME}"/>` +
    `<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>` +
    ctx.images.map((i) => `<manifest:file-entry manifest:full-path="${i.name}" manifest:media-type="image/png"/>`).join("") +
    "</manifest:manifest>";

  return [
    { name: "mimetype", data: ODT_MIME, store: true },
    { name: "META-INF/manifest.xml", data: manifest },
    { name: "content.xml", data: content },
    { name: "styles.xml", data: stylesXml(paper) },
    { name: "meta.xml", data: meta },
    ...ctx.images,
  ];
}

/** The .odt's bytes. */
export async function odtFile(doc, opts = {}) {
  return zipFiles(odtParts(doc, opts), { date: opts.date });
}
