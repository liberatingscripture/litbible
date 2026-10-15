// src/scripts/desk/term-notes.js
//
// "My notes on this term", under each /glossary entry the reader has made
// notes on the words of (STUDY-DESK.md M10). The rules, and what "on the
// term" means, are in src/lib/desk-term-notes.mjs; this reads the entries'
// "Where it appears" lists, asks the notebook, and draws the block.
//
// The occurrences come off the page rather than from a file of their own:
// every verse of every rendering is already a link in its list, whether or
// not "show more" has revealed it, and the words the LIT printed there ride
// along as `data-words` where they differ from the rendering's label
// (glossary.astro). Nothing is fetched for it.
//
// The reader's own words are drawn through noteBodyHtml, which escapes them
// before linking the scripture they cite, and the reference and link are the
// ones the notebook uses everywhere (recordReference, recordHref). Notes on
// the entry itself (N11) are not repeated: they are in its margin already.
// Like the margin, the block shows only while "My notes" is on.

import { noteBodyHtml } from "../../lib/desk-chains.mjs";
import { recordHref, recordReference } from "../../lib/desk-store-core.mjs";
import {
  occurrenceIndex,
  parseVerseHref,
  renderingsAt,
  termNotes,
} from "../../lib/desk-term-notes.mjs";
import { SETTINGS_EVENT, getSetting } from "./note-settings.js";

/** One entry's occurrences, folded by verse, read from its lists. */
function readOccurrences(entry) {
  const found = [];
  for (const group of entry.querySelectorAll("details.occ")) {
    const label = group.querySelector(".occ-form")?.textContent.trim() ?? "";
    for (const li of group.querySelectorAll(".occ-list > li")) {
      const verse = parseVerseHref(li.querySelector("a.sref")?.getAttribute("href"));
      if (verse) found.push({ ...verse, renderings: renderingsAt(label, li.dataset.words) });
    }
  }
  return occurrenceIndex(found);
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function noteItem(record) {
  const li = el("li", "desk-term-notes__item");
  const ref = el("a", "desk-term-notes__ref", recordReference(record));
  const href = recordHref(record);
  if (href) ref.href = href;
  li.append(ref);
  if (record.quote?.exact) {
    li.append(el("span", "desk-term-notes__quote", `on “${record.quote.exact}”`));
  }
  if (record.body?.trim()) {
    const body = el("p", "desk-term-notes__body");
    body.innerHTML = noteBodyHtml(record.body);
    li.append(body);
  }
  return li;
}

function noteBlock(notes, title) {
  const section = el("section", "desk-term-notes");
  section.setAttribute("data-pagefind-ignore", "");
  const heading = el("h3", "desk-term-notes__title", "My notes on this term");
  heading.id = `desk-term-notes-${title}`;
  section.setAttribute("aria-labelledby", heading.id);
  const list = el("ul", "desk-term-notes__list");
  list.append(...notes.map(noteItem));
  section.append(heading, list);
  return section;
}

/**
 * @param {{ store: object }} options
 * @returns {{ refresh(): Promise<void> } | null} Null off the glossary.
 */
export function createTermNotes({ store }) {
  const entries = Array.from(document.querySelectorAll(".glossary-entries article.entry[data-entry]"));
  if (!store || !entries.length) return null;

  // An entry with no gated occurrences has no list, and so no notes to find.
  const occurrences = new Map(entries.map((entry) => [entry, readOccurrences(entry)]));

  async function refresh() {
    const records = getSetting("notes") === "on" ? await store.all() : [];
    for (const entry of entries) {
      entry.querySelector(":scope > .desk-term-notes")?.remove();
      const notes = termNotes(records, occurrences.get(entry));
      if (!notes.length) continue;
      const block = noteBlock(notes, entry.dataset.entry);
      const anchor = entry.querySelector(":scope > .entry-body");
      if (anchor) anchor.after(block);
      else entry.append(block);
    }
  }

  store.subscribe(refresh);
  document.addEventListener(SETTINGS_EVENT, refresh);
  refresh();
  return { refresh };
}
