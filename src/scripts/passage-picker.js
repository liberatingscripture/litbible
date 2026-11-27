// src/scripts/passage-picker.js
//
// The passage picker (PassagePicker.astro; SITE-FEATHERBOA.md, "Finding a
// passage"). One script for its three places:
//
// - /read, where the picker is the page ([data-picker-full]);
// - the panel a computer opens, from 700px: hanging from what opened it (the
//   place line's book or chapter, or the header's Read), at Quick speed;
// - the sheet a phone opens from its top row's "John 3 ▾", under 700px.
//
// The panel and the sheet are one modal <dialog> (Layout.astro, on every
// page but /read and Study's own), whose picker waits in a <template> that
// the first opening puts in place. Its ways in are [data-picker-open] links
// ("books" or "chapters": where it opens and what takes focus), which work
// as links to /read without JavaScript, and G (keyboard-shortcuts.js sends
// lit:picker-open, which this answers). It holds focus while open, closes on
// Escape, its ×, a press outside, or a choice, and gives focus back.
//
// What every picker gets: the field and what it offers (readTyping in
// src/lib/passage-picker.mjs; the first offer is chosen, so Enter goes),
// Continue reading from the one record (last-read.js), the books as tabs
// (the arrows move and show, Home and End), and the chosen book's chapters
// as one stop, the arrows moving inside it. It runs once as the page loads;
// test/featherboa-picker.test.js calls start() with its own page.

import { readTyping } from "../lib/passage-picker.mjs";
import { continueHref, continueLabel, loadLastRead } from "./last-read.js";
import { asButton } from "./link-button.js";

export const OPEN_EVENT = "lit:picker-open";
const PHONE_QUERY = "(max-width: 699px)";
// Where the panel keeps from the window's edges, and how far below its
// opener it hangs (the tokens' --space-4 and --space-2).
const EDGE = 16;
const DROP = 8;

const modified = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** The number of columns a grid of cells is drawn in now (1 where nothing
 *  is laid out). */
function columnsOf(grid, win) {
  const tracks = win.getComputedStyle?.(grid)?.gridTemplateColumns ?? "";
  const count = tracks.trim() ? tracks.trim().split(/\s+/).length : 1;
  return Math.max(1, count);
}

/** Where an arrow key takes focus among `cells` (an index), or null. */
export function stepIndex(key, index, length, columns) {
  if (key === "ArrowRight") return Math.min(index + 1, length - 1);
  if (key === "ArrowLeft") return Math.max(index - 1, 0);
  if (key === "ArrowDown") return Math.min(index + columns, length - 1);
  if (key === "ArrowUp") return Math.max(index - columns, 0);
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

/**
 * Wires one picker: its field and offers, Continue reading, the books, and
 * the chapters.
 *
 * @param {HTMLElement} root the [data-picker]
 * @param {{ doc: Document, win: Window, signal: AbortSignal, go: (href: string) => void }} env
 */
export function wirePicker(root, { doc, win, signal, go }) {
  const field = root.querySelector("[data-picker-field]");
  const form = root.querySelector("[data-picker-form]");
  const offersBox = root.querySelector("[data-picker-offers]");
  const status = root.querySelector("[data-picker-status]");
  const cont = root.querySelector("[data-picker-continue]");
  const tablist = root.querySelector("[data-picker-books]");
  const tabs = [...root.querySelectorAll("[data-picker-book]")];
  const sections = new Map([...root.querySelectorAll("[data-picker-section]")].map((s) => [s.dataset.pickerSection, s]));
  const pageBook = root.dataset.book || null;
  const pageChapter = root.dataset.chapter ?? null;
  let shown = null;

  // ---------- The books, as tabs over their chapters ----------

  tablist.setAttribute("role", "tablist");
  for (const item of tablist.children) item.setAttribute("role", "none");
  for (const tab of tabs) {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `picker-${tab.dataset.pickerBook}`);
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;
  }
  for (const section of sections.values()) section.setAttribute("role", "tabpanel");
  root.setAttribute("data-picker-ready", "");

  /** The chapters of the book shown, its one stop first. */
  const cellsOf = (key) => [...(sections.get(key)?.querySelectorAll("[data-picker-grid] a") ?? [])];

  /** Shows `key`'s chapters (Matthew's for a key it doesn't know). */
  function show(key, { focus = false } = {}) {
    const book = sections.has(key) ? key : sections.keys().next().value;
    shown = book;
    for (const tab of tabs) {
      const on = tab.dataset.pickerBook === book;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    for (const [k, section] of sections) section.toggleAttribute("data-shown", k === book);
    const cells = cellsOf(book);
    const stop = cells.find((c) => c.getAttribute("aria-current") === "page") ?? cells[0];
    for (const cell of cells) cell.tabIndex = cell === stop ? 0 : -1;
  }

  for (const tab of tabs) {
    tab.addEventListener(
      "click",
      (event) => {
        if (modified(event)) return;
        event.preventDefault();
        show(tab.dataset.pickerBook, { focus: true });
      },
      { signal },
    );
  }

  tablist.addEventListener(
    "keydown",
    (event) => {
      const index = tabs.indexOf(event.target);
      if (index < 0) return;
      if (event.key === " ") {
        event.preventDefault();
        show(tabs[index].dataset.pickerBook, { focus: true });
        return;
      }
      const to = stepIndex(event.key, index, tabs.length, columnsOf(tablist, win));
      if (to === null) return;
      event.preventDefault();
      show(tabs[to].dataset.pickerBook, { focus: true });
    },
    { signal },
  );

  // The chapters: one stop, the arrows, Home, and End inside it.
  for (const section of sections.values()) {
    const grid = section.querySelector("[data-picker-grid]");
    grid?.addEventListener(
      "keydown",
      (event) => {
        const cells = cellsOf(section.dataset.pickerSection);
        const index = cells.indexOf(event.target);
        if (index < 0) return;
        const to = stepIndex(event.key, index, cells.length, columnsOf(grid, win));
        if (to === null) return;
        event.preventDefault();
        cells[index].tabIndex = -1;
        cells[to].tabIndex = 0;
        cells[to].focus();
      },
      { signal },
    );
  }

  // ---------- What the field offers ----------

  field.setAttribute("role", "combobox");
  field.setAttribute("aria-autocomplete", "list");
  field.setAttribute("aria-controls", offersBox.id);
  field.setAttribute("aria-expanded", "false");

  /** Whether the page a picker's link names is a draft, as its link says. */
  const isDraft = (book, chapter) => {
    const href = chapter === "intro" ? `/${book}-intro/` : `/${book}-${chapter}/`;
    const link = root.querySelector(`[data-picker-section] a[href="${href}"]`);
    return Boolean(link?.matches(".kit-tab--draft, .kit-row--draft"));
  };

  let offers = [];
  let active = -1;

  function choose(index) {
    active = index;
    const rows = [...offersBox.children];
    rows.forEach((row, i) => row.setAttribute("aria-selected", i === index ? "true" : "false"));
    if (rows[index]) field.setAttribute("aria-activedescendant", rows[index].id);
    else field.removeAttribute("aria-activedescendant");
  }

  function drawOffers() {
    const { book, offers: next } = readTyping(field.value, { isDraft });
    offers = next;
    offersBox.replaceChildren(
      ...offers.map((offer, i) => {
        const row = doc.createElement("a");
        row.className = `kit-row picker__offer${offer.draft ? " kit-row--draft" : ""}`;
        row.id = `picker-offer-${i}`;
        row.href = offer.href;
        row.tabIndex = -1;
        row.setAttribute("role", "option");
        row.dataset.kind = offer.kind;
        row.append(offer.label);
        if (offer.draft) {
          const comma = doc.createElement("span");
          comma.className = "sr-only";
          comma.textContent = ", ";
          const note = doc.createElement("span");
          note.className = "picker__progress";
          note.textContent = "in progress";
          row.append(comma, note);
        }
        return row;
      }),
    );
    offersBox.hidden = offers.length === 0;
    field.setAttribute("aria-expanded", offers.length ? "true" : "false");
    choose(offers.length ? 0 : -1);
    status.textContent = offers.length ? `${offers[0].label}${offers[0].draft ? ", in progress" : ""}` : "";
    // Typing a book shows its chapters below, so picking follows typing.
    if (book && book !== shown) show(book);
  }

  field.addEventListener("input", drawOffers, { signal });
  // Escape and the field's own clear send only `search`.
  field.addEventListener("search", drawOffers, { signal });
  field.addEventListener(
    "keydown",
    (event) => {
      if (!offers.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      choose((active + step + offers.length) % offers.length);
    },
    { signal },
  );
  // Enter goes where the chosen offer goes; without JavaScript the form is
  // a search of /search.
  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const offer = offers[active];
      if (offer) go(offer.href);
    },
    { signal },
  );

  function reset() {
    field.value = "";
    drawOffers();
  }

  // ---------- Continue reading, the first row ----------

  /** Fills Continue reading from the record, unless it names this page;
   *  returns the record. */
  function refreshContinue() {
    const record = loadLastRead();
    const here = record && record.book === pageBook && String(record.chapter) === pageChapter;
    if (!record || here) {
      cont.hidden = true;
      return record;
    }
    cont.href = continueHref(record);
    const label = cont.querySelector("[data-picker-continue-label]");
    if (label) label.textContent = continueLabel(record);
    cont.hidden = false;
    return record;
  }

  return {
    root,
    show,
    reset,
    refreshContinue,
    pageBook,
    shown: () => shown,
    focusField: () => field.focus(),
    /** Focus on the page's chapter, or its introduction, else the first. */
    focusChapter() {
      const cells = cellsOf(shown);
      const intro = sections.get(shown)?.querySelector('.picker__intro[aria-current="page"]');
      const target = cells.find((c) => c.tabIndex === 0 && c.getAttribute("aria-current") === "page") ?? intro ?? cells[0];
      target?.focus();
    },
  };
}

/**
 * Wires the page's pickers: /read's own, or the dialog and its ways in.
 *
 * @param {{ doc?: Document, win?: Window, go?: (href: string) => void }} [env]
 *   `go` follows an offer (a test's stands in for the address bar).
 * @returns {() => void} takes the listeners away again (a test's next page)
 */
export function start({ doc = globalThis.document, win = globalThis.window, go } = {}) {
  if (!doc || !win) return () => {};
  const page = new AbortController();
  const { signal } = page;
  const follow = go ?? ((href) => win.location.assign(href));
  const openers = [...doc.querySelectorAll("[data-picker-open]")];

  // ---------- /read: the picker is the page ----------

  const fullRoot = doc.querySelector("[data-picker][data-picker-full]");
  if (fullRoot) {
    const picker = wirePicker(fullRoot, { doc, win, signal, go: follow });
    const named = () => /^#picker-([0-9a-z]+)$/.exec(win.location.hash)?.[1];
    // The book the address names, else where the reader was, else Matthew.
    picker.show(named() ?? picker.refreshContinue()?.book ?? "matthew");
    win.addEventListener("hashchange", () => named() && picker.show(named()), { signal });
    // Read and G come to the field.
    const toField = (event) => {
      event.preventDefault();
      picker.focusField();
    };
    for (const opener of openers) {
      opener.addEventListener("click", (event) => modified(event) || toField(event), { signal });
    }
    doc.addEventListener(OPEN_EVENT, toField, { signal });
    return () => page.abort();
  }

  // ---------- The panel and the sheet ----------

  const found = doc.querySelector("[data-picker-dialog]");
  const dialog = typeof found?.showModal === "function" ? found : null;
  // Layout.astro keeps the picker in a <template> until it is first wanted,
  // so a page that never opens it carries none of its thousand-odd elements.
  const kept = dialog?.querySelector("template[data-picker-template]");
  if (!dialog || !(kept?.content.querySelector("[data-picker]") ?? dialog.querySelector("[data-picker]"))) {
    return () => page.abort();
  }

  let picker = null;
  /** The picker, put in the dialog and wired the first time it opens. */
  function ready() {
    if (picker) return picker;
    const template = dialog.querySelector("template[data-picker-template]");
    if (template) template.replaceWith(doc.importNode(template.content, true));
    picker = wirePicker(dialog.querySelector("[data-picker]"), { doc, win, signal, go: (href) => {
      close({ focus: false });
      follow(href);
    } });
    return picker;
  }
  const phone = win.matchMedia?.(PHONE_QUERY) ?? { matches: false };
  let opener = null;
  let returnTo = null;
  let giveBack = true;

  // Drawn, and in the window: the place line and the header scroll away on a
  // computer, and a panel hung from one out of sight opened out of sight too.
  const shows = (el) => {
    if (!el?.isConnected || el.getClientRects().length === 0) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < win.innerHeight;
  };

  /** Hangs the panel under `from`, kept inside the window; opened by G, under
   *  the place line's book where it shows, else the header's Read, else
   *  centered at the window's top. The sheet needs no place. */
  function place(from) {
    if (phone.matches) {
      dialog.style.removeProperty("--picker-top");
      dialog.style.removeProperty("--picker-left");
      return;
    }
    const anchor = shows(from)
      ? from
      : (openers.filter((b) => b.closest("[data-place-line]")).find(shows) ?? openers.find(shows));
    const room = doc.documentElement.clientWidth || win.innerWidth;
    const width = dialog.getBoundingClientRect().width;
    const r = anchor?.getBoundingClientRect();
    const top = r ? r.bottom + DROP : EDGE;
    const left = Math.max(EDGE, Math.min(r ? r.left : (room - width) / 2, room - width - EDGE));
    dialog.style.setProperty("--picker-top", `${Math.round(top)}px`);
    dialog.style.setProperty("--picker-left", `${Math.round(left)}px`);
  }

  function open(mode = "books", from = null) {
    if (dialog.open) return;
    opener = from;
    returnTo = from ?? doc.activeElement;
    giveBack = true;
    const picker = ready();
    picker.reset();
    const record = picker.refreshContinue();
    picker.show(picker.pageBook ?? record?.book ?? "matthew");
    dialog.showModal();
    for (const b of openers) b.setAttribute("aria-expanded", "true");
    place(from);
    if (mode === "chapters") picker.focusChapter();
    else picker.focusField();
  }

  /** What closing leaves, whichever way it came: the ways in say so, and
   *  focus goes back to what opened it. */
  function finish() {
    for (const b of openers) b.setAttribute("aria-expanded", "false");
    const back = returnTo;
    opener = null;
    returnTo = null;
    if (giveBack && back instanceof win.HTMLElement && back.isConnected && back !== doc.body) {
      back.focus({ preventScroll: true });
    }
  }

  function close({ focus = true } = {}) {
    giveBack = focus;
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", finish, { signal });

  for (const button of openers) {
    if (button.tagName === "A") {
      asButton(button, dialog.id);
      button.setAttribute("aria-haspopup", "dialog");
    }
    button.addEventListener(
      "click",
      (event) => {
        if (modified(event)) return;
        event.preventDefault();
        if (dialog.open) close();
        else open(button.dataset.pickerOpen, button);
      },
      { signal },
    );
  }

  doc.addEventListener(
    OPEN_EVENT,
    (event) => {
      event.preventDefault();
      open("books", null);
    },
    { signal },
  );

  dialog.addEventListener(
    "click",
    (event) => {
      // A press outside lands on the dialog itself, which the picker fills.
      if (event.target === dialog) {
        close();
        return;
      }
      if (event.target.closest?.("[data-picker-close]")) {
        close();
        return;
      }
      // A chosen passage closes it a frame later, after the press has
      // drawn; a modified click opens a tab and leaves it open.
      const link = event.target.closest?.("a[href]");
      if (!link || event.defaultPrevented || modified(event)) return;
      win.requestAnimationFrame(() => close({ focus: false }));
    },
    { signal },
  );

  dialog.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // In the field, words go first, then the picker.
        const field = event.target.closest?.("[data-picker-field]");
        if (field && field.value) {
          picker?.reset();
          return;
        }
        close();
        return;
      }
      // Tab stays inside: from the last stop to the first, and back.
      if (event.key !== "Tab") return;
      const stops = [...dialog.querySelectorAll("a[href], button:not([disabled]), input")].filter(
        (el) => el.tabIndex !== -1 && el.getClientRects().length > 0 && !el.closest("[hidden]"),
      );
      if (stops.length < 2) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );

  win.addEventListener("resize", () => dialog.open && place(opener), { passive: true, signal });
  phone.addEventListener?.("change", () => dialog.open && place(opener), { signal });
  // Back to a page kept whole (the back-forward cache) finds it closed.
  win.addEventListener(
    "pageshow",
    (event) => {
      if (event.persisted && dialog.open) close({ focus: false });
    },
    { signal },
  );

  return () => page.abort();
}

start();
