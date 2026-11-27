// src/scripts/link-button.js
//
// A link that opens something on the page once JavaScript is here, and is
// the plain link it was without it (SITE-FEATHERBOA.md, "The phone,"
// "Without JavaScript"): the phone bar's Search and Menu, which go to
// /search and to the footer's links until a script takes them over.

/**
 * Makes `link` answer as a button does: named a button, saying what it
 * controls and whether that is open, and pressed by Space as well as Enter.
 *
 * @param {HTMLAnchorElement} link
 * @param {string} controls the id of what it opens
 * @returns {HTMLAnchorElement} the link
 */
export function asButton(link, controls) {
  link.setAttribute("role", "button");
  link.setAttribute("aria-controls", controls);
  link.setAttribute("aria-expanded", "false");
  link.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    link.click();
  });
  return link;
}
