// test/desk-inert.test.js
//
// src/lib/desk-inert.mjs: the scrub applied to a fetched page's parts before
// any pane imports a node of them (audit 3 SEC3-2). The page is the site's
// own and the fetch's address is guarded (SEC-1), so this is the second lock:
// it must hold against what a browser would read, not against the text as
// written, which is where the old scrub let a split `javascript:` through.

import { test } from "node:test";
import assert from "node:assert/strict";

import { makeInert, plainAddress, siteImageSrc } from "../src/lib/desk-inert.mjs";
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

// E120: Matthew's introduction chart. The opt-in keeps the site's own /images/ pictures and nothing else.

const imgs = (root) => root.querySelectorAll("img");

test("without the option every img is still removed, a site image included", () => {
  const root = parseHtml('<div><img src="/images/matthew-chiasm.png" alt="x" /><p>t</p></div>');
  makeInert(root);
  assert.equal(imgs(root).length, 0);
  const again = parseHtml('<div><img src="/images/matthew-chiasm.png" alt="x" /></div>');
  makeInert(again, {});
  makeInert(again, { siteImages: false });
  assert.equal(imgs(again).length, 0);
});

test("siteImages keeps an img whose raw src is a root-relative path under /images/", () => {
  for (const ok of ["/images/matthew-chiasm.png", "/images/a/b-c_d.2.webp", "/images/9.svg"]) {
    assert.equal(siteImageSrc(ok), true, ok);
    const root = parseHtml(`<div><img src="${ok}" alt="A chart" /></div>`);
    makeInert(root, { siteImages: true });
    assert.equal(imgs(root).length, 1, ok);
    assert.equal(imgs(root)[0].getAttribute("src"), ok);
    assert.equal(imgs(root)[0].getAttribute("alt"), "A chart");
  }
});

test("siteImages removes every other src: other hosts, schemes, other folders, traversal, encodings, empty", () => {
  const bad = [
    "https://litbible.net/images/matthew-chiasm.png", "http://x/images/a.png", "//evil.example/images/a.png",
    "data:image/png;base64,AAAA", "javascript:alert(1)", "/images\\a.png", "\\images/a.png", "/img/a.png", "images/a.png",
    "/images/../secret.png", "/images/a/../b.png", "/images/%2e%2e/a.png", "/images/%2E%2E/a.png", "/images//a.png", "/images/",
    "/images/.hidden.png", "/images/a.png?x=1", "/images/a.png#f", "/images/a b.png", "/images/a.png\n", " /images/a.png", "", "/IMAGES/a.png",
  ];
  for (const src of bad) {
    assert.equal(siteImageSrc(src), false, JSON.stringify(src));
    const root = parseHtml(`<div><img src="${src.replace(/"/g, "&quot;")}" alt="x" /></div>`);
    makeInert(root, { siteImages: true });
    assert.equal(imgs(root).length, 0, JSON.stringify(src));
  }
  const none = parseHtml('<div><img alt="no src" /></div>');
  makeInert(none, { siteImages: true });
  assert.equal(imgs(none).length, 0, "an img with no src goes");
});

test("a kept img keeps only src and alt (plus the decoding and loading hints set here)", () => {
  const root = parseHtml(
    '<div><img src="/images/a.png" alt="A" srcset="https://x/a.png 2x" sizes="100vw" style="width:1px" width="9" height="9" class="c" onerror="x()" onload="x()" ' +
      'loading="eager" crossorigin="use-credentials" referrerpolicy="unsafe-url" usemap="#m" ismap="ismap" data-x="1" id="i" title="t" /></div>',
  );
  makeInert(root, { siteImages: true });
  const img = imgs(root)[0];
  assert.deepEqual([...img.getAttributeNames()].sort(), ["alt", "decoding", "loading", "src"]);
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.equal(img.getAttribute("decoding"), "async");
  assert.equal(img.getAttribute("src"), "/images/a.png");
});

test("siteImages still removes picture and source, and an img inside a picture, and the figure's style", () => {
  const root = parseHtml(
    '<div><picture><source srcset="/images/a.webp" /><img src="/images/a.png" alt="p" /></picture>' +
      '<figure style="margin:0"><img src="/images/b.png" alt="b" style="x:y" /><figcaption style="a:b">cap</figcaption></figure></div>',
  );
  makeInert(root, { siteImages: true });
  assert.equal(root.querySelectorAll("picture").length, 0);
  assert.equal(root.querySelectorAll("source").length, 0);
  assert.equal(imgs(root).length, 1);
  assert.equal(imgs(root)[0].getAttribute("alt"), "b");
  assert.equal(root.querySelector("figure").getAttribute("style"), null);
  assert.equal(root.querySelector("figcaption").getAttribute("style"), null);
});
