// src/lib/desk-first-stage.mjs
//
// The rules of the desk's first stage (src/scripts/desk/first-stage.js;
// Audit 3, LG3-2; BVJ, 2026-11-07, decision 3): a reading page loads only the
// Notebook's tab and a look at the notebook, and the rest of the desk (the
// shell and desk.css) only when there is something to draw or the reader
// reaches for it. Pure, apart from the IndexedDB read, which is handed its
// factory, so the tests run it against fake-indexeddb.

// The notebook's database, as src/scripts/desk/store.js opens it, and its
// change channel (CHANNEL in desk-store-core.mjs). Repeated here so the first
// stage needn't import either; test/desk-first-stage.test.js holds them equal.
export const DB_NAME = "lit-desk";
export const RECORDS = "records";
export const CHAPTER_INDEX = "chapter";
export const CHANNEL = "lit-desk";
// FOLLOW_FLAG_KEY in desk-bookmarks.mjs: a bookmark this tab follows.
export const FOLLOW_KEY = "lit-desk-follow";
// URL parameters the shell acts on as the page loads: a Greek search result
// (greek-link.js), the tour (tour.js) and a print link from /desk
// (print-link.js; PRINT_PARAM in desk-print-notes.mjs).
export const LOAD_PARAMS = ["greek", "desk-tour", "print"];

/** How long the look at the notebook may take before the shell is loaded anyway. */
export const PEEK_TIMEOUT_MS = 3000;

/**
 * Why the shell loads at once, or null when the first stage can wait.
 * @param {{ start: { open: boolean, minimized: boolean },
 *   session: (key: string) => string | null, params: URLSearchParams }} page
 *   `start` is startState's answer (src/lib/desk-start.mjs)
 */
export function loadAtOnce({ start, session, params }) {
  if (start.open && !start.minimized) return "expanded";
  if (session(FOLLOW_KEY) != null) return "following";
  const p = LOAD_PARAMS.find((name) => params.has(name));
  return p ? `param:${p}` : null;
}

/**
 * The key range of the records drawn on this page, by the store's `chapter`
 * index ([bookKey, chapter]): one chapter in Chapter View, a whole book in
 * Read View. `IDBKeyRange` is passed in (the browser's or fake-indexeddb's).
 */
export function drawnRange(where, KeyRange) {
  if (!where?.bookKey) return null;
  if (Number.isInteger(where.chapter)) return KeyRange.only([where.bookKey, where.chapter]);
  // Every [bookKey, n]: an array sorts above every number, so [bookKey, []]
  // closes the range after the book's last chapter.
  return KeyRange.bound([where.bookKey], [where.bookKey, []]);
}

/**
 * Whether the notebook holds anything this page draws: true, false, or null
 * when it can't tell (the caller then loads the shell, which says what went
 * wrong as it always has). Never creates the database: a browser that has
 * kept nothing has none, and opening it without a version would make an
 * empty one the store's own open (version 1) would then find with no tables.
 * So creation is aborted, which leaves nothing behind.
 *
 * @param {{ idb: IDBFactory, KeyRange: typeof IDBKeyRange,
 *   where: { bookKey: string, chapter?: number } | null, timeout?: number }} options
 */
export function peekNotebook({ idb, KeyRange, where, timeout = PEEK_TIMEOUT_MS }) {
  if (!where) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (answer, db = null) => {
      try { db?.close(); } catch (_) {}
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(answer);
    };
    const timer = setTimeout(() => finish(null), timeout);
    let open;
    try {
      open = idb.open(DB_NAME);
    } catch (_) {
      finish(null);
      return;
    }
    let created = false;
    open.onupgradeneeded = () => {
      created = true;
      open.transaction.abort();
    };
    open.onerror = (e) => {
      e?.preventDefault?.();
      finish(created ? false : null);
    };
    open.onsuccess = () => {
      const db = open.result;
      if (done) return finish(null, db);
      try {
        if (!db.objectStoreNames.contains(RECORDS)) return finish(null, db);
        const req = db
          .transaction(RECORDS, "readonly")
          .objectStore(RECORDS)
          .index(CHAPTER_INDEX)
          .count(drawnRange(where, KeyRange));
        req.onsuccess = () => finish(req.result > 0, db);
        req.onerror = () => finish(null, db);
      } catch (_) {
        finish(null, db);
      }
    };
  });
}

/**
 * How far to move a floating panel (lit-panel.js) that grew after it was
 * placed, when the desk's rows arrive late, in px (negative is up), placing it
 * again as `showPanel` would. One placed above what opened it grows upward, so
 * the text it sat above stays clear, or goes below that text when there is no
 * longer room above; one below stays, moved up only as far as the window's
 * foot needs. Either way it is kept `edge` inside the window, its top winning.
 * Window coordinates.
 *
 * @param {{ before: { top: number, bottom: number }, after: { top: number, bottom: number },
 *   trigger: { top: number, bottom: number } | null, viewport: number, edge?: number }} m
 */
export function grownPanelShift({ before, after, trigger, viewport, edge = 12, gap = 8 }) {
  const height = after.bottom - after.top;
  const growth = height - (before.bottom - before.top);
  if (!(growth > 0)) return 0;
  let dy = 0;
  if (trigger && before.bottom <= trigger.top + 1) {
    if (after.top - growth >= edge) dy = -growth;
    else if (trigger.bottom + gap + height <= viewport - edge) dy = trigger.bottom + gap - after.top;
    else dy = edge - after.top;
  } else {
    const over = after.bottom - (viewport - edge);
    if (over > 0) dy = -over;
  }
  if (after.top + dy < edge) dy = edge - after.top;
  return Math.round(dy);
}

/**
 * Load and start the shell (stage two). `importer` gives the module, whose
 * `startShell` resolves with the Notebook's API, or null when the Notebook
 * didn't come up; either failure ends in `stand` (the page without the desk).
 * Resolves with the API or null.
 */
export function loadStageTwo(importer, { handOver = null, stand }) {
  return Promise.resolve()
    .then(importer)
    .then((m) => m.startShell({ handOver }))
    .then(
      (api) => {
        if (!api) stand();
        return api ?? null;
      },
      (err) => {
        console.error("Study Desk: the notebook didn't load", err);
        stand();
        return null;
      },
    );
}
