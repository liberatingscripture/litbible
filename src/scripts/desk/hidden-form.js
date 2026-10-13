// src/scripts/desk/hidden-form.js
//
// "Hide this passage…" (STUDY-DESK.md, N8): the small form that opens in the
// shared floating panel, in place of the menu it was asked for from, as the
// note editor does. An optional "Note to yourself" (what is in the passage,
// or why) and Hide. Ctrl+Enter (⌘+Enter) hides. The panel ignores clicks
// outside it, so a stray click can't lose what was typed; Cancel, × and
// Escape close it. The note is the reader's own words: text, never HTML.

import { createRecord, editRecord } from "../../lib/desk-records.mjs";
import { hiddenFields, hiddenRecords, passageRef } from "../../lib/desk-hidden.mjs";
import { closePanel, showPanel } from "../lit-panel.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";

let seq = 0;

/**
 * @param {object} options
 * @param {Element | { getBoundingClientRect(): DOMRect }} options.trigger what the form opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {{ bookKey: string, chapter: number }} options.where
 * @param {number} options.start first verse
 * @param {number} options.end last verse
 * @param {Element} [options.restoreFocus]
 * @param {() => void} [options.onHidden] runs once the passage is saved (a selection clears itself)
 */
export function openHideForm({ trigger, store, ctx, where, start, end, restoreFocus = null, onHidden = null }) {
  const n = ++seq;
  const ref = passageRef(where.bookKey, where.chapter, start, end);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskHideTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-editor", "desk-hide-form");
  panel.setAttribute("data-desk-editor", "");
  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskHideTitle${n}">Hide this passage</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    <p class="desk-hide-form__ref"></p>
    <p class="desk-hide-form__says">It stays blurred, on every page that shows it, until you choose to show it.</p>
    <label class="desk-hide-form__label" for="deskHideNote${n}">Note to yourself (optional)</label>
    <textarea class="desk-editor__body" id="deskHideNote${n}" rows="3"
      placeholder="What is in it, or why you are hiding it"></textarea>
    <p class="desk-editor__error" role="alert" hidden></p>
    <div class="desk-editor__actions">
      <button type="button" class="desk-editor__cancel">Cancel</button>
      <button type="button" class="desk-editor__save">Hide</button>
    </div>`;
  panel.querySelector(".desk-hide-form__ref").textContent = ref;
  const note = panel.querySelector("textarea");
  const error = panel.querySelector(".desk-editor__error");

  async function save() {
    const now = new Date().toISOString();
    const fields = hiddenFields({ ...where, start, end, note: note.value });
    try {
      // The same passage hidden again takes the new note rather than doubling.
      const same = hiddenRecords(await store.byChapter(where.bookKey, where.chapter)).find(
        (r) => r.verse === fields.verse && (r.endVerse ?? r.verse) === fields.endVerse,
      );
      if (same) {
        const next = editRecord(same, { body: fields.body ?? "" }, { now, client: ctx().client });
        if (next.body === "") delete next.body;
        await store.save(next);
      } else {
        await store.save(createRecord("hidden", fields, { now, ...ctx() }));
      }
      const entry = store.lastEntry();
      closePanel();
      onHidden?.();
      if (entry) showUndo(`${ref} hidden.`, () => undoEntry(entry));
    } catch (err) {
      console.error("Study Desk: the passage wasn't hidden", err);
      error.hidden = false;
      error.textContent = "The passage couldn’t be hidden in this browser.";
    }
  }

  panel.querySelector(".desk-editor__save").addEventListener("click", save);
  panel.querySelector(".desk-editor__cancel").addEventListener("click", closePanel);
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  });

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "hide-form", stay: true },
  });
  note.focus({ preventScroll: true });
  return panel;
}
