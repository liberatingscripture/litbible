// src/scripts/desk/note-editor.js
//
// Writing or editing a note, in the shared floating panel (lit-panel.js), in
// place of the menu it was asked for from: the words it hangs on and their
// reference, the seven markers (the apps' set; STUDY-DESK-FORMAT.md
// `note.marker`), and the reader's own words. Ctrl+Enter (⌘+Enter) saves.
// The panel ignores clicks outside it, so a stray click can't lose what was
// typed; Cancel, × and Escape close it.
//
// A note's body is the reader's own words: always text, never HTML.

import { MARKERS, createRecord, editRecord, proseTarget, verseCopyFor } from "../../lib/desk-records.mjs";
import { MARKER_NAMES, shortQuote } from "../../lib/desk-notes.mjs";
import { closePanel, showPanel } from "../lit-panel.js";
import { glyph } from "./glyphs.js";
import { undoEntry } from "./history.js";
import { chapterText } from "./page.js";
import { showUndo } from "./undo-bar.js";

let seq = 0;

// The tour's example (tour.js): while set, a new note's editor opens with
// these words, read-only, and can't be saved, so the tour shows the real
// editor and writes nothing.
let preview = null;
export function setEditorPreview(text) {
  preview = text ?? null;
}

/**
 * @param {object} options
 * @param {Element | { getBoundingClientRect(): DOMRect }} options.trigger what the panel opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {string} options.ref "Romans 8:1"
 * @param {object} [options.record] an existing note, to edit
 * @param {object} [options.draft] a new note's place: bookKey, chapter, verse, endVerse, quote;
 *   or, for a note on a footnote (M11), bookKey, chapter, verse, footnote and
 *   perhaps n (desk-footnotes' pinFields), with no quote;
 *   or, for a note on a glossary entry or an article (N11, provisional),
 *   glossaryEntry or article, targetTitle, and quote
 * @param {Element} [options.restoreFocus]
 * @param {() => object} [options.text] the draft's chapter as anchor text, for
 *   a whole-verse note's copy of its wording; the page's own by default. On
 *   /desk the chapter comes from its fetched page (chapter-page.js).
 */
export function openNoteEditor({ trigger, store, ctx, ref, record = null, draft = null, restoreFocus = null, text = chapterText }) {
  const n = ++seq;
  const editing = Boolean(record);
  const place = record ?? draft;
  let marker = record?.marker ?? "note";

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskEditorTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-editor");
  panel.setAttribute("data-desk-editor", "");

  // A note on a footnote (M11) shows the footnote, not words of the verse, and
  // says so in its caption. The text is cut to a few lines by CSS.
  const onFn = typeof place.footnote === "string";
  const words = onFn ? place.footnote : place.quote?.exact;
  const where = onFn ? `a footnote in ${ref}` : ref;
  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskEditorTitle${n}">${editing ? "Edit note" : "New note"}</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    <figure class="desk-editor__quote">
      ${words ? `<blockquote${onFn ? ` class="desk-editor__footnote"` : ""}>${escapeHtml(onFn ? words : shortQuote(words, 24))}</blockquote>` : ""}
      <figcaption>${escapeHtml(onFn ? `Footnote in ${ref}` : ref)}</figcaption>
    </figure>
    <fieldset class="desk-editor__markers">
      <legend>Marker: <span class="desk-editor__marker-name">${MARKER_NAMES[marker]}</span></legend>
      <div class="desk-editor__marker-row">
        ${MARKERS.map(
          (m) => `<label class="desk-editor__marker" title="${MARKER_NAMES[m]}">
            <input type="radio" name="desk-marker-${n}" value="${m}" ${m === marker ? "checked" : ""} />
            ${glyph(m)}<span class="sr-only">${MARKER_NAMES[m]}</span>
          </label>`,
        ).join("")}
      </div>
    </fieldset>
    <label class="sr-only" for="deskEditorBody${n}">My note</label>
    <textarea class="desk-editor__body" id="deskEditorBody${n}" rows="4" placeholder="Write your note…"></textarea>
    <p class="desk-editor__error" role="alert" hidden></p>
    <div class="desk-editor__actions">
      ${editing ? `<button type="button" class="desk-editor__delete">Delete</button>` : ""}
      <button type="button" class="desk-editor__cancel">Cancel</button>
      <button type="button" class="desk-editor__save">Save</button>
    </div>`;

  const body = panel.querySelector("textarea");
  body.value = record?.body ?? "";
  const example = !editing && preview !== null;
  if (example) {
    body.value = preview;
    body.readOnly = true;
    panel.querySelector(".desk-editor__save").disabled = true;
  }
  const nameEl = panel.querySelector(".desk-editor__marker-name");
  const error = panel.querySelector(".desk-editor__error");
  for (const r of panel.querySelectorAll('input[type="radio"]')) {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      marker = r.value;
      nameEl.textContent = MARKER_NAMES[marker];
    });
  }

  async function save() {
    if (example) return;
    const now = new Date().toISOString();
    let next;
    if (editing) {
      if (record.body === body.value && record.marker === marker) return closePanel();
      next = editRecord(record, { body: body.value, marker }, { now, client: ctx().client });
    } else if (onFn) {
      // No quote and no verse copy: the footnote's own words are what it hangs on.
      next = createRecord(
        "note",
        {
          bookKey: draft.bookKey,
          chapter: draft.chapter,
          verse: draft.verse,
          footnote: draft.footnote,
          ...(draft.n ? { n: draft.n } : {}),
          body: body.value,
          marker,
        },
        { now, ...ctx() },
      );
    } else if (proseTarget(draft)) {
      const { type, id } = proseTarget(draft);
      next = createRecord(
        "note",
        {
          [type]: id,
          ...(draft.targetTitle ? { targetTitle: draft.targetTitle } : {}),
          ...(draft.quote ? { quote: draft.quote } : {}),
          body: body.value,
          marker,
        },
        { now, ...ctx() },
      );
    } else {
      let verseCopy = null;
      try {
        verseCopy = verseCopyFor(text(), draft.verse, draft.endVerse ?? draft.verse);
      } catch (_) {}
      next = createRecord(
        "note",
        {
          bookKey: draft.bookKey,
          chapter: draft.chapter,
          verse: draft.verse,
          endVerse: draft.endVerse ?? draft.verse,
          ...(draft.quote ? { quote: draft.quote } : {}),
          body: body.value,
          marker,
          ...(verseCopy ? { verseCopy, verseCopyAsOf: now } : {}),
        },
        { now, ...ctx() },
      );
    }
    try {
      await store.save(next);
      closePanel();
    } catch (err) {
      console.error("Study Desk: the note wasn't saved", err);
      error.hidden = false;
      error.textContent = "The note couldn’t be saved in this browser.";
    }
  }

  panel.querySelector(".desk-editor__save").addEventListener("click", save);
  panel.querySelector(".desk-editor__cancel").addEventListener("click", closePanel);
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);
  panel.querySelector(".desk-editor__delete")?.addEventListener("click", async () => {
    const trash = await store.remove(record.id);
    // The change this made, read at once: the undo button, like Ctrl+Z,
    // takes back exactly this one (history.js).
    const entry = trash ? store.lastEntry() : null;
    closePanel();
    if (!entry) return;
    showUndo(`Note on ${where} deleted.`, () => undoEntry(entry));
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  });

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "note-editor", stay: true },
  });
  body.focus({ preventScroll: true });
  return panel;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
