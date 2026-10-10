// src/scripts/desk/shell.js
//
// The Study Desk, as loaded by desk-gate.js on a computer with the preview
// switched on (STUDY-DESK.md, phase 1b). Everything the desk needs comes in
// through here, so none of it reaches a reader who hasn't switched it on.

// As text, added below as a <style>. A plain CSS import is gathered into
// every page's stylesheet by Astro, dynamic import or not, which would have
// every reader download the desk's styles.
import deskCss from "../../styles/desk.css?inline";
import { recordHref, recordReference, webClient } from "../../lib/desk-store-core.mjs";
import { openStore } from "./store.js";
import { createPanel } from "./panel.js";
import { initUndo } from "./undo-bar.js";
import { createHistory } from "./history.js";
import { initNoteSettings } from "./note-settings.js";
import { initActions } from "./actions.js";
import { createNotesMargin } from "./notes-margin.js";
import { createReadMarks } from "./read-marks.js";
import { openNoteEditor } from "./note-editor.js";
import { createVerseLabels } from "./verse-labels.js";
import { createHighlights } from "./highlights.js";
import { proseSource, studySource } from "./note-sources.js";
import { pageChapter } from "./page.js";
import { initProseActions } from "./prose-actions.js";
import { fitGlossaryTitles } from "./glossary-titles.js";

// Stamped at build by Layout.astro (src/lib/content-version.mjs, which reads
// the file system and so can't be imported here).
const contentVersion = document.documentElement.dataset.contentVersion || "unversioned";

/** What every record this page writes is stamped with. */
const ctx = () => ({ client: webClient(contentVersion), contentVersion });

/**
 * Go to a highlight's verse on this page by its ordinary address (`#v3`,
 * `#v3-5`): the address is pushed without the browser's own jump, and
 * chapter-tools, which lights the verses a hash names, is told by hand, since
 * pushing a state fires no hashchange. Then the verse is scrolled to a third
 * of the way down, as a note's place is (notes-margin.js).
 */
function goToVerse(record) {
  const href = recordHref(record);
  const hash = href?.slice(href.indexOf("#"));
  if (!hash) return;
  try {
    if (window.location.hash !== hash) history.pushState(history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
  } catch (_) {}
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  const verse = document.getElementById(`v${record.verse}`);
  if (!verse) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: window.scrollY + verse.getBoundingClientRect().top - window.innerHeight / 3,
    behavior: reduced ? "auto" : "smooth",
  });
}

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
  // Ctrl+Z for the notebook: from here on, what this tab writes can be taken
  // back, so it starts before anything can write.
  if (store) createHistory({ store, ctx });
  // A note opens in the editor from the margin or the panel's list.
  const edit = (record, trigger, restoreFocus = trigger) =>
    openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus });
  const addNote = (draft, trigger) =>
    openNoteEditor({ trigger, store, ctx, ref: recordReference(draft), draft, restoreFocus: trigger });
  let margin = null;
  let readMarks = null;
  const onThisChapter = (r) => {
    const here = pageChapter();
    return Boolean(here && r.bookKey === here.bookKey && r.chapter === here.chapter);
  };
  // What the change notice's "Show in the text" does (change-notice.js): a
  // note in the margin, a highlight to its verse, a glossary or article note
  // in its margin, and in Read View the verse in the book. `can` says whether
  // this page can, so the card offers the button only then.
  const showInText = {
    can: (r) => (margin ? (r.kind === "note" ? margin.canReveal(r) : onThisChapter(r)) : Boolean(readMarks?.canReveal(r))),
    go: (r) => {
      if (margin) {
        if (r.kind === "note") margin.reveal(r.id);
        else goToVerse(r);
      } else {
        readMarks?.reveal(r);
      }
    },
  };
  margin = store
    ? createNotesMargin({ store, onEdit: edit, source: studySource() ?? proseSource(), ctx, showInText })
    : null;
  readMarks = store && !margin ? createReadMarks({ store }) : null;
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
    ctx,
    showInText: store ? showInText : null,
  });
  initActions({ store, ctx, showVerse: panel.showVerse });
  initProseActions({ store, addNote });
  if (store) createVerseLabels({ store });
  // Painted on a Study View chapter or in Read View; after initNoteSettings,
  // so the switches are already on <html>.
  if (store) createHighlights({ store });
}

start();
