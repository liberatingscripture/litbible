// src/scripts/desk/sheets/sheet-lit.js
//
// What a sheet knows about the LIT, in the Sheets pane (STUDY-DESK.md, "Order
// of work", 3h): a passage's words with its blanks (S10) and the choice of
// which footnotes print, flagging any that would give a blank away (C15); the
// key terms box, filled in from the sheet's passages (S3); and the license
// card with the commercial check (S7). The rules are
// src/lib/desk-sheet-lit.mjs; this file reads the chapters and draws.
// sheet-editor.js owns saving: each card here is handed `update(fields)` for its
// own module, and `getSheet()` for what the rest of the sheet holds.
//
// Everything is read from the chapter's Chapter View page (chapter-page.js), so
// a passage's words, its key terms and its footnotes are character for
// character the ones Chapter View shows, and every offset here is in that
// chapter's anchor text (desk-anchor-dom.mjs), the same measure a blank's
// quote is stored in.

import { offsetsToRange, pageAnchorText, rangeToOffsets } from "../../../lib/desk-anchor-dom.mjs";
import { LIT_CREDIT_LINE } from "../../../lib/lit-credit.mjs";
import { BOOKS, bookKeyToLabel } from "../../../data/books.js";
import {
  blankFromOffsets,
  blankHint,
  blankWords,
  blanksTouching,
  booksToCheck,
  collectKeyTerms,
  commercialShare,
  completeBooks,
  countWords,
  flaggedWord,
  footnoteRows,
  groupBlanks,
  htmlToText,
  keyTermLine,
  locateBlank,
  marksInRange,
  overlapsBlank,
  pickedChoice,
  setFootnoteChoices,
  startingHint,
  termForWords,
  termBlanksLeft,
  termMarkOffsets,
  traditionalHint,
  verseLabel,
  wordAtPoint,
  wordOnLine,
  wordSpans,
  wordsTouching,
} from "../../../lib/desk-sheet-lit.mjs";
import { locatePassage, passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { freshCopy, passageAsRecord, passageCheck } from "../../../lib/desk-sheet-check.mjs";
import { releaseNoteFor } from "../../../lib/desk-change.mjs";
import { loadChapterPage } from "../chapter-page.js";
import { diffParagraph } from "../diff-view.js";
import { loadReleaseNotes } from "../release-feed.js";
import { buttons, describe, make } from "../dom.js";
import { plural } from "../desk-text.js";
import { newId } from "../../../lib/desk-records.mjs";

const button = buttons("desk-sheet__btn");

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");


/**
 * Puts focus back on the control a redraw replaced (SH5-10). A control that is
 * gone (its row was removed, its list changed) must not drop focus to the page:
 * it goes to `fallback`, a control that is always drawn, when there is one.
 */
function restoreFocus(root, key, fallback = null) {
  if (!key) return;
  const find = (k) => root.querySelector(`[data-focus-key="${CSS.escape(k)}"]`);
  (find(key) ?? (fallback ? find(fallback) : null))?.focus();
}

const quoted = (words) => `“${words.length > 60 ? words.slice(0, 59) + "…" : words}”`;

/* ── Reading a passage from its chapter ──────────────────────────────── */

// What each fetched chapter gives a sheet, worked out once: its anchor text,
// its key-term marks as offsets, and where each footnote letter sits.
const chapterFacts = new WeakMap();

function factsFor(source) {
  let facts = chapterFacts.get(source);
  if (facts) return facts;
  const chapter = source.anchorText();
  facts = {
    chapter,
    marks: termMarkOffsets(chapter, source.termData),
    terms: source.termData?.terms ?? {},
    list: source.footnoteList() ?? [],
    letterAt: footnotePositions(source, chapter),
    labels: new Map(source.footnotes.map((f) => [f.id, f.label])),
  };
  chapterFacts.set(source, facts);
  return facts;
}

/**
 * Where each footnote letter sits in the chapter's anchor text: the end of the
 * last word before it. A footnote belongs to a passage when its letter does,
 * so one hanging off the passage's last word is in and one ending the verse
 * before is out.
 */
function footnotePositions(source, chapter) {
  const out = new Map();
  const box = source.textBox;
  if (!box) return out;
  const walker = source.doc.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.parentElement?.closest("sup.vn, sup.fn-ref") && n.nodeValue.trim()) last = n;
      continue;
    }
    if (!n.matches("sup.fn-ref")) continue;
    const id = (n.querySelector('a[href^="#"]')?.getAttribute("href") ?? "").slice(1);
    if (!id || out.has(id)) continue;
    const at = last ? chapter.fromDom(last, last.nodeValue.length, "end") : 0;
    if (at != null) out.set(id, at);
  }
  return out;
}

/**
 * When a passage's verses are found in today's text but its words can't be
 * taken from the chapter's page (passageWords returns null). Reading again
 * gives the same answer, so the step is to add the verses afresh (CP-13).
 */
export const UNREAD_PASSAGE = "This passage couldn’t be read from the chapter.";
export const UNREAD_PASSAGE_STEP = `${UNREAD_PASSAGE} Try adding these verses again from the LIT pane, then remove this passage.`;
export const UNREAD_PASSAGE_ON_PAPER = `${UNREAD_PASSAGE} On the Study Desk, try adding these verses to the sheet again, then remove this passage.`;

/**
 * A passage module read against today's chapter: { ok: true, source, chapter,
 * at, check (S2: whether its wording changed since it was added, from
 * desk-sheet-check.mjs), contentVersion (the text's) and contentUpdated (its
 * build time), marks (the term marks
 * in it), terms, list, footnoteIds, labels } or { ok: false, message }.
 */
export async function readPassage(m) {
  let source;
  try {
    source = await loadChapterPage(m.bookKey, m.chapter);
  } catch (_) {
    return { ok: false, message: "This passage couldn’t be loaded. It will be read again when the sheet next opens." };
  }
  if (source.draft || !source.textBox) {
    return { ok: false, message: "This chapter is still being translated, so its text isn’t ready to show." };
  }
  const facts = factsFor(source);
  const at = locatePassage(facts.chapter, m);
  if (at.start == null) return { ok: false, message: "These verses can no longer be found in the LIT." };
  const footnoteIds = facts.list
    .filter((f) => {
      const pos = facts.letterAt.get(f.id);
      return pos != null ? pos >= at.start && pos <= at.end : f.verse >= m.verse && f.verse <= (m.endVerse ?? m.verse);
    })
    .map((f) => f.id);
  return {
    ok: true,
    source,
    chapter: facts.chapter,
    at,
    check: passageCheck(facts.chapter, m),
    contentVersion: source.contentVersion ?? document.documentElement.dataset.contentVersion ?? null,
    // The build time that goes with contentVersion, from the same page.
    contentUpdated: source.contentVersion ? (source.contentUpdated ?? null) : (document.documentElement.dataset.contentUpdated ?? null),
    marks: marksInRange(facts.marks, at.start, at.end),
    allMarks: facts.marks,
    terms: facts.terms,
    list: facts.list,
    footnoteIds,
    labels: facts.labels,
  };
}

/** The passage's blanks, each with where it is today. */
export function locateBlanks(view, m) {
  return (m.blanks ?? []).map((b) => ({ blank: b, ...locateBlank(view.chapter, b, view.at, m.endVerse ?? m.verse) }));
}

// ---- a sheet's printing blanks, worked out once per change (GF8b-9) ----

// Every passage card's footnote list needs every blank on the sheet that
// prints, since a footnote anywhere could give one away. Each card used to
// work that list out for itself on every save, reading every other passage:
// quadratic in the passages with blanks. It is worked out once for a given
// set of passages with blanks, and the cards share it.

const blankKeys = new WeakMap(); // a sheet record → the key of its passages with blanks
/** What a sheet's printing blanks depend on: its passages that have blanks. */
function blanksKey(sheet) {
  if (!sheet) return "[]";
  let key = blankKeys.get(sheet);
  if (key == null) {
    key = JSON.stringify((sheet.modules ?? []).filter((x) => x?.type === "passage" && x.blanks?.length));
    blankKeys.set(sheet, key);
  }
  return key;
}

let blanksMemo = { key: null, promise: null };
/**
 * Every blank on the sheet that prints, as its words and the passage's
 * reference. A list that met a passage it couldn't read isn't kept, so the
 * next change reads that passage again.
 */
function sheetPrintingBlanks(sheet) {
  const key = blanksKey(sheet);
  if (blanksMemo.key === key) return blanksMemo.promise;
  const memo = { key, promise: null };
  memo.promise = (async () => {
    const out = [];
    let complete = true;
    for (const x of sheet?.modules ?? []) {
      if (x?.type !== "passage" || !x.blanks?.length) continue;
      const v = await readPassage(x);
      if (!v.ok) {
        complete = false;
        continue;
      }
      for (const b of locateBlanks(v, x)) {
        if (b.prints) out.push({ ...blankWords(b, v.chapter.text, v.allMarks, v.terms), ref: passageReference(x) });
      }
    }
    if (!complete && blanksMemo === memo) blanksMemo = { key: null, promise: null };
    return out;
  })();
  memo.promise.catch(() => {
    if (blanksMemo === memo) blanksMemo = { key: null, promise: null };
  });
  blanksMemo = memo;
  return memo.promise;
}

/* ── The passage's words ─────────────────────────────────────────────── */

/**
 * The passage's words as Chapter View prints them, verse numbers kept, footnote
 * letters, ids and the page's own labels left out. Whole blocks are copied and
 * then trimmed to the passage, so every verse keeps its data-verse span and
 * the copy reads as anchor text exactly as the chapter does: `base` is the
 * chapter offset where the copy's own anchor text begins (null when the two
 * can't be lined up, and then nothing can be blanked). The blocks come from
 * the fetched page's kept parts, which chapter-page.js made inert before
 * any pane could import them (SEC3-2), so no scrub is needed here.
 *
 * `keepNotes`, for a copy on paper (/sheets/), is the footnotes that print:
 * their letters stay in the words as plain superscripts, so each note can be
 * found beside its verse. Anchor text never counts a footnote letter, so the
 * offsets are the same either way.
 *
 * @param {{ keepNotes?: Set<string> | null }} [opts]
 */
export function passageWords(view, m, { keepNotes = null } = {}) {
  const { source, chapter, at } = view;
  const r = offsetsToRange(chapter, at.start, at.end);
  if (!r) return null;
  const range = source.doc.createRange();
  range.setStart(r.startContainer, r.startOffset);
  range.setEnd(r.endContainer, r.endOffset);
  const blocks = [...source.textBox.children].filter((b) => range.intersectsNode(b));
  if (!blocks.length) return null;
  const words = make("div", "desk-sheet__words chapter-paragraphs");
  for (const b of blocks) words.append(document.importNode(b, true));

  const full = pageAnchorText(words.children);
  const blockStart = chapter.text.lastIndexOf(full.text, at.start);
  if (blockStart >= 0 && blockStart + full.text.length >= at.end) {
    const inner = offsetsToRange(full, at.start - blockStart, at.end - blockStart);
    if (inner) {
      // The end first: trimming the start can shorten the text node the end is in.
      const after = document.createRange();
      after.setStart(inner.endContainer, inner.endOffset);
      after.setEnd(words, words.childNodes.length);
      after.deleteContents();
      const before = document.createRange();
      before.setStart(words, 0);
      // A passage opening on a verse keeps that verse's number.
      const opening = full.spans.get(m.verse)?.[0] === at.start - blockStart
        ? words.querySelector(`sup.vn[id="v${m.verse}"]`)
        : null;
      const keep = opening?.closest(".vglue") ?? opening;
      if (keep) before.setEndBefore(keep);
      else before.setEnd(inner.startContainer, inner.startOffset);
      before.deleteContents();
    }
  }
  words.querySelectorAll("sup.fn-ref").forEach((s) => {
    const id = (s.querySelector('a[href^="#"]')?.getAttribute("href") ?? "").slice(1);
    if (!keepNotes?.has(id)) {
      s.remove();
      return;
    }
    const letter = make("sup", "fn-ref sheet-copy__fnref", view.labels.get(id) ?? s.textContent.trim());
    letter.dataset.note = id;
    s.replaceWith(letter);
  });
  words.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  // The ids are gone, so references to them go too, except a poetry block's
  // description, which every page showing a passage (/desk, /sheets) carries
  // as a chapter page does (BA86).
  words.querySelectorAll("[aria-describedby], [aria-labelledby]").forEach((el) => {
    if (el.getAttribute("aria-describedby") !== "hbq-description") el.removeAttribute("aria-describedby");
    el.removeAttribute("aria-labelledby");
  });
  for (const el of words.querySelectorAll("p, blockquote")) if (!el.textContent.trim()) el.remove();

  const own = pageAnchorText(words.children);
  let base = chapter.text.startsWith(own.text, at.start) ? at.start : chapter.text.indexOf(own.text, Math.max(0, at.start - own.text.length));
  if (base < 0 || !own.text) base = null;
  return { el: words, base };
}

// The blanked words in every sheet card, drawn with one CSS Custom Highlight,
// so marking them changes nothing in the copy of the text (its anchor text
// stays readable for the next selection). The list under each passage names
// every blank in words, for a screen reader.
const blankRanges = new Map(); // card element → Range[]
const BLANK_HIGHLIGHT = "desk-sheet-blank";

function drawBlankHighlight() {
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
  for (const [el] of blankRanges) if (!el.isConnected) blankRanges.delete(el);
  const ranges = [...blankRanges.values()].flat();
  if (ranges.length) CSS.highlights.set(BLANK_HIGHLIGHT, new Highlight(...ranges));
  else CSS.highlights.delete(BLANK_HIGHLIGHT);
}

/** Snap chapter offsets out to whole words, as the selection panel does. */
function wholeWords(text, start, end) {
  const letter = (ch) => /[\p{L}\p{N}]/u.test(ch ?? "");
  const inner = (i) => /['’-]/.test(text[i] ?? "") && letter(text[i - 1]) && letter(text[i + 1]);
  while (start > 0 && (letter(text[start - 1]) || inner(start - 1))) start--;
  while (end < text.length && (letter(text[end]) || inner(end))) end++;
  return [start, end];
}

/* ── A passage's card: words, blanks, footnotes ──────────────────────── */

/**
 * S2: a passage whose wording changed since it was added. The sheet prints
 * today's wording either way (format rule 1); this tells the leader, shows
 * what moved, links the release note that says why when there is one, and
 * offers "Keep the new wording", which takes a fresh comparison copy so the
 * notice goes. Until then the sheet's own page says so above the paper too.
 */
function wordingNotice(view, mod, { readOnly, update }) {
  const box = make("div", "desk-sheet__changed");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Wording changed");
  box.append(make("p", "desk-sheet__changed-head", mod.quote
    ? "The words of this passage have changed since you added it."
    : "The wording of these verses has changed since you added this passage."));
  const diff = diffParagraph(view.check.diff);
  if (diff) box.append(diff);
  const when = make("p", "desk-sheet__changed-when");
  when.hidden = true;
  box.append(when);
  loadReleaseNotes().then((entries) => {
    const found = entries ? releaseNoteFor(entries, passageAsRecord(mod)) : null;
    if (!found || !box.isConnected) return;
    const link = make("a", null, "Release note");
    link.href = found.href;
    when.replaceChildren(`Changed ${found.label} · `, link);
    when.hidden = false;
  });
  box.append(make("p", "desk-sheet__changed-hint", "The sheet prints today’s wording. Check your blanks, questions, and notes against it."));
  if (!readOnly) {
    const keep = button("Keep the new wording");
    keep.dataset.focusKey = "keep-wording";
    keep.addEventListener("click", () => {
      const fields = freshCopy(view.chapter, mod, view.contentVersion);
      if (fields) update(fields, `${passageReference(mod)} is checked against its new wording from now on.`);
    });
    box.append(keep);
  }
  return box;
}

/**
 * The body of a passage module's card.
 *
 * @param {{ m: object, readOnly: boolean, getSheet: () => object,
 *   update: (fields: object, announce?: string) => Promise<boolean>, say: (text: string) => void,
 *   fill?: (fields: object) => void }} opts
 *   `fill` takes a passage's first comparison copy without an undo step
 *   (one gathered from a search has none until it is first read here).
 * @returns {{ el: HTMLElement, update: (m: object) => void, sheetChanged: () => void,
 *   hasFocus: () => boolean, destroy: () => void }}
 */
export function createPassageBody({ m, readOnly, getSheet, update, say, fill = null }) {
  const el = make("div", "desk-sheet__passage");
  el.append(make("p", "desk-sheet__status", "Reading the passage…"));
  let gone = false;
  let mod = m;
  let view = null;
  let words = null; // { el, base }
  let blanksBox = null;
  let notesBox = null;
  let notesOpen = false;
  let blankNote = null; // under the Blanks heading: why a blank wasn't made
  let seq = 0;

  const ownBlanks = () => (view ? locateBlanks(view, mod) : []);

  // What the footnote list is drawn from besides the chapter: this passage's
  // choices, and every passage on the sheet with blanks. A save that changes
  // neither (typing in a text part, say) leaves the list as it is, since
  // working it out holds every footnote against every blank (BA133).
  const notesInputs = () => `${JSON.stringify(mod.footnotes ?? [])}\n${blanksKey(getSheet())}`;
  let notesDrawn = null;

  async function render() {
    const n = ++seq;
    const v = await readPassage(mod);
    if (gone || n !== seq) return;
    const focusKey = el.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
    blankRanges.delete(el);
    if (!v.ok) {
      view = null;
      el.replaceChildren(make("p", "desk-sheet__status", v.message));
      drawBlankHighlight();
      return;
    }
    view = v;
    words = passageWords(v, mod);
    const box = make("div", "desk-sheet__passage-text");
    if (!words) {
      box.append(make("p", "desk-sheet__status", readOnly ? UNREAD_PASSAGE : UNREAD_PASSAGE_STEP));
      el.replaceChildren(box);
      return;
    }
    box.append(words.el);
    if (!readOnly && words.base != null) {
      box.append(make("p", "desk-sheet__hint", "Click a word, double-click it, or drag across words to choose them. With the keyboard: Tab to the passage, move by word with the left and right arrows and by line with up and down (Shift extends), and press Enter to blank, or to fill in words that are already blank."));
      armWordCursor();
    }
    if (v.check.state === "changed") {
      box.append(wordingNotice(v, mod, { readOnly, update }));
    } else if (v.at.status === "moved") {
      box.append(make("p", "desk-sheet__status", "The words this passage started or ended on have moved since it was added, so it shows them where they stand now."));
    }
    if (v.check.state === "unchecked" && !readOnly && fill) {
      const fields = freshCopy(v.chapter, mod, v.contentVersion);
      if (fields) fill(fields);
    }
    blanksBox = make("div", "desk-sheet__blanks");
    notesBox = make("details", "desk-sheet__notes");
    notesBox.open = notesOpen;
    notesBox.addEventListener("toggle", () => { notesOpen = notesBox.open; });
    el.replaceChildren(box, blanksBox, notesBox);
    drawBlanks();
    drawNotes();
    // A removed blank's row is gone: focus goes to the button that makes one.
    restoreFocus(el, focusKey, "blank-selection");
  }

  function markBlanks(located) {
    if (!words?.el || words.base == null) return;
    const own = pageAnchorText(words.el.children);
    const ranges = [];
    for (const b of located) {
      if (!b.prints) continue;
      const r = offsetsToRange(own, b.start - words.base, b.end - words.base);
      if (!r) continue;
      const range = document.createRange();
      range.setStart(r.startContainer, r.startOffset);
      range.setEnd(r.endContainer, r.endOffset);
      ranges.push(range);
    }
    if (ranges.length) blankRanges.set(el, ranges);
    else blankRanges.delete(el);
    drawBlankHighlight();
  }

  // ---- blanks ----

  /**
   * A blank refused: shown under the Blanks heading as well as announced, so
   * a reader who pressed the button sees why nothing happened (CP-13). The
   * line isn't a live region; `say` is the one announcement.
   */
  function refuse(text) {
    if (blankNote?.isConnected) {
      blankNote.textContent = text;
      blankNote.hidden = false;
    }
    say(text);
  }

  function setBlanks(blanks, announce) {
    return update({ blanks }, announce);
  }

  function addBlanks(spans, announce) {
    const located = ownBlanks();
    const fresh = [];
    for (const [s, e] of spans) {
      if (overlapsBlank(located, s, e) || fresh.some((b) => b.s < e && s < b.e)) continue;
      // A key term starts with its traditional word beneath, where the verse
      // leaves no doubt which that is; where it holds more than one word of
      // the term's family, the leader chooses in the list, and where the word
      // is the blanked word itself, the hint would be the answer (E85).
      const term = termForWords(s, e, view.allMarks, view.terms);
      fresh.push({ s, e, blank: blankFromOffsets(view.chapter, s, e, { id: newId(), hint: startingHint(view.chapter.text.slice(s, e), term) }) });
    }
    if (!fresh.length) {
      refuse("Those words are already blank.");
      return;
    }
    setBlanks([...(mod.blanks ?? []), ...fresh.map((f) => f.blank)], announce ?? `${plural(fresh.length, "blank")} added.`);
  }

  function blankSelection() {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (blankNote) blankNote.hidden = true;
    const picked = range && !range.collapsed && words?.el.contains(range.commonAncestorContainer) && words.base != null;
    const offsets = picked ? rangeToOffsets(pageAnchorText(words.el.children), range) : null;
    // A click in the passage lights a word without selecting it; that word counts.
    const held = offsets ? null : shownCursorSpan();
    if (!offsets && !held) {
      refuse("Select words in this passage first, then choose “Blank the selected words.”");
      return;
    }
    let [s, e] = wholeWords(view.chapter.text, ...(offsets ? [words.base + offsets[0], words.base + offsets[1]] : held));
    s = Math.max(s, view.at.start);
    e = Math.min(e, view.at.end);
    sel.removeAllRanges();
    addBlanks([[s, e]]);
  }

  /** Fill in again every blank the span touches (a blank is one unit). */
  function fillIn(s, e) {
    const hit = blanksTouching(ownBlanks(), s, e);
    if (!hit.length) {
      refuse("None of the selected words are blank.");
      return;
    }
    const ids = new Set(hit.map((b) => b.blank.id));
    const words = hit.map((b) => view.chapter.text.slice(b.start, b.end));
    const label = hit.length > 1 ? `${hit.length} blanks` : quoted(words[0]);
    setBlanks((mod.blanks ?? []).filter((x) => !ids.has(x.id)), `${label} filled in again.`);
  }

  function fillInSelection() {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (blankNote) blankNote.hidden = true;
    const offsets =
      range && !range.collapsed && words?.el.contains(range.commonAncestorContainer) && words.base != null
        ? rangeToOffsets(pageAnchorText(words.el.children), range)
        : null;
    const held = offsets ? null : shownCursorSpan();
    if (!offsets && !held) {
      refuse("Select blanked words in this passage first, then choose “Fill in the selected words.”");
      return;
    }
    sel.removeAllRanges();
    fillIn(...(offsets ? [words.base + offsets[0], words.base + offsets[1]] : held));
  }

  // ---- the word cursor (DK-1) ----
  // A keyboard reader chooses words without a selection: the passage takes
  // focus, the arrows move a cursor by word (Shift extends it), Enter blanks
  // the chosen words. The cursor is two word indexes, kept across redraws.

  let cur = null; // { a: anchor index, b: moving index }
  const CURSOR_HIGHLIGHT = "desk-sheet-cursor";

  const cursorList = () => (view && words?.base != null ? wordSpans(view.chapter.text, view.at.start, view.at.end) : []);

  function cursorSpan(list) {
    if (!cur || !list.length) return null;
    const lo = Math.min(cur.a, cur.b);
    const hi = Math.max(cur.a, cur.b);
    return [list[lo][0], list[hi][1], hi - lo + 1];
  }

  let cursorShown = false; // the cursor's words are lit, so they are what the buttons act on

  function clearCursor() {
    cursorShown = false;
    if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete(CURSOR_HIGHLIGHT);
  }

  /** The words the cursor holds while it is showing, as chapter offsets, else null. */
  function shownCursorSpan() {
    if (!cursorShown) return null;
    const span = cursorSpan(cursorList());
    return span ? [span[0], span[1]] : null;
  }

  function drawCursor(list) {
    clearCursor();
    const span = cursorSpan(list);
    if (!span || typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
    const r = offsetsToRange(pageAnchorText(words.el.children), span[0] - words.base, span[1] - words.base);
    if (!r) return;
    const range = document.createRange();
    range.setStart(r.startContainer, r.startOffset);
    range.setEnd(r.endContainer, r.endOffset);
    CSS.highlights.set(CURSOR_HIGHLIGHT, new Highlight(range));
    cursorShown = true;
    (range.startContainer.parentElement ?? words.el).scrollIntoView?.({ block: "nearest" });
  }

  // Where each word is drawn now, for Up and Down and for the mouse. A word
  // that wraps has several boxes; the first is where it starts.
  function wordBoxes(list) {
    const own = pageAnchorText(words.el.children);
    return list.map(([s, e]) => {
      const r = offsetsToRange(own, s - words.base, e - words.base);
      if (!r) return null;
      const range = document.createRange();
      range.setStart(r.startContainer, r.startOffset);
      range.setEnd(r.endContainer, r.endOffset);
      const box = range.getClientRects()[0] ?? range.getBoundingClientRect();
      return box && (box.width || box.height) ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
    });
  }

  /**
   * The words a mouse selection inside the passage touches, as { lo, hi,
   * backward }, or null. The selection is the browser's own; the cursor is
   * made from it (and a mouse selection is snapped out to whole words) so the
   * mouse and the keyboard carry on from one another.
   */
  function selectedWords(list) {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || range.collapsed || !words.el.contains(range.commonAncestorContainer)) return null;
    const off = rangeToOffsets(pageAnchorText(words.el.children), range);
    const hit = off ? wordsTouching(list, words.base + off[0], words.base + off[1]) : null;
    if (!hit) return null;
    const back = document.createRange();
    try {
      back.setStart(sel.anchorNode, sel.anchorOffset);
      back.setEnd(sel.focusNode, sel.focusOffset);
    } catch {
      return { lo: hit[0], hi: hit[1], backward: false };
    }
    return { lo: hit[0], hi: hit[1], backward: back.collapsed };
  }

  function armWordCursor() {
    const w = words.el;
    w.tabIndex = 0;
    w.dataset.focusKey = "passage-words";
    w.setAttribute("role", "group");
    w.setAttribute("aria-label", "Passage text. Use the arrow keys to move by word or line, Shift to choose more words, and Enter to blank the chosen words, or to fill them in again if they are already blank. With a mouse, click to place the cursor, double-click a word, or drag across words to choose them.");
    let pressing = false; // the mouse is down in the passage: the press decides the cursor
    let goalX = null; // the column an Up or Down run keeps to
    const said = (list) => {
      const [s, en, n] = cursorSpan(list);
      say(`${n > 1 ? `${n} words: ` : ""}“${view.chapter.text.slice(s, en)}”`);
    };
    w.addEventListener("focus", () => {
      if (pressing) return;
      const list = cursorList();
      if (!list.length) return;
      if (!cur || cur.a >= list.length || cur.b >= list.length) cur = { a: 0, b: 0 };
      drawCursor(list);
    });
    w.addEventListener("blur", clearCursor);
    w.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      pressing = true;
      goalX = null;
      document.addEventListener(
        "mouseup",
        (up) => {
          pressing = false;
          const list = cursorList();
          if (!list.length || !w.isConnected) return;
          const chosen = selectedWords(list);
          if (chosen) {
            // A drag or a double-click: whole words, shown as the browser's selection.
            cur = chosen.backward ? { a: chosen.hi, b: chosen.lo } : { a: chosen.lo, b: chosen.hi };
            const span = cursorSpan(list);
            const r = offsetsToRange(pageAnchorText(w.children), span[0] - words.base, span[1] - words.base);
            const sel = window.getSelection();
            if (r && sel) {
              const range = document.createRange();
              range.setStart(r.startContainer, r.startOffset);
              range.setEnd(r.endContainer, r.endOffset);
              sel.removeAllRanges();
              sel.addRange(range);
            }
            clearCursor();
            said(list);
            return;
          }
          // A click: the cursor goes to the word clicked (Shift extends from where it was).
          if (!w.contains(up.target)) return;
          const at = wordAtPoint(wordBoxes(list), up.clientX, up.clientY);
          if (at == null) return;
          const keep = cur && cur.a < list.length && cur.b < list.length ? cur.a : at;
          cur = { a: up.shiftKey ? keep : at, b: at };
          window.getSelection()?.removeAllRanges();
          if (document.activeElement !== w) w.focus({ preventScroll: true });
          drawCursor(list);
          said(list);
        },
        { once: true },
      );
    });
    w.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const list = cursorList();
      if (!list.length) return;
      // The mouse's selection becomes the cursor, so the arrows carry on from it.
      const chosen = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter", " ", "Escape"].includes(e.key) ? selectedWords(list) : null;
      if (chosen) {
        cur = chosen.backward ? { a: chosen.hi, b: chosen.lo } : { a: chosen.lo, b: chosen.hi };
        window.getSelection()?.removeAllRanges();
        drawCursor(list);
      }
      if (!cur) cur = { a: 0, b: 0 };
      const last = list.length - 1;
      let move = null;
      let vertical = false;
      if (e.key === "ArrowRight") move = Math.min(last, cur.b + 1);
      else if (e.key === "ArrowLeft") move = Math.max(0, cur.b - 1);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // By line: the word above or below, in the same column as the run began.
        const boxes = wordBoxes(list);
        const box = boxes[cur.b];
        if (goalX == null && box) goalX = (box.left + box.right) / 2;
        move = wordOnLine(boxes, cur.b, e.key === "ArrowDown" ? 1 : -1, goalX ?? 0);
        vertical = true;
      } else if (e.key === "Home") move = 0;
      else if (e.key === "End") move = last;
      if (!vertical) goalX = null;
      if (move != null) {
        e.preventDefault();
        cur = { a: e.shiftKey ? cur.a : move, b: move };
        drawCursor(list);
        said(list);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const span = cursorSpan(list);
        if (!span) return;
        // Enter on words that are already blank fills them in again.
        const covered = list.slice(Math.min(cur.a, cur.b), Math.max(cur.a, cur.b) + 1).every(([ws, we]) => overlapsBlank(ownBlanks(), ws, we));
        if (covered) fillIn(span[0], span[1]);
        else addBlanks([[span[0], span[1]]]);
      } else if (e.key === "Escape" && cur.a !== cur.b) {
        cur = { a: cur.b, b: cur.b };
        drawCursor(list);
      }
    });
  }

  function drawBlanks() {
    const located = ownBlanks();
    markBlanks(located);
    blanksBox.replaceChildren();
    const head = make("div", "desk-sheet__lit-head");
    head.append(make("span", "desk-sheet__lit-title", "Blanks"));
    if (!readOnly) {
      const pick = button("Blank the selected words");
      pick.dataset.focusKey = "blank-selection";
      pick.title = "Leave the words you’ve selected in this passage blank on the participant’s version";
      // Keep the selection: pressing the button would otherwise clear it first.
      pick.addEventListener("mousedown", (e) => e.preventDefault());
      pick.addEventListener("click", blankSelection);
      head.append(pick, describe(pick, "Leaves the words you’ve selected in this passage blank on the participant’s version."));
      const unpick = button("Fill in the selected words");
      unpick.dataset.focusKey = "fill-in-selection";
      unpick.title = "Show again the blanked words you’ve selected in this passage";
      unpick.addEventListener("mousedown", (e) => e.preventDefault());
      unpick.addEventListener("click", fillInSelection);
      head.append(unpick, describe(unpick, "Shows again the blanked words you’ve selected in this passage, on the participant’s version too."));
    }
    blankNote = make("p", "desk-sheet__empty");
    blankNote.hidden = true;
    blanksBox.append(head, blankNote);

    // The key terms in the passage, one button each: the LIT-only kind of
    // blank, with the traditional word beneath as the hint (S10).
    const byTerm = new Map();
    for (const mk of view.marks) {
      if (!byTerm.has(mk.id)) byTerm.set(mk.id, []);
      byTerm.get(mk.id).push(mk);
    }
    if (byTerm.size && !readOnly) {
      const row = make("div", "desk-sheet__term-blanks");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Blank a key term");
      row.append(make("span", "desk-sheet__hint-label", "Key terms:"));
      for (const [id, marks] of byTerm) {
        const word = view.chapter.text.slice(marks[0].start, marks[0].end);
        const blanked = marks.every((mk) => overlapsBlank(located, mk.start, mk.end));
        // What goes beneath: each use's own traditional word (E85), which is
        // one word for the whole term only where every use renders the same
        // Greek word. A use whose verse leaves that in doubt gets no hint
        // until the leader picks one in the list, and a use whose traditional
        // word is the word itself gets none, since it would be the answer.
        const uses = marks.map((mk) => {
          const term = termForWords(mk.start, mk.end, view.allMarks, view.terms);
          return { word: term?.traditional ?? null, starts: startingHint(view.chapter.text.slice(mk.start, mk.end), term) };
        });
        const many = marks.length > 1;
        const unsure = uses.filter((u) => !u.word).length;
        const same = uses.filter((u) => u.word && u.starts === "none").length;
        const hinted = uses.filter((u) => u.starts === "traditional").map((u) => u.word);
        const one = hinted.length === marks.length && new Set(hinted).size === 1 ? hinted[0] : null;
        const times = many ? ` (${marks.length} times)` : "";
        const chip = button(word, "desk-sheet__chip");
        chip.dataset.focusKey = `term-${id}`;
        chip.setAttribute("aria-pressed", String(blanked));
        if (blanked) chip.title = `Fill in “${word}” again`;
        else if (one) chip.title = `Blank “${word}”${times} with “${traditionalHint(one)}” beneath`;
        else if (unsure === marks.length) chip.title = `Blank “${word}”${times} and choose ${many ? "their hints" : "its hint"} in the list below`;
        else if (same === marks.length) chip.title = `Blank “${word}”${times} with no hint, since the traditional word is the same`;
        else chip.title = `Blank “${word}”${times}, each with its own traditional word beneath where it has one to show`;
        const chipHint = describe(chip, `${chip.title}.`);
        chip.addEventListener("click", () => {
          if (blanked) {
            const keep = located.filter((b) => !marks.some((mk) => b.start != null && b.start < mk.end && mk.start < b.end));
            setBlanks(keep.map((b) => b.blank), `“${word}” filled in again.`);
          } else {
            const which = !many ? "it" : unsure === marks.length ? "them" : unsure === 1 ? "one of them" : `${unsure} of them`;
            const choose = unsure ? ` Choose a hint for ${which} in the list below.` : "";
            const plain = !unsure && same === marks.length ? " No hint beneath, since the traditional word is the same." : "";
            addBlanks(marks.map((mk) => [mk.start, mk.end]), `“${word}” blanked${many ? ` ${marks.length} times` : ""}.${choose}${plain}`);
          }
        });
        row.append(chip, chipHint);
      }
      blanksBox.append(row);
    }

    if (!located.length) {
      blanksBox.append(make("p", "desk-sheet__empty", readOnly ? "No blanks." : "No blanks yet. Select words in the passage, then choose “Blank the selected words.” (To show blanked words again, select them and choose “Fill in the selected words.”) A blank leaves those words out of the participant’s version and shows them on the leader’s."));
      return;
    }
    const ul = make("ul", "desk-sheet__blank-list");
    // One row for each key term's blanks that share a traditional word, one for
    // each other blank, in order of first occurrence in the passage (SH5-9, E85).
    for (const group of groupBlanks(located, view.allMarks, view.terms)) ul.append(blankRow(group, located));
    blanksBox.append(ul);
  }

  /**
   * One row of the list: a glossary term's blanks that render one traditional
   * word together, or a single blank (words chosen by hand, one that no longer
   * prints, one whose words changed). Every change a row makes is made to each
   * of its blanks.
   */
  function blankRow(group, located) {
    const { blanks: members } = group;
    const first = members[0];
    const ids = new Set(members.map((m) => m.blank.id));
    const li = make("li", "desk-sheet__blank");
    const wordsOf = (m) => (m.prints ? view.chapter.text.slice(m.start, m.end) : m.blank.exact);
    // The words as printed, each form once ("deviation" and "Deviation" are one).
    const seen = new Set();
    const forms = members.map(wordsOf).filter((w) => !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
    const words = forms.join(" / ");
    const ref = make("span", "desk-sheet__blank-words", quoted(words));
    li.append(ref);
    li.append(make("span", "desk-sheet__blank-verse", members.length > 1 ? `${members.length} times, ${verseLabel(group.verses)}` : verseLabel(group.verses)));
    // A term's row is named by its key, since a term can have a row for each
    // traditional word its blanks render (E85).
    const suffix = group.termId ? group.key : first.blank.id;
    const blank = first.blank;
    // The traditional word is the one for the Greek word these blanks render
    // (E85). Where their verse holds more than one word of the term's family,
    // nothing says which it is, so each is offered and the one picked is kept
    // as the leader's own hint: the record has nowhere else to say which.
    const PICK = "word:";
    const picks = group.termId && !group.traditional ? group.choices : [];
    const picked = group.termId ? pickedChoice({ hint: group.hint, hintText: group.hintText }, group) : null;
    if (!readOnly) {
      const select = make("select", "desk-sheet__hint");
      select.dataset.focusKey = `hint-${suffix}`;
      select.setAttribute("aria-label", `Hint beneath ${quoted(words)}`);
      const opt = (value, label) => {
        const o = make("option", null, label);
        o.value = value;
        select.append(o);
      };
      opt("none", "No hint");
      if (group.traditional) opt("traditional", traditionalHint(group.traditional));
      else if (!group.termId && group.hint === "traditional") opt("traditional", "The traditional word");
      for (const word of picks) opt(`${PICK}${word}`, traditionalHint(word));
      opt("custom", "My own hint…");
      if (group.hint === "mixed") {
        opt("mixed", "Different hints");
        select.lastChild.disabled = true;
      }
      // A traditional hint on blanks that have a choice to make prints nothing.
      if (picked) select.value = `${PICK}${picked}`;
      else select.value = group.hint === "traditional" && picks.length ? "none" : group.hint;
      li.append(select);
      const custom = make("input", "desk-sheet__hint-text");
      custom.type = "text";
      custom.maxLength = 100;
      custom.value = group.hintText;
      custom.placeholder = "A hint to print beneath";
      custom.dataset.focusKey = `hint-text-${suffix}`;
      custom.setAttribute("aria-label", `Your hint beneath ${quoted(words)}`);
      custom.hidden = group.hint !== "custom" || !!picked;
      li.append(custom);
      // The same hint goes to every blank in the row.
      const save = (fields) => {
        const blanks = (mod.blanks ?? []).map((x) => {
          if (!ids.has(x.id)) return x;
          const next = { ...x, ...fields };
          if (next.hint !== "custom") delete next.hintText;
          return next;
        });
        setBlanks(blanks);
      };
      select.addEventListener("change", () => {
        if (select.value.startsWith(PICK)) {
          save({ hint: "custom", hintText: traditionalHint(select.value.slice(PICK.length)) });
          return;
        }
        if (select.value === "custom") {
          custom.hidden = false;
          // Start from the traditional word, selected: it is a dictionary form
          // and the usual word, so "believe" may want to be "believed", or
          // another word where this verse is traditionally read differently.
          if (!custom.value.trim() && group.traditional) custom.value = traditionalHint(group.traditional);
          custom.focus();
          custom.select();
          // A word picked from the menu is this text already: saving it again
          // would only redraw the row with the menu back on that word and the
          // field hidden, so the field waits for the leader to change it.
          const text = custom.value.trim();
          if (text && !(group.hint === "custom" && text === group.hintText)) save({ hint: "custom", hintText: text });
          return;
        }
        save({ hint: select.value });
      });
      custom.addEventListener("change", () => {
        const text = custom.value.trim();
        if (text) save({ hint: "custom", hintText: text });
        else if (group.hint === "custom") save({ hint: "none" });
      });
      const remove = button("×", "desk-sheet__icon");
      remove.dataset.focusKey = `remove-${suffix}`;
      remove.title = "Fill in again";
      remove.setAttribute("aria-label", members.length > 1 ? `Fill in ${quoted(words)} again, all ${members.length} times` : `Fill in ${quoted(words)} again`);
      remove.addEventListener("click", () => {
        // A row fills in all of its blanks. A blank of a term kept apart from the
        // term's row (its words changed) can leave others blank, and the
        // sentence says how many (SH5-17).
        const termId = group.termId ?? (first.prints ? termForWords(first.start, first.end, view.allMarks, view.terms)?.id : null) ?? null;
        const left = termBlanksLeft(located, view.allMarks, view.terms, termId, ids);
        setBlanks(
          (mod.blanks ?? []).filter((x) => !ids.has(x.id)),
          `${quoted(words)} filled in again${left ? `; ${left} still blank.` : "."}`,
        );
      });
      li.append(remove);
    } else {
      const shown = [...new Set(members.map((m) => blankHint(m.blank, m, view.allMarks, view.terms)).filter(Boolean))];
      if (shown.length) li.append(make("span", "desk-sheet__hint-label", shown.join(", ")));
    }
    if (!first.prints) {
      li.append(make("p", "desk-sheet__problem", "These words can no longer be found in the passage, so this blank won’t print."));
    } else if (!readOnly && picks.length && group.hint === "traditional") {
      // The blank asks for the traditional word and its verse can't say which
      // that is (a sheet made before E85, or a verse revised since): say why
      // nothing prints, rather than drop the hint in silence.
      li.append(make("p", "desk-sheet__problem", "This verse has more than one Greek word of this key term, so no hint prints here until you choose its traditional word from the menu."));
    } else if (first.status === "changed") {
      li.append(make("p", "desk-sheet__problem", `The blanked words have changed since you chose them (they were ${quoted(blank.exact)}), so this blank covers the closest match.`));
    }
    return li;
  }

  // ---- which footnotes print ----

  let notesSeq = 0; // two overlapping calls must not finish out of order (GF8b-9)
  async function drawNotes() {
    const n = seq;
    const mine = ++notesSeq;
    const inputs = notesInputs();
    const blanks = await sheetPrintingBlanks(getSheet());
    if (gone || n !== seq || mine !== notesSeq || !view) return;
    notesDrawn = inputs;
    const focusKey = notesBox.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
    const rows = footnoteRows(view.list, view.footnoteIds, mod.footnotes, blanks);
    const printing = rows.filter((r) => r.print).length;
    const flagged = rows.filter((r) => r.givesAway.length && !r.decided).length;
    notesBox.replaceChildren();
    const summary = make("summary", "desk-sheet__notes-summary");
    summary.append(make("span", null, rows.length ? `Footnotes: ${printing} of ${rows.length} print` : "Footnotes: none in these verses"));
    if (flagged) summary.append(document.createTextNode(" · "), make("span", "desk-sheet__flag", `${plural(flagged, "footnote")} would give a blank away`));
    summary.dataset.focusKey = "notes-summary";
    notesBox.append(summary);
    if (!rows.length) {
      restoreFocus(notesBox, focusKey, "notes-summary");
      return;
    }
    if (!readOnly) {
      const bar = make("div", "desk-sheet__notes-bar");
      const all = button("Select all");
      all.dataset.focusKey = "notes-all";
      const none = button("Clear all");
      none.dataset.focusKey = "notes-none";
      const ids = rows.map((r) => r.id);
      all.addEventListener("click", () => update({ footnotes: setFootnoteChoices(mod.footnotes, view.list, ids, true) }, "Every footnote in the passage will print."));
      none.addEventListener("click", () => update({ footnotes: setFootnoteChoices(mod.footnotes, view.list, ids, false) }, "No footnote in the passage will print."));
      bar.append(all, none);
      notesBox.append(bar);
    }
    const ul = make("ul", "desk-sheet__note-list");
    for (const r of rows) {
      const li = make("li", "desk-sheet__note");
      const label = make("label", "desk-sheet__note-choice");
      const box = make("input");
      box.type = "checkbox";
      box.checked = r.print;
      box.disabled = readOnly;
      box.dataset.focusKey = `note-${r.id}`;
      const letter = view.labels.get(r.id) ?? "";
      box.addEventListener("change", () => {
        update(
          { footnotes: setFootnoteChoices(mod.footnotes, view.list, [r.id], box.checked) },
          `${letter ? `Note ${letter}` : "This footnote"} ${box.checked ? "will print" : "won’t print"}.`,
        );
      });
      const text = make("span", "desk-sheet__note-text");
      text.append(make("span", "desk-sheet__note-label", `${letter ? `Note ${letter}` : "Note"}, v. ${r.verse}`), document.createTextNode(` ${r.text}`));
      label.append(box, text);
      li.append(label);
      if (r.givesAway.length) {
        // A blank whose hint doesn't show its traditional word is given away by
        // a note naming that word too (SH5-16), so the word is named with it:
        // the blank's own, or its key term's where that is the one the note
        // names (“trusted” by a note that says only “faith,” E85).
        const named = (b) => {
          const flag = flaggedWord(r.text, b);
          if (!flag) return quoted(b.exact);
          const blank = `${quoted(b.exact).slice(0, -1)},”`;
          return flag.entry ? `${blank} whose key term is traditionally ${quoted(flag.word)}` : `${blank} traditionally ${quoted(flag.word)}`;
        };
        const words = [...new Set(r.givesAway.map(named))];
        // A comma between two items goes inside the first one's closing quote.
        const which = words.map((w, i) => (i < words.length - 1 ? (w.endsWith("”") ? `${w.slice(0, -1)},”` : `${w},`) : w)).join(" ");
        const a = words.length > 1 ? "blanks" : "a blank";
        li.append(make("p", "desk-sheet__flag", r.decided
          ? `Mentions ${a} (${which}).`
          : `Gives away ${a} (${which}), so it’s left out until you decide.`));
      }
      ul.append(li);
    }
    notesBox.append(ul);
    restoreFocus(notesBox, focusKey, "notes-summary");
  }

  // A hint being typed isn't redrawn under the reader: the change waits
  // until they leave the field.
  const typing = () => el.contains(document.activeElement) && document.activeElement?.matches("input[type=text]");
  let pending = false;
  el.addEventListener("focusout", () => {
    setTimeout(() => {
      if (pending && !typing() && !gone) {
        pending = false;
        render();
      }
    });
  });

  render();
  return {
    el,
    update(next) {
      mod = next;
      if (typing()) pending = true;
      else render();
    },
    sheetChanged() {
      if (view && notesBox && !typing() && notesInputs() !== notesDrawn) drawNotes();
    },
    hasFocus: typing,
    destroy() {
      gone = true;
      blankRanges.delete(el);
      drawBlankHighlight();
      if (el.contains(document.activeElement)) clearCursor();
    },
  };
}

/* ── The key terms box ───────────────────────────────────────────────── */

/** The sheet's passages that print on every copy, read, in order. */
async function readPassages(sheet, { leader = true } = {}) {
  const out = [];
  for (const m of sheet?.modules ?? []) {
    if (m?.type !== "passage" || (!leader && m.leaderOnly)) continue;
    out.push({ m, view: await readPassage(m) });
  }
  return out;
}

/**
 * The key terms box's card: every glossary term in the sheet's passages, with
 * its traditional word and the Greek (S3), worked out live. The leader can
 * leave a term out, which is all the module stores (`omit`).
 *
 * @param {{ m: object, readOnly: boolean, getSheet: () => object,
 *   update: (fields: object, announce?: string) => Promise<boolean> }} opts
 */
export function createKeyTermsBody({ m, readOnly, getSheet, update }) {
  const el = make("div", "desk-sheet__terms");
  el.append(make("p", "desk-sheet__status", "Gathering the key terms…"));
  let mod = m;
  let gone = false;
  let seq = 0;
  let lastKey = "";

  async function render() {
    const n = ++seq;
    const passages = (await readPassages(getSheet())).filter((p) => p.view.ok);
    if (gone || n !== seq) return;
    const terms = collectKeyTerms(
      passages.map(({ view }) => ({ chapter: view.chapter, marks: view.marks, terms: view.terms })),
      mod.omit ?? [],
    );
    const focusKey = el.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
    el.replaceChildren();
    if (!terms.length) {
      const none = make("p", "desk-sheet__empty", "None of the sheet’s passages uses a key term yet. As you add passages, their key terms are listed here for you.");
      none.tabIndex = -1;
      none.dataset.focusKey = "terms-note";
      el.append(none);
      restoreFocus(el, focusKey, "terms-note");
      return;
    }
    const note = make("p", "desk-sheet__lit-note", readOnly
      ? "Filled in from the sheet’s passages."
      : "Filled in from the sheet’s passages: the LIT’s word, the traditional one, and the Greek. Clear the box beside a term to leave it out.");
    note.tabIndex = -1;
    note.dataset.focusKey = "terms-note";
    el.append(note);
    const ul = make("ul", "desk-sheet__term-list");
    for (const t of terms) {
      const li = make("li", "desk-sheet__term");
      const label = make("label", "desk-sheet__term-choice");
      const box = make("input");
      box.type = "checkbox";
      box.checked = !t.omitted;
      box.disabled = readOnly;
      box.dataset.focusKey = `omit-${t.id}`;
      box.addEventListener("change", () => {
        const omit = new Set(mod.omit ?? []);
        if (box.checked) omit.delete(t.id);
        else omit.add(t.id);
        update({ omit: [...omit] }, `${t.renderings[0]} ${box.checked ? "is in" : "is left out of"} the key terms box.`);
      });
      const line = make("span", "desk-sheet__term-line");
      line.append(make("strong", null, t.renderings.join(" / ")));
      if (t.traditional) line.append(document.createTextNode(`, traditionally ${t.traditional}`));
      if (t.greek) {
        line.append(document.createTextNode(", "));
        line.append(make("em", null, t.greek));
      }
      label.append(box, line);
      const link = make("a", "desk-sheet__term-link", "Glossary");
      link.href = `${BASE}glossary/#${t.id}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.setAttribute("aria-label", `${t.title || t.renderings[0]} in the glossary (opens in a new tab)`);
      li.append(label, link);
      if (t.omitted) li.classList.add("is-omitted");
      ul.append(li);
    }
    el.append(ul);
    restoreFocus(el, focusKey, "terms-note");
  }

  const passagesKey = () =>
    JSON.stringify((getSheet()?.modules ?? []).filter((x) => x?.type === "passage").map((x) => [x.bookKey, x.chapter, x.verse, x.endVerse, x.quote?.exact]));

  lastKey = passagesKey();
  render();
  return {
    el,
    update(next) {
      mod = next;
      render();
    },
    sheetChanged() {
      const key = passagesKey();
      if (key === lastKey) return;
      lastKey = key;
      render();
    },
    destroy() {
      gone = true;
    },
  };
}

/** The key terms box's lines as they would print, for counting. */
async function keyTermWords(sheet) {
  const box = sheet.modules.find((x) => x?.type === "keyTerms");
  if (!box || box.leaderOnly) return 0;
  const passages = (await readPassages(sheet, { leader: false })).filter((p) => p.view.ok);
  const terms = collectKeyTerms(
    passages.map(({ view }) => ({ chapter: view.chapter, marks: view.marks, terms: view.terms })),
    box.omit ?? [],
  ).filter((t) => !t.omitted);
  return terms.reduce((n, t) => n + countWords(keyTermLine(t)), 0);
}

/* ── The license card ────────────────────────────────────────────────── */

/**
 * What the copy everyone gets would hold, counted for the commercial check:
 * the LIT's words (passages less their blanks, the footnotes that print, and
 * the key terms box) against the reader's own (title, subtitle, text and
 * questions). Parts marked Leader only, and answers, are left out.
 */
async function commercialCounts(sheet) {
  let lit = 0;
  let own = countWords(sheet.title) + countWords(sheet.subtitle);
  let blanks = 0;
  let notesOff = 0;
  const passages = [];
  const printed = [];
  const read = await readPassages(sheet, { leader: false });
  const allBlanks = [];
  for (const { m, view } of read) {
    if (!view.ok) continue;
    for (const b of locateBlanks(view, m)) if (b.prints) allBlanks.push(blankWords(b, view.chapter.text, view.allMarks, view.terms));
  }
  for (const { m, view } of read) {
    passages.push(m);
    if (!view.ok) continue;
    lit += countWords(view.chapter.text.slice(view.at.start, view.at.end));
    for (const b of locateBlanks(view, m)) {
      if (!b.prints) continue;
      blanks += 1;
      lit -= countWords(view.chapter.text.slice(b.start, b.end));
    }
    for (const r of footnoteRows(view.list, view.footnoteIds, m.footnotes, allBlanks)) {
      if (r.print) lit += countWords(r.text);
      else notesOff += 1;
    }
    printed.push(m);
  }
  lit += await keyTermWords(sheet);
  for (const x of sheet.modules) {
    if (x?.leaderOnly) continue;
    if (x?.type === "text" || x?.type === "question") own += countWords(htmlToText(x.html));
  }
  // A book can only be quoted whole if every chapter is on the sheet; read
  // those chapters' verse numbers to be sure.
  const verses = new Map();
  for (const book of booksToCheck(passages)) {
    for (let c = 1; c <= BOOKS[book]; c++) {
      try {
        const source = await loadChapterPage(book, c);
        verses.set(`${book} ${c}`, source.draft ? null : source.verses);
      } catch (_) {
        verses.set(`${book} ${c}`, null);
      }
    }
  }
  const whole = completeBooks(passages, (b, c) => verses.get(`${b} ${c}`) ?? null);
  return { ...commercialShare(lit, own), blanks, notesOff, whole };
}

/**
 * The license card (S7): the credit line every copy carries and a link to the
 * terms, and a box, "This is for a commercial project", that turns on the
 * commercial-quotation check. An ordinary sheet shows no limits at all.
 *
 * @param {{ getSheet: () => object, readOnly: boolean,
 *   setCommercial: (on: boolean) => Promise<boolean> }} opts
 */
export function createLicenseCard({ getSheet, readOnly, setCommercial, idPrefix }) {
  const el = make("section", "desk-sheet__license");
  el.setAttribute("aria-labelledby", `${idPrefix}-license`);
  const h = make("h4", "desk-sheet__license-title", "License");
  h.id = `${idPrefix}-license`;
  const credit = make("p", "desk-sheet__lit-note");
  credit.append(
    document.createTextNode("A printed or copied sheet carries the LIT’s notice, keeps each footnote that prints with its verse, and links to the terms: "),
    make("q", "desk-sheet__credit", LIT_CREDIT_LINE),
    document.createTextNode(" "),
  );
  const terms = make("a", null, "Read the license terms");
  terms.href = `${BASE}read/#license-terms`;
  terms.target = "_blank";
  terms.rel = "noopener";
  terms.setAttribute("aria-label", "Read the license terms (opens in a new tab)");
  credit.append(terms, document.createTextNode("."));

  const label = make("label", "desk-sheet__commercial");
  const box = make("input");
  box.type = "checkbox";
  box.disabled = readOnly;
  label.append(box, make("span", null, "This is for a commercial project"));
  const check = make("div", "desk-sheet__check");
  check.setAttribute("aria-live", "polite");
  el.append(h, credit, label, check);

  box.addEventListener("change", () => { setCommercial(box.checked); });

  let seq = 0;
  let lastKey = "";
  // The counts last drawn. The check is a live region, so it is rebuilt only when the
  // result differs: every autosave changes the modules, but rarely the numbers (GF8b-1).
  let drawnResult = "";
  async function render() {
    const sheet = getSheet();
    if (!sheet) return;
    box.checked = sheet.commercial === true;
    if (!box.checked) {
      ++seq; // a count still running must not draw under the unticked box (GF8b-2)
      check.replaceChildren();
      lastKey = "";
      drawnResult = "";
      return;
    }
    const key = JSON.stringify([sheet.title, sheet.subtitle, sheet.modules]);
    if (key === lastKey) return;
    lastKey = key;
    const n = ++seq;
    if (!check.childElementCount) check.append(make("p", "desk-sheet__status", "Checking the sheet against the commercial terms…"));
    const c = await commercialCounts(sheet);
    if (n !== seq) return;
    const result = JSON.stringify(c);
    if (result === drawnResult && check.querySelector("ul")) return;
    drawnResult = result;
    check.replaceChildren();
    const list = make("ul", "desk-sheet__check-list");
    const item = (text, bad) => {
      const li = make("li", bad ? "is-over" : "is-ok", text);
      list.append(li);
    };
    if (c.share == null) {
      item("Nothing on the sheet to count yet.", false);
    } else {
      let pct = Math.round(c.share * 100);
      // 50.4% is over the limit but rounds to "50%": show a tenth so the red has a reason (GF8b-13).
      if (c.over && pct <= 50) pct = Math.ceil(c.share * 1000) / 10;
      item(
        `LIT material: ${c.lit.toLocaleString("en-US")} of ${plural(c.total, "word")} (${pct}%). ` +
          (c.over ? "The commercial terms allow at most 50%." : "That’s within the 50% the commercial terms allow."),
        c.over,
      );
      const meter = make("div", "desk-sheet__meter");
      meter.setAttribute("aria-hidden", "true");
      const fill = make("span", c.over ? "is-over" : null);
      fill.style.width = `${Math.min(100, pct)}%`;
      meter.append(fill);
      list.lastChild.append(meter);
    }
    for (const book of c.whole) {
      item(`These passages quote all of ${bookKeyToLabel(book)}. The commercial terms don’t cover a complete book of the Bible.`, true);
    }
    if (c.notesOff) {
      item(`${plural(c.notesOff, "footnote")} in these passages ${c.notesOff === 1 ? "is" : "are"} set not to print. The commercial terms ask that footnotes be kept with the verses they reference.`, true);
    }
    if (c.blanks) {
      item(`This sheet leaves ${plural(c.blanks, "blank")}. The commercial terms ask that the text be quoted as written; blanks are part of the noncommercial terms.`, true);
    }
    check.append(list);
    const foot = make("p", "desk-sheet__lit-note");
    foot.append(document.createTextNode("These counts are for the version everyone gets: parts marked Leader only, and answers, are left out. Anything beyond these terms needs written permission; "));
    const contact = make("a", null, "contact the LIT");
    contact.href = `${BASE}contact/`;
    contact.target = "_blank";
    contact.rel = "noopener";
    foot.append(contact, document.createTextNode(" about your project."));
    check.append(foot);
  }

  render();
  return {
    el,
    sheetChanged: render,
  };
}
