// src/scripts/desk/collections/collection-list.js
//
// The list of the reader's collections (STUDY-DESK.md, D13), drawn by both of
// its homes as my-sheets.js serves the Sheets pane and /sheets (E64): the
// /collections/ page (collection-page.js) and, from step 4 of the pane's order
// of work, /desk's Collections pane. It is drawn as My sheets is: a title, one
// primary "New collection…" (E126), and a card per collection in
// `desk-sheet__*` with its name, a line of what it holds, and Delete, which
// takes it to the trash with the undo bar. With none, two sentences say what a
// collection is, beside "New collection…" and the help page's section.
//
// Each home follows its Sheets twin (E186; BVJ, 2026-11-19): the page's
// button sits under the title, named "New collection…" as /sheets' "New
// sheet…" is, and a host that gives `listHead` (the pane) puts it beside the
// title in one row, named "New collection" as a Sheets pane's "New sheet" is.
// A host that gives `listIntro` (the page) puts a short description of the
// feature under the title, as /sheets has one (E187); the pane has none, so
// its empty list says what a collection is instead.
//
// The button opens its form in place, under its row (E190; BVJ, 2026-11-19),
// as a Sheets pane's "New sheet" opens its templates: `newCollectionForm`
// (new-collection.js), whose words live in the host's `listState`, so a list
// drawn again while it is open keeps it open with what was typed. The name
// window stays for the ways in that have no list to open on.
//
// It knows nothing of addresses or panes. Its host (see collection-view.js,
// "The host") opens a collection with `open(id)`, and a row is a link only
// where the host gives `href(id)` (the page), else a button. Focus keys are
// the host's (`key`), and everything this looks for is found inside the host's
// own element (`root`), never with `document.querySelector`, so two
// Collections panes never answer for each other.

import { collectionCount, collectionName } from "../../../lib/desk-collections.mjs";
import { undoEntry } from "../history.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { dateWords, plural } from "../desk-text.js";
import { buttons, make } from "../dom.js";
import { newTabMark } from "../glyphs.js";
import { follow, focusKey, heading } from "./collection-view.js";
import { newCollectionForm } from "./new-collection.js";

const button = buttons("desk-sheet__btn");
const DESCRIPTION_SHOWN = 140;
const TITLE = "Liberation and Inclusion Translation";

/** A collection card's second line: its description, how many it shows, and when it changed. */
export function metaLine(c, records) {
  const text = (c.description ?? "").replace(/\s+/g, " ").trim();
  const description = text.length > DESCRIPTION_SHOWN ? `${text.slice(0, DESCRIPTION_SHOWN - 1)}…` : text;
  const when = c.modified && dateWords(c.modified) ? `changed ${dateWords(c.modified)}` : "";
  return [description, plural(collectionCount(c, records), "item"), when].filter(Boolean).join(" · ");
}

/** Newest change first, then by name. */
export const byChange = (a, b) =>
  String(b.modified ?? "").localeCompare(String(a.modified ?? "")) || collectionName(a).localeCompare(collectionName(b)) || (a.id < b.id ? -1 : 1);

/**
 * The list view: { nodes, title, focus }, as `collectionView` returns one
 * collection's. `title` is the page's document title; a pane ignores it.
 *
 * @param {object} host the view's host (collection-view.js)
 */
export async function collectionList(host) {
  const { store, ctx } = host;
  const records = await store.all();
  const all = records.filter((r) => r?.kind === "collection").sort(byChange);
  const title = heading(host, "My collections");
  title.dataset.focusKey = focusKey(host, "title");
  // The pane's title and button share a row (`desk-sheet__list-head`, the
  // Sheets pane's); the page's button has a row of its own under the title.
  const actions = make("div", host.listHead ? "desk-sheet__list-head" : "collection-page__actions");
  const nodes = host.listHead ? [actions] : [title];
  if (host.listHead) actions.append(title);
  const fresh = button(host.listHead ? "New collection" : "New collection…", "desk-sheet__btn desk-sheet__btn--primary");
  fresh.dataset.focusKey = focusKey(host, "new");
  // Its form opens in place under the button's row (E190), as a Sheets pane's
  // templates do under "New sheet".
  const form = newCollectionForm({
    store,
    ctx,
    opener: fresh,
    idSuffix: host.idSuffix,
    state: host.listState,
    keys: (name) => focusKey(host, name),
    // Straight into the new collection, where "Add ▾" is.
    onCreated: (made, entry) => {
      if (entry) showUndo(`${collectionName(made)} made.`, () => undoEntry(entry));
      host.open(made.id);
    },
  });
  fresh.addEventListener("click", () => form.toggle());
  actions.append(fresh);
  // The page's description (E187), always shown, as /sheets' is.
  if (host.listIntro) nodes.push(pageIntro(host));
  if (!host.listHead) nodes.push(actions);
  nodes.push(form);
  if (!all.length) {
    if (host.listIntro) {
      nodes.push(make("p", "desk-np__intro", "You haven’t made a collection yet."));
    } else {
      // A pane has no description, so its empty list says what a collection is.
      nodes.push(
        make(
          "p",
          "desk-np__intro",
          "A collection gathers your notes, highlights, bookmarks, sheets, and passages for one purpose, such as a class, a sermon series, or a season. Start one here with “New collection,” or from any verse’s menu with “Add to collection.”",
        ),
      );
      const help = make("p");
      help.append(helpLink(host));
      nodes.push(help);
    }
    return { nodes, title: `My collections | ${TITLE}`, focus: title };
  }
  const ul = make("ul", "desk-sheet__sheets");
  for (const c of all) ul.append(listRow(host, c, records, ul));
  nodes.push(ul);
  return { nodes, title: `My collections | ${TITLE}`, focus: title };
}

/** "How collections work", the help page's section; in a pane in a new tab, saying so (the desk's other help links do). */
function helpLink(host) {
  const link = make("a", null, "How collections work");
  link.href = `${host.base}desk/help/#collections`;
  if (host.newTabLinks) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(newTabMark(), make("span", "sr-only", " (opens in a new tab)"));
  }
  return link;
}

/**
 * The page's description (E187; BVJ, 2026-11-19: "giving an idea what the
 * feature is and how it works. Relatively short."), shaped as /sheets' is:
 * what one is, the ways in, what it does, the Study Desk linked, and the help
 * page's section last, where /sheets has its tour.
 */
function pageIntro(host) {
  const desk = make("a", null, "the Study Desk");
  desk.href = `${host.base}desk/`;
  const p = make("p", "desk-np__intro");
  p.append(
    "A collection gathers your notes, highlights, bookmarks, sheets, and passages for one purpose, such as a class, a sermon series, or a season. Add to one with “Add to collection” in a verse’s menu or “Collections…” on a row in My Notebook. Each can be printed or put on a sheet, and a Collections pane in ",
    desk,
    " shows one beside the LIT. ",
    helpLink(host),
  );
  return p;
}

/** One collection's card: its name and line, opening it, and Delete. */
function listRow(host, c, records, ul) {
  const name = collectionName(c);
  const li = make("li", "desk-sheet__sheet");
  const href = host.href?.(c.id);
  let open;
  if (href) {
    open = make("a", "desk-sheet__open");
    open.href = href;
    open.addEventListener("click", (e) => follow(e, () => host.open(c.id)));
  } else {
    open = button("", "desk-sheet__open");
    open.addEventListener("click", () => host.open(c.id));
  }
  open.dataset.focusKey = focusKey(host, `open-${c.id}`);
  open.append(make("span", "desk-sheet__open-name", name), make("span", "desk-sheet__open-meta", metaLine(c, records)));
  const del = button("Delete", "desk-sheet__btn desk-sheet__btn--quiet");
  del.setAttribute("aria-label", `Delete ${name}`);
  del.dataset.focusKey = focusKey(host, `delete-${c.id}`);
  del.addEventListener("click", async () => {
    const keys = [...ul.querySelectorAll(".desk-sheet__open")].map((a) => a.dataset.focusKey);
    const at = keys.indexOf(open.dataset.focusKey);
    let trash = null;
    try {
      trash = await host.store.remove(c.id);
    } catch (err) {
      console.error("Study Desk: couldn’t delete a collection", err);
      showNotice("The collection couldn’t be deleted in this browser. Try again in a moment.");
      return;
    }
    const entry = trash ? host.store.lastEntry() : null;
    if (entry) showUndo(`${name} deleted.`, () => undoEntry(entry));
    host.refresh([keys[at + 1], keys[at - 1], focusKey(host, "new")].filter(Boolean));
  });
  li.append(open, del);
  return li;
}
