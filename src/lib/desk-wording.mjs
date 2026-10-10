// src/lib/desk-wording.mjs
//
// "Did the wording change?" for the Study Desk (STUDY-DESK.md, N3 and C3).
// Every note and highlight keeps `verseCopy`, its verses' anchor text when it
// was made. When a later publish changes those verses, the note says so and
// shows what changed. This module answers both halves: whether the wording
// moved, and which words.
//
// Typography is evened out first, because the corpus has had mechanical passes
// that change no wording: in August 2026, 439 straight quotes were curled and
// 413 number-range hyphens became en dashes. A note shouldn't flag those, and
// the release notes can't be relied on to say so (C3: `release-notes-skip.md`
// publishes have no entry, and long entries truncate). So quotes, dashes and
// spacing are folded before comparing. Case is not: decapitalizing "Triumphant
// Message" in 2026-08 was a real change to the text.
//
// This is a different job from finding a mark again (anchor-core.mjs), which
// keeps quotes and dashes exactly as written.

const SINGLE = /[‘’‚‛′]/g;
const DOUBLE = /[“”„‟″]/g;
const DASH = /[‐-―−-]/g;

/** Text with quotes, dashes and spacing evened out, for comparing wording. */
export function wordingKey(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(SINGLE, "'")
    .replace(DOUBLE, '"')
    .replace(DASH, "-")
    .replace(/\s+/g, " ")
    .replace(/ ?- ?/g, "-")
    .trim();
}

/** Whether the words differ, once typography is evened out. */
export function wordingChanged(before, now) {
  return wordingKey(before) !== wordingKey(now);
}

/** Past this many tokens a side, the diff shows the whole passage as replaced. */
const MAX_TOKENS = 600;

/**
 * Words and dashes, each with the whitespace before it, so a run can be rebuilt
 * as written. The text's first token has no lead: whatever opens the text isn't
 * a gap between two words.
 */
function tokenize(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/(\s*)([‐-―−-]|[^\s‐-―−-]+)/g)) {
    out.push({ lead: out.length ? m[1] : "", text: m[2], key: wordingKey(m[2]) });
  }
  return out;
}

function joinRun(tokens) {
  return tokens.map((t, i) => (i ? t.lead : "") + t.text).join("");
}

/**
 * What changed, word by word: a list of runs, each `{ op, text, lead }` where
 * `op` is "same", "del" (only in the old text) or "ins" (only in the new).
 * Words that differ only in typography count as the same, and show as they
 * read now.
 *
 * `text` leaves out the whitespace before the run's first word, and `lead` is
 * that whitespace, from the text the run came from (the old text for "del", the
 * new for "same" and "ins"; "" for the first word of its text). Without it a
 * renderer can't tell "well" "-" "known" (no spaces) from "love" "is" (spaces):
 * `run.lead + run.text` reads as written, and so does a run after a run.
 */
export function wordingDiff(before, now) {
  const a = tokenize(before);
  const b = tokenize(now);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    if (!wordingChanged(before, now)) return b.length ? [{ op: "same", text: joinRun(b), lead: "" }] : [];
    return [
      ...(a.length ? [{ op: "del", text: joinRun(a), lead: "" }] : []),
      ...(b.length ? [{ op: "ins", text: joinRun(b), lead: "" }] : []),
    ];
  }

  // Longest common subsequence over token keys, filled from the end.
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const L = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i * w + j] = a[i].key === b[j].key
        ? L[(i + 1) * w + j + 1] + 1
        : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }

  const steps = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i].key === b[j].key) {
      steps.push({ op: "same", tok: b[j] });
      i++;
      j++;
    } else if (j < m && (i === n || L[i * w + j + 1] >= L[(i + 1) * w + j])) {
      steps.push({ op: "ins", tok: b[j++] });
    } else {
      steps.push({ op: "del", tok: a[i++] });
    }
  }

  // Group into runs, deletions before insertions within a changed stretch so
  // it reads "old → new".
  const runs = [];
  let k = 0;
  while (k < steps.length) {
    if (steps[k].op === "same") {
      const start = k;
      while (k < steps.length && steps[k].op === "same") k++;
      const tokens = steps.slice(start, k).map((s) => s.tok);
      runs.push({ op: "same", text: joinRun(tokens), lead: tokens[0].lead });
      continue;
    }
    const start = k;
    while (k < steps.length && steps[k].op !== "same") k++;
    const changed = steps.slice(start, k);
    const del = changed.filter((s) => s.op === "del").map((s) => s.tok);
    const ins = changed.filter((s) => s.op === "ins").map((s) => s.tok);
    if (del.length) runs.push({ op: "del", text: joinRun(del), lead: del[0].lead });
    if (ins.length) runs.push({ op: "ins", text: joinRun(ins), lead: ins[0].lead });
  }
  return runs;
}
