// A menu's unavailable lines, read aloud (Audit 3 follow-up to DK3-7).
//
// The arrow keys pass over a disabled menu item (DK3-7), so a keyboard or
// screen-reader reader never lands on one, and the reason drawn beside it (for
// example "Needs a larger window") would never be heard. This gives the menu
// itself a description a screen reader reads on entering it: one short
// sentence per disabled line that carries a reason, "Add pane is unavailable:
// needs a larger window." It is a visually hidden element (`sr-only`) beside
// the menu, named by the menu's `aria-describedby`. Nothing changes on screen.
//
// A disabled line with no reason (a button busy for a moment) adds nothing, and
// a menu with no such line carries no description at all.

/**
 * The sentences for a menu's disabled lines, in order.
 *
 * @param {{ label: string, why: string }[]} lines
 * @returns {string[]}
 */
export function unavailableSentences(lines) {
  const out = [];
  for (const { label, why } of lines) {
    const name = String(label ?? "").trim();
    const reason = String(why ?? "").trim().replace(/[.!?…]+$/, "");
    if (!name || !reason) continue;
    out.push(`${name} is unavailable: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`);
  }
  return out;
}

/**
 * Describe `menu` by its disabled lines. A line counts when it is a `button`
 * or `a` under the menu with `aria-disabled="true"` (or `disabled`) and a
 * non-empty `.desk-title__hint` inside it; its name is the text of its
 * `.desk-title__label`. Call `refresh()` after any line's state or reason
 * changes while the menu is open, and `destroy()` when the menu goes away.
 *
 * @param {Element} menu the `role="menu"` element
 * @param {{ id: string, place?: (note: HTMLElement) => void }} options
 *   `id` names the hidden element; `place` puts it in the page (default: right
 *   after the menu, as a sibling, since a menu's own children are its items and
 *   some are cleared and redrawn)
 */
export function describeUnavailable(menu, { id, place } = {}) {
  const doc = menu.ownerDocument;
  const note = doc.createElement("span");
  note.className = "sr-only";
  note.id = id;
  (place ?? ((n) => menu.after(n)))(note);

  function refresh() {
    const lines = [];
    for (const b of menu.querySelectorAll('[aria-disabled="true"], :disabled')) {
      // A nested menu (a flyout inside this one's markup) describes itself.
      if (b.closest('[role="menu"]') !== menu) continue;
      const hint = b.querySelector(".desk-title__hint");
      if (!hint) continue;
      lines.push({ label: b.querySelector(".desk-title__label")?.textContent, why: hint.textContent });
    }
    const text = unavailableSentences(lines).join(" ");
    note.textContent = text;
    if (text) menu.setAttribute("aria-describedby", id);
    else menu.removeAttribute("aria-describedby");
  }

  function destroy() {
    note.remove();
    menu.removeAttribute("aria-describedby");
  }

  refresh();
  return { refresh, destroy, note };
}
