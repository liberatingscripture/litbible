// src/scripts/desk/sheets/sheet-editor.js
//
// The sheet editor (STUDY-DESK.md, S1; "Order of work", 3f), which /desk's
// Sheets pane holds (sheet-pane.js). What only a pane has is the host's and
// handed in (S12, part 1, step 1): which sheet it shows (`getSheet`,
// `setSheet`), the suffix that keeps its ids apart, moving a LIT pane to a
// passage, and hearing when the sheet shown changes (`onSheetChange`, which
// the pane's "Add to sheet" target follows). A sheet is one record (STUDY-DESK-FORMAT.md, "Sheets (kind
// 9)"), changed only through src/lib/desk-sheets.mjs and saved like any other
// record, so trash, undo (Ctrl+Z and the undo bar), merging and other tabs
// all work as they do for notes. Built to run inside another page: it takes
// its store, context and a place to remember which sheet it shows, and draws
// nothing outside its own element.
//
// - **The editor shows one sheet, or the list of them.** Which one is the
//   host's to keep (on /desk, the layout's `setPaneSheet`), so the page
//   opens on it again.
// - **Passages come from the live text** (format rule 1): a passage module
//   holds a reference, and its words are read from the chapter's Chapter View
//   page whenever it is drawn (desk-sheet-passages.mjs's locatePassage). They
//   are added from the LIT pane's verse menu or a selection ("Add to sheet",
//   offered while a sheet is open), by typing a reference, or from the
//   notebook's notes, highlights and bookmarks.
// - **Your own text between**, formatted, in text and question modules
//   (sheet-text.js); a question has its answer (always the leader's) and
//   lines to write on; space to write and page breaks too.
// - **What the sheet knows about the LIT** (3h; sheet-lit.js): a passage's
//   blanks and which of its footnotes print, the key terms box, and the
//   license card with the commercial check. Those cards are told whenever the
//   sheet changes (`sheetChanged`), since each reads the rest of the sheet.
// - **New sheets start from a template** (M9; desk-sheet-templates.mjs): New
//   sheet opens a short list in place, and a choice makes the sheet. The
//   title menu's "New sheet…" opens the same list (`newSheet`, which the
//   pane calls on `desk:sheet-new`).
// - **The list of sheets is my-sheets.js** (Audit 6, LG6-2): "My sheets" and
//   "My templates", their rows' Duplicate, Save as template and Delete, and
//   the template chooser. `showList` here clears the sheet view and hands it
//   `listHost`.
// - **The passage form and "+ From my notes…" are add-forms.js** (Audit 6,
//   LG6-2): they read a reference or the notebook and draw their choices;
//   where a part goes, and the change that adds it, are handed in as
//   `addHost`.
// - **The add bar is add-bar.js, and each card's body is part-cards.js**
//   (Audit 6, LG6-2): the bar's buttons and the two forms under it, and a
//   passage, text, question, space or key terms body with the header's
//   minutes and Leader only. The card around a body (`buildCard`: its Move
//   and Remove, dragging, the gap's pill) stays here, handing `cardHost`.
// - **A template's parts hold no text, only a prompt** (SH5-2): an empty
//   part shows its module's `prompt` as the editor's placeholder, and a part
//   holding only its heading shows it dimmed under the heading, until the
//   leader types there (or, under a heading, a passage follows it). The
//   prompt is the module's own field, which nothing prints, copies or
//   presents, so the reading part's "Add the passage with + Passage" may
//   name the editor's tools (BA70).
// - **A new part goes right after the part last worked in** (last focused or
//   clicked on this sheet), or at the end when there is none. **A passage
//   goes where the sheet says, not where the leader last clicked** (SH5-3):
//   right after the part last worked in only when that part is itself a
//   passage, so a second passage follows the one being edited; otherwise
//   after the last passage, or on a sheet with none, after the template's
//   reading part, so it lands under "Reading", not after "Closing" (BA69),
//   else at the end.
// - **Drag into order** by a module's header (BVJ, 2026-11-08; the grip
//   alone until then), or Move up and Move down.
// - **Saves as you go**: every change is saved at once, typing a moment after
//   it pauses. A change made elsewhere (another pane on the same sheet,
//   another tab, an undo) redraws only the modules it touched, and never the
//   one being typed in.
// - **Except in the Sheets tour's example mode** (E63; `setExample`,
//   `endExample`; sheets/sheet-tour.js): there a change is made in memory and
//   the sheet stays an unwritten draft, which nothing writes (`persistDraft`
//   does nothing), so the sheet the tour shows goes when it ends.

import { plannedTotal } from "../../../lib/desk-present.mjs";
import { canEdit } from "../../../lib/desk-records.mjs";
import { MODULE_TYPES, SHEET_LIMITS } from "../../../lib/desk-sheet-format.mjs";
import {
  addModule,
  createSheet,
  isOwnTemplate,
  sheetFromTemplate,
  makeModule,
  moveModule,
  planSheetChange,
  removeModule,
  setSheetFields,
  sheetTooBig,
  updateModule,
} from "../../../lib/desk-sheets.mjs";
import { readingPart, templateModules } from "../../../lib/desk-sheet-templates.mjs";
import {
  passageInsertIndex,
  passageLabel,
  passageReference,
  samePassage,
  sortSheets,
} from "../../../lib/desk-sheet-passages.mjs";
import { undoEntry } from "../history.js";
import { createLicenseCard } from "./sheet-lit.js";
import { addEditor, editedElsewhere } from "./sheet-tabs.js";
import { changedUnderReader } from "../../../lib/desk-sheet-tabs.mjs";
import { showUndo } from "../undo-bar.js";
import { redraw } from "../focus-keep.js";
import { make } from "../dom.js";
import { openInsertMenu as openInsertMenuAt } from "./insert-menu.js";
import { listProblem, mySheetsList } from "./my-sheets.js";
import { openPassageForm } from "./add-forms.js";
import { createAddBar } from "./add-bar.js";
import { cardBody, cardTools, promptOf } from "./part-cards.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const TYPE_NAMES = {
  passage: "Passage",
  text: "Your text",
  question: "Question",
  space: "Space to write",
  keyTerms: "Key terms box",
  pageBreak: "Page break",
};

/** How long typing in the title waits before it is saved. */
const TITLE_DELAY = 500;

export function button(label, cls = "desk-sheet__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

let hintCount = 0;

/** A text part holding one heading and nothing else. */
const LONE_HEADING = /^<h[1-6]>[^<]*<\/h[1-6]>$/;
/** A text part's opening heading ("Opening", "The text"), or null: what the gap's pill and its form call the part. */
const headingOf = (m) => (m?.type === "text" && typeof m.html === "string" && /^<h[1-6]>([^<]*)<\/h[1-6]>/.exec(m.html)?.[1]?.replace(/\s+/g, " ").trim()) || null;

/**
 * The prompt a text part shows under its heading (SH5-2, SH5-4): its own
 * `prompt` while its text is exactly one heading and the part after it isn't
 * a passage (which fills it, as the reading part's passage does); else "".
 * An empty part shows its prompt as the placeholder instead.
 */
function headingPrompt(m, next) {
  if (m?.type !== "text" || typeof m.html !== "string" || !LONE_HEADING.test(m.html)) return "";
  if (next?.type === "passage") return "";
  return promptOf(m, "prompt");
}

/**
 * A sentence a control's `title` carries, given to a screen reader as well
 * (CP-9): a hidden span the control is described by, which the caller puts
 * in the page. The title stays, for a mouse.
 */
export function describe(control, text) {
  const hint = make("span", "sr-only", text);
  hint.id = `deskSheetHint${++hintCount}`;
  control.setAttribute("aria-describedby", hint.id);
  return hint;
}

const json = (x) => JSON.stringify(x);

/* ── The editor ───────────────────────────────────────────────────────── */

/**
 * @param {{ store: object | null, ctx: () => { client: string, contentVersion: string },
 *   idSuffix: string, getSheet: () => string | null, setSheet: (id: string | null) => void,
 *   showPassage?: ((passage: object) => void) | null, onSheetChange?: () => void,
 *   onList?: (() => void) | null, onDone?: ((id: string) => void) | null }} options
 *   `getSheet` and `setSheet` are which sheet the editor shows, kept by the host;
 *   `idSuffix` keeps its element ids apart from another editor's on the page;
 *   `showPassage` moves the LIT pane to a passage, where there is one;
 *   `onSheetChange` is called whenever the sheet shown, or its record, changes;
 *   `onList` is a host's own list of sheets, shown instead of the editor's
 *   (/sheets/); `onDone` is a host's own view of the sheet, which a Done
 *   button returns to once the sheet is saved, in place of "Present…" and
 *   "Print or share…" (/sheets/?id=). `askFirst: false` skips the two-tab
 *   question for the first sheet opened (the pane's "Open on its own page").
 *   `onTour` starts the Sheets tour, and puts its link at the foot of the
 *   list (the Sheets pane's; /sheets/ passes none).
 * @returns {{ el: HTMLElement, sheet: () => object | null, persist: () => void,
 *   contentVersion: () => string, addPassage: (fields: object, target?: object | null) => Promise<false | { message: string, again: boolean }>,
 *   newSheet: () => Promise<void>, startFrom: (template: string | object) => void,
 *   showList: (options?: { focus?: string | null, chooser?: boolean }) => Promise<void>,
 *   setExample: (on: boolean) => void, endExample: () => void, destroy: () => void }}
 *   `showList` shows the list of sheets in place; `setExample` and `endExample`
 *   are the Sheets tour's (E63).
 */
export function createSheetEditor({ store, ctx, idSuffix, getSheet, setSheet, showPassage = null, onSheetChange = () => {}, onList = null, onDone = null, onCancel = null, onTour = null, askFirst = true }) {
  const el = make("div", "desk-sheet");
  const live = make("p", "sr-only");
  live.setAttribute("aria-live", "polite");
  const content = make("div", "desk-sheet__content");
  el.append(live, content);

  const say = (text) => {
    live.textContent = "";
    requestAnimationFrame(() => { live.textContent = text; });
  };

  if (!store) {
    content.append(make("p", "desk-pane__later", "This browser isn’t letting the site keep a notebook, so sheets can’t be saved here. Private windows sometimes don’t. Open the site in a regular window to keep sheets."));
    return {
      el,
      sheet: () => null,
      persist() {},
      contentVersion: () => ctx().contentVersion,
      addPassage: async () => false,
      async newSheet() {},
      startFrom() {},
      async showList() {},
      setExample() {},
      endExample() {},
      destroy() {},
    };
  }

  let sheet = null; // the sheet shown, as last read or saved
  // A new sheet not yet written (Audit 6, SH6-7; BVJ, 2026-11-08): New sheet
  // shows it and writes it with its first change, so comparing templates by
  // opening them leaves no "Untitled sheet" behind. From then on it saves as
  // any sheet does.
  let draft = null;
  // The Sheets tour's example mode (E63): changes are made in memory and
  // nothing is written (`setExample`).
  let example = false;
  let lastModule = null; // the part last focused or clicked on this sheet
  // The gap pills are one Tab stop for the whole sheet (Audit 6, DK6-1; BVJ,
  // 2026-11-08): the pill under this part takes Tab, the others -1, and the
  // up and down arrows, Home and End move between them (`syncGapStop`).
  let gapStop = null;
  let insertMenu = null; // the gap pill's open menu: { close(refocus) } (DK6-2)
  const closeInsertMenu = () => insertMenu?.close(false);
  // The passage form open under a card, from the gap's "Add" pill (BVJ,
  // 2026-11-08): `after` is that card's part, `target` where its next passage
  // goes (moved on past each one added, so several land in order), and `el`
  // the form, put back on the card whenever the card is drawn again.
  let insertForm = null;
  // The reading part whose form, opened by itself, the leader closed with ×
  // or Escape on this sheet, so it stays closed until the sheet is opened again.
  let readingDismissed = null;
  let destroyed = false;
  let seq = 0; // bumped when the pane switches between the list and a sheet
  const now = () => new Date().toISOString();
  const opCtx = () => ({ now: now(), ...ctx() });

  /**
   * Where a new part goes: after the part last worked in, else at the end.
   * A passage follows the part last worked in only when that part is a
   * passage; otherwise it goes where passageInsertIndex puts it (BA69, SH5-3).
   */
  const insertIndex = (s, { passage = false } = {}) => {
    const at = lastModule ? s.modules.findIndex((x) => x.id === lastModule) : -1;
    if (passage) return at >= 0 && s.modules[at]?.type === "passage" ? at + 1 : passageInsertIndex(s);
    return at >= 0 ? at + 1 : s.modules.length;
  };

  const me = {
    sheet: () => sheet,
    persist: () => persistDraft(),
    contentVersion: () => ctx().contentVersion,
    /**
     * Add a passage after the part last worked in, or, given a `target`
     * ({ after: id }, a card's passage form), right after that part; the
     * target is moved on to the passage added, so the next lands after it.
     * Resolves false when it wasn't added, else { message, again }: the one
     * message saying so, which is announced. Adding one already on the sheet
     * adds it again and says so in that same message, never in a second one,
     * and the caller shows it, so it is seen as well as heard (BA75).
     */
    addPassage: async (fields, target = null) => {
      if (!sheet || !canEdit(sheet)) return false;
      const again = sheet.modules.some((m) => m.type === "passage" && samePassage(m, fields));
      const message = `${passageReference(fields)} added${again ? " again; it was already on the sheet" : ""}.`;
      const mod = makeModule("passage", fields);
      const where = (s) => {
        const i = target?.after ? s.modules.findIndex((x) => x.id === target.after) : -1;
        return i >= 0 ? i + 1 : insertIndex(s, { passage: true });
      };
      const ok = await change((s) => addModule(s, mod, where(s), opCtx()), {
        announce: message,
        after: () => cards.get(mod.id)?.el.scrollIntoView({ block: "nearest" }),
      });
      if (ok && target) target.after = mod.id;
      return ok && { message, again };
    },
  };

  // ---- saving ----

  let saving = Promise.resolve();
  /** The changes asked for whose write hasn't landed, in the order asked (BA72). */
  const pending = new Set();
  const status = make("span", "desk-sheet__saved");
  // Saving… and Saved are for the eye: each autosave would otherwise be read
  // out between a typist's phrases (DK-14). A failure is said through `say`.
  status.setAttribute("aria-hidden", "true");

  /**
   * Apply an operation to the sheet and save it. Saves run one after
   * another, each on the sheet as the notebook holds it. Resolves true when
   * the change was saved (or changed nothing). `source` is the module whose
   * own card made the change, which then isn't redrawn: it already shows it,
   * and redrawing would drop a click on its buttons that is under way.
   */
  // `quiet` is for a write the reader didn't make (a passage's first
  // comparison copy, S2): saved without an undo step, so Ctrl+Z never takes
  // it away only to have it written straight back.
  //
  // The operation is applied to the sheet as the notebook holds it, read in
  // the same transaction as the write, never to this pane's copy (BA129):
  // another tab may have saved the sheet's other parts since this one last
  // heard, and its message may never come (a frozen tab, no
  // BroadcastChannel). And `sheet` changes only once a save has landed, so a
  // save that fails leaves the pane on the last saved copy and every later
  // edit still saves (BA128).
  //
  // The write starts when the change is asked for, not once the saves before
  // it have landed: a tab being closed runs nothing after that (BA72), and the
  // store opens its transaction before its first await. IndexedDB runs
  // transactions on the same records in the order they were opened, each
  // reading the sheet as the one before left it, so the saves still land one
  // after another; only this pane's bookkeeping waits its turn.
  function change(op, { announce = null, after = null, source = null, quiet = false } = {}) {
    if (destroyed || !sheet) return Promise.resolve(false);
    if (example) return Promise.resolve(changeInMemory(op, { after, source }));
    const n = seq;
    const id = sheet.id;
    // A new sheet's first change writes it first, as its own undo step, so
    // undoing the change leaves the sheet; should that write fail, the change
    // is made over the unsaved sheet instead.
    const base = draft;
    persistDraft();
    const write = store.change(
      async ({ get }) => {
        const plan = planSheetChange((await get(id)) ?? base, op);
        if (plan.changed && !quiet) status.textContent = "Saving…";
        return plan;
      },
      { record: !quiet },
    );
    write.catch(() => {}); // reported below, in turn
    const asked = { op, id };
    pending.add(asked);
    const landed = () => pending.delete(asked);
    write.then(landed, landed);
    const run = saving.then(async () => {
      let made;
      try {
        made = await write;
      } catch (err) {
        console.error("Study Desk: the sheet couldn’t be saved", err);
        if (n === seq && !destroyed) failed(err, source);
        return false;
      }
      if (n !== seq || destroyed) return false;
      if (made.gone) {
        // Deleted here or in another tab.
        toList();
        return false;
      }
      if (made.refused) {
        console.error("Study Desk: the sheet refused a change", made.refused);
        // Seen beside Saved as well as heard, as a failed save is (CP-13).
        const why = made.refused.message ?? "";
        status.textContent = /holds at most \d+ modules/.test(why)
          ? `A sheet holds at most ${SHEET_LIMITS.modules} parts.`
          : /at most one key terms/.test(why)
            ? "A sheet has one key terms box, and it has one already."
            : "That change couldn’t be made, so the sheet is as it was. Reload the page, then try again.";
        say(status.textContent);
        return false;
      }
      const moved = json(made.sheet) !== json(sheet);
      sheet = made.sheet;
      if (moved) onSheetChange();
      if (made.changed && !quiet) status.textContent = "Saved";
      if (source && made.changed) {
        const card = cards.get(source);
        const m = sheet.modules.find((x) => x.id === source);
        if (card && m) card.json = json(m);
      }
      if (moved) draw();
      if (!made.changed) return true;
      after?.();
      if (announce) say(announce);
      return true;
    });
    saving = run.catch(() => false);
    return run;
  }

  /**
   * A change in the Sheets tour's example mode (E63; `setExample`): planned
   * over the sheet shown, which stays an unwritten draft, and drawn. Nothing
   * is saved, said, or put in the history, so the tour's sheet goes when it
   * ends. True when it was made (or changed nothing), false when the sheet
   * refused it.
   */
  function changeInMemory(op, { after = null, source = null } = {}) {
    const plan = planSheetChange(sheet, op);
    if (plan.gone || plan.refused) return false;
    if (!plan.sheet || !plan.changed) return true;
    sheet = plan.sheet;
    draft = sheet;
    onSheetChange();
    // As when a save lands: the card that made the change already shows it.
    if (source) {
      const card = cards.get(source);
      const m = sheet.modules.find((x) => x.id === source);
      if (card && m) card.json = json(m);
    }
    draw();
    after?.();
    return true;
  }

  /**
   * A save failed, so nothing of it was kept: say why, and put the part that
   * made it back to its saved text, so the page shows what a reload would
   * (BA128).
   */
  function failed(err, source) {
    status.textContent = sheetTooBig(err)
      ? `Not saved: this sheet is too big to save (${SHEET_LIMITS.bytes / 1024} KB). Remove some text or blanks.`
      : source && cards.has(source)
        ? "Not saved, so that change was taken back. Try it again."
        : "That change wasn’t saved. Try it again.";
    say(status.textContent);
    const card = source ? cards.get(source) : null;
    if (!card || !sheet || !moduleList) return;
    const focused = card.inst?.hasFocus?.();
    card.inst?.destroy?.();
    card.el.remove();
    cards.delete(source);
    draw();
    if (focused) cards.get(source)?.inst?.focus?.();
  }

  /**
   * Read the sheet again, for a change made elsewhere, and redraw what moved.
   * Also run when the tab comes back into view, since a frozen tab, or one
   * without BroadcastChannel, never hears another tab's save (BA129).
   * `origin` is the store's: "this-tab" is another Sheets pane here.
   */
  async function refresh(origin = "other-tab") {
    if (!sheet || draft) return;
    await saving;
    if (!sheet) return;
    const n = seq;
    let record = null;
    try {
      record = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (n !== seq || destroyed || !sheet) return;
    if (record?.kind !== "sheet") {
      // Deleted here or in another tab.
      toList();
      return;
    }
    if (json(record) === json(sheet)) return;
    sheet = record;
    onSheetChange();
    draw(origin === "this-tab" ? "pane" : "tab");
  }

  // ---- the list of sheets ----

  /** Back to the sheets: the host's list where it has one, else the editor's. */
  function toList(options) {
    setSheet(null);
    if (onList) onList();
    else showList(options);
  }

  // What the list view (my-sheets.js) is handed: the editor's own pieces.
  const listHost = { store, opCtx, idSuffix, say, content, openSheet, startFrom, showList, onTour };

  async function showList({ focus = null, chooser: openChooser = false } = {}) {
    const n = ++seq;
    sheet = null;
    draft = null;
    onSheetChange();
    lastModule = null;
    closeInsertMenu();
    closeInsertForm(false);
    for (const card of cards.values()) card.inst?.destroy?.();
    cards.clear();
    license = null;
    addBarView = null;
    // The button just pressed is gone with the view it was in, so the list
    // names where focus goes (DK-3); "loading" holds it meanwhile.
    const loading = make("p", "desk-sheet__status", "Loading your sheets…");
    redraw(content, [loading]);
    let all = [];
    try {
      all = (await store.all()).filter((r) => r.kind === "sheet");
    } catch (err) {
      console.error("Study Desk: couldn't read the sheets", err);
    }
    if (n !== seq || destroyed) return;
    // The reader's own templates are sheet records too (Audit 5, D #1); they
    // are listed apart, and New sheet offers them.
    const mine = sortSheets(all.filter(isOwnTemplate));
    all = all.filter((r) => !isOwnTemplate(r));
    const { list, chooser, heading: h } = mySheetsList(listHost, { sheets: all, mine });
    const target = focus ? list.querySelector(`[data-focus-key="${CSS.escape(focus)}"]`) : null;
    const moved = redraw(content, [list], { fallback: () => target ?? h, force: Boolean(focus) });
    if (focus && moved) say(moved === target || moved === h ? "My sheets" : "");
    // The title menu's "New sheet…": the list, with the templates open and
    // focus on the first.
    if (openChooser && chooser.hidden) chooser.toggle();
  }

  /** Start a sheet from a built-in template; it is written with its first change (SH6-7). */
  function newSheet(template = "blank") {
    openDraft(createSheet({ template, modules: templateModules(template) }, opCtx()));
  }

  /** A choice in the template chooser: a built-in template's id, or one of the reader's own. */
  function startFrom(template) {
    ++seq; // the first view is this one, even while an own template is read
    if (typeof template === "string") newSheet(template);
    else newFromOwn(template);
  }
  me.startFrom = startFrom;
  me.showList = showList;

  /** Make a sheet from one of the reader's own templates and open it. */
  async function newFromOwn(template) {
    let s = null;
    try {
      s = sheetFromTemplate((await store.get(template.id)) ?? template, opCtx());
    } catch (err) {
      console.error("Study Desk: couldn't make a sheet from a template", err);
      listProblem(listHost, "The sheet couldn’t be made in this browser. Try again in a moment.");
      return;
    }
    openDraft(s);
  }

  // ---- one sheet ----

  const cards = new Map(); // module id → { el, json, inst }
  // What the passage form and "+ From my notes…" (add-forms.js) are handed.
  const addHost = {
    store,
    ctx,
    opCtx,
    say,
    cards,
    sheet: () => sheet,
    addPassage: (fields, target) => me.addPassage(fields, target),
    change,
    insertIndex,
    focusNewPart,
  };
  // What a card's body and header controls (part-cards.js) are handed.
  const cardHost = {
    readOnly: () => readOnly,
    sheet: () => sheet,
    change,
    opCtx,
    say,
    idSuffix,
    showPassage,
  };
  let header = null;
  let moduleList = null;
  let titleInput = null;
  let subtitleInput = null;
  let plannedLine = null;
  let readOnly = false;
  let license = null;
  let addBarView = null; // the add bar under the parts (add-bar.js)

  /** What a card's head shows, which an in-place update can't redraw. */
  const headKey = (m) => json([m.type, m.leaderOnly === true, m.minutes ?? null, m.type === "passage" ? passageReference(m) : null]);

  async function openSheet(id, { focusTitle = false } = {}) {
    const n = ++seq;
    let record = null;
    try {
      record = await store.get(id);
    } catch (_) {}
    if (n !== seq || destroyed) return;
    if (record?.kind !== "sheet") {
      toList();
      return;
    }
    // Another tab editing this sheet: ask before showing the editor (S12,
    // part 4; BVJ, 2026-11-08). Cancel leaves things as they were: the
    // host's own view of the sheet, else the list.
    // Not when the reader sent it here from a Sheets pane ("Open on its own
    // page"): that tab is the other one, and they meant it.
    const ask = askFirst;
    askFirst = true;
    if (ask && canEdit(record) && (await editedElsewhere(id))) {
      if (n !== seq || destroyed) return;
      if (!(await askContinue(n))) {
        if (n !== seq || destroyed) return;
        if (onCancel) onCancel(id);
        else toList({ focus: `open-${id}` });
        return;
      }
      if (n !== seq || destroyed) return;
      try {
        record = (await store.get(id)) ?? record; // as it stands after the wait
      } catch (_) {}
      if (n !== seq || destroyed) return;
    }
    setSheet(id);
    showSheet(record, { focusTitle: focusTitle || asked.has(n) });
  }

  /** The views that asked the question, whose title then takes focus from Continue. */
  const asked = new Set();

  /** "Already open in another tab": resolves true for Continue, false for Cancel. */
  function askContinue(n) {
    asked.add(n);
    return new Promise((resolve) => {
      const box = make("div", "desk-sheet__ask");
      const text = make("p", "desk-sheet__ask-text", "This sheet is already open in another tab. Continue here?");
      text.id = `deskSheetAsk-${idSuffix}`;
      box.setAttribute("role", "group");
      box.setAttribute("aria-labelledby", text.id);
      const go = button("Continue", "desk-sheet__btn desk-sheet__btn--primary");
      const no = button("Cancel", "desk-sheet__btn desk-sheet__btn--quiet");
      const hint = describe(go, "Changes made in either tab show in the other.");
      go.addEventListener("click", () => resolve(true));
      no.addEventListener("click", () => resolve(false));
      box.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        resolve(false);
      });
      const row = make("div", "desk-sheet__ask-row");
      row.append(go, no);
      box.append(text, row, hint);
      redraw(content, [box], { fallback: () => go, force: true });
    });
  }

  /** Show a new sheet without writing it (SH6-7); `persistDraft` writes it. */
  function openDraft(s) {
    ++seq;
    showSheet(s, { focusTitle: true });
    draft = s;
  }

  /**
   * Write the new sheet shown, if it hasn't been: on its first change, before
   * another pane or /search adds to it, and before Print or Present open it in
   * a tab of their own. The write's transaction opens here, so whatever is
   * asked for after it, in any tab, reads the sheet.
   */
  function persistDraft() {
    // The Sheets tour's sheet is never written (E63).
    if (!draft || example) return;
    const d = draft;
    const n = seq;
    draft = null;
    store.save(d).then(
      () => { if (n === seq && !destroyed && sheet?.id === d.id) setSheet(d.id); },
      (err) => console.error("Study Desk: couldn't save a new sheet", err),
    );
  }

  function showSheet(record, { focusTitle = false } = {}) {
    draft = null;
    gapStop = null;
    sheet = record;
    onSheetChange();
    lastModule = null;
    closeInsertMenu();
    closeInsertForm(false);
    readingDismissed = null;
    readOnly = !canEdit(record);
    for (const card of cards.values()) card.inst?.destroy?.();
    cards.clear();
    buildSheet();
    draw();
    if (focusTitle) titleInput?.focus();
  }

  function buildSheet() {
    const wrap = make("div", "desk-sheet__sheet-view");
    header = make("div", "desk-sheet__top");
    const back = button("‹ All sheets", "desk-sheet__btn desk-sheet__btn--quiet");
    back.addEventListener("click", async () => {
      flushAll();
      await saving;
      toList({ focus: `open-${sheet?.id ?? ""}` });
    });
    status.textContent = "";
    // The sheet's own address prints, copies and shares it (3i, 3k), in a tab
    // of its own so the desk stays as it is.
    const print = make("a", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__print", "Print or share…");
    print.append(make("span", "sr-only", " (opens in a new tab)"));
    print.href = `${BASE}sheets/?id=${encodeURIComponent(sheet.id)}`;
    print.target = "_blank";
    print.rel = "noopener";
    print.title = "Open the leader and participant versions, to print, copy into Word, or share (opens in a new tab)";
    const printHint = describe(print, "The leader and participant versions, to print, copy into Word, or share.");
    const present = make("a", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__print", "Present…");
    present.append(make("span", "sr-only", " (opens in a new tab)"));
    present.href = `${BASE}sheets/?id=${encodeURIComponent(sheet.id)}&view=present`;
    present.target = "_blank";
    present.rel = "noopener";
    present.title = "Show this sheet to a room, one part at a time, with a presenter view (opens in a new tab)";
    const presentHint = describe(present, "Shows this sheet to a room, one part at a time, with a presenter view.");
    // The editor on the sheet's own page (S12, part 2: each home offers the
    // other). `from=desk` tells that page this pane sent it, so it doesn't ask.
    const ownPage = make("a", "desk-sheet__btn desk-sheet__btn--quiet desk-sheet__print", "Open on its own page");
    ownPage.append(make("span", "sr-only", " (opens in a new tab)"));
    ownPage.href = `${BASE}sheets/?id=${encodeURIComponent(sheet.id)}&view=edit&from=desk`;
    ownPage.target = "_blank";
    ownPage.rel = "noopener";
    ownPage.title = "Edit this sheet on the Sheets page, on its own (opens in a new tab)";
    const ownHint = describe(ownPage, "Edits this sheet on the Sheets page, on its own.");
    // A new sheet is written before its own address opens in a tab (SH6-7).
    for (const a of [print, present, ownPage]) {
      a.addEventListener("click", persistDraft);
      a.addEventListener("auxclick", persistDraft);
    }
    if (onDone) {
      // On the sheet's own page, its versions are the page itself (S12, part 1, step 2).
      const done = button("Done", "desk-sheet__btn desk-sheet__btn--primary");
      done.title = "Back to the leader and participant versions, to print, copy, or share";
      const doneHint = describe(done, "Back to the leader and participant versions, to print, copy, or share.");
      done.addEventListener("click", async () => {
        flushAll();
        persistDraft();
        await saving;
        if (!destroyed && sheet) onDone(sheet.id);
      });
      header.append(back, done, status, doneHint);
    } else {
      header.append(back, present, print, ownPage, status, printHint, presentHint, ownHint);
    }
    wrap.append(header);

    if (readOnly) {
      wrap.append(make("p", "desk-sheet__status", "This sheet was made by a newer version of the LIT. Reload the page to edit it."));
    }
    if (isOwnTemplate(sheet)) {
      wrap.append(make("p", "desk-sheet__status", "This is one of your templates. New sheet starts a sheet from it, so a change here reaches the next sheet made from it."));
    }

    titleInput = make("input", "desk-sheet__title");
    titleInput.type = "text";
    titleInput.maxLength = SHEET_LIMITS.title;
    titleInput.placeholder = "Title";
    titleInput.setAttribute("aria-label", "Sheet title");
    subtitleInput = make("input", "desk-sheet__subtitle");
    subtitleInput.type = "text";
    subtitleInput.maxLength = SHEET_LIMITS.subtitle;
    subtitleInput.placeholder = "Subtitle, such as your group and the date";
    subtitleInput.setAttribute("aria-label", "Sheet subtitle");
    for (const [input, field] of [[titleInput, "title"], [subtitleInput, "subtitle"]]) {
      input.value = sheet[field] ?? "";
      input.disabled = readOnly;
      let timer = null;
      const save = () => {
        clearTimeout(timer);
        timer = null;
        const value = input.value;
        change((s) => setSheetFields(s, { [field]: value }, opCtx()));
      };
      input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(save, TITLE_DELAY);
      });
      input.addEventListener("blur", () => { if (timer) save(); });
      input.flush = () => { if (timer) save(); };
    }
    // The planned minutes' total (Audit 5, D #2), kept by draw().
    plannedLine = make("p", "desk-sheet__planned");
    plannedLine.hidden = true;
    wrap.append(titleInput, subtitleInput, plannedLine);

    moduleList = make("div", "desk-sheet__modules");
    moduleList.setAttribute("role", "list");
    moduleList.setAttribute("aria-label", "The sheet’s parts");
    wireDrag(moduleList);
    const gapKeys = make("span", "sr-only", "Up and down arrows move to the places between the other parts.");
    gapKeys.id = `deskSheetGapKeys-${idSuffix}`;
    wrap.append(gapKeys, moduleList);
    if (!readOnly) {
      addBarView = createAddBar({ addPart, addHost, idSuffix });
      wrap.append(addBarView.el);
    }
    license = createLicenseCard({
      getSheet: () => sheet,
      readOnly,
      idPrefix: `deskSheet-${idSuffix}`,
      setCommercial: (on) =>
        change((s) => setSheetFields(s, { commercial: on }, opCtx()), {
          announce: on ? "Marked as a commercial project; the commercial check is on." : "No longer marked as a commercial project.",
        }),
    });
    wrap.append(license.el);
    content.replaceChildren(wrap);
  }

  /** One gap pill takes Tab: the one last focused, else the first part's (DK6-1). */
  function syncGapStop() {
    const pills = [...(moduleList?.querySelectorAll(".desk-sheet__after-btn") ?? [])];
    if (!pills.length) return;
    const owner = (b) => b.closest(".desk-sheet__module")?.dataset.moduleId;
    if (!pills.some((b) => owner(b) === gapStop)) gapStop = owner(pills[0]) ?? null;
    for (const b of pills) b.tabIndex = owner(b) === gapStop ? 0 : -1;
  }

  /**
   * Bring the page in line with `sheet`, keeping every card that hasn't
   * changed. `from` is where a change being drawn was made, for the line on a
   * part typed in meanwhile: "pane" for another Sheets pane in this tab, else
   * another tab.
   */
  function draw(from = "tab") {
    if (!sheet || !moduleList) return;
    closeInsertMenu(); // its pill is about to be redrawn or gone (DK6-2)
    if (titleInput && document.activeElement !== titleInput) titleInput.value = sheet.title ?? "";
    if (subtitleInput && document.activeElement !== subtitleInput) subtitleInput.value = sheet.subtitle ?? "";
    if (plannedLine) {
      const total = plannedTotal(sheet);
      plannedLine.hidden = !total;
      plannedLine.textContent = total ? `Planned time: ${total} min (leader’s version and presenter view only)` : "";
    }
    const seen = new Set();
    sheet.modules.forEach((m, i) => {
      seen.add(m.id);
      let card = cards.get(m.id);
      const now = json(m);
      if (card && card.json !== now) {
        if (card.inst?.update && card.head === headKey(m)) {
          // Passages and the key terms box redraw their own body in place, so
          // a blank or a footnote choice keeps the card, its open lists and
          // the reader's focus.
          card.inst.update(m);
          card.json = now;
        } else if (card.inst?.hasFocus?.()) {
          // The reader is typing here, so the card keeps their words, and a
          // line says the saved text moved under them (S12, part 4).
          if (card.inst.fields && changedUnderReader(card.json, m)) showConflict(card, m, from);
          card.json = now;
        } else {
          card.inst?.destroy?.();
          card.el.remove();
          card = null;
        }
      }
      if (!card) {
        card = buildCard(m);
        card.json = now;
        cards.set(m.id, card);
      }
      card.setPosition(i, sheet.modules.length);
      if (moduleList.children[i] !== card.el) moduleList.insertBefore(card.el, moduleList.children[i] ?? null);
    });
    for (const [id, card] of cards) {
      if (seen.has(id)) continue;
      if (insertForm?.after === id) insertForm = null;
      card.inst?.destroy?.();
      card.el.remove();
      cards.delete(id);
    }
    for (const card of cards.values()) card.inst?.sheetChanged?.();
    // A part's prompt under its lone heading (SH5-2, SH5-4): shown while the
    // part holds only the heading and no passage follows it, gone once the
    // leader types there. Only the editor shows it, so it never prints or
    // goes up on a room's screen (BA70); aria-description gives it to a
    // screen reader. An empty part's prompt is the editor's placeholder.
    sheet.modules.forEach((m, i) => {
      const box = cards.get(m.id)?.el.querySelector(".desk-rich-editor > .desk-rich");
      if (!box) return;
      const hint = readOnly ? "" : headingPrompt(m, sheet.modules[i + 1]);
      if (hint) {
        if (box.dataset.hint !== hint) {
          box.dataset.hint = hint;
          box.setAttribute("aria-description", hint);
        }
      } else if (box.hasAttribute("data-hint")) {
        delete box.dataset.hint;
        box.removeAttribute("aria-description");
      }
    });
    // A template's reading part acts as if "+ Passage" were already pressed
    // on it (BVJ, 2026-11-08): while the sheet has no passage, the passage
    // form is open under it, without taking focus or scrolling. It stays once
    // the first passage is added, for the next, as the pill's form does, and
    // × or Escape closes it until the sheet is opened again.
    if (!readOnly && !insertForm) {
      const reading = readingPart(sheet);
      const card = reading && readingDismissed !== reading.id ? cards.get(reading.id) : null;
      if (card) openInlinePassage(reading, headingOf(reading) ?? card.name, { focus: false, scroll: false, auto: true });
    }
    syncGapStop();
    license?.sheetChanged();
    addBarView?.sheetChanged(sheet);
    if (!sheet.modules.length) {
      // Beside the list, not in it: a list holds only list items (DK-16).
      if (!moduleList.parentNode.querySelector(".desk-sheet__none")) {
        moduleList.before(make("p", "desk-sheet__none", "Nothing on this sheet yet. Add a passage or your own text below."));
      }
    } else {
      moduleList.parentNode.querySelector(".desk-sheet__none")?.remove();
    }
  }

  /**
   * The line on a part whose saved text another tab (or pane) changed while
   * the reader was typing in it (S12, part 4; BVJ, 2026-11-08): the card
   * keeps the reader's words, and the line offers the other version. Under
   * the part's text, so the words being typed don't move. A later change
   * from there only updates which version "Show that version" shows.
   */
  function showConflict(card, m, from) {
    card.theirs = m;
    if (card.conflict) return;
    const id = m.id;
    const line = make("div", "desk-sheet__conflict");
    const words = make("p", "desk-sheet__conflict-text", from === "pane" ? "Changed in another Sheets pane." : "Changed in another tab.");
    words.id = `deskSheetConflict-${idSuffix}-${id}`;
    line.setAttribute("role", "group");
    line.setAttribute("aria-labelledby", words.id);
    const show = button("Show that version", "desk-sheet__btn desk-sheet__btn--quiet");
    const keep = button("Keep mine", "desk-sheet__btn desk-sheet__btn--quiet");
    const fields = () => Object.entries(card.inst?.fields ?? {});
    show.addEventListener("click", () => {
      const theirs = card.theirs;
      clearConflict(card);
      for (const [f, ed] of fields()) ed.setHtml(theirs[f] ?? "");
      // Written again, since this tab's typing may have saved over it already.
      const put = Object.fromEntries(fields().map(([f]) => [f, theirs[f] ?? ""]));
      change((s) => updateModule(s, id, put, opCtx()), { source: id, announce: "Showing the other version." });
      card.inst?.focus?.();
    });
    keep.addEventListener("click", () => {
      clearConflict(card);
      const put = Object.fromEntries(fields().map(([f, ed]) => [f, ed.take()]));
      change((s) => updateModule(s, id, put, opCtx()), { source: id, announce: "Kept your version." });
      card.inst?.focus?.();
    });
    const row = make("div", "desk-sheet__conflict-row");
    row.append(show, keep);
    line.append(words, row);
    card.conflict = line;
    const zone = card.el.querySelector(":scope > .desk-sheet__after");
    card.el.insertBefore(line, zone);
    say(`${headingOf(m) ?? card.name}: ${words.textContent.toLowerCase()} Show that version, or keep yours.`);
  }

  function clearConflict(card) {
    card.conflict?.remove();
    card.conflict = null;
    card.theirs = null;
  }

  function flushAll() {
    titleInput?.flush?.();
    subtitleInput?.flush?.();
    for (const card of cards.values()) card.inst?.flush?.();
  }

  /**
   * The page is closing (BA72). The saves under way read the sheet before
   * they write, and a closing page never gets that read back, so they would
   * die with it, as would typing still waiting for its delay. So what hasn't
   * landed is applied to this pane's copy and written at once (`writeNow`),
   * without the read. Not for a page going into the back-forward cache
   * (`persisted`), which keeps running its saves when it comes back.
   */
  function onPagehide(e) {
    flushAll();
    if (e.persisted || destroyed || readOnly || !sheet || !pending.size) return;
    let next = sheet;
    let plan = null;
    for (const asked of pending) {
      if (asked.id !== sheet.id) continue;
      const p = planSheetChange(next, asked.op);
      if (!p.changed) continue;
      next = p.sheet;
      plan = p;
    }
    if (!plan) return;
    try {
      store.writeNow(plan);
    } catch (err) {
      console.error("Study Desk: the sheet couldn’t be saved as the page closed", err);
    }
  }

  // ---- a module's card ----

  function buildCard(m) {
    const known = MODULE_TYPES.includes(m.type);
    const card = make("div", `desk-sheet__module desk-sheet__module--${known ? m.type : "unknown"}`);
    card.setAttribute("role", "listitem");
    card.dataset.moduleId = m.id;
    card.addEventListener("focusin", () => { lastModule = m.id; });
    card.addEventListener("pointerdown", () => { lastModule = m.id; });
    const head = make("div", "desk-sheet__module-head");
    const grip = make("span", "desk-sheet__grip");
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to move";
    grip.textContent = "⠿";
    const label = make("span", "desk-sheet__module-name", known ? TYPE_NAMES[m.type] : "Made by a newer version of the LIT");
    if (m.type === "passage") label.textContent = passageLabel(m);
    head.append(grip, label);

    const tools = make("div", "desk-sheet__module-tools");
    const name = label.textContent;
    // What the gap's pill, its menu and its form call the part: a text part's
    // heading when it has one ("Add a passage after Reading"), else its kind.
    const called = headingOf(m) ?? name;
    let up = null;
    let down = null;
    if (!readOnly) {
      if (known) tools.append(...cardTools(cardHost, m, { name, called }));
      up = button("↑", "desk-sheet__icon");
      up.setAttribute("aria-label", `Move ${name} up`);
      up.addEventListener("click", () => move(m.id, -1, up));
      down = button("↓", "desk-sheet__icon");
      down.setAttribute("aria-label", `Move ${name} down`);
      down.addEventListener("click", () => move(m.id, 1, down));
      const remove = button("×", "desk-sheet__icon");
      remove.setAttribute("aria-label", `Remove ${name}`);
      remove.addEventListener("click", () => removeCard(m.id, name));
      tools.append(up, down, remove);
    }
    head.append(tools);
    card.append(head);

    const inst = cardBody(cardHost, card, m);

    if (!readOnly) {
      // The whole header is the handle (BVJ, 2026-11-08), not the grip alone;
      // its buttons and the Leader only box keep their own job. A press that
      // doesn't become a drag ends with the card undraggable again, so a later
      // drag across the part's text never carries the card off (pointerup
      // doesn't fire once a drag starts; dragend covers that).
      head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, input, label, a")) return;
        card.draggable = true;
        document.addEventListener("pointerup", () => { card.draggable = false; }, { once: true });
      });
      card.addEventListener("dragend", () => { card.draggable = false; });
      // The gap under the card (BVJ, 2026-11-08): a zone over the space to the
      // next card, where a line with an "Add" pill appears under the pointer or
      // on focus, so a part can be added right there. The passage form it
      // opens sits in the card, before the zone, so the card holds it again
      // after a redraw.
      if (insertForm?.after === m.id) card.append(insertForm.el);
      const zone = make("div", "desk-sheet__after");
      const insert = button("+ Add", "desk-sheet__after-btn");
      insert.setAttribute("aria-label", `Add a part after ${called}`);
      insert.setAttribute("aria-haspopup", "menu");
      insert.setAttribute("aria-expanded", "false");
      insert.title = "Add a part here";
      insert.tabIndex = gapStop === m.id ? 0 : -1;
      insert.setAttribute("aria-describedby", `deskSheetGapKeys-${idSuffix}`);
      insert.addEventListener("click", () => openInsertMenu(insert, m, called));
      insert.addEventListener("focus", () => {
        gapStop = m.id;
        syncGapStop();
      });
      insert.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const pills = [...moduleList.querySelectorAll(".desk-sheet__after-btn")];
        const i = pills.indexOf(insert);
        const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: pills.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        const next = pills[Math.max(0, Math.min(pills.length - 1, to))];
        gapStop = next?.closest(".desk-sheet__module")?.dataset.moduleId ?? gapStop;
        syncGapStop();
        next?.focus();
      });
      zone.append(insert);
      card.append(zone);
    }
    return {
      el: card,
      inst,
      name,
      json: "",
      head: headKey(m),
      setPosition(i, count) {
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === count - 1;
      },
    };
  }

  function move(id, by, from) {
    const at = sheet.modules.findIndex((x) => x.id === id);
    if (at < 0) return;
    const to = at + by;
    if (to < 0 || to >= sheet.modules.length) return;
    change((s) => moveModule(s, id, to, opCtx()), {
      announce: `Moved to ${to + 1} of ${sheet.modules.length}.`,
      after: () => from.isConnected && !from.disabled ? from.focus() : cards.get(id)?.el.querySelector("button")?.focus(),
    });
  }

  function removeCard(id, name) {
    const at = sheet.modules.findIndex((x) => x.id === id);
    change((s) => removeModule(s, id, opCtx()), {
      after: () => {
        // In the tour's example mode nothing was written, so the last entry is another change's.
        const entry = example ? null : store.lastEntry();
        if (entry) showUndo(`${name} removed from the sheet.`, () => undoEntry(entry));
        const next = sheet.modules[Math.min(at, sheet.modules.length - 1)];
        (next ? cards.get(next.id)?.el.querySelector("button") : moduleList)?.focus?.();
      },
    });
  }

  // ---- adding ----

  /**
   * Adds a part of `type`: after the part `after` (a card's "+" menu; BVJ,
   * 2026-11-08), else after the part last worked in, else at the end. The
   * new part takes focus: a space's lines field, a page break's first Move
   * button (SH5-10), otherwise its text.
   */
  function addPart(type, after = null, called = null) {
    const mod = makeModule(type);
    const where = (s) => {
      const i = after ? s.modules.findIndex((x) => x.id === after) : -1;
      return i >= 0 ? i + 1 : insertIndex(s);
    };
    const afterName = after ? called ?? cards.get(after)?.name : null;
    const atEnd = !sheet || where(sheet) >= sheet.modules.length;
    change((s) => addModule(s, mod, where(s), opCtx()), {
      announce: `${TYPE_NAMES[type]} added${afterName ? ` after ${afterName}` : atEnd ? " at the end" : " after the part you were working in"}.`,
      after: () => {
        const c = cards.get(mod.id);
        c?.el.scrollIntoView({ block: "nearest" });
        if (type === "space") c?.el.querySelector(".desk-sheet__lines input")?.focus();
        else if (type === "pageBreak") c?.el.querySelector(".desk-sheet__module-tools .desk-sheet__icon[aria-label^=\"Move\"]:not(:disabled)")?.focus();
        else focusNewPart(c);
      },
    });
  }

  /**
   * Where a part just added takes focus (SH6-1): its text when it has an
   * editor, else its first Move button. Never "the first input", which is the
   * minutes box every header carries. (`inst.focus()` returns nothing, so a
   * `??` chain after it would always run the fallback too.)
   */
  function focusNewPart(c) {
    if (!c) return;
    if (c.inst?.focus) c.inst.focus();
    else (c.el.querySelector(".desk-sheet__module-tools .desk-sheet__icon[aria-label^=\"Move\"]:not(:disabled)") ?? c.el.querySelector("[contenteditable], button"))?.focus();
  }

  /**
   * The gap pill's menu (insert-menu.js): each part goes right after this
   * card, and "Passage…" opens the passage form under it
   * (`openInlinePassage`), since a passage needs a reference typed.
   */
  function openInsertMenu(button, m, name) {
    insertMenu = openInsertMenuAt({
      button,
      id: `deskSheetInsert-${idSuffix}-${m.id}`,
      name,
      hasTerms: !!sheet?.modules.some((x) => x?.type === "keyTerms"),
      onPick: (type) => (type === "passage" ? openInlinePassage(m, name) : addPart(type, m.id, name)),
      onClose: (close) => { if (insertMenu?.close === close) insertMenu = null; },
    });
  }

  /**
   * "Passage…" from the gap's "Add" pill (BVJ, 2026-11-08): the passage form
   * opens under that card, not in the add bar at the sheet's end, so the
   * leader isn't sent to the bottom to type a reference that lands in the
   * middle. Each passage it adds goes right after the card, then after the
   * one just added, so several land in order. One such form at a time; its ×
   * or Escape closes it and returns focus to the card's pill.
   */
  function openInlinePassage(m, name, { focus = true, scroll = true, auto = false } = {}) {
    closeInsertForm(false);
    const card = cards.get(m.id)?.el;
    if (!card) {
      say(`That part is gone, so there is nowhere to add a passage after ${name}.`);
      return;
    }
    const el = make("div", "desk-sheet__insert-form");
    const head = make("div", "desk-sheet__insert-head");
    const title = make("p", "desk-sheet__insert-title", `Add a passage after ${name}`);
    title.id = `deskSheetInsertTitle-${idSuffix}-${m.id}`;
    const close = button("×", "desk-sheet__icon");
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => closeInsertForm(true));
    head.append(title, close);
    const form = make("div", "desk-sheet__passage-form");
    form.setAttribute("role", "group");
    form.setAttribute("aria-labelledby", title.id);
    el.append(head, form);
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeInsertForm(true);
    });
    insertForm = { after: m.id, target: { after: m.id }, el, auto };
    const zone = card.querySelector(":scope > .desk-sheet__after");
    if (zone) zone.before(el);
    else card.append(el);
    openPassageForm(addHost, form, insertForm.target, { focus });
    if (scroll) el.scrollIntoView({ block: "nearest" });
  }

  function closeInsertForm(refocus) {
    if (!insertForm) return;
    const { after, el, auto } = insertForm;
    if (auto && refocus) readingDismissed = after;
    insertForm = null;
    el.remove();
    if (refocus) cards.get(after)?.el.querySelector(".desk-sheet__after-btn")?.focus();
  }

  // ---- dragging into order ----

  function wireDrag(list) {
    let dragging = null;
    const marker = make("div", "desk-sheet__drop");
    marker.setAttribute("aria-hidden", "true");
    const indexAt = (y) => {
      const items = [...list.querySelectorAll(":scope > .desk-sheet__module")];
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) return { i, before: items[i] };
      }
      return { i: items.length, before: null };
    };
    list.addEventListener("dragstart", (e) => {
      const card = e.target.closest?.(".desk-sheet__module");
      if (!card || !card.draggable) return;
      dragging = card.dataset.moduleId;
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", passageOrName(dragging));
    });
    list.addEventListener("dragover", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const { before } = indexAt(e.clientY);
      if (before) list.insertBefore(marker, before);
      else list.append(marker);
    });
    const end = () => {
      marker.remove();
      list.querySelector(".is-dragging")?.classList.remove("is-dragging");
      dragging = null;
    };
    list.addEventListener("drop", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const id = dragging;
      marker.remove();
      const { i } = indexAt(e.clientY);
      const from = sheet.modules.findIndex((x) => x.id === id);
      end();
      if (from < 0) return;
      const to = i > from ? i - 1 : i;
      change((s) => moveModule(s, id, to, opCtx()), { announce: `Moved to ${to + 1} of ${sheet.modules.length}.` });
    });
    list.addEventListener("dragend", end);
  }

  const passageOrName = (id) => {
    const m = sheet?.modules.find((x) => x.id === id);
    return m?.type === "passage" ? passageReference(m) : TYPE_NAMES[m?.type] ?? "";
  };

  // ---- changes made elsewhere ----

  const unsubscribe = store.subscribe((ids, origin) => {
    if (sheet && ids?.includes?.(sheet.id)) refresh(origin);
  });
  // Another tab opening this sheet asks whether one is editing it (S12, part 4).
  const stopCounting = addEditor(() => (sheet && !draft ? sheet.id : null));
  const onVisible = () => {
    // Hidden comes first when a tab closes; this starts the saves, and
    // onPagehide makes sure of them (BA72).
    if (document.visibilityState === "visible") refresh();
    else flushAll();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", onVisible);
  window.addEventListener("pagehide", onPagehide);

  // The first view, a tick later. A request that came first keeps the screen:
  // the title menu's "New sheet…" adds the pane and sends `desk:sheet-new` in
  // the same tick, whose showList({ chooser: true }) this would otherwise
  // supersede, leaving the list with its templates shut (E59, 2026-11-08).
  queueMicrotask(() => {
    if (seq) return;
    const id = getSheet();
    // A host that opens the editor on a press (/sheets/'s Edit) has it start on the title.
    if (id) openSheet(id, { focusTitle: Boolean(onDone) });
    else toList();
  });

  // "New sheet…": back to the list, with the templates open and focus on the
  // first.
  me.newSheet = async () => {
    if (destroyed) return;
    if (sheet) {
      flushAll();
      await saving;
      if (destroyed) return;
      setSheet(null);
      showList({ chooser: true });
      return;
    }
    const chooser = content.querySelector(".desk-sheet__templates");
    if (!chooser) showList({ chooser: true }); // the list is still loading
    else if (chooser.hidden) chooser.toggle();
    else chooser.querySelector("button")?.focus();
  };

  /**
   * The Sheets tour's example mode (E63; sheets/sheet-tour.js). While it is
   * on, a change is made in memory (`changeInMemory`) and the sheet shown is
   * never written: not by its first change, and not by "Print or share…",
   * "Present…", "Open on its own page" or an add from another pane, whose
   * `persistDraft` does nothing. Typing still waiting for its delay is saved
   * first, since it is the reader's.
   */
  me.setExample = (on) => {
    if (on && !example) flushAll();
    example = Boolean(on);
  };

  /**
   * The tour is over: its sheet is dropped unwritten, and the editor shows
   * what the host says, as the first view does. Safe to call again, which
   * the tour does once the reader's layout is back.
   */
  me.endExample = () => {
    example = false;
    draft = null;
    if (destroyed) return;
    const id = getSheet();
    ++seq;
    if (id) openSheet(id);
    else if (onList) toList();
    else showList();
  };

  return {
    el,
    ...me,
    destroy() {
      flushAll();
      closeInsertMenu();
      destroyed = true;
      seq++;
      unsubscribe();
      stopCounting();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("pagehide", onPagehide);
      for (const card of cards.values()) card.inst?.destroy?.();
    },
  };
}
