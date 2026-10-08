// src/scripts/desk/notes-margin.js
//
// The reader's notes in Study View's left margin, "like pencil in a printed
// Bible" (STUDY-DESK.md, placement 2; the details BVJ settled 2026-10-07 are
// under "Decisions": the margin switch, and the margin notes' look). The
// rules are in src/lib/desk-notes.mjs; this file measures the page and draws.
//
// What it must never do is add text to the scripture: Copy text, the handout
// and the anchor reader all read the verses off the page. The notes live in
// one <aside> at the end of <body> (outside the scripture's reading order,
// audit C24), positioned beside the text, and the words a note hangs on are
// lit with the CSS Custom Highlight API, which marks text without touching it.
//
// For a screen reader, each note opens with the words it hangs on, hidden
// from view ("My note on ‘nothing is now a verdict’, Romans 8:1: ").

import { offsetsToRange } from "../../lib/desk-anchor-dom.mjs";
import { placeRecord } from "../../lib/desk-records.mjs";
import { forChapter, recordReference } from "../../lib/desk-store-core.mjs";
import {
  CIRCLE,
  CIRCLE_GAP,
  CIRCLE_INSET,
  NOTE_GAP,
  EDGE,
  RIBBON,
  roomForMarks,
  circlesPerRow,
  layoutCircles,
  layoutFull,
  marginMode,
  noteOpening,
  noteWidth,
  popoverPlace,
} from "../../lib/desk-notes.mjs";
import { closePanel, currentPanel, showPanel } from "../lit-panel.js";
import { glyph } from "./glyphs.js";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";
import { chapterBlocks, chapterText, pageChapter } from "./page.js";

const LIT = "desk-note-words";
const supportsHighlight = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {{ store: object, onEdit: (record: object, trigger: Element, restoreFocus?: Element) => void }} options
 * @returns {{ reveal(id: string): void } | null}
 */
export function createNotesMargin({ store, onEdit }) {
  const here = pageChapter();
  const textBox = document.querySelector(".chapter-paragraphs");
  if (!store || !here || !textBox) return null;

  const aside = document.createElement("aside");
  aside.className = "desk-notes";
  aside.setAttribute("aria-label", "My notes");
  aside.setAttribute("data-desk-notes-margin", "");
  document.body.append(aside);

  let notes = []; // this chapter's note records
  let bookmarks = []; // and its bookmarks
  let mode = "none";
  const open = new Set(); // kept open by a click, for this visit
  const hover = new Set(); // hovered or focused
  const flash = new Set(); // briefly marked after "go to"
  let popId = null;

  /* ── Reading the notebook ─────────────────────────────────────────── */

  async function load() {
    const records = await store.byChapter(here.bookKey, here.chapter);
    const mine = forChapter(records, here.bookKey, here.chapter);
    notes = mine.filter((r) => r.kind === "note");
    bookmarks = mine.filter((r) => r.kind === "bookmark");
    schedule();
  }

  /** Each note (or bookmark) with its words as a live Range, in today's text; lost ones are left out. */
  function placed(records = notes) {
    const text = chapterText();
    const out = [];
    for (const r of records) {
      const at = placeRecord(text, r);
      if (at.status === "lost" || at.start == null) continue;
      const pts = offsetsToRange(text, at.start, at.end);
      if (!pts) continue;
      const range = document.createRange();
      range.setStart(pts.startContainer, pts.startOffset);
      range.setEnd(pts.endContainer, pts.endOffset);
      out.push({ record: r, range });
    }
    return out;
  }

  /* ── Drawing ─────────────────────────────────────────────────────── */

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function draw() {
    const focusedId = aside.contains(document.activeElement)
      ? document.activeElement.closest("[data-id]")?.dataset.id
      : null;
    const wasCircle = document.activeElement?.classList?.contains("desk-circle");
    aside.replaceChildren();
    const shown = getSetting("notes") === "on" && notes.length > 0;
    const box = textBox.getBoundingClientRect();
    mode = shown ? marginMode(box.left) : "none";
    const firstBlock = chapterBlocks()[0];
    const lineHeight = parseFloat(getComputedStyle(firstBlock?.querySelector("p") ?? firstBlock ?? textBox).lineHeight) || 30;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const lineTop = (range) => {
      const r = range.getClientRects()[0] ?? range.getBoundingClientRect();
      return r.top + sy;
    };

    // Bookmarks have their own switch, "My bookmarks"; "My notes" leaves them be.
    // Outside the circles' rows, each is right-aligned in the notes' column
    // (or, where there's no room for that, just clear of the text).
    const marks = getSetting("bookmarks") === "on" ? placed(bookmarks) : [];
    const ribbon = (record) => {
      const mark = document.createElement("span");
      mark.className = "desk-ribbon";
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", `Bookmark, ${refOf(record)}`);
      mark.title = `Bookmark, ${refOf(record)}`;
      mark.innerHTML = glyph("bookmark", "desk-ribbon__glyph");
      aside.append(mark);
      return mark;
    };
    const markTops = [];
    if (marks.length && mode !== "circles" && box.left >= RIBBON + 12) {
      const right = box.left >= NOTE_GAP + RIBBON + 8 ? NOTE_GAP : 6;
      for (const { record, range } of marks) {
        const mark = ribbon(record);
        const top = lineTop(range) + (lineHeight - RIBBON) / 2;
        markTops.push(top);
        mark.style.top = `${top}px`;
        mark.style.left = `${box.left + sx - right - RIBBON}px`;
      }
    }

    aside.hidden = mode === "none" && !aside.childElementCount;
    if (mode === "none") {
      if (popId) closePanel();
      syncLit();
      return;
    }
    const items = placed();

    if (mode === "full") {
      const width = noteWidth(box.left);
      const left = box.left + sx - NOTE_GAP - width;
      const els = items.map(({ record }) => {
        const el = noteElement(record);
        el.style.left = `${left}px`;
        el.style.width = `${width}px`;
        aside.append(el);
        return el;
      });
      const byId = new Map(els.map((el) => [el.dataset.id, el]));
      const noteLine = parseFloat(getComputedStyle(els[0] ?? aside).lineHeight) || 22;
      const lay = () =>
        layoutFull(
          items.map(({ record, range }, i) => ({
            id: record.id,
            top: lineTop(range),
            lineHeight,
            noteLine,
            height: els[i].querySelector(".desk-note__toggle").scrollHeight,
          })),
        );
      let laid = lay();
      // A note a bookmark's mark is in the way of moves left to clear it,
      // narrowing only by what the margin can't spare; the rest keep their
      // width. Narrowing can lengthen a note, so it is laid out again.
      if (markTops.length) {
        const shown = laid.map((l) => ({
          id: l.id,
          y: l.y,
          height: l.cut && !open.has(l.id) ? l.maxHeight : byId.get(l.id).querySelector(".desk-note__toggle").scrollHeight,
        }));
        const room = roomForMarks(shown, markTops, { spare: box.left - NOTE_GAP - width - EDGE });
        for (const [id, { shift, narrow }] of room) {
          const el = byId.get(id);
          el.style.left = `${left - shift}px`;
          el.style.width = `${width - narrow}px`;
        }
        if (room.size) laid = lay();
      }
      for (const l of laid) {
        const el = byId.get(l.id);
        el.style.top = `${l.y - 3}px`;
        if (l.cut) {
          // The last line that shows fades out, so a cut note never reads as
          // whole (BVJ, 2026-10-07): downward over that line when two or
          // more fit, and toward its end when only one does, since fading a
          // single line downward leaves nothing legible. The box holds its
          // top padding too.
          const pad = 3;
          const lines = Math.max(1, Math.floor(l.maxHeight / noteLine));
          const mask =
            lines === 1
              ? "linear-gradient(to right, #000 55%, transparent 96%)"
              : `linear-gradient(to bottom, #000 ${pad + (lines - 1) * noteLine}px, transparent ${pad + lines * noteLine}px)`;
          el.classList.add("desk-note--cut");
          el.style.setProperty("--desk-note-max", `${pad + lines * noteLine}px`);
          el.style.setProperty("--desk-note-mask", mask);
        }
      }
    } else {
      // Bookmarks take their places in the circles' rows, so the two never
      // collide; each draws as its red mark, centred in its place.
      const perRow = circlesPerRow(box.left - 8);
      const all = [...items, ...marks];
      const laid = layoutCircles(
        all.map(({ record, range }) => ({ id: record.id, top: lineTop(range), lineHeight })),
        { perRow },
      );
      const recById = new Map(all.map(({ record }) => [record.id, record]));
      for (const l of laid) {
        const record = recById.get(l.id);
        const x = box.left + sx - CIRCLE_INSET - CIRCLE - l.slot * (CIRCLE + CIRCLE_GAP);
        if (record.kind === "bookmark") {
          const mark = ribbon(record);
          mark.style.top = `${l.y + (CIRCLE - RIBBON) / 2}px`;
          mark.style.left = `${x + (CIRCLE - RIBBON) / 2}px`;
          continue;
        }
        const el = circleElement(record);
        el.style.top = `${l.y}px`;
        el.style.left = `${x}px`;
        aside.append(el);
      }
    }

    if (focusedId) {
      const sel = wasCircle ? ".desk-circle" : ".desk-note__toggle";
      aside.querySelector(`[data-id="${CSS.escape(focusedId)}"]${wasCircle ? "" : " "}${sel}`)?.focus({ preventScroll: true });
    }
    syncLit();
  }

  function refOf(r) {
    return recordReference(r);
  }

  function noteElement(r) {
    const el = document.createElement("div");
    el.className = "desk-note";
    el.dataset.id = r.id;
    if (open.has(r.id)) el.classList.add("desk-note--open");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "desk-note__toggle";
    toggle.setAttribute("aria-expanded", String(open.has(r.id)));
    toggle.innerHTML = glyph(r.marker, "desk-glyph desk-note__glyph");
    const text = document.createElement("span");
    text.className = "desk-note__text";
    const opening = document.createElement("span");
    opening.className = "sr-only";
    opening.textContent = noteOpening(r, refOf(r));
    text.append(opening, document.createTextNode(r.body));
    toggle.append(text);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "desk-note__edit";
    edit.innerHTML = `Edit<span class="sr-only"> my note on ${escapeHtml(refOf(r))}</span>`;
    el.append(toggle, edit);
    return el;
  }

  function circleElement(r) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-circle";
    b.dataset.id = r.id;
    b.setAttribute("aria-expanded", String(popId === r.id));
    b.setAttribute("aria-label", noteOpening(r, refOf(r)).replace(/:\s*$/, ""));
    b.innerHTML = glyph(r.marker);
    return b;
  }

  /* ── The words a note hangs on ───────────────────────────────────── */

  function syncLit() {
    if (!supportsHighlight) return;
    const ids = new Set([...hover, ...open, ...flash, ...(popId ? [popId] : [])]);
    if (!ids.size || getSetting("notes") !== "on") {
      CSS.highlights.delete(LIT);
      return;
    }
    const ranges = placed().filter((p) => ids.has(p.record.id)).map((p) => p.range);
    if (ranges.length) CSS.highlights.set(LIT, new Highlight(...ranges));
    else CSS.highlights.delete(LIT);
  }

  const idOf = (t) => (t instanceof Element ? t.closest("[data-id]")?.dataset.id : null);

  aside.addEventListener("mouseover", (e) => {
    const id = idOf(e.target);
    if (id && !hover.has(id)) {
      hover.add(id);
      syncLit();
    }
  });
  aside.addEventListener("mouseout", (e) => {
    const id = idOf(e.target);
    if (!id || idOf(e.relatedTarget) === id) return;
    hover.delete(id);
    syncLit();
  });
  aside.addEventListener("focusin", (e) => {
    const id = idOf(e.target);
    if (id) {
      hover.add(id);
      syncLit();
    }
  });
  aside.addEventListener("focusout", (e) => {
    const id = idOf(e.target);
    if (!id || idOf(e.relatedTarget) === id) return;
    hover.delete(id);
    syncLit();
  });

  aside.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const id = idOf(t);
    if (!id) return;
    const record = notes.find((r) => r.id === id);
    if (!record) return;
    if (t.closest(".desk-note__edit")) {
      e.stopPropagation();
      onEdit(record, t.closest(".desk-note"), t.closest(".desk-note__edit"));
      return;
    }
    if (t.closest(".desk-note__toggle")) {
      const el = t.closest(".desk-note");
      if (open.has(id)) open.delete(id);
      else open.add(id);
      el.classList.toggle("desk-note--open", open.has(id));
      t.closest(".desk-note__toggle").setAttribute("aria-expanded", String(open.has(id)));
      syncLit();
      return;
    }
    const circle = t.closest(".desk-circle");
    if (circle) {
      e.stopPropagation();
      if (popId === id) closePanel();
      else openPopover(record, circle);
    }
  });

  // Escape folds a note kept open, when focus is on it.
  aside.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const id = idOf(e.target);
    if (!id || !open.has(id) || currentPanel()) return;
    e.stopPropagation();
    open.delete(id);
    schedule();
  });

  /* ── A circle's note, opened like a footnote ─────────────────────── */

  function openPopover(record, circle) {
    const ref = refOf(record);
    const pop = document.createElement("div");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `My note on ${ref}`);
    pop.tabIndex = -1;
    pop.className = "desk-note-pop";
    pop.innerHTML = `${glyph(record.marker, "desk-glyph desk-note__glyph")}
      <div class="desk-note-pop__text"></div>
      <div class="desk-note-pop__foot">
        <span class="desk-note-pop__ref">My note · ${escapeHtml(ref)}</span>
        <button type="button" class="desk-note__edit desk-note-pop__edit">Edit<span class="sr-only"> my note on ${escapeHtml(ref)}</span></button>
      </div>`;
    pop.querySelector(".desk-note-pop__text").textContent = record.body;
    pop.querySelector(".desk-note-pop__edit").addEventListener("click", () => {
      onEdit(record, circle, circle);
    });
    const words = placed().find((p) => p.record.id === record.id)?.range;
    showPanel(circle, pop, {
      restoreFocus: circle,
      onClose: () => {
        popId = null;
        circle.setAttribute("aria-expanded", "false");
        syncLit();
      },
      extra: { kind: "desk-note" },
      place: (el) => {
        const c = circle.getBoundingClientRect();
        const w = words?.getBoundingClientRect() ?? c;
        const { top } = popoverPlace({
          circleTop: c.top,
          words: { top: w.top, bottom: w.bottom },
          height: el.offsetHeight,
          viewBottom: window.innerHeight,
        });
        return { left: window.scrollX + Math.max(12, c.left), top: window.scrollY + top };
      },
    });
    popId = record.id;
    circle.setAttribute("aria-expanded", "true");
    syncLit();
    pop.focus({ preventScroll: true });
  }

  /* ── Going to a note from the Notebook panel ─────────────────────── */

  function reveal(id) {
    const at = placed().find((p) => p.record.id === id);
    if (!at) return;
    const r = at.range.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + r.top - window.innerHeight / 3,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
    flash.add(id);
    syncLit();
    setTimeout(() => {
      flash.delete(id);
      syncLit();
    }, 1600);
    // After the scroll settles, so the note is placed where it now is.
    setTimeout(() => {
      const holder = aside.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!holder) return;
      if (holder.classList.contains("desk-circle")) {
        openPopover(at.record, holder);
        return;
      }
      holder.classList.add("desk-note--flash");
      setTimeout(() => holder.classList.remove("desk-note--flash"), 1600);
      holder.querySelector(".desk-note__toggle")?.focus({ preventScroll: true });
    }, reducedMotion() ? 50 : 450);
  }

  /* ── Keeping up with the page ────────────────────────────────────── */

  store.subscribe(load);
  window.addEventListener("resize", schedule);
  document.addEventListener("desk:column-moved", schedule);
  document.addEventListener(SETTINGS_EVENT, schedule);
  document.fonts?.addEventListener?.("loadingdone", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(textBox);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-size", "data-leading", "data-font", "data-vn", "data-fn", "data-desk-panel"],
  });
  load();

  return { reveal };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
