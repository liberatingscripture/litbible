// src/scripts/glossary-selection.js
//
// The glossary's selection panel (BVJ, 2026-10-09): selecting words in an
// entry's definition offers "Copy entry text" (the selected words, then
// "— Glossary: Flesh (LIT)" and the entry's link) and "Copy entry link", the
// way Study View's selection panel offers Copy text and Copy link for
// scripture. For every reader, not only the Study Desk's preview.
//
// It is Study View's panel in miniature and built from the same pieces
// (panel-pieces.js), so it behaves the same way:
//   - it opens once the selection settles, and with a mouse only after the
//     button comes up, so the click that ends a selection can't close it;
//   - it sits beside the selection, and the side follows the input: a mouse
//     gets the rows of a computer's menu just above the words, a finger the
//     chip layout placed clear of the phone's own Copy / Share bubble;
//   - it never takes focus, and pressing its buttons doesn't clear the
//     selection; once pressed it finishes on its own;
//   - a selection is clamped to one entry's definition and snapped out to
//     whole words, and ordinary Copy is left alone (decision 4 under
//     "Sharing a selection" in CLAUDE.md).
// The Study Desk adds its "My Notebook" row (Add a note) through the same
// `lit:panel-actions` event Study View's panels send.

import { closePanel, currentPanel, showPanel } from "./lit-panel.js";
import { copyToClipboard, menuButton, panelRow, placeBesideTouchSelection, pointerType, snapToWords, withReference } from "./panel-pieces.js";

const BODY = ".glossary-entries article.entry[data-entry] .entry-body";
const BLOCKS = "p, li, div, blockquote, h1, h2, h3, h4, h5, h6, ul, ol";
const NOT_TEXT = "button, script, style, svg, .sr-only, [data-desk-skip], sup.footnote-ref, sup.fn-ref";

/** The entry's definition holding a node, or null. */
function bodyOf(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  return el?.closest(BODY) ?? null;
}

/**
 * What a selection would share, or null when it holds no definition text:
 * clamped to the first entry it touches, snapped to whole words, and read as
 * plain text with a blank line between paragraphs.
 */
function selectionShare(selection) {
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const body = bodyOf(range.startContainer) ?? bodyOf(range.endContainer);
  if (!body) return null;
  if (!body.contains(range.startContainer)) range.setStart(body, 0);
  if (!body.contains(range.endContainer)) range.setEnd(body, body.childNodes.length);
  snapToWords(range);

  const holder = document.createElement("div");
  holder.append(range.cloneContents());
  holder.querySelectorAll(NOT_TEXT).forEach((el) => el.remove());
  holder.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  holder.querySelectorAll(BLOCKS).forEach((el) => {
    el.before("\n\n");
    el.after("\n\n");
  });
  const text = holder.textContent
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;

  const entry = body.closest("article.entry");
  const id = entry.dataset.entry;
  const title = entry.querySelector(".entries-strike strong")?.textContent.trim() || id;
  const rects = range.getClientRects();
  const rect = rects.length ? rects[0] : range.getBoundingClientRect();
  return { id, title, text, range, rect, key: `${id}|${text}` };
}

function openPanel(share, { touch }) {
  const ref = `Glossary: ${share.title}`;
  const url = `${location.origin}${location.pathname}#${share.id}`;

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `Share selected text from the ${share.title} entry`);
  panel.classList.add("lit-panel--menu", "lit-panel--selection");
  if (touch) panel.classList.add("lit-panel--chips");
  // Pressing a button would otherwise clear the selection (and move focus)
  // before the click lands.
  panel.addEventListener("mousedown", (e) => e.preventDefault());

  const heading = document.createElement("p");
  heading.className = "lit-panel__heading";
  heading.textContent = ref + " (LIT)";
  panel.appendChild(heading);

  // Once a button is pressed the panel finishes on its own ("Copied ✓"),
  // even though a tap on a phone clears the selection.
  const acting = () => {
    if (currentPanel()?.el === panel) currentPanel().acting = true;
  };

  panel.appendChild(
    panelRow(
      menuButton("Copy entry text", () => {
        acting();
        return copyToClipboard(withReference(share.text, ref) + "\n" + url);
      }),
      menuButton("Copy entry link", () => {
        acting();
        return copyToClipboard(url);
      }),
    ),
  );

  // The Study Desk's "My Notebook" row, when the desk is on (desk/prose-actions.js).
  document.dispatchEvent(
    new CustomEvent("lit:panel-actions", {
      detail: {
        panel,
        append: (node) => panel.appendChild(node),
        kind: "selection",
        view: "glossary",
        entry: { id: share.id, title: share.title },
        range: share.range,
        touch,
        acting,
      },
    }),
  );

  showPanel({ getBoundingClientRect: () => share.rect }, panel, {
    preferAbove: true,
    place: touch ? placeBesideTouchSelection(share.rect) : null,
    sheet: false,
    extra: { kind: "selection" },
  });
}

if (document.querySelector(BODY)) {
  let pointerDown = false;
  // The selection the panel was last shown for, so a dismissed panel stays
  // closed until the selection changes, and the one it was last opened for,
  // kept across gestures (see chapter-tools.js, initSelectionShare).
  let shownKey = null;
  let openedKey = null;
  let timer = null;
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 200);
  };

  document.addEventListener(
    "pointerdown",
    (e) => {
      pointerDown = true;
      if (!currentPanel()?.el.contains(e.target)) shownKey = null;
    },
    true,
  );
  const release = () => {
    pointerDown = false;
    settle();
  };
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
  document.addEventListener("selectionchange", settle);

  function update() {
    // Mid-drag with a mouse: wait for the button to come up.
    if (pointerDown && pointerType() === "mouse") return;
    const share = selectionShare(document.getSelection());
    const current = currentPanel()?.kind === "selection" ? currentPanel() : null;
    if (!share) {
      if (current && !current.acting) closePanel();
      shownKey = null;
      return;
    }
    if (share.key === shownKey) return;
    // A reference preview opened from inside a live selection was asked for;
    // the selection panel mustn't take its place back a moment later.
    if (currentPanel() && !current && share.key === openedKey) {
      shownKey = share.key;
      return;
    }
    shownKey = openedKey = share.key;
    openPanel(share, { touch: pointerType() !== "mouse" });
  }
}
