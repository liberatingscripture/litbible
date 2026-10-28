// src/lib/desk-sheet-templates.mjs
//
// The starting points "New sheet" offers (STUDY-DESK.md, M9; the blank canvas
// is 3a's). Each template is a name, a line saying what it is for, and the
// modules a new sheet begins with, built fresh on every call with makeModule
// so the ids are new and the formatted text is already in the canonical form
// (sanitizeSheetHtml). A template is only a start: the sheet keeps the
// template's id as its `template` field and nothing else of it, and every
// part can be changed, moved or removed. Pure: no DOM, no storage, no clock;
// the only randomness is makeModule's ids.

import { makeModule } from "./desk-sheets.mjs";

/** The templates, in the order the chooser lists them. */
export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: "bible-study",
    name: "Bible study",
    description: "An opening, the reading, questions to talk over, the key terms, and a closing.",
  }),
  Object.freeze({
    id: "sermon",
    name: "Sermon preparation",
    description: "Room for the text, first notes, context, an outline, and a word for the congregation.",
  }),
  Object.freeze({
    id: "class",
    name: "Class session",
    description: "Goals, the reading, background for the leader, questions with answers, and what comes next.",
  }),
  Object.freeze({
    id: "lectio-divina",
    name: "Lectio divina",
    description: "The four movements of a contemplative reading: read, reflect, pray, and rest.",
  }),
  Object.freeze({
    id: "blank",
    name: "Blank canvas",
    description: "One empty page with the full set of formatting, for a document of your own.",
  }),
]);

const text = (html, extra = {}) => makeModule("text", { html, ...extra });
const question = (html, answer = "", lines = 3) => makeModule("question", { html, answer, lines });

const BUILDERS = {
  "bible-study": () => [
    text("<h2>Opening</h2><p>A word of welcome, and a moment of quiet before reading.</p>"),
    text("<h2>Reading</h2>"),
    question("<p>What word or phrase stands out to you?</p>"),
    question("<p>What does this passage show about God, about people, and about the world?</p>"),
    question("<p>Where does this passage meet your life this week?</p>"),
    makeModule("keyTerms"),
    text("<h2>Closing</h2><p>A prayer, a blessing, or a word for the week ahead.</p>"),
  ],
  sermon: () => [
    text("<h2>The text</h2>"),
    text("<h2>First reading</h2><p>What I notice, what puzzles me, and what I want to look up.</p>"),
    makeModule("keyTerms"),
    text("<h2>Context</h2><p>Who wrote this, to whom, and what was happening around them.</p>"),
    text("<h2>The good news here</h2><p>What this passage offers the people who will hear it.</p>"),
    text("<h2>Outline</h2><ol><li>Opening</li><li>The text</li><li>The turn</li><li>Sending</li></ol>"),
    text("<h2>For the congregation</h2><p>One thing to carry into the week.</p>"),
  ],
  class: () => [
    text("<h2>Goals for this session</h2><ul><li>Goal</li></ul>"),
    text("<h2>Reading</h2>"),
    text("<h2>Background</h2><p>Notes for the leader: history, setting, and the words worth explaining.</p>", { leaderOnly: true }),
    question("<p>What is happening in this passage?</p>", "<p>An answer for the leader’s copy.</p>"),
    question("<p>What did you notice in the LIT’s wording?</p>", ""),
    makeModule("keyTerms"),
    text("<h2>Next time</h2><p>The reading for next week, and anything to bring.</p>"),
  ],
  "lectio-divina": () => [
    text("<h2>Read</h2><p>Read it slowly, aloud if you can, and notice a word or phrase that catches you.</p>"),
    text("<h2>Reflect</h2><p>Read it again. Stay with that word or phrase, and ask what it stirs in you.</p>"),
    makeModule("space", { lines: 6 }),
    text("<h2>Pray</h2><p>Read it a third time. Answer God in your own words, or with none.</p>"),
    makeModule("space", { lines: 6 }),
    text("<h2>Rest</h2><p>Let the words go, and rest in God’s presence for a few minutes.</p>"),
    makeModule("space", { lines: 4 }),
  ],
  blank: () => [makeModule("text")],
};

// The headings a template gives the part its passage belongs under. A sheet
// keeps no mark of which part that is, only its template's id, so a reopened
// sheet finds it by its heading; one the reader renames isn't found, and a
// passage then goes at the end, as on any sheet (BA69).
const READING_HEADINGS = new Set(["reading", "read", "the text", "the reading"]);

/** What the editor shows in the reading part until there is a passage (BA70). */
export const READING_HINT = "Add the passage with + Passage, or from the LIT pane’s verse numbers.";

/**
 * The part a sheet's first passage belongs under: the first text part whose
 * opening heading is a template's reading heading, while the sheet holds no
 * passage; else null. The editor shows READING_HINT in it, never as the
 * sheet's text, so the instruction can't print or go up on a room's screen
 * (BA70), and a passage added before anything is worked in goes after it
 * (BA69).
 *
 * @param {{ modules: object[] } | null} sheet
 * @returns {object | null} the module
 */
export function readingPart(sheet) {
  const modules = sheet?.modules ?? [];
  if (modules.some((m) => m?.type === "passage")) return null;
  for (const m of modules) {
    if (m?.type !== "text" || typeof m.html !== "string") continue;
    const h = /^<h[1-6]>([^<]*)<\/h[1-6]>/.exec(m.html);
    if (h && READING_HEADINGS.has(h[1].replace(/\s+/g, " ").trim().toLowerCase())) return m;
  }
  return null;
}

/**
 * A fresh list of the modules a template begins with (new ids every call).
 * An unknown id throws.
 *
 * @param {string} id one of TEMPLATES' ids
 * @returns {object[]}
 */
export function templateModules(id) {
  if (typeof id !== "string" || !Object.hasOwn(BUILDERS, id)) throw new Error(`desk-sheet-templates: unknown template "${id}"`);
  return BUILDERS[id]();
}
