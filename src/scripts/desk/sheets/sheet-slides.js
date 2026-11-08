// src/scripts/desk/sheets/sheet-slides.js
//
// A sheet as slides (STUDY-DESK-FIXES.md, E37 phase B; BVJ, 2026-11-06), for
// the Slides group of "Save as ▾" on /sheets/. Loaded by sheet-page.js only
// when a Slides item is chosen.
//
// `readSlides` reads present mode's own screens (sheet-present.js's
// prepareDeck), so a slide shows what the room would see: each passage drawn
// once covered and once revealed through the screen's own `update`, its
// footnotes as the reveal lets them out, the key terms box as it stands once
// the passages before it are revealed. The DOM is read with sheet-word.js's
// `inlines` and `block`, the reading Copy and the documents use, after each
// present-mode blank is swapped for the paper's form of it. The leader's
// notes become speaker notes, as present mode sends them to the presenter
// view. desk-slides.mjs lays the deck out, and its writers (or `printSlides`
// here, for a PDF) draw it.
//
// Slides are the room's, so they show the same whichever version is on
// screen; only the leader's version has speaker notes (SEC3-3; BVJ,
// 2026-11-07): saved from the participant version they carry no answers and
// no Leader only parts, as the menu's "Participant version" line says.

import { DOC_CREDIT, docRuns } from "../../../lib/desk-sheet-doc.mjs";
import { revealedWords, roomCodes } from "../../../lib/desk-present.mjs";
import { passageReference, sheetName } from "../../../lib/desk-sheet-passages.mjs";
import { SLIDE, SLIDE_FONTS, SLIDE_LOOK, SLIDE_PT, bodyPoints, deckSlides, slideBoxes, slideParagraphs, titlePoints } from "../../../lib/desk-slides.mjs";
import { qrSvg } from "../../../lib/qr-svg.mjs";
import { rich } from "./sheet-copy.js";
import { prepareDeck } from "./sheet-present.js";
import { codePng } from "./sheet-save.js";
import { block, inlines } from "./sheet-word.js";
import { make } from "../dom.js";

/* ── Reading the screens ──────────────────────────────────────────────── */

/** A rich part's blocks. */
const richBlocks = (html) => {
  const out = [];
  for (const child of rich(html).children) block(child, out);
  return out;
};

const hasWords = (html) => String(html ?? "").replace(/<[^>]*>/g, "").trim() !== "";
const para = (text) => ({ type: "para", inlines: [{ t: "text", text }] });

/**
 * A passage's words as drawn now, as blocks: a present-mode blank becomes the
 * paper's blank (revealed: the leader's answer; covered: a line and its hint,
 * or the traditional word in gray), and a footnote letter the screen hides is
 * left out.
 */
function wordsNow(wordsEl) {
  const copy = /** @type {HTMLElement} */ (wordsEl.cloneNode(true));
  copy.querySelectorAll("sup.sheet-copy__fnref[hidden]").forEach((s) => s.remove());
  for (const b of copy.querySelectorAll(".sheet-blank--present")) {
    const open = b.dataset.revealed === "true";
    const word = b.querySelector(".sheet-blank__word");
    let swap;
    if (open) {
      swap = make("span", "sheet-blank sheet-blank--leader");
      swap.append(make("span", "sheet-blank__line", b.querySelector(".sheet-blank__answer")?.textContent ?? ""));
    } else if (word) {
      swap = make("span");
      swap.dataset.color = "gray";
      const em = make("em");
      em.append(make("u", null, word.textContent));
      swap.append(em);
    } else {
      swap = make("span", "sheet-blank sheet-blank--participant");
      swap.dataset.hint = b.querySelector(".sheet-blank__hint")?.textContent ?? "";
    }
    b.replaceWith(swap);
  }
  const out = [];
  for (const child of copy.children) block(child, out);
  return out;
}

/** The footnotes a passage screen shows now, as note blocks. */
function notesNow(el) {
  return [...el.querySelectorAll(".present-screen__note:not([hidden])")].map((li) => {
    const text = li.querySelector(".sheet-copy__note-text");
    return {
      type: "note",
      label: li.querySelector(".sheet-copy__note-label")?.textContent ?? "",
      inlines: text ? inlines(text.childNodes) : [],
    };
  });
}

/** The parts marked Leader only that present mode puts beside a screen, as speaker notes. */
function leaderOnly(notes) {
  const out = [];
  for (const note of notes ?? []) {
    if (note.type === "space" || note.type === "pageBreak") continue;
    out.push({ type: "tag", text: "Leader only" });
    if (note.type === "passage") out.push(para(`${passageReference(note)} (not shown to the room)`));
    else if (note.type === "keyTerms") out.push(para("The key terms box (not shown to the room)"));
    else {
      out.push(...richBlocks(note.html));
      if (note.type === "question" && hasWords(note.answer)) out.push({ type: "section", text: "Answer" }, ...richBlocks(note.answer));
    }
  }
  return out;
}

/**
 * Each code's PNG, drawn from the same SVG the start screen shows; a code that
 * can't be drawn is left off, and `missing` counts it for the status line (DK3-6).
 */
async function codesWithPng(codes) {
  const out = [];
  let missing = 0;
  for (const c of codes) {
    try {
      const { png } = await codePng(qrSvg(c.url, { title: `QR code for ${c.printable}` }));
      out.push({ ...c, png });
    } catch (err) {
      missing += 1;
      console.error("Study Desk: a code to scan couldn't be drawn for the slides", err);
    }
  }
  return { codes: out, missing };
}

/**
 * The sheet's slides: { title, slides } (desk-slides.mjs's deckSlides), each
 * code on the first slide with its PNG.
 *
 * @param {object} sheet
 * @param {{ participant?: boolean }} [opts] the participant version is on screen: no speaker notes
 */
export async function readSlides(sheet, { participant = false } = {}) {
  const deck = await prepareDeck(sheet);
  const before = (i) => Object.fromEntries(deck.words.map((w, k) => [k, k < i ? w.length : 0]));
  const through = (i) => Object.fromEntries(deck.words.map((w, k) => [k, k <= i ? w.length : 0]));
  const screens = [];
  let codesMissing = 0;

  for (let i = 0; i < deck.screens.length; i++) {
    const s = deck.screens[i];
    const built = deck.built[i];
    const notes = leaderOnly(s.notes);
    if (s.kind === "start") {
      const { codes, more } = roomCodes(sheet);
      const drawn = await codesWithPng(codes);
      codesMissing = drawn.missing;
      screens.push({
        kind: "start",
        title: sheetName(sheet),
        subtitle: sheet.subtitle?.trim() ?? "",
        codes: drawn.codes,
        addresses: [...codes, ...more].map((c) => c.printable).join(" · "),
        notes,
      });
      continue;
    }
    const m = s.module;
    if (s.kind === "text") {
      screens.push({ kind: "text", blocks: richBlocks(m.html), notes });
      continue;
    }
    if (s.kind === "question") {
      const answer = hasWords(m.answer) ? [{ type: "section", text: "Answer" }, ...richBlocks(m.answer)] : [];
      screens.push({ kind: "question", blocks: richBlocks(m.html), notes: [...answer, ...notes] });
      continue;
    }
    if (s.kind === "keyTerms") {
      // As it stands once the passages before it are revealed; a later passage's blanks stay covered.
      built.update({ screen: i, revealed: before(i), notes: {} }, revealedWords(deck.words, before(i)));
      const section = built.el.querySelector(".present-screen__terms");
      const blocks = [];
      const list = section?.querySelector(".sheet-copy__term-list");
      if (list) block(list, blocks);
      const note = section?.querySelector(".sheet-copy__terms-note, .sheet-copy__missing");
      if (note?.textContent.trim()) block(note, blocks);
      screens.push({ kind: "keyTerms", blocks, notes });
      continue;
    }
    // A passage.
    const heading = passageReference(m);
    const wordsEl = built.el.querySelector(".present-screen__words");
    if (!wordsEl) {
      const missing = built.el.querySelector(".present-screen__missing");
      screens.push({ kind: "passage", heading, revealed: [para(missing?.textContent ?? "")], covered: null, footnotes: [], notes });
      continue;
    }
    const n = deck.words[i].length;
    let covered = null;
    if (n) {
      built.update({ screen: i, revealed: { ...before(i), [i]: 0 }, notes: { [i]: true } }, revealedWords(deck.words, before(i)));
      covered = wordsNow(wordsEl);
    }
    built.update({ screen: i, revealed: through(i), notes: { [i]: true } }, revealedWords(deck.words, through(i)));
    screens.push({ kind: "passage", heading, revealed: wordsNow(wordsEl), covered, footnotes: notesNow(built.el), notes });
  }
  // Leave the deck's screens as present mode would start them.
  deck.built.forEach((b, i) => b.update({ screen: i, revealed: {}, notes: {} }, new Set()));

  const slides = deckSlides(screens, { credit: DOC_CREDIT, participant });
  return { title: sheetName(sheet), slides, ...(codesMissing ? { codesMissing } : {}) };
}

/* ── The PDF: the slides printed, one to a page ───────────────────────── */

// Every declaration is !important: print.css sets every color to black, every
// background to none and every font to the serif, all !important, and only an
// inline !important outranks that.
const css = (o) =>
  Object.entries(o)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v} !important`)
    .join(";");

/** A run as HTML, in its own color, size and marks. */
function runHtml(run, look, holder) {
  if (run.br) return holder.append(make("br"));
  const span = make(run.href ? "a" : "span", null, run.text);
  if (run.href) {
    span.setAttribute("href", run.href);
    span.setAttribute("rel", "noopener noreferrer");
    span.setAttribute("target", "_blank");
  }
  if (run.script) span.lang = run.script === "greek" ? "grc" : "he";
  span.style.cssText = css({
    color: run.color ?? look.color,
    "font-family": run.script ? '"Cardo", "Times New Roman", serif' : look.font,
    "font-weight": run.b ? "700" : null,
    "font-style": run.i ? "italic" : null,
    "text-decoration": [run.u ? "underline" : "", run.s ? "line-through" : ""].join(" ").trim() || null,
    "vertical-align": run.sup ? "super" : run.sub ? "sub" : null,
    "font-size": run.sup || run.sub ? "0.62em" : run.size && run.size !== 1 ? `${run.size}em` : null,
    "background-color": run.mark ?? null,
  });
  holder.append(span);
}

/** A text box at `box` (inches), holding paragraphs (slideParagraphs) at `pt`. */
function boxEl(box, paras, { pt, color, font, b = false, i = false, align = null, anchor = "start", fit = true }) {
  const el = make("div", "sheet-slide__box");
  el.style.cssText = css({
    left: `${box.x}in`,
    top: `${box.y}in`,
    width: `${box.w}in`,
    height: `${box.h}in`,
    "justify-content": anchor,
    "font-size": `${pt}pt`,
    "font-family": font,
    color,
    "font-weight": b ? "700" : null,
    "font-style": i ? "italic" : null,
    "text-align": align,
  });
  const inner = make("div", "sheet-slide__text");
  paras.forEach((p, k) => {
    const pe = make("p", "sheet-slide__p");
    pe.style.cssText = css({
      "margin-top": k ? "0.4em" : "0",
      "margin-left": `${p.marL}in`,
      "text-indent": p.indent ? `${p.indent}in` : null,
      "text-align": p.align ?? null,
      "font-size": p.scale !== 1 ? `${p.scale}em` : null,
      "font-weight": p.b ? "700" : null,
      "font-style": p.i ? "italic" : null,
      "font-family": p.heading ? `"${SLIDE_FONTS.heading}", ${SLIDE_FONTS.headingFallback}, serif` : null,
    });
    if (p.list) pe.append(make("span", "sheet-slide__mark", p.list.label));
    const pFont = p.heading ? `"${SLIDE_FONTS.heading}", ${SLIDE_FONTS.headingFallback}, serif` : font;
    if (p.list) pe.firstChild.style.cssText = css({ color, "font-family": pFont });
    for (const run of p.runs) runHtml(run, { color, font: pFont }, pe);
    inner.append(pe);
  });
  el.append(inner);
  if (fit) el.dataset.fit = String(pt);
  return el;
}

const plain = (text) => [{ runs: docRuns([{ t: "text", text: text ?? "" }]), marL: 0, indent: 0, scale: 1, list: null }];
const TEXT_FONT = '"Crimson Text", Georgia, serif';
const HEAD_FONT = `"${SLIDE_FONTS.heading}", ${SLIDE_FONTS.headingFallback}, serif`;

function slideEl(slide) {
  const el = make("section", "sheet-slide");
  el.style.cssText = css({ "background-color": SLIDE_LOOK.ground });
  const boxes = slideBoxes(slide);
  const words = { color: SLIDE_LOOK.words, font: TEXT_FONT };
  const quiet = { color: SLIDE_LOOK.quiet, font: TEXT_FONT };
  if (slide.kind === "start") {
    el.append(boxEl(boxes.title, plain(slide.title), { ...words, pt: titlePoints(slide), b: true, font: HEAD_FONT, align: "center", anchor: "end" }));
    if (slide.subtitle) el.append(boxEl(boxes.subtitle, plain(slide.subtitle), { ...quiet, pt: SLIDE_PT.subtitle, i: true, align: "center" }));
    const codes = (slide.codes ?? []).filter((c) => c.png);
    if (codes.length) {
      el.append(boxEl(boxes.follow, plain("Scan to follow along"), { ...words, pt: 20, align: "center", fit: false }));
      codes.forEach((c, k) => {
        const box = boxes.codes[k];
        const img = make("img", "sheet-slide__code");
        img.src = URL.createObjectURL(new Blob([c.png], { type: "image/png" }));
        img.alt = `QR code for ${c.printable}`;
        img.style.cssText = css({ left: `${box.x}in`, top: `${box.y}in`, width: `${box.w}in`, height: `${box.h}in` });
        el.append(img, boxEl(box.label, plain(c.label), { ...quiet, pt: SLIDE_PT.small, align: "center", fit: false }));
      });
    }
    if (slide.addresses) el.append(boxEl(boxes.addresses, plain(slide.addresses), { ...quiet, pt: SLIDE_PT.small, align: "center" }));
    el.append(boxEl(boxes.credit, plain(slide.credit), { ...quiet, pt: 11, align: "center", anchor: "end" }));
    return el;
  }
  if (slide.kind === "end") {
    el.append(boxEl(boxes.credit, plain(slide.credit), { ...words, pt: 20, align: "center", anchor: "center" }));
    if (slide.addresses) el.append(boxEl(boxes.addresses, plain(slide.addresses), { ...quiet, pt: SLIDE_PT.small, align: "center" }));
    return el;
  }
  if (slide.heading) {
    el.append(boxEl(boxes.heading, plain(slide.heading), { color: SLIDE_LOOK.accent, font: HEAD_FONT, pt: SLIDE_PT.heading, b: true, anchor: "end" }));
  }
  const anchor = slide.kind === "question" || slide.kind === "text" ? "center" : "start";
  el.append(boxEl(boxes.body, slideParagraphs(slide.blocks), { ...words, pt: bodyPoints(slide), anchor }));
  return el;
}

/** Shrink each box's type until its words fit, as the files' text boxes do. */
function fitBoxes(root) {
  for (const box of root.querySelectorAll(".sheet-slide__box[data-fit]")) {
    let pt = Number(box.dataset.fit);
    const inner = /** @type {HTMLElement} */ (box.firstElementChild);
    while (pt > 10 && inner.scrollHeight > box.clientHeight + 1) {
      pt = Math.round(pt * 0.94 * 10) / 10;
      box.style.setProperty("font-size", `${pt}pt`, "important");
    }
  }
}

/**
 * Print the slides, one to a landscape page the size of a slide, for the
 * browser's "Save as PDF". Everything else on the page is hidden for that one
 * print, and put back on `afterprint`.
 *
 * @param {{ slides: object[] }} deck
 */
export async function printSlides(deck) {
  const root = make("div", "sheet-slides-print");
  root.setAttribute("aria-hidden", "true");
  root.style.setProperty("--slide-width", `${SLIDE.inchWidth}in`);
  root.style.setProperty("--slide-height", `${SLIDE.inchHeight}in`);
  for (const slide of deck.slides) root.append(slideEl(slide));
  document.body.append(root);
  const html = document.documentElement;
  // Laid out off screen to be measured, then shown only on paper.
  html.dataset.sheetSlides = "measure";
  // A layout first, so the print-only faces start loading before the wait;
  // the codes are blob images, which must be decoded before the print.
  void root.offsetHeight;
  await Promise.all([
    document.fonts?.ready,
    ...[...root.querySelectorAll("img")].map((img) => img.decode().catch(() => {})),
  ]);
  fitBoxes(root);
  html.dataset.sheetSlides = "print";

  const paper = document.getElementById("sheet-paper");
  const kept = paper?.textContent ?? null;
  const page = make("style");
  page.textContent = `@page { size: ${SLIDE.inchWidth}in ${SLIDE.inchHeight}in; margin: 0; }`;
  if (paper) paper.textContent = "";
  document.head.append(page);

  const done = () => {
    window.removeEventListener("afterprint", done);
    delete html.dataset.sheetSlides;
    page.remove();
    if (paper && kept !== null) paper.textContent = kept;
    root.querySelectorAll("img").forEach((img) => URL.revokeObjectURL(img.src));
    root.remove();
  };
  window.addEventListener("afterprint", done);
  window.print();
}
