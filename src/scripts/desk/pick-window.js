// src/scripts/desk/pick-window.js
//
// The pick window (STUDY-DESK-FIXES.md, E154; BVJ, 2026-11-18): a small window
// that lists every item of one kind, newest first as the caller orders them,
// with a filter box that narrows the list by title as the reader types.
// Choosing one hands it to the caller and closes the window. "All sheets…" at
// the foot of "Add to sheet ▸" opens it (sheets/sheet-add.js), so a passage can
// go to a sheet older than the five the flyout lists; the "All collections…"
// D13 plans is meant to open it too. So it knows nothing of sheets: it takes a
// list of named items, the words to show, and a pick callback. The filter and
// the count line are src/lib/desk-pick.mjs.
//
// A float-window.js window like the Notebook actions window: outside
// lit-panel.js's one slot, so a footnote or preview opening never closes it,
// draggable by its header, closed by its × or Escape from inside it (BA24),
// never by a click elsewhere. One is open at a time; opening another replaces
// it.
//
// Keys: focus starts in the filter box. Down moves to the first row, and Up
// from the first row back to the box; Down and Up step through the rows, Home
// and End jump; Enter or Space on a row picks it, and Enter in the box picks
// the one row left, else moves to the first. Escape in a box holding words
// only clears it (the next press closes, as the Notebook's search does). A
// letter typed on a row goes back to the box. When the window closes by its ×,
// Escape or a pick, focus goes back where the reader came from (`back`), never
// to the page (BA21).

import { createFloatWindow } from "../float-window.js";
import { dockWidth } from "../desk-frame.js";
import { filterPicks, pickCountLine } from "../../lib/desk-pick.mjs";
import { make } from "./dom.js";

const EDGE = 8;
const WIDTH = 340;
const MAX_HEIGHT = 480;
const MIN_HEIGHT = 200;

let seq = 0;
/** The open window's handle, or null. */
let current = null;

/**
 * Where a pick window sits: where the menu it came from was (`near`), kept
 * clear of the Notebook when it takes room at the right, and inside the
 * window; without `near`, near the top of the free room. Shared with the
 * windows that look like this one but are not a list (collections/name-window.js).
 */
export function placePick(el, near = null) {
  const room = innerWidth - dockWidth();
  el.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, innerHeight - 2 * EDGE))}px`;
  const w = el.offsetWidth || WIDTH;
  const h = el.offsetHeight;
  const left = near ? near.left : (room - w) / 2;
  const top = near ? near.top : 64;
  el.style.left = `${Math.max(EDGE, Math.min(left, room - w - EDGE))}px`;
  el.style.top = `${Math.max(EDGE, Math.min(top, innerHeight - h - EDGE))}px`;
}

/**
 * Take the one pick-window slot for a window of the same family that isn't a
 * list: the open one is closed ("replaced"), and `handle.close` is what a
 * later one calls in its turn. Returns the way to give the slot back.
 *
 * @param {{ close: (reason?: string) => void }} handle
 */
export function claimPickSlot(handle) {
  current?.close("replaced");
  current = handle;
  return () => {
    if (current === handle) current = null;
  };
}

/**
 * Open the window, replacing any open one.
 *
 * @param {{ heading: string, title: string, lead?: string, filterLabel?: string,
 *   noun: [string, string], items: { id: string, name: string, detail?: string }[],
 *   onPick: (item: { id: string, name: string, detail?: string }) => void,
 *   back?: HTMLElement | (() => HTMLElement | null) | null,
 *   near?: { left: number, top: number } | null, className?: string,
 *   action?: { label: string, onPress: () => void } | null }} options
 *   `heading` is the small label in the header ("Add to sheet"), `title` the
 *   window's name ("All sheets"), `lead` a line under it saying what a pick
 *   does. `noun` names one item and many, for the count line. `items` are in
 *   the order to list them; `detail` is a second line on a row ("Changed
 *   November 12, 2026"), heard as the row's description. `back` is where focus
 *   goes when the window closes (an element, or a function finding one then).
 *   `near` is where it opens (the menu it came from); without it, near the top
 *   of the window's free room. `action` is one row at the top of the list
 *   that the filter never hides ("New collection…"): pressing it closes the
 *   window, as a pick does, and calls `onPress`. It is not an item, so it
 *   isn't counted and `onPick` never hears it.
 * @returns {{ el: HTMLElement, update: (items: object[]) => void,
 *   close: (reason?: string) => void, isOpen: () => boolean }}
 */
export function openPickWindow({ heading, title, lead = "", filterLabel = "Filter by title", noun, items, onPick, back = null, near = null, className = "", action = null }) {
  current?.close("replaced");
  const id = `deskPick${++seq}`;
  let all = [...(items ?? [])];
  let shown = all;

  const onPageHide = () => win.close("page");
  const win = createFloatWindow({
    heading,
    title,
    className: `desk-pick ${className}`.trim(),
    // A click in it never folds the floating Notebook, and the single-key
    // shortcuts stand down in it (desk-frame.js).
    attrs: { "data-desk-dock": "" },
    place,
    onClose: (reason) => {
      if (current === handle) current = null;
      window.removeEventListener("pagehide", onPageHide);
      if (reason === "close" || reason === "pick") giveBack();
    },
  });

  function place(el) {
    placePick(el, near);
  }

  /** Focus back where the reader came from, unless they have put it somewhere else since. */
  function giveBack() {
    const to = typeof back === "function" ? back() : back;
    const at = document.activeElement;
    const lost = !at || at === document.body || !at.isConnected || win.el.contains(at);
    if (lost && to?.isConnected) to.focus({ preventScroll: true });
  }

  const body = win.body;
  const nodes = [];
  if (lead) {
    const p = make("p", "desk-pick__lead", lead);
    p.id = `${id}-lead`;
    win.el.setAttribute("aria-describedby", p.id);
    nodes.push(p);
  }
  const label = make("label", "desk-pick__label", filterLabel);
  label.htmlFor = `${id}-filter`;
  const input = document.createElement("input");
  input.type = "search";
  input.id = `${id}-filter`;
  input.className = "desk-pick__filter";
  input.autocomplete = "off";
  input.spellcheck = false;
  const count = make("p", "desk-pick__count");
  count.id = `${id}-count`;
  count.setAttribute("role", "status");
  input.setAttribute("aria-describedby", count.id);
  const list = make("ul", "desk-pick__list");
  list.setAttribute("aria-label", title);
  nodes.push(label, input, count, list);
  body.append(...nodes);

  const rows = () => [...list.querySelectorAll(".desk-pick__row")].filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true");

  function row(item, i) {
    const b = make("button", "desk-pick__row");
    b.type = "button";
    b.dataset.pick = item.id;
    b.append(make("span", "desk-pick__name", item.name));
    if (item.detail) {
      // Its name is the title alone; the detail is its description.
      b.setAttribute("aria-label", item.name);
      const detail = make("span", "desk-pick__detail", item.detail);
      detail.id = `${id}-detail-${i}`;
      b.setAttribute("aria-describedby", detail.id);
      b.append(detail);
    }
    b.addEventListener("click", () => pick(item));
    const li = make("li");
    li.append(b);
    return li;
  }

  function actionRow() {
    const b = make("button", "desk-pick__row desk-pick__action");
    b.append(make("span", "desk-pick__name", action.label));
    b.type = "button";
    b.dataset.pickAction = "";
    b.addEventListener("click", () => {
      win.close("pick");
      action.onPress();
    });
    const li = make("li");
    li.append(b);
    return li;
  }

  function draw() {
    shown = filterPicks(all, input.value);
    list.replaceChildren(...(action ? [actionRow()] : []), ...shown.map(row));
    list.hidden = shown.length === 0 && !action;
    count.textContent = pickCountLine(shown.length, all.length, input.value, noun);
  }

  function pick(item) {
    win.close("pick");
    onPick(item);
  }

  // A list filtered by a search box hears `search` and `change` too: the
  // browser's own clear sends no `input` (LV3-1, NB3-6).
  for (const type of ["input", "search", "change"]) input.addEventListener(type, draw);
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      rows()[0]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown.length === 1) pick(shown[0]);
      else rows()[0]?.focus();
    } else if (e.key === "Escape" && input.value) {
      // Words in the box: Escape clears them and leaves the window open.
      e.preventDefault();
      e.stopPropagation();
      input.value = "";
      draw();
    }
  });
  list.addEventListener("keydown", (e) => {
    const live = rows();
    const at = live.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (at < 0) return;
    let to = null;
    if (e.key === "ArrowDown") to = live[Math.min(at + 1, live.length - 1)];
    else if (e.key === "ArrowUp") to = at === 0 ? input : live[at - 1];
    else if (e.key === "Home") to = live[0];
    else if (e.key === "End") to = live[live.length - 1];
    else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // A letter goes on into the box, which takes focus before the key lands.
      input.focus();
      return;
    }
    if (!to) return;
    e.preventDefault();
    to.focus();
  });

  /** Draw a new list, keeping the filter and the row that had focus when it is still there. */
  function update(next) {
    const at = document.activeElement;
    const was = at instanceof HTMLElement && list.contains(at) ? at.dataset.pick : null;
    all = [...(next ?? [])];
    draw();
    if (was == null) return;
    const again = rows().find((b) => b.dataset.pick === was);
    (again ?? input).focus({ preventScroll: true });
  }

  const handle = { el: win.el, update, close: (reason = "close") => win.close(reason), isOpen: () => win.isOpen() };
  current = handle;
  draw();
  window.addEventListener("pagehide", onPageHide);
  win.show({ focus: false });
  input.focus({ preventScroll: true });
  return handle;
}

/** Close the open window, if any ("close" gives focus back; "page" doesn't). */
export function closePickWindow(reason = "page") {
  current?.close(reason);
}
