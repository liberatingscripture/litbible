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

/** The templates, in the order the chooser lists them. `parts` is the line
 * under the description that names what the sheet starts with (SH5-17). */
export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: "bible-study",
    name: "Bible study",
    description: "An opening, the reading, questions to talk over, the key terms, and a closing.",
    parts: "Opening · Reading · 3 questions · Key terms · Closing",
  }),
  Object.freeze({
    id: "sermon",
    name: "Sermon preparation",
    description: "Room for the text, first notes, context, an outline, and a word for the congregation.",
    parts: "The text · First reading · Context · The good news here · Outline · For the congregation · Key terms",
  }),
  Object.freeze({
    id: "class",
    name: "Class session",
    description: "Goals, the reading, background for the leader, questions with answers, and what comes next.",
    parts: "Goals · Reading · Background · 2 questions · Key terms · Next time",
  }),
  Object.freeze({
    id: "lectio-divina",
    name: "Lectio divina",
    description: "The four movements of a contemplative reading: read, reflect, pray, and rest.",
    parts: "Read · Reflect · Pray · Rest, with space to write",
  }),
  Object.freeze({
    id: "blank",
    name: "Blank canvas",
    description: "One empty page with the full set of formatting, for a document of your own.",
    parts: "One empty part",
  }),
]);

// Every template part is structure plus a prompt, and holds no text that
// could print (SH5-2, BVJ's rule that no field starts with text): a text part
// is its heading alone, a question is empty. The prompt is what the editor
// shows dimmed in the part until the leader types; the format keeps it in its
// own field, which nothing prints, copies, presents or counts
// (STUDY-DESK-FORMAT.md, "Modules"), so a prompt may name the editor's tools
// where a part's text never may (BA70).
const part = (heading, prompt, extra = {}) => makeModule("text", { html: `<h2>${heading}</h2>`, prompt, ...extra });
const question = (prompt, answerPrompt) =>
  makeModule("question", { html: "", answer: "", lines: 3, prompt, ...(answerPrompt ? { answerPrompt } : {}) });

/** The prompt of every template's reading part, until it holds a passage (BA70). */
const READING_PROMPT = "Add the passage with + Passage, or from the LIT pane’s verse numbers.";

const BUILDERS = {
  "bible-study": () => [
    part("Opening", "How you will begin: a welcome, a prayer, a moment of quiet."),
    part("Reading", READING_PROMPT),
    question("A first question for the group, such as “What word or phrase stands out to you?”"),
    question("A question about the passage, such as “What does it show about God, about people, and about the world?”"),
    question("A question that reaches into the week, such as “Where does this passage meet your life right now?”"),
    makeModule("keyTerms"),
    part("Closing", "How you will end: a prayer, a blessing, or a word for the week ahead."),
  ],
  sermon: () => [
    part("The text", READING_PROMPT),
    part("First reading", "What you notice on a first reading, what puzzles you, and what you want to look up."),
    part("Context", "Who wrote this, to whom, and what was happening around them."),
    part("The good news here", "What this passage offers the people who will hear it."),
    part("Outline", "Your outline, one line per movement: how you open, the text, the turn, the sending."),
    part("For the congregation", "One thing to carry into the week."),
    makeModule("keyTerms"), // last, as in every other template (SH5-13)
  ],
  class: () => [
    part("Goals for this session", "What the class should know or be able to do by the end. One goal per line."),
    part("Reading", READING_PROMPT),
    part(
      "Background",
      "Notes for you as leader: history, setting, and the words worth explaining. These print on the leader’s version only.",
      { leaderOnly: true },
    ),
    question(
      "A question about what happens in the passage.",
      "Optional. The answer you expect, or notes for you as leader. It prints only on the leader’s version.",
    ),
    question("A question about the LIT’s wording, such as what a key term’s traditional word was."),
    makeModule("keyTerms"),
    part("Next time", "The reading for next time, and anything to bring."),
  ],
  "lectio-divina": () => [
    part("Read", "How to read: slowly, aloud if you can, noticing a word or phrase that catches you."),
    part("Reflect", "How to reflect: read it again and stay with that word or phrase, asking what it stirs."),
    makeModule("space", { lines: 6 }),
    part("Pray", "How to pray: read it a third time and answer God in your own words, or with none."),
    makeModule("space", { lines: 6 }),
    part("Rest", "How to rest: let the words go, and rest in God’s presence for a few minutes."),
    makeModule("space", { lines: 4 }),
  ],
  blank: () => [makeModule("text")],
};

// The headings a template gives the part its passage belongs under. A sheet
// keeps no mark of which part that is, only its template's id, so a reopened
// sheet finds it by its heading; one the reader renames isn't found, and a
// passage then goes at the end, as on any sheet (BA69).
const READING_HEADINGS = new Set(["reading", "read", "the text", "the reading"]);

/**
 * The part a sheet's first passage belongs under: the first text part whose
 * opening heading is a template's reading heading, while the sheet holds no
 * passage; else null. A passage added to a sheet with none goes after it
 * (BA69, SH5-3). Its instruction is the part's `prompt`, which the editor
 * draws like any other part's (BA70, SH5-2).
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
