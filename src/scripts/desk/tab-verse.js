// src/scripts/desk/tab-verse.js
//
// The Notebook panel's "This verse" tab (STUDY-DESK.md, N10; BVJ 2026-10-02:
// one verse at a time), on Chapter View chapters: the verse the reader picked,
// with the translation's footnotes on it and the reader's own notes,
// bookmark and highlights, and a way to add a note. Each row has what its row
// in My Notes has (E148; BVJ, 2026-11-17: "It should have all the options to
// interact with it on both tabs"): a bookmark its name, its line, the follow
// link, Edit, Remove, its labels and Labels…; a note Edit and Delete; a
// highlight its words in the colour's own look and Remove. Removing shows the
// Undo bar, as in My Notes. The verse's Greek joins it later (phase 1f).
// Other translations are deferred indefinitely (BVJ, 2026-10-11).
//
// Picking a verse: opening a verse's menu while the notebook is open moves
// the tab to that verse, and "Show in Notebook" in the verse menu or the
// selection panel (actions.js) opens the notebook here. Then it stays put
// while the reader reads on. Before anything is picked it opens at the verse
// in the address (#v16), or else at the verse being read.
//
// Previous and Next step to the neighbouring verse within the chapter (BVJ,
// 2026-10-08), over the LIT's verse gaps (Matthew 17 runs 20, 22), since they
// follow the verse numbers the page has. They leave the page where it is: the
// reader is looking at the verse in the panel, not moving through the text.
//
// A gap asked for by name (a /desk pane's passage bar at Matthew 17:21) gets
// a view of its own rather than being refused (E157; BVJ, 2026-11-18,
// "3 and A"): its reference, "The LIT has no Matthew 17:21." where the words
// would be, the Greek section saying the same of the SBLGNT when the Greek has
// no words for it, and the LIT's own note that explains the gap. No My Notes
// and no Add a note: a mark needs words to sit on, as a bookmark's refusal of
// a gap already says (desk-bookmark-change.mjs).
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
// it has there (pins.js). Nothing here adds to or changes the scripture on
// the page.

import { notesCiting } from "../../lib/desk-chains.mjs";
import { shortQuote } from "../../lib/desk-notes.mjs";
import { COLORS, canEdit, verseCopyFor } from "../../lib/desk-records.mjs";
import { forChapter, recordHref, recordReference, takeOff } from "../../lib/desk-store-core.mjs";
import { isFollowing } from "../../lib/desk-bookmarks.mjs";
import { labelMap, shownLabels, takesLabels } from "../../lib/desk-labels.mjs";
import { adjacentVerse, gapNote, recordsOnVerse } from "../../lib/desk-verse.mjs";
import { isVerseGap } from "../../data/verse-gaps.js";
import { W, flattenWords } from "../../lib/desk-greek.mjs";
import { verseAtReadingLine } from "../last-read.js";
import { drawBookmarkLine, followBookmark, followsHere, stopFollowing } from "./bookmark-follow.js";
import { flagButton, noticesFor, openNotice } from "./change-notice.js";
import { chevronIcons, glyph } from "./glyphs.js";
import { fillNoteWords } from "./note-words.js";
import { loadChapterGreek } from "./greek-data.js";
import { routeFootnoteLinks } from "./footnote-links.js";
import { undoEntry } from "./history.js";
import { chapterText, goDeeperOf, pageTextBox } from "./page.js";
import { bookKeyToLabel } from "../../data/books.js";
import { pinButton } from "./pins.js";
import { showUndo } from "./undo-bar.js";
import { setTip } from "../tip.js";
import { currentPanel } from "../lit-panel.js";
import { make, scroller } from "./dom.js";
import { followLinkButton, moveItHereButton } from "./bookmark-stop.js";
import { labelsSubject, openLabelsPopover } from "./labels-ui.js";
import { collectionsTag } from "./collections/collections-popover.js";
import { collectionHref, collectionLink, addPassageToCollection } from "./collections/add-passage.js";
import { openNewCollection } from "./collections/new-collection.js";
import { openPickWindow } from "./pick-window.js";
import { dateWords } from "./desk-text.js";
import { addableCollections, collectionName, collectionsHolding, passageMember } from "../../lib/desk-collections.mjs";
import { passageFromVerses, passageReference } from "../../lib/desk-sheet-passages.mjs";
import { nameOf } from "./record-words.js";

// A highlight's words are shown in part, as in My Notes: about this many.
const HIGHLIGHT_WORDS = 24;

// This verse's chevrons are 18 pixels; the passage bar's and the intro pane's are 16.
const { prev: ICON_PREV, next: ICON_NEXT } = chevronIcons(18);

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
 *   startVerse?: number | null, idSuffix?: string, onVerse?: ((verse: number) => void) | null,
 *   showPassage?: ((passage: object) => unknown) | null }} options
 *   `ctx` and `showInText` are what the change notice's card needs; `greek`
 *   opens the Greek tab at a word. On /desk the chapter isn't the page's:
 *   `source` reads it from the chapter's fetched Chapter View page
 *   (chapter-page.js), `startVerse` is where it opens, and `idSuffix` keeps
 *   two panes' ids apart. `onVerse` hears the verse Previous or Next steps to,
 *   so the panes that share a passage move together. `showPassage` is passed
 *   only by the /desk pane: a plain click on a scripture reference in a
 *   footnote moves the LIT pane (footnote-links.js).
 * @returns {{ el: HTMLElement, render: () => Promise<void>, setVerse: (verse: number) => void,
 *   focusHeading: () => void, showNotes: () => Promise<void>,
 *   showChapter: (bookKey: string, chapter: number) => void, destroy: () => void }}
 */
export function createVerseTab({
  store, here, visible, panelOpen, onEdit = null, onAddNote = null, goHere = null, ctx = null, showInText = null,
  greek = null, source = null, startVerse = null, idSuffix = "", onVerse = null, showPassage = null,
}) {
  const textBox = source ? source.textBox : pageTextBox();
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
      <p class="desk-verse__absent" hidden></p>
    </section>
    <section class="desk-verse__section desk-verse__fns" aria-labelledby="deskVerseFnsTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseFnsTitle${idSuffix}">Footnotes</h4>
      <ol class="desk-verse__fn-list"></ol>
    </section>
    <section class="desk-verse__section desk-verse__notes" aria-labelledby="deskVerseMineTitle${idSuffix}">
      <h4 class="desk-verse__subhead" id="deskVerseMineTitle${idSuffix}" tabindex="-1">My Notes</h4>
      <ul class="desk-verse__mine"></ul>
      <p class="desk-verse__empty" hidden>No notes of yours on this verse.</p>
      <button type="button" class="desk-pin desk-pin--glyph desk-verse__add" aria-label="Add a note on this verse">${glyph("note", "desk-verse__add-glyph")}<span class="desk-pin__word" aria-hidden="true">Note</span></button>
    </section>
    <section class="desk-verse__section desk-verse__collections" aria-labelledby="deskVerseCollectionsTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseCollectionsTitle${idSuffix}">Collections</h4>
      <p class="desk-verse__mention-lead desk-verse__collections-line"></p>
      <button type="button" class="desk-item__tag desk-verse__collections-add">Add to collection…</button>
    </section>
    <section class="desk-verse__section desk-verse__chains" aria-labelledby="deskVerseChainsTitle${idSuffix}" hidden>
      <h4 class="desk-verse__subhead" id="deskVerseChainsTitle${idSuffix}">Notes that cite this verse</h4>
      <ul class="desk-verse__mentions"></ul>
    </section>`;

  const heading = el.querySelector(".desk-verse__ref");
  const text = el.querySelector(".desk-verse__text");
  const greekSection = el.querySelector(".desk-verse__greek");
  const greekText = el.querySelector(".desk-verse__greek-text");
  const greekAbsent = greekSection.querySelector(".desk-verse__absent");
  const fnSection = el.querySelector(".desk-verse__fns");
  const fnList = el.querySelector(".desk-verse__fn-list");
  const mine = el.querySelector(".desk-verse__mine");
  const notesSection = el.querySelector(".desk-verse__notes");
  const notesHead = notesSection.querySelector(".desk-verse__subhead");
  const empty = el.querySelector(".desk-verse__empty");
  const add = el.querySelector(".desk-verse__add");
  setTip(add, "Add a note on this verse");
  const chainsSection = el.querySelector(".desk-verse__chains");
  const mentions = el.querySelector(".desk-verse__mentions");
  const steps = Array.from(el.querySelectorAll(".desk-verse__step"));
  add.hidden = !onAddNote || !store;
  const collectionsSection = el.querySelector(".desk-verse__collections");
  const collectionsLine = el.querySelector(".desk-verse__collections-line");
  const collectionsAdd = el.querySelector(".desk-verse__collections-add");

  let verse = null;
  let notices = new Map(); // id -> the change notice of a record shown, if it has one
  let labelsRow = null; // the bookmark whose Labels… popover is open, so a redraw can hand it the new button
  let collectionsRow = null; // likewise for Collections…

  /** A verse number the chapter has no verse for: one the LIT leaves out (Matthew 17:21). */
  const isGap = (v) => !verses.includes(v) && isVerseGap(here.bookKey, here.chapter, v);
  /** A verse the tab can show: one on the page, or a gap, which has a view of its own. */
  const canShow = (v) => verses.includes(v) || isGap(v);

  /** Where the tab opens before the reader picks: the address's verse, or the one being read. */
  function startingVerse() {
    if (startVerse != null && canShow(startVerse)) return startVerse;
    if (source) return verses[0] ?? null;
    const m = /^#v(\d+)/.exec(window.location.hash);
    const fromHash = m ? Number(m[1]) : null;
    if (fromHash && canShow(fromHash)) return fromHash;
    return verseAtReadingLine(markers, (id) => Number(id.slice(1)) || null) ?? verses[0] ?? null;
  }

  function setVerse(v) {
    if (!canShow(v)) return;
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

    // A gap's line is the tab speaking, not scripture, so it takes the
    // panel's look for "nothing here" rather than the verse's (E157).
    const gap = isGap(v);
    text.textContent = gap ? `The LIT has no ${ref(v)}.` : verseCopyFor(readText(), v) ?? "";
    text.classList.toggle("desk-verse__absent", gap);
    notesSection.hidden = gap;
    renderGreek(v, n);
    renderFootnotes(v, gap);

    const records = store ? forChapter(await store.byChapter(here.bookKey, here.chapter), here.bookKey, here.chapter) : [];
    // The whole notebook: the labels a bookmark wears, and the notes citing the verse.
    const every = store ? await store.all() : [];
    if (n !== seq) return; // a newer render has started
    // A note on a footnote shows under its footnote above, not on the verse.
    // A gap shows no marks: its My Notes is hidden (E157).
    const on = gap ? [] : recordsOnVerse(records, v).filter(
      (r) => r.kind === "note" || r.kind === "bookmark" || r.kind === "highlight",
    );
    notices = store && ctx ? noticesFor(on) : new Map();
    const labelsById = labelMap(every);
    mine.replaceChildren(...on.map((r) => itemFor(r, labelsById)));
    empty.hidden = on.length > 0;
    // A save that redrew the rows took the button the open Labels… popover
    // belongs to; point it at the one that replaced it, as My Notes does.
    const open = currentPanel();
    for (const [row, cls, kind] of [[labelsRow, "desk-item__labels", "labels"], [collectionsRow, "desk-item__collections", "collections"]]) {
      if (!open || !row || open.kind !== kind) continue;
      const b = mine.querySelector(`[data-id="${CSS.escape(row)}"] .${cls}`);
      if (b) {
        open.trigger = b;
        open.restoreFocus = b;
      }
    }

    drawCollections(every);

    // Notes anywhere in the notebook that cite this verse in their words.
    const cited = store ? notesCiting(every, { bookKey: here.bookKey, chapter: here.chapter, verse: v }) : [];
    mentions.replaceChildren(...cited.map(({ record }) => mentionItem(record)));
    chainsSection.hidden = cited.length === 0;
  }

  /**
   * The Collections section (D13, decision 11): "In Advent series and
   * Christmas Eve service." with each name a link to the collection's page,
   * and Add to collection… (it only adds; the checkboxes on a row's
   * Collections… also take out). The section is there whenever a verse can be
   * added to a collection, with "Not in any collection yet." when none holds
   * it, as My Notes keeps its button beside "No notes of yours" (the button
   * is the only way to start). A gap has none, as it has no notes.
   */
  function drawCollections(records) {
    if (!store || !ctx || verse == null || isGap(verse)) {
      collectionsSection.hidden = true;
      return;
    }
    const names = collectionsHolding(records, { bookKey: here.bookKey, chapter: here.chapter, verse });
    collectionsSection.hidden = false;
    if (!names.length) {
      collectionsLine.textContent = "Not in any collection yet.";
      return;
    }
    const nodes = ["In "];
    names.forEach((c, i) => {
      if (i > 0) nodes.push(names.length === 2 ? " and " : i === names.length - 1 ? ", and " : ", ");
      const a = make("a", "desk-verse__mention-ref", c.name);
      a.href = collectionHref(c.id);
      nodes.push(a);
    });
    nodes.push(".");
    collectionsLine.replaceChildren(...nodes);
  }

  // A collection's write wakes no view of marks (NO_CHAPTER_KINDS), so this
  // section listens for collections itself.
  const offCollections = store?.subscribe?.(
    () => {
      if (!visible()) return;
      store.all().then((records) => visible() && drawCollections(records)).catch((err) => console.error("Study Desk: the Collections line wasn’t drawn", err));
    },
    { kinds: ["collection"] },
  );

  /** "Add to collection…": this verse, whole, as a passage, in the collection the reader picks. */
  async function openAddToCollection() {
    if (verse == null || !store || !ctx) return;
    const v = verse;
    const where = { bookKey: here.bookKey, chapter: here.chapter };
    let fields;
    try {
      fields = passageFromVerses(readText(), where, v, v, ctx().contentVersion);
    } catch (err) {
      console.error("Study Desk: couldn’t read the verse for the collection", err);
      fields = passageFromVerses(null, where, v, v);
    }
    const reference = passageReference(fields);
    const box = collectionsAdd.getBoundingClientRect();
    const near = { left: box.left, top: box.top };
    const items = (records) =>
      addableCollections(records).map((c) => ({
        id: c.id,
        name: c.name,
        detail: c.modified && dateWords(c.modified) ? `Changed ${dateWords(c.modified)}` : "",
      }));
    const records = await store.all();
    const picker = openPickWindow({
      heading: "Add to collection",
      title: "All collections",
      lead: `${reference} goes into the collection you pick.`,
      noun: ["collection", "collections"],
      items: items(records),
      near,
      back: collectionsAdd,
      action: {
        label: "New collection…",
        onPress: () =>
          openNewCollection({
            store,
            ctx,
            near,
            firstMember: passageMember(fields),
            lead: `${reference} will be its first passage.`,
            back: collectionsAdd,
            onCreated: (collection, entry) =>
              showUndo(`${reference} added to ${collectionName(collection)}.`, () => undoEntry(entry), {
                link: collectionLink(collection.id),
              }),
          }),
      },
      onPick: (item) => addPassageToCollection({ store, ctx, collectionId: item.id, fields, name: item.name }),
    });
    return picker;
  }
  collectionsAdd.addEventListener("click", () => openAddToCollection());

  /**
   * One note that cites the verse: where it is, linked (to its place in the
   * margin when that is on this page, else to the page), then its words,
   * whose own references link and preview like the note's anywhere else.
   */
  function mentionItem(r) {
    const li = document.createElement("li");
    li.className = "desk-verse__mention";
    // "a footnote in Romans 8:3" for a note on a footnote (rule 23; BA20).
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
   * arrow keys step through, as in the Greek tab. A verse the SBLGNT has no
   * words for says so in this section ("The SBLGNT has no Matthew 17:21.",
   * E157), each text naming what it lacks; left out only when the files
   * can't be had, which says nothing about the verse.
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
    greekSection.hidden = !words;
    greekAbsent.hidden = !words || words.length > 0;
    greekAbsent.textContent = greekAbsent.hidden ? "" : `The SBLGNT has no ${ref(v)}.`;
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

  /** The footnote letters on a verse, in order: `{ id, label }`, each once. */
  function notesOn(v) {
    const ids = [];
    if (v == null) return ids;
    for (const a of textBox?.querySelectorAll(`[data-verse="${v}"] sup.fn-ref a[href^="#fn-"]`) ?? []) {
      const id = a.getAttribute("href").slice(1);
      if (!ids.some((x) => x.id === id)) ids.push({ id, label: a.textContent.trim() });
    }
    return ids;
  }

  /**
   * The note that explains a gap (E157): the last on the verse before it or
   * the first on the verse after, whichever names the missing verse
   * (`gapNote`). Read off the page, so a chapter re-lettered by a revision
   * still finds it.
   */
  function gapNotes(v) {
    const before = notesOn(adjacentVerse(verses, v, -1)).at(-1);
    const after = notesOn(adjacentVerse(verses, v, 1))[0];
    const beside = [before, after].filter(Boolean).map((x) => ({ ...x, text: footnoteBody(x.id)?.textContent ?? "" }));
    const id = gapNote(beside, here.chapter, v);
    return beside.filter((x) => x.id === id).map(({ id: fn, label }) => ({ id: fn, label }));
  }

  function renderFootnotes(v, gap = false) {
    const ids = gap ? gapNotes(v) : notesOn(v);
    const items = [];
    for (const { id, label } of ids) {
      const body = footnoteBody(id);
      if (!body) continue;
      const clone = body.cloneNode(true);
      clone.querySelector(".footnote-backlink")?.remove();
      clone.removeAttribute("id");
      for (const withId of clone.querySelectorAll("[id]")) withId.removeAttribute("id");
      clone.className = "desk-verse__fn-body";
      routeFootnoteLinks(clone, showPassage);
      const li = document.createElement("li");
      li.className = "desk-verse__fn";
      const letter = document.createElement("span");
      letter.className = "desk-verse__fn-label";
      letter.textContent = label;
      li.append(letter, clone);
      // Pin, as under the note in the Footnotes list.
      const pin = store ? pinButton(id, label, { bookKey: here.bookKey, chapter: here.chapter }) : null;
      if (pin) li.append(pin);
      items.push(li);
    }
    fnList.replaceChildren(...items);
    fnSection.hidden = items.length === 0;
  }

  /**
   * One row: what it is on the left (`.desk-verse__main`), its buttons on the
   * right (`.desk-verse__actions`), as My Notes' row has them (E148).
   */
  function itemFor(r, labelsById = new Map()) {
    const li = document.createElement("li");
    li.className = "desk-verse__item";
    li.dataset.id = r.id;
    const main = make("div", "desk-verse__main");
    const actions = make("div", "desk-verse__actions");
    li.append(main, actions);
    const where = recordReference(r) || ref(verse);
    // Its reference, as My Notes' row leads with it: the record's own verses
    // (a highlight may run past the verse shown), going to its place.
    const href = recordHref(r);
    const head = make(href ? "a" : "span", "desk-item__ref", where);
    if (href) head.href = href;
    const inPlace = Boolean(href && goHere?.can(r));
    if (inPlace) {
      head.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goHere.go(r);
      });
    }
    main.append(head);
    if (r.kind === "bookmark") {
      // As in My Notes: following a moving bookmark's link starts it moving,
      // and any other bookmark's stops whatever was moving.
      if (href) {
        head.addEventListener("click", (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
          if (isFollowing(r) && (!inPlace || followsHere())) followBookmark(r, inPlace ? null : head.href);
          else stopFollowing();
        });
      }
      // Its name, then its mark and line as My Notes' row has them (E28): red
      // moves, gold stays put, an outline while it follows, and the words say
      // which. syncBookmarkLines redraws the line, the follow link and Move it
      // here as this tab's follow changes.
      if (r.label) main.append(make("p", "desk-item__bookmark-name", r.label));
      const line = make("span", "desk-item__kind");
      drawBookmarkLine(line, r, nameOf(r));
      main.append(line);
      if (isFollowing(r)) main.append(followLinkButton(r, where), moveItHereButton(r, where));
      if (onEdit && canEdit(r)) actions.append(editButton(r, `Edit bookmark on ${where}`));
    } else if (r.kind === "highlight") {
      main.append(make("span", "desk-item__kind", nameOf(r)));
      highlightItem(main, r);
    } else {
      main.append(make("span", "desk-item__kind", nameOf(r)));
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
        go.setAttribute("aria-label", `Show my note on ${where} in the margin`);
        go.setAttribute("aria-describedby", words.id);
        go.innerHTML = mark;
        go.addEventListener("click", () => goHere.go(r));
        note.append(go);
      } else {
        note.innerHTML = mark;
      }
      note.append(words);
      main.append(note);
      if (onEdit) actions.append(editButton(r, `Edit note on ${where}`));
    }
    labelsFor(main, r, where, labelsById);
    if (store) {
      const [verb] = takeOff(r.kind);
      const remove = make("button", "desk-verse__remove", verb);
      remove.type = "button";
      remove.setAttribute("aria-label", `${verb} ${nameOf(r).toLowerCase()} on ${where}`);
      remove.addEventListener("click", () => removeRecord(r, li));
      actions.append(remove);
    }
    return flagged(li, r);
  }

  function editButton(r, name) {
    const edit = make("button", "desk-item__edit", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", name);
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      onEdit(r, edit);
    });
    return edit;
  }

  /** A bookmark's labels, and Labels… to change them, as My Notes' row has (E149: bookmarks only). */
  function labelsFor(main, r, where, labelsById) {
    const chips = shownLabels(r, labelsById);
    if (chips.length) {
      const ul = make("ul", "desk-chips");
      ul.setAttribute("aria-label", "Labels");
      for (const l of chips) ul.append(make("li", "desk-chip", l.name));
      main.append(ul);
    }
    if (!store || !ctx || !takesLabels(r) || !canEdit(r)) {
      collectionsFor(main, r, where);
      return;
    }
    const tag = make("button", "desk-item__tag desk-item__labels", "Labels…");
    tag.type = "button";
    tag.setAttribute("aria-label", `Labels for ${labelsSubject(r, where)}`);
    tag.addEventListener("click", () => {
      labelsRow = r.id;
      // Forget the record once its popover has closed.
      openLabelsPopover({ trigger: tag, store, ctx, recordId: r.id, name: labelsSubject(r, where) }).then(() => {
        const open = currentPanel();
        if (!open) return;
        const done = open.onClose;
        open.onClose = () => {
          done?.();
          labelsRow = null;
        };
      });
    });
    main.append(tag);
    collectionsFor(main, r, where);
  }

  /** Collections…, after Labels… where a row has one (D13, decision 24). */
  function collectionsFor(main, r, where) {
    const tag = collectionsTag({ store, ctx, record: r, reference: where, track: (id) => (collectionsRow = id) });
    if (tag) main.append(tag);
  }

  /** The row with its change notice's flag, when the record has one. */
  function flagged(li, r) {
    const notice = notices.get(r.id);
    if (!notice) return li;
    (li.querySelector(".desk-verse__main") ?? li).append(
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
   * A highlight on the verse: its words in the colour's look, under the line
   * that names the colour in words ("Green highlight"), which is what a
   * screen reader is told, as in My Notes. Its Remove is every row's.
   */
  function highlightItem(li, r) {
    const color = COLORS.includes(r.color) ? r.color : null;
    const words = document.createElement("span");
    words.className = "desk-verse__highlight";
    const quote = shortQuote(r.quote?.exact, HIGHLIGHT_WORDS);
    if (color) {
      const swatch = document.createElement("span");
      swatch.className = "desk-swatch";
      swatch.dataset.color = color;
      const sample = document.createElement("span");
      sample.className = "desk-swatch__sample";
      sample.textContent = quote;
      swatch.append(sample);
      words.append(swatch);
    } else {
      words.append(quote);
    }
    li.append(words);
    return li;
  }

  async function removeRecord(r, li) {
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
    showUndo(`${nameOf(r)}${where ? ` on ${where}` : ""} ${takeOff(r.kind)[1]}.`, () => undoEntry(entry));
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
  const onPanelActions = (e) => {
    const d = e.detail;
    if (d?.kind !== "verse" || d.view !== "study" || !panelOpen()) return;
    // A chapter the reading page loaded beside this one (read-on.js) isn't
    // this tab's: its verse menu leaves the tab where it is.
    if (d.chapter && (d.book !== here.bookKey || d.chapter !== here.chapter)) return;
    setVerse(d.start);
  };
  document.addEventListener("lit:panel-actions", onPanelActions);

  /**
   * Bring this verse's notes into view, tinted for a moment, with focus on
   * their heading (E147; BVJ, 2026-11-17): the margin's "N more notes" opens
   * the tab here, across the page from where it was pressed, and the tab
   * changing alone was easy to miss.
   */
  let flashTimer = 0;
  async function showNotes() {
    notesHead.focus({ preventScroll: true });
    await render();
    const box = scroller(notesSection);
    if (box) {
      const top = notesSection.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, top - 8), behavior: reduced ? "auto" : "smooth" });
    }
    clearTimeout(flashTimer);
    notesSection.classList.remove("desk-verse__notes--flash");
    void notesSection.offsetWidth; // a second press starts the tint again
    notesSection.classList.add("desk-verse__notes--flash");
    flashTimer = setTimeout(() => notesSection.classList.remove("desk-verse__notes--flash"), 1600);
  }

  /**
   * "This chapter" at the tab's foot: a chapter's Go deeper rows, from its
   * section on the page (the page's own chapter or one it reads on into),
   * with its heading focused. The reading page's Go deeper asks for it where
   * the Notebook panel runs, since the section leaves the flow there (WB-18;
   * read-on.js sends `show-this-chapter`).
   */
  let chapterPart = null;
  function showChapter(bookKey, chapter) {
    const rows = goDeeperOf(bookKey, chapter)?.querySelector(".go-deeper__rows");
    chapterPart?.remove();
    chapterPart = make("section", "desk-verse__section desk-chapter");
    const title = make("h4", "desk-verse__subhead", "This chapter");
    title.id = `deskChapterTitle${idSuffix}`;
    title.tabIndex = -1;
    chapterPart.setAttribute("aria-labelledby", title.id);
    chapterPart.append(title, make("p", "desk-chapter__open", `${bookKeyToLabel(bookKey)} ${chapter}`));
    if (rows) {
      const copy = rows.cloneNode(true);
      copy.className = "desk-chapter__rows";
      for (const node of copy.querySelectorAll("[id]")) node.removeAttribute("id");
      chapterPart.append(copy);
    }
    el.append(chapterPart);
    chapterPart.scrollIntoView({ block: "nearest" });
    title.focus({ preventScroll: true });
  }

  return {
    el,
    render,
    setVerse,
    focusHeading: () => heading.focus({ preventScroll: true }),
    showNotes,
    showChapter,
    // For /desk, whose This verse pane builds a tab per chapter (BA31).
    destroy: () => {
      document.removeEventListener("lit:panel-actions", onPanelActions);
      offCollections?.();
    },
  };
}
