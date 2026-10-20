import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, commandQueryText, isCommandQuery, matchCommands } from "../src/lib/desk-commands.mjs";

const page = { surface: false, study: false, panelOpen: false, hidden: false };
const chapter = { surface: true, study: true, panelOpen: false, hidden: false };
const ids = (q, ctx) => matchCommands(q, ctx).map((c) => c.id);

test("a word that begins a command's word finds it", () => {
  assert.deepEqual(ids("hide", chapter), ["hide-notes"]);
  assert.deepEqual(ids("Hide my", chapter), ["hide-notes"]);
  assert.deepEqual(ids("tou", chapter), ["tour"]);
  assert.deepEqual(ids("backup", page), ["notebook-backup"], "through its keyword");
  assert.deepEqual(ids("zzz", chapter), []);
  assert.deepEqual(ids("", chapter), [], "a plain empty query lists nothing");
});

test("commands appear only where they can work", () => {
  assert.deepEqual(ids("hide", page), [], "no settings off a reading surface");
  assert.deepEqual(ids("tour", page), []);
  assert.deepEqual(ids(">", page), ["notebook-page", "notebook-backup", "notebook-help"]);
  assert.ok(ids("this verse", chapter).includes("show-this-verse"));
  const notStudy = { ...chapter, study: false };
  assert.ok(!ids("this verse", notStudy).includes("show-this-verse"), "This verse is a Study View tab");
  assert.deepEqual(ids("greek", chapter), ["show-greek"], "the Greek tab is found by its name");
  assert.deepEqual(ids("sblgnt", chapter), ["show-greek"], "and by its keyword");
  assert.deepEqual(ids("greek", notStudy), [], "the Greek tab is a Study View tab");
});

test("a draft chapter offers the Greek tab but not This verse", () => {
  const draft = { ...chapter, study: false, greek: true };
  assert.deepEqual(ids("greek", draft), ["show-greek"]);
  assert.ok(!ids("this verse", draft).includes("show-this-verse"), "a draft has no LIT verse to show");
});

test("open and close are one command, by whether the panel is open", () => {
  const panel = (c) => ids("notebook", c).filter((i) => i.endsWith("-notebook"));
  assert.deepEqual(panel({ ...chapter, panelOpen: false }), ["open-notebook"]);
  assert.deepEqual(panel({ ...chapter, panelOpen: true }), ["close-notebook"]);
});

test("hide my notes turns into show my notes while they are hidden", () => {
  assert.equal(matchCommands("hide", chapter)[0].name, "Hide my notes");
  assert.equal(matchCommands("show my", { ...chapter, hidden: true }).find((c) => c.id === "hide-notes").name, "Show my notes");
});

test("a query starting with > asks for commands, and what follows narrows them", () => {
  assert.equal(isCommandQuery(">"), true);
  assert.equal(isCommandQuery("  > hid"), true);
  assert.equal(isCommandQuery("hide"), false);
  assert.equal(commandQueryText(">  hid"), "hid");
  assert.equal(ids(">", chapter).length, COMMANDS.filter((c) => c.id !== "close-notebook").length);
  assert.deepEqual(ids("> hid", chapter), ["hide-notes"]);
  assert.deepEqual(ids("> zzz", chapter), []);
});

test("links carry their address and the rest carry none", () => {
  const byId = Object.fromEntries(matchCommands(">", chapter).map((c) => [c.id, c]));
  assert.equal(byId["notebook-page"].href, "/notebook/");
  assert.equal(byId["notebook-backup"].href, "/notebook/#backup");
  assert.equal(byId["notebook-help"].href, "/notebook/help/");
  assert.equal(byId["tour"].href, null);
});

test("the registry has unique ids", () => {
  assert.equal(new Set(COMMANDS.map((c) => c.id)).size, COMMANDS.length);
});

test("printing with notes is offered on a chapter and in Read View, and nowhere else", () => {
  assert.deepEqual(ids("print", chapter), ["print-with-notes"]);
  assert.deepEqual(ids("paper", chapter), ["print-with-notes"], "through its keyword");
  const readView = { ...chapter, study: false, print: true };
  assert.deepEqual(ids("print with", readView), ["print-with-notes"], "Read View has no Study View tabs but can print");
  assert.deepEqual(ids("print", { ...chapter, study: false, greek: true }), [], "a draft chapter has no notes to print");
  assert.deepEqual(ids("print", page), []);
  assert.equal(matchCommands("print", chapter)[0].href, null, "a command, not a link");
});
