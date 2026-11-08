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
//   none, and the note line says which (`passageMoveMessage`); a small link
//   beside the result opens its page in a new tab (`awayLink`).
// - **Results can go on a sheet**: "Make a sheet of these verses" (a new sheet,
//   shown in a Sheets pane) and, while a Sheets pane shows one, "Add these
//   verses to “…”" and a + on each verse, through the same rules and one
//   transaction as /search's (desk-sheet-gather.mjs, search-sheet.js).
// - **The Greek** (rules 15 and 17 of the desk's CLAUDE.md; only while
//   greekSearchEnabled()): one query never gets both English and Greek. It is
//   searchGreekAuto, said back as the Greek tab says it, with the credit under
//   every Greek group (a license requirement). A Greek result opens its word
//   in a Greek pane and moves the LIT pane there (`env.openGreekHit`).
//
// Nothing about a search is stored: it lives in this closure, and a reload
// empties the pane. Several panes may be open, each with its own search.

import { canEdit } from "../../lib/desk-records.mjs";
import { planSave } from "../../lib/desk-store-core.mjs";
import {
  MIN_QUERY_LEN,
  PAGE,
  READING,
  addAllLabel,
  addVerseLabel,
  bookFilterFor,
  bookOptions,
  longEnoughQuery,
  nextPage,
  pageLinkLabel,
  passageMoveMessage,
  introMoveMessage,
  resultTarget,
  verseRef,
} from "../../lib/desk-search-pane.mjs";
import { parsePassage, passageLabel } from "../../lib/desk-passage.mjs";
import { gatherMessage, passagesFromVerses, roomOnSheet, searchSheetTitle } from "../../lib/desk-sheet-gather.mjs";
import { sheetName } from "../../lib/desk-sheet-passages.mjs";
import { NOTEBOOK_GROUP_TITLE } from "../../lib/desk-search.mjs";
import { addModule, createSheet, makeModule } from "../../lib/desk-sheets.mjs";
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
  topicsIndexSubjectItem,
  verseHitHref,
  verseHitLabel,
} from "../search-core.js";
import { addTarget, onAddTarget } from "./sheet-pane.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";
import { make } from "./dom.js";
import { OPEN_PAGE_ICON } from "./glyphs.js";

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

function button(label, cls = "desk-search__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const STATUS_SEP = " • ";

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

/**
 * @param {{ paneId: string, env: object, getPlace: () => { bookKey: string } }} options
 *   `env` is desk-page.js's: `store`, `ctx`, `showPassage(passage, { beside })`,
 *   `showSheet(id)`, `showIntro(bookKey, { beside })` and `openGreekHit(hit, paneId)`. `getPlace` is the passage
 *   being read, for "The book I’m reading".
 * @returns {{ el: HTMLElement, focusField: () => void, destroy: () => void }}
 */
export function createSearchPane({ paneId, env, getPlace }) {
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
  // search is one link away (BVJ, 2026-11-04). Shown while there is a search.
  const pageLine = make("p", "desk-search__page");
  pageLine.hidden = true;
  const pageLink = make("a", null, "See results on the search page");
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
  const showPageLink = (q) => {
    const params = new URLSearchParams({ q });
    if (activeBook) params.set("book", activeBook);
    if (activeMode !== "all") params.set("mode", activeMode);
    pageLink.href = `/search/?${params}`;
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
  const top = make("div", "desk-search__top");
  top.append(form, tools, linkRow, live, status, note, offerBox);
  el.append(top, results, entryBox);

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
    note.textContent = text;
    note.hidden = !text;
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

  function empty() {
    seq++;
    offerSeq++;
    offerBox.hidden = true;
    pageLine.hidden = true;
    syncNotes(false);
    last = null;
    jumpBox.replaceChildren();
    groupsEl.replaceChildren();
    tell("");
    say("");
    groupsEl.append(make("p", "desk-search__empty", "Type a word, a topic, or a reference."));
  }

  function tooShort() {
    seq++;
    last = null;
    jumpBox.replaceChildren();
    groupsEl.replaceChildren();
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
    const ref = parseReference(q);
    if (ref) return { kind: "ref", ...ref };
    const book = parseBookOnly(q);
    return book ? { kind: "book", ...book } : null;
  }

  function goTo(jump) {
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
    tell(passageMoveMessage(outcome, passageLabel(passage)));
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
    tell("");
    syncOffer(q);
    showPageLink(q);
    syncNotes(false);
    closeEntry({ focus: false });
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

      const { topicsList, topicsUrlMap } = await ensureTopics();
      if (my !== seq) return;
      const picked = qPhrase ? topicsList.find((t) => t?.norm === qPhrase) : null;
      let fromIndex = picked ? topicsUrlMap.get(picked.norm) || [] : [];
      if (book) {
        fromIndex = fromIndex.filter((it) => {
          const m = /^\/([0-9a-z]+)-(\d+)/.exec(String(it?.url ?? ""));
          return m && m[1] === book;
        });
      }
      fromIndex = fromIndex.slice(0, 50);

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

      const extraSubjectItems = picked && fromIndex.length
        ? fromIndex.map((it) => topicsIndexSubjectItem({ url: it.url, title: it.url, meta: { title: titleOf(it.url) }, anchors: [] }))
        : [];
      const { glossary, subject, article, intro } = bucketSearchResults(resolved, { extraSubjectItems, replaceSubject: true });

      last = {
        q,
        jump,
        notebook: notebook?.total ? notebook : null,
        glossary: glossary.map((it) => ({ title: glossaryTermFromResult(it.d, it.locs, qUnquoted), href: pickAnchorHref(it.d, it.locs) })),
        subject: subject.map((it) => ({
          title: it.d?.meta?.title || it.d.title || it.d.url,
          href: it?.d?.anchors?.length ? pickAnchorHref(it.d, it.locs) : it.d.url,
        })),
        intro: intro.map((it) => ({ title: scriptureResultTitle(it.d?.url || "", it.d?.meta?.title || "Introduction"), href: pickAnchorHref(it.d, it.locs) })),
        article: article.map((it) => ({ title: it.d?.meta?.title || it.d.title || it.d.url, href: pickAnchorHref(it.d, it.locs) })),
        verses: verseHits,
        correction,
        greek: null,
      };
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
    a.append(make("span", "desk-search__ref", `Go to ${ref ? formatReferenceLabel(jump) : bookKeyToLabel(jump.bookKey)}`));
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
      paged(g, items, plainRow);
      groupsEl.append(g);
      counts.push(plural(items.length, one, many));
    }
    if (shows("keyword") && r.verses.length) {
      groupsEl.append(verseGroup(r));
      counts.push(`${plural(r.verses.length, "keyword match", "keyword matches")}${r.correction ? ` for “${r.correction}”` : ""}`);
    }
    say(counts.length ? counts.join(STATUS_SEP) : r.jump ? "" : "No results.");
    syncAdd();
    settleFocus();
  }

  // ---- verses, and the sheet ----

  function verseGroup(r) {
    const g = group(MODE_LABELS.keyword, "keyword");
    const row = make("div", "desk-search__bar");
    const sort = button("Bible order", "desk-search__btn desk-search__btn--quiet");
    sort.setAttribute("aria-pressed", String(sortBible));
    sort.addEventListener("click", () => {
      sortBible = !sortBible;
      drawResults();
      // The redraw replaced this button, so focus goes to the new one.
      groupsEl.querySelector("[data-group='keyword'] [aria-pressed]")?.focus({ preventScroll: true });
    });
    row.append(sort);
    if (store) {
      const make1 = button("Make a sheet of these verses", "desk-search__btn desk-search__sheet");
      make1.addEventListener("click", () => gather(r.verses.map(verseRef), null));
      const add = button("", "desk-search__btn desk-search__sheet desk-search__add-all");
      add.hidden = true;
      add.addEventListener("click", () => {
        const t = addTarget();
        if (t) gather(r.verses.map(verseRef), t);
      });
      row.append(make1, add);
    }
    g.append(row);
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
        const plus = button("+", "desk-search__add");
        plus.setAttribute("aria-label", addVerseLabel(hit));
        // Rows from "Show more" are drawn after syncAdd has run.
        plus.hidden = !addTarget() || busy;
        plus.addEventListener("click", () => {
          const t = addTarget();
          if (t) gather([verseRef(hit)], t);
        });
        li.append(plus);
      }
      return li;
    });
    return g;
  }

  /** Show or hide the add controls by whether a Sheets pane shows a sheet. */
  function syncAdd() {
    if (!store) return;
    const t = addTarget();
    for (const b of el.querySelectorAll(".desk-search__add")) b.hidden = !t || busy;
    const all = el.querySelector(".desk-search__add-all");
    if (all) {
      all.hidden = !t;
      if (t) all.textContent = addAllLabel(t.name, last?.verses.length ?? 0);
      all.disabled = busy;
    }
    for (const b of el.querySelectorAll(".desk-search__sheet:not(.desk-search__add-all)")) b.disabled = busy;
  }
  const offTarget = onAddTarget(syncAdd);

  /** Make the passages and write them: into a new sheet (`target` null) or the sheet `target` names. */
  async function gather(refs, target) {
    if (!store || busy || !refs.length) return;
    const made = target == null;
    const title = searchSheetTitle(last?.q ?? "");
    busy = true;
    syncAdd();
    tell("");
    let outcome;
    try {
      // Read and written in one transaction: another tab, or a Sheets pane,
      // may have changed the sheet since the button was drawn (BA130).
      outcome = await store.change(async ({ get }) => {
        const now = new Date().toISOString();
        const existing = made ? null : await get(target.id);
        if (!made && (existing?.kind !== "sheet" || !canEdit(existing))) return { gone: true };
        const result = passagesFromVerses(refs, { room: roomOnSheet(existing?.modules?.length ?? 0) });
        if (!result.passages.length) return { result };
        let sheet;
        if (made) {
          sheet = createSheet(
            { title, template: "search", modules: result.passages.map((p) => makeModule("passage", p)) },
            { now, ...env.ctx() },
          );
        } else {
          sheet = existing;
          for (const p of result.passages) sheet = addModule(sheet, makeModule("passage", p), undefined, { now, ...env.ctx() });
        }
        return { result, sheet, ...planSave(sheet) };
      });
    } catch (err) {
      console.error("Study Desk: the sheet couldn’t be written", err);
      busy = false;
      syncAdd();
      tell("The sheet couldn’t be saved. Nothing was changed. Try again in a moment.");
      return;
    }
    busy = false;
    if (destroyed) return;
    syncAdd();
    if (outcome.gone) {
      tell("That sheet couldn’t be changed. It may have been deleted or made by a newer version of the LIT. Start a new sheet instead.");
      return;
    }
    const { result, sheet } = outcome;
    if (!sheet) {
      tell("There was no room to add anything to that sheet.");
      return;
    }
    const entry = store.lastEntry();
    let text = gatherMessage({ made, name: sheetName(sheet), added: result.passages.length, leftOut: result.leftOut });
    // Its results stay on screen: this pane never gives its place to the sheet.
    if (made && !env.showSheet(sheet.id, paneId)) text += " Open a Sheets pane to see it.";
    if (entry) showUndo(text, () => undoEntry(entry));
    else tell(text);
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
    entryBox.replaceChildren(bar, make("p", "desk-search__status", "Loading the entry…"));
    back.focus({ preventScroll: true });
    let entries;
    try {
      entries = await loadGlossary();
    } catch (_) {
      if (n !== entrySeq) return;
      const fail = make("div", "desk-search__failed");
      const retry = button("Try again");
      retry.addEventListener("click", () => openEntry(id));
      fail.append(make("p", null, "The glossary couldn’t be loaded."), retry);
      entryBox.replaceChildren(bar, fail);
      return;
    }
    if (n !== entrySeq) return;
    const source = entries.get(id);
    if (!source) {
      entryBox.replaceChildren(bar, make("p", "desk-search__status", "That entry couldn’t be found."));
      return;
    }
    const clone = document.importNode(source, true);
    clone.querySelector(".entry-link")?.remove(); // a copy-link button that needs the glossary's script
    for (const hidden of clone.querySelectorAll(".sr-only[aria-hidden]")) hidden.remove(); // search tokens, for Pagefind
    for (const withId of clone.querySelectorAll("[id]")) withId.removeAttribute("id");
    for (const a of clone.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      const t = href.startsWith("#") ? { type: "glossary", id: decodeURIComponent(href.slice(1)) } : resultTarget(href);
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
    entryBox.replaceChildren(bar, clone);
    entryBox.scrollTop = 0;
  }

  // ---- the Greek ----

  let greekHits = []; // the hits the rows on screen were drawn from, by index

  const GREEK_HINT = "Type a search, like πίστις.gen or *.aor.impv.";

  function openCommands(filter = null) {
    withCommands()
      .then((m) => m.openGreekCommands({ field: input, filter, typeSelect: typeSel }))
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
    g.append(foot());
    groupsEl.append(g);
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
        input.value = ARTICLE_EXAMPLE;
        input.dispatchEvent(new Event("input", { bubbles: true }));
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

  /** Verses of a Greek search: real links (a new tab's), opening the word in a Greek pane on a plain click. */
  function greekRows(g, hits) {
    greekHits = hits;
    paged(g, hits, (hit, i) => {
      const li = make("li", "desk-search__row");
      const a = make("a", "desk-search__link");
      a.href = hit.href;
      a.dataset.greekHit = String(i);
      a.append(make("span", "desk-search__ref", hit.label));
      const form = make("span", "desk-search__greek-form", hit.form ?? "");
      form.lang = "grc";
      a.append(" ", form);
      // A command match names the words it matched, from the chapter's Greek.
      if (hit.marked) {
        gk.loadGreekChapter(BASE, hit.book, hit.chapter).then((data) => {
          if (data && form.isConnected) form.textContent = gk.formsLine(gk.verseGreek(data, hit.verse, hit.marked, (x) => x).words);
        });
      }
      li.append(a);
      const away = awayLink(hit.href);
      if (away) li.append(away);
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
      if (commands?.greekCommandsOpenFor(input)) commands.closeGreekCommands("pane");
    },
  };
}
