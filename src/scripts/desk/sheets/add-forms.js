// src/scripts/desk/sheets/add-forms.js
//
// The sheet editor's two forms that bring things onto a sheet (Audit 6,
// LG6-2, taken out of `createSheetEditor` as my-sheets.js was): the passage
// form ("+ Passage", and the one under a card from the gap's "Add" pill),
// which reads a typed reference or a place from the notebook, and the
// "+ From my notes…" chooser (E62). Each draws into an element the editor
// gives it; where the parts go, and the change that adds them, stay the
// editor's, handed in as `host`:
//
// - `store` and `ctx`, as the editor has them, and `opCtx()`;
// - `sheet()`, the sheet shown now (read again after every wait, since the
//   leader may have moved on);
// - `addPassage(fields, target)`, the editor's own, which places a passage
//   and says so;
// - `change(op, options)`, `insertIndex(sheet)`, `say(text)`, `cards` (the
//   drawn cards by part id) and `focusNewPart(card)`, for the chooser's one
//   change.

import { canEdit } from "../../../lib/desk-records.mjs";
import { SHEET_LIMITS } from "../../../lib/desk-sheet-format.mjs";
import { addModule } from "../../../lib/desk-sheets.mjs";
import { fitModules, notAlreadyOn, notebookItems, partsFor } from "../../../lib/desk-sheet-from-notes.mjs";
import { passageForReference, passageFromRecord } from "../../../lib/desk-sheet-passages.mjs";
import { recordReference } from "../../../lib/desk-store-core.mjs";
import { describeRefusal } from "../../../lib/desk-sheet-ref-refusal.mjs";
import { parseReference } from "../../search-core.js";
import { bookKeyToLabel } from "../../../data/books.js";
import { loadChapterPage } from "../chapter-page.js";
import { make } from "../dom.js";
// The editor imports this file too; `button` is a function declaration, so
// the cycle is safe whichever file loads first.
import { button } from "./sheet-editor.js";

/** A chapter's anchor text, or null when it can't be read. */
async function chapterText(bookKey, chapter) {
  try {
    const source = await loadChapterPage(bookKey, chapter);
    return source.textBox ? source.anchorText() : null;
  } catch (_) {
    return null;
  }
}

/**
 * The "+ From my notes…" chooser (E62): the notebook's notes, highlights and
 * pinned footnotes on this sheet's passages (everything, newest first, on a
 * sheet with none yet), each with a box to tick; "Add" brings the ticked
 * ones on as parts in one change, so one Ctrl+Z takes them all back. A
 * question becomes a Question part, any other note or a pinned footnote becomes a Text part,
 * a highlight a passage (its chapter is read first, so part of a verse
 * keeps its words). What is already on the sheet is shown but can't be
 * ticked. The parts go after the part last worked in, else at the end.
 */
export async function openFromNotes(host, box, close) {
  box.hidden = false;
  box.replaceChildren(make("p", "desk-sheet__from-title", "From my notes"), make("p", "desk-sheet__empty", "Looking in your notebook…"));
  let records = [];
  try {
    records = await host.store.all();
  } catch (_) {}
  const sheet = host.sheet();
  if (box.hidden || !sheet) return;
  const items = notebookItems(sheet, records);
  const hasPassages = sheet.modules.some((m) => m?.type === "passage");
  box.replaceChildren(make("p", "desk-sheet__from-title", hasPassages ? "From my notes on this sheet’s passages" : "From my notes"));
  const cancel = button("Cancel", "desk-sheet__btn desk-sheet__btn--quiet");
  cancel.addEventListener("click", () => close(true));
  if (!items.length) {
    box.append(
      make("p", "desk-sheet__empty", hasPassages
        ? "None of your notes, highlights, or pinned footnotes fall on this sheet’s passages. Make one there, or add the passage they are on."
        : "Notes, highlights, and pinned footnotes you make will be listed here, to bring onto a sheet."),
      cancel,
    );
    cancel.focus();
    return;
  }
  box.append(make("p", "desk-sheet__empty", "Check what to bring. A question note becomes a Question part, any other note or a pinned footnote becomes a Text part, and a highlight becomes a passage."));
  const KIND = { question: "Question", note: "Note", highlight: "Highlight", footnote: "Footnote" };
  const picks = new Map();
  const go = button("Add", "desk-sheet__btn desk-sheet__btn--primary");
  go.disabled = true;
  const count = () => {
    const k = picks.size;
    go.textContent = k ? `Add ${k === 1 ? "1 part" : `${k} parts`}` : "Add";
    go.disabled = !k;
  };
  const ul = make("ul", "desk-sheet__from-list");
  items.forEach((it, i) => {
    const li = make("li");
    const label = make("label", "desk-sheet__from-item desk-sheet__pick");
    const tick = make("input");
    tick.type = "checkbox";
    tick.disabled = it.onSheet;
    label.append(tick, make("span", "desk-sheet__from-ref", recordReference(it.record)), make("span", "desk-sheet__from-kind", it.onSheet ? `${KIND[it.kind]} · on the sheet` : KIND[it.kind]));
    if (it.words) label.append(make("span", "desk-sheet__from-words", it.words.length > 90 ? it.words.slice(0, 89) + "…" : it.words));
    tick.addEventListener("change", () => {
      if (tick.checked) picks.set(i, it);
      else picks.delete(i);
      count();
    });
    li.append(label);
    ul.append(li);
  });
  const actions = make("div", "desk-sheet__add-row");
  actions.append(go, cancel);
  box.append(ul, actions);
  ul.querySelector("input:not(:disabled)")?.focus();
  go.addEventListener("click", async () => {
    const chosen = [...picks.values()];
    if (!chosen.length) return;
    go.disabled = true;
    // The highlights' chapters, so part of a verse keeps its words.
    const chapters = new Map();
    for (const it of chosen) {
      if (it.kind !== "highlight") continue;
      const key = `${it.record.bookKey} ${it.record.chapter}`;
      if (!chapters.has(key)) chapters.set(key, await chapterText(it.record.bookKey, it.record.chapter));
    }
    const now = host.sheet();
    if (box.hidden || !now || !canEdit(now)) return;
    const made = partsFor(chosen, { chapter: (r) => chapters.get(`${r.bookKey} ${r.chapter}`) ?? null, contentVersion: host.ctx().contentVersion });
    const fit = fitModules(now, made);
    if (!fit.modules.length) {
      host.say(`A sheet holds at most ${SHEET_LIMITS.modules} parts, so nothing more fits.`);
      go.disabled = false;
      return;
    }
    close(false);
    let added = fit.modules;
    host.change((s) => {
      // Checked and fitted again on the sheet as saved, which another tab may
      // have grown, or already put one of these on (PC8B-1).
      const parts = partsFor(notAlreadyOn(s, records, chosen), { chapter: (r) => chapters.get(`${r.bookKey} ${r.chapter}`) ?? null, contentVersion: host.ctx().contentVersion });
      added = fitModules(s, parts).modules;
      if (!added.length) return s;
      let at = host.insertIndex(s);
      return added.reduce((acc, m) => addModule(acc, m, at++, host.opCtx()), s);
    }, {
      announce: `${added.length === 1 ? "1 part" : `${added.length} parts`} added from your notes.${fit.dropped ? ` ${fit.dropped} more didn’t fit.` : ""}`,
      after: () => {
        const c = host.cards.get(added[0]?.id);
        c?.el.scrollIntoView({ block: "nearest" });
        host.focusNewPart(c);
      },
    });
  });
}

/**
 * The "+ Passage" form: a typed reference, or a place from the notebook.
 * `target` ({ after: id }) is where a card's form puts the passages it adds;
 * the bar's form has none and adds after the part last worked in.
 */
export async function openPassageForm(host, form, target = null, { focus = true } = {}) {
  form.replaceChildren();
  const line = make("form", "desk-sheet__ref");
  const input = make("input");
  input.type = "text";
  input.placeholder = "A reference, such as John 3:16–18";
  input.setAttribute("aria-label", "Passage to add");
  const go = make("button", "desk-sheet__btn", "Add");
  go.type = "submit";
  const problem = make("p", "desk-sheet__problem");
  problem.setAttribute("role", "alert");
  // A passage added again says so here, where the reader added it (BA75);
  // the pane's live region has already announced it.
  const note = make("p", "desk-sheet__empty");
  note.hidden = true;
  const added = (result) => {
    note.hidden = !result?.again;
    note.textContent = result?.again ? result.message : "";
  };
  line.append(input, go);
  line.addEventListener("submit", async (e) => {
    e.preventDefault();
    added(null);
    const typed = input.value.replace(/[–—]/g, "-");
    const ref = parseReference(typed);
    if (!ref) {
      problem.textContent = describeRefusal(typed, { parse: parseReference, label: bookKeyToLabel })
        ?? "That isn’t a reference the LIT can read. Try a book, a chapter, and verses, such as Romans 5:6–10.";
      return;
    }
    problem.textContent = "";
    const chapter = await chapterText(ref.bookKey, ref.chapter);
    const found = passageForReference(chapter, ref, host.ctx().contentVersion);
    if (found.problem) {
      problem.textContent = found.problem;
      return;
    }
    const result = await host.addPassage(found.fields, target);
    added(result);
    if (result) input.value = "";
  });
  form.append(line, problem, note);
  if (focus) input.focus(); // the field takes focus as the form opens (SH5-11), unless it opened by itself

  // From the notebook: its notes, highlights and bookmarks, newest first.
  const fromBook = make("div", "desk-sheet__from");
  fromBook.append(make("p", "desk-sheet__from-title", "From my notebook"));
  form.append(fromBook);
  let records = [];
  try {
    records = (await host.store.all())
      .filter((r) => ["note", "highlight", "bookmark"].includes(r.kind) && r.bookKey && Number.isInteger(r.verse))
      .sort((a, b) => String(b.modified ?? "").localeCompare(String(a.modified ?? "")))
      .slice(0, 40);
  } catch (_) {}
  if (!records.length) {
    fromBook.append(make("p", "desk-sheet__empty", "Notes, highlights, and bookmarks you make will be listed here."));
    return;
  }
  const ul = make("ul", "desk-sheet__from-list");
  const KIND = { note: "Note", highlight: "Highlight", bookmark: "Bookmark" };
  for (const r of records) {
    const li = make("li");
    const b = button("", "desk-sheet__from-item");
    const kind = r.kind === "note" && r.marker === "question" ? "Question" : KIND[r.kind];
    b.append(make("span", "desk-sheet__from-ref", recordReference(r)), make("span", "desk-sheet__from-kind", kind));
    const words = r.kind === "note" ? r.body : r.quote?.exact;
    if (words) b.append(make("span", "desk-sheet__from-words", words.length > 90 ? words.slice(0, 89) + "…" : words));
    b.addEventListener("click", async () => {
      const chapter = await chapterText(r.bookKey, r.chapter);
      const fields = passageFromRecord(r, chapter, host.ctx().contentVersion);
      added(null);
      if (fields) added(await host.addPassage(fields, target));
    });
    li.append(b);
    ul.append(li);
  }
  fromBook.append(ul);
}
