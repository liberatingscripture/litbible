// src/lib/desk-sheet-templates.mjs
//
// The starting points "New sheet" offers (STUDY-DESK.md, M9; the blank canvas
// is 3a's). Each template is a name, a line saying what it is for, and the
// modules a new sheet begins with, built fresh on every call with makeModule
// so the ids are new and the formatted text is already in the canonical form
// (sanitizeSheetHtml). A template is only a start: the sheet keeps the
// template's id as its `template` field and nothing else of it, and every
// part can be changed, moved or removed. Pure: no DOM, no storage, no clock;
// the only randomness is makeModule's ids. These are the built-in templates;
// the reader's own (a sheet kept with `isTemplate`) are records, made and
// started from in desk-sheets.mjs (templateFromSheet, sheetFromTemplate), and
// the chooser lists them after these.

import { makeModule } from "./desk-sheets.mjs";

/** The templates, in the order the chooser lists them: a name and one line
 * saying what the sheet is for. A second line listing the parts ("Opening ·
 * Reading · 3 questions…") was tried (SH5-17) and dropped (BVJ, 2026-11-08):
 * to a new reader it read as noise, almost a mistake.
 *
 * `about` is the longer account the sheet editor shows above a sheet started
 * from the template (E84; BVJ, 2026-11-10): who it is for, how a session with
 * it moves, and what lands on the page, since the chooser's line is gone by
 * the time the parts are on screen. The chooser never shows it. Blank canvas
 * has none. What it counts ("three questions", "the first part is for you
 * alone") is held to the builders by test/desk-sheet-templates.test.js. */
export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: "bible-study",
    name: "Bible study",
    description: "An opening, the key terms, the reading, questions to talk over, and a closing.",
    about: "A plan for a small group meeting around one passage. You welcome the group, introduce the key terms, read together, and then talk through three questions that move from first impressions, to what the passage shows, to the week ahead. Each question leaves room to write, and the first part is for you alone.",
  }),
  Object.freeze({
    id: "sermon",
    name: "Sermon preparation",
    description: "Room for the text, first notes, context, an outline, and a word for the congregation.",
    about: "A working document for the preacher, not a handout. It follows the path from the text to the pulpit: what you notice first, the context, the good news for the people who will hear it, and then an outline and one thing for them to carry home. The key terms come last, as a reference.",
  }),
  Object.freeze({
    id: "class",
    name: "Class session",
    description: "Goals, the reading, background for the leader, questions that observe, interpret, and apply, and what comes next.",
    about: "A lesson plan for teaching a passage. It opens with your goals, meets the key terms before the reading, and then asks three questions in order: what the passage says, what it means, and what it means for us. Your background notes and expected answers print on the leader’s version only.",
  }),
  Object.freeze({
    id: "lectio-divina",
    name: "Lectio divina",
    description: "The four movements of a contemplative reading: read, reflect, pray, and rest.",
    about: "A slow, prayerful reading for one person or a group, with no questions to answer. The passage is read three times, and each of the four movements has your words of guidance and room to write. The first part is for you alone.",
  }),
  // The Swedish method (Audit 5, section D, #3; BVJ, 2026-11-08).
  Object.freeze({
    id: "swedish",
    name: "Swedish method",
    description: "Each person reads alone and marks a light, a question, and an arrow, then the group shares them.",
    about: "A study that needs no expert in the room. Everyone reads the passage alone and marks three things (a light, a question, and an arrow), writes a note under each, and then the group shares them in rounds. It suits a new group, or one where few people speak.",
  }),
  // Contextual Bible Study, after the Ujamaa Centre's (Audit 5, section D, #3; BVJ, 2026-11-08).
  Object.freeze({
    id: "contextual",
    name: "Contextual Bible Study",
    description: "Begin from the group’s own life, read the passage closely, and decide together what to do in response.",
    about: "A study that starts and ends with the group’s own community. The group gives its first reading, then reads again slowly, asking who has power and whose voice is missing, and then returns to its own life and decides what to do. It closes with an action the group will come back to.",
  }),
  Object.freeze({
    id: "blank",
    name: "Blank canvas",
    description: "One empty page with the full set of formatting, for a document of your own.",
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

/**
 * The prompt of every template's reading part, until a passage follows it
 * (BA70). The passage form is already open under the part on a sheet with no
 * passage (BVJ, 2026-11-08), so the prompt points at it.
 */
const READING_PROMPT = "Type the reference in the form below, or add the passage from the LIT pane’s verse numbers.";

/**
 * The group templates open with a part for the leader alone (Audit 5, section
 * D, #4; BVJ, 2026-11-08): what to have ready and the ground rules to name.
 * Leader only, so it prints on the leader's version and reaches the presenter
 * view, never the participants' copy or the room.
 */
const beforeYouLead = () =>
  part(
    "Before you lead",
    "For you alone: what to bring, and the ground rules you will name (listen well, what is shared stays here, nobody has to speak). Prints on the leader’s version only.",
    { leaderOnly: true },
  );

const BUILDERS = {
  "bible-study": () => [
    beforeYouLead(),
    part("Opening", "How you will begin: a welcome, a prayer, a moment of quiet."),
    makeModule("keyTerms"), // before the reading (BVJ, 2026-11-08); its card moves it after in one click
    part("Reading", READING_PROMPT),
    question("A first question for the group, such as “What word or phrase stands out to you?”"),
    question("A question about the passage, such as “What does it show about God, about people, and about the world?”"),
    question("A question that reaches into the week, such as “Where does this passage meet your life right now?”"),
    part("Closing", "How you will end: a prayer, a blessing, or a word for the week ahead."),
  ],
  sermon: () => [
    part("The text", READING_PROMPT),
    part("First reading", "What you notice on a first reading, what puzzles you, and what you want to look up."),
    part("Context", "Who wrote this, to whom, and what was happening around them."),
    part("The good news here", "What this passage offers the people who will hear it."),
    part("Outline", "Your outline, one line per movement: how you open, the text, the turn, the sending."),
    part("For the congregation", "One thing to carry into the week."),
    makeModule("keyTerms"), // last (SH5-13); a sermon's notes come before its vocabulary
  ],
  class: () => [
    beforeYouLead(),
    part("Goals for this session", "What the class should know or be able to do by the end. One goal per line."),
    makeModule("keyTerms"), // before the reading: a class meets the words first (BVJ, 2026-11-08)
    part("Reading", READING_PROMPT),
    part(
      "Background",
      "Notes for you as leader: history, setting, and the words worth explaining. These print on the leader’s version only.",
      { leaderOnly: true },
    ),
    // Observe, interpret, apply: the inductive study's steps (BVJ, 2026-11-08).
    question(
      "Observe: a question about what the passage says, such as “Who is here, and what happens?”",
      "Optional. The answer you expect, or notes for you as leader. It prints only on the leader’s version.",
    ),
    question("Interpret: a question about what it means, such as why the LIT renders a key term as it does."),
    question("Apply: a question about what it means for us, such as “What would change if we took this seriously?”"),
    part("Next time", "The reading for next time, and anything to bring."),
  ],
  "lectio-divina": () => [
    beforeYouLead(),
    part("Read", "Your words on how to read, such as “Read it slowly, aloud if you can, and notice a word or phrase that catches you.”"),
    part("Reflect", "Your words on how to reflect, such as “Read it again and stay with that word or phrase. What does it stir in you?”"),
    makeModule("space", { lines: 6 }),
    part("Pray", "Your words on how to pray, such as “Read it a third time, then answer God in your own words, or with none.”"),
    makeModule("space", { lines: 6 }),
    part("Rest", "Your words on how to rest, such as “Let the words go, and rest in God’s presence for a few minutes.”"),
    makeModule("space", { lines: 4 }),
  ],
  // The three signs are the parts' headings, so the participants' copy carries
  // the key: a heading is structure, and the explanation stays in the prompts.
  swedish: () => [
    beforeYouLead(),
    part("Opening", "How you will begin, and how this works: the passage read aloud, a quiet time to read it alone and mark it, then sharing."),
    part("Reading", READING_PROMPT),
    makeModule("keyTerms"), // after the reading: each reader meets the passage first
    part("Light: what shines out", "Something in the passage that shines out or brings light. Mark it, then note it here."),
    makeModule("space", { lines: 3 }),
    part("Question: what puzzles you", "Something you don’t understand, or want to ask about."),
    makeModule("space", { lines: 3 }),
    part("Arrow: what speaks to you", "Something that speaks to you personally, or to your life right now."),
    makeModule("space", { lines: 3 }),
    part("Sharing", "How the group will share: a round of lights, then questions, then arrows. Anyone may pass."),
    part("Closing", "How you will end: a prayer, or a moment of quiet."),
  ],
  // The Ujamaa Centre's movement (Gerald West, South Africa): the group's own
  // reading first, then a slow, critical reading of the text, then back to
  // the community's life and to action. The key terms box belongs to the
  // close reading, so it sits there rather than against the reading.
  contextual: () => [
    beforeYouLead(),
    part("Opening", "How you will begin: a welcome, and the passage read aloud more than once, in more than one voice."),
    part("Reading", READING_PROMPT),
    question("A first question from the group’s own reading, such as “What is this passage about?”"),
    part("Reading closely", "A slower reading: who is in the passage, who has power, and whose voice is missing."),
    makeModule("keyTerms"),
    question("A question about the people in the passage, such as “Who is here, and what do we learn about each?”"),
    question("A question about power, such as “Who has power here, who is left out, and what does the passage do about it?”"),
    part("Our context", "Back to the group’s own life: where this passage meets your community today."),
    question("A question such as “Where do we see this in our community now?”"),
    part("Action", "What the group will do in response, together or alone, and when you will come back to it."),
    part("Closing", "How you will end: a prayer, a blessing, or a word for the week ahead."),
  ],
  blank: () => [makeModule("text")],
};

/** A text part's opening heading as plain words, lowercased; "" when it has none. */
const headingWords = (m) => {
  if (m?.type !== "text" || typeof m.html !== "string") return "";
  const h = /^<h[1-6]>(.*?)<\/h[1-6]>/.exec(m.html);
  return h ? h[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase() : "";
};

/**
 * A sheet's shape: each part's type, and a text part's heading, in order.
 * Passages are left out, since adding the reading is using the template, not
 * reshaping it.
 */
const shapeOf = (modules) =>
  (modules ?? [])
    .filter((m) => m?.type !== "passage")
    .map((m) => `${m?.type}:${headingWords(m)}`)
    .join("|");

const SHAPES = new Map();
const templateShape = (id) => {
  if (!SHAPES.has(id)) SHAPES.set(id, shapeOf(BUILDERS[id]()));
  return SHAPES.get(id);
};

/**
 * The description the editor shows above a sheet (E84): its template's name
 * and `about`, or null. Only while the description is still true of the
 * sheet: a built-in template that has one, on a sheet (not one of the
 * reader's templates) whose parts are still the template's, in order, by
 * type and heading. What is typed into a part, and the passages added, don't
 * count; a part added, removed, moved or renamed does, and undoing that
 * brings the description back, since nothing about it is stored.
 *
 * A sheet started from one of the reader's own templates keeps the built-in
 * template's id (sheetFromTemplate), so the id alone can't tell the two
 * apart; the shape can, and where the reader's template kept the shape the
 * description is as true of it.
 *
 * @param {{ template?: string, isTemplate?: boolean, modules?: object[] } | null} sheet
 * @returns {{ name: string, about: string } | null}
 */
export function templateAbout(sheet) {
  if (!sheet || sheet.isTemplate) return null;
  const t = TEMPLATES.find((x) => x.id === sheet.template);
  if (!t?.about || !Object.hasOwn(BUILDERS, t.id)) return null;
  return shapeOf(sheet.modules) === templateShape(t.id) ? { name: t.name, about: t.about } : null;
}

// The headings a template gives the part its passage belongs under. A sheet
// keeps no mark of which part that is, only its template's id, so a reopened
// sheet finds it by its heading; one the reader renames isn't found, and a
// passage then goes at the end, as on any sheet (BA69).
const READING_HEADINGS = new Set(["reading", "read", "the text", "the reading"]);

const isReadingHeading = (m) => {
  if (m?.type !== "text" || typeof m.html !== "string") return false;
  const h = /^<h[1-6]>([^<]*)<\/h[1-6]>/.exec(m.html);
  return !!h && READING_HEADINGS.has(h[1].replace(/\s+/g, " ").trim().toLowerCase());
};

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
  return modules.find(isReadingHeading) ?? null;
}

/**
 * The reading on a sheet, as a span of module indexes: the first run of
 * passages side by side, with the reading part just above it when there is
 * one; with no passage yet, the reading part alone. Null when the sheet has
 * neither.
 *
 * @param {object[]} modules
 * @returns {{ start: number, end: number } | null}
 */
function readingSpan(modules) {
  const first = modules.findIndex((m) => m?.type === "passage");
  if (first < 0) {
    const at = modules.findIndex(isReadingHeading);
    return at < 0 ? null : { start: at, end: at };
  }
  let end = first;
  while (modules[end + 1]?.type === "passage") end++;
  return { start: first > 0 && isReadingHeading(modules[first - 1]) ? first - 1 : first, end };
}

/**
 * Where the key terms box sits against the reading, and the positions that
 * would put it just before or just after (BVJ, 2026-11-08: a choice made
 * sheet by sheet, from a button on the box's card). `side` is "before" or
 * "after" when the box is right against the reading, else "elsewhere";
 * `before` and `after` are the indexes to hand moveModule. Null when the
 * sheet has no box, or no reading to place it against.
 *
 * @param {{ modules: object[] } | null} sheet
 * @returns {{ side: "before" | "after" | "elsewhere", before: number, after: number } | null}
 */
export function keyTermsPlacement(sheet) {
  const modules = sheet?.modules ?? [];
  const from = modules.findIndex((m) => m?.type === "keyTerms");
  if (from < 0) return null;
  const rest = modules.filter((_, i) => i !== from);
  const span = readingSpan(rest);
  if (!span) return null;
  // Indexes in `rest` are where the box lands once taken out and put back.
  const before = span.start;
  const after = span.end + 1;
  return { side: from === before ? "before" : from === after ? "after" : "elsewhere", before, after };
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
