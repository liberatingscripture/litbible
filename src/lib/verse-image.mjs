// src/lib/verse-image.mjs
//
// The design and typesetting of a verse image (audit X8): "Make an image" in
// the verse menu and the selection panel draws the passage in the share-card
// design and shares it (a phone) or downloads it (a computer). The drawing is
// src/scripts/verse-image.js; everything here is pure, so node:test reaches it
// with a fake measure in place of a canvas.
//
// Owner decisions (2026-09-28), made from an exploration page drawn with this
// same code: two looks, Ink and Paper (since Featherboa, its two colors); both sizes,
// square and story; the chapter's own address on the image
// ("litbible.net/john-3"), which the owner counts as the link back the
// license asks for; and the length rule below. Featherboa (2026-11-26,
// SITE-FEATHERBOA.md, "Off the screen") redrew it: the verse in Source Sans 3,
// as on the screen, and one small line under it (the emblem and the
// reference at the left, the name over the address at the right) in place of
// the lockup, the green bar, and the address corner. The emblem is the green.
//
// The length rule: the text is set at the largest size that fits its box,
// with the lines balanced, stepping down a pixel at a time to a floor, and a
// size whose floor can't hold the text isn't offered. The floors are what stay
// readable where the image is seen: a square in a phone's feed shows about a
// third of its real width, so 40px reads as about 13px; a story fills the
// screen, so 44px reads as about 16px. It measures the real text in the real
// font, so it is not a word count: short words fit more, and poetry, which
// keeps its lines, fits less. (Measured on running prose in 2026-09, in the
// old box and face: about 100 words fit a square and 135 a story. The box is
// taller now that the lockup and the bar are gone, so more fit.)

export const WORDMARK = "Liberation & Inclusion Translation";

// Featherboa's two colors ("Color"): Ink #1D231C and Paper #FAFAF8, each
// the other's ground. Fixed colors: an image looks the same in any theme.
// `quiet` is the text at 78% over the background (the screen's second ink),
// for the name and the address. No green is drawn but the emblem's own. (The
// link-preview cards, scripts/build-og-images.mjs, keep their own palette.)
export const LOOKS = {
  ink: { label: "Ink", bg: "#1D231C", text: "#FAFAF8", quiet: "#C9CBC8" },
  paper: { label: "Paper", bg: "#FAFAF8", text: "#1D231C", quiet: "#4E524C" },
};

// Both sizes are 1080 wide and share every proportion of the margin and the
// foot line (FOOT, from W); they differ in height and in where the text box
// sits. Story keeps everything inside the area apps leave clear: Instagram's
// own controls cover roughly the top 250px and bottom 340px of a 1920px
// story. `textTop` is where the verse's box starts, `footTop` the top of the
// foot line (its emblem), and `bottom` the verse box's end, FOOT.gap above it.
export const SIZES = {
  square: {
    label: "Square", W: 1080, H: 1080, margin: 96, textMax: 72, textMin: 40,
    textTop: 96, footTop: 912, bottom: 856,
  },
  story: {
    label: "Story", W: 1080, H: 1920, margin: 96, textMax: 84, textMin: 44,
    textTop: 250, footTop: 1508, bottom: 1452,
  },
};

// The foot line, in proportions of the image's width (1080 gives 72, 40, 28,
// 20, and 56): one rule for both sizes.
export const FOOT = {
  emblem: 0.0667,
  ref: 0.037,
  small: 0.026,
  gap: 0.0185,
  boxGap: 0.052,
  between: 0.03, // the least space between the reference and the name block
};
const foot = (spec, k) => Math.round(spec.W * FOOT[k]);

// The faces are ones the site serves (src/styles/faces.css), named as CSS
// knows them: the verse and the small line in Source Sans 3 (the screen's
// 400), the reference in Fraunces, a heading's 500. Their fallbacks are
// generic, since a canvas can't use the site's fitted fallback faces.
export const SOURCE_FAMILY = '"Source Sans 3 Variable"';
export const FRAUNCES_FAMILY = '"Fraunces Variable"';
export const VERSE_FONT = (px) => `400 ${px}px ${SOURCE_FAMILY}, system-ui, sans-serif`;
export const REF_FONT = (px) => `500 ${px}px ${FRAUNCES_FAMILY}, Georgia, serif`;
export const SANS_FONT = (px) => `500 ${px}px ${SOURCE_FAMILY}, system-ui, sans-serif`;
export const LINE_HEIGHT = 1.3;

/** Where the verse's box starts. */
export function textTop(spec) {
  return spec.textTop;
}

/**
 * The foot line's geometry for `spec`. `refPx` is the reference's size after
 * fitRef; `nameW` and `addressW` are the two right-hand lines' widths. Every
 * y is a baseline; x for the right block is its right edge (draw it
 * right-aligned).
 */
export function footLine(spec, { refPx, nameW = 0, addressW = 0 } = {}) {
  const emblem = foot(spec, "emblem");
  const small = foot(spec, "small");
  const gap = foot(spec, "gap");
  const cy = spec.footTop + emblem / 2;
  const lh = Math.round(small * LINE_HEIGHT);
  const px = refPx ?? foot(spec, "ref");
  return {
    emblem: { x: spec.margin, y: spec.footTop, size: emblem },
    ref: { x: spec.margin + emblem + gap, y: cy + px * 0.35, px },
    right: {
      x: spec.W - spec.margin,
      px: small,
      nameY: cy - lh / 2 + small * 0.35,
      addressY: cy + lh / 2 + small * 0.35,
      width: Math.max(nameW, addressW),
    },
    top: spec.footTop,
    bottom: spec.footTop + emblem,
  };
}

/**
 * The reference's size: the foot line's, stepped down a pixel at a time (to
 * the small line's size) until it clears the right-hand block. `measureAt(px)`
 * gives a width function for the reference font at that size.
 */
export function fitRef(measureAt, ref, spec, rightW) {
  const start = foot(spec, "ref");
  const floor = foot(spec, "small");
  const room =
    spec.W - 2 * spec.margin - foot(spec, "emblem") - foot(spec, "gap") - rightW - foot(spec, "between");
  for (let px = start; px >= floor; px--) {
    if (measureAt(px)(ref) <= room) return px;
  }
  return floor;
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
 * balanced. Text set as lines (poetry, which Copy text hands over with
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
  const boxH = spec.bottom - textTop(spec);
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
