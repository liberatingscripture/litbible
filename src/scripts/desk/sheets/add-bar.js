// src/scripts/desk/sheets/add-bar.js
//
// The add bar under a sheet's parts (Audit 6, LG6-2, taken out of
// `createSheetEditor` as add-forms.js was): "+ Passage", "+ Text",
// "+ Question", "+ From my notes…", "+ Space to write", "+ Page break" and "+ Key
// terms box", with the passage form and the notes chooser it opens below the
// row. What a button adds, and where, stay the editor's, handed in as `host`:
//
// - `addPart(type)`, the editor's own;
// - `addHost`, which the two forms take (add-forms.js);
// - `idSuffix`, which keeps the forms' ids apart.
//
// It returns `el` and `sheetChanged(sheet)`, which the editor calls on every
// draw, since a sheet holds one key terms box and its button says so.

import { buttons, describe, make } from "../dom.js";
import { openFromNotes, openPassageForm } from "./add-forms.js";

const button = buttons("desk-sheet__btn");

// What each of the add bar's buttons adds, in a short line (BVJ, 2026-11-08:
// only one button had a tooltip, and that one ran too long to show whole):
// the button's hover text, and its description for a screen reader.
const ADD_TIPS = Object.freeze({
  passage: "Add a passage from the LIT by its reference, or from your notebook",
  text: "Add a part for your own words",
  question: "Add a question, with lines to write an answer on",
  fromNotes: "Bring your notes, highlights, and pinned footnotes onto the sheet, as parts you choose",
  space: "Add blank lines to write on",
  pageBreak: "Start a new page here when printed",
  keyTerms: "Add a box listing the key terms in the sheet’s passages, filled in for you",
});

const KEY_TERMS_HINT = "A box listing the key terms in the sheet’s passages, filled in for you.";
const ONE_BOX = "A sheet has one key terms box, and this one has it";

export function createAddBar({ addPart, addHost, idSuffix }) {
  const bar = make("div", "desk-sheet__add");
  const row = make("div", "desk-sheet__add-row");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Add to the sheet");
  const form = make("div", "desk-sheet__passage-form");
  form.hidden = true;
  const hints = [];
  const add = (type, label) => {
    const b = button(`+ ${label}`);
    b.title = ADD_TIPS[type];
    // The key terms box's description changes with the sheet (keyTermsHint).
    if (type !== "keyTerms") hints.push(describe(b, `${ADD_TIPS[type]}.`));
    b.addEventListener("click", () => {
      if (type === "passage") {
        form.hidden = !form.hidden;
        b.setAttribute("aria-expanded", String(!form.hidden));
        if (!form.hidden) openPassageForm(addHost, form);
        return;
      }
      addPart(type);
    });
    if (type === "passage") {
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-controls", `deskSheetPassage-${idSuffix}`);
    }
    row.append(b);
    return b;
  };
  add("passage", "Passage");
  add("text", "Text");
  add("question", "Question");
  // + From my notes… (E62; BVJ, 2026-11-08): a chooser over the notebook's
  // notes, highlights and pinned footnotes on this sheet's passages, each
  // brought on as a part. It took over from N6's "+ For discussion", which
  // gathered only the notes marked as questions: too few readers' habit.
  const fromNotes = button("+ From my notes…");
  fromNotes.title = ADD_TIPS.fromNotes;
  hints.push(describe(fromNotes, `${ADD_TIPS.fromNotes}.`));
  const picker = make("div", "desk-sheet__passage-form desk-sheet__from-notes");
  picker.id = `deskSheetFromNotes-${idSuffix}`;
  picker.hidden = true;
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "From my notes");
  fromNotes.setAttribute("aria-expanded", "false");
  fromNotes.setAttribute("aria-controls", picker.id);
  const closePicker = (refocus) => {
    picker.hidden = true;
    picker.replaceChildren();
    fromNotes.setAttribute("aria-expanded", "false");
    if (refocus) fromNotes.focus();
  };
  fromNotes.addEventListener("click", () => {
    if (!picker.hidden) {
      closePicker(false);
      return;
    }
    fromNotes.setAttribute("aria-expanded", "true");
    openFromNotes(addHost, picker, closePicker);
  });
  picker.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    closePicker(true);
  });
  row.append(fromNotes);
  add("space", "Space to write");
  add("pageBreak", "Page break");
  const keyTermsButton = add("keyTerms", "Key terms box");
  const keyTermsHint = describe(keyTermsButton, KEY_TERMS_HINT);
  form.id = `deskSheetPassage-${idSuffix}`;
  bar.append(row, form, picker, ...hints, keyTermsHint);

  return {
    el: bar,
    /** A sheet holds one key terms box: the button is disabled while it has one, and says why. */
    sheetChanged(sheet) {
      const has = sheet.modules.some((x) => x?.type === "keyTerms");
      keyTermsButton.disabled = has;
      keyTermsButton.title = has ? ONE_BOX : ADD_TIPS.keyTerms;
      keyTermsHint.textContent = has ? `${ONE_BOX}.` : KEY_TERMS_HINT;
      // The reason, for the eye too (SH5-17); hidden from a screen reader,
      // which hears it in the description above.
      const next = keyTermsButton.nextElementSibling;
      const why = next?.classList.contains("desk-title__hint") ? next : null;
      if (has && !why) {
        const span = make("span", "desk-title__hint", "already on the sheet");
        span.setAttribute("aria-hidden", "true");
        // In the row, beside its button rather than pushed to the row's end
        // as in a menu, and dimmed as a menu's disabled line is.
        keyTermsButton.after(span);
      } else if (!has) {
        why?.remove();
      }
    },
  };
}
