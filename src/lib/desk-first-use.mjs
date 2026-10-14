// src/lib/desk-first-use.mjs
//
// The rules behind the notebook's first use (STUDY-DESK.md, phase 1d): the
// first-time choice of where the notebook lives (D6), the reminder to save a
// copy and the plain line for Safari (C18), and the tour (D8). Pure: no DOM,
// no storage, and the clock is always handed in, so every rule here is tested
// with a fixed `now` (test/desk-first-use.test.js). The code that draws the
// cards and the foot is src/scripts/desk/first-use.js, and the tour's is
// src/scripts/desk/tour.js.
//
// Until an account or file option is decided (T3, plan A or C), the choice has
// two answers and neither mentions sync: the notebook stays in this browser,
// with or without a reminder to save a copy now and then.

/** Where the notebook lives. No choice yet behaves as "browser" and shows the card. */
export const HOMES = ["browser", "browser-remind"];

/** A copy older than this many days (or none, with records to lose) is nagged about. */
export const REMIND_AFTER_DAYS = 7;

export const BACKUP_HREF = "/notebook/#backup";
export const HELP_HREF = "/notebook/help/";
export const WAYS_HREF = "/notebook/help/#ways-to-keep";
export const CONTACT_HREF = "/contact/";

/** The start of the tour from a chapter page: `?desk-tour` starts it after load. */
export const TOUR_LINK = "/john-3/?desk-tour";

const DAY_MS = 86_400_000;

/** A stored choice, or null when there isn't a valid one. */
export function readHome(value) {
  return HOMES.includes(value) ? value : null;
}

export const wantsReminder = (home) => home === "browser-remind";

/**
 * When a copy was last saved, as an ISO string, or null. The notebook page
 * writes it (META key `lastExport`); a stray shape reads as "never" rather
 * than breaking the foot.
 */
export function readLastExport(value) {
  const iso = typeof value === "string" ? value : value && typeof value.at === "string" ? value.at : null;
  return iso && Number.isFinite(Date.parse(iso)) ? iso : null;
}

/** Whole days from `iso` to `now`; 0 for a time in the future; null when `iso` is not a time. */
export function daysSince(iso, now) {
  const then = Date.parse(iso ?? "");
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "today", "yesterday", "3 days ago". */
export function agoPhrase(days) {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${plural(days, "day")} ago`;
}

/** The foot's plain statement of when a copy was last saved. */
export function savedLine(lastExport, now) {
  const days = daysSince(readLastExport(lastExport), now);
  return days === null ? "No copy saved yet." : `Last saved a copy ${agoPhrase(days)}.`;
}

/**
 * Whether the foot should remind the reader to save a copy: they asked to be
 * reminded, there is something to lose, and the last copy is a week old or
 * there is none.
 */
export function reminderDue({ home, lastExport, now, hasRecords }) {
  if (!wantsReminder(home) || !hasRecords) return false;
  const days = daysSince(readLastExport(lastExport), now);
  return days === null || days >= REMIND_AFTER_DAYS;
}

/** What the reminder says: "It’s been 9 days since you saved a copy." */
export function reminderText(lastExport, now) {
  const days = daysSince(readLastExport(lastExport), now);
  return days === null
    ? "You haven’t saved a copy yet."
    : `It’s been ${plural(days, "day")} since you saved a copy.`;
}

/* ── Safari (C18) ─────────────────────────────────────────────────── */

export const SAFARI_LINE =
  "Safari can clear a site’s stored data after seven days of using Safari without visiting the site, so save a copy now and then.";

/**
 * Desktop Safari: "Safari/" and "Version/" in the user agent, and none of the
 * browsers that borrow the word (Chrome, Chromium, Edge, Opera, Firefox) or the
 * phone and tablet ones, which never load the notebook.
 */
export function isDesktopSafari(ua) {
  const s = String(ua ?? "");
  if (!/Safari\//.test(s) || !/Version\//.test(s)) return false;
  return !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR\/|Firefox|Android|iPhone|iPad|iPod/.test(s);
}

/* ── The tour (D8) ────────────────────────────────────────────────── */

/**
 * The parts of the tour, in order. A reader can skip the rest of a part.
 */
export const TOUR_PARTS = ["Marking the text", "The Notebook", "Finding and keeping"];

/**
 * The steps, in order. A step names no element: the tour (tour.js) finds each
 * one's target on the page in front of the reader, shows it working there
 * (opening the verse menu, a demo note, a tab), and leaves the step out when
 * it can't. `views` are where it can appear: "study" (a chapter), "read"
 * (Read View) and "prose" (an article or the glossary). `since` is the phase
 * that added it, so a later phase adds a step with a newer one and a reader
 * who has seen the tour is offered just that. `body` is what it says, with a
 * different wording for a view where the thing works differently.
 *
 * The walk-through (BVJ, 2026-10-13: "more thorough in walking through how to
 * use the features", with steps that act and leave nothing behind) replaced
 * five steps that only named things.
 */
export const TOUR_STEPS = [
  {
    id: "actions",
    part: 0,
    views: ["study", "read", "prose"],
    since: "1d",
    title: "Open the menu",
    body: {
      study:
        "Select a verse number to open its menu. The “My Notebook” row is yours: “Add a note”, “Bookmark” and “Highlight”. Select any words instead, and the same row works on just those words.",
      read: "Select any words. The panel that opens has a “My Notebook” row: “Bookmark”, and “Highlight” while “My highlights” is on in the Display tray.",
      prose: "Select any words. The panel that opens has a “My Notebook” row with “Add a note”.",
    },
  },
  {
    id: "note",
    part: 0,
    views: ["study", "prose"],
    since: "1h",
    title: "Write a note",
    body: {
      default:
        "“Add a note” opens this. Choose a marker, write in your own words, and choose “Save”. During the tour saving is off, so nothing here is kept.",
    },
  },
  {
    id: "margin",
    part: 0,
    views: ["study", "prose"],
    since: "1d",
    title: "Your notes in the margin",
    body: {
      study:
        "A note sits in the margin beside the words it’s on, and shows three lines. Hover over it or select it to read the rest, then “Edit” to change or delete it. Nothing is added to the scripture.",
      prose:
        "A note sits in the margin beside the words it’s on, and shows three lines. Hover over it or select it to read the rest, then “Edit” to change or delete it. Nothing is added to the page’s own text.",
    },
  },
  {
    id: "highlight",
    part: 0,
    views: ["study"],
    since: "1h",
    title: "Highlight",
    body: {
      default:
        "Choose a color to tint the words. To take part of a highlight away, select those words and choose “Remove highlight”. The tint shown now is only a preview.",
    },
  },
  {
    id: "bookmark",
    part: 0,
    views: ["study", "read"],
    since: "1h",
    title: "Bookmark a verse",
    body: {
      study:
        "“Bookmark” puts a red mark beside the verse, and “My Notes” lists every bookmark. “Ribbon here…” keeps a named place, like a ribbon in a book.",
      read: "“Bookmark” puts a red mark beside the verse, here and in Study View, and the Notebook lists your bookmarks so you can go back to them.",
    },
  },
  {
    id: "pin",
    part: 0,
    views: ["study"],
    since: "1h",
    title: "Pin a footnote",
    body: {
      default:
        "Select a footnote letter, then “Pin” to keep that footnote in “My Notes”, under “Pinned footnotes”, where it stays in reach as you read.",
    },
  },
  {
    id: "panel",
    part: 1,
    views: ["study", "read", "prose"],
    since: "1d",
    title: "The Notebook",
    body: {
      study:
        "“My Notes” lists what you’ve kept in this chapter, or everything. Select one to go to it. » minimizes the Notebook to a tab at the window’s edge, × closes it, and the Notebook button brings it back.",
      default:
        "This lists what you’ve kept. Select one to go to it. » minimizes the Notebook to a tab at the window’s edge, × closes it, and the Notebook button brings it back.",
    },
  },
  {
    id: "verse",
    part: 1,
    views: ["study"],
    since: "1h",
    title: "“This verse”",
    body: {
      default:
        "Everything on one verse: its footnotes, your notes and its Greek. While the Notebook is open, opening a verse’s menu moves this tab to that verse.",
    },
  },
  {
    id: "greek",
    part: 1,
    views: ["study"],
    since: "1h",
    title: "“Greek”",
    body: {
      default:
        "The chapter in the SBL Greek New Testament, at the verse you’re reading. Select a word for its parsing and its dictionary entry. The search button finds a word, its forms or a Strong’s number.",
    },
  },
  {
    id: "widths",
    part: 1,
    views: ["study"],
    since: "1h",
    title: "Set the widths",
    body: {
      default:
        "Drag the edges between your notes, the text and the Notebook to make each wider or narrower. “Reset widths” at the foot of “My Notes” puts them back.",
    },
  },
  {
    id: "undo",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1h",
    title: "Undo, and a clean page",
    body: {
      default:
        "Ctrl+Z undoes your last change to the notebook, and Ctrl+Shift+Z redoes it (⌘Z and ⇧⌘Z on a Mac). “Hide my notes”, or the H key, clears your marks from the page and brings them back.",
    },
  },
  {
    id: "search",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1d",
    title: "Search and commands",
    body: {
      default:
        "The search box looks in your notebook too, and understands commands such as “hide”, “Greek” and “tour”. Here it shows what “notebook” finds.",
    },
  },
  {
    id: "notebook-page",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1h",
    title: "The notebook page",
    body: {
      default:
        "“Open the notebook page” shows everything you’ve kept in one place. There you can sort it with labels, keep your ribbons, and save a copy of your notebook or open one.",
    },
  },
  {
    id: "kept",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1d",
    title: "Where it’s kept",
    body: {
      default:
        "Your notebook is kept in this browser, on this computer. Nothing is sent anywhere. The foot of the panel says when you last saved a copy.",
    },
  },
];

/** The wording of a step for this view: "study", "read" or "prose". */
export function stepBody(step, view) {
  const b = step.body;
  return b[view] ?? b.default ?? Object.values(b)[0] ?? "";
}

const OFFERED = "offered";

/**
 * What `lit-desk-tour` holds, a list of strings: the id of every step the
 * reader has been taken through, plus offer markers ("offered" for the whole
 * tour, "offered:<id>" for a step) so a declined offer is not made again.
 * Anything that isn't a list of strings reads as nothing seen.
 */
export function parseTourState(raw) {
  let list = [];
  try {
    const v = JSON.parse(raw ?? "null");
    if (Array.isArray(v)) list = v.filter((x) => typeof x === "string");
  } catch (_) {}
  const known = new Set(TOUR_STEPS.map((s) => s.id));
  return {
    list,
    seen: list.filter((x) => known.has(x)),
    offeredWhole: list.includes(OFFERED),
    offeredSteps: list.filter((x) => x.startsWith(`${OFFERED}:`)).map((x) => x.slice(OFFERED.length + 1)),
  };
}

const union = (list, more) => [...list, ...more.filter((x) => !list.includes(x))];

/** The list with these step ids marked seen. */
export function withSeen(list, ids) {
  return union(list, ids);
}

/** The list with the offer marked made: the whole tour (no ids) or just these steps. */
export function withOffered(list, ids = null) {
  return union(list, ids ? ids.map((id) => `${OFFERED}:${id}`) : [OFFERED]);
}

/**
 * Whether to offer the tour now, and what:
 *   - { kind: "first" }: the reader has never been through it and was never asked;
 *   - { kind: "new", ids }: they have, and later phases have added steps they
 *     haven't seen and haven't been asked about;
 *   - { kind: null }: nothing to offer.
 * Asking never repeats: the caller marks the offer made when it shows it.
 */
export function tourOffer(raw) {
  const { list, seen, offeredWhole, offeredSteps } = parseTourState(raw);
  if (!seen.length) return offeredWhole ? { kind: null, list } : { kind: "first", list };
  const ids = TOUR_STEPS.map((s) => s.id).filter((id) => !seen.includes(id) && !offeredSteps.includes(id));
  return ids.length ? { kind: "new", ids, list } : { kind: null, list };
}

/**
 * The steps to take, in order: those for this `view` whose target is on this
 * page (`available`, a Set of ids), narrowed to `only` for a tour of what's
 * new. Each carries its number, so a card can say "Step 2 of 14", and its
 * part's name and where the next part starts (`nextPart`, an index, or null
 * in the last part), for "Skip this part".
 */
export function planTour({ available, only = null, view = null }) {
  const steps = TOUR_STEPS.filter(
    (s) => available.has(s.id) && (!only || only.includes(s.id)) && (!view || s.views.includes(view)),
  );
  return steps.map((s, i) => {
    const next = steps.findIndex((t, j) => j > i && t.part !== s.part);
    return { ...s, number: i + 1, of: steps.length, partName: TOUR_PARTS[s.part], nextPart: next < 0 ? null : next };
  });
}
