// src/scripts/search.js
// Full /search page behavior: buckets (glossary/topic/article/keyword),
// URL state, sorting, paging, and per-occurrence keyword cards.
// Shared parsing/query logic lives in search-core.js (also used by the
// SearchBar tray) — only page-specific rendering and state live here.

import {
  BOOK_RANK,
  bookKeyToLabel,
  parseReferenceJump,
  referenceJumpLabel,
  makeStudyJumpHref,
  deskEnabled,
  normalizePhrase,
  isExplicitlyQuoted,
  buildPfQuery,
  escapeHtml,
  fuzzyTopicSuggestions,
  topicMatches,
  parseBookChapterFromUrl,
  scriptureResultTitle,
  glossaryTermFromResult,
  glossaryTermsFromDom,
  enrichSearchResult,
  topicsIndexSubjectItem,
  bucketSearchResults,
  getMatchLocations,
  pickAnchorHref,
  loadVerseIndex,
  VERSES_FAILED,
  searchVerses,
  rankVerseHits,
  verseHitHref,
  highlightVerseHit,
  loadTopicsIndex,
  loadDeskSearch,
  loadDeskSheets,
  greekSearchEnabled,
  isGreekQuery,
  addGreekMode,
  greekOfferFor,
  greekOfferLine,
  pickedMode,
  setPickedMode,
  notePickedMode,
  showModeFor,
  loadGreekSearch,
} from "./search-core.js";
import {
  renderTabs,
  visibleTabs,
  tabForMode,
  modeForTab,
  openingTab,
  resultsCount,
  verseRowsHtml,
  titleRowHtml,
  referenceRowsHtml,
  studyHrefFor,
  chaptersLineHtml,
  glossaryLineHtml,
  glossaryLineTerm,
} from "../lib/search-rows.mjs";
import { hasGreek } from "../lib/greek-detect.mjs";

// The Greek search itself, loaded by the first Greek query (LG-6), so a reader
// who never makes one downloads none of it. Whatever draws a Greek result runs
// after that search, so `gk` is set by then.
let gk = null;
const withGreek = async () => (gk ||= await loadGreekSearch());

// The commands window is loaded only when the Greek is searched at all, so a
// reader without the preview downloads none of it.
let commandsModule = null;
const withCommands = () => (commandsModule ||= import("./greek-commands.js"));

const base = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const $ = (sel, root = document) => root.querySelector(sel);

const statusEl = $("#search-status");
const tabsEl = $("#search-tabs");
const toolsEl = $("#search-tools");
const sortSelect = $("#search-sort");
const linesEl = $("#search-lines");
const countEl = $("[data-search-count]");
const refEl = $("[data-search-ref]");

const groupNotebook = $("#group-notebook");
const groupGlossary = $("#group-glossary");
const groupSubject = $("#group-subject");
const groupIntros = $("#group-intros");
const groupArticles = $("#group-articles");
const groupKeyword = $("#group-keyword");
const groupGreek = $("#group-greek");

const notebookEl = $("#results-notebook");
const glossaryEl = $("#results-glossary");
const subjectEl = $("#results-subject");
const introsEl = $("#results-intros");
const articlesEl = $("#results-articles");
const keywordEl = $("#results-keyword");
const greekEl = $("#results-greek");
const greekLemmasEl = $("#greek-lemmas");
const greekExactEl = $("#greek-exact");
const greekExactInput = $("#greek-exact-input");
const greekHelpEl = $("#greek-help");

const pagerEl = $("#pager");


// Grab the SearchBar instance rendered by SearchLayout
const searchRoot = document.querySelector("[data-searchbar]");
const input = $("#site-search-input");

const bookSelect = searchRoot
  ? searchRoot.querySelector(".searchbar__book")
  : null;

const modeSelect = searchRoot
  ? searchRoot.querySelector(".searchbar__mode")
  : null;

const pageSize = 10;
const MIN_QUERY_LEN = 3;
let pagefindMod = null;
let debounceId = null;

// Canonical subject index (same one SearchBar uses), memoized.
// no-store: full-page results should always reflect the latest deploy;
// the tray fetches the same index with force-cache for speed.
let topicsIndexPromise = null;
function loadTopicsIndexOnce() {
  if (!topicsIndexPromise)
    topicsIndexPromise = loadTopicsIndex(base, { cache: "no-store" });
  return topicsIndexPromise;
}

// Cache the most recent full result set so we can re-sort without re-searching
let lastSearchCache = null;

let cachedTopicsList = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setRefBanner(content, show) {
  if (!refEl) return;
  refEl.hidden = !show;
  refEl.replaceChildren();
  if (!show) return;

  if (content instanceof Node) {
    refEl.appendChild(content);
    return;
  }

  refEl.innerHTML = String(content || "");
}

function prettyTitleFromUrl(url, fallbackTitle = "Result") {
  return scriptureResultTitle(url, fallbackTitle);
}

// The reference's answer: "Go to John 3:16," then with the Study preview
// "Study John 3:16" (SE-17, ST-15), drawn by the module the tray shares.
function referenceAnswerHtml(jump) {
  if (!jump) return "";
  return referenceRowsHtml(
    {
      label: referenceJumpLabel(jump),
      goHref: makeStudyJumpHref(jump),
      studyHref: studyHrefFor(jump),
      intro: jump.kind === "book" && jump.intro === true,
    },
    { desk: deskEnabled() },
  );
}

// -----------------------
// URL state helpers
// -----------------------
function readState() {
  const params = new URLSearchParams(window.location.search);
  const sortRaw = (params.get("sort") || "").trim().toLowerCase();
  const sort = sortRaw === "order" ? "order" : "relevance";

  const modeRaw = (params.get("mode") || "").trim().toLowerCase();
  const mode =
    modeRaw === "subject" ||
    modeRaw === "keyword" ||
    modeRaw === "glossary" ||
    modeRaw === "article" ||
    modeRaw === "intro" ||
    (modeRaw === "greek" && greekSearchEnabled())
      ? modeRaw
      : "all";

  return {
    q: (params.get("q") || "").trim(),
    book: (params.get("book") || "").trim(),
    page: Math.max(1, parseInt(params.get("page") || "1", 10)),
    sort,
    mode,
  };
}

function writeState(next, { push = false } = {}) {
  const params = new URLSearchParams(window.location.search);

  if (next.q) params.set("q", next.q);
  else params.delete("q");

  // Clean up legacy ?type= param if present
  params.delete("type");

  if (next.book) params.set("book", next.book);
  else params.delete("book");

  if (next.page && next.page > 1) params.set("page", String(next.page));
  else params.delete("page");

  if (next.sort && next.sort !== "relevance") params.set("sort", next.sort);
  else params.delete("sort");

  if (next.mode && next.mode !== "all") params.set("mode", next.mode);
  else params.delete("mode");

  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;

  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

// -----------------------
// UI sync (SearchBar controls)
// -----------------------
function setActiveSort(sort) {
  if (sortSelect) sortSelect.value = sort === "order" ? "order" : "relevance";
}

function getActiveSort() {
  return sortSelect?.value === "order" ? "order" : "relevance";
}

// The book menu moves from the tray's filters to the tab row's right end, beside
// the sort (SE-04). The type menu stays in the page, hidden, as the one value
// the shared search code reads and writes: the row of tabs is the type.
const filtersEl = searchRoot?.querySelector(".searchbar__filters") ?? null;
if (filtersEl && toolsEl) toolsEl.prepend(filtersEl);

// The tab a search is on, and the Notebook's, which is the page's own and not
// an address's mode (it is searched in the browser, only with the preview).
let notebookTab = false;
let refocusTab = false;

function drawTabs(counts, active) {
  if (!tabsEl) return;
  renderTabs(tabsEl, {
    tabs: visibleTabs({ desk: deskEnabled(), greek: greekSearchEnabled() }),
    counts,
    active,
    onPick: pickTab,
  });
  if (refocusTab) {
    refocusTab = false;
    tabsEl.querySelector('[aria-selected="true"]')?.focus();
  }
}

/** The count at the field's right end: the chosen tab's (null: none to say). */
function setCount(n) {
  if (countEl) countEl.textContent = typeof n === "number" ? resultsCount(n) : "";
}

function pickTab(id) {
  refocusTab = true;
  if (id === "notebook") {
    notebookTab = true;
    if (lastSearchCache) renderFromCache();
    return;
  }
  notebookTab = false;
  if (modeSelect) setPickedMode(modeSelect, modeForTab(id));
  if (id === "greek" || !lastSearchCache || lastSearchCache.greekOnly) {
    updateFromControls({ resetPage: true, push: true });
    // The first time the reader picks the Greek, the builder opens itself
    // beside the box, once, without taking focus (BVJ, 2026-10-14).
    if (id === "greek" && greekSearchEnabled()) {
      withCommands().then((m) => m.openGreekCommandsOnce({ field: input, typeSelect: modeSelect }));
    }
    return;
  }
  writeState({ ...readState(), mode: modeForTab(id), page: 1 }, { push: true });
  syncGreekChrome();
  renderFromCache();
}

// "Build a search…" (Study preview): one quiet link in the field's row, shown
// only while the Greek tab is chosen, and the box suggests commands there
// (GK-34 to GK-39). Notebook actions follows it in that row (SE-23); "Notes"
// joins the tab row's tools.
const GREEK_PLACEHOLDER = "Try πίστις.gen or *.aor.impv";
const defaultPlaceholder = input ? input.placeholder : "";
const buildBtn = searchRoot?.querySelector("[data-build-search]") ?? null;
buildBtn?.addEventListener("click", () => openCommands());

// "Notes" (E11): whether a Greek search lists the reader's matching notes
// above the Greek (BA40). Shown only with the Study part loaded, the type
// "All types" (the one place notes are listed) and a Greek search under way.
// The choice is the desk's own, remembered in storage (desk/notebook-search.js),
// and changing it redraws the page from what is already fetched.
let deskMod = null;
let notesSwitch = null;
let notesBox = null;
if (input && greekSearchEnabled() && toolsEl) {
  loadDeskSearch()?.then((m) => {
    if (!m) return;
    deskMod = m;
    // The quiet "Notebook actions" button (E31): the Notebook and page commands,
    // in a window of their own (desk/commands-window.js), apart from the Greek's.
    const actions = document.createElement("button");
    actions.type = "button";
    actions.className = "kit-btn kit-btn--plain searchbar__actions";
    actions.textContent = "Notebook actions";
    actions.setAttribute("aria-haspopup", "dialog");
    actions.addEventListener("click", () => {
      m.openCommands({ anchor: input.closest("form") ?? input, opener: actions });
    });
    // It sits in the field's row (SE-23), after "Build a search…" and before
    // the phone's submit; "Notes" filters the Greek's results, so it joins
    // the book menu and the sort.
    const form = input.closest("form");
    if (form) form.insertBefore(actions, form.querySelector(".searchbar__submit"));
    else toolsEl.append(actions);
    notesSwitch = m.greekNotesSwitch();
    notesBox = notesSwitch.querySelector("input");
    notesSwitch.classList.add("search-tools__notes");
    toolsEl.append(notesSwitch);
    notesBox.addEventListener("change", () => {
      deskMod.setGreekNotes(notesBox.checked);
      if (lastSearchCache?.greekOnly) renderFromCache();
    });
    // Another tab or the tray changed it.
    window.addEventListener("storage", (e) => {
      if (e.key !== deskMod.GREEK_NOTES_KEY && e.key !== null) return;
      syncGreekChrome();
      if (lastSearchCache?.greekOnly) renderFromCache();
    });
    syncGreekChrome();
  });
}

function syncGreekChrome() {
  if (!input || !greekSearchEnabled()) return;
  const greekType = modeSelect?.value === "greek";
  const greekSearch = greekType || isGreekQuery(input.value);
  if (buildBtn) buildBtn.hidden = !greekSearch;
  input.placeholder = greekType ? GREEK_PLACEHOLDER : defaultPlaceholder;
  if (notesSwitch) {
    // Under all types only: a Greek-letter query reads "Greek" in the menu
    // while the reader's own pick is still all types.
    notesSwitch.hidden = !(
      greekSearch &&
      (modeSelect ? pickedMode(modeSelect) || "all" : "all") === "all"
    );
    notesBox.checked = deskMod.greekNotesOn();
  }
}

function syncControlsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const { q, book, sort, mode } = readState();

  if (input && input.value !== q) input.value = q;

  if (bookSelect) bookSelect.value = book;

  if (modeSelect) {
    addGreekMode(modeSelect);
    if (params.has("mode")) setPickedMode(modeSelect, mode);
    // A Greek-letter or Strong's query reads "Greek" in the menu.
    showModeFor(modeSelect, q);
  }

  setActiveSort(sort);
  syncGreekChrome();
}

async function verifyPagefindAssets() {
  const entryUrl = `${base}pagefind/pagefind-entry.json`;

  const entryRes = await fetch(entryUrl, { cache: "no-store" });
  if (!entryRes.ok) {
    throw new Error(`Pagefind entry missing (${entryRes.status}): ${entryUrl}`);
  }

  const entry = await entryRes.json();
  const langs = entry?.languages || {};

  const docLang = (document.documentElement.lang || "").toLowerCase();
  const lang = langs[docLang] || Object.values(langs)[0];

  if (!lang?.hash || !lang?.wasm) {
    throw new Error("Pagefind entry missing language hash/wasm.");
  }

  const metaUrl = `${base}pagefind/pagefind.${lang.hash}.pf_meta`;
  const wasmUrl = `${base}pagefind/wasm.${lang.wasm}.pagefind`;

  const [metaRes, wasmRes] = await Promise.all([
    fetch(metaUrl, { cache: "no-store" }),
    fetch(wasmUrl, { cache: "no-store" }),
  ]);

  if (!metaRes.ok)
    throw new Error(`Missing meta (${metaRes.status}): ${metaUrl}`);
  if (!wasmRes.ok)
    throw new Error(`Missing wasm (${wasmRes.status}): ${wasmUrl}`);
}

async function loadPagefind() {
  if (pagefindMod) return pagefindMod;

  await verifyPagefindAssets();

  pagefindMod = await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`);

  await pagefindMod.options?.({
    basePath: `${base}pagefind/`,
    baseUrl: base === "/" ? "/" : base.replace(/\/$/, ""),
  });

  await pagefindMod.init?.();
  return pagefindMod;
}

// Build a deep link to the nearest anchor at/before the first match.
async function hrefToFirstMatch(result) {
  const d = await result.data();

  const locs = getMatchLocations(d);
  const url = pickAnchorHref(d, locs);

  return { url, data: d, locs };
}

// ---- Sorting: book/chapter order (optional) ----
function bookIndex(bookKey) {
  return BOOK_RANK.get(bookKey) ?? 9999;
}

function compareByBookOrder(a, b) {
  const pa = parseBookChapterFromUrl(a?.url || "");
  const pb = parseBookChapterFromUrl(b?.url || "");

  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;

  const ia = bookIndex(pa.bookKey);
  const ib = bookIndex(pb.bookKey);
  if (ia !== ib) return ia - ib;

  if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter;

  // Within the same page, sort by occurrence position
  const oa = a.__occurrenceIndex ?? 0;
  const ob = b.__occurrenceIndex ?? 0;
  if (oa !== ob) return oa - ob;

  return String(a.url || "").localeCompare(String(b.url || ""));
}

function sortMaybe(items, sort) {
  if (sort === "order") return [...items].sort(compareByBookOrder);
  // Relevance: restore original Pagefind result order (lowest rank = most relevant)
  return [...items].sort(
    (a, b) => (a.__relevanceRank ?? 9999) - (b.__relevanceRank ?? 9999),
  );
}

// ---- Glossary: show ONLY the matched term, no excerpt, no <mark> ----
function displayQueryLabel(qRaw) {
  const q = String(qRaw || "").trim();
  if (!q) return "";
  if (isExplicitlyQuoted(q)) return q.slice(1, -1).trim();
  return q;
}

// `items` are enriched entries ({ d, locs, ... }) so the term
// label derives from the same anchor computation as the deep link.
function renderGlossary(items, qPhrase) {
  glossaryEl.innerHTML = items
    .map((it) => titleRowHtml({ title: glossaryTermFromResult(it.d, it.locs, qPhrase), href: it.d.url }))
    .join("");
}

// `topicLabels` maps a chapter's URL to the topic labels that matched it. A
// row names them ("Matthew 18 · debt forgiveness") when they say something
// the query doesn't, which is the case for a loose one-word match; a label
// that is just the query repeated is left off.
function renderSubject(items, topicLabels, qPhrase) {
  subjectEl.innerHTML = items
    .map((r) => {
      const at = parseBookChapterFromUrl(r.url || "");
      const labels = (topicLabels?.get(r.url) || []).filter(
        (label) => normalizePhrase(label) !== qPhrase,
      );
      return titleRowHtml({
        title: prettyTitleFromUrl(r.url, r.meta?.title || r.title || "Result"),
        href: r.url,
        aside: labels.join(", "),
        ref: at?.chapter ? { bookKey: at.bookKey, chapter: at.chapter } : null,
      });
    })
    .join("");
}

// One row for each verse: its reference, then the verse as reading, with its
// matches marked. A book's name stands over its verses in Bible order only.
function renderKeyword(items) {
  const verses = items.map((r) => ({
    bookKey: r.__ref.bookKey,
    bookLabel: bookKeyToLabel(r.__ref.bookKey),
    label: r.__label,
    href: r.url,
    html: r.__html,
    ref: r.__ref,
  }));
  keywordEl.innerHTML = verseRowsHtml(verses, { bibleOrder: readState().sort === "order" });
}

function renderArticles(items) {
  articlesEl.innerHTML = items
    .map((r) => titleRowHtml({ title: r.meta?.title || r.title || "Result", href: r.url }))
    .join("");
}

function renderIntros(items) {
  introsEl.innerHTML = items
    .map((r) =>
      titleRowHtml({
        // "Mark — Introduction", never the bare page title, so intro hits
        // can't read as scripture chapter results.
        title: scriptureResultTitle(r.url, r.meta?.title || r.title || "Introduction"),
        href: r.url,
        // Pagefind's excerpt (escaped text with <mark> around the matches), so a
        // reader can see why this introduction came up.
        excerptHtml: r.excerpt ? String(r.excerpt) : "",
      }),
    )
    .join("");
}

function setPager(total, page) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const show = total > pageSize;
  pagerEl.hidden = !show;
  pagerEl.innerHTML = "";

  if (!show) return;

  // Build the list of page numbers to display (with ellipsis gaps)
  const pageNums = buildPageRange(page, pages);

  const make = (label, { current = false, disabled = false, go = null } = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `kit-btn ${current ? "kit-btn--tinted" : "kit-btn--plain"}`;
    btn.textContent = label;
    btn.disabled = disabled;
    if (current) btn.setAttribute("aria-current", "page");
    else if (go != null) btn.addEventListener("click", () => setPage(go));
    return btn;
  };

  pagerEl.appendChild(make("Previous", { disabled: page <= 1, go: page - 1 }));

  // Numbered page buttons / ellipsis
  for (const entry of pageNums) {
    if (entry === "…") {
      const span = document.createElement("span");
      span.className = "search-pager__gap";
      span.textContent = "…";
      span.setAttribute("aria-hidden", "true");
      pagerEl.appendChild(span);
    } else {
      pagerEl.appendChild(make(String(entry), { current: entry === page, go: entry }));
    }
  }

  pagerEl.appendChild(make("Next", { disabled: page >= pages, go: page + 1 }));
}

/**
 * Build a compact page-number array like [1, "…", 4, 5, 6, "…", 9].
 * Always shows first, last, and a window around current page.
 */
function buildPageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set();
  pages.add(1);
  pages.add(total);

  // Window of 1 around current page
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("…");
    }
    result.push(sorted[i]);
  }

  return result;
}

// -----------------------
// The Greek (Study Desk preview, STUDY-DESK.md 1h)
// -----------------------
// The verses where the query's Greek word occurs: each with its Greek (the
// matched word marked), that word's parsing in words, and the LIT verse
// beneath. It exists only with the preview on (greekSearchEnabled), and it is
// the ONLY thing a Greek search shows (BVJ, 2026-10-13): a query with Greek
// letters or a Strong's number is searched in the Greek alone, and any other
// query only when the reader picks the "Greek" type. Otherwise nothing here
// runs or is fetched.
//
// One lemma's verses show at a time, ten to a page in the same pager as the
// English verses. When the query reaches several lemmas, the first is shown
// and the rest are offered as choices; the choice and "exact form only" are
// kept while the query stays the same.

let greekChoice = { q: "", lemmaId: null, exact: false };
let greekSeq = 0;

/**
 * The Greek search for this page: one lemma's verses, the first lemma's if
 * none was chosen; or, for a command query ("πίστις.gen", "*.aor.impv"), the
 * verses where it matches (kind "commands").
 */
async function fetchGreek(q, book, lemmaId, exact) {
  const opts = { bookKey: book, exactForm: exact };
  const mod = await withGreek();
  if (!mod) throw new Error("the Greek search module wouldn’t load");
  const { searchGreekAuto } = mod;
  let result = await searchGreekAuto(base, q, { ...opts, lemmaId });
  if (result.kind !== "commands" && !result.selected && result.lemmas.length) {
    result = await searchGreekAuto(base, q, { ...opts, lemmaId: result.lemmas[0].id });
  }
  return result;
}

/** Whether this query is searched in the Greek alone: Greek letters or a Strong's number, or the Greek type. */
function wantsGreekOnly(q, mode) {
  return greekSearchEnabled() && (mode === "greek" || isGreekQuery(q));
}

/**
 * The verse's Greek as escaped HTML with the hit's words marked (every word of
 * a command match, else the one word), and those words with their parsing.
 */
function greekVerseParts(data, hit) {
  return gk.verseGreek(data, hit.verse, hit.marked ?? [hit.t], escapeHtml);
}

/** Rows [from, to) of the current Greek hits, their Greek filling in as the chapters arrive. */
function appendGreekRows(from, to, token) {
  const cache = lastSearchCache;
  const hits = cache.greek.hits.slice(from, to);
  const verses = cache.verseIndex?.verses;
  const pending = new Map(); // "john-3" -> [{ hit, greekLine, parseLine }]

  for (const hit of hits) {
    const li = document.createElement("li");
    li.className = "result greek-row";

    const card = document.createElement("div");
    card.className = "greek-card";

    const ref = document.createElement("a");
    ref.className = "greek-ref";
    ref.href = hit.href;
    ref.textContent = hit.label;

    const greekLine = document.createElement("div");
    greekLine.className = "result-excerpt greek-text";
    greekLine.lang = "grc";

    const parseLine = document.createElement("div");
    parseLine.className = "greek-parse";
    parseLine.hidden = true;

    card.append(ref, greekLine, parseLine);

    const litText = verses?.[hit.book]?.[hit.chapter]?.[hit.verse - 1];
    if (litText) {
      const lit = document.createElement("div");
      lit.className = "result-excerpt greek-lit";
      lit.innerHTML = `<sup>${hit.verse}</sup>&nbsp;${escapeHtml(litText)}`;
      card.append(lit);
    }

    li.append(card);
    greekEl.append(li);

    const key = `${hit.book}-${hit.chapter}`;
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push({ hit, greekLine, parseLine });
  }

  for (const rows of pending.values()) {
    const { book, chapter } = rows[0].hit;
    gk.loadGreekChapter(base, book, chapter).then((data) => {
      if (token !== greekSeq) return;
      for (const { hit, greekLine, parseLine } of rows) {
        const { html, words } = data ? greekVerseParts(data, hit) : { html: "", words: [] };
        if (!html) {
          greekLine.remove();
          continue;
        }
        greekLine.innerHTML = html;
        if (hit.marked) {
          // A command match: each marked word, named, with its parsing.
          words.forEach((w, i) => {
            if (i) parseLine.append(" · ");
            const form = document.createElement("span");
            form.lang = "grc";
            form.textContent = w.form;
            parseLine.append(form, `: ${w.said}`);
          });
          parseLine.hidden = !words.length;
        } else if (words[0]?.said) {
          parseLine.textContent = words[0].said;
          parseLine.hidden = false;
        }
      }
    });
  }
}

/**
 * The status line when a Greek file wouldn’t load, with a way to ask again:
 * the loaders forget what failed, so the same search runs afresh (GK3-9).
 */
function writeGreekFailed(text) {
  statusEl.textContent = text;
  appendRetry();
}

/**
 * A Try again button at the end of the status line: the same search, run
 * afresh. For a Greek file and for the verse index (Audit 8, GF8a-3), whose
 * loaders both forget a failure.
 */
function appendRetry() {
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "kit-inline";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => updateFromControls({ resetPage: false }));
  statusEl.append(" ", retry);
}

/** The status line of a Greek search: the count alone. */
function writeGreekStatus() {
  const c = lastSearchCache;
  const greek = c?.greek;
  if (!greek) return;
  const word = greek.selected
    ? `<span lang="grc">${escapeHtml(greek.selected.lemma)}</span>`
    : "";
  // A file that wouldn’t load is checked first: with no lemmas it is not "no match" (GK6-1).
  if (greek.failed) {
    writeGreekFailed(greek.lemmas.length ? "The verses couldn’t be loaded." : "The Greek search couldn’t be loaded.");
  } else if (!greek.lemmas.length) {
    statusEl.textContent = `No Greek words match “${c.displayQ}.”`;
  } else if (!greek.total) {
    statusEl.innerHTML = `No occurrences of ${word} in the selected book.`;
  } else {
    statusEl.innerHTML = `${greek.total} Greek occurrence${greek.total === 1 ? "" : "s"} of ${word}`;
  }
}

/* ── Searching the Greek with commands (STUDY-DESK.md, 2a) ──
   "πίστις.gen, Ἰησοῦς/Χριστός.gen" and "*.aor.impv" show the query said back,
   then the verses where it matches with every matched word marked. The window
   that lists the commands (greek-commands.js) is opened from here, and its
   examples and the "See search commands" buttons fill the room an empty or
   failed search leaves. */

function openCommands({ filter = null, focus = true } = {}) {
  withCommands().then((m) => m.openGreekCommands({ field: input, filter, focus, typeSelect: modeSelect }));
}

/** Put a query in the box in the Greek type and run it, as typing it would. */
function runGreekQuery(query) {
  if (modeSelect && modeSelect.value !== "greek") setPickedMode(modeSelect, "greek");
  if (input) {
    input.value = query;
    input.focus({ preventScroll: true });
  }
  updateFromControls({ resetPage: true, push: true });
}

/**
 * What fills the Greek group when there is nothing to list: a line to say
 * why, an error with its suggestion, three examples, and the way to the
 * window. `stale()` says a newer search has drawn since.
 */
async function drawGreekHelp({ lead = "", error = null, examples = true }, stale = () => false) {
  // The empty Greek type draws this before any search has loaded the Greek.
  const g = await withGreek();
  if (stale() || !g) return;
  const frag = document.createDocumentFragment();
  if (error) {
    const msg = g.errorMessage(error);
    const p = document.createElement("p");
    p.className = "greek-help__error";
    const at = msg.suggest ? msg.text.lastIndexOf(`${msg.suggest}?`) : -1;
    if (at >= 0) {
      const fix = document.createElement("button");
      fix.type = "button";
      fix.className = "kit-inline";
      fix.textContent = msg.suggest;
      fix.addEventListener("click", () => {
        input.value = g.replaceWord(input.value, msg.replace, msg.suggest);
        updateFromControls({ resetPage: true, push: true });
        input.focus({ preventScroll: true });
      });
      p.append(msg.text.slice(0, at), fix, msg.text.slice(at + msg.suggest.length));
    } else {
      p.textContent = msg.text;
    }
    frag.append(p);
    frag.append(
      g.commandsLinkButton("Build a search…", () => openCommands({ filter: msg.filter ?? null })),
    );
  } else {
    if (lead) {
      const p = document.createElement("p");
      p.className = "greek-help__lead";
      p.textContent = lead;
      frag.append(p);
    }
    if (examples) frag.append(g.exampleList(g.EXAMPLES.slice(0, 3), runGreekQuery));
    frag.append(g.commandsLinkButton("Build a search…", () => openCommands()));
  }
  greekHelpEl.replaceChildren(frag);
  greekHelpEl.hidden = false;
}

function clearGreekHelp() {
  greekHelpEl.hidden = true;
  greekHelpEl.replaceChildren();
}

/** The Greek type with nothing typed: the examples, where the results would be. */
function showGreekStart() {
  const token = ++greekSeq;
  drawTabs({}, "greek");
  setCount(null);
  groupGreek.hidden = false;
  greekLemmasEl.hidden = true;
  greekExactEl.hidden = true;
  drawGreekHelp(
    { lead: "Search the Greek by word, form, parsing, or several words together." },
    () => token !== greekSeq,
  );
}

/** A command search's page: the query said back, then its verses, or why there are none. */
function renderGreekCommands() {
  const greek = lastSearchCache.greek;
  hideResultGroups();
  showGreekNotebook();
  const token = ++greekSeq;
  const stale = () => token !== greekSeq;
  setRefBanner("", false);
  drawTabs({}, "greek");
  setCount(greek.hits?.length ?? null);
  groupGreek.hidden = false;
  greekExactEl.hidden = true;
  greekLemmasEl.removeAttribute("role");
  greekLemmasEl.removeAttribute("aria-label");
  greekLemmasEl.replaceChildren();
  greekLemmasEl.hidden = true;
  clearGreekHelp();

  if (greek.error) {
    announceGreek(null);
    setStatus(gk.errorMessage(greek.error).text);
    drawGreekHelp({ error: greek.error }, stale);
    return;
  }
  if (greek.failed) {
    announceGreek(null);
    writeGreekFailed("The Greek search couldn’t be loaded.");
    return;
  }
  if (!greek.resolved) {
    announceGreek(null);
    setStatus("Type a search.");
    drawGreekHelp({ lead: "Search the Greek by word, form, parsing, or several words together." }, stale);
    return;
  }

  const green = (s) => `<span lang="grc">${escapeHtml(s)}</span>`;
  const readback = document.createElement("p");
  readback.className = "greek-readback";
  readback.innerHTML = `${gk.describeGreekQuery(greek.resolved, { greek: green, text: escapeHtml })} · ${escapeHtml(gk.countLine(greek.hits))}`;
  greekLemmasEl.append(readback);
  greekLemmasEl.hidden = false;

  if (!greek.hits.length) {
    announceGreek(null);
    setStatus("No verses match that search.");
    drawGreekHelp({ lead: "No verses match that search. Try one of these." }, stale);
    return;
  }
  setStatus(gk.countLine(greek.hits));

  const total = greek.hits.length;
  const pages = Math.ceil(total / pageSize);
  const page = Math.min(readState().page, pages);
  appendGreekRows((page - 1) * pageSize, page * pageSize, token);
  setPager(total, page);
  announceGreek(greek);
}

/**
 * The reader's notes that match a Greek search, above the Greek on its first
 * page (BA40). Call after hideResultGroups, which empties the group.
 */
function showGreekNotebook() {
  const { notebook, deskApi } = lastSearchCache || {};
  if (!deskApi || !notebook?.total || readState().page !== 1) return;
  // "My notes" unchecked (E11): the Greek alone.
  if (!deskApi.greekNotesOn()) return;
  groupNotebook.hidden = false;
  groupNotebook.querySelector(".group-title").textContent = notebook.title ?? "My Notebook";
  deskApi.renderPageGroup(notebookEl, notebook);
}

/** A Greek search's whole page: its group alone, its pager, no sort control, no jump links. */
function renderGreekOnly() {
  if (lastSearchCache.greek?.kind === "commands") {
    renderGreekCommands();
    return;
  }
  clearGreekHelp();
  const greek = lastSearchCache.greek;
  hideResultGroups();
  showGreekNotebook();
  const token = ++greekSeq;
  setRefBanner("", false);
  drawTabs({}, "greek");
  writeGreekStatus();
  setCount(greek?.total ?? null);
  if (!greek || !greek.lemmas.length) {
    announceGreek(null);
    return;
  }

  groupGreek.hidden = false;

  // Which lemma: named when the query reaches one, a choice when it reaches several.
  const lemmaHtml = (item) =>
    `<span lang="grc">${escapeHtml(item.lemma)}</span>${escapeHtml(gk.lemmaLine(item).slice(item.lemma.length))}`;
  greekLemmasEl.replaceChildren();
  greekLemmasEl.removeAttribute("role");
  greekLemmasEl.removeAttribute("aria-label");
  greekLemmasEl.hidden = !greek.lemmas.length;
  if (greek.lemmas.length === 1) {
    const one = document.createElement("p");
    one.className = "greek-lemma-one";
    one.innerHTML = lemmaHtml(greek.lemmas[0]);
    greekLemmasEl.append(one);
  } else if (greek.lemmas.length > 1) {
    greekLemmasEl.setAttribute("role", "group");
    greekLemmasEl.setAttribute("aria-label", "Greek words matching your search");
    for (const item of greek.lemmas) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "greek-lemma-btn";
      btn.setAttribute("aria-pressed", item.id === greek.selected?.id ? "true" : "false");
      btn.innerHTML = lemmaHtml(item);
      btn.addEventListener("click", () => chooseGreek({ lemmaId: item.id }));
      greekLemmasEl.append(btn);
    }
  }

  // "Exact form only" means something for a Greek query whose lemma has other forms.
  greekExactEl.hidden = !(greek.kind === "greek" && greek.otherForms);
  greekExactInput.checked = greekChoice.exact;

  greekEl.replaceChildren();
  if (!greek.total) {
    announceGreek(null);
    return;
  }

  const pages = Math.ceil(greek.total / pageSize);
  const page = Math.min(readState().page, pages);
  appendGreekRows((page - 1) * pageSize, page * pageSize, token);
  setPager(greek.total, page);
  announceGreek(greek);
}

/** The reader chose a lemma or flipped "exact form only": search the Greek again, nothing else. */
async function chooseGreek({ lemmaId = null, exact = greekChoice.exact } = {}) {
  const cache = lastSearchCache;
  if (!cache?.greek) return;
  const { q, book } = readState();
  const id = lemmaId ?? cache.greek.selected?.id ?? null;
  greekChoice = { q, lemmaId: id, exact };
  const chose = lemmaId != null;
  let next;
  try {
    next = await fetchGreek(q, book, id, exact);
  } catch (err) {
    console.warn("[search] Greek search failed:", err);
    return;
  }
  // Another choice, or a new search, got there first.
  if (lastSearchCache !== cache || greekChoice.exact !== exact || greekChoice.lemmaId !== id) return;
  cache.greek = next;
  // A different word or form is a different list: back to its first page.
  writeState({ ...readState(), page: 1 });
  renderGreekOnly();
  if (chose) greekLemmasEl.querySelector('[aria-pressed="true"]')?.focus();
}

greekExactInput?.addEventListener("change", () => {
  chooseGreek({ exact: greekExactInput.checked });
});

/**
 * The count goes at the field's end; the status line keeps what a count
 * can't say: a typo-corrected verse search says which word it used, and a
 * verse index that didn't load says so, with a way to ask again.
 */
function writeCountStatus() {
  const c = lastSearchCache;
  if (!c) return;
  const said =
    c.keywordCorrection && c.keywordTotal
      ? `Showing results for “${c.keywordCorrection}.”`
      : "";
  setStatus(c.versesFailed ? VERSES_FAILED : said);
  if (c.versesFailed) appendRetry();
}

// The results on screen, for anything that works on all of them rather than
// the page showing (the Study Desk's "make a sheet", desk/sheets/search-sheet.js).
// `verses` are every verse hit, `chapters` every chapter by topic, and
// `greek` every Greek hit, not just the page on screen. Nothing here knows
// who listens.
let lastResultsDetail = null;

function announceResults(detail) {
  lastResultsDetail = detail;
  document.dispatchEvent(new CustomEvent("lit:search-results", { detail }));
}

/**
 * A Greek search's results (null: none). `greek` holds a verse once for each
 * word matched in it, and `greekWord` is what they were found for, to name
 * them by: the Greek word shown, the form typed under "Exact form only", or
 * a command as typed.
 */
function announceGreek(greek) {
  const typed = lastSearchCache?.displayQ ?? "";
  const asTyped = !greek || greek.kind === "commands" || (greek.kind === "greek" && greekChoice.exact);
  announceResults({
    query: typed,
    verses: [],
    chapters: [],
    greek: (greek?.hits ?? []).map((h) => ({ bookKey: h.book, chapter: h.chapter, verse: h.verse })),
    greekWord: asTyped ? typed : (greek.selected?.lemma ?? typed),
  });
}

function renderFromCache() {
  const { page, sort, mode, q } = readState();
  if (!lastSearchCache) return;

  // A Greek search shows the Greek and nothing else.
  if (lastSearchCache.greekOnly) {
    renderGreekOnly();
    return;
  }
  // Nothing of an earlier Greek search stays on an English one.
  groupGreek.hidden = true;
  greekSeq++;
  greekEl.replaceChildren();
  clearGreekHelp();

  const {
    displayQ,
    glossaryMatches,
    subjectMatchesRaw,
    subjectTopicLabels,
    articleMatchesRaw,
    introMatchesRaw,
    keywordMatchesRaw,
    notebook,
    deskApi,
    qPhrase,
  } = lastSearchCache;

  // Topics always display in canonical book order
  const subjectMatches = [...subjectMatchesRaw].sort(compareByBookOrder);
  const articleMatches = sortMaybe(articleMatchesRaw, sort);
  // Intros are already Bible-ordered by the shared bucketing.
  const introMatches = introMatchesRaw || [];
  const keywordMatchesAll = sortMaybe(keywordMatchesRaw, sort);

  // Every tab has its count, so each is searched, whichever is chosen (SE-07).
  const counts = {
    keyword: keywordMatchesAll.length,
    subject: subjectMatches.length,
    glossary: glossaryMatches.length,
    article: articleMatches.length,
    intro: introMatches.length,
    // The reader's own notebook (D2), searched in the browser; only with the
    // Study preview on.
    notebook: deskApi ? (notebook?.total ?? 0) : 0,
  };
  const keywordTotal = counts.keyword;
  const baseTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  lastSearchCache.baseTotal = baseTotal;
  lastSearchCache.keywordTotal = keywordTotal;

  const parsedJump = parseReferenceJump(q);
  setRefBanner(referenceAnswerHtml(parsedJump), Boolean(parsedJump));

  // The page opens on Scripture, or the first tab with results (SE-08).
  let active = notebookTab && deskApi ? "notebook" : tabForMode(mode) || openingTab(counts);
  if (active === "greek") active = openingTab(counts);
  lastSearchCache.active = active;
  drawTabs(counts, active);

  if (baseTotal === 0) {
    setCount(null);
    announceResults({ query: displayQ, verses: [], chapters: [] });
    // Always replace the "Searching for…" line, which otherwise stayed on
    // screen after a search that found nothing. A recognized reference needs
    // no line at all: the answer above already offers its jump.
    statusEl.innerHTML = parsedJump
      ? ""
      : lastSearchCache.versesFailed
        ? VERSES_FAILED
        : `No results for “${escapeHtml(displayQ)}.”`;
    if (!parsedJump && lastSearchCache.versesFailed) appendRetry();
    hideResultGroups();
    if (parsedJump || lastSearchCache.versesFailed) return;

    const qNorm = normalizePhrase(displayQ);
    const wire = () =>
      statusEl.querySelectorAll("[data-suggest]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (input) input.value = btn.dataset.suggest;
          updateFromControls({ resetPage: true, push: true });
        });
      });
    if (qNorm.includes(" ")) {
      const words = qNorm.split(/\s+/).filter((w) => w.length >= MIN_QUERY_LEN);
      if (words.length >= 2) {
        const wordLinks = words
          .map(
            (w) =>
              `<button type="button" class="kit-inline" data-suggest="${escapeHtml(w)}">${escapeHtml(w)}</button>`,
          )
          .join(" · ");
        statusEl.innerHTML = `No results for the exact phrase “${escapeHtml(displayQ)}.” Try: ${wordLinks}`;
        wire();
      }
    }

    if (cachedTopicsList) {
      const suggestions = fuzzyTopicSuggestions(
        normalizePhrase(displayQ),
        cachedTopicsList,
        3,
      );
      if (suggestions.length) {
        const sugLinks = suggestions
          .map(
            (s) =>
              `<button type="button" class="kit-inline" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`,
          )
          .join(" · ");
        statusEl.innerHTML = `${statusEl.innerHTML}<br>Did you mean: ${sugLinks}`;
        wire();
      }
    }
    return;
  }

  writeCountStatus();
  setCount(counts[active]);

  // One group shows, the chosen tab's; the others are emptied.
  const groups = {
    keyword: groupKeyword,
    subject: groupSubject,
    glossary: groupGlossary,
    article: groupArticles,
    intro: groupIntros,
    notebook: groupNotebook,
  };
  for (const [id, el] of Object.entries(groups)) el.hidden = id !== active;
  for (const el of [glossaryEl, subjectEl, introsEl, articlesEl, keywordEl]) el.innerHTML = "";
  if (linesEl) linesEl.innerHTML = "";
  if (active !== "notebook") {
    notebookEl.innerHTML = "";
    groupNotebook.querySelector(".desk-see-more")?.remove();
  }
  const empty = (listEl, what) => {
    listEl.innerHTML = `<li class="search-row search-row--empty">Nothing in ${what} matches “${escapeHtml(displayQ)}.”</li>`;
  };

  if (active === "glossary") {
    if (counts.glossary) renderGlossary(glossaryMatches.slice(0, 50), qPhrase);
    else empty(glossaryEl, "the glossary");
  } else if (active === "subject") {
    if (counts.subject) renderSubject(subjectMatches.slice(0, 50), subjectTopicLabels, qPhrase);
    else empty(subjectEl, "the chapters");
  } else if (active === "intro") {
    if (counts.intro) renderIntros(introMatches.slice(0, 27));
    else empty(introsEl, "the introductions");
  } else if (active === "article") {
    if (counts.article) renderArticles(articleMatches.slice(0, 20));
    else empty(articlesEl, "the articles");
  } else if (active === "notebook") {
    groupNotebook.querySelector(".group-title").textContent = notebook?.title ?? "Notebook";
    if (counts.notebook && deskApi) deskApi.renderPageGroup(notebookEl, notebook);
    else empty(notebookEl, "your notebook");
  } else {
    // Scripture paging applies to the verses alone.
    const start = (page - 1) * pageSize;
    if (counts.keyword) renderKeyword(keywordMatchesAll.slice(start, start + pageSize));
    else empty(keywordEl, "the Scripture");
    // Over the verses, the glossary line, since the glossary still answers
    // first, then the chapters line (SE-21, SE-20). The glossary's is only
    // for an entry whose own word is what was typed (glossaryLineTerm).
    if (page === 1 && linesEl) {
      const bits = [];
      if (counts.glossary) {
        const terms = glossaryTermsFromDom() ?? {};
        const named = glossaryMatches
          .map((g) => {
            const id = decodeURIComponent(String(g.d?.url || "").split("#")[1] || "");
            const term = glossaryLineTerm(displayQ, terms[id]);
            return term ? { term, href: g.d.url } : null;
          })
          .filter(Boolean);
        if (named.length) {
          bits.push(`<p class="search-line">${glossaryLineHtml({ term: named[0].term, href: named[0].href, count: named.length })}</p>`);
        }
      }
      if (counts.subject) {
        const first = prettyTitleFromUrl(subjectMatches[0].url, subjectMatches[0].meta?.title || "Result");
        bits.push(`<p class="search-line">${chaptersLineHtml({ first, count: counts.subject, query: displayQ })}</p>`);
      }
      linesEl.innerHTML = bits.join("");
      linesEl.querySelector("[data-line-tab]")?.addEventListener("click", (e) => {
        e.preventDefault();
        pickTab(e.currentTarget.dataset.lineTab);
      });
    }
  }

  setPager(active === "keyword" ? keywordTotal : 0, page);

  announceResults({
    query: displayQ,
    verses: active === "keyword" ? keywordMatchesAll.map((r) => r.__ref).filter(Boolean) : [],
    chapters:
      active === "subject" && counts.subject
        ? subjectMatches
            .map((r) => {
              const at = parseBookChapterFromUrl(r.url || "");
              return at?.chapter ? { ...at, labels: subjectTopicLabels?.get(r.url) || [] } : null;
            })
            .filter(Boolean)
        : [],
  });
}

function clearResults() {
  hideResultGroups();
  lastSearchCache = null;
  setCount(null);
  drawTabs({}, notebookTab && deskEnabled() ? "notebook" : tabForMode(readState().mode) || "keyword");
  // No results now, so nothing of the last search's stays checked.
  if (lastResultsDetail?.query) announceResults({ query: "", verses: [], chapters: [], greek: [] });
}

/** Hides every result group and the pager, keeping the search cache. */
function hideResultGroups() {
  groupNotebook.hidden = true;
  notebookEl.innerHTML = "";
  groupNotebook.querySelector(".desk-see-more")?.remove();
  groupGlossary.hidden = true;
  groupSubject.hidden = true;
  groupIntros.hidden = true;
  groupArticles.hidden = true;
  groupKeyword.hidden = true;
  groupGreek.hidden = true;
  greekSeq++;
  greekEl.replaceChildren();
  clearGreekHelp();
  if (linesEl) linesEl.innerHTML = "";

  glossaryEl.innerHTML = "";
  subjectEl.innerHTML = "";
  introsEl.innerHTML = "";
  articlesEl.innerHTML = "";
  keywordEl.innerHTML = "";

  setPager(0, 1);
}

// The offer (BVJ, 2026-11-04): a single Latin word that is also a Greek one
// ("pistis") searches as English, and one line under the status offers the
// Greek search. It lists no Greek itself, and is not live: it adds no
// announcement to the status's.
let greekOfferEl = null;
let offerSeq = 0;
async function syncGreekOffer(q, mode) {
  const mySeq = ++offerSeq;
  if (greekOfferEl) greekOfferEl.hidden = true;
  if (!greekSearchEnabled()) return;
  const offer = await greekOfferFor(base, q, mode);
  if (mySeq !== offerSeq || !offer) return;
  if (!greekOfferEl) {
    greekOfferEl = document.createElement("p");
    greekOfferEl.className = "greek-offer";
    statusEl.after(greekOfferEl);
  }
  greekOfferEl.replaceChildren(
    greekOfferLine(offer, () => {
      modeSelect.value = "greek";
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }),
  );
  greekOfferEl.hidden = false;
}

// ">" asks for the notebook's commands alone, as it does in the tray (SE-23,
// D3): with the Study preview they are listed where the results go, nothing
// is searched, and Enter runs the first.
let commandsEl = null;
const isCommandQuery = (text) => deskEnabled() && /^\s*>/.test(String(text || ""));

function hideCommands() {
  if (!commandsEl) return;
  commandsEl.hidden = true;
  commandsEl.replaceChildren();
}

function showCommands(m, q) {
  const commands = m.commandsFor(q);
  setStatus(commands.length
    ? `${commands.length} ${commands.length === 1 ? "command" : "commands"}`
    : "No command begins that way.");
  if (!commandsEl) {
    commandsEl = document.createElement("div");
    commandsEl.className = "search-commands";
    statusEl.after(commandsEl);
  }
  commandsEl.replaceChildren();
  m.renderTray(commandsEl, {
    commands,
    onRun: (c) => {
      m.runCommand(c.id);
      if (input) input.value = "";
      updateFromControls({ resetPage: true, push: true });
    },
  });
  commandsEl.hidden = !commands.length;
}

/** Enter on a ">" query: the first command listed, as the tray does. */
function runFirstCommand() {
  if (!commandsEl || commandsEl.hidden) return false;
  const first = commandsEl.querySelector("[data-desk-command]");
  if (!first) return false;
  first.click();
  return true;
}

async function runFullSearch() {
  const { q, book } = readState();
  const displayQ = displayQueryLabel(q);
  hideCommands();
  syncGreekOffer(q.length >= MIN_QUERY_LEN ? q : "", readState().mode);

  if (!q) {
    setStatus("Type to search.");
    setRefBanner("", false);
    clearResults();
    if (greekSearchEnabled() && readState().mode === "greek") showGreekStart();
    return;
  }

  if (isCommandQuery(q)) {
    const m = await loadDeskSearch();
    if (m && readState().q === q) {
      setRefBanner("", false);
      clearResults();
      showCommands(m, q);
      return;
    }
  }

  const parsedJump = parseReferenceJump(q);

  setRefBanner(referenceAnswerHtml(parsedJump), Boolean(parsedJump));

  // Greek words can be one or two letters (ὁ, ἐν), so a Greek query needs no minimum.
  const shortQuery = q.length < MIN_QUERY_LEN && !(greekSearchEnabled() && hasGreek(q));
  if (shortQuery && !parsedJump) {
    setStatus(`Type ${MIN_QUERY_LEN} or more letters to search.`);
    clearResults();
    return;
  }

  if (shortQuery && parsedJump) {
    setStatus("Press Enter to jump, or keep typing to search.");
    clearResults();
    return;
  }

  setStatus(`Searching for "${displayQ}"...`);

  const { mode } = readState();

  // A query with Greek letters or a Strong's number, or any query under the
  // Greek type, is searched in the Greek alone: no Pagefind, verse search,
  // topics, glossary or articles, and no counts for them. The reader's own
  // notebook is the exception (BA40, BVJ 2026-10-28): under all types, their
  // notes holding the Greek are listed above it, on its first page.
  if (wantsGreekOnly(q, mode)) {
    if (greekChoice.q !== q) greekChoice = { q, lemmaId: null, exact: false };
    const deskApi = mode === "all" ? await loadDeskSearch() : null;
    const [greek, verseIndex, notebook] = await Promise.all([
      fetchGreek(q, book, greekChoice.lemmaId, greekChoice.exact).catch((err) => {
        console.warn("[search] Greek search failed:", err);
        // The module itself wouldn’t load: a failure to retry, not "no match" (GK6-1).
        return { kind: null, lemmas: [], selected: null, hits: [], total: 0, form: null, otherForms: false, failed: true };
      }),
      loadVerseIndex(base),
      deskApi ? deskApi.search(q, { bookKey: book }).catch(() => null) : null,
    ]);
    lastSearchCache = { greekOnly: true, displayQ, greek, verseIndex, notebook, deskApi };
    renderFromCache();
    return;
  }

  // Every tab has its count, so every kind is searched whichever tab is chosen.
  // Scripture keyword search scans the verse index; Pagefind covers
  // glossary/articles. Start the verse-index fetch first so the two loads
  // overlap on first use.
  const versePromise = loadVerseIndex(base);

  const qUnquoted = displayQ;
  const qPhrase = normalizePhrase(qUnquoted);

  // A book filter routes to scripture-only results, so skip Pagefind
  // entirely then (glossary/article pages carry no book value; intro pages
  // do, but book-filtered searches stay scripture-only by design). A
  // Pagefind load failure degrades to verse-index-only results.
  let resolvedAll = [];
  if (!book) {
    try {
      const pagefind = await loadPagefind();
      const { pfQuery } = buildPfQuery(q);
      const search = await pagefind.search(pfQuery);
      resolvedAll = await Promise.all(
        search.results.map((r) => hrefToFirstMatch(r)),
      );
    } catch (err) {
      console.warn("[search] Pagefind unavailable:", err);
      resolvedAll = [];
    }
  }

  // Flat result objects (Pagefind data + anchored url + relevance rank) are
  // what the render/cache layer consumes; enrichment wraps them with the
  // match signals the shared bucketing runs on. locs are passed through from
  // hrefToFirstMatch so the anchor choice and the bucketing signals share
  // one computation.
  const enriched = resolvedAll.map(({ url, data, locs }, i) =>
    enrichSearchResult({ ...data, url, __relevanceRank: i }, i, {
      qPhrase,
      locs,
    }),
  );

  // Topic-only matches via /topics-index.json (covers subjects that aren't
  // body-indexed). Exact topic phrase first; single-token queries fall back
  // to whole-word topic matches, capped to avoid an avalanche on broad
  // tokens (e.g., "god").
  const extraSubjectItems = [];
  // Every label that matched each chapter, collected before bucketing keeps
  // only the chapter's first item, so its card can name them all.
  const subjectTopicLabels = new Map();
  const topicsData = await loadTopicsIndexOnce();
  if (topicsData) cachedTopicsList = topicsData.topicsList;
  if (topicsData && qPhrase) {
    // The matching is shared with /desk's Search pane (E166).
    const { docs, labels } = topicMatches(topicsData, qPhrase, { book });
    for (const [url, found] of labels) subjectTopicLabels.set(url, found);

    for (const doc of docs) {
      const url = String(doc.url);
      extraSubjectItems.push(
        topicsIndexSubjectItem({
          url,
          meta: {
            title: String(doc?.title || ""),
            type: String(doc?.type || ""),
            book: String(doc?.book || ""),
            chapter: doc?.chapter != null ? String(doc.chapter) : "",
            // Make the subject label work
            topics: String(doc?.topic || qPhrase || ""),
          },
          excerpt: "",
          locations: [],
        }),
      );
    }
  }

  const buckets = bucketSearchResults(enriched, { extraSubjectItems });

  // Glossary stays enriched (renderGlossary needs locs to name the matched
  // entry); the other buckets flatten to the d shape the sort/render layer
  // consumes.
  const glossaryMatches = buckets.glossary;
  const subjectMatchesRaw = buckets.subject.map((it) => it.d);
  const articleMatchesRaw = buckets.article.map((it) => it.d);
  const introMatchesRaw = buckets.intro.map((it) => it.d);

  // Scripture keyword results: one card per matching verse, shaped like the
  // occurrence cards renderKeyword groups by chapter (__baseUrl). Hits come
  // back in Bible order; __relevanceRank carries the rankVerseHits order so
  // the Relevance/Book-order sort toggle keeps both meanings.
  const verseIndex = versePromise ? await versePromise : null;
  // An index that didn't load is not "no verses match" (GF8a-3).
  const versesFailed = Boolean(versePromise) && !verseIndex;

  // The reader's notebook, when the Study Desk is on (D2): searched here in
  // the browser, and nothing about the query leaves the computer.
  const deskApi = (await loadDeskSearch()) || null;
  const notebook = deskApi
    ? await deskApi.search(q, { bookKey: book }).catch(() => null)
    : null;

  const { hits: verseHits, correction: keywordCorrection } = verseIndex
    ? searchVerses(verseIndex, q, { bookKey: book })
    : { hits: [], correction: "" };

  const relevanceRank = new Map(
    rankVerseHits(verseHits).map((h, i) => [h, i]),
  );

  const keywordCards = verseHits.map((h) => {
    const chapterTitle = `${bookKeyToLabel(h.bookKey)} ${h.chapter}`;
    return {
      url: verseHitHref(h),
      __html: highlightVerseHit(h),
      __label: `${chapterTitle}:${h.verse}`,
      meta: { title: chapterTitle },
      title: chapterTitle,
      __relevanceRank: relevanceRank.get(h) ?? 9999,
      __occurrenceIndex: h.verse,
      __baseUrl: `/${h.bookKey}-${h.chapter}`,
      __matchCount: h.runs.length,
      __ref: { bookKey: h.bookKey, chapter: h.chapter, verse: h.verse },
    };
  });

  lastSearchCache = {
    displayQ,
    qPhrase,
    glossaryMatches,
    subjectMatchesRaw,
    subjectTopicLabels,
    articleMatchesRaw,
    introMatchesRaw,
    keywordMatchesRaw: keywordCards,
    keywordCorrection,
    versesFailed,
    notebook,
    deskApi,
  };

  renderFromCache();
}

function scheduleSearch() {
  clearTimeout(debounceId);
  debounceId = setTimeout(async () => {
    try {
      await runFullSearch();
    } catch (err) {
      console.error(err);
      setStatus(`Search failed: ${err?.message || "Unknown error"}`);
      setRefBanner("", false);
      clearResults();
    }
  }, 180);
}

function updateFromControls({ resetPage = true, push = false } = {}) {
  const q = input ? input.value.trim() : "";
  const book = bookSelect ? String(bookSelect.value || "") : "";
  const sort = getActiveSort();
  const mode = modeSelect ? String(pickedMode(modeSelect) || "all") : "all";

  const current = readState();

  writeState(
    { q, book, sort, mode, page: resetPage ? 1 : current.page },
    { push },
  );
  if (modeSelect) showModeFor(modeSelect, q);
  syncGreekChrome();

  scheduleSearch();
}

// The Study Desk's "make a sheet" (M5), only with the preview on.
loadDeskSheets()?.then((m) => m?.attachSearchSheets(() => lastResultsDetail));

// Initial sync
syncControlsFromUrl();
scheduleSearch();

// Input -> URL + search
if (input) {
  input.addEventListener("input", () =>
    updateFromControls({ resetPage: true }),
  );
  // Escape and the field's clear button empty a type="search" box and fire
  // `search`, not `input`. Typing and Enter fire it too, after the URL
  // already holds the words, so only a change in the words is acted on.
  input.addEventListener("search", () => {
    if (input.value.trim() === readState().q) return;
    updateFromControls({ resetPage: true });
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    // The Enter that commits an IME or dead-key composition is not a search (GK8-2).
    if (e.isComposing || e.keyCode === 229) return;
    // The field sits in the tray's form, which has no address of its own,
    // and the field has no name: left to the browser, Enter loads /search/
    // with no query and empties the search. The tray stops it where it has
    // set itself up; this page doesn't depend on that.
    e.preventDefault();
    if (isCommandQuery(input.value) && runFirstCommand()) return;
    updateFromControls({ resetPage: true, push: true });
  });
  // The form's own submit button (on a phone) is the same Enter.
  input.closest("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isCommandQuery(input.value) && runFirstCommand()) return;
    updateFromControls({ resetPage: true, push: true });
  });
}

if (bookSelect) {
  bookSelect.addEventListener("change", () =>
    updateFromControls({ resetPage: true, push: true }),
  );
}

if (modeSelect) {
  modeSelect.addEventListener("change", (e) => {
    notePickedMode(modeSelect, e);
    updateFromControls({ resetPage: true, push: true });
    // The first time the reader picks "Greek", the commands window opens
    // itself beside the box, once, without taking focus (BVJ, 2026-10-14).
    if (greekSearchEnabled() && modeSelect.value === "greek") {
      withCommands().then((m) => m.openGreekCommandsOnce({ field: input, typeSelect: modeSelect }));
    }
  });
}

// Sort menu: re-render already-computed results (no re-search)
sortSelect?.addEventListener("change", () => {
  const v = getActiveSort();
  writeState({ ...readState(), sort: v, page: 1 }, { push: true });

  if (lastSearchCache) renderFromCache();
  else scheduleSearch();
});

function setPage(n) {
  const s = readState();
  writeState({ ...s, page: n }, { push: true });

  if (lastSearchCache) renderFromCache();
  else scheduleSearch();

  // Only scroll if the keyword results area is above the viewport
  const target = lastSearchCache?.greekOnly ? groupGreek : groupKeyword || pagerEl;
  if (target) {
    const rect = target.getBoundingClientRect();
    if (rect.top < 0) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

window.addEventListener("popstate", () => {
  syncControlsFromUrl();

  if (lastSearchCache) renderFromCache();
  else scheduleSearch();
});
