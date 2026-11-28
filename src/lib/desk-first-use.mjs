// src/lib/desk-first-use.mjs
//
// The rules behind the notebook's first use (STUDY-DESK.md, phase 1d): the
// first-time choice of where the notebook lives (D6), the reminder to back up
// (its rules are in desk-reminder.mjs, re-exported here) and the plain line
// for Safari (C18), and the tour (D8). Pure: no DOM,
// no storage, and the clock is always handed in, so every rule here is tested
// with a fixed `now` (test/desk-first-use.test.js). The code that draws the
// cards and the foot is src/scripts/desk/first-use.js, and the tour's is
// src/scripts/desk/tour.js.
//
// The choice's answers are still two, and both keep the notebook in this
// browser, with or without a reminder to back up now and then: an account is
// not an answer stored here but a way out to the account pages, and a browser
// whose notebook syncs never sees the card (step 4j, BVJ 2026-11-25). Its
// words are CARD_WORDS, in two forms: while accounts are closed, and where
// they are open.

import { MAX_PANES } from "./desk-layout.mjs";
import { numberWord } from "./desk-wording.mjs";

export * from "./desk-reminder.mjs";

/** Where the notebook lives. No choice yet behaves as "browser" and shows the card. */
export const HOMES = ["browser", "browser-remind"];

export const BACKUP_HREF = "/notebook/#backup";
export const HELP_HREF = "/desk/help/";
export const WAYS_HREF = "/desk/help/#ways-to-keep";
export const CONTACT_HREF = "/contact/";
/** Where the first-time card's "Set up an account" goes. */
export const ACCOUNT_HREF = "/account/";

/**
 * The Settings tab's one quiet line to the account pages, in the backup group
 * (UX9b-4; BVJ, 2026-11-26). The whole sentence is the link.
 */
export const ACCOUNT_LINE = "Keep it in step across your devices with an account.";

/** Whether that line shows: accounts are open in this browser, and it doesn't sync yet. */
export const accountLineShown = (accountsOpen, linked) => Boolean(accountsOpen) && !linked;

/**
 * The first-time card's words (D6; step 4j, BVJ 2026-11-25). `closed` is the
 * statement it has been since BVJ's 2026-11-07 call (Audit 4, FU4-1), while
 * accounts are closed; `open` is the choice, where they are open
 * (html[data-account="open"]), and it keeps BVJ's rule that no account at
 * all is plainly an option. In both, keeping the notebook in this browser is
 * the answer the card stores; "Set up an account" is a link. A browser that
 * syncs never shows the card, so neither form has to be true there.
 */
export const CARD_WORDS = Object.freeze({
  closed: Object.freeze({
    title: "Your notebook is kept in this browser",
    lead: "It stays in this browser, and nothing is sent anywhere. If the browser’s data for this site is cleared, the notebook is gone unless you have backed it up.",
    more: "An account that keeps it in step across your devices is coming. You won’t need one.",
    done: "Got it",
  }),
  open: Object.freeze({
    title: "Where should your notebook be kept?",
    keepLead: "It stays in this browser, and nothing is sent anywhere. If the browser’s data for this site is cleared, it is gone unless you have backed it up.",
    keep: "Keep it in this browser",
    accountLead: "Your notebook stays in this browser and syncs across your devices, locked with a key we never have.",
    account: "Set up an account",
    more: "You don’t need an account, and you can stop using one at any time.",
  }),
  remind: "Remind me to back up my notebook",
  remindNote: "The Notebook reminds you when it has been a week since your last backup.",
  ways: "Ways to keep your notebook",
});

/**
 * What the bar says the first time a visit writes something while the card is
 * unanswered (panel.js's nudge, E74). It never shows in a browser that syncs.
 * @param {boolean} accountsOpen whether accounts are open in this browser
 */
export function nudgeLine(accountsOpen) {
  return accountsOpen
    ? "Your notebook is kept in this browser. Choose where to keep it."
    : "Your notebook is kept in this browser. See how to back it up.";
}

/**
 * Which stage the Study Desk is in, as a reader is told (STUDY-DESK.md, Phase
 * 6; BVJ, 2026-11-09): "preview" while invited readers test it, "beta" from
 * the public launch, and none once the apps can sync. One constant, so the
 * change at launch is one edit.
 */
export const DESK_STAGE = "preview";

/** The contact form, opened about the Study Desk (it starts the message for the sender). */
export const FEEDBACK_HREF = `${CONTACT_HREF}?about=study-desk`;

/** The invitation's words, the same in the Notebook's Settings tab, the title menu and the help page. */
export const FEEDBACK_LABEL = `Send feedback on the ${DESK_STAGE}`;

/** The start of the notebook tour from a chapter page: `?desk-tour` starts it after load. */
export const TOUR_LINK = "/john-3/?desk-tour";

/** The start of the Study Desk tour: `?desk-tour` on /desk starts it after load. */
export const DESK_TOUR_LINK = "/desk/?desk-tour";

/** The start of the Sheets tour (E63): `?sheet-tour` on /desk starts it after load. */
export const SHEET_TOUR_LINK = "/desk/?sheet-tour";

/** The Sheets tour on the Sheets page, which runs it too (E63): `?sheet-tour` on /sheets. */
export const SHEET_TOUR_PAGE_LINK = "/sheets/?sheet-tour";

/**
 * Where each tour keeps its seen list, in this browser (first-use.js reads and
 * writes them, and re-exports these names). Declared here, in the pure rules,
 * so the Sheets page can ask whether to offer its tour without loading
 * first-use.js or the tour (E63).
 */
export const TOUR_KEY = "lit-desk-tour";
/** The Study Desk tour's own list (E24), the same shape as the notebook tour's. */
export const DESK_TOUR_KEY = "lit-desk-page-tour";
/** The Sheets tour's own list (E63), the same shape again, one for both pages it runs on. */
export const SHEET_TOUR_KEY = "lit-desk-sheet-tour";

/** A stored choice, or null when there isn't a valid one. */
export function readHome(value) {
  return HOMES.includes(value) ? value : null;
}

/* ── Safari (C18) ─────────────────────────────────────────────────── */

export const SAFARI_LINE =
  "Safari can clear a site’s stored data after seven days of using Safari without visiting the site, so back up your notebook now and then.";

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
 *
 * Audit 4 (BVJ, 2026-11-07; TR4-2, TR4-3): "Open the menu" no longer explains
 * "Move as I read", which the help page and the Edit bookmark form's hint
 * cover, so the first card is five lines; and "Pin a footnote" runs in the
 * Notebook part, right after "This verse", whose tab lists the footnotes it
 * pins, rather than before the Notebook has been shown. Still 10 steps.
 *
 * Audit 7 (TR7-3, 2026-11-09): "Open the menu" names “Add to sheet”, which
 * PR #520 put in Chapter View's verse menu and selection panel after Print.
 * Read View has none, so its wording is unchanged.
 *
 * D13 (decision 22; BVJ, 2026-11-19: no tour of its own for now): "Open the
 * menu" names “Add to collection” beside “Add to sheet”, which Read View
 * lacks too, and "My Notebook, and where it’s kept" names collections. Ids
 * are unchanged, so neither is offered again as new. When the Study Desk tour
 * gained its two collection cards (decision 22's second answer, 2026-11-19),
 * "This verse" named the collections it lists, again under its own id.
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
        "Select a verse number to open its menu. The “My Notebook” row is yours: “Highlight,” “Add a note,” and “Add bookmark.” Select any words instead, and the same row works on just those words. “Add to sheet” puts the verse on one of your sheets, and “Add to collection” in one of your collections.",
      read: "Select any words. The panel that opens has a “My Notebook” row: “Highlight” while “My highlights” is on in Display options, and “Add bookmark.”",
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
        "Everything on one verse: its footnotes, your notes, the collections it’s in, and its Greek. While the Notebook is open, opening a verse’s menu moves this tab to that verse.",
    },
  },
  {
    id: "pin",
    part: 1,
    views: ["study"],
    since: "1h",
    notebook: true,
    title: "Pin a footnote",
    body: {
      default:
        "Select a footnote letter, then the thumbtack button, “Pin footnote” (it fills in once pinned), to keep that footnote in “My Notes,” under “Pinned footnotes,” where it stays in reach as you read.",
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
    title: "Undo, and Your marks",
    body: {
      default:
        "Ctrl+Z undoes your last change to the notebook, and Ctrl+Y redoes it (⌘Z and ⇧⌘Z on a Mac). Turning off “Your marks” in Display (the “Aa” button), or pressing H, clears your notes, highlights, and bookmarks from the page; turning it on brings them back.",
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
        "The search box searches your notebook as well as the text. Typing “>” lists its commands, such as hiding your marks, printing, and taking this tour again. Here it lists them.",
    },
  },
  {
    id: "kept",
    part: 2,
    views: ["study", "read", "prose"],
    since: "1d",
    notebook: true,
    title: "My Notebook, and where it’s kept",
    body: {
      default:
        "“My Notebook,” in the Settings tab, shows everything you’ve kept in one place, where you can sort it with labels, gather it into collections, and back up your notebook or merge a backup into it. Your notebook is kept in this browser, and nothing is sent anywhere. The Settings tab says when you last backed it up.",
      // In a browser that syncs, "nothing is sent anywhere" is false (step
      // 4g's list; these words are step 4j's, BVJ 2026-11-25).
      linked:
        "“My Notebook,” in the Settings tab, shows everything you’ve kept in one place, where you can sort it with labels, gather it into collections, and back up your notebook or merge a backup into it. Your notebook is kept in this browser and synced with your account, locked with a key we never have. The Settings tab says whether it is in sync, and when you last backed it up to a file.",
    },
  },
];

/**
 * The wording of a step for this view: "study", "read" or "prose". A step
 * with a `linked` wording takes it in a browser whose notebook syncs with an
 * account, whatever the view.
 * @param {{ linked?: boolean }} [opts]
 */
export function stepBody(step, view, { linked = false } = {}) {
  const { linked: whenLinked, ...b } = step.body;
  if (linked && whenLinked) return whenLinked;
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
        "Each pane shows one thing: the LIT, the Greek, your notes, and more. A pane’s name is a menu for showing something else there. Drag a pane by its header to move it, and × closes it. For the tour the desk shows its original layout, and yours comes back at the end.",
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
        "My Notes, This verse, Greek, and Footnotes follow the LIT pane. Move through the LIT, and they move with it. With two LIT panes open, as here for the tour, the one you selected most recently is marked with a flag.",
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
  // Sheets (E59; BVJ, 2026-11-08): what one is, with a Sheets pane shown. Its
  // link opens the Sheets tour (Audit 7, TR7-5), as My Notes' opens the
  // notebook tour.
  {
    id: "sheets",
    part: 0,
    since: "e59",
    title: "Sheets",
    body: {
      default:
        "A sheet is a handout you make here: passages from the LIT, your own words, questions, and blanks to fill in. Print it, present it to a room, or share it as a link or a file. A Sheets pane is shown here only for the tour.",
    },
    more: "See one made, printed, and presented: the Sheets tour",
  },
  // Collections (D13, decision 22's second answer; BVJ, 2026-11-19: "Add to
  // the desk tour"): what one is, with a Collections pane shown as the Sheets
  // card shows a Sheets pane, then the way in from the LIT pane, which this
  // tour shows nowhere else. Both are new ids, so a reader who has taken the
  // tour is offered the two of them. The rest (orders, headings, a label's
  // bookmarks) is the help page's, where the first card's link goes.
  {
    id: "collections",
    part: 0,
    since: "d13",
    notebook: true,
    title: "Collections",
    body: {
      default:
        "A collection gathers notes, highlights, bookmarks, sheets, and passages for one purpose, such as a class or a sermon series. Nothing is copied: change a note, and the collection shows the change. Select a reference in one, and the LIT pane goes there; “Add to sheet…” puts it all on a sheet. A Collections pane is shown here only for the tour.",
    },
    more: "More on the help page: How collections work",
  },
  {
    id: "collect",
    part: 0,
    since: "d13",
    notebook: true,
    title: "Adding to a collection",
    body: {
      default:
        "Select a verse number in the LIT pane to open its menu: “Add to collection” puts the verse in one of your collections, or a new one. In My Notes, a row’s “Collections…” does the same for what you’ve kept, and a collection’s own “Add” brings in a sheet or a label’s bookmarks. Nothing is added here.",
    },
  },
  // The commands moved out of the title menu into a row under the header
  // (E68, 2026-11-10), so this card is new since then and offered again.
  {
    id: "title",
    part: 1,
    since: "e68",
    title: "The commands",
    body: {
      default:
        "Under the header: Add pane, Layout, New sheet, New collection, Print, and Help. “Study Desk” above them is a menu for the rest: display options, full screen, My Notebook, and this tour.",
    },
  },
  // How a sheet starts (E59): the command row's "New sheet…" and its template
  // chooser. It names no count of templates (Audit 7, TR7-1: it listed five
  // when there were seven), so it needn't follow the template module.
  {
    id: "newsheet",
    part: 1,
    since: "e59",
    notebook: true,
    title: "New sheet",
    body: {
      default:
        "“New sheet…” under the header starts one. Choose a template, from a Bible study to lectio divina, or a blank canvas, and the sheet opens with its parts ready to fill. The chooser is open here only for the tour; nothing is made.",
    },
  },
  {
    id: "add",
    part: 1,
    since: "e24",
    title: "Add pane",
    body: {
      default:
        `Add a column at the right or a row along the bottom, then choose what it shows. ${numberWord(MAX_PANES, { capital: true })} panes fit when the window has room. A pane is added here only for the tour.`,
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

/* ── The Sheets tour (E63) ───────────────────────────────────────── */

/**
 * The Sheets tour's parts. It runs on /desk, in a Sheets pane
 * (desk/sheets/sheet-tour.js; BVJ, 2026-11-09: "a third tour for Sheets is
 * warranted, though it will likely be shorter"), and is a tour of its own,
 * as the Study Desk tour is: its own steps, its own seen list
 * (`lit-desk-sheet-tour`, the same shape) and its own offer.
 */
export const SHEET_TOUR_PARTS = ["Making a sheet", "Using a sheet"];

/**
 * The steps, in order. Like the Study Desk tour's they have no `views`, and
 * they act on the real page and leave nothing behind: the sheet the tour shows
 * is made in memory and never written. Every step is `notebook`, since a sheet
 * is a notebook record: where the browser keeps none there is no tour. The ids
 * may not collide with the other two tours' (a test holds it).
 *
 * It runs on /desk and on the Sheets page (BVJ, 2026-11-09), the same eight
 * steps under the same ids, so one seen list serves both. `default` is the
 * desk's wording, and `page` the Sheets page's where the two differ: the page
 * has no LIT pane, and its versions view stands for the pane's "Print or
 * share…" and "Present…" (stepBody(step, "page")).
 *
 * "Your own words, and more" names the whole collection “From my notes…”
 * offers (E181), added with the Study Desk tour's collection cards
 * (2026-11-19) under its own id, so it is not offered again as new.
 */
export const SHEET_TOUR_STEPS = [
  {
    id: "list",
    part: 0,
    since: "e63",
    notebook: true,
    title: "My sheets",
    body: {
      default:
        "A sheet gathers passages and your own words into a handout for a study, a class, or a sermon. Yours are listed here and on the Sheets page: open one to work on it, “Duplicate” it, or “Delete” it. A Sheets pane is shown here only for the tour.",
      page:
        "A sheet gathers passages and your own words into a handout for a study, a class, or a sermon. Yours are listed here, and in the Study Desk’s Sheets pane, where the LIT sits beside them. Open one to print, present, or share it, and “Edit” beside it to work on it, or “Duplicate” or “Delete” it. A file someone sent you opens with “Import a sheet file.”",
    },
  },
  {
    id: "templates",
    part: 0,
    since: "e63",
    notebook: true,
    title: "Start from a template",
    body: {
      default:
        "“New sheet” offers templates, each a way of meeting a text: a Bible study, sermon preparation, a class session, lectio divina, and more, or a blank canvas. A sheet you keep with “Save as template,” at the top of a sheet you are editing, is offered here too. Nothing is written until your first change, so you can open each and look.",
      page:
        "“New sheet…” offers templates, each a way of meeting a text: a Bible study, sermon preparation, a class session, lectio divina, and more, or a blank canvas. A sheet you keep with “Save as template,” at the top of a sheet you are editing, is offered here too. Nothing is written until your first change, so you can open each and look.",
    },
  },
  {
    id: "parts",
    part: 0,
    since: "e63",
    notebook: true,
    title: "The parts",
    body: {
      default:
        "A sheet is a column of parts. A template’s parts start empty, with dimmed words saying what goes in each; those never print. Drag a part by its header to move it, and × removes it. In the header, “Leader only” keeps a part off the participant’s version, and the box beside it plans its minutes. This sheet is the tour’s, and is never saved.",
    },
  },
  {
    id: "passage",
    part: 0,
    since: "e63",
    notebook: true,
    title: "Add a passage",
    body: {
      default:
        "In the LIT pane, “Add to sheet” in a verse’s menu lists your sheets, with “New sheet…” to start one, and selected words add just those words. Or type a reference in the form under “Reading.” On a Scripture page, the verse menu has “Add to sheet” as well.",
      page:
        "Type a reference in the form under “Reading,” or choose one of your notes, highlights, or bookmarks listed beneath it. In the Study Desk’s LIT pane and on a Scripture page, a verse’s menu has “Add to sheet,” which lists your sheets.",
    },
  },
  {
    id: "blanks",
    part: 0,
    since: "e63",
    notebook: true,
    title: "Blanks and footnotes",
    body: {
      default:
        "A passage shows today’s wording of the LIT, and the sheet says when it changes. Under “Fill in the blank,” choose a key term, or select words and “Blank,” to leave a gap for the group to fill in, with a hint beneath it if you like. “Footnotes” chooses which of the LIT’s notes print. A passage was added here for the tour.",
    },
  },
  {
    id: "words",
    part: 0,
    since: "e63",
    notebook: true,
    title: "Your own words, and more",
    body: {
      default:
        "The row under the parts adds the rest: your text, a question with lines to write on (and an answer on the leader’s version), space, a page break, and a key terms box filled in from the passages. “From my notes…” brings your notes, highlights, and pinned footnotes on these passages onto the sheet, or a whole collection at once. Point between two parts, and an “Add” pill puts one right there.",
    },
  },
  {
    id: "print",
    part: 1,
    since: "e63",
    notebook: true,
    title: "Print or share",
    body: {
      default:
        "“Print or share” opens the sheet’s own page in a new tab. There you choose the leader’s version or the participant’s, which leaves out the answers and the “Leader only” parts, and print it on Letter or A4, copy it into Word, save it as a document, or share it as a link or a file.",
      page:
        "“Preview” brings a sheet to its own page, this one, as it prints. Choose the leader’s version or the participant’s, which leaves out the answers and the “Leader only” parts, then print it on Letter or A4, copy it into Word, save it as a document, or share it as a link or a file. “Edit” goes back to the parts.",
    },
  },
  {
    id: "present",
    part: 1,
    since: "e63",
    notebook: true,
    title: "Present",
    body: {
      default:
        "“Present” shows the sheet to a room, full screen, one part at a time, with a passage’s blanks uncovered as you choose. A presenter view on your own screen keeps your notes and the minutes you planned, and stays in step with the room.",
    },
  },
];
