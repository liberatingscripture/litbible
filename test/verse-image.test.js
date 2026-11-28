// test/verse-image.test.js
//
// Unit tests for src/lib/verse-image.mjs, the pure design and typesetting
// behind "Share image" (audit X8), as Featherboa redrew it ("Off the screen").
// The drawing is src/scripts/verse-image.js; here a fake measure stands in for
// the canvas, so no font is needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LOOKS,
  SIZES,
  LINE_HEIGHT,
  FOOT,
  WORDMARK,
  VERSE_FONT,
  REF_FONT,
  SANS_FONT,
  textTop,
  footLine,
  fitRef,
  balancedWrap,
  setText,
  fitText,
  hangsInMargin,
  imageAddress,
  imageFileName,
} from "../src/lib/verse-image.mjs";

// Monospace: every character is half the font size wide.
const mono = (px) => (s) => s.length * px * 0.5;

// A plain greedy wrap, to compare the balanced one against.
function greedy(measure, text, maxW) {
  const lines = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? line + " " + w : w;
    if (line && measure(next) > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const widest = (measure, lines) => Math.max(...lines.map(measure));
const words = (n) => Array.from({ length: n }, (_, i) => `word${i % 10}`).join(" ");
const boxHeight = (spec) => spec.bottom - textTop(spec);
const boxWidth = (spec) => spec.W - 2 * spec.margin;

/* ── balancedWrap ──────────────────────────────────────────────────────── */

const BEATITUDE = "Blessed are those who hunger and thirst for justice because they will be satisfied";

test("balancedWrap: text that fits comes back as one line", () => {
  assert.deepEqual(balancedWrap(mono(10), "Jesus wept.", 500), ["Jesus wept."]);
  assert.deepEqual(balancedWrap(mono(10), "", 500), []);
});

test("balancedWrap: same line count as a greedy wrap, and no wider", () => {
  const m = mono(10);
  for (const maxW of [150, 200, 250, 300]) {
    const g = greedy(m, BEATITUDE, maxW);
    const b = balancedWrap(m, BEATITUDE, maxW);
    assert.equal(b.length, g.length, `line count at ${maxW}`);
    assert.ok(widest(m, b) <= widest(m, g), `widest line at ${maxW}`);
  }
});

test("balancedWrap: an uneven greedy wrap comes out narrower", () => {
  const m = mono(10);
  // Greedy leaves a one-word last line at 200 and a long first line at 300.
  for (const maxW of [200, 300]) {
    assert.ok(widest(m, balancedWrap(m, BEATITUDE, maxW)) < widest(m, greedy(m, BEATITUDE, maxW)));
  }
});

test("balancedWrap: no line exceeds maxW", () => {
  const m = mono(10);
  for (const maxW of [150, 200, 250, 300]) {
    for (const line of balancedWrap(m, BEATITUDE, maxW)) assert.ok(m(line) <= maxW, `"${line}" at ${maxW}`);
  }
});

test("balancedWrap: the words survive, whitespace collapsed", () => {
  const messy = "  Blessed   are\tthose who\nhunger  and thirst for justice because they will be satisfied  ";
  const lines = balancedWrap(mono(10), messy, 200);
  assert.equal(lines.join(" "), BEATITUDE);
});

/* ── setText ───────────────────────────────────────────────────────────── */

test("setText: prose has no indent on any line", () => {
  const lines = setText(mono(10), BEATITUDE, 200, 10);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((l) => l.indent === 0));
  assert.equal(lines.map((l) => l.text).join(" "), BEATITUDE);
});

test("setText: each source line starts a new output line", () => {
  assert.deepEqual(setText(mono(10), "Alpha\nBeta\nGamma", 500, 20), [
    { text: "Alpha", indent: 0 },
    { text: "Beta", indent: 0 },
    { text: "Gamma", indent: 0 },
  ]);
});

test("setText: a source line too long continues with a hanging indent", () => {
  const src = "this second source line is far too long to fit on a single line";
  const lines = setText(mono(10), `short\n${src}\nlast`, 200, 20);
  assert.deepEqual(lines, [
    { text: "short", indent: 0 },
    { text: "this second source line is far too long", indent: 0 },
    { text: "to fit on a single line", indent: 22 },
    { text: "last", indent: 0 },
  ]);
  // The indent scales with the size, rounded: 45 * 1.1 = 49.5.
  const big = setText(mono(45), `${src}\nlast`, 900, 45);
  assert.ok(big.some((l) => l.indent > 0));
  assert.ok(big.filter((l) => l.indent > 0).every((l) => l.indent === Math.round(45 * 1.1)));
});

test("setText: an indented continuation still fits inside maxW", () => {
  const m = mono(10);
  const src = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen";
  for (const l of setText(m, `${src}\nend`, 200, 20)) assert.ok(m(l.text) + l.indent <= 200, l.text);
});

test("setText: blank source lines are skipped", () => {
  assert.deepEqual(setText(mono(10), "\nAlpha\n\n   \nBeta\n", 500, 20), [
    { text: "Alpha", indent: 0 },
    { text: "Beta", indent: 0 },
  ]);
});

/* ── fitText ───────────────────────────────────────────────────────────── */

for (const [name, spec] of Object.entries(SIZES)) {
  test(`fitText (${name}): a short text fits at textMax`, () => {
    const r = fitText(mono, "Jesus wept.", spec);
    assert.equal(r.px, spec.textMax);
    assert.equal(r.fits, true);
    assert.equal(r.lines.length, 1);
  });

  test(`fitText (${name}): a longer text steps down to a size that fits the box`, () => {
    const r = fitText(mono, words(60), spec);
    assert.equal(r.fits, true);
    assert.ok(r.px < spec.textMax);
    assert.ok(r.px >= spec.textMin);
    assert.ok(r.lines.length * r.px * LINE_HEIGHT <= boxHeight(spec));
    // The lines returned are the ones setText gives at that size.
    assert.deepEqual(r.lines, setText(mono(r.px), words(60), boxWidth(spec), r.px));
  });

  test(`fitText (${name}): the size chosen is the largest that fits`, () => {
    for (const n of [30, 40, 60]) {
      const text = words(n);
      const { px, fits } = fitText(mono, text, spec);
      if (!fits || px === spec.textMax) continue;
      const bigger = setText(mono(px + 1), text, boxWidth(spec), px + 1);
      assert.ok(bigger.length * (px + 1) * LINE_HEIGHT > boxHeight(spec), `${n} words at ${px + 1}px`);
    }
  });

  test(`fitText (${name}): an absurdly long text does not fit, and sits at the floor`, () => {
    const r = fitText(mono, words(3000), spec);
    assert.equal(r.fits, false);
    assert.equal(r.px, spec.textMin);
    assert.ok(r.lines.length * r.px * LINE_HEIGHT > boxHeight(spec));
  });
}

test("fitText: the story holds more than the square", () => {
  // 60 words fit both, and the taller story sets them larger.
  const sq = fitText(mono, words(60), SIZES.square);
  const st = fitText(mono, words(60), SIZES.story);
  assert.ok(sq.fits && st.fits);
  assert.ok(st.px >= sq.px);
  // 110 words are too many for the square but fit the story.
  const sq110 = fitText(mono, words(110), SIZES.square);
  const st110 = fitText(mono, words(110), SIZES.story);
  assert.equal(sq110.fits, false);
  assert.equal(st110.fits, true);
});

/* ── hangsInMargin ─────────────────────────────────────────────────────── */

test("hangsInMargin: curly openers hang, nothing else does", () => {
  assert.equal(hangsInMargin("“For God so loved"), true);
  assert.equal(hangsInMargin("‘Lord, when"), true);
  assert.equal(hangsInMargin("For God so loved"), false);
  assert.equal(hangsInMargin('"For God so loved'), false);
  assert.equal(hangsInMargin("'Lord, when"), false);
  assert.equal(hangsInMargin("he said, “Follow me”"), false);
  assert.equal(hangsInMargin(""), false);
});

/* ── imageAddress ──────────────────────────────────────────────────────── */

test("imageAddress: the site's name and the path, no fragment or slash", () => {
  assert.equal(imageAddress("https://litbible.net/john-3#v16"), "litbible.net/john-3");
  assert.equal(imageAddress("https://litbible.net/john-3/#v16-18"), "litbible.net/john-3");
  assert.equal(imageAddress("https://www.litbible.net/1corinthians-13"), "litbible.net/1corinthians-13");
});

test("imageAddress: always litbible.net, whatever host drew the image", () => {
  assert.equal(imageAddress("http://localhost:4321/john-3#v16"), "litbible.net/john-3");
  assert.equal(imageAddress("https://abc123.litbible.pages.dev/romans-8/"), "litbible.net/romans-8");
});

test("imageAddress: an unparseable address falls back to the bare site", () => {
  assert.equal(imageAddress("not a url"), "litbible.net");
  assert.equal(imageAddress(""), "litbible.net");
});

/* ── imageFileName ─────────────────────────────────────────────────────── */

test("imageFileName: a slug of the reference, marked -lit", () => {
  assert.equal(imageFileName("John 3:16", "square"), "john-3-16-lit.png");
});

test("imageFileName: the story size is marked, and an en dash is a separator", () => {
  assert.equal(imageFileName("1 Corinthians 13:4–7", "story"), "1-corinthians-13-4-7-lit-story.png");
});

test("imageFileName: an empty reference still gets a name", () => {
  assert.equal(imageFileName("", "square"), "verse-lit.png");
  assert.equal(imageFileName("", "story"), "verse-lit-story.png");
});

/* ── design invariants ─────────────────────────────────────────────────── */

test("SIZES: both are 1080 wide, the type has a range, and the foot line sits below the text box", () => {
  for (const [name, s] of Object.entries(SIZES)) {
    assert.equal(s.W, 1080, `${name} width`);
    assert.ok(s.textMin < s.textMax, `${name} type range`);
    assert.ok(s.bottom < s.footTop, `${name} text box ends above the foot line`);
    assert.equal(s.footTop - s.bottom, Math.round(s.W * FOOT.boxGap), `${name} gap above the foot line`);
    assert.ok(footLine(s).bottom <= s.H - s.margin, `${name} foot line inside the image`);
    assert.ok(boxHeight(s) > 0, `${name} text box has height`);
  }
});

test("SIZES: today's readable floor is kept (40px a square, 44px a story)", () => {
  assert.equal(SIZES.square.textMin, 40);
  assert.equal(SIZES.story.textMin, 44);
});

test("SIZES: the story keeps its content inside the area apps leave clear", () => {
  const s = SIZES.story;
  assert.ok(s.textTop >= 250, "clear of the top 250px");
  assert.ok(footLine(s).bottom <= s.H - 340, "clear of the bottom 340px");
});

test("SIZES: margins and the foot line share one rule, so both sizes match", () => {
  const sq = footLine(SIZES.square);
  const st = footLine(SIZES.story);
  assert.equal(SIZES.square.margin, SIZES.story.margin);
  assert.equal(sq.emblem.size, st.emblem.size);
  assert.equal(sq.ref.px, st.ref.px);
  assert.equal(sq.right.px, st.right.px);
  assert.equal(sq.emblem.size, 72);
  assert.equal(sq.right.px, 28);
});

test("the faces: Source Sans 3 for the verse, Fraunces for the reference, no Inter or Crimson", () => {
  assert.match(VERSE_FONT(40), /^400 40px "Source Sans 3 Variable"/);
  assert.match(SANS_FONT(28), /"Source Sans 3 Variable"/);
  assert.match(REF_FONT(40), /^500 40px "Fraunces Variable"/);
  for (const f of [VERSE_FONT(40), REF_FONT(40), SANS_FONT(28)]) assert.doesNotMatch(f, /Inter|Crimson/);
  // And not in the code that draws it.
  for (const file of ["../src/lib/verse-image.mjs", "../src/scripts/verse-image.js"]) {
    const code = readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /Inter|Crimson/, file);
  }
});

test("the faces are ones the site serves (faces.css declares them)", () => {
  const css = readFileSync(new URL("../src/styles/faces.css", import.meta.url), "utf8");
  for (const family of ["Source Sans 3 Variable", "Fraunces Variable"]) {
    assert.ok(css.includes(`font-family: "${family}"`), family);
  }
});

test("the name over the address, and no bar", () => {
  assert.equal(WORDMARK, "Liberation & Inclusion Translation");
  const src = readFileSync(new URL("../src/lib/verse-image.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /BAR|refBlockHeight/);
  for (const look of Object.values(LOOKS)) assert.equal(look.bar, undefined);
});

/* ── the foot line ─────────────────────────────────────────────────────── */

test("footLine: the emblem and reference at the left, the name over the address at the right", () => {
  for (const [name, s] of Object.entries(SIZES)) {
    const f = footLine(s, { nameW: 400, addressW: 300 });
    assert.equal(f.emblem.x, s.margin, `${name} emblem at the margin`);
    assert.ok(f.ref.x > f.emblem.x + f.emblem.size, `${name} reference after the emblem`);
    assert.equal(f.right.x, s.W - s.margin, `${name} right block ends at the margin`);
    assert.ok(f.right.nameY < f.right.addressY, `${name} the name is over the address`);
    assert.equal(f.right.width, 400);
    // Both lines of the right block stay within the emblem's height, to a baseline's slack.
    assert.ok(f.right.nameY > f.top && f.right.addressY < f.bottom + f.right.px * 0.4, `${name} right block beside the emblem`);
  }
});

test("fitRef: a reference that clears the name keeps the foot size, a long one steps down", () => {
  const spec = SIZES.square;
  const refMono = (px) => (s) => s.length * px * 0.5;
  assert.equal(fitRef(refMono, "John 1:5", spec, 400), Math.round(spec.W * FOOT.ref));
  const long = "2 Thessalonians 1:1–2:12, and then some more words";
  const px = fitRef(refMono, long, spec, 400);
  assert.ok(px < Math.round(spec.W * FOOT.ref));
  assert.ok(px >= Math.round(spec.W * FOOT.small));
  // Never smaller than the small line, even if it still doesn't fit.
  assert.equal(fitRef(refMono, "x".repeat(200), spec, 400), Math.round(spec.W * FOOT.small));
  // What it chose clears the right block.
  const room = spec.W - 2 * spec.margin - 72 - 20 - 400 - Math.round(spec.W * FOOT.between);
  assert.ok(refMono(px)(long) <= room || px === Math.round(spec.W * FOOT.small));
});

/* ── the looks ─────────────────────────────────────────────────────────── */

test("LOOKS: every look defines the same keys", () => {
  const [first, ...rest] = Object.values(LOOKS).map((l) => Object.keys(l).sort());
  assert.ok(first.length > 0);
  for (const keys of rest) assert.deepEqual(keys, first);
  assert.deepEqual(Object.keys(LOOKS).sort(), ["ink", "paper"]);
});

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("LOOKS: every text color is 4.5:1 or better on its background, in both looks", () => {
  for (const [name, look] of Object.entries(LOOKS)) {
    for (const key of ["text", "quiet"]) {
      const ratio = contrast(look[key], look.bg);
      assert.ok(ratio >= 4.5, `${name} ${key} on bg is ${ratio.toFixed(2)}`);
    }
  }
});

test("LOOKS: the quiet ink is the text at 78% over the background", () => {
  for (const [name, look] of Object.entries(LOOKS)) {
    for (let i = 1; i < 7; i += 2) {
      const t = parseInt(look.text.slice(i, i + 2), 16);
      const b = parseInt(look.bg.slice(i, i + 2), 16);
      const q = parseInt(look.quiet.slice(i, i + 2), 16);
      assert.ok(Math.abs(q - (0.78 * t + 0.22 * b)) <= 1.5, `${name} channel ${i}`);
    }
  }
});
