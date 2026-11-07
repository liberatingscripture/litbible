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
 *   the keyboard always does.
 * @returns {HTMLElement} the row. `row.closeFlyout()` shuts the flyout.
 */
export function flyoutRow(name, items, { main = null, moreLabel = `More: ${name}`, pointerFocus = true } = {}) {
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
  wrap.append(fly);

  let closing = 0;
  const open = (focusIn) => {
    window.clearTimeout(closing);
    if (!fly.hidden) return focusIn && fly.querySelector("button")?.focus();
    fly.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const box = anchor.getBoundingClientRect();
    const room = fly.getBoundingClientRect();
    const right = box.right + 6;
    const left = right + room.width <= window.innerWidth - 8 ? right : Math.max(8, box.left - room.width - 6);
    fly.style.left = `${left}px`;
    fly.style.top = `${Math.max(8, Math.min(box.top, window.innerHeight - room.height - 8))}px`;
    if (focusIn) fly.querySelector("button")?.focus();
  };
  const close = (refocus) => {
    window.clearTimeout(closing);
    if (fly.hidden) return;
    fly.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (refocus) (main ?? trigger).focus();
  };
  const later = () => {
    window.clearTimeout(closing);
    closing = window.setTimeout(() => close(false), 220);
  };
  const hover = (e) => {
    if (e.pointerType !== "touch") open(false);
  };

  // A click on the chevron (or on a plain row) opens it; one that came from
  // the keyboard (detail 0) always moves focus in.
  trigger.addEventListener("click", (e) => {
    if (!fly.hidden) return close(true);
    open(pointerFocus || e.detail === 0);
  });
  anchor.addEventListener("pointerenter", hover);
  wrap.addEventListener("pointerleave", later);
  wrap.addEventListener("pointerenter", () => window.clearTimeout(closing));
  for (const opener of main ? [main, trigger] : [trigger]) {
    opener.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        open(true);
      }
    });
  }
  fly.addEventListener("keydown", (e) => {
    const buttons = [...fly.querySelectorAll("button:not([hidden])")];
    const at = buttons.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(at + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    } else if (e.key === "Tab") {
      // Tabbing on leaves the flyout rather than trapping the panel's cycle.
      close(false);
    }
  });

  wrap.closeFlyout = () => close(false);
  return wrap;
}

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lit-panel__btn";
  b.textContent = label;
  return b;
}
