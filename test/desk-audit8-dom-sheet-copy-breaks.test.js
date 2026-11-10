// A paper copy keeps one page break where removed parts left two (Audit 8,
// GF8b-12, decision 11, BVJ 2026-11-10): a Leader only part between two
// breaks leaves the participant's version one break, and a copy never starts
// or ends with one.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";
import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";

const { renderCopy } = await import("../src/scripts/desk/sheets/sheet-copy.js");

const ctx = { client: "web/test", contentVersion: "v1", now: "2026-11-10T12:00:00.000Z" };
const text = (words, leaderOnly = false) => makeModule("text", { html: `<p>${words}</p>`, leaderOnly });
const brk = () => makeModule("pageBreak");
const sheet = (modules) => createSheet({ title: "Breaks", modules }, ctx);
/** The copy's body as a string: T for a text part, | for a break. */
async function shape(modules, copy) {
  const article = await renderCopy(sheet(modules), { copy, codes: false });
  return [...article.children]
    .map((el) => (el.classList.contains("sheet-copy__break") ? "|" : el.classList.contains("sheet-copy__text") ? "T" : el.classList.contains("sheet-copy__missing") ? "none" : ""))
    .filter(Boolean)
    .join("");
}

test("GF8b-12: a Leader only part between two breaks leaves the participant one break, the leader both", async () => {
  const modules = [text("Read"), brk(), text("Notes for the leader", true), brk(), text("Discuss")];
  assert.equal(await shape(modules, "leader"), "T|T|T");
  assert.equal(await shape(modules, "participant"), "T|T");
});

test("GF8b-12: no break before the first part or after the last", async () => {
  assert.equal(await shape([brk(), text("A"), brk(), brk(), text("B"), brk()], "leader"), "T|T");
  assert.equal(await shape([text("Only for me", true), brk(), text("A")], "participant"), "T");
});

test("GF8b-12: a version with nothing but breaks says it has nothing yet", async () => {
  assert.equal(await shape([brk(), text("Mine", true), brk()], "participant"), "none");
});
