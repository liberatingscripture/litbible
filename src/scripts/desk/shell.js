// src/scripts/desk/shell.js
//
// The Study Desk, as loaded by desk-gate.js on a computer with the preview
// switched on (STUDY-DESK.md, phase 1b). Everything the desk needs comes in
// through here, so none of it reaches a reader who hasn't switched it on.

// As text, added below as a <style>. A plain CSS import is gathered into
// every page's stylesheet by Astro, dynamic import or not, which would have
// every reader download the desk's styles.
import deskCss from "../../styles/desk.css?inline";
import { recordReference, webClient } from "../../lib/desk-store-core.mjs";
import { openStore } from "./store.js";
import { createPanel } from "./panel.js";
import { initUndo } from "./undo-bar.js";
import { initNoteSettings } from "./note-settings.js";
import { initActions } from "./actions.js";
import { createNotesMargin } from "./notes-margin.js";
import { createReadMarks } from "./read-marks.js";
import { openNoteEditor } from "./note-editor.js";
import { createVerseLabels } from "./verse-labels.js";
import { proseSource, studySource } from "./note-sources.js";
import { initProseActions } from "./prose-actions.js";
import { fitGlossaryTitles } from "./glossary-titles.js";

// Stamped at build by Layout.astro (src/lib/content-version.mjs, which reads
// the file system and so can't be imported here).
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";

/** What every record this page writes is stamped with. */
const ctx = () => ({ client: webClient(contentVersion), contentVersion });

async function start() {
  const style = document.createElement("style");
  style.dataset.desk = "";
  style.textContent = deskCss;
  document.head.append(style);
  // First, before the notebook opens, so the glossary's headings settle as
  // early as they can.
  if (document.querySelector(".glossary-entries")) fitGlossaryTitles();

  let store = null;
  let storeError = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    storeError = err;
  }
  initNoteSettings();
  initUndo();
  // A note opens in the editor from the margin or the panel's list.
  const edit = (record, trigger, restoreFocus = trigger) =>
    openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus });
  const addNote = (draft, trigger) =>
    openNoteEditor({ trigger, store, ctx, ref: recordReference(draft), draft, restoreFocus: trigger });
  const margin = store
    ? createNotesMargin({ store, onEdit: edit, source: studySource() ?? proseSource() })
    : null;
  const readMarks = store && !margin ? createReadMarks({ store }) : null;
  // What the panel's links can do without leaving the page: Study View
  // shows a note on its chapter; Read View scrolls to a verse in its book.
  const here = margin ?? readMarks;
  const panel = createPanel({
    store,
    storeError,
    onEdit: store ? edit : null,
    onAddNote: store ? addNote : null,
    goHere: here
      ? { can: (r) => here.canReveal(r), go: (r) => (margin ? margin.reveal(r.id) : readMarks.reveal(r)) }
      : null,
  });
  initActions({ store, ctx, showVerse: panel.showVerse });
  initProseActions({ store, addNote });
  if (store) createVerseLabels({ store });
}

start();
