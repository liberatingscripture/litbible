// src/scripts/desk/hidden-actions.js
//
// The hidden passage in the verse menu and the selection panel (STUDY-DESK.md,
// N8). actions.js calls two things from here as it builds "My Notebook":
//
//   guardPanel   first. When the verses the panel covers include a hidden one,
//                the panel stops handing out the words: Copy text, Copy link,
//                Copy with notes, Share… and Make an image are hidden, and it
//                says "This passage is hidden by your note" with Show and
//                Stop hiding. (Decided here: the menu is replaced rather than
//                each button turned off, so there is one clear thing to do
//                and no half-working menu. A hidden verse's own number can't
//                be reached, being inert, so in practice this is the guard
//                for a selection that runs into a hidden passage, Ctrl+A
//                included.) Returns true when it has taken the panel over, and
//                actions.js adds nothing else.
//   hideRow      last. "Hide this passage…" opens the form (hidden-form.js);
//                for a passage the reader has shown this visit it offers
//                "Hide again" and "Stop hiding" instead.
//
// Both ask hidden.js (`hiddenApi()`), which is how the page knows what is
// hidden. Neither writes anything but through the store.

import { passageRef } from "../../lib/desk-hidden.mjs";
import { closePanel, currentPanel } from "../lit-panel.js";
import { openHideForm } from "./hidden-form.js";
import { hiddenApi } from "./hidden.js";

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}

/** The heading is what stays on a taken-over panel. */
const KEEP = ".lit-panel__header, .lit-panel__heading";

/**
 * @returns {boolean} true when the panel covers a hidden verse and now offers
 *   only Show and Stop hiding
 */
export function guardPanel(d, where) {
  const hid = hiddenApi();
  if (!hid || !hid.coversRange(where.bookKey, where.chapter, d.start, d.end)) return false;
  const passages = hid.passagesIn(where.bookKey, where.chapter, d.start, d.end).filter((g) => !g.revealed);
  const panel = d.panel;
  panel.classList.add("desk-hidden-blocked");
  for (const el of Array.from(panel.children)) if (!el.matches(KEEP)) el.hidden = true;

  const says = document.createElement("p");
  says.className = "desk-hidden-notice";
  says.textContent =
    d.kind === "selection" && !(d.start === passages[0]?.start && d.end === passages[passages.length - 1]?.end)
      ? "This selection includes a passage you hid. Nothing is copied or shared while it is hidden."
      : "This passage is hidden by your note. Nothing is copied or shared while it is hidden.";
  d.append(says);

  const row = document.createElement("div");
  row.className = "lit-panel__row lit-panel__row--halves";
  const show = button("Show");
  const stop = button("Stop hiding");
  row.append(show, stop);
  d.append(row);

  show.addEventListener("click", () => {
    d.acting?.();
    closePanel();
    hid.showRange(where.bookKey, where.chapter, d.start, d.end);
  });
  stop.addEventListener("click", async () => {
    d.acting?.();
    closePanel();
    const ids = passages.flatMap((g) => g.ids);
    await hid.stop(ids, passageRef(where.bookKey, where.chapter, passages[0].start, passages[passages.length - 1].end));
  });
  return true;
}

/** The row of N8's own actions, appended last. */
export function hideRow(d, where, { store, ctx }) {
  const hid = hiddenApi();
  if (!hid) return;
  const row = document.createElement("div");
  row.className = "lit-panel__row";
  const shown = hid.passagesIn(where.bookKey, where.chapter, d.start, d.end).filter((g) => g.revealed);
  if (shown.length) {
    const again = button("Hide again");
    const stop = button("Stop hiding");
    row.classList.add("lit-panel__row--halves");
    row.append(again, stop);
    again.addEventListener("click", () => {
      d.acting?.();
      closePanel();
      hid.hideAgain(where.bookKey, where.chapter, d.start, d.end);
    });
    stop.addEventListener("click", async () => {
      d.acting?.();
      closePanel();
      await hid.stop(
        shown.flatMap((g) => g.ids),
        passageRef(where.bookKey, where.chapter, shown[0].start, shown[shown.length - 1].end),
      );
    });
  } else {
    const hide = button("Hide this passage…");
    row.append(hide);
    hide.addEventListener("click", () => {
      d.acting?.();
      // Opens beside what the menu was opened from: the verse number, or the
      // selection.
      const trigger = (d.kind === "selection" && d.range) || currentPanel()?.trigger || hide;
      const restoreFocus = currentPanel()?.restoreFocus ?? null;
      openHideForm({
        trigger,
        store,
        ctx,
        where,
        start: d.start,
        end: d.end,
        restoreFocus,
        // The words are blurred now; a selection left on them would sit there.
        onHidden: () => {
          if (d.kind === "selection") window.getSelection()?.removeAllRanges();
        },
      });
    });
  }
  d.append(row);
}
