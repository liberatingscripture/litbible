// The kit's browser audit (src/styles/CLAUDE.md, "The kit"). Not a Node
// script: paste the whole file into a page's console (or a javascript tool)
// on any page of a running site, or on the dev server load it with
//
//   (0, eval)((await import("/scripts/kit-audit.js?raw")).default)
//
// then call
//
//   await kitAudit.pages(["/", "/john-3", "/search?q=love"], { width: 1440, theme: "dark" })
//   await kitAudit.opened("/john-3", [["[data-font-toggle]", ""], [".site-nav__place", "Learn"]])
//
// Each page loads in a same-origin iframe of the given width, so one tab
// covers many pages, widths, and themes. A page whose own script reloads
// itself (a dev server's) loses the harness, so run it from a plain file
// such as /robots.txt. pages() lists, for each page, its controls' problems
// and its filled buttons (a view uses filled once). opened() clicks each
// [selector, words] in a fresh copy of the page and lists only what the
// opened menu, tray, or popover added. A problem is a control that takes no
// kit level or two, a face other than Atkinson Hyperlegible Next, a weight
// under 600, corners other than 6px, a shadow, a fade, capitals, an icon
// alone that isn't one of the five (or has no name), a typed glyph, or a
// link or label drawn as a button (a fill or an edge at rest) outside the
// kit. theme "dark" or "light" is stored in this origin's lit-theme and
// cleared again afterwards; the Study preview follows lit-desk-preview,
// which every tab of the origin shares, so this script leaves it alone.
(() => {
  const LEVELS = {
    filled: ".kit-btn--filled", tinted: ".kit-btn--tinted", plain: ".kit-btn--plain",
    danger: ".kit-btn--danger", row: ".kit-row", "row-on": ".kit-row--on", tab: ".kit-tab",
    "tab-on": ".kit-tab--on", inline: ".kit-inline", field: ".kit-field", dot: ".kit-dot",
  };
  const STANDALONE = ["search", "close", "back", "forward", "more"];
  const CONTROLS = [
    "button", "[role=button]", "[role=tab]", "[role=switch]", "[role=menuitem]", "[role=menuitemradio]",
    "[role=menuitemcheckbox]", "[role=option]", "summary", "input:not([type=hidden])", "select", "textarea",
    "a[class*=btn]", "a[class*=button]", "a[class*=cta]",
  ].join(",");
  // Marks in the text (verse numbers), a form's trap for robots, and /apps,
  // which keeps its own look, are not the kit's.
  const SKIP = ".vn, [class*=honeypot], [aria-hidden=true], [aria-hidden=true] *";
  const APPS = "main .apps";
  // The kit's own underline (tab on) and ring (a chosen dot) are shadows.
  const KIT_SHADOW = /inset 0px -2px 0px|0px -2px 0px 0px inset|0px 0px 0px 2px/;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function audit(win) {
    const doc = win.document;
    const rules = [];
    const walk = (list) => { for (const r of list) { if (r.selectorText) rules.push(r.selectorText); if (r.cssRules) walk(r.cssRules); } };
    for (const s of doc.styleSheets) { try { walk(s.cssRules); } catch {} }
    // Each level's list, as the browser has it: the :is(...) its rules open with.
    const lists = {};
    for (const [level, anchor] of Object.entries(LEVELS)) {
      const open = new RegExp(`:is\\(${anchor.replace(/[.-]/g, "\\$&")}(?=[,)])`);
      const text = rules.find((t) => open.test(t));
      if (!text) continue;
      const start = text.search(open);
      let depth = 0, end = start + 3;
      for (; end < text.length; end++) { if (text[end] === "(") depth++; else if (text[end] === ")" && --depth === 0) break; }
      lists[level] = text.slice(start, end + 1);
    }
    const levelsOf = (el) => Object.entries(lists).filter(([, sel]) => { try { return el.matches(sel); } catch { return false; } }).map(([l]) => l);
    const shown = (el) => el.getClientRects().length > 0 && win.getComputedStyle(el).visibility !== "hidden";
    const name = (el) => { const c = [...el.classList].slice(0, 3).join("."); return `${el.tagName.toLowerCase()}${c ? "." + c : ""}${el.id ? "#" + el.id : ""}`; };
    const words = (el) => (el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const clear = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
    const problems = [];
    const filled = [];
    let controls = 0;
    for (const el of doc.querySelectorAll(CONTROLS)) {
      if (!shown(el) || el.closest(APPS) || el.matches(SKIP)) continue;
      controls++;
      const cs = win.getComputedStyle(el);
      const levels = levelsOf(el);
      const base = levels.filter((l) => !l.endsWith("-on"));
      if (base.includes("filled")) filled.push(`${name(el)} "${words(el)}"`);
      const box = !["checkbox", "radio", "range", "color", "file"].includes(el.getAttribute("type"));
      const own = el.classList.contains("kit-switch") || el.classList.contains("kit-icon") || el.classList.contains("kit-check");
      const inline = base.includes("inline");
      const round = base.includes("dot") || el.classList.contains("kit-switch") || el.getAttribute("role") === "switch";
      const face = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const p = [];
      if (box && !base.length && !own) p.push("no level");
      if (base.length > 1) p.push(`takes ${base.join("+")}`);
      if (box && !inline && !doc.documentElement.dataset.font && !/Atkinson/i.test(face)) p.push(`face ${face}`);
      if (box && !inline && base.length && !base.includes("field") && !["600", "700"].includes(cs.fontWeight)) p.push(`weight ${cs.fontWeight}`);
      if (box && !inline && !round && base.length && cs.borderTopLeftRadius !== "6px") p.push(`corners ${cs.borderTopLeftRadius}`);
      if (cs.boxShadow !== "none" && !KIT_SHADOW.test(cs.boxShadow)) p.push(`shadow ${cs.boxShadow.slice(0, 50)}`);
      if (Number(cs.opacity) > 0 && Number(cs.opacity) < 1) p.push(`opacity ${cs.opacity}`);
      if (cs.textTransform !== "none") p.push("capitals");
      const svg = el.querySelector("svg");
      if (svg && !words(el)) {
        const icon = svg.getAttribute("data-icon");
        const label = el.getAttribute("aria-label") || el.getAttribute("title") ||
          (el.getAttribute("aria-labelledby") && doc.getElementById(el.getAttribute("aria-labelledby"))?.textContent);
        if (!icon) p.push("an icon alone, not from icons.mjs");
        else if (!STANDALONE.includes(icon)) p.push(`the icon "${icon}" alone`);
        if (!label) p.push("an icon alone with no name");
      }
      if (/[×‹›▾▸]/.test(el.textContent || "")) p.push("a typed glyph");
      if (p.length) problems.push(`${name(el)} "${words(el)}" [${levels.join(" ") || "-"}] ${p.join("; ")}`);
    }
    for (const el of doc.querySelectorAll("a[href], label, [class*=chip], [class*=pill], [class*=toggle]")) {
      if (el.matches(CONTROLS) || !shown(el) || el.closest(APPS) || levelsOf(el).length) continue;
      const cs = win.getComputedStyle(el);
      const fill = clear(cs.backgroundColor) ? "" : `fill ${cs.backgroundColor}`;
      const edge = ["Top", "Right", "Bottom", "Left"].every((s) =>
        parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none" && !clear(cs[`border${s}Color`]));
      if (fill || edge) problems.push(`${name(el)} "${words(el) || el.getAttribute("aria-label") || el.getAttribute("href")}" [drawn as a button] ${fill}${edge ? " edge" : ""}`);
    }
    return { controls, filled, problems };
  }

  async function load(url, width, height) {
    const frame = document.createElement("iframe");
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;z-index:99999;background:#fff`;
    frame.src = url;
    document.body.append(frame);
    await new Promise((r) => frame.addEventListener("load", r, { once: true }));
    try { await frame.contentDocument.fonts.ready; } catch {}
    // A hidden window runs no animation frames: let a page's own code that
    // waits for one (a tray opening) run on a timer instead.
    const w = frame.contentWindow;
    w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(w.performance.now()), 16);
    await wait(700);
    return frame;
  }

  const group = (list) => {
    const g = new Map();
    for (const x of list) { const k = x.replace(/"[^"]*"/, '""'); if (!g.has(k)) g.set(k, { n: 0, x }); g.get(k).n++; }
    return [...g.values()].map(({ n, x }) => `   ${n}× ${x}`);
  };

  async function pages(urls, { width = 1440, height = 900, theme = null } = {}) {
    if (theme) localStorage.setItem("lit-theme", theme);
    const out = [];
    try {
      for (const url of urls) {
        const frame = await load(url, width, height);
        const r = audit(frame.contentWindow);
        out.push(`${url} (${r.controls} controls; filled: ${r.filled.join(", ") || "none"})`, ...group(r.problems));
        frame.remove();
      }
    } finally {
      if (theme) localStorage.removeItem("lit-theme");
    }
    return out.join("\n");
  }

  async function opened(url, picks, { width = 1440, height = 900 } = {}) {
    let frame = await load(url, width, height);
    const before = new Set(audit(frame.contentWindow).problems.map((x) => x.replace(/"[^"]*"/, '""')));
    frame.remove();
    const out = [];
    for (const [sel, text] of picks) {
      frame = await load(url, width, height);
      // The Display tray sets itself up when the browser is idle (two seconds at most).
      await wait(2000);
      const el = [...frame.contentDocument.querySelectorAll(sel)].find((e) =>
        e.getClientRects().length && (!text || (e.innerText || e.getAttribute("aria-label") || "").includes(text)));
      if (!el) { out.push(`${sel} "${text}": not found`); frame.remove(); continue; }
      el.click();
      await wait(800);
      const r = audit(frame.contentWindow);
      const added = r.problems.filter((x) => !before.has(x.replace(/"[^"]*"/, '""')));
      out.push(`${sel} "${text}" (filled: ${r.filled.join(", ") || "none"})`, ...group(added));
      frame.remove();
    }
    return out.join("\n");
  }

  window.kitAudit = { audit, pages, opened };
  return "kitAudit ready: kitAudit.pages(urls, opts), kitAudit.opened(url, picks, opts)";
})();
