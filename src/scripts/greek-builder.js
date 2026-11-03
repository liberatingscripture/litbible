// src/scripts/greek-builder.js
//
// The Greek search builder (STUDY-DESK.md, E5): the top of the commands window.
// One card for each word of the search, each with menus that list only what
// that word takes, and a way to add a word and say how close the words must be.
// The rules (reading the field, writing it, what each card offers) are
// src/lib/greek-builder.mjs's, pure and tested; this file only draws them.
//
// The search field is the only record of the search. The builder reads the
// field whenever it changes (a typed letter, a command pressed in the list
// below, a pasted search) and writes it when a choice is made, as typing does
// when the field has focus (the window's `put`, so Ctrl+Z works after a mouse
// press), and the two never disagree. A
// card with no word yet is the one thing the builder holds that the field
// can't: it waits for its word and writes nothing.
//
// A word's choices come from the index the Greek search already loads
// (lemmas.json, and the lemma's own shard of occ/ for the parsings its words
// take), fetched when a word is typed, never before.

import { loadGreekIndex, loadGreekOccurrences } from "./search-core.js";
import { errorMessage } from "../lib/greek-query.mjs";
import { hasGreek, lemmaLine } from "../lib/greek-search.mjs";
import {
  AXIS_LABELS,
  MAX_CARDS,
  builderOffers,
  cannotSay,
  closenessOptions,
  codeCounts,
  emptyCard,
  readBuilder,
  resolveCard,
  usableWords,
  writeBuilder,
  writeCard,
} from "../lib/greek-builder.mjs";

const baseUrl = () => String((import.meta.env && import.meta.env.BASE_URL) || "/").replace(/\/?$/, "/");

function make(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A button that never takes focus from the search field on a mouse press. */
function pressable(button, onPress) {
  button.type = "button";
  button.addEventListener("mousedown", (e) => e.preventDefault?.());
  button.addEventListener("click", (e) => onPress(e.detail > 0));
  return button;
}

/** Text with its Greek in a span that says so, for a screen reader and the Greek fonts. */
function withGreek(text, className) {
  const span = make("span", className);
  if (hasGreek(text)) span.lang = "grc";
  span.textContent = text;
  return span;
}

/**
 * @param {{ put: (text: string, opts?: { byMouse?: boolean }) => boolean,
 *   announce: (text: string) => void }} hooks
 *   `put` writes the field's new text the way the window's commands do and
 *   says whether it could (false: the field is gone). `announce` is the
 *   window's live region.
 * @returns {{ el: HTMLElement, follow: (field: HTMLInputElement | null) => void,
 *   focus: () => void, destroy: () => void }}
 */
export function createGreekBuilder({ put, announce }) {
  const base = baseUrl();
  const root = make("div", "greek-builder");
  let field = null;
  let destroyed = false;
  // What the builder shows: cards, and how close. Or `cannot`: a search it can't show.
  let state = { cards: [emptyCard()], gap: 3, anyOrder: false };
  let cannot = null;
  // What each typed word takes, by the words as typed: filled as the index arrives.
  const info = new Map();
  // The field's text as the builder last read or wrote it: a page that sets the
  // field without an input event (Back and Forward, a "Did you mean") leaves
  // this behind, and the next press reads the field first (`stale`).
  let seen = "";
  // A word being composed (a dead key, an input method): nothing is redrawn
  // until it settles, or the half-typed letter is lost with the input.
  let composing = false;

  /* ── Reading the field ─────────────────────────────────────────── */

  /** Make the builder match the field; false when it already did, so nothing needs drawing. */
  function readField() {
    if (!field) return false;
    const raw = field.value.trim();
    seen = raw;
    if (!cannot && raw === writeBuilder(state)) return false;
    const read = readBuilder(raw);
    if (read.cannot) {
      cannot = read;
    } else {
      cannot = null;
      state = { cards: read.cards.length ? read.cards : [emptyCard()], gap: read.gap, anyOrder: read.anyOrder };
    }
    return true;
  }

  const onInput = () => {
    if (readField()) render();
  };

  /**
   * True when the field was changed behind the builder's back: it is read and
   * drawn afresh, and the press that found it so does nothing (it was meant for
   * a search that is no longer there).
   */
  function stale() {
    if (!field || field.value.trim() === seen) return false;
    readField();
    render();
    return true;
  }

  /* ── Looking words up ──────────────────────────────────────────── */

  async function load(words, entry) {
    try {
      const index = await loadGreekIndex(base);
      if (!index) {
        entry.status = "failed";
      } else {
        const resolved = resolveCard(index, { words, filters: [] });
        if (resolved.error) {
          entry.status = "unknown";
          entry.message = errorMessage(resolved.error).text;
        } else {
          const rows = new Map();
          entry.lemmas = resolved.ids.map((id) => index.lemmas[id]);
          for (const id of resolved.ids) {
            const shard = await loadGreekOccurrences(base, index, id);
            if (!shard) throw new Error("no occurrences");
            for (const [code, n] of codeCounts(shard)) rows.set(code, (rows.get(code) ?? 0) + n);
          }
          entry.rows = [...rows].map(([code, n]) => ({ code, n }));
          entry.status = "ready";
        }
      }
    } catch (_) {
      entry.status = "failed";
    }
    if (!destroyed) render();
  }

  function infoFor(card) {
    if (!card.words.length) return { status: "any" };
    const key = card.words.join("/");
    let entry = info.get(key);
    // A look-up that failed is shown once and tried again on the next draw.
    if (entry?.status === "failed" && entry.shown) {
      info.delete(key);
      entry = null;
    }
    if (entry?.status === "failed") entry.shown = true;
    if (!entry) {
      entry = { status: "loading" };
      info.set(key, entry);
      load(card.words, entry);
    }
    return entry;
  }

  /* ── Writing the field ─────────────────────────────────────────── */

  function commit(byMouse, spoken = true) {
    const text = writeBuilder(state);
    if (field && text !== field.value.trim() && !put(text, { byMouse })) return;
    if (field) seen = field.value.trim();
    render();
    if (spoken) announce(text ? `Search is now ${text}.` : "Search cleared.");
  }

  function startOver() {
    if (stale()) return;
    cannot = null;
    state = { cards: [emptyCard()], gap: 3, anyOrder: false };
    commit(false, false);
    root.querySelector?.('[data-key="w0"]')?.focus({ preventScroll: true });
  }

  /* ── Drawing ───────────────────────────────────────────────────── */

  function chip(label, { on, key, title, count, onPress }) {
    const b = make("button", "greek-chip");
    b.setAttribute("aria-pressed", String(on));
    b.dataset.key = key;
    if (title) b.title = title;
    b.append(label);
    if (count !== null && count !== undefined) {
      b.append(make("small", "greek-chip__n", String(count.toLocaleString("en-US"))));
      b.setAttribute("aria-label", `${label}, ${count.toLocaleString("en-US")} ${count === 1 ? "time" : "times"}`);
    }
    return pressable(b, onPress);
  }

  function lemmaLines(entry) {
    const box = make("div", "greek-card__lemmas");
    if (entry.status === "loading") {
      box.append(make("p", "greek-card__line greek-card__line--quiet", "Looking this word up…"));
    } else if (entry.status === "unknown") {
      box.append(make("p", "greek-card__line greek-card__line--quiet", entry.message));
    } else if (entry.status === "failed") {
      box.append(make("p", "greek-card__line greek-card__line--quiet", "This word couldn’t be looked up. Its choices will wait."));
    } else if (entry.status === "ready") {
      for (const item of entry.lemmas) {
        const line = make("p", "greek-card__line");
        line.append(withGreek(item.lemma, "greek-card__lemma"), lemmaLine(item).slice(item.lemma.length));
        box.append(line);
      }
    } else {
      box.append(make("p", "greek-card__line greek-card__line--quiet", "Any word. Choose at least one thing below."));
    }
    return box;
  }

  function axisRow(card, offer, i) {
    const row = make("div", "greek-axis");
    const name = AXIS_LABELS[offer.axis];
    row.append(make("span", "greek-axis__name", name));
    const chips = make("div", "greek-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", `${name} of word ${i + 1}`);
    if (offer.only) {
      const only = make("span", "greek-chip greek-chip--only", offer.only.name);
      only.title = "The only one this word takes";
      chips.append(only);
    } else {
      for (const { filter, n, on } of offer.options) {
        chips.append(
          chip(filter.name, {
            on,
            count: n,
            key: `c${i}.${offer.axis}.${filter.name}`,
            title: `.${filter.words[0]}`,
            onPress: (byMouse) => {
              if (stale()) return;
              card.filters = on ? card.filters.filter((f) => f !== filter) : [...card.filters, filter];
              commit(byMouse);
            },
          }),
        );
      }
    }
    row.append(chips);
    return row;
  }

  function drawCard(card, i) {
    const box = make("div", "greek-card");
    const top = make("div", "greek-card__top");
    top.append(make("span", "greek-card__title", `Word ${i + 1}`));
    const notation = writeCard(card);
    if (notation) top.append(withGreek(notation, "greek-card__code"));
    if (state.cards.length > 1) {
      const x = make("button", "greek-card__x", "×");
      x.setAttribute("aria-label", `Remove word ${i + 1}`);
      x.dataset.key = `x${i}`;
      top.append(
        pressable(x, (byMouse) => {
          if (stale()) return;
          state.cards.splice(i, 1);
          commit(byMouse);
          if (!byMouse) root.querySelector?.(`[data-key="w${Math.max(0, i - 1)}"]`)?.focus({ preventScroll: true });
        }),
      );
    }
    box.append(top);

    const input = make("input", "greek-card__word");
    input.type = "text";
    input.dataset.key = `w${i}`;
    input.value = card.draft ?? card.words.join("/");
    input.placeholder = "A word, or leave empty for any";
    input.setAttribute("aria-label", `Word ${i + 1}`);
    input.autocomplete = "off";
    input.spellcheck = false;
    input.autocapitalize = "off";
    if (hasGreek(input.value)) input.lang = "grc";
    const typed = () => {
      if (stale()) return;
      // What is typed stays as typed (a "/" waiting for the next word), less
      // the symbols the notation uses and, among several words, any that is
      // also a command, which can't be written there. The card holds the words.
      const parts = input.value.replace(/[\s.,*=~&"“”]/g, "").split("/").filter(Boolean);
      card.words = usableWords(parts);
      card.draft = card.words.join("/") + (card.words.length && input.value.trim().endsWith("/") ? "/" : "");
      commit(false, false);
    };
    input.addEventListener("input", (e) => {
      if (e.isComposing || composing) return;
      typed();
    });
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      typed();
    });
    box.append(input);

    const entry = infoFor(card);
    box.append(lemmaLines(entry));

    // Every choice for any word; for a word, only once it is known (a word
    // being looked up or not found offers just the choices already made).
    const rows = entry.status === "any" ? null : entry.status === "ready" ? entry.rows : [];
    for (const offer of builderOffers(card, rows)) box.append(axisRow(card, offer, i));
    return box;
  }

  function drawCloseness() {
    const box = make("div", "greek-close");
    box.append(make("h4", "greek-close__title", "How close"));
    const chips = make("div", "greek-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "How close the words must be");
    closenessOptions(state.gap).forEach((o) => {
      chips.append(
        chip(o.label, {
          on: o.gap === state.gap,
          key: `g${o.gap === Infinity ? "v" : o.gap}`,
          onPress: (byMouse) => {
            if (stale()) return;
            state.gap = o.gap;
            commit(byMouse);
          },
        }),
      );
    });
    chips.append(
      chip("Either order", {
        on: state.anyOrder,
        key: "order",
        onPress: (byMouse) => {
          if (stale()) return;
          state.anyOrder = !state.anyOrder;
          commit(byMouse);
        },
      }),
    );
    box.append(chips);
    return box;
  }

  function render() {
    // Mid-composition the box is left alone; `compositionend` draws.
    if (destroyed || composing) return;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const keep = active?.dataset?.key && root.contains?.(active) ? active.dataset.key : null;
    const caret = keep && typeof active.selectionStart === "number" ? active.selectionStart : null;
    root.replaceChildren();

    if (cannot) {
      const note = make("div", "greek-builder__note");
      note.append(make("p", "greek-builder__why", cannotSay(cannot)));
      const again = make("button", "greek-builder__again", "Start a new search");
      again.dataset.key = "again";
      note.append(pressable(again, () => startOver()));
      root.append(note);
    } else {
      state.cards.forEach((card, i) => {
        if (i) root.append(make("p", "greek-then", "then"));
        root.append(drawCard(card, i));
      });
      const filled = state.cards.filter((c) => c.words.length || c.filters.length).length;
      const last = state.cards[state.cards.length - 1];
      if (state.cards.length < MAX_CARDS && (last.words.length || last.filters.length)) {
        const add = make("button", "greek-builder__add", "+ Then another word");
        add.dataset.key = "add";
        root.append(
          pressable(add, (byMouse) => {
            if (stale()) return;
            state.cards.push(emptyCard());
            render();
            if (!byMouse) root.querySelector?.(`[data-key="w${state.cards.length - 1}"]`)?.focus({ preventScroll: true });
          }),
        );
      }
      if (filled > 1) root.append(drawCloseness());
    }

    if (keep) {
      const again = root.querySelector?.(`[data-key="${keep}"]`);
      if (again) {
        again.focus({ preventScroll: true });
        if (caret !== null) {
          try { again.setSelectionRange(caret, caret); } catch (_) {}
        }
      }
    }
  }

  render();

  return {
    el: root,
    /** Follow another field (or none): read it now, and again whenever it changes. */
    follow(next) {
      if (field === next) {
      if (readField()) render();
      return;
    }
      field?.removeEventListener("input", onInput);
      field = next;
      field?.addEventListener("input", onInput);
      readField();
      render();
    },
    /** Put focus on the first word. */
    focus() {
      root.querySelector?.('[data-key="w0"]')?.focus({ preventScroll: true });
    },
    destroy() {
      destroyed = true;
      field?.removeEventListener("input", onInput);
      field = null;
    },
  };
}
