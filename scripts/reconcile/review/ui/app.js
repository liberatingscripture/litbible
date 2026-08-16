// Reconciliation review UI. Vanilla, no build step, no dependencies.
//
// It imports the REAL review-core.mjs the server uses (served at
// /review-core.mjs by exact-path allowlist) rather than restating compose() or
// the mechanical/judgment rule here - the browser's idea of what a decision
// resolves to has to be the server's idea, and one copy is the only way to
// guarantee that.
import { compose, defaultVerdicts } from "/review-core.mjs";

const state = { items: [], decisions: {}, counts: null, book: null };

const el = {
  progress: document.getElementById("progress"),
  books: document.getElementById("books"),
  records: document.getElementById("records"),
};

function verdictsFor(item) {
  const stored = state.decisions[item.id]?.verdicts;
  return stored ? { ...stored } : defaultVerdicts(item.segments);
}

function recordState(item) {
  const d = state.decisions[item.id];
  if (!d || d.decision === "pending") {
    const { undecided } = compose(item.segments, verdictsFor(item));
    return undecided.length === 0 ? "ready" : "pending";
  }
  return d.decision;
}

function renderProgress() {
  const total = state.items.length;
  const settled = state.items.filter((i) => ["approved", "rejected"].includes(recordState(i))).length;
  const judgment = state.counts.judgment;
  const judgmentDone = state.items.reduce((n, i) => {
    const v = verdictsFor(i);
    return n + i.segments.filter((s) => s.type === "hunk" && s.kind === "judgment" && v[s.index]).length;
  }, 0);
  el.progress.textContent =
    `${settled} / ${total} records settled  ·  ${judgmentDone} / ${judgment} judgment spans answered  ·  ` +
    `${state.counts.mechanical} mechanical + ${state.counts.structural} structural pre-answered`;
}

function renderBooks() {
  const books = [...new Set(state.items.map((i) => i.bookKey))].sort();
  el.books.replaceChildren(
    ...[null, ...books].map((b) => {
      const btn = document.createElement("button");
      const n = b === null ? state.items.length : state.items.filter((i) => i.bookKey === b).length;
      btn.textContent = b === null ? `all (${n})` : `${b} (${n})`;
      btn.setAttribute("aria-pressed", String(state.book === b));
      btn.addEventListener("click", () => {
        state.book = b;
        render();
      });
      return btn;
    }),
  );
}

function hunkSpan(seg, verdicts, onPick) {
  const span = document.createElement("span");
  span.className = "hunk";
  span.tabIndex = 0;
  span.dataset.kind = seg.kind;
  const v = verdicts[seg.index];
  if (v) span.dataset.verdict = v;

  const chosen = v === "master" ? seg.to : v === "repo" ? seg.from : null;
  const other = v === "master" ? seg.from : v === "repo" ? seg.to : null;

  if (chosen === null) {
    // Undecided: show both sides, repo first.
    const a = document.createElement("span");
    a.className = "alt";
    a.textContent = seg.from || "(nothing)";
    const b = document.createElement("span");
    b.textContent = seg.to || "(nothing)";
    span.append(a, b);
  } else if (chosen === "") {
    const d = document.createElement("span");
    d.className = "del";
    d.textContent = `(removed: ${other || "—"})`;
    span.append(d);
  } else {
    span.textContent = chosen;
  }

  span.title =
    `${seg.kind} span\nrepo:   ${JSON.stringify(seg.from)}\nmaster: ${JSON.stringify(seg.to)}\n` +
    `click to toggle, or use the buttons below`;
  const toggle = () => onPick(seg.index, verdicts[seg.index] === "master" ? "repo" : "master");
  span.addEventListener("click", toggle);
  span.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
  return span;
}

async function save(item, verdicts) {
  const res = await fetch("/api/decision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: item.id, verdicts }),
  });
  const body = await res.json();
  state.decisions[item.id] = { ...(state.decisions[item.id] || {}), decision: body.decision, verdicts };
  return body;
}

function renderRecord(item) {
  const verdicts = verdictsFor(item);
  const card = document.createElement("article");
  card.className = "record";
  card.dataset.state = recordState(item);

  const h = document.createElement("h2");
  const where = item.kind === "footnote" ? `footnote ${item.repoLabel ?? ""}` : `verse ${item.verse}`;
  h.textContent = `${item.bookKey} ${item.chapter} — ${where}`;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent =
    `bucket ${item.bucket} · ${item.subclass}` +
    (item.settledAt ? ` · settled ${item.settledAt.slice(0, 10)}` : "") +
    ` · ${item.segments.filter((s) => s.type === "hunk").length} span(s)`;

  card.append(h, meta);

  if (item.forceHandReview) {
    const w = document.createElement("p");
    w.className = "warn";
    w.textContent = item.forceHandReview;
    card.append(w);
  }

  const body = document.createElement("div");
  body.className = "text";
  const repaint = () => {
    body.replaceChildren(
      ...item.segments.map((seg) =>
        seg.type === "same"
          ? document.createTextNode(seg.text)
          : hunkSpan(seg, verdicts, async (index, v) => {
              verdicts[index] = v;
              await save(item, verdicts);
              card.dataset.state = recordState(item);
              repaint();
              renderProgress();
            }),
      ),
    );
  };
  repaint();
  card.append(body);

  const choices = document.createElement("div");
  choices.className = "choices";
  const bulk = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", async () => {
      fn();
      await save(item, verdicts);
      card.dataset.state = recordState(item);
      repaint();
      renderProgress();
      status.textContent = stateLabel(recordState(item));
    });
    return b;
  };
  const status = document.createElement("span");
  status.className = "state";
  status.textContent = stateLabel(recordState(item));

  choices.append(
    bulk("Take the master everywhere", () => {
      for (const s of item.segments) if (s.type === "hunk") verdicts[s.index] = "master";
    }),
    bulk("Keep the repo everywhere", () => {
      for (const s of item.segments) if (s.type === "hunk") verdicts[s.index] = "repo";
    }),
    bulk("Reset to defaults", () => {
      for (const k of Object.keys(verdicts)) delete verdicts[k];
      Object.assign(verdicts, defaultVerdicts(item.segments));
    }),
    status,
  );
  card.append(choices);
  return card;
}

function stateLabel(s) {
  if (s === "approved") return "approved — will be applied";
  if (s === "rejected") return "rejected — repo kept as-is";
  if (s === "ready") return "all spans answered";
  return "spans still unanswered";
}

function render() {
  renderBooks();
  renderProgress();
  const shown = state.book === null ? state.items : state.items.filter((i) => i.bookKey === state.book);
  el.records.replaceChildren(...shown.map(renderRecord));
}

const res = await fetch("/api/items");
const data = await res.json();
state.items = data.items;
state.decisions = data.decisions;
state.counts = data.counts;
render();
