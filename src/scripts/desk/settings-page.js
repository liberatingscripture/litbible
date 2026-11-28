// src/scripts/desk/settings-page.js
//
// Study's part of All settings (/settings; SITE-FEATHERBOA.md, "All
// settings" and "All settings holds the rest"), drawn into
// [data-settings-page] under the keyboard shortcuts every reader gets
// (src/scripts/settings-page.js). Loaded by desk-gate.js only where Study is
// on, so a reader without it downloads none of this. Top to bottom:
//   - Your marks: the switch the Display tray holds, then its finer choices,
//     Notes in the margin, Bookmarks, and Highlights (DI-13; note-settings.js).
//   - Back up your notebook, and Merge a backup (DI-21; export-import.js,
//     the same section as My Notebook's).
//   - Account: a link to the account pages, which this doesn't replace, only
//     where accounts are open in this browser (DI-21, AC-22).
//   - The Notebook panel: how it starts on each page (NB-25;
//     src/lib/desk-start.mjs), which was My Notebook's until Phase 4.
//   - Delete in bulk, last, in red words (NB-26, NB-27): today's four
//     choices, each asking again on the page before it acts, named as the
//     record names them (NB-19: "notes, highlights, and bookmarks," never
//     "marks," for the things kept). They were My Notebook's until Phase 4.
// Every write goes through the store, so Ctrl+Z undoes a deletion and the
// undo bar offers it back; emptying the trash is the one that can't be
// undone. The page follows the other tabs (store.subscribe).

import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { mountBackup } from "./export-import.js";
import { createHistory, undoEntry } from "./history.js";
import { initNoteSettings, settingsMarkControls } from "./note-settings.js";
import { openStore } from "./store.js";
import { initUndo, showUndo } from "./undo-bar.js";
import { el } from "./dom.js";
import { plural } from "./desk-text.js";
import {
  bulkCounts,
  planDeleteCollections,
  planDeleteMarks,
  planDeleteSheets,
  planEmptyTrashNow,
  trashHeld,
} from "../../lib/desk-notebook.mjs";
import { START_KEY, shownStartChoices, startChoice } from "../../lib/desk-start.mjs";
import { planWrite, QUIET_KINDS } from "../../lib/desk-store-core.mjs";
import { TRASH_DAYS } from "../../lib/desk-records.mjs";
import { SYNC_META, readLink } from "../../lib/desk-sync-link.mjs";

const NO_NOTEBOOK =
  "This browser isn’t letting the site keep a notebook, so there is nothing to back up or delete here. Private windows sometimes don’t. Open the site in a regular window to keep notes.";

/** A section of the page, `#id`, named by its heading. */
function section(id, title) {
  const box = el("section", "settings-page__section");
  box.id = id;
  box.dataset.settingsSection = id;
  const h2 = el("h2", "settings-page__h2", title);
  h2.id = `settings-${id}-title`;
  box.setAttribute("aria-labelledby", h2.id);
  box.append(h2);
  return box;
}

/* ── How the Notebook panel starts ─────────────────────────────── */

const readStart = () => {
  try {
    return startChoice((k) => localStorage.getItem(k));
  } catch {
    return "left";
  }
};

function writeStart(value) {
  try {
    if (value === "left") localStorage.removeItem(START_KEY);
    else localStorage.setItem(START_KEY, value);
  } catch {
    /* storage refused: the choice reads back as it was */
  }
}

/**
 * "When a page opens, the Notebook panel is" Open, Minimized, or As I left it
 * (NB-25), as a row of choices (the kit's, as the Display tray's Theme): one
 * press each, the arrow keys and Home and End moving the choice along it.
 * "Closed" shows too for a reader who chose it before the Notebook lost its
 * Close (shownStartChoices), and stays for the visit once they pick another.
 */
export function startChoices() {
  const wrap = el("div", "settings-page__start");
  const label = el("p", "settings-page__label", "When a page opens, the Notebook panel is");
  label.id = "settingsStartLabel";
  const group = el("div", "kit-choices");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", label.id);
  group.dataset.settingsChoices = "start";
  for (const { value, label: words } of shownStartChoices(readStart())) {
    const b = el("button", "kit-tab", words);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.settingsChoice = value;
    group.append(b);
  }
  const items = () => Array.from(group.querySelectorAll('[role="radio"]'));
  const sync = () => {
    const now = readStart();
    for (const b of items()) {
      const on = b.dataset.settingsChoice === now;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  const pick = (b) => {
    writeStart(b.dataset.settingsChoice);
    sync();
  };
  group.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest('[role="radio"]') : null;
    if (b && group.contains(b)) pick(b);
  });
  group.addEventListener("keydown", (e) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    if (at < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let to;
    if (step) to = (at + step + list.length) % list.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = list.length - 1;
    else return;
    e.preventDefault();
    list[to].focus();
    pick(list[to]);
  });
  window.addEventListener("storage", (e) => {
    if (e.key === START_KEY || e.key === null) sync();
  });
  sync();
  const note = el(
    "p",
    "settings-page__note",
    "“As I left it” starts minimized, then follows what you last did: a panel you minimize stays minimized, and one you open out stays open.",
  );
  wrap.append(label, group, note);
  return wrap;
}

/* ── Delete in bulk ────────────────────────────────────────────── */

const FAILED = "That couldn’t be saved in this browser, so nothing was deleted. Try again.";

/** The four choices (NB-27), in the record's order, with the words each says. */
const BULK = [
  {
    key: "marks",
    title: "Delete all notes, highlights, and bookmarks",
    about: "Every note, highlight, bookmark, pinned footnote, and label. Your sheets, templates, and collections stay.",
    count: (counts) => counts.marks,
    button: "Delete all notes, highlights, and bookmarks…",
    none: "There are no notes, highlights, or bookmarks to delete.",
    question: (n) =>
      `Are you sure? This moves ${plural(n, "item", "items")} (every note, highlight, bookmark, pinned footnote, and label) to the trash. Your sheets, templates, and collections stay.`,
    confirm: "Delete all notes, highlights, and bookmarks",
    failed: FAILED,
    plan: planDeleteMarks,
    said: (n) => `All notes, highlights, and bookmarks deleted: ${plural(n, "item", "items")} moved to the trash.`,
  },
  {
    key: "sheets",
    title: "Delete all sheets",
    about: "Every sheet, and your own templates. Your notes, highlights, bookmarks, and collections stay.",
    count: (counts) => counts.sheets,
    button: "Delete all sheets…",
    none: "There are no sheets to delete.",
    question: (n) =>
      `Are you sure? This moves ${plural(n, "sheet", "sheets")} (templates included) to the trash. Your notes, highlights, bookmarks, and collections stay.`,
    confirm: "Delete all sheets",
    failed: FAILED,
    plan: planDeleteSheets,
    said: (n) => `All sheets deleted: ${plural(n, "sheet", "sheets")} moved to the trash.`,
  },
  {
    key: "collections",
    title: "Delete all collections",
    about: "Every collection. What’s in them stays in your notebook.",
    count: (counts) => counts.collections,
    button: "Delete all collections…",
    none: "There are no collections to delete.",
    question: (n) => `Are you sure? This moves ${plural(n, "collection", "collections")} to the trash. What’s in them stays in your notebook.`,
    confirm: "Delete all collections",
    failed: FAILED,
    plan: planDeleteCollections,
    said: (n) => `All collections deleted: ${plural(n, "collection", "collections")} moved to the trash.`,
  },
  {
    key: "trash",
    title: "Empty the trash now",
    about: `For a shared computer. Wipes the words of everything in the trash at once, instead of after ${TRASH_DAYS} days. Only a record that each item was deleted stays. This can’t be undone.`,
    count: (_counts, held) => held,
    button: "Empty the trash now…",
    none: "The trash is empty.",
    question: (n) => `Are you sure? The words of ${plural(n, "deleted item", "deleted items")} will be gone for good. This can’t be undone.`,
    confirm: "Empty the trash now",
    failed: "That couldn’t be saved in this browser, so nothing was wiped. Try again.",
    plan: null,
    said: (n) => `The trash is empty. The words of ${plural(n, "item", "items")} are gone.`,
  },
];

/**
 * Delete in bulk, in `box`: each choice a red button that asks again in its
 * place, Cancel first under the reader's hand, and the question kept open
 * (its number brought up to date) while other tabs change the notebook.
 * Returns `draw(records)`, which the page calls whenever the records change.
 */
function mountBulk(box, { store, announce }) {
  const lede = el(
    "p",
    "",
    `Each moves what it names in this browser to the trash. Choose Undo (or press Ctrl+Z, ⌘Z on a Mac) to bring it back until you leave the page, or restore it from the notebook’s `,
  );
  const trashLink = el("a", "", "Trash");
  trashLink.href = "/notebook/#trash";
  lede.append(trashLink, `. The trash keeps each item for ${TRASH_DAYS} days, then only a record that it was deleted.`);
  box.append(lede);

  const states = new Map();
  for (const spec of BULK) {
    const part = el("div", "settings-page__danger");
    const h3 = el("h3", "settings-page__h3", spec.title);
    const slot = el("div");
    slot.dataset.settingsDelete = spec.key;
    part.append(h3, el("p", "", spec.about), slot);
    box.append(part);
    states.set(spec.key, { slot, asking: false, count: 0 });
  }

  let latest = [];
  let seq = 0;

  function draw(records) {
    latest = records;
    const counts = bulkCounts(records);
    const held = trashHeld(records);
    for (const spec of BULK) drawOne(spec, states.get(spec.key), spec.count(counts, held));
  }

  function drawOne(spec, state, count) {
    state.count = count;
    if (state.asking && count > 0) {
      // Keep the question open, but bring its number up to date.
      state.slot.querySelector(".settings-page__ask-text").textContent = spec.question(count);
      return;
    }
    state.asking = false;
    if (count <= 0) {
      state.slot.replaceChildren(el("p", "settings-page__none", spec.none));
      return;
    }
    const ask = el("button", "kit-btn kit-btn--danger", spec.button);
    ask.type = "button";
    ask.addEventListener("click", () => openAsk(spec, state));
    state.slot.replaceChildren(ask);
  }

  function openAsk(spec, state) {
    state.asking = true;
    const group = el("div", "settings-page__ask");
    group.setAttribute("role", "group");
    const text = el("p", "settings-page__ask-text", spec.question(state.count));
    // The group is named by the question, so it is read when focus lands on Cancel (NB-10).
    text.id = `settingsAsk-${++seq}`;
    group.setAttribute("aria-labelledby", text.id);
    const failed = el("p", "settings-page__error");
    failed.setAttribute("role", "alert");
    failed.hidden = true;
    const yes = el("button", "kit-btn kit-btn--danger", spec.confirm);
    yes.type = "button";
    const no = el("button", "kit-btn kit-btn--plain", "Cancel");
    no.type = "button";
    const buttons = el("div", "settings-page__ask-buttons");
    buttons.append(yes, no);
    group.append(text, failed, buttons);
    state.slot.replaceChildren(group);
    // Cancel first: the safe answer is the one under the reader's hand.
    no.focus();
    no.addEventListener("click", () => {
      state.asking = false;
      draw(latest);
      state.slot.querySelector("button")?.focus();
    });
    group.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !e.isComposing) {
        e.stopPropagation();
        no.click();
      }
    });
    yes.addEventListener("click", async () => {
      // Busy, not disabled, so focus stays on it while the write runs (NB8-8).
      if (yes.getAttribute("aria-disabled") === "true") return;
      yes.setAttribute("aria-disabled", "true");
      state.asking = false;
      const done = await run(spec);
      if (done === false) {
        // Nothing was written: the question stays, with the reason, ready to ask again (GF8a-2).
        state.asking = true;
        failed.textContent = spec.failed;
        failed.hidden = false;
        yes.removeAttribute("aria-disabled");
        yes.focus();
        return;
      }
      // The button is gone: focus lands on what took its place, the line
      // saying there is nothing left to delete (or the button again, if
      // another tab added something meanwhile).
      const now = state.slot.querySelector(".settings-page__none, button");
      if (now && !now.matches("button")) now.tabIndex = -1;
      now?.focus();
    });
  }

  /**
   * Plan over the notebook as it is and write, in one transaction (DI-9), so
   * another tab's write between the read and the write can't be overwritten
   * from a stale copy. false when the browser refused the write.
   */
  async function writeOver(make, { record = true } = {}) {
    let plan = null;
    try {
      await store.change(
        async ({ all }) => {
          plan = make(await all());
          return plan.put.length || plan.remove.length ? planWrite(plan) : null;
        },
        { record },
      );
    } catch (err) {
      console.error("Study: the notebook write failed", err);
      return false;
    }
    return plan;
  }

  async function run(spec) {
    if (!spec.plan) {
      // Not remembered for undo: undoing it would bring back what it was for.
      const plan = await writeOver((records) => planEmptyTrashNow(records), { record: false });
      if (plan === false) return false;
      draw(await store.all());
      if (plan.put.length) announce(spec.said(plan.put.length));
      return true;
    }
    const plan = await writeOver((records) => spec.plan(records, ctx()));
    if (plan === false) return false;
    const entry = plan.remove.length ? store.lastEntry() : null;
    draw(await store.all());
    if (!plan.remove.length) return true;
    const message = spec.said(plan.remove.length);
    // The undo bar speaks the message itself, with the key that undoes it,
    // so the page's own status says it only when there is no bar.
    if (!entry) {
      announce(message);
      return true;
    }
    showUndo(message, async () => {
      await undoEntry(entry);
      draw(await store.all());
    });
    return true;
  }

  return draw;
}

/* ── The page ──────────────────────────────────────────────────── */

async function start() {
  const root = document.querySelector("[data-settings-page]");
  if (!root) return;
  addDeskStyle();
  initNoteSettings();
  root.replaceChildren();

  const status = el("p", "sr-only");
  status.setAttribute("role", "status");
  const announce = (message) => {
    status.textContent = "";
    setTimeout(() => (status.textContent = message), 50);
  };

  const marks = section("marks", "Your marks");
  marks.append(settingsMarkControls());
  root.append(marks);

  let store = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    console.error("Study: the notebook didn’t open", err);
  }

  let backup = null;
  if (store) {
    initUndo();
    createHistory({ store, ctx });
    let linked = false;
    try {
      linked = readLink(await store.getMeta(SYNC_META)) != null;
    } catch {
      /* unread: the words for a notebook kept here alone */
    }
    // The section's own heading, "Back up your notebook," is export-import.js's.
    backup = el("section", "settings-page__section desk-backup");
    backup.id = "backup";
    backup.dataset.settingsSection = "backup";
    backup.setAttribute("aria-labelledby", "deskBackupTitle");
    root.append(backup);
    mountBackup(backup, { store, ctx, linked });
  }

  if (document.documentElement.dataset.account === "open") {
    const account = section("account", "Account");
    const line = el("p", "", "Sign in, set up your synced notebook, and manage your devices in ");
    const link = el("a", "", "Account and devices");
    link.href = "/account/";
    line.append(link, ".");
    account.append(line);
    root.append(account);
  }

  const panel = section("panel", "The Notebook panel");
  panel.append(startChoices());
  root.append(panel);

  const bulk = section("delete-in-bulk", "Delete in bulk");
  root.append(bulk, status);
  if (!store) {
    bulk.append(el("p", "settings-page__none", NO_NOTEBOOK));
    return;
  }
  const draw = mountBulk(bulk, { store, announce });

  let seq = 0;
  let known = new Set();
  const render = async () => {
    const mine = ++seq;
    const records = await store.all();
    if (mine !== seq) return;
    known = new Set(records.map((r) => r?.id));
    draw(records);
  };
  // A bookmark moving as the reader reads in another tab isn't a reason to
  // redraw (BA107), and neither is a reading place moving; a new place is,
  // since the first choice counts it (as My Notebook's counts did).
  store.subscribe(() => render(), { except: QUIET_KINDS });
  store.subscribe((ids) => {
    if (ids.some((id) => !known.has(id))) render();
  }, { kinds: ["place"] });
  await render();

  // The page is drawn after the browser has looked for the address's #part
  // (#backup, #delete-in-bulk), so go to it now. A fragment that isn't valid
  // percent-encoding names no part and is left alone (SEC4-2).
  let id = "";
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    /* no part */
  }
  const target = id && document.getElementById(id);
  if (target && root.contains(target)) target.scrollIntoView({ block: "start" });
}

// A failure after the import is only logged, as My Notebook's is: what was
// drawn stays, and the gate stands down only when the module can't load.
export const ready = start().catch((err) => console.error("Study: All settings didn’t draw", err));
