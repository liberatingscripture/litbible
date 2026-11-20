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
import { follow, focusKey, heading, keyed } from "./collection-view.js";
import { openNewCollection } from "./new-collection.js";

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
  const nodes = [title];
  const actions = make("div", "collection-page__actions");
  const fresh = button("New collection…", "desk-sheet__btn desk-sheet__btn--primary");
  fresh.dataset.focusKey = focusKey(host, "new");
  fresh.addEventListener("click", () => {
    const at = fresh.getBoundingClientRect();
    openNewCollection({
      store,
      ctx,
      heading: "My collections",
      near: { left: at.left, top: at.bottom + 8 },
      back: () => keyed(host, "new"),
      // Straight into the new collection, where "Add ▾" is.
      onCreated: (made, entry) => {
        if (entry) showUndo(`${collectionName(made)} made.`, () => undoEntry(entry));
        host.open(made.id);
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
    link.href = `${host.base}desk/help/#collections`;
    // In a pane it opens in a new tab, and says so (the desk's other help links do).
    if (host.newTabLinks) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(newTabMark(), make("span", "sr-only", " (opens in a new tab)"));
    }
    help.append(link);
    nodes.push(help);
    return { nodes, title: `My collections | ${TITLE}`, focus: title };
  }
  nodes.push(actions);
  const ul = make("ul", "desk-sheet__sheets");
  for (const c of all) ul.append(listRow(host, c, records, ul));
  nodes.push(ul);
  return { nodes, title: `My collections | ${TITLE}`, focus: title };
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
