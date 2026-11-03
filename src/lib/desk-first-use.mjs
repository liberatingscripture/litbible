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

/** The start of the notebook tour from a chapter page: `?desk-tour` starts it after load. */
export const TOUR_LINK = "/john-3/?desk-tour";

/** The start of the Study Desk tour: `?desk-tour` on /desk starts it after load. */
export const DESK_TOUR_LINK = "/desk/?desk-tour";

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
 * `notebook` marks a step about marking the text or keeping the notebook,
 * left out where the browser keeps none (BA34).
 *
 * "prose" is left out of the first three steps' `views` while notes on an
 * article or the glossary (N11) are out of version 1 (BVJ, 2026-10-29): their
 * "prose" wording stays for version 2, which puts the view back.
 *
 * The walk-through (BVJ, 2026-10-13: "more thorough in walking through how to
 * use the features", with steps that act and leave nothing behind) replaced
 * five steps that only named things. It ran to 14 steps and was cut to 10
 * (BVJ, 2026-11-02, "14 steps feels like a lot"): Highlight and Bookmark are
 * named in "Open the menu", "Set the widths" is in the help page, and the
 * notebook page and where it's kept are one step. A retired id stays in a
 * reader's stored list and is ignored (`parseTourState`), so nobody is offered
 * a new tour for steps that went.
 */
export const TOUR_STEPS = [
  {
    id: "actions",
    part: 0,
    views: ["study", "read"],
    since: "1d",
    notebook: true,
    title: "Open the menu",
    body: {
      study:
        "Select a verse number to open its menu. The “My Notebook” row is yours: “Add a note,” “Bookmark,” and “Highlight.” Select any words instead, and the same row works on just those words. A bookmark stays on its verse until you remove it, and “Move as I read” in the Notebook makes it follow you through a book.",
      read: "Select any words. The panel that opens has a “My Notebook” row: “Bookmark,” and “Highlight” while “My highlights” is on in the Display tray. A bookmark stays on its verse until you remove it, and “Move as I read” in the Notebook makes it follow you through a book.",
      prose: "Select any words. The panel that opens has a “My Notebook” row with “Add a note.”",
    },
  },
  {
    id: "note",
    part: 0,
    views: ["study"],
    since: "1h",
    notebook: true,
    title: "Write a note",
    body: {
      default:
        "“Add a note” opens this. Choose a marker, write in your own words, and choose “Save.” During the tour saving is off, so nothing here is kept.",
    },
  },
  {
    id: "margin",
    part: 0,
    views: ["study"],
    since: "1d",
    notebook: true,
    title: "Your notes in the margin",
    body: {
      study:
        "A note sits in the margin beside the words it’s on, and shows three lines. Hover over it or select it to read the rest, then “Edit” to change or delete it. Nothing is added to the scripture.",
      prose:
        "A note sits in the margin beside the words it’s on, and shows three lines. Hover over it or select it to read the rest, then “Edit” to change or delete it. Nothing is added to the page’s own text.",
    },
  },
  {
    id: "pin",
    part: 0,
    views: ["study"],
    since: "1h",
    notebook: true,
    title: "Pin a footnote",
    body: {
      default:
        "Select a footnote letter, then the thumbtack button, “Pin footnote,” to keep that footnote in “My Notes,” under “Pinned footnotes,” where it stays in reach as you read.",
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
        "“My Notes” lists what you’ve kept in this chapter, or everything. Select one to go to it. » minimizes the Notebook to a tab at the window’s edge, and selecting that tab brings it back.",
      default:
        "This lists what you’ve kept. Select one to go to it. » minimizes the Notebook to a tab at the window’s edge, and selecting that tab brings it back.",
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
        "Everything on one verse: its footnotes, your notes, and its Greek. While the Notebook is open, opening a verse’s menu moves this tab to that verse.",
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
        "The chapter in the SBL Greek New Testament, at the verse you’re reading. Select a word for its parsing and its dictionary entry. Select its form, its dictionary form, or its Strong’s number there to see where else it occurs.",
    },
  },
  {
    id: "undo",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1h",
    notebook: true,
    title: "Undo, and a clean page",
    body: {
      default:
        "Ctrl+Z undoes your last change to the notebook, and Ctrl+Shift+Z redoes it (⌘Z and ⇧⌘Z on a Mac). “Hide my marks,” or the H key, clears your notes, highlights, and bookmarks from the page and brings them back.",
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
        "The search box looks in your notebook too, and understands commands such as “hide,” “Greek,” and “tour.” Here it shows what “notebook” finds.",
    },
  },
  {
    id: "kept",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1d",
    notebook: true,
    title: "The notebook page, and where it’s kept",
    body: {
      default:
        "“Open the notebook page” shows everything you’ve kept in one place, where you can sort it with labels and save a copy of your notebook or open one. Your notebook is kept in this browser, on this computer, and nothing is sent anywhere. The foot of the panel says when you last saved a copy.",
    },
  },
];

/** The wording of a step for this view: "study", "read" or "prose". */
export function stepBody(step, view) {
  const b = step.body;
  return b[view] ?? b.default ?? Object.values(b)[0] ?? "";
}

const OFFERED = "offered";
const NEVER = "never";
const LATER = "later:";
const LATER_RE = /^later:\d{4}-\d{2}-\d{2}$/;

/**
 * What `lit-desk-tour` holds, a list of strings: the id of every step the
 * reader has been taken through, plus markers about the offer:
 *   - "offered" for the whole tour and "offered:<id>" for a step: the offer
 *     was made (the reader chose "Take the tour now");
 *   - "later:YYYY-MM-DD": "Remind me later." The offer is not made again until
 *     a later local calendar day than that date. Only one is ever kept;
 *   - "never": "Don't show this again." No offer of either kind, ever.
 * Anything that isn't a list of strings reads as nothing seen. `laterDay` is
 * the greatest well-formed later date, or null. The notebook tour and the Study
 * Desk tour each keep a list of their own (`steps` says whose ids are known).
 */
export function parseTourState(raw, steps = TOUR_STEPS) {
  let list = [];
  try {
    const v = JSON.parse(raw ?? "null");
    if (Array.isArray(v)) list = v.filter((x) => typeof x === "string");
  } catch (_) {}
  const known = new Set(steps.map((s) => s.id));
  const laters = list.filter((x) => LATER_RE.test(x)).map((x) => x.slice(LATER.length)).sort();
  return {
    list,
    seen: list.filter((x) => known.has(x)),
    offeredWhole: list.includes(OFFERED),
    offeredSteps: list.filter((x) => x.startsWith(`${OFFERED}:`)).map((x) => x.slice(OFFERED.length + 1)),
    never: list.includes(NEVER),
    laterDay: laters.length ? laters[laters.length - 1] : null,
  };
}

const union = (list, more) => [...list, ...more.filter((x) => !list.includes(x))];
const withoutLater = (list) => list.filter((x) => !x.startsWith(LATER));

/** The list with these step ids marked seen. */
export function withSeen(list, ids) {
  return union(list, ids);
}

/** The list with the offer marked made: the whole tour (no ids) or just these steps. */
export function withOffered(list, ids = null) {
  return union(list, ids ? ids.map((id) => `${OFFERED}:${id}`) : [OFFERED]);
}

/** A date's LOCAL calendar day as "YYYY-MM-DD" (zero-padded). */
export function localDay(date) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(date.getFullYear(), 4)}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** The list with its later marker replaced by "later:<day>" ("Remind me later"). */
export function withLater(list, day) {
  return [...withoutLater(list), `${LATER}${day}`];
}

/** The list with "Don't show this again" recorded (and any later marker dropped). */
export function withNever(list) {
  return union(withoutLater(list), [NEVER]);
}

/**
 * Whether to offer the tour now, and what:
 *   - { kind: "first" }: the reader has never been through it and was never asked;
 *   - { kind: "new", ids }: they have, and later phases have added steps they
 *     haven't seen and haven't been asked about;
 *   - { kind: null }: nothing to offer ({ snoozed: true } when it is only
 *     waiting for a later day).
 * The window has three answers. "Take the tour now" marks the offer made
 * (`withOffered`), then the tour marks every step seen. "Remind me later," the
 * window's ×, Escape, and simply leaving it all write a later marker
 * (`withLater`, also written when the window is shown), so the offer comes
 * back on a later day. "Don't show this again" writes "never" (`withNever`).
 * Pass `today` (a `localDay` string) for the later marker to be honored.
 */
export function tourOffer(raw, { today = null, steps = TOUR_STEPS } = {}) {
  const { list, seen, offeredWhole, offeredSteps, never, laterDay } = parseTourState(raw, steps);
  if (never) return { kind: null, list };
  if (today && laterDay && today <= laterDay) return { kind: null, list, snoozed: true };
  if (!seen.length) return offeredWhole ? { kind: null, list } : { kind: "first", list };
  const ids = steps.map((s) => s.id).filter((id) => !seen.includes(id) && !offeredSteps.includes(id));
  return ids.length ? { kind: "new", ids, list } : { kind: null, list };
}

/**
 * The steps to take, in order: those for this `view` whose target is on this
 * page (`available`, a Set of ids), narrowed to `only` for a tour of what's
 * new. Each carries its number, so a card can say "Step 2 of 14", and its
 * part's name and where the next part starts (`nextPart`, an index, or null
 * in the last part), for "Skip this part". With `canKeep` false (a browser
 * that keeps no notebook) the `notebook` steps are left out. `steps` and
 * `parts` default to the notebook tour's; the Study Desk's are passed in.
 */
export function planTour({ available, only = null, view = null, canKeep = true, steps: all = TOUR_STEPS, parts = TOUR_PARTS }) {
  const steps = all.filter(
    (s) =>
      available.has(s.id) &&
      (!only || only.includes(s.id)) &&
      (!view || s.views.includes(view)) &&
      (canKeep || !s.notebook),
  );
  return steps.map((s, i) => {
    const next = steps.findIndex((t, j) => j > i && t.part !== s.part);
    return { ...s, number: i + 1, of: steps.length, partName: parts[s.part], nextPart: next < 0 ? null : next };
  });
}

/* ── The Study Desk tour (E24) ───────────────────────────────────── */

/**
 * The Study Desk tour's parts. It runs on /desk (desk/desk-tour.js) and is a
 * tour of its own (BVJ, 2026-11-02): its own steps, its own seen list
 * (`lit-desk-page-tour`, same shape as the notebook tour's) and its own offer,
 * so finishing one says nothing about the other.
 */
export const DESK_TOUR_PARTS = ["What’s on the desk", "Changing the desk"];

/**
 * The steps, in order. Unlike the notebook tour's they have no `views`: /desk
 * is one page. Like it, they act on the real page and leave nothing behind:
 * the desk shows its original layout for the tour, nothing is saved while it
 * runs, and the reader's own layout comes back at the end. `notebook` marks a
 * step that needs the notebook kept (My Notes), left out where it isn't.
 */
export const DESK_TOUR_STEPS = [
  {
    id: "panes",
    part: 0,
    since: "e24",
    title: "Your panes",
    body: {
      default:
        "Each pane shows one thing: the LIT, the Greek, your notes, and more. A pane’s name is a menu for showing something else there. Drag a pane by its header to move it, and × closes it. For the tour the desk shows its original layout. Yours comes back at the end.",
    },
  },
  {
    id: "mine",
    part: 0,
    since: "e24",
    notebook: true,
    title: "My Notes",
    body: {
      default:
        "What you’ve kept in the chapter you’re reading, or everything: notes, highlights, bookmarks, and pinned footnotes. A bookmark can “Move as I read,” so it keeps your place through a book.",
    },
    more: "See how to make them: the notebook tour",
  },
  {
    id: "sync",
    part: 0,
    since: "e24",
    title: "Reading in sync",
    body: {
      default:
        "My Notes, This verse, Greek, and Footnotes follow the LIT pane. Move through the LIT, and they move with it. With two LIT panes open, the one you selected most recently is marked with a flag.",
    },
  },
  {
    id: "stay",
    part: 0,
    since: "e24",
    title: "Stay here",
    body: {
      default:
        "The lock keeps a pane where it is while the LIT moves on, so a verse or a Greek word stays in view. Select it again to follow. It is on here only for the tour.",
    },
  },
  {
    id: "title",
    part: 1,
    since: "e24",
    title: "The title menu",
    body: {
      default:
        "“Study Desk” is a menu for the page itself: adding a pane, the layout, printing, and display options. Help for the Study Desk is here too.",
    },
  },
  {
    id: "add",
    part: 1,
    since: "e24",
    title: "Add pane",
    body: {
      default:
        "Add a column at the right or a row along the bottom, then choose what it shows. Four panes fit when the window has room. A pane is added here only for the tour.",
    },
  },
  {
    id: "layout",
    part: 1,
    since: "e24",
    title: "Layout",
    body: {
      default:
        "Choose an arrangement and your panes move into it. Grayed ones need a bigger window. “Make this my default” keeps one for next time. An arrangement is applied here only for the tour.",
    },
  },
];
