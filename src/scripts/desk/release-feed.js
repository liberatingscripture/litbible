// src/scripts/desk/release-feed.js
//
// The release notes feed (/api/data/release-notes.json) for the desk's pages:
// the change notice's "why did this change" line, the notebook page's "What's
// new for you" and the Notebook panel's one-line count all read it. It is
// served `no-store` (the apps' sync contract), so it is fetched once per page and kept in
// sessionStorage for the tab's visit, keyed by the content version this page
// was built from: a new publish is a new version, so a stale copy is never
// used, and moving between pages of the site costs no second download. When
// the version is unknown (dev, before a build) nothing is kept.

const KEY = "lit-desk-release-feed";

let pending = null;

const version = () => document.documentElement.dataset.contentVersion || "unversioned";

function readKept() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(KEY));
    if (kept?.v === version() && Array.isArray(kept.entries)) return kept.entries;
  } catch (_) {}
  return null;
}

function keep(entries) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: version(), entries }));
  } catch (_) {}
}

/** The release notes, newest first; null if they can't be had. Fetched once per page. */
export function loadReleaseNotes() {
  pending ??= (async () => {
    const cacheable = version() !== "unversioned";
    const kept = cacheable ? readKept() : null;
    if (kept) return kept;
    try {
      const res = await fetch("/api/data/release-notes.json");
      if (!res.ok) return null;
      const entries = await res.json();
      if (!Array.isArray(entries)) return null;
      if (cacheable) keep(entries);
      return entries;
    } catch (_) {
      return null;
    }
  })();
  return pending;
}
