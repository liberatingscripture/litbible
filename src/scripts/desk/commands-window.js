// src/scripts/desk/commands-window.js
//
// The Commands window (E31, reworked 2026-11-06): the Study Desk's own
// commands, the ones a ">" in the search box lists (src/lib/desk-commands.mjs),
// in a small window of their own. It is kept apart from the Greek search's
// "Search commands" window (src/scripts/greek-commands.js) on purpose: that one
// is for building a Greek search, and this one is a plain list. Select a command
// and it runs, and the window is done with, as it is in the box.
//
// A float-window.js window like that one and the tour offer: outside
// lit-panel.js's one slot, so a footnote or preview opening never closes it,
// draggable by its header, closed by the × or Escape. It is desk code. The
// search tray and /search reach it only through notebook-search.js
// (openCommands), which loadDeskSearch() in search-core.js imports only with
// data-desk="on"; the Notebook's Settings tab imports that module itself.
//
// Nothing here knows where the list comes from: the caller passes `list` (what
// listCommands gives) and `run` (what runs a command that is not a link), so
// this file stays free of the page it is opened on.

import { createFloatWindow } from "../float-window.js";
import { dockWidth } from "../desk-frame.js";
import { make } from "./dom.js";

const GAP = 16;
const EDGE = 8;
const WIDTH = 340;
const MAX_HEIGHT = 520;
const MIN_HEIGHT = 240;

export const COMMANDS_LEAD =
  "Type “>” in the search box to list these, or the start of a few of their words, such as “hide marks.” Select one here to run it.";
export const COMMANDS_MORE = "More appear when you are reading a chapter.";

/** The open window: { win, anchor, beside, opener }, or null. */
let current = null;

function row(command, run) {
  const el = make(command.href ? "a" : "button", "desk-cmds__row");
  if (command.href) {
    el.href = command.href;
  } else {
    el.type = "button";
    el.addEventListener("click", () => {
      run(command);
      // As the box does, it is done with once chosen.
      closeCommandsWindow("command");
    });
  }
  el.append(make("span", "desk-cmds__name", command.name));
  if (command.hint) el.append(make("span", "desk-cmds__hint", command.hint));
  const li = make("li");
  li.append(el);
  return li;
}

/** Fill the body from what is offered here: a row for each, and the line about the rest. */
function draw(body, { here, more }, run) {
  const list = make("ul", "desk-cmds__list");
  list.append(...here.map((c) => row(c, run)));
  const nodes = [make("p", "desk-cmds__lead", COMMANDS_LEAD), list];
  if (more) nodes.push(make("p", "desk-cmds__lead desk-cmds__more", COMMANDS_MORE));
  body.replaceChildren(...nodes);
}

/**
 * Where it sits. Beside the thing it was opened from: to the right of the
 * search box when there is room, else against the right edge below it; to the
 * left of the Notebook when it was opened from the Notebook (`beside`).
 */
function place(el) {
  if (!current) return;
  const w = el.offsetWidth || WIDTH;
  const dock = dockWidth();
  const beside = current.beside?.isConnected ? current.beside.getBoundingClientRect() : null;
  // The room the Notebook keeps for itself, when it is open, is not ours.
  const right = dock ? innerWidth - dock : beside ? beside.left : innerWidth;
  const box = current.anchor?.isConnected ? current.anchor.getBoundingClientRect() : null;
  let left = right - w - GAP;
  let top = box ? box.bottom + 10 : GAP;
  if (box && !beside && box.right + GAP + w <= right - EDGE) {
    left = box.right + GAP;
    top = box.top;
  } else if (box && beside) {
    top = box.top;
  }
  left = Math.max(EDGE, left);
  top = Math.max(EDGE, top);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  const room = innerHeight - top - EDGE;
  el.style.maxHeight = room >= MIN_HEIGHT ? `${Math.min(room, MAX_HEIGHT)}px` : "";
}

const onPageHide = () => closeCommandsWindow("page");

/**
 * Open the window, or refresh it if it is open.
 * @param {{ list: { here: { id: string, name: string, href: string | null, hint: string }[], more: number },
 *   run: (command: { id: string }) => void,
 *   anchor?: Element | null, beside?: Element | null, opener?: HTMLElement | null,
 *   onRun?: () => void }} options
 *   `list` is what `listCommands` gives; `run` runs a command that isn't a link.
 *   `anchor` is what it sits beside (the search box's form); `beside` is the
 *   Notebook's panel, which it sits to the left of. `opener` is the control that
 *   opened it, which takes focus back when the window is closed with its ×.
 *   `onRun` hears that a command was chosen (the tray closes itself).
 */
export function openCommandsWindow({ list, run, anchor = null, beside = null, opener = null, onRun = () => {} }) {
  const runCommand = (command) => {
    run(command);
    onRun();
  };
  if (current) {
    current.anchor = anchor;
    current.beside = beside;
    current.opener = opener;
    draw(current.win.body, list, runCommand);
    current.win.reposition();
    current.win.title.focus({ preventScroll: true });
    return;
  }

  const win = createFloatWindow({
    heading: "Search",
    title: "Notebook actions",
    className: "desk-cmds",
    // A click in it never closes the Notebook when that floats, nor the tray.
    attrs: { "data-desk-dock": "", "data-desk-commands": "" },
    place,
    onClose: (reason) => {
      const was = current;
      current = null;
      window.removeEventListener("pagehide", onPageHide);
      if (reason === "close" && was?.opener?.isConnected) was.opener.focus({ preventScroll: true });
    },
  });
  current = { win, anchor, beside, opener };
  draw(win.body, list, runCommand);
  window.addEventListener("pagehide", onPageHide);
  win.show();
}

/** Close the window (for the reason given: "close", "page", "command"). */
export function closeCommandsWindow(reason = "page") {
  current?.win.close(reason);
}

/** Whether it is open. */
export function commandsWindowOpen() {
  return Boolean(current);
}
