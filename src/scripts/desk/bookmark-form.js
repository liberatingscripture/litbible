// src/scripts/desk/bookmark-form.js
//
// "Edit bookmark" (STUDY-DESK-FIXES.md E9): the small form a bookmark row's Edit
// button opens, in the shared floating panel (as the note editor does). The
// reader names the bookmark, or leaves it unnamed, and turns "Move as I read"
// on or off. A bookmark stays on its verse unless that switch is on, and a few
// may move at once (MAX_FOLLOWING).
//
// A name is the reader's own words, set as text, never HTML. The rules (what a
// name may be, how many may move) are src/lib/desk-bookmarks.mjs, applied in
// the one transaction that writes (desk-bookmark-change.mjs).

import { BOOKMARK_NAME_MAX, MAX_FOLLOWING } from "../../lib/desk-bookmarks.mjs";
import { planBookmarkEdit } from "../../lib/desk-bookmark-change.mjs";
import { followChoices, recordReference } from "../../lib/desk-store-core.mjs";
import { closePanel, showPanel } from "../lit-panel.js";
import { isFollowedHere, restingId, stopFollowing } from "./bookmark-follow.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";

let seq = 0;

/**
 * @param {object} options
 * @param {Element | { getBoundingClientRect(): DOMRect }} options.trigger what the panel opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {object} options.record the bookmark being edited
 * @param {Element} [options.restoreFocus]
 * @param {boolean | null} [options.lock] fix "Move as I read" at this value, the
 *   kind the verse doesn't already hold (BVJ, 2026-11-04); null works it out
 */
export function openBookmarkForm({ trigger, store, ctx, record, restoreFocus = null, lock = null }) {
  const n = ++seq;
  const ref = recordReference(record);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskBookmarkTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-editor", "desk-bookmark-form");
  panel.setAttribute("data-desk-editor", "");

  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskBookmarkTitle${n}">Edit bookmark</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    <p class="desk-bookmark-form__where"></p>
    <div class="desk-bookmark-form__field">
      <label for="deskBookmarkName${n}">Name (optional)</label>
      <input type="text" class="desk-bookmark-form__name" id="deskBookmarkName${n}" maxlength="${BOOKMARK_NAME_MAX}"
        placeholder="Thursday group" autocomplete="off" />
    </div>
    <label class="desk-bookmark-form__follow">
      <input type="checkbox" class="desk-bookmark-form__follow-box" aria-describedby="deskBookmarkHint${n}" />
      <span>Move as I read</span>
    </label>
    <p class="desk-bookmark-form__lock" role="status" hidden></p>
    <p class="desk-bookmark-form__hint" id="deskBookmarkHint${n}">
      Open this bookmark from your list, and it follows you through the book.
      Off, it stays put on its verse. Up to ${MAX_FOLLOWING} bookmarks can move.
    </p>
    <p class="desk-editor__error" role="alert" hidden></p>
    <div class="desk-editor__actions">
      <button type="button" class="desk-editor__cancel">Cancel</button>
      <button type="button" class="desk-editor__save">Save</button>
    </div>`;

  panel.querySelector(".desk-bookmark-form__where").textContent = ref;
  const nameInput = panel.querySelector(".desk-bookmark-form__name");
  // The reader's words: set as a value, never as markup.
  nameInput.value = record.label ?? "";
  const follow = panel.querySelector(".desk-bookmark-form__follow-box");
  follow.checked = record.follow === true;
  // The verse holds one bookmark of each kind: when the other is taken, the
  // switch is fixed at the one that isn't, and says why.
  const lockLine = panel.querySelector(".desk-bookmark-form__lock");
  function fixSwitch(value) {
    follow.checked = value;
    follow.disabled = true;
    lockLine.hidden = false;
    lockLine.textContent = value
      ? "This verse already has a bookmark that stays put, so this one moves as you read."
      : "This verse already has a bookmark that moves as you read, so this one stays put.";
  }
  if (lock !== null) fixSwitch(lock);
  else if (store?.byChapter) {
    store
      .byChapter(record.bookKey, record.chapter)
      .then((records) => {
        const choices = followChoices(records, record, { except: restingId() });
        if (choices.moves && choices.stays) return;
        fixSwitch(choices.moves ? true : choices.stays ? false : record.follow === true);
      })
      .catch(() => {});
  }
  const error = panel.querySelector(".desk-editor__error");
  const saveButton = panel.querySelector(".desk-editor__save");

  async function save() {
    // One save at a time: a second press while the first is writing would be
    // a second change over the same bookmark.
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    error.hidden = true;
    // The bookmark is read, the limit checked, and the write made in one
    // transaction (BA102): the form's copy is from when it opened, and another
    // tab or pane may have changed it since.
    let outcome = null;
    try {
      await store.change(async (reads) => {
        outcome = await planBookmarkEdit(
          reads,
          record.id,
          { name: nameInput.value, follow: follow.checked },
          { now: new Date().toISOString(), client: ctx().client },
        );
        return outcome.plan;
      });
    } catch (err) {
      console.error("Study Desk: the bookmark wasn't saved", err);
      error.hidden = false;
      error.textContent = "The bookmark couldn’t be saved in this browser. Try again.";
      saveButton.disabled = false;
      return;
    }
    if (outcome?.problem) {
      error.hidden = false;
      error.textContent = outcome.problem;
      saveButton.disabled = false;
      return;
    }
    // Nothing changed: nothing was written.
    if (!outcome?.plan) return closePanel();
    const entry = store.lastEntry();
    // Turned off while this tab is moving it: it stops now, not at the next scroll.
    if (!follow.checked && isFollowedHere(record.id)) stopFollowing();
    closePanel();
    showUndo(`Bookmark on ${ref} updated.`, () => undoEntry(entry));
  }

  saveButton.addEventListener("click", save);
  panel.querySelector(".desk-editor__cancel").addEventListener("click", closePanel);
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  });

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "bookmark-form", stay: true },
  });
  nameInput.focus({ preventScroll: true });
  return panel;
}
