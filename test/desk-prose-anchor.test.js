// test/desk-prose-anchor.test.js
//
// src/lib/desk-prose-anchor.mjs: the anchor text for a glossary entry's or an
// article's own words (STUDY-DESK.md N11, provisional). The whole body is read
// as one verse, by the scripture's own steps, so what these tests pin down is
// what is specific to prose: where block edges fall, what is never the body's
// text, and how a stored quote is placed again when the body changes.
//
// The DOM is test/helpers/mini-dom.js, as in desk-anchor-dom.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";

import { offsetsToRange, rangeToOffsets } from "../src/lib/desk-anchor-dom.mjs";
import { placeProse, proseAnchorText, proseQuote, proseSegments } from "../src/lib/desk-prose-anchor.mjs";
import { parseHtml } from "./helpers/mini-dom.js";

/** The anchor text of a body written as HTML. */
const read = (html) => proseAnchorText(parseHtml(html));

/** A DOM point as [the text node's text, offset], which reads better than the node. */
const point = (p) => [p.node.nodeValue, p.offset];

/** The text node holding exactly this text. */
const nodeWith = (page, value) => page.textNodes.find((n) => n.nodeValue === value);

/* ── Reading the body ────────────────────────────────────────────────── */

test("the whole body is one verse", () => {
  const page = read("<p>First paragraph.</p><p>Second one.</p>");
  assert.equal(page.text, "First paragraph. Second one.");
  assert.deepEqual([...page.verses], [[1, "First paragraph. Second one."]]);
  assert.deepEqual(page.spans.get(1), [0, page.text.length]);
});

test("a block boundary is one space, whatever the block", () => {
  assert.equal(read("<p>One</p><p>Two</p>").text, "One Two");
  assert.equal(read("<h2>Heading</h2><p>Body text.</p><ul><li>One</li><li>Two</li></ul>").text, "Heading Body text. One Two");
  assert.equal(read("<blockquote>Quoted</blockquote><div>Next</div>").text, "Quoted Next");
  assert.equal(read("<dl><dt>Term</dt><dd>Meaning</dd></dl>").text, "Term Meaning");
  assert.equal(read("<table><tr><td>A</td><td>B</td></tr></table>").text, "A B");
});

test("a line break separates words even when no space was typed", () => {
  assert.equal(read("<p>line one<br>line two</p>").text, "line one line two");
});

test("inline tags vanish, so a word split across them rejoins", () => {
  assert.equal(read("<p>A <em>lib</em><em>eration</em> of <strong>all</strong>.</p>").text, "A liberation of all.");
  assert.equal(read('<p><a href="/glossary/#flesh-body"><em>sar</em>x</a>, not the body</p>').text, "sarx, not the body");
});

test("whitespace collapses and the text is trimmed", () => {
  assert.equal(read("\n  <p>  Many   words\n\t here </p>\n  ").text, "Many words here");
  assert.equal(read("<p>one&nbsp;&nbsp;two</p>").text, "one two");
  assert.equal(read("<p>Spaced </p><p> out</p>").text, "Spaced out");
});

test("it applies the scripture's own steps: composed, invisible characters dropped, brackets stripped", () => {
  assert.equal(read("<p>Iēsous</p>").text, "Iēsous", "a decomposed accent composes");
  assert.equal(read("<p>re­orient​ing</p>").text, "reorienting", "soft hyphen and zero-width space go");
  assert.equal(read("<p>said, ⟦ “Come” ⟧</p>").text, "said, “Come”", "bracket markers go");
});

test("an empty body has no anchor text", () => {
  assert.equal(read("").text, "");
  assert.equal(read("<p> </p>").text, "");
  assert.equal(read("<p><button>Copy</button></p>").text, "");
});

/* ── What isn't the body's own text ──────────────────────────────────── */

test("proseSegments lists text on verse 1, skipped text on none, and a boundary at each block edge", () => {
  const segs = proseSegments(parseHtml("<p>Hi <button>Go</button></p>")).map((s) => (s.boundary ? "|" : [s.verse, s.text]));
  assert.deepEqual(segs, ["|", [1, "Hi "], [null, "Go"], "|"]);
});

test("a button's text is skipped, contents and all", () => {
  assert.equal(read("<p>Read this <button>Copy link</button>closely.</p>").text, "Read this closely.");
  assert.equal(read("<p>Read this <button><span>deep</span> down</button>closely.</p>").text, "Read this closely.");
});

test("sr-only text is skipped, among other classes too", () => {
  assert.equal(read('<p>Visible<span class="sr-only"> for a screen reader only</span> text</p>').text, "Visible text");
  assert.equal(read('<p>Visible<span class="note sr-only extra"> hidden</span> text</p>').text, "Visible text");
  assert.equal(read('<p>Kept<span class="sr-only-not"> words</span></p>').text, "Kept words", "a longer class name is not sr-only");
});

test("anything marked data-desk-skip is skipped", () => {
  assert.equal(read("<p>Entry <span data-desk-skip>A note of yours</span>text</p>").text, "Entry text");
  assert.equal(read('<p>Entry <span data-desk-skip="true">A note of yours</span>text</p>').text, "Entry text");
});

test("footnote references are skipped with their contents", () => {
  assert.equal(read('<p>Claim.<sup class="footnote-ref"><a href="#fn1">1</a></sup> More.</p>').text, "Claim. More.");
  assert.equal(read('<p>Claim.<sup class="fn-ref"><a href="#fn-a">a</a></sup> More.</p>').text, "Claim. More.");
  assert.equal(read('<p>Claim<sup class="x fn-ref">12</sup>, then more.</p>').text, "Claim, then more.");
});

test("a superscript that links to a note is a footnote reference even without a class", () => {
  const root = parseHtml('<p>Claim.<sup><a href="#fn2">2</a></sup> Next.</p>');
  const sup = root.findAll((el) => el.tagName === "SUP")[0];
  // mini-dom has no querySelector; give the superscript the one lookup the rule makes.
  sup.querySelector = (selector) =>
    selector.includes("href^=") && selector.includes("#fn")
      ? (sup.findAll((el) => el.tagName === "A" && el.getAttribute("href")?.startsWith("#fn"))[0] ?? null)
      : null;
  assert.equal(proseAnchorText(root).text, "Claim. Next.");
});

test("an ordinary superscript is body text", () => {
  assert.equal(read("<p>E = mc<sup>2</sup></p>").text, "E = mc2");
  assert.equal(read('<p>The 2<sup class="ordinal">nd</sup> day</p>').text, "The 2nd day");
});

test("scripts, styles and SVG are skipped", () => {
  const html = "<p>Text<script>var x = 1;</script><style>p{}</style><svg><title>Icon</title></svg> after.</p>";
  assert.equal(read(html).text, "Text after.");
});

test("a skipped block still separates the words around it", () => {
  assert.equal(read('<p>One</p><div class="sr-only">Hidden</div><p>Two</p>').text, "One Two");
});

/* ── Quoting ─────────────────────────────────────────────────────────── */

const BODY =
  "Paul uses this word to name the self turned inward, and not the body itself. It is a way of living, not a part of the person.";

test("proseQuote is the exact words with up to 32 characters either side", () => {
  const page = read(`<p>${BODY}</p>`);
  const s = page.text.indexOf("turned inward");
  const q = proseQuote(page, s, s + "turned inward".length);
  assert.equal(q.exact, "turned inward");
  assert.equal(q.prefix.length, 32);
  assert.equal(q.suffix.length, 32);
  assert.equal(q.prefix, "uses this word to name the self ");
  assert.equal(q.suffix, ", and not the body itself. It is");
  assert.deepEqual(Object.keys(q), ["exact", "prefix", "suffix"], "no verse fields: the body has none to name");
});

test("proseQuote keeps less context at either end of the body", () => {
  const page = read(`<p>${BODY}</p>`);
  const first = proseQuote(page, 0, 4);
  assert.deepEqual(first, { exact: "Paul", prefix: "", suffix: page.text.slice(4, 36) });
  const end = page.text.length;
  const last = proseQuote(page, end - 7, end);
  assert.equal(last.exact, "person.");
  assert.equal(last.suffix, "");
  assert.equal(last.prefix.length, 32);
});

test("a quote can run across a block boundary", () => {
  const page = read("<p>First paragraph.</p><p>Second one.</p>");
  const s = page.text.indexOf("paragraph");
  const q = proseQuote(page, s, s + "paragraph. Second".length);
  assert.equal(q.exact, "paragraph. Second");
  assert.equal(q.prefix, "First ");
  assert.equal(q.suffix, " one.");
});

/* ── Finding a quote again ───────────────────────────────────────────── */

function quoteOf(page, words) {
  const s = page.text.indexOf(words);
  assert.ok(s >= 0, `"${words}" is in the body`);
  return proseQuote(page, s, s + words.length);
}

test("placeProse finds the words where they were, and the offsets slice back to them", () => {
  const page = read(`<p>${BODY}</p>`);
  const quote = quoteOf(page, "turned inward");
  const at = placeProse(page, { quote });
  assert.equal(at.status, "found");
  assert.equal(page.text.slice(at.start, at.end), "turned inward");
  assert.equal(at.start, page.text.indexOf("turned inward"));
});

test("placeProse finds the words after they moved elsewhere in the body, and calls it found", () => {
  const before = read("<p>Opening remarks about something else.</p><p>The word turned inward names the self.</p>");
  const quote = quoteOf(before, "turned inward");
  const after = read("<p>The word turned inward names the self.</p><p>Closing remarks, and a long way from where the quote began.</p>");
  const at = placeProse(after, { quote });
  assert.equal(at.status, "found", "there is only one verse, so nothing is ever 'moved'");
  assert.equal(after.text.slice(at.start, at.end), "turned inward");

  const rewrapped = read("<p>Nothing like the old context at all: turned inward, then something else entirely.</p>");
  const again = placeProse(rewrapped, { quote });
  assert.equal(again.status, "found");
  assert.equal(rewrapped.text.slice(again.start, again.end), "turned inward");
});

test("placeProse takes the occurrence whose surroundings match when the words appear twice", () => {
  const page = read("<p>Love is patient. Love is kind. Love never fails.</p>");
  const second = page.text.indexOf("Love is kind");
  const quote = proseQuote(page, second, second + "Love".length);
  const at = placeProse(page, { quote });
  assert.equal(at.status, "found");
  assert.equal(at.start, second);
  const third = page.text.indexOf("Love never");
  assert.equal(placeProse(page, { quote: proseQuote(page, third, third + 4) }).start, third);
});

test("placeProse offers the new words when the quoted ones changed but the context survives", () => {
  const before = read(`<p>${BODY}</p>`);
  const quote = quoteOf(before, "turned inward");
  const after = read(`<p>${BODY.replace("turned inward", "bent in on itself")}</p>`);
  const at = placeProse(after, { quote });
  assert.equal(at.status, "changed");
  assert.equal(after.text.slice(at.start, at.end), "bent in on itself");
});

test("placeProse puts the note on the whole body when nothing usable is left", () => {
  const before = read(`<p>${BODY}</p>`);
  const quote = quoteOf(before, "turned inward");
  const rewritten = read("<p>An entirely different entry, with none of the old sentences in it.</p>");
  assert.deepEqual(placeProse(rewritten, { quote }), { status: "whole", start: null, end: null });
});

test("placeProse doesn't trust a sliver of context", () => {
  const before = read("<p>A. word B.</p>");
  const quote = quoteOf(before, "word");
  assert.equal(quote.prefix, "A. ");
  assert.equal(quote.suffix, " B.");
  const after = read("<p>A. other B.</p>");
  assert.deepEqual(placeProse(after, { quote }), { status: "whole", start: null, end: null });
});

test("placeProse: no quote means the whole entry or article", () => {
  const page = read(`<p>${BODY}</p>`);
  const whole = { status: "whole", start: null, end: null };
  assert.deepEqual(placeProse(page, {}), whole);
  assert.deepEqual(placeProse(page, { quote: null }), whole);
  assert.deepEqual(placeProse(page, { quote: { exact: "", prefix: "x", suffix: "y" } }), whole);
  assert.deepEqual(placeProse(page, null), whole);
  assert.deepEqual(placeProse(page, undefined), whole);
});

test("placeProse: an empty body is the whole, even for a record with a quote", () => {
  const quote = { exact: "turned inward", prefix: "the self ", suffix: ", and not" };
  const whole = { status: "whole", start: null, end: null };
  assert.deepEqual(placeProse(read(""), { quote }), whole);
  assert.deepEqual(placeProse(read("<p><button>Copy</button></p>"), { quote }), whole);
  assert.deepEqual(placeProse(null, { quote }), whole);
});

test("a quote stored in a decomposed form still finds the composed words", () => {
  const page = read("<p>The name Iēsous means rescue.</p>");
  const quote = { exact: "Iēsous", prefix: "The name ", suffix: " means rescue." };
  const at = placeProse(page, { quote });
  assert.equal(at.status, "found");
  assert.equal(page.text.slice(at.start, at.end), "Iēsous");
});

/* ── The map back to the page ────────────────────────────────────────── */

test("the map sends a word split across inline tags back to the right text nodes", () => {
  const page = read('<p>The <em>lib</em><em>eration</em> of <a href="/glossary/#x">all</a>.</p>');
  assert.equal(page.text, "The liberation of all.");
  const s = page.text.indexOf("liberation");
  const e = s + "liberation".length;
  assert.deepEqual(point(page.toDom(s, "start")), ["lib", 0]);
  assert.deepEqual(point(page.toDom(e, "end")), ["eration", 7]);
  assert.equal(page.fromDom(nodeWith(page, "lib"), 0, "start"), s);
  assert.equal(page.fromDom(nodeWith(page, "eration"), 7, "end"), e);
  // A point inside the second piece lands inside the word.
  assert.equal(page.fromDom(nodeWith(page, "eration"), 3, "start"), s + 6);
});

const RICH =
  "<h2>Flesh</h2>" +
  "<p>Paul's <em>sar</em><em>x</em> is not the body.<sup class=\"fn-ref\"><a href=\"#fn1\">1</a></sup> It names a <a href=\"/x\">way of living</a>.</p>" +
  "<p>See <button>Copy link</button>the entry.</p>";

test("every word's offsets map to the page and back, around skipped text", () => {
  const page = read(RICH);
  assert.equal(page.text, "Flesh Paul's sarx is not the body. It names a way of living. See the entry.");
  for (const m of page.text.matchAll(/\S+/g)) {
    const s = m.index;
    const e = s + m[0].length;
    const range = offsetsToRange(page, s, e);
    assert.ok(range, `"${m[0]}" maps to a range`);
    assert.deepEqual(rangeToOffsets(page, range), [s, e], `"${m[0]}" comes back to its own offsets`);
  }
  // The word before a skipped footnote reference ends in its own node, and the
  // word after it starts in the node that follows.
  const body = page.text.indexOf("body.");
  assert.deepEqual(point(page.toDom(body + "body.".length, "end")), [" is not the body.", " is not the body.".length]);
  assert.deepEqual(point(page.toDom(page.text.indexOf("It names"), "start")), [" It names a ", 1]);
});

test("a selection that starts inside a footnote number moves forward onto the words", () => {
  const root = parseHtml('<p>Claim<sup class="fn-ref"><a href="#fn1">1</a></sup> that matters<button>Copy</button></p>');
  const page = proseAnchorText(root);
  assert.equal(page.text, "Claim that matters");
  const digit = nodeWith(page, "1");
  const last = nodeWith(page, " that matters");
  assert.deepEqual(rangeToOffsets(page, { startContainer: digit, startOffset: 0, endContainer: last, endOffset: 5 }), [6, 10]);
  const button = nodeWith(page, "Copy");
  assert.equal(
    rangeToOffsets(page, { startContainer: button, startOffset: 0, endContainer: button, endOffset: 4 }),
    null,
    "a selection inside text that isn't the body's covers nothing",
  );
});

test("a quote made from a selection finds its words after the markup around them changes", () => {
  const before = read("<p>Paul uses this word to name the <em>self turned</em> inward, not the body.</p>");
  // The reader selects from the start of "self turned" to the end of " inward".
  const range = {
    startContainer: nodeWith(before, "self turned"),
    startOffset: 0,
    endContainer: nodeWith(before, " inward, not the body."),
    endOffset: " inward".length,
  };
  const [s, e] = rangeToOffsets(before, range);
  assert.equal(before.text.slice(s, e), "self turned inward");
  // What the note stores survives being written down and read back.
  const quote = JSON.parse(JSON.stringify(proseQuote(before, s, e)));

  const after = read('<p>Paul uses this word to name the <span class="term"><em>self</em> turned</span> inward, not the body.</p>');
  const at = placeProse(after, { quote });
  assert.equal(at.status, "found");
  assert.deepEqual([at.start, at.end], [s, e], "same words, same place, different nodes");
  const drawn = offsetsToRange(after, at.start, at.end);
  assert.deepEqual([drawn.startContainer.nodeValue, drawn.startOffset], ["self", 0]);
  assert.deepEqual([drawn.endContainer.nodeValue, drawn.endOffset], [" inward, not the body.", " inward".length]);
});
