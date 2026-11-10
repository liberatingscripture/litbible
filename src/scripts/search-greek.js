// src/scripts/search-greek.js
//
// The Greek search (STUDY-DESK.md, 1h and 2a): the files it loads and the shape
// the search surfaces draw from, with what those surfaces draw it with. Every
// surface reaches this only through loadGreekSearch() in search-core.js, or from
// a module that is itself loaded on demand (greek-find.js, greek-commands.js),
// never with a static import, so a reader without a Greek search downloads none
// of it, desk on or off (LG-6; test/search-greek-lazy.test.js holds that).
//
// The rules are in src/lib/greek-search.mjs, shared with the Notebook's Greek
// tab; this is the loading. The files are public/greek/search/ (lemmas.json,
// then occ/<NN>.json for the lemma chosen) and public/greek/text/ for a
// result's verse.

import { BOOK_ORDER, bookKeyToLabel } from "../data/books.js";
import {
  decodeOccurrences,
  decodeParseGroup,
  greekHref,
  hasGreek,
  hasOtherForms,
  litVerseKeys,
  matchForTray,
  matchGreek,
  occShard,
  parseStrong,
  prepareBridge,
  prepareIndex,
  sameBuild,
  strongView,
} from "../lib/greek-search.mjs";
import {
  codeFits,
  groupsForFilters,
  isGreekCommandQuery,
  formFallbackTerm,
  isSimpleQuery,
  plainLatinWords,
  matchConstruction,
  parseGreekQuery,
  resolveGreekQuery,
} from "../lib/greek-query.mjs";
import { isGreekQuery } from "./search-core.js";
import { fetchGreekChapter } from "./greek-chapters.js";

// What the surfaces draw results with, so each has the one module to wait for.
export { ARTICLE, ARTICLE_EXAMPLE, articleLine, lemmaLine, versesIn } from "../lib/greek-search.mjs";
export { EXAMPLES, countLine, describeGreekQuery, errorMessage } from "../lib/greek-query.mjs";
export { formsLine, replaceWord, verseGreek } from "../lib/greek-commands-ui.mjs";
export { creditHtml } from "../lib/greek-credits.mjs";

function make(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * A list of example searches as buttons, each running its query when pressed.
 * `run(query)` is the caller's; a button never takes focus from the field on
 * a mouse press, so the field keeps its cursor.
 */
export function exampleList(examples, run) {
  const ul = make("ul", "greek-examples");
  for (const ex of examples) {
    const li = make("li");
    const b = make("button", "greek-ex");
    b.type = "button";
    const q = make("span", "greek-ex__query", ex.query);
    if (hasGreek(ex.query)) q.lang = "grc";
    b.append(q, make("span", "greek-ex__says", ex.says));
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => run(ex.query));
    li.append(b);
    ul.append(li);
  }
  return ul;
}

/** A "See all search commands" kind of button: it reads as a link and opens the window. */
export function commandsLinkButton(label, open) {
  const b = make("button", "greek-cmd-link", label);
  b.type = "button";
  b.addEventListener("click", () => open(b));
  return b;
}

/** True when a query could name Greek: Greek letters, a Strong's number, or one to four Latin words (four only for a LIT rendering, matchGreek). */
export function couldBeGreek(raw) {
  const q = String(raw ?? "").trim();
  if (hasGreek(q) || parseStrong(q)) return true;
  if (q.length < 2) return false;
  const words = q.match(/[\p{L}]+/gu) ?? [];
  return words.length > 0 && words.length <= 4;
}

let greekBridgePromise = null;

/**
 * The glossary bridge (public/search/greek-bridge.json): the LIT's renderings
 * of the glossary terms, so the LIT's own words reach the Greek. Null on
 * failure; the Greek search goes on with the lexicons' English alone.
 */
export function loadGreekBridge(base) {
  greekBridgePromise ||= fetch(`${base}search/greek-bridge.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((json) => prepareBridge(json))
    .catch((err) => {
      console.warn("[search] Failed to load the Greek bridge:", err);
      greekBridgePromise = null;
      return null;
    });
  return greekBridgePromise;
}

// One build at a time (GK6-9). A lemma's id is its place in lemmas.json, the
// shards and parse groups store ids, and public/_headers caches every Greek
// file a day, so after build:greek is re-run a returning reader can hold
// lemmas.json from one build and a shard from the other. Each file carries its
// build's `build`; one from another build than the index is not read (it
// counts as failed to load), and the next load of the index first drops every
// file this page holds and has each one checked with the server from then on
// (`cache: "no-cache"`, a bodiless 304 where nothing changed). A search that
// met one runs once more that way (`freshGreek`); meeting one again, a deploy
// still arriving, it reports the failure.
let staleSeen = 0; // files met from another build than the index
let renewedAt = 0; // staleSeen when this page's files were last dropped
let revalidate = false;

function greekFetch(url) {
  return revalidate ? fetch(url, { cache: "no-cache" }) : fetch(url);
}

function renewIfStale() {
  if (renewedAt === staleSeen) return;
  renewedAt = staleSeen;
  revalidate = true;
  greekIndexPromise = null;
  greekParseNamesPromise = null;
  greekShards.clear();
  greekParseGroups.clear();
}

/** Whether a file is from the index's build; if not, says so and counts it. */
function fromIndexBuild(json, index, what) {
  if (sameBuild(json, index)) return true;
  staleSeen++;
  console.warn(`[search] ${what} is from another build of the Greek data than lemmas.json; checking with the server.`);
  return false;
}

/** Runs a search, and once more if it met a file from another build. */
async function freshGreek(run) {
  const before = staleSeen;
  const res = await run();
  return staleSeen === before ? res : run();
}

let greekIndexPromise = null;

/** public/greek/search/lemmas.json, made ready to search; null on failure (retried next time). */
export function loadGreekIndex(base) {
  renewIfStale();
  greekIndexPromise ||= greekFetch(`${base}greek/search/lemmas.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`lemmas.json missing (${res.status})`);
      return res.json();
    })
    .then((json) => {
      const index = prepareIndex(json);
      // A lemmas.json of another format is one cached from an older build:
      // counted as such, so the next load checks it with the server (GK8-1's
      // format 3 met a day-old format 2).
      if (!index && Number.isInteger(json?.format)) staleSeen++;
      if (!index) throw new Error("lemmas.json is not the format this script reads");
      return index;
    })
    .catch((err) => {
      console.warn("[search] Failed to load the Greek index:", err);
      greekIndexPromise = null;
      return null;
    });
  return greekIndexPromise;
}

const greekShards = new Map();

/**
 * A lemma's occurrence entry from its shard ([forms, flat, parses]) and
 * whether the shard itself failed to load: `{ entry: null, failed: false }`
 * is a lemma the shard has no entry for, `failed: true` is a shard that
 * wouldn't come (GK6-6) or came from another build than `index` (GK6-9).
 */
export async function loadGreekEntry(base, index, id) {
  const name = occShard(index, id);
  let p = greekShards.get(name);
  if (!p) {
    p = greekFetch(`${base}greek/search/occ/${name}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .catch((err) => {
        console.warn("[search] Failed to load Greek occurrences:", err);
        greekShards.delete(name);
        return null;
      });
    greekShards.set(name, p);
  }
  const shard = await p;
  if (shard && !fromIndexBuild(shard, index, `occ/${name}.json`)) return { entry: null, failed: true };
  return { entry: shard?.[id] ?? null, failed: !shard };
}

/** A lemma's occurrence entry from its shard ([forms, flat, parses]), or null. */
export async function loadGreekOccurrences(base, index, id) {
  return (await loadGreekEntry(base, index, id)).entry;
}

/** A chapter's Greek (public/greek/text/<book>-<chapter>.json), or null. */
export function loadGreekChapter(base, book, chapter) {
  return fetchGreekChapter(base, book, chapter).catch(() => null);
}

/**
 * Search the Greek. Resolves to
 *   { kind, lemmas, selected, hits, total, form, otherForms, failed }
 * where `failed` is true when the selected word's verses wouldn't load.
 * `lemmas` are the index's lemma items, best first; `selected` is the one
 * whose verses are in `hits` (the only lemma, or `lemmaId`), else null, in
 * which case a surface offers the lemmas to choose from. Each hit is
 * { book, chapter, verse, t, form, href, label }, in Bible order.
 *
 * Options: `near: false` leaves out near misses (the tray's choice); `tray`
 * is the older tray rule for Latin queries, no longer used by the tray;
 * `bookKey` narrows the verses; `lemmaId` picks a lemma;
 * `exactForm` keeps only the form typed (Greek queries only).
 */
export function searchGreek(base, raw, options = {}) {
  return freshGreek(() => searchGreekOnce(base, raw, options));
}

async function searchGreekOnce(base, raw, { tray = false, near = true, bookKey = "", lemmaId = null, exactForm = false } = {}) {
  const empty = { kind: null, lemmas: [], selected: null, hits: [], total: 0, form: null, otherForms: false, failed: false };
  if (!couldBeGreek(raw)) return empty;
  const index = await loadGreekIndex(base);
  if (!index) return { ...empty, failed: true };
  // The LIT's own renderings only matter to Latin text.
  const bridge = isGreekQuery(raw) ? null : await loadGreekBridge(base);
  let match;
  let found;
  if (tray) {
    ({ match, lemmas: found } = matchForTray(index, raw));
  } else {
    match = matchGreek(index, raw, { near, bridge, offerForms: true });
    found = match.lemmas;
  }
  // A Strong's number finds only the words tagged with it (GK8-1): each lemma
  // is counted, and its verses kept, by those words alone.
  const strongs = match.kind === "strong" ? [match.strong] : null;
  let lemmas = found.map((m) => ({ ...strongView(index.lemmas[m.id], strongs), how: m.how, lit: m.lit ?? null }));
  // A LIT rendering names a term's verses, not its words (until alignment
  // phase 2), and a term can govern several lemmas: count each lemma in those
  // verses, and drop one that never occurs there.
  const litKey = (h) => `${BOOK_ORDER.indexOf(h.book)}.${h.chapter}.${h.verse}`;
  let litShardFailed = false;
  await Promise.all(
    lemmas
      .filter((l) => l.lit)
      .map(async (l) => {
        const keys = litVerseKeys(l.lit);
        const { entry, failed: shardFailed } = await loadGreekEntry(base, index, l.id);
        // A shard that failed is not "never occurs there" (GK6-6): keep the lemma, say so.
        if (shardFailed) litShardFailed = true;
        l.lit = { ...l.lit, counted: decodeOccurrences(entry, BOOK_ORDER).filter((h) => keys.has(litKey(h))).length };
      }),
  );
  if (litShardFailed) return { ...empty, kind: match.kind, lemmas, form: match.form, query: match.query ?? null, failed: true };
  lemmas = [
    ...lemmas.filter((l) => l.lit?.counted > 0).sort((a, b) => b.lit.counted - a.lit.counted),
    ...lemmas.filter((l) => !l.lit),
  ];
  const selected =
    (lemmaId != null && lemmas.find((l) => l.id === Number(lemmaId))) ||
    (lemmas.length === 1 ? lemmas[0] : null);
  const out = { ...empty, kind: match.kind, lemmas, selected, form: match.form, query: match.query ?? null };
  if (!selected) return out;
  const entry = await loadGreekOccurrences(base, index, selected.id);
  // A word with occurrences and no entry means its shard didn't load (GK-6).
  if (!entry && selected.count > 0) out.failed = true;
  const form = exactForm && match.form ? match.form : null;
  out.otherForms = hasOtherForms(entry, match.form);
  // Found by a LIT rendering: only the verses where the LIT renders it so.
  const litKeys = selected.lit ? litVerseKeys(selected.lit) : null;
  const decoded = decodeOccurrences(entry, BOOK_ORDER, { bookKey, form, strongs, primary: selected.strong }).filter(
    (h) => !litKeys || litKeys.has(litKey(h)),
  );
  out.hits = decoded.map((h) => ({
    ...h,
    href: greekHref(h),
    label: `${bookKeyToLabel(h.book)} ${h.chapter}:${h.verse}`,
  }));
  out.total = out.hits.length;
  return out;
}

/* ── Searching the Greek with commands (STUDY-DESK.md, 2a) ───────────── */

// What a command query means is src/lib/greek-query.mjs's; this loads the
// files it needs and puts the answer in the shape the three search surfaces
// draw from. The index by parsing is public/greek/search/parse.json (the
// groups and their sizes) and parse/<group>.json (every word of a group).

let greekParseNamesPromise = null;

/**
 * The parse groups' names (public/greek/search/parse.json), or null on failure
 * (retried next time) or when the file is from another build than `index`.
 */
export async function loadGreekParseNames(base, index) {
  greekParseNamesPromise ||= greekFetch(`${base}greek/search/parse.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((json) => {
      if (!json?.groups) throw new Error("parse.json is not the format this script reads");
      return { names: Object.keys(json.groups), build: json.build };
    })
    .catch((err) => {
      console.warn("[search] Failed to load the Greek parse groups:", err);
      greekParseNamesPromise = null;
      return null;
    });
  const got = await greekParseNamesPromise;
  return got && fromIndexBuild(got, index, "parse.json") ? got.names : null;
}

const greekParseGroups = new Map();

/** One parse group's words, decoded (greek-search.mjs decodeParseGroup), or null, as for loadGreekParseNames. */
export async function loadGreekParseGroup(base, name, index) {
  let p = greekParseGroups.get(name);
  if (!p) {
    p = greekFetch(`${base}greek/search/parse/${name}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        const words = decodeParseGroup(json, BOOK_ORDER);
        if (!words) throw new Error("not the format this script reads");
        return { words, build: json.build };
      })
      .catch((err) => {
        console.warn("[search] Failed to load a Greek parse group:", err);
        greekParseGroups.delete(name);
        return null;
      });
    greekParseGroups.set(name, p);
  }
  const got = await p;
  return got && fromIndexBuild(got, index, `parse/${name}.json`) ? got.words : null;
}

/**
 * Search the Greek by a command query ("πίστις.gen, Ἰησοῦς/Χριστός.gen",
 * "*.aor.impv"). Resolves to
 *   { kind: "commands", resolved, hits, matchCount, verseCount, error, failed }
 * `resolved` is the query read and looked up (greek-query.mjs), for
 * describeGreekQuery; each hit is
 *   { book, chapter, verse, matches, marked, t, href, label }
 * in Bible order, `matches` the words of each match, `marked` every word of
 * them (sorted, once each) and `t` the first match's first word, which the
 * link opens. `error` is the parse or lookup error (errorMessage turns it into
 * a sentence), and `failed` is true when a file the search needs wouldn't
 * load. `bookKey` narrows the verses.
 */
export function searchGreekCommands(base, raw, options = {}) {
  return freshGreek(() => searchGreekCommandsOnce(base, raw, options));
}

async function searchGreekCommandsOnce(base, raw, { bookKey = "" } = {}) {
  const out = {
    kind: "commands", resolved: null, hits: [], matchCount: 0, verseCount: 0, error: null, failed: false,
    lemmas: [], selected: null, total: 0, form: null, otherForms: false,
  };
  const parsed = parseGreekQuery(raw);
  if (parsed.error) return { ...out, error: parsed.error };
  if (!parsed.terms.length) return out;

  const index = await loadGreekIndex(base);
  if (!index) return { ...out, failed: true };
  // The LIT's own renderings only matter to words typed in Latin letters.
  const latin = parsed.terms.some((t) => t.words?.some((w) => !hasGreek(w) && !parseStrong(w)));
  const bridge = latin ? await loadGreekBridge(base) : null;
  const resolved = resolveGreekQuery(index, parsed, { bridge });
  if (resolved.error) return { ...out, error: resolved.error };

  const needsGroups = resolved.terms.some((t) => !t.lemmaIds);
  const groupNames = needsGroups ? await loadGreekParseNames(base, index) : [];
  if (!groupNames) return { ...out, resolved, failed: true };

  let failed = false;
  const listFor = async (term, book) => {
    const fits = (w) => (!book || w.book === book) && codeFits(term.filters, w.pos + w.parse);
    if (term.lemmaIds) {
      const parts = await Promise.all(
        term.lemmaIds.map(async (id) => {
          const entry = await loadGreekOccurrences(base, index, id);
          if (!entry) failed = true;
          // A lemma reached only by a Strong's number keeps the words tagged with it (GK8-1).
          const strongs = term.strongs?.[id] ?? null;
          return decodeOccurrences(entry, BOOK_ORDER, { form: term.form, bookKey: book, strongs, primary: index.lemmas[id].strong }).filter(fits);
        }),
      );
      return parts.flat();
    }
    const names = groupsForFilters(term.filters, groupNames);
    const groups = await Promise.all(names.map((n) => loadGreekParseGroup(base, n, index)));
    return groups.flatMap((g) => {
      if (!g) failed = true;
      return (g ?? []).filter(fits);
    });
  };
  // The narrow fallback (GK3 Q1): a word read lemma-first that finds nothing
  // under its filters anywhere in the New Testament, while another lemma with
  // the same spelling does (ἐξ.prep: not the numeral ἕξ, but ἐκ). It is judged
  // on the whole text, so a book filter never changes which word is meant.
  const terms = await Promise.all(
    resolved.terms.map(async (term) => {
      if (!term.altIds?.length) return term;
      if ((await listFor(term, "")).length) return term;
      const alt = formFallbackTerm(index, term);
      return alt && (await listFor(alt, "")).length ? alt : term;
    }),
  );
  if (failed) return { ...out, resolved, failed: true };
  const settled = terms.some((t, i) => t !== resolved.terms[i]) ? { ...resolved, terms } : resolved;
  const lists = await Promise.all(settled.terms.map((term) => listFor(term, bookKey)));
  if (failed) return { ...out, resolved: settled, failed: true };

  const found = matchConstruction(lists, { gap: settled.gap, anyOrder: settled.anyOrder, bookOrder: BOOK_ORDER });
  const hits = found.map((h) => {
    const marked = [...new Set(h.matches.flat())].sort((a, b) => a - b);
    const t = h.matches[0][0];
    return {
      ...h,
      marked,
      t,
      href: greekHref({ book: h.book, chapter: h.chapter, verse: h.verse, t }),
      label: `${bookKeyToLabel(h.book)} ${h.chapter}:${h.verse}`,
    };
  });
  return {
    ...out,
    resolved: settled,
    hits,
    matchCount: hits.reduce((n, h) => n + h.matches.length, 0),
    verseCount: hits.length,
    total: hits.length,
  };
}

/** Whether a Latin search found a lemma by the whole phrase: the LIT's rendering, a gloss or a sense. */
function wholeGloss(res) {
  return res.kind === "latin" && res.lemmas.some((l) => l.how === "lit" || l.how === "sense" || (l.how === "gloss" && l.glossHeads?.includes(res.query)));
}

/**
 * The one Greek search the three surfaces call (the search bar's tray,
 * /search and the Notebook's Greek tab). A command query goes to
 * searchGreekCommands, unless it reads as one plain word ("πίστις.", "πίστις
 * and"), which is searchGreek's as before. Two or three plain Latin words that
 * hold a command word are a gloss when they are one whole ("present time",
 * "in order to"), and a command otherwise, falling back to the gloss when the
 * command fails or finds nothing (BA45, BVJ 2026-10-27). Any other query is
 * searchGreek's as before; when that finds no word and the query is two or
 * three plain Latin words, they are tried as a construction (pistis Christos).
 * Resolves to searchGreek's result, or to searchGreekCommands's (kind
 * "commands"). The options are searchGreek's, and `bookKey` is
 * searchGreekCommands's too.
 */
export async function searchGreekAuto(base, raw, options = {}) {
  const q = String(raw ?? "").trim();
  if (isGreekCommandQuery(q)) {
    // First, so a gloss ending in a command word ("be next to") isn't cut short.
    const gloss = plainLatinWords(q) ? await searchGreek(base, q, options) : null;
    if (gloss && wholeGloss(gloss)) return gloss;
    const parsed = parseGreekQuery(q);
    if (!parsed.error && isSimpleQuery(parsed)) return searchGreek(base, parsed.terms[0].words[0], options);
    if (!gloss) return searchGreekCommands(base, q, { bookKey: options.bookKey });
    const cmd = await searchGreekCommands(base, q, { bookKey: options.bookKey });
    if ((cmd.error || (!cmd.failed && !cmd.hits.length)) && gloss.lemmas.length) return gloss;
    return cmd;
  }
  const res = await searchGreek(base, q, options);
  if (!res.lemmas.length && plainLatinWords(q)) {
    const cmd = await searchGreekCommands(base, q, { bookKey: options.bookKey });
    // A word that matched nothing is the single search's "no match", not a
    // command that went wrong.
    if (cmd.error?.kind !== "unknown") return cmd;
  }
  return res;
}
