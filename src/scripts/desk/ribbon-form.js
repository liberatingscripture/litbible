// src/scripts/desk/ribbon-form.js
//
// "Ribbon here…" (STUDY-DESK.md B1): the small form the verse menu's and the
// selection panel's "My Notebook" row opens, in the shared floating panel in
// place of the menu (as the note editor does). The reader names a new ribbon,
// or picks one they already have to move it to this verse. A few ribbons per
// reader (MAX_RIBBONS); at the limit only moving is offered.
//
// Names are the reader's own words, set as text, never HTML. The rules (what
// a name may be, how many) are src/lib/desk-places.mjs.

import { RIBBON_NAME_MAX, canAddRibbon, ribbonsOf } from "../../lib/desk-places.mjs";
import { planRibbonCreate, planRibbonMove } from "../../lib/desk-ribbon-change.mjs";
import { recordReference } from "../../lib/desk-store-core.mjs";
import { closePanel, showPanel } from "../lit-panel.js";
import { undoEntry } from "./history.js";
import { showUndo } from "./undo-bar.js";

let seq = 0;

/**
 * @param {object} options
 * @param {Element | { getBoundingClientRect(): DOMRect }} options.trigger what the panel opens beside
 * @param {object} options.store
 * @param {() => object} options.ctx
 * @param {{ bookKey: string, chapter: number, verse: number }} options.where the verse the ribbon goes to
 * @param {Element} [options.restoreFocus]
 */
export async function openRibbonForm({ trigger, store, ctx, where, restoreFocus = null }) {
  const n = ++seq;
  const place = { bookKey: where.bookKey, chapter: where.chapter, verse: where.verse, endVerse: where.verse };
  const ref = recordReference(place);
  let ribbons = [];
  try {
    ribbons = ribbonsOf(await store.all());
  } catch (err) {
    console.error("Study Desk: couldn't read the ribbons", err);
  }
  const canAdd = canAddRibbon(ribbons);

  const panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", `deskRibbonTitle${n}`);
  panel.tabIndex = -1;
  panel.classList.add("lit-panel--menu", "desk-editor", "desk-ribbon-form");
  panel.setAttribute("data-desk-editor", "");

  // One group of choices: a new ribbon (with its name field) and each ribbon
  // the reader has. Radios, so the arrow keys move between them.
  const choices = [
    ...(canAdd
      ? [
          `<div class="desk-ribbon-form__choice desk-ribbon-form__choice--new">
            <label class="desk-ribbon-form__label">
              <input type="radio" name="desk-ribbon-${n}" value="new" checked />
              <span>New ribbon</span>
            </label>
            <label class="sr-only" for="deskRibbonName${n}">Name of the new ribbon</label>
            <input type="text" class="desk-ribbon-form__name" id="deskRibbonName${n}" maxlength="${RIBBON_NAME_MAX}"
              placeholder="Thursday group" autocomplete="off" />
          </div>`,
        ]
      : []),
    ...ribbons.map(
      (r, i) => `<div class="desk-ribbon-form__choice">
        <label class="desk-ribbon-form__label">
          <input type="radio" name="desk-ribbon-${n}" value="${i}" ${!canAdd && i === 0 ? "checked" : ""} />
          <span class="desk-ribbon-form__existing"></span>
        </label>
      </div>`,
    ),
  ];

  panel.innerHTML = `
    <div class="lit-panel__header">
      <p class="lit-panel__heading" id="deskRibbonTitle${n}">Ribbon here</p>
      <button type="button" class="lit-panel__close" aria-label="Close">×</button>
    </div>
    <p class="desk-ribbon-form__where"></p>
    ${canAdd ? "" : `<p class="desk-ribbon-form__limit">You have ${ribbons.length} ribbons. Choose one to move here.</p>`}
    <fieldset class="desk-ribbon-form__choices">
      <legend class="sr-only">${ribbons.length ? "A new ribbon, or a ribbon to move here" : "A new ribbon"}</legend>
      ${choices.join("")}
    </fieldset>
    <p class="desk-editor__error" role="alert" hidden></p>
    <div class="desk-editor__actions">
      <button type="button" class="desk-editor__cancel">Cancel</button>
      <button type="button" class="desk-editor__save">Save</button>
    </div>`;

  panel.querySelector(".desk-ribbon-form__where").textContent = ref;
  // Ribbon names are the reader's words: set as text, never as markup.
  panel.querySelectorAll(".desk-ribbon-form__existing").forEach((el, i) => {
    el.textContent = `Move “${ribbons[i].name}” here (now at ${recordReference(ribbons[i])})`;
  });

  const nameInput = panel.querySelector(".desk-ribbon-form__name");
  const radios = Array.from(panel.querySelectorAll('input[type="radio"]'));
  const error = panel.querySelector(".desk-editor__error");
  const chosen = () => radios.find((r) => r.checked)?.value;

  // Typing a name chooses "New ribbon", the way a text field beside a radio is meant to work.
  nameInput?.addEventListener("input", () => {
    const first = radios[0];
    if (first?.value === "new") first.checked = true;
  });

  const saveButton = panel.querySelector(".desk-editor__save");

  async function save() {
    // One save at a time: a second press while the first is writing would make
    // a second ribbon of the same name.
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    const now = new Date().toISOString();
    error.hidden = true;
    const making = chosen() === "new";
    const existing = making ? null : ribbons[Number(chosen())];
    if (!making && !existing) {
      saveButton.disabled = false;
      return closePanel();
    }
    // The ribbon is read, the name and the limit checked, and the write made in
    // one transaction (BA102): the form's own list of ribbons is from when it
    // opened, and another tab or pane may have changed them since.
    let outcome = null;
    try {
      await store.change(async (reads) => {
        outcome = making
          ? await planRibbonCreate(reads, nameInput.value, place, { now, ...ctx() })
          : await planRibbonMove(reads, existing.id, place, { now, client: ctx().client });
        return outcome.plan;
      });
    } catch (err) {
      console.error("Study Desk: the ribbon wasn't saved", err);
      error.hidden = false;
      error.textContent = "The ribbon couldn’t be saved in this browser.";
      saveButton.disabled = false;
      return;
    }
    if (outcome?.problem) {
      error.hidden = false;
      error.textContent = outcome.problem;
      saveButton.disabled = false;
      if (making) nameInput.focus();
      return;
    }
    // A ribbon already at this verse writes nothing.
    if (!outcome?.plan) return closePanel();
    const entry = store.lastEntry();
    const name = outcome.record.name;
    closePanel();
    showUndo(`Ribbon “${name}” ${making ? "placed at" : "moved to"} ${ref}.`, () => undoEntry(entry));
  }

  saveButton.addEventListener("click", save);
  panel.querySelector(".desk-editor__cancel").addEventListener("click", closePanel);
  panel.querySelector(".lit-panel__close").addEventListener("click", closePanel);
  nameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  });

  showPanel(trigger, panel, {
    restoreFocus,
    sheet: false,
    extra: { kind: "ribbon-form", stay: true },
  });
  (nameInput ?? radios[0] ?? panel).focus({ preventScroll: true });
  return panel;
}
