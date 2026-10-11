// test/handout-rich.test.js
//
// src/lib/handout-rich.mjs: the two clipboard flavors of "Copy with notes".
// The plain flavor must stay exactly the text the handout always was.

import { test } from "node:test";
import assert from "node:assert/strict";

import { ITALIC_ON, ITALIC_OFF, BOLD_ON, BOLD_OFF, handoutPlain, handoutHtml } from "../src/lib/handout-rich.mjs";

const em = (s) => ITALIC_ON + s + ITALIC_OFF;

const HANDOUT = [
  "In the beginning was the Word.[a]\n— John 1:1 (LIT)",
  "[a] The Greek word is " + em("logos") + ".",
  "Scripture and footnote quotations are from the LIT Bible.\nhttps://litbible.net/john-1#v1",
].join("\n\n");

test("the plain flavor is the handout with only the markers removed", () => {
  assert.equal(
    handoutPlain(HANDOUT),
    [
      "In the beginning was the Word.[a]\n— John 1:1 (LIT)",
      "[a] The Greek word is logos.",
      "Scripture and footnote quotations are from the LIT Bible.\nhttps://litbible.net/john-1#v1",
    ].join("\n\n"),
  );
});

test("the HTML flavor italicizes the marked runs and keeps the layout", () => {
  assert.equal(
    handoutHtml(HANDOUT),
    "<p>In the beginning was the Word.[a]<br>— John 1:1 (LIT)</p>" +
      "<p>[a] The Greek word is <em>logos</em>.</p>" +
      "<p>Scripture and footnote quotations are from the LIT Bible.<br>https://litbible.net/john-1#v1</p>",
  );
});

test("the HTML flavor escapes what would otherwise read as markup", () => {
  assert.equal(handoutHtml("a < b & " + em("c > d")), "<p>a &lt; b &amp; <em>c &gt; d</em></p>");
});

test("an italic run holding only whitespace is not pasted as formatting", () => {
  assert.equal(handoutHtml("one" + em(" ") + "two"), "<p>one two</p>");
});

test("text with no markers round-trips unchanged in the plain flavor", () => {
  assert.equal(handoutPlain("no italics here"), "no italics here");
});

test("bold carries over too, alone and nested with italics", () => {
  const bold = (t) => BOLD_ON + t + BOLD_OFF;
  assert.equal(handoutHtml("a " + bold("b") + " " + bold(em("c"))), "<p>a <strong>b</strong> <strong><em>c</em></strong></p>");
  assert.equal(handoutPlain("a " + bold("b") + " " + bold(em("c"))), "a b c");
  assert.equal(handoutHtml("x" + bold(" ") + "y"), "<p>x y</p>");
});
