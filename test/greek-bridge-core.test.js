import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGreekBridge } from "../scripts/lib/greek-bridge-core.mjs";

const BOOKS = ["matthew", "mark", "romans"];
const occ = (bookKey, chapter, verse) => ({ bookKey, chapter, verse, record: {} });

test("the bridge lists each published term's renderings with their verses", () => {
  const gated = new Map([
    [
      "flesh-body",
      new Map([
        ["family", [occ("mark", 10, 8)]],
        // Two records in one verse are one verse; Bible order, not record order.
        ["self-preservation", [occ("romans", 8, 4), occ("romans", 8, 3), occ("romans", 8, 3)]],
      ]),
    ],
    ["draft-term", new Map([["x", [occ("mark", 1, 1)]]])],
    ["no-lemmas", new Map([["y", [occ("mark", 1, 1)]]])],
  ]);
  const entries = new Map([
    ["flesh-body", { title: "Self-preservation / Family", traditional: "Flesh" }],
    ["no-lemmas", { title: "Y", traditional: "Y" }],
  ]);
  const bridge = buildGreekBridge({
    gated,
    entries,
    lemmas: { "flesh-body": ["σάρξ"], "draft-term": ["λόγος"] },
    bookOrder: BOOKS,
  });
  assert.equal(bridge.format, 1);
  assert.deepEqual(bridge.terms, [
    {
      id: "flesh-body",
      title: "Self-preservation / Family",
      traditional: "Flesh",
      lemmas: ["σάρξ"],
      renderings: [
        { form: "self-preservation", count: 3, verses: [2, 8, 3, 2, 8, 4] },
        { form: "family", count: 1, verses: [1, 10, 8] },
      ],
    },
  ]);
});
