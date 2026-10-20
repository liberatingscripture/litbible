// src/scripts/desk/desk-page.js
//
// The Study Desk as a page of its own, /desk/ (STUDY-DESK.md, D9; "Order of
// work", 3c). Loaded by desk-gate.js on a computer with the preview switched
// on, when the page carries [data-desk-page]. It is not a reading surface, so
// there is no Notebook panel here: the page is panes, one to four, and this
// module opens the notebook for them.
//
// The rules are src/lib/desk-layout.mjs (pure, unit-tested); this draws them:
// - **The Layout menu** offers every arrangement BVJ kept (2026-10-18: all
//   mocked but four rows), each drawn as a small diagram and grayed out, with
//   the reason, when the window can't give every pane 280 by 160 pixels. It
//   also holds which layout the page opens with ("My last layout" or "My
//   default"), "Make this my default" and "Reset to the original layout".
// - **Dragging a pane by its header** to an edge of another splits that one,
//   shown before the drop; a drop that would leave a pane too small is
//   refused. Escape cancels.
// - **The lines between panes move**, by pointer or by the arrow keys
//   (Shift for bigger steps); double-clicking one shares the room evenly.
// - **Each pane's name is a menu** for showing another kind in it, which is
//   also the keyboard's way to put any pane anywhere. × closes a pane.
// - **The LIT pane last scrolled, clicked or typed in is the active one**,
//   marked "Leading" when more than one is open, and This verse, Greek, and
//   Footnotes follow it unless their "Stay here" is pressed.
// - **Each LIT pane keeps where its reader is** (`at`, 3e), and the active
//   one's is the passage the following panes share, `layout.place`, so they
//   follow it. They lead back too: a following pane's picker, This verse's
//   Previous and Next, a footnote's verse, or scrolling the Greek move the
//   active LIT pane, which moves the rest. With no LIT pane open they share
//   the place among themselves (3d, BVJ's option A). "Stay here" gives a pane
//   its own passage, `pin.at`, which only it moves. The place starts at the
//   reader's Continue reading place, or Matthew 1.
//
// The layout is kept in localStorage['lit-desk-layout'] (named in /privacy's
// paragraph), written on every change: the last layout, the reader's own
// default, and which of the two opens the page.

import { recordReference } from "../../lib/desk-store-core.mjs";
import {
  ARRANGEMENTS,
  HANDLE,
  KINDS,
  LAYOUT_KEY,
  MIN_HEIGHT,
  applyArrangement,
  arrangementOf,
  closePane,
  evenOut,
  findPane,
  fitSizes,
  isFollower,
  kindLabel,
  needs,
  nodeAt,
  openingLayout,
  originalLayout,
  panes,
  readSaved,
  resize,
  setActive,
  setKind,
  setPin,
  setPlace,
  placeFor,
  litPlace,
  setLitAt,
  splitPane,
  writeSaved,
} from "../../lib/desk-layout.mjs";
import { formatPassage, parsePassage, sameChapter, startingPassage } from "../../lib/desk-passage.mjs";
import { loadLastRead } from "../last-read.js";
import { initActions } from "./actions.js";
import { addDeskStyle, deskCtx as ctx } from "./boot.js";
import { mountPane } from "./desk-panes.js";
import { createHistory } from "./history.js";
import { initNoteSettings } from "./note-settings.js";
import { openNoteEditor } from "./note-editor.js";
import { openStore } from "./store.js";
import { initUndo } from "./undo-bar.js";

const NEEDS_TEXT = {
  wider: "Needs a wider window",
  taller: "Needs a taller window",
  larger: "Needs a larger window",
};

const ICON_CARET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 9l6 6 6-6" /></svg>`;

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>`;

const ICON_GRIP = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"
  focusable="false"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" />
  <circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>`;

const ICON_PIN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z" /></svg>`;

// "Greek, The LIT, and My Notes": the Oxford comma, as the site writes lists.
const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function readKey() {
  try { return localStorage.getItem(LAYOUT_KEY); } catch (_) { return null; }
}

function writeKey(text) {
  try { localStorage.setItem(LAYOUT_KEY, text); } catch (_) {}
}

/** A small picture of an arrangement, for the Layout menu. */
function diagram(shape) {
  const W = 40;
  const H = 26;
  const G = 2;
  const rects = [];
  const walk = (node, x, y, w, h) => {
    if (node.slot) { rects.push([x, y, w, h]); return; }
    const n = node.children.length;
    node.children.forEach((child, i) => {
      if (node.split === "columns") {
        const cw = (w - G * (n - 1)) / n;
        walk(child, x + i * (cw + G), y, cw, h);
      } else {
        const ch = (h - G * (n - 1)) / n;
        walk(child, x, y + i * (ch + G), w, ch);
      }
    });
  };
  walk(shape, 1, 1, W - 2, H - 2);
  return `<svg class="desk-ws__shape-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${rects
    .map(([x, y, w, h]) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" />`)
    .join("")}</svg>`;
}

async function start() {
  const root = document.querySelector("[data-desk-page]");
  if (!root) return;
  addDeskStyle();
  initNoteSettings();
  initUndo();

  let store = null;
  let storeError = null;
  try {
    store = await openStore({ ctx });
  } catch (err) {
    storeError = err;
    console.error("Study Desk: the notebook didn’t open", err);
  }
  if (store) createHistory({ store, ctx });
  // The LIT pane's verse menu and selection panel get the "My Notebook" row
  // (3f): Add a note, Bookmark and Ribbon here….
  if (store) initActions({ store, ctx });
  const onEdit = store
    ? (record, trigger) => openNoteEditor({ trigger, store, ctx, ref: recordReference(record), record, restoreFocus: trigger })
    : null;
  // A word in This verse's Greek opens in a Greek pane showing its chapter.
  const openGreekWord = (passage, t) => {
    const greek = Array.from(paneEls.values()).find((r) => r.kind === "greek" && sameChapter(r.inst?.chapter?.(), passage));
    if (greek) greek.inst.selectWord(passage.verse, t, { focus: true });
    else announce("Open a Greek pane on this chapter to see the word.");
  };
  // The draft chapters of each book, written at build (desk.astro), so the
  // LIT pane shows a run of them as one stub without fetching each.
  let drafts = {};
  try { drafts = JSON.parse(document.getElementById("desk-drafts")?.textContent || "{}") ?? {}; } catch (_) {}
  const env = { store, storeError, onEdit, ctx, openGreekWord, drafts };

  document.documentElement.dataset.deskWorkspace = "";
  root.replaceChildren();
  root.classList.add("desk-ws");

  let saved = readSaved(readKey());
  let layout = openingLayout(saved);
  // The following panes' shared passage starts where the reader last read.
  if (!parsePassage(layout.place)) {
    let last = null;
    try { last = loadLastRead(); } catch (_) {}
    layout = setPlace(layout, formatPassage(startingPassage(last)));
  }

  // ---- the bar and the Layout menu ----

  const bar = el("div", "desk-ws__bar");
  const title = document.querySelector(".desk-page__title");
  if (title) bar.append(title);
  const layoutButton = el("button", "desk-ws__layout");
  layoutButton.type = "button";
  layoutButton.setAttribute("aria-haspopup", "dialog");
  layoutButton.setAttribute("aria-expanded", "false");
  layoutButton.setAttribute("aria-controls", "deskLayoutMenu");
  layoutButton.innerHTML = `<span>Layout</span>${ICON_CARET}`;
  bar.append(layoutButton);

  const menu = el("div", "desk-ws__menu");
  menu.id = "deskLayoutMenu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Layout");
  menu.hidden = true;
  menu.innerHTML = `
    <div class="desk-ws__shapes" role="group" aria-label="Arrange the panes"></div>
    <p class="desk-ws__menu-note">Or drag a pane by its header to an edge of another to split it.</p>
    <fieldset class="desk-ws__start">
      <legend>When this page opens, show</legend>
      <label><input type="radio" name="desk-ws-start" value="last" /> My last layout</label>
      <label><input type="radio" name="desk-ws-start" value="default" /> My default</label>
    </fieldset>
    <div class="desk-ws__menu-actions">
      <button type="button" data-ws-make-default>Make this my default</button>
      <button type="button" data-ws-reset>Reset to the original layout</button>
    </div>`;
  bar.append(menu);

  const shapesBox = menu.querySelector(".desk-ws__shapes");
  const shapeButtons = ARRANGEMENTS.map((a) => {
    const b = el("button", "desk-ws__shape");
    b.type = "button";
    b.dataset.arrangement = a.id;
    b.innerHTML = `${diagram(a.shape)}<span class="desk-ws__shape-name"></span><span class="desk-ws__shape-needs"></span>`;
    b.querySelector(".desk-ws__shape-name").textContent = a.label;
    b.querySelector(".desk-ws__shape-needs").id = `deskWsNeeds-${a.id}`;
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      commit(applyArrangement(layout, a.id));
      announce(`Layout: ${a.label}.`);
      closeMenu();
    });
    shapesBox.append(b);
    return b;
  });
  const startRadios = Array.from(menu.querySelectorAll('input[name="desk-ws-start"]'));
  for (const radio of startRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      saved = { ...saved, start: radio.value };
      writeKey(writeSaved(saved));
    });
  }
  const makeDefault = menu.querySelector("[data-ws-make-default]");
  makeDefault.addEventListener("click", () => {
    saved = { ...saved, mine: layout };
    writeKey(writeSaved(saved));
    refreshMenu();
    announce("This layout is now your default.");
  });
  menu.querySelector("[data-ws-reset]").addEventListener("click", () => {
    commit(originalLayout());
    announce("Back to the original layout: the LIT beside My Notes.");
    closeMenu();
  });

  function refreshMenu() {
    const { width, height } = panesBox.getBoundingClientRect();
    const current = arrangementOf(layout);
    for (const b of shapeButtons) {
      const why = needs(b.dataset.arrangement, width, height);
      const note = b.querySelector(".desk-ws__shape-needs");
      note.textContent = why ? NEEDS_TEXT[why] : "";
      if (why) {
        b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-describedby", note.id);
      } else {
        b.removeAttribute("aria-disabled");
        b.removeAttribute("aria-describedby");
      }
      b.setAttribute("aria-pressed", String(b.dataset.arrangement === current));
    }
    const defaultRadio = startRadios.find((r) => r.value === "default");
    defaultRadio.disabled = !saved.mine;
    for (const r of startRadios) r.checked = r.value === (saved.mine ? saved.start : "last");
  }

  function openMenu() {
    refreshMenu();
    menu.hidden = false;
    layoutButton.setAttribute("aria-expanded", "true");
    (shapesBox.querySelector('[aria-pressed="true"]') ?? shapeButtons[0]).focus();
  }

  function closeMenu({ focus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    layoutButton.setAttribute("aria-expanded", "false");
    if (focus) layoutButton.focus();
  }

  layoutButton.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
  });

  // ---- the panes ----

  const panesBox = el("div", "desk-ws__panes");
  const drop = el("div", "desk-ws__drop");
  drop.hidden = true;
  const status = el("p", "sr-only");
  status.setAttribute("role", "status");
  const announce = (text) => { status.textContent = ""; requestAnimationFrame(() => { status.textContent = text; }); };
  root.append(bar, panesBox, status);

  const paneEls = new Map(); // id → { el, body, kind, inst, ... }
  let kindMenu = null; // the open "show in this pane" menu, if any

  function save() {
    saved = { ...saved, last: layout };
    writeKey(writeSaved(saved));
  }

  /** Take a new layout: kept at once, and drawn (or only re-marked). */
  function commit(next, { draw: redraw = true } = {}) {
    if (next === layout) return;
    layout = next;
    save();
    if (redraw) draw();
    else mark();
    follow();
  }

  /** The passage a pane shows now: a LIT pane's own, a following pane's own or the shared one. */
  const passageOf = (id) => parsePassage(litPlace(layout, id) ?? placeFor(layout, id))
    ?? parsePassage(layout.place) ?? startingPassage(null);

  /**
   * A pane's passage changed. A LIT pane is telling where its reader is; a
   * following pane that stays put moves only itself; one that follows moves
   * the active LIT pane (or, with none open, the shared place), and with it
   * every pane that follows.
   */
  function setPassageOf(id, passage) {
    const at = formatPassage(passage);
    const pane = findPane(layout.root, id);
    if (!at || !pane) return;
    if (pane.kind === "lit") {
      const rec = paneEls.get(id);
      if (rec) rec.at = at; // it is already there
      commit(setLitAt(layout, id, at), { draw: false });
    } else if (pane.pin) {
      commit(setPin(layout, id, true, at), { draw: false });
    } else if (findPane(layout.root, layout.active)?.kind === "lit") {
      commit(setLitAt(layout, layout.active, at), { draw: false });
    } else {
      commit(setPlace(layout, at), { draw: false });
    }
  }

  /** Give each pane that is moved (LIT and following) its passage, when it has changed. */
  function follow() {
    for (const pane of panes(layout.root)) {
      const rec = paneEls.get(pane.id);
      if (!rec?.inst?.setPassage) continue;
      const p = passageOf(pane.id);
      const at = formatPassage(p);
      if (rec.at === at) continue;
      rec.at = at;
      rec.inst.setPassage(p);
    }
  }

  function paneRecord(pane) {
    let rec = paneEls.get(pane.id);
    if (!rec) {
      const section = el("section", "desk-pane");
      section.dataset.paneId = pane.id;
      const head = el("header", "desk-pane__head");
      const grip = el("span", "desk-pane__grip");
      grip.innerHTML = ICON_GRIP;
      const h2 = el("h2", "desk-pane__title");
      const kindButton = el("button", "desk-pane__kind");
      kindButton.type = "button";
      kindButton.id = `deskPaneTitle-${pane.id}`;
      kindButton.setAttribute("aria-haspopup", "menu");
      kindButton.setAttribute("aria-expanded", "false");
      kindButton.innerHTML = `<span class="desk-pane__name"></span>${ICON_CARET}`;
      h2.append(kindButton);
      const lead = el("span", "desk-pane__lead", "Leading");
      lead.title = "This verse, Greek, and Footnotes follow this pane";
      const pin = el("button", "desk-pane__pin");
      pin.type = "button";
      pin.innerHTML = `${ICON_PIN}<span>Stay here</span>`;
      const close = el("button", "desk-pane__close");
      close.type = "button";
      close.innerHTML = ICON_CLOSE;
      head.append(grip, h2, lead, pin, close);
      const body = el("div", "desk-pane__body");
      section.setAttribute("aria-labelledby", kindButton.id);
      section.append(head, body);
      rec = { el: section, head, body, kindButton, lead, pin, close, kind: null, inst: null, at: null };
      paneEls.set(pane.id, rec);

      kindButton.addEventListener("click", () => openKindMenu(pane.id, kindButton));
      pin.addEventListener("click", () => {
        const now = findPane(layout.root, pane.id);
        // A pane that stays put keeps the passage it shows; let go, it
        // rejoins the passage the following panes share.
        commit(setPin(layout, pane.id, !now?.pin, now?.pin ? null : formatPassage(passageOf(pane.id))), { draw: false });
        announce(now?.pin ? `${kindLabel(now.kind)} follows the LIT pane again.` : `${kindLabel(now.kind)} stays here.`);
      });
      close.addEventListener("click", () => {
        const name = kindLabel(findPane(layout.root, pane.id)?.kind);
        commit(closePane(layout, pane.id));
        announce(`${name} closed.`);
        panesBox.querySelector(".desk-pane__kind")?.focus();
      });
      head.addEventListener("pointerdown", (e) => startMove(e, pane.id));
      // The LIT pane last worked in leads (D9, "Phase 3a's answers", 6).
      const touch = () => {
        const p = findPane(layout.root, pane.id);
        if (p?.kind === "lit") commit(setActive(layout, pane.id), { draw: false });
      };
      body.addEventListener("pointerdown", touch);
      body.addEventListener("focusin", touch);
      body.addEventListener("keydown", touch);
      // Not "scroll": a LIT pane scrolls itself when it loads a chapter
      // above or is sent somewhere, and that isn't the reader working in it.
      body.addEventListener("wheel", touch, { passive: true });
    }
    if (rec.kind !== pane.kind) {
      rec.inst?.destroy();
      rec.body.replaceChildren();
      rec.kind = pane.kind;
      // A LIT or following pane starts at its passage; follow() moves it after.
      rec.at = isFollower(pane.kind) || pane.kind === "lit" ? formatPassage(passageOf(pane.id)) : null;
      rec.inst = mountPane(pane.kind, rec.body, env, {
        id: pane.id,
        get: () => passageOf(pane.id),
        set: (passage) => setPassageOf(pane.id, passage),
      });
    }
    return rec;
  }

  function build(node, path) {
    if (node.pane) return paneRecord(node.pane).el;
    const box = el("div", `desk-split desk-split--${node.split}`);
    box.dataset.path = path.join(".");
    node.children.forEach((child, i) => {
      if (i) box.append(lineBetween(node, path, i - 1));
      const part = build(child, [...path, i]);
      part.style.flex = `${node.sizes[i]} 1 0px`;
      box.append(part);
    });
    return box;
  }

  function draw() {
    const live = new Set(panes(layout.root).map((p) => p.id));
    for (const [id, rec] of paneEls) {
      if (!live.has(id)) { rec.inst?.destroy(); paneEls.delete(id); }
    }
    fit();
    // Moving an element blurs it, so the focus is put back after.
    const focused = panesBox.contains(document.activeElement) ? document.activeElement : null;
    const tree = build(layout.root, []);
    tree.style.flex = "1 1 0px";
    panesBox.replaceChildren(tree, drop);
    if (focused?.isConnected) focused.focus({ preventScroll: true });
    mark();
    follow();
  }

  /** The parts of each pane's header that change without redrawing. */
  function mark() {
    const all = panes(layout.root);
    const lits = all.filter((p) => p.kind === "lit").length;
    for (const pane of all) {
      const rec = paneEls.get(pane.id);
      if (!rec) continue;
      const name = kindLabel(pane.kind);
      rec.kindButton.querySelector(".desk-pane__name").textContent = name;
      rec.kindButton.setAttribute("aria-label", `${name} pane: show something else here`);
      const leading = pane.kind === "lit" && lits > 1 && layout.active === pane.id;
      rec.lead.hidden = !leading;
      rec.el.classList.toggle("desk-pane--leading", leading);
      rec.pin.hidden = !isFollower(pane.kind);
      rec.pin.setAttribute("aria-pressed", String(Boolean(pane.pin)));
      rec.pin.title = pane.pin ? "Follow the LIT pane again" : "Stop following the LIT pane";
      rec.close.hidden = all.length <= 1;
      rec.close.setAttribute("aria-label", `Close the ${name} pane`);
    }
  }

  // ---- "show in this pane" ----

  function closeKindMenu({ focus = true } = {}) {
    if (!kindMenu) return;
    const { menuEl, button } = kindMenu;
    kindMenu = null;
    menuEl.remove();
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  }

  function openKindMenu(id, button) {
    const wasOpen = kindMenu?.button === button;
    closeKindMenu({ focus: false });
    if (wasOpen) return;
    const pane = findPane(layout.root, id);
    const menuEl = el("div", "desk-pane__menu");
    menuEl.setAttribute("role", "menu");
    menuEl.setAttribute("aria-label", "Show in this pane");
    for (const k of KINDS) {
      const item = el("button", "desk-pane__menu-item", k.label);
      item.type = "button";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(k.kind === pane.kind));
      item.tabIndex = -1;
      item.addEventListener("click", () => {
        closeKindMenu();
        commit(setKind(layout, id, k.kind));
        announce(`This pane now shows ${k.label}.`);
      });
      menuEl.append(item);
    }
    const items = Array.from(menuEl.children);
    menuEl.addEventListener("keydown", (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = items.length;
        items[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        items[e.key === "Home" ? 0 : items.length - 1].focus();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        closeKindMenu();
      } else if (e.key === "Tab") {
        closeKindMenu({ focus: false });
      }
    });
    button.closest(".desk-pane__head").append(menuEl);
    button.setAttribute("aria-expanded", "true");
    kindMenu = { menuEl, button };
    (items.find((it) => it.getAttribute("aria-checked") === "true") ?? items[0]).focus();
  }

  document.addEventListener("pointerdown", (e) => {
    if (kindMenu && !kindMenu.menuEl.contains(e.target) && e.target !== kindMenu.button && !kindMenu.button.contains(e.target)) {
      closeKindMenu({ focus: false });
    }
    if (!menu.hidden && !menu.contains(e.target) && !layoutButton.contains(e.target)) closeMenu({ focus: false });
  });

  // ---- the lines between panes ----

  function lineBetween(node, path, index) {
    const line = el("div", "desk-split__handle");
    line.setAttribute("role", "separator");
    line.tabIndex = 0;
    // A line between columns stands upright.
    line.setAttribute("aria-orientation", node.split === "columns" ? "vertical" : "horizontal");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    line.setAttribute("aria-valuenow", String(Math.round(node.sizes[index] * 100)));
    const names = [node.children[index], node.children[index + 1]].map((c) => LIST.format(panes(c).map((p) => kindLabel(p.kind))));
    line.setAttribute("aria-label", node.split === "columns"
      ? `Resize: ${names[0]} on the left, ${names[1]} on the right`
      : `Resize: ${names[0]} above, ${names[1]} below`);
    line.style.flexBasis = `${HANDLE}px`;
    const columns = node.split === "columns";
    const lengthOf = () => {
      const r = line.parentElement.getBoundingClientRect();
      return columns ? r.width : r.height;
    };
    line.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      const base = layout;
      const from = columns ? e.clientX : e.clientY;
      const length = lengthOf();
      document.documentElement.classList.add(columns ? "desk-ws--resizing-x" : "desk-ws--resizing-y");
      const move = (ev) => {
        layout = resize(base, path, index, (columns ? ev.clientX : ev.clientY) - from, length);
        sizeSplit(path);
      };
      const up = () => {
        line.removeEventListener("pointermove", move);
        line.removeEventListener("pointerup", up);
        line.removeEventListener("pointercancel", up);
        document.documentElement.classList.remove("desk-ws--resizing-x", "desk-ws--resizing-y");
        save();
      };
      line.addEventListener("pointermove", move);
      line.addEventListener("pointerup", up);
      line.addEventListener("pointercancel", up);
    });
    line.addEventListener("keydown", (e) => {
      const back = columns ? "ArrowLeft" : "ArrowUp";
      const ahead = columns ? "ArrowRight" : "ArrowDown";
      if (e.key !== back && e.key !== ahead) return;
      e.preventDefault();
      const length = lengthOf();
      const step = length * (e.shiftKey ? 0.1 : 0.02);
      layout = resize(layout, path, index, e.key === ahead ? step : -step, length);
      sizeSplit(path);
      save();
    });
    line.addEventListener("dblclick", () => {
      layout = evenOut(layout, path);
      sizeSplit(path);
      save();
    });
    return line;
  }

  /** Sizes that give every pane its minimum in the space there is (in memory; saved with the next change). */
  function fit() {
    const { width, height } = panesBox.getBoundingClientRect();
    if (width && height) layout = { ...layout, root: fitSizes(layout.root, width, height) };
  }

  /** Put every split's sizes on the page without redrawing. */
  function sizeAll() {
    const walk = (node, path) => {
      if (node.pane) return;
      sizeSplit(path);
      node.children.forEach((c, i) => walk(c, [...path, i]));
    };
    walk(layout.root, []);
  }

  /** Put a split's sizes on the page without redrawing it. */
  function sizeSplit(path) {
    const node = nodeAt(layout.root, path);
    const box = panesBox.querySelector(`.desk-split[data-path="${path.join(".")}"]`);
    if (!node || node.pane || !box) return;
    const parts = Array.from(box.children).filter((c) => !c.classList.contains("desk-split__handle"));
    parts.forEach((part, i) => { part.style.flex = `${node.sizes[i]} 1 0px`; });
    Array.from(box.children)
      .filter((c) => c.classList.contains("desk-split__handle"))
      .forEach((line, i) => line.setAttribute("aria-valuenow", String(Math.round(node.sizes[i] * 100))));
  }

  // ---- dragging a pane to split another ----

  function edgeAt(rect, x, y) {
    const fx = (x - rect.left) / rect.width;
    const fy = (y - rect.top) / rect.height;
    const d = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
    return Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
  }

  function startMove(e, movingId) {
    if (e.button !== 0 || e.target.closest("button, .desk-pane__menu")) return;
    if (panes(layout.root).length < 2) return;
    const head = e.currentTarget;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moving = false;
    let candidate = null;
    head.setPointerCapture(e.pointerId);
    const stop = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", key, true);
      drop.hidden = true;
      document.documentElement.classList.remove("desk-ws--moving");
      paneEls.get(movingId)?.el.classList.remove("desk-pane--moving");
    };
    const move = (ev) => {
      if (!moving) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        moving = true;
        document.documentElement.classList.add("desk-ws--moving");
        paneEls.get(movingId)?.el.classList.add("desk-pane--moving");
      }
      const target = document.elementsFromPoint(ev.clientX, ev.clientY)
        .map((n) => n.closest?.(".desk-pane"))
        .find((n) => n && panesBox.contains(n));
      if (!target || target.dataset.paneId === movingId) {
        drop.hidden = true;
        candidate = null;
        return;
      }
      const rect = target.getBoundingClientRect();
      const edge = edgeAt(rect, ev.clientX, ev.clientY);
      const next = splitPane(layout, target.dataset.paneId, edge, movingId);
      const box = panesBox.getBoundingClientRect();
      const why = next === layout ? "larger" : needs(next.root, box.width, box.height);
      candidate = why ? null : next;
      const half = {
        left: [rect.left, rect.top, rect.width / 2, rect.height],
        right: [rect.left + rect.width / 2, rect.top, rect.width / 2, rect.height],
        top: [rect.left, rect.top, rect.width, rect.height / 2],
        bottom: [rect.left, rect.top + rect.height / 2, rect.width, rect.height / 2],
      }[edge];
      Object.assign(drop.style, {
        left: `${half[0] - box.left}px`,
        top: `${half[1] - box.top}px`,
        width: `${half[2]}px`,
        height: `${half[3]}px`,
      });
      drop.classList.toggle("desk-ws__drop--refused", Boolean(why));
      drop.textContent = why ? "No room here" : "";
      drop.hidden = false;
    };
    const up = () => {
      stop();
      if (moving && candidate) {
        const name = kindLabel(findPane(layout.root, movingId)?.kind);
        commit(candidate);
        announce(`${name} moved.`);
      }
    };
    const cancel = () => stop();
    const key = (ev) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      stop();
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", key, true);
  }

  // ---- the page's height ----

  // The panes fill the window below the bar; the footer is hidden (desk.css)
  // so the page itself doesn't scroll.
  function fitHeight() {
    const top = panesBox.getBoundingClientRect().top + window.scrollY;
    panesBox.style.height = `${Math.max(MIN_HEIGHT, window.innerHeight - top - 12)}px`;
  }
  window.addEventListener("resize", () => {
    fitHeight();
    fit();
    sizeAll();
    if (!menu.hidden) refreshMenu();
  });

  fitHeight();
  draw();
}

start();
