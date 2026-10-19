// src/scripts/desk/passage-bar.js
//
// The passage picker at the top of a following pane on /desk (STUDY-DESK.md,
// D9; "Order of work", 3d): the passage the pane shows, which the reader can
// type over ("John 3:16", "Rom 8", "jn 3.16", read by search-core.js's
// parseReference, the search box's own reader), and the previous and next
// chapter, across the books.
//
// BVJ, 2026-10-19 (option A): until the LIT pane comes (3e), This verse and
// Greek panes that aren't pinned share one passage, so changing it here moves
// them all; a pinned pane's picker moves only that pane. Where the passage is
// kept is desk-page.js's business; this only asks for a change.

import { parseReference } from "../search-core.js";
import { checkPassage, passageLabel, stepChapter } from "../../lib/desk-passage.mjs";

const ICON_PREV = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M15 6l-6 6 6 6" /></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M9 6l6 6-6 6" /></svg>`;

/**
 * @param {{ id: string, set: (passage: object) => void }} options
 *   `id` keeps the field's id apart from other panes'.
 * @returns {{ el: HTMLElement, update: (passage: object) => void }}
 */
export function createPassageBar({ id, set }) {
  const el = document.createElement("form");
  el.className = "desk-passage";
  el.setAttribute("role", "search");
  el.setAttribute("aria-label", "Passage");
  el.noValidate = true;
  el.innerHTML = `
    <button type="button" class="desk-passage__step" data-step="-1">${ICON_PREV}</button>
    <label class="sr-only" for="deskPassage-${id}">Passage</label>
    <input type="text" class="desk-passage__field" id="deskPassage-${id}" autocomplete="off"
      spellcheck="false" enterkeyhint="go" aria-describedby="deskPassageError-${id}" />
    <button type="button" class="desk-passage__step" data-step="1">${ICON_NEXT}</button>
    <p class="desk-passage__error" id="deskPassageError-${id}" role="alert" hidden></p>`;
  const field = el.querySelector(".desk-passage__field");
  const error = el.querySelector(".desk-passage__error");
  const steps = Array.from(el.querySelectorAll(".desk-passage__step"));

  let current = null;

  function say(message) {
    error.hidden = !message;
    error.textContent = message ?? "";
    field.setAttribute("aria-invalid", String(Boolean(message)));
  }

  function update(passage) {
    current = passage;
    if (document.activeElement !== field) field.value = passageLabel(passage);
    for (const b of steps) {
      const dir = Number(b.dataset.step);
      const to = stepChapter(passage, dir);
      const name = dir < 0 ? "Previous chapter" : "Next chapter";
      b.setAttribute("aria-disabled", String(!to));
      b.setAttribute("aria-label", to ? `${name}, ${passageLabel(to)}` : name);
      b.title = to ? passageLabel(to) : "";
    }
  }

  el.addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = parseReference(field.value);
    const passage = ref && checkPassage({ bookKey: ref.bookKey, chapter: ref.chapter, verse: ref.verse });
    if (!passage) {
      say("That isn’t a passage in the New Testament. Try John 3:16 or Romans 8.");
      return;
    }
    say(null);
    field.value = passageLabel(passage);
    set(passage);
  });

  field.addEventListener("focus", () => field.select());
  // Leaving the field without asking for anything puts the passage back.
  field.addEventListener("blur", () => {
    if (current && error.hidden) field.value = passageLabel(current);
  });
  field.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !current) return;
    e.stopPropagation();
    say(null);
    field.value = passageLabel(current);
    field.select();
  });
  field.addEventListener("input", () => {
    if (!error.hidden) say(null);
  });

  for (const b of steps) {
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true" || !current) return;
      const to = stepChapter(current, Number(b.dataset.step));
      if (!to) return;
      say(null);
      set(to);
    });
  }

  return { el, update };
}
