// scripts/alignment-review/ui/app.js
//
// Alignment review tool — client. Localhost-only, single-operator, no build
// step: plain ES module, plain fetch, plain DOM. Talks to the HTTP contract
// in server.mjs (GET/POST /api/terms, /api/terms/:id, /api/absent, ...) —
// see the docblock at the bottom of this file for the exact shapes this
// code assumes.
//
// WHY ONE TERM = ONE PAGE. Consistency across verses is the judgment being
// made ("is this the same rendering as verse 12, or a new one?"), so the
// reviewer needs the whole queue and the accumulating "renderings so far"
// summary in view together, not paginated apart. That summary panel —
// click a rendering to apply its form to the row you're looking at — is
// the single most load-bearing piece of UI here.
//
// WHY NO innerHTML WITH SERVER DATA. Verse text, forms, and references all
// come from the API. Every place they reach the DOM goes through
// textContent/createElement, never string-built HTML, so there is nothing
// to escape and nothing to get wrong.

// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------
//
// `rows` and `rowEls` are keyed by verse ref and rebuilt whenever a term
// page loads. Row state is UI-local (which words are selected, which span
// is active, whether a settled row is being re-edited) and is reconciled
// against the server's `decided`/`records` on every successful POST —
// the server is always the source of truth for what's actually saved.

const state = {
  view: "terms", // "terms" | "absent"
  terms: [], // GET /api/terms summaries, kept in sync with each save
  selectedTermId: null,
  termPage: null, // GET /api/terms/:id payload for the selected term
  rows: new Map(), // ref -> row state
  rowEls: new Map(), // ref -> <li> element (for in-place re-render)
  orderedRefs: [], // verse refs in queue order, for j/k navigation
  focusedRef: null,
  absentGroups: [],
  absentLoaded: false,
};

let spanCounter = 0;
function makeSpan() {
  spanCounter += 1;
  return { id: `span-${spanCounter}`, wordStart: null, wordEnd: null, form: "", formDirty: false };
}

// -----------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------

class ApiError extends Error {}

async function api(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch (err) {
    throw new ApiError(`network error (${err?.message || err})`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body — fall through, res.ok/status still tell the story.
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `${res.status} ${res.statusText}`);
  }

  return data;
}

// -----------------------------------------------------------------------
// Small DOM helpers
// -----------------------------------------------------------------------

function mkBtn(label, className, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function mkLoading(text) {
  const p = document.createElement("p");
  p.className = "loading-inline";
  p.textContent = text;
  return p;
}

function mkError(text) {
  const p = document.createElement("p");
  p.className = "sidebar-error";
  p.textContent = text;
  return p;
}

function showToast(message, { error = false } = {}) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (error ? " toast--error" : "");
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), error ? 9000 : 4000);
}

function setGlobalStatus(text) {
  const el = document.getElementById("global-status");
  if (el) el.textContent = text || "";
}

function formatProgress(progress) {
  if (!progress) return "";
  return `${progress.done}/${progress.total} done · ${progress.remaining} remaining`;
}

// -----------------------------------------------------------------------
// Word-span geometry
//
// `words[].start`/`end` are character offsets into `verse.text`, half-open
// (slice semantics: text.slice(start, end) === the word). A "span" the
// reviewer builds is a contiguous run of word indices [wordStart, wordEnd].
// -----------------------------------------------------------------------

function wordRangeFromCharSpan(words, start, end) {
  let s = -1;
  let e = -1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.start >= start && w.start < end) {
      if (s === -1) s = i;
      e = i;
    }
  }
  return s === -1 ? null : { start: s, end: e };
}

function spanText(verse, span) {
  if (span.wordStart == null || span.wordEnd == null) return "";
  const words = verse.words || [];
  const a = words[span.wordStart];
  const b = words[span.wordEnd];
  if (!a || !b) return "";
  return verse.text.slice(a.start, b.end);
}

// Best-effort re-location of a confirmed record's English text back onto
// word indices, so a settled row can be re-opened for editing with its
// prior span still highlighted. This is convenience, not correctness —
// the record itself (not this reconstruction) is what's saved; if the
// text has shifted underneath it we just fail to highlight and the
// reviewer re-picks words.
function findNthOccurrence(hay, needle, n) {
  if (!needle) return -1;
  const hayL = hay.toLowerCase();
  const needleL = needle.toLowerCase();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    idx = hayL.indexOf(needleL, idx + 1);
    if (idx === -1) return -1;
  }
  return idx;
}

function spansFromRecords(verse) {
  const spans = [];
  for (const rec of verse.records || []) {
    if (rec.status !== "confirmed") continue;
    const english = rec.english || [];
    if (!english.length) continue;

    const joined = english.map((e) => e.text).join(" ");
    const n = english[0]?.n || 1;
    const start = findNthOccurrence(verse.text, joined, n);
    const range = start === -1 ? null : wordRangeFromCharSpan(verse.words || [], start, start + joined.length);

    spans.push({
      id: makeSpan().id,
      wordStart: range ? range.start : null,
      wordEnd: range ? range.end : null,
      form: rec.term?.form || joined,
      formDirty: true,
    });
  }
  return spans;
}

// -----------------------------------------------------------------------
// Row state
// -----------------------------------------------------------------------

function buildRowState(verse) {
  const decided = Boolean(verse.decided);
  let spans = [];

  if (decided) {
    spans = spansFromRecords(verse);
  } else if (verse.proposal) {
    const range = wordRangeFromCharSpan(verse.words || [], verse.proposal.start, verse.proposal.end);
    spans = [
      {
        id: makeSpan().id,
        wordStart: range ? range.start : null,
        wordEnd: range ? range.end : null,
        form: verse.proposal.form || verse.proposal.text || "",
        formDirty: false,
      },
    ];
  }

  return {
    ref: verse.ref,
    verse,
    spans,
    activeSpanId: spans[0]?.id || null,
    editing: !decided, // undecided rows start editable; decided rows start settled
    decided,
    busy: false,
  };
}

// -----------------------------------------------------------------------
// Word click -> span toggle
//
// Clicking a word toggles its membership in the row's ACTIVE span. Contiguous
// selected words form the span, enforced here rather than left to the caller:
//   - adjacent to the current range -> extends it
//   - an edge word already in range -> shrinks it
//   - a middle word already in range -> no single contiguous answer exists,
//     so we restart the span at just that word (predictable > clever)
//   - anywhere else -> starts a fresh single-word span
// -----------------------------------------------------------------------

function applyWordToggle(span, idx) {
  if (span.wordStart == null) {
    span.wordStart = idx;
    span.wordEnd = idx;
    return;
  }

  if (idx === span.wordStart - 1) {
    span.wordStart = idx;
    return;
  }
  if (idx === span.wordEnd + 1) {
    span.wordEnd = idx;
    return;
  }

  if (idx >= span.wordStart && idx <= span.wordEnd) {
    if (idx === span.wordStart) {
      if (span.wordStart === span.wordEnd) {
        span.wordStart = null;
        span.wordEnd = null;
      } else {
        span.wordStart += 1;
      }
      return;
    }
    if (idx === span.wordEnd) {
      span.wordEnd -= 1;
      return;
    }
    // Clicked word in the middle of the current selection.
    span.wordStart = idx;
    span.wordEnd = idx;
    return;
  }

  // Not adjacent, not inside — start a fresh span here.
  span.wordStart = idx;
  span.wordEnd = idx;
}

function onWordClick(row, idx) {
  if (row.busy) return;

  let span = row.spans.find((s) => s.id === row.activeSpanId);
  if (!span) {
    span = makeSpan();
    row.spans.push(span);
    row.activeSpanId = span.id;
  }

  applyWordToggle(span, idx);

  // Keep the form field in sync with the selection unless the reviewer has
  // hand-edited it (e.g. typed "reorienting the mind" over a literal
  // "transformation of the mind" selection) — that override must survive
  // further clicks.
  if (!span.formDirty) {
    span.form = spanText(row.verse, span);
  }

  setFocusedRef(row.ref);
  rerenderRow(row);
}

// -----------------------------------------------------------------------
// Rendering: verse text with clickable word spans
// -----------------------------------------------------------------------

function spanMembershipForWord(row, idx) {
  for (let i = 0; i < row.spans.length; i++) {
    const span = row.spans[i];
    if (span.wordStart == null) continue;
    if (idx >= span.wordStart && idx <= span.wordEnd) {
      return { isAlt: i > 0 };
    }
  }
  return null;
}

function renderVerseText(row) {
  const verse = row.verse;
  const p = document.createElement("p");
  p.className = "verse-row__text";

  const text = verse.text || "";
  const words = verse.words || [];
  let cursor = 0;

  words.forEach((w, idx) => {
    if (w.start > cursor) {
      p.appendChild(document.createTextNode(text.slice(cursor, w.start)));
    }

    const wordEl = document.createElement("span");
    wordEl.textContent = text.slice(w.start, w.end);
    wordEl.className = "verse-word";
    wordEl.dataset.wordIndex = String(idx);

    const membership = spanMembershipForWord(row, idx);
    if (membership) {
      wordEl.classList.add("is-selected");
      if (membership.isAlt) wordEl.classList.add("is-alt-span");
    }

    if (row.editing) {
      wordEl.addEventListener("click", () => onWordClick(row, idx));
    } else {
      wordEl.classList.add("is-readonly");
    }

    p.appendChild(wordEl);
    cursor = w.end;
  });

  if (cursor < text.length) {
    p.appendChild(document.createTextNode(text.slice(cursor)));
  }

  return p;
}

// -----------------------------------------------------------------------
// Rendering: the editable span list ("+ add span" for a second rendering
// in the same verse) and the read-only settled summary for decided rows.
// -----------------------------------------------------------------------

function renderSpanEditor(row) {
  const wrap = document.createElement("div");
  wrap.className = "span-editor";

  row.spans.forEach((span, i) => {
    const line = document.createElement("div");
    line.className =
      "span-row" + (i > 0 ? " is-alt-span" : "") + (span.id === row.activeSpanId ? " is-active" : "");

    const swatch = document.createElement("span");
    swatch.className = "span-row__swatch";
    swatch.setAttribute("aria-hidden", "true");
    line.appendChild(swatch);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "span-row__form";
    input.placeholder = "Click words above, or type a form";
    input.value = span.form || "";
    input.addEventListener("focus", () => {
      row.activeSpanId = span.id;
      setFocusedRef(row.ref);
      // Re-render just enough to move the "active" outline; skip a full
      // rerenderRow so the input doesn't lose focus mid-keystroke.
      wrap.querySelectorAll(".span-row").forEach((el) => el.classList.remove("is-active"));
      line.classList.add("is-active");
    });
    input.addEventListener("input", () => {
      span.form = input.value;
      span.formDirty = true;
    });
    line.appendChild(input);

    if (row.spans.length > 1) {
      line.appendChild(
        mkBtn("Remove span", "btn btn--ghost btn--small", () => {
          row.spans = row.spans.filter((s) => s.id !== span.id);
          if (row.activeSpanId === span.id) {
            row.activeSpanId = row.spans[0]?.id || null;
          }
          rerenderRow(row);
        }),
      );
    }

    wrap.appendChild(line);
  });

  wrap.appendChild(
    mkBtn("+ add span", "btn btn--ghost btn--small", () => {
      const span = makeSpan();
      row.spans.push(span);
      row.activeSpanId = span.id;
      rerenderRow(row);
    }),
  );

  return wrap;
}

function renderSettledSummary(row) {
  const p = document.createElement("p");
  p.className = "verse-row__settled";

  const records = row.verse.records || [];
  const confirmed = records.filter((r) => r.status === "confirmed");
  const noRendering = records.some((r) => r.status === "no-rendering");

  if (confirmed.length) {
    const forms = confirmed.map((r) => `“${r.term?.form || (r.english || []).map((e) => e.text).join(" ")}”`);
    p.append("Confirmed: ");
    const strong = document.createElement("strong");
    strong.textContent = forms.join(", ");
    p.appendChild(strong);
  } else if (noRendering) {
    p.textContent = "Marked: no rendering of this term in this verse.";
    p.classList.add("verse-row__no-rendering");
  } else {
    p.textContent = "Decided.";
  }

  return p;
}

// -----------------------------------------------------------------------
// Rendering: one verse row, rebuilt in place on every state change (word
// click, span add/remove, save). Keeping the same <li> across rebuilds
// preserves scroll position and the j/k focus outline.
// -----------------------------------------------------------------------

function populateRowElement(li, row) {
  li.replaceChildren();
  li.dataset.ref = row.ref;
  li.classList.toggle("is-decided", row.decided && !row.editing);
  li.classList.toggle("is-focused", state.focusedRef === row.ref);
  li.addEventListener("click", () => setFocusedRef(row.ref), { once: false });

  const head = document.createElement("div");
  head.className = "verse-row__head";

  const refEl = document.createElement("span");
  refEl.className = "verse-row__ref";
  refEl.textContent = row.verse.label || row.ref;
  head.appendChild(refEl);

  if (row.verse.doubleConfirmed) {
    const flag = document.createElement("span");
    flag.className = "verse-row__flag verse-row__flag--double";
    flag.textContent = "Double-confirmed";
    head.appendChild(flag);
  }

  if (row.decided) {
    const flag = document.createElement("span");
    flag.className = "verse-row__flag verse-row__flag--decided";
    flag.textContent = row.editing ? "Editing" : "Decided";
    head.appendChild(flag);
  }

  li.appendChild(head);
  li.appendChild(renderVerseText(row));

  if (row.decided && !row.editing) {
    li.appendChild(renderSettledSummary(row));

    const actions = document.createElement("div");
    actions.className = "verse-row__actions";
    actions.appendChild(
      mkBtn("Edit", "btn btn--ghost btn--small", () => {
        row.editing = true;
        rerenderRow(row);
      }),
    );
    li.appendChild(actions);
    return;
  }

  li.appendChild(renderSpanEditor(row));

  const actions = document.createElement("div");
  actions.className = "verse-row__actions";

  const confirmBtn = mkBtn("Confirm", "btn btn--primary btn--small", () => submitRow(row, "confirm"));
  const noRenderBtn = mkBtn("No rendering", "btn btn--small", () => submitRow(row, "no-rendering"));
  const skipBtn = mkBtn("Skip", "btn btn--ghost btn--small", () => focusNextRow(row.ref));

  confirmBtn.disabled = row.busy;
  noRenderBtn.disabled = row.busy;
  skipBtn.disabled = row.busy;

  actions.append(confirmBtn, noRenderBtn, skipBtn);

  if (row.decided) {
    actions.appendChild(
      mkBtn("Cancel edit", "btn btn--ghost btn--small", () => {
        row.spans = spansFromRecords(row.verse);
        row.activeSpanId = row.spans[0]?.id || null;
        row.editing = false;
        rerenderRow(row);
      }),
    );
  }

  li.appendChild(actions);
}

function rerenderRow(row) {
  const li = state.rowEls.get(row.ref);
  if (!li) return;
  populateRowElement(li, row);
}

// -----------------------------------------------------------------------
// Row actions: save to the server
// -----------------------------------------------------------------------

async function submitRow(row, action) {
  if (row.busy) return;

  let body;
  if (action === "confirm") {
    const spans = row.spans
      .filter((s) => s.wordStart != null)
      .map((s) => {
        const text = spanText(row.verse, s);
        return { text, start: row.verse.words[s.wordStart].start, form: (s.form || "").trim() || text };
      });

    if (!spans.length) {
      showToast('Select at least one span before confirming (or use "No rendering").', { error: true });
      return;
    }
    body = { action: "confirm", spans };
  } else if (action === "no-rendering") {
    body = { action: "no-rendering" };
  } else {
    return;
  }

  row.busy = true;
  rerenderRow(row);

  try {
    const result = await api(
      `/api/terms/${encodeURIComponent(state.selectedTermId)}/verses/${encodeURIComponent(row.ref)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    applyServerUpdate(result);
    focusNextRow(row.ref);
  } catch (err) {
    showToast(`Could not save ${row.ref}: ${err.message}`, { error: true });
  } finally {
    row.busy = false;
    rerenderRow(row);
  }
}

// Fold a verse-save response back into local state: the row itself, the
// progress badge, the renderings panel, and the sidebar's done/total for
// this term. The server's numbers win outright — we never recompute them.
function applyServerUpdate(result) {
  if (!state.termPage) return;

  state.termPage.progress = result.progress;
  state.termPage.renderings = result.renderings;

  const badge = document.getElementById("term-progress-badge");
  if (badge) badge.textContent = formatProgress(result.progress);

  const panel = document.getElementById("renderings-panel");
  if (panel) populateRenderingsPanel(panel);

  const termEntry = state.terms.find((t) => t.id === state.selectedTermId);
  if (termEntry && result.progress) {
    termEntry.total = result.progress.total;
    termEntry.done = result.progress.done;
    termEntry.remaining = result.progress.remaining;
    renderTermSidebar();
  }

  const row = state.rows.get(result.ref);
  if (row) {
    row.verse.records = result.records;
    row.verse.decided = result.decided;
    row.decided = Boolean(result.decided);
    if (row.decided) {
      row.spans = spansFromRecords(row.verse);
      row.activeSpanId = row.spans[0]?.id || null;
      row.editing = false;
    }
    rerenderRow(row);
  }
}

async function acceptAllDoubleConfirmed() {
  if (!state.selectedTermId) return;
  setGlobalStatus("Accepting double-confirmed records…");
  try {
    const result = await api(`/api/terms/${encodeURIComponent(state.selectedTermId)}/accept-double-confirmed`, {
      method: "POST",
    });
    showToast(`Accepted ${result.confirmed} record${result.confirmed === 1 ? "" : "s"} across ${result.verses} verse${result.verses === 1 ? "" : "s"}.`);
    // The response doesn't enumerate which verses moved, so the simplest
    // correct thing is to reload the term page wholesale.
    await loadTermPage(state.selectedTermId);
  } catch (err) {
    showToast(`Could not accept double-confirmed records: ${err.message}`, { error: true });
  } finally {
    setGlobalStatus("");
  }
}

// -----------------------------------------------------------------------
// Renderings-so-far panel
// -----------------------------------------------------------------------

function applyRenderingToFocusedRow(form) {
  const row = state.rows.get(state.focusedRef);
  if (!row) {
    showToast("Focus a verse row first (click it, or use j/k), then click a rendering to apply it.", {
      error: true,
    });
    return;
  }

  if (row.decided && !row.editing) row.editing = true;

  let span = row.spans.find((s) => s.id === row.activeSpanId);
  if (!span) {
    span = makeSpan();
    row.spans.push(span);
    row.activeSpanId = span.id;
  }
  span.form = form;
  span.formDirty = true;

  rerenderRow(row);
}

function populateRenderingsPanel(wrap) {
  wrap.replaceChildren();

  const title = document.createElement("p");
  title.className = "renderings-panel__title";
  title.textContent = "Renderings so far";
  wrap.appendChild(title);

  const renderings = state.termPage?.renderings || [];
  if (!renderings.length) {
    const empty = document.createElement("p");
    empty.className = "renderings-panel__empty";
    empty.textContent = "No confirmed renderings yet.";
    wrap.appendChild(empty);
    return;
  }

  const chips = document.createElement("div");
  chips.className = "rendering-chips";

  for (const r of renderings) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "rendering-chip";
    chip.title = `Apply "${r.form}" to the focused row`;

    const label = document.createElement("span");
    label.textContent = r.form;
    const count = document.createElement("span");
    count.className = "rendering-chip__count";
    count.textContent = String(r.count);

    chip.append(label, count);
    chip.addEventListener("click", () => applyRenderingToFocusedRow(r.form));
    chips.appendChild(chip);
  }

  wrap.appendChild(chips);
}

function renderRenderingsPanel() {
  const wrap = document.createElement("div");
  wrap.className = "renderings-panel";
  wrap.id = "renderings-panel";
  populateRenderingsPanel(wrap);
  return wrap;
}

// -----------------------------------------------------------------------
// Keyboard: j/k move the focused row, Enter confirms it. Skipped whenever
// focus is inside a text input so typing a form value doesn't navigate.
// -----------------------------------------------------------------------

function setFocusedRef(ref) {
  if (state.focusedRef && state.rowEls.has(state.focusedRef)) {
    state.rowEls.get(state.focusedRef).classList.remove("is-focused");
  }
  state.focusedRef = ref;
  if (ref && state.rowEls.has(ref)) {
    state.rowEls.get(ref).classList.add("is-focused");
  }
}

function moveFocus(delta) {
  const refs = state.orderedRefs;
  if (!refs.length) return;
  const idx = state.focusedRef ? refs.indexOf(state.focusedRef) : -1;
  const next = Math.min(refs.length - 1, Math.max(0, idx + delta));
  setFocusedRef(refs[next]);
  state.rowEls.get(refs[next])?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function focusNextRow(currentRef) {
  const refs = state.orderedRefs;
  const idx = refs.indexOf(currentRef);
  if (idx === -1) return;
  const next = refs[idx + 1];
  if (!next) return;
  setFocusedRef(next);
  state.rowEls.get(next)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

document.addEventListener("keydown", (e) => {
  if (state.view !== "terms" || !state.termPage) return;

  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (e.key === "j") {
    e.preventDefault();
    moveFocus(1);
  } else if (e.key === "k") {
    e.preventDefault();
    moveFocus(-1);
  } else if (e.key === "Enter") {
    const row = state.rows.get(state.focusedRef);
    if (row) {
      e.preventDefault();
      submitRow(row, "confirm");
    }
  }
});

// -----------------------------------------------------------------------
// Term sidebar
// -----------------------------------------------------------------------

function renderTermSidebar() {
  const aside = document.getElementById("term-sidebar");
  aside.replaceChildren();

  if (!state.terms.length) {
    aside.appendChild(mkLoading("No terms found."));
    return;
  }

  // Worst-progress-first: lowest completion ratio surfaces first, so the
  // sidebar always points at where review is most needed.
  const sorted = [...state.terms].sort((a, b) => {
    const ra = a.total ? a.done / a.total : 0;
    const rb = b.total ? b.done / b.total : 0;
    if (ra !== rb) return ra - rb;
    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
    return (a.traditional || a.id).localeCompare(b.traditional || b.id);
  });

  const ul = document.createElement("ul");
  ul.className = "term-list";

  for (const t of sorted) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "term-list-item" +
      (t.id === state.selectedTermId ? " is-selected" : "") +
      (t.remaining === 0 ? " is-complete" : "");
    btn.dataset.termId = t.id;

    const name = document.createElement("span");
    name.className = "term-list-item__name";
    name.textContent = t.traditional ? `${t.traditional} — ${t.greek || t.id}` : t.greek || t.id;
    btn.appendChild(name);

    const meta = document.createElement("span");
    meta.className = "term-list-item__meta";
    const doneSpan = document.createElement("span");
    doneSpan.textContent = `${t.done}/${t.total}`;
    meta.appendChild(doneSpan);
    if (t.doubleConfirmed > 0) {
      const dc = document.createElement("span");
      dc.textContent = `${t.doubleConfirmed} double-confirmed`;
      meta.appendChild(dc);
    }
    btn.appendChild(meta);

    const bar = document.createElement("span");
    bar.className = "term-list-item__bar";
    const fill = document.createElement("span");
    fill.className = "term-list-item__bar-fill";
    const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    btn.appendChild(bar);

    btn.addEventListener("click", () => selectTerm(t.id));
    li.appendChild(btn);
    ul.appendChild(li);
  }

  aside.appendChild(ul);
}

async function selectTerm(id) {
  if (state.selectedTermId === id && state.termPage) return;
  state.selectedTermId = id;
  state.focusedRef = null;
  renderTermSidebar();
  await loadTermPage(id);
}

// -----------------------------------------------------------------------
// Term page
// -----------------------------------------------------------------------

async function loadTermPage(id) {
  const container = document.getElementById("term-main");
  container.replaceChildren(mkLoading("Loading term…"));

  try {
    const payload = await api(`/api/terms/${encodeURIComponent(id)}`);
    state.termPage = payload;
    renderTermPage();
  } catch (err) {
    container.replaceChildren(mkError(`Could not load term: ${err.message}`));
  }
}

function renderTermPage() {
  const container = document.getElementById("term-main");
  container.replaceChildren();

  const payload = state.termPage;
  if (!payload) return;

  const header = document.createElement("div");
  header.className = "term-header";

  const title = document.createElement("h2");
  title.className = "term-header__title";
  title.textContent = payload.term.traditional || payload.term.id;
  header.appendChild(title);

  if (payload.term.greek) {
    const greek = document.createElement("span");
    greek.className = "term-header__greek";
    greek.textContent = payload.term.greek;
    header.appendChild(greek);
  }

  if (payload.term.lit) {
    const lit = document.createElement("span");
    lit.className = "term-header__traditional";
    lit.textContent = `LIT: ${payload.term.lit}`;
    header.appendChild(lit);
  }

  const progress = document.createElement("span");
  progress.className = "term-header__progress";
  progress.id = "term-progress-badge";
  progress.textContent = formatProgress(payload.progress);
  header.appendChild(progress);

  if (payload.doubleConfirmed > 0) {
    header.appendChild(
      mkBtn(
        `Accept all ${payload.doubleConfirmed} double-confirmed`,
        "btn btn--primary term-header__accept-all",
        acceptAllDoubleConfirmed,
      ),
    );
  }

  container.appendChild(header);
  container.appendChild(renderRenderingsPanel());

  const list = document.createElement("ul");
  list.className = "verse-list";
  list.id = "verse-list";

  state.rows.clear();
  state.rowEls.clear();
  state.orderedRefs = [];

  for (const verse of payload.verses || []) {
    const row = buildRowState(verse);
    state.rows.set(row.ref, row);
    state.orderedRefs.push(row.ref);

    const li = document.createElement("li");
    li.className = "verse-row";
    state.rowEls.set(row.ref, li);
    populateRowElement(li, row);
    list.appendChild(li);
  }

  container.appendChild(list);

  if (!list.children.length) {
    container.appendChild(mkLoading("No verses in this term's queue."));
  }

  setFocusedRef(state.orderedRefs.includes(state.focusedRef) ? state.focusedRef : state.orderedRefs[0] || null);
}

// -----------------------------------------------------------------------
// Absent view
// -----------------------------------------------------------------------

async function loadAbsentView() {
  const container = document.getElementById("absent-main");
  container.replaceChildren(mkLoading("Loading…"));

  try {
    const payload = await api("/api/absent");
    state.absentGroups = payload.groups || [];
    renderAbsentView();
  } catch (err) {
    container.replaceChildren(mkError(`Could not load absent records: ${err.message}`));
  }
}

function renderAbsentGroup(group) {
  const wrap = document.createElement("div");
  wrap.className = "absent-group";
  wrap.dataset.groupId = group.id;

  const head = document.createElement("div");
  head.className = "absent-group__head";

  const title = document.createElement("span");
  title.className = "absent-group__title";
  title.textContent = `${group.glossary} → “${group.form}”`;
  head.appendChild(title);

  const count = document.createElement("span");
  count.className = "absent-group__count";
  count.textContent = `${group.count} record${group.count === 1 ? "" : "s"}`;
  head.appendChild(count);

  const spacer = document.createElement("span");
  spacer.className = "absent-group__spacer";
  head.appendChild(spacer);

  const rejectBtn = mkBtn("Reject group", "btn btn--danger btn--small", async () => {
    const keys = checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.key);
    if (!keys.length) {
      showToast("Check at least one record to reject.", { error: true });
      return;
    }

    rejectBtn.disabled = true;
    try {
      const result = await api("/api/absent/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordKeys: keys }),
      });
      showToast(`Rejected ${result.rejected} record${result.rejected === 1 ? "" : "s"}.`);

      group.records = (group.records || []).filter((r) => !keys.includes(r.key));
      group.count = group.records.length;
      if (!group.records.length) {
        state.absentGroups = state.absentGroups.filter((g) => g.id !== group.id);
      }
      renderAbsentView();
    } catch (err) {
      showToast(`Could not reject group: ${err.message}`, { error: true });
      rejectBtn.disabled = false;
    }
  });
  head.appendChild(rejectBtn);

  wrap.appendChild(head);

  const list = document.createElement("ul");
  list.className = "absent-records";

  const checkboxes = [];
  for (const rec of group.records || []) {
    const li = document.createElement("li");
    li.className = "absent-record";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "absent-record__checkbox";
    cb.checked = true;
    cb.dataset.key = rec.key;
    checkboxes.push(cb);
    li.appendChild(cb);

    const body = document.createElement("div");
    body.className = "absent-record__body";

    const ref = document.createElement("div");
    ref.className = "absent-record__ref";
    ref.textContent = rec.label || rec.ref;
    body.appendChild(ref);

    const eng = document.createElement("div");
    eng.className = "absent-record__english";
    eng.textContent = `Matched: “${rec.englishText}”`;
    body.appendChild(eng);

    const text = document.createElement("p");
    text.className = "absent-record__text";
    text.textContent = rec.text || "";
    body.appendChild(text);

    li.appendChild(body);
    list.appendChild(li);
  }

  wrap.appendChild(list);
  return wrap;
}

function renderAbsentView() {
  const container = document.getElementById("absent-main");
  container.replaceChildren();

  if (!state.absentGroups.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No absent records. Every scanned rendering agrees with its Greek lemma.";
    container.appendChild(p);
    return;
  }

  const sorted = [...state.absentGroups].sort((a, b) => b.count - a.count);
  for (const group of sorted) {
    container.appendChild(renderAbsentGroup(group));
  }
}

// -----------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------

function switchView(view) {
  state.view = view;

  const termsTab = document.getElementById("tab-terms");
  const absentTab = document.getElementById("tab-absent");
  const termsPanel = document.getElementById("view-terms");
  const absentPanel = document.getElementById("view-absent");

  const isTerms = view === "terms";
  termsTab.classList.toggle("is-active", isTerms);
  termsTab.setAttribute("aria-selected", String(isTerms));
  absentTab.classList.toggle("is-active", !isTerms);
  absentTab.setAttribute("aria-selected", String(!isTerms));
  termsPanel.hidden = !isTerms;
  absentPanel.hidden = isTerms;

  if (!isTerms && !state.absentLoaded) {
    state.absentLoaded = true;
    loadAbsentView();
  }
}

document.getElementById("tab-terms").addEventListener("click", () => switchView("terms"));
document.getElementById("tab-absent").addEventListener("click", () => switchView("absent"));

// -----------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------

async function init() {
  setGlobalStatus("Loading terms…");
  try {
    const payload = await api("/api/terms");
    state.terms = payload.terms || [];
    renderTermSidebar();
    setGlobalStatus("");

    if (state.terms.length) {
      // Land straight on the worst-progress term — the common case walking
      // into this tool is "keep reviewing," not "browse the list."
      const sorted = [...state.terms].sort((a, b) => {
        const ra = a.total ? a.done / a.total : 0;
        const rb = b.total ? b.done / b.total : 0;
        return ra - rb;
      });
      await selectTerm(sorted[0].id);
    }
  } catch (err) {
    document.getElementById("term-sidebar").replaceChildren(mkError(`Could not load terms: ${err.message}`));
    setGlobalStatus("");
  }
}

init();

// -----------------------------------------------------------------------
// Contract reference (see the task brief for the authoritative version):
//
// GET  /api/terms
//   -> { terms: [{ id, greek, traditional, lit, forms, lemmas,
//                   total, done, remaining, doubleConfirmed,
//                   renderings: [{form, count}] }] }
//
// GET  /api/terms/:id
//   -> { term: {id, greek, traditional, lit, forms, lemmas},
//        renderings: [{form, count}],
//        progress: {total, done, remaining},
//        doubleConfirmed,
//        verses: [{ ref, bookKey, chapter, verse, label, text,
//                    words: [{text,start,end}], greek: [...], records: [...],
//                    decided, doubleConfirmed,
//                    proposal: {text,start,end,form,n} | null }] }
//
// POST /api/terms/:id/verses/:ref
//   body {action:"confirm", spans:[{text,start,form}]} | {action:"no-rendering"}
//   -> {ok, ref, records, progress, renderings, decided}
//
// POST /api/terms/:id/accept-double-confirmed
//   -> {ok, confirmed, verses, progress, renderings}
//
// GET  /api/absent
//   -> { groups: [{ id, glossary, form, count,
//                    records: [{key, ref, label, englishText, text}] }] }
//
// POST /api/absent/bulk-reject
//   body {recordKeys: [...]}
//   -> {ok, rejected}
//
// Errors: non-2xx with {error: "..."}.
// -----------------------------------------------------------------------
