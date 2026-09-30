// src/scripts/verse-image.js
//
// "Make an image" (audit X8): the verse menu and the selection panel draw the
// passage in the share-card design, in the reader's browser, and hand it on.
// The design and the typesetting rules are src/lib/verse-image.mjs; this file
// draws, and runs the button.
//
// One button that becomes the next question each time it's answered (owner,
// 2026-09-28): "Make an image" → Ink or Paper → Square or Story → the phone's
// share sheet, or a download on a computer. A phone or tablet is told apart
// by its OS (isAppPlatform), not the screen width, the same test the app
// announcement uses.
//
// Nothing is stored and nothing leaves the device until the reader shares it.
//
// Safari only opens the share sheet from a tap that is still fresh, so both
// images for the chosen look are drawn while the size question is showing,
// and the last tap shares one that is already made. If a slow phone isn't
// done in time, the button asks for one more tap.

import {
  LOOKS,
  SIZES,
  WORDMARK,
  VERSE_FONT,
  REF_FONT,
  SANS_FONT,
  LINE_HEIGHT,
  BAR,
  fitText,
  hangsInMargin,
  imageAddress,
  imageFileName,
  refBlockHeight,
  textTop,
} from "../lib/verse-image.mjs";
import { isAppPlatform } from "./announcement-gate.js";

const EMBLEM_URL = "/images/lit-logo-2026-ring.svg";

let assets = null;

/** The three faces and the emblem, loaded once per page. */
function loadAssets() {
  if (!assets) {
    const fonts = [VERSE_FONT(40), REF_FONT(40), SANS_FONT(30)].map((f) =>
      document.fonts.load(f).catch(() => null)
    );
    const emblem = new Image();
    emblem.src = EMBLEM_URL;
    const emblemReady = emblem.decode().then(
      () => emblem,
      () => null
    );
    assets = Promise.all([emblemReady, ...fonts]).then(([img]) => ({ emblem: img }));
  }
  return assets;
}

function measurer(ctx, font) {
  return (px) => {
    ctx.font = font(px);
    return (s) => ctx.measureText(s).width;
  };
}

let scratch = null;

/** The sizes this text fits, in the order they're offered. */
function sizesThatFit(text) {
  scratch ||= document.createElement("canvas").getContext("2d");
  return Object.keys(SIZES).filter(
    (key) => fitText(measurer(scratch, VERSE_FONT), text, SIZES[key]).fits
  );
}

/** Draw one image. `emblem` may be null (it failed to load): the rest still draws. */
function draw({ text, ref, address }, lookKey, sizeKey, emblem) {
  const spec = SIZES[sizeKey];
  const look = LOOKS[lookKey];
  const canvas = document.createElement("canvas");
  canvas.width = spec.W;
  canvas.height = spec.H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = look.bg;
  ctx.fillRect(0, 0, spec.W, spec.H);

  // The lockup, as on the share cards: the ringed emblem, then the wordmark.
  const M = spec.margin;
  if (emblem) ctx.drawImage(emblem, M, spec.lockupY, spec.emblem, spec.emblem);
  ctx.font = SANS_FONT(spec.wordmark);
  ctx.fillStyle = look.mark;
  ctx.fillText(WORDMARK, M + spec.emblem + 22, spec.lockupY + spec.emblem / 2 + spec.wordmark * 0.36);

  // The verse, then the bar and the reference, centred together between the
  // lockup and the address.
  const set = fitText(measurer(ctx, VERSE_FONT), text, spec);
  const lineH = set.px * LINE_HEIGHT;
  const top = textTop(spec);
  const blockH = set.lines.length * lineH + refBlockHeight(spec);
  const y = top + Math.max(0, (spec.bottom - top - blockH) / 2);

  ctx.font = VERSE_FONT(set.px);
  ctx.fillStyle = look.text;
  let baseline = y + set.px * 0.92;
  for (const line of set.lines) {
    let x = M + line.indent;
    if (hangsInMargin(line.text)) x -= ctx.measureText(line.text[0]).width;
    ctx.fillText(line.text, x, baseline);
    baseline += lineH;
  }

  let ry = y + set.lines.length * lineH + BAR.gap;
  ctx.fillStyle = look.bar;
  ctx.fillRect(M + 4, ry, BAR.width, BAR.height);
  ry += BAR.height + BAR.after + spec.ref * 0.78;
  ctx.font = REF_FONT(spec.ref);
  ctx.fillStyle = look.text;
  ctx.fillText(ref, M, ry);
  const refW = ctx.measureText(ref + " ").width;
  ctx.fillStyle = look.accent;
  ctx.fillText("LIT", M + refW, ry);

  // The chapter's address, bottom right, where the share cards put the site's.
  ctx.font = SANS_FONT(spec.address);
  ctx.fillStyle = look.accent;
  ctx.fillText(address, spec.W - M - ctx.measureText(address).width, spec.addressY);

  return canvas;
}

function toBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      canvas.width = canvas.height = 0; // let a phone have the memory back
      resolve(blob);
    }, "image/png");
  });
}

function download(blob, name) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}

/** "shared", "cancelled", "stale" (the tap was too old), or "failed". */
async function share(file, text) {
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (err) {
    if (err?.name === "AbortError") return "cancelled";
    if (err?.name === "NotAllowedError") return "stale";
    return "failed";
  }
}

function canShareFile(file) {
  return isAppPlatform() && !!navigator.canShare && navigator.canShare({ files: [file] });
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Replace the step's contents with `build()`'s, fading the old out and the
 * new in. Focus follows only a reader who was already in the step (the
 * keyboard, in the verse menu); the selection panel never takes focus.
 */
function swap(step, build) {
  const hadFocus = step.contains(document.activeElement);
  const next = () => {
    step.replaceChildren(...build());
    step.inert = false;
    if (hadFocus) step.querySelector("button")?.focus();
    if (!reduceMotion()) {
      step.animate(
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 160, easing: "ease-out" }
      );
    }
  };
  if (reduceMotion()) return next();
  step.inert = true; // no second tap on a button that is leaving
  step.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: "ease-in" }).finished.then(next, next);
}

function stepButton(label, { swatch = null, shape = null } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lit-panel__btn lit-image__choice";
  if (swatch) {
    const chip = document.createElement("span");
    chip.className = "lit-image__swatch";
    chip.style.background = swatch.bg;
    chip.style.borderColor = swatch.text;
    chip.setAttribute("aria-hidden", "true");
    btn.appendChild(chip);
  }
  if (shape) {
    const icon = document.createElement("span");
    icon.className = "lit-image__shape lit-image__shape--" + shape;
    icon.setAttribute("aria-hidden", "true");
    btn.appendChild(icon);
  }
  btn.append(label);
  return btn;
}

function group(label, buttons) {
  const g = document.createElement("div");
  g.className = "lit-image__group";
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", label);
  g.append(...buttons);
  return g;
}

function note(text) {
  const p = document.createElement("p");
  p.className = "lit-image__note";
  p.setAttribute("role", "status");
  p.textContent = text;
  return p;
}

/**
 * The "Make an image" step for a panel.
 *
 * @param {object} o
 * @param {() => {text: string, ref: string, url: string, shareText: string}} o.content
 *   What to draw: the passage as it should read on the image (no verse
 *   numbers), its reference and verse link, and the text that goes with it
 *   to the share sheet (the same text Share… sends).
 * @param {() => void} [o.onStart]  called on the first tap (the selection
 *   panel marks itself busy, so clearing the selection doesn't close it)
 * @param {() => void} o.onDone  called once the image has gone
 * @returns {HTMLElement}
 */
export function imageStep({ content, onStart = () => {}, onDone }) {
  const step = document.createElement("div");
  step.className = "lit-image";

  let what = null; // content(), taken once
  let fitting = null; // the sizes this text fits
  const made = {}; // size → Blob, for the chosen look
  let making = null;

  const start = stepButton("Make an image");
  start.addEventListener("click", async () => {
    onStart();
    // Marks a step past its first button, for a panel that shares its row
    // with Share… (the chip layout gives the row over to the questions).
    step.classList.add("lit-image--open");
    what = content();
    start.textContent = "Preparing…";
    start.setAttribute("aria-busy", "true");
    await loadAssets();
    fitting = sizesThatFit(what.text);
    if (!fitting.length) {
      swap(step, () => [note("Too long for an image. Try fewer verses.")]);
      return;
    }
    swap(step, lookStep);
  });
  step.appendChild(start);

  function lookStep() {
    const buttons = Object.entries(LOOKS).map(([key, look]) => {
      const btn = stepButton(look.label, { swatch: look });
      btn.addEventListener("click", () => chooseLook(key));
      return btn;
    });
    return [group("Image color", buttons)];
  }

  function chooseLook(lookKey) {
    // Draw both sizes now, while the reader decides, so the last tap can hand
    // the phone a finished image (see the header).
    making = loadAssets().then(async ({ emblem }) => {
      for (const size of fitting) {
        made[size] = await toBlob(
          draw({ ...what, address: imageAddress(what.url) }, lookKey, size, emblem)
        );
      }
    });
    swap(step, sizeStep);
  }

  function sizeStep() {
    const buttons = fitting.map((key) => {
      const btn = stepButton(SIZES[key].label, { shape: key });
      btn.addEventListener("click", () => deliver(key, btn));
      return btn;
    });
    return [group("Image size", buttons)];
  }

  async function deliver(size, btn) {
    const name = imageFileName(what.ref, size);
    if (!made[size]) {
      btn.textContent = "Making image…";
      btn.setAttribute("aria-busy", "true");
      await making;
    }
    const blob = made[size];
    if (!blob) {
      swap(step, () => [note("Couldn’t make the image in this browser.")]);
      return;
    }
    const file = new File([blob], name, { type: "image/png" });
    if (!canShareFile(file)) {
      download(blob, name);
      swap(step, () => [note("Image downloaded ✓")]);
      setTimeout(onDone, 900);
      return;
    }
    const result = await share(file, what.shareText);
    if (result === "shared") return onDone();
    if (result === "cancelled") return;
    if (result === "stale") {
      // The image took long enough that the phone no longer counts this as
      // the reader's tap. One more tap shares it straight away.
      swap(step, () => {
        const again = stepButton("Share image");
        again.addEventListener("click", async () => {
          if ((await share(file, what.shareText)) === "shared") onDone();
        });
        return [again];
      });
      return;
    }
    download(blob, name);
    swap(step, () => [note("Image downloaded ✓")]);
    setTimeout(onDone, 900);
  }

  return step;
}
