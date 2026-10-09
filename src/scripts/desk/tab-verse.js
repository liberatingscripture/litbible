// src/scripts/desk/tab-verse.js
//
// The Notebook panel's "This verse" tab (STUDY-DESK.md, N10; BVJ 2026-10-02:
// one verse at a time), on Study View chapters: the verse the reader picked,
// with the translation's footnotes on it and the reader's own notes and
// bookmark, and a way to add a note. Other translations and the verse's Greek
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
// The footnotes are copied from the page's own footnote list, so they read
// exactly as they do there, links included. Nothing here adds to or changes
// the scripture on the page.

import { verseCopyFor } from "../../lib/desk-records.mjs";
import { forChapter } from "../../lib/desk-store-core.mjs";
import { adjacentVerse, recordsOnVerse } from "../../lib/desk-verse.mjs";
import { verseAtReadingLine } from "../last-read.js";
import { glyph } from "./glyphs.js";
import { chapterText } from "./page.js";

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
 *   goHere?: { can(record: object): boolean, go(record: object): void } | null }} options
 * @returns {{ el: HTMLElement, render: () => Promise<void>, setVerse: (verse: number) => void,
 *   focusHeading: () => void }}
 */
export function createVerseTab({ store, here, visible, panelOpen, onEdit = null, onAddNote = null, goHere = null }) {
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
    const on = recordsOnVerse(records, v).filter((r) => r.kind === "note" || r.kind === "bookmark");
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
    return li;
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
