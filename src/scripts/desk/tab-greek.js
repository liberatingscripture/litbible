// src/scripts/desk/tab-greek.js
//
// The Notebook panel's "Greek" tab (STUDY-DESK.md, "Decisions", 2026-10-08;
// phase 1f), on Study View chapters and on draft chapters: the SBL Greek New
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
import {
  W, borrowedFor, firstWordOf, flattenWords, indexOfWord, joinAnd, moveFrom, orderSenses,
  renderingsIn, splitSigns, termsForLemma, versesOf,
} from "../../lib/desk-greek.mjs";
import { verseAtReadingLine } from "../last-read.js";
import { createGreekFind } from "./greek-find.js";
import {
  getLexicon, loadChapterGreek, loadLsjEntries, loadStepEntries, loadUbsEntry, setLexicon,
} from "./greek-data.js";

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

const SOURCES = [
  ["SBL Greek New Testament (SBLGNT), © 2010 Society of Biblical Literature and Logos Bible Software, CC BY 4.0", "https://github.com/LogosBible/SBLGNT"],
  ["Lemmas and parsing: MorphGNT, CC BY-SA 3.0", "https://github.com/morphgnt/sblgnt"],
  ["Parsing for John 7:53–8:11 and Romans 16:25–27: MACULA Greek, Clear Bible, CC BY 4.0", "https://github.com/Clear-Bible/macula-greek"],
  ["UBS Dictionary of the Greek New Testament, United Bible Societies, CC BY-SA 4.0", "https://github.com/ubsicap/ubs-open-license"],
  // Credited as STEPBible's README asks: "STEP Bible" linked to www.STEPBible.org.
  ["STEP Bible: brief lexicon (TBESG) and full LSJ (TFLSJ), Tyndale House Cambridge, CC BY 4.0, reformatted", "https://www.stepbible.org/"],
];

// How long an apparatus entry stays lit after a sign takes the reader to it.
const LIT_MS = 1800;

/** A new element with a class and, optionally, text. */
function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
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
        into.append(document.createTextNode(n.nodeValue));
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
 * @returns {{ el: HTMLElement, render: () => Promise<void>,
 *   selectWord: (verse: number, t: number, opts?: { focus?: boolean }) => Promise<boolean> }}
 */
export function createGreekTab({ here, visible, openVerse }) {
  const textBox = document.querySelector(".chapter-paragraphs");
  const markers = Array.from(textBox?.querySelectorAll('sup.vn[id^="v"]') ?? []);
  const termData = readTermData();

  const el = make("div", "desk-greek");
  el.innerHTML = `
    <div class="desk-greek__head">
      <h3 class="desk-greek__title" id="deskGreekTitle" tabindex="-1"></h3>
      <button type="button" class="desk-greek__goto" hidden></button>
      <button type="button" class="desk-greek__find-btn" aria-label="Search the Greek" title="Search the Greek">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 12.8 17 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <form class="desk-greek__find" role="search" hidden>
        <input type="text" class="desk-greek__find-input" aria-label="Search the Greek" placeholder="Greek, G4102, pistis, faith" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        <button type="button" class="desk-greek__find-close" aria-label="Close the Greek search" title="Close the Greek search">&times;</button>
      </form>
    </div>
    <div class="desk-greek__scroller"></div>
    <div class="desk-greek__scroller desk-greek__results" aria-label="Greek search results" role="region" hidden></div>
    <section class="desk-greek__details" aria-label="Word details">
      <div class="sr-only desk-greek__announce" aria-live="polite" aria-atomic="true"></div>
      <div class="desk-greek__live">
        <h4 class="desk-greek__word" lang="grc"></h4>
        <p class="desk-greek__parse"></p>
      </div>
      <div class="desk-greek__more" hidden>
        <p class="desk-greek__lemma"></p>
        <p class="desk-greek__from" hidden></p>
        <div class="desk-seg desk-greek__switch" role="radiogroup" aria-label="Lexicon">
          <label class="desk-seg__option">
            <input type="radio" class="desk-seg__input" name="desk-greek-lex" value="ubs" />
            <span class="desk-seg__text">UBS dictionary</span>
          </label>
          <label class="desk-seg__option">
            <input type="radio" class="desk-seg__input" name="desk-greek-lex" value="step" />
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
  const wordHead = el.querySelector(".desk-greek__word");
  const parseLine = el.querySelector(".desk-greek__parse");
  const more = el.querySelector(".desk-greek__more");
  const lemmaLine = el.querySelector(".desk-greek__lemma");
  const fromLine = el.querySelector(".desk-greek__from");
  const lexSwitch = el.querySelector(".desk-greek__switch");
  const lexBox = el.querySelector(".desk-greek__lex");
  const fnsLine = el.querySelector(".desk-greek__fns");
  const appLine = el.querySelector(".desk-greek__appline");
  const litBox = el.querySelector(".desk-greek__lit");
  const announce = el.querySelector(".desk-greek__announce");
  const radios = Array.from(el.querySelectorAll('input[name="desk-greek-lex"]'));
  title.textContent = `${here.label} in Greek`;

  let data = null;
  let flat = [];
  let verses = [];
  let buttons = []; // flat index -> its button
  const verseMarks = new Map(); // verse -> its number in the text
  let selected = null;
  let rover = 0;
  let pending = null; // a verse to scroll to once the tab has a size
  let loading = null;
  let lexSeq = 0;

  const find = createGreekFind({
    root: el,
    here,
    selectWord: selectWordHere,
    // Focus goes back to the selected word, else the roving one.
    focusText: () => {
      const b = buttons[selected ?? rover];
      if (!b) return false;
      b.focus({ preventScroll: true });
      return true;
    },
  });

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

  /** Load and draw the chapter once; resolves true when the Greek is on the tab. */
  function ensure() {
    if (data) return Promise.resolve(true);
    if (loading) return loading;
    showStatus("Loading the Greek…");
    loading = loadChapterGreek(here.bookKey, here.chapter)
      .then(
        (d) => {
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
        if (ok) build();
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

  function build() {
    flat = flattenWords(data.paragraphs);
    verses = versesOf(flat);
    buttons = [];
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
      const p = make("p", "desk-greek__p");
      p.lang = "grc";
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
    parseLine.textContent = "Select a word to see its dictionary entry. The arrow keys move between words.";
    more.hidden = true;

    window.addEventListener("scroll", queueGoto, { passive: true });
    scroller.addEventListener("scroll", queueGoto, { passive: true });
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => {
        if (pending != null && scroller.clientHeight > 0) {
          const v = pending;
          pending = null;
          scrollToVerse(v);
        }
        queueGoto();
      }).observe(scroller);
    }

    openAtReading();
  }

  function apparatusSection() {
    const sec = make("section", "desk-greek__app");
    sec.setAttribute("aria-labelledby", "deskGreekAppTitle");
    const h = make("h4", "desk-greek__subhead", "Apparatus");
    h.id = "deskGreekAppTitle";
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
      for (const note of notes) {
        const n = make("span", "desk-greek__app-note", note.replace(lead, ""));
        n.lang = "grc";
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
    sec.setAttribute("aria-labelledby", "deskGreekSourcesTitle");
    const h = make("h4", "desk-greek__subhead", "Sources and licenses");
    h.id = "deskGreekSourcesTitle";
    const ul = make("ul", "desk-greek__sources-list");
    for (const [label, href] of SOURCES) {
      const li = make("li");
      li.append(externalLink(label, href));
      ul.append(li);
    }
    const share = make("p", "desk-greek__sources-note");
    const license = make("a", null, "the license note");
    license.href = "/greek/LICENSE.txt";
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

  const pageVerse = () => verseAtReadingLine(markers, (id) => Number(id.slice(1)) || null);

  /** Where the tab first opens: the address's verse, or the one being read. */
  function openAtReading() {
    const m = /^#v(\d+)/.exec(window.location.hash);
    const fromHash = m ? Number(m[1]) : null;
    const v = fromHash && verses.includes(fromHash) ? fromHash : pageVerse();
    const at = v != null && verses.includes(v) ? v : verses[0];
    if (at == null) return;
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

  /* ── Words ─────────────────────────────────────────────────────── */

  function setRover(i) {
    if (i == null || i < 0 || !buttons[i]) return;
    if (buttons[rover]) buttons[rover].tabIndex = -1;
    rover = i;
    buttons[i].tabIndex = 0;
  }

  function select(i, { focus = false, scroll = true } = {}) {
    if (i == null || !flat[i]) return;
    setRover(i);
    if (selected != null && buttons[selected]) {
      buttons[selected].setAttribute("aria-pressed", "false");
      buttons[selected].classList.remove("is-selected");
    }
    selected = i;
    buttons[i].setAttribute("aria-pressed", "true");
    buttons[i].classList.add("is-selected");
    if (focus) buttons[i].focus({ preventScroll: true });
    // The details first: they take height from the text, so the word is
    // placed against the Greek's final size.
    showDetails(i);
    if (scroll) bringIntoView(buttons[i]);
    queueGoto();
  }

  scroller.addEventListener("click", (e) => {
    const sign = e.target.closest(".desk-greek__sign");
    if (sign) {
      toApparatus(Number(sign.dataset.verse));
      return;
    }
    const word = e.target.closest(".desk-greek__w");
    if (word) select(Number(word.dataset.i), { scroll: true });
  });

  scroller.addEventListener("keydown", (e) => {
    const word = e.target.closest?.(".desk-greek__w");
    if (!word || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    // The keys are the Greek's own, so the text doesn't scroll by itself.
    e.preventDefault();
    const to = moveFrom(flat, Number(word.dataset.i), e.key);
    if (to != null) select(to, { focus: true });
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
    find.close({ focus: false });
    return selectWordHere(verse, t, opts);
  }

  /* ── The apparatus ─────────────────────────────────────────────── */

  let litTimer = 0;
  function toApparatus(verse) {
    const item = scroller.querySelector(`.desk-greek__app-item[data-app-verse="${verse}"]`);
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

  function showDetails(i) {
    const { w, verse } = flat[i];
    const lemma = lemmaOf(w);
    const pos = w[W.pos];
    const parse = w[W.parse];
    details.scrollTop = 0;
    more.hidden = false;
    const lemmaForm = lemma?.[0];
    // The form, the lemma and the Strong's number each start a search of the
    // Greek (BVJ, 2026-10-13); plain clicks only, so the browser's own menu
    // stays.
    const formQuery = w[W.text].replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    wordHead.replaceChildren(
      starter(w[W.text], formQuery, () => find.open({ query: formQuery, exact: true, prefer: lemmaForm })),
    );

    // The live line: the word and its parsing, in words with the code beside.
    parseLine.replaceChildren();
    if (pos || parse) {
      parseLine.append(describeParse(pos, parse));
      parseLine.append(" ", make("span", "desk-greek__code", [pos, parse].filter(Boolean).join(" ")));
    } else {
      parseLine.append("No parsing for this word.");
    }

    announce.replaceChildren();
    const said = make("span", null, w[W.text]);
    said.lang = "grc";
    announce.append(said, ". ", parseLine.textContent);

    // Dictionary form, short gloss and Strong's number.
    lemmaLine.replaceChildren();
    lemmaLine.hidden = !lemma;
    if (lemma) {
      const [form, strong, , gloss] = lemma;
      const f = make("span", "desk-greek__lemma-form");
      f.lang = "grc";
      f.append(starter(form, form, () => find.open({ query: form, prefer: form })));
      lemmaLine.append(f);
      if (gloss) lemmaLine.append(` · ${gloss}`);
      if (strong) {
        const s = make("span", "desk-greek__strong");
        s.append(starter(`Strong’s ${strong}`, strong, () => find.open({ query: strong, prefer: form })));
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
      renderLexicon();
    } else {
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
      p.append(rendered.length ? `In the LIT: rendered here as “${joinAnd(rendered)}”. ` : "In the LIT: see the glossary entry. ");
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
    if (s.def) li.append(make("p", "desk-greek__def", s.def));
    if (s.glosses?.length) li.append(make("p", "desk-greek__glosses", s.glosses.join("; ")));
    if (s.comment) {
      const d = make("details", "desk-greek__comment");
      d.append(make("summary", null, "Comment"), make("p", null, s.comment));
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

  return { el, render, selectWord };
}
