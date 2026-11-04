// Keep a keyboard reader's place when a pane redraws itself (FA2-p; DK-3, DK-4).
//
// `replaceChildren` deletes the button that was just pressed, and the browser
// drops focus to the page body. A control that should survive a redraw carries
// `data-focus-key`; the redraw goes through `redraw`, which finds the same key
// in the new content and focuses it, or else the `fallback` (a selector, or a
// function of the container).

/**
 * Replace a container's children and, when focus was inside it, put focus back
 * on the new control with the same `data-focus-key` (else `fallback`).
 *
 * @param {Element} container
 * @param {Node[]} nodes the new children
 * @param {object} [options]
 * @param {string | ((container: Element) => Element | null)} [options.fallback]
 *   where focus goes when its control is gone
 * @param {boolean} [options.force] move focus even when it wasn't inside (a
 *   pane switching views on the reader's own click, whose button is gone)
 * @returns {Element | null} what took focus
 */
export function redraw(container, nodes, { fallback = null, force = false } = {}) {
  const active = document.activeElement;
  const had = active && container.contains(active);
  const key = had ? active.dataset?.focusKey ?? null : null;
  container.replaceChildren(...nodes);
  if (!had && !force) return null;
  let target = key ? container.querySelector(`[data-focus-key="${CSS.escape(key)}"]`) : null;
  if (!target && fallback) target = typeof fallback === "function" ? fallback(container) : container.querySelector(fallback);
  if (target && !target.hasAttribute("tabindex") && !isFocusable(target)) target.setAttribute("tabindex", "-1");
  target?.focus?.({ preventScroll: false });
  return target ?? null;
}

/** Whether an element takes focus without a tabindex. */
function isFocusable(node) {
  return /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(node.tagName);
}

/**
 * A button that is busy but must stay focused: `aria-disabled` rather than
 * `disabled` (a focused button that becomes disabled loses focus in some
 * browsers; NB-16). Returns a function that undoes it. Clicks while busy are
 * the caller's to ignore: check `isBusy(button)` first.
 */
export function busy(button) {
  button.setAttribute("aria-disabled", "true");
  return () => button.removeAttribute("aria-disabled");
}

/** Whether `busy` is in force on this button. */
export function isBusy(button) {
  return button.getAttribute("aria-disabled") === "true";
}
