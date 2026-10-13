// src/scripts/desk/greek-find.js
//
// The Greek tab's own search (STUDY-DESK.md, "Order of work", 1h, step 5).
// A search button in the tab's header row opens a field in place of the row's
// contents, so the tab loses no height until it's used. The text stays as it
// is until the reader types; results then take the text's place (the text is
// hidden, not rebuilt, so its place and selected word are exactly as they
// were) with "Back to the text" at the top.
//
// What a query means, and what comes back, is search-core.js's searchGreek,
// the same call the search bar and /search make. A result in the chapter on
// the page selects that word here; one in another chapter is the ordinary
// verse link with ?greek=, which loads the chapter and opens the Notebook at
// the word (desk/greek-link.js).
//
// Nothing here scrolls the PAGE, and nothing is stored about a search.

import { couldBeGreek, loadGreekIndex, searchGreek } from "../search-core.js";
import { hasGreek, lemmaLine } from "../../lib/greek-search.mjs";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const PAGE = 10; // verses at a time
const CHOICES = 10; // words offered at a time
const DEBOUNCE = 180;

const HINT =
  "Type a Greek word, a Strong’s number such as G4102, a transliteration such as pistis, or an English word such as faith.";

/** A new element with a class and, optionally, text. */
function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A lemma's line with its Greek set as Greek: "πίστις · pistis · G4102 · faith · 243 times". */
function lemmaNodes(into, item, { count = true } = {}) {
  let line = lemmaLine(item);
  if (!count) line = line.replace(/ · \d+ times?$/, "");
  const g = make("span", null, item.lemma);
  g.lang = "grc";
  into.append(g, line.slice(item.lemma.length));
}

/**
 * @param {{ root: HTMLElement, here: { bookKey: string, chapter: number },
 *   selectWord: (verse: number, t: number, opts?: { focus?: boolean }) => Promise<boolean>,
 *   focusText: () => boolean }} options
 *   `root` is the Greek tab's element; `focusText` puts focus on the selected
 *   word (or the roving one) and says whether there was one to focus.
 * @returns {{ open: (opts?: { query?: string, exact?: boolean, prefer?: string }) => void,
 *   close: (opts?: { focus?: "button" | "word" | false }) => void, isOpen: () => boolean }}
 */
export function createGreekFind({ root, here, selectWord, focusText }) {
  const openBtn = root.querySelector(".desk-greek__find-btn");
  const form = root.querySelector(".desk-greek__find");
  const input = root.querySelector(".desk-greek__find-input");
  const closeBtn = root.querySelector(".desk-greek__find-close");
  const scroller = root.querySelector(".desk-greek__scroller");
  const pane = root.querySelector(".desk-greek__results");

  pane.innerHTML = `
    <button type="button" class="desk-greek__back desk-greek__back--text">Back to the text</button>
    <p class="desk-greek__find-status" role="status"></p>
    <button type="button" class="desk-greek__retry" hidden>Try again</button>
    <p class="desk-greek__found" hidden></p>
    <div class="desk-greek__choices" role="group" aria-label="Words that match" hidden></div>
    <button type="button" class="desk-greek__choices-more" hidden>Show more words</button>
    <label class="desk-greek__exact" hidden><input type="checkbox" /> <span>Exact form only</span></label>
    <ul class="desk-greek__hits" hidden></ul>
    <button type="button" class="desk-greek__hits-more" hidden>Show more</button>
    <p class="desk-greek__find-page" hidden><a href="/search/">See these on the search page</a></p>`;
  const backBtn = pane.querySelector(".desk-greek__back");
  const status = pane.querySelector(".desk-greek__find-status");
  const retry = pane.querySelector(".desk-greek__retry");
  const found = pane.querySelector(".desk-greek__found");
  const choices = pane.querySelector(".desk-greek__choices");
  const choicesMore = pane.querySelector(".desk-greek__choices-more");
  const exactLabel = pane.querySelector(".desk-greek__exact");
  const exactBox = exactLabel.querySelector("input");
  const list = pane.querySelector(".desk-greek__hits");
  const hitsMore = pane.querySelector(".desk-greek__hits-more");
  const pageLine = pane.querySelector(".desk-greek__find-page");
  const pageLink = pageLine.querySelector("a");

  let seq = 0; // a newer search cancels an older one
  let timer = 0;
  let textScroll = 0; // where the text was when the results took its place
  let state = { lemmaId: null, exact: false, prefer: null };
  let lemmas = [];
  let choicesShown = CHOICES;
  let hits = [];
  let hitsShown = 0;

  const isOpen = () => !form.hidden;
  const showingResults = () => !pane.hidden;

  /* ── The text and the results trade places ─────────────────────── */

  function showResults() {
    if (showingResults()) return;
    textScroll = scroller.scrollTop;
    scroller.hidden = true;
    pane.hidden = false;
    pane.scrollTop = 0;
  }

  function showText() {
    if (!showingResults()) return;
    pane.hidden = true;
    scroller.hidden = false;
    // A hidden scroller forgets where it was in some browsers.
    scroller.scrollTop = textScroll;
  }

  /* ── Opening and closing ───────────────────────────────────────── */

  function open({ query = "", exact = false, prefer = null } = {}) {
    state = { lemmaId: null, exact, prefer: prefer ? prefer.normalize("NFC") : null };
    exactBox.checked = exact;
    root.classList.add("is-finding");
    form.hidden = false;
    input.value = query;
    input.focus({ preventScroll: true });
    input.setSelectionRange(query.length, query.length);
    if (query.trim().length >= 2) run();
  }

  function close({ focus = "button" } = {}) {
    if (!isOpen()) return;
    seq++;
    window.clearTimeout(timer);
    showText();
    form.hidden = true;
    root.classList.remove("is-finding");
    input.value = "";
    status.textContent = "";
    state = { lemmaId: null, exact: false, prefer: null };
    exactBox.checked = false;
    if (focus === "word") {
      if (!focusText()) openBtn.focus({ preventScroll: true });
    } else if (focus === "button") {
      openBtn.focus({ preventScroll: true });
    }
  }

  openBtn.addEventListener("click", () => open());
  closeBtn.addEventListener("click", () => close({ focus: "button" }));
  backBtn.addEventListener("click", () => close({ focus: "word" }));

  // Escape is the field's own: it closes the search and no more, so the
  // panel (panel.js) doesn't close as well.
  const onEscape = (e) => {
    if (e.key !== "Escape" || !isOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    close({ focus: "button" });
  };
  form.addEventListener("keydown", onEscape);
  pane.addEventListener("keydown", onEscape);

  /* ── Asking ────────────────────────────────────────────────────── */

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });

  input.addEventListener("input", () => {
    // A new query starts afresh: no chosen word, no exact form.
    state = { lemmaId: null, exact: false, prefer: null };
    exactBox.checked = false;
    window.clearTimeout(timer);
    if (input.value.trim().length < 2) {
      timer = window.setTimeout(run, 0);
      return;
    }
    timer = window.setTimeout(run, DEBOUNCE);
  });

  retry.addEventListener("click", () => run());

  exactBox.addEventListener("change", () => {
    state.exact = exactBox.checked;
    run({ keep: "exact" });
  });

  choices.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    state.lemmaId = Number(b.dataset.id);
    run({ keep: `lemma-${b.dataset.id}` });
  });

  choicesMore.addEventListener("click", () => {
    const first = choicesShown;
    choicesShown += CHOICES;
    drawChoices();
    choices.querySelectorAll("button")[first]?.focus({ preventScroll: true });
  });

  function reset() {
    found.hidden = true;
    found.replaceChildren();
    choices.hidden = true;
    choices.replaceChildren();
    choicesMore.hidden = true;
    exactLabel.hidden = true;
    list.hidden = true;
    list.replaceChildren();
    hitsMore.hidden = true;
    pageLine.hidden = true;
    retry.hidden = true;
    lemmas = [];
    hits = [];
    hitsShown = 0;
  }

  function say(message, { canRetry = false } = {}) {
    reset();
    status.textContent = message;
    retry.hidden = !canRetry;
  }

  /** Run the search in the field; `keep` names the control to give focus back to. */
  async function run({ keep = null } = {}) {
    window.clearTimeout(timer);
    const raw = input.value.trim();
    const my = ++seq;
    if (raw.length < 2) {
      if (showingResults()) say(HINT);
      return;
    }
    showResults();
    pane.setAttribute("aria-busy", "true");
    if (!status.textContent) status.textContent = "Searching…";
    try {
      if (!couldBeGreek(raw)) {
        say(hasGreek(raw) ? "Search one Greek word at a time." : "No Greek matches. Try one word at a time.");
        return;
      }
      const ask = () => searchGreek(BASE, raw, { lemmaId: state.lemmaId, exactForm: state.exact });
      let res = await ask();
      if (my !== seq) return;
      if (!res.kind) {
        // Nothing matched, or the index never loaded; the two read differently.
        if (!(await loadGreekIndex(BASE))) {
          if (my === seq) say("The Greek search couldn’t be loaded.", { canRetry: true });
          return;
        }
        if (my === seq) say("No Greek matches.");
        return;
      }
      if (!res.selected && res.lemmas.length) {
        // Several words match: the one this search came from, else the commonest.
        const want = state.prefer ? res.lemmas.find((l) => l.lemma.normalize("NFC") === state.prefer) : null;
        state.lemmaId = (want ?? res.lemmas[0]).id;
        res = await ask();
        if (my !== seq) return;
      }
      paint(res, raw);
      const target = keep && pane.querySelector(keep === "exact" ? ".desk-greek__exact input" : `[data-key="${keep}"]`);
      target?.focus({ preventScroll: true });
    } catch (err) {
      console.warn("[greek tab] search failed", err);
      if (my === seq) say("The Greek search couldn’t be loaded.", { canRetry: true });
    } finally {
      if (my === seq) pane.removeAttribute("aria-busy");
    }
  }

  /* ── Showing what came back ────────────────────────────────────── */

  function paint(res, raw) {
    reset();
    lemmas = res.lemmas;
    if (!lemmas.length) {
      status.textContent = "No Greek matches.";
      return;
    }
    const sel = res.selected;
    if (lemmas.length === 1 && sel) {
      lemmaNodes(found, sel, { count: false });
      found.hidden = false;
    }
    if (lemmas.length > 1) {
      choicesShown = Math.max(CHOICES, lemmas.findIndex((l) => l.id === sel?.id) + 1);
      drawChoices();
    }
    exactLabel.hidden = !(res.otherForms && res.form);

    if (!res.total) {
      // A word with occurrences and no verses means the shard didn't load.
      if (sel && sel.count > 0 && !state.exact) {
        status.textContent = "The verses couldn’t be loaded.";
        retry.hidden = false;
        return;
      }
      status.textContent = "This exact form doesn’t occur. Clear “Exact form only” to see every form.";
      return;
    }
    status.textContent = `${res.total} time${res.total === 1 ? "" : "s"} in the New Testament${state.exact ? ", in this form" : ""}`;
    hits = res.hits;
    hitsShown = 0;
    list.hidden = false;
    drawHits();
    pageLink.href = `/search/?q=${encodeURIComponent(raw)}`;
    pageLine.hidden = false;
  }

  function drawChoices() {
    choices.replaceChildren();
    lemmas.slice(0, choicesShown).forEach((item) => {
      const b = make("button", "desk-greek__choice");
      b.type = "button";
      b.dataset.id = String(item.id);
      b.dataset.key = `lemma-${item.id}`;
      b.setAttribute("aria-pressed", String(item.id === state.lemmaId));
      lemmaNodes(b, item);
      choices.append(b);
    });
    choices.hidden = false;
    choicesMore.hidden = lemmas.length <= choicesShown;
  }

  function drawHits() {
    const end = Math.min(hits.length, hitsShown + PAGE);
    for (let i = hitsShown; i < end; i++) {
      const hit = hits[i];
      const li = make("li", "desk-greek__hit-item");
      const same = hit.book === here.bookKey && hit.chapter === here.chapter;
      let row;
      if (same) {
        row = make("button", "desk-greek__hit");
        row.type = "button";
        row.dataset.i = String(i);
      } else {
        row = make("a", "desk-greek__hit");
        row.href = hit.href;
      }
      const g = make("span", "desk-greek__hit-form", hit.form);
      g.lang = "grc";
      row.append(make("span", "desk-greek__hit-ref", hit.label), " ", g);
      li.append(row);
      list.append(li);
    }
    hitsShown = end;
    hitsMore.hidden = hitsShown >= hits.length;
  }

  hitsMore.addEventListener("click", () => {
    const first = hitsShown;
    drawHits();
    list.children[first]?.querySelector(".desk-greek__hit")?.focus({ preventScroll: true });
  });

  list.addEventListener("click", async (e) => {
    const row = e.target.closest("button.desk-greek__hit");
    if (!row) return;
    const hit = hits[Number(row.dataset.i)];
    if (!hit) return;
    // Back to the text first, so the word is placed against the Greek's size.
    close({ focus: false });
    await selectWord(hit.verse, hit.t, { focus: true });
  });

  return { open, close, isOpen };
}
