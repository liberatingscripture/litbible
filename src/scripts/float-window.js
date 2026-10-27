// src/scripts/float-window.js
//
// A small window that floats over the page and stays open until the reader
// answers it or closes it. It looks like the shared panels (lit-panel.js:
// the same card, a header with a grip to drag it by, and a ×), but behaves
// differently in two ways, both on purpose:
//   - a click outside it doesn't close it, so it can stay up while the
//     reader does something else;
//   - it doesn't take the shared panels' one slot, so a footnote, a verse
//     menu, or a reference preview opening doesn't close it either.
// It is a non-modal dialog: focus moves to its title when it opens, nothing
// is trapped, and Escape inside it, or its ×, closes it.
//
// The caller places it (`place`, called again on scroll and resize until the
// reader drags it), fills `body`, and hears how it closed through
// `onClose(reason)`: "close" (the × or Escape) or whatever reason the
// caller passes to `close`. `onMoved({ left, top })` hears where a drag left
// it, for a caller that remembers the place.
//
// First used by the Study Desk's tour offer (STUDY-DESK.md, D8); the Greek
// search's commands window (greek-commands.js) is the second. Its styles are
// in global.css (.lit-window), beside the shared panels', since the search
// pages use it too.

const EDGE = 8;

let seq = 0;

/**
 * @param {{ heading: string, title: string, className?: string,
 *   attrs?: Record<string, string>,
 *   place: (el: HTMLElement) => void,
 *   onClose?: (reason: string) => void,
 *   onMoved?: (at: { left: number, top: number }) => void }} options
 *   `heading` is the small label in the header ("Notebook tour"); `title` is
 *   the window's name, its first line, which takes focus.
 */
export function createFloatWindow({ heading, title, className = "", attrs = {}, place, onClose = () => {}, onMoved = () => {} }) {
  const id = `floatWindow${++seq}`;
  const el = document.createElement("section");
  el.className = `lit-panel lit-window ${className}`.trim();
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "false");
  el.setAttribute("aria-labelledby", `${id}-title`);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);

  const header = document.createElement("div");
  header.className = "lit-panel__header lit-panel__header--drag";
  const grip = document.createElement("span");
  grip.className = "lit-panel__grip";
  grip.setAttribute("aria-hidden", "true");
  const label = document.createElement("p");
  label.className = "lit-panel__heading";
  label.textContent = heading;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "lit-panel__close";
  x.setAttribute("aria-label", "Close");
  x.textContent = "×";
  header.append(grip, label, x);

  const titleEl = document.createElement("h2");
  titleEl.className = "lit-window__title";
  titleEl.id = `${id}-title`;
  titleEl.tabIndex = -1;
  titleEl.textContent = title;

  const body = document.createElement("div");
  body.className = "lit-window__body";
  el.append(header, titleEl, body);

  let open = false;
  let dragged = false;
  // The drag in progress, if any: close() ends it without reporting a move.
  let endDrag = null;

  function clamp() {
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(EDGE, r.left), Math.max(EDGE, innerWidth - r.width - EDGE));
    const top = Math.min(Math.max(EDGE, r.top), Math.max(EDGE, innerHeight - r.height - EDGE));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function reposition() {
    if (!open) return;
    if (!dragged) place(el);
    clamp();
  }

  // Dragged by the header, as the verse menu is; once moved, it stays where
  // it was put rather than following the page.
  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    el.classList.add("lit-panel--dragging");
    const move = (ev) => {
      dragged = true;
      el.style.left = `${r.left + ev.clientX - x0}px`;
      el.style.top = `${r.top + ev.clientY - y0}px`;
      clamp();
    };
    const up = (ev, report = true) => {
      el.classList.remove("lit-panel--dragging");
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      endDrag = null;
      // A window closed mid-drag has no place left to report.
      if (report && open && dragged) {
        const at = el.getBoundingClientRect();
        onMoved({ left: at.left, top: at.top });
      }
    };
    endDrag = up;
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });

  x.addEventListener("click", () => close("close"));
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close("close");
  });

  function show({ focus = true } = {}) {
    if (open) return;
    open = true;
    dragged = false;
    document.body.append(el);
    reposition();
    addEventListener("resize", reposition);
    addEventListener("scroll", reposition, { passive: true });
    if (focus) titleEl.focus({ preventScroll: true });
  }

  function close(reason = "close") {
    if (!open) return;
    open = false;
    if (endDrag) endDrag(null, false);
    removeEventListener("resize", reposition);
    removeEventListener("scroll", reposition);
    el.remove();
    onClose(reason);
  }

  return { el, body, title: titleEl, show, close, reposition, isOpen: () => open };
}
