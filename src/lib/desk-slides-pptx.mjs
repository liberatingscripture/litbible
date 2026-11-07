// src/lib/desk-slides-pptx.mjs
//
// A sheet's slides as a PowerPoint file (STUDY-DESK-FIXES.md, E37 phase B),
// written by hand from the deck desk-slides.mjs lays out and zipped by
// desk-zip.mjs: no library. Loaded by sheet-page.js's "Save as" only when
// "PowerPoint (.pptx)" is chosen.
//
// What it writes, and why:
//   - One master and one layout ("Title Only"), dark as present mode's room
//     screen is, and one slide per slide of the deck. A slide's heading is the
//     layout's title placeholder, so PowerPoint's outline, a screen reader and
//     the slide sorter know each slide by its passage; its body is a text box.
//   - The words carry their own font, size and color, so the file looks the
//     same whatever theme a program applies: Crimson Text for the words,
//     Fraunces for the titles, Cardo for Greek and Hebrew, named and never
//     embedded (BVJ, 2026-11-06). Hebrew is marked with its language; the
//     program's bidirectional algorithm sets it right to left.
//   - Speaker notes through a notes master and a notes slide per slide that
//     has any: the Leader only parts, each question's answer, and a covered
//     slide's blanks.
//   - The codes to scan as PNG (the caller draws them), with a description.
//   - LIT_CREDIT_LINE on the first and last slides, and in the file's
//     properties (core.xml's description and a custom "Rights" property, as
//     the .docx has it).
//
// PowerPoint refuses a file over small faults, so the order of every element
// inside a:pPr, a:rPr and p:presentation below is the schema's. Keep it when
// adding one.

import { DOC_CREDIT, DOC_FONTS, docDate, docRuns, xmlEscape as x } from "./desk-sheet-doc.mjs";
import { SLIDE, SLIDE_FONTS, SLIDE_LOOK, SLIDE_PT, bodyPoints, slideBoxes, slideParagraphs, slideRuns, titlePoints } from "./desk-slides.mjs";
import { zipFiles } from "./desk-zip.mjs";

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PML = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const EMU = 914400; // an inch
const emu = (inches) => Math.round(inches * EMU);
const hex = (color) => color.replace("#", "").toUpperCase();
const ALIGN = { left: "l", center: "ctr", right: "r", justify: "just" };
const NUMBERS = ["arabicPeriod", "alphaLcPeriod", "romanLcPeriod"];

/* ── Runs and paragraphs ──────────────────────────────────────────────── */

/**
 * One run. `look` is the paragraph's: { pt, color, font, b }. A run's own
 * color, size and marks win over it.
 */
function runXml(ctx, run, look) {
  const pt = look.pt * (run.size ?? 1);
  const attrs = [`lang="${run.script === "greek" ? "el-GR" : run.script === "hebrew" ? "he-IL" : "en-US"}"`, `sz="${Math.round(pt * 100)}"`];
  if (run.b || look.b) attrs.push('b="1"');
  if (run.i || look.i) attrs.push('i="1"');
  if (run.u) attrs.push('u="sng"');
  if (run.s) attrs.push('strike="sngStrike"');
  if (run.sup) attrs.push('baseline="30000"');
  else if (run.sub) attrs.push('baseline="-25000"');
  attrs.push('dirty="0"');
  // Children in the schema's order: fill, highlight, latin, cs, hlinkClick.
  let kids = `<a:solidFill><a:srgbClr val="${hex(run.color ?? look.color)}"/></a:solidFill>`;
  if (run.mark) kids += `<a:highlight><a:srgbClr val="${hex(run.mark)}"/></a:highlight>`;
  const latin = run.script ? DOC_FONTS.ancient : look.font;
  kids += `<a:latin typeface="${x(latin)}"/><a:cs typeface="${x(run.script ? DOC_FONTS.ancient : look.font)}"/>`;
  if (run.href) kids += `<a:hlinkClick r:id="${ctx.link(run.href)}"/>`;
  return `<a:r><a:rPr ${attrs.join(" ")}>${kids}</a:rPr><a:t>${x(run.text)}</a:t></a:r>`;
}

/**
 * A paragraph. `opts`: look ({ pt, color, font, b, i }), align, marL and
 * indent (inches), bullet ({ char } or { auto, start }), before (points).
 */
function paraXml(ctx, runs, { look, align = null, marL = 0, indent = 0, bullet = null, before = 0 }) {
  const attrs = [];
  if (marL) attrs.push(`marL="${emu(marL)}"`);
  if (indent) attrs.push(`indent="${emu(indent)}"`);
  if (align && ALIGN[align]) attrs.push(`algn="${ALIGN[align]}"`);
  // Children in the schema's order: lnSpc, spcBef, spcAft, buClr, buSzPct, buFont, buChar or buAutoNum or buNone.
  let kids = '<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>';
  kids += `<a:spcBef><a:spcPts val="${Math.round(before * 100)}"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>`;
  if (bullet) {
    kids += `<a:buClr><a:srgbClr val="${hex(look.color)}"/></a:buClr>`;
    if (bullet.auto) kids += `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${bullet.auto}"${bullet.start > 1 ? ` startAt="${bullet.start}"` : ""}/>`;
    else kids += `<a:buFont typeface="Arial"/><a:buChar char="${x(bullet.char)}"/>`;
  } else kids += "<a:buNone/>";
  let body = "";
  for (const run of runs) {
    if (run.br) body += `<a:br><a:rPr lang="en-US" sz="${Math.round(look.pt * 100)}" dirty="0"/></a:br>`;
    else body += runXml(ctx, run, look);
  }
  const end = `<a:endParaRPr lang="en-US" sz="${Math.round(look.pt * 100)}" dirty="0"/>`;
  return `<a:p><a:pPr ${attrs.join(" ")}>${kids}</a:pPr>${body}${end}</a:p>`;
}

/** Plain text as runs, whitespace as a browser shows it and Greek or Hebrew marked. */
const textRuns = (text, toRuns = slideRuns) => toRuns([{ t: "text", text: text ?? "" }]);

/**
 * Blocks as paragraphs (slideParagraphs). `look` is the body's; `gap` is the
 * space between paragraphs as a share of the type size.
 */
function blocksXml(ctx, blocks, look, { toRuns = slideRuns, gap = 0.4 } = {}) {
  const out = slideParagraphs(blocks, { toRuns }).map((p, k) => {
    const pLook = { ...look, pt: look.pt * p.scale, b: p.b || look.b, i: p.i || look.i, font: p.heading ? SLIDE_FONTS.heading : look.font };
    const bullet = !p.list ? null : p.list.ordered ? { auto: NUMBERS[p.list.level % NUMBERS.length], start: p.list.n } : { char: p.list.label };
    return paraXml(ctx, p.runs, { look: pLook, align: p.align, marL: p.marL, indent: p.indent, bullet, before: k ? look.pt * gap : 0 });
  });
  return out.join("") || paraXml(ctx, [], { look });
}

/* ── Shapes ───────────────────────────────────────────────────────────── */

/** A text box at `box` (inches). `title` makes it the slide's title placeholder. */
function textBox(ctx, box, paras, { name, title = false, anchor = "t", autofit = true }) {
  const id = ctx.shape();
  const nv = title
    ? `<p:nvSpPr><p:cNvPr id="${id}" name="${x(name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>`
    : `<p:nvSpPr><p:cNvPr id="${id}" name="${x(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`;
  return (
    `<p:sp>${nv}<p:spPr><a:xfrm><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}">${autofit ? "<a:normAutofit/>" : "<a:noAutofit/>"}</a:bodyPr>` +
    `<a:lstStyle/>${paras}</p:txBody></p:sp>`
  );
}

/** A code to scan, as a picture at `box`. */
function picture(ctx, box, code) {
  const id = ctx.shape();
  const rid = ctx.image(code.png);
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Code ${id}" descr="${x(`QR code for ${code.printable ?? code.label ?? ""}`)}"/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  );
}

const WORDS = { color: SLIDE_LOOK.words, font: DOC_FONTS.text };
const QUIET = { color: SLIDE_LOOK.quiet, font: DOC_FONTS.text };

/** A slide's shapes. */
function slideShapes(ctx, slide) {
  const boxes = slideBoxes(slide);
  let out = "";
  if (slide.kind === "start") {
    const title = { ...WORDS, pt: titlePoints(slide), b: true, font: SLIDE_FONTS.heading };
    out += textBox(ctx, boxes.title, paraXml(ctx, textRuns(slide.title), { look: title, align: "center" }), { name: "Title", title: true, anchor: "b" });
    if (slide.subtitle) {
      out += textBox(ctx, boxes.subtitle, paraXml(ctx, textRuns(slide.subtitle), { look: { ...QUIET, pt: SLIDE_PT.subtitle, i: true }, align: "center" }), { name: "Subtitle" });
    }
    const codes = (slide.codes ?? []).filter((c) => c.png);
    if (codes.length) {
      out += textBox(ctx, boxes.follow, paraXml(ctx, textRuns("Scan to follow along"), { look: { ...WORDS, pt: 20 }, align: "center" }), { name: "Scan to follow along" });
      codes.forEach((c, i) => {
        const box = boxes.codes[i];
        out += picture(ctx, box, c);
        out += textBox(ctx, box.label, paraXml(ctx, textRuns(c.label), { look: { ...QUIET, pt: SLIDE_PT.small }, align: "center" }), { name: `Code label ${i + 1}` });
      });
    }
    if (slide.addresses) {
      out += textBox(ctx, boxes.addresses, paraXml(ctx, textRuns(slide.addresses), { look: { ...QUIET, pt: SLIDE_PT.small }, align: "center" }), { name: "Addresses" });
    }
    out += textBox(ctx, boxes.credit, paraXml(ctx, textRuns(slide.credit), { look: { ...QUIET, pt: 11 }, align: "center" }), { name: "Credit", anchor: "b" });
    return out;
  }
  if (slide.kind === "end") {
    out += textBox(ctx, boxes.credit, paraXml(ctx, textRuns(slide.credit), { look: { ...WORDS, pt: 20 }, align: "center" }), { name: "Credit", anchor: "ctr" });
    if (slide.addresses) {
      out += textBox(ctx, boxes.addresses, paraXml(ctx, textRuns(slide.addresses), { look: { ...QUIET, pt: SLIDE_PT.small }, align: "center" }), { name: "Addresses" });
    }
    return out;
  }
  if (slide.heading) {
    const look = { color: SLIDE_LOOK.accent, font: SLIDE_FONTS.heading, pt: SLIDE_PT.heading, b: true };
    out += textBox(ctx, boxes.heading, paraXml(ctx, textRuns(slide.heading), { look }), { name: "Title", title: true, anchor: "b" });
  }
  const look = { ...WORDS, pt: bodyPoints(slide) };
  const anchor = slide.kind === "question" || slide.kind === "text" ? "ctr" : "t";
  out += textBox(ctx, boxes.body, blocksXml(ctx, slide.blocks, look), { name: "Body", anchor });
  return out;
}

const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/* ── The parts that never change ──────────────────────────────────────── */

const fontScheme = () =>
  `<a:fontScheme name="LIT"><a:majorFont><a:latin typeface="${SLIDE_FONTS.heading}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="${DOC_FONTS.text}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`;

const solid = (c) => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
const THEME =
  `${XML}<a:theme xmlns:a="${NS_A}" name="LIT Bible"><a:themeElements>` +
  `<a:clrScheme name="LIT Bible"><a:dk1><a:srgbClr val="${hex(SLIDE_LOOK.ground)}"/></a:dk1><a:lt1><a:srgbClr val="${hex(SLIDE_LOOK.words)}"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="1D231C"/></a:dk2><a:lt2><a:srgbClr val="${hex(SLIDE_LOOK.quiet)}"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="${hex(SLIDE_LOOK.accent)}"/></a:accent1><a:accent2><a:srgbClr val="8AB4FF"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="FF8A80"/></a:accent3><a:accent4><a:srgbClr val="C9A4F2"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="7ED69C"/></a:accent5><a:accent6><a:srgbClr val="B3B8AF"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="8AB4FF"/></a:hlink><a:folHlink><a:srgbClr val="C9A4F2"/></a:folHlink></a:clrScheme>` +
  fontScheme() +
  `<a:fmtScheme name="LIT Bible"><a:fillStyleLst>${solid("111511")}${solid("1D231C")}${solid("2A3128")}</a:fillStyleLst>` +
  `<a:lnStyleLst><a:ln w="9525">${solid("A7ADA3")}</a:ln><a:ln w="19050">${solid("A7ADA3")}</a:ln><a:ln w="28575">${solid("A7ADA3")}</a:ln></a:lnStyleLst>` +
  "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
  `<a:bgFillStyleLst>${solid("111511")}${solid("1D231C")}${solid("2A3128")}</a:bgFillStyleLst></a:fmtScheme>` +
  "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>";

/** A text style's nine levels, all alike. */
const levels = (pt, color, font, b = false) =>
  Array.from({ length: 9 }, (_, i) =>
    `<a:lvl${i + 1}pPr marL="0" indent="0" algn="l"><a:buNone/><a:defRPr sz="${pt * 100}"${b ? ' b="1"' : ""}>${solid(color)}` +
    `<a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:defRPr></a:lvl${i + 1}pPr>`,
  ).join("");

const TITLE_SHAPE = (id, box) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.w)}" cy="${emu(box.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  `<p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="b"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody></p:sp>`;

const HEAD_BOX = { x: 0.7, y: 0.45, w: SLIDE.inchWidth - 1.4, h: 0.6 };

const MASTER =
  `${XML}<p:sldMaster ${PML}><p:cSld><p:bg><p:bgPr>${solid(hex(SLIDE_LOOK.ground))}<a:effectLst/></p:bgPr></p:bg>` +
  `<p:spTree>${GROUP}${TITLE_SHAPE(2, HEAD_BOX)}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
  `<p:txStyles><p:titleStyle>${levels(SLIDE_PT.heading, hex(SLIDE_LOOK.accent), SLIDE_FONTS.heading, true)}</p:titleStyle>` +
  `<p:bodyStyle>${levels(SLIDE_PT.body, hex(SLIDE_LOOK.words), DOC_FONTS.text)}</p:bodyStyle>` +
  `<p:otherStyle>${levels(18, hex(SLIDE_LOOK.words), DOC_FONTS.text)}</p:otherStyle></p:txStyles></p:sldMaster>`;

const LAYOUT =
  `${XML}<p:sldLayout ${PML} type="titleOnly" preserve="1"><p:cSld name="Title Only"><p:spTree>${GROUP}${TITLE_SHAPE(2, HEAD_BOX)}</p:spTree></p:cSld>` +
  "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";

const rels = (list) =>
  `${XML}<Relationships xmlns="${NS_REL}">` +
  list.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${x(r.target)}"${r.external ? ' TargetMode="External"' : ""}/>`).join("") +
  "</Relationships>";

// The notes page: portrait, the slide's picture above its notes.
const NOTES_W = 6858000;
const NOTES_H = 9144000;
const NOTE_IMAGE = { x: 381000, y: 685800, cx: 6096000, cy: 3429000 };
const NOTE_BODY = { x: 685800, y: 4343400, cx: 5486400, cy: 4114800 };
const notesShapes = (body) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${NOTE_IMAGE.x}" y="${NOTE_IMAGE.y}"/><a:ext cx="${NOTE_IMAGE.cx}" cy="${NOTE_IMAGE.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${NOTE_BODY.x}" y="${NOTE_BODY.y}"/><a:ext cx="${NOTE_BODY.cx}" cy="${NOTE_BODY.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`;

const NOTES_MASTER =
  `${XML}<p:notesMaster ${PML}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>` +
  `<p:spTree>${GROUP}${notesShapes('<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>')}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  `<p:notesStyle>${levels(SLIDE_PT.notes, "1D231C", DOC_FONTS.text)}</p:notesStyle></p:notesMaster>`;

// The notes are dark on white, so the notes' theme is the paper's.
const NOTES_THEME = THEME.replace(`<a:dk1><a:srgbClr val="${hex(SLIDE_LOOK.ground)}"/></a:dk1><a:lt1><a:srgbClr val="${hex(SLIDE_LOOK.words)}"/></a:lt1>`, '<a:dk1><a:srgbClr val="1D231C"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>');

const PACKAGE_RELS = rels([
  { id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" },
  { id: "rId2", type: "../package/2006/relationships/metadata/core-properties", target: "docProps/core.xml" },
  { id: "rId3", type: "custom-properties", target: "docProps/custom.xml" },
]).replace(`${REL}/../package/2006/relationships/metadata/core-properties`, "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties");

/* ── The file ─────────────────────────────────────────────────────────── */

/**
 * The file's parts, in order, for zipFiles.
 *
 * @param {{ title: string, slides: object[] }} deck from deckSlides, each code with its `png`
 * @param {{ title?: string, date?: number | Date }} [opts]
 * @returns {{ name: string, data: string | Uint8Array }[]}
 */
export function pptxParts(deck, { title = deck.title ?? "", date = Date.now() } = {}) {
  const media = [];
  const slideParts = [];
  const notesParts = [];
  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    const slideRels = [{ id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }];
    let shapes = 1;
    const ctx = {
      shape: () => ++shapes,
      link(href) {
        const found = slideRels.find((r) => r.type === "hyperlink" && r.target === href);
        if (found) return found.id;
        const id = `rId${slideRels.length + 1}`;
        slideRels.push({ id, type: "hyperlink", target: href, external: true });
        return id;
      },
      image(png) {
        const name = `code${media.length + 1}.png`;
        media.push({ name: `ppt/media/${name}`, data: png });
        const id = `rId${slideRels.length + 1}`;
        slideRels.push({ id, type: "image", target: `../media/${name}` });
        return id;
      },
    };
    const body = slideShapes(ctx, slide);
    if (slide.notes?.length) {
      const id = `rId${slideRels.length + 1}`;
      slideRels.push({ id, type: "notesSlide", target: `../notesSlides/notesSlide${n}.xml` });
      const noteLinks = [];
      const noteCtx = {
        shape: () => 0,
        link(href) {
          const found = noteLinks.find((r) => r.target === href);
          if (found) return found.id;
          const rid = `rId${noteLinks.length + 3}`;
          noteLinks.push({ id: rid, type: "hyperlink", target: href, external: true });
          return rid;
        },
        image: () => "",
      };
      const look = { pt: SLIDE_PT.notes, color: "#1d231c", font: DOC_FONTS.text };
      const paras = blocksXml(noteCtx, slide.notes, look, { toRuns: docRuns, gap: 0.5 });
      notesParts.push(
        {
          name: `ppt/notesSlides/notesSlide${n}.xml`,
          data: `${XML}<p:notes ${PML}><p:cSld><p:spTree>${GROUP}${notesShapes(paras)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`,
        },
        {
          name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
          data: rels([
            { id: "rId1", type: "notesMaster", target: "../notesMasters/notesMaster1.xml" },
            { id: "rId2", type: "slide", target: `../slides/slide${n}.xml` },
            ...noteLinks,
          ]),
        },
      );
    }
    slideParts.push(
      {
        name: `ppt/slides/slide${n}.xml`,
        data: `${XML}<p:sld ${PML}><p:cSld><p:spTree>${GROUP}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
      },
      { name: `ppt/slides/_rels/slide${n}.xml.rels`, data: rels(slideRels) },
    );
  });

  const count = deck.slides.length;
  const noted = deck.slides.map((s, i) => (s.notes?.length ? i + 1 : 0)).filter(Boolean);
  // presentation.xml's relationships: the master, the slides, the notes master, then the shared parts.
  const presRels = [{ id: "rId1", type: "slideMaster", target: "slideMasters/slideMaster1.xml" }];
  for (let i = 1; i <= count; i++) presRels.push({ id: `rId${i + 1}`, type: "slide", target: `slides/slide${i}.xml` });
  const after = count + 2;
  presRels.push(
    { id: `rId${after}`, type: "notesMaster", target: "notesMasters/notesMaster1.xml" },
    { id: `rId${after + 1}`, type: "theme", target: "theme/theme1.xml" },
    { id: `rId${after + 2}`, type: "presProps", target: "presProps.xml" },
    { id: `rId${after + 3}`, type: "viewProps", target: "viewProps.xml" },
    { id: `rId${after + 4}`, type: "tableStyles", target: "tableStyles.xml" },
  );
  const presentation =
    `${XML}<p:presentation ${PML} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:notesMasterIdLst><p:notesMasterId r:id="rId${after}"/></p:notesMasterIdLst>` +
    `<p:sldIdLst>${Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE.width}" cy="${SLIDE.height}"/><p:notesSz cx="${NOTES_W}" cy="${NOTES_H}"/>` +
    `<p:defaultTextStyle>${levels(18, hex(SLIDE_LOOK.words), DOC_FONTS.text)}</p:defaultTextStyle></p:presentation>`;

  const when = docDate(date);
  const core =
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${x(title)}</dc:title><dc:subject>Slides</dc:subject>` +
    `<dc:description>${x(DOC_CREDIT)}</dc:description><dc:language>en-US</dc:language>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified></cp:coreProperties>`;
  const custom =
    `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Rights"><vt:lpwstr>${x(DOC_CREDIT)}</vt:lpwstr></property></Properties>`;

  const P = "application/vnd.openxmlformats-officedocument.presentationml";
  const contentTypes =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    `<Override PartName="/ppt/presentation.xml" ContentType="${P}.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${P}.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${P}.slideLayout+xml"/>` +
    Array.from({ length: count }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${P}.slide+xml"/>`).join("") +
    `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="${P}.notesMaster+xml"/>` +
    noted.map((n) => `<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="${P}.notesSlide+xml"/>`).join("") +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    `<Override PartName="/ppt/presProps.xml" ContentType="${P}.presProps+xml"/>` +
    `<Override PartName="/ppt/viewProps.xml" ContentType="${P}.viewProps+xml"/>` +
    `<Override PartName="/ppt/tableStyles.xml" ContentType="${P}.tableStyles+xml"/>` +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' +
    "</Types>";

  return [
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: PACKAGE_RELS },
    { name: "docProps/core.xml", data: core },
    { name: "docProps/custom.xml", data: custom },
    { name: "ppt/presentation.xml", data: presentation },
    { name: "ppt/_rels/presentation.xml.rels", data: rels(presRels) },
    { name: "ppt/presProps.xml", data: `${XML}<p:presentationPr ${PML}/>` },
    { name: "ppt/viewProps.xml", data: `${XML}<p:viewPr ${PML}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` },
    { name: "ppt/tableStyles.xml", data: `${XML}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` },
    { name: "ppt/theme/theme1.xml", data: THEME },
    { name: "ppt/theme/theme2.xml", data: NOTES_THEME },
    { name: "ppt/slideMasters/slideMaster1.xml", data: MASTER },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: rels([
        { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
        { id: "rId2", type: "theme", target: "../theme/theme1.xml" },
      ]),
    },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: LAYOUT },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: rels([{ id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }]) },
    { name: "ppt/notesMasters/notesMaster1.xml", data: NOTES_MASTER },
    { name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: rels([{ id: "rId1", type: "theme", target: "../theme/theme2.xml" }]) },
    ...slideParts,
    ...notesParts,
    ...media,
  ];
}

/** The .pptx's bytes. */
export async function pptxFile(deck, opts = {}) {
  return zipFiles(pptxParts(deck, opts), { date: opts.date });
}
