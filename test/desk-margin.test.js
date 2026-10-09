// test/desk-margin.test.js
//
// src/lib/desk-margin.mjs: where the Notebook panel goes. It fills the right
// margin beside the reading column and moves nothing when the margin is wide
// enough; otherwise the column moves left only as far as the panel needs.
// The widths below are real ones: Study View's column is 622px at the
// default text size with the desk's 52 measure, 787px at Extra large. (At
// 48, which Study View chapters take while the panel is open since
// 2026-10-08, it is 577px; the rule doesn't care.)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EDGE, GAP, MAX_MEASURE, MAX_WIDTH, MIN_HEIGHT, MIN_MEASURE, MIN_WIDTH, TAB_EDGE, TAB_GAP, TAB_WIDTH,
  dragNotebookEdge, dragTextEdge, nextCollapsed, panelHeight, placeFloating, placeInMargin,
  placeWithWidths, widestMeasure, widthsFromLayout,
} from "../src/lib/desk-margin.mjs";

/** A column `width` wide, centred in a page `viewport` wide, moved left by `shift`. */
function centred(viewport, width, shift = 0) {
  const left = (viewport - width) / 2 - shift;
  return { viewport, column: { left, right: left + width }, main: { left: 0 }, shift };
}

test("a wide margin: the panel fills it, beside the text, and nothing moves", () => {
  const m = centred(1425, 622); // a 1440px window
  const at = placeInMargin(m);
  assert.equal(at.shift, 0);
  assert.equal(at.over, false);
  assert.equal(at.left, m.column.right + GAP);
  assert.equal(at.left + at.width, 1425 - EDGE);
  assert.ok(at.width >= MIN_WIDTH && at.width <= MAX_WIDTH);
});

test("a very wide margin: the panel stops at its widest and keeps to the text's side", () => {
  const m = centred(1905, 622); // a 1920px window
  const at = placeInMargin(m);
  assert.equal(at.width, MAX_WIDTH);
  assert.equal(at.left, m.column.right + GAP);
  assert.equal(at.shift, 0);
});

test("exactly enough margin still moves nothing", () => {
  const viewport = 1600;
  const width = viewport - 2 * (MIN_WIDTH + GAP + EDGE);
  const at = placeInMargin(centred(viewport, width));
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.shift, 0);
});

test("a narrow margin: the column moves left only as far as the panel needs", () => {
  const m = centred(1265, 787); // a 1280px window at Extra large
  const room = 1265 - EDGE - (m.column.right + GAP);
  const at = placeInMargin(m);
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.shift, Math.round(MIN_WIDTH - room));
  assert.equal(at.over, false);
  assert.equal(at.left, 1265 - EDGE - MIN_WIDTH);
});

test("the answer holds once applied: measuring the moved column gives the same move", () => {
  const first = placeInMargin(centred(1265, 787));
  const again = placeInMargin(centred(1265, 787, first.shift));
  assert.deepEqual(again, first);
});

test("a window too narrow to move far enough: the panel lies over the line ends", () => {
  const m = centred(885, 787); // a 900px window at Extra large
  const at = placeInMargin(m);
  assert.equal(at.over, true);
  assert.equal(at.shift, Math.round(m.column.left), "the column moves as far as its own margin allows");
  assert.equal(at.width, MIN_WIDTH);
});

/* ── Height: down to EDGE above the window's bottom ─────────────────── */

test("at the top of the page the panel starts level with the text and reaches EDGE above the bottom", () => {
  // The rail starts 202px down (Romans 8's title) and runs far below.
  assert.equal(panelHeight({ top: 202, bottom: 5000 }, 860), 860 - EDGE - 202);
});

test("scrolled past the start, it pins EDGE from the top and fills the window less both gaps", () => {
  assert.equal(panelHeight({ top: -1500, bottom: 3000 }, 860), 860 - 2 * EDGE);
});

test("at the footer it ends with the rail, until it would get shorter than MIN_HEIGHT", () => {
  assert.equal(panelHeight({ top: -4000, bottom: 600 }, 860), 600 - EDGE);
  assert.equal(panelHeight({ top: -4000, bottom: 100 }, 860), MIN_HEIGHT);
});

test("a heading low on the screen still ends the panel EDGE above the bottom, short until scrolled", () => {
  // An article title 735px down an 860px window.
  assert.equal(panelHeight({ top: 735, bottom: 6000 }, 860), 860 - EDGE - 735);
  assert.equal(panelHeight({ top: 900, bottom: 6000 }, 860), 0, "below the window: nothing to show yet");
});

test("a rail ending on screen and shorter than MIN_HEIGHT caps the floor at its own height", () => {
  assert.equal(panelHeight({ top: 300, bottom: 400 }, 860), 100);
});

/* ── A narrow window: the floating notebook ─────────────────────────── */

test("floating: the column moves only as far as the collapsed tab needs", () => {
  const m = centred(885, 787); // a 900px window at Extra large: 49px a side
  const at = placeFloating(m);
  const need = m.column.right + TAB_GAP - (885 - TAB_EDGE - TAB_WIDTH);
  assert.equal(at.shift, Math.round(need));
  assert.equal(at.tabOver, false);
  assert.ok(m.column.right - at.shift + TAB_GAP <= at.tab.left, "the tab clears the moved text");
  assert.equal(at.tab.left + at.tab.width, 885 - TAB_EDGE);
});

test("floating: where the margin already holds the tab, nothing moves", () => {
  const at = placeFloating(centred(885, 622)); // default size: 131px a side
  assert.equal(at.shift, 0);
  assert.equal(at.tabOver, false);
});

test("floating: the expanded panel takes its narrowest width at the window's edge", () => {
  const at = placeFloating(centred(885, 622));
  assert.equal(at.panel.width, MIN_WIDTH);
  assert.equal(at.panel.left + at.panel.width, 885 - EDGE);
});

test("floating: the answer holds once applied", () => {
  const first = placeFloating(centred(885, 787));
  assert.deepEqual(placeFloating(centred(885, 787, first.shift)), first);
});

test("floating: a column with no room to move leaves the tab over the text, and says so", () => {
  const m = centred(800, 790);
  const at = placeFloating(m);
  assert.equal(at.tabOver, true);
  assert.equal(at.shift, Math.round(m.column.left));
});

test("the notebook collapses when it starts floating, unless the reader is opening it", () => {
  // A page opening with it remembered open, or a window narrowed under it.
  assert.equal(nextCollapsed({ floating: true, wasFloating: false, collapsed: false, opening: false }), true);
  // The reader pressing Notebook in a narrow window.
  assert.equal(nextCollapsed({ floating: true, wasFloating: false, collapsed: false, opening: true }), false);
  // Already floating: as the reader left it.
  assert.equal(nextCollapsed({ floating: true, wasFloating: true, collapsed: false, opening: false }), false);
  assert.equal(nextCollapsed({ floating: true, wasFloating: true, collapsed: true, opening: false }), true);
  // In the margin it is never collapsed.
  assert.equal(nextCollapsed({ floating: false, wasFloating: true, collapsed: true, opening: false }), false);
});

/* ── Widths the reader drags (Study View, the notebook open) ─────────── */

// Real numbers: a window of 1171 or 1280px, the column starting at the left
// edge of its containing box, 11.355px to a measure unit (one --ch at the
// column's size) and 32px of padding on the column's box.
const CH = 11.355;
const PAD = 32;
const TOL = 1e-6;

/** The column's box for a measure: measure x ch, plus its own padding. */
const columnBox = (measure) => measure * CH + PAD;

function withWidths(viewport, measure, width, parentLeft = 0) {
  return placeWithWidths({ viewport, parentLeft, ch: CH, pad: PAD, measure, width });
}

// placeWithWidths places from the values the page is given: the notebook's
// width in whole px and the measure to a tenth, so the column can sit up to
// half a px plus half a tenth of a character off the unrounded figure.
const ROUNDING = 0.5 + 0.05 * 11.355 + 1e-6;

function near(actual, expected, tolerance = TOL, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message ?? `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("the measure limits are 36 and 72", () => {
  assert.equal(MIN_MEASURE, 36);
  assert.equal(MAX_MEASURE, 72);
});

test("with room to spare, the notebook sits EDGE from the window's edge at the kept width and the column ends GAP before it", () => {
  const at = withWidths(1280, 52, 320);
  assert.equal(at.over, false);
  assert.equal(at.measure, 52);
  assert.equal(at.width, 320);
  assert.equal(at.panelLeft + at.width, 1280 - EDGE);
  assert.equal(at.columnRight, at.panelLeft - GAP);
  near(at.columnRight - at.columnLeft, columnBox(52), TOL, "the column's box is measure x ch plus its padding");
  assert.ok(at.columnLeft > 0, "what is left over is the notes' margin");
});

test("a 1171px window with the 48 measure and a 280px notebook reproduces today's layout", () => {
  const at = withWidths(1171, 48, MIN_WIDTH);
  assert.equal(at.over, false);
  assert.equal(at.panelLeft, 875);
  assert.equal(at.columnRight, 851);
  assert.equal(at.measure, 48);
  assert.equal(at.width, 280);
  near(at.columnLeft, 851 - columnBox(48));
});

test("the notes' margin is whatever is left: it shrinks first, while the measure and the notebook keep their widths", () => {
  // 48 and 380 need 957.04px between parentLeft and the window's edge, less
  // EDGE and GAP: the margin is gone at a 997.04px window.
  for (const viewport of [1400, 1200, 1100, 1000]) {
    const at = withWidths(viewport, 48, 380);
    assert.equal(at.over, false, `${viewport}px`);
    assert.equal(at.measure, 48, `${viewport}px`);
    assert.equal(at.width, 380, `${viewport}px`);
    near(at.columnLeft, viewport - EDGE - 380 - GAP - columnBox(48), TOL, `${viewport}px: columnLeft`);
    assert.ok(at.columnLeft >= 0, `${viewport}px: the column stays inside its containing box`);
  }
  // Each step in is paid for by the margin alone.
  const wide = withWidths(1200, 48, 380);
  const narrow = withWidths(1100, 48, 380);
  near(wide.columnLeft - narrow.columnLeft, 100);
  near(wide.panelLeft - narrow.panelLeft, 100);
});

test("with the notes' margin gone, the notebook narrows, and the column's left edge stays at parentLeft", () => {
  const a = withWidths(950, 48, 380);
  assert.equal(a.over, false);
  assert.equal(a.measure, 48, "the LIT keeps its measure while the notebook can still give");
  assert.equal(a.width, 333); // 380 less the 47.04 the window is short
  near(a.columnLeft, 0, ROUNDING);
  // The width is whole pixels but panelLeft is placed with the unrounded one,
  // so the panel's right edge is EDGE from the window's, to half a pixel.
  near(a.panelLeft + a.width, 950 - EDGE, 0.5);

  const b = withWidths(900, 48, 380);
  assert.equal(b.measure, 48);
  assert.equal(b.width, 283);
  near(b.columnLeft, 0, ROUNDING);

  // At 897.04px the notebook is exactly as narrow as it may be.
  const c = withWidths(897.04, 48, 380);
  assert.equal(c.measure, 48);
  assert.equal(c.width, MIN_WIDTH);
  near(c.columnLeft, 0, ROUNDING);
});

test("the notebook never narrows below MIN_WIDTH, however narrow the window", () => {
  for (const viewport of [890, 850, 800, 761]) {
    const at = withWidths(viewport, 48, 380);
    assert.equal(at.width, MIN_WIDTH, `${viewport}px`);
    assert.equal(at.panelLeft, viewport - EDGE - MIN_WIDTH, `${viewport}px`);
  }
});

test("once the notebook is at MIN_WIDTH, the LIT's measure narrows, and the column still ends GAP before the notebook", () => {
  const at = withWidths(800, 48, 380);
  assert.equal(at.over, false);
  assert.equal(at.width, MIN_WIDTH);
  // 960.04... less the 100px the notebook gave leaves 97.04px for the LIT:
  // 97.04 / 11.355 = 8.55 measure units.
  assert.equal(at.measure, 39.5);
  near(at.columnLeft, 0, ROUNDING);
  assert.equal(at.columnRight, at.panelLeft - GAP);

  // At 761px the LIT is just at its narrowest.
  const edge = withWidths(761, 48, 380);
  assert.equal(edge.over, false);
  assert.equal(edge.measure, MIN_MEASURE);
  assert.equal(edge.width, MIN_WIDTH);
});

test("the LIT never narrows below MIN_MEASURE, and past that the widths no longer fit", () => {
  const at = withWidths(740, 48, 380);
  assert.equal(at.over, true);
  assert.equal(at.measure, MIN_MEASURE);
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.panelLeft, 740 - EDGE - MIN_WIDTH);
  assert.ok(at.columnLeft < 0, "the column would have to start left of its containing box");

  const narrower = withWidths(600, 70, 440);
  assert.equal(narrower.over, true);
  assert.equal(narrower.measure, MIN_MEASURE);
  assert.equal(narrower.width, MIN_WIDTH);
});

test("a shortfall under half a pixel is not over", () => {
  // ch 10 and pad 30 keep the sums round: 36 x 10 + 30 + 280 = 670px, and
  // EDGE + GAP = 40, so a 710px window fits it exactly.
  const fits = (viewport) => placeWithWidths({
    viewport, parentLeft: 0, ch: 10, pad: 30, measure: MIN_MEASURE, width: MIN_WIDTH,
  });
  assert.equal(fits(710).over, false);
  assert.equal(fits(709.6).over, false, "0.4px short");
  assert.equal(fits(709.4).over, true, "0.6px short");
});

test("as the window narrows, things give way in order: margin, then notebook, then LIT, then over", () => {
  const kept = { measure: 48, width: 380 };
  let previous = null;
  for (let viewport = 1500; viewport >= 600; viewport -= 5) {
    const at = withWidths(viewport, kept.measure, kept.width);
    // Nothing is ever wider than what was kept, or narrower than its floor.
    assert.ok(at.measure <= kept.measure && at.measure >= MIN_MEASURE, `${viewport}px: measure`);
    assert.ok(at.width <= kept.width && at.width >= MIN_WIDTH, `${viewport}px: width`);
    // The LIT only narrows once the notebook has given all it can.
    if (at.measure < kept.measure) assert.equal(at.width, MIN_WIDTH, `${viewport}px: LIT narrowed early`);
    // The notebook only narrows once the notes' margin is gone.
    if (at.width < kept.width && !at.over) near(at.columnLeft, 0, ROUNDING, `${viewport}px: notebook narrowed early`);
    // The window only gives out once both are at their floors.
    if (at.over) {
      assert.equal(at.measure, MIN_MEASURE, `${viewport}px`);
      assert.equal(at.width, MIN_WIDTH, `${viewport}px`);
    }
    // And it only ever gets worse as the window narrows.
    if (previous) {
      assert.ok(at.measure <= previous.measure, `${viewport}px: measure`);
      assert.ok(at.width <= previous.width, `${viewport}px: width`);
      assert.ok(!previous.over || at.over, `${viewport}px: over comes back`);
    }
    previous = at;
  }
  assert.equal(previous.over, true, "a 600px window cannot hold them");
});

test("a wider window brings the reader's widths back, since nothing kept is changed", () => {
  const narrow = withWidths(800, 48, 380);
  assert.notEqual(narrow.measure, 48);
  const wide = withWidths(1400, 48, 380);
  assert.equal(wide.measure, 48);
  assert.equal(wide.width, 380);
});

test("parentLeft is the furthest left the column goes", () => {
  // The same 48 / 380 that leave a 0px margin in a 997.04px window leave 0px
  // of it in a 1037.04px window when the column's box starts 40px in.
  const at = withWidths(1037.04, 48, 380, 40);
  assert.equal(at.over, false);
  assert.equal(at.measure, 48);
  assert.equal(at.width, 380);
  near(at.columnLeft, 40, ROUNDING);
  // One pixel less and the notebook has to give it.
  const less = withWidths(1036.04, 48, 380, 40);
  assert.equal(less.measure, 48);
  assert.equal(less.width, 379);
  near(less.columnLeft, 40, ROUNDING);
});

test("a kept measure outside 36 to 72 is clamped", () => {
  const tooWide = withWidths(2600, 100, 320);
  assert.equal(tooWide.measure, MAX_MEASURE);
  near(tooWide.columnRight - tooWide.columnLeft, columnBox(MAX_MEASURE));

  const tooNarrow = withWidths(2600, 10, 320);
  assert.equal(tooNarrow.measure, MIN_MEASURE);
  near(tooNarrow.columnRight - tooNarrow.columnLeft, columnBox(MIN_MEASURE));

  // The limits themselves are allowed.
  assert.equal(withWidths(2600, 36, 320).measure, 36);
  assert.equal(withWidths(2600, 72, 320).measure, 72);
});

test("a kept width under MIN_WIDTH is clamped to it", () => {
  const at = withWidths(1280, 48, 100);
  assert.equal(at.width, MIN_WIDTH);
  assert.equal(at.panelLeft, 1280 - EDGE - MIN_WIDTH);
  assert.equal(at.columnRight, at.panelLeft - GAP);
});

test("widthsFromLayout: the notebook is made to reach the window's edge", () => {
  // The ordinary placement stops the panel at MAX_WIDTH beside the text; the
  // first drag starts from the width that reaches EDGE from the window's edge.
  assert.deepEqual(widthsFromLayout({ viewport: 1280, measure: 48, panelLeft: 840 }), { measure: 48, width: 424 });
  assert.deepEqual(widthsFromLayout({ viewport: 1171, measure: 48, panelLeft: 875 }), { measure: 48, width: 280 });
});

test("widthsFromLayout: the notebook is never under MIN_WIDTH", () => {
  // A floating notebook or a 220px-wide panel measures narrower than 280.
  assert.equal(widthsFromLayout({ viewport: 1000, measure: 48, panelLeft: 900 }).width, MIN_WIDTH);
  assert.equal(widthsFromLayout({ viewport: 1171, measure: 48, panelLeft: 1000 }).width, MIN_WIDTH);
});

test("widthsFromLayout: the measure is rounded to a tenth", () => {
  assert.equal(widthsFromLayout({ viewport: 1171, measure: 47.96, panelLeft: 875 }).measure, 48);
  assert.equal(widthsFromLayout({ viewport: 1171, measure: 47.94, panelLeft: 875 }).measure, 47.9);
  assert.equal(widthsFromLayout({ viewport: 1171, measure: 52.04, panelLeft: 875 }).measure, 52);
});

test("widthsFromLayout: the widths it gives place the panel where it was", () => {
  const kept = widthsFromLayout({ viewport: 1280, measure: 52, panelLeft: 900 });
  const at = withWidths(1280, kept.measure, kept.width);
  assert.equal(at.panelLeft, 900);
  assert.equal(at.width, kept.width);
});

test("dragTextEdge: dragging right narrows the LIT by dx / ch, and left widens it", () => {
  assert.equal(dragTextEdge({ measure: 48, dx: 0, ch: CH }), 48);
  assert.equal(dragTextEdge({ measure: 48, dx: CH, ch: CH }), 47);
  assert.equal(dragTextEdge({ measure: 48, dx: 5 * CH, ch: CH }), 43);
  assert.equal(dragTextEdge({ measure: 48, dx: -CH, ch: CH }), 49);
  assert.equal(dragTextEdge({ measure: 48, dx: -2 * CH, ch: CH }), 50);
});

test("dragTextEdge: the result is kept to a tenth", () => {
  // 20px is 1.761 measure units.
  assert.equal(dragTextEdge({ measure: 48, dx: 20, ch: CH }), 46.2);
  assert.equal(dragTextEdge({ measure: 48, dx: -20, ch: CH }), 49.8);
});

test("dragTextEdge: it stops at MIN_MEASURE however far it is dragged right", () => {
  assert.equal(dragTextEdge({ measure: 48, dx: 1000, ch: CH }), MIN_MEASURE);
  assert.equal(dragTextEdge({ measure: MIN_MEASURE, dx: 50, ch: CH }), MIN_MEASURE);
});

test("dragTextEdge: it stops at maxMeasure, the point where the notes' margin is gone", () => {
  assert.equal(dragTextEdge({ measure: 48, dx: -1000, ch: CH, maxMeasure: 60 }), 60);
  assert.equal(dragTextEdge({ measure: 48, dx: -2 * CH, ch: CH, maxMeasure: 60 }), 50, "short of the limit it follows the pointer");
  assert.equal(dragTextEdge({ measure: 60, dx: -50, ch: CH, maxMeasure: 60 }), 60);
});

test("dragTextEdge: it stops at MAX_MEASURE when maxMeasure is larger, or not given", () => {
  assert.equal(dragTextEdge({ measure: 48, dx: -1000, ch: CH, maxMeasure: 90 }), MAX_MEASURE);
  assert.equal(dragTextEdge({ measure: 48, dx: -1000, ch: CH }), MAX_MEASURE);
});

test("dragTextEdge: a maxMeasure under MIN_MEASURE still leaves the LIT at MIN_MEASURE", () => {
  assert.equal(dragTextEdge({ measure: 40, dx: -1000, ch: CH, maxMeasure: 30 }), MIN_MEASURE);
});

test("dragNotebookEdge: dragging right narrows the notebook and widens the LIT by the same px", () => {
  const d = 5 * CH; // 56.775px
  const at = dragNotebookEdge({ measure: 48, width: 380, dx: d, ch: CH });
  assert.equal(at.measure, 53);
  assert.equal(at.width, Math.round(380 - d));
  assert.equal(at.width, 323);
});

test("dragNotebookEdge: dragging left widens the notebook and narrows the LIT by the same px", () => {
  const at = dragNotebookEdge({ measure: 48, width: 380, dx: -3 * CH, ch: CH });
  assert.equal(at.measure, 45);
  assert.equal(at.width, Math.round(380 + 3 * CH));
});

test("dragNotebookEdge: the LIT's box and the notebook together keep their width, within rounding", () => {
  const before = columnBox(48) + 380;
  for (const dx of [-120, -57, -10, 0, 8, 33, 61, 99]) {
    const at = dragNotebookEdge({ measure: 48, width: 380, dx, ch: CH });
    const after = columnBox(at.measure) + at.width;
    // A tenth of a measure unit (1.1px) and half a pixel is all rounding can add.
    near(after, before, 1.1 + 0.5, `dx ${dx}: ${after} against ${before}`);
  }
});

test("dragNotebookEdge: the column's left edge stays put", () => {
  // The column ends GAP before the notebook, so if the box and the notebook
  // together are unchanged, so is the left edge.
  const viewport = 1280;
  const start = withWidths(viewport, 48, 380);
  const dragged = dragNotebookEdge({ measure: 48, width: 380, dx: 4 * CH, ch: CH });
  const after = withWidths(viewport, dragged.measure, dragged.width);
  near(after.columnLeft, start.columnLeft, 1.6);
});

test("dragNotebookEdge: the notebook stops at MIN_WIDTH", () => {
  const at = dragNotebookEdge({ measure: 48, width: 380, dx: 1000, ch: CH });
  assert.equal(at.width, MIN_WIDTH);
  near(at.measure, 48 + (380 - MIN_WIDTH) / CH, 0.05 + TOL);

  const already = dragNotebookEdge({ measure: 48, width: MIN_WIDTH, dx: 50, ch: CH });
  assert.deepEqual(already, { measure: 48, width: MIN_WIDTH });
});

test("dragNotebookEdge: the LIT stops at MAX_MEASURE", () => {
  const at = dragNotebookEdge({ measure: 70, width: 500, dx: 1000, ch: CH });
  assert.equal(at.measure, MAX_MEASURE);
  assert.equal(at.width, Math.round(500 - 2 * CH));
  assert.ok(at.width > MIN_WIDTH, "the notebook still has width to spare when the LIT is the limit");

  const already = dragNotebookEdge({ measure: MAX_MEASURE, width: 400, dx: 50, ch: CH });
  assert.deepEqual(already, { measure: MAX_MEASURE, width: 400 });
});

test("dragNotebookEdge: dragging left stops when the LIT reaches MIN_MEASURE", () => {
  const at = dragNotebookEdge({ measure: 48, width: 380, dx: -1000, ch: CH });
  assert.equal(at.measure, MIN_MEASURE);
  assert.equal(at.width, Math.round(380 + (48 - MIN_MEASURE) * CH));

  const already = dragNotebookEdge({ measure: MIN_MEASURE, width: 380, dx: -50, ch: CH });
  assert.deepEqual(already, { measure: MIN_MEASURE, width: 380 });
});

test("dragNotebookEdge: no drag changes nothing", () => {
  assert.deepEqual(dragNotebookEdge({ measure: 48, width: 380, dx: 0, ch: CH }), { measure: 48, width: 380 });
});

test("widestMeasure: it is the measure at which the column's left edge reaches parentLeft", () => {
  // (1000 - EDGE - GAP - 280 - 32) / 11.355 = 57.07
  const widest = widestMeasure({ viewport: 1000, parentLeft: 0, ch: CH, pad: PAD, width: 280 });
  assert.equal(widest, 57.1);
  const at = withWidths(1000, widest, 280);
  near(at.columnLeft, 0, ROUNDING, "the column starts at parentLeft, to the tenth the measure is kept to");
  assert.equal(at.measure, widest, "and the window holds it without anything giving way");
});

test("widestMeasure: it counts parentLeft and the notebook's width", () => {
  const base = widestMeasure({ viewport: 1000, parentLeft: 0, ch: CH, pad: PAD, width: 280 });
  const inset = widestMeasure({ viewport: 1000, parentLeft: 40, ch: CH, pad: PAD, width: 280 });
  const wider = widestMeasure({ viewport: 1000, parentLeft: 0, ch: CH, pad: PAD, width: 380 });
  near(base - inset, 40 / CH, 0.1 + TOL);
  near(base - wider, 100 / CH, 0.1 + TOL);
  // Fixing the answer for the inset case.
  const at = withWidths(1000, inset, 280, 40);
  near(at.columnLeft, 40, ROUNDING);
});

test("widestMeasure: it is capped at MAX_MEASURE", () => {
  // At 1171px with the 280px notebook it is 72.13.
  assert.equal(widestMeasure({ viewport: 1171, parentLeft: 0, ch: CH, pad: PAD, width: 280 }), MAX_MEASURE);
  assert.equal(widestMeasure({ viewport: 2400, parentLeft: 0, ch: CH, pad: PAD, width: 280 }), MAX_MEASURE);
});

test("widestMeasure: it is the most dragTextEdge lets the LIT widen to", () => {
  const maxMeasure = widestMeasure({ viewport: 1100, parentLeft: 0, ch: CH, pad: PAD, width: 320 });
  assert.ok(maxMeasure < MAX_MEASURE);
  assert.equal(dragTextEdge({ measure: 40, dx: -2000, ch: CH, maxMeasure }), maxMeasure);
});
