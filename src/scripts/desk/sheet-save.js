// src/scripts/desk/sheet-save.js
//
// "Save as ▾" on a sheet's page (STUDY-DESK-FIXES.md, E37; BVJ, 2026-11-06):
// the version on screen as a document to open in another program. It follows
// the toolbar's Version choice, as Print and Copy do; the Share dialog's
// "Export a Study Desk file (.md)" is the other kind of file, one for another Study
// Desk. The groups and items are SAVE_GROUPS (desk-sheet-doc.mjs): "A
// document" and "Slides" (E37 phase B, sheet-slides.js).
//
// Each writer is loaded by a dynamic import only when its item is chosen, so
// the sheet page's own chunk carries the menu and not the formats. The page
// is reached only through desk-gate.js with data-desk="on", so none of it is
// in a reader's bundle. "PDF…" writes nothing: it runs the toolbar's Print
// (or, under Slides, prints the slides), and says to choose "Save as PDF" in
// the print window.
//
// The menu is a button with aria-haspopup and a role="menu" under it, as
// /desk's title menu is: the arrows, Home and End move through the items,
// Escape closes it and gives focus back to the button, and a click outside
// or a Tab out closes it.

import { SAVE_GROUPS } from "../../lib/desk-sheet-doc.mjs";
import { make } from "./dom.js";

/** Each format's writer, loaded when chosen: (doc, opts) => Promise<Uint8Array>. */
const WRITERS = {
  docx: () => import("../../lib/desk-doc-docx.mjs").then((m) => m.docxFile),
  odt: () => import("../../lib/desk-doc-odt.mjs").then((m) => m.odtFile),
  rtf: () => import("../../lib/desk-doc-rtf.mjs").then((m) => m.rtfFile),
  // Slides take the deck sheet-slides.js reads, not the document model.
  pptx: () => import("../../lib/desk-slides-pptx.mjs").then((m) => m.pptxFile),
  odp: () => import("../../lib/desk-slides-odp.mjs").then((m) => m.odpFile),
};

/** How many pixels a module of a code to scan is drawn at in the PNG. */
const CODE_SCALE = 8;

/** A code's SVG (qrSvg's) as PNG bytes, drawn on a canvas: { png, pixels }. */
export async function codePng(svg) {
  const modules = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1]) || 41;
  const pixels = modules * CODE_SCALE;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = make("canvas");
  canvas.width = pixels;
  canvas.height = pixels;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, pixels, pixels);
  g.drawImage(img, 0, 0, pixels, pixels);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The canvas made no PNG");
  return { png: new Uint8Array(await blob.arrayBuffer()), pixels };
}

/**
 * Each code block's PNG (`png`, `pixels`), drawn from the SVG the copy shows.
 * A code that can't be drawn is left out of the file.
 */
export async function drawCodes(doc) {
  for (const b of doc.blocks) {
    if (b.type !== "code" || !b.svg) continue;
    try {
      Object.assign(b, await codePng(b.svg));
    } catch (err) {
      console.error("Study Desk: a code to scan couldn't be drawn for the file", err);
    }
  }
  return doc;
}

/** A file the reader's browser saves (its downloads), as the share file is saved. */
export function download(bytes, type, name) {
  const a = make("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** The writer for a format: (doc, opts) => Promise<Uint8Array>. */
export async function writerFor(id) {
  const load = WRITERS[id];
  if (!load) throw new Error(`No writer for ${id}`);
  return load();
}

/**
 * The menu.
 *
 * @param {{ version: () => string, onChoose: (item: object) => unknown }} options
 *   `version` names the version on screen ("Leader version"), for the menu's
 *   first line; `onChoose` runs an item once the menu has closed.
 * @returns {{ el: HTMLElement }}
 */
export function createSaveMenu({ version, onChoose }) {
  const wrap = make("div", "sheets-page__save");
  const button = make("button", "desk-sheet__btn sheets-page__save-button", "Save as");
  button.type = "button";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.title = "Save this version as a document to open in Word or another program";
  const chevron = make("span", "sheets-page__save-more");
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M6 9l6 6 6-6" /></svg>`;
  button.append(chevron);

  const menu = make("div", "sheets-page__save-menu");
  menu.id = "sheetSaveMenu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  button.setAttribute("aria-controls", menu.id);
  // The version the files hold, as the menu's first line; the menu's name says it too.
  const versionLine = make("p", "sheets-page__save-version");
  versionLine.setAttribute("aria-hidden", "true");
  menu.append(versionLine);

  const items = [];
  let hints = 0;
  for (const group of SAVE_GROUPS) {
    const box = make("div", "sheets-page__save-group");
    box.setAttribute("role", "group");
    const head = make("p", "sheets-page__save-head", group.label);
    head.id = `sheetSaveGroup-${group.id}`;
    head.setAttribute("role", "presentation");
    box.setAttribute("aria-labelledby", head.id);
    box.append(head);
    for (const item of group.items) {
      const b = make("button", "sheets-page__save-item");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.tabIndex = -1;
      b.append(make("span", "sheets-page__save-label", item.label));
      if (item.hint) {
        const hint = make("span", "sheets-page__save-hint", item.hint);
        hint.id = `sheetSaveHint${++hints}`;
        b.append(hint);
        b.setAttribute("aria-label", item.label);
        b.setAttribute("aria-describedby", hint.id);
      }
      b.addEventListener("click", () => {
        close({ focus: true });
        Promise.resolve()
          .then(() => onChoose(item))
          .catch((err) => console.error("Study Desk: Save as didn't finish", err));
      });
      box.append(b);
      items.push(b);
    }
    menu.append(box);
  }
  wrap.append(button, menu);

  const outside = (e) => {
    if (!wrap.contains(/** @type {Node} */ (e.target))) close({ focus: false });
  };

  function open() {
    const name = version();
    versionLine.textContent = name;
    menu.setAttribute("aria-label", `Save the ${name.toLowerCase()} as`);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    items[0]?.focus();
  }

  function close({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    if (focus) button.focus();
  }

  button.addEventListener("click", () => (menu.hidden ? open() : close()));
  button.addEventListener("keydown", (e) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && menu.hidden) {
      e.preventDefault();
      open();
      if (e.key === "ArrowUp") items.at(-1)?.focus();
    }
  });
  menu.addEventListener("keydown", (e) => {
    const i = items.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  // Tabbing out of the menu closes it, as a click elsewhere does. Focus going
  // nowhere (Safari doesn't focus a pressed button) leaves it to the click.
  menu.addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (to instanceof Node && !wrap.contains(to)) close({ focus: false });
  });

  return { el: wrap };
}
