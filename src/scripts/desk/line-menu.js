// src/scripts/desk/line-menu.js
//
// Every line the desk lets a reader drag to resize works the same way, by one
// set of rules here (E189; BVJ, 2026-11-19: "they use different approaches.
// Probably best to consolidate them"): the two margin lines in Chapter View,
// the floating Notebook's left edge, the Greek tab's line between the text and
// the entry, and the lines between /desk's panes. `wireLine` gives a line all
// of it:
//
// - **Drag** it with a press that moves.
// - **Click** it (a press released without moving), or press Enter or Space
//   on it, and a small menu opens: a step each way and the line's reset
//   (Audit 8, XA8-1; BVJ, 2026-11-10). That is the single-pointer way WCAG
//   2.5.7 asks for, for a reader who points with a trackball, a head pointer,
//   eye tracking or voice and can click but not drag. Nothing new shows at
//   rest (BVJ's rule for reading pages); the help page says so.
// - **The arrow keys across the line** move it a step (Shift, a bigger one),
//   and **Home and End** move it as far as it goes toward the start (left or
//   top) or the end (right or bottom): the ARIA window-splitter pattern.
// - **Its grip** (where it draws one) sits beside the pointer along the line,
//   and at the middle of the line's visible part when it takes focus.
//
// Until E189 the /desk pane lines had their own handlers: no menu (the pane
// menu's Size, DK-8, was their click route, and stays), and a double click
// that evened the panes out, which is now the menu's reset, as the Greek
// line's double click became its reset in XA8-1.
//
// The steps keep the menu open, so a reader can press "Wider text" three
// times without reopening it; a step that has reached its limit is disabled
// with its reason, read by the menu's description (menu-reasons.js). The
// limit is read from the line's own `aria-valuenow`, `aria-valuemin` and
// `aria-valuemax`, which each line keeps current for a screen reader, and
// after each step the line's `aria-valuetext` is said. The reset closes the
// menu.
//
// - `wireLine(line, options)` wires a line; see its comment for the options.
// - `clickOrDrag(line, e, { move, end, click })` runs a press that started on
//   the line: past a few pixels of movement it is a drag (`move(ev)`, then
//   `end()`); released before that it is a click (`click(ev)`). So a click
//   never writes a width, which the old handlers did with a zero move.
// - `toggleLineMenu(line, options)` opens the line's menu, or closes it if it
//   is open. `options`:
//     `label`  the menu's accessible name ("Text width")
//     `more`, `less`  the two steps' labels ("Wider text", "Narrower text"),
//       `more` being the one that raises `aria-valuenow`
//     `step(dir)`  take one step, +1 for `more` and -1 for `less`
//     `reset`  `{ label, run, shown? }`: the line's reset, offered while
//       `shown()` (default always)
//     `at`  `{ x, y }` in window pixels: where the press was, or omitted for a
//       key, which opens it beside the line's grip
//     `along`  "vertical" (a line running down the page: the menu opens to its
//       right) or "horizontal" (the menu opens below it)

import { make } from "./dom.js";
import { describeUnavailable } from "./menu-reasons.js";

/** How far a press may move and still count as a click, in pixels. */
export const CLICK_SLOP = 4;

let seq = 0;
const open = new WeakMap();

/**
 * Whether a step can still be taken from a line's ARIA values: "max" when it is
 * as far up as it goes, "min" when as far down, else null. Unknown values
 * block nothing.
 *
 * @param {{ now: number, min: number, max: number }} v
 */
export function lineLimit({ now, min, max }) {
  if (!Number.isFinite(now)) return null;
  if (Number.isFinite(max) && now >= max - 0.5) return "max";
  if (Number.isFinite(min) && now <= min + 0.5) return "min";
  return null;
}

/**
 * Where the menu goes, in window pixels: beside the line at the press (to the
 * right of a vertical line, below a horizontal one), flipped to the other side
 * where it doesn't fit, and kept 8px inside the window.
 *
 * @param {{ x: number, y: number }} at
 * @param {"vertical" | "horizontal"} along
 * @param {number} w the menu's width
 * @param {number} h the menu's height
 * @param {{ width: number, height: number }} view
 */
export function lineMenuPlace(at, along, w, h, view) {
  const GAP = 12;
  let left;
  let top;
  if (along === "vertical") {
    left = at.x + GAP + w + 8 <= view.width ? at.x + GAP : at.x - GAP - w;
    top = at.y - 16;
  } else {
    left = at.x - 16;
    top = at.y + GAP + h + 8 <= view.height ? at.y + GAP : at.y - GAP - h;
  }
  left = Math.max(8, Math.min(left, view.width - w - 8));
  top = Math.max(8, Math.min(top, view.height - h - 8));
  return { left: Math.round(left), top: Math.round(top) };
}

/**
 * A press that began on `line` (call it from the line's own `pointerdown`,
 * after checking the button): a drag once it moves past CLICK_SLOP, a click if
 * released before.
 */
export function clickOrDrag(line, e, { move, end = () => {}, click }) {
  const x0 = e.clientX;
  const y0 = e.clientY;
  let dragging = false;
  try {
    line.setPointerCapture(e.pointerId);
  } catch (_) {
    /* a synthetic event has no live pointer */
  }
  const onMove = (ev) => {
    if (!dragging && Math.hypot(ev.clientX - x0, ev.clientY - y0) < CLICK_SLOP) return;
    // A drag puts away the line's menu, if it was open.
    if (!dragging) closeLineMenu(line);
    dragging = true;
    move(ev);
  };
  const finish = (ev) => {
    line.removeEventListener("pointermove", onMove);
    line.removeEventListener("pointerup", finish);
    line.removeEventListener("pointercancel", finish);
    end();
    if (!dragging && ev.type === "pointerup") click(ev);
  };
  line.addEventListener("pointermove", onMove);
  line.addEventListener("pointerup", finish);
  line.addEventListener("pointercancel", finish);
}

/**
 * Wire a line the reader can drag, so it answers as every other one does (see
 * the top of this file). The line keeps its own ARIA values current; this
 * reads them only for the menu's limits.
 *
 * @param {HTMLElement} line a focusable element with role="separator"
 * @param {{
 *   along?: "vertical" | "horizontal",
 *   draggingClass?: string,
 *   grip?: boolean,
 *   begin?: (e: PointerEvent) => any,
 *   drag: (start: any, ev: PointerEvent) => void,
 *   end?: (start: any, moved: boolean) => void,
 *   nudge: (dir: -1 | 1, big: boolean) => void,
 *   toEnd: (dir: -1 | 1) => void,
 *   menu: () => object,
 * }} o
 *   `along` "vertical" for a line running down the page, which moves left and
 *     right (the default), or "horizontal".
 *   `draggingClass` set on the line while it is dragged (it shows its hairline).
 *   `grip` false where the line draws no grip, so nothing follows the pointer.
 *   `begin(e)` at a press: what the drag starts from, handed to `drag` and `end`.
 *   `drag(start, ev)` each move once the press is a drag.
 *   `end(start, moved)` when the press ends, a drag or a click.
 *   `nudge(dir, big)` an arrow key: -1 toward the start (left or up), +1
 *     toward the end; `big` with Shift.
 *   `toEnd(dir)` Home (-1) or End (+1): as far as the line goes that way.
 *   `menu()` the line's menu, `toggleLineMenu`'s options without `at` and
 *     `along`, asked for each time it opens, since names and limits change.
 * @returns {{ openMenu: (at: {x: number, y: number} | null) => void }}
 */
export function wireLine(line, o) {
  const along = o.along ?? "vertical";
  const gripVar = along === "vertical" ? "--grip-y" : "--grip-x";
  const back = along === "vertical" ? "ArrowLeft" : "ArrowUp";
  const ahead = along === "vertical" ? "ArrowRight" : "ArrowDown";

  const openMenu = (at) => toggleLineMenu(line, { ...o.menu(), at, along });

  if (o.grip !== false) {
    // The grip sits beside the pointer, at its place along the line.
    line.addEventListener("pointermove", (e) => {
      const r = line.getBoundingClientRect();
      line.style.setProperty(gripVar, `${along === "vertical" ? e.clientY - r.top : e.clientX - r.left}px`);
    });
    // Focused, it sits at the middle of the line's part inside the window.
    line.addEventListener("focus", () => {
      const r = line.getBoundingClientRect();
      const view = line.ownerDocument.defaultView;
      const mid =
        along === "vertical"
          ? (Math.max(0, r.top) + Math.min(view.innerHeight, r.bottom)) / 2 - r.top
          : (Math.max(0, r.left) + Math.min(view.innerWidth, r.right)) / 2 - r.left;
      line.style.setProperty(gripVar, `${mid}px`);
    });
  }

  line.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection
    const start = o.begin ? o.begin(e) : null;
    let moved = false;
    clickOrDrag(line, e, {
      move: (ev) => {
        moved = true;
        if (o.draggingClass) line.classList.add(o.draggingClass);
        o.drag(start, ev);
      },
      end: () => {
        if (o.draggingClass) line.classList.remove(o.draggingClass);
        o.end?.(start, moved);
      },
      click: (ev) => openMenu({ x: ev.clientX, y: ev.clientY }),
    });
  });

  line.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (isMenuKey(e)) {
      e.preventDefault();
      openMenu(null);
    } else if (e.key === back || e.key === ahead) {
      e.preventDefault();
      o.nudge(e.key === ahead ? 1 : -1, e.shiftKey);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      o.toEnd(e.key === "End" ? 1 : -1);
    }
  });

  return { openMenu };
}

/**
 * Say a line's new value through one polite live region, made once and kept
 * (a region made with the words in it is often not read). Emptied first, so
 * the same words twice are said twice.
 */
function say(doc, text) {
  if (!text) return;
  let live = doc.getElementById("deskLineSaid");
  if (!live) {
    live = make("div", "sr-only");
    live.id = "deskLineSaid";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    doc.body.append(live);
  }
  live.textContent = "";
  setTimeout(() => {
    live.textContent = text;
  }, 50);
}

/** Close a line's menu if one is open. */
export function closeLineMenu(line, refocus = false) {
  open.get(line)?.close(refocus);
}

/** Open the line's menu, or close it if it is open. Returns the menu's handle, or null when it closed one. */
export function toggleLineMenu(line, options) {
  if (open.has(line)) {
    open.get(line).close(false);
    return null;
  }
  return openLineMenu(line, options);
}

function openLineMenu(line, { label, more, less, step, reset, at, along = "vertical" }) {
  const doc = line.ownerDocument;
  const menu = make("div", "desk-pane__menu desk-line-menu");
  menu.id = `deskLineMenu${++seq}`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", label);

  let closed = false;
  let reasons = null;
  let frame = 0;
  const close = (refocus) => {
    if (closed) return;
    closed = true;
    open.delete(line);
    cancelAnimationFrame(frame);
    doc.removeEventListener("pointerdown", outside, true);
    doc.defaultView.removeEventListener("resize", away);
    reasons?.destroy();
    menu.remove();
    line.removeAttribute("aria-controls");
    if (refocus) line.focus({ preventScroll: true });
  };
  // A press on the line itself is the line's own: its click toggles.
  const outside = (e) => {
    if (!menu.contains(e.target) && !line.contains(e.target)) close(false);
  };
  // The line moves when the window does, so the menu would float away from it.
  const away = () => close(false);

  const item = (text) => {
    const b = make("button", "desk-pane__menu-item");
    b.type = "button";
    b.tabIndex = -1;
    b.setAttribute("role", "menuitem");
    b.append(make("span", "desk-title__label", text));
    menu.append(b);
    return b;
  };

  const values = () => ({
    now: parseFloat(line.getAttribute("aria-valuenow")),
    min: parseFloat(line.getAttribute("aria-valuemin")),
    max: parseFloat(line.getAttribute("aria-valuemax")),
  });
  const steps = [
    { b: item(more), dir: 1, at: "max", why: "it goes no further" },
    { b: item(less), dir: -1, at: "min", why: "it goes no further" },
  ];
  // Each step disabled at its own end, with the reason beside it.
  function sync() {
    const limit = lineLimit(values());
    for (const s of steps) {
      const off = limit === s.at;
      let hint = s.b.querySelector(".desk-title__hint");
      if (off) {
        s.b.setAttribute("aria-disabled", "true");
        if (!hint) {
          hint = make("span", "desk-title__hint", s.why);
          s.b.append(hint);
        }
      } else {
        s.b.removeAttribute("aria-disabled");
        hint?.remove();
      }
    }
    reasons?.refresh();
    // Focus on a line that just became disabled moves to the other step.
    const on = live();
    if (on.length && !on.includes(doc.activeElement) && menu.contains(doc.activeElement)) on[0].focus();
  }
  for (const s of steps) {
    s.b.addEventListener("click", () => {
      if (s.b.getAttribute("aria-disabled") === "true") return;
      step(s.dir);
      // The line's values are set when the page is placed again, a frame or
      // two after the step; then what it came to is said, since focus stays
      // in the menu and the line's own value isn't read there.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          sync();
          say(doc, line.getAttribute("aria-valuetext"));
        });
      });
    });
  }
  if (reset && (reset.shown?.() ?? true)) {
    const line_ = make("div", "desk-pane__menu-line");
    line_.setAttribute("role", "separator");
    menu.append(line_);
    item(reset.label).addEventListener("click", () => {
      close(true);
      reset.run();
    });
  }

  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];
  const live = () => items().filter((b) => b.getAttribute("aria-disabled") !== "true");
  menu.addEventListener("keydown", (e) => {
    const on = live();
    const i = on.indexOf(doc.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (on.length) on[(i + (e.key === "ArrowDown" ? 1 : on.length - 1)) % on.length].focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      if (on.length) on[e.key === "Home" ? 0 : on.length - 1].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  });
  menu.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !menu.contains(e.relatedTarget)) close(false);
  });

  doc.body.append(menu);
  reasons = describeUnavailable(menu, { id: `${menu.id}-reasons` });
  sync();

  // A key opens it beside the line's grip: the middle of the line's visible part.
  let where = at;
  if (!where) {
    const r = line.getBoundingClientRect();
    const view = doc.defaultView;
    where =
      along === "vertical"
        ? { x: r.left + r.width / 2, y: (Math.max(0, r.top) + Math.min(view.innerHeight, r.bottom)) / 2 }
        : { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 };
  }
  const view = doc.defaultView;
  const { left, top } = lineMenuPlace(where, along, menu.offsetWidth, menu.offsetHeight, {
    width: view.innerWidth,
    height: view.innerHeight,
  });
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  line.setAttribute("aria-controls", menu.id);
  doc.addEventListener("pointerdown", outside, true);
  view.addEventListener("resize", away);
  (live()[0] ?? items()[0])?.focus({ preventScroll: true });

  const handle = { close, menu };
  open.set(line, handle);
  return handle;
}

/** Enter or Space on a line opens its menu; returns true when it did. */
export function isMenuKey(e) {
  return e.key === "Enter" || e.key === " ";
}
