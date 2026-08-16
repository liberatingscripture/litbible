import test from "node:test";
import assert from "node:assert/strict";

import {
  tokenize,
  stripTags,
  classifyHunk,
  diffSegments,
  compose,
  defaultVerdicts,
  decisionFor,
  summarize,
  mechanicalNormalize,
} from "../review/review-core.mjs";

test("tokenize is lossless", () => {
  for (const s of [
    "plain words here",
    '<span class="vglue"><sup id="v5" class="vn">5</sup>&nbsp;Who</span> is Apollos?',
    "  leading and trailing  ",
    "",
    "<em>psuchē</em>, which refers",
  ]) {
    assert.equal(tokenize(s).join(""), s, `round-trip failed for ${JSON.stringify(s)}`);
  }
});

test("tokenize keeps a whole HTML tag as one token", () => {
  // The bug this guards: splitting on whitespace alone cuts
  // `<span class="chiasm-text">Verse` into `<span` + `class="chiasm-text">Verse`,
  // so the fragment reaching stripTags has no `<` and reads as a word change.
  const tokens = tokenize('<span class="chiasm-text">Verse 2');
  assert.ok(tokens.includes('<span class="chiasm-text">'), `tag was split: ${JSON.stringify(tokens)}`);
});

test("stripTags removes markup only", () => {
  assert.equal(stripTags('<span class="x">Verse</span> 2'), "Verse 2");
  assert.equal(stripTags("no markup"), "no markup");
});

test("mechanicalNormalize folds diacritics, quotes and spacing", () => {
  assert.equal(mechanicalNormalize("phtheírō"), mechanicalNormalize("phtheiro"));
  assert.equal(mechanicalNormalize('“destroy.”'), mechanicalNormalize('"destroy."'));
  assert.equal(mechanicalNormalize("A:  Verse"), mechanicalNormalize("A: Verse"));
  // Digits must survive - an earlier version of the combining-mark range
  // matched ASCII digits and silently stripped verse references.
  assert.equal(mechanicalNormalize("Isaiah 29:13"), "Isaiah 29:13");
});

test("classifyHunk separates the three questions", () => {
  assert.equal(classifyHunk("phtheiro", "phtheírō"), "mechanical");
  assert.equal(classifyHunk('“x”', '"x"'), "mechanical");
  assert.equal(classifyHunk('<span class="chiasm-text">Verse', "Verse"), "structural");
  assert.equal(classifyHunk("highlights", "reflects"), "judgment");
  assert.equal(classifyHunk("arazeloo", "parazeloo"), "judgment");
});

test("diffSegments rejoins to each side and indexes hunks in order", () => {
  const repo = "The verb phtheiro is traditionally rendered here.";
  const master = "The verb phtheírō is traditionally rendered there.";
  const segs = diffSegments(repo, master);
  const hunks = segs.filter((s) => s.type === "hunk");
  assert.equal(hunks.length, 2);
  assert.deepEqual(
    hunks.map((h) => h.index),
    [0, 1],
  );
  assert.equal(compose(segs, { 0: "repo", 1: "repo" }).resolved, repo);
  assert.equal(compose(segs, { 0: "master", 1: "master" }).resolved, master);
});

test("compose mixes sides per hunk, which is the whole point", () => {
  // 1corinthians-10-fn-g: the master is right about the macrons and the repo
  // is right about the wording, in one footnote.
  const repo = "as hemon egenethesan reflects the verb";
  const master = "as hēmōn egenēthēsan highlights the verb";
  const segs = diffSegments(repo, master);
  const hunks = segs.filter((s) => s.type === "hunk");
  const verdicts = {};
  for (const h of hunks) verdicts[h.index] = h.kind === "mechanical" ? "master" : "repo";
  const { resolved, undecided } = compose(segs, verdicts);
  assert.equal(undecided.length, 0);
  assert.match(resolved, /hēmōn egenēthēsan/);
  assert.match(resolved, /reflects/);
});

test("compose reports undecided hunks and never claims a value", () => {
  const segs = diffSegments("a b c", "a X c");
  const { undecided } = compose(segs, {});
  assert.deepEqual(undecided, [0]);
});

test("defaults take the master mechanically and keep the repo structurally", () => {
  // Taking the master on a structural hunk would delete hand-authored markup:
  // 1corinthians-11-fn-b builds its chiasm out of spans the Word master,
  // being plain text, has none of.
  const segs = diffSegments('<span class="chiasm-text">Verse 2 phtheiro', "Verse 2 phtheírō");
  const defaults = defaultVerdicts(segs);
  for (const seg of segs) {
    if (seg.type !== "hunk") continue;
    if (seg.kind === "mechanical") assert.equal(defaults[seg.index], "master");
    if (seg.kind === "structural") assert.equal(defaults[seg.index], "repo");
    if (seg.kind === "judgment") assert.equal(defaults[seg.index], undefined);
  }
});

test("a record where every hunk keeps the repo is rejected, not approved", () => {
  const repo = "keep this wording";
  const segs = diffSegments(repo, "change this wording");
  const { resolved } = compose(segs, { 0: "repo" });
  assert.equal(decisionFor(resolved, repo), "rejected");
  const taken = compose(segs, { 0: "master" }).resolved;
  assert.equal(decisionFor(taken, repo), "approved");
});

test("summarize counts all three kinds", () => {
  const segs = diffSegments('<b>x</b>phtheiro here', "phtheírō there");
  const counts = summarize([segs]);
  assert.equal(counts.total, counts.mechanical + counts.structural + counts.judgment);
  assert.ok(counts.total > 0);
});
