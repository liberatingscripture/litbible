// src/scripts/desk/desk-panes.js
//
// What each kind of pane on /desk draws (STUDY-DESK.md, D9; "Order of work",
// 3c to 3f). The kinds, their names and which of them follow the LIT pane are
// src/lib/desk-layout.mjs's; this says what fills a pane's body.
//
// Every pane mounts the Notebook's own module, never a copy, so a pane and
// the tab or list it comes from can't drift apart:
// - My Notes is tab-mine.js (3c), following the LIT pane by scrolling its
//   list (3g);
// - This verse is tab-verse.js, with a "This chapter" section at its foot
//   holding the chapter's Go deeper (D9, "Phase 3a's answers", 3) (3d);
// - Greek is tab-greek.js (3d);
// - What I've kept is kept-list.js, the notebook page's list (3d).
// - the LIT text is lit-pane.js, the whole corpus in one scroll (3e);
// - Footnotes is footnotes-view.js, the chapter's notes with the reader's
//   verse marked (X11; 3e);
// - Sheet is sheet-pane.js, the sheet editor (S1; 3f), showing the sheet the
//   layout names for it, or the list of sheets.
// The following panes (This verse, Greek, Footnotes) read their chapter from
// its fetched Study View page (chapter-page.js), and show the passage
// desk-page.js gives them, with a passage picker at their top
// (passage-bar.js). Each mount returns { destroy },
// plus setPassage for a pane that is moved: a following pane, or a LIT pane
// that the panes following it lead back (the Greek's scrolling, a picker).
// A pane whose scrolling tells where its reader is also returns keep, which
// desk-page.js calls before it redraws the panes (BA51): it notes where the
// pane is and returns what puts it back, untold.

import { sameChapter, passageLabel } from "../../lib/desk-passage.mjs";
import { chapterHref, loadChapterPage } from "./chapter-page.js";
import { createFootnotesView } from "./footnotes-view.js";
import { createKeptList } from "./kept-list.js";
import { createLitPane } from "./lit-pane.js";
import { openNoteEditor } from "./note-editor.js";
import { createPassageBar } from "./passage-bar.js";
import { createSheetPane } from "./sheet-pane.js";
import { createGreekTab } from "./tab-greek.js";
import { createMineTab } from "./tab-mine.js";
import { onDeskChapters } from "./page.js";
import { createVerseTab } from "./tab-verse.js";

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function message(body, text) {
  body.append(make("p", "desk-pane__later", text));
  return { destroy() {} };
}

/** A status line in a pane, with Try again when there is something to retry. */
function status(text, retry) {
  const box = make("div", "desk-dp__status");
  box.setAttribute("role", "status");
  box.append(make("p", null, text));
  if (retry) {
    const b = make("button", "desk-dp__retry", "Try again");
    b.type = "button";
    b.addEventListener("click", retry);
    box.append(b);
  }
  return box;
}

const hereOf = (p) => ({ bookKey: p.bookKey, chapter: p.chapter, label: passageLabel({ ...p, verse: null }) });

/**
 * "This chapter" at the foot of This verse: the chapter's Go deeper rows
 * (podcast episodes, articles, key terms, and the book's introduction), taken
 * from its Study View page, and a link to that page. Its links are the
 * page's own, so one to another page of the site leaves /desk as it would
 * from Study View.
 */
function thisChapter(source, paneId) {
  const section = make("section", "desk-verse__section desk-chapter");
  const title = make("h4", "desk-verse__subhead", "This chapter");
  title.id = `deskChapterTitle-${paneId}`;
  section.setAttribute("aria-labelledby", title.id);
  section.append(title);
  const rows = source.goDeeper?.querySelector(".go-deeper__rows");
  if (rows) {
    const copy = rows.cloneNode(true);
    copy.className = "desk-chapter__rows";
    section.append(copy);
  }
  const open = make("p", "desk-chapter__open");
  const a = make("a", null, `Read ${passageLabel({ bookKey: source.bookKey, chapter: source.chapter })} in Study View`);
  a.href = chapterHref(source.bookKey, source.chapter);
  open.append(a);
  section.append(open);
  return section;
}

/** The pane's frame for a following kind: the picker, then a part that holds the tab. */
function followFrame(body, pane, fill) {
  body.classList.add("desk-pane__body--fill");
  const bar = createPassageBar({ id: pane.id, set: pane.set });
  const content = make("div", fill ? "desk-dp__content desk-dp__content--fill" : "desk-dp__content");
  body.append(bar.el, content);
  return { bar, content };
}

function mountVerse(body, env, pane) {
  const { bar, content } = followFrame(body, pane, false);
  let chapter = null; // the passage whose chapter the tab shows
  let shown = null; // the verse the tab shows
  let tab = null;
  let seq = 0;

  async function show(p) {
    bar.update(p);
    if (tab && sameChapter(chapter, p)) {
      if (p.verse && p.verse !== shown) {
        shown = p.verse;
        tab.setVerse(p.verse);
      }
      return;
    }
    const n = ++seq;
    tab?.destroy();
    tab = null;
    chapter = p;
    shown = p.verse;
    content.replaceChildren(status("Loading the chapter…"));
    let source;
    try {
      source = await loadChapterPage(p.bookKey, p.chapter);
    } catch (_) {
      if (n === seq) content.replaceChildren(status("The chapter couldn’t be loaded.", () => { chapter = null; show(p); }));
      return;
    }
    if (n !== seq) return;
    if (source.draft) {
      content.replaceChildren(status(`${hereOf(p).label} is still being translated. Its Greek is ready in a Greek pane.`));
      return;
    }
    const here = hereOf(p);
    tab = createVerseTab({
      store: env.store,
      here,
      visible: () => body.isConnected,
      panelOpen: () => false,
      onEdit: env.onEdit,
      onAddNote: env.store
        ? (draft, trigger) => openNoteEditor({
          trigger, store: env.store, ctx: env.ctx, ref: draft.verse ? `${here.label}:${draft.verse}` : here.label,
          draft, restoreFocus: trigger, text: source.anchorText,
        })
        : null,
      ctx: env.ctx,
      greek: { open: (verse, t) => env.openGreekWord({ ...p, verse }, t) },
      source,
      startVerse: p.verse,
      idSuffix: `-${pane.id}`,
      onVerse: (verse) => {
        shown = verse;
        pane.set({ ...p, verse });
      },
    });
    content.replaceChildren(tab.el, thisChapter(source, pane.id));
    tab.render();
  }

  // It draws the chapter's notes, bookmarks and highlights, never a place, so a
  // ribbon following the reader doesn't redraw it (BA107).
  const unsubscribe = env.store?.subscribe(() => tab?.render(), { except: ["place"] });
  // A record's wording is judged only where a LIT pane shows its chapter, so
  // the tab is drawn again when the panes' chapters change (BA121).
  const offChapters = onDeskChapters(() => tab?.render());
  queueMicrotask(() => show(pane.get()));
  return {
    setPassage: show,
    destroy: () => {
      seq++;
      unsubscribe?.();
      offChapters();
      tab?.destroy();
    },
  };
}

function mountGreek(body, env, pane) {
  const { bar, content } = followFrame(body, pane, true);
  let chapter = null;
  let top = null; // the verse the Greek was last moved to, or scrolled to
  let tab = null;
  let seq = 0;
  let word = null; // a word to select once the chapter is drawn

  async function show(p) {
    bar.update(p);
    if (tab && sameChapter(chapter, p)) {
      if (p.verse && p.verse !== top) {
        top = p.verse;
        tab.goToVerse(p.verse);
      }
      return;
    }
    const n = ++seq;
    tab?.destroy();
    tab = null;
    chapter = p;
    top = p.verse;
    content.replaceChildren(status("Loading the Greek…"));
    // The key terms and footnote letters come from the LIT's page; the Greek
    // shows without them if that page can't be had.
    let source = { textBox: null, termData: null };
    try {
      const page = await loadChapterPage(p.bookKey, p.chapter);
      source = { textBox: page.textBox, termData: page.termData };
    } catch (_) {}
    if (n !== seq) return;
    let made = null;
    made = createGreekTab({
      here: hereOf(p),
      visible: () => Boolean(made?.el.isConnected),
      openVerse: (verse) => pane.set({ ...p, verse }),
      source,
      startVerse: p.verse,
      idSuffix: `-${pane.id}`,
      openHit: (hit) => {
        word = { verse: hit.verse, t: hit.t };
        pane.set({ bookKey: hit.book, chapter: hit.chapter, verse: hit.verse });
      },
      onTopVerse: (verse) => {
        top = verse;
        pane.set({ ...p, verse });
      },
    });
    tab = made;
    content.replaceChildren(tab.el);
    await tab.render();
    if (n !== seq || !word) return;
    const w = word;
    word = null;
    tab.selectWord(w.verse, w.t, { focus: true });
  }

  queueMicrotask(() => show(pane.get()));
  return {
    setPassage: show,
    chapter: () => chapter,
    selectWord: (verse, t, opts) => tab?.selectWord(verse, t, opts) ?? Promise.resolve(false),
    // The page puts the scrolling back; the Greek only mustn't tell it.
    keep: () => () => tab?.settle(),
    destroy: () => {
      seq++;
      tab?.destroy();
    },
  };
}

function mountFootnotes(body, env, pane) {
  const { bar, content } = followFrame(body, pane, false);
  let chapter = null; // the passage whose chapter the view shows
  let view = null;
  let source = null;
  let seq = 0;

  async function show(p) {
    bar.update(p);
    if (view && sameChapter(chapter, p)) {
      view.show(source, p.verse);
      return;
    }
    const n = ++seq;
    view = null;
    chapter = p;
    content.replaceChildren(status("Loading the footnotes…"));
    let page;
    try {
      page = await loadChapterPage(p.bookKey, p.chapter);
    } catch (_) {
      if (n === seq) content.replaceChildren(status("The chapter couldn’t be loaded.", () => { chapter = null; show(p); }));
      return;
    }
    if (n !== seq) return;
    source = page;
    view = createFootnotesView({
      idSuffix: `-${pane.id}`,
      store: env.store,
      // A note's verse leads back: the LIT pane this pane follows goes there.
      onVerse: (verse) => pane.set({ ...p, verse }),
    });
    content.replaceChildren(view.el);
    view.show(source, p.verse);
  }

  queueMicrotask(() => show(pane.get()));
  return {
    setPassage: show,
    destroy: () => { seq++; },
  };
}

function mountLit(body, env, pane) {
  body.classList.add("desk-pane__body--fill");
  const lit = createLitPane({ paneId: pane.id, start: pane.get(), drafts: env.drafts, onPlace: pane.set });
  body.append(lit.el);
  return { setPassage: (p) => lit.goTo(p), keep: () => lit.keep(), destroy: () => lit.destroy() };
}

function mountSheet(body, env, pane) {
  body.classList.add("desk-pane__body--fill");
  const sheet = createSheetPane({
    store: env.store,
    ctx: env.ctx,
    paneId: pane.id,
    getSheet: pane.getSheet,
    setSheet: pane.setSheet,
    showPassage: env.showPassage,
  });
  body.append(sheet.el);
  return { destroy: () => sheet.destroy() };
}

/**
 * A record on a verse moves the LIT pane being read there (3g), which the
 * following panes then follow: for My Notes' rows and What I've kept's
 * (BA124), whose references would otherwise leave /desk.
 */
function goToRecord(env) {
  return {
    can: (r) => Boolean(r?.bookKey && r.chapter),
    go: (r) => env.showPassage({ bookKey: r.bookKey, chapter: r.chapter, verse: r.verse ?? null }),
  };
}

function mountKept(body, env, pane) {
  if (!env.store) {
    return message(body, "This browser isn’t letting the site keep a notebook. Private windows sometimes don’t.");
  }
  const list = createKeptList({ store: env.store, ctx: env.ctx, idPrefix: `deskKept${pane.id}`, goHere: goToRecord(env) });
  const wrap = make("div", "desk-np desk-np--pane");
  wrap.append(list.el);
  body.append(wrap);
  queueMicrotask(() => list.render());
  // The list holds no places (listable leaves them out), so a ribbon following
  // the reader doesn't redraw it under a reader typing in its search (BA107).
  const unsubscribe = env.store.subscribe(() => list.render(), { except: ["place"] });
  return { destroy: () => unsubscribe() };
}

/**
 * Fill a pane's body with a kind.
 *
 * @param {string} kind
 * @param {HTMLElement} body
 * @param {{ store: object | null, storeError: unknown,
 *   onEdit: ((record: object, trigger: Element) => void) | null,
 *   ctx: () => { client: string, contentVersion: string },
 *   openGreekWord: (passage: object, t: number) => void,
 *   drafts: Record<string, number[]> }} env
 * @param {{ id: string, get: () => object, set: (passage: object) => void,
 *   getSheet: () => string | null, setSheet: (id: string | null) => void }} pane
 *   `get` and `set` are the passage the pane shows (desk-page.js): for a LIT
 *   pane, `set` is where its reader now is. `getSheet` and `setSheet` are the
 *   sheet a Sheet pane shows.
 * @returns {{ destroy: () => void, setPassage?: (passage: object) => void,
 *   keep?: () => () => void }}
 */
export function mountPane(kind, body, env, pane) {
  body.classList.remove("desk-pane__body--fill");
  if (kind === "mine") {
    const tab = createMineTab({
      store: env.store,
      storeError: env.storeError,
      inReadView: false,
      // Drawn whenever it is on the page; a closed pane is taken off it.
      visible: () => body.isConnected,
      onEdit: env.onEdit,
      ctx: env.ctx,
      goHere: goToRecord(env),
    });
    body.append(tab.el);
    // It follows the LIT pane (3g; BVJ, 2026-10-19): the records on the
    // passage being read are kept in view, the list otherwise unchanged.
    tab.follow(pane.get());
    // The pane goes on the page right after this returns, and a tab draws
    // only once it is there.
    queueMicrotask(() => tab.render());
    const unsubscribe = env.store?.subscribe(() => tab.render());
    const offMeta = env.store?.onMeta?.(() => tab.render()); // What's new's line (BA96)
    // Its rows' wording is judged only where a LIT pane shows their chapter,
    // so it is drawn again when the panes' chapters change (BA121).
    const offChapters = onDeskChapters(() => tab.render());
    return {
      setPassage: (p) => tab.follow(p),
      destroy: () => {
        unsubscribe?.();
        offMeta?.();
        offChapters();
        tab.destroy();
      },
    };
  }
  if (kind === "verse") return mountVerse(body, env, pane);
  if (kind === "greek") return mountGreek(body, env, pane);
  if (kind === "kept") return mountKept(body, env, pane);
  if (kind === "lit") return mountLit(body, env, pane);
  if (kind === "footnotes") return mountFootnotes(body, env, pane);
  if (kind === "sheet") return mountSheet(body, env, pane);
  // A pane saved by a later version of the page, which this copy doesn't know.
  return message(body, "This pane needs a newer copy of the page. Reload to get it.");
}
