// test/desk-inert.test.js
//
// src/lib/desk-inert.mjs: the scrub applied to a fetched page's parts before
// any pane imports a node of them (audit 3 SEC3-2). The page is the site's
// own and the fetch's address is guarded (SEC-1), so this is the second lock:
// it must hold against what a browser would read, not against the text as
// written, which is where the old scrub let a split `javascript:` through.

import { test } from "node:test";
import assert from "node:assert/strict";

import { makeInert, plainAddress } from "../src/lib/desk-inert.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

const tags = (root) => root.findAll(() => true).map((el) => el.tagName.toLowerCase());

test("plainAddress reads a scheme as a browser does: control characters inside it are dropped first", () => {
  for (const bad of ["javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "\u0001javascript:alert(1)", " javascript:x", "JAVASCRIPT:x", "data:text/html,x", "vbscript:x", "blob:https://x/y", "file:///etc/passwd"]) {
    assert.equal(plainAddress(bad), false, JSON.stringify(bad));
  }
  for (const ok of ["#fn-a", "/romans-8/#v3", "romans-8/", "https://www.sefaria.org/x", "http://example.org/", "mailto:a@b.org", "tel:+1", "?q=1", ""]) {
    assert.equal(plainAddress(ok), true, JSON.stringify(ok));
  }
});

test("makeInert removes what loads, runs, submits or re-bases, and keeps the chapter's own markup", () => {
  const root = parseHtml(
    '<div class="chapter-paragraphs"><p id="t-1-p1"><span class="vglue"><sup id="v1" class="vn">1</sup> Love</span> is <em>patient</em>,<sup class="fn-ref"><a href="#fn-a">a</a></sup>' +
      '<img src="https://x/y.png" /><script>alert(1)</script><style>p{}</style><iframe src="https://x/"></iframe><base href="https://attacker.example/" />' +
      '<form action="https://x/"><input type="image" src="https://x/i.png" /><button>go</button></form><svg><use href="x"></use></svg><picture><source srcset="x" /></picture>' +
      '<object data="x"></object><embed src="x" /><video src="x"></video><audio src="x"></audio><template><p>t</p></template><link rel="stylesheet" href="x" /><meta http-equiv="refresh" content="0;url=x" /></p></div>',
  );
  // (The void elements are self-closed for the test's small parser; a browser's parser closes them itself.)
  makeInert(root);
  assert.deepEqual(tags(root), ["div", "p", "span", "sup", "em", "sup", "a"]);
  assert.equal(root.querySelector("a").getAttribute("href"), "#fn-a");
  assert.equal(root.querySelector("sup").getAttribute("id"), "v1", "ids and classes stay: the anchor reader needs them");
});

test("makeInert strips handlers, styles, resource attributes and every address that isn't a plain web address", () => {
  const root = parseHtml(
    '<div onclick="x()" style="background:url(x)"><a href="java&#9;script:alert(1)" onmouseover="x()">a</a><a href="data:text/html,x">b</a>' +
      '<a href="https://www.sefaria.org/Genesis.1" target="_blank" rel="noopener noreferrer" class="sefaria-ref">c</a><td background="x">d</td>' +
      '<span data-verse="3" ping="https://x/" formaction="x" ONLOAD="x">e</span><a href="\u0001javascript:x">f</a></div>',
  );
  makeInert(root);
  const links = root.querySelectorAll("a");
  assert.equal(links[0].getAttribute("href"), null, "a tab inside the scheme is dropped by a browser, so the scheme is javascript:");
  assert.equal(links[0].getAttribute("onmouseover"), null);
  assert.equal(links[1].getAttribute("href"), null);
  assert.equal(links[2].getAttribute("href"), "https://www.sefaria.org/Genesis.1");
  assert.equal(links[2].getAttribute("target"), "_blank");
  assert.equal(links[2].getAttribute("rel"), "noopener noreferrer");
  assert.equal(links[2].getAttribute("class"), "sefaria-ref");
  assert.equal(links[3].getAttribute("href"), null);
  // The div, not the parser's wrapper, which never had them (Audit 8, LG8-5).
  const div = root.querySelector("div");
  assert.equal(div.getAttribute("onclick"), null);
  assert.equal(div.getAttribute("style"), null);
  assert.equal(root.querySelector("td").getAttribute("background"), null);
  const span = root.querySelector("span");
  assert.equal(span.getAttribute("data-verse"), "3");
  for (const gone of ["ping", "formaction", "ONLOAD"]) assert.equal(span.getAttribute(gone), null, gone);
});

test("makeInert returns what it was given, and tolerates nothing", () => {
  const root = parseHtml("<p>plain</p>");
  assert.equal(makeInert(root), root);
  assert.equal(makeInert(null), null);
});
