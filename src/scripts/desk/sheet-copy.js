// src/scripts/desk/sheet-copy.js
//
// A sheet drawn as one of its two copies (STUDY-DESK.md, S4; "Order of work",
// 3i), for /sheets/ to show, print and copy for Word. The leader's copy has
// every part, the answers to blanks and to questions; the participant's has
// the passages with their blanks (a line, and the hint beneath), the questions
// with lines to write on, the key terms box, and no part marked Leader only.
// Both end with the LIT's notice, each chapter's address and the day the text
// is from ("Text as of October 18, 2026", S2), and can carry a code per
// chapter (S5).
//
// The rules are src/lib/desk-sheet-copy.mjs. A passage's words are read from
// the chapter's Study View page exactly as the Sheet pane reads them
// (sheet-lit.js's readPassage and passageWords), so the copy and the editor
// can't disagree about which words a passage, a blank or a footnote covers.

import { offsetsToRange, pageAnchorText } from "../../lib/desk-anchor-dom.mjs";
import {
  blankedTermsNote,
  chapterCodes,
  COPY_NAMES,
  keyTermsForCopy,
  modulesForCopy,
  sheetHtmlForShow,
} from "../../lib/desk-sheet-copy.mjs";
import { blankHint, collectKeyTerms, footnoteRows, termForWords } from "../../lib/desk-sheet-lit.mjs";
import { blankCover, footnotesInPlay } from "../../lib/desk-present.mjs";
import { passageReference, sheetName } from "../../lib/desk-sheet-passages.mjs";
import { newestVersion, textAsOfLine } from "../../lib/desk-sheet-check.mjs";
import { LIT_CREDIT_LINE } from "../../lib/lit-credit.mjs";
import { qrSvg } from "../../lib/qr-svg.mjs";
import { locateBlanks, passageWords, readPassage } from "./sheet-lit.js";

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Lines to write on: one ruled line each, as borders, which print where backgrounds don't. */
function ruled(n) {
  const box = make("div", "sheet-copy__lines");
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < n; i++) box.append(make("div", "sheet-copy__line"));
  return box;
}

export function rich(html, cls = "") {
  const box = make("div", `desk-rich sheet-copy__rich ${cls}`.trim());
  box.innerHTML = sheetHtmlForShow(html);
  return box;
}

/**
 * A blank as it prints. On the participant's copy, a line with the hint
 * beneath; on the leader's, the answer itself, underlined, with the same hint.
 */
function blankElement({ copy, answer, hint }) {
  const span = make("span", `sheet-blank sheet-blank--${copy}`);
  const line = make("span", "sheet-blank__line");
  if (copy === "participant") {
    line.setAttribute("role", "img");
    line.setAttribute("aria-label", "blank");
  } else {
    line.append(answer);
  }
  span.append(line);
  if (hint) span.append(make("span", "sheet-blank__hint", hint));
  span.dataset.hint = hint ?? "";
  return span;
}

/**
 * A blank on a screen in present mode (S6): the words, and what covers them
 * until the reveal (the traditional word, or a line with the leader's hint).
 * Both sit in one cell, so revealing never moves the words around it; the
 * presentation shows one or the other by `data-revealed`.
 */
function presentBlank(answer, cover) {
  const span = make("span", "sheet-blank sheet-blank--present");
  span.dataset.revealed = "false";
  const words = make("span", "sheet-blank__answer");
  words.append(answer);
  const over = make("span", `sheet-blank__cover sheet-blank__cover--${cover.kind}`);
  if (cover.kind === "word") {
    over.append(make("span", "sheet-blank__word", cover.text));
  } else {
    over.append(make("span", "sheet-blank__line"));
    if (cover.hint) over.append(make("span", "sheet-blank__hint", cover.hint));
  }
  span.dataset.cover = cover.kind === "word" ? cover.text : cover.hint ?? "";
  span.append(words, over);
  return span;
}

/**
 * Every passage on the copy, read once: { m, view }. The same passage read
 * twice (the key terms box, the blanks the footnotes check) would fetch
 * nothing new, but would work its facts out again.
 */
export async function readAll(modules) {
  const out = new Map();
  for (const m of modules) {
    if (m.type === "passage" && !out.has(m.id)) out.set(m.id, await readPassage(m));
  }
  return out;
}

/** The blanks that print on the copy, as words: what a footnote or a key term could give away. */
export function printingBlanks(modules, views) {
  const out = [];
  for (const m of modules) {
    const view = views.get(m.id);
    if (m.type !== "passage" || !view?.ok) continue;
    for (const b of locateBlanks(view, m)) if (b.prints) out.push({ exact: view.chapter.text.slice(b.start, b.end) });
  }
  return out;
}

/* ── A passage ───────────────────────────────────────────────────────── */

function passageSection(m, view, { copy, allBlanks, code }) {
  const section = make("section", "sheet-copy__passage");
  const head = make("div", "sheet-copy__passage-head");
  head.append(make("h2", "sheet-copy__ref", passageReference(m)));
  if (m.leaderOnly) head.append(make("span", "sheet-copy__tag", "Leader only"));
  section.append(head);
  if (code) section.append(code);

  if (!view.ok) {
    section.append(make("p", "sheet-copy__missing", view.message));
    return section;
  }

  const rows = footnoteRows(view.list, view.footnoteIds, m.footnotes, allBlanks).filter((r) => r.print);
  const words = passageWords(view, m, { keepNotes: new Set(rows.map((r) => r.id)) });
  if (!words) {
    section.append(make("p", "sheet-copy__missing", "This passage couldn’t be read from the chapter."));
    return section;
  }
  words.el.className = "sheet-copy__words chapter-paragraphs";
  applyBlanks(words, view, m, copy);
  section.append(words.el);

  // The footnotes that print, beside their verses (the license keeps them
  // together), with the chapter's own letters.
  const shown = new Set([...words.el.querySelectorAll("sup.sheet-copy__fnref")].map((s) => s.dataset.note));
  const notes = rows.filter((r) => shown.has(r.id));
  if (notes.length) {
    const list = make("ol", "sheet-copy__notes");
    list.setAttribute("aria-label", `Footnotes to ${passageReference(m)}`);
    for (const r of notes) {
      const li = make("li", "sheet-copy__note");
      li.append(make("span", "sheet-copy__note-label", view.labels.get(r.id) ?? ""));
      const body = make("span", "sheet-copy__note-text");
      const source = view.source.footnoteBody(r.id);
      if (source) {
        const clone = document.importNode(source, true);
        clone.querySelectorAll(".footnote-backlink").forEach((x) => x.remove());
        clone.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        body.append(...clone.childNodes);
      } else {
        body.textContent = r.text;
      }
      li.append(body);
      list.append(li);
    }
    section.append(list);
  }
  return section;
}

/**
 * A passage as a screen in present mode shows it (S6): its words, with every
 * blank that prints covered until the reveal, and the footnotes the screen
 * could ever put up (desk-present's footnotesInPlay), each with the chapter's
 * own letter. Which of them show is the presentation's to say, from
 * `rows`, so this is drawn once and only its attributes change.
 *
 * @returns {{ ok: true, words: HTMLElement, notes: HTMLOListElement | null, rows: object[], blanks: string[] } | { ok: false, message: string }}
 */
export function presentPassage(m, view, { allBlanks }) {
  if (!view?.ok) return { ok: false, message: view?.message ?? "This passage couldn’t be read from the chapter." };
  const rows = footnoteRows(view.list, view.footnoteIds, m.footnotes, allBlanks);
  const inPlay = new Set(footnotesInPlay(rows));
  const words = passageWords(view, m, { keepNotes: inPlay });
  if (!words) return { ok: false, message: "This passage couldn’t be read from the chapter." };
  words.el.className = "present-screen__words chapter-paragraphs";
  applyBlanks(words, view, m, "present");
  // The blanks' words as the anchor text reads them (what a footnote is
  // checked against), in reading order, which is the order they are revealed.
  const blanks = [...words.el.querySelectorAll(".sheet-blank--present")].map((el) => el.dataset.words ?? "");
  const shown = new Set([...words.el.querySelectorAll("sup.sheet-copy__fnref")].map((s) => s.dataset.note));
  let notes = null;
  const listed = rows.filter((r) => inPlay.has(r.id) && shown.has(r.id));
  if (listed.length) {
    notes = make("ol", "present-screen__notes");
    notes.setAttribute("aria-label", `Footnotes to ${passageReference(m)}`);
    for (const r of listed) {
      const li = make("li", "present-screen__note");
      li.dataset.note = r.id;
      li.append(make("span", "sheet-copy__note-label", view.labels.get(r.id) ?? ""));
      const body = make("span", "sheet-copy__note-text");
      const source = view.source.footnoteBody(r.id);
      if (source) {
        const clone = document.importNode(source, true);
        clone.querySelectorAll(".footnote-backlink").forEach((x) => x.remove());
        clone.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        body.append(...clone.childNodes);
      } else {
        body.textContent = r.text;
      }
      li.append(body);
      notes.append(li);
    }
  }
  return { ok: true, words: words.el, notes, rows: rows.filter((r) => inPlay.has(r.id)), blanks };
}

/**
 * Put the passage's blanks into its words. Ranges are made first and filled
 * from the last to the first, so taking one out never moves the next. On the
 * participant's copy the words go and a line takes their place; a verse
 * number or footnote letter inside them is kept, after the line.
 */
function applyBlanks(words, view, m, copy) {
  if (words.base == null) return;
  const own = pageAnchorText(words.el.children);
  const located = locateBlanks(view, m)
    .filter((b) => b.prints)
    .sort((a, b) => b.start - a.start);
  for (const b of located) {
    const r = offsetsToRange(own, b.start - words.base, b.end - words.base);
    if (!r) continue;
    const range = document.createRange();
    range.setStart(r.startContainer, r.startOffset);
    range.setEnd(r.endContainer, r.endOffset);
    const answer = range.extractContents();
    const kept = copy !== "leader" ? [...answer.querySelectorAll("sup.vn, sup.fn-ref")] : [];
    const blank = copy === "present"
      ? presentBlank(answer, blankCover(b.blank, termForWords(b.start, b.end, view.allMarks, view.terms)))
      : blankElement({ copy, answer, hint: blankHint(b.blank, b, view.allMarks, view.terms) });
    if (copy === "present") blank.dataset.words = view.chapter.text.slice(b.start, b.end);
    range.insertNode(blank);
    if (kept.length) blank.after(...kept);
  }
}

/* ── Other parts ─────────────────────────────────────────────────────── */

function questionSection(m, copy) {
  const section = make("section", "sheet-copy__question");
  if (m.leaderOnly) section.append(make("span", "sheet-copy__tag", "Leader only"));
  section.append(rich(m.html));
  if (copy === "leader" && String(m.answer ?? "").replace(/<[^>]*>/g, "").trim()) {
    const answer = make("div", "sheet-copy__answer");
    answer.append(make("p", "sheet-copy__answer-label", "Answer"), rich(m.answer));
    section.append(answer);
  }
  if (m.lines) section.append(ruled(m.lines));
  return section;
}

export function keyTermsSection(m, views, modules, copy, blanks) {
  const section = make("section", "sheet-copy__terms");
  if (m.leaderOnly) section.append(make("span", "sheet-copy__tag", "Leader only"));
  section.append(make("h2", "sheet-copy__terms-title", "Key terms"));
  const passages = modules
    .filter((x) => x.type === "passage" && views.get(x.id)?.ok)
    .map((x) => {
      const v = views.get(x.id);
      return { chapter: v.chapter, marks: v.marks, terms: v.terms };
    });
  const { terms, blanked } = keyTermsForCopy(collectKeyTerms(passages, m.omit ?? []), blanks, copy);
  if (!terms.length) {
    section.append(make("p", "sheet-copy__missing", "None of the sheet’s passages uses a key term."));
    return section;
  }
  const ul = make("ul", "sheet-copy__term-list");
  for (const t of terms) {
    const li = make("li");
    // Renderings that are all blank print as one blank, not a row of them.
    const shown = t.renderings.every((r) => r.blank) ? t.renderings.slice(0, 1) : t.renderings;
    shown.forEach((r, i) => {
      if (i) li.append(document.createTextNode(" / "));
      if (r.blank) li.append(blankElement({ copy, answer: null, hint: null }));
      else li.append(make("strong", null, r.text));
    });
    if (t.traditional) li.append(document.createTextNode(`, traditionally ${t.traditional}`));
    if (t.greek) {
      li.append(document.createTextNode(", "));
      li.append(make("em", null, t.greek));
    }
    ul.append(li);
  }
  section.append(ul);
  const note = blankedTermsNote(blanked);
  if (note) section.append(make("p", "sheet-copy__terms-note", note));
  return section;
}

export function codeFigure(code, caption = `Scan to read ${code.label}`) {
  const fig = make("figure", "sheet-copy__code");
  const art = make("div", "sheet-copy__code-art");
  art.innerHTML = qrSvg(code.url, { title: `QR code for ${code.printable}` });
  art.firstElementChild?.setAttribute("role", "img");
  art.firstElementChild?.setAttribute("aria-label", `A code to scan for ${code.label}`);
  fig.append(art, make("figcaption", null, caption));
  return fig;
}

/* ── The copy ────────────────────────────────────────────────────────── */

/**
 * Draw a copy of the sheet.
 *
 * @param {object} sheet the sheet record
 * @param {{ copy: "leader" | "participant", codes?: boolean }} opts
 * @returns {Promise<HTMLElement>}
 */
export async function renderCopy(sheet, { copy, codes = true }) {
  const modules = modulesForCopy(sheet, copy);
  const views = await readAll(modules);
  const blanks = printingBlanks(modules, views);
  const chapters = chapterCodes(modules);
  const codeFor = new Map(codes ? chapters.map((c) => [c.moduleId, c]) : []);

  const article = make("article", `sheet-copy sheet-copy--${copy}`);
  article.setAttribute("aria-label", `${sheetName(sheet)}, ${COPY_NAMES[copy].toLowerCase()}`);
  const head = make("header", "sheet-copy__head");
  head.append(make("h1", "sheet-copy__title", sheetName(sheet)));
  head.append(make("p", "sheet-copy__subtitle", [sheet.subtitle?.trim(), COPY_NAMES[copy]].filter(Boolean).join(" · ")));
  article.append(head);

  for (const m of modules) {
    if (m.type === "passage") {
      const code = codeFor.get(m.id);
      article.append(passageSection(m, views.get(m.id), { copy, allBlanks: blanks, code: code ? codeFigure(code) : null }));
    } else if (m.type === "text") {
      const section = make("section", "sheet-copy__text");
      if (m.leaderOnly) section.append(make("span", "sheet-copy__tag", "Leader only"));
      section.append(rich(m.html));
      article.append(section);
    } else if (m.type === "question") {
      article.append(questionSection(m, copy));
    } else if (m.type === "space") {
      const section = make("section", "sheet-copy__space");
      if (m.leaderOnly) section.append(make("span", "sheet-copy__tag", "Leader only"));
      section.append(ruled(m.lines ?? 4));
      article.append(section);
    } else if (m.type === "keyTerms") {
      article.append(keyTermsSection(m, views, modules, copy, blanks));
    } else if (m.type === "pageBreak") {
      const br = make("div", "sheet-copy__break");
      br.setAttribute("role", "separator");
      br.setAttribute("aria-label", "Page break");
      article.append(br);
    }
  }

  if (!modules.length) article.append(make("p", "sheet-copy__missing", "Nothing on this copy yet."));

  const foot = make("footer", "sheet-copy__foot");
  foot.append(make("p", "sheet-copy__credit", LIT_CREDIT_LINE));
  if (chapters.length) foot.append(make("p", "sheet-copy__addresses", chapters.map((c) => c.printable).join(" · ")));
  const read = [...views.values()].filter((v) => v.ok);
  const newest = newestVersion(read.map((v) => v.contentVersion));
  const asOf = textAsOfLine(newest, read.find((v) => v.contentVersion === newest)?.contentUpdated);
  if (asOf) foot.append(make("p", "sheet-copy__as-of", asOf));
  article.append(foot);
  return article;
}

/**
 * S2: each passage on the copy with its check against today's text
 * ([{ m, check }], in sheet order), for the notice the sheet's page shows
 * above the paper. A passage that can't be read has no check; its copy says
 * so where it would print.
 */
export async function copyChecks(sheet, copy) {
  const modules = modulesForCopy(sheet, copy).filter((m) => m.type === "passage");
  const views = await readAll(modules);
  return modules.map((m) => ({ m, check: views.get(m.id)?.ok ? views.get(m.id).check : null }));
}
