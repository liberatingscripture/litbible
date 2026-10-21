// test/desk-present.test.js
//
// Present mode (STUDY-DESK.md, S6, M2, M3; "Order of work", 3j): the pure module
// src/lib/desk-present.mjs. Covers the sheet's screens and their names, the
// codes on the start screen, how a blank looks before its reveal, the state of
// the room (checking it, stepping it, comparing it), the reveal's reach into key
// terms and footnotes, the keys, type fitting, and the messages two windows send
// each other.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGE_VERSION,
  ROOM_CODES_MAX,
  SHOWN_TYPES,
  blankCover,
  channelName,
  checkState,
  clockWords,
  firstWords,
  fitSize,
  footnotesInPlay,
  hiddenTermsNote,
  initialState,
  makeMessage,
  presentKey,
  presentMessage,
  presentScreens,
  revealedWords,
  roomCodes,
  sameState,
  screenCount,
  screenFootnotes,
  screenTitle,
  stepState,
} from "../src/lib/desk-present.mjs";

const passage = (id, bookKey, chapter, verse, endVerse, extra = {}) => ({
  id,
  type: "passage",
  bookKey,
  chapter,
  verse,
  endVerse,
  ...extra,
});

/* ── Constants ───────────────────────────────────────────────────────── */

test("constants: shown types, code cap and message version", () => {
  assert.deepEqual([...SHOWN_TYPES], ["passage", "text", "question", "keyTerms"]);
  assert.equal(ROOM_CODES_MAX, 4);
  assert.equal(MESSAGE_VERSION, 1);
});

/* ── presentScreens ──────────────────────────────────────────────────── */

test("presentScreens: the start screen is always first, even for an empty or missing sheet", () => {
  for (const sheet of [{ modules: [] }, {}, null, undefined]) {
    const screens = presentScreens(sheet);
    assert.equal(screens.length, 1);
    assert.deepEqual(screens[0], { kind: "start", module: null, notes: [] });
  }
});

test("presentScreens: passage, text, question and keyTerms each get one screen, in the sheet's order", () => {
  const mods = [
    { id: "a", type: "text", html: "<p>Hi</p>" },
    passage("b", "romans", 8, 1, 4),
    { id: "c", type: "question", html: "<p>Why?</p>" },
    { id: "d", type: "keyTerms" },
  ];
  const screens = presentScreens({ modules: mods });
  assert.deepEqual(
    screens.map((s) => s.kind),
    ["start", "text", "passage", "question", "keyTerms"],
  );
  assert.equal(screens[1].module, mods[0]);
  assert.equal(screens[2].module, mods[1]);
  assert.deepEqual(screens[2].notes, []);
});

test("presentScreens: a space and a page break get no screen", () => {
  const screens = presentScreens({
    modules: [{ type: "space" }, { type: "text", html: "x" }, { type: "pageBreak" }],
  });
  assert.deepEqual(
    screens.map((s) => s.kind),
    ["start", "text"],
  );
});

test("presentScreens: unknown types and null modules are skipped", () => {
  const screens = presentScreens({
    modules: [null, { type: "video" }, undefined, { type: "text", html: "x" }, { type: "video", leaderOnly: true }],
  });
  assert.deepEqual(
    screens.map((s) => s.kind),
    ["start", "text"],
  );
  assert.deepEqual(screens[1].notes, [], "an unknown leader-only type is not a note either");
});

test("presentScreens: a leader-only module attaches to the screen before it as notes", () => {
  const note1 = { id: "n1", type: "text", html: "<p>Say this</p>", leaderOnly: true };
  const note2 = { id: "n2", type: "question", html: "<p>Ask this</p>", leaderOnly: true };
  const screens = presentScreens({
    modules: [passage("p", "romans", 8, 1, 4), note1, note2, { id: "t", type: "text", html: "x" }],
  });
  assert.deepEqual(
    screens.map((s) => s.kind),
    ["start", "passage", "text"],
  );
  assert.deepEqual(screens[1].notes, [note1, note2]);
  assert.deepEqual(screens[2].notes, []);
});

test("presentScreens: a leader-only module with nothing before it goes with the start screen", () => {
  const note = { id: "n", type: "text", html: "<p>Welcome</p>", leaderOnly: true };
  const screens = presentScreens({ modules: [note, { id: "t", type: "text", html: "x" }] });
  assert.equal(screens.length, 2);
  assert.deepEqual(screens[0].notes, [note]);
});

test("presentScreens: a leader-only space or page break still becomes a note, never a screen", () => {
  const space = { type: "space", leaderOnly: true };
  const screens = presentScreens({ modules: [{ type: "text", html: "x" }, space] });
  assert.equal(screens.length, 2);
  assert.deepEqual(screens[1].notes, [space]);
});

/* ── firstWords and screenTitle ──────────────────────────────────────── */

test("firstWords: up to eight words, with an ellipsis when cut", () => {
  assert.equal(firstWords("<p>one two three</p>"), "one two three");
  assert.equal(firstWords("one two three four five six seven eight"), "one two three four five six seven eight");
  assert.equal(firstWords("one two three four five six seven eight nine"), "one two three four five six seven eight…");
  assert.equal(firstWords("one two three four five", 3), "one two three…");
});

test("firstWords: tags, entities and runs of whitespace are cleaned; nothing gives an empty string", () => {
  assert.equal(firstWords("<p>Fish &amp; <em>chips</em></p><p>for  all</p>"), "Fish & chips for all");
  assert.equal(firstWords(""), "");
  assert.equal(firstWords("<p> </p>"), "");
  assert.equal(firstWords(null), "");
  assert.equal(firstWords(undefined), "");
});

test("screenTitle: the start screen is the sheet's name, or 'Untitled sheet' without one", () => {
  const start = { kind: "start", module: null, notes: [] };
  assert.equal(screenTitle(start, { title: "  Romans night  " }), "Romans night");
  assert.equal(screenTitle(start, { title: "" }), "Untitled sheet");
  assert.equal(screenTitle(start, { title: "   " }), "Untitled sheet");
  assert.equal(screenTitle(start, {}), "Untitled sheet");
  assert.equal(screenTitle(start, null), "Untitled sheet");
});

test("screenTitle: a passage is its reference, with an en dash for a range", () => {
  const sc = (m) => ({ kind: "passage", module: m, notes: [] });
  assert.equal(screenTitle(sc(passage("a", "romans", 8, 1, 4)), {}), "Romans 8:1–4");
  assert.equal(screenTitle(sc(passage("a", "romans", 8, 1, 1)), {}), "Romans 8:1");
  assert.equal(screenTitle(sc({ id: "a", type: "passage", bookKey: "john", chapter: 3, verse: 16 }), {}), "John 3:16");
});

test("screenTitle: a question is 'Question: ' and its first words, or just 'Question'", () => {
  assert.equal(
    screenTitle({ kind: "question", module: { html: "<p>What does it mean?</p>" } }, {}),
    "Question: What does it mean?",
  );
  assert.equal(screenTitle({ kind: "question", module: { html: "" } }, {}), "Question");
  assert.equal(screenTitle({ kind: "question", module: {} }, {}), "Question");
});

test("screenTitle: a text is its first words, or 'Text'", () => {
  assert.equal(screenTitle({ kind: "text", module: { html: "<p>A short reading</p>" } }, {}), "A short reading");
  assert.equal(screenTitle({ kind: "text", module: { html: "<p> </p>" } }, {}), "Text");
  assert.equal(
    screenTitle({ kind: "text", module: { html: "one two three four five six seven eight nine ten" } }, {}),
    "one two three four five six seven eight…",
  );
});

test("screenTitle: key terms, and an unknown or missing screen", () => {
  assert.equal(screenTitle({ kind: "keyTerms", module: {} }, {}), "Key terms");
  assert.equal(screenTitle({ kind: "other" }, {}), "");
  assert.equal(screenTitle(null, {}), "");
  assert.equal(screenTitle(undefined, {}), "");
});

/* ── roomCodes ───────────────────────────────────────────────────────── */

test("roomCodes: one code per chapter, in the order the sheet first quotes it", () => {
  const sheet = {
    modules: [
      passage("a", "romans", 8, 1, 4),
      passage("b", "john", 3, 16, 16),
      passage("c", "romans", 8, 28, 30),
      passage("d", "romans", 9, 1, 3),
    ],
  };
  const { codes, more } = roomCodes(sheet);
  assert.deepEqual(
    codes.map((c) => c.key),
    ["romans-8", "john-3", "romans-9"],
  );
  assert.deepEqual(more, []);
  assert.equal(codes[0].url, "https://litbible.net/romans-8/#v1-4");
  assert.equal(codes[0].moduleId, "a");
});

test("roomCodes: a leader-only passage's chapter is not counted (it is not in the participant copy)", () => {
  const sheet = {
    modules: [passage("a", "romans", 8, 1, 4), passage("b", "john", 3, 16, 16, { leaderOnly: true })],
  };
  const { codes } = roomCodes(sheet);
  assert.deepEqual(
    codes.map((c) => c.key),
    ["romans-8"],
  );
});

test("roomCodes: capped at ROOM_CODES_MAX with the rest in `more`", () => {
  const mods = [];
  for (let ch = 1; ch <= 6; ch++) mods.push(passage(`p${ch}`, "romans", ch, 1, 2));
  const { codes, more } = roomCodes({ modules: mods });
  assert.equal(codes.length, ROOM_CODES_MAX);
  assert.deepEqual(
    codes.map((c) => c.chapter),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    more.map((c) => c.chapter),
    [5, 6],
  );
});

test("roomCodes: a different cap, and a sheet with no passages", () => {
  const mods = [passage("a", "romans", 1, 1, 1), passage("b", "romans", 2, 1, 1), passage("c", "romans", 3, 1, 1)];
  const two = roomCodes({ modules: mods }, 2);
  assert.equal(two.codes.length, 2);
  assert.equal(two.more.length, 1);
  assert.deepEqual(roomCodes({ modules: [{ type: "text", html: "x" }] }), { codes: [], more: [] });
  assert.deepEqual(roomCodes(null), { codes: [], more: [] });
});

/* ── blankCover ──────────────────────────────────────────────────────── */

test("blankCover: the traditional hint with a term shows the traditional word, lowercased", () => {
  assert.deepEqual(blankCover({ hint: "traditional" }, { traditional: "Hell" }), { kind: "word", text: "hell" });
});

test("blankCover: the traditional word loses its [2] disambiguator", () => {
  assert.deepEqual(blankCover({ hint: "traditional" }, { traditional: "Good [2]" }), { kind: "word", text: "good" });
  assert.deepEqual(blankCover({ hint: "traditional" }, { traditional: "Good[12]" }), { kind: "word", text: "good" });
});

test("blankCover: the traditional hint with no term (or an empty one) falls back to a line", () => {
  assert.deepEqual(blankCover({ hint: "traditional" }, null), { kind: "line", hint: null });
  assert.deepEqual(blankCover({ hint: "traditional" }, undefined), { kind: "line", hint: null });
  assert.deepEqual(blankCover({ hint: "traditional" }, {}), { kind: "line", hint: null });
  assert.deepEqual(blankCover({ hint: "traditional" }, { traditional: "" }), { kind: "line", hint: null });
});

test("blankCover: a custom hint is a line with the trimmed hint text; empty is null", () => {
  assert.deepEqual(blankCover({ hint: "custom", hintText: "  a word for rescue  " }, null), {
    kind: "line",
    hint: "a word for rescue",
  });
  assert.deepEqual(blankCover({ hint: "custom", hintText: "   " }, null), { kind: "line", hint: null });
  assert.deepEqual(blankCover({ hint: "custom", hintText: "" }, null), { kind: "line", hint: null });
  assert.deepEqual(blankCover({ hint: "custom" }, { traditional: "Hell" }), { kind: "line", hint: null });
});

test("blankCover: a custom hint ignores the term; 'none' and a missing blank give a bare line", () => {
  assert.deepEqual(blankCover({ hint: "custom", hintText: "x" }, { traditional: "Hell" }), { kind: "line", hint: "x" });
  assert.deepEqual(blankCover({ hint: "none", hintText: "ignored" }, { traditional: "Hell" }), { kind: "line", hint: null });
  assert.deepEqual(blankCover({}, null), { kind: "line", hint: null });
  assert.deepEqual(blankCover(null, null), { kind: "line", hint: null });
});

/* ── initialState and checkState ─────────────────────────────────────── */

test("initialState: the start screen, nothing revealed, no footnotes up", () => {
  assert.deepEqual(initialState(), { screen: 0, revealed: {}, notes: {} });
  assert.notEqual(initialState(), initialState(), "a fresh object each time");
});

const SHAPE = { kinds: ["start", "passage", "text", "passage"], blanks: [0, 3, 0, 2] };

test("checkState: a good state passes through", () => {
  const state = { screen: 3, revealed: { 1: 2, 3: 1 }, notes: { 1: true } };
  assert.deepEqual(checkState(state, SHAPE), state);
});

test("checkState: the screen is clamped into range", () => {
  assert.equal(checkState({ screen: 99 }, SHAPE).screen, 3);
  assert.equal(checkState({ screen: -5 }, SHAPE).screen, 0);
  assert.equal(checkState({ screen: "2" }, SHAPE).screen, 2);
});

test("checkState: a screen that is not an integer goes to the start", () => {
  assert.equal(checkState({ screen: 1.5 }, SHAPE).screen, 0);
  assert.equal(checkState({ screen: "abc" }, SHAPE).screen, 0);
  assert.equal(checkState({ screen: NaN }, SHAPE).screen, 0);
  assert.equal(checkState({}, SHAPE).screen, 0);
});

test("checkState: a reveal count beyond the screen's blanks is cut to the number of blanks", () => {
  assert.deepEqual(checkState({ screen: 1, revealed: { 1: 10, 3: 5 } }, SHAPE).revealed, { 1: 3, 3: 2 });
});

test("checkState: reveal counts on bad indices, on screens with no blanks, and bad counts are dropped", () => {
  const revealed = { 0: 2, 2: 1, 7: 1, "-1": 1, x: 1, 1.5: 1, 3: 0 };
  assert.deepEqual(checkState({ screen: 0, revealed }, SHAPE).revealed, {});
  assert.deepEqual(checkState({ screen: 0, revealed: { 1: -2 } }, SHAPE).revealed, {});
  assert.deepEqual(checkState({ screen: 0, revealed: { 1: 1.5 } }, SHAPE).revealed, {});
  assert.deepEqual(checkState({ screen: 0, revealed: { 1: "2" } }, SHAPE).revealed, {});
});

test("checkState: footnotes are kept only on passage screens and only when exactly true", () => {
  const notes = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: false };
  assert.deepEqual(checkState({ screen: 0, notes }, SHAPE).notes, { 1: true, 3: true });
  assert.deepEqual(checkState({ screen: 0, notes: { 1: 1, 3: "true", 2: false } }, SHAPE).notes, {});
  assert.deepEqual(checkState({ screen: 0, notes: { 1: false } }, SHAPE).notes, {});
});

test("checkState: garbage input gives the initial state", () => {
  for (const bad of [null, undefined, "x", 5, true]) {
    assert.deepEqual(checkState(bad, SHAPE), initialState());
  }
});

test("checkState: a sheet with no screens gives the initial state whatever arrives", () => {
  assert.deepEqual(checkState({ screen: 4, revealed: { 0: 1 } }, { kinds: [], blanks: [] }), initialState());
});

test("checkState: missing revealed and notes are fine", () => {
  assert.deepEqual(checkState({ screen: 2 }, SHAPE), { screen: 2, revealed: {}, notes: {} });
  assert.deepEqual(checkState({ screen: 2, revealed: null, notes: null }, SHAPE), { screen: 2, revealed: {}, notes: {} });
});

test("checkState: does not change the state it is given", () => {
  const state = { screen: 99, revealed: { 1: 10 }, notes: { 0: true } };
  const copy = JSON.parse(JSON.stringify(state));
  checkState(state, SHAPE);
  assert.deepEqual(state, copy);
});

/* ── stepState ───────────────────────────────────────────────────────── */

const at = (screen, extra = {}) => ({ screen, revealed: {}, notes: {}, ...extra });

test("stepState: next and prev move one screen", () => {
  assert.equal(stepState(at(1), { type: "next" }, SHAPE).screen, 2);
  assert.equal(stepState(at(2), { type: "prev" }, SHAPE).screen, 1);
});

test("stepState: next at the last screen and prev at the first return the SAME object", () => {
  const last = at(3);
  const first = at(0);
  assert.equal(stepState(last, { type: "next" }, SHAPE), last);
  assert.equal(stepState(first, { type: "prev" }, SHAPE), first);
});

test("stepState: first and last jump, and return the same object when already there", () => {
  assert.equal(stepState(at(2), { type: "first" }, SHAPE).screen, 0);
  assert.equal(stepState(at(1), { type: "last" }, SHAPE).screen, 3);
  const first = at(0);
  const last = at(3);
  assert.equal(stepState(first, { type: "first" }, SHAPE), first);
  assert.equal(stepState(last, { type: "last" }, SHAPE), last);
});

test("stepState: go clamps at both ends and returns the same object for the current screen", () => {
  assert.equal(stepState(at(0), { type: "go", to: 2 }, SHAPE).screen, 2);
  assert.equal(stepState(at(0), { type: "go", to: 99 }, SHAPE).screen, 3);
  assert.equal(stepState(at(2), { type: "go", to: -4 }, SHAPE).screen, 0);
  const s = at(2);
  assert.equal(stepState(s, { type: "go", to: 2 }, SHAPE), s);
  assert.equal(stepState(s, { type: "go", to: 99 }, SHAPE).screen, 3);
});

test("stepState: go without an integer target does nothing", () => {
  const s = at(1);
  assert.equal(stepState(s, { type: "go" }, SHAPE), s);
  assert.equal(stepState(s, { type: "go", to: 2.5 }, SHAPE), s);
  assert.equal(stepState(s, { type: "go", to: "2" }, SHAPE), s);
});

test("stepState: moving keeps the reveal and the footnotes, and does not change the old state", () => {
  const s = at(1, { revealed: { 1: 2 }, notes: { 1: true } });
  const moved = stepState(s, { type: "next" }, SHAPE);
  assert.deepEqual(moved.revealed, { 1: 2 });
  assert.deepEqual(moved.notes, { 1: true });
  assert.equal(s.screen, 1);
});

test("stepState: reveal shows the next blank, one at a time, and stops at the blank count", () => {
  let s = at(1);
  s = stepState(s, { type: "reveal" }, SHAPE);
  assert.deepEqual(s.revealed, { 1: 1 });
  s = stepState(s, { type: "reveal" }, SHAPE);
  s = stepState(s, { type: "reveal" }, SHAPE);
  assert.deepEqual(s.revealed, { 1: 3 });
  const full = s;
  assert.equal(stepState(full, { type: "reveal" }, SHAPE), full, "past the last blank nothing changes");
});

test("stepState: reveal on a screen with no blanks returns the same object", () => {
  const s = at(2);
  assert.equal(stepState(s, { type: "reveal" }, SHAPE), s);
  const start = at(0);
  assert.equal(stepState(start, { type: "reveal" }, SHAPE), start);
});

test("stepState: hide covers the last blank again, and deletes the key at 1", () => {
  const s = at(1, { revealed: { 1: 3, 3: 1 } });
  const once = stepState(s, { type: "hide" }, SHAPE);
  assert.deepEqual(once.revealed, { 1: 2, 3: 1 });
  const twice = stepState(once, { type: "hide" }, SHAPE);
  const thrice = stepState(twice, { type: "hide" }, SHAPE);
  assert.deepEqual(thrice.revealed, { 3: 1 });
  assert.equal("1" in thrice.revealed, false);
  assert.deepEqual(s.revealed, { 1: 3, 3: 1 }, "the old state is untouched");
});

test("stepState: hide with nothing revealed returns the same object", () => {
  const s = at(1);
  assert.equal(stepState(s, { type: "hide" }, SHAPE), s);
});

test("stepState: notes toggles on a passage screen", () => {
  const up = stepState(at(1), { type: "notes" }, SHAPE);
  assert.deepEqual(up.notes, { 1: true });
  const down = stepState(up, { type: "notes" }, SHAPE);
  assert.deepEqual(down.notes, {});
  assert.equal("1" in down.notes, false);
});

test("stepState: notes does nothing on a screen that is not a passage", () => {
  for (const i of [0, 2]) {
    const s = at(i);
    assert.equal(stepState(s, { type: "notes" }, SHAPE), s);
  }
});

test("stepState: an unknown or missing action returns the same object", () => {
  const s = at(1);
  assert.equal(stepState(s, { type: "explode" }, SHAPE), s);
  assert.equal(stepState(s, null, SHAPE), s);
  assert.equal(stepState(s, undefined, SHAPE), s);
});

/* ── sameState ───────────────────────────────────────────────────────── */

test("sameState: the same object, and two equal copies, are alike", () => {
  const a = { screen: 1, revealed: { 1: 2 }, notes: { 1: true } };
  assert.equal(sameState(a, a), true);
  assert.equal(sameState(a, { screen: 1, revealed: { 1: 2 }, notes: { 1: true } }), true);
  assert.equal(sameState(initialState(), initialState()), true);
});

test("sameState: a different screen, reveal or footnotes are not alike", () => {
  const a = { screen: 1, revealed: { 1: 2 }, notes: { 1: true } };
  assert.equal(sameState(a, { ...a, screen: 2 }), false);
  assert.equal(sameState(a, { ...a, revealed: { 1: 3 } }), false);
  assert.equal(sameState(a, { ...a, revealed: { 1: 2, 3: 1 } }), false);
  assert.equal(sameState(a, { ...a, revealed: {} }), false);
  assert.equal(sameState(a, { ...a, notes: {} }), false);
  assert.equal(sameState(a, { ...a, notes: { 3: true } }), false);
});

test("sameState: a missing state is not like a real one; missing maps count as empty", () => {
  assert.equal(sameState(null, initialState()), false);
  assert.equal(sameState(initialState(), undefined), false);
  assert.equal(sameState({ screen: 0 }, initialState()), true);
});

/* ── revealedWords ───────────────────────────────────────────────────── */

test("revealedWords: the first n words of each screen, gathered across the presentation", () => {
  const words = [[], ["flesh", "spirit", "life"], [], ["peace", "death"]];
  const out = revealedWords(words, { 1: 2, 3: 1 });
  assert.deepEqual([...out].sort(), ["flesh", "peace", "spirit"]);
  assert.ok(out instanceof Set);
});

test("revealedWords: nothing revealed, a count past the list, and missing input", () => {
  const words = [["a", "b"], ["c"]];
  assert.equal(revealedWords(words, {}).size, 0);
  assert.equal(revealedWords(words, undefined).size, 0);
  assert.deepEqual([...revealedWords(words, { 0: 9 })], ["a", "b"]);
  assert.equal(revealedWords([null, undefined], { 0: 2, 1: 2 }).size, 0);
  assert.equal(revealedWords(null ?? [], { 0: 1 }).size, 0);
});

/* ── screenFootnotes and footnotesInPlay ─────────────────────────────── */

const row = (id, print, decided, givesAway = []) => ({ id, print, decided, givesAway });

test("screenFootnotes: a footnote the leader prints always shows", () => {
  const { shown, held } = screenFootnotes([row("a", true, true), row("b", true, false)], new Set());
  assert.deepEqual(shown, ["a", "b"]);
  assert.equal(held, 0);
});

test("screenFootnotes: an undecided spoiler waits until every blank it gives away is revealed", () => {
  const spoiler = row("x", false, false, [{ exact: "flesh" }, { exact: "spirit" }]);
  assert.deepEqual(screenFootnotes([spoiler], new Set()), { shown: [], held: 1 });
  assert.deepEqual(screenFootnotes([spoiler], new Set(["flesh"])), { shown: [], held: 1 });
  assert.deepEqual(screenFootnotes([spoiler], new Set(["flesh", "spirit"])), { shown: ["x"], held: 0 });
  assert.deepEqual(screenFootnotes([spoiler], new Set(["flesh", "spirit", "other"])), { shown: ["x"], held: 0 });
});

test("screenFootnotes: a footnote the leader decided to leave out never shows and is not held", () => {
  const out = screenFootnotes([row("n", false, true, [{ exact: "flesh" }])], new Set(["flesh"]));
  assert.deepEqual(out, { shown: [], held: 0 });
});

test("screenFootnotes: an undecided footnote that gives nothing away is neither shown nor held", () => {
  assert.deepEqual(screenFootnotes([row("n", false, false, [])], new Set()), { shown: [], held: 0 });
  assert.deepEqual(screenFootnotes([{ id: "n", print: false, decided: false }], new Set()), { shown: [], held: 0 });
});

test("screenFootnotes: a mix keeps its order and counts held ones", () => {
  const rows = [
    row("a", true, true),
    row("b", false, false, [{ exact: "w1" }]),
    row("c", false, true),
    row("d", false, false, [{ exact: "w2" }]),
    row("e", true, false),
  ];
  assert.deepEqual(screenFootnotes(rows, new Set(["w1"])), { shown: ["a", "b", "e"], held: 1 });
  assert.deepEqual(screenFootnotes(rows, new Set()), { shown: ["a", "e"], held: 2 });
});

test("screenFootnotes: no rows gives nothing", () => {
  assert.deepEqual(screenFootnotes([], new Set()), { shown: [], held: 0 });
  assert.deepEqual(screenFootnotes(null, new Set()), { shown: [], held: 0 });
  assert.deepEqual(screenFootnotes(undefined, new Set()), { shown: [], held: 0 });
});

test("footnotesInPlay: the printed ones and the undecided spoilers, not decided leave-outs", () => {
  const rows = [
    row("a", true, true),
    row("b", false, false, [{ exact: "w" }]),
    row("c", false, true, [{ exact: "w" }]),
    row("d", false, false, []),
    row("e", true, false, [{ exact: "w" }]),
  ];
  assert.deepEqual(footnotesInPlay(rows), ["a", "b", "e"]);
  assert.deepEqual(footnotesInPlay([]), []);
  assert.deepEqual(footnotesInPlay(null), []);
});

/* ── presentKey ──────────────────────────────────────────────────────── */

test("presentKey: arrows, Page Up and Page Down move between screens", () => {
  assert.deepEqual(presentKey({ key: "ArrowRight" }), { type: "next" });
  assert.deepEqual(presentKey({ key: "PageDown" }), { type: "next" });
  assert.deepEqual(presentKey({ key: "ArrowLeft" }), { type: "prev" });
  assert.deepEqual(presentKey({ key: "PageUp" }), { type: "prev" });
});

test("presentKey: Space goes on, Shift+Space goes back", () => {
  assert.deepEqual(presentKey({ key: " " }), { type: "next" });
  assert.deepEqual(presentKey({ key: " ", shiftKey: true }), { type: "prev" });
  assert.deepEqual(presentKey({ key: "Spacebar" }), { type: "next" });
  assert.deepEqual(presentKey({ key: "Spacebar", shiftKey: true }), { type: "prev" });
});

test("presentKey: Home and End go to the first and last screens", () => {
  assert.deepEqual(presentKey({ key: "Home" }), { type: "first" });
  assert.deepEqual(presentKey({ key: "End" }), { type: "last" });
});

test("presentKey: r reveals, Shift+R covers again (shiftKey decides, not the letter case)", () => {
  assert.deepEqual(presentKey({ key: "r" }), { type: "reveal" });
  assert.deepEqual(presentKey({ key: "R", shiftKey: true }), { type: "hide" });
  assert.deepEqual(presentKey({ key: "r", shiftKey: true }), { type: "hide" });
  assert.deepEqual(presentKey({ key: "R", shiftKey: false }), { type: "reveal" });
});

test("presentKey: f puts the footnotes up and down; Shift+F is nothing", () => {
  assert.deepEqual(presentKey({ key: "f" }), { type: "notes" });
  assert.deepEqual(presentKey({ key: "F" }), { type: "notes" });
  assert.equal(presentKey({ key: "F", shiftKey: true }), null);
  assert.equal(presentKey({ key: "f", shiftKey: true }), null);
});

test("presentKey: a key held with Ctrl, Alt or Cmd is the browser's", () => {
  for (const key of ["ArrowRight", " ", "r", "f", "Home", "PageDown"]) {
    assert.equal(presentKey({ key, ctrlKey: true }), null, `${key} + Ctrl`);
    assert.equal(presentKey({ key, altKey: true }), null, `${key} + Alt`);
    assert.equal(presentKey({ key, metaKey: true }), null, `${key} + Cmd`);
  }
});

test("presentKey: Up, Down and Escape are left alone, as are other keys and a missing event", () => {
  for (const key of ["ArrowUp", "ArrowDown", "Escape", "a", "Enter", "Tab", "1"]) {
    assert.equal(presentKey({ key }), null, key);
  }
  assert.equal(presentKey(null), null);
  assert.equal(presentKey(undefined), null);
});

/* ── fitSize ─────────────────────────────────────────────────────────── */

test("fitSize: the maximum when it fits", () => {
  assert.equal(fitSize({ min: 20, max: 200, fits: () => true }), 200);
});

test("fitSize: the minimum when even it doesn't fit", () => {
  assert.equal(fitSize({ min: 20, max: 200, fits: () => false }), 20);
});

test("fitSize: the exact boundary otherwise, wherever it falls", () => {
  for (const boundary of [20, 21, 22, 57, 100, 123, 198, 199]) {
    const size = fitSize({ min: 20, max: 200, fits: (s) => s <= boundary });
    assert.equal(size, boundary, `boundary ${boundary}`);
  }
});

test("fitSize: the minimum is returned when only the minimum fits", () => {
  assert.equal(fitSize({ min: 20, max: 200, fits: (s) => s <= 20 }), 20);
});

test("fitSize: calls fits a logarithmic number of times", () => {
  for (const boundary of [20, 21, 57, 150, 199]) {
    let calls = 0;
    fitSize({
      min: 20,
      max: 200,
      fits: (s) => {
        calls += 1;
        return s <= boundary;
      },
    });
    assert.ok(calls <= 10, `${calls} calls for boundary ${boundary}`);
  }
  let calls = 0;
  fitSize({ min: 1, max: 100000, fits: (s) => (calls++, s <= 777) });
  assert.ok(calls <= 20, `${calls} calls over a wide range`);
});

test("fitSize: sizes are whole pixels; fractional bounds round inward", () => {
  assert.equal(fitSize({ min: 10.2, max: 20.9, fits: () => true }), 20);
  assert.equal(fitSize({ min: 10.2, max: 20.9, fits: () => false }), 11);
  const seen = [];
  fitSize({ min: 10.5, max: 30.5, fits: (s) => (seen.push(s), s <= 17) });
  assert.ok(seen.every(Number.isInteger));
});

test("fitSize: a range that is empty or one wide gives the minimum, or tests only the one size", () => {
  assert.equal(
    fitSize({
      min: 30,
      max: 20,
      fits: () => {
        throw new Error("should not be asked");
      },
    }),
    30,
  );
  assert.equal(fitSize({ min: 40, max: 40, fits: () => true }), 40);
  assert.equal(fitSize({ min: 40, max: 40, fits: () => false }), 40);
  assert.equal(fitSize({ min: 40, max: 41, fits: (s) => s <= 40 }), 40);
});

/* ── The two windows ─────────────────────────────────────────────────── */

test("channelName: one channel per sheet", () => {
  assert.equal(channelName("abc123"), "lit-present:abc123");
  assert.notEqual(channelName("a"), channelName("b"));
});

test("presentMessage: a hello is read with its sender", () => {
  assert.deepEqual(presentMessage({ v: 1, type: "hello", from: "w1" }), { type: "hello", from: "w1" });
});

test("presentMessage: a bye carries its role, defaulting to stage", () => {
  assert.deepEqual(presentMessage({ v: 1, type: "bye", from: "w1", role: "presenter" }), {
    type: "bye",
    from: "w1",
    role: "presenter",
  });
  assert.deepEqual(presentMessage({ v: 1, type: "bye", from: "w1" }), { type: "bye", from: "w1", role: "stage" });
  assert.deepEqual(presentMessage({ v: 1, type: "bye", from: "w1", role: "audience" }), {
    type: "bye",
    from: "w1",
    role: "stage",
  });
});

test("presentMessage: a state carries its state and role (default stage)", () => {
  const state = { screen: 2, revealed: {}, notes: {} };
  assert.deepEqual(presentMessage({ v: 1, type: "state", from: "w1", state }), {
    type: "state",
    from: "w1",
    state,
    role: "stage",
  });
  assert.equal(presentMessage({ v: 1, type: "state", from: "w1", state, role: "presenter" }).role, "presenter");
});

test("presentMessage: a state message without a state object is rejected", () => {
  assert.equal(presentMessage({ v: 1, type: "state", from: "w1" }), null);
  assert.equal(presentMessage({ v: 1, type: "state", from: "w1", state: null }), null);
  assert.equal(presentMessage({ v: 1, type: "state", from: "w1", state: "x" }), null);
});

test("presentMessage: the wrong version is rejected", () => {
  assert.equal(presentMessage({ v: 2, type: "hello", from: "w1" }), null);
  assert.equal(presentMessage({ v: 0, type: "hello", from: "w1" }), null);
  assert.equal(presentMessage({ v: "1", type: "hello", from: "w1" }), null);
  assert.equal(presentMessage({ type: "hello", from: "w1" }), null);
});

test("presentMessage: a missing or non-string sender is rejected", () => {
  assert.equal(presentMessage({ v: 1, type: "hello" }), null);
  assert.equal(presentMessage({ v: 1, type: "hello", from: "" }), null);
  assert.equal(presentMessage({ v: 1, type: "hello", from: 7 }), null);
});

test("presentMessage: an unknown type, and data that is not an object, are rejected", () => {
  assert.equal(presentMessage({ v: 1, type: "launch", from: "w1" }), null);
  assert.equal(presentMessage({ v: 1, from: "w1" }), null);
  for (const bad of [null, undefined, "hello", 1, true]) assert.equal(presentMessage(bad), null);
});

test("makeMessage: stamps the version, type and sender, with extra fields", () => {
  assert.deepEqual(makeMessage("hello", "w1"), { v: MESSAGE_VERSION, type: "hello", from: "w1" });
  assert.deepEqual(makeMessage("bye", "w1", { role: "presenter" }), {
    v: MESSAGE_VERSION,
    type: "bye",
    from: "w1",
    role: "presenter",
  });
});

test("makeMessage: round-trips through presentMessage", () => {
  const state = { screen: 1, revealed: { 1: 2 }, notes: { 1: true } };
  assert.deepEqual(presentMessage(makeMessage("hello", "a")), { type: "hello", from: "a" });
  assert.deepEqual(presentMessage(makeMessage("bye", "a", { role: "presenter" })), {
    type: "bye",
    from: "a",
    role: "presenter",
  });
  assert.deepEqual(presentMessage(makeMessage("state", "a", { state, role: "presenter" })), {
    type: "state",
    from: "a",
    state,
    role: "presenter",
  });
  // survives a structured copy, as a BroadcastChannel would make
  const sent = JSON.parse(JSON.stringify(makeMessage("state", "a", { state })));
  assert.deepEqual(presentMessage(sent).state, state);
});

/* ── clockWords and screenCount ──────────────────────────────────────── */

test("clockWords: minutes and seconds, then hours", () => {
  assert.equal(clockWords(0), "0:00");
  assert.equal(clockWords(999), "0:00");
  assert.equal(clockWords(1000), "0:01");
  assert.equal(clockWords(59000), "0:59");
  assert.equal(clockWords(60000), "1:00");
  assert.equal(clockWords(245000), "4:05");
  assert.equal(clockWords(3599000), "59:59");
  assert.equal(clockWords(3600000), "1:00:00");
  assert.equal(clockWords(3729000), "1:02:09");
});

test("clockWords: negative, missing and non-numeric time is 0:00", () => {
  assert.equal(clockWords(-5000), "0:00");
  assert.equal(clockWords(undefined), "0:00");
  assert.equal(clockWords(null), "0:00");
  assert.equal(clockWords(NaN), "0:00");
  assert.equal(clockWords("abc"), "0:00");
});

test("screenCount: the 1-based position of a 0-based screen", () => {
  assert.equal(screenCount(0, 8), "Screen 1 of 8");
  assert.equal(screenCount(2, 8), "Screen 3 of 8");
  assert.equal(screenCount(7, 8), "Screen 8 of 8");
});

/* ── hiddenTermsNote ─────────────────────────────────────────────────── */

test("hiddenTermsNote: nothing for none, then one or several terms waiting on the reveal", () => {
  assert.equal(hiddenTermsNote(0), "");
  assert.equal(hiddenTermsNote(1), "One term is left blank until it is revealed.");
  assert.equal(hiddenTermsNote(3), "3 terms are left blank until they are revealed.");
});
