// src/scripts/desk/shell.js
//
// The Study Desk on a reading page, stage two: loaded and started by the
// first stage (first-stage.js, which desk-gate.js loads on a computer with
// the preview switched on) once there is something to draw or the reader
// reaches for the Notebook (Audit 3, LG3-2). Everything the Notebook needs
// comes in through here, so none of it reaches a reader who hasn't switched
// the desk on, and a reader with nothing kept gets it only on asking.

import { onFootnote } from "../../lib/desk-records.mjs";
import { recordHref, recordReference } from "../../lib/desk-store-core.mjs";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { openStore } from "./store.js";
import { createPanel } from "./panel.js";
import { initGreekLink } from "./greek-link.js";
import { initUndo } from "./undo-bar.js";
import { createHistory } from "./history.js";
import { initNoteSettings } from "./note-settings.js";
import { initActions } from "./actions.js";
import { createNotesMargin } from "./notes-margin.js";
import { createReadMarks } from "./read-marks.js";
import { openBookmarkForm } from "./bookmark-form.js";
import { openNoteEditor } from "./note-editor.js";
import { createVerseLabels } from "./verse-labels.js";
import { createHighlights } from "./highlights.js";
import { proseSource, studySource } from "./note-sources.js";
import { pageChapter } from "./page.js";
import { standDown } from "../desk-frame.js";
import { initProseActions } from "./prose-actions.js";
import { initPins } from "./pins.js";
import { initBookmarkFollow } from "./bookmark-follow.js";
import { showPausedBar } from "./bookmark-stop.js";
import { createTour } from "./tour.js";
import { initCommands } from "./commands.js";
import { createPrintNotes } from "./print-notes.js";
import { createPrintPart } from "./print-part.js";
import { createPrintRoom } from "./print-room.js";
import { initPrintLink } from "./print-link.js";

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

// Whether the Notebook came up. Past that, a failure is logged and the rest
// keeps working; before it, there is no Notebook for the narrowed column and
// the buttons to belong to, so the page stands down (BA29).
let panelUp = false;
// What the first stage needs once the Notebook is up: the panel's API.
let api = null;

async function start({ handOver }) {
  addDeskStyle();

  let store = null;
  let storeError = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    storeError = err;
  }
  // Where this browser keeps no notebook, the search box's commands leave out
  // what needs one (notebook-search.js, which the shell doesn't load; BA34).
  if (!store) document.documentElement.setAttribute("data-desk-no-notebook", "");
  initNoteSettings();
  initUndo();
  // Ctrl+Z for the notebook: from here on, what this tab writes can be taken
  // back, so it starts before anything can write.
  if (store) createHistory({ store, ctx });
  // A note opens in the editor from the margin or the panel's list, and a
  // bookmark in its own small form (its name, "Move as I read"; E9).
  const edit = (record, trigger, restoreFocus = trigger) =>
    record.kind === "bookmark"
      ? openBookmarkForm({ trigger, store, ctx, record, restoreFocus })
      : openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus });
  const addNote = (draft, trigger) =>
    openNoteEditor({ trigger, store, ctx, ref: recordReference(draft), draft, restoreFocus: trigger });
  let margin = null;
  let readMarks = null;
  let pins = null;
  const onThisChapter = (r) => {
    const here = pageChapter();
    return Boolean(here && r.bookKey === here.bookKey && r.chapter === here.chapter);
  };
  // What the change notice's "Show in the text" does (change-notice.js): a
  // note in the margin, a highlight to its verse, a pinned footnote to its
  // note in the Footnotes list, a glossary or article note in its margin, and
  // in Read View the verse in the book. A note on a footnote (M11) goes to
  // its margin note, which sits beside the footnote in the Footnotes list;
  // where there is no margin it is shown as a pin is. `can` says whether
  // this page can, so the card offers the button only then.
  const showInText = {
    can: (r) =>
      r.kind === "footnotePin"
        ? Boolean(pins?.canReveal(r))
        : onFootnote(r)
          ? Boolean(pins?.canReveal(r)) && (margin ? margin.canReveal(r) : true)
          : margin
            ? (r.kind === "note" ? margin.canReveal(r) : onThisChapter(r))
            : Boolean(readMarks?.canReveal(r)),
    go: (r) => {
      if (r.kind === "footnotePin" || (onFootnote(r) && !margin)) {
        pins?.reveal(r);
      } else if (margin) {
        if (r.kind === "note") margin.reveal(r.id);
        else goToVerse(r);
      } else {
        readMarks?.reveal(r);
      }
    },
  };
  margin = store
    ? createNotesMargin({
        store,
        onEdit: edit,
        source: studySource() ?? proseSource(),
        ctx,
        showInText,
        // The panel is built after the margin; "N more notes" opens This verse
        // through it once it is up (GF8b-6).
        showVerse: (verse) => api?.panel?.showVerse?.(verse),
      })
    : null;
  readMarks = store && !margin ? createReadMarks({ store }) : null;
  // Before the panel: its tabs ask for Pin buttons as they draw.
  pins = initPins({ store, ctx });
  // What the panel's links can do without leaving the page: Chapter View
  // shows a note on its chapter; Read View scrolls to a verse in its book.
  const here = margin ?? readMarks;
  // "Print with my notes" (M6): the panel's button and the command both start it.
  const printNotes = createPrintNotes({ store });
  // "Print with room to write" (N9): the blank version, which reads no notebook.
  const printRoom = createPrintRoom();
  // The first stage's tab gives way in the same task as the panel's own is
  // placed, so nothing paints between and nothing moves.
  handOver?.();
  const panel = createPanel({
    store,
    printNotes,
    printRoom,
    storeError,
    onEdit: store ? edit : null,
    onAddNote: store ? addNote : null,
    goHere: here
      ? {
          // On Chapter View a note on a footnote can be shown only while its
          // footnote is there; Read View has no footnotes and goes to the verse.
          can: (r) => here.canReveal(r) && (!margin || !onFootnote(r) || Boolean(pins?.canReveal(r))),
          go: (r) => (margin ? margin.reveal(r.id) : readMarks.reveal(r)),
        }
      : null,
    ctx,
    showInText: store ? showInText : null,
  });
  panelUp = true;
  api = { panel };
  // "Print ▸" in the verse menu and the selection panel (E40).
  // Each part starts on its own, as each tab of the panel does: one that fails
  // is logged and the rest still start (NB8-10).
  const printPart = tryStart("the Print menu in the verse menu", () => createPrintPart({ store, printNotes }));
  tryStart("the verse menu rows", () => initActions({ store, ctx, showVerse: panel.showVerse, printPart }));
  tryStart("the bookmark follower", () => initBookmarkFollow({ store, ctx, tell: showPausedBar }));
  tryStart("the commands", () => initCommands({ panel, printNotes, printRoom }));
  tryStart("the Greek link", () => initGreekLink({ panel }));
  tryStart("the notes on articles", () => initProseActions({ store, addNote }));
  // The tour (D8): started by the reader, never by itself (tour.js).
  tryStart("the tour", () => createTour({ panel, canKeep: Boolean(store) }));
  if (store) tryStart("the verse labels", () => createVerseLabels({ store }));
  // Painted on a Chapter View chapter or in Read View; after initNoteSettings,
  // so the switches are already on <html>.
  if (store) tryStart("the highlights", () => createHighlights({ store }));
  // A chapter opened from /desk's Print menu prints itself (print-link.js).
  tryStart("print from a link", () => initPrintLink({ printNotes, printRoom }));
  return api;
}

/** Run one start-up step; a failure is logged and the next step still runs. */
function tryStart(what, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`Study Desk: ${what} didn't start`, err);
    return null;
  }
}

/**
 * Start the Notebook (once). Resolves with `{ panel }` once it is up, even if
 * something after the panel failed (that is only logged), or null when it
 * failed before the panel was built, in which case the page has stood down.
 * `handOver` is the first stage's: it takes its own tab away just before the
 * panel draws its own.
 */
let started = null;
export function startShell({ handOver = null } = {}) {
  started ??= start({ handOver }).catch((err) => {
    console.error("Study Desk: the notebook didn't start", err);
    if (!panelUp) standDown();
    return api;
  });
  return started;
}
