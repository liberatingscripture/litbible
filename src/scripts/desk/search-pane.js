// src/scripts/desk/search-pane.js
//
// The Search pane on /desk (STUDY-DESK.md, "Order of work", 3m): the site's
// search in a pane, with results that move the LIT pane instead of leaving the
// page. It is a third UI beside searchbar.js (the tray) and search.js
// (/search), and like them it calls search-core.js for everything that must
// agree (reference parsing, the verse-index scanner, Pagefind queries,
// bucketing, the Greek) and never copies it. The pure rules (where a result
// goes, the book menu, the minimum query) are src/lib/desk-search-pane.mjs.
// Reached only from desk-panes.js, so a reader without the preview downloads
// none of it.
//
// BVJ's answers (2026-11-01):
// - **It stands alone.** The book menu offers "The book I’m reading (John)";
//   choosing it fixes the filter to that book, which stays when the LIT pane
//   moves, so the list holds still.
// - **A glossary result opens in the pane** (the entry cloned from /glossary/,
//   fetched once a visit) with "Back to results" and "Open in the glossary";
//   an article opens in a new tab, and an introduction in a Book Intro pane
//   (E53, 2026-11-06; `env.showIntro`). A verse or topic result
//   moves the LIT pane (`env.showPassage`) with a plain click, and is a real
//   link otherwise, so a modified or middle click opens a tab and
//   ref-preview.js previews it on hover.
// - **Both ways to read a passage** (E34; BVJ, 2026-11-05): the plain click
//   moves the leading LIT pane, or opens one beside this pane when there is
//   none (or takes another pane's place, E127), and the note line says which
//   (`passageMoveMessage`; the undo bar and the notice say the rest); a small link
//   beside the result opens its page in a new tab (`awayLink`). The first move
//   of a visit also says where the LIT pane's way back is, “← John 3:16” on its
//   bar (E168; `env.backPlace`).
// - **Results can go on a sheet** (E117; BVJ, 2026-11-12, option A): every
//   verse has a box, and a strip under the group's title holds the box that
//   checks them all, a count line and the buttons: "New sheet of 3 verses"
//   (shown in a Sheets pane by E127's rule) and, while a Sheets pane shows a
//   sheet, "Add 3 verses to “…”" before it, the primary. Nothing checked adds
//   nothing: the buttons stay focusable, aria-disabled, described by the
//   line. A + on each verse adds that one. The same rules and one transaction
//   as /search's (desk-sheet-gather.mjs, search-sheet.js), in the same words.
//   The chapters by topic, each going whole, and the Greek's verses have the
//   same boxes, strip and + (E166; BVJ, 2026-11-19: "full parity with the
//   search page"), each group its own checks (`PICKS`). A Greek verse
//   matched twice has two rows and one check, since the verse is what goes.
//   "Choose a sheet…" opens the pick window of every sheet, as /search's
//   chooser lists them (E167).
// - **The Greek** (rules 15 and 17 of the desk's CLAUDE.md; only while
//   greekSearchEnabled()): one query never gets both English and Greek. It is
//   searchGreekAuto, said back as the Greek tab says it, with the credit under
//   every Greek group (a license requirement). A Greek result opens its word
//   in a Greek pane and moves the LIT pane there (`env.openGreekHit`). Its
//   row is /search's card in short (E167): the parsing, then a line of the
//   Greek around the word; its reference, drawn as a scripture link, previews
//   the LIT verse.
//
// Nothing about a search is stored: it lives in this closure, and a reload
// empties the pane. Several panes may be open, each with its own search.

import { canEdit } from "../../lib/desk-records.mjs";
import { makeInert } from "../../lib/desk-inert.mjs";
import { planSave } from "../../lib/desk-store-core.mjs";
import {
  MIN_QUERY_LEN,
  PAGE,
  READING,
  BIBLE_ORDER,
  CHOOSE_SHEET,
  addCheckedLabel,
  addChapterLabel,
  addVerseLabel,
  newSheetLabel,
  bookFilterFor,
  bookOptions,
  longEnoughQuery,
  nextPage,
  pageLinkLabel,
  pageLinkText,
  passageMoveMessage,
  introMoveMessage,
  noWayLinkLabel,
  noWayMessage,
  replacedMessage,
  resultTarget,
  verseRef,
} from "../../lib/desk-search-pane.mjs";
import { parsePassage, passageLabel } from "../../lib/desk-passage.mjs";
import { addableSheets, planAddPassages } from "../../lib/desk-sheet-add.mjs";
import {
  checkAllLabel,
  checkedLine,
  checkedSaid,
  commonLabel,
  gatherMessage,
  includeLabel,
  passagesFromChapters,
  passagesFromVerses,
  roomOnSheet,
  searchSheetTitle,
} from "../../lib/desk-sheet-gather.mjs";
import { verseCount } from "../../data/verse-counts.js";
import { sheetName } from "../../lib/desk-sheet-passages.mjs";
import { NOTEBOOK_GROUP_TITLE } from "../../lib/desk-search.mjs";
import { createSheet, makeModule } from "../../lib/desk-sheets.mjs";
import { creditHtml } from "../../lib/greek-credits.mjs";
import {
  MODE_LABELS,
  addGreekMode,
  greekOfferFor,
  greekOfferLine,
  bookKeyToLabel,
  bucketSearchResults,
  buildPfQuery,
  enrichSearchResult,
  escapeHtml,
  formatReferenceLabel,
  glossaryTermFromResult,
  highlightVerseHit,
  isGreekQuery,
  greekSearchEnabled,
  loadDeskSearch,
  loadGreekSearch,
  loadPagefind,
  loadTopicsIndex,
  loadVerseIndex,
  VERSES_FAILED,
  makeStudyBookHref,
  makeStudyReferenceHref,
  normalizePhrase,
  notePickedMode,
  parseBookOnly,
  parseReference,
  pickAnchorHref,
  pickedMode,
  rankVerseHits,
  scriptureResultTitle,
  searchVerses,
  showModeFor,
  topicMatches,
  topicsIndexSubjectItem,
  verseHitHref,
  verseHitLabel,
  parseReferenceJump,
} from "../search-core.js";
import { addTarget, onAddTarget } from "./sheets/sheet-pane.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";
import { buttons, make } from "./dom.js";
import { OPEN_PAGE_ICON } from "./glyphs.js";
import { dateWords, plural } from "./desk-text.js";
import { openPickWindow } from "./pick-window.js";
import { setTip } from "../tip.js";

const button = buttons("desk-search__btn");

/** Bible order's glyph: an arrow down beside lines growing shorter. */
const SORT_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 4v16M3 16l4 4 4-4M14 6h7M14 12h5M14 18h3"/></svg>';

/** A verse hit's key among the checked ones, as desk-sheet-gather.mjs keys a verse. */
const hitKey = (hit) => `${hit.bookKey} ${hit.chapter}:${hit.verse}`;
/** A chapter's key among the checked ones. */
const chapterKey = (c) => `${c.bookKey} ${c.chapter}`;

// The groups whose results can be checked and go on a sheet, as /search's
// (KINDS in sheets/search-sheet.js): the verses (E117), the chapters by topic,
// each going whole, and the Greek's verses (E166). Each keeps its own checks
// and has its own strip; a new group joins this table.
const PICKS = {
  keyword: { noun: "verse", key: hitKey },
  subject: { noun: "chapter", key: chapterKey, whole: true },
  greek: { noun: "verse", key: hitKey },
};
const PICK_KINDS = Object.keys(PICKS);

/** `list` with one of each by `key`, in order: a Greek verse can hold several matches. */
function onceEach(list, key) {
  const seen = new Set();
  return list.filter((r) => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A Greek hit as the sheet rules take a verse. */
const greekRef = (hit) => ({ bookKey: hit.book, chapter: hit.chapter, verse: hit.verse });

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

// The Greek search itself, loaded by the pane's first Greek query, and the
// commands window, loaded when it is asked for (LG-6). Whatever draws a Greek
// result runs after that search, so `gk` is set by then.
let gk = null;
const withGreek = async () => (gk ||= await loadGreekSearch());
let commands = null;
const withCommands = () => import("../greek-commands.js").then((m) => (commands = m));
const DEBOUNCE = 120; // as the tray
const CHOICES = 10; // Greek words offered at a time
const GREEK_AROUND = 3; // words of a Greek row's verse kept either side of the word (E167)

const STATUS_SEP = " • ";

/** `decodeURIComponent` that leaves a malformed escape as it is, so one bad link can't stop an entry drawing. */
function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

/** Open a link in a new tab, as every link that leaves /desk does. */
function awayTab(a) {
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

/** A click that asks for the link's own behavior: a new tab, a window, a download. */
const modified = (e) => e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/* ── The glossary, fetched once a visit ──────────────────────────────── */

let glossaryPromise = null;

/** Map(entry id → its <article> on /glossary/). A failed fetch is forgotten, so Try again asks again. */
function loadGlossary() {
  glossaryPromise ||= fetch(`${BASE}glossary/`, { credentials: "same-origin" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((html) => {
      const page = new DOMParser().parseFromString(html, "text/html");
      const entries = new Map();
      for (const a of page.querySelectorAll("article.entry[data-entry]")) entries.set(a.getAttribute("data-entry"), a);
      if (!entries.size) throw new Error("no entries");
      return entries;
    });
  glossaryPromise.catch(() => {
    glossaryPromise = null;
  });
  return glossaryPromise;
}

/* ── The pane ─────────────────────────────────────────────────────────── */

// Whether a note line has said where the LIT pane's “←” is (E168): once a
// visit, in whichever Search pane moves the LIT pane first.
let backTold = false;

/**
 * @param {{ paneId: string, env: object, getPlace: () => { bookKey: string } }} options
 *   `env` is desk-page.js's: `store`, `ctx`, `showPassage(passage, { beside })`,
 *   `showSheet(id)`, `showIntro(bookKey, { beside })`, `openGreekHit(hit, paneId)` and
 *   `backPlace()`, where the leading LIT pane's “←” goes (E168). `getPlace` is the passage
 *   being read, for "The book I’m reading". `sheets` is where the add
 *   buttons add: the open Sheets panes (`sheet-pane.js`) unless a test hands
 *   in its own `{ addTarget, onAddTarget }`.
 * @returns {{ el: HTMLElement, focusField: () => void, destroy: () => void }}
 */
export function createSearchPane({ paneId, env, getPlace, sheets = { addTarget, onAddTarget } }) {
  const sfx = `-${paneId}`;
  const store = env.store ?? null;
  const el = make("div", "desk-search");

  // ---- the parts ----

  const form = make("form", "desk-search__form");
  form.setAttribute("role", "search");
  form.setAttribute("aria-label", "Search the LIT");
  form.noValidate = true;
  const input = make("input", "desk-search__input");
  input.type = "search";
  input.id = `deskSearchField${sfx}`;
  input.name = "q";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Search the LIT");
  form.append(input);

  const tools = make("div", "desk-search__tools");
  const typeSel = make("select", "desk-search__select");
  typeSel.id = `deskSearchType${sfx}`;
  typeSel.setAttribute("aria-label", "Kind of result");
  for (const [value, label] of [
    ["all", "All results"],
    ["subject", MODE_LABELS.subject],
    ["keyword", MODE_LABELS.keyword],
    ["glossary", MODE_LABELS.glossary],
    ["article", MODE_LABELS.article],
    ["intro", MODE_LABELS.intro],
  ]) {
    const o = make("option", null, label);
    o.value = value;
    typeSel.append(o);
  }
  addGreekMode(typeSel); // only while the Greek is searched at all
  const bookSel = make("select", "desk-search__select");
  bookSel.id = `deskSearchBook${sfx}`;
  bookSel.setAttribute("aria-label", "Book");
  const reading = () => getPlace()?.bookKey ?? null;
  for (const o of bookOptions(reading())) {
    const opt = make("option", null, o.label);
    opt.value = o.value;
    bookSel.append(opt);
  }
  tools.append(bookSel, typeSel); // the order /search has them in (BVJ, 2026-11-04)

  // One polite region for the pane, always in the tree, so a screen reader
  // hears its text change (DK-2). The visible status and note carry the same
  // words for the eye and are not live themselves.
  const live = make("p", "sr-only");
  live.setAttribute("role", "status");
  const status = make("p", "desk-search__status");
  const note = make("p", "desk-search__note");
  note.hidden = true;
  // A single Latin word that is also a Greek one ("pistis"): one line offering
  // the Greek search (BVJ, 2026-11-04). Not live, and it lists no Greek.
  const offerBox = make("p", "desk-search__note");
  offerBox.hidden = true;
  // The pane shows less than /search does (no pager, no counts), so the same
  // search is one link away (BVJ, 2026-11-04). Always shown: before a search it
  // opens /search, and once one runs it carries that search (E115).
  const pageLine = make("p", "desk-search__page");
  const pageLink = make("a", null, pageLinkText(false));
  pageLine.append(pageLink);
  // "My notes" (E11) beside it, on the same line: whether a Greek search under
  // all types lists the reader's notes. The choice is the one the tray and
  // /search keep (notebook-search.js), so it changes there too.
  const notesSlot = make("span", "desk-search__notes");
  notesSlot.hidden = true;
  const linkRow = make("div", "desk-search__linkrow");
  linkRow.append(pageLine, notesSlot);
  let notesBox = null;
  function syncNotes(show) {
    if (show && deskPart && !notesBox) {
      const sw = deskPart.greekNotesSwitch();
      notesBox = sw.querySelector("input");
      notesSlot.append(sw);
      notesBox.addEventListener("change", () => {
        deskPart.setGreekNotes(notesBox.checked);
        rerun();
      });
    }
    notesSlot.hidden = !(show && deskPart);
    if (notesBox && !notesSlot.hidden) notesBox.checked = deskPart.greekNotesOn();
  }
  // `q` is the search that ran, or "" for the empty box (E115): the book filter
  // and, with a search, its type carry over either way.
  const showPageLink = (q) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeBook) params.set("book", activeBook);
    if (q && activeMode !== "all") params.set("mode", activeMode);
    const query = params.toString();
    pageLink.href = query ? `/search/?${query}` : "/search/";
    pageLink.textContent = pageLinkText(Boolean(q));
    pageLine.hidden = false;
  };
  let offerSeq = 0;
  async function syncOffer(q) {
    const mySeq = ++offerSeq;
    offerBox.hidden = true;
    const offer = await greekOfferFor(BASE, q, activeMode);
    if (destroyed || mySeq !== offerSeq || !offer) return;
    offerBox.replaceChildren(
      greekOfferLine(offer, () => {
        typeSel.value = "greek";
        typeSel.dispatchEvent(new Event("change", { bubbles: true }));
      }),
    );
    offerBox.hidden = false;
  }
  const results = make("div", "desk-search__results");
  const jumpBox = make("div", "desk-search__jump");
  const groupsEl = make("div", "desk-search__groups");
  results.append(jumpBox, groupsEl);
  const entryBox = make("div", "desk-search__entry");
  entryBox.hidden = true;
  // The note line a passage link inside an open entry writes to: `top`, which
  // holds `note`, is hidden while an entry shows (GF8a-6).
  let entryNote = null;
  const top = make("div", "desk-search__top");
  // `live` sits outside `top`, so it is still announced while an entry is open.
  top.append(form, tools, linkRow, status, note, offerBox);
  el.append(live, top, results, entryBox);

  // ---- state (none of it stored) ----

  let activeBook = ""; // the book filter: "" or a book key (never "@reading": that sets a book)
  let activeMode = "all";
  let seq = 0; // a newer search cancels an older one (as the tray's searchSeq)
  let timer = 0;
  let destroyed = false;
  let sortBible = false; // verses: relevance by default, Bible order on request
  let last = null; // what the results on screen were drawn from
  let greekState = { lemmaId: null, exact: false }; // the Greek word chosen, and "Exact form only"
  let entrySeq = 0;
  let resultsScroll = 0;
  let openedFrom = null; // the result that opened the glossary entry, to give focus back
  let busy = false; // a sheet is being written
  let chooser = null; // the "Choose a sheet…" window, while open (E167)
  // What each group's strip has checked (by PICKS' key), for one query.
  const checked = Object.fromEntries(PICK_KINDS.map((kind) => [kind, new Set()]));
  let checkedFor = null; // the query they belong to

  let topics = null; // loadTopicsIndex's, once
  let deskPart = null; // the notebook's search, once loaded
  loadDeskSearch()?.then((m) => {
    deskPart = m;
  });

  // The live region is cleared and filled a frame later, so the same words
  // twice in a row are heard twice.
  const hear = (text) => {
    live.textContent = "";
    if (text) requestAnimationFrame(() => { if (!destroyed) live.textContent = text; });
  };
  const say = (text) => {
    status.textContent = text;
    hear(text);
  };
  const tell = (text) => {
    const line = entryBox.hidden || !entryNote ? note : entryNote;
    line.textContent = text;
    line.hidden = !text;
    hear(text);
  };

  // A control pressed in the results is rebuilt by the search it starts, so
  // its replacement takes focus once the results are drawn (DK-4).
  let pendingFocus = null;
  const settleFocus = () => {
    if (!pendingFocus) return;
    const key = pendingFocus;
    pendingFocus = null;
    // Only from where focus was dropped: a reader who has gone on typing keeps the field.
    const at = document.activeElement;
    if (at && at !== document.body && !groupsEl.contains(at)) return;
    groupsEl.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  };
  const runKeeping = (q, key) => {
    pendingFocus = key;
    run(q);
  };

  const searchable = (q) => longEnoughQuery(q, greekSearchEnabled()) || Boolean(parseReference(q) || parseBookOnly(q));

  // ---- the book menu: "The book I’m reading" ----

  /** The reading option's label, from where the LIT pane is now. */
  function refreshReading() {
    const opt = bookSel.querySelector(`option[value="${READING}"]`);
    const key = reading();
    if (!opt || !key) return;
    const label = bookOptions(key)[1]?.label;
    if (label && opt.textContent !== label) opt.textContent = label;
  }
  // When the menu is focused or opened, so a reader sees the book now, not the
  // one at the pane's start.
  for (const type of ["focus", "pointerdown"]) bookSel.addEventListener(type, refreshReading);

  bookSel.addEventListener("change", () => {
    // "The book I’m reading" fixes the book at this moment; the menu then
    // shows that book, so a LIT pane moving on can't leave a stale label.
    activeBook = bookFilterFor(bookSel.value, reading());
    bookSel.value = activeBook;
    rerun();
  });

  typeSel.addEventListener("change", (e) => {
    notePickedMode(typeSel, e);
    activeMode = pickedMode(typeSel) || "all";
    showModeFor(typeSel, input.value);
    rerun();
  });

  // ---- asking ----

  function rerun() {
    const q = input.value.trim();
    clearTimeout(timer);
    if (!q) return empty();
    if (searchable(q)) run(q);
    else tooShort();
  }

  /** What no search on screen leaves behind: the offer, the page link, the notes switch, the note, the results. */
  function clearSearch() {
    seq++;
    offerSeq++;
    offerBox.hidden = true;
    showPageLink("");
    syncNotes(false);
    last = null;
    // No search on screen: the checks went with it, as on /search.
    for (const set of Object.values(checked)) set.clear();
    checkedFor = null;
    jumpBox.replaceChildren();
    groupsEl.replaceChildren();
    tell("");
  }

  function empty() {
    clearSearch();
    say("");
    groupsEl.append(make("p", "desk-search__empty", "Type a word, a topic, or a reference."));
  }

  function tooShort() {
    clearSearch();
    say(`Type ${MIN_QUERY_LEN} or more letters to search.`);
  }

  input.addEventListener("input", () => {
    // A new query starts afresh: no chosen Greek word, no exact form.
    greekState = { lemmaId: null, exact: false };
    showModeFor(typeSel, input.value);
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) return empty();
    if (!searchable(q)) return tooShort();
    timer = window.setTimeout(() => run(q), DEBOUNCE);
  });
  // The browser's own clear (Escape, the field's x) sends `search` and no
  // `input` (LV3-1), which left the last results under an empty field. A
  // `search` with words in the field is Enter, which the submit below handles.
  input.addEventListener("search", () => {
    if (input.value.trim()) return;
    clearTimeout(timer);
    greekState = { lemmaId: null, exact: false };
    showModeFor(typeSel, input.value);
    empty();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) return;
    const jump = jumpOf(q);
    // Enter on a reference moves the LIT pane there (the results still show).
    // The search first, since it clears the note the move leaves.
    if (searchable(q)) run(q);
    if (jump) goTo(jump);
  });

  function jumpOf(q) {
    return parseReferenceJump(q);
  }

  function goTo(jump) {
    // "Matthew intro" opens the book's introduction in a Book Intro pane, as a
    // result for one does (E53), rather than moving the LIT pane to chapter 1.
    if (jump.kind === "book" && jump.intro) {
      const result = env.showIntro(jump.bookKey, { beside: paneId });
      const moved = result.moved ? passageLabel(parsePassage(result.moved)) : "";
      tell(introMoveMessage(result, bookKeyToLabel(jump.bookKey), moved));
      return;
    }
    showHere(
      jump.kind === "ref"
        ? { bookKey: jump.bookKey, chapter: jump.chapter, verse: jump.verse ?? null }
        : { bookKey: jump.bookKey, chapter: 1, verse: null },
    );
  }

  /**
   * A passage shown in the leading LIT pane, or in one opened beside this
   * pane when there is none, by the desk's own move (`env.showPassage`), and
   * the reader told which happened (E34).
   */
  function showHere(passage) {
    const outcome = env.showPassage(passage, { beside: paneId });
    // The first move of a visit that gives the LIT pane a way back says
    // where its button is (E168); later ones don't repeat it.
    const back = outcome === "moved" && !backTold ? env.backPlace?.() : null;
    if (back) backTold = true;
    tell(passageMoveMessage(outcome, passageLabel(passage), back ? passageLabel(back) : ""));
  }

  /**
   * A result's second link (E34): the passage on its own page, in a new tab,
   * beside the result whose plain click moves the LIT pane. Null for a result
   * that isn't a passage.
   */
  function awayLink(href) {
    const target = resultTarget(href);
    if (target.type !== "passage" && target.type !== "intro") return null;
    const a = awayTab(make("a", "desk-search__away"));
    a.href = href;
    a.title = "Open on its page";
    a.setAttribute("aria-label", pageLinkLabel(target.type === "intro" ? `the ${bookKeyToLabel(target.bookKey)} introduction` : passageLabel(target)));
    a.innerHTML = OPEN_PAGE_ICON;
    return a;
  }

  // ---- running a search ----

  async function ensureTopics() {
    if (topics) return topics;
    topics = (await loadTopicsIndex(BASE, { cache: "force-cache" })) ?? { topicsList: [], topicsUrlMap: new Map() };
    return topics;
  }

  async function run(q) {
    const my = ++seq;
    showModeFor(typeSel, q);
    closeEntry({ focus: false });
    tell("");
    syncOffer(q);
    showPageLink(q);
    syncNotes(false);
    try {
      const jump = jumpOf(q);
      // A typed reference ignores the book filter, as the tray does.
      const book = jump ? "" : activeBook;
      drawJump(jump);
      say("Searching…");
      groupsEl.replaceChildren();

      if (greekSearchEnabled() && !parseReference(q) && (isGreekQuery(q) || activeMode === "greek")) {
        await runGreek(q, my, book, jump);
        return;
      }

      const qUnquoted = q.replace(/^"+|"+$/g, "").trim();
      const qPhrase = normalizePhrase(qUnquoted);
      const wantKeyword = activeMode === "all" || activeMode === "keyword";
      const versePromise = wantKeyword ? loadVerseIndex(BASE) : null;
      const notebookPromise = deskPart && activeMode === "all" ? deskPart.search(q, { bookKey: book }).catch(() => null) : null;

      // /search's own topic matching, loose one-word matches and all (E166):
      // `labels` holds each chapter's matched topics, which a row names when
      // they differ from the query and which name a sheet made of them
      // (`commonLabel`).
      const { docs: fromIndex, labels: topicLabels } = topicMatches(await ensureTopics(), qPhrase, { book });
      if (my !== seq) return;

      // A book filter keeps to scripture: Pagefind is skipped (glossary and
      // article pages carry no book), as the tray does.
      let resolved = [];
      const wantPagefind = !book && activeMode !== "keyword";
      if (wantPagefind) {
        let pf = null;
        try {
          pf = await loadPagefind(BASE);
        } catch (_) {
          if (my === seq) tell("The glossary, articles, and introductions couldn’t be searched just now. Search again in a moment to include them.");
        }
        if (my !== seq) return;
        if (pf) {
          const res = await pf.search(buildPfQuery(q).pfQuery);
          if (my !== seq) return;
          resolved = await Promise.all(res.results.map(async (r, i) => enrichSearchResult(await r.data(), i, { qPhrase })));
          if (my !== seq) return;
        }
      }

      const verseIndex = versePromise ? await versePromise : null;
      if (my !== seq) return;
      const notebook = notebookPromise ? await notebookPromise : null;
      if (my !== seq) return;

      const { hits: verseHits, correction } = verseIndex
        ? searchVerses(verseIndex, q, { bookKey: book })
        : { hits: [], correction: "" };
      // A verse index that didn't load is not "no verses match" (GF8a-3).
      const versesFailed = wantKeyword && !verseIndex;
      if (versesFailed) tell(VERSES_FAILED);

      const extraSubjectItems = fromIndex.map((it) => topicsIndexSubjectItem({ url: it.url, title: it.url, meta: { title: titleOf(it.url) }, anchors: [] }));
      // Merged as /search merges them, which keeps a chapter once when two
      // loose topics both hold it.
      const { glossary, subject, article, intro } = bucketSearchResults(resolved, { extraSubjectItems });

      last = {
        q,
        qPhrase,
        jump,
        notebook: notebook?.total ? notebook : null,
        glossary: glossary.map((it) => ({ title: glossaryTermFromResult(it.d, it.locs, qUnquoted), href: pickAnchorHref(it.d, it.locs) })),
        subject: subject.map((it) => ({
          title: it.d?.meta?.title || it.d.title || it.d.url,
          href: it?.d?.anchors?.length ? pickAnchorHref(it.d, it.locs) : it.d.url,
          labels: topicLabels.get(it.d?.url) ?? [],
        })),
        intro: intro.map((it) => ({ title: scriptureResultTitle(it.d?.url || "", it.d?.meta?.title || "Introduction"), href: pickAnchorHref(it.d, it.locs) })),
        article: article.map((it) => ({ title: it.d?.meta?.title || it.d.title || it.d.url, href: pickAnchorHref(it.d, it.locs) })),
        verses: verseHits,
        correction,
        versesFailed,
        greek: null,
      };
      last.picks = picksOf(last);
      drawResults();
    } catch (err) {
      if (my !== seq) return;
      console.error("Study Desk: the search failed", err);
      groupsEl.replaceChildren();
      say("The search didn’t finish. Try again in a moment.");
    }
  }

  function titleOf(url) {
    return scriptureResultTitle(url, String(url || ""));
  }

  // ---- drawing the English results ----

  /** Whether a group shows under the type chosen. */
  const shows = (kind) => activeMode === "all" || activeMode === kind;

  function drawJump(jump) {
    jumpBox.replaceChildren();
    if (!jump) return;
    const ref = jump.kind === "ref";
    const a = make("a", "desk-search__link desk-search__jump-link");
    a.href = ref ? makeStudyReferenceHref(jump) : makeStudyBookHref(jump.bookKey);
    const name = ref ? formatReferenceLabel(jump) : bookKeyToLabel(jump.bookKey);
    a.append(make("span", "desk-search__ref", `Go to ${name}${jump.intro ? " introduction" : ""}`));
    a.dataset.jump = "";
    jumpBox.append(a);
  }

  function group(title, kind) {
    const section = make("section", "desk-search__group");
    section.dataset.group = kind;
    const h = make("h3", "desk-search__group-title", title);
    section.append(h);
    return section;
  }

  /** Rows `PAGE` at a time with "Show more" after the list. */
  function paged(section, items, draw) {
    const list = make("ol", "desk-search__list");
    section.append(list);
    let shown = 0;
    let more = null;
    const step = () => {
      const first = shown;
      const next = nextPage(shown, items.length);
      for (let i = shown; i < next.shown; i++) list.append(draw(items[i], i));
      shown = next.shown;
      more?.remove();
      more = null;
      if (next.hidden > 0) {
        more = button(`Show ${next.hidden > PAGE ? PAGE : next.hidden} more`, "desk-search__btn desk-search__more");
        more.addEventListener("click", () => {
          step();
          list.children[first]?.querySelector("a, button")?.focus({ preventScroll: true });
        });
        section.append(more);
      }
    };
    step();
    return list;
  }

  /** A result's link: the plain click is the pane's, any other the link's own. */
  function resultLink(href) {
    const a = make("a", "desk-search__link");
    a.href = href;
    const target = resultTarget(href);
    a.dataset.target = target.type;
    if (target.type === "tab") awayTab(a);
    return a;
  }

  function plainRow(item) {
    const li = make("li", "desk-search__row");
    const a = resultLink(item.href);
    a.append(make("span", "desk-search__title", item.title));
    li.append(a);
    const away = awayLink(item.href);
    if (away) li.append(away);
    return li;
  }

  function notebookRow(hit) {
    const li = make("li", "desk-search__row");
    const a = resultLink(hit.href || "/notebook/");
    const head = make("span", "desk-search__title", hit.reference);
    head.append(make("span", "desk-search__kind", hit.label));
    const snippet = make("span", "desk-search__text");
    for (const part of hit.parts) {
      if (part.mark) snippet.append(make("mark", null, part.text));
      else snippet.append(document.createTextNode(part.text));
    }
    a.append(head, snippet);
    li.append(a);
    const away = awayLink(hit.href || "");
    if (away) li.append(away);
    return li;
  }

  function drawResults() {
    const r = last;
    if (!r) return;
    keepChecks(r);
    groupsEl.replaceChildren();
    const counts = [];
    const nCount = r.notebook?.total ?? 0;

    if (nCount) {
      const g = group(r.notebook.title ?? NOTEBOOK_GROUP_TITLE, "notebook");
      paged(g, r.notebook.hits, notebookRow);
      groupsEl.append(g);
      counts.push(plural(nCount, ...(r.notebook.nouns ?? ["notebook match", "notebook matches"])));
    }
    const plainGroups = [
      ["glossary", MODE_LABELS.glossary, r.glossary, "glossary match", "glossary matches"],
      ["subject", MODE_LABELS.subject, r.subject, "topic match", "topic matches"],
      ["intro", MODE_LABELS.intro, r.intro, "book intro match", "book intro matches"],
      ["article", MODE_LABELS.article, r.article, "article match", "article matches"],
    ];
    for (const [kind, title, items, one, many] of plainGroups) {
      if (!shows(kind) || !items.length) continue;
      const g = group(title, kind);
      // The chapters by topic can be checked (E166); an introduction among
      // them can't, being no chapter.
      if (kind === "subject" && store && r.picks.subject.length) g.append(pickStrip("subject"));
      paged(g, items, kind === "subject" ? subjectRow : plainRow);
      groupsEl.append(g);
      counts.push(plural(items.length, one, many));
    }
    if (shows("keyword") && r.verses.length) {
      groupsEl.append(verseGroup(r));
      counts.push(`${plural(r.verses.length, "keyword match", "keyword matches")}${r.correction ? ` for “${r.correction}”` : ""}`);
    }
    if (shows("keyword") && r.versesFailed) {
      // The verses weren't searched (GF8a-3): say so where they would be, with
      // the way to ask again, as the Greek's failures do.
      const g = group(MODE_LABELS.keyword, "keyword");
      g.append(make("p", "desk-search__readback", "The verses couldn’t be loaded."), retryButton(r.q));
      groupsEl.append(g);
    }
    say(counts.length ? counts.join(STATUS_SEP) : r.jump ? "" : r.versesFailed ? VERSES_FAILED : "No results.");
    syncAdd();
    settleFocus();
  }

  // ---- verses, chapters, and the sheet ----

  /** A topic result that is a whole chapter, as the sheet rules take it, else null (an introduction). */
  function chapterOf(item) {
    const t = resultTarget(item.href);
    return t.type === "passage" && t.verse == null ? { bookKey: t.bookKey, chapter: t.chapter, labels: item.labels ?? [] } : null;
  }

  /**
   * What each group's checks are of, once each, for the groups the type
   * chosen shows. The Greek's are set as its rows are drawn (`greekRows`),
   * since a Greek search can answer without a list (the article alone).
   */
  function picksOf(r) {
    return {
      keyword: shows("keyword") ? onceEach(r.verses.map(verseRef), hitKey) : [],
      subject: shows("subject") ? onceEach(r.subject.map(chapterOf).filter(Boolean), chapterKey) : [],
      greek: [],
    };
  }

  /**
   * Checks belong to a query, and a check on a result the results no longer
   * hold (the book filter, another Greek word) is dropped, so the count never
   * counts what a press wouldn't add (BA132, as /search).
   */
  function keepChecks(r) {
    if (r.q !== checkedFor) {
      for (const set of Object.values(checked)) set.clear();
      checkedFor = r.q;
      return;
    }
    for (const kind of PICK_KINDS) {
      const here = new Set(r.picks[kind].map(PICKS[kind].key));
      for (const key of checked[kind]) if (!here.has(key)) checked[kind].delete(key);
    }
  }

  /** How many results a group's checks are of. */
  const pickTotal = (kind) => last?.picks?.[kind]?.length ?? 0;

  /** A group's checked results, in the order the search found them. */
  const checkedRefs = (kind) => (last?.picks?.[kind] ?? []).filter((r) => checked[kind].has(PICKS[kind].key(r)));

  /**
   * A row's box (E117, E166), first in the row: every row of one verse or
   * chapter shares its check. Its row is marked while checked.
   */
  function addBox(li, kind, ref, label) {
    const key = PICKS[kind].key(ref);
    const box = make("input", "desk-search__check");
    box.type = "checkbox";
    box.dataset.pick = kind;
    box.dataset.key = key;
    box.checked = checked[kind].has(key);
    box.setAttribute("aria-label", includeLabel(label));
    box.addEventListener("change", () => {
      if (box.checked) checked[kind].add(key);
      else checked[kind].delete(key);
      syncPick(kind, { said: true });
    });
    li.classList.add("desk-search__row--checkable");
    li.classList.toggle("desk-search__row--picked", box.checked);
    li.prepend(box);
  }

  /** A row's +, last in the row: it adds its one verse or chapter to the sheet a Sheets pane shows. */
  function addPlus(li, kind, ref, label) {
    const plus = button("+", "desk-search__add");
    plus.setAttribute("aria-label", label);
    // Rows from "Show more" are drawn after syncAdd has run.
    plus.hidden = !sheets.addTarget() || busy;
    plus.addEventListener("click", () => {
      const t = sheets.addTarget();
      if (t) gather(kind, [ref], t);
    });
    li.append(plus);
  }

  /** A topic result: a chapter's row has a box and a +, an introduction's neither. */
  function subjectRow(item) {
    const li = plainRow(item);
    // "Matthew 18 · debt forgiveness": the topics a loose one-word match
    // found, when they aren't the query itself, as /search names them.
    const also = item.labels.filter((label) => normalizePhrase(label) !== last?.qPhrase);
    if (also.length) li.querySelector(".desk-search__title")?.append(make("span", "desk-search__topics", ` · ${also.join(", ")}`));
    const c = store ? chapterOf(item) : null;
    if (c) {
      addBox(li, "subject", c, `${bookKeyToLabel(c.bookKey)} ${c.chapter}`);
      addPlus(li, "subject", c, addChapterLabel(c));
    }
    return li;
  }

  function verseGroup(r) {
    const g = group(MODE_LABELS.keyword, "keyword");
    // Bible order: small, at the right of the title line, a toggle (E117).
    const title = g.querySelector(".desk-search__group-title");
    const head = make("div", "desk-search__group-head");
    title.replaceWith(head);
    const sort = button(null, "desk-search__btn desk-search__sort");
    sort.innerHTML = SORT_ICON;
    sort.append(BIBLE_ORDER);
    sort.setAttribute("aria-pressed", String(sortBible));
    sort.addEventListener("click", () => {
      sortBible = !sortBible;
      drawResults();
      // The redraw replaced this button, so focus goes to the new one.
      groupsEl.querySelector("[data-group='keyword'] .desk-search__sort")?.focus({ preventScroll: true });
    });
    head.append(title, sort);
    if (store) g.append(pickStrip("keyword"));
    const hits = sortBible ? r.verses : rankVerseHits(r.verses);
    paged(g, hits, (hit) => {
      const li = make("li", "desk-search__row desk-search__row--verse");
      const a = resultLink(verseHitHref(hit));
      a.append(make("span", "desk-search__ref", verseHitLabel(hit)));
      const text = make("span", "desk-search__text");
      text.innerHTML = highlightVerseHit(hit);
      a.append(text);
      li.append(a);
      const away = awayLink(verseHitHref(hit));
      if (away) li.append(away);
      if (store) {
        addBox(li, "keyword", verseRef(hit), verseHitLabel(hit));
        addPlus(li, "keyword", verseRef(hit), addVerseLabel(hit));
      }
      return li;
    });
    return g;
  }

  /**
   * The strip under a group's title (E117, E166): the box that checks every
   * result of the group, the line ("3 of 40 checked." and Clear checks, or
   * with none checked how to check them), and the buttons, which `syncAdd`
   * names. Sticky in the results while its group is in view.
   */
  function pickStrip(kind) {
    const { noun, key } = PICKS[kind];
    // The results this strip was drawn for: a new search draws a new strip.
    const items = last.picks[kind];
    const strip = make("div", "desk-search__pick");
    strip.dataset.pick = kind;
    const all = make("input", "desk-search__check-all");
    all.type = "checkbox";
    all.setAttribute("aria-label", checkAllLabel(items.length, noun));
    const line = make("p", "desk-search__pick-line");
    line.id = `deskSearchPick-${kind}${sfx}`;
    const clear = button("Clear checks", "desk-search__pick-clear");
    line.append(make("span", "desk-search__pick-count"), make("span", "desk-search__pick-text"), clear);
    const actions = make("div", "desk-search__pick-actions");
    const add = stripButton("desk-search__btn desk-search__btn--primary desk-search__sheet desk-search__sheet--add");
    add.hidden = true;
    const fresh = stripButton("desk-search__btn desk-search__sheet desk-search__sheet--new");
    // Any sheet, as /search's chooser offers (E167): the pick window every
    // "All sheets…" opens.
    const choose = stripButton("desk-search__btn desk-search__sheet desk-search__sheet--choose");
    choose.setAttribute("aria-haspopup", "dialog");
    actions.append(add, fresh, choose);
    strip.append(all, line, actions);

    all.addEventListener("change", () => {
      if (all.checked) for (const r of items) checked[kind].add(key(r));
      else checked[kind].clear();
      syncPick(kind, { said: true });
    });
    clear.addEventListener("click", () => {
      checked[kind].clear();
      syncPick(kind, { said: true });
      // Clear checks hides itself, so focus goes to the box beside it.
      all.focus({ preventScroll: true });
    });
    add.addEventListener("click", () => {
      if (refused(add, kind)) return;
      const t = sheets.addTarget();
      if (t) gather(kind, checkedRefs(kind), t);
    });
    // A new sheet opens in a Sheets pane by E127's one rule (`gather`).
    fresh.addEventListener("click", () => {
      if (refused(fresh, kind)) return;
      gather(kind, checkedRefs(kind), null);
    });
    choose.addEventListener("click", () => {
      if (refused(choose, kind)) return;
      chooseSheet(kind, choose);
    });
    syncPick(kind, { strip });
    return strip;
  }

  /**
   * "Choose a sheet…" (E167; BVJ, 2026-11-19, parity with /search's chooser):
   * every sheet that can take a passage, newest first, in the pick window,
   * with New sheet at its top. A pick adds what is checked when it is made,
   * as every strip button does, and shows that sheet as a new one is shown.
   */
  async function chooseSheet(kind, from) {
    let records = [];
    try {
      records = await store.byKind("sheet");
    } catch (err) {
      console.error("Study Desk: the Search pane couldn’t read the sheets", err);
    }
    if (destroyed || !from.isConnected) return;
    const { noun } = PICKS[kind];
    const at = from.getBoundingClientRect();
    // A redraw (a page of results, the sort) replaces the strip, so focus goes
    // back to this group's button as it is then.
    const back = () => (from.isConnected ? from : stripOf(kind)?.querySelector(".desk-search__sheet--choose") ?? input);
    const add = (target) => {
      const refs = checkedRefs(kind);
      if (!refs.length) {
        hear(checkedLine(0, pickTotal(kind), noun).text);
        return;
      }
      gather(kind, refs, target, { show: true });
    };
    chooser = openPickWindow({
      heading: "Add to sheet",
      title: "Choose a sheet",
      lead: `Choose the sheet for the checked ${noun}s.`,
      noun: ["sheet", "sheets"],
      items: addableSheets(records).map((s) => ({ id: s.id, name: s.name, detail: s.modified && dateWords(s.modified) ? `Changed ${dateWords(s.modified)}` : "" })),
      near: { left: at.left, top: at.bottom + 4 },
      back,
      action: { label: "New sheet", onPress: () => add(null) },
      onPick: (item) => add({ id: item.id, name: item.name }),
    });
  }

  /** A strip button: its label, over invisible copies of the longest it can read. */
  function stripButton(cls) {
    const b = button(null, cls);
    b.append(make("span", "desk-search__label"));
    return b;
  }

  /**
   * Name a strip button. `room` is the labels it may read at other counts,
   * held under it so its width never moves; the accessible name is the whole
   * label, which a long sheet name cuts with "…" only on screen, and `tip`
   * puts it in the tooltip too.
   */
  function nameStripButton(b, label, room, tip = false) {
    b.querySelector(".desk-search__label").textContent = label;
    for (const old of b.querySelectorAll(".desk-search__label-room")) old.remove();
    for (const text of room) {
      const ghost = make("span", "desk-search__label-room", text);
      ghost.setAttribute("aria-hidden", "true");
      b.append(ghost);
    }
    b.setAttribute("aria-label", label);
    if (tip) setTip(b, label);
  }

  /** A press on a strip button that can't act: nothing is added, and with none checked it says why. */
  function refused(b, kind) {
    if (b.getAttribute("aria-disabled") !== "true") return false;
    if (!busy && !checked[kind].size) hear(checkedLine(0, pickTotal(kind), PICKS[kind].noun).text);
    return true;
  }

  const stripOf = (kind) => el.querySelector(`.desk-search__pick[data-pick="${kind}"]`);

  /** A group's strip, boxes and row marks, from its checks; `said` speaks the count, once per change. */
  function syncPick(kind, { said = false, strip = stripOf(kind) } = {}) {
    if (!strip || !last) return;
    const { noun } = PICKS[kind];
    const total = pickTotal(kind);
    const k = checked[kind].size;
    const all = strip.querySelector(".desk-search__check-all");
    all.checked = k > 0 && k === total;
    all.indeterminate = k > 0 && k < total;
    const { count, text } = checkedLine(k, total, noun);
    strip.querySelector(".desk-search__pick-count").textContent = count;
    strip.querySelector(".desk-search__pick-text").textContent = text;
    strip.querySelector(".desk-search__pick-clear").hidden = k === 0;
    strip.classList.toggle("desk-search__pick--some", k > 0);
    // Every row of one verse or chapter: a Greek verse matched twice has two.
    for (const box of el.querySelectorAll(`.desk-search__check[data-pick="${kind}"]`)) {
      const on = checked[kind].has(box.dataset.key);
      box.checked = on;
      box.closest(".desk-search__row")?.classList.toggle("desk-search__row--picked", on);
    }
    syncAdd(strip);
    if (said) hear(checkedSaid(k, total, noun));
  }

  /**
   * The add controls, by whether a Sheets pane shows a sheet: the rows' +,
   * and each strip's "Add … to “…”" (the primary then) beside "New sheet of
   * …" (the primary when it stands alone). Disabled while a write runs and
   * while nothing is checked, then described by the strip's line. `only` is
   * one strip to name, else every strip.
   */
  function syncAdd(only = null) {
    if (!store) return;
    const t = sheets.addTarget();
    for (const b of el.querySelectorAll(".desk-search__add")) b.hidden = !t || busy;
    if (!last) return;
    for (const strip of only ? [only] : el.querySelectorAll(".desk-search__pick")) {
      const kind = strip.dataset.pick;
      const { noun } = PICKS[kind];
      const total = pickTotal(kind);
      const k = checked[kind].size;
      const add = strip.querySelector(".desk-search__sheet--add");
      const fresh = strip.querySelector(".desk-search__sheet--new");
      add.hidden = !t;
      if (t) {
        const label = (n) => addCheckedLabel(t.name, n, total, noun);
        nameStripButton(add, label(k), [label(0), label(total)], true);
      }
      nameStripButton(fresh, newSheetLabel(k, total, noun), [newSheetLabel(0, total, noun), newSheetLabel(total, total, noun)]);
      fresh.classList.toggle("desk-search__btn--primary", !t);
      const choose = strip.querySelector(".desk-search__sheet--choose");
      nameStripButton(choose, CHOOSE_SHEET, []);
      const reason = strip.querySelector(".desk-search__pick-line").id;
      for (const b of [add, fresh, choose]) {
        if (busy || !k) b.setAttribute("aria-disabled", "true");
        else b.removeAttribute("aria-disabled");
        if (!k) b.setAttribute("aria-describedby", reason);
        else b.removeAttribute("aria-describedby");
      }
    }
  }
  const offTarget = sheets.onAddTarget(() => syncAdd());

  /**
   * A new sheet's name, as /search names it: the search, a topic's label
   * (`commonLabel`, else Topic: “…”), or the Greek word the verses were found
   * for. Taken when the button is pressed (BA130).
   */
  function sheetTitleFor(kind, picked) {
    const q = last?.q ?? "";
    if (kind === "subject") return searchSheetTitle(q, { kind: "topic", label: commonLabel(picked) });
    if (kind === "greek") return searchSheetTitle(last?.greekWord || q, { kind: "greek" });
    return searchSheetTitle(q);
  }

  /**
   * Make the passages and write them: into a new sheet (`target` null) or the
   * sheet `target` names. A chapter by topic goes whole, to its last verse
   * (the committed counts, which match the LIT wherever it is written).
   */
  async function gather(kind, refs, target, { show = target == null } = {}) {
    if (!store || busy || !refs.length) return;
    const made = target == null;
    const title = sheetTitleFor(kind, refs);
    const { whole } = PICKS[kind];
    const chapters = whole ? refs.map((c) => ({ ...c, lastVerse: verseCount(c.bookKey, c.chapter) || null })) : null;
    const passagesFor = (room) => (whole ? passagesFromChapters(chapters, { room }) : passagesFromVerses(refs, { room }));
    busy = true;
    syncAdd();
    tell("");
    let outcome;
    try {
      // A Sheets pane's new sheet is written first, if it hasn't been (SH6-7).
      if (!made) target.ready?.();
      // Read and written in one transaction: another tab, or a Sheets pane,
      // may have changed the sheet since the button was drawn (BA130).
      outcome = await store.change(async ({ get }) => {
        const now = new Date().toISOString();
        const existing = made ? null : await get(target.id);
        if (!made && (existing?.kind !== "sheet" || !canEdit(existing))) return { gone: true };
        const result = passagesFor(roomOnSheet(existing?.modules?.length ?? 0));
        if (!result.passages.length) return { result };
        if (made) {
          const sheet = createSheet(
            { title, template: "search", modules: result.passages.map((p) => makeModule("passage", p)) },
            { now, ...env.ctx() },
          );
          return { result, sheet, ...planSave(sheet) };
        }
        // Over the editor's own rules: the sheet in today's canonical form, and
        // each passage where `passageInsertIndex` puts it (SH8-3).
        const plan = planAddPassages(existing, result.passages, { now, ...env.ctx() });
        if (plan.gone) return { gone: true };
        if (plan.refused) throw plan.refused;
        return { result, ...plan };
      });
    } catch (err) {
      console.error("Study Desk: the sheet couldn’t be written", err);
      busy = false;
      syncAdd();
      tell("The sheet couldn’t be saved. Nothing was changed. Try again in a moment.");
      return;
    }
    busy = false;
    // A pane closed while the write ran still says what it did and offers Undo:
    // the undo bar is the page's, not the pane's (GF8a-11).
    if (!destroyed) syncAdd();
    if (outcome.gone) {
      if (!destroyed) tell("That sheet couldn’t be changed. It may have been deleted or made by a newer version of the LIT. Start a new sheet instead.");
      return;
    }
    const { result, sheet } = outcome;
    if (!sheet) {
      if (!destroyed) tell("There was no room to add anything to that sheet.");
      return;
    }
    const entry = store.lastEntry();
    let text = gatherMessage({ made, name: sheetName(sheet), added: result.passages.length, leftOut: result.leftOut, unread: result.unknown ?? 0 });
    // Its results stay on screen: this pane never gives its place to the sheet
    // (`keep`). By the one rule for a pane the desk opens (E127) the sheet is
    // shown in a Sheets pane, in a new one, or in place of another pane, said
    // in this one bar whose Undo takes back both the sheet and the layout; with
    // no pane to give its place the bar says why and links to the sheet's page.
    let link = null;
    let undoLayout = null;
    // A sheet picked in "Choose a sheet…" is shown the same way (E167).
    if (show && !destroyed) {
      const way = env.showSheet(sheet.id, paneId);
      if (way?.changed) undoLayout = way.undoLayout;
      if (way?.outcome === "replaced") text += ` ${replacedMessage("sheet", way.replaced.kind)}`;
      else if (way?.outcome === "none" && way.reason) {
        text += ` ${noWayMessage("sheet", way.reason, { search: true })}`;
        link = { label: noWayLinkLabel("sheet"), href: `/sheets/?id=${encodeURIComponent(sheet.id)}` };
      }
    }
    // The layout first, then the record, so no pane is left pointing at a deleted sheet.
    if (entry) showUndo(text, async () => { undoLayout?.(); await undoEntry(entry); }, { link, keyless: Boolean(undoLayout) });
    else if (!destroyed) tell(text);
  }

  // ---- links in the results ----

  results.addEventListener("click", (e) => {
    const a = e.target.closest?.("a.desk-search__link");
    if (!a || modified(e) || !results.contains(a)) return;
    if (a.dataset.jump !== undefined && last?.jump) {
      e.preventDefault();
      goTo(last.jump);
      return;
    }
    if (a.dataset.greekHit !== undefined) {
      e.preventDefault();
      const hit = greekHits[Number(a.dataset.greekHit)];
      if (hit) env.openGreekHit(hit, paneId);
      return;
    }
    const target = resultTarget(a.getAttribute("href"));
    if (target.type === "passage") {
      e.preventDefault();
      showHere({ bookKey: target.bookKey, chapter: target.chapter, verse: target.verse });
    } else if (target.type === "glossary") {
      e.preventDefault();
      openedFrom = a;
      openEntry(target.id);
    } else if (target.type === "intro") {
      e.preventDefault();
      const result = env.showIntro(target.bookKey, { beside: paneId });
      const moved = result.moved ? passageLabel(parsePassage(result.moved)) : "";
      tell(introMoveMessage(result, bookKeyToLabel(target.bookKey), moved));
    }
  });

  // ---- a glossary entry, in the pane ----

  function closeEntry({ focus = true } = {}) {
    entrySeq++;
    if (entryBox.hidden) return;
    entryBox.hidden = true;
    entryBox.replaceChildren();
    entryNote = null;
    top.hidden = false;
    results.hidden = false;
    results.scrollTop = resultsScroll;
    if (focus) (openedFrom?.isConnected ? openedFrom : input).focus({ preventScroll: true });
  }

  async function openEntry(id) {
    const n = ++entrySeq;
    if (entryBox.hidden) resultsScroll = results.scrollTop;
    results.hidden = true;
    top.hidden = true;
    entryBox.hidden = false;
    const back = button("Back to results", "desk-search__btn desk-search__back");
    back.addEventListener("click", () => closeEntry());
    const openLink = awayTab(make("a", "desk-search__open", "Open in the glossary"));
    openLink.href = `${BASE}glossary/#${encodeURIComponent(id)}`;
    const bar = make("div", "desk-search__entry-bar");
    bar.append(back, openLink);
    entryNote = make("p", "desk-search__note");
    entryNote.hidden = true;
    entryBox.replaceChildren(bar, entryNote, make("p", "desk-search__status", "Loading the entry…"));
    back.focus({ preventScroll: true });
    // `bar` stays in the page, or focus on Back would be dropped; only what
    // follows the note line is swapped (GF8a-5).
    const below = (node) => {
      while (entryNote.nextSibling) entryNote.nextSibling.remove();
      entryBox.append(node);
    };
    let entries;
    try {
      entries = await loadGlossary();
    } catch (_) {
      if (n !== entrySeq) return;
      const fail = make("div", "desk-search__failed");
      const retry = button("Try again");
      retry.addEventListener("click", () => openEntry(id));
      fail.append(make("p", null, "The glossary couldn’t be loaded."), retry);
      below(fail);
      return;
    }
    if (n !== entrySeq) return;
    const source = entries.get(id);
    if (!source) {
      below(make("p", "desk-search__status", "That entry couldn’t be found."));
      return;
    }
    const clone = makeInert(document.importNode(source, true));
    clone.querySelector(".entry-link")?.remove(); // a copy-link button that needs the glossary's script
    for (const hidden of clone.querySelectorAll(".sr-only[aria-hidden]")) hidden.remove(); // search tokens, for Pagefind
    for (const withId of clone.querySelectorAll("[id]")) withId.removeAttribute("id");
    for (const a of clone.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      const t = href.startsWith("#") ? { type: "glossary", id: safeDecode(href.slice(1)) } : resultTarget(href);
      if (t.type === "passage") a.classList.add("desk-search__link");
      else if (t.type === "glossary") a.dataset.entry = t.id;
      else awayTab(a);
    }
    clone.addEventListener("click", (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || modified(e)) return;
      if (a.dataset.entry !== undefined && entries.has(a.dataset.entry)) {
        e.preventDefault();
        openEntry(a.dataset.entry);
        return;
      }
      const t = resultTarget(a.getAttribute("href"));
      if (t.type === "passage") {
        e.preventDefault();
        showHere({ bookKey: t.bookKey, chapter: t.chapter, verse: t.verse });
      }
    });
    below(clone);
    entryBox.scrollTop = 0;
  }

  // ---- the Greek ----

  let greekHits = []; // the hits the rows on screen were drawn from, by index

  const GREEK_HINT = "Type a search, like πίστις.gen or *.aor.impv.";

  function openCommands(filter = null) {
    withCommands()
      .then((m) => {
        if (destroyed) return; // closed while the commands window was loading (GF8a-12)
        return m.openGreekCommands({ field: input, filter, typeSelect: typeSel });
      })
      .catch((err) => console.error("Study Desk: the search commands couldn't load", err));
  }

  async function runGreek(q, my, book, jump) {
    syncNotes(activeMode === "all");
    const notebookPromise =
      deskPart && activeMode === "all" && deskPart.greekNotesOn() ? deskPart.search(q, { bookKey: book }).catch(() => null) : null;
    const ask = () =>
      withGreek()
        .then((m) => m.searchGreekAuto(BASE, q, { bookKey: book, lemmaId: greekState.lemmaId, exactForm: greekState.exact }))
        .catch(() => null);
    let res = await ask();
    if (my !== seq) return;
    // Several words match: the commonest, as the Greek tab does, the rest offered.
    if (res && res.kind !== "commands" && !res.selected && res.lemmas?.length) {
      greekState.lemmaId = res.lemmas[0].id;
      res = await ask();
      if (my !== seq) return;
    }
    const notebook = notebookPromise ? await notebookPromise : null;
    if (my !== seq) return;
    last = {
      q, jump, notebook: notebook?.total ? notebook : null,
      glossary: [], subject: [], intro: [], article: [], verses: [], correction: "", greek: res,
      picks: { keyword: [], subject: [], greek: [] },
      // What a sheet of its verses is named for, as on /search (E165): the
      // Greek word shown, or the search as typed for a command or an exact form.
      greekWord: !res || res.kind === "commands" || greekState.exact ? q : (res.selected?.lemma ?? q),
    };
    groupsEl.replaceChildren();
    const nCount = last.notebook?.total ?? 0;
    if (nCount) {
      const g = group(last.notebook.title ?? NOTEBOOK_GROUP_TITLE, "notebook");
      paged(g, last.notebook.hits, notebookRow);
      groupsEl.append(g);
    }
    const g = group(MODE_LABELS.greek, "greek");
    let line = "";
    if (!res) {
      line = "The Greek search couldn’t be loaded.";
      g.append(retryButton(q));
    } else if (res.kind === "commands") {
      line = await paintCommands(g, res);
    } else {
      line = await paintWord(g, res, q);
    }
    if (my !== seq) return;
    // Drop the checks this answer doesn't hold: with no list, all of them.
    keepChecks(last);
    g.append(foot());
    groupsEl.append(g);
    syncAdd();
    const said = typeof line === "string" ? line : "";
    say(nCount ? `${said.replace(/\.$/, "")}${said ? STATUS_SEP : ""}${plural(nCount, ...(last.notebook.nouns ?? ["notebook match", "notebook matches"]))}` : said);
    settleFocus();
  }

  function retryButton(q) {
    const b = button("Try again");
    b.dataset.focusKey = "retry";
    b.addEventListener("click", () => runKeeping(q, "retry"));
    return b;
  }

  /** The credit under every Greek group (a license requirement) and the way to the commands window. */
  function foot() {
    const box = make("div", "desk-search__greek-foot");
    // No engine means the search couldn't load, and the window needs it too.
    const cmds = gk?.commandsLinkButton("Search commands", () => openCommands());
    cmds?.setAttribute("aria-haspopup", "dialog");
    const credit = make("p", "desk-search__credit");
    credit.innerHTML = creditHtml(escapeHtml);
    for (const a of credit.querySelectorAll("a")) awayTab(a);
    if (cmds) box.append(cmds);
    box.append(credit);
    return box;
  }

  function drawHelp(g, { filter = null, examples = 2 } = {}) {
    const box = make("div", "desk-search__help");
    if (examples) {
      box.append(gk.exampleList(gk.EXAMPLES.slice(0, examples), (query) => {
        greekState = { lemmaId: null, exact: false };
        input.value = query;
        input.focus({ preventScroll: true });
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }));
    }
    box.append(gk.commandsLinkButton("See all search commands", () => openCommands(filter)));
    g.append(box);
  }

  /** A command query: said back, then its verses. Resolves to the status line. */
  async function paintCommands(g, res) {
    greekHits = [];
    if (res.error) {
      const msg = gk.errorMessage(res.error);
      const p = make("p", "desk-search__readback");
      const at = msg.suggest ? msg.text.lastIndexOf(`${msg.suggest}?`) : -1;
      if (at < 0) {
        p.textContent = msg.text;
      } else {
        const fix = make("button", "greek-cmd-link", msg.suggest);
        fix.type = "button";
        fix.addEventListener("click", () => {
          input.value = gk.replaceWord(input.value, msg.replace, msg.suggest);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus({ preventScroll: true }); // the button is about to be redrawn away (GF8a-9)
        });
        p.append(msg.text.slice(0, at), fix, msg.text.slice(at + msg.suggest.length));
      }
      g.append(p);
      drawHelp(g, { filter: msg.filter ?? null });
      return msg.text;
    }
    if (res.failed) {
      g.append(make("p", "desk-search__readback", "The Greek search couldn’t be loaded."), retryButton(last.q));
      return "The Greek search couldn’t be loaded.";
    }
    if (!res.resolved) {
      g.append(make("p", "desk-search__readback", GREEK_HINT));
      drawHelp(g);
      return "";
    }
    const greek = (x) => `<span lang="grc">${escapeHtml(x)}</span>`;
    const back = make("p", "desk-search__readback");
    back.innerHTML = `${gk.describeGreekQuery(res.resolved, { greek, text: escapeHtml })} · ${escapeHtml(gk.countLine(res.hits))}`;
    g.append(back);
    if (!res.hits.length) {
      drawHelp(g);
      return "No verses match that search.";
    }
    greekRows(g, res.hits);
    return gk.countLine(res.hits);
  }

  /** One word (or its choices) and its verses. Resolves to the status line. */
  async function paintWord(g, res, q) {
    greekHits = [];
    const lemmas = res.lemmas ?? [];
    if (!res.kind || !lemmas.length) {
      // Nothing matched, or the index never loaded; the two read differently.
      if (!(await gk.loadGreekIndex(BASE))) {
        g.append(make("p", "desk-search__readback", "The Greek search couldn’t be loaded."), retryButton(q));
        return "The Greek search couldn’t be loaded.";
      }
      g.append(make("p", "desk-search__readback", "No Greek words match."));
      drawHelp(g, { examples: 2 });
      return "No Greek words match.";
    }
    const sel = res.selected;
    if (lemmas.length === 1 && sel) {
      const p = make("p", "desk-search__found");
      lemmaNodes(p, sel, { count: false });
      g.append(p);
    } else {
      const box = make("div", "desk-search__choices");
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "Words that match");
      let shown = Math.max(CHOICES, lemmas.findIndex((l) => l.id === sel?.id) + 1);
      const draw = () => {
        box.replaceChildren();
        lemmas.slice(0, shown).forEach((item) => {
          const b = make("button", "desk-search__choice");
          b.type = "button";
          b.setAttribute("aria-pressed", String(item.id === sel?.id));
          lemmaNodes(b, item);
          b.dataset.focusKey = `choice-${item.id}`;
          b.addEventListener("click", () => {
            greekState.lemmaId = item.id;
            runKeeping(q, `choice-${item.id}`);
          });
          box.append(b);
        });
        if (lemmas.length > shown) {
          const more = button("Show more words", "desk-search__btn desk-search__more");
          more.addEventListener("click", () => {
            const first = lemmas[shown]?.id;
            shown += CHOICES;
            draw();
            // The button is gone (or moved on): the first new word takes focus.
            box.querySelector(`[data-focus-key="choice-${CSS.escape(String(first))}"]`)?.focus();
          });
          box.append(more);
        }
      };
      draw();
      g.append(box);
    }
    if (res.otherForms && res.form) {
      const label = make("label", "desk-search__exact");
      const check = make("input");
      check.type = "checkbox";
      check.checked = greekState.exact;
      check.dataset.focusKey = "exact";
      check.addEventListener("change", () => {
        greekState.exact = check.checked;
        runKeeping(q, "exact");
      });
      label.append(check, " ", make("span", null, "Exact form only"));
      g.append(label);
    }
    if (!res.total) {
      // The search says when the word's verses didn't load (it used to be
      // guessed, and not at all under "Exact form only": GK3-9).
      if (res.failed) {
        g.append(make("p", "desk-search__readback", "The verses couldn’t be loaded."), retryButton(q));
        return "The verses couldn’t be loaded.";
      }
      // Nothing loaded wrongly: the exact form, or the book chosen, has none.
      g.append(
        make(
          "p",
          "desk-search__readback",
          greekState.exact
            ? "This exact form doesn’t occur. Clear “Exact form only” to see every form."
            : "No occurrences in the selected book.",
        ),
      );
      return "";
    }
    if (sel?.lemma.normalize("NFC") === gk.ARTICLE && !greekState.exact) {
      // The article alone is in nearly every verse: it is studied beside a
      // word, so the answer is a line and a search to try, not the list (BA110).
      const p = make("p", "desk-search__readback");
      const next = make("button", "greek-cmd-link", gk.ARTICLE_EXAMPLE);
      next.type = "button";
      next.lang = "grc";
      next.addEventListener("click", () => {
        greekState = { lemmaId: null, exact: false };
        input.value = gk.ARTICLE_EXAMPLE;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus({ preventScroll: true }); // the button is about to be redrawn away (GF8a-9)
      });
      p.append(`${gk.articleLine(gk.versesIn(res.hits))} `, next, ".");
      g.append(p);
      return "";
    }
    const said = `${res.total} time${res.total === 1 ? "" : "s"} in the New Testament${greekState.exact ? ", in this form" : ""}`;
    g.append(make("p", "desk-search__readback", said));
    greekRows(g, res.hits);
    return said;
  }

  /** A lemma's line with its Greek set as Greek: "πίστις · pistis · G4102 · faith · 243 times". */
  function lemmaNodes(into, item, { count = true } = {}) {
    let line = gk.lemmaLine(item);
    if (!count) line = line.replace(/ · \d+ times?$/, "");
    const g = make("span", null, item.lemma);
    g.lang = "grc";
    into.append(g, line.slice(item.lemma.length));
  }

  /**
   * Verses of a Greek search: real links (a new tab's), opening the word in a
   * Greek pane on a plain click. Each has a box and a +, and the strip goes
   * under the group's title, above the word and Exact form only, as on /search
   * (E166).
   */
  function greekRows(g, hits) {
    greekHits = hits;
    if (store && last) {
      last.picks.greek = onceEach(hits.map(greekRef), hitKey);
      keepChecks(last);
      if (last.picks.greek.length) g.querySelector(".desk-search__group-title")?.after(pickStrip("greek"));
    }
    paged(g, hits, (hit, i) => {
      const li = make("li", "desk-search__row desk-search__row--greek");
      const a = make("a", "desk-search__link");
      a.href = hit.href;
      a.dataset.greekHit = String(i);
      // The reference is drawn as a scripture link: the row previews its LIT
      // verse on hover (ref-preview.js) and a click opens it, as a footnote's
      // reference does. A line of the LIT under it showed the verse's start,
      // not the words rendering this one (BVJ, 2026-11-19), which only the
      // alignment can find; that waits for alignment phase 1b (E167).
      a.append(make("span", "desk-search__ref", hit.label));
      const form = make("span", "desk-search__greek-form", hit.form ?? "");
      form.lang = "grc";
      const parse = make("span", "desk-search__greek-parse");
      a.append(" ", form, parse);
      // A line of the verse's Greek around the word, marked (E167; BVJ,
      // 2026-11-19: “just a few words on either side of it”), filled in as
      // the chapter's file arrives.
      const greekLine = make("span", "desk-search__text desk-search__line");
      greekLine.lang = "grc";
      greekLine.hidden = true;
      a.append(greekLine);
      // A file already loaded answers before the row is in the page, so a
      // row is filled whether or not it is connected yet.
      gk.loadGreekChapter(BASE, hit.book, hit.chapter).then((data) => {
        if (!data) return;
        const { html, words } = gk.verseGreek(data, hit.verse, hit.marked ?? [hit.t], escapeHtml, { around: GREEK_AROUND });
        // A command match names the words it matched; one word, its parsing.
        if (hit.marked) form.textContent = gk.formsLine(words);
        if (words.length === 1 && words[0].said) parse.textContent = ` · ${words[0].said}`;
        greekLine.innerHTML = html;
        greekLine.hidden = !html;
      });
      li.append(a);
      const away = awayLink(hit.href);
      if (away) li.append(away);
      if (store) {
        const ref = greekRef(hit);
        addBox(li, "greek", ref, hit.label);
        addPlus(li, "greek", ref, addVerseLabel(ref));
      }
      return li;
    });
  }

  // ---- go ----

  empty();

  return {
    el,
    focusField() {
      closeEntry({ focus: false }); // an open entry hides the field
      input.focus();
      input.select();
    },
    destroy() {
      destroyed = true;
      seq++;
      entrySeq++;
      clearTimeout(timer);
      offTarget();
      if (chooser?.isOpen()) chooser.close("pane");
      if (commands?.greekCommandsOpenFor(input)) commands.closeGreekCommands("pane");
    },
  };
}
