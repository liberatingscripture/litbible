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
  markdownLine,
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

test("a part's planned minutes travel in a leader share only (Audit 5, D #2)", () => {
  const src = sample();
  src.modules[0] = { ...src.modules[0], minutes: 10 };
  assert.equal(sharedSheet(src, { scope: "leader" }).modules[0].minutes, 10);
  assert.equal("minutes" in sharedSheet(src, { scope: "participant" }).modules[0], false);
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
  // Sanitizing can't mend formatted text that isn't text (DI6-1).
  const bad = { ...sharedSheet(sample()), modules: [{ type: "text", html: 42 }] };
  await assert.rejects(openShare(await fragmentOf(bad), ctx), (e) => e.code === "invalid");
  await assert.rejects(openShare(await fragmentOf({ lit: "notes", modules: [] }), ctx), (e) => e.code === "not-a-sheet");
  await assert.rejects(openShare(await fragmentOf({ ...sharedSheet(sample()), sheetFormat: 99 }), ctx), (e) => e.code === "newer");
});

test("a share's formatted text is sanitized before it is checked (DI6-1)", async () => {
  const drifted = {
    ...sharedSheet(sample()),
    modules: [
      { type: "text", html: "<p><b>bold</b> and <i>italic</i></p><script>alert(1)</script>" },
      { type: "question", html: "<p><b>Why?</b></p>", answer: "<p><i>Because.</i></p>", lines: 2 },
    ],
  };
  const { sheet } = await openShare(await fragmentOf(drifted), ctx);
  assert.equal(sheet.modules[0].html, "<p><strong>bold</strong> and <em>italic</em></p>");
  assert.equal(sheet.modules[1].html, "<p><strong>Why?</strong></p>");
  assert.equal(sheet.modules[1].answer, "<p><em>Because.</em></p>");
  assert.deepEqual(validateRecord(sheet), []);
});

test("a participant share leaves out the editor's prompts; a leader share keeps them (SEC6-3)", () => {
  const src = sample();
  src.modules[0] = { ...src.modules[0], prompt: "How you will begin." };
  src.modules[2] = { ...src.modules[2], prompt: "Ask it.", answerPrompt: "The answer you expect." };
  const leader = sharedSheet(src, { scope: "leader" });
  assert.equal(leader.modules[0].prompt, "How you will begin.");
  assert.equal(leader.modules[2].answerPrompt, "The answer you expect.");
  const part = sharedSheet(src, { scope: "participant" });
  for (const m of part.modules) for (const k of ["prompt", "answerPrompt", "minutes"]) assert.equal(k in m, false, `${m.type} ${k}`);
});

test("the file writes a reader's < as text, never as HTML (SEC6-1)", async () => {
  assert.equal(markdownLine("<b>hi</b> & <!-- x"), "\\<b>hi\\</b> & &lt;!-- x");
  const s = createSheet(
    {
      title: "<img src=x onerror=alert(1)>",
      subtitle: "<i>sub</i>",
      modules: [makeModule("text", { html: "<p>&lt;script&gt;alert(1)&lt;/script&gt; and &lt;b&gt;bold&lt;/b&gt;</p>" }), makeModule("keyTerms")],
    },
    ctx,
  );
  assert.deepEqual(validateRecord(s), []);
  const file = await shareFile(s);
  const human = file.slice(0, file.lastIndexOf("<!-- lit-sheet"));
  assert.doesNotMatch(human, /(^|[^\\])</, human);
  assert.ok(human.startsWith("# \\<img src=x onerror=alert(1)>\n\\<i>sub\\</i>\n"), human.slice(0, 60));
  assert.ok(human.includes("\\<script>alert(1)\\</script> and \\<b>bold\\</b>"));
  assert.equal(fragmentInFile(file), await shareFragment(s));
});

test("plainText and markdownLine take linear time on runs of spaces and tabs (SEC6-2)", () => {
  const time = (fn) => {
    const t = performance.now();
    fn();
    return performance.now() - t;
  };
  const run = " \t".repeat(100000);
  // Quadratic, these took seconds; linear, well under one.
  assert.ok(time(() => markdownLine(run + "x")) < 1000);
  assert.ok(time(() => plainText("<p>\n" + " ".repeat(200000) + "x</p>")) < 1000);
  assert.equal(plainText("<p>a   </p><p>  # b</p>"), "a\n\n  \\# b", "trailing spaces go, a line's start is still escaped");
  assert.equal(plainText("<ul><li>  - x</li></ul>"), "-   \\- x", "after a list item's mark too");
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

test("the file's words are Markdown that reads as written: escaped, paragraphs a blank line apart (DK3-12)", async () => {
  assert.equal(plainText("<p># not a heading</p><p>- not a list</p><p>&gt; not a quote</p><p>3. not a number</p>"),
    "\\# not a heading\n\n\\- not a list\n\n\\> not a quote\n\n3\\. not a number");
  assert.equal(plainText("<p>a *star* and _under_ and `tick` and C:\\dir</p>"), "a \\*star\\* and \\_under\\_ and \\`tick\\` and C:\\\\dir");
  assert.equal(plainText("<ul><li>- dash</li><li>plain</li></ul><hr><p>after</p>"), "- \\- dash\n- plain\n\n---\n\nafter", "the file's own list marks and rule stay");
  assert.equal(plainText("<p>one</p><p>two</p>"), "one\n\ntwo");
  assert.equal(markdownLine("Week *2* of 1. Romans"), "Week \\*2\\* of 1. Romans", "a number mid-line is left alone");
  const s = createSheet({ title: "Rivers *and* wells", subtitle: "# week 2", modules: [makeModule("keyTerms")] }, ctx);
  const file = await shareFile(s);
  assert.ok(file.startsWith("# Rivers \\*and\\* wells\n\\# week 2\n"), file.slice(0, 60));
  assert.equal(fragmentInFile(file), await shareFragment(s), "the data line still reads back");
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

test("BA80: a file with two data lines yields the last", () => {
  const file = "# T\n\n<!-- lit-sheet share1.AAAA -->\n\nmore\n<!-- lit-sheet share1.BBBB -->\n";
  assert.equal(fragmentInFile(file), "share1.BBBB");
});

test("BA80: a sheet's text can't plant a data line in its file", async () => {
  assert.equal(plainText("<p>&lt;!-- x --&gt;</p>"), "&lt;!-- x -->");
  const s = createSheet(
    { title: "Planted", modules: [makeModule("text", { html: "<p>&lt;!-- lit-sheet share1.AAAA --&gt;</p>" }), makeModule("keyTerms")] },
    ctx,
  );
  assert.deepEqual(validateRecord(s), []);
  const file = await shareFile(s);
  assert.equal(file.split("<!-- lit-sheet").length - 1, 1, "only the real data line opens a comment");
  assert.ok(file.includes("&lt;!-- lit-sheet share1.AAAA -->"));
  const { sheet } = await openShare(fragmentInFile(file), ctx);
  assert.equal(sheet.title, "Planted");
  assert.equal(sheet.modules.length, 2);
});

test("BA81: a part of an unknown type stays out of a participant share", async () => {
  const s = sample();
  s.modules.push({ id: "m-poll", type: "poll", answer: "secret", html: "<p>x</p>" });
  assert.deepEqual(validateRecord(s), []);
  const participant = sharedSheet(s, { scope: "participant" });
  assert.equal(participant.modules.length, 4);
  assert.ok(!participant.modules.some((m) => m.type === "poll"));
  assert.ok(!JSON.stringify(participant).includes("secret"));
  const file = await shareFile(s, { scope: "participant" });
  const { sheet } = await openShare(fragmentInFile(file), ctx);
  assert.ok(!sheet.modules.some((m) => m.type === "poll"));
  assert.ok(!JSON.stringify(sheet).includes("secret"));
  const leader = sharedSheet(s);
  assert.equal(leader.modules.length, 6);
  assert.equal(leader.modules.find((m) => m.type === "poll").answer, "secret");
});

test("BA82: a crafted share's comparison copies are dropped on opening", async () => {
  const data = sharedSheet(sample());
  data.modules = data.modules.map((m) => (m.type === "passage" ? { ...m, verseCopy: "scripture", verseCopyAsOf: "v1" } : m));
  assert.ok(data.modules.some((m) => "verseCopy" in m));
  const { sheet } = await openShare(await fragmentOf(data), ctx);
  for (const m of sheet.modules) {
    assert.equal("verseCopy" in m, false);
    assert.equal("verseCopyAsOf" in m, false);
  }
  const mine = copyOfShared(sheet, { client: "web-me", now: "2026-10-21T00:00:00.000Z" });
  for (const m of mine.modules) {
    assert.equal("verseCopy" in m, false);
    assert.equal("verseCopyAsOf" in m, false);
  }
});

test("BA87: a data line folded by email still opens", async () => {
  const file = await shareFile(sample());
  const real = fragmentInFile(file);
  const data = real.slice(SHARE_PREFIX.length);
  const folded = `${SHARE_PREFIX}${data.slice(0, 40)}\r\n  ${data.slice(40, 90)}\r\n${data.slice(90)}\n`;
  const mangled = file.replace(real, folded);
  assert.notEqual(mangled, file);
  assert.equal(fragmentInFile(mangled), real);
  const { sheet } = await openShare(fragmentInFile(mangled), ctx);
  assert.equal(sheet.modules.length, 5);
});

test("BA87: an unreadable data line is damaged, and no data line is null", () => {
  for (const text of ["# T\n<!-- lit-sheet share1.!!! -->\n", "# T\n<!-- lit-sheet share1.AAAA\n", "<!-- lit-sheet -->"]) {
    assert.throws(() => fragmentInFile(text), (e) => e instanceof ShareError && e.code === "damaged", text);
  }
  assert.equal(fragmentInFile("# T\n\nNo data here.\n"), null);
  assert.equal(fragmentInFile(""), null);
});

test("BA87: a crafted file of unclosed whitespace is read in linear time", () => {
  const started = performance.now();
  assert.throws(() => fragmentInFile("<!-- lit-sheet share1." + " ".repeat(500_000)), (e) => e.code === "damaged");
  assert.ok(performance.now() - started < 1000, "took too long");
});

// E122 (BVJ, 2026-11-12): a participant share may ask for its answer key to
// be shown. A display instruction, never part of a sheet record.

test("E122: answerKey rides a participant share only, and only when true", async () => {
  assert.equal(sharedSheet(sample(), { scope: "participant", answerKey: true }).answerKey, true);
  assert.equal("answerKey" in sharedSheet(sample(), { scope: "participant" }), false);
  assert.equal("answerKey" in sharedSheet(sample(), { scope: "leader", answerKey: true }), false);
  // A share without the key is byte for byte what it was before the field existed.
  assert.equal(await shareFragment(sample(), { scope: "participant", answerKey: false }), await shareFragment(sample(), { scope: "participant" }));
  assert.notEqual(await shareFragment(sample(), { scope: "participant", answerKey: true }), await shareFragment(sample(), { scope: "participant" }));
});

test("E122: opening a share hands answerKey back beside the scope, and no record holds it", async () => {
  const withKey = await openShare(await shareFragment(sample(), { scope: "participant", answerKey: true }), ctx);
  assert.equal(withKey.scope, "participant");
  assert.equal(withKey.answerKey, true);
  assert.equal("answerKey" in withKey.sheet, false);
  assert.deepEqual(validateRecord(withKey.sheet), []);
  const mine = copyOfShared(withKey.sheet, { ...ctx, client: "web-other" });
  assert.equal(JSON.stringify(mine).includes("answerKey"), false);
  // The blank's words travel either way: the key is shown or not, never withheld.
  assert.equal(mine.modules.find((m) => m.type === "passage").blanks[0].exact, "life-breath");
  assert.equal((await openShare(await shareFragment(sample(), { scope: "participant" }), ctx)).answerKey, false);
  assert.equal((await openShare(await shareFragment(sample(), { scope: "leader", answerKey: true }), ctx)).answerKey, false);
});

test("E122: a sheet file carries the same answerKey in its data line", async () => {
  const file = await shareFile(sample(), { scope: "participant", answerKey: true });
  assert.equal((await openShare(fragmentInFile(file), ctx)).answerKey, true);
  assert.equal((await openShare(fragmentInFile(await shareFile(sample(), { scope: "participant" })), ctx)).answerKey, false);
});
