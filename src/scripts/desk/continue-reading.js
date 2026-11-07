// src/scripts/desk/continue-reading.js
//
// "Continue reading" (STUDY-DESK-FIXES.md E9): the one place the Notebook lists that
// is not a bookmark. It is where the reader stopped, not something they
// marked, so it carries no bookmark mark, and it is the only thing above the
// list; every other place the Notebook once listed (the book's other places,
// other clients' places, Read View's per-book places, the named ribbons) is
// gone, and the ribbons are bookmarks now (desk-bookmarks.mjs).
//
// It is one element, `continueSection`, that the Notebook panel's My Notes
// tab puts above its list and the /notebook/ page mounts as it is. It stays
// where reader code keeps it (localStorage `lit_last_read`, last-read.js) and
// is only read here; it is not a notebook record. It links to where the reader
// was, in the view it was kept in, and moves as they read. Where it names
// what is already on screen (`here`: this chapter, Read View's book, /desk's
// LIT pane) it is left out (Audit 4, FU4-2), so a first visit doesn't show a
// row that looks like a bookmark the reader never made.

import { continueIsHere, continueItem } from "../../lib/desk-bookmarks.mjs";
import { loadLastRead } from "../last-read.js";

let seq = 0;

/**
 * The Continue reading row as an element. It draws itself, keeps itself in
 * step with the reader (other tabs' saves, and this tab's as they read, slowly),
 * and has nothing to show for a reader who hasn't read yet: it stays hidden
 * unless `emptyText` is given. `section.refresh()` redraws it at once; the My
 * Notes tab calls that when it is shown. `here` says what is on screen
 * (`continueIsHere`), where the row is left out.
 *
 * @param {{ emptyText?: string | null,
 *   here?: () => { bookKey: string, chapter?: number } | null }} [options]
 * @returns {HTMLElement & { refresh: () => void, destroy: () => void }}
 */
export function continueSection({ emptyText = null, here = () => null } = {}) {
  const n = ++seq;
  const section = document.createElement("section");
  section.className = "desk-continue";
  section.setAttribute("aria-labelledby", `deskContinueTitle${n}`);
  section.hidden = true;

  const title = document.createElement("h3");
  title.className = "desk-mine__pins-title desk-continue__title";
  title.id = `deskContinueTitle${n}`;
  title.textContent = "Continue reading";
  const list = document.createElement("ul");
  list.className = "desk-list desk-continue__list";
  const empty = document.createElement("p");
  empty.className = "desk-continue__empty";
  empty.hidden = true;
  section.append(title, list, empty);

  function render() {
    const last = loadLastRead();
    const item = continueIsHere(last, here()) ? null : continueItem(last);
    if (item) {
      const li = document.createElement("li");
      li.className = "desk-item desk-item--continue";
      li.dataset.place = "continue";
      const head = document.createElement("a");
      head.className = "desk-item__ref";
      head.textContent = item.title;
      head.href = item.href;
      const kind = document.createElement("span");
      kind.className = "desk-item__kind";
      kind.textContent = item.detail;
      li.append(head, kind);
      list.replaceChildren(li);
    } else {
      list.replaceChildren();
    }
    section.hidden = !item && !emptyText;
    empty.hidden = Boolean(item) || !emptyText;
    empty.textContent = item ? "" : (emptyText ?? "");
  }

  // Quiet while out of sight: the My Notes tab calls `refresh` when it shows.
  const visible = () => Boolean(section.parentElement?.getClientRects().length);
  const whenSeen = () => {
    if (visible()) render();
  };
  // Another tab's Continue reading.
  const onStorage = (e) => {
    if (e.key === null || e.key === "lit_last_read") whenSeen();
  };
  window.addEventListener("storage", onStorage);
  // This tab's moves as the reader reads: a slow redraw.
  let timer = 0;
  const onLastRead = () => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      whenSeen();
    }, 2000);
  };
  window.addEventListener("lit:last-read", onLastRead);

  section.refresh = render;
  // For a My Notes pane on /desk, which can be closed (BA31).
  section.destroy = () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("lit:last-read", onLastRead);
    window.clearTimeout(timer);
  };
  render();
  return section;
}
