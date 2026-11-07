// src/lib/desk-slides-odp.mjs
//
// A sheet's slides as an OpenDocument presentation (.odp; STUDY-DESK-FIXES.md,
// E37 phase B), for LibreOffice Impress, Keynote and Google Slides, from the
// same deck desk-slides.mjs lays out for the .pptx. Hand-written ODF zipped by
// desk-zip.mjs, `mimetype` first and stored, as the .odt is. Loaded by
// sheet-page.js's "Save as" only when this format is chosen.
//
// As in the .pptx: one dark master, a slide per slide of the deck with its
// heading as the title (the slide is named for it too, which is what Impress's
// navigator lists), text boxes that shrink their words to fit, the speaker
// notes on each slide's notes page, the codes as PNG, and LIT_CREDIT_LINE on
// the first and last slides and in meta.xml. One difference: a list's marks
// are written into its paragraphs (a bullet or "1." and a tab) rather than as
// an ODF list, since a slide's list items are flat paragraphs here and a
// numbered ODF list would restart at every one.

import { DOC_CREDIT, DOC_FONTS, docDate, docRuns, xmlEscape as x } from "./desk-sheet-doc.mjs";
import { SLIDE, SLIDE_FONTS, SLIDE_LOOK, SLIDE_PT, bodyPoints, slideBoxes, slideParagraphs, slideRuns } from "./desk-slides.mjs";
import { zipFiles } from "./desk-zip.mjs";

export const ODP_MIME = "application/vnd.oasis.opendocument.presentation";

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" ' +
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
const ALIGN = { left: "start", center: "center", right: "end", justify: "justify" };
const inch = (n) => `${(Math.round(n * 1000) / 1000).toFixed(3)}in`;
const pt = (n) => `${Math.round(n * 10) / 10}pt`;
const NOTES_INK = "#1d231c";

const FONT_FACES =
  "<office:font-face-decls>" +
  [
    [DOC_FONTS.text, "roman"],
    [DOC_FONTS.ancient, "roman"],
    [SLIDE_FONTS.heading, "roman"],
  ]
    .map(([name, generic]) => `<style:font-face style:name="${name}" svg:font-family="'${name}'" style:font-family-generic="${generic}" style:font-pitch="variable"/>`)
    .join("") +
  "</office:font-face-decls>";

/* ── Styles made as they are met ──────────────────────────────────────── */

function autoStyles() {
  const text = new Map();
  const para = new Map();
  const frame = new Map();
  return {
    /** A run's style. `look` is the paragraph's: { pt, color, font, b, i }. */
    text(run, look) {
      const font = run.script ? DOC_FONTS.ancient : look.font;
      const props = [
        `style:font-name="${font}"`,
        `style:font-name-complex="${run.script ? DOC_FONTS.ancient : font}"`,
        `fo:font-size="${pt(look.pt * (run.size ?? 1))}"`,
        `style:font-size-complex="${pt(look.pt * (run.size ?? 1))}"`,
        `fo:color="${run.color ?? look.color}"`,
      ];
      if (run.b || look.b) props.push('fo:font-weight="bold" style:font-weight-complex="bold"');
      if (run.i || look.i) props.push('fo:font-style="italic" style:font-style-complex="italic"');
      if (run.u) props.push('style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"');
      if (run.s) props.push('style:text-line-through-style="solid"');
      if (run.sup) props.push('style:text-position="super 58%"');
      else if (run.sub) props.push('style:text-position="sub 58%"');
      if (run.mark) props.push(`fo:background-color="${run.mark}"`);
      if (run.script === "greek") props.push('fo:language="el" fo:country="GR"');
      else if (run.script === "hebrew") props.push('style:language-complex="he" style:country-complex="IL"');
      else props.push('fo:language="en" fo:country="US"');
      const key = props.join(" ");
      if (!text.has(key)) text.set(key, `T${text.size + 1}`);
      return text.get(key);
    },
    /** A paragraph's style: alignment, indents (inches), the space above it (points), a tab stop for a list's mark. */
    para({ align = null, marL = 0, indent = 0, before = 0, tab = false }) {
      const key = `${align}|${marL}|${indent}|${before}|${tab}`;
      if (!para.has(key)) para.set(key, { name: `P${para.size + 1}`, align, marL, indent, before, tab });
      return para.get(key).name;
    },
    /** A text box's graphic style: where its words sit, and that they shrink to fit. */
    frame(anchor, family = "graphic") {
      const key = `${family}|${anchor}`;
      if (!frame.has(key)) frame.set(key, { name: `${family === "presentation" ? "pr" : "gr"}${frame.size + 1}`, anchor, family });
      return frame.get(key).name;
    },
    xml() {
      let out =
        '<style:style style:name="dp1" style:family="drawing-page"><style:drawing-page-properties presentation:background-visible="true" ' +
        'presentation:background-objects-visible="true" presentation:display-footer="false" presentation:display-page-number="false" ' +
        'presentation:display-date-time="false"/></style:style>' +
        '<style:style style:name="gr0" style:family="graphic"><style:graphic-properties draw:stroke="none" draw:fill="none"/></style:style>';
      for (const { name, anchor, family } of frame.values()) {
        out +=
          `<style:style style:name="${name}" style:family="${family}"><style:graphic-properties draw:stroke="none" draw:fill="none" ` +
          `draw:textarea-vertical-align="${anchor}" draw:auto-grow-height="false" draw:auto-grow-width="false" ` +
          'fo:padding-top="0in" fo:padding-bottom="0in" fo:padding-left="0in" fo:padding-right="0in" fo:wrap-option="wrap" ' +
          'style:shrink-to-fit="true"/></style:style>';
      }
      for (const { name, align, marL, indent, before, tab } of para.values()) {
        const props = [`fo:margin-top="${pt(before)}"`, 'fo:margin-bottom="0pt"', 'fo:line-height="100%"'];
        props.push(`fo:margin-left="${inch(marL)}"`, `fo:text-indent="${inch(indent)}"`);
        // Always written: a title frame's own style centers its words otherwise.
        props.push(`fo:text-align="${ALIGN[align] ?? "start"}"`);
        const tabs = tab ? `<style:tab-stops><style:tab-stop style:position="0in"/></style:tab-stops>` : "";
        out += `<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties ${props.join(" ")}>${tabs}</style:paragraph-properties></style:style>`;
      }
      for (const [props, name] of text) out += `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`;
      return out;
    },
  };
}

/* ── Paragraphs ───────────────────────────────────────────────────────── */

function runsXml(ctx, runs, look) {
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
    const piece = `<text:span text:style-name="${ctx.styles.text(run, look)}">${x(run.text)}</text:span>`;
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

/** One paragraph. `opts`: look, align, marL, indent (inches), before (points), label (a list's mark). */
function paraXml(ctx, runs, { look, align = null, marL = 0, indent = 0, before = 0, label = null }) {
  const style = ctx.styles.para({ align, marL, indent, before, tab: !!label });
  const mark = label ? `<text:span text:style-name="${ctx.styles.text({ text: label }, look)}">${x(label)}<text:tab/></text:span>` : "";
  return `<text:p text:style-name="${style}">${mark}${runsXml(ctx, runs, look)}</text:p>`;
}

const textRuns = (text, toRuns = slideRuns) => toRuns([{ t: "text", text: text ?? "" }]);

function blocksXml(ctx, blocks, look, { toRuns = slideRuns, gap = 0.4 } = {}) {
  const out = slideParagraphs(blocks, { toRuns }).map((p, k) => {
    const pLook = { ...look, pt: look.pt * p.scale, b: p.b || look.b, i: p.i || look.i, font: p.heading ? SLIDE_FONTS.heading : look.font };
    return paraXml(ctx, p.runs, { look: pLook, align: p.align, marL: p.marL, indent: p.indent, before: k ? look.pt * gap : 0, label: p.list?.label ?? null });
  });
  return out.join("") || paraXml(ctx, [], { look });
}

/* ── Shapes ───────────────────────────────────────────────────────────── */

const place = (box) => `svg:x="${inch(box.x)}" svg:y="${inch(box.y)}" svg:width="${inch(box.w)}" svg:height="${inch(box.h)}"`;

function textBox(ctx, box, paras, { name, title = false, anchor = "top" }) {
  if (title) {
    const style = ctx.styles.frame(anchor, "presentation");
    return (
      `<draw:frame presentation:style-name="${style}" draw:name="${x(name)}" draw:layer="layout" ${place(box)} ` +
      `presentation:class="title" presentation:user-transformed="true"><draw:text-box>${paras}</draw:text-box></draw:frame>`
    );
  }
  return `<draw:frame draw:style-name="${ctx.styles.frame(anchor)}" draw:name="${x(name)}" draw:layer="layout" ${place(box)}><draw:text-box>${paras}</draw:text-box></draw:frame>`;
}

function picture(ctx, box, code) {
  const n = ctx.images.length + 1;
  const path = `Pictures/code${n}.png`;
  ctx.images.push({ name: path, data: code.png });
  return (
    `<draw:frame draw:style-name="gr0" draw:name="Code ${n}" draw:layer="layout" ${place(box)}>` +
    `<draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
    `<svg:title>${x(`QR code for ${code.printable ?? code.label ?? ""}`)}</svg:title></draw:frame>`
  );
}

const WORDS = { color: SLIDE_LOOK.words, font: DOC_FONTS.text };
const QUIET = { color: SLIDE_LOOK.quiet, font: DOC_FONTS.text };

function slideShapes(ctx, slide) {
  const boxes = slideBoxes(slide);
  const line = (box, text, look, name, opts = {}) => textBox(ctx, box, paraXml(ctx, textRuns(text), { look, align: "center" }), { name, ...opts });
  let out = "";
  if (slide.kind === "start") {
    out += line(boxes.title, slide.title, { ...WORDS, pt: SLIDE_PT.title, b: true, font: SLIDE_FONTS.heading }, "Title", { title: true, anchor: "bottom" });
    if (slide.subtitle) out += line(boxes.subtitle, slide.subtitle, { ...QUIET, pt: SLIDE_PT.subtitle, i: true }, "Subtitle");
    const codes = (slide.codes ?? []).filter((c) => c.png);
    if (codes.length) {
      out += line(boxes.follow, "Scan to follow along", { ...WORDS, pt: 20 }, "Scan to follow along");
      codes.forEach((c, i) => {
        out += picture(ctx, boxes.codes[i], c);
        out += line(boxes.codes[i].label, c.label, { ...QUIET, pt: SLIDE_PT.small }, `Code label ${i + 1}`);
      });
    }
    if (slide.addresses) out += line(boxes.addresses, slide.addresses, { ...QUIET, pt: SLIDE_PT.small }, "Addresses");
    out += line(boxes.credit, slide.credit, { ...QUIET, pt: 11 }, "Credit", { anchor: "bottom" });
    return out;
  }
  if (slide.kind === "end") {
    out += line(boxes.credit, slide.credit, { ...WORDS, pt: 20 }, "Credit", { anchor: "middle" });
    if (slide.addresses) out += line(boxes.addresses, slide.addresses, { ...QUIET, pt: SLIDE_PT.small }, "Addresses");
    return out;
  }
  if (slide.heading) {
    const look = { color: SLIDE_LOOK.accent, font: SLIDE_FONTS.heading, pt: SLIDE_PT.heading, b: true };
    out += textBox(ctx, boxes.heading, paraXml(ctx, textRuns(slide.heading), { look }), { name: "Title", title: true, anchor: "bottom" });
  }
  const anchor = slide.kind === "question" || slide.kind === "text" ? "middle" : "top";
  out += textBox(ctx, boxes.body, blocksXml(ctx, slide.blocks, { ...WORDS, pt: bodyPoints(slide) }), { name: "Body", anchor });
  return out;
}

// The notes page: letter, portrait, the slide's picture above its notes.
const NOTES_PAGE = { w: 8.5, h: 11 };
const NOTE_IMAGE = { x: 0.75, y: 0.75, w: 7, h: 3.94 };
const NOTE_BODY = { x: 0.75, y: 5, w: 7, h: 5.25 };

function notesXml(ctx, slide, n) {
  const look = { pt: SLIDE_PT.notes, color: NOTES_INK, font: DOC_FONTS.text };
  const body = slide.notes?.length ? blocksXml(ctx, slide.notes, look, { toRuns: docRuns, gap: 0.5 }) : "";
  return (
    `<presentation:notes><draw:page-thumbnail draw:style-name="gr0" draw:layer="layout" ${place(NOTE_IMAGE)} ` +
    `draw:page-number="${n}" presentation:class="page"/>` +
    `<draw:frame presentation:style-name="${ctx.styles.frame("top", "presentation")}" draw:layer="layout" ${place(NOTE_BODY)} presentation:class="notes" ` +
    `presentation:user-transformed="true"${body ? "" : ' presentation:placeholder="true"'}><draw:text-box>${body}</draw:text-box></draw:frame></presentation:notes>`
  );
}

function stylesXml() {
  return (
    `${XML}<office:document-styles ${NS} office:version="1.2">${FONT_FACES}` +
    "<office:styles>" +
    `<style:default-style style:family="graphic"><style:paragraph-properties fo:line-height="100%"/>` +
    `<style:text-properties style:font-name="${DOC_FONTS.text}" fo:font-size="18pt" fo:color="${SLIDE_LOOK.words}" fo:language="en" fo:country="US"/></style:default-style>` +
    "</office:styles><office:automatic-styles>" +
    `<style:page-layout style:name="PM1"><style:page-layout-properties fo:margin-top="0in" fo:margin-bottom="0in" fo:margin-left="0in" fo:margin-right="0in" ` +
    `fo:page-width="${inch(SLIDE.inchWidth)}" fo:page-height="${inch(SLIDE.inchHeight)}" style:print-orientation="landscape"/></style:page-layout>` +
    `<style:page-layout style:name="PM2"><style:page-layout-properties fo:margin-top="0in" fo:margin-bottom="0in" fo:margin-left="0in" fo:margin-right="0in" ` +
    `fo:page-width="${inch(NOTES_PAGE.w)}" fo:page-height="${inch(NOTES_PAGE.h)}" style:print-orientation="portrait"/></style:page-layout>` +
    `<style:style style:name="Mdp1" style:family="drawing-page"><style:drawing-page-properties draw:background-size="full" draw:fill="solid" draw:fill-color="${SLIDE_LOOK.ground}"/></style:style>` +
    "</office:automatic-styles><office:master-styles>" +
    `<style:master-page style:name="LIT_20_Bible" style:display-name="LIT Bible" style:page-layout-name="PM1" draw:style-name="Mdp1">` +
    // The notes page takes no fill of its own: Impress reads one here as the slides' too.
    `<presentation:notes style:page-layout-name="PM2"><draw:page-thumbnail draw:layer="layout" ${place(NOTE_IMAGE)} presentation:class="page"/>` +
    `<draw:frame draw:layer="layout" ${place(NOTE_BODY)} presentation:class="notes" presentation:placeholder="true"><draw:text-box/></draw:frame>` +
    "</presentation:notes></style:master-page></office:master-styles></office:document-styles>"
  );
}

/* ── The file ─────────────────────────────────────────────────────────── */

/**
 * The entries of the .odp, as [{ name, data, store? }] in the order they are
 * zipped, `mimetype` first.
 *
 * @param {{ title: string, slides: object[] }} deck from deckSlides, each code with its `png`
 * @param {{ title?: string, date?: number | Date }} [opts]
 */
export function odpParts(deck, { title = deck.title ?? "", date = Date.now() } = {}) {
  const ctx = { styles: autoStyles(), images: [] };
  const pages = deck.slides
    .map((slide, i) => {
      const name = slide.heading ?? (slide.kind === "start" ? slide.title : slide.kind === "end" ? "Credit" : slide.kind === "question" ? "Question" : "Slide");
      // A slide's name is unique in Impress, so a repeated one (a covered passage and its reveal) takes its number.
      const named = `${name} (${i + 1})`;
      return (
        `<draw:page draw:name="${x(named)}" draw:style-name="dp1" draw:master-page-name="LIT_20_Bible">` +
        slideShapes(ctx, slide) +
        notesXml(ctx, slide, i + 1) +
        "</draw:page>"
      );
    })
    .join("");
  const content =
    `${XML}<office:document-content ${NS} office:version="1.2">${FONT_FACES}` +
    `<office:automatic-styles>${ctx.styles.xml()}</office:automatic-styles>` +
    `<office:body><office:presentation>${pages}</office:presentation></office:body></office:document-content>`;

  const when = docDate(date).replace(/Z$/, "");
  const meta =
    `${XML}<office:document-meta ${NS} office:version="1.2"><office:meta>` +
    `<meta:generator>LIT Bible Study Desk</meta:generator><dc:title>${x(title)}</dc:title><dc:subject>Slides</dc:subject>` +
    `<dc:description>${x(DOC_CREDIT)}</dc:description><dc:language>en-US</dc:language>` +
    `<meta:creation-date>${when}</meta:creation-date><dc:date>${when}</dc:date>` +
    `<meta:user-defined meta:name="Rights">${x(DOC_CREDIT)}</meta:user-defined>` +
    `</office:meta></office:document-meta>`;

  const manifest =
    `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
    `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODP_MIME}"/>` +
    `<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>` +
    ctx.images.map((i) => `<manifest:file-entry manifest:full-path="${i.name}" manifest:media-type="image/png"/>`).join("") +
    "</manifest:manifest>";

  return [
    { name: "mimetype", data: ODP_MIME, store: true },
    { name: "META-INF/manifest.xml", data: manifest },
    { name: "content.xml", data: content },
    { name: "styles.xml", data: stylesXml() },
    { name: "meta.xml", data: meta },
    ...ctx.images,
  ];
}

/** The .odp's bytes. */
export async function odpFile(deck, opts = {}) {
  return zipFiles(odpParts(deck, opts), { date: opts.date });
}
