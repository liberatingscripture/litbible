// src/scripts/desk/tab-greek.js
//
// The Notebook panel's "Greek" tab (STUDY-DESK.md, "Decisions", 2026-10-08;
// phase 1f), on Chapter View chapters and on draft chapters: the SBL Greek New
// Testament for this chapter, with a word's dictionary form, parsing and
// lexicon entries docked at the tab's foot. A draft has no LIT text beside it,
// so there is no "Go to verse" and no footnote letters there.
//
// The Greek scrolls on its own and never follows the page (BVJ: each text
// scrolls on its own). A "Go to verse N" button names the verse at the page's
// reading line and takes the Greek there; the tab first opens at the verse in
// the address, or the one being read. Nothing here scrolls the PAGE: the text
// is moved by setting its scroller's scrollTop, never by scrollIntoView.
//
// A word is a button, but only one is a tab stop (the roving word, the
// selected one or else the first of the verse in view): Left and Right step by
// word, Home and End go to the chapter's ends, Up and Down to the previous or
// next verse. Moving selects, which fills the details. The details are
// announced through one polite live region holding the word and its parsing.
//
// The files are public/greek/ (greek-data.js). Nothing here adds to or
// changes the scripture on the page.

import { describeParse } from "../../lib/greek-parse.mjs";
import { plainTextOf } from "../../lib/desk-greek-text.mjs";
import { GREEK_LICENSE_HREF, SOURCES } from "../../lib/greek-credits.mjs";
import { parsingQuery } from "../../lib/greek-detect.mjs";
import {
  W, borrowedFor, firstWordOf, flattenWords, indexOfWord, joinAnd, moveFrom, nearestVerse, noteVerseFor, orderSenses,
  langRuns, renderingsIn, splitSigns, termsForLemma, versesOf, wordStrong,
} from "../../lib/desk-greek.mjs";
import { verseAtReadingLine } from "../last-read.js";
import {
  MAX_SPLIT,
  MIN_SPLIT,
  SPLIT_STEP,
  clampSplit,
  forgetsSplit,
  splitFromPointer,
} from "../../lib/desk-greek-split.mjs";
import { WIDTHS_EVENT, keepGreekSplit, keptGreekSplit } from "./widths.js";
import { clickOrDrag, isMenuKey, toggleLineMenu } from "./line-menu.js";
import {
  getLexicon, loadChapterGreek, loadLsjEntries, loadStepEntries, loadUbsEntry, setLexicon,
} from "./greek-data.js";
import { make } from "./dom.js";

// The editions SBL's notes compare the SBLGNT with.
const EDITIONS = [
  ["WH", "Westcott–Hort"],
  ["Treg", "Tregelles"],
  ["NA28", "Nestle–Aland, 28th edition"],
  ["RP", "Robinson–Pierpont"],
  ["NIV", "the Greek text behind the NIV"],
];

const BORROWED = {
  "macula-sblgnt": {
    note: "John 7:53–8:11: SBL added this passage to the SBLGNT in its 2023 data, in double brackets. Parsing from MACULA Greek.",
    from: "Parsing for this passage is from MACULA Greek.",
  },
  "sblgnt-apparatus+macula-nestle1904": {
    note: "Romans 16:25–27: not in the SBLGNT text. The Greek is the reading its apparatus prints (Westcott–Hort, Tregelles, NA28), parsed from MACULA Greek’s Nestle 1904.",
    from: "This Greek is the reading the SBLGNT’s apparatus prints. Parsing is from MACULA Greek’s Nestle 1904.",
  },
};

// The sources and their licenses are src/lib/greek-credits.mjs, which the
// search results' credit line shares (BA46).

// How long an apparatus entry stays lit after a sign takes the reader to it.
const LIT_MS = 1800;

/**
 * Text into `into` with the Greek and Hebrew in it marked by `lang`, so a
 * screen reader voices a quoted word as the language it is (GK-2).
 */
function appendLang(into, text) {
  for (const run of langRuns(text)) {
    if (!run.lang) {
      into.append(document.createTextNode(run.text));
    } else {
      const s = make("span", null, run.text);
      s.lang = run.lang;
      into.append(s);
    }
  }
}

/**
 * Lexicon HTML into `to`, keeping only what the build is meant to leave in it
 * (b, i, br, span.lex-ref and abbr[title]) and dropping the rest, text kept.
 * The build already sanitizes; this is the second lock. A template's content
 * is inert, so nothing in the markup runs or loads while it's read.
 */
function sanitizeInto(to, html) {
  const t = document.createElement("template");
  t.innerHTML = String(html ?? "");
  const walk = (from, into) => {
    for (const n of from.childNodes) {
      if (n.nodeType === 3) {
        appendLang(into, n.nodeValue);
      } else if (n.nodeType === 1) {
        const tag = n.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") continue;
        if (tag === "B" || tag === "I") {
          const e = document.createElement(tag.toLowerCase());
          walk(n, e);
          into.append(e);
        } else if (tag === "BR") {
          into.append(document.createElement("br"));
        } else if (tag === "SPAN" && n.classList.contains("lex-ref")) {
          const e = make("span", "lex-ref");
          walk(n, e);
          into.append(e);
        } else if (tag === "ABBR") {
          const e = document.createElement("abbr");
          const title = n.getAttribute("title");
          if (title) e.setAttribute("title", title);
          walk(n, e);
          into.append(e);
        } else {
          walk(n, into);
        }
      }
    }
  };
  walk(t.content, to);
}

/**
 * A button that writes out the sources a lexicon entry names, which are the
 * `title` of its abbreviations and so reach only a mouse's hover. Pressed,
 * each is set in brackets after its abbreviation; pressed again, they go.
 * Null where the entry cites none (GK-12).
 */
function sourcesToggle(body) {
  if (!body.querySelector("abbr[title]")) return null;
  // Its own class: "desk-greek__sources" is the credit block's, and a button
  // given it was drawn as a pill around the licence (GK3-1). The label stays
  // fixed and the state is aria-pressed alone; a label that also flips to
  // "Hide sources" read as "Hide sources, pressed" (GK3-8).
  const b = make("button", "desk-greek__show-sources", "Show sources");
  b.type = "button";
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    body.querySelectorAll(".lex-cite").forEach((c) => c.remove());
    if (!on) return;
    for (const a of body.querySelectorAll("abbr[title]")) {
      // Many titles hold Greek (28,920 of 76,389), so they go through the
      // same language marking as the entry's own text (GK-2).
      const c = make("span", "lex-cite");
      appendLang(c, ` [${a.getAttribute("title")}]`);
      a.after(c);
    }
  });
  return b;
}

/** The page's glossary terms, or null (the lens data is absent on some chapters). */
function readTermData() {
  try {
    return JSON.parse(document.getElementById("term-lens-data")?.textContent || "null");
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ here: { bookKey: string, chapter: number, label: string },
 *   visible: () => boolean, openVerse: (verse: number) => void }} options
 *   `openVerse` opens This verse at a verse (the footnote letters under a
 *   word).
 *
 *   On /desk (desk-panes.js) the chapter isn't the page's: `source` gives the
 *   chapter's text and key terms from its fetched Chapter View page
 *   (chapter-page.js), with `textBox` null for a draft; `startVerse` is
 *   where it opens; `idSuffix` keeps two panes' ids apart; `openHit` takes a
 *   search result in another chapter (the pane moves there, rather than the
 *   page leaving /desk); and `onTopVerse` hears the verse at the Greek's top
 *   whenever the reader's scrolling changes it, which is how the Greek leads
 *   back (D9, the 1g answer). There is no "Go to verse" button then: the
 *   pane is moved with `goToVerse`.
 * @returns {{ el: HTMLElement, render: () => Promise<void>,
 *   selectWord: (verse: number, t: number, opts?: { focus?: boolean }) => Promise<boolean>,
 *   goToVerse: (verse: number) => Promise<void>, settle: () => void,
 *   destroy: () => void }}
 */
export function createGreekTab({
  here, visible, openVerse, source = null, startVerse = null, idSuffix = "", openHit = null, onTopVerse = null,
}) {
  const textBox = source ? source.textBox : document.querySelector(".chapter-paragraphs");
  const markers = source ? [] : Array.from(textBox?.querySelectorAll('sup.vn[id^="v"]') ?? []);
  const termData = source ? source.termData : readTermData();

  const el = make("div", "desk-greek");
  el.innerHTML = `
    <div class="desk-greek__head">
      <h3 class="desk-greek__title" id="deskGreekTitle${idSuffix}" tabindex="-1"></h3>
      <button type="button" class="desk-greek__goto" hidden></button>
    </div>
    <div class="desk-greek__scroller"></div>
    <div class="desk-greek__scroller desk-greek__results" aria-label="Greek search results" role="region" hidden></div>
    <div class="desk-greek__split" role="separator" aria-orientation="horizontal" aria-label="Resize the Greek and the entry" tabindex="0"><span class="desk-greek__split-grip" aria-hidden="true"></span></div>
    <section class="desk-greek__details" aria-label="Word details">
      <div class="sr-only desk-greek__announce" aria-live="polite" aria-atomic="true"></div>
      <div class="desk-greek__live">
        <button type="button" class="desk-greek__close" aria-label="Close the word’s details" title="Close the word’s details" hidden>&times;</button>
        <h4 class="desk-greek__word" lang="grc"></h4>
        <p class="desk-greek__parse"></p>
      </div>
      <div class="desk-greek__more" hidden>
        <p class="desk-greek__lemma"></p>
        <p class="desk-greek__from" hidden></p>
        <div class="desk-seg desk-greek__switch" role="radiogroup" aria-label="Lexicon">
          <label class="desk-seg__option">
            <input type="radio" class="desk-seg__input" name="desk-greek-lex${idSuffix}" value="ubs" />
            <span class="desk-seg__text">UBS dictionary</span>
          </label>
          <label class="desk-seg__option">
            <input type="radio" class="desk-seg__input" name="desk-greek-lex${idSuffix}" value="step" />
            <span class="desk-seg__text">STEPBible</span>
          </label>
        </div>
        <div class="desk-greek__lex"></div>
        <p class="desk-greek__fns" hidden></p>
        <p class="desk-greek__appline" hidden></p>
        <div class="desk-greek__lit" hidden></div>
        <p class="desk-greek__caveat">A lexicon and the LIT can differ. The LIT’s notes give its reasons.</p>
      </div>
    </section>`;

  const title = el.querySelector(".desk-greek__title");
  const goto = el.querySelector(".desk-greek__goto");
  const scroller = el.querySelector(".desk-greek__scroller");
  const details = el.querySelector(".desk-greek__details");
  const splitter = el.querySelector(".desk-greek__split");
  const wordHead = el.querySelector(".desk-greek__word");
  const parseLine = el.querySelector(".desk-greek__parse");
  const closeWord = el.querySelector(".desk-greek__close");
  // A line for what the lazy search module is doing or couldn't do. It is in
  // the page from the start and only its text changes, since a live region
  // made with its text already in it is often not announced (GK3-13).
  const findNote = make("p", "desk-greek__find-note");
  findNote.setAttribute("role", "status");
  parseLine?.after(findNote);
  const NO_WORD = "Select a word to see its dictionary entry. Left and Right move between words, Up and Down between verses.";
  const more = el.querySelector(".desk-greek__more");
  const lemmaLine = el.querySelector(".desk-greek__lemma");
  const fromLine = el.querySelector(".desk-greek__from");
  const lexSwitch = el.querySelector(".desk-greek__switch");
  const lexBox = el.querySelector(".desk-greek__lex");
  const fnsLine = el.querySelector(".desk-greek__fns");
  const appLine = el.querySelector(".desk-greek__appline");
  const litBox = el.querySelector(".desk-greek__lit");
  const announce = el.querySelector(".desk-greek__announce");
  const radios = Array.from(el.querySelectorAll(".desk-greek__switch input"));
  title.textContent = `${here.label} in Greek`;

  let data = null;
  let flat = [];
  let verses = [];
  let buttons = []; // flat index -> its button
  const verseMarks = new Map(); // verse -> its number in the text
  let selected = null;
  let selKin = []; // the other words of the selected word's lemma, tinted green
  let rover = 0;
  let pending = null; // a verse to scroll to once the tab has a size
  let loading = null;
  let lexSeq = 0;
  let lexTimer = 0; // the pause before a selected word's lexicon is asked for
  const LEXICON_PAUSE = 150; // ms
  let toldTop = null; // the verse last told to onTopVerse (or moved to)

  // The tab's search and the engine behind it (greek-find.js) load when the
  // reader starts a search, not with the tab (LG-6). A failed load is forgotten,
  // so the next click tries again.
  let find = null;
  let findLoading = null;
  let findAsk = 0;
  const loadFind = () =>
    (findLoading ||= import("./greek-find.js")
      .then(({ createGreekFind }) => {
        find = createGreekFind({
          root: el,
          here,
          selectWord: selectWordHere,
          openHit,
          // Focus goes back to the selected word, else the roving one.
          focusText: () => {
            const b = buttons[selected ?? rover];
            if (!b) return false;
            b.focus({ preventScroll: true });
            return true;
          },
        });
        return find;
      })
      .catch((err) => {
        findLoading = null;
        throw err;
      }));

  function openFind(opts) {
    const ask = ++findAsk;
    findNote.textContent = find ? "" : "Opening the Greek search…";
    loadFind().then(
      (f) => {
        if (ask !== findAsk || destroyed) return;
        findNote.textContent = "";
        f.open(opts);
      },
      (err) => {
        console.error("Study Desk: the Greek search couldn't load", err);
        if (ask !== findAsk || destroyed) return;
        findNote.textContent = "The Greek search couldn’t be loaded. Try again.";
      },
    );
  }

  function closeFind(opts) {
    findAsk++; // a search still loading doesn't open over what came after it
    find?.close(opts);
  }

  /* ── Loading ───────────────────────────────────────────────────── */

  function showStatus(message, retry) {
    const box = make("div", "desk-greek__status");
    box.setAttribute("role", "status");
    box.append(make("p", null, message));
    if (retry) {
      const b = make("button", "desk-greek__retry", "Try again");
      b.type = "button";
      b.addEventListener("click", () => { ensure(); });
      box.append(b);
    }
    scroller.replaceChildren(box);
  }

  let destroyed = false; // taken down (destroy, below)

  /** Load and draw the chapter once; resolves true when the Greek is on the tab. */
  function ensure() {
    if (data) return Promise.resolve(true);
    if (loading) return loading;
    showStatus("Loading the Greek…");
    loading = loadChapterGreek(here.bookKey, here.chapter)
      .then(
        (d) => {
          // A file in a format this code doesn't read would throw in build() and
          // leave "Loading" up for good; say so and offer Try again instead (GK-14).
          if (d?.format !== 1 || !Array.isArray(d.paragraphs)) {
            showStatus("The Greek couldn’t be loaded.", true);
            return false;
          }
          data = d;
          return true;
        },
        () => {
          showStatus("The Greek couldn’t be loaded.", true);
          return false;
        },
      )
      .then((ok) => {
        loading = null;
        // A tab taken down while its chapter loaded is never built (BA115).
        if (ok && !destroyed) build();
        return ok;
      });
    return loading;
  }

  /* ── The text ──────────────────────────────────────────────────── */

  /** Text with its text-critical signs as buttons (pre and post of a word). */
  function appendWithSigns(p, text, verse) {
    for (const piece of splitSigns(text)) {
      if (!piece.sign) {
        p.append(document.createTextNode(piece.text));
        continue;
      }
      const b = make("button", "desk-greek__sign", piece.text);
      b.type = "button";
      b.tabIndex = -1;
      b.dataset.verse = String(verse);
      b.setAttribute("aria-label", `Apparatus note on verse ${verse}`);
      p.append(b);
    }
  }

  let resizes = null; // the scroller's ResizeObserver, once built
  function build() {
    flat = flattenWords(data.paragraphs);
    verses = versesOf(flat);
    buttons = [];
    selKin = [];
    verseMarks.clear();
    const frag = document.createDocumentFragment();

    if (data.title) {
      const h = make("h4", "desk-greek__book", data.title);
      h.lang = "grc";
      frag.append(h);
    }

    const noted = new Set();
    let i = 0;
    let last = null;
    for (const words of data.paragraphs) {
      // A borrowed passage says so above its first paragraph.
      const first = words[0]?.[W.verse];
      const range = first == null ? null : borrowedFor(data.borrowed, first);
      if (range && !noted.has(range)) {
        noted.add(range);
        const note = BORROWED[range[2]]?.note ?? `Verses ${range[0]}–${range[1]} are not in the SBLGNT text; their source is ${range[2]}.`;
        frag.append(make("p", "desk-greek__borrowed", note));
      }
      // The language is on each word, not the paragraph: the "Verse" labels and
      // the signs' names are English and sit among the words (GK-11).
      const p = make("p", "desk-greek__p");
      for (const w of words) {
        const verse = w[W.verse];
        if (verse !== last) {
          last = verse;
          const vn = make("sup", "desk-greek__vn");
          vn.dataset.vn = String(verse);
          vn.append(make("span", "sr-only", "Verse "), String(verse));
          verseMarks.set(verse, vn);
          p.append(vn);
        }
        appendWithSigns(p, w[W.pre], verse);
        const b = make("button", "desk-greek__w", w[W.text]);
        b.lang = "grc";
        b.type = "button";
        b.tabIndex = -1;
        b.dataset.i = String(i);
        b.setAttribute("aria-pressed", "false");
        buttons.push(b);
        p.append(b);
        appendWithSigns(p, w[W.post], verse);
        i++;
      }
      frag.append(p);
    }

    frag.append(apparatusSection(), sourcesSection());
    scroller.replaceChildren(frag);

    rover = 0;
    if (buttons[0]) buttons[0].tabIndex = 0;
    wordHead.textContent = "";
    parseLine.textContent = NO_WORD;
    more.hidden = true;
    closeWord.hidden = true;

    window.addEventListener("scroll", queueGoto, { passive: true });
    scroller.addEventListener("scroll", queueGoto, { passive: true });
    if (typeof ResizeObserver === "function") {
      resizes = new ResizeObserver(() => {
        if (pending != null && scroller.clientHeight > 0) {
          const v = pending;
          pending = null;
          scrollToVerse(v);
        }
        queueGoto();
      });
      resizes.observe(scroller);
    }

    openAtReading();
  }

  function apparatusSection() {
    const sec = make("section", "desk-greek__app");
    sec.setAttribute("aria-labelledby", `deskGreekAppTitle${idSuffix}`);
    const h = make("h4", "desk-greek__subhead", "Apparatus");
    h.id = `deskGreekAppTitle${idSuffix}`;
    sec.append(h);
    const key = make("dl", "desk-greek__key");
    for (const [abbr, name] of EDITIONS) key.append(make("dt", null, abbr), make("dd", null, name));
    sec.append(
      make("p", "desk-greek__app-intro", "The signs in the text mark where the SBLGNT’s notes compare its reading with these editions:"),
      key,
    );
    const list = make("ol", "desk-greek__app-list");
    for (const [verse, notes] of data.apparatus ?? []) {
      const li = make("li", "desk-greek__app-item");
      li.tabIndex = -1;
      li.dataset.appVerse = String(verse);
      li.append(make("span", "desk-greek__app-ref", `${here.chapter}:${verse}`));
      const body = make("span", "desk-greek__app-notes");
      // A note opens with its own verse ("8:1 " or "13 "), which the label
      // already says; only that is dropped.
      const lead = new RegExp(`^(?:${here.chapter}:)?${verse}\\s+`);
      // The note is mostly Latin sigla (WH, Treg, NA28, RP), so only its Greek
      // runs are marked, through appendLang (GK8-3).
      for (const note of notes) {
        const n = make("span", "desk-greek__app-note");
        appendLang(n, note.replace(lead, ""));
        body.append(n);
      }
      li.append(body);
      const back = make("button", "desk-greek__back", "Back to the text");
      back.type = "button";
      back.setAttribute("aria-label", `Back to verse ${verse} in the text`);
      back.addEventListener("click", () => backToText(verse));
      li.append(back);
      list.append(li);
    }
    if (list.children.length) sec.append(list);
    else sec.append(make("p", "desk-greek__app-intro", "The SBLGNT prints no notes on this chapter."));
    return sec;
  }

  function sourcesSection() {
    const sec = make("section", "desk-greek__sources");
    sec.setAttribute("aria-labelledby", `deskGreekSourcesTitle${idSuffix}`);
    const h = make("h4", "desk-greek__subhead", "Sources and licenses");
    h.id = `deskGreekSourcesTitle${idSuffix}`;
    const ul = make("ul", "desk-greek__sources-list");
    for (const [label, href] of SOURCES) {
      const li = make("li");
      li.append(externalLink(label, href));
      ul.append(li);
    }
    const share = make("p", "desk-greek__sources-note");
    const license = make("a", null, "the license note");
    license.href = GREEK_LICENSE_HREF;
    share.append("The Greek text files are shared under CC BY-SA 4.0, the lexicons under their own licenses. See ", license, ".");
    sec.append(h, ul, share);
    return sec;
  }

  function externalLink(label, href) {
    const a = make("a", null, label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  /* ── Where the text is ─────────────────────────────────────────── */

  /** Move the Greek (and only the Greek) so `target` shows; the page never moves. */
  function bringIntoView(target) {
    if (!scroller.clientHeight) return;
    const s = scroller.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const pad = 12;
    if (r.top < s.top + pad) scroller.scrollTop += r.top - s.top - pad;
    else if (r.bottom > s.bottom - pad) scroller.scrollTop += r.bottom - s.bottom + pad;
  }

  /** Put a verse's number at the top of the Greek. */
  function scrollToVerse(verse) {
    const mark = verseMarks.get(verse);
    if (!mark) return;
    if (!scroller.clientHeight) {
      pending = verse;
      return;
    }
    if (verse === verses[0]) {
      scroller.scrollTop = 0;
    } else {
      const s = scroller.getBoundingClientRect();
      scroller.scrollTop += mark.getBoundingClientRect().top - s.top - 6;
    }
    queueGoto();
  }

  // On /desk there is no page to read along with: the pane is moved instead.
  const pageVerse = () => (source ? null : verseAtReadingLine(markers, (id) => Number(id.slice(1)) || null));

  /** Where the tab first opens: the address's verse, or the one being read. */
  function openAtReading() {
    const m = source ? null : /^#v(\d+)/.exec(window.location.hash);
    const fromHash = m ? Number(m[1]) : null;
    // A verse the Greek lacks (Matthew 17:21) opens at the nearest one.
    const at = nearestVerse(verses, startVerse) ?? nearestVerse(verses, fromHash)
      ?? nearestVerse(verses, pageVerse()) ?? verses[0];
    if (at == null) return;
    // Opening at a verse isn't the reader scrolling there.
    toldTop = at;
    setRover(firstWordOf(flat, at));
    scrollToVerse(at);
  }

  /** The verse whose number is the last at or above the Greek's top edge. */
  function topVerse() {
    const top = scroller.getBoundingClientRect().top + 24;
    let found = verses[0];
    for (const v of verses) {
      if (verseMarks.get(v).getBoundingClientRect().top > top) break;
      found = v;
    }
    return found;
  }

  let queued = false;
  function queueGoto() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      updateGoto();
    });
  }

  /** "Go to verse N": the page's verse, unless the Greek already shows it near its top. */
  function updateGoto() {
    if (!data || !visible() || !scroller.clientHeight) return;
    reportTop();
    const v = pageVerse();
    const mark = v == null ? null : verseMarks.get(v);
    if (!mark) {
      goto.hidden = true;
      return;
    }
    const top = mark.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const near = top >= -4 && top <= scroller.clientHeight * 0.35;
    goto.hidden = near || topVerse() === v;
    goto.textContent = `Go to verse ${v}`;
    goto.dataset.verse = String(v);
  }

  goto.addEventListener("click", () => {
    const v = Number(goto.dataset.verse);
    if (!verseMarks.has(v)) return;
    scrollToVerse(v);
    // The button is about to hide itself; focus goes to the verse's first word.
    const i = firstWordOf(flat, v);
    setRover(i);
    buttons[i]?.focus({ preventScroll: true });
    goto.hidden = true;
  });

  // The verse at the Greek's top, told to `onTopVerse` when the reader's
  // scrolling changes it. A move made here (opening at a verse, goToVerse,
  // a selected word brought into view) is not told back: only scrolling the
  // reader started counts, so two panes kept in step never chase each other,
  // and a verse near the chapter's end, which can't reach the top, isn't
  // pulled back to the one that does.
  let readerScrolled = false;
  if (onTopVerse) {
    const byReader = () => { readerScrolled = true; };
    for (const type of ["wheel", "pointerdown", "touchstart", "keydown"]) {
      scroller.addEventListener(type, byReader, { passive: true });
    }
  }
  function reportTop() {
    if (!onTopVerse || !verses.length || !readerScrolled) return;
    const v = topVerse();
    if (v == null || v === toldTop) return;
    toldTop = v;
    onTopVerse(v);
  }

  /**
   * The pane was moved (desk-page.js redraws /desk's panes, which takes each
   * off the page and puts its scrolling back): what that scroll does next
   * isn't the reader's, so it isn't told back (BA51).
   */
  function settle() {
    readerScrolled = false;
  }

  /** Bring a verse to the Greek's top, as the passage it follows moves (not told back). */
  async function goToVerse(passageVerse) {
    if (!(await ensure())) return;
    const verse = nearestVerse(verses, passageVerse);
    if (verse == null) return;
    toldTop = verse;
    readerScrolled = false;
    if (selected == null) setRover(firstWordOf(flat, verse));
    scrollToVerse(verse);
  }

  /* ── Words ─────────────────────────────────────────────────────── */

  function setRover(i) {
    if (i == null || i < 0 || !buttons[i]) return;
    if (buttons[rover]) buttons[rover].tabIndex = -1;
    rover = i;
    buttons[i].tabIndex = 0;
  }

  function select(i, { focus = false, scroll = true, pause = false } = {}) {
    if (i == null || !flat[i]) return;
    setRover(i);
    if (selected != null && buttons[selected]) {
      buttons[selected].setAttribute("aria-pressed", "false");
      buttons[selected].classList.remove("is-selected");
    }
    selected = i;
    closeWord.hidden = false;
    buttons[i].setAttribute("aria-pressed", "true");
    buttons[i].classList.add("is-selected");
    markSelectedLemma(i);
    if (focus) buttons[i].focus({ preventScroll: true });
    // The details first: they take height from the text, so the word is
    // placed against the Greek's final size.
    showDetails(i, { pause });
    if (scroll) bringIntoView(buttons[i]);
    queueGoto();
  }

  /** Let go of the selected word: its tints and its entry go, and the pane is as it was before any word was chosen. */
  function deselect({ focus = false } = {}) {
    if (selected == null) return;
    const b = buttons[selected];
    if (b) {
      b.setAttribute("aria-pressed", "false");
      b.classList.remove("is-selected");
    }
    for (const k of selKin) k.classList.remove("is-sel-kin");
    selKin = [];
    selected = null;
    lexSeq++; // a lexicon still loading is for a word no longer chosen
    window.clearTimeout(lexTimer);
    wordHead.replaceChildren();
    parseLine.textContent = NO_WORD;
    findNote.textContent = "";
    announce.replaceChildren();
    more.hidden = true;
    closeWord.hidden = true;
    if (focus && b) b.focus({ preventScroll: true });
    queueGoto();
  }

  closeWord.addEventListener("click", () => deselect({ focus: true }));

  /** Every word of the selected word's lemma gets a lighter green tint; they stay while the reader scrolls. */
  function markSelectedLemma(i) {
    for (const b of selKin) b.classList.remove("is-sel-kin");
    selKin = [];
    const lemma = flat[i].w[W.lemma];
    if (lemma == null) return;
    flat.forEach((f, j) => {
      if (j !== i && f.w[W.lemma] === lemma && buttons[j]) {
        buttons[j].classList.add("is-sel-kin");
        selKin.push(buttons[j]);
      }
    });
  }

  // Copying the Greek (BVJ, 2026-11-06): each word and sign is a button, and a
  // sheet's paste drops buttons with what they hold (as it should for a web
  // page's controls), so a copy reached a sheet as spaces, commas and verse
  // numbers. The clipboard gets the words as Greek text instead: buttons become
  // spans keeping their lang, the screen reader's "Verse " goes, and the plain
  // text puts a space after each verse number and a blank line between paragraphs.
  el.addEventListener("copy", (e) => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !e.clipboardData) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const box = document.createElement("div");
    box.append(range.cloneContents());
    for (const n of box.querySelectorAll(".sr-only")) n.remove();
    for (const b of box.querySelectorAll("button")) {
      const s = document.createElement("span");
      if (b.lang) s.lang = b.lang;
      s.textContent = b.textContent;
      b.replaceWith(s);
    }
    const html = box.innerHTML;
    for (const vn of box.querySelectorAll("sup")) vn.append(" ");
    // Walked, not read by paragraph: a lexicon entry's body holds none (GK3-12).
    const text = plainTextOf(box);
    if (!text) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", text);
    e.clipboardData.setData("text/html", html);
  });

  scroller.addEventListener("click", (e) => {
    const sign = e.target.closest(".desk-greek__sign");
    if (sign) {
      toApparatus(Number(sign.dataset.verse));
      return;
    }
    const word = e.target.closest(".desk-greek__w");
    if (!word) return;
    const i = Number(word.dataset.i);
    // Clicking the chosen word again lets it go.
    if (i === selected) deselect();
    else select(i, { scroll: true });
  });

  // Hovering a word also tints every word of its lemma in the chapter.
  let kin = [];
  const clearKin = () => {
    for (const b of kin) b.classList.remove("is-kin");
    kin = [];
  };
  scroller.addEventListener("pointerover", (e) => {
    const word = e.target.closest?.(".desk-greek__w");
    clearKin();
    if (!word || e.pointerType === "touch") return;
    const lemma = flat[Number(word.dataset.i)]?.w[W.lemma];
    if (lemma == null) return;
    flat.forEach((f, i) => {
      if (f.w[W.lemma] === lemma && buttons[i] !== word) {
        buttons[i].classList.add("is-kin");
        kin.push(buttons[i]);
      }
    });
  });
  scroller.addEventListener("pointerleave", clearKin);

  scroller.addEventListener("keydown", (e) => {
    const word = e.target.closest?.(".desk-greek__w");
    // Shift passes through, so a reader can extend a selection of the Greek by
    // keyboard and copy it (GK8-4).
    if (!word || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    // The keys are the Greek's own, so the text doesn't scroll by itself.
    e.preventDefault();
    const to = moveFrom(flat, Number(word.dataset.i), e.key);
    if (to != null) select(to, { focus: true, pause: true });
  });

  /** Select the word at a verse and place, and (with focus) move focus to it. */
  async function selectWordHere(verse, t, { focus = false } = {}) {
    if (!(await ensure())) return false;
    const i = indexOfWord(flat, verse, t);
    if (i < 0) return false;
    select(i, { focus });
    return true;
  }

  /** The same, for a caller from outside: an open search gives the text back first. */
  function selectWord(verse, t, opts) {
    closeFind({ focus: false });
    return selectWordHere(verse, t, opts);
  }

  /* ── The apparatus ─────────────────────────────────────────────── */

  let litTimer = 0;
  function toApparatus(verse) {
    // A note on a span of verses sits under the span's first verse.
    const noteVerses = (data.apparatus ?? []).map((a) => a[0]);
    const at = noteVerseFor(noteVerses, verse);
    const item = at == null ? null : scroller.querySelector(`.desk-greek__app-item[data-app-verse="${at}"]`);
    if (!item) return;
    bringIntoView(item);
    scroller.querySelector(".desk-greek__app-item.is-lit")?.classList.remove("is-lit");
    item.classList.add("is-lit");
    window.clearTimeout(litTimer);
    litTimer = window.setTimeout(() => item.classList.remove("is-lit"), LIT_MS);
    item.focus({ preventScroll: true });
  }

  function backToText(verse) {
    const i = firstWordOf(flat, verse);
    if (i < 0) return;
    scrollToVerse(verse);
    setRover(i);
    buttons[i].focus({ preventScroll: true });
  }

  /* ── The line between the Greek and the entry ──────────────────── */

  // Draggable between a quarter and three quarters either way (BVJ,
  // 2026-10-17); rules in src/lib/desk-greek-split.mjs. Untouched, the entry
  // takes what it needs, as before. The line shows only while a word is
  // open (desk.css), and the reader's share is kept for the visit.
  const visibleScroller = () =>
    Array.from(el.querySelectorAll(".desk-greek__scroller")).find((s) => !s.hidden) ?? scroller;
  let share = keptGreekSplit();
  let splitFrame = 0;

  // The entry's share as it stands: the reader's, else what it measures.
  const measuredShare = () =>
    clampSplit(details.offsetHeight / (details.offsetHeight + visibleScroller().offsetHeight)) ?? 0.5;

  // The one place the handle's value is written, so the number and its words
  // can't drift (BA112). A separator needs a value whenever it can be focused.
  function writeSplitValue(value) {
    const pct = Math.round(value * 100);
    splitter.setAttribute("aria-valuenow", String(pct));
    splitter.setAttribute("aria-valuetext", `Entry ${pct} percent, Greek ${100 - pct} percent`);
  }

  function setShare(next, { keep = true } = {}) {
    share = next;
    if (share == null) {
      el.removeAttribute("data-split");
      el.style.removeProperty("--desk-greek-split");
      splitter.removeAttribute("aria-valuenow");
      splitter.removeAttribute("aria-valuetext");
    } else {
      el.dataset.split = "";
      el.style.setProperty("--desk-greek-split", String(share));
      writeSplitValue(share);
    }
    if (keep) {
      try {
        if (share == null) sessionStorage.removeItem("lit-desk-greek-split");
        else keepGreekSplit(share);
      } catch (_) {}
      document.dispatchEvent(new CustomEvent(WIDTHS_EVENT, { detail: { kept: share != null } }));
    }
    // The text changed height under the word: bring it back into view.
    cancelAnimationFrame(splitFrame);
    splitFrame = requestAnimationFrame(() => {
      // After a reset the entry sizes itself again: say what it came to.
      if (share == null) writeSplitValue(measuredShare());
      if (selected != null && buttons[selected]) bringIntoView(buttons[selected]);
    });
  }

  splitter.setAttribute("aria-valuemin", String(MIN_SPLIT * 100));
  splitter.setAttribute("aria-valuemax", String(MAX_SPLIT * 100));
  if (share != null) setShare(share, { keep: false });
  // The entry sizes itself until the line is moved, so read it when focused.
  splitter.addEventListener("focus", () => writeSplitValue(share ?? measuredShare()));
  // "Reset widths" forgets it. Only an event saying nothing is kept does: our
  // own move sends kept: true, and where storage is blocked a read would find
  // nothing and snap the line back (BA113).
  const onWidths = (e) => {
    if (forgetsSplit(share, e.detail)) setShare(null, { keep: false });
  };
  document.addEventListener(WIDTHS_EVENT, onWidths);

  splitter.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    clickOrDrag(splitter, e, {
      move: (ev) => {
        splitter.classList.add("desk-greek__split--dragging");
        const next = splitFromPointer({
          y: ev.clientY,
          top: visibleScroller().getBoundingClientRect().top,
          bottom: details.getBoundingClientRect().bottom,
        });
        if (next != null) setShare(next);
      },
      end: () => splitter.classList.remove("desk-greek__split--dragging"),
      click: (ev) => openSplitMenu({ x: ev.clientX, y: ev.clientY }),
    });
  });

  // The grip sits beside the pointer, at its place along the line.
  splitter.addEventListener("pointermove", (e) => {
    splitter.style.setProperty("--grip-x", `${e.clientX - splitter.getBoundingClientRect().left}px`);
  });

  // The line moves with the arrow: Up raises it (the entry grows), Down
  // lowers it. Shift takes bigger steps, and Home and End go to the bounds.
  // Enter or Space opens the line's menu, whose last line lets the entry size
  // itself again (it was Enter and a double click until XA8-1).
  splitter.addEventListener("keydown", (e) => {
    if (isMenuKey(e)) {
      e.preventDefault();
      openSplitMenu(null);
      return;
    }
    const now = share ?? measuredShare();
    const step = (e.shiftKey ? 5 : 1) * SPLIT_STEP;
    let next = null;
    if (e.key === "ArrowUp") next = now + step;
    else if (e.key === "ArrowDown") next = now - step;
    else if (e.key === "Home") next = MAX_SPLIT;
    else if (e.key === "End") next = MIN_SPLIT;
    else return;
    e.preventDefault();
    setShare(clampSplit(next));
  });

  // The click-only way to do what dragging does (XA8-1): two arrow steps a
  // press, a tenth of the room.
  function openSplitMenu(at) {
    // Its limits are read from the line's value, which the entry sizing
    // itself leaves unset.
    writeSplitValue(share ?? measuredShare());
    toggleLineMenu(splitter, {
      label: "Entry size",
      more: "Larger entry",
      less: "Smaller entry",
      step: (dir) => setShare(clampSplit((share ?? measuredShare()) + dir * 2 * SPLIT_STEP)),
      reset: { label: "Let the entry size itself", run: () => setShare(null), shown: () => share != null },
      at,
      along: "horizontal",
    });
  }

  /* ── The word's details ────────────────────────────────────────── */

  /** A button that searches the Greek: the text looks as it did, and says what it does. */
  function starter(text, query, run) {
    const b = make("button", "desk-greek__starter", text);
    b.type = "button";
    b.title = `Search the Greek for ${query}`;
    b.addEventListener("click", run);
    return b;
  }

  const lemmaOf = (w) => data.lemmas?.[w[W.lemma]] ?? null;

  function showDetails(i, { pause = false } = {}) {
    const { w, verse } = flat[i];
    const lemma = lemmaOf(w);
    const pos = w[W.pos];
    const parse = w[W.parse];
    details.scrollTop = 0;
    more.hidden = false;
    // The separator shows with the entry, and a focusable one carries its value from then (LV-2).
    requestAnimationFrame(() => writeSplitValue(share ?? measuredShare()));
    const lemmaForm = lemma?.[0];
    // The form, the lemma, the Strong's number and the parsing each start a
    // search of the Greek (BVJ, 2026-10-13; the parsing, 2026-10-14), shown in
    // place of the text. They are the tab's only searches: a typed one is the
    // search bar's (BVJ, 2026-11-02). Plain clicks only, so the browser's own
    // menu stays.
    const formQuery = w[W.text].replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    wordHead.replaceChildren(
      starter(w[W.text], formQuery, () => openFind({ query: formQuery, exact: true, prefer: lemmaForm })),
    );

    // A word's note about the search belongs to that word.
    findNote.textContent = "";
    // The live line: the word and its parsing, in words with the code beside.
    parseLine.replaceChildren();
    let inWords = "";
    if (pos || parse) {
      // The parsing in words searches every word parsed so ("*.aor.act.impv.2nd.pl").
      const parsed = parsingQuery(pos, parse);
      inWords = describeParse(pos, parse);
      parseLine.append(parsed ? starter(inWords, parsed, () => openFind({ query: parsed })) : inWords);
      parseLine.append(" ", make("span", "desk-greek__code", [pos, parse].filter(Boolean).join(" ")));
    } else {
      parseLine.append("No parsing for this word.");
    }

    announce.replaceChildren();
    const said = make("span", null, w[W.text]);
    said.lang = "grc";
    // The parsing in words only: the code beside it is MorphGNT's raw string, not for the ear.
    announce.append(said, ". ", inWords || "No parsing for this word.");

    // Dictionary form, short gloss and Strong's number: the word's own, which
    // is its lemma's unless MACULA tags this word otherwise (ἦν is G2258 under
    // εἰμί; GK8-1), so the search it starts finds this word.
    lemmaLine.replaceChildren();
    lemmaLine.hidden = !lemma;
    if (lemma) {
      const [form, lemmaStrong, , gloss] = lemma;
      const strong = wordStrong(w, lemmaStrong);
      const f = make("span", "desk-greek__lemma-form");
      f.lang = "grc";
      f.append(starter(form, form, () => openFind({ query: form, prefer: form })));
      lemmaLine.append(f);
      if (gloss) lemmaLine.append(` · ${gloss}`);
      const count = flat.filter((x) => x.w[W.lemma] === w[W.lemma]).length;
      lemmaLine.append(` · ${count} in this chapter`);
      if (strong) {
        const s = make("span", "desk-greek__strong");
        s.append(starter(`Strong’s ${strong}`, strong, () => openFind({ query: strong, prefer: form })));
        lemmaLine.append(" · ", s);
      }
    }

    const range = borrowedFor(data.borrowed, verse);
    const from = range ? BORROWED[range[2]]?.from : null;
    fromLine.hidden = !from;
    fromLine.textContent = from ?? "";

    // The lexicons need a lemma to look up.
    lexSwitch.hidden = !lemma;
    lexBox.hidden = !lemma;
    if (lemma) {
      const which = getLexicon();
      for (const r of radios) r.checked = r.value === which;
      // The arrow keys select each word they pass, and each would ask for a
      // lexicon shard (up to 200 KB), so only the word the reader rests on
      // loads (GK-10). The word itself is announced at once, above.
      // A click or a search answer rests on its word at once, so only the
      // arrow keys wait (GK3-11); a word still shows "Loading…" until its
      // entry arrives.
      window.clearTimeout(lexTimer);
      if (pause) {
        lexBox.replaceChildren(make("p", "desk-greek__muted", "Loading…"));
        lexTimer = window.setTimeout(renderLexicon, LEXICON_PAUSE);
      } else {
        renderLexicon();
      }
    } else {
      window.clearTimeout(lexTimer);
      lexBox.replaceChildren();
    }

    renderFootnotes(verse);
    renderApparatusLine(w, verse);
    renderLit(lemma?.[0], verse);
  }

  /** A word beside a text-critical sign says so, with a way to the note for keyboard readers. */
  function renderApparatusLine(w, verse) {
    appLine.replaceChildren();
    const marked = splitSigns(w[W.pre] + w[W.post]).some((x) => x.sign);
    appLine.hidden = !marked;
    if (!marked) return;
    const b = make("button", "desk-greek__fn", "Show the note");
    b.type = "button";
    b.addEventListener("click", () => toApparatus(verse));
    appLine.append("This word carries a text-critical sign. ", b);
  }

  for (const r of radios) {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      setLexicon(r.value);
      renderLexicon();
    });
  }

  /** The LIT's footnote letters on this verse, each opening This verse there. */
  function renderFootnotes(verse) {
    const letters = [];
    for (const a of textBox?.querySelectorAll(`[data-verse="${verse}"] sup.fn-ref a`) ?? []) {
      const label = a.textContent.trim();
      if (label && !letters.includes(label)) letters.push(label);
    }
    fnsLine.replaceChildren();
    fnsLine.hidden = letters.length === 0;
    if (!letters.length) return;
    fnsLine.append(`LIT notes on verse ${verse}: `);
    letters.forEach((label, k) => {
      if (k) fnsLine.append(", ");
      const b = make("button", "desk-greek__fn", label);
      b.type = "button";
      b.setAttribute("aria-label", `Footnote ${label} on verse ${verse}, in This verse`);
      b.addEventListener("click", () => openVerse(verse));
      fnsLine.append(b);
    });
  }

  /** How the LIT renders the word, when its lemma is one of the page's glossary terms. */
  function renderLit(lemma, verse) {
    litBox.replaceChildren();
    const terms = lemma ? termsForLemma(termData, lemma) : [];
    litBox.hidden = terms.length === 0;
    for (const term of terms) {
      const rendered = renderingsIn(termData, term.id, verse);
      const p = make("p", "desk-greek__lit-line");
      p.append(rendered.length ? `In the LIT: rendered here as “${joinAnd(rendered)}.” ` : "In the LIT: see the glossary entry. ");
      const a = make("a", null, `Glossary: ${term.title}`);
      a.href = `/glossary/#${term.id}`;
      p.append(a);
      litBox.append(p);
    }
  }

  /* ── The lexicons ──────────────────────────────────────────────── */

  function lexError(retry) {
    const box = make("div", "desk-greek__lex-error");
    box.append(make("p", null, "The dictionary couldn’t be loaded."));
    const b = make("button", "desk-greek__retry", "Try again");
    b.type = "button";
    b.addEventListener("click", retry);
    box.append(b);
    return box;
  }

  async function renderLexicon() {
    if (selected == null) return;
    const n = ++lexSeq;
    const { w } = flat[selected];
    const lemma = lemmaOf(w);
    if (!lemma) return;
    const [, strong, ubsId] = lemma;
    const which = getLexicon();
    lexBox.replaceChildren(make("p", "desk-greek__muted", "Loading…"));
    try {
      const out = which === "step" ? await stepView(strong) : await ubsView(ubsId, w[W.sense]);
      if (n !== lexSeq) return;
      lexBox.replaceChildren(out);
    } catch (_) {
      if (n !== lexSeq) return;
      lexBox.replaceChildren(lexError(renderLexicon));
    }
  }

  async function ubsView(mainId, sense) {
    const wrap = make("div", "desk-greek__ubs");
    const entry = mainId ? await loadUbsEntry(mainId) : null;
    if (!entry) {
      wrap.append(make("p", "desk-greek__muted", "The UBS dictionary has no entry for this word."));
      return wrap;
    }
    const { here: at, others } = orderSenses(entry.senses, sense);
    const group = (label, items) => {
      if (label) wrap.append(make("h5", "desk-greek__senses-head", label));
      const ol = make("ol", "desk-greek__senses");
      for (const s of items) ol.append(senseItem(s.sense));
      wrap.append(ol);
    };
    if (at) {
      group("At this word", [at]);
      if (others.length) group("Other senses", others);
    } else {
      group(null, others);
    }
    return wrap;
  }

  function senseItem(s) {
    const li = make("li", "desk-greek__sense");
    const where = [s.domain, s.subdomain].filter(Boolean).join(" › ");
    const head = make("p", "desk-greek__sense-head");
    if (s.code) head.append(make("b", null, s.code));
    if (where) head.append(s.code ? " " : "", where);
    if (head.childNodes.length) li.append(head);
    if (s.def) {
      const p = make("p", "desk-greek__def");
      appendLang(p, s.def);
      li.append(p);
    }
    if (s.glosses?.length) {
      const p = make("p", "desk-greek__glosses");
      appendLang(p, s.glosses.join("; "));
      li.append(p);
    }
    if (s.comment) {
      const d = make("details", "desk-greek__comment");
      const cp = make("p");
      appendLang(cp, s.comment);
      d.append(make("summary", null, "Comment"), cp);
      li.append(d);
    }
    return li;
  }

  async function stepView(strong) {
    const wrap = make("div", "desk-greek__step");
    const entries = strong ? await loadStepEntries(strong) : [];
    if (!entries.length) {
      wrap.append(make("p", "desk-greek__muted", "STEPBible has no brief entry for this word."));
    }
    for (const e of entries) {
      const box = make("div", "desk-greek__entry");
      const head = make("p", "desk-greek__entry-head");
      const form = make("b", null, e.lemma);
      form.lang = "grc";
      head.append(form);
      if (e.translit) head.append(` ${e.translit}`);
      if (e.gloss) head.append(` · ${e.gloss}`);
      box.append(head);
      const body = make("div", "desk-greek__entry-body");
      sanitizeInto(body, e.html);
      const toggle = sourcesToggle(body);
      if (toggle) box.append(toggle);
      box.append(body);
      wrap.append(box);
    }
    if (strong) wrap.append(lsjSection(strong));
    return wrap;
  }

  /**
   * The full LSJ entry, always shown under the brief one with a heading of
   * its own (BVJ, 2026-10-13: a heading, not a button to reveal it), so it
   * is plain that LSJ is there.
   */
  function lsjSection(strong) {
    const box = make("section", "desk-greek__lsj");
    const out = make("div", "desk-greek__lsj-body");
    box.append(make("h5", "desk-greek__senses-head", "Full LSJ entry"), out);
    const fill = async () => {
      out.replaceChildren(make("p", "desk-greek__muted", "Loading…"));
      try {
        const entries = await loadLsjEntries(strong);
        const frag = document.createDocumentFragment();
        if (!entries.length) frag.append(make("p", "desk-greek__muted", "LSJ has no entry for this word."));
        for (const e of entries) {
          const entry = make("div", "desk-greek__entry");
          const head = make("p", "desk-greek__entry-head");
          const form = make("b", null, e.lemma);
          form.lang = "grc";
          head.append(form);
          entry.append(head);
          const body = make("div", "desk-greek__entry-body");
          sanitizeInto(body, e.html);
          const toggle = sourcesToggle(body);
          if (toggle) entry.append(toggle);
          entry.append(body);
          frag.append(entry);
        }
        out.replaceChildren(frag);
      } catch (_) {
        out.replaceChildren(lexError(fill));
      }
    };
    fill();
    return box;
  }

  /* ── The panel's side ──────────────────────────────────────────── */

  async function render() {
    if (!visible()) return;
    if (await ensure()) queueGoto();
  }

  /**
   * Take the tab down for good (BA115): /desk's Greek pane builds a tab per
   * chapter, so each must let go of the window and the document. The
   * Notebook's tab lives as long as the page and never calls it.
   */
  function destroy() {
    destroyed = true;
    closeFind({ focus: false });
    window.removeEventListener("scroll", queueGoto);
    document.removeEventListener(WIDTHS_EVENT, onWidths);
    resizes?.disconnect();
    window.clearTimeout(litTimer);
    window.clearTimeout(lexTimer);
    cancelAnimationFrame(splitFrame);
  }

  return { el, render, selectWord, goToVerse, settle, destroy };
}
