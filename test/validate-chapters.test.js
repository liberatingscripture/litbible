// The five chapter rules added after the 2026-08 reconciliation.
//
// Each one exists because a real defect shipped past every check that came
// before it, so each test asserts BOTH halves: the defect is caught, and the
// legitimate shape it most resembles is not. The near-miss controls are the
// point — a rule that fires on the bracketed-passage opening, on two footnote
// anchors in a row, or on a URL in link text would be worse than no rule,
// because it would train whoever hits it to reach for --fix.
//
// The validator is a CLI with top-level execution, so it is exercised the way
// the pre-commit hook and CI exercise it: as a process, over files on disk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATOR = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "validate-chapters.mjs");

const anchor = (l) => `<sup class="fn-ref"><a id="fnref-${l}" href="#fn-${l}" role="doc-noteref">${l}</a></sup>`;
const note = (l, html) => ({ id: `fn-${l}`, refId: `fnref-${l}`, label: l, html });
const verse = (n, word) => `<span class="vglue"><sup id="v${n}" class="vn">${n}</sup>&nbsp;${word}</span>`;

/** Run the validator over one chapter and return its combined output. */
function validate({ paragraphs, footnotes = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "lit-validate-"));
  try {
    const file = join(dir, "john-3.json");
    writeFileSync(
      file,
      JSON.stringify(
        {
          bookKey: "john",
          chapter: 3,
          type: "scripture",
          title: "John 3",
          description: "John 3 in the Liberation and Inclusion Translation (LIT).",
          indexed: true,
          paragraphs,
          footnotes,
        },
        null,
        2
      )
    );
    try {
      return execFileSync(process.execPath, [VALIDATOR, file], { encoding: "utf8" });
    } catch (err) {
      // Exit 1 is the expected path for a chapter with errors; the messages
      // are on stderr and are the thing under test.
      return `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const clean = (out) => assert.match(out, /valid\./, `expected no errors, got:\n${out}`);

// ── footnote_quote_balance ───────────────────────────────────────────────────

test("an unclosed quotation inside a footnote is rejected", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} word${anchor("a")}</p>`],
    footnotes: [note("a", "The source says \u201cthis, and never closes it.")],
  });
  assert.match(out, /footnote fn-a has unbalanced curly double quotes \(1 .* \/ 0 /);
});

test("a balanced footnote passes, and apostrophes are not counted as quotes", () => {
  clean(
    validate({
      paragraphs: [`<p id="john-3-p1">${verse(1, "One")} word${anchor("a")}</p>`],
      footnotes: [note("a", "The reader\u2019s own copy says \u201cthis\u201d and \u2018that\u2019.")],
    })
  );
});

// ── footnote_anchor_sequence ─────────────────────────────────────────────────

test("anchors running out of order are rejected even though every link resolves", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} a${anchor("b")} b${anchor("a")}</p>`],
    footnotes: [note("a", "first"), note("b", "second")],
  });
  assert.match(out, /footnote anchors run out of order: at position 1/);
});

test("the same anchor twice is rejected", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} a${anchor("a")} b${anchor("a")}</p>`],
    footnotes: [note("a", "only")],
  });
  assert.match(out, /appear more than once: fnref-a/);
});

test("two different anchors on one word are a legitimate shape", () => {
  clean(
    validate({
      paragraphs: [`<p id="john-3-p1">${verse(1, "One")} word${anchor("a")}${anchor("b")}</p>`],
      footnotes: [note("a", "one"), note("b", "two")],
    })
  );
});

// ── verse_marker_separator ───────────────────────────────────────────────────

test("a verse marker welded to the preceding sentence is rejected", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} sheep.${verse(2, "The")}</p>`],
  });
  assert.match(out, /verse 2 marker has no separator before it/);
  // The snippet must read as the page reads, not as the markup reads.
  assert.match(out, /sheep\.2/);
});

test("a bracketed passage may open with its marker and anchor before verse 1", () => {
  clean(
    validate({
      paragraphs: [`<p id="john-3-p1">[|${anchor("a")}${verse(1, "One")} word |]${anchor("b")}</p>`],
      footnotes: [note("a", "\u201cnote\u201d"), note("b", "\u201cnote\u201d")],
    })
  );
});

// ── no_fragmented_tag_runs ───────────────────────────────────────────────────

test("a phrase split across adjacent same-tag runs is rejected", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} <em>ekd</em><em>emeo</em> word</p>`],
  });
  assert.match(out, /splits a <em> run/);
});

test("a seam with a space between the runs is left alone", () => {
  clean(
    validate({
      paragraphs: [`<p id="john-3-p1">${verse(1, "One")} <em>a</em> <em>b</em> word</p>`],
    })
  );
});

// ── en_dash_numeric_ranges ───────────────────────────────────────────────────

test("a hyphenated numeric range is rejected", () => {
  const out = validate({
    paragraphs: [`<p id="john-3-p1">${verse(1, "One")} see Matthew 5:3-12 there</p>`],
  });
  assert.match(out, /numeric range "5:3-12" with a hyphen/);
});

test("an en dash passes, and neither a paragraph id nor a URL is touched", () => {
  clean(
    validate({
      paragraphs: [`<p id="john-3-p1">${verse(1, "One")} see Matthew 5:3\u201312${anchor("a")}</p>`],
      footnotes: [note("a", 'At <a href="https://x.org/p1-2">x.org/p1-2</a> and example.com/a1-2.')],
    })
  );
});
