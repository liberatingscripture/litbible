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
// - **Print**, which prints the copy on screen, and **Copy for Word** (S9),
//   which puts the same copy on the clipboard as formatted text and as plain.
// Present (3j) and opening a shared sheet with "Copy into my desk" (3k) come
// later.

import { COPIES, COPY_NAMES, defaultPaper, PAPERS, pageRule, paperName } from "../../lib/desk-sheet-copy.mjs";
import { sheetName, sortSheets } from "../../lib/desk-sheet-passages.mjs";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { renderCopy } from "./sheet-copy.js";
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
  root.append(intro);
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

async function showSheet(root, store, id) {
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

  let copy = "leader";
  let paper = storedPaper() ?? defaultPaper(navigator.languages ?? [navigator.language]);
  let codes = true;
  setPaper(paper);

  const bar = make("div", "sheets-page__bar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Copy, paper and printing");
  const back = make("a", "sheets-page__back", "‹ My sheets");
  back.href = `${BASE}sheets/`;
  const edit = make("a", "sheets-page__back", "Edit on the Study Desk");
  edit.href = `${BASE}desk/`;
  const links = make("div", "sheets-page__links");
  links.append(back, edit);

  const copyChoice = choices("sheet-copy", "Copy", COPIES.map((c) => [c, COPY_NAMES[c]]), copy, (v) => {
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
  const print = button("Print", "desk-sheet__btn desk-sheet__btn--primary");
  const word = button("Copy for Word");
  word.title = "Copy this copy with its headings, italics, and notice, to paste into Word, Google Docs, or Pages";
  const status = make("span", "sheets-page__status");
  status.setAttribute("role", "status");
  actions.append(print, word, status);
  bar.append(links, copyChoice, paperChoice, codeBox, actions);

  const paperBox = make("div", "sheets-page__paper");
  root.replaceChildren(bar, paperBox);

  let current = null;
  let seq = 0;
  let ready = Promise.resolve();
  function draw() {
    const n = ++seq;
    paperBox.setAttribute("aria-busy", "true");
    ready = renderCopy(sheet, { copy, codes })
      .then((el) => {
        if (n !== seq) return;
        current = el;
        paperBox.replaceChildren(el);
        document.title = `${sheetName(sheet)}, ${COPY_NAMES[copy].toLowerCase()} | LIT Bible`;
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
  store.subscribe(async (ids) => {
    if (!ids?.includes?.(sheet.id)) return;
    let next = null;
    try {
      next = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (next?.kind !== "sheet") {
      showSheet(root, store, id);
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(sheet)) return;
    sheet = next;
    draw();
  });

  await draw();
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
  if (!store) {
    root.replaceChildren(make("h1", "sheets-page__title", "Sheets"), make("p", "sheets-page__empty", "This browser isn’t letting the site keep a notebook, so there are no sheets to show. Private windows sometimes don’t."));
    return;
  }
  const id = new URLSearchParams(location.search).get("id");
  if (id) await showSheet(root, store, id);
  else await showList(root, store);
}

start();
