// src/scripts/desk/notebook-search.js
//
// The Study Desk's part of the site's search (STUDY-DESK.md, D2 and D3): the
// "Your notebook" group of matches from the reader's own notebook, and the
// "Commands" group. The search tray (searchbar.js) and
// /search (search.js) reach this file only through loadDeskSearch() in
// search-core.js, which imports it only when <html data-desk="on">, so a
// reader without the preview downloads none of it, and it is the only place
// either of them meets the notebook.
//
// Everything happens in this browser. The notebook is read straight out of
// IndexedDB and searched here (src/lib/desk-search.mjs); the query is never
// sent anywhere. The database is opened read-only and is never created from
// here: a reader who has not written anything yet has no `lit-desk` database,
// and a search must not make one (store.js owns its creation and upgrades). A
// page that also runs the desk's shell has the database open already, and the
// two simply share it.
//
// What the reader wrote is only ever drawn as text (nodes built with
// textContent), never as HTML.

import deskCss from "../../styles/desk.css?inline";
import { isCommandQuery, matchCommands } from "../../lib/desk-commands.mjs";
import { notebookSearchHref, searchNotebook } from "../../lib/desk-search.mjs";
import { readingSurface } from "../desk-frame.js";
import { pageChapter } from "./page.js";

export { isCommandQuery };

/** How many matches the tray lists before "N more in your notebook". */
export const TRAY_LIMIT = 4;
/** How many /search shows before "Show N more". */
const PAGE_LIMIT = 10;

const DB_NAME = "lit-desk";
const RECORDS = "records";

/* ── Styles ──────────────────────────────────────────────────────────── */

// /search and the home page's search strip aren't pages the shell runs on, so
// the desk's styles come in with this file; on a reading surface the shell has
// them already. A second copy would change nothing.
function ensureStyles() {
  if (document.querySelector("style[data-desk], style[data-desk-search]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-desk-search", "");
  style.textContent = deskCss;
  document.head.append(style);
}

/* ── Reading the notebook ────────────────────────────────────────────── */

let connection = null;

/**
 * The notebook's database if it exists, or null. Opening without a version
 * and aborting the upgrade that fires when there is nothing to open is how
 * "open it if it's there" is asked of IndexedDB without creating it.
 */
function openExisting() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME);
    } catch (_) {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS)) {
        db.close();
        resolve(null);
        return;
      }
      // A newer site opening the database in another tab waits for this one.
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readRecords() {
  connection ||= await openExisting();
  if (!connection) return [];
  try {
    const tx = connection.transaction(RECORDS, "readonly");
    return await new Promise((resolve, reject) => {
      const all = tx.objectStore(RECORDS).getAll();
      all.onsuccess = () => resolve(all.result ?? []);
      all.onerror = () => reject(all.error);
    });
  } catch (_) {
    // A connection closed by a version change, or a browser that refuses.
    connection = null;
    return [];
  }
}

// "Hide my notes" (M1) as it stands in the saved settings. note-settings.js
// has the same test over the attributes it stamps on <html>, but it runs only
// where the desk's shell does, and this file also runs on /search; the saved
// values are what the attributes mirror. Read View's highlights are off by
// default, so only "on" counts as showing.
function notesHidden() {
  const get = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  };
  return (
    get("lit-desk-notes") === "off" &&
    get("lit-desk-bookmarks") === "off" &&
    get("lit-desk-highlights") === "off" &&
    get("lit-desk-read-highlights") !== "on"
  );
}

/**
 * Search the notebook for a query. Resolves to { hits, total }: the matches
 * (none while "Hide my notes" is on) and their count. `bookKey` is the search
 * box's book filter.
 */
export async function search(query, { bookKey = "" } = {}) {
  const records = await readRecords();
  const hits = notesHidden() ? [] : searchNotebook(records, query, { bookKey });
  return { hits, total: hits.length };
}

/* ── Commands ────────────────────────────────────────────────────────── */

function commandContext() {
  return {
    surface: Boolean(readingSurface()),
    study: Boolean(pageChapter()),
    panelOpen: document.documentElement.hasAttribute("data-desk-panel"),
    hidden: notesHidden(),
  };
}

/** The commands a query reaches here (desk-commands.mjs), or none. */
export function commandsFor(query) {
  return matchCommands(query, commandContext());
}

/** Run a command that isn't a link: the desk's shell listens (commands.js). */
export function runCommand(id) {
  document.dispatchEvent(new CustomEvent("lit:desk-command", { detail: { id } }));
}

/* ── Drawing ─────────────────────────────────────────────────────────── */

/** Append a snippet's parts: plain text, and <mark> around the matches. */
function appendParts(el, parts) {
  for (const part of parts) {
    if (part.mark) {
      const mark = document.createElement("mark");
      mark.textContent = part.text;
      el.append(mark);
    } else {
      el.append(document.createTextNode(part.text));
    }
  }
}

function commandItem(command, onRun) {
  const li = document.createElement("li");
  li.className = "searchbar__result";
  const el = document.createElement(command.href ? "a" : "button");
  el.className = "searchbar__link desk-command";
  el.dataset.deskCommand = command.id;
  if (command.href) {
    el.href = command.href;
  } else {
    el.type = "button";
    el.addEventListener("click", () => onRun(command));
  }
  const name = document.createElement("span");
  name.className = "searchbar__title";
  name.textContent = command.name;
  el.append(name);
  if (command.hint) {
    const hint = document.createElement("span");
    hint.className = "desk-command__hint";
    hint.textContent = command.hint;
    el.append(hint);
  }
  li.append(el);
  return li;
}

function groupShell(title) {
  const group = document.createElement("div");
  group.className = "searchbar__group";
  const heading = document.createElement("div");
  heading.className = "searchbar__group-title";
  heading.textContent = title;
  const list = document.createElement("ol");
  list.className = "searchbar__results";
  group.append(heading, list);
  return { group, list };
}

function trayHit(hit) {
  const li = document.createElement("li");
  li.className = "searchbar__result";
  const el = document.createElement(hit.href ? "a" : "div");
  el.className = "searchbar__link desk-hit";
  if (hit.href) el.href = hit.href;
  const title = document.createElement("div");
  title.className = "searchbar__title";
  title.textContent = hit.reference;
  const kind = document.createElement("span");
  kind.className = "desk-hit__kind";
  kind.textContent = hit.label;
  title.append(kind);
  const snippet = document.createElement("div");
  snippet.className = "desk-hit__snippet";
  appendParts(snippet, hit.parts);
  el.append(title, snippet);
  li.append(el);
  return li;
}

/**
 * Put the Commands group, then the Your notebook group, at the top of the
 * tray's results (`host` is its groups element, which the tray empties before
 * each search). `commands` is commandsFor()'s answer; `notebook` is search()'s;
 * `onRun(command)` is what a command button does.
 */
export function renderTray(host, { commands = [], notebook = null, query = "", onRun = () => {} } = {}) {
  ensureStyles();
  const groups = [];

  if (commands.length) {
    const { group, list } = groupShell("Commands");
    group.dataset.deskCommands = "";
    for (const c of commands) list.append(commandItem(c, onRun));
    groups.push(group);
  }

  if (notebook?.total) {
    const { group, list } = groupShell("Your notebook");
    group.dataset.deskNotebook = "";
    for (const hit of notebook.hits.slice(0, TRAY_LIMIT)) list.append(trayHit(hit));
    const rest = notebook.total - TRAY_LIMIT;
    if (rest > 0) {
      const more = document.createElement("a");
      more.className = "desk-more";
      more.href = notebookSearchHref(query);
      more.textContent = `${rest} more in your notebook`;
      group.append(more);
    }
    groups.push(group);
  }

  host.prepend(...groups);
}

/**
 * Fill /search's "Your notebook" group (`list` is its <ol>): every match,
 * the first PAGE_LIMIT showing and the rest behind "Show N more", in the
 * same cards the page's other groups use.
 */
export function renderPageGroup(list, notebook) {
  ensureStyles();
  list.replaceChildren();
  list.parentElement?.querySelector(".desk-see-more")?.remove();

  notebook.hits.forEach((hit, i) => {
    const li = document.createElement("li");
    li.className = "result";
    if (i >= PAGE_LIMIT) li.classList.add("result--collapsed");
    const el = document.createElement(hit.href ? "a" : "div");
    el.className = "result-link";
    if (hit.href) el.href = hit.href;
    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = hit.reference;
    const kind = document.createElement("span");
    kind.className = "desk-hit__kind";
    kind.textContent = hit.label;
    title.append(kind);
    const excerpt = document.createElement("div");
    excerpt.className = "result-excerpt";
    appendParts(excerpt, hit.parts);
    el.append(title, excerpt);
    li.append(el);
    list.append(li);
  });

  const extra = notebook.total - PAGE_LIMIT;
  if (extra > 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "see-more-btn desk-see-more";
    button.textContent = `Show ${extra} more`;
    button.addEventListener("click", () => {
      const first = list.querySelector(".result--collapsed a, .result--collapsed .result-link");
      list.querySelectorAll(".result--collapsed").forEach((li) => li.classList.remove("result--collapsed"));
      button.remove();
      first?.focus?.({ preventScroll: false });
    });
    list.after(button);
  }
}
