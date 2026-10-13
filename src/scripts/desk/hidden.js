// src/scripts/desk/hidden.js
//
// The hidden passage on the page (STUDY-DESK.md, N8): while a `hidden` record
// exists, the verses it covers are hidden wherever this page shows them, in
// Study View and in Read View. The rules are src/lib/desk-hidden.mjs; this
// file reads the notebook and does the hiding.
//
// What hiding is, and why it adds nothing to the scripture:
//   - Each covered verse's `data-verse` spans are blurred (CSS, desk.css),
//     made `inert` (no focus, no clicks, no selecting, and out of the
//     accessibility tree, which `aria-hidden` says too) and kept exactly the
//     size they were, so nothing on the page moves.
//   - Over the passage's first lines lies a veil, a card in one layer at the
//     end of <body> (like the margin notes) that says the passage is hidden,
//     shows the reader's note to self, and has Show and Stop hiding. It is
//     outside the scripture, so the anchor text, Copy text, the handout and
//     the verse wrapping never meet it.
//   - Screen readers hear the same in reading order: a visually hidden but
//     focusable group right before the block that holds the passage's first
//     verse, announced "Passage hidden by your note", with the same two
//     buttons, shown on focus. It sits beside the scripture's blocks and
//     carries `data-desk-passage`, so chapterBlocks() (page.js) skips it.
//
// Show is for this page view only (the record stays, so a reload hides the
// passage again); Stop hiding deletes the record, with an undo. "Hide my
// notes" (M1) keeps every passage hidden but leaves the note to self off the
// veil. A short list of where passages sit is kept in localStorage so the
// gate (desk-gate.js) can hide them in the first moments of the next page,
// before this file has read the notebook; it holds no note to self.
//
// Other code asks through `hiddenApi()`: the verse menu's guard
// (hidden-actions.js), the "This verse" tab, the margin notes and the
// interleaf, and the reference previews, which can't import desk code and so
// find the same answers through `window.litPreviewGate`.

import {
  HIDDEN_NOTICE,
  earlyCache,
  groupAt,
  hiddenRecords,
  hiddenVerses,
  passageRef,
  planHidden,
  veilText,
} from "../../lib/desk-hidden.mjs";
import { planDelete } from "../../lib/desk-store-core.mjs";
import { announce, showUndo } from "./undo-bar.js";
import { undoEntry } from "./history.js";
import { SETTINGS_EVENT, allHidden } from "./note-settings.js";
import { pageChapter, readBook } from "./page.js";

/** Sent on `document` when what is hidden, or what is shown, changes. */
export const HIDDEN_EVENT = "desk:hidden";

export const CACHE_KEY = "lit-desk-hidden-cache";

let api = null;

/** The page's hidden-passage state, or null before it is made or where the page has none. */
export function hiddenApi() {
  return api;
}

/**
 * @param {{ store: object, ctx: () => object }} options
 * @returns {object | null} the api; null off a Study View chapter and Read View
 */
export function createHidden({ store, ctx }) {
  const study = pageChapter();
  const book = study ? null : readBook();
  const textBox = study
    ? document.querySelector(".chapter-paragraphs")
    : document.querySelector("[data-rm-root] [data-rm-text]");
  if (!store || !textBox || !(study || book)) return null;
  const bookKey = study ? study.bookKey : book;

  let all = []; // every hidden record in the notebook
  const revealed = new Set(); // ids shown since this page loaded

  /* ── Where the verses are on this page ───────────────────────────── */

  const spansOf = (chapter, verse) =>
    Array.from(
      study
        ? textBox.querySelectorAll(`[data-verse="${verse}"]`)
        : textBox.querySelectorAll(`.rm-block[data-chapter="${chapter}"] [data-verse="${verse}"]`),
    );

  /** The chapters this page shows text for. */
  function pageChapters() {
    if (study) return [study.chapter];
    const set = new Set();
    for (const el of textBox.querySelectorAll(".rm-block[data-chapter]")) set.add(Number(el.dataset.chapter));
    return [...set];
  }

  /** The verse numbers a chapter has on this page. */
  function versesOnPage(chapter) {
    const set = new Set();
    const spans = study
      ? textBox.querySelectorAll("[data-verse]")
      : textBox.querySelectorAll(`.rm-block[data-chapter="${chapter}"] [data-verse]`);
    for (const el of spans) set.add(Number(el.dataset.verse));
    return [...set].sort((a, b) => a - b);
  }

  const groupsFor = (key, chapter) =>
    planHidden(all, {
      bookKey: key,
      chapter,
      verses: key === bookKey && pageChapters().includes(chapter) ? versesOnPage(chapter) : null,
      revealed,
    });

  /* ── Reading the notebook ────────────────────────────────────────── */

  let loading = 0;
  async function load() {
    const mine = ++loading;
    const records = await store.all();
    if (mine !== loading) return;
    all = hiddenRecords(records);
    // Records that are gone can't stay shown.
    const ids = new Set(all.map((r) => r.id));
    for (const id of [...revealed]) if (!ids.has(id)) revealed.delete(id);
    try {
      const cache = earlyCache(all);
      if (Object.keys(cache).length) localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      else localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
    changed();
  }

  /* ── Hiding the words ────────────────────────────────────────────── */

  function mark(el) {
    el.setAttribute("data-desk-hidden", "");
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("inert", "");
    // The gate's first-moment marks carried these inline; the stylesheet has it now.
    el.style.removeProperty("filter");
    el.style.removeProperty("user-select");
  }

  function unmark(el) {
    el.removeAttribute("data-desk-hidden");
    el.removeAttribute("aria-hidden");
    el.removeAttribute("inert");
    el.style.removeProperty("filter");
    el.style.removeProperty("user-select");
  }

  function applyMarks() {
    const want = new Set();
    for (const chapter of pageChapters()) {
      for (const verse of hiddenVerses(groupsFor(bookKey, chapter))) {
        for (const el of spansOf(chapter, verse)) want.add(el);
      }
    }
    for (const el of textBox.querySelectorAll("[data-desk-hidden]")) if (!want.has(el)) unmark(el);
    for (const el of want) mark(el);
  }

  /* ── The veil and the screen-reader control ──────────────────────── */

  const layer = document.createElement("aside");
  layer.className = "desk-veils";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  const sr = []; // the in-flow controls, kept so they can be taken out again

  function button(label, act) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-veil__button";
    b.dataset.act = act;
    b.innerHTML = label;
    return b;
  }

  /** Each button runs the same action wherever it sits. */
  function wire(root, group, chapter) {
    root.addEventListener("click", (e) => {
      const act = e.target instanceof Element ? e.target.closest("[data-act]")?.dataset.act : null;
      if (act === "show") showGroup(group, chapter, { focus: root.contains(document.activeElement) });
      else if (act === "stop") stop(group.ids, passageRef(bookKey, chapter, group.start, group.end));
    });
  }

  function veilFor(group, chapter, say) {
    const veil = document.createElement("div");
    veil.className = "desk-veil";
    veil.innerHTML = `<div class="desk-veil__row">
        <span class="desk-veil__title"></span><span class="desk-veil__ref"></span>
        <span class="desk-veil__actions"></span>
      </div>
      <p class="desk-veil__note" hidden></p>`;
    veil.querySelector(".desk-veil__title").textContent = say.title;
    veil.querySelector(".desk-veil__ref").textContent = say.ref;
    const note = veil.querySelector(".desk-veil__note");
    if (say.note) {
      // The note to self is the reader's own words: text, never HTML.
      note.hidden = false;
      note.textContent = say.note;
    }
    // Mouse users act here; the keyboard and screen readers use the control
    // in the page's own order (this layer is aria-hidden).
    const show = button("Show", "show");
    const stopBtn = button("Stop hiding", "stop");
    show.tabIndex = -1;
    stopBtn.tabIndex = -1;
    veil.querySelector(".desk-veil__actions").append(show, stopBtn);
    wire(veil, group, chapter);
    return veil;
  }

  function controlFor(group, chapter, say) {
    const el = document.createElement("div");
    el.className = "desk-passage";
    el.setAttribute("data-desk-passage", "");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", say.name);
    if (say.note) {
      const p = document.createElement("p");
      p.className = "desk-passage__note";
      p.textContent = say.note;
      el.append(p);
    }
    el.append(
      button(`Show<span class="sr-only"> ${escapeHtml(say.ref)}</span>`, "show"),
      button(`Stop hiding<span class="sr-only"> ${escapeHtml(say.ref)}</span>`, "stop"),
    );
    wire(el, group, chapter);
    return el;
  }

  /** The element of Study View's or Read View's flow that holds a passage's first verse. */
  function blockOf(span) {
    return study ? ancestorIn(span, textBox) : span.closest(".rm-block");
  }

  function drawUi() {
    for (const el of sr.splice(0)) el.remove();
    layer.replaceChildren();
    const hideNotes = allHidden();
    const box = textBox.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    for (const chapter of pageChapters()) {
      for (const group of groupsFor(bookKey, chapter)) {
        if (group.revealed || !group.verses.length) continue;
        const say = veilText(group, { bookKey, chapter, hideNotes });
        const spans = group.verses.flatMap((v) => spansOf(chapter, v));
        if (!spans.length) continue;

        const first = blockOf(spans[0]);
        if (first) {
          const control = controlFor(group, chapter, say);
          first.before(control);
          sr.push(control);
        }

        const rects = spans.flatMap((s) => Array.from(s.getClientRects())).filter((r) => r.width > 0 && r.height > 0);
        if (!rects.length) continue;
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        const veil = veilFor(group, chapter, say);
        veil.style.top = `${top + sy}px`;
        veil.style.left = `${box.left + sx}px`;
        veil.style.width = `${box.width}px`;
        // The veil never reaches past the passage into the text after it.
        veil.style.maxHeight = `${Math.max(28, bottom - top)}px`;
        layer.append(veil);
      }
    }
    layer.hidden = !layer.childElementCount;
  }

  let frame = 0;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drawUi);
  }

  /* ── Changes ─────────────────────────────────────────────────────── */

  function changed() {
    applyMarks();
    drawUi();
    document.dispatchEvent(new CustomEvent(HIDDEN_EVENT));
  }

  function showGroup(group, chapter, { focus = false } = {}) {
    for (const id of group.ids) revealed.add(id);
    changed();
    announce(`${passageRef(bookKey, chapter, group.start, group.end)} shown.`);
    if (focus && study) document.getElementById(`v${group.start}`)?.focus({ preventScroll: true });
  }

  /** Delete the records (one undoable change) and say so. */
  async function stop(ids, ref) {
    const plan = { put: [], remove: [] };
    for (const id of ids) {
      const record = await store.get(id);
      if (!record || record.kind === "trash") continue;
      const one = planDelete(record, ctx());
      plan.put.push(...one.put);
      plan.remove.push(...one.remove);
    }
    if (!plan.remove.length) return false;
    await store.commit(plan);
    const entry = store.lastEntry();
    if (entry) showUndo(`Stopped hiding ${ref}.`, () => undoEntry(entry));
    return true;
  }

  /* ── The questions the rest of the desk asks ─────────────────────── */

  const nowHidden = (key, chapter) => hiddenVerses(groupsFor(key, chapter));

  api = {
    /** Whether any verse from start to end is hidden now. */
    coversRange(key, chapter, start, end = start) {
      const set = nowHidden(key, chapter);
      for (let v = start; v <= end; v++) if (set.has(v)) return true;
      return false;
    },
    /** Whether a record on the text (a note) touches a hidden verse. */
    coversRecord(r) {
      if (!r?.bookKey || !Number.isInteger(r.verse)) return false;
      return api.coversRange(r.bookKey, r.chapter, r.verse, r.endVerse ?? r.verse);
    },
    /** The passages (shown or not) that overlap start..end. */
    passagesIn(key, chapter, start, end = start) {
      return groupsFor(key, chapter).filter((g) => g.start <= end && g.end >= start);
    },
    /** The passage a verse is in, shown or not. */
    passageAt: (key, chapter, verse) => groupAt(groupsFor(key, chapter), verse),
    /** What the veil would say for a passage, honouring "Hide my notes". */
    sayFor: (key, chapter, group) => veilText(group, { bookKey: key, chapter, hideNotes: allHidden() }),
    /** Show every hidden passage that overlaps start..end, for this page view. */
    showRange(key, chapter, start, end = start, opts) {
      const groups = groupsFor(key, chapter).filter((g) => g.start <= end && g.end >= start && !g.revealed);
      if (!groups.length) return;
      for (const g of groups) for (const id of g.ids) revealed.add(id);
      changed();
      announce(`${passageRef(key, chapter, groups[0].start, groups[groups.length - 1].end)} shown.`);
      if (opts?.focus && study) document.getElementById(`v${start}`)?.focus({ preventScroll: true });
    },
    /** Hide again what was shown, for this page view. */
    hideAgain(key, chapter, start, end = start) {
      for (const g of groupsFor(key, chapter)) {
        if (g.start <= end && g.end >= start) for (const id of g.ids) revealed.delete(id);
      }
      changed();
    },
    stop,
    notice: HIDDEN_NOTICE,
    refresh: schedule,
  };

  // Where reference previews ask (ref-preview.js can't import this): null
  // when nothing in that chapter is hidden, else which verses are and how to
  // show one.
  window.litPreviewGate = (ref) => {
    const set = nowHidden(ref.key, ref.chapter);
    if (!set.size) return null;
    return {
      hidden: (verse) => set.has(verse),
      show: (verse) => api.showRange(ref.key, ref.chapter, verse, verse),
    };
  };

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
  return api;
}

/** The ancestor of `node` that is a direct child of `parent`, or null. */
function ancestorIn(node, parent) {
  for (let n = node; n && n !== parent; n = n.parentNode) if (n.parentNode === parent) return n;
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
