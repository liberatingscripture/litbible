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
  makeReadJumpHref,
  normalizePhrase,
  isExplicitlyQuoted,
  buildPfQuery,
  escapeHtml,
  fuzzyTopicSuggestions,
  topicTokenMatches,
  parseBookChapterFromUrl,
  scriptureResultTitle,
  glossaryTermFromResult,
  enrichSearchResult,
  topicsIndexSubjectItem,
  bucketSearchResults,
  getMatchLocations,
  getMetaRangesFromAnchors,
  pickAnchorHref,
  expandToOccurrences,
  loadTopicsIndex,
  MODE_LABELS,
} from "./search-core.js";

const base = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const $ = (sel, root = document) => root.querySelector(sel);

const statusEl = $("#search-status");
const refEl = $("[data-search-ref]");

const groupGlossary = $("#group-glossary");
const groupSubject = $("#group-subject");
const groupArticles = $("#group-articles");
const groupKeyword = $("#group-keyword");

const glossaryEl = $("#results-glossary");
const subjectEl = $("#results-subject");
const articlesEl = $("#results-articles");
const keywordEl = $("#results-keyword");

const pagerEl = $("#pager");
const activeFiltersFullEl = document.getElementById("search-active-filters");

const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));

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
const COLLAPSE_THRESHOLD = 3;
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

function renderActiveFiltersFull() {
  if (!activeFiltersFullEl) return;
  const { book, mode } = readState();
  const pills = [];

  if (book) {
    const opt = bookSelect?.querySelector(`option[value="${book}"]`);
    pills.push({
      label: opt?.textContent || bookKeyToLabel(book),
      key: "book",
    });
  }

  if (mode && mode !== "all") {
    pills.push({ label: MODE_LABELS[mode] || mode, key: "mode" });
  }

  if (!pills.length) {
    activeFiltersFullEl.hidden = true;
    activeFiltersFullEl.innerHTML = "";
    return;
  }

  activeFiltersFullEl.hidden = false;
  activeFiltersFullEl.innerHTML =
    pills
      .map(
        (p) =>
          `<button type="button" class="filter-pill" data-clear-key="${p.key}">${escapeHtml(p.label)} <span aria-label="Clear">✕</span></button>`,
      )
      .join("") +
    (pills.length >= 2
      ? `<button type="button" class="filter-pill filter-pill--clear-all" data-clear-key="all">Clear all</button>`
      : "");

  activeFiltersFullEl.querySelectorAll("[data-clear-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.clearKey;
      if (k === "all") {
        if (bookSelect) bookSelect.value = "";
        if (modeSelect) modeSelect.value = "all";
      } else if (k === "book") {
        if (bookSelect) bookSelect.value = "";
      } else if (k === "mode") {
        if (modeSelect) modeSelect.value = "all";
      }
      updateFromControls({ resetPage: true, push: true });
    });
  });
}

function prettyTitleFromUrl(url, fallbackTitle = "Result") {
  return scriptureResultTitle(url, fallbackTitle);
}

function renderReferenceActions(jump) {
  if (!jump) return null;

  const isBook = jump.kind === "book";

  const wrapper = document.createElement("div");
  wrapper.className = "search-ref__links";

  const label = document.createElement("p");
  label.className = "search-ref__label";
  label.textContent = `Jump to: ${referenceJumpLabel(jump)}`;

  const studyLink = document.createElement("a");
  studyLink.className = "search-ref__link";
  studyLink.setAttribute("href", makeStudyJumpHref(jump));
  studyLink.textContent = isBook ? "Jump (Study Intro)" : "Jump (Study View)";

  const readLink = document.createElement("a");
  readLink.className = "search-ref__link search-ref__link--read";
  readLink.setAttribute("href", makeReadJumpHref(jump));
  readLink.textContent = isBook ? "Jump (Read Book)" : "Jump (Read View)";

  wrapper.append(label, studyLink, readLink);
  return wrapper;
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
    modeRaw === "article"
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
  const v = sort === "order" ? "order" : "relevance";
  for (const btn of sortButtons) {
    const on = btn.dataset.sort === v;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function getActiveSort() {
  const active = sortButtons.find((b) => b.classList.contains("is-active"));
  const v = active?.dataset.sort || "relevance";
  return v === "order" ? "order" : "relevance";
}

function syncControlsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const { q, book, sort, mode } = readState();

  if (input && input.value !== q) input.value = q;

  if (bookSelect) bookSelect.value = book;

  if (params.has("mode") && modeSelect) modeSelect.value = mode;

  setActiveSort(sort);
  renderActiveFiltersFull();
}

// Sometimes excerpts get polluted by meta text; keep this conservative.
function looksLikeMetaDump(htmlOrText) {
  const t = String(htmlOrText || "").toLowerCase();
  if (!t) return false;

  const hasTypeWord = /\b(scripture|intro|article)\b/.test(t);
  const hasMetaWords = /\b(book|chapter|type)\b/.test(t);
  return hasTypeWord && hasMetaWords;
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

// Build a deep link to the nearest anchor at/before the first NON-meta match.
async function hrefToFirstMatch(result) {
  const d = await result.data();

  const metaRanges = getMetaRangesFromAnchors(d?.anchors);
  const locs = getMatchLocations(d);
  const url = pickAnchorHref(d, metaRanges, locs);

  return { url, data: d, metaRanges, locs };
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

function renderGlossary(items, qPhrase) {
  glossaryEl.innerHTML = "";
  for (const r of items) {
    const li = document.createElement("li");
    li.className = "result";

    const term = glossaryTermFromResult(r, qPhrase);

    li.innerHTML = `
      <a class="result-link" href="${escapeHtml(r.url)}">
        <div class="result-title">${escapeHtml(term)}</div>
      </a>
    `;

    glossaryEl.appendChild(li);
  }
}

function renderSubject(items) {
  subjectEl.innerHTML = "";
  for (const r of items) {
    const li = document.createElement("li");
    li.className = "result";

    const fallbackTitle = r.meta?.title || r.title || "Result";
    const displayTitle = prettyTitleFromUrl(r.url, fallbackTitle);

    li.innerHTML = `
      <a class="result-link" href="${escapeHtml(r.url)}">
        <div class="result-title">${escapeHtml(displayTitle)}</div>
      </a>
    `;

    subjectEl.appendChild(li);
  }
}

function renderKeyword(items) {
  keywordEl.innerHTML = "";

  // Group items by base URL (chapter page)
  const groups = new Map();
  for (const r of items) {
    const groupBase = r.__baseUrl || r.url?.replace(/#.*$/, "") || r.url;
    if (!groups.has(groupBase)) {
      groups.set(groupBase, { items: [], meta: r.meta, baseUrl: groupBase });
    }
    groups.get(groupBase).items.push(r);
  }

  for (const [baseUrl, group] of groups) {
    const fallbackTitle =
      group.meta?.title || group.items[0]?.title || "Result";
    const displayTitle = prettyTitleFromUrl(baseUrl, fallbackTitle);

    // Single-result groups: same layout as multi-result (title above, card below)
    if (group.items.length === 1) {
      const r = group.items[0];
      const groupLi = document.createElement("li");
      groupLi.className = "result-group";

      const heading = document.createElement("div");
      heading.className = "result-group__title";
      heading.textContent = displayTitle;
      groupLi.appendChild(heading);

      const excerptHtml = r.excerpt ? String(r.excerpt) : "";
      const hasHighlight = /<mark>/i.test(excerptHtml);

      const descriptionMeta = r?.meta?.description
        ? String(r.meta.description).trim()
        : "";

      let snippetHtml = "";
      if (excerptHtml) {
        if (hasHighlight) {
          snippetHtml = excerptHtml;
        } else if (!looksLikeMetaDump(excerptHtml)) {
          snippetHtml = excerptHtml;
        } else if (descriptionMeta) {
          snippetHtml = escapeHtml(descriptionMeta);
        } else {
          snippetHtml = excerptHtml;
        }
      } else if (descriptionMeta) {
        snippetHtml = escapeHtml(descriptionMeta);
      }

      const subList = document.createElement("ol");
      subList.className = "result-group__occurrences";

      const subLi = document.createElement("li");
      subLi.className = "result-occurrence";
      subLi.innerHTML = `
        <a class="result-link result-link--occurrence" href="${escapeHtml(r.url)}">
          ${snippetHtml ? `<div class="result-excerpt">${snippetHtml}</div>` : `<div class="result-excerpt">(match)</div>`}
        </a>
      `;

      subList.appendChild(subLi);
      groupLi.appendChild(subList);
      keywordEl.appendChild(groupLi);
      continue;
    }

    // Multi-occurrence group: render a chapter heading + individual occurrence cards
    const groupLi = document.createElement("li");
    groupLi.className = "result-group";

    const heading = document.createElement("div");
    heading.className = "result-group__title";
    heading.textContent = `${displayTitle}`;
    groupLi.appendChild(heading);

    const VISIBLE_LIMIT = 3;
    const subList = document.createElement("ol");
    subList.className = "result-group__occurrences";

    group.items.forEach((r, idx) => {
      const subLi = document.createElement("li");
      subLi.className = "result-occurrence";
      if (idx >= VISIBLE_LIMIT) {
        subLi.classList.add("result-occurrence--collapsed");
      }

      const excerptHtml = r.excerpt ? String(r.excerpt) : "";

      subLi.innerHTML = `
        <a class="result-link result-link--occurrence" href="${escapeHtml(r.url)}">
          <div class="result-excerpt">${excerptHtml || "(match)"}</div>
        </a>
      `;

      subList.appendChild(subLi);
    });

    groupLi.appendChild(subList);

    // "Show more" button if there are more than VISIBLE_LIMIT occurrences
    if (group.items.length > VISIBLE_LIMIT) {
      const extra = group.items.length - VISIBLE_LIMIT;
      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "see-more-btn";
      moreBtn.textContent = `Show ${extra} more in this chapter`;
      moreBtn.addEventListener("click", () => {
        subList
          .querySelectorAll(".result-occurrence--collapsed")
          .forEach((el) => el.classList.remove("result-occurrence--collapsed"));
        moreBtn.remove();
      });
      groupLi.appendChild(moreBtn);
    }

    keywordEl.appendChild(groupLi);
  }
}

function renderArticles(items) {
  articlesEl.innerHTML = "";
  for (const r of items) {
    const li = document.createElement("li");
    li.className = "result";

    const fallbackTitle = r.meta?.title || r.title || "Result";
    const displayTitle = fallbackTitle;

    li.innerHTML = `
      <a class="result-link" href="${escapeHtml(r.url)}">
        <div class="result-title">${escapeHtml(displayTitle)}</div>
      </a>
    `;

    articlesEl.appendChild(li);
  }
}

function applyCollapse(listEl) {
  const items = listEl.querySelectorAll(":scope > li");

  // Always clean up stale "See more" button (e.g. after filter narrows results)
  const oldBtn = listEl.parentElement?.querySelector(".see-more-btn");
  if (oldBtn) oldBtn.remove();

  if (items.length <= COLLAPSE_THRESHOLD) return;

  items.forEach((li, i) => {
    if (i >= COLLAPSE_THRESHOLD) li.classList.add("result--collapsed");
  });

  const extra = items.length - COLLAPSE_THRESHOLD;
  const btn = document.createElement("button");
  btn.className = "see-more-btn";
  btn.textContent = `See ${extra} more`;
  btn.addEventListener("click", () => {
    items.forEach((li) => li.classList.remove("result--collapsed"));
    btn.remove();
  });

  listEl.parentElement.appendChild(btn);
}

function setPager(total, page) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const show = total > pageSize;
  pagerEl.hidden = !show;
  pagerEl.innerHTML = "";

  if (!show) return;

  // Build the list of page numbers to display (with ellipsis gaps)
  const pageNums = buildPageRange(page, pages);

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "pager-btn pager-btn--arrow";
  prevBtn.textContent = "Previous";
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener("click", () => {
    if (page > 1) setPage(page - 1);
  });
  pagerEl.appendChild(prevBtn);

  // Numbered page buttons / ellipsis
  for (const entry of pageNums) {
    if (entry === "…") {
      const span = document.createElement("span");
      span.className = "pager-ellipsis";
      span.textContent = "…";
      span.setAttribute("aria-hidden", "true");
      pagerEl.appendChild(span);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "pager-btn pager-btn--num" +
        (entry === page ? " pager-btn--current" : "");
      btn.textContent = entry;
      if (entry === page) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.addEventListener("click", () => setPage(entry));
      }
      pagerEl.appendChild(btn);
    }
  }

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "pager-btn pager-btn--arrow";
  nextBtn.textContent = "Next";
  nextBtn.disabled = page >= pages;
  nextBtn.addEventListener("click", () => {
    if (page < pages) setPage(page + 1);
  });
  pagerEl.appendChild(nextBtn);
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

function renderFromCache() {
  const { page, sort, mode, q } = readState();
  if (!lastSearchCache) return;

  const {
    displayQ,
    glossaryMatches,
    subjectMatchesRaw,
    articleMatchesRaw,
    keywordMatchesRaw,
    qPhrase,
  } = lastSearchCache;

  // Topics always display in canonical book order
  const subjectMatches = [...subjectMatchesRaw].sort(compareByBookOrder);
  const articleMatches = sortMaybe(articleMatchesRaw, sort);
  const keywordMatchesAll = sortMaybe(keywordMatchesRaw, sort);

  const glossaryCount = glossaryMatches.length;
  const subjectCount = subjectMatches.length;
  const articleCount = articleMatches.length;
  const keywordTotal = keywordMatchesAll.length;
  const matchTotal = glossaryCount + subjectCount + articleCount + keywordTotal;

  const parsedJump = parseReferenceJump(q);
  setRefBanner(
    parsedJump ? renderReferenceActions(parsedJump) : null,
    Boolean(parsedJump),
  );

  if (matchTotal === 0) {
    const qNorm = normalizePhrase(displayQ);
    if (qNorm.includes(" ")) {
      const words = qNorm.split(/\s+/).filter((w) => w.length >= MIN_QUERY_LEN);
      if (words.length >= 2) {
        const wordLinks = words
          .map(
            (w) =>
              `<button type="button" class="suggest-word" data-suggest="${escapeHtml(w)}">${escapeHtml(w)}</button>`,
          )
          .join(" · ");
        statusEl.innerHTML = `No results for the exact phrase “${escapeHtml(displayQ)}.” Try: ${wordLinks}`;
        statusEl.querySelectorAll("[data-suggest]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (input) input.value = btn.dataset.suggest;
            updateFromControls({ resetPage: true, push: true });
          });
        });
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
              `<button type="button" class="suggest-word" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`,
          )
          .join(" · ");
        const current =
          statusEl.innerHTML || `No results for “${escapeHtml(displayQ)}.”`;
        statusEl.innerHTML = `${current}<br>Did you mean: ${sugLinks}`;
        statusEl.querySelectorAll("[data-suggest]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (input) input.value = btn.dataset.suggest;
            updateFromControls({ resetPage: true, push: true });
          });
        });
      }
    }

    if (statusEl.innerHTML) {
      // skip normal setStatus — we already set innerHTML
      renderActiveFiltersFull();
      return;
    }
  }

  setStatus(
    `Searching for "${displayQ}" - ${matchTotal} match${
      matchTotal === 1 ? "" : "es"
    } (${glossaryCount} glossary, ${subjectCount} topic, ${articleCount} article, ${keywordTotal} keyword)`,
  );

  // Only show glossary/subject on page 1
  const showMetaBuckets = page === 1;

  const showGlossary =
    (mode === "all" || mode === "glossary") && showMetaBuckets;
  const showSubject = (mode === "all" || mode === "subject") && showMetaBuckets;
  const showArticles =
    (mode === "all" || mode === "article") && showMetaBuckets;
  const showKeyword = mode === "all" || mode === "keyword";

  if (showGlossary && glossaryCount) {
    groupGlossary.hidden = false;
    renderGlossary(glossaryMatches.slice(0, 50), qPhrase);
  } else {
    groupGlossary.hidden = true;
    glossaryEl.innerHTML = "";
  }

  if (showSubject && subjectCount) {
    groupSubject.hidden = false;
    renderSubject(subjectMatches.slice(0, 50));
    applyCollapse(subjectEl);
  } else {
    groupSubject.hidden = true;
    subjectEl.innerHTML = "";
  }

  if (showArticles && articleCount) {
    groupArticles.hidden = false;
    renderArticles(articleMatches.slice(0, 20));
    applyCollapse(articlesEl);
  } else {
    groupArticles.hidden = true;
    articlesEl.innerHTML = "";
  }

  // keyword paging always applies to keyword bucket only
  const start = (page - 1) * pageSize;
  const keywordSlice = keywordMatchesAll.slice(start, start + pageSize);

  if (showKeyword && keywordTotal) {
    groupKeyword.hidden = false;
    renderKeyword(keywordSlice);
  } else {
    groupKeyword.hidden = true;
    keywordEl.innerHTML = "";
  }

  setPager(showKeyword ? keywordTotal : 0, page);
  renderActiveFiltersFull();
}

function clearResults() {
  groupGlossary.hidden = true;
  groupSubject.hidden = true;
  groupArticles.hidden = true;
  groupKeyword.hidden = true;

  glossaryEl.innerHTML = "";
  subjectEl.innerHTML = "";
  articlesEl.innerHTML = "";
  keywordEl.innerHTML = "";

  setPager(0, 1);
  lastSearchCache = null;
}

async function runFullSearch() {
  const { q, book } = readState();
  const displayQ = displayQueryLabel(q);

  if (!q) {
    setStatus("Type to search.");
    setRefBanner("", false);
    clearResults();
    return;
  }

  const parsedJump = parseReferenceJump(q);

  setRefBanner(
    parsedJump ? renderReferenceActions(parsedJump) : null,
    Boolean(parsedJump),
  );

  if (q.length < MIN_QUERY_LEN && !parsedJump) {
    setStatus(`Type ${MIN_QUERY_LEN} or more letters to search.`);
    clearResults();
    return;
  }

  if (q.length < MIN_QUERY_LEN && parsedJump) {
    setStatus("Press Enter to jump, or keep typing to search.");
    clearResults();
    return;
  }

  setStatus(`Searching for "${displayQ}"...`);

  const pagefind = await loadPagefind();

  const filters = {};
  if (book) filters.book = book;

  const { pfQuery, exactSingleToken, exactToken } = buildPfQuery(q);

  const search = await pagefind.search(
    pfQuery,
    Object.keys(filters).length ? { filters } : undefined,
  );

  const resolvedAll = await Promise.all(
    search.results.map((r) => hrefToFirstMatch(r)),
  );

  const qUnquoted = displayQ;
  const qPhrase = normalizePhrase(qUnquoted);

  // Flat result objects (Pagefind data + anchored url + relevance rank) are
  // what the render/cache layer consumes; enrichment wraps them with the
  // match signals the shared bucketing runs on.
  const enriched = resolvedAll.map(({ url, data }, i) =>
    enrichSearchResult({ ...data, url, __relevanceRank: i }, i, {
      qPhrase,
      exactSingleToken,
      exactToken,
    }),
  );

  // Topic-only matches via /topics-index.json (covers subjects that aren't
  // body-indexed). Exact topic phrase first; single-token queries fall back
  // to whole-word topic matches, capped to avoid an avalanche on broad
  // tokens (e.g., "god").
  const extraSubjectItems = [];
  const topicsData = await loadTopicsIndexOnce();
  if (topicsData) cachedTopicsList = topicsData.topicsList;
  if (topicsData && qPhrase) {
    const { topicsList, topicsUrlMap } = topicsData;

    const exact = topicsUrlMap.get(qPhrase) || [];

    let loose = [];
    if (!exact.length && !/\s/.test(qPhrase)) {
      const MAX_TOPICS = 30;
      const MAX_DOCS = 60;

      const matchedTopics = [];
      for (const t of topicsList) {
        if (topicTokenMatches(t.norm, qPhrase)) matchedTopics.push(t.norm);
        if (matchedTopics.length >= MAX_TOPICS) break;
      }

      for (const norm of matchedTopics) {
        const docs = topicsUrlMap.get(norm) || [];
        loose = loose.concat(docs);
        if (loose.length >= MAX_DOCS) break;
      }
    }

    const docs = exact.length ? exact : loose;
    const wantBook = normalizePhrase(String(book || ""));

    for (const doc of docs) {
      const url = String(doc?.url || "");
      if (!url) continue;

      const docBook = normalizePhrase(String(doc?.book || ""));
      if (wantBook && docBook && docBook !== wantBook) continue;

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

  const glossaryMatches = buckets.glossary.map((it) => it.d);
  const subjectMatchesRaw = buckets.subject.map((it) => it.d);
  const articleMatchesRaw = buckets.article.map((it) => it.d);

  // Expand keyword results into per-occurrence cards
  const keywordExpanded = buckets.keyword
    .map((it) => it.d)
    .flatMap((item) => expandToOccurrences(item, displayQ));

  lastSearchCache = {
    displayQ,
    qPhrase,
    glossaryMatches,
    subjectMatchesRaw,
    articleMatchesRaw,
    keywordMatchesRaw: keywordExpanded,
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
  const mode = modeSelect ? String(modeSelect.value || "all") : "all";

  const current = readState();

  writeState(
    { q, book, sort, mode, page: resetPage ? 1 : current.page },
    { push },
  );

  scheduleSearch();
  // Yield to the browser so the input visual update paints before
  // the filter-pill DOM work runs (improves INP).
  requestAnimationFrame(() => renderActiveFiltersFull());
}

// Initial sync
syncControlsFromUrl();
scheduleSearch();

// Input -> URL + search
if (input) {
  input.addEventListener("input", () =>
    updateFromControls({ resetPage: true }),
  );
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    updateFromControls({ resetPage: true, push: true });
  });
}

if (bookSelect) {
  bookSelect.addEventListener("change", () =>
    updateFromControls({ resetPage: true, push: true }),
  );
}

if (modeSelect) {
  modeSelect.addEventListener("change", () =>
    updateFromControls({ resetPage: true, push: true }),
  );
}

// Sort toggle: re-render already-computed results (no re-search, no reset)
sortButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.sort === "order" ? "order" : "relevance";
    const s = readState();

    setActiveSort(v);
    writeState({ ...s, sort: v }, { push: true });

    if (lastSearchCache) renderFromCache();
    else scheduleSearch();
  });
});

function setPage(n) {
  const s = readState();
  writeState({ ...s, page: n }, { push: true });

  if (lastSearchCache) renderFromCache();
  else scheduleSearch();

  // Only scroll if the keyword results area is above the viewport
  const target = groupKeyword || pagerEl;
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
