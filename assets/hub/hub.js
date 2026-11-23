/* Grammar Hub + Vocabulary Hub: shared engine (assets/hub/hub.js).
   Each hub page sets window.HUB = { id: "grammar" | "vocab", name: "...", data: "data/units.json" }
   and loads config.js, /assets/appbar.js and this file.

   Every unit follows test-teach-test with guided discovery:
     0 Try it (test, no help) → 1 Notice (find the form in a text) → 2 Work it out (guiding questions → rule)
     → 3 Practise (hints, second tries) → 4 Try again (test, with explanations) → 5 Use it (write) → 6 Finished
   Pages (hash routes): #/  #/u/<unit>/<step>  #/review  #/progress  #/words (vocab)  #/about  #/check (teachers)
   Storage: localStorage "dnhub-<id>-v1" on this device only. Optional anonymous score sharing and
   AI feedback go to the davenab-api Worker only if apiBase is set in config.js. */
(function () {
  "use strict";
  var H = window.HUB || { id: "grammar", name: "Hub", data: "data/units.json" };
  var CFG = window.DN_HUB_CONFIG || {};
  var API = String(CFG.apiBase || "").replace(/\/+$/, "");
  var AI_ON = !!(API && CFG.aiFeedback);
  var KEY = "dnhub-" + H.id + "-v1";
  var app = document.getElementById("app");
  var D = null, BY = {}, ORDER = [];
  var F = { level: "all", q: "" };
  var STEPS = [
    ["Try it", "See what you already know", true],
    ["Notice", "Spot the pattern in a real text"],
    ["Work it out", "Guiding questions lead you to the rule"],
    ["Practise", "Short tasks with hints"],
    ["Try again", "Measure your progress", true],
    ["Use it", "Write your own sentences"]
  ];
  var REVIEW_GAPS = [1, 3, 7]; // days

  /* ---------- storage ---------- */
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.v === 1) return s; } catch (e) {}
    return { v: 1, units: {}, review: {}, share: null };
  }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function rec(id) { return S.units[id] || (S.units[id] = { pre: null, post: null, best: null, step: 0, max: 0, done: false }); }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function today(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function norm(s) { return String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "").trim(); }
  function pct(x, n) { return n ? Math.round(100 * x / n) : 0; }
  function words(s) { var m = String(s || "").trim().match(/\S+/g); return m ? m.length : 0; }
  function levelName(l) { return (D.levels[l] && D.levels[l].name) || l; }
  function focusTitle() { var h = $("h1", app) || $("h2", app); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
  function dueItems() { var t = today(); return Object.keys(S.review).filter(function (k) { return S.review[k].due <= t && findItem(k); }); }
  function findItem(key) { var p = key.split("|"); var u = BY[p[0]]; return u && u[p[1]] && u[p[1]][+p[2]] ? { unit: u, item: u[p[1]][+p[2]] } : null; }
  var REVIEWABLE = { mcq: 1, gap: 1, fix: 1, order: 1 };
  function addReview(u, section, i) {
    var it = u[section][i]; if (!REVIEWABLE[it.t]) return;
    S.review[u.id + "|" + section + "|" + i] = { box: 0, due: today(1) };
  }
  function send(kind, u, pre, post) {
    if (!API || S.share !== true) return;
    try {
      fetch(API + "/e", { method: "POST", headers: { "Content-Type": "text/plain" }, keepalive: true,
        body: JSON.stringify({ v: 1, hub: H.id, unit: u.id, level: u.level, kind: kind, pre: pre, post: post }) }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- theme ---------- */
  var themeBtn = $("#theme");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ---------- start ---------- */
  fetch(H.data).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
    D = d;
    D.units.forEach(function (u) { BY[u.id] = u; ORDER.push(u.id); });
    window.addEventListener("hashchange", route);
    route();
  }).catch(function () {
    app.innerHTML = '<div class="wrap narrow player"><p class="notice">Sorry, the units could not be loaded. Please check your connection and reload the page.</p></div>';
  });

  function setNav(r) {
    $$(".appnav a").forEach(function (a) { if (a.dataset.r === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var n = dueItems().length, c = $("#due-count");
    if (c) { c.textContent = n; c.hidden = !n; }
  }

  function route() {
    var h = location.hash || "#/", m;
    if ((m = h.match(/^#\/u\/([a-z0-9-]+)(?:\/(\d))?$/)) && BY[m[1]]) { setNav("home"); unitPage(BY[m[1]], m[2]); }
    else if (h === "#/review") { setNav("review"); reviewPage(); }
    else if (h === "#/progress") { setNav("progress"); progressPage(); }
    else if (h === "#/about") { setNav("about"); aboutPage(); }
    else if (h === "#/words" && H.id === "vocab") { setNav("words"); wordsPage(); }
    else if (h === "#/check") { setNav(""); checkPage(); }
    else { setNav("home"); homePage(); }
    if (!/^#\/u\//.test(h) || !window.__keepScroll) window.scrollTo(0, 0);
    window.__keepScroll = false;
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  function statusHtml(u) {
    var r = S.units[u.id];
    if (r && r.done && r.pre != null && r.best != null)
      return '<span class="minibars" title="Before and after"><span class="sr">Before ' + r.pre + '%, after ' + r.best + '%</span><i style="--w:' + r.pre + '%"></i><i class="after" style="--w:' + r.best + '%"></i><b aria-hidden="true">' + r.pre + '→' + r.best + '%</b></span>';
    if (r && r.max > 0) return '<span class="status">Step ' + Math.min(r.step + 1, 6) + ' of 6</span>';
    return '<span class="status">Not started</span>';
  }
  function cardHtml(u) {
    var r = S.units[u.id], label = r && r.done ? "Practise again" : (r && r.max > 0 ? "Continue" : "Start");
    var s = [u.title, u.cando, (u.tags || []).join(" "), (u.sample || []).join(" ").replace(/<[^>]+>/g, "")].join(" ").toLowerCase();
    return '<article class="ucard" data-level="' + u.level + '" data-s="' + esc(s) + '">' +
      '<div class="meta"><span class="lvl-tag">' + u.level + (u.quick ? " · Quick fix" : "") + '</span><span>≈ ' + (u.minutes || 10) + ' min</span></div>' +
      '<h3>' + esc(u.title) + '</h3><p class="cando">' + esc(u.cando) + '</p>' +
      (u.sample ? '<div class="sample">' + u.sample.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" : "") +
      '<div class="foot">' + statusHtml(u) + '<a class="go" href="#/u/' + u.id + '" aria-label="' + label + ': ' + esc(u.title) + '">' + label + ' →</a></div></article>';
  }
  function homePage() {
    var levels = Object.keys(D.levels);
    var html = '<div class="wrap">';
    html += '<section class="hero"><p class="eyebrow">' + D.hero.eyebrow + '</p><h1>' + D.hero.title + '</h1><p class="lead">' + D.hero.lead + '</p>' +
      '<ol class="steps" aria-label="How every unit works">' + STEPS.map(function (s) { return '<li' + (s[2] ? ' class="t"' : "") + '><b>' + s[0] + '</b><span class="muted">' + s[1] + "</span></li>"; }).join("") + "</ol>" +
      '<p class="steps-note">You test yourself first, so the lesson focuses on what <em>you</em> need. Then you test again and see your progress.</p>' +
      '<p class="steps-note"><b>Not sure of your level?</b> <a href="../level-check/">Take the 30-minute level check</a> (B1–C1), then start with the units it suggests.</p></section>';

    if (API && S.share === null)
      html += '<div class="panel optin" id="optin"><p><b>Help improve this hub?</b> Share your before-and-after scores anonymously, for example “passive voice: 40% → 80%”. No name, no email, no tracking. <a href="#/about">What is shared</a></p><div class="row"><button class="btn primary sm" data-share="1" type="button">Yes, share anonymously</button><button class="btn sm" data-share="0" type="button">No thanks</button></div></div>';

    var cont = ORDER.filter(function (id) { var r = S.units[id]; return r && r.max > 0 && !r.done; }).sort(function (a, b) { return (S.units[b].at || "").localeCompare(S.units[a].at || ""); })[0];
    var due = dueItems().length;
    if (cont) html += '<div class="panel continue"><div class="grow"><p class="small muted">Pick up where you left off</p><p><b>' + esc(BY[cont].title) + '</b> · ' + STEPS[Math.min(S.units[cont].step, 5)][0] + '</p></div><a class="btn primary" href="#/u/' + cont + '">Continue →</a></div>';
    else if (due) html += '<div class="panel continue"><div class="grow"><p class="small muted">Spaced review</p><p><b>' + due + ' item' + (due > 1 ? "s" : "") + '</b> from earlier units are ready for review. It takes about ' + Math.max(1, Math.round(due / 3)) + ' min.</p></div><a class="btn primary" href="#/review">Review now →</a></div>';

    html += '<div class="toolbar" role="search"><div class="chips" role="group" aria-label="Filter by level"><button class="chip" type="button" data-lv="all" aria-pressed="' + (F.level === "all") + '">All levels</button>' +
      levels.map(function (l) { return '<button class="chip" type="button" data-lv="' + l + '" data-level="' + l + '" aria-pressed="' + (F.level === l) + '"><span class="dot" aria-hidden="true"></span>' + l + ' <span class="sr">' + levelName(l) + "</span></button>"; }).join("") +
      '</div><label class="search"><span class="sr">Search units</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="' + esc(D.searchHint || "Search") + '" value="' + esc(F.q) + '" autocomplete="off"></label></div>';

    var quick = D.units.filter(function (u) { return u.quick; });
    if (quick.length) html += '<section class="lvl" data-sec="quick" aria-labelledby="h-quick"><div class="lvl-head"><span class="lvl-tag" style="--lc:var(--hub);--lb:var(--hub-bg)">4 min</span><h2 id="h-quick">Quick fixes</h2><p>Short lessons on common mix-ups. Each one takes about four minutes.</p></div><div class="grid">' + quick.map(cardHtml).join("") + "</div></section>";
    levels.forEach(function (l) {
      var units = D.units.filter(function (u) { return u.level === l && !u.quick; });
      var soon = (D.soon && D.soon[l]) || [];
      html += '<section class="lvl" data-sec="' + l + '" data-level="' + l + '" aria-labelledby="h-' + l + '"><div class="lvl-head"><span class="lvl-tag">' + l + '</span><h2 id="h-' + l + '">' + esc(levelName(l)) + '</h2><p>' + esc(D.levels[l].cando) + '</p></div>' +
        '<div class="grid">' + units.map(cardHtml).join("") + "</div>" +
        (soon.length ? '<p class="soon"><b>Coming next:</b> ' + soon.map(esc).join(" · ") + "</p>" : "") + "</section>";
    });
    html += '<p class="empty" id="empty" hidden>No units match your search. Try another word, or choose “All levels”.</p>';
    html += '<details class="cefr"><summary>What do A2, B1, B2 and C1 mean?</summary><p class="muted small">CEFR levels describe what you can do in a language. Most university courses ask for about B2; IELTS 6.5 is roughly B2/C1. If you are not sure of your level, start with any unit: the first test tells you quickly if it is too easy.</p><div class="cefr-grid">' +
      levels.map(function (l) { return '<div data-level="' + l + '"><b>' + l + " · " + esc(levelName(l)) + "</b><br><span class=\"small\">" + esc(D.levels[l].about) + "</span></div>"; }).join("") + "</div></details>";
    if (D.related) html += '<section class="related" aria-labelledby="rel-h"><h2 id="rel-h">More free practice</h2><ul>' + D.related.map(function (r) { return '<li><a href="' + r.u + '"><b>' + esc(r.t) + "</b><span>" + esc(r.d) + "</span></a></li>"; }).join("") + "</ul></section>";
    html += "</div>";
    app.innerHTML = html;

    $$(".chip[data-lv]").forEach(function (b) { b.addEventListener("click", function () { F.level = b.dataset.lv; $$(".chip[data-lv]").forEach(function (c) { c.setAttribute("aria-pressed", c === b); }); applyFilter(); }); });
    $("#q").addEventListener("input", function (e) { F.q = e.target.value; applyFilter(); });
    $$("[data-share]").forEach(function (b) { b.addEventListener("click", function () { S.share = b.dataset.share === "1"; save(); var o = $("#optin"); o.innerHTML = '<p>' + (S.share ? "Thank you! Only anonymous scores are shared. You can change this on the About page." : "No problem. Nothing is shared. You can change this on the About page.") + "</p>"; }); });
    applyFilter();
  }
  function applyFilter() {
    var q = norm(F.q), any = false;
    $$(".lvl").forEach(function (sec) {
      var showLevel = F.level === "all" || sec.dataset.sec === F.level || sec.dataset.sec === "quick", vis = 0;
      $$(".ucard", sec).forEach(function (c) { var ok = showLevel && (!q || c.dataset.s.indexOf(q) > -1); c.hidden = !ok; if (ok) vis++; });
      sec.hidden = !vis; if (vis) any = true;
      var soon = $(".soon", sec); if (soon) soon.hidden = !!q;
    });
    $("#empty").hidden = any;
  }

  /* =====================================================================
     UNIT PLAYER
     ===================================================================== */
  function unitPage(u, stepStr) {
    var r = rec(u.id);
    var step = stepStr != null ? Math.min(+stepStr, 6) : (r.done ? 0 : r.step || 0);
    if (step > r.max + 1 && !r.done) step = r.max; // no skipping far ahead on a first run
    r.step = Math.min(step, 5); r.max = Math.max(r.max, Math.min(step, 5)); r.at = today(); save();
    var html = '<div class="wrap narrow player"><div class="p-head"><span class="lvl-tag" data-level="' + u.level + '">' + u.level + '</span><h1>' + esc(u.title) + '</h1>' + (u.verified === false ? '<span class="draft" title="Dave has not checked this unit yet">Draft content</span>' : "") + '</div>' +
      '<ol class="stepper" aria-label="Unit steps">' + STEPS.map(function (s, i) {
        var cls = i < step || (step === 6) ? "done" : (i === step ? "now" : "");
        var can = i <= r.max || r.done;
        var label = '<span>' + s[0] + "</span>";
        return '<li class="' + cls + '"' + (i === step ? ' aria-current="step"' : "") + '>' + (can && i !== step ? '<a href="#/u/' + u.id + "/" + i + '" style="color:inherit;text-decoration:none">' + label + "</a>" : label) + "</li>";
      }).join("") + '</ol><div id="stage"></div><p class="small" style="margin-top:18px"><a href="#/">← All units</a></p></div>';
    app.innerHTML = html;
    var stage = $("#stage");
    [stepTry, stepNotice, stepDiscover, stepPractise, stepRetest, stepUse, stepFinish][step](u, stage, r);
    focusTitle();
  }
  function go(u, step) { location.hash = "#/u/" + u.id + "/" + step; }

  function intro(stage, title, text, btn, fn, extra) {
    stage.innerHTML = '<div class="stage"><h2>' + title + '</h2><p>' + text + '</p>' + (extra || "") + '<div class="actions"><button class="btn primary" type="button" id="begin">' + btn + "</button></div></div>";
    $("#begin").addEventListener("click", fn);
  }

  /* --- 0 Try it --- */
  function stepTry(u, stage, r) {
    intro(stage, "Step 1 · Try it", "First, see what you already know. " + u.pre.length + " quick questions, no help yet. Don’t worry about mistakes: they show what to focus on.", "Start the questions", function () {
      runItems(stage, u, "pre", "test", function (score) {
        var p = pct(score, u.pre.length);
        var first = r.pre == null;
        if (first) { r.pre = p; send("pre", u, p); }
        r.lastPre = p; save();
        var msg = p === 100 ? "Excellent: you already know this well! You can skip to the second test, or work through the unit anyway to make sure." :
          p >= 60 ? "Good start. Some parts are still tricky. Let’s look at a real text and work out the pattern." :
          "That’s fine: now you know what to focus on. Let’s look at a real text and work out the pattern.";
        stage.innerHTML = '<div class="stage"><p class="small muted">Your first score</p><p class="big">' + p + '%</p><p>' + msg + '</p><div class="actions"><button class="btn primary" type="button" id="n">Next: Notice →</button>' + (p === 100 ? '<button class="btn" type="button" id="skip">Skip to Try again</button>' : "") + "</div></div>";
        $("#n").addEventListener("click", function () { go(u, 1); });
        if ($("#skip")) $("#skip").addEventListener("click", function () { r.max = Math.max(r.max, 4); save(); go(u, 4); });
        $("#n").focus();
      });
    });
  }

  /* --- 1 Notice --- */
  function stepNotice(u, stage) {
    var n = u.notice;
    var parts = [], re = /\[\[(.+?)\]\]/g, last = 0, m, total = 0;
    while ((m = re.exec(n.text))) { pushWords(parts, n.text.slice(last, m.index)); parts.push({ w: m[1], t: true }); total++; last = re.lastIndex; }
    pushWords(parts, n.text.slice(last));
    var found = 0;
    stage.innerHTML = '<div class="stage"><h2>Step 2 · Notice</h2><p class="instr">' + n.instr + '</p>' +
      (n.title ? '<p class="small muted" style="margin:0 0 6px"><b>' + esc(n.title) + "</b></p>" : "") +
      '<div class="reading tokens" id="toks">' + parts.map(function (p, i) { return p.sp ? p.sp : '<button type="button" class="tok" data-i="' + i + '">' + esc(p.w) + "</button>"; }).join("") + '</div>' +
      '<div class="actions"><span class="found-count" aria-live="polite" id="fc">Found 0 of ' + total + '</span><button class="btn sm ghost" type="button" id="reveal">Show me the rest</button></div><div class="fb" id="fb" aria-live="polite"></div><div class="actions" id="next" hidden><button class="btn primary" type="button">Next: Work it out →</button></div></div>';
    function done(all) {
      $$(".tok").forEach(function (b) { b.disabled = true; });
      $("#reveal").hidden = true;
      $("#fb").className = "fb " + (all ? "ok" : "info");
      $("#fb").innerHTML = (all ? '<b class="tick">✓</b> You found them all. ' : "Here they are, outlined. ") + (n.after || "Look at the highlighted words. What do they have in common? You’ll work it out next.");
      $("#next").hidden = false; $("#next button").focus();
    }
    $("#toks").addEventListener("click", function (e) {
      var b = e.target.closest(".tok"); if (!b || b.disabled) return;
      var p = parts[+b.dataset.i];
      if (p.t) { b.classList.add("found"); b.disabled = true; found++; $("#fc").textContent = "Found " + found + " of " + total; if (found === total) done(true); }
      else { b.classList.add("miss"); setTimeout(function () { b.classList.remove("miss"); }, 700); }
    });
    $("#reveal").addEventListener("click", function () { $$(".tok").forEach(function (b) { var p = parts[+b.dataset.i]; if (p.t && !b.classList.contains("found")) b.classList.add("found", "revealed"); }); done(false); });
    $("#next button").addEventListener("click", function () { go(u, 2); });
  }
  function pushWords(parts, s) {
    s.split(/(\s+)/).forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) parts.push({ sp: " " });
      else if (!/[A-Za-z0-9]/.test(w)) parts.push({ sp: esc(w) }); // punctuation on its own is not tappable
      else parts.push({ w: w });
    });
  }

  /* --- 2 Work it out --- */
  function ruleHtml(u) {
    var R = u.rule;
    return '<div class="rule"><h3>' + esc(R.title || "What you worked out") + '</h3><ul>' + R.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>" +
      (R.ex || []).map(function (x) { return '<p class="ex">' + x + "</p>"; }).join("") +
      (u.words ? '<div class="wordcard">' + u.words.map(function (w) { return "<div><b>" + esc(w.w) + "</b>" + esc(w.m) + (w.ex ? '<br><i class="muted">' + esc(w.ex) + "</i>" : "") + "</div>"; }).join("") + "</div>" : "") +
      (R.watch ? '<p class="small" style="margin:.8em 0 0"><b>Watch out:</b> ' + R.watch + "</p>" : "") + "</div>";
  }
  function stepDiscover(u, stage) {
    intro(stage, "Step 3 · Work it out", "Answer a few guiding questions about the examples. You’ll build the rule yourself, step by step.", "Start", function () {
      runItems(stage, u, "discover", "practice", function () {
        stage.innerHTML = '<div class="stage"><h2>Here’s what you worked out</h2>' + ruleHtml(u) + '<div class="actions"><button class="btn primary" type="button" id="n">Next: Practise →</button></div></div>';
        $("#n").addEventListener("click", function () { go(u, 3); }); $("#n").focus();
      });
    });
  }

  /* --- 3 Practise --- */
  function stepPractise(u, stage) {
    intro(stage, "Step 4 · Practise", u.practice.length + " short tasks. If you get one wrong, you’ll get a hint and a second try.", "Start practising", function () {
      runItems(stage, u, "practice", "practice", function (score) {
        var p = pct(score, u.practice.length);
        stage.innerHTML = '<div class="stage"><p class="small muted">Practice score</p><p class="big">' + p + '%</p><p>' + (p >= 80 ? "Great work. Ready to test yourself again?" : "Good effort. Mistakes you made are saved for spaced review. Ready to test yourself again?") + '</p><div class="actions"><button class="btn primary" type="button" id="n">Next: Try again →</button><button class="btn" type="button" id="again">Practise once more</button></div></div>';
        $("#n").addEventListener("click", function () { go(u, 4); }); $("#again").addEventListener("click", function () { stepPractise(u, stage); }); $("#n").focus();
      }, true);
    });
  }

  /* --- 4 Try again --- */
  function stepRetest(u, stage, r) {
    intro(stage, "Step 5 · Try again", "A new set of " + u.post.length + " questions, like the first test. This time you’ll see an explanation after each one.", "Start the test", function () {
      runItems(stage, u, "post", "check", function (score) {
        var p = pct(score, u.post.length);
        var pre = r.pre == null ? (r.lastPre == null ? 0 : r.lastPre) : r.pre;
        if (r.post == null) { r.post = p; send("post", u, pre, p); }
        r.best = Math.max(r.best == null ? 0 : r.best, p); save();
        var gain = p - pre;
        stage.innerHTML = '<div class="stage"><h2>Your progress</h2><div class="compare">' +
          '<div class="cmp"><span>First test</span><span class="track"><i data-w="' + pre + '"></i></span><span>' + pre + '%</span></div>' +
          '<div class="cmp after"><span>Second test</span><span class="track"><i data-w="' + p + '"></i></span><span>' + p + '%</span></div></div>' +
          '<p>' + (gain > 0 ? "You improved by <b>" + gain + " points</b>. Well done!" : p === 100 ? "A perfect score. Excellent!" : gain === 0 ? "Same score as before. Look at the rule again, then try the practice once more." : "This one is still tricky. Look at the rule again and practise once more: it’s normal for new grammar to take time.") + '</p>' +
          '<div class="actions"><button class="btn primary" type="button" id="n">Next: Use it →</button>' + (p < 80 ? '<button class="btn" type="button" id="back">Practise again</button>' : "") + "</div></div>";
        setTimeout(function () { $$(".cmp i").forEach(function (i) { i.style.width = i.dataset.w + "%"; }); }, 60);
        $("#n").addEventListener("click", function () { go(u, 5); }); if ($("#back")) $("#back").addEventListener("click", function () { go(u, 3); });
        $("#n").focus();
      });
    });
  }

  /* --- 5 Use it --- */
  function stepUse(u, stage, r) {
    var P = u.produce;
    stage.innerHTML = '<div class="stage"><h2>Step 6 · Use it</h2><p class="instr">' + P.task + '</p>' +
      '<label class="sr" for="ta">Your writing</label><textarea id="ta" maxlength="900" placeholder="Write here…">' + esc(r.draft || "") + '</textarea><div class="counter" id="wc"></div>' +
      '<p style="margin:12px 0 4px"><b>Check your own writing first:</b></p><ul class="checklist">' + P.checklist.map(function (c, i) { return '<li><label><input type="checkbox" id="c' + i + '"> <span>' + c + "</span></label></li>"; }).join("") + '</ul>' +
      '<div class="actions">' + (AI_ON ? '<button class="btn primary" type="button" id="ai">Get AI feedback</button>' : "") + '<button class="btn" type="button" id="model">Show an example answer</button></div>' +
      (AI_ON ? '<p class="small muted" style="margin-top:8px">AI feedback: your text is sent to Cloudflare Workers AI to create feedback. It is not stored. Don’t include your name or personal details. AI can make mistakes.</p>' : "") +
      '<div id="aiout" class="ai-box" aria-live="polite"></div><div class="model notice" id="mod" hidden><b>Example answer</b><p style="margin:.4em 0 0">' + P.model + "</p></div>" +
      '<div class="actions" style="margin-top:22px;border-top:1px solid var(--border);padding-top:16px"><button class="btn primary" type="button" id="fin">Finish the unit →</button></div></div>';
    var ta = $("#ta");
    function wc() { $("#wc").textContent = words(ta.value) + " words"; r.draft = ta.value; save(); }
    ta.addEventListener("input", wc); wc();
    $("#model").addEventListener("click", function () { $("#mod").hidden = !$("#mod").hidden; this.textContent = $("#mod").hidden ? "Show an example answer" : "Hide the example answer"; });
    $("#fin").addEventListener("click", function () { r.done = true; r.max = 5; save(); go(u, 6); });
    if ($("#ai")) $("#ai").addEventListener("click", function () { aiFeedback(u, ta.value, this); });
  }
  function aiFeedback(u, text, btn) {
    var out = $("#aiout");
    if (words(text) < 4) { out.innerHTML = '<div class="fb hint">Write at least one full sentence first.</div>'; return; }
    btn.disabled = true; btn.textContent = "Thinking…";
    out.innerHTML = '<div class="fb info">Reading your writing…</div>';
    fetch(API + "/feedback", { method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ hub: H.id, level: u.level, target: u.produce.target, task: u.produce.task.replace(/<[^>]+>/g, ""), text: text }) })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) {
          var e = x.j && x.j.error;
          out.innerHTML = '<div class="fb hint">' + (e === "slow-down" ? "Too many requests. Please wait a minute and try again." : e === "daily-limit" ? "AI feedback has reached today’s limit. Please use the checklist and example answer, and try again tomorrow." : "AI feedback isn’t available right now. Please use the checklist and the example answer.") + "</div>";
          return;
        }
        var j = x.j, cls = j.verdict === "great" ? "ok" : j.verdict === "off_task" ? "no" : "hint";
        var head = { great: "✓ Well done", almost: "Almost there", not_yet: "Not yet: keep going", off_task: "This doesn’t answer the task" }[j.verdict] || "Feedback";
        out.innerHTML = '<div class="fb ' + cls + '"><b>' + head + '</b><p>' + esc(j.summary) + '</p>' +
          (j.points && j.points.length ? '<ul class="ai-points">' + j.points.map(function (p) { return "<li>" + (p.quote ? "<q>" + esc(p.quote) + "</q>" : "") + esc(p.hint) + "</li>"; }).join("") + "</ul>" : "") +
          (j.tip ? '<p><b>Next step:</b> ' + esc(j.tip) + "</p>" : "") + '<p class="small muted">AI feedback can be wrong. If something seems odd, check the rule card.</p></div>';
      })
      .catch(function () { out.innerHTML = '<div class="fb hint">AI feedback isn’t available right now. Please use the checklist and the example answer.</div>'; })
      .then(function () { btn.disabled = false; btn.textContent = "Get AI feedback again"; });
  }

  /* --- 6 Finished --- */
  function stepFinish(u, stage, r) {
    var i = ORDER.indexOf(u.id);
    var next = ORDER.slice(i + 1).concat(ORDER.slice(0, i)).map(function (id) { return BY[id]; }).filter(function (x) { var rr = S.units[x.id]; return !(rr && rr.done); })[0];
    var due = Object.keys(S.review).length;
    var html = '<div class="stage"><h2>Unit finished: <em>well done!</em></h2>' +
      '<div class="compare"><div class="cmp"><span>First test</span><span class="track"><i data-w="' + (r.pre || 0) + '"></i></span><span>' + (r.pre || 0) + '%</span></div>' +
      '<div class="cmp after"><span>Best second test</span><span class="track"><i data-w="' + (r.best || 0) + '"></i></span><span>' + (r.best || 0) + '%</span></div></div>' +
      '<details class="peek" open><summary>Your rule card</summary>' + ruleHtml(u) + '</details>' +
      '<p style="margin-top:14px">' + (due ? "Questions you found hard are saved. They’ll come back in <b>Review</b> after 1, 3 and 7 days, which helps you remember them for longer." : "Come back in a few days and do the second test again to check you still remember it.") + "</p>" +
      '<div class="actions">' + (next ? '<a class="btn primary" href="#/u/' + next.id + '">Next unit: ' + esc(next.title) + ' →</a>' : "") + '<a class="btn" href="#/">All units</a><button class="btn ghost" type="button" id="print">Print my rule card</button></div>' +
      (window.DNNext ? DNNext.html(H.id === "vocab" ? "vocabhub" : "grammarhub") : "") + "</div>";
    stage.innerHTML = html;
    setTimeout(function () { $$(".cmp i").forEach(function (x) { x.style.width = x.dataset.w + "%"; }); }, 60);
    $("#print").addEventListener("click", function () { window.print(); });
  }

  /* =====================================================================
     ITEMS
     mode "test": one try, right/wrong only.  "practice": hint + second try, then answer + why.
     "check": one try, then answer + why.
     ===================================================================== */
  function runItems(stage, u, section, mode, onDone, peek) {
    var items = u[section], i = 0, score = 0;
    function next() {
      if (i >= items.length) { save(); onDone(score); return; }
      var it = items[i];
      stage.innerHTML = '<div class="stage"><div class="stage-top"><span>' + (section === "discover" ? "Question" : "Task") + " " + (i + 1) + " of " + items.length + '</span><span class="bar" aria-hidden="true"><i style="width:' + pct(i, items.length) + '%"></i></span></div>' +
        (it.ctx ? '<div class="reading" style="line-height:1.7;margin-bottom:14px">' + it.ctx + "</div>" : "") +
        '<div id="item"></div><div class="fb" id="fb" aria-live="polite"></div><div class="actions" id="nx" hidden><button class="btn primary" type="button">' + (i + 1 < items.length ? "Next →" : "Finish") + "</button></div>" +
        (peek ? '<details class="peek"><summary>Need the rule? Show my rule card</summary>' + ruleHtml(u) + "</details>" : "") + "</div>";
      var box = $("#item");
      RENDER[it.t](box, it, mode, function (s, isWrongFinal) {
        score += s;
        if (s < 1 && mode !== "test") { addReview(u, section, i); save(); }
        if (section === "discover" && it.insight && s > 0) { var fb = $("#fb"); fb.innerHTML += '<p><b>Key point:</b> ' + it.insight + "</p>"; }
        i++;
        var nx = $("#nx"); nx.hidden = false; var b = $("button", nx); b.addEventListener("click", next); b.focus({ preventScroll: true });
      });
    }
    next();
  }

  function feedback(ok, mode, it, answerHtml, tries) {
    var fb = $("#fb");
    if (ok) {
      fb.className = "fb ok";
      fb.innerHTML = '<b class="tick">✓ Correct.</b>' + (mode !== "test" && it.why ? " " + it.why : "");
    } else if (mode === "test") {
      fb.className = "fb no"; fb.innerHTML = '<b class="cross">✗ Not this time.</b> You’ll find out why later in this unit.';
    } else if (mode === "practice" && tries === 1) {
      fb.className = "fb hint"; fb.innerHTML = "<b>Not quite. Try again.</b> " + (it.hint ? "Hint: " + it.hint : "Look again carefully.");
    } else {
      fb.className = "fb no"; fb.innerHTML = '<b class="cross">✗ Not quite.</b> The answer: <b>' + answerHtml + "</b>." + (it.why ? "<p>" + it.why + "</p>" : "");
    }
  }
  function maxTries(mode) { return mode === "practice" ? 2 : 1; }
  function qHtml(q) { return '<p class="q">' + q.replace(/___/g, '<span class="blank" aria-label="blank"></span>') + "</p>"; }

  var RENDER = {
    /* multiple choice: {t:"mcq", q, o:[...], a:index, hint, why} */
    mcq: function (box, it, mode, done) {
      var order = shuffle(it.o.map(function (_, k) { return k; })), tries = 0;
      if (it.keep) order = it.o.map(function (_, k) { return k; });
      box.innerHTML = (it.instr ? '<p class="instr">' + it.instr + "</p>" : "") + qHtml(it.q) + '<div class="opts">' + order.map(function (k, n) { return '<button class="opt" type="button" data-k="' + k + '"><span class="k" aria-hidden="true">' + "ABCDEF"[n] + "</span><span>" + it.o[k] + "</span></button>"; }).join("") + "</div>";
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".opt"); if (!b || b.disabled) return;
        tries++;
        var ok = +b.dataset.k === it.a;
        var final = ok || tries >= maxTries(mode);
        if (ok) b.classList.add("right");
        else { b.classList.add(final ? "wrong" : "tried"); b.disabled = true; }
        feedback(ok, mode, it, it.o[it.a], tries);
        if (final) {
          $$(".opt", box).forEach(function (x) { x.disabled = true; if (mode !== "test" && +x.dataset.k === it.a) x.classList.add("right"); });
          done(ok ? (tries === 1 ? 1 : 0.5) : 0);
        }
      });
    },
    /* gap fill: {t:"gap", q:"... ___ ...", a:["answer", "alt"], hint, why} */
    gap: function (box, it, mode, done) {
      var tries = 0, parts = it.q.split("___");
      var w = Math.max.apply(null, it.a.map(function (x) { return x.length; }));
      box.innerHTML = (it.instr ? '<p class="instr">' + it.instr + "</p>" : '<p class="instr">Type the missing word(s).</p>') + '<p class="q">' + parts[0] + '<label class="sr" for="g">Missing word</label><input class="gapin" id="g" autocomplete="off" autocapitalize="off" spellcheck="false" style="--w:' + Math.max(5, w + 2) + 'ch">' + (parts[1] || "") + "</p>" +
        '<div class="actions"><button class="btn primary" type="button" id="chk">Check my answer</button></div>';
      var inp = $("#g", box), btn = $("#chk", box);
      function check() {
        if (!inp.value.trim()) { inp.focus(); return; }
        tries++;
        var ok = it.a.some(function (a) { return norm(a) === norm(inp.value); });
        var final = ok || tries >= maxTries(mode);
        inp.classList.remove("right", "wrong"); inp.classList.add(ok ? "right" : "wrong");
        feedback(ok, mode, it, esc(it.a[0]), tries);
        if (final) { inp.readOnly = true; btn.hidden = true; done(ok ? (tries === 1 ? 1 : 0.5) : 0); }
        else inp.select();
      }
      btn.addEventListener("click", check);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (!btn.hidden) check(); } });
      setTimeout(function () { inp.focus({ preventScroll: true }); }, 50);
    },
    /* find the error: {t:"fix", s:"The results {was} clear.", c:"were", hint, why} */
    fix: function (box, it, mode, done) {
      var toks = it.s.split(/\s+/).map(function (w) { return { w: w.replace(/[{}]/g, ""), bad: w.indexOf("{") > -1 }; });
      var tries = 0, badTok = toks.filter(function (t) { return t.bad; })[0];
      box.innerHTML = '<p class="instr">' + (it.instr || "One word or phrase is wrong. Tap it.") + '</p><p class="tokens q">' + toks.map(function (t, k) { return '<button type="button" class="tok" data-k="' + k + '">' + esc(t.w) + "</button>"; }).join(" ") + "</p>";
      var ans = "<s>" + esc(badTok.w) + "</s> → " + esc(it.c);
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".tok"); if (!b || b.disabled) return;
        tries++;
        var ok = toks[+b.dataset.k].bad, final = ok || tries >= maxTries(mode);
        b.classList.add(ok ? "right" : "wrong"); if (!ok) b.disabled = true;
        feedback(ok, mode, it, ans, tries);
        if (ok && mode !== "test") $("#fb").innerHTML = '<b class="tick">✓ Correct.</b> ' + ans + ". " + (it.why || "");
        if (final) {
          $$(".tok", box).forEach(function (x) { x.disabled = true; if (mode !== "test" && toks[+x.dataset.k].bad) x.classList.add("right"); });
          done(ok ? (tries === 1 ? 1 : 0.5) : 0);
        }
      });
    },
    /* put words in order: {t:"order", a:"The full correct sentence.", alt:["another correct order"], hint, why} */
    order: function (box, it, mode, done) {
      var words = it.a.split(/\s+/), tries = 0, bank;
      do { bank = shuffle(words.map(function (w, k) { return { w: w, k: k }; })); } while (words.length > 2 && bank.map(function (b) { return b.w; }).join(" ") === it.a);
      var line = [];
      box.innerHTML = '<p class="instr">' + (it.instr || "Put the words in the right order.") + '</p><div class="answer-line" id="line" aria-label="Your sentence"></div><div class="bank" id="bank">' +
        bank.map(function (b, n) { return '<button type="button" class="wchip" data-n="' + n + '">' + esc(b.w) + "</button>"; }).join("") + '</div><div class="actions"><button class="btn primary" type="button" id="chk" disabled>Check my answer</button><button class="btn ghost sm" type="button" id="clr">Clear</button></div>';
      var L = $("#line", box), chk = $("#chk", box), locked = false;
      function draw() {
        L.innerHTML = line.map(function (n, pos) { return '<button type="button" class="wchip" data-pos="' + pos + '">' + esc(bank[n].w) + "</button>"; }).join("");
        $$("#bank .wchip", box).forEach(function (b) { b.disabled = locked || line.indexOf(+b.dataset.n) > -1; });
        chk.disabled = locked || line.length !== bank.length;
      }
      $("#bank", box).addEventListener("click", function (e) { var b = e.target.closest(".wchip"); if (!b || b.disabled || locked) return; line.push(+b.dataset.n); L.className = "answer-line"; draw(); });
      L.addEventListener("click", function (e) { var b = e.target.closest(".wchip"); if (!b || locked) return; line.splice(+b.dataset.pos, 1); L.className = "answer-line"; draw(); });
      $("#clr", box).addEventListener("click", function () { if (locked) return; line = []; L.className = "answer-line"; draw(); });
      chk.addEventListener("click", function () {
        tries++;
        var said = line.map(function (n) { return bank[n].w; }).join(" ");
        var ok = [it.a].concat(it.alt || []).some(function (a) { return norm(a) === norm(said); });
        var final = ok || tries >= maxTries(mode);
        L.className = "answer-line " + (ok ? "right" : "wrong");
        feedback(ok, mode, it, esc(it.a), tries);
        if (final) { locked = true; draw(); $("#clr", box).hidden = true; done(ok ? (tries === 1 ? 1 : 0.5) : 0); }
      });
      draw();
    },
    /* sort into groups: {t:"sort", instr, bins:["A","B"], chips:[["word",0,"note"], ...]} */
    sort: function (box, it, mode, done) {
      var chips = shuffle(it.chips), k = 0, right = 0, placed = it.bins.map(function () { return []; });
      box.innerHTML = '<p class="instr">' + it.instr + '</p><div id="sc"></div><div class="bins" id="bins">' + it.bins.map(function (b, n) { return '<button class="opt" type="button" data-b="' + n + '">' + b + "</button>"; }).join("") + '</div><div class="sorted" id="sorted"></div>';
      function show() {
        $("#sorted", box).innerHTML = it.bins.map(function (b, n) { return "<div><b>" + b + "</b>" + placed[n].map(function (p) { return '<span class="' + (p.x ? "x" : "") + '">' + esc(p.w) + "</span>"; }).join("") + "</div>"; }).join("");
        if (k < chips.length) $("#sc", box).innerHTML = '<div class="sort-card">' + esc(chips[k][0]) + '<small>' + (k + 1) + " of " + chips.length + "</small></div>";
        else { $("#sc", box).innerHTML = ""; $("#bins", box).hidden = true; }
      }
      $("#bins", box).addEventListener("click", function (e) {
        var b = e.target.closest(".opt"); if (!b || k >= chips.length) return;
        var c = chips[k], ok = +b.dataset.b === c[1];
        if (ok) right++;
        placed[c[1]].push({ w: c[0], x: !ok });
        var fb = $("#fb");
        fb.className = "fb " + (ok ? "ok" : "no");
        fb.innerHTML = ok ? '<b class="tick">✓</b> ' + esc(c[0]) + (c[2] ? ": " + c[2] : "") : '<b class="cross">✗</b> <b>' + esc(c[0]) + "</b> goes in <b>" + it.bins[c[1]] + "</b>." + (c[2] ? " " + c[2] : "");
        k++; show();
        if (k >= chips.length) { fb.innerHTML += "<p><b>" + right + " of " + chips.length + "</b> right." + (it.why ? " " + it.why : "") + "</p>"; done(right / chips.length); }
      });
      show();
    },
    /* match pairs: {t:"match", instr, pairs:[["left","right"], ...], why} */
    match: function (box, it, mode, done) {
      var L = it.pairs.map(function (p, k) { return { w: p[0], k: k }; }), R = shuffle(it.pairs.map(function (p, k) { return { w: p[1], k: k }; }));
      var sel = null, made = 0, errs = 0;
      box.innerHTML = '<p class="instr">' + (it.instr || "Match each item on the left with one on the right.") + '</p><div class="match"><div class="col">' + L.map(function (x) { return '<button class="opt" type="button" data-side="L" data-k="' + x.k + '">' + esc(x.w) + "</button>"; }).join("") + '</div><div class="col">' + R.map(function (x) { return '<button class="opt" type="button" data-side="R" data-k="' + x.k + '">' + esc(x.w) + "</button>"; }).join("") + "</div></div>";
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".opt"); if (!b || b.disabled) return;
        if (!sel || sel.dataset.side === b.dataset.side) { if (sel) sel.classList.remove("sel"); sel = b; b.classList.add("sel"); return; }
        var fb = $("#fb");
        if (sel.dataset.k === b.dataset.k) {
          [sel, b].forEach(function (x) { x.classList.remove("sel"); x.classList.add("paired"); x.disabled = true; });
          made++; fb.className = "fb ok"; fb.innerHTML = '<b class="tick">✓</b> ' + esc(it.pairs[+b.dataset.k][0]) + " + " + esc(it.pairs[+b.dataset.k][1]);
        } else {
          errs++; var a = sel; [a, b].forEach(function (x) { x.classList.add("shake"); setTimeout(function () { x.classList.remove("shake"); }, 400); });
          a.classList.remove("sel"); fb.className = "fb hint"; fb.innerHTML = "Those two don’t go together. Try another.";
        }
        sel = null;
        if (made === it.pairs.length) { fb.className = "fb ok"; fb.innerHTML = '<b class="tick">✓ All matched</b>' + (errs ? " with " + errs + " wrong tr" + (errs > 1 ? "ies" : "y") + "." : " with no mistakes!") + (it.why ? "<p>" + it.why + "</p>" : ""); done(Math.max(0, 1 - errs / it.pairs.length)); }
      });
    }
  };

  /* =====================================================================
     REVIEW (spaced: 1, 3, 7 days)
     ===================================================================== */
  function reviewPage(all) {
    var keys = all ? Object.keys(S.review).filter(findItem) : dueItems();
    var total = Object.keys(S.review).filter(findItem).length;
    var html = '<div class="wrap narrow player"><p class="eyebrow">Spaced review</p><h1>Review</h1>';
    if (!keys.length) {
      var next = Object.keys(S.review).map(function (k) { return S.review[k].due; }).sort()[0];
      html += '<div class="stage"><p>' + (total ? "Nothing is due today. You have <b>" + total + "</b> item" + (total > 1 ? "s" : "") + " scheduled; the next ones are due on <b>" + next + "</b>." : "Nothing to review yet. When you get a question wrong in a unit, it’s saved here and comes back after 1, 3 and 7 days.") + '</p><div class="actions">' + (total ? '<button class="btn" type="button" id="early">Review all ' + total + " now</button>" : "") + '<a class="btn primary" href="#/">Go to the units</a></div></div></div>';
      app.innerHTML = html; if ($("#early")) $("#early").addEventListener("click", function () { reviewPage(true); }); focusTitle(); return;
    }
    keys = shuffle(keys).slice(0, 10);
    html += '<p class="muted">' + keys.length + " question" + (keys.length > 1 ? "s" : "") + " from units you’ve studied. Get one right and it comes back later; get it wrong and it comes back tomorrow.</p><div id=\"stage\"></div></div>";
    app.innerHTML = html; focusTitle();
    var stage = $("#stage"), i = 0, right = 0;
    (function next() {
      if (i >= keys.length) {
        save(); setNav("review");
        stage.innerHTML = '<div class="stage"><p class="small muted">Review finished</p><p class="big">' + right + " / " + keys.length + '</p><p>Nice work. Short, regular reviews like this help you remember for longer.</p><div class="actions"><a class="btn primary" href="#/">Back to the units</a></div></div>';
        return;
      }
      var k = keys[i], f = findItem(k);
      stage.innerHTML = '<div class="stage"><div class="stage-top"><span>' + esc(f.unit.title) + " · " + (i + 1) + " of " + keys.length + '</span><span class="bar" aria-hidden="true"><i style="width:' + pct(i, keys.length) + '%"></i></span></div>' + (f.item.ctx ? '<div class="reading" style="line-height:1.7;margin-bottom:14px">' + f.item.ctx + "</div>" : "") + '<div id="item"></div><div class="fb" id="fb" aria-live="polite"></div><div class="actions" id="nx" hidden><button class="btn primary" type="button">Next →</button></div></div>';
      RENDER[f.item.t]($("#item"), f.item, "check", function (s) {
        var r = S.review[k];
        if (s >= 1) { right++; r.box++; if (r.box >= REVIEW_GAPS.length) delete S.review[k]; else r.due = today(REVIEW_GAPS[r.box]); }
        else { r.box = 0; r.due = today(1); }
        save(); i++;
        var nx = $("#nx"); nx.hidden = false; var b = $("button", nx); b.addEventListener("click", next); b.focus({ preventScroll: true });
      });
    })();
  }

  /* =====================================================================
     PROGRESS
     ===================================================================== */
  function progressPage() {
    var done = D.units.filter(function (u) { var r = S.units[u.id]; return r && r.done; });
    var withScores = done.filter(function (u) { return S.units[u.id].pre != null && S.units[u.id].best != null; });
    var avg = function (f) { return withScores.length ? Math.round(withScores.reduce(function (a, u) { return a + f(S.units[u.id]); }, 0) / withScores.length) : 0; };
    var html = '<div class="wrap narrow player"><p class="eyebrow">Saved on this device</p><h1>My progress</h1>' +
      '<div class="statgrid"><div><b>' + done.length + " / " + D.units.length + '</b><span>units finished</span></div><div><b>' + (withScores.length ? avg(function (r) { return r.pre; }) + "%" : "–") + '</b><span>average first test</span></div><div><b>' + (withScores.length ? avg(function (r) { return r.best; }) + "%" : "–") + '</b><span>average second test</span></div><div><b>' + Object.keys(S.review).length + '</b><span>items in review</span></div></div>' +
      '<div class="panel tbl-wrap"><table class="prog"><thead><tr><th>Unit</th><th>Level</th><th>First test</th><th>Best second test</th><th></th></tr></thead><tbody>' +
      D.units.map(function (u) { var r = S.units[u.id] || {}; return "<tr><td>" + esc(u.title) + '</td><td><span class="lvl-tag" data-level="' + u.level + '">' + u.level + "</span></td><td>" + (r.pre != null ? r.pre + "%" : "–") + "</td><td>" + (r.best != null ? "<b>" + r.best + "%</b>" : "–") + '</td><td><a href="#/u/' + u.id + '">' + (r.done ? "Again" : r.max ? "Continue" : "Start") + "</a></td></tr>"; }).join("") +
      '</tbody></table></div><div class="actions"><button class="btn" type="button" id="copy">Copy summary</button><button class="btn" type="button" id="pr">Print</button><button class="btn ghost" type="button" id="clear">Clear my data</button></div><p class="small muted" id="msg" aria-live="polite"></p></div>';
    app.innerHTML = html; focusTitle();
    $("#copy").addEventListener("click", function () {
      var t = H.name + " – my progress (" + today() + ")\n" + D.units.filter(function (u) { return S.units[u.id] && S.units[u.id].pre != null; }).map(function (u) { var r = S.units[u.id]; return "- " + u.title + " (" + u.level + "): " + r.pre + "% → " + (r.best != null ? r.best + "%" : "not finished"); }).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $("#msg").textContent = "Copied."; }, function () { $("#msg").textContent = "Couldn’t copy. Please select the table and copy it yourself."; });
    });
    $("#pr").addEventListener("click", function () { window.print(); });
    $("#clear").addEventListener("click", function () { if (confirm("Delete all your progress in the " + H.name + " on this device? This can’t be undone.")) { var share = S.share; S = { v: 1, units: {}, review: {}, share: share }; save(); progressPage(); setNav("progress"); } });
  }

  /* =====================================================================
     WORD BANK (vocabulary hub)
     ===================================================================== */
  function wordsPage() {
    var html = '<div class="wrap player"><p class="eyebrow">All words and collocations</p><h1>Word bank</h1><p class="muted">Every word and collocation in the hub, with its meaning and an example. Tap a unit name to practise it.</p>' +
      '<div class="toolbar" style="position:relative;top:0"><label class="search"><span class="sr">Search words</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="wq" type="search" placeholder="Search, e.g. evidence, conduct" autocomplete="off"></label></div>';
    Object.keys(D.levels).forEach(function (l) {
      var us = D.units.filter(function (u) { return u.level === l && u.words; });
      if (!us.length) return;
      html += '<section class="lvl" data-level="' + l + '"><div class="lvl-head"><span class="lvl-tag">' + l + '</span><h2>' + esc(levelName(l)) + '</h2></div><div class="wb-list">' +
        us.map(function (u) { return u.words.map(function (w) { return '<div class="wb-item" data-s="' + esc((w.w + " " + w.m + " " + (w.ex || "")).toLowerCase()) + '"><b>' + esc(w.w) + "</b>" + esc(w.m) + (w.ex ? '<span class="ex">' + esc(w.ex) + "</span>" : "") + '<a class="small" href="#/u/' + u.id + '">' + esc(u.title) + "</a></div>"; }).join(""); }).join("") + "</div></section>";
    });
    html += "</div>";
    app.innerHTML = html; focusTitle();
    $("#wq").addEventListener("input", function (e) {
      var q = norm(e.target.value);
      $$(".lvl").forEach(function (s) { var v = 0; $$(".wb-item", s).forEach(function (w) { var ok = !q || w.dataset.s.indexOf(q) > -1; w.hidden = !ok; if (ok) v++; }); s.hidden = !v; });
    });
  }

  /* =====================================================================
     ABOUT + TEACHER CHECK PAGE
     ===================================================================== */
  function aboutPage() {
    var html = '<div class="wrap narrow player"><p class="eyebrow">About</p><h1>About the ' + esc(H.name) + '</h1>' +
      '<h2>How the units work</h2><p>Every unit uses <b>test–teach–test</b> with <b>guided discovery</b>. You try some questions first, so you can see what you already know. Then you <b>notice</b> the language in a short text, answer guiding questions to <b>work out the rule</b> yourself, and practise with hints. Finally you test yourself again, compare the two scores, and use the language in your own writing.</p>' +
      '<p>Questions you get wrong come back in <b>Review</b> after 1, 3 and 7 days (spaced repetition), which helps you remember them for longer.</p>' +
      '<h2>Levels</h2><p>Units are grouped by CEFR level (A2–C1). The levels are a guide, based on the English Grammar Profile, the English Vocabulary Profile and the Academic Word List. Choose by what you need, not only by level.</p>' +
      '<h2>Your privacy</h2><ul><li>No sign-in. Your progress is saved only in this browser, on this device (localStorage, key <code>' + KEY + '</code>).</li><li>You can delete it any time on <a href="#/progress">My progress</a> (“Clear my data”).</li>' +
      (API ? '<li><b>Anonymous score sharing</b> is ' + (S.share ? "on" : "off") + '. If it’s on, the only things sent are: the hub, the unit, its level, your first and second test scores, and the month (added by the server). No name, email, device ID or IP address is stored, and nothing you write is ever shared.</li>' +
        (AI_ON ? '<li><b>AI feedback</b> only runs when you press “Get AI feedback”. Your text is sent to Cloudflare Workers AI to create the feedback, then forgotten: it is not stored or logged.</li>' : "") : '<li>Nothing is sent anywhere: score sharing and AI feedback are switched off.</li>') + "</ul>" +
      (API ? '<label class="toggle"><input type="checkbox" id="share"' + (S.share ? " checked" : "") + '> Share my scores anonymously to help improve the hub</label>' : "") +
      '<h2 style="margin-top:1.2em">Content</h2><p>All texts and questions were written for this hub. Units marked “Draft content” have not been checked by Dave yet. Found a mistake? Email <a href="mailto:dave.naserbakht@gmail.com">dave.naserbakht@gmail.com</a>.</p>' +
      '<p class="small muted">Teachers: <a href="#/check">see every question with its answer</a>.</p></div>';
    app.innerHTML = html; focusTitle();
    var sh = $("#share"); if (sh) sh.addEventListener("change", function () { S.share = sh.checked; save(); });
  }
  function itemAnswer(it) {
    switch (it.t) {
      case "mcq": return it.o[it.a];
      case "gap": return it.a.map(esc).join(" / ");
      case "fix": return "<s>" + esc((it.s.match(/\{(.+?)\}/) || [])[1]) + "</s> → " + esc(it.c);
      case "order": return esc(it.a);
      case "sort": return it.bins.map(function (b, n) { return b + ": " + it.chips.filter(function (c) { return c[1] === n; }).map(function (c) { return esc(c[0]); }).join(", "); }).join(" | ");
      case "match": return it.pairs.map(function (p) { return esc(p[0]) + " + " + esc(p[1]); }).join("; ");
    }
    return "";
  }
  function checkPage() {
    var html = '<div class="wrap narrow player"><p class="eyebrow">For teachers</p><h1>All questions and answers</h1><p class="muted">Use this page to check the content. Students don’t see it in the menu.</p>';
    D.units.forEach(function (u) {
      html += '<section class="panel" style="margin:16px 0"><h2>' + esc(u.title) + ' <span class="lvl-tag" data-level="' + u.level + '">' + u.level + '</span></h2>';
      ["pre", "discover", "practice", "post"].forEach(function (sec) {
        html += "<h3>" + { pre: "Try it", discover: "Work it out", practice: "Practise", post: "Try again" }[sec] + '</h3><ol class="small">' + u[sec].map(function (it) { return "<li>[" + it.t + "] " + (it.q || it.s || it.instr || it.a || "").replace(/[{}]/g, "") + " <b>→ " + itemAnswer(it) + "</b>" + (it.why ? '<br><span class="muted">' + it.why + "</span>" : "") + "</li>"; }).join("") + "</ol>";
      });
      html += '<h3>Notice</h3><p class="small">' + u.notice.text.replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>") + "</p>" + ruleHtml(u) + '<h3>Use it</h3><p class="small">' + u.produce.task + "<br><i>" + u.produce.model + "</i></p></section>";
    });
    app.innerHTML = html + "</div>"; focusTitle();
  }
})();
