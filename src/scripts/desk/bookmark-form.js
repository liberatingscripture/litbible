// src/scripts/desk/bookmark-form.js
//
// "Edit bookmark" (STUDY-DESK-FIXES.md E9): the small form a bookmark row's Edit
// button opens, in the shared floating panel (as the note editor does). The
// reader moves the bookmark to another verse (E46), names it, or leaves it
// unnamed, and turns "Move as I read" on or off. A bookmark stays on its verse
// unless that switch is on, and a few may move at once (MAX_FOLLOWING).
//
// A name is the reader's own words, set as text, never HTML. The verse is read
// as the Go to passage field reads one (search-core.js's parseReference). The
// rules (what a name may be, how many may move, one bookmark of each kind on a
// verse) are src/lib/desk-bookmarks.mjs and desk-bookmark-change.mjs, applied
// in the one transaction that writes.

import { BOOKMARK_NAME_MAX, canFollowMore, MAX_FOLLOWING } from "../../lib/desk-bookmarks.mjs";
import { bookmarkPlace, placeLabel, planBookmarkEdit, roomAt } from "../../lib/desk-bookmark-change.mjs";
import { numberWord } from "../../lib/desk-wording.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { parseReference } from "../search-core.js";
import { closePanel, showPanel } from "../lit-panel.js";
import {
  followBookmark,
  followsHere,
  isFollowedHere,
  isPausedHere,
  restedAt,
  restingId,
  stopFollowing,
} from "./bookmark-follow.js";
import { busy as holdButton, isBusy } from "./focus-keep.js";
import { undoEntry } from "./history.js";
import { announce, showUndo } from "./undo-bar.js";

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
    <div class="desk-bookmark-form__field">
      <label for="deskBookmarkVerse${n}">Verse</label>
      <input type="text" class="desk-bookmark-form__verse" id="deskBookmarkVerse${n}" autocomplete="off"
        spellcheck="false" placeholder="John 3:16" />
    </div>
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
      Moves along with you as you read its book, once it’s following you.
      Without this, it stays on its verse. Up to ${numberWord(MAX_FOLLOWING)} of your bookmarks can move.
    </p>
    <label class="desk-bookmark-form__follow desk-bookmark-form__start" hidden>
      <input type="checkbox" class="desk-bookmark-form__start-box" />
      <span>Start following now?</span>
    </label>
    <p class="desk-bookmark-form__start-note" role="status" hidden></p>
    <p class="desk-editor__error" role="alert" hidden></p>
    <div class="desk-editor__actions">
      <button type="button" class="desk-editor__cancel">Cancel</button>
      <button type="button" class="desk-editor__save">Save</button>
    </div>`;

  // The verse it is on, as the field shows it; only a different one moves it,
  // so a move the follower makes while the form is open isn't undone (E46).
  const shownVerse = placeLabel(record);
  const verseInput = panel.querySelector(".desk-bookmark-form__verse");
  verseInput.value = shownVerse;
  const nameInput = panel.querySelector(".desk-bookmark-form__name");
  // The reader's words: set as a value, never as markup.
  nameInput.value = record.label ?? "";
  const follow = panel.querySelector(".desk-bookmark-form__follow-box");
  follow.checked = record.follow === true;
  // The verse holds one bookmark of each kind: when the other is taken, the
  // switch is fixed at the one that isn't, and says why. A verse typed in the
  // field is looked at the same way once the reader leaves it.
  const lockLine = panel.querySelector(".desk-bookmark-form__lock");
  function fixSwitch(value, where = null) {
    follow.checked = value;
    follow.disabled = true;
    lockLine.hidden = false;
    const verse = where ? placeLabel(where) : "This verse";
    lockLine.textContent = value
      ? `${verse} already has a bookmark that stays put, so this one moves as you read.`
      : `${verse} already has a bookmark that moves as you read, so this one stays put.`;
    drawStart();
  }
  function freeSwitch() {
    follow.disabled = false;
    lockLine.hidden = true;
    lockLine.textContent = "";
  }
  /** The verse the field names, or null when it doesn't read as one. */
  function typedPlace() {
    return bookmarkPlace(parseReference(verseInput.value)).place;
  }
  let looking = 0;
  /** Fix or free the switch for the verse `place` (the bookmark's own, or one typed). */
  function lookAt(place) {
    if (!store?.byChapter) return;
    const n = ++looking;
    const own = place.bookKey === record.bookKey && place.chapter === record.chapter && place.verse === record.verse;
    store
      .byChapter(place.bookKey, place.chapter)
      .then((records) => {
        if (n !== looking) return;
        const room = roomAt(records, record, place, { except: restingId() });
        if (room.moves && room.stays) return freeSwitch();
        // A verse holding both kinds takes neither: Save says so.
        if (!room.moves && !room.stays) return own ? fixSwitch(record.follow === true) : freeSwitch();
        fixSwitch(room.moves, own ? null : place);
      })
      .catch(() => {});
  }
  // "Start following now?" (E47, BVJ 2026-11-05): the dialog's way to do what a
  // row's "Start following" does (E44), offered while "Move as I read" is
  // checked, and only when this tab could start it: not while it already
  // follows this one, not on a page that doesn't follow the reader, and not
  // with six others already moving. Otherwise a line says which.
  const startWrap = panel.querySelector(".desk-bookmark-form__start");
  const startBox = panel.querySelector(".desk-bookmark-form__start-box");
  const startNote = panel.querySelector(".desk-bookmark-form__start-note");
  let atLimit = false;
  function drawStart() {
    const why = !follow.checked
      ? null
      : isFollowedHere(record.id)
        ? isPausedHere(record.id)
          ? "It’s already following you in this tab, paused where you left off."
          : "It’s already following you in this tab."
        : !followsHere()
          ? "It can start following from a chapter or Read View page."
          : atLimit
            ? `${numberWord(MAX_FOLLOWING, { capital: true })} of your bookmarks already move as you read, so this one can’t follow until you turn that off on one of them.`
            : null;
    startWrap.hidden = !follow.checked || Boolean(why);
    if (startWrap.hidden) startBox.checked = false;
    startNote.hidden = !why;
    startNote.textContent = why ?? "";
  }
  follow.addEventListener("change", drawStart);
  drawStart();
  // The limit, as the notebook holds it now; the write checks it again.
  store
    ?.all?.()
    .then((records) => {
      atLimit = !canFollowMore(records, record.id);
      drawStart();
    })
    .catch(() => {});

  if (lock !== null) fixSwitch(lock);
  else lookAt(record);
  verseInput.addEventListener("change", () => {
    const place = typedPlace();
    if (place) lookAt(place);
  });
  const error = panel.querySelector(".desk-editor__error");
  const saveButton = panel.querySelector(".desk-editor__save");

  async function save() {
    // One save at a time: a second press while the first is writing would be
    // a second change over the same bookmark.
    // aria-disabled, not disabled, so the key that pressed it keeps focus when the
    // save fails and the form stays (NB8-8).
    if (isBusy(saveButton)) return;
    const release = holdButton(saveButton);
    error.hidden = true;
    // The bookmark is read, the limit checked, and the write made in one
    // transaction (BA102): the form's copy is from when it opened, and another
    // tab or pane may have changed it since.
    let outcome = null;
    const change = { name: nameInput.value, follow: follow.checked };
    // A verse typed over the one shown (null when it doesn't read as one,
    // which the plan refuses with a line saying so).
    if (verseInput.value.trim() !== shownVerse) change.place = parseReference(verseInput.value);
    const { client, contentVersion } = ctx();
    try {
      await store.change(async (reads) => {
        outcome = await planBookmarkEdit(
          reads,
          record.id,
          change,
          { now: new Date().toISOString(), client, contentVersion },
          { except: restingId() },
        );
        return outcome.plan;
      });
    } catch (err) {
      console.error("Study Desk: the bookmark wasn't saved", err);
      error.hidden = false;
      error.textContent = "The bookmark couldn’t be saved in this browser. Try again.";
      release();
      return;
    }
    if (outcome?.problem) {
      error.hidden = false;
      error.textContent = outcome.problem;
      release();
      return;
    }
    // Checked and still offered: the follow starts once the bookmark is saved
    // (E47), the way a row's "Start following" starts it.
    const startNow = !startWrap.hidden && startBox.checked && follow.checked;
    const saved = outcome?.record ?? record;
    // Nothing changed: nothing was written.
    if (!outcome?.plan) {
      closePanel();
      if (startNow && saved.follow === true) {
        followBookmark(saved);
        announce(`The bookmark on ${recordReference(saved)} is following you now.`);
      }
      return;
    }
    const entry = store.lastEntry();
    // Turned off while this tab is moving it: it stops now, not at the next scroll.
    if (!follow.checked && isFollowedHere(record.id)) stopFollowing();
    // Moved while this tab follows it: where it rests moves too (E46).
    if (outcome.moved && isFollowedHere(record.id)) restedAt(record.id, saved.bookKey);
    const started = startNow && saved.follow === true;
    if (started) followBookmark(saved);
    closePanel();
    const said = outcome.moved ? `Bookmark moved to ${recordReference(saved)}.` : `Bookmark on ${ref} updated.`;
    showUndo(started ? `${said} It’s following you now.` : said, () => undoEntry(entry));
  }

  saveButton.addEventListener("click", save);
  panel.querySelector(".desk-editor__cancel").addEventListener("click", closePanel);
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);
  for (const input of [verseInput, nameInput]) {
    input.addEventListener("keydown", (e) => {
      // Not while an input method is composing: Enter there confirms the word (NB8-14).
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        save();
      }
    });
  }

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "bookmark-form", stay: true },
  });
  nameInput.focus({ preventScroll: true });
  return panel;
}
