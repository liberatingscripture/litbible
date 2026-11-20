// src/scripts/desk/lit-back.js
//
// “← John 3:16” at the start of a LIT pane's bar on /desk (STUDY-DESK-FIXES.md,
// E168; BVJ, 2026-11-19): after a jump moves the pane (a Search pane result,
// a record in My Notes, a reference in a footnote, a place
// typed in a picker), the way back to where the reader was. The rules are
// src/lib/desk-way-back.mjs; this draws them and keeps the pane's state, in
// memory for the visit only.
//
// It is absent until there is somewhere to go back to. Scrolling never takes
// it away (BVJ, 2026-11-19). Pressed, it names the place before that one, if
// the history holds one, and is gone when none is left; there is no Forward
// (Claude's call, open to BVJ). Where the bar has room, a quiet button (E126's
// fourth kind): the text green, an arrow and the place's name. Where it
// hasn't, the arrow alone in an ordinary button, raised like the Show eye
// beside it (BVJ, 2026-11-19: alone, the quiet arrow was "subtle and easy to
// miss"). The shared tooltip names it either way (desk.css, E72's rule).

import { NO_WAY_BACK, afterJump, afterMove, backPlace, goBack } from "../../lib/desk-way-back.mjs";
import { passageLabel } from "../../lib/desk-passage.mjs";
import { setTip } from "../tip.js";
import { make } from "./dom.js";

// An arrow, not a chevron: the bar's chevrons step a chapter.
const ICON_BACK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>`;

/**
 * @param {{ go: (passage: object, options: { focus: boolean }) => void }} options
 *   `go` takes the pane back to the place; `focus` says the button had focus
 *   and is gone now, so the pane gives its focus to the text it brought back.
 * @returns {{ el: HTMLButtonElement, jumped: (from: object | null, to: object) => void,
 *   moved: (to: object) => void, forget: () => void, place: () => object | null }}
 */
export function createBackButton({ go }) {
  const button = make("button", "desk-lit__back");
  button.type = "button";
  const arrow = make("span", "desk-lit__back-glyph");
  arrow.innerHTML = ICON_BACK;
  const word = make("span", "desk-lit__back-word");
  button.append(arrow, word);

  let state = NO_WAY_BACK;

  function draw() {
    const p = backPlace(state);
    button.hidden = !p;
    if (!p) {
      setTip(button, "");
      button.removeAttribute("aria-label");
      word.textContent = "";
      return;
    }
    const name = `Back to ${passageLabel(p)}`;
    word.textContent = passageLabel(p);
    button.setAttribute("aria-label", name);
    // For the arrow alone in a narrow pane, and the same words in a wide one.
    setTip(button, name);
  }
  draw();

  button.addEventListener("click", () => {
    const had = document.activeElement === button;
    const { place, state: next } = goBack(state);
    if (!place) return;
    state = next;
    draw();
    // Still here with a place before this one, it keeps the focus, so Enter
    // steps back again.
    go(place, { focus: had && button.hidden });
  });

  return {
    el: button,
    jumped(from, to) {
      state = afterJump(state, from, to);
      draw();
    },
    moved(to) {
      state = afterMove(state, to);
      draw();
    },
    forget() {
      state = NO_WAY_BACK;
      draw();
    },
    place: () => backPlace(state),
  };
}
