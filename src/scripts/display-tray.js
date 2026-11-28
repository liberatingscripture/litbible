// src/scripts/display-tray.js
//
// The Display tray ("Aa"; SITE-FEATHERBOA.md, "Display"). Its markup and its
// settings are src/lib/display-tray.mjs; this opens it beside the button
// that asked, and applies each choice to <html> and to localStorage, as
// Layout.astro's head script applies them before first paint.
//
// - Each row of choices is one stop for Tab (the one chosen), and the arrows,
//   Home and End move through it and choose as they go, as a group of radio
//   buttons does. A switch is pressed.
// - Every choice keeps the reader's place (keep-reading-place.js), the face
//   through both of its reflows: the attribute's, and its files' arriving.
// - With the Study preview the desk adds "Your marks" to View
//   (desk/note-settings.js); nothing here imports the desk.

import { TRAY_SETTINGS } from "../lib/display-tray.mjs";
import { isHoldingPlace, keepReadingPlace } from "./keep-reading-place.js";

// The files each face's reading text asks for (faces.css, global.css), which
// the hold waits on.
const FACE_FONTS = {
  default: ['1em "Source Sans 3 Variable"', 'italic 1em "Source Sans 3 Variable"', '1em "Fraunces Variable"'],
  atkinson: ['1em "Atkinson Hyperlegible Next Variable"', 'italic 1em "Atkinson Hyperlegible Next Variable"'],
  dyslexic: ['1em "OpenDyslexic"', 'bold 1em "OpenDyslexic"', 'italic 1em "OpenDyslexic"'],
};

/** The value a setting has on this page now. */
export function traySetting(name) {
  const { attr, fallback } = TRAY_SETTINGS[name];
  return document.documentElement.getAttribute(attr) || fallback;
}

/**
 * Put a setting on the page and keep it. Every one but the theme reflows the
 * text, so it is made inside keepReadingPlace, which measures right after it;
 * `overlay` is the tray, taken out of hit-testing while the line is found.
 */
export function setTraySetting(name, value, { overlay = null } = {}) {
  const { attr, key, legacy, fallback } = TRAY_SETTINGS[name];
  const root = document.documentElement;
  const put = () => {
    if (value === fallback) root.removeAttribute(attr);
    else root.setAttribute(attr, value);
    if (name === "theme") root.style.colorScheme = value === fallback ? "" : value;
    // What was measured in the old face (the margin's notes, a floating
    // window) is measured again.
    if (name === "font") window.dispatchEvent(new Event("resize"));
  };
  if (name === "theme") put();
  else keepReadingPlace(put, { overlay, fonts: name === "font" ? FACE_FONTS[value] : null });
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    for (const old of legacy) localStorage.removeItem(old);
  } catch (_) {}
}

/**
 * A row of choices: `choose` is called with the value picked, and the
 * returned `sync` redraws the row from the page.
 */
function wireChoices(group, choose) {
  const items = () => Array.from(group.querySelectorAll('[role="radio"]'));
  const sync = () => {
    const now = traySetting(group.dataset.trayChoices);
    const list = items();
    for (const b of list) {
      const on = b.dataset.trayChoice === now;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (list.length && !list.some((b) => b.tabIndex === 0)) list[0].tabIndex = 0;
  };
  const pick = (b) => {
    if (b.getAttribute("aria-checked") !== "true") choose(b.dataset.trayChoice);
    sync();
  };
  group.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest('[role="radio"]') : null;
    if (b && group.contains(b)) pick(b);
  });
  group.addEventListener("keydown", (e) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    if (at < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let to = null;
    if (step) to = (at + step + list.length) % list.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = list.length - 1;
    else return;
    e.preventDefault();
    list[to].focus();
    pick(list[to]);
  });
  return sync;
}

/** A switch for one on/off setting; returns its `sync`. */
function wireSwitch(button, overlay) {
  const name = button.dataset.traySwitch;
  const on = () => traySetting(name) === "on";
  const sync = () => button.setAttribute("aria-checked", String(on()));
  button.addEventListener("click", () => {
    setTraySetting(name, on() ? "off" : "on", { overlay });
    sync();
  });
  return sync;
}

let started = false;

export function initDisplayTray() {
  if (started) return;
  const tray = document.getElementById("fontTray");
  const closeBtn = tray?.querySelector(".font-tray__close");
  const toggleBtns = Array.from(document.querySelectorAll("[data-font-toggle]"));
  if (!tray || !closeBtn || !toggleBtns.length) return;
  started = true;

  // Out of the header's stacking context (.site-header has a z-index), so
  // its own z-index competes at the top level. It is fixed and placed by
  // this script, so it needs no positioned ancestor.
  document.body.appendChild(tray);

  const syncs = [
    ...Array.from(tray.querySelectorAll("[data-tray-choices]"), (group) =>
      wireChoices(group, (value) => setTraySetting(group.dataset.trayChoices, value, { overlay: tray })),
    ),
    // Only the tray's own switches: the desk wires the ones it adds.
    ...Array.from(tray.querySelectorAll("[data-tray-switch]"))
      .filter((b) => b.dataset.traySwitch in TRAY_SETTINGS)
      .map((b) => wireSwitch(b, tray)),
  ];
  const syncAll = () => {
    for (const sync of syncs) sync();
  };

  let activeBtn = null;

  // Below the button, or above it when there isn't room below; aligned to
  // the button's right edge, or its left where that would run off the
  // screen. A toggle can name another element to hang the tray from
  // (data-tray-anchor="<selector>"): Study moves its Aa into the page
  // title's menu, which closes as the tray opens, so the tray hangs from the
  // title and focus returns to it.
  const anchorOf = (btn) => (btn.dataset.trayAnchor && document.querySelector(btn.dataset.trayAnchor)) || btn;

  const positionTray = (btn) => {
    const rect = anchorOf(btn).getBoundingClientRect();
    const margin = 8;
    tray.style.maxHeight = "none";
    const width = tray.offsetWidth;
    const height = tray.offsetHeight;
    const below = window.innerHeight - rect.bottom - margin * 2;
    const above = rect.top - margin * 2;
    const openAbove = height > below && above > below;
    const room = openAbove ? above : below;
    tray.style.maxHeight = `${Math.max(160, room)}px`;
    tray.style.top = openAbove ? `${Math.max(margin, rect.top - margin - Math.min(height, room))}px` : `${rect.bottom + margin}px`;
    let left = rect.right - width;
    if (left < margin) left = Math.min(rect.left, window.innerWidth - width - margin);
    tray.style.left = `${Math.max(margin, left)}px`;
    tray.style.right = "auto";
  };

  const closeTray = (returnFocus = true) => {
    tray.hidden = true;
    for (const btn of toggleBtns) btn.setAttribute("aria-expanded", "false");
    if (returnFocus && activeBtn) anchorOf(activeBtn).focus({ preventScroll: true });
    activeBtn = null;
  };

  const openTray = (btn) => {
    activeBtn = btn;
    syncAll();
    // Shown before it is placed, so it can be measured; both in this task,
    // before any paint.
    tray.hidden = false;
    positionTray(btn);
    btn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  };

  for (const btn of toggleBtns) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      !tray.hidden && activeBtn === btn ? closeTray() : openTray(btn);
    });
  }
  closeBtn.addEventListener("click", () => closeTray());
  tray.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    if (!tray.hidden) closeTray(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !tray.hidden) closeTray();
  });
  window.addEventListener("resize", () => {
    if (!tray.hidden && activeBtn) positionTray(activeBtn);
  });
  // The header isn't sticky: close on a scroll so the fixed tray can't
  // drift from its button, but not for a scroll the reader didn't make: the
  // hold's own corrective scroll, or the one that holds the line when a
  // chapter is put in above it (read-on.js, which says so first with
  // READ_ON_EVENT, "lit:read-on", named here so this file, on every page,
  // doesn't import it). A smaller size near a chapter's top brings one: the
  // hold scrolls up, and the page reads that as the reader nearing the top.
  let pageMoved = false;
  document.addEventListener("lit:read-on", (e) => {
    if (e.detail?.type !== "loaded") return;
    pageMoved = true;
    requestAnimationFrame(() => requestAnimationFrame(() => (pageMoved = false)));
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!tray.hidden && !isHoldingPlace() && !pageMoved) closeTray(false);
    },
    { passive: true },
  );

  syncAll();
}
