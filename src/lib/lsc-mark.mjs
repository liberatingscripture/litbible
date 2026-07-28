/**
 * The Liberating Scripture Collective dove mark — geometry, in one place.
 *
 * The art arrives from Inkscape as three filled paths inside a group carrying a
 * fit-to-drawing transform. It is monochrome, which is the whole point: a single
 * color means the mark can follow the theme instead of being a fixed tile.
 *
 * The house treatment is an "inverted coin": the dove sits on a filled disc
 * whose color OPPOSES the surface, and the dove opposes the disc. So an ink disc
 * with a cream dove on a light page, and the reverse on a dark one. On-page that
 * flip is driven by the --lsc-mark-disc / --lsc-mark-bird tokens (see
 * global.css and components/LscMark.astro); here it is just two arguments.
 *
 * Two shapes exist because two jobs do:
 *   coin — the disc, transparent outside it. Every on-page use, the favicon SVG,
 *          and the OG composite.
 *   tile — the same art full-bleed on a square, no circular clip. The apple-touch
 *          icon and the web-app-manifest icons are declared `purpose: maskable`,
 *          which means the platform crops them to its own mask; a circle on a
 *          transparent field would get clipped into a lens. A tile also stays
 *          legible at 16px, where a coin's rim turns to mush.
 *
 * Imported by src/components/LscMark.astro at build time, from Astro frontmatter.
 *
 * Mirrored verbatim from liberatingscripture.org's repo, which owns the mark and
 * also carries scripts/build-brand-assets.mjs — every generated favicon, app
 * icon and OG raster over there comes from this same module, so the mark on this
 * page and the mark in LSC's share cards are provably the same drawing. Nothing
 * here needs generating on this side; keep the two copies in step.
 */

/** Extent of the source drawing, in its own user units. */
export const ART_W = 247.96603;
export const ART_H = 217.5247;

/** Inkscape's fit-to-drawing offset. Applied innermost, it moves the paths so
 *  they start at (0,0) and exactly fill ART_W × ART_H. */
export const ART_FIT = "translate(28.648394 -32.64334)";

/**
 * The three dove paths, verbatim from the supplied lsc-dove.svg.
 * The source carries a 0.264583 stroke in the same color as the fill; it
 * thickens the hairlines a touch and is reproduced rather than baked in.
 */
export const DOVE_PATHS = [
  "m 143.9912,60.167241 c 0.003,-0.002 0.003,-0.007 0.005,-0.0124 1.01907,15.45435 2.03192,31.04823 -0.26665,46.363059 -4.6519,30.94798 -24.79849,53.67527 -56.678705,57.72671 26.449025,-14.37742 44.813795,-42.65166 47.198155,-72.663269 -9.53328,8.985499 -21.60489,14.679209 -32.76597,21.537709 -11.161075,6.85746 -22.028625,15.61765 -26.676405,27.866 -5.62136,14.81356 -0.80305,31.96394 8.45634,44.82 9.25834,12.85606 22.418265,22.27047 35.334265,31.44614 -13.16095,-1.41594 -24.982445,-8.95346 -34.492975,-18.16117 -10.11722,-9.79475 -18.30276,-21.93147 -21.75991,-35.58129 -3.45716,-13.65291 -1.81488,-28.88195 6.05337,-40.56083 8.93176,-13.2612 24.25279,-20.36258 38.136175,-28.288709 14.94689,-8.53281 29.48036,-19.2412 37.45715,-34.49195",
  "m 72.013165,206.21 c 13.70872,8.45633 29.239555,14.43013 45.871095,19.22467 -11.08149,4.58991 -25.843375,1.48931 -36.518695,-2.9559 -11.87731,-4.94439 -22.25291,-12.94287 -31.61771,-21.76714 -14.30404,-13.47825 -26.59062,-29.09073 -36.3244,-46.16462 -4.9009901,-8.59379 -9.2376701,-17.66611 -15.9111701,-24.97109 -6.67453,-7.30498 -16.3555899,-12.7217 -26.1606799,-11.39052 7.62538,-10.35079 20.8266399,-15.80058 33.6806399,-15.63419 12.8529601,0.16433 25.2780401,5.46944 35.5554501,13.19196 1.52238,-12.66279 10.17405,-23.422859 20.12693,-31.400659 9.95185,-7.97471 21.41368,-13.86686 31.61461,-21.52117 10.201955,-7.65742 19.446865,-17.71882 22.169185,-30.178 9.17153,17.75292 6.66523,40.88329 -6.09782,56.26116 2.04432,-8.28166 2.18281,-17.02945 0.40101,-25.37416 -18.291385,11.14454 -37.465405,23.21512 -47.258095,42.262019 -8.5018,16.53646 -8.662,35.99367 -7.82174,54.56824 -6.26629,-27.21074 -33.53387,-47.97226 -61.4308801,-46.77337 10.84895,2.47634 19.4034701,10.99365 25.2718501,20.4494 5.8694,9.45369 9.62525,20.05046 14.78772,29.90825 9.91671,18.93115 23.52828,32.31637 39.6627,42.26512",
  "m 219.31064,249.90347 c 0.003,0.0868 0.005,0.17465 0.007,0.26458 -10.65982,-12.26076 -26.38909,-18.8092 -41.9282,-23.54585 -15.54115,-4.73358 -31.68695,-8.15455 -45.95997,-15.91428 -14.27303,-7.76284 -26.78803,-21.00337 -28.55433,-37.15329 19.20916,16.25637 39.70093,32.16858 63.8917,39.09219 14.85906,4.25193 32.32156,5.94589 41.47035,18.39887 -3.45819,-9.00306 -6.95876,-18.08675 -12.25042,-26.14827 -5.29167,-8.06462 -12.59147,-15.13913 -21.65552,-18.43402 -5.9459,-2.15801 -12.37755,-2.61379 -18.43402,-4.43694 -4.97128,-1.49758 -9.99837,-4.19095 -12.76821,-8.73125 12.82401,5.35058 26.71154,4.1889 40.06784,8.22586 13.25086,4.00596 23.38668,15.30139 28.86128,28.01483 5.4374,12.63384 6.83162,26.61439 7.25228,40.36757",
];

/** Canonical box the mark is composed in. Every consumer scales from here. */
export const BOX = 320;

/**
 * Fraction of the box the dove's width occupies. 0.625 leaves the dove clear of
 * the coin's rim (its bounding-box corners land at r≈133 of 160) without
 * floating small inside it.
 */
const ART_FILL = 0.625;

/** The transform that places the art, centered, at ART_FILL of BOX. */
export function artTransform(box = BOX) {
  const scale = (box * ART_FILL) / ART_W;
  const x = (box - ART_W * scale) / 2;
  const y = (box - ART_H * scale) / 2;
  return `translate(${round(x)} ${round(y)}) scale(${round(scale, 6)}) ${ART_FIT}`;
}

function round(v, places = 4) {
  return Number(v.toFixed(places));
}

/** The dove itself, as an SVG fragment. `bird` may be a color or a CSS var(). */
export function doveGroup(bird, box = BOX) {
  const paths = DOVE_PATHS.map(
    (d) => `<path d="${d}" fill="${bird}" stroke="${bird}" stroke-width="0.264583"/>`,
  ).join("");
  return `<g transform="${artTransform(box)}">${paths}</g>`;
}

/** The backdrop the dove sits on: a full-bleed square, or a disc filling it. */
export function backdrop(disc, shape = "coin", box = BOX) {
  const c = box / 2;
  return shape === "tile"
    ? `<rect width="${box}" height="${box}" fill="${disc}"/>`
    : `<circle cx="${c}" cy="${c}" r="${c}" fill="${disc}"/>`;
}

/**
 * A complete, standalone SVG document for the mark. Used by the build script to
 * feed sharp and to write public/favicon.svg; the Astro component composes the
 * same two helpers inline instead, so it can carry classes and a11y attributes.
 *
 * `extra` is injected into <defs>-adjacent position — the favicon uses it for
 * its own prefers-color-scheme <style>.
 */
export function markSvg({ disc, bird, shape = "coin", size, extra = "" } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}"${dims}>` +
    extra +
    backdrop(disc, shape) +
    doveGroup(bird) +
    `</svg>`
  );
}

/** The two brand colors, exactly as supplied. */
export const INK = "#1D231C";
export const LIGHT = "#FAFAF8";
