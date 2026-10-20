// src/scripts/desk/footnotes-view.js
//
// The Footnotes pane's body on /desk (STUDY-DESK.md, D9; X11, "Footnotes in
// the margin": a footnotes pane following the LIT pane; "Order of work", 3e).
// The chapter's footnotes in the page's order, each with its letter, the verse
// it hangs on and its note, copied from the built Study View page so it reads
// exactly as it does there, links included (a footnote's scripture references
// still preview). The reader's verse marks its notes and brings them to the
// top of the pane's own scroll.
//
// Nothing here adds to the scripture. With a notebook (3g) each note carries
// the Pin / Unpin button it has in This verse and in Study View's Footnotes
// list (pins.js), under the note, with the flag a rewritten pinned note gets
// under that; pins.js draws the flags, since it already follows the notebook.
// The list scrolls inside the pane (its nearest scrolling ancestor), never the
// page.
//
// createFootnotesView({ idSuffix, onVerse, store }) → { el, show(source, verse) },
// where source is what loadChapterPage resolves to (chapter-page.js).

import { passageLabel } from "../../lib/desk-passage.mjs";
import { pinButton, refreshPins } from "./pins.js";

const TOP_GAP = 8; // px between the pane's top edge and the first note shown

/** The nearest ancestor that scrolls vertically, or null. */
function scroller(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if (y === "auto" || y === "scroll") return p;
  }
  return null;
}

export function createFootnotesView({ idSuffix = "", onVerse = null, store = null } = {}) {
  const el = document.createElement("section");
  el.className = "desk-fns";
  const headId = `desk-fns-title${idSuffix}`;
  el.setAttribute("aria-labelledby", headId);

  let shownKey = null; // "john 3": the chapter on screen
  let shownVerse; // the verse last marked (undefined before the first show)
  let items = []; // [{ li, verse }]

  function redraw(source, label) {
    const head = document.createElement("h3");
    head.className = "desk-fns__title";
    head.id = headId;
    head.textContent = `Footnotes on ${label}`;
    const children = [head];
    items = [];

    const none = (text) => {
      const p = document.createElement("p");
      p.className = "desk-fns__none";
      p.textContent = text;
      children.push(p);
    };

    if (source.draft) {
      none(`${label} is still being translated, so it has no footnotes yet.`);
    } else if (!source.footnotes?.length) {
      none(`${label} has no footnotes.`);
    } else {
      const list = document.createElement("ol");
      list.className = "desk-fns__list";
      for (const { id, label: letter, verse } of source.footnotes) {
        const li = document.createElement("li");
        li.className = "desk-fns__item";
        const letterEl = document.createElement("span");
        letterEl.className = "desk-fns__label";
        letterEl.textContent = letter;
        li.append(letterEl);
        if (verse && onVerse) {
          const go = document.createElement("button");
          go.type = "button";
          go.className = "desk-fns__verse";
          go.textContent = `Verse ${verse}`;
          go.setAttribute("aria-label", `Go to ${label}:${verse}`);
          go.addEventListener("click", () => onVerse(verse));
          li.append(go);
        }
        const body = source.footnoteBody(id);
        if (body) {
          const clone = body.cloneNode(true);
          clone.querySelector(".footnote-backlink")?.remove();
          clone.removeAttribute("id");
          for (const withId of clone.querySelectorAll("[id]")) withId.removeAttribute("id");
          clone.className = "desk-fns__body";
          li.append(clone);
        }
        // Pin / Unpin, as under the note in the Footnotes list.
        const pin = store ? pinButton(id, letter, { bookKey: source.bookKey, chapter: source.chapter }) : null;
        if (pin) li.append(pin);
        list.append(li);
        items.push({ li, verse });
      }
      children.push(list);
    }
    el.replaceChildren(...children);
    // The flags of notes whose pins were rewritten go under their notes.
    if (store) refreshPins();
  }

  function mark(verse) {
    for (const { li, verse: v } of items) {
      const current = verse != null && v === verse;
      li.classList.toggle("desk-fns__item--current", current);
      if (current) li.setAttribute("aria-current", "true");
      else li.removeAttribute("aria-current");
    }
  }

  function scrollTo(verse) {
    const box = scroller(el);
    if (!box) return;
    let target = null;
    if (verse != null) {
      target =
        items.find((x) => x.verse === verse) ??
        items.find((x) => x.verse != null && x.verse > verse) ??
        null;
      if (!target) return;
    }
    const top =
      target === null
        ? 0
        : box.scrollTop + (target.li.getBoundingClientRect().top - box.getBoundingClientRect().top) - TOP_GAP;
    box.scrollTop = Math.max(0, top);
  }

  function show(source, verse) {
    const v = Number.isFinite(verse) && verse > 0 ? verse : null;
    const key = `${source.bookKey} ${source.chapter}`;
    const fresh = key !== shownKey;
    if (fresh) {
      shownKey = key;
      redraw(source, passageLabel({ bookKey: source.bookKey, chapter: source.chapter }));
    }
    mark(v);
    if (fresh || v !== shownVerse) {
      shownVerse = v;
      // Not laid out until the pane is on the page: scroll once it is.
      if (el.isConnected) scrollTo(v);
      else requestAnimationFrame(() => el.isConnected && scrollTo(v));
    }
  }

  return { el, show };
}
