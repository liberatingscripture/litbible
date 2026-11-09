// src/scripts/desk/sheets/sheet-page.js
//
// A sheet's own address, /sheets/ (STUDY-DESK.md, D9, "Phase 3a's answers",
// 2; "Order of work", 3i). Loaded by desk-gate.js on a computer with the
// preview switched on, when the page carries [data-sheet-page]. This page
// shows a sheet, prints it and copies it, and writes a record only when the
// reader edits one here (Edit, New sheet…), uses a list row's Duplicate, Save
// as template or Delete, or imports a shared one:
//
// - `/sheets/` lists the reader's sheets, each with a Sheets pane's row
//   actions, and their own templates under "My templates" (E64; the rows come
//   by import(), see `showList`); `/sheets/?id=<id>` shows one. The id is a
//   random one that means nothing outside this browser's notebook.
// - **Edit** (S12, part 1, step 2; BVJ, 2026-11-08, decision 1) turns the
//   page into the sheet editor, `/sheets/?id=<id>&view=edit`, and Done turns
//   it back; "Edit on the Study Desk" stays beside it for the fuller
//   workspace. **New sheet…** on the list offers the templates and opens the
//   new sheet in the editor. The editor's code (sheet-page-edit.js, which
//   holds sheet-editor.js) is a dynamic import made only then, so a page
//   opened to print or present never loads it. The page moves between its
//   list, a sheet's versions and the editor in place, each with its own
//   address, and Back and Forward move between them (`route`).
// - **Leader copy or Participant copy** (S4), drawn by sheet-copy.js from
//   today's text, and redrawn when the sheet changes in another tab.
// - **Paper**: US Letter or A4 (C27), guessed from the reader's languages
//   until they choose, then kept in `localStorage['lit-sheet-paper']` (named in
//   /privacy's paragraph). The page's own preview is drawn at that paper's width.
// - **Show QR codes** (S5; "Codes to scan" until 2026-11-06), one per
//   chapter, on by default; not kept.
// - **Checked before printing** (S2): a passage whose wording changed since it
//   was added is named above the paper, with what moved, and the copy's foot
//   says the day its text is from. The notice is for the screen only; the
//   copy prints today's wording either way, and the new wording is kept
//   when the sheet is next opened in an editor (Edit, or on /desk).
// - **Print**, which prints the copy on screen, and **Copy** (S9; E36 renamed
//   it from "Copy for Word"), which puts the same copy on the clipboard as
//   formatted text and as plain.
// - **Save as ▾** (E37; sheet-save.js): the same copy as a document for
//   another program (.docx, .odt or .rtf, each writer loaded when chosen), or
//   "PDF…", which runs Print. Copy and the files read the copy on screen into
//   one model (readCopy in sheet-word.js), so they can't disagree.
// - **Present** (3j): the sheet shown to a room, full screen, with the reveal
//   and a presenter view (sheet-present.js). `&view=present` opens it
//   straight away (the Sheets pane's "Present…"), and `&view=presenter` is the
//   presenter view's own window.
// - **Share…** (3k, S8): the sheet in a link's fragment or in a file
//   (desk-sheet-share.mjs), the whole sheet or the participant copy's parts.
//   The file is "Export a Study Desk file (.md)" (EXPORT_LABEL; E37 renamed it from
//   "Save as a file"), so "Save as" means only a document for another program.
// - **A shared sheet**: `/sheets/#share1.<data>`, whose fragment the page's
//   inline script has already moved into history.state.litSharedSheet before
//   the analytics beacon could read the address, or a file opened with "Import a
//   Study Desk file" (BVJ, 2026-11-06; "Import a shared file" until then). Shown like the reader's own, read only, with "Import into my
//   notebook", which saves it as a new sheet of theirs. A participant share offers
//   the participant copy only.
// - **A shared sheet on a phone or tablet** (BVJ, 2026-11-08, Audit 6 NB6-8,
//   from a mock): the one way the desk's code reaches a phone.
//   sheet-share-gate.js imports this file there for a shared link alone and
//   calls `showSharedOnPhone`, which never opens the notebook. The sheet is
//   shown to read, with Present (no presenter view; taps step it), Print and
//   Share… (the phone's share sheet, with the same link) in one row that
//   scrolls with the page. Nothing that saves: no Import, Copy, Save as, or
//   link to the desk, and no paper, code or answer key choices.
// - **The Sheets tour runs here too** (STUDY-DESK-FIXES.md E63; BVJ,
//   2026-11-09), acting on this page's own list, editor and versions view
//   through the host at the end of this file (`tourHost`). The tour itself is
//   sheet-tour.js, reached only by `import()`: when the list or a sheet's
//   versions is drawn and the seen list says there is something to offer, or
//   when the reader starts it ("Take the Sheets tour" in the list's intro,
//   `/sheets/?sheet-tour`). The rules that decide the offer
//   (`desk-first-use.mjs`) come by `import()` too, 1.6 s after the draw: with
//   them comes `desk-layout.mjs`, and neither is any use to a page opened to
//   print or present, or to a phone showing a shared sheet. It never changes
//   the address or history, and ends with `route()`.

import { COPIES, COPY_NAMES, defaultPaper, PAPERS, pageRule, paperName } from "../../../lib/desk-sheet-copy.mjs";
import {
  MAX_SHARE_FILE_BYTES,
  QR_LINK_LIMIT,
  ShareError,
  SHARE_ERRORS,
  copyOfShared,
  fragmentInFile,
  openShare,
  shareFile,
  shareFileName,
  shareLink,
} from "../../../lib/desk-sheet-share.mjs";
import { qrSvg } from "../../../lib/qr-svg.mjs";
import { sheetName, sortSheets } from "../../../lib/desk-sheet-passages.mjs";
import { isOwnTemplate } from "../../../lib/desk-sheets.mjs";
import { addDeskStyle, deskCtx as ctx } from "../boot.js";
import { checkSummary } from "../../../lib/desk-sheet-check.mjs";
import { passageReference } from "../../../lib/desk-sheet-passages.mjs";
import { documentFileName } from "../../../lib/desk-sheet-doc.mjs";
import { copyChecks, copyLeaks, renderCopy } from "./sheet-copy.js";
import { leakSentence } from "../../../lib/desk-sheet-leaks.mjs";
import { diffParagraph } from "../diff-view.js";
import { openPresentation, showPresenterView } from "./sheet-present.js";
import { CODES_MISSING, createSaveMenu, download, drawCodes, writerFor } from "./sheet-save.js";
import { copyForWord, readCopy } from "./sheet-word.js";
import { openStore } from "../store.js";
import { announce } from "../undo-bar.js";
import { make } from "../dom.js";

const PAPER_KEY = "lit-sheet-paper";
// Bumped whenever the page draws another view (`route`), so a view drawn
// before stops listening for changes; and the editor while the page is one.
let viewSeq = 0;
let editing = null;
// The Sheets tour (E63), made the first time it is offered or started, and
// the wait before its offer.
let sheetTour = null;
let tourOfferTimer = 0;
// Whether the leader's version ends with an answer key: this browser's choice,
// never part of the sheet record.
const ANSWER_KEY = "lit-sheet-answer-key";

function storedAnswerKey() {
  try {
    return localStorage.getItem(ANSWER_KEY) === "on";
  } catch (_) {
    return false;
  }
}
/**
 * The Share dialog's file button (E37; BVJ, 2026-11-06: "export", to set it
 * apart from Save as). Its messages read it from here, so it changes in one place.
 */
const EXPORT_LABEL = "Export a Study Desk file (.md)";
/** The button on /sheets/ that opens such a file (BVJ, 2026-11-06, pairing with Export). */
const IMPORT_LABEL = "Import a Study Desk file";
const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

function button(label, cls = "desk-sheet__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

/**
 * The copy glyph the site's copy controls use: two sheets, as the glossary's
 * copy-link icon draws them (glossary.astro), without its chain. Drawn with
 * presentation attributes, not a style attribute, so the page's CSP allows it.
 */
function copyGlyph() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "sheets-page__copy-glyph");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const back = document.createElementNS(NS, "path");
  back.setAttribute("d", "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2");
  const front = document.createElementNS(NS, "rect");
  front.setAttribute("x", "8");
  front.setAttribute("y", "8");
  front.setAttribute("width", "14");
  front.setAttribute("height", "14");
  front.setAttribute("rx", "2");
  svg.append(back, front);
  return svg;
}

let hintCount = 0;

/**
 * A sentence a control's `title` carries, given to a screen reader as well
 * (CP-9): a hidden span the control is described by, which the caller puts
 * in the page. The title stays, for a mouse.
 */
function describe(control, text) {
  const hint = make("span", "sr-only", text);
  hint.id = `sheetsPageHint${++hintCount}`;
  control.setAttribute("aria-describedby", hint.id);
  return hint;
}

const dateWords = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

function storedPaper() {
  try {
    return paperName(localStorage.getItem(PAPER_KEY));
  } catch (_) {
    return null;
  }
}

/** The paper's @page rule, as the page's last style so it outranks print.css. */
function setPaper(paper) {
  let style = document.getElementById("sheet-paper");
  if (!style) {
    style = make("style");
    style.id = "sheet-paper";
    document.head.append(style);
  }
  style.textContent = pageRule(paper);
  document.documentElement.style.setProperty("--sheet-paper-width", PAPERS[paper].width);
  document.documentElement.style.setProperty("--sheet-paper-margin", PAPERS[paper].margin);
}

/** A radio group of choices, as one row of the toolbar. */
function choices(name, legend, options, current, onChange) {
  const set = make("fieldset", "sheets-page__choice");
  set.append(make("legend", null, legend));
  for (const [value, label] of options) {
    const lab = make("label");
    const input = make("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.checked = value === current;
    input.addEventListener("change", () => { if (input.checked) onChange(value); });
    lab.append(input, document.createTextNode(` ${label}`));
    set.append(lab);
  }
  return set;
}

async function copyToClipboard({ html, text }) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch (_) {
      /* a plain write below */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * The list. `onPick` is the Sheets tour's (E63): its "New sheet…" starts the
 * tour's sheet from the template chosen instead of opening the editor at a
 * new address. `focusKey` names the control to focus once it is drawn (a
 * row's `data-focus-key`), after a row's action redraws the list.
 *
 * Each sheet has Duplicate, Save as template and Delete, and the reader's own
 * templates are listed under "My templates" (E64), as in a Sheets pane: the
 * rows are sheet-page-list.js's, loaded by import() so the history they need
 * stays out of a page opened to print or present. Where that fails to load,
 * the sheets are plain links, as before.
 */
async function showList(root, store, { onPick = null, focusKey = null } = {}) {
  const n = viewSeq;
  document.title = "My sheets | Liberation and Inclusion Translation";
  root.replaceChildren(make("h1", "sheets-page__title", "My sheets"));
  const first = await readList(store);
  // Another view was drawn while the sheets were read.
  if (n !== viewSeq) return;
  const desk = make("a", null, "the Study Desk");
  desk.href = `${BASE}desk/`;
  const intro = make("p", "sheets-page__intro");
  intro.append(
    document.createTextNode("Each sheet here can be changed, printed as a leader’s version or a participant’s version, copied, or saved as a document for Word or another program. A Sheets pane on "),
    desk,
    document.createTextNode(" has the fuller workspace, with the LIT beside the sheet."),
  );
  // The Sheets tour (E63), here as in a Sheets pane's list: a quiet link,
  // which loads the tour and starts it.
  const tour = button("Take the Sheets tour", "desk-sheet__tour");
  tour.addEventListener("click", async () => (await pageTour(root, store))?.start());
  intro.append(document.createTextNode(" "), tour);
  const newRow = newSheetRow(root, store, { onPick });
  // A row's action that fails says so under this row (`listProblem`), and
  // focus comes here when Delete takes the last row.
  newRow.dataset.listProblems = "";
  const fresh = newRow.querySelector("button");
  if (fresh) fresh.dataset.focusKey = "new-sheet";
  root.append(intro, newRow, openFileRow(root, store));
  // `/sheets/?new` (the notebook page's "New sheet…", S12, part 2) opens the
  // templates at once, and the address goes back to the list's.
  if (!onPick && new URLSearchParams(location.search).has("new")) {
    history.replaceState(history.state, "", `${BASE}sheets/`);
    fresh?.click();
  }
  // The rows, and the line for no sheets: the one part of the list a change
  // elsewhere redraws (Audit 8, SH8-1). The rest stays as it is, so an open
  // "New sheet…" chooser, a status line, and focus outside the rows are kept.
  let shown = listRows(root, store, first, (key) => update(key));
  let drawn = rowsHtml(shown);
  root.append(...shown);
  const focusOn = (key) => {
    const to = (key && root.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)) || root.querySelector(".sheets-page__title");
    if (to && !to.matches("a, button")) to.tabIndex = -1;
    to?.focus();
  };
  // The list again, as it stands, built off the page and put in place of the
  // rows only when what they show moved: a sheet's text saved in another tab
  // changes nothing here, so it redraws nothing, and the page is never
  // emptied while the sheets are read. `key` is a row action's control to
  // focus afterward. Focus on a row is kept by its control's own key (each
  // row's link and buttons have one), or goes to the heading when that row
  // is gone, never to the page.
  let updates = 0;
  async function update(key = null) {
    const u = ++updates;
    const data = await readList(store);
    if (n !== viewSeq || u !== updates) return;
    // A row action that worked takes down a problem an earlier one left (`listProblem`).
    if (key) root.querySelector(".desk-sheet__made-not")?.remove();
    const next = listRows(root, store, data, (k) => update(k));
    const html = rowsHtml(next);
    if (html === drawn) {
      if (key) focusOn(key);
      return;
    }
    const at = document.activeElement;
    const inRows = shown.some((node) => node.contains(at));
    const was = inRows ? (at.closest("[data-focus-key]")?.dataset.focusKey ?? null) : null;
    shown[0].before(...next);
    for (const node of shown) node.remove();
    shown = next;
    drawn = html;
    if (key || inRows) focusOn(key ?? was);
  }
  // A sheet changed elsewhere (another tab, or Undo here). Until the page draws another view.
  const stop = store.subscribe(() => {
    if (n !== viewSeq) {
      stop?.();
      return;
    }
    update();
  }, { kinds: ["sheet"] });
  if (focusKey) focusOn(focusKey);
}

/** The reader's sheets and own templates, sorted, with the rows' module when there are any. */
async function readList(store) {
  let all = [];
  try {
    all = (await store.all()).filter((r) => r.kind === "sheet");
  } catch (err) {
    console.error("Study Desk: couldn't read the sheets", err);
  }
  const sheets = sortSheets(all.filter((r) => !isOwnTemplate(r)));
  const mine = sortSheets(all.filter(isOwnTemplate));
  let rows = null;
  if (sheets.length || mine.length) {
    try {
      rows = await import("./sheet-page-list.js");
    } catch (err) {
      console.error("Study Desk: the list's actions didn’t load", err);
    }
  }
  return { sheets, mine, rows };
}

/** What the list's rows show, to tell whether a change moved any of it (SH8-1). */
const rowsHtml = (nodes) => nodes.map((node) => node.outerHTML).join("");

/**
 * The list's rows, not yet on the page: the line for no sheets, the sheets
 * (with a Sheets pane's actions where sheet-page-list.js loaded, else plain
 * links), and "My templates". Never empty, so the rows always have a place.
 * `redraw(key)` is a row action's: the list again, focus on `key`.
 */
function listRows(root, store, { sheets, mine, rows }, redraw) {
  const nodes = [];
  if (!sheets.length) nodes.push(make("p", "sheets-page__empty", "You haven’t made a sheet yet."));
  if (rows) {
    const sheetHref = (r) => `${BASE}sheets/?id=${encodeURIComponent(r.id)}${isOwnTemplate(r) ? "&view=edit" : ""}`;
    const { list, own } = rows.pageListRows({
      store,
      ctx,
      root,
      sheets,
      mine,
      // A sheet's name opens its versions, a template's its editor, since a
      // template has no passages to print.
      href: sheetHref,
      // Duplicate opens the copy in the editor, its title focused, as a Sheets pane does.
      openEditor: (id) => {
        history.pushState(null, "", `${BASE}sheets/?id=${encodeURIComponent(id)}&view=edit`);
        route(root, store);
      },
      redraw,
    });
    if (list) nodes.push(list);
    if (own) nodes.push(own);
  } else if (sheets.length) {
    const ul = make("ul", "sheets-page__list");
    for (const s of sheets) {
      const li = make("li");
      const a = make("a", "sheets-page__sheet", sheetName(s));
      a.href = `${BASE}sheets/?id=${encodeURIComponent(s.id)}`;
      li.append(a);
      const meta = [s.subtitle, s.modified ? `changed ${dateWords(s.modified)}` : ""].filter(Boolean).join(" · ");
      if (meta) li.append(make("span", "sheets-page__meta", meta));
      ul.append(li);
    }
    nodes.push(ul);
  }
  return nodes;
}

/**
 * "New sheet…" (S12, part 1, step 2): the templates, under the button, and
 * the editor on the one chosen. The editor's code is fetched on the first press.
 * `onPick` takes the choice instead (the Sheets tour's, E63).
 */
function newSheetRow(root, store, { onPick = null } = {}) {
  const row = make("div", "sheets-page__new");
  const fresh = button("New sheet…", "desk-sheet__btn desk-sheet__btn--primary");
  fresh.setAttribute("aria-expanded", "false");
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  let chooser = null;
  let loading = false;
  fresh.addEventListener("click", async () => {
    if (!chooser) {
      if (loading) return;
      loading = true;
      try {
        const { newSheetChooser } = await import("./sheet-page-edit.js");
        chooser = await newSheetChooser({
          opener: fresh,
          store,
          onPick: onPick ?? ((template) => {
            history.pushState(null, "", `${BASE}sheets/?view=edit`);
            route(root, store, { template });
          }),
        });
      } catch (err) {
        console.error("Study Desk: the sheet editor didn’t load", err);
        status.textContent = "The editor didn’t load. Check your connection, then try again.";
        return;
      } finally {
        loading = false;
      }
      fresh.setAttribute("aria-controls", chooser.id);
      row.append(chooser);
    }
    chooser.toggle();
  });
  row.append(fresh, status);
  return row;
}

/** "Import a Study Desk file": a sheet someone saved with "Export a Study Desk file (.md)". */
function openFileRow(root, store) {
  const row = make("p", "sheets-page__open-file");
  const pick = button(IMPORT_LABEL);
  pick.title = "Open a sheet someone sent you as a Study Desk file (.md)";
  const input = make("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
  input.hidden = true;
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  pick.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    status.textContent = "";
    // A file far past any share's size isn't read into memory at all (SEC3-4).
    if (file.size > MAX_SHARE_FILE_BYTES) {
      status.textContent = SHARE_ERRORS["too-large"];
      return;
    }
    let fragment = null;
    try {
      fragment = fragmentInFile(await file.text());
    } catch (err) {
      // A data line begun but unreadable is damaged, not missing (BA87).
      if (err instanceof ShareError) {
        status.textContent = err.message;
        return;
      }
    }
    if (!fragment) {
      status.textContent = SHARE_ERRORS["no-data"];
      return;
    }
    // Kept in this tab's history entry, as a shared link's is, so a reload keeps it.
    history.replaceState({ litSharedSheet: fragment }, "", `${BASE}sheets/`);
    await showShared(root, store, fragment);
  });
  row.append(pick, input, status);
  return row;
}

async function showShared(root, store, fragment, { phone = false } = {}) {
  let opened;
  try {
    opened = await openShare(fragment, ctx());
  } catch (err) {
    if (!(err instanceof ShareError)) console.error("Study Desk: the shared sheet couldn't be read", err);
    else if (err.detail) console.warn("Study Desk: the shared sheet was refused:", err.detail);
    root.replaceChildren(make("h1", "sheets-page__title", "A shared sheet"));
    const p = make("p", "sheets-page__intro", err instanceof ShareError ? err.message : SHARE_ERRORS.invalid);
    root.append(p);
    if (store) root.append(openFileRow(root, store));
    return;
  }
  await drawSheet(root, { sheet: opened.sheet, store, shared: opened.scope, phone, fragment });
}

async function showSheet(root, store, id, view = null) {
  let sheet = null;
  try {
    sheet = await store.get(id);
  } catch (_) {}
  if (sheet?.kind !== "sheet") {
    root.replaceChildren(make("h1", "sheets-page__title", "Sheet not found"));
    const p = make("p", "sheets-page__intro");
    const all = make("a", null, "your sheets");
    all.href = `${BASE}sheets/`;
    p.append(document.createTextNode("This sheet isn’t in this browser’s notebook. It may have been deleted, or made on another computer. See "), all, document.createTextNode("."));
    root.append(p);
    return;
  }

  if (view === "presenter") {
    await showPresenterView({ root, sheet, store });
    return;
  }
  await drawSheet(root, { sheet, store, view });
}

/**
 * The sheet's page: its toolbar and the copy on screen. `shared` is the scope
 * of a sheet someone shared ("leader" or "participant"), which is shown read
 * only with "Import into my notebook"; absent for the reader's own.
 *
 * `demo` is the Sheets tour's (E63): the versions of the tour's sheet, which
 * is never saved, drawn as for the reader's own. It leaves out the links row
 * ("‹ My sheets" and "Edit on the Study Desk" leave the tour, and the second
 * names an id no notebook holds), its Edit returns to the tour's editor
 * (`demo.onEdit`) without touching the address, and nothing here writes a
 * record: Print, Copy, Save as, Share and Present work on the sheet in hand.
 * The presenter view's window reads the sheet from the notebook, so it can't
 * find this one; a reader who opens it has left the tour's script.
 */
async function drawSheet(root, { sheet, store, view = null, shared = null, phone = false, fragment = null, demo = null }) {
  const id = sheet.id;
  const n0 = viewSeq;
  const copies = shared === "participant" ? ["participant"] : COPIES;
  let copy = copies[0];
  let paper = storedPaper() ?? defaultPaper(navigator.languages ?? [navigator.language]);
  let codes = true;
  let answerKey = storedAnswerKey();
  setPaper(paper);

  const bar = make("div", "sheets-page__bar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", phone ? "Version, presenting, printing, and sharing" : "Version, paper, and printing");
  const back = make("a", "sheets-page__back", "‹ My sheets");
  back.href = `${BASE}sheets/`;
  const edit = make("a", "sheets-page__back", "Edit on the Study Desk");
  edit.href = `${BASE}desk/?sheet=${encodeURIComponent(id)}`;
  const links = make("div", "sheets-page__links");
  // A phone has no sheets of its own to go back to, and no desk (NB6-8).
  if (!phone) links.append(back);
  if (!shared) links.append(edit);

  const copyChoice = choices("sheet-copy", "Version", copies.map((c) => [c, COPY_NAMES[c]]), copy, (v) => {
    copy = v;
    draw();
  });
  const paperChoice = choices("sheet-paper", "Paper", Object.entries(PAPERS).map(([k, p]) => [k, p.name]), paper, (v) => {
    paper = v;
    setPaper(v);
    try { localStorage.setItem(PAPER_KEY, v); } catch (_) {}
  });
  const codeBox = make("label", "sheets-page__codes");
  const codeInput = make("input");
  codeInput.type = "checkbox";
  codeInput.checked = codes;
  codeInput.addEventListener("change", () => {
    codes = codeInput.checked;
    draw();
  });
  codeBox.append(codeInput, document.createTextNode(" Show QR codes"));
  codeBox.title = "A QR code beside each chapter’s first passage, which opens it in the LIT app or on litbible.net";
  // "Add an answer key" belongs to the leader's version, so it shows there only.
  const keyBox = make("label", "sheets-page__keybox");
  const keyInput = make("input");
  keyInput.type = "checkbox";
  keyInput.checked = answerKey;
  keyInput.addEventListener("change", () => {
    answerKey = keyInput.checked;
    try { localStorage.setItem(ANSWER_KEY, answerKey ? "on" : "off"); } catch (_) {}
    draw();
  });
  keyBox.append(keyInput, document.createTextNode(" Add an answer key"));
  keyBox.title = "End the leader’s version with each passage’s blanks and their answers, to print or save";
  keyBox.hidden = copy !== "leader";
  // A phone gets none of these choices, so none of their descriptions (SH6-11).
  const hints = phone ? [] : [describe(keyInput, "Ends the leader’s version with each passage’s blanks and their answers, to print or save."), describe(codeInput,"A QR code beside each chapter’s first passage, which opens it in the LIT app or on litbible.net.")];

  const actions = make("div", "sheets-page__actions");
  // Edit (S12, part 1, step 2): the page becomes the editor. The reader's
  // own sheets only; a shared one is imported first.
  const editHere = button("Edit", "desk-sheet__btn sheets-page__edit");
  editHere.title = "Change this sheet here, on its own page";
  editHere.addEventListener("click", () => {
    if (demo) {
      demo.onEdit();
      return;
    }
    history.pushState(null, "", `${BASE}sheets/?id=${encodeURIComponent(id)}&view=edit`);
    route(root, store);
  });
  const present = button("Present");
  present.title = "Show this sheet to a room, full screen, one part at a time";
  const print = button("Print", "desk-sheet__btn desk-sheet__btn--primary");
  const word = button("Copy");
  word.prepend(copyGlyph());
  // The visible "Copy" opens the name, so a screen reader says what is copied.
  word.setAttribute("aria-label", "Copy this version to the clipboard");
  word.title = "Copy this version with its headings, italics, and notice, to paste into Word, Google Docs, or Pages";
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  const share = button("Share…", phone ? "desk-sheet__btn desk-sheet__btn--primary" : "desk-sheet__btn");
  share.title = phone ? "Send this sheet’s link with your phone’s share sheet" : "Send this sheet to someone as a link or a file";
  if (phone) print.classList.remove("desk-sheet__btn--primary");
  // Present is hidden and Share left out on a shared sheet, so theirs are not
  // written (SH6-11); a phone shows both, and has no Copy.
  hints.push(
    ...(shared && !phone ? [] : [describe(present, "Shows this sheet to a room, full screen, one part at a time.")]),
    ...(phone ? [] : [describe(word, "Copies this version with its headings, italics, and notice, to paste into Word, Google Docs, or Pages.")]),
    ...(shared && !phone ? [] : [describe(share, phone ? "Sends this sheet’s link with your phone’s share sheet." : "Sends this sheet to someone as a link or a file.")]),
  );
  // Save as (E37) follows the Version choice, as Print and Copy do.
  const save = createSaveMenu({ version: () => COPY_NAMES[copy], onChoose: (item) => saveAs(item) });
  // Presenting needs the presenter view's window to find the sheet, so a
  // shared one is copied into the desk first.
  // A phone presents without the presenter view, so it needs no saved copy.
  if (shared && !phone) present.hidden = true;
  if (phone) actions.append(present, print, share);
  else actions.append(...(shared ? [] : [editHere]), present, print, word, save.el);
  if (!shared) actions.append(share);
  actions.append(status);
  if (phone) {
    root.classList.add("sheets-page--phone");
    bar.append(...(copies.length > 1 ? [copyChoice] : []), actions, ...hints);
  } else {
    bar.append(...(demo ? [] : [links]), copyChoice, paperChoice, codeBox, keyBox, actions, ...hints);
  }

  const paperBox = make("div", "sheets-page__paper");
  // S2's notice. A shared sheet carries no comparison copies (desk-sheet-share),
  // so it never has one.
  const checkBox = make("section", "sheets-page__check");
  checkBox.hidden = true;
  // The "what prints" notice, for the participant version.
  const leaksBox = make("section", "sheets-page__leaks");
  leaksBox.hidden = true;
  root.replaceChildren(...(shared && !demo ? [sharedBanner(root, sheet, store, shared, { phone })] : []), bar, checkBox, leaksBox, paperBox);
  share.addEventListener("click", () => (phone ? sharePhone(sheet, fragment, say) : openShareDialog(sheet, share)));

  let current = null;
  let seq = 0;
  let ready = Promise.resolve();
  function draw() {
    const n = ++seq;
    paperBox.setAttribute("aria-busy", "true");
    keyBox.hidden = copy !== "leader";
    ready = renderCopy(sheet, { copy, codes, answerKey })
      .then(async (el) => {
        if (n !== seq) return;
        current = el;
        paperBox.replaceChildren(el);
        document.title = `${sheetName(sheet)}, ${COPY_NAMES[copy].toLowerCase()} | Liberation and Inclusion Translation`;
        drawLeaks(leaksBox, []);
        if (copy === "participant" && !shared) {
          // Never on a shared link: the notice names the answer (SH6-2).
          // Quiet and best effort: a failure here never costs the reader their copy.
          copyLeaks(sheet, el).then((leaks) => { if (n === seq) drawLeaks(leaksBox, leaks); }).catch((err) => console.error("Study Desk: the what-prints check didn't finish", err));
        }
        if (shared) return;
        const checks = await copyChecks(sheet, copy);
        if (n === seq) drawCheck(checkBox, checks, edit.href);
      })
      .catch((err) => {
        console.error("Study Desk: the sheet couldn't be drawn", err);
        if (n === seq) paperBox.replaceChildren(make("p", "sheets-page__empty", "This sheet couldn’t be drawn. Reload the page to try again."));
      })
      .finally(() => {
        if (n === seq) paperBox.removeAttribute("aria-busy");
      });
    return ready;
  }

  let presenting = null;
  const startPresenting = async ({ fullscreen }) => {
    if (presenting) return;
    presenting = openPresentation({
      sheet,
      store,
      fullscreen,
      touch: phone,
      onClose: () => {
        presenting = null;
        if (!root.contains(document.activeElement)) present.focus();
        if (!demo && new URLSearchParams(location.search).get("view")) {
          history.replaceState(history.state, "", `${BASE}sheets/?id=${encodeURIComponent(sheet.id)}`);
        }
      },
    });
    await presenting;
  };
  present.addEventListener("click", () => startPresenting({ fullscreen: true }));

  const printCopy = async () => {
    await ready;
    window.print();
  };
  print.addEventListener("click", printCopy);
  word.addEventListener("click", async () => {
    await ready;
    if (!current) return;
    const ok = await copyToClipboard(copyForWord(current));
    say(ok ? `${COPY_NAMES[copy]} copied. Paste it into your document.` : "Your browser didn’t allow the copy. Choose Copy again.");
  });
  let quiet = 0;
  function say(text, { keep = false } = {}) {
    clearTimeout(quiet);
    status.textContent = text;
    if (!keep) quiet = setTimeout(() => { status.textContent = ""; }, 6000);
  }

  /** A Save as item: a file of the version on screen, or Print for a PDF. */
  async function saveAs(item) {
    if (item.slides) return saveSlides(item);
    if (item.print) {
      // Said before the print window opens, since it holds the page until closed.
      say("In the print window, choose “Save as PDF” as the printer.");
      await printCopy();
      return;
    }
    await ready;
    if (!current) return;
    const name = documentFileName(sheetName(sheet), copy, item.ext);
    say("Making the file…", { keep: true });
    try {
      const doc = await drawCodes(readCopy(current));
      const write = await writerFor(item.id);
      const bytes = await write(doc, { title: sheetName(sheet), version: COPY_NAMES[copy], paper, date: Date.now() });
      download(bytes, item.mime, name);
      say(`Saved ${name}.${doc.codesMissing ? ` ${CODES_MISSING}` : ""}`);
    } catch (err) {
      console.error("Study Desk: couldn't make the file", err);
      say("The file couldn’t be made. The sheet is unchanged: try again in a moment.");
    }
  }

  /**
   * A Slides item (E37 phase B): the room's screens as a .pptx or .odp, or
   * printed one to a page for a PDF. The same slides whichever version is on
   * screen; the participant version's have no speaker notes (SEC3-3).
   */
  async function saveSlides(item) {
    say(item.print ? "Laying out the slides…" : "Making the slides…", { keep: true });
    try {
      const { printSlides, readSlides } = await import("./sheet-slides.js");
      const deck = await readSlides(sheet, { participant: copy === "participant" });
      if (item.print) {
        say("In the print window, choose “Save as PDF” as the printer.");
        await printSlides(deck);
        return;
      }
      const name = documentFileName(sheetName(sheet), "slides", item.ext);
      const write = await writerFor(item.id);
      download(await write(deck, { title: sheetName(sheet), date: Date.now() }), item.mime, name);
      say(`Saved ${name}.${deck.codesMissing ? ` ${CODES_MISSING}` : ""}`);
    } catch (err) {
      console.error("Study Desk: couldn't make the slides", err);
      say("The slides couldn’t be made. The sheet is unchanged: try again in a moment.");
    }
  }

  // A change made on /desk in another tab shows here too.
  // Until the page draws another view (`route`).
  // The tour's sheet (`demo`) is in no notebook, so nothing changes it there.
  const stop = shared || demo ? null : store.subscribe(async (ids) => {
    if (n0 !== viewSeq) {
      stop?.();
      return;
    }
    if (!ids?.includes?.(sheet.id)) return;
    let next = null;
    try {
      next = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (n0 !== viewSeq) return;
    if (next?.kind !== "sheet") {
      showSheet(root, store, id, view);
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(sheet)) return;
    sheet = next;
    draw();
  });

  await draw();
  // Opened to present (the Sheets pane's "Present…"): full screen waits for
  // the leader's first click, which a browser requires.
  if (view === "present") startPresenting({ fullscreen: false });
}

/**
 * S2: the passages whose wording changed since they were added, above the
 * paper, each with what moved. Hidden when there are none.
 */
function drawCheck(box, checks, deskHref) {
  const summary = checkSummary(checks);
  box.hidden = !summary;
  if (!summary) {
    box.replaceChildren();
    return;
  }
  box.setAttribute("aria-labelledby", "sheetCheckHead");
  const head = make("h2", "sheets-page__check-head", summary.headline);
  head.id = "sheetCheckHead";
  const list = make("ul", "sheets-page__check-list");
  for (const { m, check } of checks) {
    if (check?.state !== "changed") continue;
    const li = make("li");
    li.append(make("p", "sheets-page__check-ref", passageReference(m)));
    const diff = diffParagraph(check.diff);
    if (diff) li.append(diff);
    list.append(li);
  }
  const advice = make("p", "sheets-page__check-advice", `${summary.advice} `);
  const link = make("a", null, "Open it on the Study Desk");
  link.href = deskHref;
  advice.append(link);
  box.replaceChildren(head, list, advice);
}

/**
 * The "what prints" notice: where a blank's words print again on the
 * participant version, one line each. Hidden when there is nothing to say;
 * it never blocks printing or saving.
 */
function drawLeaks(box, leaks) {
  box.hidden = !leaks.length;
  if (!leaks.length) {
    box.replaceChildren();
    return;
  }
  const head = make("p", "sheets-page__leaks-head", leaks.length === 1 ? "A blank’s words also print elsewhere" : "Some blanks’ words also print elsewhere");
  const list = make("ul", "sheets-page__leaks-list");
  for (const l of leaks) list.append(make("li", null, leakSentence(l)));
  box.replaceChildren(head, list);
}

/**
 * On a phone, Share… hands the same link to the phone's share sheet (NB6-8),
 * so a participant share stays one. Where there is no share sheet, it copies
 * the link instead.
 */
async function sharePhone(sheet, fragment, say) {
  const url = `${location.origin}${BASE}sheets/#${fragment}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: sheetName(sheet), url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    say("Link copied. Paste it into a message or an email.");
  } catch (_) {
    say("Your browser didn’t allow sharing or copying. Forward the message that held this link instead.");
  }
}

/** "Shared with you", with "Import into my notebook" (on a computer). */
function sharedBanner(root, sheet, store, scope, { phone = false } = {}) {
  const box = make("div", "sheets-page__shared");
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "A shared sheet");
  const p = make("p");
  const strong = make("strong", null, "Shared with you. ");
  if (phone) {
    // Nothing on a phone saves a sheet (NB6-8): the banner only says where to.
    p.append(strong, document.createTextNode("To keep a copy or change it, open this link on a computer."));
    box.append(p);
    return box;
  }
  p.append(
    strong,
    document.createTextNode(
      scope === "participant"
        ? "This is the participant’s version of a sheet. It isn’t in your notebook until you import it."
        : "This sheet isn’t in your notebook until you import it.",
    ),
  );
  const take = button("Import into my notebook", "desk-sheet__btn desk-sheet__btn--primary");
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  if (!store) {
    take.disabled = true;
    status.textContent = "This browser isn’t letting the site keep a notebook, so the sheet can be printed but not imported.";
  }
  take.addEventListener("click", async () => {
    take.disabled = true;
    const mine = copyOfShared(sheet, ctx());
    try {
      await store.save(mine);
    } catch (err) {
      console.error("Study Desk: couldn't import the shared sheet", err);
      status.textContent = "The sheet couldn’t be imported into your notebook. It is still here to print: try again in a moment.";
      take.disabled = false;
      return;
    }
    // From here the page is the reader's own copy, at its own address.
    history.replaceState(null, "", `${BASE}sheets/?id=${encodeURIComponent(mine.id)}`);
    await drawSheet(root, { sheet: mine, store });
    // Heard through `announce` below, not as a status of its own, so it isn't read twice.
    const done = make("p", "sheets-page__shared");
    const open = make("a", null, "the Study Desk");
    open.href = `${BASE}desk/?sheet=${encodeURIComponent(mine.id)}`;
    done.append(document.createTextNode("Copied into your notebook. Change it here with Edit, or on "), open, document.createTextNode("."));
    root.prepend(done);
    // The Import button is gone with the banner, so focus would fall to the top of the page (SH5-10).
    open.focus();
    // A status line put in with its words already in it is seldom read out,
    // and the focus move would speak over it, so the undo bar's live region,
    // always in the page, says it (Audit 8, XA8-8).
    announce("Copied into your notebook. Change it here with Edit, or on the Study Desk.");
  });
  box.append(p, take, status);
  return box;
}

/** The Share dialog: a link (and its code, when it is short enough) or a file. */
function openShareDialog(sheet, opener) {
  const dialog = make("dialog", "sheets-page__dialog");
  dialog.setAttribute("aria-labelledby", "sheet-share-title");
  const h = make("h2", null, "Share this sheet");
  h.id = "sheet-share-title";
  let scope = "leader";
  const scopeChoice = choices("sheet-share-scope", "What to share", [
    ["leader", "Everything, for another leader"],
    ["participant", "The participant’s version, without answers or Leader only parts"],
  ], scope, (v) => {
    scope = v;
    refresh();
  });
  // The note says the link is long because the sheet is in it (E58; BVJ,
  // 2026-11-08): a first link read as a few hundred random characters.
  const note = make(
    "p",
    "sheets-page__dialog-note",
    "The link is long because the whole sheet is in it: litbible.net never sees or stores it. Anyone who has the link can open it (on a phone to read, present, or print it, or on a computer to keep it too), and any service that carries it, such as email, can read it, so send the participant’s version when you’re unsure. The passages are read from the LIT when it is opened.",
  );
  const copyLink = button("Copy link", "desk-sheet__btn desk-sheet__btn--primary");
  const saveFile = button(EXPORT_LABEL);
  saveFile.title = `A Study Desk file (.md) of the sheet, which opens on another computer with “${IMPORT_LABEL}” on the Sheets page`;
  const saveFileHint = describe(saveFile, `A Study Desk file (.md) of the sheet, which opens on another computer with “${IMPORT_LABEL}” on the Sheets page.`);
  // Save as is the other kind of file (E37), and a PDF comes from Print: say where both are.
  const fileNote = make(
    "p",
    "sheets-page__dialog-note",
    `A Study Desk file (.md) opens on another computer with “${IMPORT_LABEL}” on the Sheets page. To open the sheet in Word or another program, use Save as. For a PDF, choose Print, then “Save as PDF” in the print window.`,
  );
  const status = make("p", "sheets-page__status");
  status.setAttribute("role", "status");
  const code = make("figure", "sheets-page__share-code");
  // A × in the corner as well as Cancel in the row (BVJ, 2026-11-06).
  const x = button("×", "lit-panel__close sheets-page__dialog-x");
  x.setAttribute("aria-label", "Close");
  const cancel = button("Cancel");
  const row = make("div", "sheets-page__dialog-actions");
  row.append(copyLink, saveFile, cancel);
  dialog.append(x, h, scopeChoice, note, row, fileNote, status, code, saveFileHint);
  document.body.append(dialog);

  let link = "";
  let seq = 0;
  async function refresh() {
    const n = ++seq;
    copyLink.disabled = true;
    try {
      const made = await shareLink(sheet, { origin: location.origin, base: BASE, scope });
      if (n !== seq) return;
      link = made;
    } catch (err) {
      console.error("Study Desk: couldn't make the link", err);
      status.textContent = `The link couldn’t be made in this browser. Choose ${EXPORT_LABEL} instead.`;
      return;
    }
    copyLink.disabled = false;
    code.replaceChildren();
    if (link.length <= QR_LINK_LIMIT) {
      const img = make("img");
      img.alt = "A code for this link";
      img.width = 160;
      img.height = 160;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(link, { level: "L", title: "A code for this link" }))}`;
      code.append(img, make("figcaption", null, "Or scan this code to get the link."));
    } else if (link.length > 4000) {
      code.append(make("p", "sheets-page__dialog-note", "This sheet makes a long link, which some email programs cut short. A file is safer for a sheet this size."));
    }
  }
  copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      status.textContent = "Link copied. It is long because the sheet is in it. Paste it into an email or a message.";
    } catch (_) {
      status.textContent = `Your browser didn’t allow the copy. Choose ${EXPORT_LABEL} instead.`;
    }
  });
  saveFile.addEventListener("click", async () => {
    try {
      const text = await shareFile(sheet, { scope });
      const a = make("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
      a.download = shareFileName(sheet);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      status.textContent = `Saved ${a.download}. Send it as an attachment.`;
    } catch (err) {
      console.error("Study Desk: couldn't save the file", err);
      status.textContent = copyLink.disabled
        ? "The file couldn’t be made. The sheet is unchanged: try again in a moment."
        : "The file couldn’t be made. The sheet is unchanged: choose Copy link instead.";
    }
  });
  for (const b of [x, cancel]) b.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    opener?.focus();
  });
  dialog.showModal();
  // Open on the first choice, not the ×, so the dialog reads from "What to share" (SH5-17).
  scopeChoice.querySelector("input")?.focus();
  refresh();
}

async function start() {
  const root = document.querySelector("[data-sheet-page]");
  if (!root) return;
  addDeskStyle();
  root.classList.add("sheets-page__root");
  let store = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    console.error("Study Desk: the notebook didn’t open", err);
  }
  // `/sheets/?sheet-tour` (the help page's link) starts the Sheets tour once
  // the page is drawn (E63), and leaves the address.
  const wantsTour = new URLSearchParams(location.search).has("sheet-tour");
  if (wantsTour) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("sheet-tour");
      history.replaceState(history.state, "", url);
    } catch (_) {}
  }
  const shared = history.state?.litSharedSheet;
  if (typeof shared === "string" && shared) {
    await showShared(root, store, shared);
    return;
  }
  if (!store) {
    root.replaceChildren(make("h1", "sheets-page__title", "Sheets"), make("p", "sheets-page__empty", "This browser isn’t letting the site keep a notebook, so there are no sheets to show. Private windows sometimes don’t. Open the site in a regular window to keep sheets."));
    return;
  }
  // Back and Forward between the list, a sheet, its editor, and a file
  // opened from the list. A shared link's fragment is the inline script's,
  // which reloads the page for it.
  addEventListener("popstate", () => route(root, store));
  // Started by the address: no offer then, and the tour 600 ms after the
  // first view, as on /desk.
  await route(root, store, { offer: !wantsTour });
  if (wantsTour) setTimeout(async () => (await pageTour(root, store))?.start(), 600);
}

/**
 * Draw the view the address names: the list, a sheet's versions, or the
 * editor (`view=edit`, with the sheet's id, or `template`, a new sheet's,
 * chosen under New sheet…). The list and a sheet's versions may bring the
 * Sheets tour's offer (`offer: false` holds it back).
 */
async function route(root, store, { template = null, focus = null, offer = true } = {}) {
  const n = ++viewSeq;
  clearTimeout(tourOfferTimer);
  editing?.destroy();
  editing = null;
  const shared = history.state?.litSharedSheet;
  if (typeof shared === "string" && shared) {
    await showShared(root, store, shared);
    return;
  }
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const view = params.get("view");
  if (view === "edit" && (id || template)) {
    let editSheet;
    try {
      ({ editSheet } = await import("./sheet-page-edit.js"));
    } catch (err) {
      console.error("Study Desk: the sheet editor didn’t load", err);
      root.replaceChildren(make("h1", "sheets-page__title", "Sheets"), make("p", "sheets-page__empty", "The editor didn’t load. Check your connection, then reload the page."));
      return;
    }
    if (n !== viewSeq) return;
    // Focus goes where the editor's button pointed: the list's heading, or
    // the sheet's Edit button.
    const go = (address, focusOn) => {
      history.pushState(null, "", address);
      route(root, store, { focus: focusOn });
    };
    // Sent from a Sheets pane's "Open on its own page": no two-tab question,
    // and the marker leaves the address, so a reload asks as usual.
    const fromDesk = params.get("from") === "desk";
    if (fromDesk && id) history.replaceState(history.state, "", `${BASE}sheets/?id=${encodeURIComponent(id)}&view=edit`);
    editing = editSheet({
      root,
      store,
      ctx,
      id,
      template,
      askFirst: !fromDesk,
      // A new sheet's address gains its id once it is saved.
      onSaved: (sheetId) => history.replaceState(null, "", `${BASE}sheets/?id=${encodeURIComponent(sheetId)}&view=edit`),
      onList: () => go(`${BASE}sheets/`, "list"),
      onDone: (sheetId) => go(`${BASE}sheets/?id=${encodeURIComponent(sheetId)}`, "edit"),
      // Not editing after all: the versions, in place of the edit address,
      // so Back doesn't ask again.
      onCancel: (sheetId) => {
        history.replaceState(null, "", `${BASE}sheets/?id=${encodeURIComponent(sheetId)}`);
        route(root, store, { focus: "edit" });
      },
    });
    document.title = "Edit a sheet | Liberation and Inclusion Translation";
    return;
  }
  if (id) await showSheet(root, store, id, view);
  else await showList(root, store);
  // Not over a presentation, nor where no sheet was found.
  if (n === viewSeq && offer && view !== "present" && view !== "presenter" && tourViewShown(root)) offerTourLater(root, store);
  if (n !== viewSeq || !focus) return;
  const to = root.querySelector(focus === "edit" ? ".sheets-page__edit" : ".sheets-page__title");
  if (to && !to.matches("button")) to.tabIndex = -1;
  to?.focus();
}

/* ── The Sheets tour on this page (E63) ─────────────────────────────────── */

/**
 * The Sheets tour, loaded and made the first time it is offered or started;
 * null when it didn't load. Its host is this page's (`tourHost`).
 */
async function pageTour(root, store) {
  if (!sheetTour) {
    let createSheetTour;
    try {
      ({ createSheetTour } = await import("./sheet-tour.js"));
    } catch (err) {
      console.error("Study Desk: the Sheets tour didn’t load", err);
      return null;
    }
    sheetTour ??= createSheetTour({ host: tourHost(root, store) });
  }
  return sheetTour;
}

/** The list or a sheet's own versions on the page: where the tour may be offered. */
const tourViewShown = (root) =>
  !editing && !root.querySelector(":scope > .sheets-page__shared") &&
  Boolean(root.querySelector(":scope > .sheets-page__new, :scope > .sheets-page__bar"));

/**
 * The tour's offer, 1.6 seconds after the list or a sheet's versions is
 * drawn, when the seen list (one for both pages) says there is something to
 * offer. The rules are loaded then (they bring `desk-layout.mjs` with them,
 * which the page has no other use for), and the tour only if they say so.
 * Another view drawn meanwhile (`route`) cancels it, and the tour checks the
 * rest when it comes.
 */
function offerTourLater(root, store) {
  clearTimeout(tourOfferTimer);
  tourOfferTimer = setTimeout(async () => {
    let rules;
    try {
      rules = await import("../../../lib/desk-first-use.mjs");
    } catch (err) {
      console.error("Study Desk: the Sheets tour’s rules didn’t load", err);
      return;
    }
    let raw = null;
    try {
      raw = localStorage.getItem(rules.SHEET_TOUR_KEY);
    } catch (_) {
      return;
    }
    if (!rules.tourOffer(raw, { today: rules.localDay(new Date()), steps: rules.SHEET_TOUR_STEPS }).kind) return;
    (await pageTour(root, store))?.maybeOffer();
  }, 1600);
}

/**
 * The Sheets tour's host on this page (E63; the tour and the host's methods
 * are described in sheet-tour.js). It acts on the page's own list, editor and
 * versions view, and **never changes the address or history**: it draws its
 * views into `root`, each a view of the page's (`viewSeq`), so one still being
 * drawn, or a view's listener, stops when another is drawn; at the end
 * `route()` draws whatever the address names. Its one editor stays alive
 * across its views, the tour's sheet living in it, held in `editing` so a
 * route (Back, or the end) takes it down; the list and the versions view take
 * it off the page, and `editor()` puts it back. Nothing here writes a record:
 * the editor is in example mode, and the versions view is `drawSheet`'s `demo`.
 */
function tourHost(root, store) {
  let tourEditing = null; // { destroy, editor }, the tour's editor view, while it lives
  let tourRow = null; // the tour's list's "New sheet…" row, while it is on the page
  let shown = null; // the versions view drawn for the tour's sheet: { el, marks, present, sheet }
  let pick = null; // the tour's template pick, for every list it draws
  const nextView = () => ++viewSeq;
  const editTitle = () => {
    document.title = "Edit a sheet | Liberation and Inclusion Translation";
  };

  const host = {
    view: "page",
    canKeep: Boolean(store),

    // The reader's own editor, if the page showed one, is put away (its typing
    // is saved by its own destroy, the reader's write), and no offer comes.
    begin({ onPick }) {
      clearTimeout(tourOfferTimer);
      pick = onPick;
      editing?.destroy();
      editing = null;
      nextView();
      return true;
    },

    async editor({ onMade = null, live = null, show = true } = {}) {
      if (!tourEditing || editing !== tourEditing) {
        let editSheet;
        try {
          ({ editSheet } = await import("./sheet-page-edit.js"));
        } catch (err) {
          console.error("Study Desk: the sheet editor didn’t load", err);
          return null;
        }
        if (live && !live()) return null;
        if (!tourEditing || editing !== tourEditing) {
          nextView();
          editing?.destroy();
          shown = null;
          tourRow = null;
          tourEditing = editing = editSheet({
            root,
            store,
            ctx,
            id: null,
            template: null,
            // Its sheet is never saved, so it never has an address.
            onSaved: () => {},
            // "‹ All sheets" and Done go to the tour's own list and versions.
            onList: () => host.showList(),
            onDone: () => host.versions(tourEditing.editor),
            onCancel: () => {},
          });
          editTitle();
          // In the same tick, before the editor's first view would draw the page's list.
          onMade?.(tourEditing.editor);
          return tourEditing.editor;
        }
      }
      const { editor } = tourEditing;
      if (show && !editor.el.isConnected) {
        nextView();
        shown = null;
        tourRow = null;
        root.replaceChildren(make("h1", "sr-only", "Edit a sheet"), editor.el);
        root.classList.add("sheets-page--editing");
        editTitle();
      }
      return editor;
    },

    // The page's own list, whose "New sheet…" starts the tour's sheet.
    async showList({ onPick = null } = {}) {
      nextView();
      shown = null;
      root.classList.remove("sheets-page--editing");
      await showList(root, store, { onPick: onPick ?? pick });
      const row = root.querySelector(":scope > .sheets-page__new");
      tourRow = row;
      const fresh = row?.querySelector("button");
      return row ? { el: row, side: "right", marks: fresh ? [fresh] : [] } : null;
    },

    // That list's chooser, opened as its button opens it (which loads the
    // editor's code). `waitFor` is the tour's, so this page carries no copy.
    async openChooser({ onPick = null, live = null, waitFor } = {}) {
      if (!tourRow?.isConnected) await host.showList({ onPick });
      const row = tourRow;
      if (!row?.isConnected || (live && !live())) return null;
      const open = () => {
        const box = row.querySelector(".desk-sheet__templates");
        return box && !box.hidden ? box : null;
      };
      if (!open()) row.querySelector("button")?.click();
      const chooser = await waitFor(open);
      if (!chooser) return null;
      return {
        el: chooser,
        side: "right",
        marks: [chooser],
        undo: () => {
          if (chooser.isConnected && !chooser.hidden) chooser.toggle();
        },
      };
    },

    /**
     * The versions view of the tour's sheet, drawn unless it is on the page
     * already. `drawSheet` puts its bar in the root before it first waits, so
     * the bar is there at once; the copy follows.
     */
    versions(editor) {
      const sheet = editor?.sheet();
      if (!sheet) return null;
      if (shown?.el.isConnected && shown.sheet === sheet) return shown;
      nextView();
      tourRow = null;
      root.classList.remove("sheets-page--editing");
      drawSheet(root, { sheet, store, demo: { onEdit: () => host.editor() } }).catch((err) =>
        console.error("Study Desk: the tour’s sheet couldn’t be drawn", err),
      );
      const bar = root.querySelector(":scope > .sheets-page__bar");
      if (!bar) return null;
      const actions = bar.querySelector(".sheets-page__actions");
      const version = bar.querySelector("input[name='sheet-copy']")?.closest("fieldset") ?? null;
      const present = Array.from(actions?.querySelectorAll("button") ?? []).find((b) => b.textContent.trim() === "Present") ?? null;
      shown = { el: bar, marks: [version, actions].filter(Boolean), present, sheet };
      return shown;
    },

    // Continue reading's chapter, from its verse, else John 3:16. Its reader
    // is a reading page's module, loaded here only for the tour.
    async passage() {
      let r = null;
      try {
        const { loadLastRead } = await import("../../last-read.js");
        r = loadLastRead();
      } catch (_) {}
      return r ? { bookKey: r.book, chapter: r.chapter, verse: r.verse ?? null } : { bookKey: "john", chapter: 3, verse: 16 };
    },

    // The tour's editor taken down, and the page back to what its address names.
    finish() {
      editing?.destroy();
      editing = null;
      tourEditing = null;
      tourRow = null;
      shown = null;
      route(root, store);
    },

    returnFallback() {
      const title = root.querySelector(".sheets-page__title");
      if (title) {
        title.tabIndex = -1;
        return title;
      }
      return root.querySelector("button");
    },

    /**
     * Beside the page's content: to its right where there is room, else to
     * its left, else over its top right corner.
     */
    placeOffer(w) {
      const box = root.getBoundingClientRect();
      const GAP = 12;
      const EDGE = 8;
      const width = Math.min(300, innerWidth - 2 * EDGE);
      w.style.width = `${width}px`;
      w.style.top = `${Math.max(EDGE, box.top)}px`;
      if (box.right + GAP + width <= innerWidth - EDGE) w.style.left = `${box.right + GAP}px`;
      else if (box.left - GAP - width >= EDGE) w.style.left = `${box.left - GAP - width}px`;
      else w.style.left = `${Math.max(EDGE, Math.min(box.right, innerWidth - EDGE) - width)}px`;
    },

    // Focus in something the reader types in, which the offer leaves alone.
    working() {
      const at = document.activeElement;
      return at instanceof HTMLElement && (at.isContentEditable || at.matches("input, textarea, select"));
    },

    canOffer: () => tourViewShown(root),
    otherOffer: () => false,
  };
  return host;
}

/**
 * A shared sheet on a phone or tablet (NB6-8): read from the link, shown
 * without the notebook, which is never opened. Called by sheet-share-gate.js.
 */
export async function showSharedOnPhone(root, fragment) {
  addDeskStyle();
  root.classList.add("sheets-page__root");
  await showShared(root, null, fragment, { phone: true });
}

// desk-gate.js loads this file only with the desk on; a phone imports it for
// showSharedOnPhone alone.
if (document.documentElement.dataset.desk === "on") start();
