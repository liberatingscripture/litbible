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
 * The steps, in order. A step names no element: the tour (tour.js) finds each
 * one's target on the page in front of the reader and leaves the step out
 * when it isn't there. `since` is the phase that added it, so a later phase
 * adds a step with a newer one and a reader who has seen the tour is offered
 * just that. `body` is what it says, with a different wording for a view
 * where the thing works differently.
 */
export const TOUR_STEPS = [
  {
    id: "actions",
    since: "1d",
    title: "Add to the text",
    body: {
      study:
        "Select a verse number, or select any words. The menu that opens has a My Notebook row: Add a note, Bookmark and Highlight.",
      read: "Select any words. The panel that opens has a My Notebook row: Bookmark and Highlight.",
      prose: "Select any words. The panel that opens has a My Notebook row where you can add a note.",
    },
  },
  {
    id: "margin",
    since: "1d",
    title: "Notes in the margin",
    body: {
      study:
        "A note you write sits in the margin beside its words. Highlights tint the text itself. Nothing is added to the scripture.",
      prose: "A note you write sits in the margin beside its words. Nothing is added to the page’s own text.",
    },
  },
  {
    id: "panel",
    since: "1d",
    title: "The Notebook",
    body: {
      study:
        "This panel lists what you’ve kept. My Notes shows your notes, bookmarks and highlights. This verse gathers what you have on one verse. Greek shows the chapter in the SBL Greek New Testament.",
      default: "This panel lists what you’ve kept: your notes, bookmarks and highlights.",
    },
  },
  {
    id: "search",
    since: "1d",
    title: "Search and commands",
    body: {
      default:
        "The search box also looks in your notebook and understands a few commands. Type “tour” to see this tour again.",
    },
  },
  {
    id: "kept",
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
 * The steps to take, in order: those whose target is on this page (`available`,
 * a Set of ids), narrowed to `only` for a tour of what's new. Each carries its
 * number, so a card can say "Step 2 of 5".
 */
export function planTour({ available, only = null }) {
  const steps = TOUR_STEPS.filter((s) => available.has(s.id) && (!only || only.includes(s.id)));
  return steps.map((s, i) => ({ ...s, number: i + 1, of: steps.length }));
}
