// The markup of /search (search.astro) with SearchBar's field and filters, as
// much as search.js reads, for tests that drive the page in a browser DOM.

export const SEARCH_PAGE_HTML = `
  <div data-searchbar>
    <div class="searchbar__input-wrap">
      <input id="site-search-input" class="searchbar__input" type="search" />
      <span class="searchbar__count" data-search-count></span>
    </div>
    <button type="button" data-build-search hidden>Build a search…</button>
    <div class="searchbar__filters">
      <select id="searchbar-book" class="searchbar__book"><option value="">All books</option></select>
      <select id="searchbar-mode" class="searchbar__mode">
        <option value="all">All results</option><option value="subject">Chapters about it</option>
        <option value="keyword">Scripture</option><option value="glossary">Glossary</option>
        <option value="article">Articles</option><option value="intro">Introductions</option>
      </select>
    </div>
  </div>
  <section class="search-page">
    <div class="search-bar-row">
      <div class="kit-tabs search-tabs" id="search-tabs" role="tablist"></div>
      <div class="search-tools" id="search-tools">
        <select id="search-sort"><option value="relevance">Relevance</option><option value="order">Bible order</option></select>
      </div>
    </div>
    <p class="search-status" id="search-tabs-reason" hidden></p>
    <p class="search-status" id="search-status"></p>
    <div class="search-ref" id="search-ref" data-search-ref hidden></div>
    ${["notebook", "glossary", "subject", "intros", "articles"]
      .map((g) => `<div class="group" id="group-${g}" hidden><h2 class="group-title"></h2><ol id="results-${g}"></ol></div>`)
      .join("")}
    <div class="group" id="group-keyword" hidden>
      <h2 class="group-title"></h2><div id="search-lines"></div><ol id="results-keyword"></ol>
    </div>
    <div class="group" id="group-greek" hidden>
      <h2 class="group-title">Greek</h2>
      <div id="greek-lemmas" hidden></div>
      <label id="greek-exact" hidden><input type="checkbox" id="greek-exact-input" /></label>
      <ol id="results-greek"></ol>
      <div id="greek-help" hidden></div>
    </div>
    <div class="search-pickbar" id="search-pickbar" hidden></div>
    <nav id="pager" class="search-pager" hidden></nav>
  </section>`;
