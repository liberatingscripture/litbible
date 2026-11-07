// src/scripts/desk/kind-menu.js
//
// A /desk pane's name is a menu (the "show in this pane" menu): the kinds to
// show in it, then three lines that open flyouts beside it, Add pane, Move and
// Size (BVJ, 2026-11-04; E25, DK-8). Taken out of desk-page.js's `start()`
// (Audit 3, LG3-3) so the next bug in it means reading this file, not 1,700
// lines of shared locals.
//
// It takes what it needs and reaches for nothing else, as panel-flyout.js and
// intro-pane.js do. The layout is read through `getLayout()` at the moment it
// is wanted (it is replaced on every change, so a captured copy would be
// stale by the click); a change goes back through `commit`. The pure rules
// are in src/lib/desk-layout.mjs (`addWhy`, `whyText`, `sizingFor`, `SIZINGS`).
//
// - `getLayout()` the page's current layout.
// - `panesBox` the element holding the panes (the room Add pane is judged in).
// - `paneEls` id → { el, ... }, to ask the panes where they are drawn.
// - `commit(layout)` makes a layout the page's, saved and drawn.
// - `announce(text)` says what happened to a screen reader.
// - `sizePane(id, sizing)` the page's step of a pane's size (it resizes the
//   drawn tree, so it stays with the lines between panes).

import {
  KINDS,
  SIZINGS,
  addBeside,
  addBesideNeeds,
  addWhy,
  findPane,
  kindLabel,
  neighborIn,
  panes,
  setKind,
  sizingFor,
  swapPanes,
  whyText,
} from "../../lib/desk-layout.mjs";
import { el } from "./dom.js";
import { describeUnavailable } from "./menu-reasons.js";

// A pane's "Move" items, in the order the menu lists them (E25).
const MOVES = [
  { direction: "left", label: "Move left" },
  { direction: "right", label: "Move right" },
  { direction: "up", label: "Move up" },
  { direction: "down", label: "Move down" },
];

/**
 * Builds the pane menu and wires the listeners that close it (a scroll or
 * resize anywhere but in it, a press outside it). Returns `{ open(id, button),
 * close({ focus }) }`: `open` toggles, closing the menu if it is already open
 * on that button.
 */
export function createKindMenu({ getLayout, panesBox, paneEls, commit, announce, sizePane }) {
  let kindMenu = null; // the open "show in this pane" menu, if any

  function closeKindMenu({ focus = true } = {}) {
    if (!kindMenu) return;
    const { menuEl, button, fly, reasons } = kindMenu;
    clearTimeout(flyTimer);
    kindMenu = null;
    fly?.reasons.destroy();
    fly?.el.remove();
    reasons.destroy();
    menuEl.remove();
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  }

  // The pane menu's Add pane, Move and Size are flyouts beside it, as the title
  // menu's Add pane is: hover opens one without taking focus, a click or the
  // right arrow moves into it. A flyout is a sibling of the menu, not a child,
  // since the menu scrolls and would clip it.
  let flyTimer = 0;

  const flyButtons = (flyEl) => Array.from(flyEl.querySelectorAll("button")).filter((b) => b.getAttribute("aria-disabled") !== "true");

  function closeFly({ focus = false } = {}) {
    const fly = kindMenu?.fly;
    if (!fly) return;
    fly.reasons.destroy();
    fly.el.remove();
    fly.trigger.setAttribute("aria-expanded", "false");
    kindMenu.fly = null;
    if (focus) fly.trigger.focus({ preventScroll: true });
  }

  function closeFlyLater() {
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => {
      if (kindMenu?.fly && !kindMenu.fly.el.contains(document.activeElement)) closeFly();
    }, 250);
  }

  function openFly(def, trigger, { focus = true } = {}) {
    if (!kindMenu) return;
    clearTimeout(flyTimer);
    const current = kindMenu.fly;
    if (current?.trigger === trigger) {
      if (focus) flyButtons(current.el)[0]?.focus({ preventScroll: true });
      return;
    }
    closeFly();
    const flyEl = el("div", "desk-pane__menu desk-pane__fly");
    flyEl.setAttribute("role", "menu");
    flyEl.setAttribute("aria-label", def.name);
    def.build(flyEl, null);
    kindMenu.head.append(flyEl);
    // Beside the menu, level with its line; on the other side where the
    // window's edge is in the way, and kept inside the window below.
    const m = kindMenu.menuEl.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const edge = 8;
    let left = m.right + 2;
    if (left + flyEl.offsetWidth > window.innerWidth - edge) left = m.left - flyEl.offsetWidth - 2;
    flyEl.style.left = `${Math.max(edge, left)}px`;
    flyEl.style.top = `${Math.max(edge, Math.min(t.top - 4, window.innerHeight - edge - flyEl.offsetHeight))}px`;
    flyEl.addEventListener("mouseenter", () => clearTimeout(flyTimer));
    flyEl.addEventListener("mouseleave", closeFlyLater);
    flyEl.addEventListener("keydown", (e) => {
      const live = flyButtons(flyEl);
      const i = live.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        live[(i + (e.key === "ArrowDown" ? 1 : live.length - 1)) % live.length]?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        live[e.key === "Home" ? 0 : live.length - 1]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "Escape") {
        // One step back: from the kinds to the directions, then out of the flyout.
        e.preventDefault();
        e.stopPropagation();
        if (flyEl.dataset.step) {
          def.build(flyEl, null);
          flyButtons(flyEl)[0]?.focus();
        } else {
          closeFly({ focus: true });
        }
      } else if (e.key === "Tab") {
        closeKindMenu({ focus: false });
      }
    });
    trigger.setAttribute("aria-expanded", "true");
    kindMenu.fly = { el: flyEl, trigger, reasons: describeUnavailable(flyEl, { id: `deskPaneFlyWhy-${++paneHintCount}` }) };
    if (focus) flyButtons(flyEl)[0]?.focus({ preventScroll: true });
  }

  let paneHintCount = 0;

  function openKindMenu(id, button) {
    const wasOpen = kindMenu?.button === button;
    closeKindMenu({ focus: false });
    if (wasOpen) return;
    const pane = findPane(getLayout().root, id);
    const menuEl = el("div", "desk-pane__menu");
    menuEl.setAttribute("role", "menu");
    menuEl.setAttribute("aria-label", "Pane options");
    // The kinds are radios and the moves plain items, so each has a group of
    // its own with its own name.
    const kinds = el("div", "desk-pane__menu-group");
    kinds.setAttribute("role", "group");
    kinds.setAttribute("aria-label", "Show in this pane");
    menuEl.append(kinds);
    for (const k of KINDS) {
      const item = el("button", "desk-pane__menu-item", k.label);
      item.type = "button";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(k.kind === pane.kind));
      item.tabIndex = -1;
      item.addEventListener("click", () => {
        closeKindMenu();
        commit(setKind(getLayout(), id, k.kind));
        announce(`This pane now shows ${k.label}.`);
      });
      kinds.append(item);
    }
    const head = button.closest(".desk-pane__head");
    // A line of the menu or its flyouts: a label, and under it, greyed, the
    // reason it can't be used (as the title menu draws one).
    const menuItem = (label, why) => {
      const b = el("button", "desk-pane__menu-item");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.tabIndex = -1;
      b.append(el("span", "desk-title__label", label));
      if (why) {
        const hint = el("span", "desk-title__hint", why);
        hint.id = `deskPaneHint-${id}-${++paneHintCount}`;
        b.append(hint);
        b.setAttribute("aria-disabled", "true");
        b.setAttribute("aria-describedby", hint.id);
      }
      return b;
    };

    // Move this pane (E25): the keyboard's way to do what dragging does. It
    // swaps places with the pane beside it, so "Move left" is only offered
    // where there is one; the panes are asked where they are drawn.
    const rects = panes(getLayout().root).map((p) => {
      const r = paneEls.get(p.id)?.el.getBoundingClientRect();
      return r ? { id: p.id, left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
    }).filter(Boolean);
    const moves = MOVES.map((m) => ({ ...m, other: neighborIn(rects, id, m.direction) })).filter((m) => m.other);
    const buildMove = (fly) => {
      for (const m of moves) {
        const b = menuItem(m.label);
        b.addEventListener("click", () => {
          const name = kindLabel(findPane(getLayout().root, id)?.kind);
          const other = kindLabel(findPane(getLayout().root, m.other)?.kind);
          closeKindMenu();
          commit(swapPanes(getLayout(), id, m.other));
          announce(`${name} moved ${m.direction}, swapping with ${other}.`);
        });
        fly.append(b);
      }
    };

    // Add a pane beside this one: the flyout asks which side, then, in the same
    // flyout, the kind, and the others scoot over (addBeside).
    const { width, height } = panesBox.getBoundingClientRect();
    const SIDES = [
      { id: "left", label: "To the left", said: "to the left" },
      { id: "right", label: "To the right", said: "to the right" },
      { id: "above", label: "Above", said: "above" },
      { id: "below", label: "Below", said: "below" },
    ];
    const sideWhy = (s) => {
      return whyText(addBesideNeeds(getLayout(), id, s, width, height));
    };
    const buildAdd = (fly, side) => {
      fly.replaceChildren();
      if (side) fly.dataset.step = side; else delete fly.dataset.step;
      if (!side) {
        for (const s of SIDES) {
          const b = menuItem(s.label, sideWhy(s.id));
          b.addEventListener("click", () => {
            if (b.getAttribute("aria-disabled") === "true") return;
            buildAdd(fly, s.id);
            fly.children[1]?.focus();
          });
          fly.append(b);
        }
        kindMenu?.fly?.reasons.refresh();
        return;
      }
      const label = SIDES.find((s) => s.id === side).label;
      const back = menuItem(`‹ ${label}`);
      back.addEventListener("click", () => { buildAdd(fly, null); fly.children[0]?.focus(); });
      fly.append(back);
      kindMenu?.fly?.reasons.refresh();
      for (const k of KINDS) {
        const b = menuItem(k.label);
        b.addEventListener("click", () => {
          const next = addBeside(getLayout(), id, side, k.kind, width, height);
          closeKindMenu();
          if (next === getLayout()) return;
          commit(next);
          announce(`Added a pane ${SIDES.find((x) => x.id === side).said} showing ${k.label}.`);
        });
        fly.append(b);
      }
    };
    const addReasons = SIDES.map((s) => addBesideNeeds(getLayout(), id, s.id, width, height));
    const addHint = addWhy(addReasons);

    // Size this pane (DK-8): the click-only way to do what dragging a line
    // does, for a reader who can't drag. Each step is a tenth of the split.
    const sizes = SIZINGS.map((z) => ({ ...z, at: sizingFor(getLayout().root, id, z) })).filter((z) => z.at);
    const buildSize = (fly) => {
      for (const z of sizes) {
        const b = menuItem(z.label);
        b.addEventListener("click", () => {
          closeKindMenu();
          sizePane(id, z);
        });
        fly.append(b);
      }
    };

    // The three are lines of the menu that open flyouts.
    const flyDefs = [
      { name: "Add pane", build: buildAdd, why: addHint },
      ...(moves.length ? [{ name: "Move", build: buildMove }] : []),
      ...(sizes.length ? [{ name: "Size", build: buildSize }] : []),
    ];
    const triggers = new Map();
    const line = el("div", "desk-pane__menu-line");
    line.setAttribute("role", "separator");
    menuEl.append(line);
    for (const def of flyDefs) {
      const b = menuItem(def.name, def.why);
      b.classList.add("desk-pane__menu-item--fly");
      b.setAttribute("aria-haspopup", "menu");
      b.setAttribute("aria-expanded", "false");
      const more = el("span", "desk-title__more");
      more.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M9 6l6 6-6 6" /></svg>`;
      b.append(more);
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") !== "true") openFly(def, b);
      });
      triggers.set(b, def);
      menuEl.append(b);
    }
    menuEl.addEventListener("mouseover", (e) => {
      const b = e.target instanceof Element ? e.target.closest("button") : null;
      if (!b) return;
      const def = triggers.get(b);
      if (def && b.getAttribute("aria-disabled") !== "true") openFly(def, b, { focus: false });
      else closeFlyLater();
    });
    menuEl.addEventListener("mouseleave", closeFlyLater);
    const items = Array.from(menuEl.querySelectorAll("button"));
    menuEl.addEventListener("keydown", (e) => {
      const live = items.filter((b) => b.getAttribute("aria-disabled") !== "true");
      const i = live.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = live.length;
        live[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        live[e.key === "Home" ? 0 : live.length - 1].focus();
      } else if (e.key === "ArrowRight" && triggers.has(document.activeElement)) {
        e.preventDefault();
        if (document.activeElement.getAttribute("aria-disabled") !== "true") openFly(triggers.get(document.activeElement), document.activeElement);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        closeKindMenu();
      } else if (e.key === "Tab") {
        closeKindMenu({ focus: false });
      }
    });
    head.append(menuEl);
    placeKindMenu(menuEl, button);
    button.setAttribute("aria-expanded", "true");
    kindMenu = { menuEl, button, head, fly: null, reasons: describeUnavailable(menuEl, { id: `deskPaneMenuWhy-${++paneHintCount}` }) };
    (items.find((it) => it.getAttribute("aria-checked") === "true") ?? items[0]).focus({ preventScroll: true });
  }

  /**
   * The menu is placed on the screen, not in its pane (BA122): the panes box
   * scrolls, so a menu hanging below a bottom-row pane's header was cut off
   * at its foot. It opens below the button where it fits in the window,
   * above where only that fits, and otherwise on the roomier side,
   * scrolling. Anything that scrolls or resizes under it closes it.
   */
  function placeKindMenu(menuEl, button) {
    const r = button.getBoundingClientRect();
    const gap = 2;
    const edge = 8;
    const height = menuEl.offsetHeight;
    const below = window.innerHeight - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    const down = height <= below || (height > above && below >= above);
    if (height > (down ? below : above)) menuEl.style.maxHeight = `${Math.max(down ? below : above, 0)}px`;
    menuEl.style.top = down ? `${r.bottom + gap}px` : `${Math.max(edge, r.top - gap - Math.min(height, above))}px`;
    const left = Math.min(r.left, window.innerWidth - menuEl.offsetWidth - edge);
    menuEl.style.left = `${Math.max(edge, left)}px`;
  }

  // A scroll anywhere but in the menu itself (the page, the panes box, a
  // pane), or a new window size, would leave it beside nothing.
  const kindMenuMoved = (e) => {
    if (kindMenu && !(e.type === "scroll" && (kindMenu.menuEl.contains(e.target) || kindMenu.fly?.el.contains(e.target)))) closeKindMenu({ focus: false });
  };
  window.addEventListener("scroll", kindMenuMoved, { capture: true, passive: true });
  window.addEventListener("resize", kindMenuMoved);

  document.addEventListener("pointerdown", (e) => {
    if (kindMenu && !kindMenu.menuEl.contains(e.target) && !kindMenu.fly?.el.contains(e.target) && e.target !== kindMenu.button && !kindMenu.button.contains(e.target)) {
      closeKindMenu({ focus: false });
    }
  });

  return { open: openKindMenu, close: closeKindMenu };
}
