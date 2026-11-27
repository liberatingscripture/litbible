// src/scripts/header-search.js
//
// The header's magnifier (audit U6; HD-13), on every page but the Read page.
// Without JS it is a plain link to /search. With JS, on a page with no search
// box of its own it opens a strip under the header holding the ordinary
// SearchBar, so the results tray is the same one chapter pages use; on a page
// with its own box (data-search-here) it takes the reader to that box, so a
// page never shows two.
//
// Escape closes the results tray first (searchbar.js does that), then the
// strip. The strip is in the page flow, so it scrolls with the header rather
// than floating over the text. Other scripts can open it with the
// "lit:search-open" event (the "/" keyboard shortcut does).

for (const here of document.querySelectorAll("[data-search-here]")) {
  here.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const box = document.getElementById("site-search-input");
    if (!box || box.offsetParent === null) return; // no box showing: /search it is
    event.preventDefault();
    box.scrollIntoView({ block: "nearest" });
    box.focus({ preventScroll: true });
    box.select();
  });
}

const strip = document.getElementById("headerSearch");
const toggles = Array.from(document.querySelectorAll("[data-search-toggle]"));

if (strip && toggles.length) {
  const searchbar = strip.querySelector("[data-searchbar]");
  const input = strip.querySelector("input[type='search']");
  const closeBtn = strip.querySelector(".site-header__search-close");
  let opener = null;

  for (const toggle of toggles) {
    toggle.setAttribute("role", "button");
    toggle.setAttribute("aria-controls", "headerSearch");
    toggle.setAttribute("aria-expanded", "false");
  }

  const isOpen = () => !strip.hidden;

  function open(from) {
    opener =
      from ??
      toggles.find((t) => t.offsetParent !== null) ??
      document.querySelector(".site-header__menu-toggle");
    strip.hidden = false;
    for (const toggle of toggles) toggle.setAttribute("aria-expanded", "true");
    input?.focus({ preventScroll: true });
    strip.scrollIntoView({ block: "nearest" });
  }

  function close() {
    strip.hidden = true;
    if (searchbar) searchbar.dataset.open = "false";
    for (const toggle of toggles) toggle.setAttribute("aria-expanded", "false");
    opener?.focus({ preventScroll: true });
    opener = null;
  }

  for (const toggle of toggles) {
    toggle.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // The phone menu's Search item (under 360px). The menu closes itself a
      // frame after any link click, handing focus back and lifting the inert
      // it put on the page, so open once that has happened, and give focus
      // back to the menu button later, since this item goes with the menu.
      if (toggle.closest(".menu-overlay")) {
        const menuButton = document.querySelector(".site-header__menu-toggle");
        requestAnimationFrame(() => requestAnimationFrame(() => open(menuButton)));
        return;
      }
      isOpen() ? close() : open(toggle);
    });
    // A link doesn't answer Space the way a button does.
    toggle.addEventListener("keydown", (event) => {
      if (event.key === " ") {
        event.preventDefault();
        toggle.click();
      }
    });
  }

  closeBtn?.addEventListener("click", close);

  // Capture, so this sees the tray's state before searchbar.js closes it.
  strip.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      if (searchbar?.dataset.open === "true") return;
      close();
    },
    true,
  );

  document.addEventListener("lit:search-open", () => {
    isOpen() ? input?.focus({ preventScroll: true }) : open();
  });
}
