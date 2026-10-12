// Word-alignment UI. Click Greek words and English words to select them, press
// Link, and the group becomes one record. Every change saves at once (the whole
// chapter's links, in one request, since a link may cross a verse), so there is
// no save step and a crash costs at most one decision. The server owns the
// rules; this file only decides what to send.
//
// A word is named by a key: "g|<verse>|<t>" for Greek, "e|<verse>|<token>" for
// English. The selection survives moving between verses, so a link can join
// words that sit in different verses.

const $ = (id) => document.getElementById(id);
const state = {
  chapters: [],
  chapter: null,
  vi: 0, // index into chapter.verses
  sel: new Set(),
  active: null, // index of the link the reviewer has picked, to unlink it
  relink: null, // index into chapter.stale being re-linked
  context: false,
};

async function api(path, body) {
  const res = await fetch(
    path,
    body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined,
  );
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
  errTimer = setTimeout(() => (box.hidden = true), 8000);
}

const cur = () => state.chapter?.verses[state.vi];
const verseNo = (n) => state.chapter.verses.find((v) => v.verse === n);
const hue = (i) => (i * 47 + 20) % 360;
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

/** [4, 5, 6, 9] -> "4–6, 9". */
function spans(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`)).join(", ");
}

function owners() {
  const m = new Map();
  state.chapter.links.forEach((l, i) => {
    l.greek.forEach((g) => m.set(`g|${g.v}|${g.t}`, i));
    l.english.forEach((e) => {
      for (let k = e.first; k <= e.last; k++) m.set(`e|${e.v}|${k}`, i);
    });
  });
  return m;
}
const linkVerses = (l) => new Set([...l.greek.map((g) => g.v), ...l.english.map((e) => e.v)]);
const englishText = (e) => {
  const v = verseNo(e.v);
  return v.text.slice(v.englishTokens[e.first].start, v.englishTokens[e.last].end);
};
const greekWord = (g) => verseNo(g.v)?.greek.find((x) => x.t === g.t)?.word ?? "?";
const wire = () => state.chapter.links.map((l) => ({ greek: l.greek, english: l.english }));
const staleHere = (n) =>
  state.chapter.stale.map((s, i) => ({ s, i })).filter(({ s }) => s.verses.includes(n) && s.reason !== "verse");

// ---------------------------------------------------------------- chapter-level

function renderNav() {
  const ch = state.chapter;
  const staleVerses = new Set(ch.stale.flatMap((s) => s.verses));
  $("verses").replaceChildren(
    ...ch.verses.map((v, i) => {
      const flags = [
        v.complete ? "done" : "pending",
        staleVerses.has(v.verse) ? "stale-mark" : "",
        v.changed ? "changed-mark" : "",
        v.outsideSource ? "outside" : "",
      ];
      const b = el("button", { type: "button", textContent: v.verse, className: flags.join(" ").trim() });
      const says = [
        v.complete && "complete",
        staleVerses.has(v.verse) && "has stale links",
        v.changed && "English changed since aligned",
        v.outsideSource && "no SBLGNT text",
      ].filter(Boolean);
      b.setAttribute("aria-label", `Verse ${v.verse}${says.length ? ", " + says.join(", ") : ""}`);
      if (i === state.vi) b.setAttribute("aria-current", "true");
      b.addEventListener("click", () => goTo(i));
      return b;
    }),
  );

  const countable = ch.verses.filter((v) => !v.outsideSource);
  const done = countable.filter((v) => v.complete).length;
  $("progress").textContent =
    `${done} of ${countable.length} verses complete` + (ch.stale.length ? `, ${ch.stale.length} stale` : "");
  $("where").textContent = ch.greekOnly.length
    ? `SBLGNT also has verse${ch.greekOnly.length > 1 ? "s" : ""} ${spans(ch.greekOnly)}, not yet in the English`
    : "";

  const changed = ch.verses.filter((v) => v.changed).map((v) => v.verse);
  const moved = ch.links.filter((l) => l.moved).length;
  $("changed").hidden = !changed.length;
  if (changed.length) {
    $("changed-text").textContent =
      `The English of verse${changed.length > 1 ? "s" : ""} ${spans(changed)} changed since it was aligned. ` +
      `${moved} link${moved === 1 ? "" : "s"} whose words all survived ${moved === 1 ? "was" : "were"} found in the new wording ` +
      `(dotted outline). Accept to save ${moved === 1 ? "it" : "them"} there. Links that touched a changed word are listed as stale.`;
  }

  const gone = ch.stale.map((s, i) => ({ s, i })).filter(({ s }) => s.reason === "verse");
  $("chapter-stale").hidden = !gone.length;
  $("chapter-stale-list").replaceChildren(...gone.map(({ s, i }) => staleItem(s, i, false)));

  const opt = [...$("chapter").options].find((o) => o.value === ch.key);
  if (opt) {
    opt.textContent = optionLabel({
      label: ch.label, draft: ch.draft, complete: done, verses: countable.length,
      stale: ch.stale.length, changed: changed.length,
    });
  }
}

function optionLabel(c) {
  return `${c.label} (${c.complete}/${c.verses})${c.draft ? " draft" : ""}${c.stale ? ` ⚠ ${c.stale}` : ""}${c.changed ? ` ↻ ${c.changed}` : ""}`;
}

// ---------------------------------------------------------------- the verse view

function renderWork() {
  const v = cur();
  $("empty").hidden = !!v;
  $("work").hidden = !v;
  if (!v) {
    $("empty").textContent = "No English verses in this chapter yet.";
    return;
  }
  const own = owners();
  const active = state.active != null ? state.chapter.links[state.active] : null;
  const partner = new Set();
  active?.greek.forEach((g) => partner.add(`g|${g.v}|${g.t}`));
  active?.english.forEach((e) => {
    for (let k = e.first; k <= e.last; k++) partner.add(`e|${e.v}|${k}`);
  });

  const shown = state.context
    ? [state.chapter.verses[state.vi - 1], v, state.chapter.verses[state.vi + 1]].filter(Boolean)
    : [v];
  $("blocks").replaceChildren(...shown.map((x) => verseBlock(x, x !== v, own, partner)));

  renderActions();
  renderStale(v);
  renderLinks(v);
}

function tokenButton(key, own, partner) {
  const b = el("button", { type: "button" });
  const li = own.get(key);
  b.className = "tok " + (li != null ? "linked" : "free");
  if (li != null) {
    b.style.setProperty("--h", hue(li));
    if (state.chapter.links[li].moved) b.classList.add("carried");
  }
  if (state.sel.has(key)) b.classList.add("selected");
  if (partner.has(key)) b.classList.add("partner");
  b.setAttribute("aria-pressed", String(state.sel.has(key)));
  b.addEventListener("click", () => clickToken(key, li));
  return b;
}

function verseBlock(v, isContext, own, partner) {
  const block = el("section", { className: "block" + (isContext ? " context" : "") });
  const note = v.outsideSource
    ? "no SBLGNT text: outside the source, so it can't be completed"
    : v.complete ? "✓ complete" : v.changed ? "↻ English changed since aligned" : "";
  block.append(el("h2", {}, `${state.chapter.label}:${v.verse}`, el("span", { className: "note", textContent: note })));

  const details = el("p", { className: "details muted", textContent: " " });
  const showDetails = (g) => (details.textContent = `${g.text}  ·  ${g.lemma}  ·  ${g.parsed}  (${g.pos} ${g.parse})`);
  block.append(
    el("p", { className: "label", textContent: "Greek (SBLGNT)" }),
    el(
      "div",
      { className: "row greek", lang: "grc" },
      ...v.greek.map((g) => {
        const b = tokenButton(`g|${v.verse}|${g.t}`, own, partner);
        b.append(el("span", { textContent: g.text }), el("small", { textContent: g.lemma }));
        b.title = `${g.t}. ${g.lemma}: ${g.parsed} (${g.pos} ${g.parse})`;
        b.setAttribute("aria-label", `${g.text}, ${g.lemma}, ${g.parsed}`);
        b.addEventListener("mouseenter", () => showDetails(g));
        b.addEventListener("focus", () => showDetails(g));
        return b;
      }),
    ),
  );
  if (v.greek.length) block.append(details);
  else block.append(el("p", { className: "outside", textContent: "MorphGNT's SBLGNT has no words for this verse." }));

  const english = el("div", { className: "row english", lang: "en" });
  let prev = 0;
  v.englishTokens.forEach((tok, i) => {
    if (tok.start > prev) english.append(el("span", { className: "gap", textContent: v.text.slice(prev, tok.start) }));
    prev = tok.end;
    const b = tokenButton(`e|${v.verse}|${i}`, own, partner);
    b.textContent = tok.text;
    english.append(b);
  });
  if (prev < v.text.length) english.append(el("span", { className: "gap", textContent: v.text.slice(prev) }));
  block.append(el("p", { className: "label", textContent: "English (LIT)" }), english);
  return block;
}

function selectionParts() {
  const greek = [];
  const byVerse = new Map();
  for (const key of state.sel) {
    const [kind, v, n] = key.split("|");
    if (kind === "g") greek.push({ v: Number(v), t: Number(n) });
    else {
      if (!byVerse.has(Number(v))) byVerse.set(Number(v), []);
      byVerse.get(Number(v)).push(Number(n));
    }
  }
  const english = [];
  for (const [v, idx] of [...byVerse].sort((a, b) => a[0] - b[0])) {
    idx.sort((a, b) => a - b);
    for (const i of idx) {
      const last = english[english.length - 1];
      if (last && last.v === v && i === last.last + 1) last.last = i;
      else english.push({ v, first: i, last: i });
    }
  }
  return { greek, english };
}

function renderActions() {
  const { greek, english } = selectionParts();
  const g = greek.length;
  const e = english.reduce((n, r) => n + r.last - r.first + 1, 0);
  const link = $("link");
  link.disabled = !(g || e);
  if (g && e) link.textContent = `Link ${g} Greek ↔ ${e} English`;
  else if (g) link.textContent = `Greek with no English (${g})`;
  else if (e) link.textContent = `English with no Greek (${e})`;
  else link.textContent = "Link";
  if (state.relink != null && (g || e)) link.textContent += " (replaces the stale link)";
  $("clear").disabled = !(g || e) && state.relink == null;
  $("unlink").hidden = state.active == null;

  const verses = new Set([...greek.map((x) => x.v), ...english.map((x) => x.v)]);
  $("hint").textContent =
    verses.size > 1
      ? `Selection spans verses ${spans(verses)}.`
      : g || e || state.active != null
        ? ""
        : "Click words to select them. Enter links, Esc clears, [ and ] change verse.";
}

const WHY = {
  english: "its English words changed",
  greek: "its Greek no longer matches SBLGNT",
  clash: "it overlaps another link",
  empty: "it links nothing",
  verse: "its verse is no longer in the English",
};

function staleItem(s, i, canRelink) {
  const li = el("li", { className: state.relink === i ? "relinking" : "" });
  const relink = el("button", { type: "button", textContent: "Re-link" });
  relink.addEventListener("click", () => startRelink(i));
  const drop = el("button", { type: "button", textContent: "Discard" });
  drop.addEventListener("click", () => save(wire(), [i]));
  li.append(
    el("span", { className: "g", lang: "grc", textContent: s.record.greek.map((x) => x.form).join(" ") || "(no Greek)" }),
    el("span", { textContent: "↔ " + (s.record.english.map((p) => p.text).join(" … ") || "(no English)") }),
    el("span", { className: "why", textContent: WHY[s.reason] ?? s.reason }),
    ...(canRelink ? [relink] : []),
    drop,
  );
  return li;
}

function renderStale(v) {
  const here = staleHere(v.verse);
  $("stale").hidden = !here.length;
  $("stale-count").textContent = here.length;
  $("stale-list").replaceChildren(...here.map(({ s, i }) => staleItem(s, i, true)));
}

function renderLinks(v) {
  const items = state.chapter.links
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => linkVerses(l).has(v.verse));
  const where = (x) => (x.v !== v.verse ? el("span", { className: "v", textContent: `(v. ${x.v}) ` }) : "");
  $("links").replaceChildren(
    ...items.map(({ l, i }) => {
      const li = el("li");
      li.style.setProperty("--h", hue(i));
      if (state.active === i) li.classList.add("active");
      const g = el("span", { className: "g", lang: "grc" });
      if (l.greek.length) l.greek.forEach((x, k) => g.append(k ? " " : "", where(x), greekWord(x)));
      else g.append("(no Greek)");
      const e = el("span");
      if (l.english.length) l.english.forEach((x, k) => e.append(k ? " … " : "", where(x), englishText(x)));
      else e.append("(no English)");
      const x = el("button", { type: "button", textContent: "×" });
      x.setAttribute("aria-label", "Unlink");
      x.addEventListener("click", (ev) => {
        ev.stopPropagation();
        unlink(i);
      });
      li.append(g, el("span", { className: "arrow", textContent: "↔" }), e, x);
      if (l.moved) li.append(el("span", { className: "why", textContent: " carried over, not yet saved" }));
      li.addEventListener("click", () => {
        state.active = state.active === i ? null : i;
        renderWork();
      });
      return li;
    }),
  );
  const open = [];
  if (v.unlinkedGreek.length) open.push(`${v.unlinkedGreek.length} Greek word${v.unlinkedGreek.length > 1 ? "s" : ""} not yet linked`);
  if (v.unlinkedEnglish.length) open.push(`${v.unlinkedEnglish.length} English word${v.unlinkedEnglish.length > 1 ? "s" : ""} not yet linked`);
  $("open").textContent = open.length ? open.join("; ") : v.complete ? "Every word is linked." : "";
}

// ---------------------------------------------------------------- behaviour

function clickToken(key, linkIndex) {
  if (linkIndex != null) {
    // A word already in a link picks that link, so it can be unlinked.
    state.active = state.active === linkIndex ? null : linkIndex;
  } else {
    state.active = null;
    if (state.sel.has(key)) state.sel.delete(key);
    else state.sel.add(key);
  }
  renderWork();
}

/** Save the chapter's links; the server answers with the chapter as it now stands. */
async function save(links, dropStale = []) {
  const ch = state.chapter;
  const at = cur()?.verse;
  try {
    state.chapter = await api(`/api/chapters/${encodeURIComponent(ch.key)}`, { revision: ch.revision, links, dropStale });
    const i = state.chapter.verses.findIndex((v) => v.verse === at);
    state.vi = i === -1 ? 0 : i;
    state.active = null;
    state.relink = null;
    return true;
  } catch (err) {
    showError(err.message);
    return false;
  } finally {
    renderNav();
    renderWork();
  }
}

async function link() {
  const { greek, english } = selectionParts();
  if (!greek.length && !english.length) return;
  const ok = await save([...wire(), { greek, english }], state.relink != null ? [state.relink] : []);
  if (ok) {
    state.sel.clear();
    renderWork();
  }
}

const unlink = (index = state.active) => index != null && save(wire().filter((_, i) => i !== index));

/** Put a stale link's still-good Greek back in the selection; the reviewer picks the new English. */
function startRelink(i) {
  const own = owners();
  state.sel = new Set(
    state.chapter.stale[i].relinkGreek.map((g) => `g|${g.v}|${g.t}`).filter((k) => !own.has(k)),
  );
  state.active = null;
  state.relink = i;
  renderWork();
}

function clear() {
  state.sel.clear();
  state.active = null;
  state.relink = null;
  renderWork();
}

function goTo(i) {
  if (i < 0 || i >= state.chapter.verses.length) return;
  state.vi = i;
  state.active = null; // the selection stays, so a link can reach another verse
  remember();
  renderNav();
  renderWork();
}

function remember() {
  try {
    localStorage.setItem(
      "lit-words-place",
      JSON.stringify({ key: state.chapter.key, verse: cur()?.verse, context: state.context }),
    );
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
  state.vi = at !== -1 ? at : Math.max(0, state.chapter.verses.findIndex((v) => !v.complete && !v.outsideSource));
  state.sel.clear();
  state.active = null;
  state.relink = null;
  $("chapter").value = key;
  remember();
  renderNav();
  renderWork();
}

async function init() {
  const { chapters } = await api("/api/chapters");
  state.chapters = chapters;
  if (!chapters.length) {
    $("empty").hidden = false;
    $("empty").textContent = "No chapter has English verses yet. Check --chapters-dir.";
    return;
  }
  const sel = $("chapter");
  sel.replaceChildren(...chapters.map((c) => el("option", { value: c.key, textContent: optionLabel(c) })));
  sel.addEventListener("change", () => openChapter(sel.value).catch((e) => showError(e.message)));
  const last = recall();
  state.context = !!last?.context;
  $("context").checked = state.context;
  const start = chapters.find((c) => c.key === last?.key) ?? chapters[0];
  await openChapter(start.key, last?.key === start.key ? last.verse : undefined);
}

$("link").addEventListener("click", link);
$("clear").addEventListener("click", clear);
$("unlink").addEventListener("click", () => unlink());
$("accept").addEventListener("click", () => save(wire()));
$("context").addEventListener("change", (e) => {
  state.context = e.target.checked;
  remember();
  renderWork();
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "Enter" && tag !== "BUTTON" && !$("link").disabled) {
    e.preventDefault();
    link();
  } else if (e.key === "Escape") clear();
  else if ((e.key === "Delete" || e.key === "Backspace") && state.active != null) {
    e.preventDefault();
    unlink();
  } else if (e.key === "]") goTo(state.vi + 1);
  else if (e.key === "[") goTo(state.vi - 1);
});

init().catch((err) => showError(err.message));
