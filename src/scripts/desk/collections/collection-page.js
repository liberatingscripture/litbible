// src/scripts/desk/collections/collection-page.js
//
// The collections page, /collections/ (STUDY-DESK.md, D13; step 2 of its order
// of work). `/collections/` is the list, drawn as My sheets is (its title, its
// "New collection…" button, one card for each, in `desk-sheet__*`);
// `/collections/?id=<id>` is one collection (collection-view.js). Loaded by
// desk-gate.js on a computer with the preview on, when the page carries
// [data-collections-page]. It is not a reading surface: no panel, no margin.
// For everyone else, and with JS off, collections.astro is the whole page: a
// note that the Study Desk preview isn't switched on.
//
// The list has two shapes. With none, the page says what a collection is in
// two sentences, offers "New collection…", and links the help page's section.
// With some, each card shows the name, the description, how many things it
// shows, and when it changed; Delete takes it to the trash with the undo bar.
// "Make a sheet" and "Add to sheet ▸" are step 7 and aren't here yet.
//
// Every write is the store's (history for Ctrl+Z, the undo bar for a
// deletion); this module keeps the page in step with every change to the
// notebook, in this tab or another, by drawing the view again (`refresh`),
// handing focus to the control it names, or keeping it where it was.
//
// `mountCollectionsPage` takes what it needs, so a test drives it without the
// network: `chapterText` (a chapter's anchor text, for checking a typed
// reference), `passageText` (a passage's words), and `parse` (the reference
// reader). The defaults load the chapter pages (chapter-page.js) and read the
// words as a sheet's passage does (sheets/sheet-lit.js), each only when first
// asked for, so the list alone loads neither.

import { collectionCount, collectionName } from "../../../lib/desk-collections.mjs";
import { QUIET_KINDS } from "../../../lib/desk-store-core.mjs";
import { parseReference } from "../../search-core.js";
import { standDown } from "../../desk-frame.js";
import { addDeskStyle, deskCtx } from "../boot.js";
import { createHistory, undoEntry } from "../history.js";
import { openStore } from "../store.js";
import { initUndo, showNotice, showUndo } from "../undo-bar.js";
import { dateWords, plural } from "../desk-text.js";
import { buttons, make } from "../dom.js";
import { collectionView } from "./collection-view.js";
import { openNewCollection } from "./new-collection.js";

const button = buttons("desk-sheet__btn");
const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const TITLE = "Liberation and Inclusion Translation";
const DESCRIPTION_SHOWN = 140;

/** A chapter's anchor text, or null when it can't be read. */
async function defaultChapterText(bookKey, chapter) {
  try {
    const { loadChapterPage } = await import("../chapter-page.js");
    const source = await loadChapterPage(bookKey, chapter);
    return source.textBox ? source.anchorText() : null;
  } catch (_) {
    return null;
  }
}

/** The words of `where` ({ bookKey, chapter, verse, endVerse }) as plain text, or null when they can't be read. */
async function defaultPassageText(where) {
  try {
    const { readPassage, passageWords } = await import("../sheets/sheet-lit.js");
    const m = { bookKey: where.bookKey, chapter: where.chapter, verse: where.verse, endVerse: where.endVerse };
    const view = await readPassage(m);
    if (!view.ok) return null;
    // passageWords gives { el, base }: the words are its element.
    const words = passageWords(view, m)?.el;
    if (!words) return null;
    for (const s of words.querySelectorAll("sup")) s.remove();
    return words.textContent;
  } catch (err) {
    // Said aloud: a quiet failure here once hid that no live words were ever read.
    console.error("Study Desk: a collection's passage couldn’t be read", err);
    return null;
  }
}

/** A collection card's second line: its description, how many it shows, and when it changed. */
function metaLine(c, records) {
  const text = (c.description ?? "").replace(/\s+/g, " ").trim();
  const description = text.length > DESCRIPTION_SHOWN ? `${text.slice(0, DESCRIPTION_SHOWN - 1)}…` : text;
  const when = c.modified && dateWords(c.modified) ? `changed ${dateWords(c.modified)}` : "";
  return [description, plural(collectionCount(c, records), "item"), when].filter(Boolean).join(" · ");
}

const byChange = (a, b) =>
  String(b.modified ?? "").localeCompare(String(a.modified ?? "")) || collectionName(a).localeCompare(collectionName(b)) || (a.id < b.id ? -1 : 1);

/**
 * Draw the page into `root` and keep it drawn. Resolves to `{ refresh, go, destroy }`.
 *
 * @param {HTMLElement} root
 * @param {{ store: object, ctx?: () => object, base?: string,
 *   chapterText?: Function, passageText?: Function, parse?: Function }} options
 */
export async function mountCollectionsPage(root, {
  store,
  ctx = deskCtx,
  base = BASE,
  chapterText = defaultChapterText,
  passageText = defaultPassageText,
  parse = parseReference,
}) {
  initUndo();
  createHistory({ store, ctx });
  let seq = 0;
  const words = new Map();
  // What a view keeps while it is drawn again (an open form, a heading being renamed), by collection.
  const states = new Map();
  const page = {
    store,
    ctx,
    base,
    chapterText,
    parse,
    // A passage's words, read once for each place and kept.
    passageText(where) {
      const key = `${where.bookKey} ${where.chapter}:${where.verse}-${where.endVerse ?? where.verse}`;
      if (!words.has(key)) words.set(key, passageText(where));
      return words.get(key);
    },
    viewState(id) {
      if (!states.has(id)) states.set(id, { adding: false, typed: "", heading: false, headingText: "", editing: null });
      return states.get(id);
    },
    refresh,
    go,
    follow(e, href) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      go(href);
    },
  };

  /** Draw the address's view again. `focus` is the data-focus-key to put focus on, the first that is there. */
  async function refresh(focus = []) {
    const n = ++seq;
    const id = new URLSearchParams(location.search).get("id");
    const view = id ? await collectionView(page, id) : await listView(page);
    if (n !== seq) return;
    const at = document.activeElement;
    const was = root.contains(at) ? (at.closest?.("[data-focus-key]")?.dataset.focusKey ?? "") : null;
    root.replaceChildren(...view.nodes);
    document.title = view.title;
    const wanted = [...focus, ...(was ? [was] : [])];
    const to =
      wanted.map((k) => root.querySelector(`[data-focus-key="${CSS.escape(k)}"]`)).find((el) => el && !el.disabled) ??
      (was !== null ? view.focus : null);
    if (to) {
      if (!to.matches("a, button, input, textarea")) to.tabIndex = -1;
      to.focus({ preventScroll: true });
    }
  }

  /** Go to another view of the page, with a history entry of its own. */
  function go(href) {
    history.pushState(null, "", href);
    return refresh(["title"]);
  }

  /* ── The list ─────────────────────────────────────────────────── */

  async function listView() {
    const records = await store.all();
    const all = records.filter((r) => r?.kind === "collection").sort(byChange);
    const title = make("h1", "sheets-page__title", "My collections");
    title.dataset.focusKey = "title";
    const nodes = [title];
    const actions = make("div", "collection-page__actions");
    const fresh = button("New collection…");
    fresh.dataset.focusKey = "new";
    fresh.addEventListener("click", () => {
      const at = fresh.getBoundingClientRect();
      openNewCollection({
        store,
        ctx,
        heading: "My collections",
        near: { left: at.left, top: at.bottom + 8 },
        back: () => document.querySelector('[data-focus-key="new"]'),
        // Straight into the new collection, where Add passage… is.
        onCreated: (made, entry) => {
          if (entry) showUndo(`${collectionName(made)} made.`, () => undoEntry(entry));
          go(`${base}collections/?id=${encodeURIComponent(made.id)}`);
        },
      });
    });
    actions.append(fresh);
    if (!all.length) {
      nodes.push(
        make(
          "p",
          "desk-np__intro",
          "A collection gathers your notes, highlights, bookmarks, sheets, and passages for one purpose, such as a class, a sermon series, or a season. Start one here with “New collection,” or from any verse’s menu with “Add to collection.”",
        ),
        actions,
      );
      const help = make("p");
      const link = make("a", null, "How collections work");
      link.href = `${base}desk/help/#collections`;
      help.append(link);
      nodes.push(help);
      return { nodes, title: `My collections | ${TITLE}`, focus: title };
    }
    nodes.push(actions);
    const ul = make("ul", "desk-sheet__sheets");
    for (const c of all) {
      const name = collectionName(c);
      const li = make("li", "desk-sheet__sheet");
      const open = make("a", "desk-sheet__open");
      open.href = `${base}collections/?id=${encodeURIComponent(c.id)}`;
      open.dataset.focusKey = `open-${c.id}`;
      open.addEventListener("click", (e) => page.follow(e, open.href));
      open.append(make("span", "desk-sheet__open-name", name), make("span", "desk-sheet__open-meta", metaLine(c, records)));
      const del = button("Delete", "desk-sheet__btn desk-sheet__btn--quiet");
      del.setAttribute("aria-label", `Delete ${name}`);
      del.dataset.focusKey = `delete-${c.id}`;
      del.addEventListener("click", async () => {
        const keys = [...ul.querySelectorAll(".desk-sheet__open")].map((a) => a.dataset.focusKey);
        const at = keys.indexOf(open.dataset.focusKey);
        let trash = null;
        try {
          trash = await store.remove(c.id);
        } catch (err) {
          console.error("Study Desk: couldn’t delete a collection", err);
          showNotice("The collection couldn’t be deleted in this browser. Try again in a moment.");
          return;
        }
        const entry = trash ? store.lastEntry() : null;
        if (entry) showUndo(`${name} deleted.`, () => undoEntry(entry));
        refresh([keys[at + 1], keys[at - 1], "new"].filter(Boolean));
      });
      li.append(open, del);
      ul.append(li);
    }
    nodes.push(ul);
    return { nodes, title: `My collections | ${TITLE}`, focus: title };
  }

  // A change to any record can change what a collection shows (a note's words,
  // a sheet's name), so every kind but a reading place draws the view again.
  const stop = store.subscribe(() => refresh(), { except: QUIET_KINDS });
  addEventListener("popstate", () => refresh(["title"]));
  await refresh();
  return { refresh, go, destroy: stop };
}

async function start() {
  const root = document.querySelector("[data-collections-page]");
  if (!root) return;
  addDeskStyle();
  root.classList.add("sheets-page__root", "desk-np");
  let store = null;
  try {
    store = await openStore({ ctx: deskCtx });
  } catch (err) {
    console.error("Study Desk: the notebook didn’t open", err);
  }
  if (!store) {
    root.replaceChildren(
      make("h1", "sheets-page__title", "Collections"),
      make("p", "desk-panel__empty", "This browser isn’t letting the site keep a notebook, so there are no collections to show. Private windows sometimes don’t. Open the site in a regular window to keep collections."),
    );
    return;
  }
  try {
    await mountCollectionsPage(root, { store });
  } catch (err) {
    console.error("Study Desk: the collections page didn’t draw", err);
    standDown(); // its "Loading" line gives way to the note again
  }
}

start();
