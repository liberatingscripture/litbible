// Reconciliation review UI. Vanilla, no build step, no dependencies.
//
// It imports the REAL review-core.mjs the server uses (served at
// /review-core.mjs by exact-path allowlist) rather than restating compose() or
// the mechanical/structural/judgment rule here - the browser's idea of what a
// decision resolves to has to be the server's idea, and one copy is the only
// way to guarantee that.
//
// THE ONE RULE OF THIS SCREEN: an unanswered span must never look answered.
// The first version rendered an undecided hunk as the repo text struck through
// followed by the master text, which reads as a decision already taken rather
// than as a question. So an unanswered span is the ONLY thing here that shows
// two readings, it shows them as two labelled buttons, and nothing else on the
// page is amber.
import { compose, defaultVerdicts } from "/review-core.mjs";

const state = {
  items: [],
  decisions: {},
  counts: null,
  book: null,
  onlyOpen: false,
  focus: null, // { id, index }
  undo: [],
};

const el = {
  progress: document.getElementById("progress"),
  barFill: document.getElementById("bar-fill"),
  books: document.getElementById("books"),
  records: document.getElementById("records"),
  jump: document.getElementById("jump"),
  onlyOpen: document.getElementById("only-open"),
  help: document.getElementById("help"),
  helpToggle: document.getElementById("help-toggle"),
};

const cards = new Map(); // item id -> { card, body, status }

// ---------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------

function verdictsFor(item) {
  if (!item._verdicts) {
    const stored = state.decisions[item.id]?.verdicts;
    item._verdicts = stored ? { ...stored } : defaultVerdicts(item.segments);
  }
  return item._verdicts;
}

const hunks = (item) => item.segments.filter((s) => s.type === "hunk");

function openHunks(item) {
  const v = verdictsFor(item);
  return hunks(item).filter((s) => !v[s.index]);
}

function recordState(item) {
  if (openHunks(item).length) return "open";
  const { resolved } = compose(item.segments, verdictsFor(item));
  return resolved === composeAll(item, "repo") ? "rejected" : "approved";
}

function composeAll(item, side) {
  const v = {};
  for (const s of hunks(item)) v[s.index] = side;
  return compose(item.segments, v).resolved;
}

function stateLabel(s) {
  if (s === "approved") return "will be applied";
  if (s === "rejected") return "no change — repo kept";
  return "unanswered";
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

/** Append text with tags and entities dimmed, so prose reads as prose. The
 *  values here are HTML source that gets spliced into chapter JSON, so the
 *  markup has to stay visible and literal - but it must not shout over the
 *  words, which are what is being judged. */
function appendSource(parent, text) {
  const parts = String(text).split(/(<[^>]*>|&[a-zA-Z#0-9]+;)/);
  for (const p of parts) {
    if (p === "") continue;
    if (p[0] === "<" || (p[0] === "&" && p.endsWith(";"))) {
      const m = document.createElement("span");
      m.className = "markup";
      m.textContent = p;
      parent.append(m);
    } else {
      parent.append(document.createTextNode(p));
    }
  }
}

function sideNode(text) {
  const wrap = document.createElement("span");
  wrap.className = "txt";
  if (text === "") {
    const nil = document.createElement("i");
    nil.className = "nil";
    nil.textContent = "nothing";
    wrap.append(nil);
  } else {
    appendSource(wrap, text);
  }
  return wrap;
}

function renderSpan(item, seg) {
  const verdicts = verdictsFor(item);
  const v = verdicts[seg.index];

  if (!v) {
    // UNANSWERED: two explicit options. Nothing is pre-selected and nothing is
    // struck through, because either would read as a decision.
    const group = document.createElement("span");
    group.className = "choice";
    group.dataset.hunk = String(seg.index);
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Choose a reading");
    if (state.focus && state.focus.id === item.id && state.focus.index === seg.index) {
      group.classList.add("is-focus");
    }
    for (const side of ["repo", "master"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.dataset.side = side;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = side;
      b.append(tag, sideNode(side === "repo" ? seg.from : seg.to));
      b.addEventListener("click", () => setVerdict(item, seg.index, side, true));
      group.append(b);
    }
    return group;
  }

  // ANSWERED: reads as ordinary text, coloured by which side won. Clicking
  // re-opens the question rather than blind-toggling to the other side.
  const span = document.createElement("button");
  span.type = "button";
  span.className = "span";
  span.dataset.verdict = v;
  span.dataset.kind = seg.kind;
  if (seg.shuffle) span.dataset.shuffle = "1";
  const chosen = v === "master" ? seg.to : seg.from;
  const other = v === "master" ? seg.from : seg.to;
  if (chosen === "") {
    // The chosen side contributes nothing here. Render a marker rather than a
    // word: "removed" set in the middle of a sentence reads as part of the
    // text being reviewed. The colour already says which side won, and the
    // tooltip carries what the other side had.
    const d = document.createElement("i");
    d.className = "nil";
    d.textContent = "·";
    span.append(d);
  } else {
    appendSource(span, chosen);
  }
  const auto = seg.kind !== "judgment";
  span.title =
    `${seg.kind}${seg.shuffle ? " (text crossed a tag boundary — the words are identical)" : ""}` +
    ` — taking the ${v}\n` +
    `repo:   ${JSON.stringify(seg.from)}\nmaster: ${JSON.stringify(seg.to)}\n` +
    (auto ? "answered automatically. " : "") +
    "click to change";
  span.addEventListener("click", () => {
    delete verdictsFor(item)[seg.index];
    state.focus = { id: item.id, index: seg.index };
    save(item);
    repaint(item);
    focusCurrent();
  });
  return span;
}

/**
 * Some records are not a set of spot edits but a wholesale rewrite, and for
 * those "pick a side per word" is the wrong question. matthew-12-fn-z is 92%
 * changed across 51 hunks: rendered span by span it becomes an unreadable wall
 * of choosers, and neither version can be read as a sentence. Five records hold
 * 129 of the 296 questions this way.
 *
 * They open as a whole-version comparison instead - the two readings side by
 * side, choose one - with a toggle down to spans for anyone who wants to mix.
 * The other 92 records are one to seven spans and stay per-hunk, which is what
 * the tool is for.
 */
function isDense(item) {
  const judgment = hunks(item).filter((s) => s.kind === "judgment");
  if (judgment.length >= 12) return true;
  let sameChars = 0;
  let hunkChars = 0;
  for (const s of item.segments) {
    if (s.type === "same") sameChars += s.text.length;
    else hunkChars += s.from.length + s.to.length;
  }
  return judgment.length > 1 && hunkChars / Math.max(1, sameChars + hunkChars) >= 0.5;
}

const spanMode = (item) => item._spanMode === true || !isDense(item);

/** What the record would become with every judgment span taken from `side`.
 *  Mechanical and structural spans keep their own defaults, so the preview is
 *  what would actually be written rather than a naive one-sided take. */
function previewVerdicts(item, side) {
  const v = { ...defaultVerdicts(item.segments) };
  for (const s of hunks(item)) if (s.kind === "judgment") v[s.index] = side;
  return v;
}

function renderCompare(item) {
  const wrap = document.createElement("div");
  wrap.className = "compare";
  // Highlighting each differing word helps only while the differences are
  // findable. matthew-12-fn-z differs in 51 places across 92% of its text, and
  // marking them all just underlines the paragraph. Past that the two panels
  // are simply two readings, which is the question being asked anyway.
  const markDiffs = hunks(item).filter((s) => s.kind === "judgment").length <= 12;
  const chosenSide = (() => {
    const v = verdictsFor(item);
    const j = hunks(item).filter((s) => s.kind === "judgment");
    if (j.every((s) => v[s.index] === "master")) return "master";
    if (j.every((s) => v[s.index] === "repo")) return "repo";
    return null;
  })();

  for (const side of ["repo", "master"]) {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.dataset.side = side;
    if (chosenSide === side) panel.dataset.chosen = "1";

    const head = document.createElement("header");
    const label = document.createElement("h3");
    label.textContent = side === "repo" ? "Repo — what the site shows now" : "Master — the Word document";
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "pick";
    pick.textContent = chosenSide === side ? "chosen" : "Use this version";
    pick.disabled = chosenSide === side;
    pick.addEventListener("click", () => {
      takeVersion(item, side);
      save(item);
      repaint(item);
      renderProgress();
    });
    head.append(label, pick);

    const body = document.createElement("div");
    body.className = "panel-text";
    for (const seg of item.segments) {
      if (seg.type === "same") {
        appendSource(body, seg.text);
        continue;
      }
      const v = previewVerdicts(item, side);
      const text = v[seg.index] === "master" ? seg.to : seg.from;
      if (text === "") continue;
      if (seg.kind !== "judgment" || !markDiffs) {
        appendSource(body, text);
        continue;
      }
      const mark = document.createElement("span");
      mark.className = "diffmark";
      appendSource(mark, text);
      body.append(mark);
    }
    panel.append(head, body);
    wrap.append(panel);
  }
  return wrap;
}

function repaint(item) {
  const entry = cards.get(item.id);
  if (!entry) return;

  if (spanMode(item)) {
    entry.body.className = "text";
    entry.body.replaceChildren(
      ...item.segments.map((seg) => {
        if (seg.type === "same") {
          const frag = document.createElement("span");
          frag.className = "same";
          appendSource(frag, seg.text);
          return frag;
        }
        return renderSpan(item, seg);
      }),
    );
  } else {
    entry.body.className = "text compare-host";
    entry.body.replaceChildren(renderCompare(item));
  }

  if (entry.modeBtn) {
    entry.modeBtn.textContent = spanMode(item) ? "Compare whole versions" : "Compare span by span";
  }
  const st = recordState(item);
  entry.card.dataset.state = st;
  const left = openHunks(item).length;
  entry.status.textContent = left ? `${left} question${left === 1 ? "" : "s"} left` : stateLabel(st);
}

function liveUrl(item) {
  const base = `https://litbible.net/${item.bookKey}-${item.chapter}`;
  if (item.kind === "footnote") {
    const label = String(item.repoLabel ?? "").replace(/^fn-/, "");
    return label ? `${base}#fn-${label}` : base;
  }
  return item.verse ? `${base}#v${item.verse}` : base;
}

function renderRecord(item) {
  const card = document.createElement("article");
  card.className = "record";
  card.id = `rec-${item.id}`;

  const h = document.createElement("h2");
  const where = item.kind === "footnote" ? `note ${item.repoLabel ?? ""}`.trim() : `verse ${item.verse}`;
  h.textContent = `${item.bookLabel} ${item.chapter} — ${where}`;

  const link = document.createElement("a");
  link.className = "live";
  link.href = liveUrl(item);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "see it on the site";
  h.append(" ", link);

  const nJ = hunks(item).filter((s) => s.kind === "judgment").length;
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent =
    `bucket ${item.bucket} · ${item.subclass}` +
    (item.settledAt ? ` · settled ${item.settledAt.slice(0, 10)}` : "") +
    ` · ${nJ} question${nJ === 1 ? "" : "s"}`;

  card.append(h, meta);

  if (item.forceHandReview) {
    const w = document.createElement("p");
    w.className = "warn";
    w.textContent = item.forceHandReview;
    card.append(w);
  }

  const body = document.createElement("div");
  body.className = "text";
  card.append(body);

  const choices = document.createElement("div");
  choices.className = "choices";
  const status = document.createElement("span");
  status.className = "state";

  const bulk = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => {
      fn();
      save(item);
      repaint(item);
      renderProgress();
    });
    return b;
  };
  const modeBtn = document.createElement("button");
  modeBtn.type = "button";
  modeBtn.className = "mode";
  modeBtn.addEventListener("click", () => {
    item._spanMode = !spanMode(item);
    repaint(item);
  });

  choices.append(
    bulk("Answer the rest with the master", () => answerRest(item, "master")),
    bulk("Answer the rest with the repo", () => answerRest(item, "repo")),
    bulk("Start over", () => {
      const v = verdictsFor(item);
      for (const k of Object.keys(v)) delete v[k];
      Object.assign(v, defaultVerdicts(item.segments));
    }),
    modeBtn,
    status,
  );
  card.append(choices);

  cards.set(item.id, { card, body, status, modeBtn });
  repaint(item);
  return card;
}

function visibleItems() {
  let list = state.items;
  if (state.book) list = list.filter((i) => i.bookKey === state.book);
  if (state.onlyOpen) list = list.filter((i) => openHunks(i).length > 0);
  return list;
}

function renderBooks() {
  const seen = [];
  for (const i of state.items) if (!seen.includes(i.bookKey)) seen.push(i.bookKey);
  const make = (key, label, n) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const open = (key === null ? state.items : state.items.filter((i) => i.bookKey === key)).reduce(
      (acc, i) => acc + openHunks(i).length,
      0,
    );
    btn.innerHTML = "";
    btn.append(document.createTextNode(`${label} `));
    const c = document.createElement("span");
    c.className = open ? "count open" : "count";
    c.textContent = open ? String(open) : "✓";
    btn.append(c);
    btn.setAttribute("aria-pressed", String(state.book === key));
    btn.addEventListener("click", () => {
      state.book = key;
      render();
    });
    return btn;
  };
  el.books.replaceChildren(
    make(null, "All books"),
    ...seen.map((k) => make(k, state.items.find((i) => i.bookKey === k).bookLabel)),
  );
}

function renderProgress() {
  const total = state.counts.judgment;
  const open = state.items.reduce((n, i) => n + openHunks(i).filter((s) => s.kind === "judgment").length, 0);
  const done = total - open;
  const pct = total ? Math.round((done / total) * 100) : 100;
  el.barFill.style.width = `${pct}%`;
  el.progress.textContent =
    `${done} of ${total} questions answered (${pct}%)  ·  ` +
    `${state.counts.mechanical + state.counts.structural} spans answered for you`;
  el.jump.disabled = open === 0;
  renderBooks();
}

function render() {
  cards.clear();
  const shown = visibleItems();
  el.records.replaceChildren(...shown.map(renderRecord));
  if (shown.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nothing left here. Clear the filters to see the settled records.";
    el.records.append(p);
  }
  renderProgress();
}

// ---------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------

/** Bulk buttons only fill in what is still open - they never overwrite a span
 *  you already answered, so a mis-click costs one undo rather than the record. */
function answerRest(item, side) {
  const v = verdictsFor(item);
  const open = hunks(item).filter((s) => !v[s.index]);
  snapshot(item, open.map((s) => s.index));
  for (const s of open) v[s.index] = side;
}

/** Answer every judgment span from one side, as one undoable action. This is
 *  what "Use this version" means, and mechanical/structural spans keep their
 *  own defaults - taking a version must never delete authored markup. */
function takeVersion(item, side) {
  const v = verdictsFor(item);
  const j = hunks(item).filter((s) => s.kind === "judgment");
  snapshot(item, j.map((s) => s.index));
  for (const s of j) v[s.index] = side;
}

/**
 * Undo is per ACTION, not per span. Choosing a whole version sets 51 verdicts
 * at once, and a stack that unwound those one press at a time would not be an
 * undo anybody could use. Each frame is the full set of spans one action
 * touched, with the value each held before it.
 */
function snapshot(item, indices) {
  if (!indices.length) return;
  const v = verdictsFor(item);
  state.undo.push(indices.map((index) => ({ id: item.id, index, prev: v[index] })));
  if (state.undo.length > 200) state.undo.shift();
}

async function save(item) {
  const verdicts = verdictsFor(item);
  try {
    const res = await fetch("/api/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, verdicts }),
    });
    const body = await res.json();
    state.decisions[item.id] = { ...(state.decisions[item.id] || {}), decision: body.decision, verdicts };
  } catch (e) {
    console.error(e);
    document.body.dataset.saveError = "1";
  }
}

function setVerdict(item, index, side, advance) {
  snapshot(item, [index]);
  verdictsFor(item)[index] = side;
  save(item);
  repaint(item);
  renderProgress();
  if (advance) {
    const next = nextOpen({ id: item.id, index });
    state.focus = next;
    if (next) {
      repaint(state.items.find((i) => i.id === next.id));
      focusCurrent();
    }
  }
}

function undo() {
  const frame = state.undo.pop();
  if (!frame || frame.length === 0) return;
  const item = state.items.find((i) => i.id === frame[0].id);
  if (!item) return;
  const v = verdictsFor(item);
  for (const step of frame) {
    if (step.prev === undefined) delete v[step.index];
    else v[step.index] = step.prev;
  }
  state.focus = { id: item.id, index: spanMode(item) ? frame[0].index : null };
  save(item);
  repaint(item);
  renderProgress();
  focusCurrent();
}

// ---------------------------------------------------------------------
// Focus and keyboard
// ---------------------------------------------------------------------

/**
 * Every stop still needing an answer, in the order it is shown. A record shown
 * span by span contributes one stop per open hunk; a record in whole-version
 * mode contributes a single stop with `index: null`, because that is the one
 * question it is asking. Skipping those entirely would make "next unanswered"
 * silently walk past the five biggest records.
 */
function openList() {
  const out = [];
  for (const item of visibleItems()) {
    if (openHunks(item).length === 0) continue;
    if (spanMode(item)) {
      for (const s of openHunks(item)) out.push({ id: item.id, index: s.index });
    } else {
      out.push({ id: item.id, index: null });
    }
  }
  return out;
}

/** Position of a stop in reading order, for "the next one after this". A
 *  record-level stop sorts ahead of any hunk in the same record. */
function stopRank(stop, order) {
  const rec = order.indexOf(stop.id);
  return [rec < 0 ? Number.MAX_SAFE_INTEGER : rec, stop.index === null ? -1 : stop.index];
}
const rankLt = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

function nextOpen(after) {
  const list = openList();
  if (list.length === 0) return null;
  if (!after) return list[0];
  const order = visibleItems().map((i) => i.id);
  const from = stopRank(after, order);
  for (const cand of list) if (rankLt(from, stopRank(cand, order))) return cand;
  return list[0];
}

function prevOpen(before) {
  const list = openList();
  if (list.length === 0) return null;
  if (!before) return list[list.length - 1];
  const order = visibleItems().map((i) => i.id);
  const from = stopRank(before, order);
  let best = null;
  for (const cand of list) if (rankLt(stopRank(cand, order), from)) best = cand;
  return best || list[list.length - 1];
}

function focusCurrent() {
  if (!state.focus) return;
  const entry = cards.get(state.focus.id);
  if (!entry) return;
  for (const g of document.querySelectorAll(".choice.is-focus, .compare.is-focus")) {
    g.classList.remove("is-focus");
  }

  if (state.focus.index === null) {
    const cmp = entry.body.querySelector(".compare");
    if (!cmp) return;
    cmp.classList.add("is-focus");
    cmp.scrollIntoView({ block: "center", behavior: "smooth" });
    const btn = cmp.querySelector(".pick:not(:disabled)");
    if (btn) btn.focus({ preventScroll: true });
    return;
  }

  const group = entry.body.querySelector(`.choice[data-hunk="${state.focus.index}"]`);
  if (!group) return;
  group.classList.add("is-focus");
  group.scrollIntoView({ block: "center", behavior: "smooth" });
  const btn = group.querySelector(".opt");
  if (btn) btn.focus({ preventScroll: true });
}

function jump(dir) {
  const target = dir < 0 ? prevOpen(state.focus) : nextOpen(state.focus);
  if (!target) return;
  const prevId = state.focus?.id;
  state.focus = target;
  if (prevId && prevId !== target.id) {
    const prevItem = state.items.find((i) => i.id === prevId);
    if (prevItem) repaint(prevItem);
  }
  repaint(state.items.find((i) => i.id === target.id));
  focusCurrent();
}

function answerFocused(side) {
  if (!state.focus) {
    jump(1);
    return;
  }
  const item = state.items.find((i) => i.id === state.focus.id);
  if (!item) return;

  if (state.focus.index === null) {
    // Whole-version mode: the record is one question, so one key answers it.
    takeVersion(item, side);
    save(item);
    repaint(item);
    renderProgress();
    const next = nextOpen(state.focus);
    state.focus = next;
    if (next) {
      repaint(state.items.find((i) => i.id === next.id));
      focusCurrent();
    }
    return;
  }

  if (verdictsFor(item)[state.focus.index]) return; // already answered
  setVerdict(item, state.focus.index, side, true);
}

document.addEventListener("keydown", (e) => {
  // `document` is the target whenever nothing is focused, and it has no
  // .matches() - calling it there throws and takes every shortcut down with it.
  if (e.target instanceof Element && e.target.matches("input, textarea")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === "n" || k === "j") { e.preventDefault(); jump(1); }
  else if (k === "p" || k === "k") { e.preventDefault(); jump(-1); }
  else if (k === "1" || k === "ArrowLeft") { e.preventDefault(); answerFocused("repo"); }
  else if (k === "2" || k === "ArrowRight") { e.preventDefault(); answerFocused("master"); }
  else if (k === "u") {
    e.preventDefault();
    if (!state.focus || state.focus.index === null) return;
    const item = state.items.find((i) => i.id === state.focus.id);
    if (!item) return;
    snapshot(item, [state.focus.index]);
    delete verdictsFor(item)[state.focus.index];
    save(item);
    repaint(item);
    renderProgress();
    focusCurrent();
  } else if (k === "?") {
    e.preventDefault();
    el.helpToggle.click();
  }
});

el.jump.addEventListener("click", () => jump(1));
el.onlyOpen.addEventListener("change", () => {
  state.onlyOpen = el.onlyOpen.checked;
  render();
});
el.helpToggle.addEventListener("click", () => {
  const open = el.help.hidden;
  el.help.hidden = !open;
  el.helpToggle.setAttribute("aria-expanded", String(open));
});

// ---------------------------------------------------------------------

const res = await fetch("/api/items");
const data = await res.json();
state.items = data.items;
state.decisions = data.decisions;
state.counts = data.counts;
render();
