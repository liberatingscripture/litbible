// src/scripts/desk/sheet-present.js
//
// Present mode (STUDY-DESK.md, S6, M2, M3; "Order of work", 3j), on a sheet's
// own address. Loaded by sheet-page.js, which opens it from the copy's toolbar
// ("Present"), or straight away for `/sheets/?id=<id>&view=present` (the Sheet
// pane's "Present…") and `&view=presenter` (the presenter view's window).
//
// - **The presentation** covers the page: full screen, dark in either theme,
//   one screen at a time. The first screen is the sheet's name with a code per
//   chapter for the room to follow along (M3); then each part the room sees.
//   Parts marked Leader only never reach it.
// - **The reveal** (S6): every blank on a passage screen is covered (by its
//   traditional word, or a line with the leader's hint) until R uncovers the
//   next; Shift+R covers it again. F puts the passage's footnotes up, and a
//   footnote that gives a blank away waits until that blank is revealed.
// - **The presenter view** (M2) is a second window on the leader's own screen:
//   what the room sees, what comes next, and the leader's notes (the answers,
//   the parts marked Leader only), with a clock. Where the browser can place
//   windows on screens (Chrome and Edge, the Window Management API) the
//   presentation moves to the other screen; elsewhere the leader drags it
//   there. The two windows stay in step through a BroadcastChannel.
//
// The rules are src/lib/desk-present.mjs. The screens are drawn from the same
// reading of each chapter the copies use (sheet-copy.js), so a blank or a
// footnote is the same on the screen as on paper. Nothing is stored: where the
// room is lives in the open windows only.

import {
  channelName,
  checkState,
  clockWords,
  initialState,
  makeMessage,
  presentKey,
  presentMessage,
  presentScreens,
  revealedWords,
  roomCodes,
  sameState,
  screenCount,
  screenFootnotes,
  screenTitle,
  stepState,
  fitSize,
  hiddenTermsNote,
} from "../../lib/desk-present.mjs";
import { modulesForCopy } from "../../lib/desk-sheet-copy.mjs";
import { passageReference, sheetName } from "../../lib/desk-sheet-passages.mjs";
import { codeFigure, keyTermsSection, presentPassage, printingBlanks, readAll, rich } from "./sheet-copy.js";

const BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

// The virtual screen a preview is laid out on in the presenter view, then
// scaled to fit its frame: a 16:9 projector.
const VIRTUAL = { width: 1600, height: 900 };

function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(label, cls = "present-btn") {
  const b = make("button", cls, label);
  b.type = "button";
  return b;
}

const sheetUrl = (id, view) => `${BASE}sheets/?id=${encodeURIComponent(id)}${view ? `&view=${view}` : ""}`;

/* ── The screens ─────────────────────────────────────────────────────── */

/**
 * Every screen of a sheet, drawn once: { sheet, screens, built, shape, words }.
 * `built[i]` is { el, update(state, revealed) }; `shape` is what checkState
 * and stepState need (each screen's kind and its number of blanks).
 */
async function prepareDeck(sheet) {
  const screens = presentScreens(sheet);
  const room = modulesForCopy(sheet, "participant");
  const views = await readAll(room);
  const allBlanks = printingBlanks(room, views);
  const built = screens.map((s, i) => buildScreen(s, i, { sheet, views, room, allBlanks }));
  return {
    sheet,
    screens,
    built,
    shape: { kinds: screens.map((s) => s.kind), blanks: built.map((b) => b.words.length) },
    words: built.map((b) => b.words),
    rows: built.map((b) => b.rows),
  };
}

function screenShell(kind) {
  const el = make("section", `present-screen present-screen--${kind}`);
  const body = make("div", "present-screen__body");
  el.append(body);
  return { el, body };
}

function buildScreen(screen, i, { sheet, views, room, allBlanks }) {
  const { el, body } = screenShell(screen.kind);
  const plain = { el, words: [], rows: [], update() {} };

  if (screen.kind === "start") {
    body.append(make("h1", "present-screen__title", sheetName(sheet)));
    if (sheet.subtitle?.trim()) body.append(make("p", "present-screen__subtitle", sheet.subtitle.trim()));
    const { codes, more } = roomCodes(sheet);
    if (codes.length) {
      const box = make("div", "present-screen__codes");
      box.append(make("p", "present-screen__follow", "Scan to follow along"));
      const row = make("div", "present-screen__code-row");
      for (const c of codes) row.append(codeFigure(c, c.label));
      box.append(row);
      const addresses = [...codes, ...more].map((c) => c.printable).join(" · ");
      box.append(make("p", "present-screen__addresses", addresses));
      body.append(box);
    }
    return plain;
  }

  const m = screen.module;
  if (screen.kind === "text") {
    body.append(rich(m.html, "present-screen__rich"));
    return plain;
  }
  if (screen.kind === "question") {
    body.append(rich(m.html, "present-screen__rich present-screen__question"));
    return plain;
  }
  if (screen.kind === "keyTerms") {
    // Redrawn as blanks are revealed: a rendering that would give a still
    // covered blank away stays a line until then.
    let last = null;
    return {
      el,
      words: [],
      rows: [],
      update(_state, revealed) {
        const hidden = allBlanks.filter((b) => !revealed.has(b.exact));
        const key = hidden.map((b) => b.exact).join("\u0000");
        if (key === last) return;
        last = key;
        const section = keyTermsSection(m, views, room, "participant", hidden);
        section.className = "present-screen__terms";
        // Paper's line sends the room to the leader copy; here the reveal answers it.
        const note = section.querySelector(".sheet-copy__terms-note");
        if (note) {
          const blank = section.querySelectorAll(".sheet-copy__term-list li:has(.sheet-blank)").length;
          note.textContent = hiddenTermsNote(blank);
        }
        body.replaceChildren(section);
      },
    };
  }

  // A passage.
  body.append(make("h2", "present-screen__ref", passageReference(m)));
  const drawn = presentPassage(m, views.get(m.id), { allBlanks });
  if (!drawn.ok) {
    body.append(make("p", "present-screen__missing", drawn.message));
    return plain;
  }
  body.append(drawn.words);
  if (drawn.notes) {
    drawn.notes.hidden = true;
    body.append(drawn.notes);
  }
  const blankEls = [...drawn.words.querySelectorAll(".sheet-blank--present")];
  return {
    el,
    words: drawn.blanks,
    rows: drawn.rows,
    update(state, revealed) {
      const n = state.revealed[i] ?? 0;
      blankEls.forEach((b, k) => {
        const open = k < n;
        b.dataset.revealed = String(open);
        b.querySelector(".sheet-blank__answer")?.setAttribute("aria-hidden", String(!open));
        b.querySelector(".sheet-blank__cover")?.setAttribute("aria-hidden", String(open));
      });
      const up = state.notes[i] === true;
      const { shown } = screenFootnotes(drawn.rows, revealed);
      const on = new Set(up ? shown : []);
      drawn.words.querySelectorAll("sup.sheet-copy__fnref").forEach((s) => {
        s.hidden = !on.has(s.dataset.note);
      });
      if (drawn.notes) {
        drawn.notes.querySelectorAll(".present-screen__note").forEach((li) => {
          li.hidden = !on.has(li.dataset.note);
        });
        drawn.notes.hidden = !on.size;
      }
    },
  };
}

/**
 * Lay a screen out at the largest type size at which it fits its box
 * (desk-present's fitSize). Footnotes, when up, lie over the screen in a box
 * of their own and are fitted in it separately, never shrinking the verses.
 */
function fitScreen(el, height) {
  const h = height || el.clientHeight || window.innerHeight;
  const notes = el.querySelector(".present-screen__notes");
  const notesUp = notes && !notes.hidden;
  if (notesUp) notes.hidden = true;
  const fits = (size) => {
    el.style.setProperty("--present-size", `${size}px`);
    return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
  };
  const size = fitSize({ min: Math.max(16, h * 0.034), max: h * 0.068, fits });
  el.style.setProperty("--present-size", `${size}px`);
  el.scrollTop = 0;
  if (!notesUp) return;
  notes.hidden = false;
  const noteSize = fitSize({
    min: Math.max(14, h * 0.026),
    max: Math.max(14, Math.min(size * 0.8, h * 0.045)),
    fits: (px) => {
      notes.style.setProperty("--present-notes-size", `${px}px`);
      return notes.scrollHeight <= notes.clientHeight + 1;
    },
  });
  notes.style.setProperty("--present-notes-size", `${noteSize}px`);
  notes.scrollTop = 0;
}

/* ── Where the room is, shared by both windows ───────────────────────── */

/**
 * One window's side of a presentation: the deck, the state, the keys and the
 * channel to the other window. `draw(state, deck, why)` is the view's own
 * drawing; it is called after every change, whoever made it.
 */
function createControl({ sheet, store, role, draw, say }) {
  const me = globalThis.crypto?.randomUUID?.() ?? `w${Math.random().toString(36).slice(2)}`;
  let deck = null;
  let state = initialState();
  let closed = false;
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName(sheet.id)) : null;
  const send = (type, fields = {}) => {
    try {
      channel?.postMessage(makeMessage(type, me, { role, ...fields }));
    } catch (_) {}
  };

  const revealed = () => revealedWords(deck?.words ?? [], state.revealed);
  const render = (why) => {
    if (!deck) return;
    const set = revealed();
    deck.built.forEach((b) => b.update(state, set));
    draw(state, deck, why);
  };

  function apply(next, { from = "here", why = "state" } = {}) {
    if (!deck) return false;
    const checked = checkState(next, deck.shape);
    if (sameState(checked, state)) return false;
    state = checked;
    render(why);
    if (from === "here") send("state", { state });
    return true;
  }

  function act(action) {
    if (!deck) return;
    const next = stepState(state, action, deck.shape);
    if (next === state) {
      if (action.type === "reveal") say("Everything on this screen is revealed.");
      else if (action.type === "hide") say("Nothing on this screen is revealed.");
      else if (action.type === "notes") say("This screen has no footnotes.");
      return;
    }
    apply(next, { why: action.type });
  }

  channel?.addEventListener("message", (e) => {
    const msg = presentMessage(e.data);
    if (!msg || msg.from === me || closed) return;
    if (msg.type === "hello") {
      send("state", { state });
      // A window that says hello is open: the presenter view stops saying no
      // presentation is, though the state goes from here to there (BA84).
      draw(state, deck, `heard:${msg.role}`);
    } else if (msg.type === "state") {
      apply(msg.state, { from: "there", why: "remote" });
      // Heard either way, so the presenter view knows the presentation is open.
      draw(state, deck, `heard:${msg.role}`);
    }
    else if (msg.type === "bye") draw(state, deck, `bye:${msg.role}`);
  });

  // The sheet changed on /desk in another tab: draw it again, keeping the place.
  const unsubscribe = store?.subscribe?.(async (ids) => {
    if (closed || !ids?.includes?.(sheet.id)) return;
    let next = null;
    try {
      next = await store.get(sheet.id);
    } catch (_) {
      return;
    }
    if (next?.kind !== "sheet" || JSON.stringify(next) === JSON.stringify(sheet)) return;
    sheet = next;
    deck = await prepareDeck(sheet);
    state = checkState(state, deck.shape);
    render("sheet");
  });

  return {
    async start() {
      deck = await prepareDeck(sheet);
      state = checkState(state, deck.shape);
      render("start");
      send("hello");
    },
    act,
    get state() {
      return state;
    },
    get deck() {
      return deck;
    },
    close() {
      if (closed) return;
      closed = true;
      send("bye");
      channel?.close();
      if (typeof unsubscribe === "function") unsubscribe();
    },
  };
}

/** A key pressed in either window, as an action, unless a control has it. */
function keyAction(e) {
  const t = e.target;
  if (t instanceof Element && t.closest("input, textarea, select, [contenteditable='true']")) return null;
  if ((e.key === " " || e.key === "Enter") && t instanceof Element && t.closest("button, a")) return null;
  return presentKey(e);
}

function liveRegion() {
  const live = make("div", "sr-only");
  live.setAttribute("aria-live", "polite");
  let timer = 0;
  live.say = (text) => {
    clearTimeout(timer);
    live.textContent = "";
    timer = setTimeout(() => { live.textContent = text; }, 40);
  };
  return live;
}

function announce(why, state, deck) {
  const i = state.screen;
  const total = deck.screens.length;
  const title = screenTitle(deck.screens[i], deck.sheet);
  if (["next", "prev", "first", "last", "go", "remote-screen", "start"].includes(why)) return `${screenCount(i, total)}: ${title}`;
  if (why === "reveal") {
    const n = state.revealed[i] ?? 0;
    return `Revealed: ${deck.words[i][n - 1] ?? ""}`;
  }
  if (why === "hide") return "Covered again.";
  if (why === "notes") return state.notes[i] ? "Footnotes shown." : "Footnotes hidden.";
  return "";
}

/* ── The presentation ────────────────────────────────────────────────── */

/**
 * Open the presentation over the page.
 *
 * @param {{ sheet: object, store: object, fullscreen?: boolean, onClose?: () => void }} opts
 */
export async function openPresentation({ sheet, store, fullscreen = true, onClose }) {
  const stage = make("div", "present-stage");
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-modal", "true");
  stage.setAttribute("aria-label", `Presenting ${sheetName(sheet)}`);
  stage.tabIndex = -1;
  const frame = make("div", "present-stage__frame");
  const live = liveRegion();

  const strip = make("div", "present-stage__strip");
  strip.setAttribute("role", "toolbar");
  strip.setAttribute("aria-label", "Presentation");
  const prev = button("‹ Previous");
  const next = button("Next ›");
  const reveal = button("Reveal");
  reveal.setAttribute("aria-keyshortcuts", "R");
  reveal.title = "Reveal the next blank (R). Shift+R covers it again.";
  const notes = button("Footnotes");
  notes.setAttribute("aria-keyshortcuts", "F");
  notes.title = "Show or hide this passage’s footnotes (F)";
  const presenter = button("Presenter view");
  presenter.title = "Open the presenter view in a window of its own: your notes, what comes next, and a clock";
  const full = button("Full screen");
  const where = make("span", "present-stage__where");
  const close = button("Close", "present-btn present-btn--close");
  close.title = "Leave present mode (Escape)";
  strip.append(prev, next, reveal, notes, where, presenter, full, close);
  stage.append(frame, strip, live);

  // Everything behind the presentation is out of reach while it is open.
  const behind = [...document.body.children].filter((el) => !el.inert);
  behind.forEach((el) => { el.inert = true; });
  document.body.append(stage);
  document.documentElement.dataset.presenting = "on";
  const opener = document.activeElement;

  let shownEl = null;
  const control = createControl({
    sheet,
    store,
    role: "stage",
    say: (t) => live.say(t),
    draw(state, deck, why) {
      if (!deck || why?.startsWith?.("bye:") || why?.startsWith?.("heard:")) return;
      const i = state.screen;
      const el = deck.built[i].el;
      if (shownEl !== el) {
        frame.replaceChildren(el);
        shownEl = el;
      }
      fitScreen(el);
      const kind = deck.screens[i].kind;
      const blanks = deck.shape.blanks[i];
      const n = state.revealed[i] ?? 0;
      // A control about to be disabled or hidden while it has focus would
      // drop focus to the page, out of the stage's keys (BA79): the stage
      // takes it first.
      const off = new Map([
        [prev, i === 0],
        [next, i === deck.screens.length - 1],
        [reveal, !blanks],
        [notes, kind !== "passage" || !deck.rows[i].length],
      ]);
      if (off.get(document.activeElement)) stage.focus({ preventScroll: true });
      prev.disabled = off.get(prev);
      next.disabled = off.get(next);
      reveal.hidden = off.get(reveal);
      reveal.textContent = blanks ? `Reveal (${n} of ${blanks})` : "Reveal";
      notes.hidden = off.get(notes);
      notes.setAttribute("aria-pressed", String(state.notes[i] === true));
      where.textContent = screenCount(i, deck.screens.length);
      const words = why === "remote" ? "" : announce(why, state, deck);
      if (words) live.say(words);
    },
  });

  // The strip shows while the pointer moves or a control has focus, and
  // the pointer hides with it, so a still screen shows only the text.
  let idle = 0;
  const wake = () => {
    stage.classList.add("is-awake");
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!strip.contains(document.activeElement) && !strip.matches(":hover")) stage.classList.remove("is-awake");
    }, 2500);
  };
  stage.addEventListener("pointermove", wake);
  strip.addEventListener("focusin", wake);

  prev.addEventListener("click", () => control.act({ type: "prev" }));
  next.addEventListener("click", () => control.act({ type: "next" }));
  reveal.addEventListener("click", (e) => control.act({ type: e.shiftKey ? "hide" : "reveal" }));
  notes.addEventListener("click", () => control.act({ type: "notes" }));

  const isFull = () => document.fullscreenElement === stage;
  const syncFull = () => {
    full.textContent = isFull() ? "Exit full screen" : "Full screen";
    if (shownEl) fitScreen(shownEl);
  };
  let fullscreenLeft = 0;
  const onFullscreen = () => {
    if (!isFull()) fullscreenLeft = performance.now();
    syncFull();
  };
  document.addEventListener("fullscreenchange", onFullscreen);
  full.addEventListener("click", () => {
    if (isFull()) document.exitFullscreen?.().catch(() => {});
    else stage.requestFullscreen?.().catch(() => live.say("This browser didn’t allow full screen."));
  });
  stage.addEventListener("dblclick", (e) => {
    if (e.target instanceof Element && e.target.closest(".present-stage__strip")) return;
    full.click();
  });

  presenter.addEventListener("click", () => openPresenterWindow(stage, sheet, (t) => live.say(t)));

  function finish() {
    clearTimeout(idle);
    control.close();
    document.removeEventListener("fullscreenchange", onFullscreen);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pagehide", onPagehide);
    if (isFull()) document.exitFullscreen?.().catch(() => {});
    stage.remove();
    behind.forEach((el) => { el.inert = false; });
    delete document.documentElement.dataset.presenting;
    if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus();
    onClose?.();
  }
  close.addEventListener("click", finish);

  // Heard on the document, so the keys still work if focus ever falls to
  // the page (BA79); everything else on it is inert, so only the stage or
  // the body can have it. In the capture phase, so the site's shortcuts
  // (keyboard-shortcuts.js) find the key already taken.
  const onKey = (e) => {
    if (e.defaultPrevented || !(stage.contains(e.target) || e.target === document.body)) return;
    if (e.key === "Escape") {
      // Escape in full screen is the browser's way out of it, not ours.
      if (isFull() || performance.now() - fullscreenLeft < 400) return;
      e.preventDefault();
      finish();
      return;
    }
    const action = keyAction(e);
    if (!action) return;
    e.preventDefault();
    control.act(action);
  };
  document.addEventListener("keydown", onKey, true);

  const onResize = () => { if (shownEl) fitScreen(shownEl); };
  window.addEventListener("resize", onResize);
  const onPagehide = () => control.close();
  window.addEventListener("pagehide", onPagehide);

  if (fullscreen) stage.requestFullscreen?.().catch(() => {});
  stage.focus();
  wake();
  syncFull();
  await control.start();
  return { close: finish };
}

/**
 * Open the presenter view (M2). Where the browser can place windows on
 * screens and a second screen is attached, the presentation goes full screen
 * on that one and the presenter view fills this one; elsewhere the presenter
 * view opens as a window of its own and the leader moves the presentation.
 */
async function openPresenterWindow(stage, sheet, say) {
  const url = sheetUrl(sheet.id, "presenter");
  const name = `lit-presenter-${sheet.id}`;
  let features = "popup,width=1180,height=760";
  let asked = false;
  if (window.screen?.isExtended && typeof window.getScreenDetails === "function") {
    asked = await willAsk();
    try {
      const details = await window.getScreenDetails();
      const here = details.currentScreen;
      const other = details.screens.find((s) => s !== here);
      if (other) {
        await stage.requestFullscreen({ screen: other });
        features = `popup,left=${here.availLeft},top=${here.availTop},width=${here.availWidth},height=${here.availHeight}`;
      }
    } catch (_) {
      // Permission refused, or the click's moment passed while asking: the
      // presenter view still opens, and the leader moves the presentation.
    }
  }
  const win = window.open(url, name, features);
  if (win) return;
  // A window opens only on the click's moment, which the browser's question
  // about the screens may have used up; the second time it doesn't ask (BA85).
  say(asked
    ? "The browser asked about your screens first, so the presenter view didn’t open. Choose Presenter view again."
    : "The browser blocked the presenter view’s window. Allow pop-ups for litbible.net and try again.");
}

/** Whether getScreenDetails() will ask the reader first (Chrome's "window-management" permission, once "window-placement"). */
async function willAsk() {
  for (const name of ["window-management", "window-placement"]) {
    try {
      return (await navigator.permissions.query({ name })).state === "prompt";
    } catch (_) {
      // Not a permission this browser knows by that name.
    }
  }
  return false;
}

/* ── The presenter view ──────────────────────────────────────────────── */

/** A frame showing a screen at projector proportions, scaled to the frame's width. */
function previewFrame(label) {
  const box = make("figure", "present-preview");
  const viewport = make("div", "present-preview__viewport");
  const surface = make("div", "present-preview__surface");
  surface.style.width = `${VIRTUAL.width}px`;
  surface.style.height = `${VIRTUAL.height}px`;
  viewport.append(surface);
  const caption = make("figcaption", "present-preview__caption", label);
  box.append(caption, viewport);
  const scale = () => {
    const w = viewport.clientWidth || VIRTUAL.width;
    viewport.style.setProperty("--present-scale", String(w / VIRTUAL.width));
  };
  new ResizeObserver(scale).observe(viewport);
  scale();
  return {
    box,
    caption,
    show(el) {
      if (!el) {
        surface.replaceChildren(make("p", "present-preview__none", "The end of the sheet."));
        return;
      }
      if (surface.firstElementChild !== el) surface.replaceChildren(el);
      fitScreen(el, VIRTUAL.height);
    },
  };
}

/** The leader's notes for one screen, in words. */
function leaderNotes(state, deck) {
  const i = state.screen;
  const screen = deck.screens[i];
  const out = make("div", "present-notes__body");
  const m = screen.module;

  if (screen.kind === "start") {
    const { codes } = roomCodes(deck.sheet);
    out.append(make("p", null, codes.length
      ? "The room can scan the codes on this screen to read along in the LIT app or on litbible.net."
      : "This sheet has no passages, so there are no codes to scan."));
  }

  const words = deck.words[i] ?? [];
  if (words.length) {
    const n = state.revealed[i] ?? 0;
    out.append(make("h3", "present-notes__head", `Blanks: ${n} of ${words.length} revealed`));
    const ol = make("ol", "present-notes__blanks");
    const els = [...deck.built[i].el.querySelectorAll(".sheet-blank--present")];
    words.forEach((w, k) => {
      const li = make("li", k < n ? "is-revealed" : null);
      li.append(make("strong", null, w));
      const cover = els[k]?.dataset.cover;
      if (cover) li.append(document.createTextNode(els[k].querySelector(".sheet-blank__word") ? ` (shown as “${cover}”)` : ` (hint: ${cover})`));
      ol.append(li);
    });
    out.append(ol);
  }

  if (screen.kind === "passage" && deck.rows[i].length) {
    const { shown, held } = screenFootnotes(deck.rows[i], revealedWords(deck.words, state.revealed));
    const up = state.notes[i] === true;
    const bits = [up ? "Footnotes are up" : "Footnotes are down", `${shown.length} to show`];
    if (held) bits.push(`${held} waiting on the reveal`);
    out.append(make("p", "present-notes__line", `${bits.join(" · ")}.`));
  }

  if (screen.kind === "question" && String(m.answer ?? "").replace(/<[^>]*>/g, "").trim()) {
    out.append(make("h3", "present-notes__head", "Answer"));
    out.append(rich(m.answer));
  }

  for (const note of screen.notes) {
    const part = make("section", "present-notes__part");
    part.append(make("span", "sheet-copy__tag", "Leader only"));
    if (note.type === "passage") part.append(make("p", null, `${passageReference(note)} (not shown to the room)`));
    else if (note.type === "keyTerms") part.append(make("p", null, "The key terms box (not shown to the room)"));
    else if (note.type === "space" || note.type === "pageBreak") continue;
    else {
      part.append(rich(note.html));
      if (note.type === "question" && String(note.answer ?? "").replace(/<[^>]*>/g, "").trim()) {
        part.append(make("p", "present-notes__head", "Answer"), rich(note.answer));
      }
    }
    out.append(part);
  }

  if (!out.childNodes.length) out.append(make("p", "present-notes__none", "No notes for this screen."));
  return out;
}

/**
 * Draw the presenter view into the page (`/sheets/?id=<id>&view=presenter`).
 *
 * @param {{ root: HTMLElement, sheet: object, store: object }} opts
 */
export async function showPresenterView({ root, sheet, store }) {
  document.title = `Presenter view: ${sheetName(sheet)} | LIT Bible`;
  document.documentElement.dataset.presenter = "on";
  root.classList.add("present-presenter");
  const live = liveRegion();

  const head = make("header", "present-presenter__head");
  const title = make("h1", "present-presenter__title", sheetName(sheet));
  const where = make("p", "present-presenter__where");
  const clock = make("p", "present-presenter__clock");
  clock.setAttribute("aria-label", "Time since the presentation began");
  const restart = button("Restart clock", "present-btn present-btn--quiet");
  head.append(title, where, clock, restart);

  const status = make("p", "present-presenter__status");
  status.setAttribute("role", "status");

  const now = previewFrame("Now");
  const upNext = previewFrame("Next");

  const controls = make("div", "present-presenter__controls");
  controls.setAttribute("role", "toolbar");
  controls.setAttribute("aria-label", "Presentation");
  const prev = button("‹ Previous");
  const next = button("Next ›");
  const reveal = button("Reveal");
  reveal.setAttribute("aria-keyshortcuts", "R");
  const hide = button("Cover again");
  hide.setAttribute("aria-keyshortcuts", "Shift+R");
  const notes = button("Footnotes");
  notes.setAttribute("aria-keyshortcuts", "F");
  controls.append(prev, next, reveal, hide, notes);

  const notesBox = make("section", "present-notes");
  notesBox.append(make("h2", "present-notes__title", "For the leader"));
  const notesBody = make("div");
  notesBox.append(notesBody);

  const keys = make("p", "present-presenter__keys",
    "Keys, in either window: → or Page Down for the next screen, ← or Page Up for the one before, R to reveal, Shift+R to cover again, F for footnotes.");

  const main = make("div", "present-presenter__main");
  const left = make("div", "present-presenter__now");
  left.append(now.box, controls);
  const right = make("div", "present-presenter__side");
  right.append(notesBox, upNext.box);
  main.append(left, right);
  root.replaceChildren(head, status, main, keys, live);

  let began = Date.now();
  const tick = () => { clock.textContent = clockWords(Date.now() - began); };
  tick();
  setInterval(tick, 1000);
  restart.addEventListener("click", () => {
    began = Date.now();
    tick();
  });

  let stageSeen = false;
  const control = createControl({
    sheet,
    store,
    role: "presenter",
    say: (t) => live.say(t),
    draw(state, deck, why) {
      if (why === "bye:stage") {
        stageSeen = false;
        status.textContent = "The presentation was closed. Open it again with Present on the sheet’s page, and this view will follow it.";
        return;
      }
      if (why?.startsWith?.("heard:")) {
        if (why === "heard:stage") {
          stageSeen = true;
          status.textContent = "";
        }
        return;
      }
      if (!deck) return;
      const i = state.screen;
      const total = deck.screens.length;
      where.textContent = `${screenCount(i, total)}: ${screenTitle(deck.screens[i], deck.sheet)}`;
      now.show(deck.built[i].el);
      const after = deck.built[i + 1]?.el ?? null;
      upNext.caption.textContent = after ? `Next: ${screenTitle(deck.screens[i + 1], deck.sheet)}` : "Next";
      upNext.show(after);
      notesBody.replaceChildren(leaderNotes(state, deck));
      const blanks = deck.shape.blanks[i];
      const n = state.revealed[i] ?? 0;
      prev.disabled = i === 0;
      next.disabled = i === total - 1;
      reveal.disabled = n >= blanks;
      hide.disabled = !n;
      reveal.hidden = hide.hidden = !blanks;
      notes.hidden = deck.screens[i].kind !== "passage" || !deck.rows[i].length;
      notes.setAttribute("aria-pressed", String(state.notes[i] === true));
      const words = why === "remote" ? "" : announce(why, state, deck);
      if (words) live.say(words);
    },
  });

  prev.addEventListener("click", () => control.act({ type: "prev" }));
  next.addEventListener("click", () => control.act({ type: "next" }));
  reveal.addEventListener("click", () => control.act({ type: "reveal" }));
  hide.addEventListener("click", () => control.act({ type: "hide" }));
  notes.addEventListener("click", () => control.act({ type: "notes" }));
  document.addEventListener("keydown", (e) => {
    const action = keyAction(e);
    if (!action) return;
    e.preventDefault();
    control.act(action);
  });
  window.addEventListener("pagehide", () => control.close());

  status.textContent = "Waiting for the presentation. If it’s on another screen, it will follow this view; if not, drag its window to the room’s screen and choose Full screen there.";
  await control.start();
  setTimeout(() => {
    if (!stageSeen && status.textContent.startsWith("Waiting")) {
      status.textContent = "No presentation is open for this sheet yet. Choose Present on the sheet’s page, and it will follow this view.";
    }
  }, 2500);
}
