// src/scripts/glossary-line.js
//
// The glossary's line under the header (GlossaryLine.astro; GL-04 to GL-06,
// GL-09): "Learn / Glossary ▾ / trust". It names the entry in view as the
// reader scrolls, steps from entry to entry with ‹ ›, and holds the order
// switch in the "Glossary ▾" list, which reorders the page's entries by the
// LIT word or the traditional word. Also the page's "Back to top". All of it
// is progressive enhancement: without this file the line names the page and
// the list reaches every entry.
//
// Motion: nothing here animates. A step is a jump (scrollIntoView with the
// browser's own behavior), which the reader's reduced-motion setting leaves
// alone, since the page never asks for smooth scrolling.

const line = document.querySelector("[data-gloss-line]");
const wrap = document.querySelector(".glossary-entries .entries-wrap");

if (line && wrap) {
  const menu = line.querySelector("[data-gloss-menu]");
  const button = menu.querySelector("summary");
  const names = JSON.parse(line.querySelector("[data-gloss-names]")?.textContent || "{}");
  const current = line.querySelector("[data-gloss-current]");
  const sep = line.querySelector("[data-gloss-sep]");
  const turn = line.querySelector("[data-gloss-turn]");
  const prev = turn.querySelector('[data-gloss-step="-1"]');
  const next = turn.querySelector('[data-gloss-step="1"]');
  const orderBox = line.querySelector("[data-gloss-order]");
  const choices = Array.from(orderBox.querySelectorAll("[data-order]"));
  const lists = Array.from(line.querySelectorAll("[data-gloss-list]"));

  const entries = () => Array.from(wrap.querySelectorAll(":scope > .entry"));

  // ---- the order switch ----
  const setOrder = (order) => {
    for (const c of choices) c.setAttribute("aria-pressed", String(c.dataset.order === order));
    for (const l of lists) l.hidden = l.dataset.glossList !== order;
    // data-sort-* hold the labels without a leading article (glossarySortKey),
    // so a plain compare files "The Adversary" under A.
    const key = order === "traditional" ? "sortTraditional" : "sortLit";
    entries()
      .sort((a, b) => a.dataset[key].localeCompare(b.dataset[key]))
      .forEach((e) => wrap.appendChild(e));
    window.dispatchEvent(new CustomEvent("glossary-reordered"));
    update();
  };
  for (const c of choices) c.addEventListener("click", () => setOrder(c.dataset.order));

  // ---- the entry in view ----
  let shown = -1;
  const inView = () => {
    // The last entry whose heading has reached the upper third of the window
    // (under the line); none above the first.
    const edge = window.innerHeight * 0.33;
    let at = -1;
    entries().forEach((e, i) => {
      const h = e.querySelector(".entry-title");
      if (h && h.getBoundingClientRect().top <= edge) at = i;
    });
    return at;
  };

  const update = () => {
    const list = entries();
    shown = inView();
    const id = shown >= 0 ? list[shown]?.dataset.entry : null;
    const name = id ? names[id] || "" : "";
    current.textContent = name;
    current.hidden = !name;
    sep.hidden = !name;
    for (const a of menu.querySelectorAll("[data-gloss-target]")) {
      if (a.dataset.glossTarget === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    prev.setAttribute("aria-disabled", String(shown <= 0));
    next.setAttribute("aria-disabled", String(shown >= list.length - 1));
  };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  // ---- ‹ › ----
  const goTo = (entry) => {
    const heading = entry.querySelector(".entry-title");
    heading.scrollIntoView({ block: "start" });
    history.replaceState(null, "", `#${heading.id}`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    update();
  };
  for (const b of [prev, next]) {
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      const list = entries();
      const to = shown + Number(b.dataset.glossStep);
      if (list[to]) goTo(list[to]);
    });
  }

  // ---- the list: open and close ----
  const sync = () => button.setAttribute("aria-expanded", String(menu.open));
  menu.addEventListener("toggle", sync);
  sync();
  const close = (focus) => {
    if (!menu.open) return;
    menu.open = false;
    if (focus) button.focus();
  };
  document.addEventListener("pointerdown", (e) => {
    if (menu.open && !menu.contains(e.target)) close(false);
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    }
  });
  menu.addEventListener("focusout", (e) => {
    if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) close(false);
  });
  // A chosen entry closes the list; the link itself does the jump.
  menu.addEventListener("click", (e) => {
    if (e.target.closest("[data-gloss-target]")) close(false);
  });

  // ---- turn the enhancements on ----
  orderBox.hidden = false;
  turn.hidden = false;
  update();

  // ---- back to top ----
  const top = document.querySelector("[data-gloss-top]");
  if (top) {
    const first = () => entries()[0]?.getBoundingClientRect().top ?? 0;
    const sees = () => top.classList.toggle("is-visible", first() < 0);
    window.addEventListener("scroll", sees, { passive: true });
    sees();
    top.addEventListener("click", () => {
      window.scrollTo({ top: 0 });
      history.replaceState(null, "", location.pathname + location.search);
      // The button hides at the top, so focus goes to the page's title rather
      // than staying on a control no one can see.
      const title = document.getElementById("glossary-title");
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    });
  }
}
