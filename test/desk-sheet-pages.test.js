// The /sheets copy as pages (sheet-pages.js; BVJ, 2026-11-10). happy-dom has no
// layout, so where the breaks fall was checked in the Browser pane; these hold
// what doesn't need one: the paper lengths, and that the spacers never reach
// Copy or a saved file.

import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers/browser-env.mjs";

const { lengthPx, unpaged, unpaginate } = await import("../src/scripts/desk/sheets/sheet-pages.js");
const { copyForWord } = await import("../src/scripts/desk/sheets/sheet-word.js");

test("lengthPx: inches and millimeters in CSS pixels", () => {
  assert.equal(lengthPx("11in"), 1056);
  assert.equal(lengthPx("0.75in"), 72);
  assert.ok(Math.abs(lengthPx("297mm") - 1122.52) < 0.01);
  assert.ok(Number.isNaN(lengthPx("12pt")));
});

function copyWithSpacers() {
  const article = document.createElement("article");
  article.className = "sheet-copy";
  article.innerHTML =
    '<header class="sheet-copy__head"><h1 class="sheet-copy__title">Romans 8</h1></header>' +
    '<div class="sheet-page-gap" aria-hidden="true"></div>' +
    '<section class="sheet-copy__text"><div class="desk-rich">' +
    '<p>The first line and <em>the</em></p>' +
    '<div class="sheet-page-gap" aria-hidden="true"></div>' +
    "</div></section>" +
    '<footer class="sheet-copy__foot"><p class="sheet-copy__credit">Credit</p></footer>';
  // A spacer inside a paragraph splits its text, as a line break between pages does.
  const p = article.querySelector("p");
  const tail = p.firstChild.splitText(10);
  const gap = document.createElement("span");
  gap.className = "sheet-page-gap";
  p.insertBefore(gap, tail);
  return article;
}

test("unpaged: Copy reads the copy as if there were no pages", () => {
  const article = copyWithSpacers();
  const clean = copyWithSpacers();
  for (const s of clean.querySelectorAll(".sheet-page-gap")) s.remove();
  clean.normalize();
  assert.deepEqual(copyForWord(article), copyForWord(clean));
  // The copy on screen keeps its spacers; only what is read loses them.
  assert.equal(article.querySelectorAll(".sheet-page-gap").length, 3);
  assert.equal(unpaged(article).querySelectorAll(".sheet-page-gap").length, 0);
});

test("unpaginate: the copy as one block again, its text whole", () => {
  const article = copyWithSpacers();
  article.dataset.paged = "";
  article.style.height = "2136px";
  unpaginate(article);
  assert.equal(article.querySelectorAll(".sheet-page-gap").length, 0);
  assert.equal(article.dataset.paged, undefined);
  assert.equal(article.style.height, "");
  assert.equal(article.querySelector("p").childNodes[0].nodeValue, "The first line and ");
});
