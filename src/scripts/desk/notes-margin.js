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
//
// The same margin serves a glossary entry's or an article's own text (N11,
// provisional; decision 9 under "the margin switch"): the page's `source`
// (note-sources.js) says what the notes sit beside and how each is found.
//
// The change notice (change-notice.js) is shown here too. A note in full
// whose wording has changed carries a small flag beside Edit; a note in a
// circle gets a badge and the same words in its name and its popover; and a
// highlight whose wording has changed gets a flag of its own in the margin,
// like a bookmark's red mark, level with the first line where it is drawn
// today (only while highlights are shown, and only where the margin has room:
// the Notebook's lists name it anyway). Each opens the card. Nothing is
// written until the reader chooses Keep or Delete there.

import { recordReference } from "../../lib/desk-store-core.mjs";
import {
  CIRCLE,
  CIRCLE_GAP,
  CIRCLE_INSET,
  NOTE_GAP,
  RIBBON,
  RIBBON_LANE,
  STACK_GAP,
  notesInTheWay,
  circlesPerRow,
  layoutCircles,
  layoutFull,
  marginMode,
  noteOpening,
  noteWidth,
  popoverPlace,
} from "../../lib/desk-notes.mjs";
import { closePanel, currentPanel, showPanel } from "../lit-panel.js";
import { changedGlyph, drawnNotices, markName, noticeFor, noticesFor, openNotice } from "./change-notice.js";
import { glyph } from "./glyphs.js";
import { SETTINGS_EVENT, getSetting, highlightSetting } from "./note-settings.js";

const LIT = "desk-note-words";
const supportsHighlight = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A highlight's flag in the margin: wide enough to read as a mark beside a
// bookmark's (RIBBON), with RIBBON_LANE between lanes. Its hit area is
// widened in desk.css.
const FLAG = 18;

/**
 * @param {{ store: object, source: object | null,
 *   onEdit: (record: object, trigger: Element, restoreFocus?: Element) => void,
 *   ctx?: () => { client: string, contentVersion: string },
 *   showInText?: { can(record: object): boolean, go(record: object): void } | null }} options
 *   `source` is the page's, from note-sources.js; null where the page has no
 *   margin notes. `ctx` and `showInText` are what the change notice's card
 *   needs (change-notice.js).
 * @returns {{ reveal(id: string): void, canReveal(record: object): boolean } | null}
 */
export function createNotesMargin({ store, source, onEdit, ctx = null, showInText = null }) {
  if (!store || !source) return null;
  const textBox = source.textBox;

  const aside = document.createElement("aside");
  aside.className = "desk-notes";
  aside.setAttribute("aria-label", "My notes");
  aside.setAttribute("data-desk-notes-margin", "");
  document.body.append(aside);

  let notes = []; // this chapter's note records
  let bookmarks = []; // and its bookmarks
  let highlights = []; // and its highlights, which get a flag when their wording has changed
  let mode = "none";
  const open = new Set(); // kept open by a click, for this visit
  const hover = new Set(); // hovered or focused
  const flash = new Set(); // briefly marked after "go to"
  let popId = null;
  let afterDraw = null; // focus to place once the next drawing is done

  /* ── Reading the notebook ─────────────────────────────────────────── */

  async function load() {
    ({ notes, bookmarks, highlights = [] } = await source.load(store));
    schedule();
  }

  /** Each note (or bookmark) with its words as a live Range, in today's text; lost ones are left out. */
  function placed(records = notes) {
    return source.placed(records);
  }

  /* ── Drawing ─────────────────────────────────────────────────────── */

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function draw() {
    const focused = aside.contains(document.activeElement) ? document.activeElement : null;
    const focusedId = focused?.closest("[data-id]")?.dataset.id;
    const focusSel = focused?.classList.contains("desk-circle")
      ? ".desk-circle"
      : focused?.classList.contains("desk-flag")
        ? ".desk-flag"
        : ".desk-note__toggle";
    aside.replaceChildren();
    const notesOn = getSetting("notes") === "on" && notes.length > 0;
    // A highlight whose wording has changed is flagged while highlights are
    // shown, wherever it is drawn today (a lost one is not drawn).
    const flagged =
      highlights.length && getSetting(highlightSetting()) === "on" ? drawnNotices(highlights) : [];
    const box = textBox.getBoundingClientRect();
    mode = notesOn || flagged.length ? marginMode(box.left) : "none";
    const lineHeight = parseFloat(getComputedStyle(source.lineEl()).lineHeight) || 30;
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
    // The marks standing in the notes' column, each with its top and the lane
    // it is in: lane 0 is nearest the text, and a flag whose line a bookmark
    // (or another flag) already holds takes the next lane out. A note in full
    // that one is in the way of contracts to clear the outermost.
    const spots = [];
    if ((marks.length || flagged.length) && mode !== "circles" && box.left >= RIBBON + 12) {
      const right = box.left >= NOTE_GAP + RIBBON + 8 ? NOTE_GAP : 6;
      for (const { record, range } of marks) {
        const mark = ribbon(record);
        const top = lineTop(range) + (lineHeight - RIBBON) / 2;
        spots.push({ top, lane: 0 });
        mark.style.top = `${top}px`;
        mark.style.left = `${box.left + sx - right - RIBBON}px`;
      }
      // Where there is no margin at all ("none") there is no flag.
      if (mode === "full") {
        for (const { record, range } of flagged) {
          const top = lineTop(range) + (lineHeight - FLAG) / 2;
          let lane = 0;
          while (spots.some((s) => s.lane === lane && Math.abs(s.top - top) < FLAG)) lane++;
          spots.push({ top, lane });
          const flag = flagElement(record);
          flag.style.top = `${top}px`;
          flag.style.left = `${box.left + sx - right - FLAG - lane * RIBBON_LANE}px`;
        }
      }
    }

    aside.hidden = mode === "none" && !aside.childElementCount;
    if (mode === "none") {
      if (popId) closePanel();
      syncLit();
      return;
    }
    const items = notesOn ? placed() : [];
    const noticed = noticesFor(items.map((p) => p.record));

    if (mode === "full") {
      const width = noteWidth(box.left, box.width);
      const left = box.left + sx - NOTE_GAP - width;
      const els = items.map(({ record }) => {
        const el = noteElement(record, noticed.get(record.id));
        el.style.left = `${left}px`;
        el.style.width = `${width}px`;
        aside.append(el);
        return el;
      });
      const byId = new Map(els.map((el) => [el.dataset.id, el]));
      const noteLine = parseFloat(getComputedStyle(els[0] ?? aside).lineHeight) || 22;
      // A flagged note's foot (its flag, and Edit beside it) is always there,
      // under the words, so it counts toward the note's height.
      const footOf = (el) => el.querySelector(".desk-note__foot")?.offsetHeight ?? 0;
      const wholeHeight = (el) => el.querySelector(".desk-note__toggle").scrollHeight + footOf(el);
      // layoutFull knows nothing of a flag's foot, which a flagged note
      // always shows under its first line. Where that foot would run into the
      // note below, the note below starts lower, and what is cut is worked
      // out again from the room that leaves.
      const clearFeet = (laid) => {
        const out = laid.map((l) => ({ ...l }));
        const least = (l) => noteLine + footOf(byId.get(l.id));
        for (let i = 0; i + 1 < out.length; i++) {
          out[i + 1].y = Math.max(out[i + 1].y, out[i].y + least(out[i]) + STACK_GAP);
        }
        out.forEach((l, i) => {
          const room = i + 1 < out.length ? out[i + 1].y - l.y - STACK_GAP : Infinity;
          l.cut = wholeHeight(byId.get(l.id)) > room + 0.5;
          l.maxHeight = l.cut ? Math.max(room, least(l)) : null;
        });
        return out;
      };
      const lay = () =>
        clearFeet(
          layoutFull(
            items.map(({ record, range }, i) => ({
              id: record.id,
              top: lineTop(range),
              lineHeight,
              noteLine,
              height: wholeHeight(els[i]),
            })),
          ),
        );
      let laid = lay();
      // A note a bookmark's mark (or a highlight's flag) is in the way of
      // contracts at its text-side edge to clear it, never moving; the rest
      // keep the margin's whole width. Contracting can lengthen a note, so it
      // is laid out again.
      if (spots.length) {
        const shown = laid.map((l) => ({
          id: l.id,
          y: l.y,
          height: l.cut && !open.has(l.id) ? l.maxHeight : wholeHeight(byId.get(l.id)),
        }));
        const clear = new Map(); // id -> how far it contracts
        const outermost = Math.max(...spots.map((s) => s.lane));
        for (let lane = 0; lane <= outermost; lane++) {
          const tops = spots.filter((s) => s.lane >= lane).map((s) => s.top);
          for (const id of notesInTheWay(shown, tops)) clear.set(id, RIBBON_LANE * (lane + 1));
        }
        for (const [id, by] of clear) byId.get(id).style.width = `${width - by}px`;
        if (clear.size) laid = lay();
      }
      for (const l of laid) {
        const el = byId.get(l.id);
        el.style.top = `${l.y - 3}px`;
        if (l.cut) {
          // The last line that shows fades out, so a cut note never reads as
          // whole (BVJ, 2026-10-07): downward over that line when two or
          // more fit, and toward its end when only one does, since fading a
          // single line downward leaves nothing legible. The box holds its
          // top padding too. A flagged note cuts its words alone (the
          // toggle), so the flag under them stays in view.
          const pad = 3;
          const foot = footOf(el);
          const lines = Math.max(1, Math.floor((l.maxHeight - foot) / noteLine));
          const above = foot ? 0 : pad;
          const mask =
            lines === 1
              ? "linear-gradient(to right, #000 55%, transparent 96%)"
              : `linear-gradient(to bottom, #000 ${above + (lines - 1) * noteLine}px, transparent ${above + lines * noteLine}px)`;
          el.classList.add("desk-note--cut");
          el.style.setProperty("--desk-note-max", `${above + lines * noteLine}px`);
          el.style.setProperty("--desk-note-mask", mask);
        }
      }
    } else {
      // Bookmarks take their places in the circles' rows, so the two never
      // collide; each draws as its red mark, centred in its place. So does a
      // highlight's flag.
      const perRow = circlesPerRow(box.left - 8);
      const all = [...items, ...marks, ...flagged];
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
        if (record.kind === "highlight") {
          const flag = flagElement(record);
          flag.style.top = `${l.y + (CIRCLE - FLAG) / 2}px`;
          flag.style.left = `${x + (CIRCLE - FLAG) / 2}px`;
          continue;
        }
        const el = circleElement(record, noticed.get(record.id));
        el.style.top = `${l.y}px`;
        el.style.left = `${x}px`;
        aside.append(el);
      }
    }

    if (focusedId) {
      const id = CSS.escape(focusedId);
      aside.querySelector(`[data-id="${id}"]${focusSel}, [data-id="${id}"] ${focusSel}`)?.focus({ preventScroll: true });
    }
    if (afterDraw) {
      const place = afterDraw;
      afterDraw = null;
      place();
    }
    syncLit();
  }

  function refOf(r) {
    return recordReference(r);
  }

  function noteElement(r, notice = null) {
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
    el.append(toggle);
    if (notice) {
      // Its wording has changed: a flag under the words, with Edit beside it
      // (change-notice.js). The flag is always shown; Edit still waits for
      // hover or focus.
      el.classList.add("desk-note--flagged");
      const flag = document.createElement("button");
      flag.type = "button";
      flag.className = "desk-flag desk-flag--inline";
      flag.setAttribute("aria-haspopup", "dialog");
      flag.setAttribute("aria-label", `The wording changed under my note on ${refOf(r)}. Review`);
      flag.innerHTML = `${changedGlyph()}<span class="desk-flag__text" aria-hidden="true">Wording changed</span>`;
      const foot = document.createElement("div");
      foot.className = "desk-note__foot";
      foot.append(flag, edit);
      el.append(foot);
    } else {
      el.append(edit);
    }
    return el;
  }

  function circleElement(r, notice = null) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-circle";
    b.dataset.id = r.id;
    b.setAttribute("aria-expanded", String(popId === r.id));
    // A dot on the circle says its wording has changed; the name says it in
    // words, so it is not told by the dot alone.
    const name = noteOpening(r, refOf(r)).replace(/:\s*$/, "");
    b.setAttribute("aria-label", notice ? `${name}, the wording changed` : name);
    if (notice) b.classList.add("desk-circle--changed");
    b.innerHTML = glyph(r.marker);
    return b;
  }

  /** A highlight whose wording has changed, as a mark in the margin: the changed glyph, alone. */
  function flagElement(r) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-flag desk-flag--mark";
    b.dataset.id = r.id;
    b.setAttribute("aria-haspopup", "dialog");
    const label = `${markName(r)} on ${refOf(r)}: the wording changed. Review`;
    b.setAttribute("aria-label", label);
    b.title = `The wording changed under this ${markName(r).toLowerCase()}. Review`;
    b.innerHTML = changedGlyph();
    aside.append(b);
    return b;
  }

  /** Open a record's change notice beside the flag that asked, and look after focus after. */
  function review(record, trigger) {
    if (!ctx) return;
    openNotice(trigger, record, {
      store,
      ctx,
      showInText,
      restoreFocus: trigger,
      onDone: (what) => {
        if (what === "show") return;
        // The flag may be gone now (Keep), and the aside is drawn again: put
        // focus back on the note's words, or on a highlight's verse number.
        if (record.kind === "highlight") {
          document.getElementById(`v${record.verse}`)?.focus({ preventScroll: true });
        } else if (what === "keep") {
          afterDraw = () =>
            aside
              .querySelector(`[data-id="${CSS.escape(record.id)}"] .desk-note__toggle, .desk-circle[data-id="${CSS.escape(record.id)}"]`)
              ?.focus({ preventScroll: true });
        }
      },
    });
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
    const flag = t.closest(".desk-flag");
    if (flag) {
      e.stopPropagation();
      const flagged = notes.find((r) => r.id === id) ?? highlights.find((r) => r.id === id);
      if (flagged) review(flagged, flag);
      return;
    }
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
    // Its wording has changed: "Wording changed · Review" opens the card in
    // place of this popover. Stopped here, so the click isn't taken for one
    // outside the card (this button leaves the page with the popover).
    const notice = ctx ? noticeFor(record) : null;
    if (notice) {
      const flag = document.createElement("button");
      flag.type = "button";
      flag.className = "desk-flag desk-flag--row desk-note-pop__flag";
      flag.setAttribute("aria-haspopup", "dialog");
      flag.innerHTML = `${changedGlyph()}<span class="desk-flag__text">Wording changed<span class="sr-only">.</span><span aria-hidden="true"> · </span>Review<span class="sr-only"> my note on ${escapeHtml(ref)}</span></span>`;
      flag.addEventListener("click", (e) => {
        e.stopPropagation();
        review(record, circle);
      });
      pop.querySelector(".desk-note-pop__foot").before(flag);
    }
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

  /** Whether `reveal` can take the reader to this record here: a note on this page. */
  const canReveal = (r) => source.owns(r);

  return { reveal, canReveal };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
