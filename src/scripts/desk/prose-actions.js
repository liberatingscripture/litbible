// src/scripts/desk/prose-actions.js
//
// "Yours" on a glossary entry or an article (STUDY-DESK.md N11, provisional,
// 2026-10-08): the ways to start a note on their own text, which the
// scripture's menus (actions.js) don't reach.
//   - Selecting words inside an article's text opens a small panel beside
//     the selection with "Add a note", which quotes them. (On the glossary
//     the selection panel is every reader's, glossary-selection.js, and the
//     desk adds the same "Yours" row to it.) It
//     follows the selection panel's ways (chapter-tools.js): it opens once
//     the selection settles, so the click that ends a mouse selection can't
//     close it; it never takes focus; pressing its button doesn't clear the
//     selection; and the button acts on the words as they were when the panel
//     opened. It closes when the selection goes.
//   - A note on a whole glossary entry is "Note on this entry", beside "Add
//     a note" in the glossary's selection panel; an article's is in the
//     Notebook panel's My Notes ("Add a note on this article").
// Both open the ordinary note editor (note-editor.js) with the entry or
// article as the note's target.

import { rangeToOffsets } from "../../lib/desk-anchor-dom.mjs";
import { proseAnchorText, proseQuote } from "../../lib/desk-prose-anchor.mjs";
import { closePanel, currentPanel, showPanel } from "../lit-panel.js";
import { prosePage } from "./note-sources.js";

const KIND = "desk-prose-selection";
const SETTLE_MS = 250;

/**
 * @param {{ store: object | null, addNote: (draft: object, trigger: Element | Range) => void }} options
 */
export function initProseActions({ store, addNote }) {
  const page = store ? prosePage() : null;
  if (!page || !page.targets.length) return;

  /* ── A selection inside an entry's or article's text ───────────────── */

  // On the glossary the selection panel is every reader's
  // (glossary-selection.js: Copy entry text, Copy entry link), and the desk
  // adds its row to it through lit:panel-actions, as it does in scripture.
  if (page.kind === "glossary") {
    document.addEventListener("lit:panel-actions", (e) => {
      const d = e.detail;
      if (d?.view !== "glossary" || !d.range || !d.entry) return;
      const t = page.targets.find((x) => x.id === d.entry.id);
      if (!t) return;
      const text = proseAnchorText(t.root);
      const offsets = rangeToOffsets(text, d.range);
      if (!offsets) return;
      const quote = proseQuote(text, offsets[0], offsets[1]);
      const range = d.range.cloneRange();
      const heading = document.createElement("p");
      heading.className = "lit-panel__subheading";
      heading.textContent = "Yours";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "lit-panel__btn";
      add.textContent = "Add a note";
      add.addEventListener("click", () => {
        d.acting?.();
        closePanel();
        addNote({ glossaryEntry: t.id, targetTitle: t.title, quote }, range);
      });
      // A note on the whole entry, which sits level with its heading. Here
      // rather than as a button in the heading, which took room from the
      // heading and split it across more lines (BVJ, 2026-10-09).
      const whole = document.createElement("button");
      whole.type = "button";
      whole.className = "lit-panel__btn";
      whole.textContent = "Note on this entry";
      whole.addEventListener("click", () => {
        d.acting?.();
        closePanel();
        addNote({ glossaryEntry: t.id, targetTitle: t.title }, range);
      });
      const row = document.createElement("div");
      row.className = "lit-panel__row lit-panel__row--halves";
      row.append(add, whole);
      d.append(heading);
      d.append(row);
    });
  }

  let shownFor = null; // "target id|start|end" of the open panel

  /** The target whose text holds the whole selection, with the selection's range. */
  function selected() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount !== 1 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || el.closest("input, textarea, [contenteditable], [data-desk-dock]")) return null;
    const target = page.targets.find((t) => t.root.contains(range.startContainer) && t.root.contains(range.endContainer));
    return target ? { target, range } : null;
  }

  function settle() {
    const open = currentPanel();
    const ours = open?.kind === KIND;
    const pick = selected();
    if (!pick) {
      if (ours) closePanel();
      shownFor = null;
      return;
    }
    if (open && !ours) return; // another panel has the screen
    const text = proseAnchorText(pick.target.root);
    const offsets = rangeToOffsets(text, pick.range);
    if (!offsets) return;
    const key = `${pick.target.type}:${pick.target.id}|${offsets[0]}|${offsets[1]}`;
    if (ours && key === shownFor) return;
    show(pick.target, pick.range.cloneRange(), proseQuote(text, offsets[0], offsets[1]), key);
  }

  function show(target, range, quote, key) {
    const panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Your actions for the selected words");
    panel.classList.add("lit-panel--menu", "desk-prose-pick");
    const heading = document.createElement("p");
    heading.className = "lit-panel__subheading";
    heading.textContent = "Yours";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "lit-panel__btn";
    add.textContent = "Add a note";
    panel.append(heading, add);
    // Pressing a button would otherwise clear the selection first.
    panel.addEventListener("mousedown", (e) => e.preventDefault());
    add.addEventListener("click", () => {
      closePanel();
      shownFor = null;
      addNote({ [target.type]: target.id, targetTitle: target.title, quote }, range);
    });
    showPanel(range, panel, {
      sheet: false,
      extra: { kind: KIND },
      onClose: () => {
        shownFor = null;
      },
    });
    shownFor = key;
  }

  // An article's selection has no panel of its own, so the desk shows one.
  if (page.kind === "article") {
    let timer = 0;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    document.addEventListener("selectionchange", later);
    document.addEventListener("pointerup", later);
    document.addEventListener("keyup", later);
  }
}
