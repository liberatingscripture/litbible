// src/scripts/desk/tab-verse.js
//
// The Notebook panel's "This verse" tab (STUDY-DESK.md, N10; BVJ 2026-10-02:
// one verse at a time), on Study View chapters: the verse the reader picked,
// with the translation's footnotes on it and the reader's own notes,
// bookmark and highlights, and a way to add a note. A highlight is listed as
// its words in the colour's own look, with Remove (and an Undo bar, as a
// deleted note has). Other translations and the verse's Greek
// join it later (the versions wait on the API.bible questions, BVJ
// 2026-10-08; the Greek is phase 1f).
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
// A note or highlight whose wording has changed (change-notice.js) carries
// the same flag as in My Notes, "Wording changed · Review", under its words,
// which opens the card beside it.
//
// The footnotes are copied from the page's own footnote list, so they read
// exactly as they do there, links included. Nothing here adds to or changes
// the scripture on the page.

import { shortQuote } from "../../lib/desk-notes.mjs";
import { COLORS, verseCopyFor } from "../../lib/desk-records.mjs";
import { forChapter, recordReference } from "../../lib/desk-store-core.mjs";
import { adjacentVerse, recordsOnVerse } from "../../lib/desk-verse.mjs";
import { verseAtReadingLine } from "../last-read.js";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { glyph } from "./glyphs.js";
import { undoEntry } from "./history.js";
import { chapterText } from "./page.js";
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
 *   showInText?: { can(record: object): boolean, go(record: object): void } | null }} options
 *   `ctx` and `showInText` are what the change notice's card needs.
 * @returns {{ el: HTMLElement, render: () => Promise<void>, setVerse: (verse: number) => void,
 *   focusHeading: () => void }}
 */
export function createVerseTab({ store, here, visible, panelOpen, onEdit = null, onAddNote = null, goHere = null, ctx = null, showInText = null }) {
  const textBox = document.querySelector(".chapter-paragraphs");
  const markers = Array.from(textBox?.querySelectorAll('sup.vn[id^="v"]') ?? []);
  const verses = markers.map((m) => Number(m.id.slice(1))).filter(Number.isFinite);
  const ref = (v) => `${here.label}:${v}`;

  const el = document.createElement("div");
  el.className = "desk-verse";
  el.innerHTML = `
    <div class="desk-verse__head">
      <button type="button" class="desk-verse__step" data-step="-1">${ICON_PREV}</button>
      <h3 class="desk-verse__ref" id="deskVerseRef" tabindex="-1"></h3>
      <button type="button" class="desk-verse__step" data-step="1">${ICON_NEXT}</button>
    </div>
    <p class="desk-verse__text"></p>
    <section class="desk-verse__section desk-verse__fns" aria-labelledby="deskVerseFnsTitle" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseFnsTitle">Footnotes</h4>
      <ol class="desk-verse__fn-list"></ol>
    </section>
    <section class="desk-verse__section" aria-labelledby="deskVerseMineTitle">
      <h4 class="desk-verse__subhead" id="deskVerseMineTitle">My notes</h4>
      <ul class="desk-verse__mine"></ul>
      <p class="desk-verse__empty" hidden>No notes of yours on this verse.</p>
      <button type="button" class="desk-verse__add">Add a note</button>
    </section>`;

  const heading = el.querySelector(".desk-verse__ref");
  const text = el.querySelector(".desk-verse__text");
  const fnSection = el.querySelector(".desk-verse__fns");
  const fnList = el.querySelector(".desk-verse__fn-list");
  const mine = el.querySelector(".desk-verse__mine");
  const empty = el.querySelector(".desk-verse__empty");
  const add = el.querySelector(".desk-verse__add");
  const steps = Array.from(el.querySelectorAll(".desk-verse__step"));
  add.hidden = !onAddNote || !store;

  let verse = null;
  let notices = new Map(); // id -> the change notice of a record shown, if it has one

  /** Where the tab opens before the reader picks: the address's verse, or the one being read. */
  function startingVerse() {
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

    text.textContent = verseCopyFor(chapterText(), v) ?? "";
    renderFootnotes(v);

    const records = store ? forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter) : [];
    if (n !== seq) return; // a newer render has started
    const on = recordsOnVerse(records, v).filter((r) => r.kind === "note" || r.kind === "bookmark" || r.kind === "highlight");
    notices = store && ctx ? noticesFor(on) : new Map();
    mine.replaceChildren(...on.map(itemFor));
    empty.hidden = on.length > 0;
  }

  function renderFootnotes(v) {
    const ids = [];
    for (const a of textBox.querySelectorAll(`[data-verse="${v}"] sup.fn-ref a[href^="#fn-"]`)) {
      const id = a.getAttribute("href").slice(1);
      if (!ids.some((x) => x.id === id)) ids.push({ id, label: a.textContent.trim() });
    }
    const items = [];
    for (const { id, label } of ids) {
      const body = document.getElementById(id)?.querySelector(".fn-body");
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
    const canGo = Boolean(goHere?.can(r));
    const note = document.createElement(canGo ? "button" : "span");
    if (canGo) {
      note.type = "button";
      note.addEventListener("click", () => goHere.go(r));
    }
    note.className = "desk-verse__note";
    note.innerHTML = glyph(r.marker, "desk-glyph desk-verse__glyph");
    const words = document.createElement("span");
    words.className = "desk-verse__words";
    // A note's body is the reader's own words: always text, never HTML.
    words.textContent = r.body || "(the marker only)";
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
            const rows = mine.querySelectorAll(".desk-verse__item");
            const next = what === "delete" ? rows[Math.min(index, rows.length - 1)] : mine.querySelector(`.desk-verse__item:nth-child(${index + 1})`);
            (next?.querySelector("button, a") ?? (add.hidden ? heading : add)).focus({ preventScroll: true });
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
      if (to != null) setVerse(to);
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
