// src/scripts/desk/sheet-page.js
//
// A sheet's own address, /sheets/ (STUDY-DESK.md, D9, "Phase 3a's answers",
// 2; "Order of work", 3i). Loaded by desk-gate.js on a computer with the
// preview switched on, when the page carries [data-sheet-page]. Sheets are
// edited on /desk only; this page shows one, prints it and copies it, and
// never writes a record:
//
// - `/sheets/` lists the reader's sheets; `/sheets/?id=<id>` shows one. The id
//   is a random one that means nothing outside this browser's notebook.
// - **Leader copy or Participant copy** (S4), drawn by sheet-copy.js from
//   today's text, and redrawn when the sheet changes on /desk in another tab.
// - **Paper**: US Letter or A4 (C27), guessed from the reader's languages
//   until they choose, then kept in `localStorage['lit-sheet-paper']` (named in
//   /privacy's paragraph). The page's own preview is drawn at that paper's width.
// - **Show QR codes** (S5; "Codes to scan" until 2026-11-06), one per
//   chapter, on by default; not kept.
// - **Checked before printing** (S2): a passage whose wording changed since it
//   was added is named above the paper, with what moved, and the copy's foot
//   says the day its text is from. The notice is for the screen only; the
//   copy prints today's wording either way, and the new wording is kept on
//   /desk, since this page never writes.
// - **Print**, which prints the copy on screen, and **Copy** (S9; E36 renamed
//   it from "Copy for Word"), which puts the same copy on the clipboard as
//   formatted text and as plain.
// - **Save as ▾** (E37; sheet-save.js): the same copy as a document for
//   another program (.docx, .odt or .rtf, each writer loaded when chosen), or
//   "PDF…", which runs Print. Copy and the files read the copy on screen into
//   one model (readCopy in sheet-word.js), so they can't disagree.
// - **Present** (3j): the sheet shown to a room, full screen, with the reveal
//   and a presenter view (sheet-present.js). `&view=present` opens it
//   straight away (the Sheet pane's "Present…"), and `&view=presenter` is the
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

import { COPIES, COPY_NAMES, defaultPaper, PAPERS, pageRule, paperName } from "../../lib/desk-sheet-copy.mjs";
import {
  QR_LINK_LIMIT,
  ShareError,
  SHARE_ERRORS,
  copyOfShared,
  fragmentInFile,
  openShare,
  shareFile,
  shareFileName,
  shareLink,
} from "../../lib/desk-sheet-share.mjs";
import { qrSvg } from "../../lib/qr-svg.mjs";
import { sheetName, sortSheets } from "../../lib/desk-sheet-passages.mjs";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { checkSummary } from "../../lib/desk-sheet-check.mjs";
import { passageReference } from "../../lib/desk-sheet-passages.mjs";
import { documentFileName } from "../../lib/desk-sheet-doc.mjs";
import { copyChecks, renderCopy } from "./sheet-copy.js";
import { diffParagraph } from "./diff-view.js";
import { openPresentation, showPresenterView } from "./sheet-present.js";
import { createSaveMenu, download, drawCodes, writerFor } from "./sheet-save.js";
import { copyForWord, readCopy } from "./sheet-word.js";
import { openStore } from "./store.js";
import { make } from "./dom.js";

const PAPER_KEY = "lit-sheet-paper";
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

async function showList(root, store) {
  document.title = "My sheets | Liberation and Inclusion Translation";
  root.replaceChildren(make("h1", "sheets-page__title", "My sheets"));
  let sheets = [];
  try {
    sheets = sortSheets((await store.all()).filter((r) => r.kind === "sheet"));
  } catch (err) {
    console.error("Study Desk: couldn't read the sheets", err);
  }
  const desk = make("a", null, "the Study Desk");
  desk.href = `${BASE}desk/`;
  const intro = make("p", "sheets-page__intro");
  intro.append(
    document.createTextNode("Each sheet here can be printed as a leader’s version or a participant’s version, copied, or saved as a document for Word or another program. Sheets are made and changed on "),
    desk,
    document.createTextNode(", in a Sheet pane."),
  );
  root.append(intro, openFileRow(root, store));
  if (!sheets.length) {
    root.append(make("p", "sheets-page__empty", "You haven’t made a sheet yet."));
    return;
  }
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
  root.append(ul);
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

async function showShared(root, store, fragment) {
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
  await drawSheet(root, { sheet: opened.sheet, store, shared: opened.scope });
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
 */
async function drawSheet(root, { sheet, store, view = null, shared = null }) {
  const id = sheet.id;
  const copies = shared === "participant" ? ["participant"] : COPIES;
  let copy = copies[0];
  let paper = storedPaper() ?? defaultPaper(navigator.languages ?? [navigator.language]);
  let codes = true;
  setPaper(paper);

  const bar = make("div", "sheets-page__bar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Version, paper, and printing");
  const back = make("a", "sheets-page__back", "‹ My sheets");
  back.href = `${BASE}sheets/`;
  const edit = make("a", "sheets-page__back", "Edit on the Study Desk");
  edit.href = `${BASE}desk/?sheet=${encodeURIComponent(id)}`;
  const links = make("div", "sheets-page__links");
  links.append(back);
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
  const hints = [describe(codeInput, "A QR code beside each chapter’s first passage, which opens it in the LIT app or on litbible.net.")];

  const actions = make("div", "sheets-page__actions");
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
  const share = button("Share…");
  share.title = "Send this sheet to someone as a link or a file";
  hints.push(
    describe(present, "Shows this sheet to a room, full screen, one part at a time."),
    describe(word, "Copies this version with its headings, italics, and notice, to paste into Word, Google Docs, or Pages."),
    describe(share, "Sends this sheet to someone as a link or a file."),
  );
  // Save as (E37) follows the Version choice, as Print and Copy do.
  const save = createSaveMenu({ version: () => COPY_NAMES[copy], onChoose: (item) => saveAs(item) });
  // Presenting needs the presenter view's window to find the sheet, so a
  // shared one is copied into the desk first.
  if (shared) present.hidden = true;
  actions.append(present, print, word, save.el);
  if (!shared) actions.append(share);
  actions.append(status);
  bar.append(links, copyChoice, paperChoice, codeBox, actions, ...hints);

  const paperBox = make("div", "sheets-page__paper");
  // S2's notice. A shared sheet carries no comparison copies (desk-sheet-share),
  // so it never has one.
  const checkBox = make("section", "sheets-page__check");
  checkBox.hidden = true;
  root.replaceChildren(...(shared ? [sharedBanner(root, sheet, store, shared)] : []), bar, checkBox, paperBox);
  share.addEventListener("click", () => openShareDialog(sheet, share));

  let current = null;
  let seq = 0;
  let ready = Promise.resolve();
  function draw() {
    const n = ++seq;
    paperBox.setAttribute("aria-busy", "true");
    ready = renderCopy(sheet, { copy, codes })
      .then(async (el) => {
        if (n !== seq) return;
        current = el;
        paperBox.replaceChildren(el);
        document.title = `${sheetName(sheet)}, ${COPY_NAMES[copy].toLowerCase()} | Liberation and Inclusion Translation`;
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
      onClose: () => {
        presenting = null;
        if (!root.contains(document.activeElement)) present.focus();
        if (new URLSearchParams(location.search).get("view")) {
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
      say(`Saved ${name}.`);
    } catch (err) {
      console.error("Study Desk: couldn't make the file", err);
      say("The file couldn’t be made. The sheet is unchanged: try again in a moment.");
    }
  }

  /**
   * A Slides item (E37 phase B): the room's screens as a .pptx or .odp, or
   * printed one to a page for a PDF. The same whichever version is on screen.
   */
  async function saveSlides(item) {
    say(item.print ? "Laying out the slides…" : "Making the slides…", { keep: true });
    try {
      const { printSlides, readSlides } = await import("./sheet-slides.js");
      const deck = await readSlides(sheet);
      if (item.print) {
        say("In the print window, choose “Save as PDF” as the printer.");
        await printSlides(deck);
        return;
      }
      const name = documentFileName(sheetName(sheet), "slides", item.ext);
      const write = await writerFor(item.id);
      download(await write(deck, { title: sheetName(sheet), date: Date.now() }), item.mime, name);
      say(`Saved ${name}.`);
    } catch (err) {
      console.error("Study Desk: couldn't make the slides", err);
      say("The slides couldn’t be made. The sheet is unchanged: try again in a moment.");
    }
  }

  // A change made on /desk in another tab shows here too.
  if (!shared) store.subscribe(async (ids) => {
    if (!ids?.includes?.(sheet.id)) return;
    let next = null;
    try {
      next = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (next?.kind !== "sheet") {
      showSheet(root, store, id, view);
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(sheet)) return;
    sheet = next;
    draw();
  });

  await draw();
  // Opened to present (the Sheet pane's "Present…"): full screen waits for
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

/** "Shared with you", with "Import into my notebook". */
function sharedBanner(root, sheet, store, scope) {
  const box = make("div", "sheets-page__shared");
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "A shared sheet");
  const p = make("p");
  const strong = make("strong", null, "Shared with you. ");
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
    const done = make("p", "sheets-page__shared");
    done.setAttribute("role", "status");
    const open = make("a", null, "Open it on the Study Desk");
    open.href = `${BASE}desk/?sheet=${encodeURIComponent(mine.id)}`;
    done.append(document.createTextNode("Copied into your notebook. "), open, document.createTextNode(" to change it."));
    root.prepend(done);
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
  const note = make(
    "p",
    "sheets-page__dialog-note",
    "The link holds the sheet itself, so litbible.net never sees or stores it. Anyone who has the link can open it on a computer, and any service that carries it, such as email, can read it, so send the participant’s version when you’re unsure. The passages are read from the LIT when it is opened.",
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
      status.textContent = "Link copied. Paste it into an email or a message.";
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
  const shared = history.state?.litSharedSheet;
  if (typeof shared === "string" && shared) {
    await showShared(root, store, shared);
    return;
  }
  if (!store) {
    root.replaceChildren(make("h1", "sheets-page__title", "Sheets"), make("p", "sheets-page__empty", "This browser isn’t letting the site keep a notebook, so there are no sheets to show. Private windows sometimes don’t. Open the site in a regular window to keep notes."));
    return;
  }
  const id = new URLSearchParams(location.search).get("id");
  const view = new URLSearchParams(location.search).get("view");
  if (id) await showSheet(root, store, id, view);
  else await showList(root, store);
}

start();
