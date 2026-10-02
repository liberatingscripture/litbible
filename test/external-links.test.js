// test/external-links.test.js
//
// Unit tests for src/lib/external-links.mjs, the render-time pass that opens
// every link leaving the site in a new tab. Shapes are lifted from the corpus
// (footnotes, articles, the Sefaria links the scripture linker writes).

import { test } from "node:test";
import assert from "node:assert/strict";

import { isExternalHref, openExternalLinks } from "../src/lib/external-links.mjs";

const NEW_TAB = 'target="_blank"';
const REL = 'rel="noopener noreferrer"';

test("an external link gets target and rel", () => {
  const out = openExternalLinks('<a href="https://margmowczko.com/teshuqah-desire/">Marg</a>');
  assert.equal(
    out,
    `<a href="https://margmowczko.com/teshuqah-desire/" ${REL} ${NEW_TAB}>Marg</a>`
  );
});

test("internal links, fragments and mailto are left alone", () => {
  for (const html of [
    '<a href="/john-3/#v16">John 3:16</a>',
    '<a href="#fn-a">a</a>',
    '<a href="mailto:hello@example.org">mail</a>',
    '<a class="sref" href="/romans-2/#v24">Romans 2:24</a>',
  ]) {
    assert.equal(openExternalLinks(html), html);
  }
});

test("a link to this site written in full stays in the tab", () => {
  for (const href of [
    "https://litbible.net/articles/matthew-15-canaanite-woman",
    "https://www.litbible.net/glossary/",
    "http://litbible.net",
  ]) {
    const html = `<a href="${href}">x</a>`;
    assert.equal(openExternalLinks(html), html);
  }
});

test("a look-alike host is external", () => {
  assert.equal(isExternalHref("https://litbible.net.evil.example/"), true);
  assert.equal(isExternalHref("https://notlitbible.net/"), true);
});

test("an existing target is kept, a missing rel is still filled in", () => {
  const out = openExternalLinks(
    '<a href="https://dianabutlerbass.substack.com/p/mary-the-tower" target="_blank" style="color: #209D50">x</a>'
  );
  assert.equal(out.match(/target=/g).length, 1);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, /style="color: #209D50"/);
});

test("an existing rel is extended, not replaced", () => {
  const out = openExternalLinks('<a href="https://apps.apple.com/x" rel="external">x</a>');
  assert.match(out, /rel="external noopener noreferrer"/);
  const once = openExternalLinks('<a href="https://a.example/" rel="noopener">x</a>');
  assert.match(once, /rel="noopener noreferrer"/);
});

test("it is idempotent", () => {
  const html = '<a href="https://a.example/">x</a>';
  const once = openExternalLinks(html);
  assert.equal(openExternalLinks(once), once);
});

test("the scripture linker's Sefaria and eBible links are covered", () => {
  const sefaria = '<a class="sefaria-ref" href="https://www.sefaria.org/Joel.3.1?lang=bi&amp;ven=x">Joel 2:28</a>';
  const out = openExternalLinks(sefaria);
  assert.match(out, /target="_blank"/);
  assert.match(out, /href="https:\/\/www\.sefaria\.org\/Joel\.3\.1\?lang=bi&amp;ven=x"/);
  assert.match(openExternalLinks('<a class="ebible-ref" href="https://ebible.org/eng-web/SIR024.htm">Sirach 24</a>'), /target="_blank"/);
});

test("a > inside an attribute value does not end the tag early", () => {
  const out = openExternalLinks('<a title="a > b" href="https://a.example/">x</a>');
  assert.match(out, /target="_blank">x<\/a>$/);
});

test("text, other tags and empty input pass through", () => {
  assert.equal(openExternalLinks(""), "");
  assert.equal(openExternalLinks("plain https://a.example/ text"), "plain https://a.example/ text");
  assert.equal(openExternalLinks("<abbr>x</abbr>"), "<abbr>x</abbr>");
});
