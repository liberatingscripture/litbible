import { test } from "node:test";
import assert from "node:assert/strict";

import { createSheet, makeModule } from "../src/lib/desk-sheets.mjs";
import {
  QR_LINK_LIMIT,
  SHARE_PREFIX,
  ShareError,
  copyOfShared,
  fragmentInFile,
  isShareFragment,
  openShare,
  plainText,
  shareFile,
  shareFileName,
  shareFragment,
  shareLink,
  sharedSheet,
} from "../src/lib/desk-sheet-share.mjs";
import { validateRecord } from "../src/lib/desk-records.mjs";

const ctx = { client: "web-test", contentVersion: "v20261020.abcdef12", now: "2026-10-20T12:00:00.000Z" };

function sample() {
  return createSheet(
    {
      title: "Freedom and the Life-breath",
      subtitle: "Thursday group · October 2, 2026",
      template: "bible-study",
      modules: [
        makeModule("text", { html: "<h2>Opening</h2><p>Welcome, “friends.”</p>" }),
        makeModule("passage", {
          bookKey: "romans",
          chapter: 8,
          verse: 1,
          endVerse: 4,
          verseCopy: "There is now no condemnation…",
          verseCopyAsOf: "v20261001.00000000",
          blanks: [{ id: "b1", verse: 2, exact: "life-breath", prefix: "the ", suffix: " of", hint: "traditional" }],
          footnotes: [],
        }),
        makeModule("question", { html: "<p>What stands out?</p>", answer: "<p>The answer.</p>", lines: 3 }),
        makeModule("text", { html: "<p>For me alone.</p>", leaderOnly: true }),
        makeModule("keyTerms"),
      ],
    },
    ctx,
  );
}

test("a share leaves out the record's own fields, module ids and comparison copies", () => {
  const s = sharedSheet(sample());
  assert.equal(s.lit, "sheet");
  assert.equal(s.scope, "leader");
  for (const k of ["id", "client", "created", "modified", "labels", "kind", "schema"]) assert.equal(k in s, false, k);
  assert.equal(s.modules.length, 5);
  for (const m of s.modules) {
    assert.equal("id" in m, false);
    assert.equal("verseCopy" in m, false);
    assert.equal("verseCopyAsOf" in m, false);
  }
  assert.equal(s.contentVersion, ctx.contentVersion);
});

test("a participant share drops Leader only parts and answers", () => {
  const s = sharedSheet(sample(), { scope: "participant" });
  assert.equal(s.modules.length, 4);
  assert.equal(s.modules.find((m) => m.type === "question").answer, "");
  assert.ok(!s.modules.some((m) => m.leaderOnly));
  // the blank is kept: the participant copy prints it
  assert.equal(s.modules.find((m) => m.type === "passage").blanks.length, 1);
});

test("a link round-trips to a valid sheet with fresh ids", async () => {
  const original = sample();
  const link = await shareLink(original, { origin: "https://litbible.net" });
  assert.ok(link.startsWith(`https://litbible.net/sheets/#${SHARE_PREFIX}`));
  assert.match(link.split("#")[1], /^share1\.[A-Za-z0-9_-]+$/);
  const { sheet, scope } = await openShare("#" + link.split("#")[1], { client: "web-other" });
  assert.equal(scope, "leader");
  assert.deepEqual(validateRecord(sheet), []);
  assert.notEqual(sheet.id, original.id);
  assert.equal(sheet.client, "web-other");
  assert.equal(sheet.title, original.title);
  assert.equal(sheet.contentVersion, original.contentVersion);
  assert.deepEqual(
    sheet.modules.map(({ id, ...m }) => m),
    original.modules.map(({ id, verseCopy, verseCopyAsOf, ...m }) => m),
  );
  const ids = sheet.modules.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.some((id) => original.modules.some((m) => m.id === id)));
});

test("a references-only sheet fits a code", async () => {
  const s = createSheet(
    {
      title: "Romans 8",
      template: "blank",
      modules: [1, 5, 9, 12, 18, 26, 31].map((v) => makeModule("passage", { bookKey: "romans", chapter: 8, verse: v, endVerse: v + 2 })),
    },
    ctx,
  );
  const link = await shareLink(s, { origin: "https://litbible.net" });
  assert.ok(link.length < QR_LINK_LIMIT, `${link.length} characters`);
});

test("a damaged, cut-short or foreign fragment is refused with a reason", async () => {
  const frag = await shareFragment(sample());
  await assert.rejects(openShare(frag.slice(0, frag.length - 20), ctx), (e) => e instanceof ShareError && e.code === "damaged");
  await assert.rejects(openShare(frag + "!", ctx), (e) => e instanceof ShareError && e.code === "damaged");
  await assert.rejects(openShare("#v16", ctx), (e) => e instanceof ShareError && e.code === "not-a-sheet");
});

async function fragmentOf(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return SHARE_PREFIX + Buffer.from(out).toString("base64url");
}

test("a share whose data fails the sheet check is refused", async () => {
  const bad = { ...sharedSheet(sample()), modules: [{ type: "text", html: "<script>alert(1)</script><p>x</p>" }] };
  await assert.rejects(openShare(await fragmentOf(bad), ctx), (e) => e.code === "invalid");
  await assert.rejects(openShare(await fragmentOf({ lit: "notes", modules: [] }), ctx), (e) => e.code === "not-a-sheet");
  await assert.rejects(openShare(await fragmentOf({ ...sharedSheet(sample()), sheetFormat: 99 }), ctx), (e) => e.code === "newer");
});

test("a decompression bomb is refused before it is read whole", async () => {
  const huge = { ...sharedSheet(sample()), title: "x".repeat(3 * 1024 * 1024) };
  await assert.rejects(openShare(await fragmentOf(huge), ctx), (e) => e.code === "too-large");
});

test("the file names its parts, quotes no scripture, and carries the data", async () => {
  const file = await shareFile(sample());
  assert.match(file, /^# Freedom and the Life-breath\n/);
  assert.match(file, /## Romans 8:1–4/);
  assert.match(file, /\*\*Question:\*\* What stands out\?/);
  assert.match(file, /\*\*Answer:\*\* The answer\./);
  assert.ok(!file.includes("no condemnation"));
  const frag = fragmentInFile(file);
  assert.ok(isShareFragment(frag));
  const { sheet } = await openShare(frag, ctx);
  assert.equal(sheet.modules.length, 5);
  assert.equal(fragmentInFile("# Just notes"), null);
});

test("a participant file has no answer and no Leader only part", async () => {
  const file = await shareFile(sample(), { scope: "participant" });
  assert.ok(!file.includes("The answer"));
  assert.ok(!file.includes("For me alone"));
});

test("plainText and file names", () => {
  assert.equal(plainText("<h2>A</h2><ul><li>one</li><li>two &amp; three</li></ul>"), "A\n\n- one\n- two & three");
  assert.equal(shareFileName({ title: "Freedom and the Life-breath!" }), "freedom-and-the-life-breath.lit-sheet.md");
  assert.equal(shareFileName({ title: "" }), "sheet.lit-sheet.md");
});

test("a copy into my desk is a new sheet of mine", async () => {
  const { sheet } = await openShare(await shareFragment(sample()), { client: "web-x" });
  const mine = copyOfShared(sheet, { client: "web-me", contentVersion: "v2", now: "2026-10-21T00:00:00.000Z" });
  assert.deepEqual(validateRecord(mine), []);
  assert.notEqual(mine.id, sheet.id);
  assert.equal(mine.client, "web-me");
  assert.equal(mine.created, "2026-10-21T00:00:00.000Z");
  assert.ok(mine.modules.every((m, i) => m.id !== sheet.modules[i].id));
  assert.equal(mine.title, sheet.title);
});
