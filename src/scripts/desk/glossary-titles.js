// src/scripts/desk/glossary-titles.js
//
// With the desk on, the glossary is a reading column (pages/glossary.css),
// narrower than the 780px below which its headings take the phone layout,
// and at first every heading with several LIT options ("alignment /
// justice") took it: each option on a line of its own, which split short
// headings that fit perfectly well (BVJ, 2026-10-09). Now each heading takes
// the least break it needs, measured on the page:
//   1. the options stay on the heading's line when they fit there;
//   2. otherwise they start a line of their own, together (a break before
//      the first option), so a slash never ends or starts a line;
//   3. only when even a line of their own can't hold them does each option
//      take its own line (`desk-split`, the phone layout).
// Measured again whenever the column or the type can change: the window, the
// Display tray's text size, spacing or font, and the web fonts arriving. The
// ink underlines are redrawn after each pass (glossary.astro listens for
// glossary-reordered).

/** Lay out every multi-option heading; returns nothing. Glossary only. */
export function fitGlossaryTitles() {
  const titles = Array.from(document.querySelectorAll(".glossary-entries .entry-title")).filter((t) =>
    t.querySelector(".lit-sep"),
  );
  if (!titles.length) return;

  // Whether the options (and the slashes between them) share one line.
  const together = (title) => {
    const tops = Array.from(title.querySelectorAll(".lit-part, .lit-sep")).map((el) =>
      Math.round(el.getBoundingClientRect().top),
    );
    return Math.max(...tops) - Math.min(...tops) < 2;
  };

  function fit() {
    for (const title of titles) {
      title.classList.remove("desk-split");
      title.querySelector(":scope > .desk-gloss-break")?.remove();
      if (together(title)) continue;
      const brk = document.createElement("span");
      brk.className = "desk-gloss-break";
      brk.setAttribute("aria-hidden", "true");
      title.querySelector(":scope > .lit-part")?.before(brk);
      if (together(title)) continue;
      brk.remove();
      title.classList.add("desk-split");
    }
    window.dispatchEvent(new Event("glossary-reordered"));
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  };
  fit();
  window.addEventListener("resize", schedule);
  document.fonts?.ready.then(schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-size", "data-leading", "data-font"],
  });
}
