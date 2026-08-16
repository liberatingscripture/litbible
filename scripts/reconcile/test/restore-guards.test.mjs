import test from "node:test";
import assert from "node:assert/strict";

import { verseBoundaryDisagreement, suspectRestore } from "../lib/restore-guards.mjs";

// John 8:19-20 as the two sides actually carry it: the master ends verse 19
// one sentence later than the repo does.
const masterJohn8 = new Map([
  [19, "So they said to him, “Where is your father?” “You don’t recognize either me or my Father,” Jesus answered."],
  [20, "(Jesus made these statements at the donation box while teaching in the sacred grounds.)"],
]);
const repoJohn8 = new Map([
  [19, "So they said to him, “Where is your father?”"],
  [20, "“You don’t recognize either me or my Father,” Jesus answered. (Jesus made these statements at the donation box while teaching in the sacred grounds.)"],
]);

test("catches the master running on into the repo's next verse", () => {
  const r = verseBoundaryDisagreement(masterJohn8, repoJohn8, 19);
  assert.match(r, /master's verse 19 runs on into text the repo carries in verse 20/);
});

test("catches the mirror, where the repo opens with the master's previous verse", () => {
  const r = verseBoundaryDisagreement(masterJohn8, repoJohn8, 20);
  assert.match(r, /repo's verse 20 opens with text the master carries in verse 19/);
});

test("an ordinary wording difference is not a boundary disagreement", () => {
  const master = new Map([[8, "you arranged everything under his feet."], [9, "But we do see Jesus."]]);
  const repo = new Map([[8, "you coordinated everything under his feet."], [9, "But we do see Jesus."]]);
  assert.equal(verseBoundaryDisagreement(master, repo, 8), null);
});

test("a short trailing addition is not treated as a boundary move", () => {
  const master = new Map([[3, "He spoke to them plainly."], [4, "And they left."]]);
  const repo = new Map([[3, "He spoke to them"], [4, "And they left."]]);
  assert.equal(verseBoundaryDisagreement(master, repo, 3), null);
});

test("identical verses are never flagged", () => {
  const m = new Map([[1, "In the beginning."], [2, "And so on."]]);
  assert.equal(verseBoundaryDisagreement(m, m, 1), null);
});

test("a doubled word introduced by the master is a typo, not a restore", () => {
  const r = suspectRestore({
    kind: "footnote",
    masterText: "the path laid out in in Torah",
    repoText: "the path laid out in Torah",
  });
  assert.match(r, /doubled word/);
});

test("a doubled word the repo already has does not block the restore", () => {
  const r = suspectRestore({
    kind: "footnote",
    masterText: "that that is settled here",
    repoText: "that that is settled there",
  });
  assert.equal(r, null);
});

test("square brackets are blocked in scripture and allowed in a footnote", () => {
  const masterText = "Then [Miriam] said to Jesus";
  const repoText = "Then Miriam said to Jesus";
  assert.match(suspectRestore({ kind: "verse", masterText, repoText }), /square brackets/);
  assert.equal(
    suspectRestore({
      kind: "footnote",
      masterText: "“to arrange [troop divisions] in a military fashion”",
      repoText: "“to arrange troop divisions in a military fashion”",
    }),
    null,
  );
});

test("a restore that more than halves the text looks like a truncated master", () => {
  const r = suspectRestore({
    kind: "footnote",
    masterText: "This is ‘they trusted the sc",
    repoText: "This footnote text appears truncated in the source. Verify and complete it from your full master text before publishing.",
  });
  assert.match(r, /less than half/);
});

test("a restore that lengthens the text is the expected direction", () => {
  const r = suspectRestore({
    kind: "footnote",
    masterText: "Traditionally, ‘submit to.’ According to the dictionary, hupotasso is a military term meaning to arrange in order.",
    repoText: "Traditionally, ‘submit to.’",
  });
  assert.equal(r, null);
});
