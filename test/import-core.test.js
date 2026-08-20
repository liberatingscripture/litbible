// The importer's fidelity guarantee.
//
// The claim under test is narrow and total: nothing visible from the Word
// master reaches the JSON altered, except straight quotes becoming curly and
// digit-hyphen-digit becoming an en dash. These tests are the reason that
// claim is checkable rather than merely asserted — most of them are of the
// form "this transform is reversible by `foldAllowed`", which is what lets the
// fidelity gate see through the two exceptions and catch everything else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { curlify } from "../scripts/reconcile/lib/curl-quotes.mjs";
import {
  labelFor,
  anchorFor,
  isUrlToken,
  mapTextNodes,
  visibleText,
  foldAllowed,
  curlText,
  enDashRanges,
  collapseRuns,
  fidelityDivergence,
} from "../scripts/lib/import-core.mjs";

// ── labels ───────────────────────────────────────────────────────────────────

test("footnote labels run a…z, then aa…zz, then aaa…", () => {
  assert.equal(labelFor(0), "a");
  assert.equal(labelFor(25), "z");
  assert.equal(labelFor(26), "aa");
  assert.equal(labelFor(51), "zz");
  assert.equal(labelFor(52), "aaa");
});

test("an anchor carries its label in the id, the href, and the visible text", () => {
  assert.equal(
    anchorFor("bb"),
    '<sup class="fn-ref"><a id="fnref-bb" href="#fn-bb" role="doc-noteref">bb</a></sup>'
  );
});

// ── the two pre-approved changes, and their reversibility ────────────────────

test("straight quotes are curled, and folding puts them back", () => {
  const src = '<p>She said, "it is theirs," and left.</p>';
  const { html, curled, refusal } = curlText(src, curlify);
  assert.equal(refusal, null);
  assert.equal(curled, 2);
  assert.match(html, /“it is theirs,”/);
  assert.equal(foldAllowed(visibleText(html)), foldAllowed(visibleText(src)));
});

test("curling spans a phrase split across tags, because the quotes are one state machine", () => {
  // A quotation opening outside an <em> and closing inside it must still be
  // seen as one quotation; curling each fragment alone would restart the state.
  const { html, refusal } = curlText('<p>He wrote, "the <em>kalos</em> shepherd."</p>', curlify);
  assert.equal(refusal, null);
  assert.match(html, /“the <em>kalos<\/em> shepherd\.”/);
});

test("an unbalanced quotation is refused, and the characters come back untouched", () => {
  const src = "<p>The source says “this, and never closes it.</p>";
  const { html, curled, refusal } = curlText(src, curlify);
  assert.equal(html, src, "the master's characters must not be guessed at");
  assert.equal(curled, 0);
  assert.ok(refusal, "the caller needs something to report to the owner");
});

test("numeric ranges take an en dash, and folding puts the hyphen back", () => {
  const src = "<p>See Matthew 5:3-12 and verses 9-11.</p>";
  const { html, dashed } = enDashRanges(src);
  assert.equal(html, "<p>See Matthew 5:3–12 and verses 9–11.</p>");
  assert.equal(dashed, 2);
  assert.equal(foldAllowed(visibleText(html)), foldAllowed(visibleText(src)));
});

test("a tag's interior is never rewritten, so paragraph ids survive", () => {
  const { html, dashed } = enDashRanges('<p id="john-3-p1">See 1-2 there.</p>');
  assert.match(html, /id="john-3-p1"/);
  assert.equal(dashed, 1);
});

test("a URL keeps its hyphens, in the href and in visible link text alike", () => {
  const src = '<p>At <a href="https://x.org/p1-2">x.org/p1-2</a> and example.com/a1-2.</p>';
  assert.equal(enDashRanges(src).html, src);
  assert.ok(isUrlToken("https://x.org/p1-2"));
  assert.ok(isUrlToken("example.com/a1-2"));
  assert.ok(isUrlToken("www.x.io/a1-2"));
  assert.ok(!isUrlToken("5:3-12"), "a plain reference is not a URL");
});

// ── what must NOT be touched ─────────────────────────────────────────────────

test("neither transform repairs a typo, a doubled word, or a spacing defect", () => {
  // Every one of these is a real defect found in a master during the 2026-08
  // reconciliation. All of them must survive both transforms unchanged: the
  // importer reports them, the owner fixes them in Word.
  for (const src of [
    "<p>is has reason for gratitude</p>",
    "<p>those group of people</p>",
    "<p>‘divine’and the</p>",
    "<p>the the shepherd</p>",
  ]) {
    assert.equal(curlText(src, curlify).html, src);
    assert.equal(enDashRanges(src).html, src);
  }
});

// ── structural transforms: no visible character moves ────────────────────────

test("fragmented runs collapse, changing no visible character", () => {
  const src = "<p><em>ekd</em><em>e</em><em>me</em><em>o</em> means away.</p>";
  const out = collapseRuns(src);
  assert.equal(out, "<p><em>ekdemeo</em> means away.</p>");
  assert.equal(visibleText(out), visibleText(src));
});

test("a seam with a space between runs, or with attributes, is left alone", () => {
  const spaced = "<p><em>a</em> <em>b</em></p>";
  assert.equal(collapseRuns(spaced), spaced);
  const anchors = `<p>word${anchorFor("a")}${anchorFor("b")}</p>`;
  assert.equal(collapseRuns(anchors), anchors);
});

// ── visibleText ──────────────────────────────────────────────────────────────

test("footnote anchors are excluded, because Word numbers them and the repo letters them", () => {
  assert.equal(visibleText(`<p>word${anchorFor("a")} next</p>`), "word next");
});

test("entities decode, so an escaped character is compared as the reader sees it", () => {
  assert.equal(visibleText("<p>a&nbsp;b &amp; c &lt;d&gt;</p>"), "a b & c <d>");
});

// ── the gate ─────────────────────────────────────────────────────────────────

test("the gate sees through both pre-approved changes", () => {
  assert.equal(
    fidelityDivergence('He said, "see 5:3-12."', "He said, “see 5:3–12.”"),
    null
  );
});

test("the gate sees through whitespace, since markup carries the layout", () => {
  assert.equal(fidelityDivergence("one   two\n\nthree ", " one two three"), null);
});

test("a dropped word is caught, and located", () => {
  const d = fidelityDivergence("the path laid out in Torah", "the path laid out Torah");
  assert.ok(d, "a lost word must never pass the gate");
  assert.equal(typeof d.at, "number");
  assert.match(d.master, /Torah/);
});

test("a single changed character is caught", () => {
  assert.ok(fidelityDivergence("New Testament", "New Testatment"));
});

// ── mapTextNodes ─────────────────────────────────────────────────────────────

test("mapTextNodes visits text and skips tags", () => {
  assert.equal(
    mapTextNodes('<p id="a-1">x</p>', (t) => t.toUpperCase()),
    '<p id="a-1">X</p>'
  );
});
