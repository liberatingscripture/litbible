// src/scripts/desk/collections/collection-pane.js
//
// /desk's Collections pane (STUDY-DESK.md, D13, "A Collections pane on /desk",
// decisions 26 to 36): the second home of the list (collection-list.js) and
// of one collection (collection-view.js), beside the /collections page. It
// has the Sheets pane's shape (decision 26): it opens on the list, a row opens
// that collection, and "All collections" goes back. Which collection it
// shows is the layout's (`setPaneCollection`, handed in by desk-panes.js as
// `getCollection` and `setCollection`), so a reload keeps it.
//
// It is the views' host (collection-view.js, "The host"), and keeps what only
// a pane has:
// - its id on every id, focus key and radio name (`idSuffix`), and everything
//   the views look for found inside its own element, so two Collections panes
//   never answer for each other;
// - "Open on its own page" (a new tab) in Print's place (decisions 32 and 36);
// - the list's "New collection" beside its title (`listHead`, E186), as a
//   Sheets pane's "New sheet" is;
// - references that move the leading LIT pane, as a jump, so its bar offers
//   the way back (decision 29, E168), or open one by E127's rule where none
//   is open; a sheet in the collection shown in a Sheets pane by the same rule
//   (`showSheet`), the undo bar saying what it took the place of;
// - "Add ▾ › From My Notes" (E177; BVJ: "On /desk, it should open the My
//   Notes pane"): `showMine`, desk-page.js's, shows a My Notes pane by
//   E127's rule, this pane keeping its place;
// - the command row's "New collection…" (decision 28): `desk:collection-new`
//   with this pane's id shows the list with its New collection form open
//   (E190), and Create shows the new collection in this pane;
// - every change to the notebook draws it again (decision 31), so a passage
//   the LIT pane's menus add to the collection it shows appears at once.

import { noWayLinkLabel, noWayMessage, replacedMessage } from "../../../lib/desk-search-pane.mjs";
import { QUIET_KINDS } from "../../../lib/desk-store-core.mjs";
import { showNotice, showUndo } from "../undo-bar.js";
import { make } from "../dom.js";
import { collectionName } from "../../../lib/desk-collections.mjs";
import { collectionHref } from "./add-passage.js";
import { collectionList } from "./collection-list.js";
import { collectionView, focusKey, viewHost } from "./collection-view.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/**
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   paneId: string, getCollection: () => string | null, setCollection: (id: string | null) => void,
 *   showPassage?: ((passage: object, options?: object) => unknown) | null,
 *   showSheet?: ((sheetId: string, keep?: string) => object) | null,
 *   showMine?: ((keep: string) => unknown) | null,
 *   chapterText?: Function, passageText?: Function, parse?: Function }} options
 *   `showPassage`, `showSheet` and `showMine` are desk-page.js's (desk-panes.js's `env`);
 *   the last three are `viewHost`'s readers, which a test replaces.
 * @returns {{ el: HTMLElement, show: (id: string | null, options?: { focus?: boolean }) => Promise<void>, destroy: () => void }}
 *   `show` puts a collection (or, null, the list) in the pane from outside,
 *   as the undo bar's "Open the collection" does; `focus` takes focus to its
 *   title.
 */
export function createCollectionPane({ store, ctx, paneId, getCollection, setCollection, showPassage = null, showSheet = null, showMine = null, chapterText, passageText, parse }) {
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
    backLabel: "All collections",
    headingTag: "h3",
    headingClass: "desk-sheet__list-title",
    // The list's title and "New collection" share a row, as a Sheets pane's
    // "My sheets" and "New sheet" do (E186).
    listHead: true,
    newTabLinks: true,
    ownPageHref: collectionHref,
    // "Add ▾ › From My Notes" (E177): a My Notes pane beside this one, which
    // keeps its place; desk-page.js says what it took the place of, if anything.
    ...(showMine ? { openNotes: () => showMine(paneId) } : {}),
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

  /**
   * Draw the pane's view again. `focus` names the focus keys to put focus on,
   * the first that is there. `reveal` scrolls the focused row into view (a move's);
   * `drawn` runs as soon as the view is in, before anything is awaited, so a
   * move from another order can hold its row in place before a frame is
   * painted (E213).
   */
  async function refresh(focus = [], { reveal = false, drawn = null } = {}) {
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
      if (reveal) (to.closest("[data-row-key]") ?? to).scrollIntoView?.({ block: "nearest" });
    }
    drawn?.();
    // The header names the open collection (E69's place): the name, or nothing
    // on the list or for a collection that isn't there.
    const named = await nameShown();
    if (n === seq && !destroyed) document.dispatchEvent(new CustomEvent("desk:collection-named", { detail: { paneId, name: named } }));
  }

  /** The name of the collection shown, read as collectionView reads it (a live collection, or null). */
  async function nameShown() {
    if (!shows) return null;
    const c = (await store.all()).find((r) => r?.id === shows && r.kind === "collection");
    return c ? collectionName(c) : null;
  }

  const keyedIn = (k) => (k ? el.querySelector(`[data-focus-key="${CSS.escape(k)}"]`) : null);

  /**
   * Show collection `id` (null: the list), keep it in the layout, and draw. A
   * different collection, or the list to a collection or back, starts at the
   * top of the pane; a redraw of the same view keeps its scroll.
   */
  function show(id, focus = []) {
    const next = typeof id === "string" && id ? id : null;
    const changed = next !== shows;
    shows = next;
    setCollection?.(shows);
    const drawn = refresh(focus);
    if (!changed) return drawn;
    return drawn.then(() => {
      const scroller = el.closest(".desk-pane__body") ?? el.parentElement;
      if (scroller) scroller.scrollTop = 0;
    });
  }

  // "New collection…" in the command row (decision 28), for this pane: the
  // list, with its New collection form open and focus in Name (E190), as the
  // command row's "New sheet…" opens a Sheets pane's templates; Create shows
  // the new collection here. Registered as the pane is built, because
  // command-row.js sends the event right after its commit (DK6-10).
  const onNew = (e) => {
    if (e.detail?.paneId !== paneId) return;
    const form = shows ? null : el.querySelector(".collection-page__new");
    if (form) {
      form.show();
      return;
    }
    // A collection is showing, or the list is still being drawn.
    host.listState.open = true;
    show(null, [focusKey(host, "new-name")]);
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
