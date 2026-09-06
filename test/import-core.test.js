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
  chapterHeadingIndex,
  firstTokenSpan,
  liftTrailingPunctuation,
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
// ── chapterHeadingIndex ──────────────────────────────────────────────────────
//
// The master prints a big chapter number before verse 1 and the chapter's entry
// range opens on it. Left in, it ships as literal body text at the head of the
// first paragraph — `<b>21</b> ` before verse 1, which is what Luke 21 did.

const text = (plain, html) => ({ kind: "text", plain, html: html ?? plain });
const marker = (verse) => ({ kind: "verseMarker", verse });

test("the chapter-number heading is located, so it can be dropped", () => {
  const entries = [
    { kind: "break" },
    text("21", "<b>21</b>"),
    text(" "),
    marker(1),
    text(" When "),
  ];
  assert.equal(chapterHeadingIndex(entries, 0, entries.length, 21), 1);
});

test("a single-chapter book has no heading to drop", () => {
  // That branch anchors the range at verse 1's own digits.
  const entries = [marker(1), text(" Paul, ")];
  assert.equal(chapterHeadingIndex(entries, 0, entries.length, 1), -1);
});

test("real text before verse 1 is left alone rather than guessed at", () => {
  const entries = [text("A Psalm of David"), marker(1), text(" Blessed ")];
  assert.equal(chapterHeadingIndex(entries, 0, entries.length, 1), -1);
});

test("a heading that is not the chapter number is not dropped", () => {
  const entries = [text("20", "<b>20</b>"), marker(1), text(" When ")];
  assert.equal(chapterHeadingIndex(entries, 0, entries.length, 21), -1);
});

// ── firstTokenSpan ───────────────────────────────────────────────────────────
//
// Word's run boundaries do not respect words, so the token a verse number must
// stay glued to can arrive split across runs. Reading only the first run glued
// a bare `“`, or a lone `t`, and left the rest of the word outside the span.

const glue = (entries, i = 0) =>
  firstTokenSpan(entries, i, entries.length, {
    escapeHtml: (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    sameBlock: () => true,
  });

test("the ordinary case: one run holding the word and a space", () => {
  const r = glue([text(" When Jesus looked ")]);
  assert.equal(r.tokenHtml, "When");
  assert.equal(r.tailHtml, " Jesus looked ");
});

test("an opening quote in its own run is glued to the word after it", () => {
  // Luke 21:3 — ` “` / `Honestly` / `, I’m telling you,”
  const r = glue([text(" “"), text("Honestly"), text(", I’m telling you,”")]);
  assert.equal(r.tokenHtml, "“Honestly,");
  assert.equal(r.tailHtml, " I’m telling you,”");
  assert.equal(r.nextIndex, 3);
});

test("a word split mid-letter is rejoined", () => {
  // Luke 21:26 — `t` / `here will be `
  const r = glue([text(" "), text("t"), text("here will be ")]);
  assert.equal(r.tokenHtml, "there");
  assert.equal(r.tailHtml, " will be ");
});

test("a comma orphaned into the next run is glued back on", () => {
  // Luke 21:32 — `Honestly` / `, I’m telling you`
  const r = glue([text(" "), text("Honestly"), text(", I’m telling you")]);
  assert.equal(r.tokenHtml, "Honestly,");
  assert.equal(r.tailHtml, " I’m telling you");
});

test("markup inside the token is kept — the corpus shape at John 1:49", () => {
  const r = glue([text(" “"), text("Rabbi", "<em>Rabbi</em>"), text(",” he said")]);
  assert.equal(r.tokenHtml, "“<em>Rabbi</em>,”");
  assert.equal(r.tailHtml, " he said");
});

test("a footnote anchor ends the token where it stands", () => {
  const entries = [text(" Win"), { kind: "footnoteRef", id: "1" }, text(" your very selves")];
  const r = glue(entries);
  assert.equal(r.tokenHtml, "Win");
  assert.equal(r.nextIndex, 1);
});

test("the token stops at a block boundary", () => {
  const entries = [text(" When"), text("ever")];
  const r = firstTokenSpan(entries, 0, entries.length, {
    escapeHtml: (s) => s,
    sameBlock: (j) => j === 0,
  });
  assert.equal(r.tokenHtml, "When");
});

test("a run carrying both markup and a space is not sliced", () => {
  // Slicing that by a plain-text offset would not survive the tags. A short
  // span is cosmetic; a mangled one is not.
  const r = glue([text("Rabbi and", "<em>Rabbi and</em>")]);
  assert.equal(r.tokenHtml, "");
});

// ── note trimming is gate-safe ───────────────────────────────────────────────
//
// Word leaves a trailing space on a note more often than not, and the corpus
// carries none (5,511 of 5,512). The importer trims them; this is what makes
// that safe rather than a third exception to the guarantee — the fold already
// removes edge whitespace, so the gate cannot tell the two apart.

test("the fold ignores edge whitespace, so trimming a note cannot fail the gate", () => {
  assert.equal(fidelityDivergence("a note. ", "a note."), null);
  assert.equal(fidelityDivergence(" a note.", "a note."), null);
});

test("trimming still cannot hide a real change at the end of a note", () => {
  assert.ok(fidelityDivergence("give my bowels a reprieve. ", "give my bowels a rebuke."));
});

// ── liftTrailingPunctuation ──────────────────────────────────────────────────
//
// Word makes it easy to overshoot a selection by one character when
// italicizing a word, so the comma lands inside the run. Published text runs
// 1,133 commas after a closing tag against 13 before one.

test("a comma is lifted out of the styled run it was typed inside", () => {
  const r = liftTrailingPunctuation("related to <em>presbuteros,</em> ‘elder,’");
  assert.equal(r.html, "related to <em>presbuteros</em>, ‘elder,’");
  assert.equal(r.lifted, 1);
});

test("a semicolon is lifted too, and strong/i/b are covered", () => {
  assert.equal(liftTrailingPunctuation("<strong>x;</strong>").html, "<strong>x</strong>;");
  assert.equal(liftTrailingPunctuation("<i>x,</i>").html, "<i>x</i>,");
});

test("terminal punctuation is LEFT ALONE — it can belong to the run", () => {
  // `i.e.` would be broken by moving its period; `Marana tha!` owns its mark.
  for (const s of ["<em>i.e.</em>", "<em>Marana tha!</em>", "<em>arsenokoites.</em>", "<em>Really?</em>"]) {
    assert.equal(liftTrailingPunctuation(s).html, s);
  }
});

test("an abbreviation keeps its periods while its comma is lifted", () => {
  assert.equal(liftTrailingPunctuation("<em>i.e.,</em>").html, "<em>i.e.</em>,");
});

test("a comma already outside is not moved again", () => {
  const s = "<em>presbuteros</em>, ‘elder’";
  assert.equal(liftTrailingPunctuation(s).html, s);
  assert.equal(liftTrailingPunctuation(s).lifted, 0);
});

test("lifting a comma cannot fail the fidelity gate — no visible character moves", () => {
  const before = "<em>presbuteros,</em> ‘elder’";
  const after = liftTrailingPunctuation(before).html;
  assert.equal(fidelityDivergence(visibleText(before), visibleText(after)), null);
});
