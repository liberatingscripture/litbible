// src/scripts/desk/greek-data.js
//
// Fetches the Greek files the Notebook's Greek tab reads (public/greek/,
// STUDY-DESK.md phase 1f): the chapter's text once per page, and a lexicon
// shard only when a reader opens a word that needs it. Each fetch is kept as
// a promise, so two words that share a shard share the request. A failed
// fetch is forgotten, so "Try again" asks again. Nothing here throws into the
// page: a caller gets a rejected promise and decides what to say.

import { lsjShard, stepShard, ubsShard } from "../../lib/desk-greek.mjs";

const cache = new Map();

function load(url) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

/** One chapter's Greek: { paragraphs, lemmas, apparatus, borrowed?, title? }. */
export function loadChapterGreek(bookKey, chapter) {
  return load(`/greek/text/${bookKey}-${chapter}.json`);
}

/** A UBS entry by its MainId, or null when the dictionary has none. */
export async function loadUbsEntry(mainId) {
  const nn = ubsShard(mainId);
  if (nn == null) return null;
  const shard = await load(`/greek/ubs/${nn}.json`);
  return shard[mainId] ?? null;
}

/** The STEPBible brief entries for a Strong's code: [{ lemma, translit, gloss, html }]. */
export async function loadStepEntries(strong) {
  const nn = stepShard(strong);
  if (nn == null) return [];
  const shard = await load(`/greek/step/${nn}.json`);
  return shard[strong] ?? [];
}

/** The full LSJ entries for a Strong's code: [{ lemma, html }]. */
export async function loadLsjEntries(strong) {
  const nnn = lsjShard(strong);
  if (nnn == null) return [];
  const shard = await load(`/greek/lsj/${nnn}.json`);
  return shard[strong] ?? [];
}

/** Which lexicon the reader chose last: "ubs" (the default) or "step". */
export function getLexicon() {
  try {
    return localStorage.getItem("lit-desk-lexicon") === "step" ? "step" : "ubs";
  } catch (_) {
    return "ubs";
  }
}

export function setLexicon(which) {
  try {
    if (which === "step") localStorage.setItem("lit-desk-lexicon", "step");
    else localStorage.removeItem("lit-desk-lexicon");
  } catch (_) {}
}
