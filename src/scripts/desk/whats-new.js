// src/scripts/desk/whats-new.js
//
// "What's new for you" as the page shows it (STUDY-DESK.md B3, phase 2a): the
// release notes narrowed to the verses the reader has marked, in two places.
//
//   - mountWhatsNew: the notebook page's #whats-new section, the publishes
//     that touched a note, highlight, bookmark, pinned footnote or ribbon,
//     newest first, each change linked to its entry in /release-notes/ and
//     each mark to its verse. Publishes after the day the reader last looked
//     carry a "New" mark; looking (the page loading) moves that day on.
//   - panelLine: the one line the Notebook panel's My Notes tab shows when
//     something changed since that day, linking to the section.
//
// The rules (which changes touch which marks) are src/lib/desk-whats-new.mjs;
// how they are presented is src/lib/desk-whats-new-view.mjs. This file only
// reads the notebook and the feed and draws. It writes one thing, the "last
// looked" day in the notebook's meta, from the notebook page alone, and never
// a record. The panel only reads, so a count there can't hide what the page
// would show. Words from the feed and from the reader are drawn as text.

import { whatsNewForYou, whatsNewLine } from "../../lib/desk-whats-new.mjs";
import {
  SEEN_KEY,
  hasVerseMarks,
  listSeparator,
  markLinks,
  presentWhatsNew,
  seenMark,
  seenValue,
} from "../../lib/desk-whats-new-view.mjs";
import { loadReleaseNotes } from "./release-feed.js";

/** Where the section is, for the panel's line. */
export const WHATS_NEW_HREF = "/notebook/#whats-new";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/** The saved "last looked" value as it is stored ("2026-10-26+3"), or null. */
async function lastLooked(store) {
  try {
    const value = await store.getMeta?.(SEEN_KEY);
    return seenMark(value) ? value : null;
  } catch (_) {
    return null;
  }
}

/**
 * The line for the Notebook panel, or null for nothing to say: no mark on a
 * verse (the feed isn't even fetched then), the feed out of reach, or nothing
 * in the reader's verses since they last looked. Before a first look there is
 * no "since", so it counts everything and doesn't say "since your last
 * visit".
 *
 * @param {object} store the desk's store (only getMeta is used)
 * @param {object[]} records the notebook
 * @returns {Promise<{ text: string, href: string } | null>}
 */
export async function panelLine(store, records) {
  if (!hasVerseMarks(records)) return null;
  const entries = await loadReleaseNotes();
  if (!entries) return null;
  const seen = await lastLooked(store);
  const text = whatsNewLine(whatsNewForYou(entries, records, { since: seen }), { sinceVisit: seen !== null });
  return text ? { text, href: WHATS_NEW_HREF } : null;
}

/** "your note and highlight on Romans 4:7 and your note on Galatians 3:27", as links. */
function marksSentence(records) {
  const p = el("p", "desk-wn__marks");
  p.append("Touches ");
  const links = markLinks(records);
  links.forEach(({ text, href }, i) => {
    p.append(listSeparator(i, links.length));
    const a = el("a", null, text);
    if (href) a.href = href;
    p.append(a);
  });
  p.append(".");
  return p;
}

/** Everything publishItem draws for a group, to tell whether a redraw would change it. */
function publishSignature(group) {
  return [group.id, group.label, group.isNew, group.changes.map(({ change, records }) => [change.description, markLinks(records)])];
}

function publishItem(group) {
  const article = el("article", `desk-wn__publish${group.isNew ? " desk-wn__publish--new" : ""}`);
  article.dataset.entry = group.id;
  const heading = el("h3", "desk-np__h3 desk-wn__date");
  const link = el("a", null, group.label);
  link.href = group.href;
  heading.append(link);
  if (group.isNew) heading.append(" ", el("span", "desk-wn__new", "New"));
  const list = el("ul", "desk-wn__changes");
  for (const { change, records } of group.changes) {
    const li = el("li", "desk-wn__change");
    const what = el("a", "desk-wn__what", change.description);
    what.href = group.href;
    li.append(what, marksSentence(records));
    list.append(li);
  }
  article.append(heading, list);
  return article;
}

/**
 * Fill the notebook page's section (`box`): a heading, a line in words, the
 * publishes and "Show more". It redraws when the notebook changes, keeps
 * what was new when the page opened marked new for the whole visit, and moves
 * the "last looked" day on once it has drawn from a feed it could read.
 */
export function mountWhatsNew(box, { store }) {
  const title = el("h2", "desk-np__h2", "What’s new for you");
  title.id = "deskNpWhatsNewTitle";
  const status = el("p", "desk-wn__status");
  status.setAttribute("aria-live", "polite");
  const list = el("div", "desk-wn__list");
  const again = el("button", "desk-wn__again", "Try again");
  again.type = "button";
  again.hidden = true;
  const more = el("button", "desk-wn__more");
  more.type = "button";
  more.hidden = true;
  box.setAttribute("aria-labelledby", title.id);
  box.replaceChildren(title, status, again, list, more);

  let seen; // the day last looked, read once so "New" holds for the visit
  let limit = null;
  let marked = false; // the day moved on
  let seq = 0;
  let drawn = null; // what the list last showed, so an unchanged redraw keeps focus (BA97)

  more.addEventListener("click", () => {
    limit = Infinity;
    const first = list.children.length;
    draw().then(() => list.children[first]?.querySelector("a")?.focus());
  });

  // Try again fetches the feed afresh (release-feed.js forgets a failure, BA88).
  // Once a draw hides it, focus goes to the heading rather than the page.
  let refocus = false;
  again.addEventListener("click", () => {
    refocus = true;
    draw();
  });
  function landFocus() {
    if (!refocus || !again.hidden) return;
    refocus = false;
    if (document.activeElement === again || document.activeElement === document.body) {
      title.tabIndex = -1;
      title.focus();
    }
  }

  /** Say something in place of the list, with Try again when `retry`. */
  function plain(text, { retry = false } = {}) {
    drawn = null;
    list.replaceChildren();
    more.hidden = true;
    again.hidden = !retry;
    landFocus();
    status.textContent = text;
  }

  function draw() {
    const mine = ++seq;
    return paint(mine).catch(() => {
      if (mine === seq) plain("Your notebook couldn’t be read just now.", { retry: true });
    });
  }

  async function paint(mine) {
    const records = await store.all();
    if (seen === undefined) seen = await lastLooked(store);
    if (!hasVerseMarks(records)) {
      if (mine === seq) plain("Once you’ve marked a verse, changes to it show up here.");
      return;
    }
    const entries = await loadReleaseNotes();
    if (mine !== seq) return;
    if (!entries) {
      plain("The release notes couldn’t be loaded just now.", { retry: true });
      return;
    }

    const found = whatsNewForYou(entries, records);
    const { shown, hidden, fresh } = presentWhatsNew(found, seen, limit == null ? undefined : { limit });
    // A first look has no "since": it says what the notebook's verses have had.
    const text = !found.length
      ? "Nothing has changed in your verses."
      : seen === null
        ? whatsNewLine(found)
        : (whatsNewLine(fresh, { sinceVisit: true }) ?? "Nothing new since your last visit.");
    again.hidden = true;
    landFocus();
    if (status.textContent !== text) status.textContent = text;
    // A change elsewhere in the notebook leaves this list as it was: rebuilding
    // it anyway would drop the focus of a reader working through it.
    const signature = JSON.stringify(shown.map(publishSignature));
    if (signature !== drawn) {
      drawn = signature;
      list.replaceChildren(...shown.map(publishItem));
    }
    more.hidden = hidden === 0;
    more.textContent = `Show ${hidden} more ${hidden === 1 ? "publish" : "publishes"}`;

    // Looking is what moves the day on, once, from a feed that was read.
    if (!marked) {
      marked = true;
      const value = seenValue(entries);
      if (value && value !== seen && typeof store.setMeta === "function") {
        try {
          await store.setMeta(SEEN_KEY, value);
        } catch (_) {
          // An unwritable meta only means "New" shows again next time.
        }
      }
    }
  }

  store.subscribe?.(() => draw());
  return draw();
}
