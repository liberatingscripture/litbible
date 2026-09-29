// src/lib/verse-image.mjs
//
// The design and typesetting of a verse image (audit X8): "Make an image" in
// the verse menu and the selection panel draws the passage in the share-card
// design and shares it (a phone) or downloads it (a computer). The drawing is
// src/scripts/verse-image.js; everything here is pure, so node:test reaches it
// with a fake measure in place of a canvas.
//
// Owner decisions (2026-09-28), made from an exploration page drawn with this
// same code: two looks, Ink (the share cards' own) and Paper; the verse in
// Crimson Text; both sizes, square and story; the chapter's own address on the
// image ("litbible.net/john-3"), which the owner counts as the link back the
// license asks for; and the length rule below.
//
// The length rule: the text is set at the largest size that fits its box,
// with the lines balanced, stepping down a pixel at a time to a floor, and a
// size whose floor can't hold the text isn't offered. The floors are what stay
// readable where the image is seen: a square in a phone's feed shows about a
// third of its real width, so 40px reads as about 13px; a story fills the
// screen, so 44px reads as about 16px. It measures the real text in the real
// font, so it is not a word count: short words fit more, and poetry, which
// keeps its lines, fits less. Measured on running prose in 2026-09, about 100
// words fit a square and 135 a story.

export const WORDMARK = "The Liberation & Inclusion Translation";

// The share cards' palette (scripts/build-og-images.mjs), and Paper, its
// light sibling. Fixed colours: an image looks the same in any theme.
export const LOOKS = {
  ink: { label: "Ink", bg: "#1D231C", text: "#F2F0E9", mark: "#E1DFD9", bar: "#209D50", accent: "#3ABF6A" },
  paper: { label: "Paper", bg: "#F2F0E9", text: "#1D231C", mark: "#454B44", bar: "#209D50", accent: "#0F6B33" },
};

// Story keeps everything inside the area apps leave clear: Instagram's own
// controls cover roughly the top 250px and bottom 340px of a 1920px story.
export const SIZES = {
  square: {
    label: "Square", W: 1080, H: 1080, margin: 88, lockupY: 80, emblem: 84, wordmark: 30,
    textMax: 72, textMin: 40, ref: 44, address: 30, addressY: 1004, bottom: 930,
  },
  story: {
    label: "Story", W: 1080, H: 1920, margin: 96, lockupY: 250, emblem: 92, wordmark: 32,
    textMax: 84, textMin: 44, ref: 50, address: 34, addressY: 1540, bottom: 1450,
  },
};

// The verse face and its line height; the reference is Fraunces, as on the
// cards, and the wordmark and address are Inter.
export const VERSE_FONT = (px) => `400 ${px}px "Crimson Text", Georgia, serif`;
export const REF_FONT = (px) => `500 ${px}px Fraunces, Georgia, serif`;
export const SANS_FONT = (px) => `400 ${px}px Inter, system-ui, sans-serif`;
export const LINE_HEIGHT = 1.3;

// Space between the verse and the reference: a gap, the green bar, a gap.
export const BAR = { gap: 40, width: 150, height: 8, after: 30 };

/** The vertical space the reference block takes below the verse. */
export function refBlockHeight(spec) {
  return BAR.gap + BAR.height + BAR.after + spec.ref;
}

/** Where the verse's box starts: below the emblem and wordmark. */
export function textTop(spec) {
  return spec.lockupY + spec.emblem + 56;
}

function wrapWords(measure, words, maxW) {
  const lines = [];
  let line = "";
  for (const w of words) {
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

/**
 * Greedy wrap, then the narrowest measure that keeps the same number of
 * lines, so the lines come out even (CSS text-wrap: balance, by hand).
 */
export function balancedWrap(measure, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const greedy = wrapWords(measure, words, maxW);
  if (greedy.length < 2) return greedy;
  let lo = maxW * 0.55;
  let hi = maxW;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapWords(measure, words, mid).length > greedy.length) lo = mid;
    else hi = mid;
  }
  return wrapWords(measure, words, hi);
}

/**
 * Lines to draw, each `{ text, indent }` with the indent in px. Prose is
 * balanced. Text set as lines (poetry, which Copy verse hands over with
 * newlines) keeps its lines, and one too long for the measure wraps with a
 * hanging indent, as the site sets a quoted poem.
 */
export function setText(measure, text, maxW, px) {
  if (!text.includes("\n")) {
    return balancedWrap(measure, text, maxW).map((t) => ({ text: t, indent: 0 }));
  }
  const indent = Math.round(px * 1.1);
  const out = [];
  for (const line of text.split("\n")) {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const first = wrapWords(measure, words, maxW);
    out.push({ text: first[0], indent: 0 });
    if (first.length === 1) continue;
    const rest = words.slice(first[0].split(" ").length);
    for (const t of wrapWords(measure, rest, maxW - indent)) out.push({ text: t, indent });
  }
  return out;
}

/**
 * Set `text` at the largest size, from spec.textMax down to spec.textMin,
 * whose lines fit the image's text box. `measureAt(px)` returns a function
 * giving a string's width at that size. `fits` is false when even the floor
 * is too big, and the site then doesn't offer that size.
 */
export function fitText(measureAt, text, spec) {
  const boxW = spec.W - 2 * spec.margin;
  const boxH = spec.bottom - textTop(spec) - refBlockHeight(spec);
  for (let px = spec.textMax; px >= spec.textMin; px--) {
    const lines = setText(measureAt(px), text, boxW, px);
    if (lines.length * px * LINE_HEIGHT <= boxH) return { px, lines, fits: true };
  }
  const px = spec.textMin;
  return { px, lines: setText(measureAt(px), text, boxW, px), fits: false };
}

/** An opening quotation mark hangs in the margin, so the text's edge stays straight. */
export function hangsInMargin(line) {
  return line.startsWith("“") || line.startsWith("‘");
}

/**
 * "https://litbible.net/john-3/#v16" → "litbible.net/john-3". Always the
 * site's own name, so an image drawn on a preview build or a local server
 * still carries the address a reader can type.
 */
export function imageAddress(url) {
  try {
    return "litbible.net" + new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return "litbible.net";
  }
}

/** "1 Corinthians 13:4–7" + "story" → "1-corinthians-13-4-7-lit-story.png". */
export function imageFileName(ref, size) {
  const slug = ref
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "verse") + "-lit" + (size === "story" ? "-story" : "") + ".png";
}
