// src/scripts/header-menus.js
//
// The header's Learn, Study and About menus (S12 step 5, header C;
// STUDY-DESK.md). They show only on a computer with the Study Desk preview on
// (global.css, from the pre-paint data-desk stamp), but this runs for every
// reader: it costs a few listeners and touches nothing until a press.
//
// Each is a disclosure, not an ARIA menu: a button with aria-expanded over a
// list of plain links, which a screen reader reads as links. The keys follow
// the desk's menus (src/scripts/CLAUDE.md, "One set of actions, two ways
// in"): Arrow Down or Up on the button opens it at the first or last link,
// the arrows, Home and End move among the links, and Escape closes it and
// returns to the button. A menu opens on a press, never on hover (BVJ's call
// was left to the build: a hover menu opens under a pointer crossing the
// header on its way to Read Now). One is open at a time, and a press
// elsewhere, or Tab out of it, closes it.

const groups = [...document.querySelectorAll("[data-nav-group]")];

const parts = (group) => ({
  button: group.querySelector(".site-nav__group-btn"),
  menu: group.querySelector(".site-nav__menu"),
});
const linksOf = (menu) => [...menu.querySelectorAll("a")];

let open = null;

function close({ focus = false } = {}) {
  if (!open) return;
  const { button, menu } = parts(open);
  menu.hidden = true;
  button.setAttribute("aria-expanded", "false");
  open = null;
  if (focus) button.focus();
}

function show(group, at) {
  if (open !== group) close();
  const { button, menu } = parts(group);
  menu.hidden = false;
  button.setAttribute("aria-expanded", "true");
  open = group;
  const links = linksOf(menu);
  if (at === "first") links[0]?.focus();
  else if (at === "last") links.at(-1)?.focus();
}

for (const group of groups) {
  const { button, menu } = parts(group);
  if (!button || !menu) continue;

  button.addEventListener("click", () => {
    if (open === group) close();
    else show(group);
  });

  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      show(group, "first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      show(group, "last");
    }
  });

  menu.addEventListener("keydown", (e) => {
    const links = linksOf(menu);
    const i = links.indexOf(/** @type {HTMLAnchorElement} */ (document.activeElement));
    let next = null;
    if (e.key === "ArrowDown") next = links[(i + 1) % links.length];
    else if (e.key === "ArrowUp") next = links[(i - 1 + links.length) % links.length];
    else if (e.key === "Home") next = links[0];
    else if (e.key === "End") next = links.at(-1);
    if (!next) return;
    e.preventDefault();
    next.focus();
  });

  group.addEventListener("focusout", (e) => {
    if (open === group && !group.contains(/** @type {Node | null} */ (e.relatedTarget))) close();
  });
}

if (groups.length) {
  document.addEventListener("click", (e) => {
    if (open && !open.contains(/** @type {Node} */ (e.target))) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) close({ focus: open.contains(document.activeElement) });
  });
}
