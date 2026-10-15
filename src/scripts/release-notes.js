// /release-notes: filter by book and kind of change, and open the month that
// holds a linked entry. Progressive enhancement. Without JS the filters stay
// hidden, every change is on the page, and the months fold natively.
//
// The filters live in the query string (?book=romans&kind=wording) so a
// filtered view can be shared, and never touch the hash, which names an entry.

const form = document.getElementById("rn-filters");

if (form) {
  const bookSelect = form.querySelector("#rn-book");
  const kindSelect = form.querySelector("#rn-kind");
  const countEl = form.querySelector("#rn-count");
  const months = [...document.querySelectorAll(".rn-month")];
  const total = Number(countEl.dataset.total);
  const plural = (n) => `${n} change${n === 1 ? "" : "s"}`;
  let wasFiltered = false;

  function apply() {
    const book = bookSelect.value;
    const kind = kindSelect.value;
    const filtered = Boolean(book || kind);
    let shown = 0;

    for (const month of months) {
      let inMonth = 0;
      for (const entry of month.querySelectorAll(".rn-entry")) {
        let inEntry = 0;
        for (const change of entry.querySelectorAll(".rn-change")) {
          const match =
            (!book || change.dataset.book === book) && (!kind || change.dataset.kind === kind);
          change.hidden = !match;
          if (match) inEntry++;
        }
        entry.hidden = inEntry === 0;
        inMonth += inEntry;
      }
      month.hidden = inMonth === 0;
      const count = month.querySelector(".rn-month__count");
      count.textContent = filtered
        ? `${inMonth} of ${plural(Number(count.dataset.total))}`
        : plural(Number(count.dataset.total));
      // A filter opens every month it matches in; clearing it puts the
      // months back as the page loaded, but leaves them alone otherwise, so
      // a month a reader opened by hand stays open.
      if (filtered) month.open = inMonth > 0;
      else if (wasFiltered) month.open = month.hasAttribute("data-default-open");
      shown += inMonth;
    }

    countEl.textContent = !filtered
      ? plural(total)
      : shown
        ? `Showing ${shown} of ${plural(total)}`
        : "No changes match these filters.";
    wasFiltered = filtered;
  }

  function syncUrl() {
    const url = new URL(location.href);
    for (const [key, select] of [["book", bookSelect], ["kind", kindSelect]]) {
      if (select.value) url.searchParams.set(key, select.value);
      else url.searchParams.delete(key);
    }
    history.replaceState(history.state, "", url);
  }

  // Open the month holding the entry the hash names, and bring it into view.
  // A filter that hides it is cleared first, since the link asked for it.
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target || !target.closest(".rn-month")) return;
    if (target.closest("[hidden]")) {
      bookSelect.value = "";
      kindSelect.value = "";
      apply();
      syncUrl();
    }
    const month = target.closest("details");
    if (month && !month.open) month.open = true;
    target.scrollIntoView({ block: "start" });
  }

  const params = new URLSearchParams(location.search);
  for (const [key, select] of [["book", bookSelect], ["kind", kindSelect]]) {
    const value = params.get(key);
    if (value && [...select.options].some((o) => o.value === value)) select.value = value;
  }

  form.hidden = false;
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("change", () => {
    apply();
    syncUrl();
  });
  window.addEventListener("hashchange", revealHash);

  apply();
  revealHash();
}
