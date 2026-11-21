/* APA Reference Guide (davenab.com)
   Plain JavaScript. No framework, no server, no tracking. Nothing is saved except the
   light/dark choice. Source types live in data/sources.json (see README.md). */
(function () {
  "use strict";

  const AUTH = { one: "One author", two: "Two authors", three: "Three or more authors", org: "An organisation or group", none: "No author" };
  const STOP = ["apa", "apa7", "7", "7th", "reference", "references", "referencing", "list", "citation", "citations", "cite", "citing", "how", "to", "do", "i", "a", "an", "the", "in", "of", "for", "my", "format", "style", "example", "examples", "entry", "with", "from", "and", "or"];
  let D = null;
  let LAST_Q = "";

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  /* *text* = italics */
  function fmt(s) { return esc(s).replace(/\*([^*]+)\*/g, "<i>$1</i>"); }
  function plain(s) { return String(s).replace(/\*([^*]+)\*/g, "$1"); }
  function byId(id) { return D.sources.find(s => s.id === id); }

  /* ---------- building a reference ---------- */
  function suffixFor(src, a, example) {
    const sx = (example && src.exampleSuffix) || src.suffix;
    if (!sx || a === "org" || a === "none") return "";
    return a === "one" ? (sx.one || "") : (sx.many || "");
  }
  function authorPart(src, a, example) {
    const role = src.role || "Author";
    const P = D.people.exampleAuthors;
    let core;
    if (a === "org") core = example ? src.org.name : (src.orgPatternName || (src.role === "Company" ? "Company" : "Organisation"));
    else if (a === "one") core = example ? P[0] : role + ", A";
    else if (a === "two") core = example ? P[0] + "., & " + P[1] : role + ", A., & " + role + ", B";
    else core = example ? P[0] + "., " + P[1] + "., & " + P[2] : role + ", A., " + role + ", B., & " + role + ", C";
    const sx = suffixFor(src, a, example);
    return core + "." + (sx ? sx + "." : "");
  }
  function dates(src, a, nd) {
    if (nd) return { pd: "n.d.", ed: "n.d.", y: "n.d." };
    const pd = (a === "org" && src.orgDatePattern) || src.datePattern || "Year";
    const ed = (a === "org" && src.orgExampleDate) || src.exampleDate || "2024";
    return { pd, ed, y: ed.split(",")[0] };
  }
  function reference(src, a, nd) {
    const d = dates(src, a, nd);
    if (a === "none" && src.none) return { pattern: src.none.pattern.replace("{D}", d.pd), example: src.none.example.replace("{D}", d.ed), y: d.y };
    const pt = (a === "org" && src.orgPattern) || src.pattern;
    const ex = (a === "org" && src.orgExample) || src.example;
    return {
      pattern: pt.replace("{A}", authorPart(src, a, false)).replace("{D}", d.pd),
      example: ex.replace("{A}", authorPart(src, a, true)).replace("{D}", d.ed),
      y: d.y
    };
  }
  function inText(src, a, nd) {
    const S = D.people.surnames, Y = dates(src, a, nd).y;
    const rows = [];
    if (src.inTextOnly) {
      rows.push(["Pattern", src.inText.pattern], ["In brackets", src.inText.paren], ["In your sentence", src.inText.narr]);
      return rows;
    }
    if (a === "one") rows.push(["Pattern", "(Author, Year) · Author (Year)"], ["In brackets", "(" + S[0] + ", " + Y + ")"], ["In your sentence", S[0] + " (" + Y + ")"]);
    else if (a === "two") rows.push(["Pattern", "(Author & Author, Year) · Author and Author (Year)"], ["In brackets", "(" + S[0] + " & " + S[1] + ", " + Y + ")"], ["In your sentence", S[0] + " and " + S[1] + " (" + Y + ")"]);
    else if (a === "three") rows.push(["Pattern", "(Author et al., Year) · Author et al. (Year)"], ["In brackets", "(" + S[0] + " et al., " + Y + ")"], ["In your sentence", S[0] + " et al. (" + Y + ")"]);
    else if (a === "org") {
      const n = src.org.name, ab = src.org.abbr;
      if (ab) {
        rows.push(["Pattern", "First time: (Organisation [ABC], Year). After that: (ABC, Year)"],
          ["In brackets, first time", "(" + n + " [" + ab + "], " + Y + ")"], ["In brackets, after that", "(" + ab + ", " + Y + ")"],
          ["In your sentence, first time", n + " (" + ab + ", " + Y + ")"], ["In your sentence, after that", ab + " (" + Y + ")"]);
      } else rows.push(["Pattern", "(Organisation, Year) · Organisation (Year)"], ["In brackets", "(" + n + ", " + Y + ")"], ["In your sentence", n + " (" + Y + ")"]);
    } else if (a === "none" && src.none) {
      rows.push(["Pattern", "Use a short title in place of the author, with capitals for the main words."], ["In brackets", src.none.paren.replace("{Y}", Y)], ["In your sentence", src.none.narr.replace("{Y}", Y)]);
    }
    return rows;
  }

  /* ---------- search ---------- */
  function tokens(q) { return q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(t => t && STOP.indexOf(t) < 0); }
  function score(src, q) {
    const ts = tokens(q);
    if (!ts.length) return 0;
    const words = (src.title + " " + src.keywords.join(" ")).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/);
    const phrase = ts.join(" ");
    let sc = 0, matched = 0;
    ts.forEach(t => {
      let best = 0;
      words.forEach(w => { if (w === t) best = Math.max(best, 3); else if (w.startsWith(t) && t.length >= 2) best = Math.max(best, 2); else if (t.length >= 4 && w.indexOf(t) >= 0) best = Math.max(best, 1); });
      if (best) matched++;
      sc += best;
    });
    if (src.keywords.some(k => k.toLowerCase() === phrase) || src.title.toLowerCase() === phrase) sc += 6;
    else if (src.keywords.some(k => k.toLowerCase().indexOf(phrase) >= 0) && ts.length > 1) sc += 4;
    return matched ? { sc: sc + matched * 2, all: matched === ts.length } : 0;
  }
  function results(q) {
    let r = D.sources.map(s => ({ s, m: score(s, q) })).filter(x => x.m);
    if (r.some(x => x.m.all)) r = r.filter(x => x.m.all);   /* prefer source types that match every word typed */
    return r.sort((a, b) => b.m.sc - a.m.sc).map(x => x.s);
  }

  /* ---------- views ---------- */
  const APP = () => $("#app");
  function page(html, title, r) {
    APP().innerHTML = '<div class="wrap page">' + html + "</div>";
    document.title = (title ? title + " | " : "") + "APA Reference Guide | Dave Nab";
    $$(".appnav a").forEach(a => a.setAttribute("aria-current", a.dataset.r === r ? "page" : "false"));
  }
  function srcButton(s) {
    return '<li><a class="srcbtn" href="#/s/' + esc(s.id) + '"><b>' + esc(s.title) + "</b><span>" + esc(s.when) + "</span></a></li>";
  }
  function groupsHtml() {
    return D.groups.map(g => '<section class="group" aria-labelledby="g-' + esc(g.id) + '"><h2 id="g-' + esc(g.id) + '">' + esc(g.title) + '</h2><p class="muted small">' + esc(g.about) + '</p><ul class="srclist">' +
      D.sources.filter(s => s.group === g.id).map(srcButton).join("") + "</ul></section>").join("");
  }
  function viewHome() {
    let h = '<section class="hero"><p class="eyebrow">APA 7th · Free referencing guide</p><h1>How do I reference <span class="hl">this source</span>?</h1>' +
      '<p class="lead">Search for your source type, or choose it from the list. Then choose who wrote it. You will see the pattern, an example and the in-text citation.</p></section>' +
      '<div class="search card"><label for="q">What kind of source is it?</label><input type="search" id="q" placeholder="For example: online newspaper, YouTube, journal article" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="' + esc(LAST_Q) + '">' +
      '<p class="small muted" id="qcount" aria-live="polite"></p><ul class="srclist" id="qres" hidden></ul></div>' +
      '<div id="browse">' + groupsHtml() + "</div>" +
      '<section class="card"><h2>Setting out your reference list</h2><p>Order, indents, capitals and italics. <a href="#/layout">See the reference list rules</a>.</p>' +
      '<p class="small muted">For in-text citations (and / &amp;, et al., page numbers, “as cited in”), see the <a href="../apa-citation-trainer/#/guide">Quick guide</a>, or practise with <a href="../apa-citation-trainer/">APA Trainer</a>.</p></section>' + note();
    page(h, "", "home");
    const q = $("#q");
    q.addEventListener("input", () => { LAST_Q = q.value; showResults(); });
    q.addEventListener("keydown", e => { if (e.key === "Enter") { const first = $("#qres a"); if (first) { e.preventDefault(); location.hash = first.getAttribute("href"); } } });
    showResults();
  }
  function showResults() {
    const q = LAST_Q.trim(), list = $("#qres"), count = $("#qcount"), browse = $("#browse");
    if (!list) return;
    if (!q) { list.hidden = true; list.innerHTML = ""; count.textContent = ""; browse.hidden = false; return; }
    const r = results(q);
    if (!tokens(q).length) { list.hidden = true; count.textContent = "Type the kind of source, for example “newspaper” or “book”."; browse.hidden = false; return; }
    list.innerHTML = r.map(srcButton).join("");
    list.hidden = !r.length;
    browse.hidden = !!r.length;
    count.textContent = r.length ? (r.length === 1 ? "1 match." : r.length + " matches. The best match is first.") : "No match. Try another word, or choose from the list below.";
  }
  function note() { return '<p class="small muted guide-note">Based on the APA 7th guide. Always follow your own course’s referencing guide if it is different. All example names and titles are invented.</p>'; }

  function viewSource(id, a, nd) {
    const src = byId(id);
    if (!src) { location.hash = "#/"; return; }
    if (src.authors.indexOf(a) < 0) a = src.defaultAuthor || src.authors[0];
    nd = !!(src.ndAllowed && (nd === null ? src.ndDefault : nd));
    const g = D.groups.find(x => x.id === src.group);
    let h = '<p class="small"><a href="#/">← All source types</a></p><p class="eyebrow">' + esc(g ? g.title : "Source type") + "</p><h1>" + esc(src.title) + '</h1><p class="lead">' + esc(src.when) + "</p>";
    h += '<div class="card choose">';
    if (src.authors.length > 1 || !src.inTextOnly) {
      h += '<fieldset class="pick"><legend>Who wrote it?</legend><div class="seg">' + src.authors.map((x, k) =>
        '<input type="radio" id="a' + k + '" name="auth" value="' + x + '"' + (x === a ? " checked" : "") + '><label for="a' + k + '">' + esc((src.authorLabels && src.authorLabels[x]) || AUTH[x]) + "</label>").join("") + "</div></fieldset>";
    }
    if (src.ndAllowed) h += '<fieldset class="pick"><legend>Is there a date?</legend><div class="seg"><input type="radio" id="d1" name="nd" value="0"' + (!nd ? " checked" : "") + '><label for="d1">Yes, there is a date</label><input type="radio" id="d0" name="nd" value="1"' + (nd ? " checked" : "") + '><label for="d0">No date (n.d.)</label></div></fieldset>';
    h += "</div>";
    h += '<div id="out" aria-live="polite"></div>';
    h += '<section class="card"><h2>Tips</h2><ul>' + src.tips.map(t => "<li>" + fmt(t) + "</li>").join("") + "</ul>" +
      (src.authors.indexOf("three") >= 0 ? '<p class="small muted">21 or more authors? In the reference list, write the first 19, then “…”, then the last author.</p>' : "") + "</section>";
    h += '<p class="small muted guide-note">Based on the APA 7th guide. Always follow your own course’s referencing guide if it is different. The example is invented.</p>';
    h += '<div class="actions"><a class="btn" href="#/">Find another source type</a><a class="btn" href="#/layout">Reference list rules</a><a class="btn" href="../apa-citation-trainer/">Practise with APA Trainer</a></div>';
    page(h, src.title, "home");
    const update = () => {
      const ar = $('input[name="auth"]:checked'), nr = $('input[name="nd"]:checked');
      const av = ar ? ar.value : a, nv = nr ? nr.value === "1" : nd;
      renderOut(src, av, nv);
      try { history.replaceState(null, "", "#/s/" + src.id + "/" + av + (nv ? "/nd" : "")); } catch (e) { }
    };
    $$('input[name="auth"], input[name="nd"]').forEach(r => r.addEventListener("change", update));
    renderOut(src, a, nd);
  }
  function renderOut(src, a, nd) {
    let h = "";
    if (src.inTextOnly) {
      h += '<section class="card"><h2>Reference list</h2><p class="notice">Do not put this in the reference list. Cite it in your text only.</p></section>';
    } else {
      const r = reference(src, a, nd);
      h += '<section class="card"><div class="row between"><h2>Pattern</h2><button class="btn small-btn" type="button" id="copyP">Copy pattern</button></div>' +
        '<p class="ref">' + fmt(r.pattern) + '</p><p class="small muted">Words in <i>italics</i> must be in italics.</p><p class="small" id="copymsg" aria-live="polite"></p>' + caseNote(src, a) + "</section>" +
        '<section class="card"><h2>Example</h2><p class="ref">' + fmt(r.example) + "</p></section>";
      window.__lastPattern = r.pattern;
    }
    h += '<section class="card"><h2>In-text citation</h2><dl class="intext">' + inText(src, a, nd).map(([k, v]) => "<dt>" + esc(k) + "</dt><dd" + (k === "Pattern" ? ' class="muted"' : "") + ">" + fmt(v) + "</dd>").join("") + "</dl>" +
      '<p class="small muted">A direct quotation also needs the page: (' + esc(D.people.surnames[0]) + ', 2021, p. 15). More rules in the <a href="../apa-citation-trainer/#/guide">Quick guide</a>.</p></section>';
    $("#out").innerHTML = h;
    const cp = $("#copyP");
    if (cp) cp.addEventListener("click", () => copy(window.__lastPattern, $("#copymsg")));
  }
  const CASE = { sentence: "Sentence case", title: "Title case", name: "As the name is written" };
  function caseNote(src, a) {
    const parts = (src.case || []).filter(p => !(a === "org" && p.notOrg));
    if (!parts.length) return "";
    return '<div class="casebox"><h3>Capital letters</h3><dl class="caselist">' + parts.map(p =>
      "<dt>" + esc(p.part) + '</dt><dd><span class="casetag ' + p.case + '">' + CASE[p.case] + "</span> " + fmt(p.example) + "</dd>").join("") + "</dl>" +
      '<p class="small"><b>Sentence case:</b> a capital letter only for the first word, the first word after a colon, and names (e.g. <i>Writing at university: A practical guide</i>).<br>' +
      "<b>Title case:</b> a capital letter for every main word; small words such as <i>and, of, the, in</i> stay lower case (e.g. <i>Journal of Student Learning</i>).</p>" +
      '<p class="small muted">A common mistake: capital letters on every word of an article, book or web page title. In the reference list, these titles use sentence case.</p></div>';
  }
  function copy(text, msg) {
    const html = fmt(text), txt = plain(text);
    const ok = () => { msg.textContent = "Copied. Paste it into your document, then replace each part with your source's details."; };
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); let done = false; try { done = document.execCommand("copy"); } catch (e) { }
      document.body.removeChild(ta); msg.textContent = done ? "Copied (without italics). Add the italics in your document." : "Sorry, copying did not work. Select the pattern and copy it.";
    };
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([txt], { type: "text/plain" }) })]).then(ok, () => {
          if (navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { msg.textContent = "Copied (without italics). Add the italics in your document."; }, fallback); else fallback();
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { msg.textContent = "Copied (without italics). Add the italics in your document."; }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function viewLayout() {
    let h = '<p class="small"><a href="#/">← All source types</a></p><p class="eyebrow">Reference list</p><h1>Setting out your <span class="hl">reference list</span></h1>' +
      '<section class="card"><ol class="layout">' + D.layout.map(t => "<li>" + fmt(t) + "</li>").join("") + "</ol></section>" +
      '<section class="card"><h2>What it looks like</h2><div class="reflist"><p class="reflist-h">References</p>' +
      ["journal-article:two", "online-news:one", "webpage:org"].map(k => { const [id, a] = k.split(":"); const s = byId(id); return s ? '<p class="ref hang">' + fmt(reference(s, a, false).example) + "</p>" : ""; })
        .sort((x, y) => x.replace(/<[^>]+>/g, "").localeCompare(y.replace(/<[^>]+>/g, ""))).join("") +
      '</div><p class="small muted">Alphabetical order by the first word of each entry. Every line after the first is indented.</p></section>' + note();
    page(h, "Reference list rules", "layout");
  }

  /* ---------- router ---------- */
  function render() {
    if (!D) return;
    const p = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (p[0] === "s" && p[1]) viewSource(p[1], p[2] || null, p[3] === "nd" ? true : (p[2] ? false : null));
    else if (p[0] === "layout") viewLayout();
    else viewHome();
    window.scrollTo(0, 0);
    if (p[0] === "s" || p[0] === "layout") { const h1 = $("#app h1"); if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); } }
  }
  function initTheme() {
    const b = $("#theme"); if (!b) return;
    b.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) { }
    });
  }

  window.APARef = { reference, inText, results, get data() { return D; } };
  initTheme();
  window.addEventListener("hashchange", render);
  fetch("data/sources.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { D = d; render(); })
    .catch(() => { APP().innerHTML = '<div class="wrap page"><p class="notice">The guide could not be loaded. Please refresh the page. If you opened the file from your computer, open it from the website instead.</p></div>'; });
})();
