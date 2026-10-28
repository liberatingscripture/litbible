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
// - **Codes to scan** (S5), one per chapter, on by default; not kept.
// - **Checked before printing** (S2): a passage whose wording changed since it
//   was added is named above the paper, with what moved, and the copy's foot
//   says the day its text is from. The notice is for the screen only; the
//   copy prints today's wording either way, and the new wording is kept on
//   /desk, since this page never writes.
// - **Print**, which prints the copy on screen, and **Copy for Word** (S9),
//   which puts the same copy on the clipboard as formatted text and as plain.
// - **Present** (3j): the sheet shown to a room, full screen, with the reveal
//   and a presenter view (sheet-present.js). `&view=present` opens it
//   straight away (the Sheet pane's "Present…"), and `&view=presenter` is the
//   presenter view's own window.
// - **Share…** (3k, S8): the sheet in a link's fragment or in a file
//   (desk-sheet-share.mjs), the whole sheet or the participant copy's parts.
// - **A shared sheet**: `/sheets/#share1.<data>`, whose fragment the page's
//   inline script has already moved into history.state.litSharedSheet before
//   the analytics beacon could read the address, or a file opened with "Open a
//   shared file". Shown like the reader's own, read only, with "Copy into my
//   desk", which saves it as a new sheet of theirs. A participant share offers
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
import { copyChecks, renderCopy } from "./sheet-copy.js";
import { diffParagraph } from "./diff-view.js";
import { openPresentation, showPresenterView } from "./sheet-present.js";
import { copyForWord } from "./sheet-word.js";
import { openStore } from "./store.js";

const PAPER_KEY = "lit-sheet-paper";
const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(label, cls = "desk-sheet__btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
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
  document.title = "My sheets | LIT Bible";
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
    document.createTextNode("Each sheet here can be printed as a leader copy or a participant copy, or copied into Word. Sheets are made and changed on "),
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

/** "Open a shared file": a sheet someone saved with "Save as a file". */
function openFileRow(root, store) {
  const row = make("p", "sheets-page__open-file");
  const pick = button("Open a shared file");
  pick.title = "Open a sheet someone sent you as a file";
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
 * only with "Copy into my desk"; absent for the reader's own.
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
  bar.setAttribute("aria-label", "Copy, paper and printing");
  const back = make("a", "sheets-page__back", "‹ My sheets");
  back.href = `${BASE}sheets/`;
  const edit = make("a", "sheets-page__back", "Edit on the Study Desk");
  edit.href = `${BASE}desk/?sheet=${encodeURIComponent(id)}`;
  const links = make("div", "sheets-page__links");
  links.append(back);
  if (!shared) links.append(edit);

  const copyChoice = choices("sheet-copy", "Copy", copies.map((c) => [c, COPY_NAMES[c]]), copy, (v) => {
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
  codeBox.append(codeInput, document.createTextNode(" Codes to scan"));
  codeBox.title = "A code beside each chapter’s first passage, which opens it in the LIT app or on litbible.net";

  const actions = make("div", "sheets-page__actions");
  const present = button("Present");
  present.title = "Show this sheet to a room, full screen, one part at a time";
  const print = button("Print", "desk-sheet__btn desk-sheet__btn--primary");
  const word = button("Copy for Word");
  word.title = "Copy this copy with its headings, italics, and notice, to paste into Word, Google Docs, or Pages";
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  const share = button("Share…");
  share.title = "Send this sheet to someone as a link or a file";
  // Presenting needs the presenter view's window to find the sheet, so a
  // shared one is copied into the desk first.
  if (shared) present.hidden = true;
  actions.append(present, print, word);
  if (!shared) actions.append(share);
  actions.append(status);
  bar.append(links, copyChoice, paperChoice, codeBox, actions);

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
        document.title = `${sheetName(sheet)}, ${COPY_NAMES[copy].toLowerCase()} | LIT Bible`;
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

  print.addEventListener("click", async () => {
    await ready;
    window.print();
  });
  word.addEventListener("click", async () => {
    await ready;
    if (!current) return;
    const ok = await copyToClipboard(copyForWord(current));
    status.textContent = ok ? `${COPY_NAMES[copy]} copied. Paste it into your document.` : "Your browser didn’t allow the copy.";
    setTimeout(() => { status.textContent = ""; }, 6000);
  });

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

/** "Shared with you", with "Copy into my desk". */
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
        ? "This is the participant copy of a sheet. It isn’t in your notebook until you copy it there."
        : "This sheet isn’t in your notebook until you copy it there.",
    ),
  );
  const take = button("Copy into my desk", "desk-sheet__btn desk-sheet__btn--primary");
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  if (!store) {
    take.disabled = true;
    status.textContent = "This browser isn’t letting the site keep a notebook, so the sheet can be printed but not copied.";
  }
  take.addEventListener("click", async () => {
    take.disabled = true;
    const mine = copyOfShared(sheet, ctx());
    try {
      await store.save(mine);
    } catch (err) {
      console.error("Study Desk: couldn't copy the shared sheet", err);
      status.textContent = "The sheet couldn’t be copied.";
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
    ["participant", "The participant copy, without answers or Leader only parts"],
  ], scope, (v) => {
    scope = v;
    refresh();
  });
  const note = make(
    "p",
    "sheets-page__dialog-note",
    "The link holds the sheet itself, so it never passes through a server and nothing is stored. Anyone who has the link can open it on a computer. The passages are read from the LIT when it is opened.",
  );
  const copyLink = button("Copy link", "desk-sheet__btn desk-sheet__btn--primary");
  const saveFile = button("Save as a file");
  saveFile.title = "A Markdown file of the sheet, which opens with “Open a shared file” on the Sheets page";
  const status = make("p", "sheets-page__status");
  status.setAttribute("role", "status");
  const code = make("figure", "sheets-page__share-code");
  const close = button("Close");
  const row = make("div", "sheets-page__dialog-actions");
  row.append(copyLink, saveFile, close);
  dialog.append(h, scopeChoice, note, row, status, code);
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
      status.textContent = "The link couldn’t be made in this browser. Save as a file instead.";
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
      status.textContent = "Your browser didn’t allow the copy.";
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
      status.textContent = "The file couldn’t be made.";
    }
  });
  close.addEventListener("click", () => dialog.close());
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
    root.replaceChildren(make("h1", "sheets-page__title", "Sheets"), make("p", "sheets-page__empty", "This browser isn’t letting the site keep a notebook, so there are no sheets to show. Private windows sometimes don’t."));
    return;
  }
  const id = new URLSearchParams(location.search).get("id");
  const view = new URLSearchParams(location.search).get("view");
  if (id) await showSheet(root, store, id, view);
  else await showList(root, store);
}

start();
