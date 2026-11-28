// Study's model of places, panes, and tabs (src/lib/desk-study.mjs; Featherboa Phase 9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { greekHref } from "../src/lib/greek-search.mjs";
import { greekWordHref } from "../src/lib/greek-detect.mjs";
import {
  HANDLE, MAX_KEPT, MAX_PANES, MIN_WIDTH, SIDE_WIDTH, STATE_KEY, KINDS, PLACES,
  arrive, checkState, closeTab, columnWidths, countFits, countsFor, dragLine, findTab, followedPassage, forgetPlace,
  freshState, getPlace, goTo, isFollowing, kindAllowed, largestFit, leadLit, lineBounds, lineIsDefault,
  migrateLayout, moveTab, moveTabTo, moveTargets, neededWidth, offerGroups, offers, openInScripture, openPlace,
  openThing, openingPlace, parseAddress, passageOf, paneNames, readState, resetLine, searchFromHeader, selectTab,
  setCount, setFollowing, setGreekWord, setLitAt, setPlacePassage, setTabMark, setTabScope, setWorking, tabHides,
  tabsOf, writeState,
} from "../src/lib/desk-study.mjs";

const SCRIPTURE = { kind: "scripture" };
const NOTEBOOK = { kind: "notebook" };
const TRASH = { kind: "trash" };
const sheet = (id) => ({ kind: "sheet", id });
const collection = (id) => ({ kind: "collection", id });

function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    Object.values(v).forEach(deepFreeze);
  }
  return v;
}
const kinds = (pane) => pane.tabs.map((t) => t.kind);
const roundTrip = (s) => readState(writeState(s));

// ---- what a place offers ---------------------------------------------------

test("each place offers its own set (What each place shows beside it)", () => {
  assert.deepEqual(offers("scripture"), ["lit", "greek", "footnotes", "verse", "mine", "search"]);
  assert.deepEqual(offers("notebook"), ["lit", "verse", "greek", "search"]);
  assert.deepEqual(offers("collection"), ["lit", "search", "mine"]);
  assert.deepEqual(offers("sheet"), ["lit", "search", "mine", "collection", "sheet"]);
  assert.deepEqual(offers("trash"), []);
  assert.deepEqual(offers("nowhere"), []);
  assert.ok(!kindAllowed("notebook", "mine"), "no Notes beside the Notebook");
  assert.ok(!kindAllowed("sheet", "greek"), "no Greek beside a sheet");
  assert.ok(!kindAllowed("collection", "footnotes"), "no Footnotes outside Scripture");
  for (const place of PLACES) for (const k of offers(place)) assert.ok(KINDS.includes(k));
  assert.deepEqual(offerGroups("scripture").map((g) => g.group), ["scripture", "yours", "search"]);
  assert.deepEqual(offerGroups("scripture")[0].kinds, ["lit", "greek", "footnotes", "verse"]);
  assert.deepEqual(offerGroups("trash"), []);
  assert.equal(offerGroups("notebook").length, 1);
});

test("the counts a place has, and the room each needs", () => {
  assert.equal(MAX_PANES, 3);
  assert.deepEqual(countsFor("scripture"), [1, 2, 3]);
  assert.deepEqual(countsFor("sheet"), [1, 2]);
  assert.deepEqual(countsFor("trash"), []);
  assert.equal(neededWidth(1), 280);
  assert.equal(neededWidth(3), 3 * 280 + 2 * HANDLE);
  assert.deepEqual(countFits("scripture", 700).map((c) => [c.count, c.fits, c.reason]), [[1, true, null], [2, true, null], [3, false, "wider"]]);
  assert.deepEqual(countFits("trash", 700), []);
  assert.equal(largestFit("scripture", 900), 3);
  assert.equal(largestFit("scripture", 100), 1);
  assert.equal(largestFit("notebook", 2000), 2);
  assert.deepEqual(paneNames(3), ["left", "middle", "right"]);
  assert.deepEqual(paneNames(2), ["left", "right"]);
});

// ---- opening states ----------------------------------------------------------

test("a new reader: Scripture with the LIT, and beside it Notes, Footnotes, This verse, and Greek", () => {
  const s = freshState();
  assert.deepEqual(s.open, SCRIPTURE);
  const p = s.scripture;
  assert.equal(p.count, 2);
  assert.deepEqual(p.panes.map(kinds), [["lit"], ["mine", "footnotes", "verse", "greek"]]);
  assert.equal(findTab(p, p.panes[1].open).tab.kind, "mine");
  assert.equal(p.lit, p.panes[0].tabs[0].id);
  assert.equal(p.working, 1);
  assert.ok(p.panes[1].tabs.every((t) => isFollowing(t)));
});

test("each place opens with its own tabs (Opens with)", () => {
  const nb = freshState().notebook;
  assert.equal(nb.count, 2);
  assert.deepEqual(kinds(nb.panes[0]), ["lit", "verse"]);
  assert.deepEqual(kinds(openingPlace("collection", "c1").panes[0]), ["lit", "search"]);
  assert.equal(openingPlace("collection", "c1").count, 2);
  const none = openingPlace("sheet", "s1", {});
  assert.equal(none.count, 1, "a sheet in no collection starts with one pane");
  assert.equal(none.panes[0].tabs.length, 0);
  const one = openingPlace("sheet", "s1", { memberOf: ["c1"] });
  assert.equal(one.count, 2);
  assert.deepEqual(kinds(one.panes[0]), ["collection", "lit", "search", "mine"]);
  assert.equal(one.panes[0].tabs[0].collection, "c1");
  assert.equal(findTab(one, one.panes[0].open).tab.kind, "collection");
  const trash = freshState().trash;
  assert.deepEqual(trash.panes, []);
  assert.equal(trash.working, null);
});

test("a sheet in several collections opens with the one the reader came from, else the last added", () => {
  const added = openingPlace("sheet", "s1", { memberOf: ["c1", "c2", "c3"] });
  assert.equal(added.panes[0].tabs[0].collection, "c3");
  const from = openingPlace("sheet", "s1", { memberOf: ["c1", "c2", "c3"], from: collection("c2") });
  assert.equal(from.panes[0].tabs[0].collection, "c2");
  const away = openingPlace("sheet", "s1", { memberOf: ["c1", "c2"], from: collection("c9") });
  assert.equal(away.panes[0].tabs[0].collection, "c2");
  const side = openingPlace("sheet", "s1", { memberOf: ["c1", "c2"], from: NOTEBOOK });
  assert.equal(side.panes[0].tabs[0].collection, "c2");
});

test("a sheet opens as the reader left it, except from its collection's place, which always brings that collection", () => {
  let s = openPlace(freshState(), sheet("s1"), { memberOf: ["c1", "c2"] });
  assert.deepEqual(s.open, sheet("s1"));
  s = setCount(s, sheet("s1"), 1);
  s = openPlace(s, SCRIPTURE);
  s = openPlace(s, sheet("s1"), { memberOf: ["c1", "c2"] });
  assert.equal(getPlace(s, sheet("s1")).count, 1, "from the sidebar, as the reader left it");
  s = openPlace(s, sheet("s1"), { memberOf: ["c1", "c2"], from: collection("c1") });
  const p = getPlace(s, sheet("s1"));
  assert.equal(p.count, 2);
  assert.equal(findTab(p, p.panes[0].open).tab.collection, "c1");
  assert.equal(p.panes[0].tabs.filter((t) => t.kind === "collection").length, 2, "its first collection's tab stays, the new one opens");
  s = openPlace(s, sheet("s1"), { memberOf: ["c1", "c2"], from: collection("c1") });
  assert.equal(getPlace(s, sheet("s1")).panes[0].tabs.filter((t) => t.kind === "collection").length, 2, "a second visit adds nothing");
});

test("places keep their own state, and Scripture keeps its panes while the reader is elsewhere (ST-26)", () => {
  let s = freshState();
  s = setCount(s, SCRIPTURE, 3);
  const before = getPlace(s, SCRIPTURE);
  s = openPlace(s, sheet("s1"));
  s = openThing(s, sheet("s1"), { kind: "search" });
  s = openPlace(s, NOTEBOOK);
  s = setCount(s, NOTEBOOK, 1);
  s = openPlace(s, SCRIPTURE);
  assert.deepEqual(getPlace(s, SCRIPTURE), before);
  assert.equal(getPlace(s, NOTEBOOK).count, 1);
  assert.equal(getPlace(s, sheet("s1")).count, 2);
  assert.equal(getPlace(s, sheet("nope")), null);
});

test("only the most recent sheets and collections keep a state", () => {
  let s = freshState();
  for (let i = 0; i < MAX_KEPT + 5; i++) s = openPlace(s, sheet(`s${i}`));
  assert.equal(s.sheets.length, MAX_KEPT);
  assert.equal(s.sheets[0].id, `s${MAX_KEPT + 4}`);
  assert.equal(getPlace(s, sheet("s0")), null);
  s = openPlace(s, sheet(`s${MAX_KEPT + 4 - 3}`));
  assert.equal(s.sheets[0].id, `s${MAX_KEPT + 1}`, "opening one again moves it to the front");
  assert.equal(s.sheets.length, MAX_KEPT);
  for (let i = 0; i < MAX_KEPT + 2; i++) s = openPlace(s, collection(`c${i}`));
  assert.equal(s.collections.length, MAX_KEPT);
  s = forgetPlace(s, collection(`c${MAX_KEPT + 1}`));
  assert.equal(s.collections.length, MAX_KEPT - 1);
  assert.deepEqual(s.open, SCRIPTURE, "forgetting the open place goes to Scripture");
  assert.equal(openPlace(s, sheet("bad id!")), s);
  assert.equal(openPlace(s, { kind: "elsewhere" }), s);
});

// ---- opening, moving, closing ---------------------------------------------------

test("opening brings an open tab forward, else adds to the working pane; nothing is replaced (SD-30)", () => {
  let s = freshState();
  const before = tabsOf(s.scripture).length;
  s = openThing(s, SCRIPTURE, { kind: "greek" });
  assert.equal(tabsOf(s.scripture).length, before, "Greek is open already: it comes forward");
  assert.equal(findTab(s.scripture, s.scripture.panes[1].open).tab.kind, "greek");
  s = openThing(s, SCRIPTURE, { kind: "search" });
  assert.equal(tabsOf(s.scripture).length, before + 1);
  assert.equal(s.scripture.panes[1].tabs.at(-1).kind, "search", "the working pane took it");
  const again = openThing(s, SCRIPTURE, { kind: "search" });
  assert.equal(tabsOf(again.scripture).length, before + 1);
  const second = openThing(s, SCRIPTURE, { kind: "search" }, { fresh: true });
  assert.equal(tabsOf(second.scripture).filter((t) => t.tab.kind === "search").length, 2, "two searches keep two questions open");
  const named = openThing(s, SCRIPTURE, { kind: "lit", at: "luke 3:8" }, { pane: 0 });
  assert.equal(named.scripture.panes[0].tabs.at(-1).at, "luke 3:8", "a target pane can be named");
  assert.equal(named.scripture.working, 1, "naming a pane doesn't move the working pane");
});

test("the same chapter opens once; another chapter is another LIT tab", () => {
  let s = freshState({ passage: "john 3:1" });
  s = openThing(s, SCRIPTURE, { kind: "lit", at: "john 3:16" });
  assert.equal(tabsOf(s.scripture).filter((t) => t.tab.kind === "lit").length, 1);
  assert.equal(leadLit(s.scripture).at, "john 3:16");
  assert.equal(s.scripture.at, "john 3:16");
  s = openThing(s, SCRIPTURE, { kind: "lit", at: "luke 3" });
  assert.equal(tabsOf(s.scripture).filter((t) => t.tab.kind === "lit").length, 2);
  assert.equal(leadLit(s.scripture).at, "luke 3", "a new LIT tab with a passage is the one followed");
  assert.equal(openThing(s, SCRIPTURE, { kind: "lit", at: "not a passage" }), s);
  assert.equal(openThing(s, SCRIPTURE, { kind: "lit", at: "john 99" }), s);
});

test("a place refuses what it doesn't show", () => {
  const s = freshState();
  assert.equal(openThing(s, NOTEBOOK, { kind: "mine" }), s);
  assert.equal(openThing(s, SCRIPTURE, { kind: "sheet", sheet: "s1" }), s);
  assert.equal(openThing(s, TRASH, { kind: "lit" }), s);
  assert.equal(openThing(s, SCRIPTURE, { kind: "bogus" }), s);
  assert.equal(openThing(s, SCRIPTURE, null), s);
  assert.equal(openThing(s, sheet("none"), { kind: "lit" }), s);
});

test("beside a sheet: a collection, another sheet, never itself; opening shows the second pane", () => {
  let s = openPlace(freshState(), sheet("s1"));
  assert.equal(getPlace(s, sheet("s1")).count, 1);
  assert.equal(openThing(s, sheet("s1"), { kind: "sheet", sheet: "s1" }), s);
  s = openThing(s, sheet("s1"), { kind: "sheet", sheet: "s2" });
  assert.equal(getPlace(s, sheet("s1")).count, 2, "with one pane it opens the second");
  assert.equal(tabsOf(getPlace(s, sheet("s1"))).length, 1);
  s = openThing(s, sheet("s1"), { kind: "collection", collection: "c1" });
  const again = openThing(s, sheet("s1"), { kind: "collection", collection: "c1" });
  assert.equal(tabsOf(getPlace(again, sheet("s1"))).length, 2);
  assert.equal(openThing(s, sheet("s1"), { kind: "sheet" }), s, "a sheet tab names its sheet");
});

test("opening in a hidden pane beside the Notebook shows it, with the tabs it kept", () => {
  let s = setCount(freshState(), NOTEBOOK, 1);
  s = openThing(s, NOTEBOOK, { kind: "greek" });
  const p = getPlace(s, NOTEBOOK);
  assert.equal(p.count, 2);
  assert.deepEqual(kinds(p.panes[0]), ["lit", "verse", "greek"]);
  assert.equal(p.panes[0].open, p.panes[0].tabs[2].id);
});

test("selecting a tab opens it, makes its pane the working one, and a LIT tab the one followed", () => {
  let s = freshState({ passage: "john 3:16" });
  s = openThing(s, SCRIPTURE, { kind: "lit", at: "luke 3" }, { pane: 1 });
  s = openThing(s, SCRIPTURE, { kind: "lit", at: "mark 1" }, { pane: 0 });
  const first = s.scripture.panes[0].tabs[0];
  s = selectTab(s, SCRIPTURE, first.id);
  assert.equal(s.scripture.working, 0);
  assert.equal(s.scripture.lit, first.id);
  assert.equal(s.scripture.at, "john 3:16");
  assert.equal(selectTab(s, SCRIPTURE, "t999"), s);
  assert.equal(setWorking(s, SCRIPTURE, 1).scripture.working, 1);
  assert.equal(setWorking(s, SCRIPTURE, 5), s);
  assert.equal(setWorking(s, TRASH, 0), s);
});

test("tabs move between panes, within one, and by name (SD-32)", () => {
  let s = freshState();
  const lit = s.scripture.panes[0].tabs[0].id;
  const greek = s.scripture.panes[1].tabs[3].id;
  s = moveTab(s, SCRIPTURE, greek, 0);
  assert.deepEqual(kinds(s.scripture.panes[0]), ["lit", "greek"]);
  assert.equal(s.scripture.panes[0].open, greek);
  assert.equal(s.scripture.working, 0);
  assert.deepEqual(kinds(s.scripture.panes[1]), ["mine", "footnotes", "verse"]);
  s = moveTab(s, SCRIPTURE, greek, 0, 0);
  assert.deepEqual(kinds(s.scripture.panes[0]), ["greek", "lit"], "to an index");
  s = moveTabTo(s, SCRIPTURE, lit, "right");
  assert.equal(s.scripture.panes[1].tabs.at(-1).id, lit);
  assert.deepEqual(moveTargets(s, SCRIPTURE, lit).map((t) => t.name), ["left"]);
  s = setCount(s, SCRIPTURE, 3);
  assert.deepEqual(moveTargets(s, SCRIPTURE, lit).map((t) => t.name), ["left", "right"]);
  s = moveTab(s, SCRIPTURE, lit, 0);
  assert.deepEqual(moveTargets(s, SCRIPTURE, lit).map((t) => t.name), ["middle", "right"]);
  const before = s;
  assert.equal(moveTabTo(s, SCRIPTURE, lit, "middle").scripture.panes[1].tabs.at(-1).id, lit);
  assert.equal(moveTabTo(setCount(s, SCRIPTURE, 1), SCRIPTURE, lit, "middle").scripture.panes.length, 1);
  assert.equal(moveTab(before, SCRIPTURE, lit, 9), before);
  assert.equal(moveTab(before, SCRIPTURE, "t999", 0), before);
  assert.deepEqual(moveTargets(freshState(), NOTEBOOK, "t1"), [], "one row of tabs beside the Notebook: nowhere to move");
});

test("closing opens the neighbor, and a pane with no tabs stays, empty", () => {
  let s = freshState();
  const [mine, foot, verse, greek] = s.scripture.panes[1].tabs.map((t) => t.id);
  s = closeTab(s, SCRIPTURE, mine);
  assert.equal(s.scripture.panes[1].open, foot, "the next tab opens");
  s = selectTab(s, SCRIPTURE, greek);
  s = closeTab(s, SCRIPTURE, greek);
  assert.equal(s.scripture.panes[1].open, verse, "else the previous");
  s = closeTab(closeTab(closeTab(s, SCRIPTURE, foot), SCRIPTURE, verse), SCRIPTURE, "nothing");
  assert.equal(s.scripture.panes[1].open, null);
  assert.equal(s.scripture.panes.length, 2, "the empty pane stays");
  const lit = s.scripture.panes[0].tabs[0].id;
  s = closeTab(s, SCRIPTURE, lit);
  assert.equal(s.scripture.lit, null);
  assert.equal(leadLit(s.scripture), null);
});

// ---- the count -------------------------------------------------------------------

test("changing the count keeps everything: down merges into the last pane, up opens empty (SD-33)", () => {
  let s = freshState();
  s = setCount(s, SCRIPTURE, 3);
  assert.equal(s.scripture.panes.length, 3);
  assert.deepEqual(s.scripture.panes[2], { tabs: [], open: null }, "a new pane opens empty");
  const verse = s.scripture.panes[1].tabs[2].id;
  s = moveTab(s, SCRIPTURE, verse, 2);
  s = setWorking(s, SCRIPTURE, 2);
  s = setCount(s, SCRIPTURE, 1);
  assert.equal(s.scripture.count, 1);
  assert.deepEqual(kinds(s.scripture.panes[0]), ["lit", "mine", "footnotes", "greek", "verse"], "tabs keep their order");
  assert.equal(s.scripture.working, 0);
  s = setCount(s, SCRIPTURE, 2);
  assert.deepEqual(s.scripture.panes[1], { tabs: [], open: null });
  // Going down keeps the last pane's open tab open.
  let t = setCount(freshState(), SCRIPTURE, 3);
  t = moveTab(t, SCRIPTURE, t.scripture.panes[1].tabs[0].id, 2);
  const open = t.scripture.panes[1].open;
  t = setCount(t, SCRIPTURE, 2);
  assert.equal(t.scripture.panes[1].open, open, "the last pane's own open tab stays open");
  assert.equal(t.scripture.panes[1].tabs.at(-1).kind, "mine", "the closed pane's tab joins it, after");
  assert.equal(setCount(t, SCRIPTURE, 4), t);
  assert.equal(setCount(t, SCRIPTURE, 2), t);
  assert.equal(setCount(t, TRASH, 2), t);
});

test("a count the window can't hold is refused when the room is given (SD-16, SD-17)", () => {
  const s = freshState();
  assert.equal(setCount(s, SCRIPTURE, 3, { available: 700 }), s);
  assert.equal(setCount(s, SCRIPTURE, 3, { available: neededWidth(3) }).scripture.count, 3);
  assert.equal(setCount(s, SCRIPTURE, 1, { available: 300 }).scripture.count, 1);
});

test("the Notebook, a sheet, and a collection are Panes 1 2, and the hidden pane keeps its tabs", () => {
  let s = freshState();
  assert.deepEqual(countsFor("notebook"), [1, 2]);
  assert.equal(setCount(s, NOTEBOOK, 3), s);
  s = setCount(s, NOTEBOOK, 1);
  const p = getPlace(s, NOTEBOOK);
  assert.equal(p.count, 1);
  assert.equal(p.panes.length, 1);
  assert.deepEqual(kinds(p.panes[0]), ["lit", "verse"]);
  assert.deepEqual(kinds(getPlace(setCount(s, NOTEBOOK, 2), NOTEBOOK).panes[0]), ["lit", "verse"]);
});

// ---- widths -----------------------------------------------------------------------

test("columns are whole pixels, none under the minimum, summing to the room", () => {
  const s = setCount(freshState(), SCRIPTURE, 3);
  const w = columnWidths(s, SCRIPTURE, 1000);
  assert.equal(w.length, 3);
  assert.equal(w.reduce((a, b) => a + b, 0) + 2 * HANDLE, 1000);
  assert.ok(w.every((x) => Number.isInteger(x) && x >= MIN_WIDTH));
  assert.deepEqual(columnWidths(s, SCRIPTURE, 700), [280, 280, 280], "the page scrolls where it can't hold them");
  assert.deepEqual(columnWidths(freshState(), TRASH, 900), [900]);
  assert.deepEqual(columnWidths(setCount(freshState(), SCRIPTURE, 1), SCRIPTURE, 900), [900]);
});

test("each count remembers its own widths: three to two and back returns the three-pane sizes (SD-36)", () => {
  let s = setCount(freshState(), SCRIPTURE, 3);
  s = dragLine(s, SCRIPTURE, 0, 120, 1200);
  const three = columnWidths(s, SCRIPTURE, 1200);
  assert.notDeepEqual(three, columnWidths(setCount(freshState(), SCRIPTURE, 3), SCRIPTURE, 1200));
  s = setCount(s, SCRIPTURE, 2);
  assert.deepEqual(columnWidths(s, SCRIPTURE, 1200).map((x) => x), [597, 597], "two panes are even until dragged");
  s = dragLine(s, SCRIPTURE, 0, -100, 1200);
  s = setCount(s, SCRIPTURE, 3);
  assert.deepEqual(columnWidths(s, SCRIPTURE, 1200), three);
  s = setCount(s, SCRIPTURE, 2);
  assert.deepEqual(columnWidths(s, SCRIPTURE, 1200), [497, 697]);
});

test("a dragged width keeps its share when the window changes", () => {
  let s = dragLine(freshState(), SCRIPTURE, 0, 200, 1000);
  const wide = columnWidths(s, SCRIPTURE, 1800);
  assert.ok(wide[0] / wide[1] > 1.4);
  const narrow = columnWidths(s, SCRIPTURE, 700);
  assert.ok(narrow.every((x) => x >= MIN_WIDTH));
  assert.equal(narrow[0] + narrow[1] + HANDLE, 700);
});

test("a line stops at the minimum, and its bounds say where", () => {
  const s = freshState();
  const b = lineBounds(s, SCRIPTURE, 0, 1000);
  assert.equal(b.min, MIN_WIDTH);
  assert.equal(b.max, 1000 - HANDLE - MIN_WIDTH);
  assert.equal(b.value, 497);
  const far = dragLine(s, SCRIPTURE, 0, 5000, 1000);
  assert.deepEqual(columnWidths(far, SCRIPTURE, 1000), [b.max, MIN_WIDTH]);
  const back = dragLine(s, SCRIPTURE, 0, -5000, 1000);
  assert.deepEqual(columnWidths(back, SCRIPTURE, 1000), [MIN_WIDTH, b.max]);
  assert.equal(lineBounds(s, SCRIPTURE, 1, 1000), null);
  assert.equal(lineBounds(s, SCRIPTURE, 0, 500), null);
  assert.equal(dragLine(s, SCRIPTURE, 0, 50, 500), s);
  assert.equal(dragLine(s, SCRIPTURE, 0, NaN, 1000), s);
  assert.equal(lineBounds(setCount(s, SCRIPTURE, 1), SCRIPTURE, 0, 1000), null);
});

test("a reset per line restores that line's default and leaves the others (E189)", () => {
  let s = setCount(freshState(), SCRIPTURE, 3);
  s = dragLine(s, SCRIPTURE, 0, 100, 1200);
  s = dragLine(s, SCRIPTURE, 1, -80, 1200);
  assert.ok(!lineIsDefault(s, SCRIPTURE, 0));
  const reset = resetLine(s, SCRIPTURE, 0);
  const w = columnWidths(reset, SCRIPTURE, 1200);
  assert.ok(Math.abs(w[0] - w[1]) <= 1);
  assert.ok(lineIsDefault(reset, SCRIPTURE, 0));
  assert.ok(!lineIsDefault(reset, SCRIPTURE, 1) || Math.abs(w[1] - w[2]) <= 1);
  assert.equal(resetLine(reset, SCRIPTURE, 0), reset, "nothing to reset");
  const fresh = freshState();
  assert.equal(resetLine(fresh, SCRIPTURE, 0), fresh, "an even line has nothing to reset");
});

test("beside a sheet the pane keeps its own width, 320px at first, and the sheet takes the rest", () => {
  let s = openPlace(freshState(), sheet("s1"), { memberOf: ["c1"] });
  assert.deepEqual(columnWidths(s, sheet("s1"), 1100), [1100 - HANDLE - SIDE_WIDTH, SIDE_WIDTH]);
  assert.deepEqual(columnWidths(s, sheet("s1"), 1800), [1800 - HANDLE - SIDE_WIDTH, SIDE_WIDTH], "the pane doesn't grow with the window");
  s = dragLine(s, sheet("s1"), 0, -100, 1100);
  assert.deepEqual(columnWidths(s, sheet("s1"), 1100)[1], 420);
  assert.ok(!lineIsDefault(s, sheet("s1"), 0));
  assert.equal(getPlace(s, sheet("s1")).side, 420);
  s = resetLine(s, sheet("s1"), 0);
  assert.equal(columnWidths(s, sheet("s1"), 1100)[1], SIDE_WIDTH);
  assert.equal("side" in getPlace(s, sheet("s1")), false);
  s = dragLine(s, sheet("s1"), 0, -5000, 700);
  assert.deepEqual(columnWidths(s, sheet("s1"), 700), [MIN_WIDTH, 700 - HANDLE - MIN_WIDTH], "the sheet's pane keeps its minimum too");
  assert.deepEqual(columnWidths(setCount(s, sheet("s1"), 1), sheet("s1"), 700), [700]);
});

test("the Notebook and a collection start half and half", () => {
  let s = openPlace(freshState(), collection("c1"));
  for (const ref of [NOTEBOOK, collection("c1")]) {
    const w = columnWidths(s, ref, 1000);
    assert.equal(w.length, 2);
    assert.ok(Math.abs(w[0] - w[1]) <= 1);
  }
  s = dragLine(s, NOTEBOOK, 0, 100, 1000);
  assert.ok(columnWidths(s, NOTEBOOK, 1000)[0] > columnWidths(s, NOTEBOOK, 1000)[1]);
  assert.equal(resetLine(s, NOTEBOOK, 0) !== s, true);
});

// ---- following ---------------------------------------------------------------------

test("followers follow the LIT tab the reader last moved in, unless pinned (SD-34)", () => {
  let s = freshState({ passage: "john 3:16" });
  const p0 = s.scripture;
  const notes = p0.panes[1].tabs[0];
  assert.equal(passageOf(p0, notes), "john 3:16");
  s = openThing(s, SCRIPTURE, { kind: "lit", at: "luke 3:8" }, { pane: 0 });
  assert.equal(passageOf(s.scripture, notes), "luke 3:8", "a new LIT tab is the one followed");
  const luke = leadLit(s.scripture).id;
  const john = s.scripture.panes[0].tabs[0].id;
  s = setFollowing(s, SCRIPTURE, notes.id, false);
  assert.deepEqual(findTab(s.scripture, notes.id).tab.pin, { at: "luke 3:8" }, "pinned to the passage it is on");
  assert.ok(!isFollowing(findTab(s.scripture, notes.id).tab));
  s = selectTab(s, SCRIPTURE, john);
  assert.equal(leadLit(s.scripture).id, john);
  assert.equal(passageOf(s.scripture, findTab(s.scripture, notes.id).tab), "luke 3:8", "unchanged: pinned");
  const verse = s.scripture.panes[1].tabs[2];
  assert.equal(passageOf(s.scripture, verse), "john 3:16", "the others follow");
  s = setLitAt(s, SCRIPTURE, john, "john 4:2");
  assert.equal(passageOf(s.scripture, verse), "john 4:2");
  assert.equal(followedPassage(s.scripture), "john 4:2");
  s = setFollowing(s, SCRIPTURE, notes.id, true);
  assert.equal(findTab(s.scripture, notes.id).tab.pin, undefined);
  assert.equal(passageOf(s.scripture, notes), "john 4:2");
  assert.equal(setFollowing(s, SCRIPTURE, notes.id, true), s, "already following");
  assert.equal(setFollowing(s, SCRIPTURE, luke, false), s, "a LIT tab doesn't follow");
  assert.equal(setFollowing(s, SCRIPTURE, "nope", false), s);
});

test("with no LIT tab the place's own passage is followed, set with the picker", () => {
  let s = freshState();
  s = closeTab(s, SCRIPTURE, s.scripture.panes[0].tabs[0].id);
  s = setPlacePassage(s, SCRIPTURE, "romans 8");
  assert.equal(followedPassage(s.scripture), "romans 8");
  assert.equal(passageOf(s.scripture, s.scripture.panes[1].tabs[0]), "romans 8");
  assert.equal(setPlacePassage(s, SCRIPTURE, "romans 8"), s);
  assert.equal(setPlacePassage(s, SCRIPTURE, "junk"), s);
  assert.equal(setLitAt(s, SCRIPTURE, s.scripture.panes[1].tabs[0].id, "romans 8:1"), s, "only a LIT tab is moved");
});

test("a LIT tab's marks (E108), Notes' scope, and the Greek's word stay with their tab", () => {
  let s = freshState();
  const lit = s.scripture.panes[0].tabs[0].id;
  s = setTabMark(s, SCRIPTURE, lit, "fn", false);
  s = setTabMark(s, SCRIPTURE, lit, "terms", false);
  assert.deepEqual(tabHides(findTab(s.scripture, lit).tab), ["fn", "terms"]);
  assert.equal(setTabMark(s, SCRIPTURE, lit, "fn", false), s);
  assert.equal(setTabMark(s, SCRIPTURE, lit, "bogus", false), s);
  s = setTabMark(setTabMark(s, SCRIPTURE, lit, "fn", true), SCRIPTURE, lit, "terms", true);
  assert.equal("hide" in findTab(s.scripture, lit).tab, false);
  const notes = s.scripture.panes[1].tabs[0].id;
  assert.equal(setTabMark(s, SCRIPTURE, notes, "fn", false), s);
  s = setTabScope(s, SCRIPTURE, notes, "chapter");
  assert.equal(findTab(s.scripture, notes).tab.scope, "chapter");
  assert.equal("scope" in findTab(setTabScope(s, SCRIPTURE, notes, "everything").scripture, notes).tab, false);
  const greek = s.scripture.panes[1].tabs[3].id;
  s = setGreekWord(s, SCRIPTURE, greek, { verse: 16, t: 7 });
  assert.deepEqual(findTab(s.scripture, greek).tab.word, { verse: 16, t: 7 });
  assert.equal(setGreekWord(s, SCRIPTURE, greek, { verse: 0, t: 1 }), s);
  assert.equal("word" in findTab(setGreekWord(s, SCRIPTURE, greek, null).scripture, greek).tab, false);
  assert.deepEqual(roundTrip(s), s);
});

// ---- search, Open in Scripture, going to a passage ----------------------------------

test("the header's search: Scripture, the Notebook, a sheet, a collection, the Trash (SE rules)", () => {
  let s = searchFromHeader(freshState());
  assert.equal(tabsOf(s.scripture).filter((t) => t.tab.kind === "search").length, 1);
  assert.equal(s.scripture.panes[1].tabs.at(-1).kind, "search", "in the working pane");
  assert.equal(searchFromHeader(s).scripture.panes[1].tabs.length, s.scripture.panes[1].tabs.length, "brings it forward");
  s = openPlace(s, NOTEBOOK);
  s = setCount(s, NOTEBOOK, 1);
  s = searchFromHeader(s);
  const nb = getPlace(s, NOTEBOOK);
  assert.equal(nb.count, 2, "makes the second pane");
  assert.equal(findTab(nb, nb.panes[0].open).tab.kind, "search");
  s = openPlace(s, sheet("s1"));
  s = searchFromHeader(s);
  assert.equal(getPlace(s, sheet("s1")).count, 2);
  assert.deepEqual(s.open, sheet("s1"));
  s = openPlace(s, TRASH);
  s = searchFromHeader(s);
  assert.deepEqual(s.open, SCRIPTURE, "from the Trash, Search opens in Scripture");
});

test("Open in Scripture opens the thing there", () => {
  let s = openPlace(freshState(), collection("c1"));
  s = openInScripture(s, { kind: "footnotes" });
  assert.deepEqual(s.open, SCRIPTURE);
  s = openInScripture(s, { kind: "lit", at: "mark 4" });
  assert.equal(leadLit(s.scripture).at, "mark 4");
});

test("going to a passage moves the LIT tab beside the Notebook, or opens one and the second pane (Notebook rule)", () => {
  let s = goTo(freshState(), NOTEBOOK, "luke 3:8");
  const nb = getPlace(s, NOTEBOOK);
  assert.equal(nb.panes[0].tabs[0].at, "luke 3:8");
  assert.equal(nb.at, "luke 3:8");
  s = openPlace(s, sheet("s1"));
  s = goTo(s, sheet("s1"), "luke 3:8");
  const p = getPlace(s, sheet("s1"));
  assert.equal(p.count, 2);
  assert.equal(leadLit(p).at, "luke 3:8");
  assert.equal(goTo(s, SCRIPTURE, "junk"), s);
  assert.equal(goTo(s, TRASH, "luke 3"), s);
});

// ---- addresses and arrival -----------------------------------------------------------

test("an address names a place and an arrival", () => {
  assert.deepEqual(parseAddress("/desk", "?place=romans-8"), { place: SCRIPTURE, at: "romans 8", greek: null, list: null });
  assert.deepEqual(parseAddress("/desk/", "?place=john-3:16&greek=16.7"), { place: SCRIPTURE, at: "john 3:16", greek: { verse: 16, t: 7 }, list: null });
  assert.equal(parseAddress("/desk", "?greek=16.7").greek, null, "a word needs a passage");
  assert.deepEqual(parseAddress("/study", "?place=romans-8", { studyPath: "/study" }).place, SCRIPTURE);
  assert.equal(parseAddress("/desk", "", { studyPath: "/study" }).place, null, "the rename is one argument");
  assert.deepEqual(parseAddress("/desk", "?place=romans-8&layout=reading").at, "romans 8", "an old Reading link opens the passage");
  assert.deepEqual(parseAddress("/notebook", "").place, NOTEBOOK);
  assert.deepEqual(parseAddress("/sheets/", "?id=abc-123").place, sheet("abc-123"));
  assert.deepEqual(parseAddress("/sheets", ""), { place: null, at: null, greek: null, list: "sheets" });
  assert.deepEqual(parseAddress("/collections", "?id=c_9").place, collection("c_9"));
  assert.equal(parseAddress("/collections", "").list, "collections");
  assert.deepEqual(parseAddress("/sheets", "?id=<script>").list, "sheets");
  assert.equal(parseAddress("/desk", "?sheet=s1").place.id, "s1");
  assert.equal(parseAddress("/desk", "?collection=c1").place.kind, "collection");
  assert.deepEqual(parseAddress("/about", "?place=john-3"), { place: null, at: null, greek: null, list: null });
  assert.equal(parseAddress(undefined, undefined).place, null);
});

test("a Greek word's link (greekHref, greekWordHref) is an address parseAddress reads", () => {
  const word = { book: "john", chapter: 3, verse: 16, t: 7 };
  assert.equal(greekWordHref(word), greekHref(word), "the light builder and greekHref are one address");
  const url = new URL(greekHref(word), "https://x.test");
  assert.equal(url.pathname, "/desk/");
  assert.deepEqual(parseAddress(url.pathname, url.search), { place: SCRIPTURE, at: "john 3:16", greek: { verse: 16, t: 7 }, list: null });
  // The word's verse is its own, whatever verse the place names (desk-page.js).
  assert.deepEqual(parseAddress("/desk", "?place=1john-4:8&greek=10.2").greek, { verse: 10, t: 2 });
  for (const search of ["?place=john-3", "?place=john-3&greek=16", "?place=john-3&greek=x.7", "?place=genesis-1&greek=1.1", "?place=john-3&greek="]) {
    assert.equal(parseAddress("/desk", search).greek, null, search);
  }
});

test("arrival at a passage moves the LIT tab, or opens one; the places keep their own", () => {
  let s = arrive(freshState(), parseAddress("/desk", "?place=romans-8"));
  assert.equal(leadLit(s.scripture).at, "romans 8");
  assert.equal(s.scripture.at, "romans 8");
  assert.equal(tabsOf(s.scripture).filter((t) => t.tab.kind === "lit").length, 1);
  s = arrive(s, parseAddress("/notebook", "?place=luke-3"));
  assert.deepEqual(s.open, NOTEBOOK);
  assert.equal(leadLit(getPlace(s, NOTEBOOK)).at, "luke 3");
  assert.equal(leadLit(s.scripture).at, "romans 8", "Scripture is as it was");
  s = arrive(s, parseAddress("/sheets", "?id=s1"), { memberOf: ["c1"] });
  assert.deepEqual(s.open, sheet("s1"));
  s = arrive(s, parseAddress("/collections", "?id=c1"));
  assert.deepEqual(s.open, collection("c1"));
  assert.equal(arrive(s, parseAddress("/sheets", "")), s, "an address that names no place changes nothing");
  assert.equal(arrive(s, null), s);
});

test("arrival at a Greek word: the verse, and the Greek tab at the word", () => {
  let s = arrive(freshState(), parseAddress("/desk", "?place=john-3:16&greek=16.7"));
  assert.equal(passageOf(s.scripture, s.scripture.panes[1].tabs[3]), "john 3:16");
  const greek = s.scripture.panes[1].tabs[3];
  assert.deepEqual(greek.word, { verse: 16, t: 7 });
  assert.equal(s.scripture.panes[1].open, greek.id);
  assert.equal(tabsOf(s.scripture).filter((t) => t.tab.kind === "greek").length, 1);
  // Pinned Greek tabs stay; a following one is added.
  let p = setFollowing(freshState(), SCRIPTURE, freshState().scripture.panes[1].tabs[3].id, false);
  p = arrive(p, parseAddress("/desk", "?place=john-3:16&greek=2.1"));
  assert.equal(tabsOf(p.scripture).filter((t) => t.tab.kind === "greek").length, 2);
  // The Notebook holds the Greek; a sheet does not.
  const nb = arrive(freshState(), parseAddress("/notebook", "?place=john-3:16&greek=16.7"));
  assert.deepEqual(tabsOf(getPlace(nb, NOTEBOOK)).find((t) => t.tab.kind === "greek").tab.word, { verse: 16, t: 7 });
  const sh = arrive(freshState(), { place: sheet("s1"), at: "john 3:16", greek: { verse: 16, t: 7 } });
  assert.equal(tabsOf(getPlace(sh, sheet("s1"))).some((t) => t.tab.kind === "greek"), false);
});

// ---- the saved state --------------------------------------------------------------------

test("the key is the old layout's, named in /privacy", () => {
  assert.equal(STATE_KEY, "lit-desk-layout");
});

test("junk reads as a new reader's state, and never throws", () => {
  const fresh = freshState();
  for (const junk of [null, undefined, "", "   ", "null", "[]", "42", '"x"', "{", "{}", '{"v":2}', '{"v":1}', '{"last":null}', "[1,2]", true, 7, {}, [], { v: 2, open: {} }]) {
    assert.deepEqual(readState(junk), fresh, String(JSON.stringify(junk)));
  }
});

test("a state survives a save and a read unchanged", () => {
  let s = freshState({ passage: "john 3:16" });
  s = setCount(s, SCRIPTURE, 3);
  s = openThing(s, SCRIPTURE, { kind: "search" }, { pane: 2 });
  s = dragLine(s, SCRIPTURE, 0, 90, 1300);
  s = openPlace(s, sheet("s1"), { memberOf: ["c1"] });
  s = dragLine(s, sheet("s1"), 0, -40, 1300);
  s = openPlace(s, collection("c1"));
  s = openPlace(s, TRASH);
  assert.deepEqual(roundTrip(s), s);
  assert.deepEqual(JSON.parse(writeState(s)), JSON.parse(JSON.stringify(s)));
  assert.equal(typeof writeState(s), "string");
  assert.deepEqual(readState(JSON.parse(writeState(s))), s);
});

test("a saved state is repaired: counts, widths, kinds, repeats, and ids", () => {
  const good = freshState();
  const bad = JSON.parse(JSON.stringify(good));
  bad.scripture.panes.push(...Array.from({ length: 5 }, () => ({ tabs: [{ id: "t50", kind: "search" }], open: "t50" })));
  bad.scripture.working = 99;
  bad.scripture.widths = { 2: [0, 1], 3: [1, 1, 1], 9: [1] };
  bad.scripture.lit = "t999";
  bad.notebook.panes[0].tabs.push({ id: "t30", kind: "mine" }, { id: "x", kind: "lit" }, { id: "t31", kind: "sheet", sheet: "s" }, null, 4);
  bad.notebook.count = 7;
  bad.sheets = [{ id: "s1", panes: [{ tabs: [{ id: "t1", kind: "greek" }, { id: "t2", kind: "sheet", sheet: "s1" }, { id: "t3", kind: "sheet", sheet: "s2" }], open: "t9" }], count: 2, side: 5 }, { id: "bad id" }, { id: "s1" }];
  bad.open = { kind: "sheet", id: "gone" };
  const fixed = checkState(bad);
  assert.equal(fixed.scripture.panes.length, 3);
  assert.equal(fixed.scripture.count, 3);
  assert.equal(fixed.scripture.working, 0);
  assert.equal(fixed.scripture.lit, null, "a lead that isn't a LIT tab is dropped");
  assert.equal(fixed.scripture.panes[2].tabs.length, 1, "repeated ids are dropped");
  assert.deepEqual(fixed.scripture.widths, {}, "even widths and bad ones are not kept");
  assert.deepEqual(kinds(fixed.notebook.panes[0]), ["lit", "verse"], "the Notebook shows no Notes, and ids must be well formed");
  assert.equal(fixed.notebook.count, 2);
  assert.equal(fixed.sheets.length, 1);
  assert.deepEqual(kinds(fixed.sheets[0].panes[0]), ["sheet"], "Greek is not beside a sheet, nor a sheet beside itself");
  assert.equal(fixed.sheets[0].panes[0].open, fixed.sheets[0].panes[0].tabs[0].id);
  assert.equal(fixed.sheets[0].side, MIN_WIDTH);
  assert.deepEqual(fixed.open, SCRIPTURE);
  assert.deepEqual(checkState(fixed), fixed, "repair is idempotent");
  assert.deepEqual(checkState(null), freshState());
  assert.deepEqual(checkState({ scripture: { panes: [] } }), freshState());
});

// ---- migrating today's layouts (SD-63, RP-41 to RP-43, SD-62) ---------------------------------

const leaf = (id, kind, more = {}) => ({ pane: { id, kind, pin: null, ...more } });
const cols = (...children) => ({ split: "columns", children });
const rows = (...children) => ({ split: "rows", children });
const saved = (layout) => JSON.stringify({ v: 1, start: "last", last: layout, mine: null });
const shape = (s) => s.scripture.panes.map((p) => p.tabs.map((t) => t.kind));

const OLD = [
  {
    name: "the original: the LIT beside My Notes",
    old: { root: { split: "columns", sizes: [0.6, 0.4], children: [leaf("p1", "lit", { at: "john 3:16" }), leaf("p2", "mine")] }, active: "p1", place: "john 3:16" },
    expect: { panes: [["lit"], ["mine"]], at: "john 3:16", widths: { 2: [0.6, 0.4] }, working: 0 },
  },
  {
    name: "three columns with sizes",
    old: { root: { split: "columns", sizes: [0.5, 0.25, 0.25], children: [leaf("p1", "lit"), leaf("p2", "greek"), leaf("p3", "verse")] }, active: "p1" },
    expect: { panes: [["lit"], ["greek"], ["verse"]], widths: { 3: [0.5, 0.25, 0.25] } },
  },
  {
    name: "rows flatten in reading order, top to bottom",
    old: { root: rows(leaf("p1", "lit"), leaf("p2", "verse")), active: "p1" },
    expect: { panes: [["lit"], ["verse"]], widths: {} },
  },
  {
    name: "one beside two stacked reads left to right, then down",
    old: { root: cols(leaf("p1", "lit"), rows(leaf("p2", "greek"), leaf("p3", "footnotes"))), active: "p1" },
    expect: { panes: [["lit"], ["greek"], ["footnotes"]], widths: {} },
  },
  {
    name: "four panes: the fourth's tab joins the third",
    old: { root: cols(leaf("p1", "lit"), leaf("p2", "mine"), leaf("p3", "verse"), leaf("p4", "greek")), active: "p1" },
    expect: { panes: [["lit"], ["mine"], ["verse", "greek"]], widths: {} },
  },
  {
    name: "a two by two grid",
    old: { root: cols(rows(leaf("p1", "lit"), leaf("p2", "mine")), rows(leaf("p3", "verse"), leaf("p4", "search"))), active: "p3" },
    expect: { panes: [["lit"], ["mine"], ["verse", "search"]] },
  },
  {
    name: "retired kinds: kept is Notes, intro is This verse (with its pin)",
    old: { root: cols(leaf("p1", "lit"), leaf("p2", "kept"), { pane: { id: "p3", kind: "intro", pin: { at: "romans 8" } } }), active: "p1" },
    expect: { panes: [["lit"], ["mine"], ["verse"]], pin: { pane: 2, at: "romans 8" } },
  },
  {
    name: "pins and a LIT pane's own place stay with their tabs",
    old: { root: cols(leaf("p1", "lit", { at: "luke 3:8" }), { pane: { id: "p2", kind: "greek", pin: { at: "mark 1:1" } } }, leaf("p3", "lit", { at: "acts 2" })), active: "p3", place: "acts 2" },
    expect: { panes: [["lit"], ["greek"], ["lit"]], pin: { pane: 1, at: "mark 1:1" }, at: "acts 2", lead: 2, working: 2, litAt: ["luke 3:8", undefined, "acts 2"] },
  },
  {
    name: "E108's per-pane marks and a Notes pane's scope",
    old: { root: cols(leaf("p1", "lit", { hide: ["fn", "terms", "bogus"] }), leaf("p2", "mine", { scope: "chapter" })), active: "p1" },
    expect: { panes: [["lit"], ["mine"]], hide: ["fn", "terms"], scope: "chapter" },
  },
  {
    name: "the Reading layout on: the marks it turned off stay off",
    old: { root: leaf("p1", "lit", { hide: ["vn", "fn", "terms", "highlights"], readingHid: ["vn", "fn"] }), active: "p1", reading: true },
    expect: { panes: [["lit"]], hide: ["vn", "fn", "terms", "highlights"] },
  },
  {
    name: "the Reading layout with only readingHid",
    old: { root: leaf("p1", "lit", { readingHid: ["fn", "highlights"] }), active: "p1", reading: true },
    expect: { panes: [["lit"]], hide: ["fn", "highlights"] },
  },
  {
    name: "an old Reading layout with no marks listed had all four off",
    old: { root: leaf("p1", "lit"), active: "p1", reading: true },
    expect: { panes: [["lit"]], hide: ["vn", "fn", "terms", "highlights"] },
  },
  {
    name: "readingHid without reading turns nothing off",
    old: { root: leaf("p1", "lit", { readingHid: ["fn"] }), active: "p1" },
    expect: { panes: [["lit"]], hide: undefined },
  },
  {
    name: "sheet and collection panes are dropped, with their panes",
    old: { root: cols(leaf("p1", "lit"), leaf("p2", "sheet", { sheet: "s1" }), leaf("p3", "collection", { collection: "c1" })), active: "p1" },
    expect: { panes: [["lit"]], widths: {} },
  },
  {
    name: "a layout of nothing but sheets is a new reader's",
    old: { root: leaf("p1", "sheet", { sheet: "s1" }), active: "p1" },
    expect: { fresh: true },
  },
  {
    name: "unknown kinds are dropped",
    old: { root: cols(leaf("p1", "lit"), leaf("p2", "timeline")), active: "p1" },
    expect: { panes: [["lit"]] },
  },
  {
    name: "a layout with no active pane, and a place that isn't one",
    old: { root: cols(leaf("p1", "mine"), leaf("p2", "lit", { at: "romans 8" })), active: "gone", place: "narnia 3" },
    expect: { panes: [["mine"], ["lit"]], lead: 1, working: 1, at: "romans 8" },
  },
];

for (const row of OLD) {
  test(`migration: ${row.name}`, () => {
    for (const text of [saved(row.old), JSON.stringify(row.old)]) {
      const s = readState(text);
      const e = row.expect;
      if (e.fresh) {
        assert.deepEqual(s, freshState());
        continue;
      }
      assert.deepEqual(shape(s), e.panes);
      const p = s.scripture;
      assert.equal(p.count, e.panes.length);
      assert.ok(p.count <= MAX_PANES);
      if ("at" in e) assert.equal(p.at, e.at);
      if ("working" in e) assert.equal(p.working, e.working);
      if (e.lead !== undefined) assert.equal(p.lit, p.panes[e.lead].tabs[0].id, "the active LIT is the one followed");
      if (e.widths) assert.deepEqual(p.widths, Object.fromEntries(Object.entries(e.widths).map(([k, v]) => [k, v.map((x) => x)])));
      if (e.pin) assert.deepEqual(p.panes[e.pin.pane].tabs[0].pin, { at: e.pin.at });
      if ("hide" in e) assert.deepEqual(p.panes[0].tabs[0].hide, e.hide);
      if (e.scope) assert.equal(p.panes[1].tabs[0].scope, e.scope);
      if (e.litAt) assert.deepEqual(p.panes.map((pane) => pane.tabs[0].at), e.litAt);
      assert.deepEqual(roundTrip(s), s, "the migrated state saves and reads back unchanged");
      assert.deepEqual(s.open, SCRIPTURE);
      assert.deepEqual(s.notebook, freshState().notebook);
    }
  });
}

test("migration: the active LIT tab is the one followed", () => {
  const s = readState(JSON.stringify({ root: cols(leaf("p1", "lit", { at: "luke 3:8" }), leaf("p2", "lit", { at: "acts 2" })), active: "p2", place: "acts 2" }));
  assert.equal(s.scripture.lit, s.scripture.panes[1].tabs[0].id);
  assert.equal(s.scripture.working, 1);
});

test("migration: \"My default\" is dropped, and the last layout is read", () => {
  const last = { root: cols(leaf("p1", "lit"), leaf("p2", "greek")), active: "p1" };
  const mine = { root: cols(leaf("p1", "lit"), leaf("p2", "mine"), leaf("p3", "verse")), active: "p1" };
  const s = readState(JSON.stringify({ v: 1, start: "default", last, mine }));
  assert.deepEqual(shape(s), [["lit"], ["greek"]]);
  assert.deepEqual(readState(JSON.stringify({ v: 1, start: "default", last: null, mine })), freshState(), "a default alone is not read");
});

test("migration: junk inside a layout never throws", () => {
  const cases = [
    { root: null }, { root: {} }, { root: { split: "columns" } }, { root: { split: "columns", children: [null, 4] } },
    { root: { pane: null } }, { root: { pane: { id: 4, kind: 7 } } }, { root: cols(leaf("p1", "lit", { at: 5, hide: "fn", pin: "x" })) },
    { v: 1, last: { root: [] } }, { v: 1, last: 7 },
  ];
  for (const c of cases) {
    const s = readState(JSON.stringify(c));
    assert.deepEqual(checkState(s), s);
  }
  assert.deepEqual(migrateLayout({ root: null }), null);
  assert.deepEqual(migrateLayout(null), null);
  let deep = leaf("p1", "lit");
  for (let i = 0; i < 20; i++) deep = cols(deep, leaf(`p${i + 2}`, "mine"));
  assert.doesNotThrow(() => readState(JSON.stringify({ root: deep })));
});

test("migration needs no other state: a v1 key with new places in it is read as the new state", () => {
  const s = setCount(freshState(), SCRIPTURE, 3);
  assert.deepEqual(readState(writeState(s)), s);
});

// ---- invariants over generated sequences ---------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkInvariants(s, label) {
  assert.equal(s.v, 2, label);
  assert.ok(PLACES.includes(s.open.kind), label);
  assert.ok(s.sheets.length <= MAX_KEPT && s.collections.length <= MAX_KEPT, label);
  assert.equal(new Set(s.sheets.map((e) => e.id)).size, s.sheets.length, label);
  const open = getPlace(s, s.open);
  assert.ok(open, `${label}: the open place exists`);
  const places = [["scripture", SCRIPTURE], ["notebook", NOTEBOOK], ["trash", TRASH], ...s.sheets.map((e) => ["sheet", sheet(e.id)]), ...s.collections.map((e) => ["collection", collection(e.id)])];
  for (const [kind, ref] of places) {
    const p = getPlace(s, ref);
    const where = `${label}: ${kind}`;
    if (kind === "trash") {
      assert.deepEqual(p.panes, [], where);
      assert.equal(p.working, null, where);
      continue;
    }
    assert.ok(countsFor(kind).includes(p.count), `${where}: count ${p.count}`);
    assert.equal(p.panes.length, kind === "scripture" ? p.count : 1, where);
    assert.ok(Number.isInteger(p.working) && p.working >= 0 && p.working < p.panes.length, `${where}: exactly one working pane`);
    const ids = tabsOf(p).map((t) => t.tab.id);
    assert.equal(new Set(ids).size, ids.length, `${where}: no tab in two panes`);
    for (const { tab } of tabsOf(p)) {
      assert.ok(kindAllowed(kind, tab.kind), `${where}: ${tab.kind} allowed`);
      if (kind === "sheet") assert.notEqual(tab.sheet, ref.id, where);
    }
    for (const pane of p.panes) assert.ok(pane.open === null ? pane.tabs.length === 0 : pane.tabs.some((t) => t.id === pane.open), `${where}: open tab is in its pane`);
    assert.ok(p.lit === null || findTab(p, p.lit)?.tab.kind === "lit", `${where}: lead is a LIT tab`);
    for (const [n, w] of Object.entries(p.widths)) {
      assert.equal(w.length, Number(n), where);
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-6, `${where}: widths sum to 1`);
      assert.ok(w.every((x) => x > 0), where);
    }
    for (const room of [neededWidth(p.count), 1000, 1531, 3000]) {
      const cols = columnWidths(s, ref, room);
      assert.ok(cols.every((x) => Number.isInteger(x) && x >= MIN_WIDTH), `${where}: none under its minimum at ${room}`);
      assert.equal(cols.reduce((a, b) => a + b, 0) + HANDLE * (cols.length - 1), room, `${where}: widths fill ${room}`);
    }
    assert.ok(p.seq > Math.max(0, ...ids.map((i) => Number(i.slice(1)))), `${where}: seq is ahead of every id`);
  }
  assert.deepEqual(readState(writeState(s)), s, `${label}: survives a save and a read`);
}

test("invariants hold over generated sequences of operations", () => {
  const sheetIds = ["s1", "s2", "s3"];
  const collIds = ["c1", "c2"];
  const passages = ["john 3:16", "luke 3", "romans 8:28", "mark 1:1", "acts 2"];
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed);
    const pick = (a) => a[Math.floor(r() * a.length)];
    let s = deepFreeze(seed % 5 === 0 ? freshState({ passage: "john 3:16" }) : freshState());
    const log = [];
    for (let step = 0; step < 70; step++) {
      const refs = [SCRIPTURE, NOTEBOOK, TRASH, ...sheetIds.map(sheet), ...collIds.map(collection)];
      const ref = r() < 0.7 ? s.open : pick(refs);
      const p = getPlace(s, ref);
      const tab = p && tabsOf(p).length ? pick(tabsOf(p)).tab.id : "t1";
      const room = pick([500, 700, 900, 1200, 1600]);
      const ops = [
        () => openThing(s, ref, { kind: pick(KINDS), at: r() < 0.5 ? pick(passages) : undefined, sheet: pick(sheetIds), collection: pick(collIds) }, { pane: r() < 0.3 ? Math.floor(r() * 3) : null, fresh: r() < 0.2 }),
        () => moveTab(s, ref, tab, Math.floor(r() * 4), r() < 0.5 ? Math.floor(r() * 5) : undefined),
        () => moveTabTo(s, ref, tab, pick(["left", "middle", "right", "top"])),
        () => closeTab(s, ref, tab),
        () => selectTab(s, ref, tab),
        () => setWorking(s, ref, Math.floor(r() * 4)),
        () => setCount(s, ref, 1 + Math.floor(r() * 4), r() < 0.5 ? { available: room } : {}),
        () => dragLine(s, ref, Math.floor(r() * 3), Math.round((r() - 0.5) * 800), room),
        () => resetLine(s, ref, Math.floor(r() * 3)),
        () => setFollowing(s, ref, tab, r() < 0.5),
        () => setLitAt(s, ref, tab, pick(passages)),
        () => setPlacePassage(s, ref, pick(passages)),
        () => setTabMark(s, ref, tab, pick(["vn", "fn", "terms", "highlights", "x"]), r() < 0.5),
        () => goTo(s, ref, pick(passages)),
        () => openPlace(s, pick(refs), { memberOf: r() < 0.5 ? [...collIds] : [], from: r() < 0.5 ? collection(pick(collIds)) : null }),
        () => searchFromHeader(s),
        () => openInScripture(s, { kind: pick(["lit", "greek", "footnotes", "search"]), at: pick(passages) }),
        () => arrive(s, parseAddress("/desk", `?place=${pick(["john-3:16", "luke-3", "romans-8:28"])}${r() < 0.4 ? "&greek=3.4" : ""}`), {}),
        () => forgetPlace(s, pick(refs)),
        () => setGreekWord(s, ref, tab, { verse: 1 + Math.floor(r() * 5), t: 1 + Math.floor(r() * 9) }),
      ];
      const i = Math.floor(r() * ops.length);
      log.push(i);
      s = deepFreeze(ops[i]());
      checkInvariants(s, `seed ${seed} step ${step} op ${i} (${log.join(",")})`);
    }
  }
});

test("no function changes what it is given", () => {
  const s = deepFreeze(openPlace(setCount(freshState(), SCRIPTURE, 3), sheet("s1"), { memberOf: ["c1"] }));
  const copy = JSON.stringify(s);
  const t = s.sheets[0].panes[0].tabs[0].id;
  // A frozen state throws on any write; these must all complete.
  openThing(s, sheet("s1"), { kind: "search" });
  moveTab(s, sheet("s1"), t, 0, 0);
  closeTab(s, sheet("s1"), t);
  setCount(s, SCRIPTURE, 1);
  dragLine(s, SCRIPTURE, 0, 100, 1200);
  resetLine(s, SCRIPTURE, 0);
  setFollowing(s, SCRIPTURE, s.scripture.panes[1].tabs[0].id, false);
  openPlace(s, collection("c1"));
  searchFromHeader(s);
  arrive(s, parseAddress("/desk", "?place=john-3:16&greek=16.7"));
  writeState(s);
  checkState(s);
  assert.equal(JSON.stringify(s), copy);
});
