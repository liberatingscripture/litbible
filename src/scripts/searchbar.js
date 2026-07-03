// src/scripts/searchbar.js
//
// SearchBar tray behavior (dropdown results, ghost topic autocomplete,
// reference jumps, filters). Extracted from SearchBar.astro so the script is
// bundled + cached once instead of shipping inline in every page's HTML.
// Shared parsing/query logic lives in search-core.js; only tray rendering
// and event wiring live here.

import {
  bookKeyToLabel,
  parseReference,
  parseBookOnly,
  formatReferenceLabel,
  makeStudyReferenceHref,
  makeReadReferenceHref,
  makeStudyBookHref,
  makeReadBookHref,
  normalizePhrase,
  buildPfQuery,
  escapeHtml,
  stripTags,
  textHasWholeWord,
  textHasPhrase,
  excerptHasWholeWordMarkedTerm,
  fuzzyTopicSuggestions,
  parseMetaList,
  parseScripturePath,
  scriptureResultTitle,
  isGlossaryUrl,
  bibleOrderCompareHref,
  getMatchLocations,
  getMetaRangesFromAnchors,
  hasNonMetaMatch,
  pickAnchorHref,
  countOccurrences,
  loadTopicsIndex,
  MODE_LABELS,
} from "./search-core.js";

const base = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

// Initialize ALL searchbars on the page (guarded with data-enhanced).
//
// Deferred to idle so the main thread is free for early user interactions
// (improves INP).
const _initSearchbars = async () => {
  const roots = Array.from(document.querySelectorAll("[data-searchbar]"));
  for (const root of roots) {
    if (!root) continue;

    // Prevent double-init if Astro renders twice / view transitions
    if (root.dataset.enhanced === "true") continue;
    root.dataset.enhanced = "true";

    const form = root.querySelector("[data-searchbar-form]");
    const input = root.querySelector(".searchbar__input");
    const status = root.querySelector(".searchbar__status");
    const groupsEl = root.querySelector("[data-groups]");
    const bookSelect = root.querySelector(".searchbar__book");
    const modeSelect = root.querySelector(".searchbar__mode");
    const closeBtn = root.querySelector(".searchbar__close");
    const fullLink = root.querySelector(".searchbar__full");
    const jumpRow = root.querySelector("[data-jump]");
    const activeFiltersEl = root.querySelector("[data-active-filters]");

    // Ghost autocomplete elements
    const ghost = root.querySelector("[data-ghost]");
    const ghostTyped = root.querySelector("[data-ghost-typed]");
    const ghostRest = root.querySelector("[data-ghost-rest]");

    if (
      !form ||
      !input ||
      !status ||
      !groupsEl ||
      !bookSelect ||
      !modeSelect ||
      !closeBtn ||
      !jumpRow
    )
      continue;

    // -----------------------------
    // Tooltip behavior (viewport-clamped, stable on mobile)
    // -----------------------------
    const tipButtons = Array.from(root.querySelectorAll(".searchbar__tip"));
    let activeTip = null;
    const lockedTips = new Set();

    function closeAllTips() {
      for (const b of tipButtons) b.dataset.tipOpen = "false";
      lockedTips.clear();
      activeTip = null;
    }

    function positionTip(btn) {
      const tip = btn.querySelector(".searchbar__tooltip");
      if (!tip) return;

      const pad = 12;
      const gap = 10;

      // Ensure it's measurable
      btn.dataset.tipOpen = "true";

      const btnRect = btn.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();

      let left = btnRect.left + btnRect.width / 2 - tipRect.width / 2;
      left = Math.max(
        pad,
        Math.min(left, window.innerWidth - tipRect.width - pad),
      );

      // Prefer above; if not enough room, place below
      let top = btnRect.top - tipRect.height - gap;
      if (top < pad) top = btnRect.bottom + gap;

      top = Math.max(
        pad,
        Math.min(top, window.innerHeight - tipRect.height - pad),
      );

      btn.style.setProperty("--tip-x", `${left}px`);
      btn.style.setProperty("--tip-y", `${top}px`);
    }

    function openTip(btn) {
      if (activeTip && activeTip !== btn) activeTip.dataset.tipOpen = "false";
      activeTip = btn;
      btn.dataset.tipOpen = "true";
      requestAnimationFrame(() => positionTip(btn));
    }

    for (const btn of tipButtons) {
      btn.dataset.tipOpen = "false";

      btn.addEventListener("mouseenter", () => openTip(btn));
      btn.addEventListener("mouseleave", () => {
        if (!lockedTips.has(btn)) {
          btn.dataset.tipOpen = "false";
          if (activeTip === btn) activeTip = null;
        }
      });

      btn.addEventListener("focus", () => openTip(btn));
      btn.addEventListener("blur", () => {
        if (!lockedTips.has(btn)) {
          btn.dataset.tipOpen = "false";
          if (activeTip === btn) activeTip = null;
        }
      });

      // Click locks open; second click closes
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (lockedTips.has(btn)) {
          lockedTips.delete(btn);
          btn.dataset.tipOpen = "false";
          if (activeTip === btn) activeTip = null;
        } else {
          lockedTips.add(btn);
          openTip(btn);
        }
      });
    }

    // Close tips when clicking elsewhere
    root.addEventListener("click", (e) => {
      if (!e.target.closest(".searchbar__tip")) closeAllTips();
    });
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) closeAllTips();
    });

    window.addEventListener("resize", () => {
      if (activeTip) requestAnimationFrame(() => positionTip(activeTip));
    });

    const MIN_QUERY_LEN = 3; // 3-4 char queries are exact-only

    let pagefind = null;

    const initialMode = root.dataset.defaultMode || "all";
    let activeBook = "";
    let activeMode = initialMode;

    // Kill stale async renders (prod can be slower than localhost)
    let searchSeq = 0;

    // -----------------------------
    // One-option topic autocomplete
    // -----------------------------
    let topicsLoaded = false;
    let topicsList = []; // [{ label, norm, count }]
    let topicsUrlMap = new Map(); // norm -> [{ url, ... }]

    async function loadTopicsOnce() {
      if (topicsLoaded) return;
      topicsLoaded = true;

      // force-cache: prefer speed for autocomplete; the /search page
      // fetches the same index with no-store for freshness.
      const data = await loadTopicsIndex(base, { cache: "force-cache" });
      if (data) {
        topicsList = data.topicsList;
        topicsUrlMap = data.topicsUrlMap;
      }
    }

    function clearGhost() {
      if (!ghost || !ghostTyped || !ghostRest) return;
      ghost.hidden = true;
      ghostTyped.textContent = "";
      ghostRest.textContent = "";
    }

    function caretIsAtEnd() {
      try {
        const end = input.value.length;
        return input.selectionStart === end && input.selectionEnd === end;
      } catch {
        return true;
      }
    }

    function bestTopicSuggestion(qRaw) {
      const qNorm = normalizePhrase(qRaw);
      if (!qNorm || qNorm.length < 2) return null; // small guard = fewer distractions

      // prefix-only
      const matches = [];
      for (const t of topicsList) {
        if (!t?.norm) continue;
        if (t.norm.startsWith(qNorm)) matches.push(t);
      }
      if (!matches.length) return null;

      // shortest matching first, then count desc, then alpha
      matches.sort((a, b) => {
        const la = a.norm.length;
        const lb = b.norm.length;
        if (la !== lb) return la - lb;

        const ac = Number(a.count || 0);
        const bc = Number(b.count || 0);
        if (bc !== ac) return bc - ac;

        return String(a.label || "").localeCompare(String(b.label || ""));
      });

      return matches[0] || null;
    }

    function renderGhost(qRaw) {
      if (!ghost || !ghostTyped || !ghostRest) return;

      // Only show ghost when user is editing at the end
      if (document.activeElement === input && !caretIsAtEnd()) {
        clearGhost();
        return;
      }

      const q = String(qRaw || "");
      const picked = bestTopicSuggestion(q);
      const qNorm = normalizePhrase(q);
      if (!picked || picked.norm === qNorm) {
        clearGhost();
        return;
      }

      const fullLabel = String(picked.label || "");
      const typedLen = q.length;

      ghost.hidden = false;
      ghostTyped.textContent = q;

      ghostRest.textContent =
        typedLen < fullLabel.length ? fullLabel.slice(typedLen) : "";
    }

    function acceptGhostIfAny() {
      if (!ghost || ghost.hidden) return false;

      const q = input.value;
      const picked = bestTopicSuggestion(q);
      if (!picked) return false;

      const qNorm = normalizePhrase(q);
      if (!picked.norm.startsWith(qNorm)) return false;

      input.value = String(picked.label || "").trim();
      clearGhost();
      return true;
    }

    function acceptCompletion() {
      const accepted = acceptGhostIfAny();
      if (!accepted) return false;
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    // On /search the panel is server-rendered open and should stay open.
    const pinnedOpen = root.dataset.open === "true";

    function openPanel() {
      root.dataset.open = "true";
    }

    function closePanel() {
      if (pinnedOpen) return;
      root.dataset.open = "false";
      clearGhost();
      closeAllTips();
    }

    async function ensurePagefind() {
      if (pagefind) return pagefind;
      try {
        pagefind = await import(
          /* @vite-ignore */ `${base}pagefind/pagefind.js`
        );
        return pagefind;
      } catch {
        status.textContent =
          "Search index not available yet. Run: npm run build";
        return null;
      }
    }

    // jump = null | { kind:"ref", ... } | { kind:"book", bookKey }
    function renderJump(jump) {
      if (!jump) {
        jumpRow.hidden = true;
        jumpRow.innerHTML = "";
        return;
      }

      const isBook = jump.kind === "book";
      const studyHref = isBook
        ? makeStudyBookHref(jump.bookKey)
        : makeStudyReferenceHref(jump);
      const readHref = isBook
        ? makeReadBookHref(jump.bookKey)
        : makeReadReferenceHref(jump);
      const label = isBook
        ? bookKeyToLabel(jump.bookKey)
        : formatReferenceLabel(jump);

      jumpRow.hidden = false;
      jumpRow.innerHTML = `
        <div class="searchbar__jump-links">
          <a class="searchbar__jump-link" href="${studyHref}">
            Jump to <strong>${label}</strong>
            <span class="searchbar__jump-hint">${
              isBook ? "Intro (Study View)" : "in Study View"
            }</span>
          </a>
          <a class="searchbar__jump-link searchbar__jump-link--read" href="${readHref}">
            Jump to <strong>${label}</strong>
            <span class="searchbar__jump-hint">${
              isBook ? "Book (Read View)" : "in Read View"
            }</span>
          </a>
        </div>
        <div class="searchbar__jump-meta">
          <span class="searchbar__jump-keys">
            Enter: Study View &nbsp;&middot;&nbsp; Shift+Enter: Read View
          </span>
          <button type="button" class="searchbar__jump-search" data-jump-search>
            Search for this instead
          </button>
        </div>
      `;
    }

    // "Search for this instead" lives inside jumpRow (innerHTML),
    // so use event delegation once.
    jumpRow.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-jump-search]");
      if (!btn) return;
      e.preventDefault();
      submitSearch({ forceSearch: true });
    });

    function jumpLinksVisible() {
      return !!(
        jumpRow &&
        jumpRow.hidden === false &&
        jumpRow.querySelector(".searchbar__jump-link")
      );
    }

    function doJump(preferRead = false) {
      const links = Array.from(
        jumpRow.querySelectorAll("a.searchbar__jump-link"),
      );
      if (!links.length) return false;

      const target = preferRead ? links[1] || links[0] : links[0];
      const href = target?.getAttribute("href");
      if (!href) return false;

      window.location.href = href;
      return true;
    }

    function isArticleResult(it) {
      const url = it?.d?.url || "";
      return url && !parseScripturePath(url) && !isGlossaryUrl(url);
    }

    function renderGroups({ glossary, subject, articles, keyword }) {
      const glossaryCount = glossary.length;
      const subjectCount = subject.length;
      const articlesCount = articles.length;
      const keywordCount = keyword.length;

      if (!glossaryCount && !subjectCount && !articlesCount && !keywordCount) {
        groupsEl.innerHTML = "";
        return;
      }

      const renderList = (items) => {
        return `
          <ol class="searchbar__results">
            ${items
              .map(
                ({ title, href }) => `
                  <li class="searchbar__result">
                    <a class="searchbar__link" href="${href}">
                      <div class="searchbar__title">${title}</div>
                    </a>
                  </li>
                `,
              )
              .join("")}
          </ol>
        `;
      };

      groupsEl.innerHTML = `
        ${
          glossaryCount && (activeMode === "all" || activeMode === "glossary")
            ? `
              <div class="searchbar__group">
                <div class="searchbar__group-title">${MODE_LABELS.glossary}</div>
                ${renderList(glossary)}
              </div>
            `
            : ""
        }
        ${
          subjectCount && (activeMode === "all" || activeMode === "subject")
            ? `
              <div class="searchbar__group">
                <div class="searchbar__group-title">${MODE_LABELS.subject}</div>
                ${renderList(subject)}
              </div>
            `
            : ""
        }
        ${
          articlesCount && (activeMode === "all" || activeMode === "article")
            ? `
              <div class="searchbar__group">
                <div class="searchbar__group-title">${MODE_LABELS.article}</div>
                ${renderList(articles)}
              </div>
            `
            : ""
        }
        ${
          keywordCount && (activeMode === "all" || activeMode === "keyword")
            ? `
              <div class="searchbar__group">
                <div class="searchbar__group-title">${MODE_LABELS.keyword}</div>
                ${renderList(keyword)}
              </div>
            `
            : ""
        }
      `;
    }

    function titleFromUrl(u) {
      // Non-scripture URLs (e.g. article paths from the topic index) fall
      // back to the raw URL, matching the tray's original behavior.
      return scriptureResultTitle(u, String(u || ""));
    }

    function renderActiveFilters() {
      if (!activeFiltersEl) return;
      const pills = [];

      if (activeBook) {
        const bookLabel =
          bookSelect.selectedOptions?.[0]?.textContent ||
          bookKeyToLabel(activeBook);
        pills.push({
          label: bookLabel,
          clear() {
            activeBook = "";
            bookSelect.value = "";
          },
        });
      }

      if (activeMode && activeMode !== "all") {
        pills.push({
          label: MODE_LABELS[activeMode] || activeMode,
          clear() {
            activeMode = "all";
            modeSelect.value = "all";
          },
        });
      }

      if (!pills.length) {
        activeFiltersEl.hidden = true;
        activeFiltersEl.innerHTML = "";
        return;
      }

      activeFiltersEl.hidden = false;
      activeFiltersEl.innerHTML =
        pills
          .map(
            (p, i) =>
              `<button type="button" class="searchbar__filter-pill" data-pill-idx="${i}">${escapeHtml(p.label)} <span aria-label="Clear filter">✕</span></button>`,
          )
          .join("") +
        (pills.length >= 2
          ? `<button type="button" class="searchbar__filter-clear-all" data-clear-all>Clear all</button>`
          : "");

      function rerun() {
        renderActiveFilters();
        const q = input.value.trim();
        if (q.length >= MIN_QUERY_LEN || parseReference(q) || parseBookOnly(q))
          runSearch(q);
        else clearForShortQuery();
      }

      activeFiltersEl.querySelectorAll("[data-pill-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          pills[Number(btn.dataset.pillIdx)]?.clear();
          rerun();
        });
      });
      activeFiltersEl
        .querySelector("[data-clear-all]")
        ?.addEventListener("click", () => {
          activeBook = "";
          bookSelect.value = "";
          activeMode = "all";
          modeSelect.value = "all";
          rerun();
        });
    }

    function filterSubjectUrlsByActiveFilters(items, opts = {}) {
      const bookFilter =
        typeof opts.bookOverride === "string" ? opts.bookOverride : activeBook;

      let out = Array.isArray(items) ? items.slice() : [];

      if (bookFilter) {
        out = out.filter((it) => {
          const p = parseScripturePath(it?.url);
          return p ? p.bookKey === bookFilter : false;
        });
      }

      return out;
    }

    async function runSearch(q) {
      const mySeq = ++searchSeq;

      try {
        const pf = await ensurePagefind();
        if (!pf) return;
        if (mySeq !== searchSeq) return;

        const ref = parseReference(q);
        const bookOnly = !ref ? parseBookOnly(q) : null;
        const jump = ref
          ? { kind: "ref", ...ref }
          : bookOnly
            ? { kind: "book", ...bookOnly }
            : null;
        const hasJump = !!jump;

        // Show jump row (if any) AND keep searching for results.
        renderJump(jump);

        const filters = {};

        // If the user typed a reference or book-only query, ignore the active
        // book filter to avoid "I forgot I filtered" confusion and to allow
        // article hits to appear.
        if (activeBook && !hasJump) filters.book = [activeBook];

        status.textContent = "Searching…";
        groupsEl.innerHTML = "";

        const qTrim = q.trim();
        const qUnquoted = qTrim.replace(/^"+|"+$/g, "").trim();
        const qPhrase = normalizePhrase(qUnquoted);
        const isSingleToken = qPhrase && !qPhrase.includes(" ");

        const pickedTopic = qPhrase
          ? topicsList.find((t) => t?.norm === qPhrase)
          : null;

        const subjectFromIndexRaw =
          pickedTopic && topicsUrlMap
            ? topicsUrlMap.get(pickedTopic.norm) || []
            : [];

        const subjectFromIndex = filterSubjectUrlsByActiveFilters(
          subjectFromIndexRaw,
          { bookOverride: hasJump ? "" : undefined },
        ).slice(0, 50);

        if (activeMode === "subject") {
          const subjectItems = subjectFromIndex.slice(0, 6).map((it) => ({
            title: titleFromUrl(it.url),
            href: it.url,
          }));

          const sCount = subjectFromIndex.length;

          status.textContent = `${sCount} topic match${sCount === 1 ? "" : "es"}`;

          renderGroups({
            glossary: [],
            subject: subjectItems,
            articles: [],
            keyword: [],
          });

          return;
        }

        const { pfQuery, exactSingleToken, exactToken } = buildPfQuery(q);

        const res = await pf.search(
          pfQuery,
          Object.keys(filters).length ? { filters } : undefined,
        );
        if (mySeq !== searchSeq) return;

        const resolvedAll = await Promise.all(
          res.results.map(async (r, i) => {
            const d = await r.data();

            const metaRanges = getMetaRangesFromAnchors(d?.anchors);
            const locs = getMatchLocations(d);

            const topicsListLocal = [
              ...parseMetaList(d?.meta?.topics),
              ...parseMetaList(d?.meta?.tags),
            ];

            const excerptText = stripTags(d?.excerpt);

            const wholeWordOk =
              !exactSingleToken ||
              excerptHasWholeWordMarkedTerm(d?.excerpt, exactToken) ||
              textHasWholeWord(excerptText, exactToken);

            const contentHit = !qPhrase
              ? false
              : isSingleToken
                ? textHasWholeWord(excerptText, qPhrase)
                : textHasPhrase(excerptText, qPhrase);

            const subjectHit =
              !!qPhrase &&
              topicsListLocal.map(normalizePhrase).includes(qPhrase);

            return {
              d,
              relevanceRank: i,
              metaRanges,
              locs,
              topicsList: topicsListLocal,
              wholeWordOk,
              subjectHit,
              contentHit,
            };
          }),
        );
        if (mySeq !== searchSeq) return;

        // Preserve Pagefind relevance order for keyword results.
        // Bible order is applied to topic/subject matches separately below.
        const merged = resolvedAll;

        const glossaryMatches = merged.filter((it) =>
          isGlossaryUrl(it?.d?.url),
        );
        const nonGlossary = merged.filter((it) => !isGlossaryUrl(it?.d?.url));

        let subjectMatches = nonGlossary.filter((it) => it.subjectHit);
        subjectMatches.sort((a, b) =>
          bibleOrderCompareHref(a.d?.url || "", b.d?.url || ""),
        );

        if (pickedTopic && subjectFromIndex.length) {
          subjectMatches = subjectFromIndex.map((it) => ({
            d: {
              url: it.url,
              title: titleFromUrl(it.url),
              meta: { title: titleFromUrl(it.url) },
              anchors: [],
            },
            metaRanges: [],
            locs: [],
            subjectHit: true,
            contentHit: false,
            wholeWordOk: true,
          }));
          subjectMatches.sort((a, b) =>
            bibleOrderCompareHref(a.d?.url || "", b.d?.url || ""),
          );
        }

        const keywordMatches = nonGlossary.filter((it) => {
          if (it?.d?.meta?.type === "intro") return false;

          if (!hasNonMetaMatch(it.locs, it.metaRanges)) return false;
          if (it.subjectHit && !it.contentHit) return false;
          if (exactSingleToken) return it.wholeWordOk;
          return true;
        });

        // Pull article-page results into their own bucket.
        // Always extract so articles get their own section and are not
        // double-counted as keyword results. Scan all non-glossary Pagefind
        // hits (not just subject+keyword survivors) so articles aren't lost
        // by the stricter keyword filters.
        let articleMatches = [];
        const articleSeen = new Set();
        for (const it of nonGlossary) {
          if (!isArticleResult(it)) continue;
          const url = it.d?.url || "";
          if (articleSeen.has(url)) continue;
          articleSeen.add(url);
          articleMatches.push(it);
        }
        // Also capture any article URLs that came from the topic index
        // (subjectFromIndex path) but weren't in the Pagefind results.
        for (const it of subjectMatches) {
          if (!isArticleResult(it)) continue;
          const url = it.d?.url || "";
          if (articleSeen.has(url)) continue;
          articleSeen.add(url);
          articleMatches.push(it);
        }
        subjectMatches = subjectMatches.filter((it) => !isArticleResult(it));
        let keywordMatchesFiltered = keywordMatches.filter(
          (it) => !isArticleResult(it),
        );

        const glossaryItems = glossaryMatches.slice(0, 6).map((it) => ({
          title: it.d?.meta?.title ? it.d.meta.title : it.d.title || it.d.url,
          href: pickAnchorHref(it.d, it.metaRanges, it.locs),
        }));

        const subjectItems = subjectMatches.slice(0, 6).map((it) => ({
          title: it.d?.meta?.title ? it.d.meta.title : it.d.title || it.d.url,
          href: it?.d?.anchors?.length
            ? pickAnchorHref(it.d, it.metaRanges, it.locs)
            : it.d.url,
        }));

        const articleItems = articleMatches.slice(0, 6).map((it) => ({
          title: it.d?.meta?.title ? it.d.meta.title : it.d.title || it.d.url,
          href: pickAnchorHref(it.d, it.metaRanges, it.locs),
        }));

        // Sort keyword and article results by Pagefind relevance order
        keywordMatchesFiltered.sort(
          (a, b) => (a.relevanceRank ?? 9999) - (b.relevanceRank ?? 9999),
        );
        articleMatches.sort(
          (a, b) => (a.relevanceRank ?? 9999) - (b.relevanceRank ?? 9999),
        );

        const keywordItems = keywordMatchesFiltered.slice(0, 6).map((it) => ({
          title: it.d?.meta?.title ? it.d.meta.title : it.d.title || it.d.url,
          href: pickAnchorHref(it.d, it.metaRanges, it.locs),
        }));

        const gCount = glossaryMatches.length;
        const sCount = subjectMatches.length;
        const aCount = articleMatches.length;
        // Count-only path: the status line doesn't need excerpt cards.
        const kCount = keywordMatchesFiltered.reduce(
          (n, it) => n + countOccurrences(it.d, qUnquoted),
          0,
        );
        const sep = " • ";

        // Only include counts for sections visible under the current mode
        const showG = activeMode === "all" || activeMode === "glossary";
        const showS = activeMode === "all" || activeMode === "subject";
        const showA = activeMode === "all" || activeMode === "article";
        const showK = activeMode === "all" || activeMode === "keyword";

        const parts = [];
        if (showG && gCount)
          parts.push(`${gCount} glossary match${gCount === 1 ? "" : "es"}`);
        if (showS)
          parts.push(`${sCount} topic match${sCount === 1 ? "" : "es"}`);
        if (showA && aCount)
          parts.push(`${aCount} article match${aCount === 1 ? "" : "es"}`);
        if (showK)
          parts.push(`${kCount} keyword match${kCount === 1 ? "" : "es"}`);
        status.textContent = parts.join(sep);

        renderGroups({
          glossary: glossaryItems,
          subject: subjectItems,
          articles: articleItems,
          keyword: keywordItems,
        });
        renderActiveFilters();

        const totalCount =
          (showG ? gCount : 0) +
          (showS ? sCount : 0) +
          (showA ? aCount : 0) +
          (showK ? kCount : 0);
        if (totalCount === 0) {
          if (qPhrase && qPhrase.includes(" ")) {
            const words = qPhrase
              .split(/\s+/)
              .filter((w) => w.length >= MIN_QUERY_LEN);
            if (words.length >= 2) {
              const wordLinks = words
                .map(
                  (w) =>
                    `<button type="button" class="searchbar__suggest-word" data-suggest="${escapeHtml(w)}">${escapeHtml(w)}</button>`,
                )
                .join(" · ");
              status.innerHTML = `No results for the exact phrase “${escapeHtml(qPhrase)}.” Try: ${wordLinks}`;
              status.querySelectorAll("[data-suggest]").forEach((btn) => {
                btn.addEventListener("click", () => {
                  input.value = btn.dataset.suggest;
                  runSearch(btn.dataset.suggest);
                });
              });
            }
          }

          const suggestions = fuzzyTopicSuggestions(qPhrase, topicsList, 3);
          if (suggestions.length) {
            const sugLinks = suggestions
              .map(
                (s) =>
                  `<button type="button" class="searchbar__suggest-word" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`,
              )
              .join(" · ");
            const current =
              status.innerHTML ||
              status.textContent ||
              `No results for “${escapeHtml(qPhrase)}.”`;
            status.innerHTML = `${current}<br>Did you mean: ${sugLinks}`;
            status.querySelectorAll("[data-suggest]").forEach((btn) => {
              btn.addEventListener("click", () => {
                input.value = btn.dataset.suggest;
                runSearch(btn.dataset.suggest);
              });
            });
          }
        }
      } catch (err) {
        console.error(err);
        groupsEl.innerHTML = "";
        renderJump(null);
        status.textContent = "Search failed.";
      }
    }

    function submitSearch(opts = {}) {
      const forceSearch = !!opts.forceSearch;
      const q = input.value.trim();
      if (!q) return;

      clearGhost();

      if (!forceSearch) {
        const ref = parseReference(q);
        if (ref) {
          window.location.href = makeStudyReferenceHref(ref);
          return;
        }

        const bookOnly = parseBookOnly(q);
        if (bookOnly) {
          window.location.href = makeStudyBookHref(bookOnly.bookKey);
          return;
        }
      }

      const url = new URL(
        fullLink?.getAttribute("href") || "/search",
        window.location.origin,
      );

      const { pfQuery, exactSingleToken } = buildPfQuery(q);
      url.searchParams.set("q", exactSingleToken ? pfQuery : q);

      if (activeBook) url.searchParams.set("book", activeBook);
      if (activeMode && activeMode !== "all")
        url.searchParams.set("mode", activeMode);

      window.location.href = url.pathname + url.search;
    }

    function clearForShortQuery() {
      groupsEl.innerHTML = "";
      renderJump(null);
      clearGhost();
      status.textContent = `Type ${MIN_QUERY_LEN} or more letters to search.`;
    }

    bookSelect.addEventListener("change", () => {
      activeBook = bookSelect.value || "";
      const q = input.value.trim();
      openPanel();

      renderGhost(q);

      if (!q) {
        clearForShortQuery();
        renderActiveFilters();
        return;
      }
      if (q.length >= MIN_QUERY_LEN || parseReference(q) || parseBookOnly(q))
        runSearch(q);
      else clearForShortQuery();
      renderActiveFilters();
    });

    modeSelect.addEventListener("change", () => {
      activeMode = modeSelect.value || "all";
      const q = input.value.trim();
      openPanel();

      renderGhost(q);

      if (!q) {
        clearForShortQuery();
        renderActiveFilters();
        return;
      }
      runSearch(q);
      renderActiveFilters();
    });

    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) closePanel();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });

    let t = null;
    input.addEventListener("input", () => {
      const q = input.value;

      if (!q.trim()) {
        groupsEl.innerHTML = "";
        status.textContent = "";
        renderJump(null);
        clearGhost();
        return;
      }

      openPanel();

      renderGhost(q);

      // Keep 3-letter minimum for keyword search,
      // but allow 2-letter book-only detection to show jumps.
      const qt = q.trim();
      if (
        qt.length < MIN_QUERY_LEN &&
        !parseReference(qt) &&
        !parseBookOnly(qt)
      ) {
        clearForShortQuery();
        return;
      }

      clearTimeout(t);
      t = setTimeout(() => runSearch(q.trim()), 120);
    });

    input.addEventListener("focus", () => {
      // Start loading topics on first focus so ghost suggestions are ready,
      // without blocking page load with an eager fetch.
      loadTopicsOnce().then(() => {
        renderGhost(input.value);
      });

      openPanel();
      const q = input.value;

      if (!q.trim()) {
        clearForShortQuery();
        return;
      }

      renderGhost(q);

      const qt = q.trim();
      if (
        qt.length < MIN_QUERY_LEN &&
        !parseReference(qt) &&
        !parseBookOnly(qt)
      ) {
        clearForShortQuery();
        return;
      }

      // Yield to the browser so the focus visual update paints before
      // the heavy Pagefind import + search runs (improves INP).
      setTimeout(() => {
        runSearch(q.trim());
        renderActiveFilters();
      }, 0);
    });

    input.addEventListener("keydown", (e) => {
      if (
        (e.key === "Tab" || e.key === "ArrowRight") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (document.activeElement === input && caretIsAtEnd()) {
          const accepted = acceptCompletion();
          if (accepted) {
            e.preventDefault();
            const q = input.value.trim();
            if (
              q.length >= MIN_QUERY_LEN ||
              parseReference(q) ||
              parseBookOnly(q)
            )
              runSearch(q);
            return;
          }
        }
      }

      if (e.key !== "Enter") return;

      // If jump links are showing, Enter should jump (Shift+Enter = Read View)
      if (jumpLinksVisible()) {
        e.preventDefault();
        doJump(e.shiftKey);
        return;
      }

      e.preventDefault();
      submitSearch();
    });

    // --------------------------------------------------
    // Option C - tap ghost-rest span to accept completion
    // --------------------------------------------------
    if (ghostRest) {
      ghostRest.addEventListener("click", (e) => {
        e.stopPropagation();
        const accepted = acceptCompletion();
        if (accepted) {
          const q = input.value.trim();
          if (
            q.length >= MIN_QUERY_LEN ||
            parseReference(q) ||
            parseBookOnly(q)
          )
            runSearch(q);
        }
      });
    }

    // --------------------------------------------------
    // Option A - swipe right on input to accept completion
    // --------------------------------------------------
    const SWIPE_THRESHOLD_PX = 40;
    const SWIPE_AXIS_RATIO = 1.5;

    let swipeStartX = 0;
    let swipeStartY = 0;

    input.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.changedTouches[0];
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
      },
      { passive: true },
    );

    input.addEventListener(
      "touchend",
      (e) => {
        if (ghost && !ghost.hidden) {
          const touch = e.changedTouches[0];
          const dx = touch.clientX - swipeStartX;
          const dy = Math.abs(touch.clientY - swipeStartY);
          if (dx >= SWIPE_THRESHOLD_PX && dx / (dy || 1) >= SWIPE_AXIS_RATIO) {
            const accepted = acceptCompletion();
            if (accepted) {
              const q = input.value.trim();
              if (
                q.length >= MIN_QUERY_LEN ||
                parseReference(q) ||
                parseBookOnly(q)
              )
                runSearch(q);
            }
          }
        }
      },
      { passive: true },
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitSearch();
    });

    activeMode = initialMode;
    if (modeSelect) modeSelect.value = initialMode;
    renderActiveFilters();
    closePanel();
  }
};

// Yield to the browser before running the heavy init so early
// interactions (taps, clicks) are not blocked (improves INP).
if ("requestIdleCallback" in window) {
  requestIdleCallback(_initSearchbars);
} else {
  setTimeout(_initSearchbars, 1);
}
