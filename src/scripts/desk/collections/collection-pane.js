// src/scripts/desk/collections/collection-pane.js
//
// /desk's Collections pane (STUDY-DESK.md, D13, "A Collections pane on /desk",
// decisions 26 to 36): the second home of the list (collection-list.js) and
// of one collection (collection-view.js), beside the /collections page. It
// has the Sheets pane's shape (decision 26): it opens on the list, a row opens
// that collection, and "‹ All collections" goes back. Which collection it
// shows is the layout's (`setPaneCollection`, handed in by desk-panes.js as
// `getCollection` and `setCollection`), so a reload keeps it.
//
// It is the views' host (collection-view.js, "The host"), and keeps what only
// a pane has:
// - its id on every id, focus key and radio name (`idSuffix`), and everything
//   the views look for found inside its own element, so two Collections panes
//   never answer for each other;
// - the members on the pane, not on a card (`plainMembers`), and "Open on its
//   own page" (a new tab) in Print's place (decisions 32 and 36);
// - references that move the leading LIT pane, as a jump, so its bar offers
//   the way back (decision 29, E168), or open one by E127's rule where none
//   is open; a sheet in the collection shown in a Sheets pane by the same rule
//   (`showSheet`), the undo bar saying what it took the place of;
// - the command row's "New collection…" (decision 28): `desk:collection-new`
//   with this pane's id opens the name window here, and Create shows the new
//   collection in this pane;
// - every change to the notebook draws it again (decision 31), so a passage
//   the LIT pane's menus add to the collection it shows appears at once.

import { collectionName } from "../../../lib/desk-collections.mjs";
import { noWayLinkLabel, noWayMessage, replacedMessage } from "../../../lib/desk-search-pane.mjs";
import { QUIET_KINDS } from "../../../lib/desk-store-core.mjs";
import { undoEntry } from "../history.js";
import { showNotice, showUndo } from "../undo-bar.js";
import { make } from "../dom.js";
import { collectionHref } from "./add-passage.js";
import { collectionList } from "./collection-list.js";
import { collectionView, focusKey, keyed, viewHost } from "./collection-view.js";
import { openNewCollection } from "./new-collection.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/**
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   paneId: string, getCollection: () => string | null, setCollection: (id: string | null) => void,
 *   showPassage?: ((passage: object, options?: object) => unknown) | null,
 *   showSheet?: ((sheetId: string, keep?: string) => object) | null,
 *   chapterText?: Function, passageText?: Function, parse?: Function }} options
 *   `showPassage` and `showSheet` are desk-page.js's (desk-panes.js's `env`);
 *   the last three are `viewHost`'s readers, which a test replaces.
 * @returns {{ el: HTMLElement, show: (id: string | null, options?: { focus?: boolean }) => Promise<void>, destroy: () => void }}
 *   `show` puts a collection (or, null, the list) in the pane from outside,
 *   as the undo bar's "Open the collection" does; `focus` takes focus to its
 *   title.
 */
export function createCollectionPane({ store, ctx, paneId, getCollection, setCollection, showPassage = null, showSheet = null, chapterText, passageText, parse }) {
  const el = make("div", "desk-collections");
  // A browser keeping no notebook shows one line, as the Sheets pane does (decision 33).
  if (!store) {
    el.append(
      make(
        "p",
        "desk-pane__later",
        "This browser isn’t letting the site keep a notebook, so collections can’t be saved here. Private windows sometimes don’t. Open the site in a regular window to keep collections.",
      ),
    );
    return { el, async show() {}, destroy() {} };
  }

  let shows = getCollection?.() ?? null;
  let seq = 0;
  let destroyed = false;

  /** A sheet in the collection, in a Sheets pane by E127's rule; this pane keeps its place. */
  function openSheet(sheetId) {
    const way = showSheet?.(sheetId, paneId);
    if (way?.outcome === "replaced") {
      showUndo(replacedMessage("sheet", way.replaced.kind), () => way.undoLayout(), { keyless: true });
    } else if (way?.outcome === "none" && way.reason) {
      showNotice(noWayMessage("sheet", way.reason, { collection: true }), {
        link: { label: noWayLinkLabel("sheet"), href: `${BASE}sheets/?id=${encodeURIComponent(sheetId)}` },
      });
    }
  }

  const host = {
    ...viewHost({ store, ctx, base: BASE, chapterText, passageText, parse }),
    root: el,
    idSuffix: paneId,
    backLabel: "‹ All collections",
    headingTag: "h3",
    headingClass: "desk-sheet__list-title",
    newTabLinks: true,
    plainMembers: true,
    ownPageHref: collectionHref,
    // A reference moves the LIT pane being read (decision 29); with none open,
    // one opens beside this pane, or takes another's place (E127). A sheet
    // goes to a Sheets pane, where the page sends it to /sheets/.
    goHere: {
      can: (m) => (m?.kind === "sheet" ? Boolean(showSheet && m.id) : Boolean(showPassage && m?.bookKey && m.chapter)),
      go: (m) => {
        if (m.kind === "sheet") openSheet(m.id);
        else showPassage({ bookKey: m.bookKey, chapter: m.chapter, verse: m.verse ?? null }, { beside: paneId, asker: "collection" });
      },
    },
    refresh,
    open: (id) => show(id, [focusKey(host, "title")]),
    // Back on the list, focus goes to the row it came from, as "‹ All sheets" does.
    toList: () => show(null, [focusKey(host, `open-${shows ?? ""}`), focusKey(host, "title")]),
  };

  /** Draw the pane's view again. `focus` names the focus keys to put focus on, the first that is there. */
  async function refresh(focus = []) {
    const n = ++seq;
    let view;
    try {
      view = shows ? await collectionView(host, shows) : await collectionList(host);
    } catch (err) {
      console.error("Study Desk: the Collections pane couldn’t be drawn", err);
      if (n === seq && !destroyed) el.replaceChildren(make("p", "desk-pane__later", "Your collections couldn’t be read just now. Try again in a moment."));
      return;
    }
    if (n !== seq || destroyed) return;
    const at = document.activeElement;
    const was = el.contains(at) ? (at.closest?.("[data-focus-key]")?.dataset.focusKey ?? "") : null;
    el.replaceChildren(...view.nodes);
    const wanted = [...focus, ...(was ? [was] : [])];
    const to =
      wanted.map((k) => keyedIn(k)).find((node) => node && !node.disabled) ??
      (was !== null ? view.focus : null);
    if (to) {
      if (!to.matches("a, button, input, textarea")) to.tabIndex = -1;
      to.focus({ preventScroll: true });
    }
  }

  const keyedIn = (k) => (k ? el.querySelector(`[data-focus-key="${CSS.escape(k)}"]`) : null);

  /** Show collection `id` (null: the list), keep it in the layout, and draw. */
  function show(id, focus = []) {
    shows = typeof id === "string" && id ? id : null;
    setCollection?.(shows);
    return refresh(focus);
  }

  // "New collection…" in the command row (decision 28), for this pane: the
  // name window, near the list's own button when the list is showing, and
  // Create shows the new collection here. Registered as the pane is built,
  // because command-row.js sends the event right after its commit (DK6-10).
  const onNew = (e) => {
    if (e.detail?.paneId !== paneId) return;
    const button = keyed(host, "new");
    const box = (button ?? el).getBoundingClientRect();
    openNewCollection({
      store,
      ctx,
      heading: "My collections",
      near: { left: box.left, top: button ? box.bottom + 8 : box.top },
      back: e.detail.back ?? (() => keyed(host, "new")),
      onCreated: (made, entry) => {
        if (entry) showUndo(`${collectionName(made)} made.`, () => undoEntry(entry));
        host.open(made.id);
      },
    });
  };
  document.addEventListener("desk:collection-new", onNew);

  // Every change but a reading place's (decision 31): a note's words, a
  // sheet's name, a passage added from the LIT pane's menus.
  const stop = store.subscribe(() => refresh(), { except: QUIET_KINDS });
  refresh();

  return {
    el,
    show: (id, { focus = false } = {}) => show(id, focus ? [focusKey(host, "title")] : []),
    destroy() {
      destroyed = true;
      stop();
      document.removeEventListener("desk:collection-new", onNew);
    },
  };
}
