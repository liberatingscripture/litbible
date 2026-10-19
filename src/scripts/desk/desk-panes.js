// src/scripts/desk/desk-panes.js
//
// What each kind of pane on /desk draws (STUDY-DESK.md, D9; "Order of work",
// 3c to 3f). The kinds, their names and which of them follow the LIT pane are
// src/lib/desk-layout.mjs's; this says what fills a pane's body.
//
// Every pane mounts the Notebook's own module, never a copy, so a pane and
// the tab or list it comes from can't drift apart:
// - My Notes is tab-mine.js (3c);
// - This verse is tab-verse.js, with a "This chapter" section at its foot
//   holding the chapter's Go deeper (D9, "Phase 3a's answers", 3) (3d);
// - Greek is tab-greek.js (3d);
// - What I've kept is kept-list.js, the notebook page's list (3d).
// This verse and Greek read their chapter from its fetched Study View page
// (chapter-page.js), and show the passage desk-page.js gives them, with a
// passage picker at their top (passage-bar.js). The LIT text and Footnotes
// come in 3e and the sheet in 3f. Each mount returns { destroy }, plus
// setPassage for a pane that follows.

import { sameChapter, passageLabel } from "../../lib/desk-passage.mjs";
import { chapterHref, loadChapterPage } from "./chapter-page.js";
import { createKeptList } from "./kept-list.js";
import { openNoteEditor } from "./note-editor.js";
import { createPassageBar } from "./passage-bar.js";
import { createGreekTab } from "./tab-greek.js";
import { createMineTab } from "./tab-mine.js";
import { createVerseTab } from "./tab-verse.js";

const LATER = {
  lit: "The LIT text comes to this pane in a later step of the preview.",
  footnotes: "The footnotes come to this pane in a later step of the preview. They will follow the LIT pane you last worked in.",
  sheet: "Sheets come to this pane in a later step of the preview.",
};

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

  const unsubscribe = env.store?.subscribe(() => tab?.render());
  queueMicrotask(() => show(pane.get()));
  return {
    setPassage: show,
    destroy: () => {
      seq++;
      unsubscribe?.();
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
    destroy: () => { seq++; },
  };
}

function mountKept(body, env, pane) {
  if (!env.store) {
    return message(body, "This browser isn’t letting the site keep a notebook. Private windows sometimes don’t.");
  }
  const list = createKeptList({ store: env.store, ctx: env.ctx, idPrefix: `deskKept${pane.id}` });
  const wrap = make("div", "desk-np desk-np--pane");
  wrap.append(list.el);
  body.append(wrap);
  queueMicrotask(() => list.render());
  const unsubscribe = env.store.subscribe(() => list.render());
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
 *   openGreekWord: (passage: object, t: number) => void }} env
 * @param {{ id: string, get: () => object, set: (passage: object) => void }} pane
 *   `get` and `set` are the passage a following pane shows (desk-page.js).
 * @returns {{ destroy: () => void, setPassage?: (passage: object) => void }}
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
    });
    body.append(tab.el);
    // The pane goes on the page right after this returns, and a tab draws
    // only once it is there.
    queueMicrotask(() => tab.render());
    const unsubscribe = env.store?.subscribe(() => tab.render());
    return { destroy: () => unsubscribe?.() };
  }
  if (kind === "verse") return mountVerse(body, env, pane);
  if (kind === "greek") return mountGreek(body, env, pane);
  if (kind === "kept") return mountKept(body, env, pane);
  if (LATER[kind]) return message(body, LATER[kind]);
  // A pane saved by a later version of the page, which this copy doesn't know.
  return message(body, "This pane needs a newer copy of the page. Reload to get it.");
}
