// src/scripts/glossary-entry-links.js
//
// "Copy link" beside each /glossary entry's pair (audit Q4; Featherboa's
// GL-10, where the button shows its words, since copy is not one of the
// icons that may stand alone). Without JS it is an ordinary link to the
// entry's anchor. With JS a click copies the entry's full address instead,
// shows a check for a moment, and says so to a screen reader. Where the
// clipboard is unavailable the link is left to navigate as usual, which
// still puts the address in the address bar.

const links = document.querySelectorAll("a[data-entry-link]");

if (links.length && navigator.clipboard?.writeText) {
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  document.body.append(status);

  const timers = new WeakMap();

  for (const link of links) {
    // The markup's name ("Copy link to the Faith entry") starts with the
    // button's own words, and the words need no tooltip.
    link.addEventListener("click", async (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const id = link.hash.slice(1);
      const url = `${location.origin}${location.pathname}#${id}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        location.hash = id;
        return;
      }

      link.dataset.copied = "";
      status.textContent = "";
      // A fresh message each time, so a second copy is announced too.
      requestAnimationFrame(() => {
        status.textContent = `Link to the ${link.dataset.term} entry copied`;
      });
      clearTimeout(timers.get(link));
      timers.set(
        link,
        setTimeout(() => delete link.dataset.copied, 2000),
      );
    });
  }
}
