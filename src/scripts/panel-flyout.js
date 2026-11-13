// src/scripts/panel-flyout.js
//
// The one flyout the reader tools' panels share (STUDY-DESK-FIXES.md, E39): the
// verse menu's and the selection panel's "Copy text ▸" and "Share ▸" rows, and
// the Study Desk's "Bookmark ▸" and "Print ▸" (desk/actions.js). It was the
// desk's own until the Copy and Share rows needed it for every reader, so it
// lives here and desk code imports it; shared code never imports desk code.
//
// A row that opens `items` in a flyout beside it: on hover without taking
// focus, on a click, Enter or the right arrow with focus moved in; Escape or
// the left arrow closes it and gives focus back. The flyout is a sibling of the
// panel's rows and fixed to the window, so the panel's own scrolling never
// clips it. Styles are the .lit-flyout rules in global.css.
//
// A click on a flyout that hover opened is the click the reader came to make,
// so it moves focus in rather than shutting it (Audit 3, NB3-1); only a click
// on one a click or a key opened toggles it shut. Being fixed, the flyout can't
// follow its row, so a scroll or a press anywhere else (the panel's grip
// included) closes it (NB3-12). It never hides with focus inside it: focus goes
// back to the row first.
//
// Two shapes:
//   - a plain row (`flyoutRow(name, items)`): one button, the name and a
//     chevron, whose press opens the flyout;
//   - a split row (`main` given): `main` is the row's own button and keeps its
//     own action on a press; a chevron button beside it ("More ways to copy")
//     opens the flyout. Hover over either part opens it.
//
// A finger's chip layout never gets a flyout (callers build flat chips).

/**
 * @param {string} name the row's name; names the flyout's menu
 * @param {HTMLElement[]} items what the flyout holds (buttons, or rows of them)
 * @param {{ main?: HTMLButtonElement | null, moreLabel?: string,
 *   pointerFocus?: boolean }} [options] `main` makes a split row; `moreLabel`
 *   names its chevron button. `pointerFocus: false` keeps a mouse click from
 *   moving focus into the flyout (the selection panel never takes focus);
 *   the keyboard always does. `onClose` runs each time the flyout shuts (the
 *   Share row puts "Share image…" back, E111).
 * @returns {HTMLElement} the row. `row.closeFlyout()` shuts the flyout.
 */
export function flyoutRow(name, items, { main = null, moreLabel = `More: ${name}`, pointerFocus = true, onClose = null } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "lit-panel__row lit-flyout";

  let trigger;
  let anchor;
  if (main) {
    anchor = document.createElement("div");
    anchor.className = "lit-flyout__split";
    trigger = button("");
    trigger.classList.add("lit-flyout__more");
    trigger.setAttribute("aria-label", moreLabel);
    anchor.append(main, trigger);
    wrap.append(anchor);
  } else {
    trigger = button(name);
    trigger.classList.add("lit-flyout__trigger");
    anchor = trigger;
    wrap.append(trigger);
  }
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");

  const fly = document.createElement("div");
  fly.className = "lit-flyout__menu";
  fly.setAttribute("role", "menu");
  fly.setAttribute("aria-label", name);
  fly.hidden = true;
  fly.append(...items);
  for (const item of fly.querySelectorAll("button")) item.setAttribute("role", "menuitem");
  // A menu holds menu items only (NB3-11): a row of buttons steps aside, and a
  // line of words (the Bookmark flyout's "resting here") describes the menu
  // instead of sitting in it.
  const described = [];
  for (const child of fly.children) {
    if (child.matches("button")) continue;
    child.setAttribute("role", "none");
    if (child.querySelector("button")) continue;
    child.id ||= `lit-flyout-note-${++noteIds}`;
    child.setAttribute("aria-hidden", "true");
    described.push(child.id);
  }
  if (described.length) fly.setAttribute("aria-describedby", described.join(" "));
  wrap.append(fly);

  let closing = 0;
  let openedBy = null; // "hover", "click" or "key"
  let watching = null; // the scroll and press listeners while it is open
  let hovered = false; // the pointer is over the row or its flyout
  // The arrow keys, and opening it, pass over a disabled item (DK3-7; BVJ,
  // 2026-11-07: the rule for every menu, src/scripts/CLAUDE.md). A busy row
  // that keeps focus (aria-disabled while it works) is passed over too.
  const live = () => [...fly.querySelectorAll("button:not([hidden]):not(:disabled)")].filter((b) => b.getAttribute("aria-disabled") !== "true");
  const focusFirst = () => live()[0]?.focus({ preventScroll: true });
  const open = (focusIn, by) => {
    window.clearTimeout(closing);
    if (!fly.hidden) return focusIn && focusFirst();
    openedBy = by;
    fly.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const box = anchor.getBoundingClientRect();
    const room = fly.getBoundingClientRect();
    const right = box.right + 6;
    const left = right + room.width <= window.innerWidth - 8 ? right : Math.max(8, box.left - room.width - 6);
    fly.style.left = `${left}px`;
    fly.style.top = `${Math.max(8, Math.min(box.top, window.innerHeight - room.height - 8))}px`;
    watching = new AbortController();
    const away = (e) => {
      if (!wrap.contains(e.target)) close(false);
    };
    document.addEventListener("scroll", away, { capture: true, passive: true, signal: watching.signal });
    document.addEventListener("pointerdown", away, { capture: true, signal: watching.signal });
    if (focusIn) focusFirst();
  };
  const close = (refocus) => {
    window.clearTimeout(closing);
    if (fly.hidden) return;
    watching?.abort();
    watching = null;
    // Focus leaves before the menu hides, or it would fall to the page.
    if (refocus || fly.contains(document.activeElement)) (main ?? trigger).focus({ preventScroll: true });
    fly.hidden = true;
    openedBy = null;
    trigger.setAttribute("aria-expanded", "false");
    onClose?.();
  };
  const later = () => {
    window.clearTimeout(closing);
    // A flyout holding focus stays until focus leaves it, not the pointer.
    if (fly.contains(document.activeElement)) return;
    closing = window.setTimeout(() => {
      // Focus can come back (a step inside it swapped its buttons), and a
      // pointer still over it hasn't left (E111).
      if (hovered || fly.contains(document.activeElement)) return;
      close(false);
    }, 220);
  };
  const hover = (e) => {
    if (e.pointerType !== "touch") open(false, "hover");
  };

  // A click on the chevron (or on a plain row) opens it; one that came from
  // the keyboard (detail 0) always moves focus in. On a flyout hover opened,
  // the click takes it instead of shutting it.
  trigger.addEventListener("click", (e) => {
    const focusIn = pointerFocus || e.detail === 0;
    if (fly.hidden) return open(focusIn, "click");
    if (openedBy === "hover") {
      openedBy = "click";
      return open(focusIn, "click");
    }
    // A mouse that may not move focus in (`pointerFocus: false`) doesn't pull
    // it to the trigger on the way out either.
    close(focusIn);
  });
  fly.addEventListener("focusout", (e) => {
    if (!wrap.contains(/** @type {Node | null} */ (e.relatedTarget))) later();
  });
  anchor.addEventListener("pointerenter", hover);
  wrap.addEventListener("pointerleave", () => {
    hovered = false;
    later();
  });
  wrap.addEventListener("pointerenter", () => {
    hovered = true;
    window.clearTimeout(closing);
  });
  for (const opener of main ? [main, trigger] : [trigger]) {
    opener.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        open(true, "key");
      }
    });
  }
  fly.addEventListener("keydown", (e) => {
    const buttons = live();
    const at = buttons.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      // Nothing in the list has focus (a note it holds does): down is the first, up the last.
      const to = at < 0 ? (down ? 0 : buttons.length - 1) : (at + (down ? 1 : buttons.length - 1)) % buttons.length;
      buttons[to]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      buttons[e.key === "Home" ? 0 : buttons.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // Tabbing on leaves the flyout rather than trapping the panel's cycle.
      close(false);
    }
  });

  wrap.closeFlyout = () => close(false);
  return wrap;
}

let noteIds = 0;

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
