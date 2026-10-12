// Word-alignment UI. One verse at a time: click Greek words and English words
// to select them, press Link, and the group becomes one record. Every change is
// saved at once (the whole verse's links, in one request), so there is no save
// step and a crash costs at most one decision. The server owns the rules; this
// file only decides what to send.

const $ = (id) => document.getElementById(id);
const state = {
  chapters: [],
  chapter: null,
  vi: 0, // index into chapter.verses
  sel: { greek: new Set(), english: new Set() },
  active: null, // index of the link the reviewer has picked, to unlink it
  relink: null, // index into verse().stale being re-linked, if any
};

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}

let errTimer;
function showError(message) {
  const box = $("error");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(errTimer);
  errTimer = setTimeout(() => (box.hidden = true), 6000);
}

const verse = () => state.chapter?.verses[state.vi];
const hue = (i) => (i * 47 + 20) % 360;

/** [4, 5, 6, 9] -> "4–6, 9". */
function spans(numbers) {
  return toRanges(numbers)
    .map(([a, b]) => (a === b ? String(a) : `${a}–${b}`))
    .join(", ");
}

/** Consecutive indices -> [first, last] ranges. */
function toRanges(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  const out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else out.push([i, i]);
  }
  return out;
}

function englishOf(v, ranges) {
  return ranges.map(([i, j]) => v.text.slice(v.englishTokens[i].start, v.englishTokens[j].end)).join(" … ");
}
function greekOf(v, ts) {
  return ts.map((t) => v.greek.find((g) => g.t === t)?.word ?? "?").join(" ");
}

// ---------------------------------------------------------------- rendering

function renderNav() {
  const nav = $("verses");
  nav.replaceChildren();
  state.chapter.verses.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = v.verse;
    b.className = (v.complete ? "done" : "pending") + (v.stale.length ? " stale-mark" : "");
    b.setAttribute(
      "aria-label",
      `Verse ${v.verse}${v.complete ? ", complete" : ""}${v.stale.length ? ", has stale links" : ""}`,
    );
    if (i === state.vi) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => goTo(i));
    nav.append(b);
  });
  const done = state.chapter.verses.filter((v) => v.complete).length;
  const staleN = state.chapter.verses.reduce((n, v) => n + v.stale.length, 0);
  $("progress").textContent =
    `${done} of ${state.chapter.verses.length} verses complete` + (staleN ? `, ${staleN} stale link${staleN > 1 ? "s" : ""}` : "");
  const orphans = $("orphans");
  orphans.hidden = !state.chapter.orphans.length;
  $("orphan-count").textContent = state.chapter.orphans.length;
  const only = state.chapter.greekOnly;
  $("where").textContent = only.length
    ? `SBLGNT also has verse${only.length > 1 ? "s" : ""} ${spans(only)}, not yet in the English`
    : "";
}

function linkIndexMaps(v) {
  const greek = new Map();
  const english = new Map();
  v.links.forEach((l, i) => {
    l.greek.forEach((t) => greek.set(t, i));
    l.english.forEach(([a, b]) => {
      for (let k = a; k <= b; k++) english.set(k, i);
    });
  });
  return { greek, english };
}

function renderVerse() {
  const v = verse();
  const empty = $("empty");
  if (!v) {
    $("verse").hidden = true;
    empty.hidden = false;
    empty.textContent = "No English verses in this chapter yet.";
    return;
  }
  empty.hidden = true;
  $("verse").hidden = false;
  $("verse-ref").textContent = `${state.chapter.label}:${v.verse}${v.complete ? "  ✓ complete" : ""}`;

  const stale = $("stale");
  stale.hidden = !v.stale.length;
  if (v.stale.length) {
    $("stale-count").textContent = v.stale.length;
    const WHY = {
      english: "its English is no longer in the verse",
      greek: "its Greek no longer matches SBLGNT",
      clash: "it overlaps another link",
      empty: "it links nothing",
    };
    $("stale-list").replaceChildren(
      ...v.stale.map((st, i) => {
        const li = document.createElement("li");
        if (state.relink === i) li.classList.add("relinking");
        const g = document.createElement("span");
        g.className = "g";
        g.lang = "grc";
        g.textContent = st.record.greek.map((x) => x.form).join(" ") || "(no Greek)";
        const e = document.createElement("span");
        e.textContent = "↔ " + (st.record.english.map((p) => p.text).join(" … ") || "(no English)");
        const why = document.createElement("span");
        why.className = "why";
        why.textContent = WHY[st.reason] ?? st.reason;
        const relink = document.createElement("button");
        relink.type = "button";
        relink.textContent = "Re-link";
        relink.addEventListener("click", () => startRelink(i));
        const drop = document.createElement("button");
        drop.type = "button";
        drop.textContent = "Discard";
        drop.addEventListener("click", () => discardStale([i]));
        li.append(g, e, why, relink, drop);
        return li;
      }),
    );
  }

  const maps = linkIndexMaps(v);
  const activeLink = state.active != null ? v.links[state.active] : null;
  const partnerG = new Set(activeLink?.greek ?? []);
  const partnerE = new Set();
  activeLink?.english.forEach(([a, b]) => { for (let k = a; k <= b; k++) partnerE.add(k); });

  const greek = $("greek");
  greek.replaceChildren(
    ...v.greek.map((g) => {
      const b = document.createElement("button");
      b.type = "button";
      const li = maps.greek.get(g.t);
      b.className = "tok " + (li != null ? "linked" : "free");
      if (li != null) b.style.setProperty("--h", hue(li));
      if (state.sel.greek.has(g.t)) b.classList.add("selected");
      if (partnerG.has(g.t)) b.classList.add("partner");
      b.setAttribute("aria-pressed", String(state.sel.greek.has(g.t)));
      const main = document.createElement("span");
      main.textContent = g.text;
      const lemma = document.createElement("small");
      lemma.textContent = g.lemma;
      const parse = document.createElement("small");
      parse.className = "parse";
      parse.textContent = `${g.pos} ${g.parse}`;
      b.append(main, lemma, parse);
      b.title = `${g.t}. ${g.lemma} (${g.pos} ${g.parse})`;
      b.setAttribute("aria-label", `${g.text}, ${g.lemma}, ${g.pos} ${g.parse}`);
      b.addEventListener("click", () => clickToken("greek", g.t, li));
      return b;
    }),
  );

  const english = $("english");
  english.replaceChildren();
  let prev = 0;
  v.englishTokens.forEach((tok, i) => {
    if (tok.start > prev) {
      const gap = document.createElement("span");
      gap.className = "gap";
      gap.textContent = v.text.slice(prev, tok.start);
      english.append(gap);
    }
    prev = tok.end;
    const b = document.createElement("button");
    b.type = "button";
    const li = maps.english.get(i);
    b.className = "tok " + (li != null ? "linked" : "free");
    if (li != null) b.style.setProperty("--h", hue(li));
    if (state.sel.english.has(i)) b.classList.add("selected");
    if (partnerE.has(i)) b.classList.add("partner");
    b.setAttribute("aria-pressed", String(state.sel.english.has(i)));
    b.textContent = tok.text;
    b.addEventListener("click", () => clickToken("english", i, li));
    english.append(b);
  });
  if (prev < v.text.length) {
    const tail = document.createElement("span");
    tail.className = "gap";
    tail.textContent = v.text.slice(prev);
    english.append(tail);
  }

  renderLinks(v);
  renderActions(v);
}

function renderLinks(v) {
  $("links").replaceChildren(
    ...v.links.map((l, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--h", hue(i));
      if (state.active === i) li.classList.add("active");
      const g = document.createElement("span");
      g.className = "g";
      g.lang = "grc";
      g.textContent = l.greek.length ? greekOf(v, l.greek) : "(no Greek)";
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "↔";
      const e = document.createElement("span");
      e.textContent = l.english.length ? englishOf(v, l.english) : "(no English)";
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", "Unlink");
      x.addEventListener("click", () => unlink(i));
      li.append(g, arrow, e, x);
      li.addEventListener("click", (ev) => {
        if (ev.target === x) return;
        state.active = state.active === i ? null : i;
        renderVerse();
      });
      return li;
    }),
  );
  const open = [];
  if (v.unlinkedGreek.length) open.push(`${v.unlinkedGreek.length} Greek word${v.unlinkedGreek.length > 1 ? "s" : ""} not yet linked`);
  if (v.unlinkedEnglish.length) open.push(`${v.unlinkedEnglish.length} English word${v.unlinkedEnglish.length > 1 ? "s" : ""} not yet linked`);
  $("open").textContent = open.length ? open.join("; ") : v.complete ? "Every word is linked." : "";
}

function renderActions(v) {
  const g = state.sel.greek.size;
  const e = state.sel.english.size;
  const link = $("link");
  link.disabled = !(g || e);
  if (g && e) link.textContent = `Link ${g} Greek ↔ ${e} English`;
  else if (g) link.textContent = `Greek with no English (${g})`;
  else if (e) link.textContent = `English with no Greek (${e})`;
  else link.textContent = "Link";
  if (state.relink != null && (g || e)) link.textContent += " (replaces the stale link)";
  $("clear").disabled = !(g || e);
  $("unlink").hidden = state.active == null;
  $("hint").textContent = g || e || state.active != null
    ? ""
    : "Click words to select them. Enter links, Esc clears, [ and ] change verse.";
}

// ---------------------------------------------------------------- behaviour

function clickToken(kind, key, linkIndex) {
  if (linkIndex != null) {
    // A word already in a link picks that link, so it can be unlinked.
    state.sel = { greek: new Set(), english: new Set() };
    state.active = state.active === linkIndex ? null : linkIndex;
  } else {
    state.active = null;
    const set = state.sel[kind];
    if (set.has(key)) set.delete(key);
    else set.add(key);
  }
  renderVerse();
}

async function save(v, links, dropStale = []) {
  const res = await api(`/api/verses/${encodeURIComponent(v.ref)}`, { links, dropStale });
  Object.assign(v, { links: res.links, stale: res.stale, unlinkedGreek: res.unlinkedGreek, unlinkedEnglish: res.unlinkedEnglish, complete: res.complete });
}

const wire = (v) => v.links.map((l) => ({ greek: l.greek, english: l.english }));

async function link() {
  const v = verse();
  if (!v || !(state.sel.greek.size || state.sel.english.size)) return;
  const next = [...wire(v), { greek: [...state.sel.greek], english: toRanges(state.sel.english) }];
  try {
    await save(v, next, state.relink != null ? [state.relink] : []);
    state.sel = { greek: new Set(), english: new Set() };
    state.active = null;
    state.relink = null;
  } catch (err) {
    showError(err.message);
  }
  renderVerse();
  renderNav();
}

async function unlink(index = state.active) {
  const v = verse();
  if (!v || index == null) return;
  try {
    await save(v, wire(v).filter((_, i) => i !== index));
    state.active = null;
  } catch (err) {
    showError(err.message);
  }
  renderVerse();
  renderNav();
}

/** Put a stale link's still-good Greek back in the selection; the reviewer picks the new English. */
function startRelink(i) {
  const v = verse();
  const free = new Set(v.unlinkedGreek);
  state.sel = { greek: new Set(v.stale[i].relinkGreek.filter((t) => free.has(t))), english: new Set() };
  state.active = null;
  state.relink = i;
  renderVerse();
}

async function discardStale(indices) {
  const v = verse();
  try {
    await save(v, wire(v), indices);
    state.relink = null;
  } catch (err) {
    showError(err.message);
  }
  renderVerse();
  renderNav();
}

function clear() {
  state.sel = { greek: new Set(), english: new Set() };
  state.active = null;
  state.relink = null;
  renderVerse();
}

function goTo(i) {
  const n = state.chapter.verses.length;
  if (i < 0 || i >= n) return;
  state.vi = i;
  state.sel = { greek: new Set(), english: new Set() };
  state.active = null;
  state.relink = null;
  remember();
  renderNav();
  renderVerse();
}

function remember() {
  try {
    localStorage.setItem("lit-words-place", JSON.stringify({ key: state.chapter.key, verse: verse()?.verse }));
  } catch {}
}
function recall() {
  try {
    return JSON.parse(localStorage.getItem("lit-words-place") || "null");
  } catch {
    return null;
  }
}

async function openChapter(key, verseNumber) {
  state.chapter = await api(`/api/chapters/${encodeURIComponent(key)}`);
  const at = state.chapter.verses.findIndex((v) => v.verse === verseNumber);
  // Open on the first verse that is not finished, unless told where to go.
  state.vi = at !== -1 ? at : Math.max(0, state.chapter.verses.findIndex((v) => !v.complete));
  state.sel = { greek: new Set(), english: new Set() };
  state.active = null;
  state.relink = null;
  $("chapter").value = key;
  remember();
  renderNav();
  renderVerse();
}

async function init() {
  const { chapters } = await api("/api/chapters");
  state.chapters = chapters;
  const sel = $("chapter");
  if (!chapters.length) {
    $("empty").hidden = false;
    $("empty").textContent = "No chapter has English verses yet. Check --chapters-dir.";
    return;
  }
  sel.replaceChildren(
    ...chapters.map((c) => {
      const o = document.createElement("option");
      o.value = c.key;
      o.textContent = `${c.label} (${c.complete}/${c.verses})${c.draft ? " draft" : ""}${c.stale ? ` ⚠ ${c.stale}` : ""}`;
      return o;
    }),
  );
  sel.addEventListener("change", () => openChapter(sel.value).catch((e) => showError(e.message)));
  const last = recall();
  const start = chapters.find((c) => c.key === last?.key) ?? chapters[0];
  await openChapter(start.key, last?.key === start.key ? last.verse : undefined);
}

$("link").addEventListener("click", link);
$("clear").addEventListener("click", clear);
$("unlink").addEventListener("click", () => unlink());
$("discard-all").addEventListener("click", () => discardStale("all"));
$("discard-orphans").addEventListener("click", async () => {
  try {
    await api(`/api/chapters/${encodeURIComponent(state.chapter.key)}/discard-orphans`, {});
    await openChapter(state.chapter.key, verse()?.verse);
  } catch (err) {
    showError(err.message);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "Enter" && tag !== "BUTTON" && !$("link").disabled) { e.preventDefault(); link(); }
  else if (e.key === "Escape") clear();
  else if ((e.key === "Delete" || e.key === "Backspace") && state.active != null) { e.preventDefault(); unlink(); }
  else if (e.key === "]") goTo(state.vi + 1);
  else if (e.key === "[") goTo(state.vi - 1);
});

init().catch((err) => showError(err.message));
