// Puts every radio button back after the print dialog closes (STUDY-DESK-FIXES.md,
// E216; BVJ, 2026-11-21).
//
// Microsoft Edge clears the `checked` state of every native radio on the page
// about 100 ms after the print dialog closes, whether the reader printed or
// cancelled. At `beforeprint`, `afterprint` and the next frame the radios are
// right; then they are all off, with no event, no script and no new element
// behind it. The Sheets toolbar's Version and Paper choices lost their dots
// that way (the paper still said "Leader copy"), and so did the Display tray's
// face, theme, size and spacing, on any page. Chrome does not do it.
//
// There is nothing to hook, so this holds each page's checked radios at
// `beforeprint` and sets them back as `afterprint` comes and for a few seconds
// after, by timer. A radio goes back only while nothing in its group is
// checked, so a choice the reader makes in that time is never overwritten, and
// a radio whose view was redrawn meanwhile (gone from the page) is let go.
// Programmatic `checked` fires no event, so no `change` handler runs and
// nothing is written. Loaded by SiteHeader.astro, so every page has it.

const FOR_MS = 3000;
const EVERY_MS = 100;

/** The radios checked when the print dialog opened. */
let held = [];
let timer = 0;

const radios = () => [...document.querySelectorAll('input[type="radio"]:checked')];

/** Whether another radio in this one's group (same name, same form) is checked. */
function groupChecked(input) {
  if (!input.name) return input.checked;
  return radios().some((other) => other.name === input.name && other.form === input.form);
}

function restore() {
  held = held.filter((input) => input.isConnected);
  for (const input of held) {
    if (!input.checked && !groupChecked(input)) input.checked = true;
  }
}

function stopRestoring() {
  clearInterval(timer);
  timer = 0;
}

function onBeforePrint() {
  stopRestoring();
  held = radios();
}

function onAfterPrint() {
  stopRestoring();
  restore();
  let waited = 0;
  timer = setInterval(() => {
    waited += EVERY_MS;
    restore();
    if (waited >= FOR_MS) stopRestoring();
  }, EVERY_MS);
}

window.addEventListener("beforeprint", onBeforePrint);
window.addEventListener("afterprint", onAfterPrint);
