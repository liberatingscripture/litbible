// A sheet's own text size (STUDY-DESK-FIXES.md, E101; BVJ, 2026-11-11): the
// `textSize` field, how it is set, checked and shared, and the saved files
// that print at it. The editor and the paper read it through `sheetTextScale`;
// the Display tray never reaches it (desk.css, `--sheet-ui`).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SHEET_TEXT_SIZE,
  SHEET_TEXT_SIZES,
  sheetTextScale,
  sheetTextSize,
  validateSheet,
} from "../src/lib/desk-sheet-format.mjs";
import { createSheet, duplicateSheet, makeModule, setSheetFields, templateFromSheet } from "../src/lib/desk-sheets.mjs";
import { sharedSheet, sheetFromShared } from "../src/lib/desk-sheet-share.mjs";
import { docHtml } from "../src/lib/desk-sheet-doc.mjs";
import { docxParts } from "../src/lib/desk-doc-docx.mjs";
import { odtParts } from "../src/lib/desk-doc-odt.mjs";
import { rtfText } from "../src/lib/desk-doc-rtf.mjs";

const T0 = "2026-11-11T12:00:00.000Z";
const T1 = "2026-11-11T12:05:00.000Z";
const ctx = { client: "web-test", contentVersion: "v20261111.abcdef12", now: T0 };
const at = (now) => ({ ...ctx, now });

function sheet(over = {}) {
  return createSheet({ title: "Sizes", template: "blank", modules: [makeModule("text", { html: "<p>Hello.</p>" })], ...over }, ctx);
}

test("the sizes a sheet offers, and the standard among them", () => {
  assert.deepEqual([...SHEET_TEXT_SIZES], [11, 12, 14, 16, 18]);
  assert.equal(SHEET_TEXT_SIZE, 12);
  assert.ok(SHEET_TEXT_SIZES.includes(SHEET_TEXT_SIZE));
});

test("sheetTextSize reads the field, and anything else as the standard", () => {
  assert.equal(sheetTextSize(sheet()), 12);
  assert.equal(sheetTextSize({ textSize: 16 }), 16);
  assert.equal(sheetTextSize({ textSize: 13 }), 12);
  assert.equal(sheetTextSize({ textSize: "16" }), 12);
  assert.equal(sheetTextSize(null), 12);
  assert.equal(sheetTextScale({ textSize: 18 }), 1.5);
  assert.equal(sheetTextScale({}), 1);
});

test("validateSheet takes the offered sizes or none, and refuses any other", () => {
  assert.deepEqual(validateSheet(sheet()), []);
  for (const size of SHEET_TEXT_SIZES) assert.deepEqual(validateSheet({ ...sheet(), textSize: size }), [], `size ${size}`);
  for (const bad of [13, 0, "16", 16.5, true]) {
    assert.ok(validateSheet({ ...sheet(), textSize: bad }).some((p) => /textSize/.test(p)), `refuses ${JSON.stringify(bad)}`);
  }
});

test("setSheetFields sets a size, and the standard size takes the field away", () => {
  const s = sheet();
  const big = setSheetFields(s, { textSize: 16 }, at(T1));
  assert.equal(big.textSize, 16);
  assert.equal(big.modified, T1);
  assert.equal(setSheetFields(big, { textSize: 16 }, at(T1)), big, "no change, the same sheet");

  const back = setSheetFields(big, { textSize: 12 }, at(T1));
  assert.equal("textSize" in back, false, "12 is the standard, kept as no field");
  assert.equal("textSize" in setSheetFields(big, { textSize: null }, at(T1)), false);
  assert.equal(setSheetFields(s, { textSize: 12 }, at(T1)), s, "already standard");

  assert.throws(() => setSheetFields(s, { textSize: 13 }, at(T1)), /text size is one of/);
  assert.throws(() => setSheetFields(s, { textSize: "16" }, at(T1)), /text size is one of/);
});

test("a duplicate and a template keep the sheet's size", () => {
  const big = setSheetFields(sheet(), { textSize: 18 }, at(T1));
  assert.equal(duplicateSheet(big, at(T1)).textSize, 18);
  assert.equal(templateFromSheet(big, at(T1)).textSize, 18);
});

test("a share carries a size that isn't the standard, and opening it keeps only an offered one", () => {
  assert.equal("textSize" in sharedSheet(sheet()), false);
  const big = setSheetFields(sheet(), { textSize: 14 }, at(T1));
  for (const scope of ["leader", "participant"]) assert.equal(sharedSheet(big, { scope }).textSize, 14, scope);

  const opened = (data) => sheetFromShared(data, { now: T1, client: "web-test" });
  assert.equal(opened(sharedSheet(big)).textSize, 14);
  assert.deepEqual(validateSheet(opened(sharedSheet(big))), []);
  assert.equal("textSize" in opened({ ...sharedSheet(big), textSize: 13 }), false, "an unknown size is dropped, not refused");
  assert.equal("textSize" in opened({ ...sharedSheet(big), textSize: 12 }), false);
});

const doc = (size) => ({
  title: "T",
  ...(size ? { size } : {}),
  blocks: [
    { type: "title", text: "T" },
    { type: "para", inlines: [{ t: "text", text: "hello" }] },
    { type: "foot", inlines: [{ t: "text", text: "credit" }] },
  ],
});

const docxStyles = (d) => docxParts(d, { date: 0 }).find((p) => p.name === "word/styles.xml").data;
const odtStyles = (d) => odtParts(d, { date: 0 }).find((p) => p.name === "styles.xml").data;
const sizes = (text, re) => [...text.matchAll(re)].map((m) => Number(m[1]));
const FS = new RegExp(String.raw`\\fs(\d+)`, "g");

test("at 12 points, or with no size, every file is what it was", () => {
  assert.equal(docxStyles(doc(12)), docxStyles(doc()));
  assert.equal(odtStyles(doc(12)), odtStyles(doc()));
  assert.equal(rtfText(doc(12)), rtfText(doc()));
  assert.equal(docHtml(doc(12)), docHtml(doc()));
});

test("the saved files scale their text by the size, and leave page numbers alone", () => {
  const base = sizes(docxStyles(doc()), /w:sz w:val="(\d+)"/g);
  const big = sizes(docxStyles(doc(16)), /w:sz w:val="(\d+)"/g);
  assert.equal(big.length, base.length);
  big.forEach((v, i) => assert.equal(v, Math.round(base[i] * (16 / 12)), `docx style ${i}`));

  const odtBase = sizes(odtStyles(doc()), /fo:font-size="([\d.]+)pt"/g);
  const odtBig = sizes(odtStyles(doc(16)), /fo:font-size="([\d.]+)pt"/g);
  assert.ok(odtBig.some((v, i) => v > odtBase[i]), "odt sizes grow");

  const rtf12 = rtfText(doc());
  const rtf16 = rtfText(doc(16));
  assert.ok(Math.max(...sizes(rtf16, FS)) > Math.max(...sizes(rtf12, FS)), "rtf sizes grow");
  assert.equal(rtfText(doc()), rtf12, "the rtf writer's scale resets after a sized document");

  const pageNumber = new RegExp(String.raw`\\fs(\d+)\\cf\d+ \{\\field\{\\\*\\fldinst PAGE\}`, "g");
  assert.deepEqual(sizes(rtf16, pageNumber), sizes(rtf12, pageNumber), "rtf page numbers keep their size");
  assert.ok(sizes(rtf12, pageNumber).length > 0, "the rtf has page numbers to compare");
  const docxPages = (d) => docxParts(d, { date: 0 })
    .filter((p) => /word\/(header|footer)/.test(p.name))
    .map((p) => sizes(p.data, /w:sz w:val="(\d+)"/g).join(","));
  assert.deepEqual(docxPages(doc(16)), docxPages(doc()), "docx page numbers keep their size");
  assert.ok(docxPages(doc()).some(Boolean), "the docx has page numbers to compare");

  assert.match(docHtml(doc(16)), /font-size:16pt/);
  assert.doesNotMatch(docHtml(doc()), /font-size:12pt/);
});
