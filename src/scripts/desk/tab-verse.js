// src/scripts/desk/tab-verse.js
//
// The Notebook panel's "This verse" tab (STUDY-DESK.md, N10; BVJ 2026-10-02:
// one verse at a time), on Study View chapters: the verse the reader picked,
// with the translation's footnotes on it and the reader's own notes,
// bookmark and highlights, and a way to add a note. A highlight is listed as
// its words in the colour's own look, with Remove (and an Undo bar, as a
// deleted note has). The verse's Greek joins it later (phase 1f).
// Other translations are deferred indefinitely (BVJ, 2026-10-11).
//
// Picking a verse: opening a verse's menu while the notebook is open moves
// the tab to that verse, and "Show in notebook" in the verse menu or the
// selection panel (actions.js) opens the notebook here. Then it stays put
// while the reader reads on. Before anything is picked it opens at the verse
// in the address (#v16), or else at the verse being read.
//
// Previous and Next step to the neighbouring verse within the chapter (BVJ,
// 2026-10-08), over the LIT's verse gaps (Matthew 17 runs 20, 22), since they
// follow the verse numbers the page has. They leave the page where it is: the
// reader is looking at the verse in the panel, not moving through the text.
//
// Your own chains (N4): a reference typed in a note is a link, and this tab
// lists the notes of the reader's that cite the verse shown, "Mentioned in
// your note on Romans 8:3–4", with the note's words and a way to its place.
//
// A note or highlight whose wording has changed (change-notice.js) carries
// the same flag as in My Notes, "Wording changed · Review", under its words,
// which opens the card beside it.
//
// The footnotes are copied from the page's own footnote list, so they read
// exactly as they do there, links included, and each carries the Pin button
// it has there (pins.js). Nothing here adds to or changes
// the scripture on the page.

import { notesCiting } from "../../lib/desk-chains.mjs";
import { shortQuote } from "../../lib/desk-notes.mjs";
import { COLORS, verseCopyFor } from "../../lib/desk-records.mjs";
import { forChapter, recordHref, recordReference } from "../../lib/desk-store-core.mjs";
import { adjacentVerse, recordsOnVerse } from "../../lib/desk-verse.mjs";
import { W, flattenWords } from "../../lib/desk-greek.mjs";
import { verseAtReadingLine } from "../last-read.js";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { glyph } from "./glyphs.js";
import { fillNoteWords } from "./note-words.js";
import { loadChapterGreek } from "./greek-data.js";
import { undoEntry } from "./history.js";
import { chapterText } from "./page.js";
import { pinButton } from "./pins.js";
import { showUndo } from "./undo-bar.js";

// A highlight's words are shown in part, as in My Notes: about this many.
const HIGHLIGHT_WORDS = 24;

const ICON_PREV = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M15 6l-6 6 6 6" /></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M9 6l6 6-6 6" /></svg>`;

/**
 * @param {{ store: object | null, here: { bookKey: string, chapter: number, label: string },
 *   visible: () => boolean, panelOpen: () => boolean,
 *   onEdit?: (record: object, trigger: Element) => void,
 *   onAddNote?: (draft: object, trigger: Element) => void,
 *   goHere?: { can(record: object): boolean, go(record: object): void } | null,
 *   ctx?: (() => object) | null,
 *   showInText?: { can(record: object): boolean, go(record: object): void } | null,
 *   greek?: { open(verse: number, t: number): void } | null,
 *   source?: { textBox: Element | null, footnoteBody: (id: string) => Element | null,
 *     anchorText: () => object } | null,
 *   startVerse?: number | null, idSuffix?: string, onVerse?: ((verse: number) => void) | null }} options
 *   `ctx` and `showInText` are what the change notice's card needs; `greek`
 *   opens the Greek tab at a word. On /desk the chapter isn't the page's:
 *   `source` reads it from the chapter's fetched Study View page
 *   (chapter-page.js), `startVerse` is where it opens, and `idSuffix` keeps
 *   two panes' ids apart. `onVerse` hears the verse Previous or Next steps to,
 *   so the panes that share a passage move together.
 * @returns {{ el: HTMLElement, render: () => Promise<void>, setVerse: (verse: number) => void,
 *   focusHeading: () => void }}
 */
export function createVerseTab({
  store, here, visible, panelOpen, onEdit = null, onAddNote = null, goHere = null, ctx = null, showInText = null,
  greek = null, source = null, startVerse = null, idSuffix = "", onVerse = null,
}) {
  const textBox = source ? source.textBox : document.querySelector(".chapter-paragraphs");
  const footnoteBody = source
    ? source.footnoteBody
    : (id) => document.getElementById(id)?.querySelector(".fn-body") ?? null;
  const readText = source ? source.anchorText : chapterText;
  const markers = Array.from(textBox?.querySelectorAll('sup.vn[id^="v"]') ?? []);
  const verses = markers.map((m) => Number(m.id.slice(1))).filter(Number.isFinite);
  const ref = (v) => `${here.label}:${v}`;

  const el = document.createElement("div");
  el.className = "desk-verse";
  el.innerHTML = `
    <div class="desk-verse__head">
      <button type="button" class="desk-verse__step" data-step="-1">${ICON_PREV}</button>
      <h3 class="desk-verse__ref" id="deskVerseRef${idSuffix}" tabindex="-1"></h3>
      <button type="button" class="desk-verse__step" data-step="1">${ICON_NEXT}</button>
    </div>
    <p class="desk-verse__text"></p>
    <section class="desk-verse__section desk-verse__greek" aria-labelledby="deskVerseGreekTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseGreekTitle${idSuffix}">Greek</h4>
      <p class="desk-verse__greek-text" lang="grc"></p>
    </section>
    <section class="desk-verse__section desk-verse__fns" aria-labelledby="deskVerseFnsTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseFnsTitle${idSuffix}">Footnotes</h4>
      <ol class="desk-verse__fn-list"></ol>
    </section>
    <section class="desk-verse__section" aria-labelledby="deskVerseMineTitle${idSuffix}">
      <h4 class="desk-verse__subhead" id="deskVerseMineTitle${idSuffix}">My notes</h4>
      <ul class="desk-verse__mine"></ul>
      <p class="desk-verse__empty" hidden>No notes of yours on this verse.</p>
      <button type="button" class="desk-verse__add">Add a note</button>
    </section>
    <section class="desk-verse__section desk-verse__chains" aria-labelledby="deskVerseChainsTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseChainsTitle${idSuffix}">Notes that cite this verse</h4>
      <ul class="desk-verse__mentions"></ul>
    </section>`;

  const heading = el.querySelector(".desk-verse__ref");
  const text = el.querySelector(".desk-verse__text");
  const greekSection = el.querySelector(".desk-verse__greek");
  const greekText = el.querySelector(".desk-verse__greek-text");
  const fnSection = el.querySelector(".desk-verse__fns");
  const fnList = el.querySelector(".desk-verse__fn-list");
  const mine = el.querySelector(".desk-verse__mine");
  const empty = el.querySelector(".desk-verse__empty");
  const add = el.querySelector(".desk-verse__add");
  const chainsSection = el.querySelector(".desk-verse__chains");
  const mentions = el.querySelector(".desk-verse__mentions");
  const steps = Array.from(el.querySelectorAll(".desk-verse__step"));
  add.hidden = !onAddNote || !store;

  let verse = null;
  let notices = new Map(); // id -> the change notice of a record shown, if it has one

  /** Where the tab opens before the reader picks: the address's verse, or the one being read. */
  function startingVerse() {
    if (startVerse != null && verses.includes(startVerse)) return startVerse;
    if (source) return verses[0] ?? null;
    const m = /^#v(\d+)/.exec(window.location.hash);
    const fromHash = m ? Number(m[1]) : null;
    if (fromHash && verses.includes(fromHash)) return fromHash;
    return verseAtReadingLine(markers, (id) => Number(id.slice(1)) || null) ?? verses[0] ?? null;
  }

  function setVerse(v) {
    if (!verses.includes(v)) return;
    verse = v;
    render();
  }

  let seq = 0;
  async function render() {
    if (!visible()) return;
    if (verse == null) verse = startingVerse();
    if (verse == null) return;
    const n = ++seq;
    const v = verse;

    heading.textContent = ref(v);
    for (const b of steps) {
      const to = adjacentVerse(verses, v, Number(b.dataset.step));
      const name = Number(b.dataset.step) < 0 ? "Previous verse" : "Next verse";
      // aria-disabled rather than disabled, so a button pressed to the
      // chapter's edge keeps focus.
      b.setAttribute("aria-disabled", String(to == null));
      b.setAttribute("aria-label", to == null ? name : `${name}, ${ref(to)}`);
      b.title = to == null ? "" : ref(to);
    }

    text.textContent = verseCopyFor(readText(), v) ?? "";
    renderGreek(v, n);
    renderFootnotes(v);

    const records = store ? forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter) : [];
    if (n !== seq) return; // a newer render has started
    const on = recordsOnVerse(records, v).filter((r) => r.kind === "note" || r.kind === "bookmark" || r.kind === "highlight");
    notices = store && ctx ? noticesFor(on) : new Map();
    mine.replaceChildren(...on.map(itemFor));
    empty.hidden = on.length > 0;

    // Notes anywhere in the notebook that cite this verse in their words.
    const cited = store ? notesCiting(await store.all(), { bookKey: here.bookKey, chapter: here.chapter, verse: v }) : [];
    if (n !== seq) return;
    mentions.replaceChildren(...cited.map(({ record }) => mentionItem(record)));
    chainsSection.hidden = cited.length === 0;
  }

  /**
   * One note that cites the verse: where it is, linked (to its place in the
   * margin when that is on this page, else to the page), then its words,
   * whose own references link and preview like the note's anywhere else.
   */
  function mentionItem(r) {
    const li = document.createElement("li");
    li.className = "desk-verse__mention";
    const where = recordReference(r);
    const lead = document.createElement("p");
    lead.className = "desk-verse__mention-lead";
    lead.append("Mentioned in your note on ");
    const href = recordHref(r);
    const place = document.createElement(href ? "a" : "span");
    place.className = "desk-verse__mention-ref";
    place.textContent = where || "this notebook";
    if (href) {
      place.href = href;
      if (goHere?.can(r)) {
        place.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          goHere.go(r);
        });
      }
    }
    lead.append(place, ".");
    const words = document.createElement("p");
    words.className = "desk-verse__mention-words";
    fillNoteWords(words, r.body);
    li.append(lead, words);
    return li;
  }

  /**
   * The verse's Greek after its text: SBL's words, signs as printed, each word
   * a button that opens the Greek tab there. One word is a tab stop and the
   * arrow keys step through, as in the Greek tab. Left out when the files
   * can't be had or the verse has no Greek.
   */
  async function renderGreek(v, n) {
    if (!greek) return;
    // The store redraws this tab on every change; the same verse's Greek is
    // left alone, so a word being tabbed through keeps focus.
    if (greekText.dataset.verse === String(v) && greekText.firstChild) return;
    let words = null;
    try {
      const data = await loadChapterGreek(here.bookKey, here.chapter);
      words = flattenWords(data.paragraphs).filter((x) => x.verse === v);
    } catch (_) {}
    if (n !== seq) return; // a newer render has started
    greekSection.hidden = !words?.length;
    if (!words?.length) {
      greekText.replaceChildren();
      delete greekText.dataset.verse;
      return;
    }
    greekText.dataset.verse = String(v);
    const nodes = [];
    words.forEach(({ w }, k) => {
      if (w[W.pre]) nodes.push(document.createTextNode(w[W.pre]));
      const b = document.createElement("button");
      b.type = "button";
      b.className = "desk-verse__gw";
      b.tabIndex = k === 0 ? 0 : -1;
      b.textContent = w[W.text];
      b.addEventListener("click", () => greek.open(v, w[W.t]));
      nodes.push(b);
      if (w[W.post]) nodes.push(document.createTextNode(w[W.post]));
    });
    greekText.replaceChildren(...nodes);
  }

  greekText.addEventListener("keydown", (e) => {
    const all = Array.from(greekText.querySelectorAll(".desk-verse__gw"));
    const at = all.indexOf(document.activeElement);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: all.length - 1 }[e.key];
    if (at < 0 || to === undefined || !all[to]) return;
    e.preventDefault();
    all[at].tabIndex = -1;
    all[to].tabIndex = 0;
    all[to].focus({ preventScroll: true });
  });

  function renderFootnotes(v) {
    const ids = [];
    for (const a of textBox?.querySelectorAll(`[data-verse="${v}"] sup.fn-ref a[href^="#fn-"]`) ?? []) {
      const id = a.getAttribute("href").slice(1);
      if (!ids.some((x) => x.id === id)) ids.push({ id, label: a.textContent.trim() });
    }
    const items = [];
    for (const { id, label } of ids) {
      const body = footnoteBody(id);
      if (!body) continue;
      const clone = body.cloneNode(true);
      clone.querySelector(".footnote-backlink")?.remove();
      clone.removeAttribute("id");
      for (const withId of clone.querySelectorAll("[id]")) withId.removeAttribute("id");
      clone.className = "desk-verse__fn-body";
      const li = document.createElement("li");
      li.className = "desk-verse__fn";
      const letter = document.createElement("span");
      letter.className = "desk-verse__fn-label";
      letter.textContent = label;
      li.append(letter, clone);
      // Pin / Unpin, as under the note in the Footnotes list.
      const pin = store ? pinButton(id, label) : null;
      if (pin) li.append(pin);
      items.push(li);
    }
    fnList.replaceChildren(...items);
    fnSection.hidden = items.length === 0;
  }

  function itemFor(r) {
    const li = document.createElement("li");
    li.className = "desk-verse__item";
    if (r.kind === "bookmark") {
      li.innerHTML = `${glyph("bookmark", "desk-glyph desk-verse__glyph desk-verse__glyph--bookmark")}<span class="desk-verse__words">Bookmarked</span>`;
      return li;
    }
    if (r.kind === "highlight") return flagged(highlightItem(li, r), r);
    // The note goes to its place in the margin, as it does in My Notes.
    // Its words may hold links, which can't sit inside a button: the note's
    // own button is its marker, stretched over the row (desk-stretch), with
    // the words' links lifted above it.
    const canGo = Boolean(goHere?.can(r));
    const note = document.createElement("div");
    note.className = "desk-verse__note";
    const mark = glyph(r.marker, "desk-glyph desk-verse__glyph");
    const words = document.createElement("span");
    words.className = "desk-verse__words";
    fillNoteWords(words, r.body, "(the marker only)");
    if (canGo) {
      note.classList.add("desk-stretch", "desk-verse__note--go");
      const go = document.createElement("button");
      go.type = "button";
      go.className = "desk-verse__go";
      words.id = `deskVerseWords${idSuffix}-${r.id}`;
      go.setAttribute("aria-label", `Show my note on ${recordReference(r) || ref(verse)} in the margin`);
      go.setAttribute("aria-describedby", words.id);
      go.innerHTML = mark;
      go.addEventListener("click", () => goHere.go(r));
      note.append(go);
    } else {
      note.innerHTML = mark;
    }
    note.append(words);
    li.append(note);
    if (onEdit) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "desk-item__edit";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit note on ${ref(verse)}`);
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        onEdit(r, edit);
      });
      li.append(edit);
    }
    return flagged(li, r);
  }

  /** The row with its change notice's flag, when the record has one. */
  function flagged(li, r) {
    const notice = notices.get(r.id);
    if (!notice) return li;
    li.append(
      flagButton(r, notice, (trigger) => {
        const index = Array.from(mine.children).indexOf(li);
        openNotice(trigger, r, {
          store,
          ctx,
          showInText,
          restoreFocus: trigger,
          onDone: async (what) => {
            if (what === "show") return;
            await render();
            const back = () => {
              const rows = mine.querySelectorAll(".desk-verse__item");
              const next = rows[Math.min(index, rows.length - 1)];
              (next?.querySelector("button, a") ?? (add.hidden ? heading : add)).focus({ preventScroll: true });
            };
            back();
            // As in My Notes: the first write of a visit draws the tab once
            // more, which would take focus off the row.
            setTimeout(() => {
              if (!document.activeElement || document.activeElement === document.body) back();
            }, 400);
          },
        });
      }),
    );
    return li;
  }

  /**
   * A highlight on the verse: its words in the colour's look, and Remove. The
   * look is for the eye (tint and underline), so a screen reader is told the
   * colour in words, ahead of the quotation.
   */
  function highlightItem(li, r) {
    const color = COLORS.includes(r.color) ? r.color : null;
    const name = color ? `${color} highlight` : "highlight";
    const words = document.createElement("span");
    words.className = "desk-verse__highlight";
    const said = document.createElement("span");
    said.className = "sr-only";
    said.textContent = `${name[0].toUpperCase()}${name.slice(1)}: `;
    const quote = shortQuote(r.quote?.exact, HIGHLIGHT_WORDS);
    if (color) {
      const swatch = document.createElement("span");
      swatch.className = "desk-swatch";
      swatch.dataset.color = color;
      const sample = document.createElement("span");
      sample.className = "desk-swatch__sample";
      sample.textContent = quote;
      swatch.append(sample);
      words.append(said, swatch);
    } else {
      words.append(said, quote);
    }
    li.append(words);
    if (store) {
      const where = recordReference(r);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "desk-verse__remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${name}${where ? ` on ${where}` : ""}`);
      remove.addEventListener("click", () => removeHighlight(r, li));
      li.append(remove);
    }
    return li;
  }

  async function removeHighlight(r, li) {
    const index = Array.from(mine.children).indexOf(li);
    const trash = await store.remove(r.id);
    if (!trash) return;
    // The change this made, read before anything else can write: the undo
    // button, like Ctrl+Z, takes back exactly this one (history.js).
    const entry = store.lastEntry();
    // The store's notice redraws the tab too; drawing it here as well means
    // focus can be placed once it is done.
    await render();
    const rows = mine.querySelectorAll(".desk-verse__item");
    const next = rows[Math.min(index, rows.length - 1)]?.querySelector("button");
    (next ?? (add.hidden ? heading : add)).focus({ preventScroll: true });
    const where = recordReference(r);
    showUndo(`Highlight${where ? ` on ${where}` : ""} removed.`, () => undoEntry(entry));
  }

  for (const b of steps) {
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true" || verse == null) return;
      const to = adjacentVerse(verses, verse, Number(b.dataset.step));
      if (to == null) return;
      setVerse(to);
      onVerse?.(to);
    });
  }

  add.addEventListener("click", () => {
    if (verse == null) return;
    onAddNote({ bookKey: here.bookKey, chapter: here.chapter, verse, endVerse: verse }, add);
  });

  // A verse's menu opened while the notebook is open picks that verse.
  document.addEventListener("lit:panel-actions", (e) => {
    const d = e.detail;
    if (d?.kind !== "verse" || d.view !== "study" || !panelOpen()) return;
    setVerse(d.start);
  });

  return { el, render, setVerse, focusHeading: () => heading.focus({ preventScroll: true }) };
}
