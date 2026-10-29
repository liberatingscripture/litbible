// src/lib/desk-commands.mjs
//
// The commands the site's search box offers once the Study Desk is on
// (STUDY-DESK.md, D3, placement 4; audit C11: commands live in the "/" search
// box, with no Ctrl K, which is the browser's own shortcut for its search).
// Pure: the registry and the matching. What a command does is
// src/scripts/desk/commands.js's (an event the desk listens for) or a plain
// link, and where the box draws them is notebook-search.js.
//
// A command is offered only where it can work. The ones that act on the
// Notebook panel or the page's settings need the desk's code running, which it
// is only on a reading surface (desk-frame.js); "This verse" and the Greek tab
// need a Study View chapter, "Print with my notes" and "Print with room to
// write" a chapter or Read View; the
// ones that open the notebook's own pages work anywhere.
//
// A query reaches a command when each of its words begins one of the
// command's words ("hide" finds "Hide my notes"; "back" finds "Save a copy of
// my notebook" through its keyword "backup"). A query that starts with ">"
// asks for commands alone: ">" lists them all, and what follows narrows them.

import { searchTokens } from "./desk-search.mjs";

/**
 * Where the box is, as far as commands care:
 * { surface: a reading surface (the desk's panel exists), study: a Study View
 *   chapter, panelOpen: the Notebook panel is open, hidden: "Hide my notes"
 *   is on }.
 */

/** @type {readonly { id: string, name: (ctx: object) => string, keywords: string[], needs: "surface" | "study" | "greek" | "print" | null, href?: string, show?: (ctx: object) => boolean, hint?: string }[]} */
export const COMMANDS = Object.freeze([
  {
    id: "open-notebook",
    name: () => "Open the Notebook",
    keywords: ["panel"],
    needs: "surface",
    show: (ctx) => !ctx.panelOpen,
    hint: "On this page",
  },
  {
    id: "close-notebook",
    name: () => "Close the Notebook",
    keywords: ["panel"],
    needs: "surface",
    show: (ctx) => ctx.panelOpen,
    hint: "On this page",
  },
  {
    id: "show-my-notes",
    name: () => "Show My Notes",
    keywords: ["list", "mine"],
    needs: "surface",
    hint: "In the Notebook",
  },
  {
    id: "show-this-verse",
    name: () => "Show This verse",
    keywords: ["tab"],
    needs: "study",
    hint: "In the Notebook",
  },
  {
    id: "show-greek",
    name: () => "Show the Greek",
    keywords: ["greek", "sblgnt", "tab"],
    needs: "greek",
    hint: "In the Notebook",
  },
  {
    id: "hide-notes",
    name: (ctx) => (ctx.hidden ? "Show my notes" : "Hide my notes"),
    keywords: ["hide", "show", "private", "screen"],
    needs: "surface",
    hint: "On this page",
  },
  {
    id: "print-with-notes",
    name: () => "Print with my notes",
    keywords: ["annotated", "paper", "pdf", "margin", "highlights"],
    needs: "print",
    // Not where the browser keeps no notebook (`keeps: false`), which has no
    // notes to print (BA34).
    show: (ctx) => ctx.keeps !== false,
    hint: "On this page",
  },
  {
    id: "print-with-room",
    name: () => "Print with room to write",
    keywords: ["journal", "journaling", "paper", "pdf", "margin", "ruled", "lines", "blank"],
    needs: "print",
    hint: "On this page",
  },
  {
    id: "notebook-page",
    name: () => "Open the notebook page",
    keywords: ["everything", "all"],
    needs: null,
    href: "/notebook/",
  },
  {
    id: "notebook-backup",
    name: () => "Save a copy of my notebook",
    keywords: ["backup", "export", "download", "file"],
    needs: null,
    href: "/notebook/#backup",
  },
  {
    id: "notebook-help",
    name: () => "Ways to keep your notebook",
    keywords: ["sync", "help", "where"],
    needs: null,
    href: "/notebook/help/",
  },
  {
    id: "tour",
    name: () => "Take the tour",
    keywords: ["welcome", "guide", "walkthrough"],
    needs: "surface",
    hint: "On this page",
  },
]);

/** Whether a command can work where the box is. */
function offered(command, ctx) {
  if (command.needs === "surface" && !ctx.surface) return false;
  if (command.needs === "study" && !ctx.study) return false;
  if (command.needs === "greek" && !(ctx.greek ?? ctx.study)) return false;
  // Printing (with notes, or with room to write) works on a Study View
  // chapter and in Read View. With room to write needs no notebook; with my
  // notes says so itself (`show`).
  if (command.needs === "print" && !(ctx.print ?? ctx.study)) return false;
  return command.show ? command.show(ctx) : true;
}

/** Whether the query asks for commands alone (it starts with ">"). */
export function isCommandQuery(query) {
  return /^\s*>/.test(String(query || ""));
}

/** A command query without its ">". */
export function commandQueryText(query) {
  return String(query || "").replace(/^\s*>\s*/, "");
}

/**
 * The commands a query reaches, in registry order, as
 * { id, name, href (or null), hint (or "") }. A plain query needs every word
 * to begin one of a command's words; a ">" query lists every command offered
 * when nothing follows the ">". A plain query that is empty finds none.
 */
export function matchCommands(query, ctx) {
  const asked = isCommandQuery(query);
  const tokens = searchTokens(asked ? commandQueryText(query) : query);
  if (!tokens.length && !asked) return [];

  const out = [];
  for (const c of COMMANDS) {
    if (!offered(c, ctx)) continue;
    const name = c.name(ctx);
    if (tokens.length) {
      const words = searchTokens(`${name} ${c.keywords.join(" ")}`);
      // searchTokens drops one-letter words; the commands have few, and a
      // query is matched against what is left.
      if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) continue;
    }
    out.push({ id: c.id, name, href: c.href ?? null, hint: c.hint ?? "" });
  }
  return out;
}
