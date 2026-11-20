// src/scripts/desk/collections/collection-page.js
//
// The collections page, /collections/ (STUDY-DESK.md, D13; step 2 of its order
// of work). `/collections/` is the list (collection-list.js, which /desk's
// Collections pane draws too); `/collections/?id=<id>` is one collection
// (collection-view.js). Loaded by desk-gate.js on a computer with the preview
// on, when the page carries [data-collections-page]. It is not a reading
// surface: no panel, no margin. For everyone else, and with JS off,
// collections.astro is the whole page: a note that the Study Desk preview
// isn't switched on.
//
// The page is the views' host (collection-view.js, "The host"): it keeps the
// address, `document.title`, and the history, turning the views' `open(id)`
// and `toList()` into an address with a history entry of its own, and gives
// `listHref` and `href(id)`, so "‹ My collections" and the list's rows are
// links. Its focus keys are the plain words (no `idSuffix`).
//
// Every write is the store's (history for Ctrl+Z, the undo bar for a
// deletion); this module keeps the page in step with every change to the
// notebook, in this tab or another, by drawing the view again (`refresh`),
// handing focus to the control it names, or keeping it where it was.
//
// `mountCollectionsPage` takes what it needs, so a test drives it without the
// network: `chapterText` (a chapter's anchor text, for checking a typed
// reference), `passageText` (a passage's words), and `parse` (the reference
// reader). The defaults are `viewHost`'s, each loaded only when first asked
// for, so the list alone loads neither.

import { QUIET_KINDS } from "../../../lib/desk-store-core.mjs";
import { standDown } from "../../desk-frame.js";
import { addDeskStyle, deskCtx } from "../boot.js";
import { createHistory } from "../history.js";
import { openStore } from "../store.js";
import { initUndo } from "../undo-bar.js";
import { make } from "../dom.js";
import { collectionList } from "./collection-list.js";
import { collectionView, viewHost } from "./collection-view.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

/**
 * Draw the page into `root` and keep it drawn. Resolves to `{ refresh, open, toList, destroy }`.
 *
 * @param {HTMLElement} root
 * @param {{ store: object, ctx?: () => object, base?: string,
 *   chapterText?: Function, passageText?: Function, parse?: Function }} options
 */
export async function mountCollectionsPage(root, { store, ctx = deskCtx, base = BASE, chapterText, passageText, parse }) {
  initUndo();
  createHistory({ store, ctx });
  let seq = 0;
  const href = (id) => `${base}collections/?id=${encodeURIComponent(id)}`;
  const listHref = `${base}collections/`;
  const host = {
    ...viewHost({ store, ctx, base, chapterText, passageText, parse }),
    root,
    listHref,
    href,
    // The list's description of the feature, as /sheets has one (E187).
    listIntro: true,
    // "Open in the Study Desk" (decision 27): /desk shows it in a Collections pane.
    deskHref: (id) => `${base}desk/?collection=${encodeURIComponent(id)}`,
    // "Add ▾ › From My Notebook" (E177; BVJ: "On /collections it should Go to
    // My Notebook"), in this tab, where a row's "Collections…" and "Add these
    // N to a collection…" add to it.
    notebookHref: `${base}notebook/`,
    refresh,
    open: (id) => go(href(id)),
    toList: () => go(listHref),
  };

  /** Draw the address's view again. `focus` is the data-focus-key to put focus on, the first that is there. */
  async function refresh(focus = []) {
    const n = ++seq;
    const id = new URLSearchParams(location.search).get("id");
    const view = id ? await collectionView(host, id) : await collectionList(host);
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
  function go(to) {
    history.pushState(null, "", to);
    return refresh(["title"]);
  }

  // A change to any record can change what a collection shows (a note's words,
  // a sheet's name), so every kind but a reading place draws the view again.
  const stop = store.subscribe(() => refresh(), { except: QUIET_KINDS });
  const onPop = () => refresh(["title"]);
  addEventListener("popstate", onPop);
  await refresh();
  return {
    refresh,
    open: host.open,
    toList: host.toList,
    destroy() {
      stop();
      removeEventListener("popstate", onPop);
    },
  };
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
