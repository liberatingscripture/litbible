// src/scripts/search.js
// Extracted from search.astro for cacheability and maintainability.

    const base = String(window.__SEARCH_BASE_URL || "/").replace(/\/?$/, "/");
    const BOOK_ORDER_LIST = Array.isArray(window.__SEARCH_BOOK_ORDER) ? window.__SEARCH_BOOK_ORDER : [];
    const BOOK_RANK = new Map(BOOK_ORDER_LIST.map((k, i) => [String(k), i]));

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
    const activeFiltersFullEl = document.getElementById(
      "search-active-filters",
    );

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

    // Optional subject index (topics -> pages), for matches that don't appear in body text.
    // Canonical subject index (same one SearchBar uses)
    // Expected shape: { topics: { <topicKey>: [ { url, type, book, chapter, title?, topicLabel? }, ... ] } }
    let topicsIndexPromise = null;
    async function loadTopicsIndexOnce() {
      if (topicsIndexPromise) return topicsIndexPromise;

      const url = `${base}topics-index.json`;

      topicsIndexPromise = (async () => {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok)
            throw new Error(`topics-index.json missing (${res.status})`);

          const json = await res.json();
          const topicsObj =
            json?.topics && typeof json.topics === "object"
              ? json.topics
              : null;
          if (!topicsObj)
            throw new Error("topics-index.json has no .topics object.");

          const topicsList = [];
          const topicsUrlMap = new Map();

          for (const [topicKey, docsRaw] of Object.entries(topicsObj)) {
            const docsArr = Array.isArray(docsRaw) ? docsRaw : [];
            const topicLabel =
              String(
                docsArr[0]?.topicLabel || docsArr[0]?.topic || topicKey || "",
              ).trim() || String(topicKey || "").trim();

            const norm = normalizePhrase(topicLabel);
            if (!norm) continue;

            topicsList.push({ norm, display: topicLabel });

            const docs = docsArr
              .map((d) => ({
                url: String(d?.url || ""),
                type: String(d?.type || ""),
                book: String(d?.book || ""),
                chapter: d?.chapter != null ? String(d.chapter) : "",
                title: String(d?.title || ""),
                topic: topicLabel,
                t: topicLabel,
              }))
              .filter((d) => d.url);

            topicsUrlMap.set(norm, docs);
          }

          topicsList.sort((a, b) => a.display.localeCompare(b.display));

          return { topicsList, topicsUrlMap };
        } catch (e) {
          console.warn("[search] Failed to load topics-index.json:", e);
          return null;
        }
      })();

      return topicsIndexPromise;
    }

    function topicTokenMatches(normTopic, token) {
      if (!token) return false;
      // whole word match (topic already normalized to spaces)
      const re = new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?:$|\\s)`, "i");
      return re.test(normTopic);
    }

    // Cache the most recent full result set so we can re-sort without re-searching
    let lastSearchCache = null;

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

    let cachedTopicsList = null;

    function levenshtein(a, b) {
      const m = a.length,
        n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      const d = Array.from({ length: m + 1 }, (_, i) => i);
      for (let j = 1; j <= n; j++) {
        let prev = d[0];
        d[0] = j;
        for (let i = 1; i <= m; i++) {
          const temp = d[i];
          d[i] =
            a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, d[i], d[i - 1]);
          prev = temp;
        }
      }
      return d[m];
    }

    function fuzzyTopicSuggestions(query, topics, limit) {
      limit = limit || 3;
      const qNorm = normalizePhrase(query);
      if (!qNorm || qNorm.length < 3) return [];
      const scored = [];
      for (const t of topics) {
        const norm = t.norm || String(t);
        if (norm === qNorm) continue;
        if (norm.startsWith(qNorm) || qNorm.startsWith(norm)) {
          scored.push({ label: t.label || t.display || norm, dist: 0 });
          continue;
        }
        if (Math.abs(norm.length - qNorm.length) > 4) continue;
        const dist = levenshtein(qNorm, norm);
        const threshold = Math.max(2, Math.ceil(qNorm.length * 0.3));
        if (dist <= threshold)
          scored.push({ label: t.label || t.display || norm, dist });
      }
      scored.sort((a, b) => a.dist - b.dist);
      return scored.slice(0, limit).map((s) => s.label);
    }

    function renderActiveFiltersFull() {
      if (!activeFiltersFullEl) return;
      const { book, mode } = readState();
      const pills = [];

      if (book) {
        const opt = bookSelect?.querySelector(`option[value="${book}"]`);
        pills.push({
          label: opt?.textContent || humanBookName(book),
          key: "book",
        });
      }

      if (mode && mode !== "all") {
        const ml = {
          subject: "Topic matches",
          keyword: "Keyword matches",
          glossary: "Glossary",
          article: "Article matches",
        };
        pills.push({ label: ml[mode] || mode, key: "mode" });
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
              `<button type="button" class="filter-pill" data-clear-key="${p.key}">${escapeHtml(p.label)} <span aria-label="Clear">\u2715</span></button>`,
          )
          .join("") +
        (pills.length >= 2
          ? `<button type="button" class="filter-pill filter-pill--clear-all" data-clear-key="all">Clear all</button>`
          : "");

      activeFiltersFullEl
        .querySelectorAll("[data-clear-key]")
        .forEach((btn) => {
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

    function escapeHtml(s) {
      return String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[c],
      );
    }

    // --- Pretty titles for numeric-leading books (1thessalonians -> 1 Thessalonians) ---
    function humanBookName(key) {
      const k = String(key || "").trim();
      const spaced = k.replace(/^(\d+)([a-z])/i, (_, n, ch) => {
        return `${n} ${String(ch).toUpperCase()}`;
      });
      return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "";
    }

    function prettyTitleFromUrl(url, fallbackTitle = "Result") {
      try {
        const path = new URL(url, window.location.origin).pathname;
        const m = path.match(/^\/([0-9]?[a-z]+)(?:-(intro|\d+))?\/?$/i);
        if (!m) return fallbackTitle;

        const bookKey = String(m[1]).toLowerCase();
        const suffix = String(m[2] || "").toLowerCase();

        const bookName = humanBookName(bookKey);

        if (!suffix || suffix === "intro") return `${bookName} - Introduction`;

        const chapter = Number.parseInt(suffix, 10);
        if (Number.isFinite(chapter)) return `${bookName} ${chapter}`;

        return fallbackTitle;
      } catch {
        return fallbackTitle;
      }
    }

    function isGlossaryUrl(hrefOrUrl) {
      try {
        const u = new URL(hrefOrUrl, window.location.origin);
        const p = u.pathname.replace(/\/+$/, "");
        return p === "/glossary" || p.startsWith("/glossary/");
      } catch {
        const s = String(hrefOrUrl || "");
        return s.startsWith("/glossary");
      }
    }

    function isArticleUrl(url) {
      return url && !parseBookChapterFromUrl(url) && !isGlossaryUrl(url);
    }

    // ----------------------------
    // Reference parsing
    // ----------------------------
    function getSharedRefJump() {
      return window.__litRefJump && typeof window.__litRefJump === "object"
        ? window.__litRefJump
        : null;
    }

    function slugifyBookName(name) {
      return String(name || "")
        .toLowerCase()
        .replace(/[^0-9a-z]/g, "");
    }

    const BOOK_ALIAS_ENTRIES = [
      ["matthew", ["matthew", "matt", "mt"]],
      ["mark", ["mark", "mrk", "mk"]],
      ["luke", ["luke", "luk", "lk"]],
      ["john", ["john", "jhn", "jn"]],
      ["acts", ["acts", "act", "ac"]],
      ["romans", ["romans", "rom", "ro"]],
      [
        "1corinthians",
        ["1corinthians", "1 corinthians", "1cor", "1 cor", "1co", "1 co"],
      ],
      [
        "2corinthians",
        ["2corinthians", "2 corinthians", "2cor", "2 cor", "2co", "2 co"],
      ],
      ["galatians", ["galatians", "gal"]],
      ["ephesians", ["ephesians", "eph"]],
      ["philippians", ["philippians", "phil", "php"]],
      ["colossians", ["colossians", "col"]],
      [
        "1thessalonians",
        [
          "1thessalonians",
          "1 thessalonians",
          "1thess",
          "1 thess",
          "1thes",
          "1 thes",
          "1th",
          "1 th",
        ],
      ],
      [
        "2thessalonians",
        [
          "2thessalonians",
          "2 thessalonians",
          "2thess",
          "2 thess",
          "2thes",
          "2 thes",
          "2th",
          "2 th",
        ],
      ],
      ["1timothy", ["1timothy", "1 timothy", "1tim", "1 tim", "1ti", "1 ti"]],
      ["2timothy", ["2timothy", "2 timothy", "2tim", "2 tim", "2ti", "2 ti"]],
      ["titus", ["titus", "tit"]],
      ["philemon", ["philemon", "phm", "phlm"]],
      ["hebrews", ["hebrews", "heb"]],
      ["james", ["james", "jas", "jm"]],
      ["1peter", ["1peter", "1 peter", "1pet", "1 pet", "1pe", "1 pe"]],
      ["2peter", ["2peter", "2 peter", "2pet", "2 pet", "2pe", "2 pe"]],
      ["1john", ["1john", "1 john", "1jn", "1 jn", "1jhn", "1 jhn"]],
      ["2john", ["2john", "2 john", "2jn", "2 jn", "2jhn", "2 jhn"]],
      ["3john", ["3john", "3 john", "3jn", "3 jn", "3jhn", "3 jhn"]],
      ["jude", ["jude", "jud"]],
      ["revelation", ["revelation", "rev", "re"]],
    ];

    const BOOK_ALIASES = new Map();
    for (const [bookKey, aliases] of BOOK_ALIAS_ENTRIES) {
      BOOK_ALIASES.set(bookKey, bookKey);
      BOOK_ALIASES.set(slugifyBookName(bookKey), bookKey);
      for (const alias of aliases) {
        BOOK_ALIASES.set(slugifyBookName(alias), bookKey);
      }
    }

    function resolveBookKey(rawBookPart) {
      const alias = slugifyBookName(rawBookPart);
      const mapped = BOOK_ALIASES.get(alias) || alias;
      return BOOK_RANK.has(mapped) ? mapped : null;
    }

    function parseBookOnly(raw) {
      const s = String(raw || "")
        .trim()
        .toLowerCase();
      if (!s) return null;

      const cleaned = s
        .replace(/[.,;()]/g, " ")
        .replace(/[\u2013\u2014\u2212]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const bookKey = resolveBookKey(cleaned);
      return bookKey ? { bookKey } : null;
    }

    function parseReferenceFallback(raw) {
      const s = String(raw || "")
        .trim()
        .toLowerCase();
      if (!s) return null;

      const cleaned = s
        .replace(/[.,;()]/g, " ")
        .replace(/[\u2013\u2014\u2212]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const m = cleaned.match(/^(.+?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
      if (!m) return null;

      const bookKey = resolveBookKey(m[1]);
      const chapter = Number(m[2]);
      const verse = m[3] ? Number(m[3]) : null;
      const rangeEnd = m[4] ? Number(m[4]) : null;

      if (!bookKey) return null;
      if (!Number.isFinite(chapter) || chapter <= 0) return null;
      if (verse !== null && (!Number.isFinite(verse) || verse <= 0))
        return null;
      if (rangeEnd !== null && (!Number.isFinite(rangeEnd) || rangeEnd <= 0))
        return null;

      return {
        bookKey,
        chapter,
        verse,
        rangeEnd: verse !== null && rangeEnd !== null && rangeEnd > verse ? rangeEnd : null,
      };
    }

    function parseReference(raw) {
      const sharedRefJump = getSharedRefJump();
      if (typeof sharedRefJump?.parseReference === "function") {
        const parsed = sharedRefJump.parseReference(raw);
        if (parsed) return parsed;
      }
      return parseReferenceFallback(raw);
    }

    function parseReferenceJump(raw) {
      const ref = parseReference(raw);
      if (ref) return { kind: "ref", ...ref };

      const bookOnly = parseBookOnly(raw);
      if (bookOnly) return { kind: "book", ...bookOnly };

      return null;
    }

    function formatReferenceLabel(ref) {
      const sharedRefJump = getSharedRefJump();
      if (typeof sharedRefJump?.formatReferenceLabel === "function") {
        return sharedRefJump.formatReferenceLabel(ref);
      }

      const book = humanBookName(ref?.bookKey || "");
      const chapter = Number(ref?.chapter || 0);
      const verse = Number(ref?.verse || 0);
      const rangeEnd = Number(ref?.rangeEnd || 0);
      if (verse > 0) {
        return `${book} ${chapter}:${verse}${rangeEnd > verse ? `–${rangeEnd}` : ""}`;
      }
      return `${book} ${chapter}`;
    }

    function makeStudyReferenceHref(ref) {
      const sharedRefJump = getSharedRefJump();
      if (typeof sharedRefJump?.makeStudyReferenceHref === "function") {
        return sharedRefJump.makeStudyReferenceHref(ref);
      }

      const baseHref = `/${ref.bookKey}-${ref.chapter}`;
      if (!ref.verse) return baseHref;
      const range = ref.rangeEnd ? `-${ref.rangeEnd}` : "";
      return `${baseHref}#v${ref.verse}${range}`;
    }

    function makeReadReferenceHref(ref) {
      const sharedRefJump = getSharedRefJump();
      if (typeof sharedRefJump?.makeReadReferenceHref === "function") {
        return sharedRefJump.makeReadReferenceHref(ref);
      }

      const baseHref = `/read/${ref.bookKey}`;
      const hash = ref.verse
        ? `${ref.bookKey}-${ref.chapter}-v${ref.verse}`
        : `ch-${ref.chapter}`;
      return `${baseHref}#${hash}`;
    }

    function makeStudyBookHref(bookKey) {
      return `/${bookKey}-intro`;
    }

    function makeReadBookHref(bookKey) {
      return `/read/${bookKey}`;
    }

    function referenceJumpLabel(jump) {
      if (!jump) return "";
      return jump.kind === "book"
        ? humanBookName(jump.bookKey)
        : formatReferenceLabel(jump);
    }

    function makeStudyJumpHref(jump) {
      return jump.kind === "book"
        ? makeStudyBookHref(jump.bookKey)
        : makeStudyReferenceHref(jump);
    }

    function makeReadJumpHref(jump) {
      return jump.kind === "book"
        ? makeReadBookHref(jump.bookKey)
        : makeReadReferenceHref(jump);
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
      studyLink.textContent = isBook
        ? "Jump (Study Intro)"
        : "Jump (Study View)";

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

    // -------- Subject parsing (PHRASES, not tokens) --------
    function parseMetaPhrases(raw) {
      const s = raw ? String(raw) : "";
      if (!s) return [];

      const cleaned = s
        .replace(/\u00A0/g, " ")
        .replace(/[|/]+/g, ",")
        .trim();

      if (!cleaned) return [];

      if (/[;,]/.test(cleaned)) {
        return cleaned
          .split(/\s*[;,]\s*/g)
          .map((t) => t.trim())
          .filter(Boolean);
      }

      return [cleaned];
    }

    function normalizePhrase(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Query rules (mirrors SearchBar behavior):
    function normalizeQuotes(s) {
      return String(s || "")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
    }

    function isExplicitlyQuoted(q) {
      const s = String(q || "").trim();
      return s.length >= 2 && s.startsWith('"') && s.endsWith('"');
    }

    function isWordChar(ch) {
      if (!ch) return false;
      return /[\p{L}\p{N}_]/u.test(ch);
    }

    function excerptHasWholeWordMarkedTerm(excerptHtml, term) {
      if (!excerptHtml || !term) return false;

      const s = String(excerptHtml)
        .replace(/<mark>/gi, "\u0001")
        .replace(/<\/mark>/gi, "\u0002")
        .replace(/<[^>]+>/g, "");

      const t = String(term).toLowerCase();

      for (let i = 0; i < s.length; i++) {
        if (s[i] !== "\u0001") continue;

        const start = i + 1;
        const end = s.indexOf("\u0002", start);
        if (end === -1) break;

        const marked = s.slice(start, end);
        if (marked.toLowerCase() === t) {
          const before = s[i - 1];
          const after = s[end + 1];
          if (!isWordChar(before) && !isWordChar(after)) return true;
        }

        i = end;
      }

      return false;
    }

    function escapeRegExp(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function stripTags(html) {
      return String(html || "").replace(/<[^>]+>/g, "");
    }

    function textHasWholeWord(text, term) {
      if (!text || !term) return false;

      const s = String(text).toLowerCase();
      const t = escapeRegExp(String(term).toLowerCase());

      const re = new RegExp(
        `(^|[^\\p{L}\\p{N}_])${t}([^\\p{L}\\p{N}_]|$)`,
        "u",
      );
      return re.test(s);
    }

    // UPDATED: hyphenated single-token query support (matches your index "word- word")
    function buildPfQuery(raw) {
      const q0 = normalizeQuotes(raw).trim();
      if (!q0) return { pfQuery: "", exactSingleToken: false, exactToken: "" };

      if (isExplicitlyQuoted(q0)) {
        const inner = q0.slice(1, -1).trim();
        const single = !/\s+/.test(inner);
        return {
          pfQuery: q0,
          exactSingleToken: single,
          exactToken: single ? inner : "",
        };
      }

      // Normalize fancy dashes to "-" for consistent matching.
      const canon = q0.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");

      // Hyphenated single-token queries:
      // Your index uses "word- word" (hyphen + space). So if a user types "word-word",
      // rewrite to a quoted phrase "word- word" so results appear.
      if (!/\s+/.test(canon) && /[\p{L}\p{N}]-(?=[\p{L}\p{N}])/u.test(canon)) {
        const pfPhrase = canon.replace(
          /([\p{L}\p{N}])-([\p{L}\p{N}])/gu,
          "$1- $2",
        );
        return {
          pfQuery: `"${pfPhrase}"`,
          exactSingleToken: false,
          exactToken: "",
        };
      }

      if (/\s+/.test(canon)) {
        return {
          pfQuery: `"${canon}"`,
          exactSingleToken: false,
          exactToken: "",
        };
      }

      if (canon.length >= 1 && canon.length <= 4) {
        return {
          pfQuery: `"${canon}"`,
          exactSingleToken: true,
          exactToken: canon,
        };
      }

      return { pfQuery: canon, exactSingleToken: false, exactToken: "" };
    }

    // Treat "meta-like hidden zones" as a UNION of ranges.
    // NOTE: topics are no longer body-indexed, so DO NOT include pf-topics-* here.
    function getMetaRangesFromAnchors(anchors) {
      if (!Array.isArray(anchors)) return [];

      const pairs = [
        ["pf-subjects-start", "pf-subjects-end"],
        ["pf-tags-start", "pf-tags-end"],
      ];

      const ranges = [];

      for (const [startId, endId] of pairs) {
        const start = anchors.find((a) => a?.id === startId)?.location;
        const end = anchors.find((a) => a?.id === endId)?.location;
        if (typeof start === "number" && typeof end === "number") {
          ranges.push(
            start <= end ? { start, end } : { start: end, end: start },
          );
        }
      }

      ranges.sort((a, b) => a.start - b.start);

      // Merge overlaps / adjacency
      const merged = [];
      for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (!last || r.start > last.end) merged.push({ ...r });
        else last.end = Math.max(last.end, r.end);
      }

      return merged;
    }

    function getMatchLocations(d) {
      const wl = Array.isArray(d?.weighted_locations)
        ? d.weighted_locations
            .map((x) => x?.location)
            .filter((n) => typeof n === "number")
        : [];
      if (wl.length) return wl;

      const locs = Array.isArray(d?.locations)
        ? d.locations.filter((n) => typeof n === "number")
        : [];
      return locs;
    }

    function isInAnyRange(n, ranges) {
      return (ranges || []).some((r) => n >= r.start && n <= r.end);
    }

    function hasNonMetaMatch(locs, metaRanges) {
      if (!metaRanges || metaRanges.length === 0) return true;
      return (locs || []).some((n) => !isInAnyRange(n, metaRanges));
    }

    function pickBestNonMetaLocation(locs, metaRanges) {
      if (!Array.isArray(locs) || !locs.length) return null;
      if (!metaRanges || metaRanges.length === 0) return locs[0];

      const nonMeta = locs.filter((n) => !isInAnyRange(n, metaRanges));
      return nonMeta.length ? nonMeta[0] : locs[0];
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
        throw new Error(
          `Pagefind entry missing (${entryRes.status}): ${entryUrl}`,
        );
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

      pagefindMod = await import(`${base}pagefind/pagefind.js`);

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
      const chosenLoc = pickBestNonMetaLocation(locs, metaRanges);

      if (
        typeof chosenLoc !== "number" ||
        !Array.isArray(d?.anchors) ||
        d.anchors.length === 0
      ) {
        return { url: d.url, data: d, metaRanges, locs };
      }

      const anchors = [...d.anchors]
        .filter((a) => {
          const id = a?.id ? String(a.id) : "";
          if (!id) return false;
          if (id.startsWith("pf-tags-")) return false;
          if (id.startsWith("pf-subjects-")) return false;
          return true;
        })
        .sort((a, b) => (a.location ?? 0) - (b.location ?? 0));

      let chosen = null;
      for (const a of anchors) {
        if (!a?.id || typeof a.location !== "number") continue;
        if (a.location <= chosenLoc) chosen = a;
        else break;
      }

      const url = chosen?.id ? `${d.url}#${chosen.id}` : d.url;
      return { url, data: d, metaRanges, locs };
    }

    // ---- Sorting: book/chapter order (optional) ----
    function parseBookChapterFromUrl(url) {
      try {
        const path = new URL(url, window.location.origin).pathname;
        const m = path.match(/^\/([0-9]?[a-z]+)(?:-(intro|\d+))?\/?$/i);
        if (!m) return null;

        const bookKey = String(m[1] || "").toLowerCase();
        const suffix = String(m[2] || "").toLowerCase();

        // Intro before chapter 1
        let chapter = 0;
        if (suffix && suffix !== "intro") {
          const n = Number.parseInt(suffix, 10);
          chapter = Number.isFinite(n) ? n : 0;
        }

        return { bookKey, chapter };
      } catch {
        return null;
      }
    }

    function bookIndex(bookKey) {
      const i = BOOK_ORDER_LIST.indexOf(bookKey);
      return i === -1 ? 9999 : i;
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

    function cleanGlossaryTitle(s) {
      let t = String(s || "").trim();
      t = t.replace(/^glossary\s*[-\u2014:]\s*/i, "");
      t = t.replace(/\s*[-\u2014:]\s*glossary$/i, "");
      return t.trim();
    }

    function glossaryTermFromResult(d, fallback = "") {
      const metaTerm =
        d?.meta?.glossary_term || d?.meta?.term || d?.meta?.entry || "";

      if (metaTerm) return String(metaTerm).trim();

      const title = d?.meta?.title || d?.title || "";
      const cleaned = cleanGlossaryTitle(title);
      return cleaned || String(fallback || "").trim() || "Glossary";
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

    function expandToOccurrences(item, searchTerm) {
      const content = item?.content || "";
      const anchors = Array.isArray(item?.anchors) ? item.anchors : [];
      const term = String(searchTerm || "")
        .toLowerCase()
        .trim();

      // Fallback: if we can't scan, return the original item as-is (one card)
      if (!content || !term || term.length < 2) {
        return [item];
      }

      // Build sorted anchor list, filtering out meta-zone anchors
      const sortedAnchors = anchors
        .filter((a) => {
          const id = a?.id ? String(a.id) : "";
          if (!id) return false;
          if (id.startsWith("pf-tags-")) return false;
          if (id.startsWith("pf-subjects-")) return false;
          return true;
        })
        .sort((a, b) => (a.location ?? 0) - (b.location ?? 0));

      // Find all whole-word occurrences of the term in the content
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapedTerm}(?![\\p{L}\\p{N}_])`,
        "giu",
      );

      // Pre-compute a character→word-index lookup.
      // Pagefind anchor locations are word indexes, not character offsets.
      function charIndexToWordIndex(charIdx) {
        let words = 0;
        for (let i = 0; i < charIdx && i < content.length; i++) {
          if (content[i] === " " && i > 0 && content[i - 1] !== " ") {
            words++;
          }
        }
        return words;
      }

      const matchPositions = [];
      let m;
      while ((m = regex.exec(content)) !== null) {
        matchPositions.push({
          index: m.index, // character position (for excerpt slicing)
          length: m[0].length,
          wordIndex: charIndexToWordIndex(m.index), // word position (for anchor matching)
        });
      }

      // If no occurrences found in content, fall back to original
      if (matchPositions.length === 0) {
        return [item];
      }

      // Map each match to its nearest preceding anchor
      function findNearestAnchor(wordIndex) {
        let best = null;
        for (const a of sortedAnchors) {
          if (typeof a.location !== "number") continue;
          if (a.location <= wordIndex) best = a;
          else break;
        }
        return best;
      }

      // Group matches by anchor ID
      const groups = new Map(); // anchorId -> { anchor, matches: [] }
      for (const pos of matchPositions) {
        const anchor = findNearestAnchor(pos.wordIndex);
        const key = anchor?.id || "__no_anchor__";
        if (!groups.has(key)) {
          groups.set(key, { anchor, matches: [] });
        }
        groups.get(key).matches.push(pos);
      }

      // Build one card per anchor group
      const baseUrl = (item.url || "").replace(/#.*$/, ""); // strip any existing hash
      const results = [];
      let occIdx = 0;

      for (const [anchorId, group] of groups) {
        // Deep-link URL: use the anchor ID as the hash fragment
        const hash =
          anchorId !== "__no_anchor__" && anchorId ? `#${anchorId}` : "";
        const url = `${baseUrl}${hash}`;

        // Build excerpt from the FIRST match in this group, with a window of context
        const firstMatch = group.matches[0];
        const WINDOW = 80; // chars before and after the match
        let excerptStart = Math.max(0, firstMatch.index - WINDOW);
        let excerptEnd = Math.min(
          content.length,
          firstMatch.index + firstMatch.length + WINDOW,
        );

        // Snap to word boundaries
        if (excerptStart > 0) {
          const spaceAfter = content.indexOf(" ", excerptStart);
          if (spaceAfter !== -1 && spaceAfter < firstMatch.index) {
            excerptStart = spaceAfter + 1;
          }
        }
        if (excerptEnd < content.length) {
          const spaceBefore = content.lastIndexOf(" ", excerptEnd);
          if (spaceBefore > firstMatch.index + firstMatch.length) {
            excerptEnd = spaceBefore;
          }
        }

        let excerptText = content.slice(excerptStart, excerptEnd);

        // Highlight ALL occurrences of the term within the excerpt window
        const excerptEscaped = excerptText.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#039;",
            })[c],
        );
        const highlightRegex = new RegExp(
          `(?<![\\p{L}\\p{N}_])(${escapedTerm})(?![\\p{L}\\p{N}_])`,
          "giu",
        );
        const highlighted = excerptEscaped.replace(
          highlightRegex,
          "<mark>$1</mark>",
        );

        const prefix = excerptStart > 0 ? "…" : "";
        const suffix = excerptEnd < content.length ? "…" : "";
        const excerptHtml = `${prefix}${highlighted}${suffix}`;

        // Strip verse numbers from the excerpt for cleaner display.
        const cleanedExcerpt = excerptHtml.replace(/^(…?)(\d{1,3})\s/, "$1");

        results.push({
          url,
          excerpt: cleanedExcerpt,
          meta: item.meta,
          title: item.title,
          content: item.content,
          anchors: item.anchors,
          filters: item.filters,
          __relevanceRank: item.__relevanceRank ?? 9999,
          __occurrenceIndex: occIdx,
          __baseUrl: baseUrl,
          __anchorId: anchorId,
          __matchCount: group.matches.length,
        });
        occIdx++;
      }

      return results;
    }

    function renderKeyword(items) {
      keywordEl.innerHTML = "";

      // Group items by base URL (chapter page)
      const groups = new Map();
      for (const r of items) {
        const base = r.__baseUrl || r.url?.replace(/#.*$/, "") || r.url;
        if (!groups.has(base)) {
          groups.set(base, { items: [], meta: r.meta, baseUrl: base });
        }
        groups.get(base).items.push(r);
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
              .forEach((el) =>
                el.classList.remove("result-occurrence--collapsed"),
              );
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
      const matchTotal =
        glossaryCount + subjectCount + articleCount + keywordTotal;

      const parsedJump = parseReferenceJump(q);
      setRefBanner(
        parsedJump ? renderReferenceActions(parsedJump) : null,
        Boolean(parsedJump),
      );

      if (matchTotal === 0) {
        const qNorm = normalizePhrase(displayQ);
        if (qNorm.includes(" ")) {
          const words = qNorm
            .split(/\s+/)
            .filter((w) => w.length >= MIN_QUERY_LEN);
          if (words.length >= 2) {
            const wordLinks = words
              .map(
                (w) =>
                  `<button type="button" class="suggest-word" data-suggest="${escapeHtml(w)}">${escapeHtml(w)}</button>`,
              )
              .join(" \u00B7 ");
            statusEl.innerHTML = `No results for the exact phrase \u201C${escapeHtml(displayQ)}.\u201D Try: ${wordLinks}`;
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
              .join(" \u00B7 ");
            const current =
              statusEl.innerHTML ||
              `No results for \u201C${escapeHtml(displayQ)}.\u201D`;
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
      const showSubject =
        (mode === "all" || mode === "subject") && showMetaBuckets;
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

    async function runFullSearch() {
      const { q, book, mode } = readState();
      const displayQ = displayQueryLabel(q);

      if (!q) {
        setStatus("Type to search.");
        setRefBanner("", false);

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
        return;
      }

      const parsedJump = parseReferenceJump(q);

      setRefBanner(
        parsedJump ? renderReferenceActions(parsedJump) : null,
        Boolean(parsedJump),
      );

      if (q.length < MIN_QUERY_LEN && !parsedJump) {
        setStatus(`Type ${MIN_QUERY_LEN} or more letters to search.`);

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
        return;
      }

      if (q.length < MIN_QUERY_LEN && parsedJump) {
        setStatus("Press Enter to jump, or keep typing to search.");

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

      const allData = resolvedAll.map(({ url, data, metaRanges, locs }, i) => ({
        ...data,
        url,
        __metaRanges: metaRanges,
        __locs: locs,
        __relevanceRank: i,
      }));

      const qUnquoted = displayQ;
      const qPhrase = normalizePhrase(qUnquoted);

      // 1) Glossary matches (exclusive bucket)
      const glossaryMatches = allData.filter((d) => {
        const metaType = String(d?.meta?.type || "");
        return isGlossaryUrl(d.url) || metaType === "glossary";
      });

      // 2) Subject matches (excluding glossary)
      let subjectMatchesRaw = allData.filter((d) => {
        if (isGlossaryUrl(d.url) || String(d?.meta?.type || "") === "glossary")
          return false;
        if (!qPhrase) return false;

        const subjects = [
          ...parseMetaPhrases(d?.meta?.topics || ""),
          ...parseMetaPhrases(d?.meta?.tags || ""),
        ].map(normalizePhrase);

        return subjects.includes(qPhrase);
      });

      // 2b) Topic-only matches via /topics-index.json (covers subjects that aren't body-indexed)
      const topicsData = await loadTopicsIndexOnce();
      if (topicsData) cachedTopicsList = topicsData.topicsList;
      if (topicsData && qPhrase) {
        const { topicsList, topicsUrlMap } = topicsData;

        // Exact topic phrase match
        const exact = topicsUrlMap.get(qPhrase) || [];

        // If no exact hit and the query is a single token, allow whole-word topic matches
        let loose = [];
        if (!exact.length && !/\s/.test(qPhrase)) {
          // Cap to avoid an avalanche on broad tokens (e.g., "god")
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

        if (docs.length) {
          const wantBook = normalizePhrase(String(book || ""));

          const existing = new Set(subjectMatchesRaw.map((r) => r.url));
          for (const doc of docs) {
            const url = String(doc?.url || "");
            if (!url || existing.has(url)) continue;

            const docType = String(doc?.type || "");
            const docBook = normalizePhrase(String(doc?.book || ""));

            if (wantBook && docBook && docBook !== wantBook) continue;

            subjectMatchesRaw.push({
              url,
              meta: {
                title: String(doc?.title || ""),
                type: docType,
                book: String(doc?.book || ""),
                chapter: doc?.chapter != null ? String(doc.chapter) : "",
                // Make the subject label work
                topics: String(doc?.topic || doc?.t || qPhrase || ""),
              },
              excerpt: "",
              locations: [],
            });
            existing.add(url);
          }
        }
      }

      // 3) Keyword matches (excluding glossary)
      const keywordMatchesRaw = allData.filter((d) => {
        if (isGlossaryUrl(d.url) || String(d?.meta?.type || "") === "glossary")
          return false;

        // Intros are subject-indexed only (by design), so keep them out of keyword.
        if (String(d?.meta?.type || "") === "intro") return false;

        const metaRanges =
          d.__metaRanges || getMetaRangesFromAnchors(d?.anchors);
        const locs = d.__locs || getMatchLocations(d);

        // Require at least one match OUTSIDE meta ranges (subjects/tags zones, if any)
        if (!hasNonMetaMatch(locs, metaRanges)) return false;

        const excerptText = stripTags(d?.excerpt);

        if (exactSingleToken) {
          return (
            excerptHasWholeWordMarkedTerm(d?.excerpt, exactToken) ||
            textHasWholeWord(excerptText, exactToken)
          );
        }

        return true;
      });

      // Pull article-page results into their own bucket.
      // Always extract so articles get their own section and are not
      // double-counted as keyword results. Scan all non-glossary Pagefind
      // hits (not just subject+keyword survivors) so articles aren't lost
      // by stricter keyword filters.
      let articleMatchesRaw = [];
      const articleSeen = new Set();
      // First pass: all Pagefind results that are article URLs
      for (const d of allData) {
        if (isGlossaryUrl(d.url) || String(d?.meta?.type || "") === "glossary")
          continue;
        if (!isArticleUrl(d.url)) continue;
        if (articleSeen.has(d.url)) continue;
        articleSeen.add(d.url);
        articleMatchesRaw.push(d);
      }
      // Second pass: article URLs from the topic index that weren't in Pagefind
      for (const d of subjectMatchesRaw) {
        if (!isArticleUrl(d.url)) continue;
        if (articleSeen.has(d.url)) continue;
        articleSeen.add(d.url);
        articleMatchesRaw.push(d);
      }
      subjectMatchesRaw = subjectMatchesRaw.filter((d) => !isArticleUrl(d.url));
      let keywordMatchesRawFiltered = keywordMatchesRaw.filter(
        (d) => !isArticleUrl(d.url),
      );

      // Expand keyword results into per-occurrence cards
      const keywordExpanded = keywordMatchesRawFiltered.flatMap((item) =>
        expandToOccurrences(item, displayQ),
      );

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
