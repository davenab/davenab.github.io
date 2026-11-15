/* Grammar Self-Correction Trainer
   Plain JavaScript, no framework, no build step. Mode 1 makes no network calls
   except loading this app's own files (codes, links, practice texts). */
(function () {
  "use strict";

  var CFG = window.GSC_CONFIG || {};
  var KEY = CFG.storageKey || "gsc-v1";
  var MAX_WORDS = CFG.maxWords || 150;
  var PREVIEW = /[?&]preview=1(&|$)/.test(location.search);
  var AI_VISIBLE = !!CFG.aiEnabled || PREVIEW;   // Mode 2 is hidden unless switched on, or teacher preview
  var app = document.getElementById("app");

  /* ================= data ================= */
  var D = { codes: [], codeMap: {}, links: {}, texts: [], textMap: {}, issues: {} };

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  function loadData() {
    return Promise.all([getJSON("data/codes.json"), getJSON("data/links.json"), getJSON("texts/index.json")])
      .then(function (res) {
        D.codes = res[0].codes || [];
        D.codes.forEach(function (c) { D.codeMap[c.code] = c; });
        D.links = (res[1] && res[1].links) || {};
        var files = (res[2] && res[2].texts) || [];
        return Promise.all(files.map(function (f) {
          return getJSON("texts/" + f).then(function (t) { return prepareText(t, f); })
            .catch(function () { D.issues[f] = ["This file could not be read. Check the commas and brackets."]; return null; });
        }));
      }).then(function (texts) {
        D.texts = texts.filter(Boolean);
        D.texts.forEach(function (t) { D.textMap[t.id] = t; });
      });
  }

  // Check each error's position. If start/end are missing or wrong, find the wrong words in the text.
  function prepareText(t, file) {
    var issues = [], errs = [], from = 0;
    (t.errors || []).slice().sort(function (a, b) { return (a.start || 0) - (b.start || 0); }).forEach(function (e, i) {
      var s = e.start, en = e.end;
      if (typeof s !== "number" || t.text.slice(s, en) !== e.wrong) {
        var at = t.text.indexOf(e.wrong, from);
        if (at === -1) { issues.push("Error " + (i + 1) + ": the words \"" + e.wrong + "\" are not in the text. It was skipped."); return; }
        if (typeof s === "number") issues.push("Error " + (i + 1) + ": start/end did not match \"" + e.wrong + "\". The app found it at " + at + " instead.");
        s = at; en = at + e.wrong.length;
      }
      if (s < from) { issues.push("Error " + (i + 1) + " overlaps the error before it. It was skipped."); return; }
      if (!D.codeMap[e.code]) issues.push("Error " + (i + 1) + ": the code \"" + e.code + "\" is not in the code list.");
      if (!e.acceptedAnswers || !e.acceptedAnswers.length) issues.push("Error " + (i + 1) + " has no accepted answers.");
      errs.push({ start: s, end: en, wrong: e.wrong, code: e.code, acceptedAnswers: e.acceptedAnswers || [], ruleReminder: e.ruleReminder || "", explanation: e.explanation || "" });
      from = en;
    });
    var words = (t.text.match(/\S+/g) || []).length;
    if (words < 80 || words > 120) issues.push("The text has " + words + " words (aim for 80 to 120).");
    if (errs.length < 6 || errs.length > 8) issues.push("The text has " + errs.length + " errors (aim for 6 to 8).");
    if (issues.length) D.issues[t.id || file] = issues;
    return { id: t.id || file, title: t.title || "Untitled", topic: t.topic || "", level: t.level || "", verified: t.verified === true, text: t.text, errors: errs, file: file };
  }

  /* ================= storage (never required) ================= */
  var STORE_OK = true;
  function blank() { return { v: 1, sessions: [], rules: [] }; }
  var DB = blank();
  function loadDB() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); if (d && Array.isArray(d.sessions)) { DB = blank(); DB.sessions = d.sessions; DB.rules = Array.isArray(d.rules) ? d.rules : []; } }
      localStorage.setItem(KEY + "-test", "1"); localStorage.removeItem(KEY + "-test");
    } catch (e) { STORE_OK = false; }
  }
  function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(DB)); STORE_OK = true; } catch (e) { STORE_OK = false; } }

  /* ================= helpers ================= */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) {
    return String(s || "").replace(/[\u2018\u2019\u0060\u00b4]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/\s+/g, " ").replace(/\s+([,.;:?!])/g, "$1").trim().toLowerCase();
  }
  function code(c) { return D.codeMap[c] || { code: c, name: c, meaning: "", wrong: "", right: "", rule: "", fullHintEarly: false }; }
  function codeName(c) { return code(c).name; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function today() { try { return new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return new Date().toDateString(); } }
  function why(text) { return '<p class="why"><b>Why this helps</b>' + esc(text) + "</p>"; }
  function draftBadge(t) { return t.verified ? "" : ' <span class="badge draft" title="The teacher has not checked this text yet">Draft content</span>'; }
  function storeNote() { return STORE_OK ? "" : '<p class="notice small">Your browser is not saving progress right now. You can still practise, but your profile will be lost when you close this page.</p>'; }
  function timesDone(id) { return DB.sessions.filter(function (s) { return s.textId === id; }).length; }

  /* ================= routing ================= */
  var route = "";
  function parseRoute() { return (location.hash.replace(/^#\/?/, "").split("/")[0] || "home"); }
  window.addEventListener("hashchange", function () { render(true); });

  function setNav() {
    var nav = document.getElementById("appnav");
    if (AI_VISIBLE && !nav.querySelector('[data-r="mine"]')) {
      var a = document.createElement("a");
      a.href = "#/mine"; a.dataset.r = "mine"; a.textContent = PREVIEW && !CFG.aiEnabled ? "My writing (preview)" : "My own writing";
      nav.insertBefore(a, nav.children[1]);
    }
    nav.querySelectorAll("a").forEach(function (a) {
      var on = a.dataset.r === route || (a.dataset.r === "setup" && route === "session");
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function render(routeChanged) {
    var r = parseRoute();
    if (r === "mine" && !AI_VISIBLE) { location.replace("#/"); return; }
    if (r !== "mine") M = null;               // Mode 2: forget the pasted text when the student leaves
    if (r === "session" && !S) { location.replace("#/setup"); return; }
    route = r; setNav();
    var html;
    switch (r) {
      case "setup": html = viewSetup(); break;
      case "session": html = viewSession(S); break;
      case "profile": html = viewProfile(); break;
      case "codes": html = viewCodes(); break;
      case "about": html = viewAbout(); break;
      case "mine": html = viewMine(); break;
      case "teacher": html = viewTeacher(); break;
      default: route = "home"; html = viewHome();
    }
    app.innerHTML = '<div class="wrap page">' + html + "</div>";
    if (routeChanged) { window.scrollTo(0, 0); focusHeading(); }
  }
  function focusHeading() { var h = app.querySelector("h1"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
  function rerender(focusSel, scrollTop) {
    render(false);
    if (scrollTop) window.scrollTo(0, 0);
    var el = focusSel && app.querySelector(focusSel);
    if (el) { el.focus({ preventScroll: true }); if (!scrollTop) el.scrollIntoView({ block: "center" }); }
    else if (scrollTop) focusHeading();
  }

  /* ================= views: home, about, codes ================= */
  function viewHome() {
    var n = DB.sessions.length;
    return '<p class="eyebrow">Grammar practice for EAP</p>' +
      '<h1>Find and fix your own <em>grammar errors</em></h1>' +
      '<p class="lead">Your teacher marks errors with codes like VT or Art. This app helps you practise acting on them. It shows you where an error is. You do the fixing.</p>' +
      '<div class="btnrow"><a class="btn primary" href="#/setup">' + (n ? "Practise again" : "Start practising") + '</a><a class="btn" href="#/codes">Open the code key</a></div>' +
      storeNote() +
      '<div class="grid three" style="margin-top:28px">' +
      '<div class="card"><h2>1. Choose</h2><p class="muted">Pick one or two error types, or mixed practice. Then choose how much help you want.</p></div>' +
      '<div class="card"><h2>2. Fix</h2><p class="muted">Correct each error yourself. Ask for a hint only when you need one. Hints start small.</p></div>' +
      '<div class="card"><h2>3. Notice</h2><p class="muted">Write a rule in your own words. Your profile shows which errors you repeat.</p></div>' +
      "</div>" +
      (n ? '<p style="margin-top:20px"><a href="#/profile">See my error profile</a> (' + plural(n, "session") + " so far)</p>" : "") +
      why("When a teacher or an AI tool fixes your errors, you copy the fix and learn little. Finding and fixing errors yourself is the skill university writing needs.");
  }

  function viewAbout() {
    return '<h1>About this app</h1>' +
      '<div class="card"><h2>Hints, not corrections</h2><p>This app shows you where an error is and what type it is. It does not fix the error for you. Fixing your own errors is how you improve, because you have to think about the rule. If you are stuck, the hints give you a little more help each time. The answer comes last.</p></div>' +
      '<div class="card"><h2>Where the practice texts come from</h2><p>The practice paragraphs were drafted with AI and checked by the teacher. Texts marked <span class="badge draft">Draft content</span> have not been checked yet.</p><p>The app does not use AI when you practise. It compares your answer with a list of answers the teacher expects. If your answer is different, it may still be right, so you decide by comparing it with a model answer.</p></div>' +
      '<div class="card"><h2>What is stored, and where</h2><ul><li>Your results, your saved rules and your error profile are stored only in this browser on this device (localStorage).</li><li>Nothing is sent to a server. There is no sign-in, no tracking and no analytics.</li><li>If you use a shared computer, use <b>Clear my data</b> on your profile page when you finish.</li><li>Clearing your browser data also deletes your progress.</li></ul></div>' +
      (AI_VISIBLE ? '<div class="card"><h2>My own writing</h2><p>This part uses an AI service. AI suggestions can be wrong or miss errors. Your pasted text is not saved after the session. Check your course rules before using AI tools on assessed work.</p></div>' : "") +
      '<div class="card"><h2>Made by</h2><p>Dave Nab, EAP teacher. <a href="../apps/">More learning apps</a>.</p></div>';
  }

  function codeBlock(c, withLinks) {
    var links = (D.links[c.code] || []);
    return '<section class="code" id="code-' + esc(c.code === "^" ? "missing" : c.code) + '">' +
      '<h3><span class="codepill">' + esc(c.code) + "</span> " + esc(c.name) + "</h3>" +
      "<p>" + esc(c.meaning) + "</p>" +
      '<div class="ex"><span class="w">' + esc(c.wrong) + '</span><span class="r">' + esc(c.right) + "</span></div>" +
      '<p class="rule"><b>Remember:</b> ' + esc(c.rule) + "</p>" +
      (withLinks && links.length ? '<p class="small"><b>Study more:</b> ' + links.map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + "</a>"; }).join(" · ") + "</p>" : "") +
      "</section>";
  }
  function viewCodes() {
    return '<h1>Code key</h1><p class="lead">These are the codes your teacher uses. Each one tells you the type of error, not the answer.</p>' +
      '<div class="card">' + D.codes.map(function (c) { return codeBlock(c, true); }).join("") + "</div>" +
      why("When you know what each code means, you can fix errors in your own writing without waiting for the teacher.");
  }

  /* ================= setup ================= */
  var SETUP = { focus: [], level: "guide", textId: "" };

  function activeErrors(t, focus) { return t.errors.filter(function (e) { return !focus.length || focus.indexOf(e.code) !== -1; }); }

  function viewSetup() {
    var f = SETUP.focus;
    var list = D.texts.filter(function (t) { return activeErrors(t, f).length > 0; });
    if (SETUP.textId && !list.some(function (t) { return t.id === SETUP.textId; })) SETUP.textId = "";
    var chips = D.codes.map(function (c) {
      var on = f.indexOf(c.code) !== -1;
      return '<button type="button" class="chip" data-act="focus" data-code="' + esc(c.code) + '" aria-pressed="' + on + '"><b>' + esc(c.code) + "</b> " + esc(c.name) + "</button>";
    }).join("");
    var texts = '<ul class="textlist">' +
      '<li><button type="button" class="tile" data-act="text" data-id="" aria-pressed="' + (!SETUP.textId) + '"><b>Choose one for me</b><span>A text you have practised least.</span></button></li>' +
      list.map(function (t) {
        var n = activeErrors(t, f).length, d = timesDone(t.id);
        return '<li><button type="button" class="tile" data-act="text" data-id="' + esc(t.id) + '" aria-pressed="' + (SETUP.textId === t.id) + '"><b>' + esc(t.title) + "</b><span>" + esc(t.topic) + " · " + plural(n, "error") + " to fix" + (d ? " · done " + plural(d, "time") : "") + "</span>" + draftBadge(t) + "</button></li>";
      }).join("") + "</ul>";
    return '<h1>Set up your practice</h1>' +
      '<p class="muted">One session takes about 8 to 12 minutes.</p>' +
      '<fieldset><legend>1. What do you want to practise?</legend>' +
      '<div class="chips" style="margin-bottom:10px"><button type="button" class="chip" data-act="focus" data-code="" aria-pressed="' + (!f.length) + '"><b>Mixed</b> all error types</button></div>' +
      '<p class="hint-text" id="focusHelp">Or choose one or two codes:</p>' +
      '<div class="chips" aria-describedby="focusHelp">' + chips + "</div>" +
      (f.length === 2 ? '<p class="hint-text">You have chosen two codes. Tap one again to remove it.</p>' : "") +
      "</fieldset>" +
      '<fieldset><legend>2. How much help do you want?</legend><div class="tiles">' +
      '<button type="button" class="tile" data-act="level" data-level="guide" aria-pressed="' + (SETUP.level === "guide") + '"><b>Guide me</b><span>The errors are marked from the start.</span></button>' +
      '<button type="button" class="tile" data-act="level" data-level="hunt" aria-pressed="' + (SETUP.level === "hunt") + '"><b>Let me hunt</b><span>First, you find the errors. Then you see what you found and missed.</span></button>' +
      "</div></fieldset>" +
      '<fieldset><legend>3. Which text?</legend>' + (list.length ? texts : '<p class="notice">No texts have these codes yet. Choose different codes.</p>') + "</fieldset>" +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="start"' + (list.length ? "" : " disabled") + ">Start</button></div>" +
      why("Practising one or two error types at a time helps you notice the same pattern again and again.");
  }

  function pickText(focus) {
    var list = D.texts.filter(function (t) { return activeErrors(t, focus).length > 0; });
    if (!list.length) return null;
    list.sort(function (a, b) { return (timesDone(a.id) - timesDone(b.id)) || (activeErrors(b, focus).length - activeErrors(a, focus).length); });
    var best = list.filter(function (t) { return timesDone(t.id) === timesDone(list[0].id) && activeErrors(t, focus).length === activeErrors(list[0], focus).length; });
    return best[Math.floor(Math.random() * best.length)];
  }

  /* ================= session model (used by Mode 1 and Mode 2) ================= */
  var S = null;   // Mode 1 session
  var M = null;   // Mode 2 session (memory only, never stored)

  // Build the text the student sees. In focus mode, errors of other types are already corrected.
  function buildSession(t, focus, level, mode) {
    var display = "", errs = [], pos = 0, n = 0;
    t.errors.forEach(function (e) {
      display += t.text.slice(pos, e.start);
      var active = !focus.length || focus.indexOf(e.code) !== -1;
      if (active) {
        n++;
        errs.push({ n: n, ds: display.length, de: display.length + e.wrong.length, wrong: e.wrong, code: e.code,
          acceptedAnswers: e.acceptedAnswers, ruleReminder: e.ruleReminder, explanation: e.explanation,
          level: 1, tries: 0, status: "open", outcome: null, answer: e.wrong, final: null, self: false, found: false });
        display += e.wrong;
      } else display += e.acceptedAnswers[0] || e.wrong;
      pos = e.end;
    });
    display += t.text.slice(pos);
    var tokens = [], m, re = /\S+/g;
    while ((m = re.exec(display))) tokens.push({ s: m.index, e: m.index + m[0].length, w: m[0] });
    return { mode: mode, text: t, focus: focus.slice(), level: level, display: display, errs: errs, tokens: tokens,
      taps: {}, stage: mode === "ai" ? "fix" : "read", cur: 0, recorded: false, ruleSaved: false };
  }

  function chunks(X, finalText) {
    // split the display text into plain parts and error parts
    var out = [], pos = 0;
    X.errs.forEach(function (e, i) {
      if (e.ds > pos) out.push({ t: X.display.slice(pos, e.ds), s: pos });
      out.push({ i: i, t: finalText ? (e.final != null ? e.final : e.wrong) : e.wrong });
      pos = e.de;
    });
    if (pos < X.display.length) out.push({ t: X.display.slice(pos), s: pos });
    return out;
  }

  function hintLabel(X, e) {
    var full = code(e.code).fullHintEarly;
    if (e.level === 1) return full ? "Show me the code and the rule" : "Show me the code";
    if (e.level === 2) return full ? "Show me another example" : "Show me the rule";
    return X.mode === "ai" ? "Show me a suggestion" : "Show me the answer";
  }

  /* ================= session views ================= */
  function viewSession(X) {
    var t = X.text, head = "";
    if (X.mode === "practice") {
      head = '<div class="progressline"><span>' + esc(t.topic) + "</span><span>" + (X.focus.length ? "Focus: " + X.focus.map(esc).join(" + ") : "Mixed practice") + "</span><span>" + (X.level === "hunt" ? "Let me hunt" : "Guide me") + "</span>" + draftBadge(t) + "</div>";
    }
    switch (X.stage) {
      case "read": return head + viewRead(X);
      case "hunt": return head + viewHunt(X);
      case "huntResult": return head + viewHuntResult(X);
      case "fix": return head + viewFix(X);
      case "summary": return head + viewSummary(X);
      case "reflect": return head + viewReflect(X);
    }
    return "";
  }

  function viewRead(X) {
    return '<h1>' + esc(X.text.title) + "</h1>" +
      '<p class="lead">Read the paragraph once, just for meaning. Do not look for errors yet.</p>' +
      '<p class="para plain">' + esc(X.display) + "</p>" +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="readDone">' + (X.level === "hunt" ? "I have read it. Let me hunt" : "I have read it. Show the errors") + "</button></div>" +
      why("When you understand the message first, it is easier to notice where something sounds wrong.");
  }

  function viewHunt(X) {
    var html = "", pos = 0;
    X.tokens.forEach(function (tk, k) {
      html += esc(X.display.slice(pos, tk.s));
      html += '<button type="button" class="tok" data-act="tap" data-k="' + k + '" aria-pressed="' + (!!X.taps[k]) + '">' + esc(tk.w) + "</button>";
      pos = tk.e;
    });
    var nt = Object.keys(X.taps).length;
    return '<h1>Hunt for the errors</h1>' +
      '<p class="lead">There ' + (X.errs.length === 1 ? "is 1 error" : "are " + X.errs.length + " errors") + " in this paragraph" + (X.focus.length ? " (" + X.focus.map(esc).join(" and ") + ")" : "") + ". Tap the words you think are wrong. Tap again to undo.</p>" +
      '<p class="para" aria-label="Paragraph. Each word is a button.">' + html + "</p>" +
      '<p class="hint-text" aria-live="polite">You have tapped ' + plural(nt, "word") + ".</p>" +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="huntDone">I have finished looking</button><button type="button" class="btn" data-act="openKey">Code key</button></div>' +
      why("Looking for errors yourself trains the skill you need when you check your own writing.");
  }

  function huntScore(X) {
    var found = 0, falseTaps = [];
    X.errs.forEach(function (e) { e.found = false; });
    Object.keys(X.taps).forEach(function (k) {
      var tk = X.tokens[k], hit = false;
      X.errs.forEach(function (e) { if (tk.s < e.de && tk.e > e.ds) { e.found = true; hit = true; } });
      if (!hit) falseTaps.push(+k);
    });
    X.errs.forEach(function (e) { if (e.found) found++; });
    X.hunt = { found: found, total: X.errs.length, falseTaps: falseTaps.length, falseList: falseTaps };
  }

  function viewHuntResult(X) {
    var h = X.hunt, html = "", falseSet = {};
    h.falseList.forEach(function (k) { falseSet[k] = 1; });
    chunks(X, false).forEach(function (c) {
      if (c.i == null) {
        var part = c.t, base = c.s, pos = 0;
        X.tokens.forEach(function (tk, k) {
          if (!falseSet[k] || tk.s < base || tk.e > base + part.length) return;
          html += esc(part.slice(pos, tk.s - base)) + '<span class="falsetap">' + esc(tk.w) + "</span>";
          pos = tk.e - base;
        });
        html += esc(part.slice(pos));
      } else {
        var e = X.errs[c.i];
        html += '<span class="mk static ' + (e.found ? "found" : "missed") + '"><span class="n">' + e.n + "</span>" + esc(e.wrong) + "</span>";
      }
    });
    return '<h1>You found ' + h.found + " of " + h.total + "</h1>" +
      '<p class="lead">' + (h.found === h.total ? "Excellent. You found every error." : "The marks show the errors you found and the ones you missed.") +
      (h.falseTaps ? " " + plural(h.falseTaps, "word") + " you tapped " + (h.falseTaps === 1 ? "was" : "were") + " not one of the planted errors." : "") + "</p>" +
      '<p class="para">' + html + "</p>" +
      '<p class="legend"><span>Underline + number + "found": you found it</span><span>Dashed underline + "missed": you missed it</span><span>Dashed box: not an error</span></p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="startFix">Start fixing</button></div>' +
      why("Seeing what you found and missed shows you which errors you do not notice yet.");
  }

  function markHTML(X, e, i) {
    var cls = "mk", label = "Error " + e.n;
    if (e.status === "done") { cls += e.outcome === "kept" ? " kept" : " done"; label += ", done"; }
    if (i === X.cur && e.status !== "done") { cls += " cur"; label += ", selected"; }
    var showCode = e.level >= 2 || e.status === "done";
    if (showCode) label += ", code " + e.code + " " + codeName(e.code);
    var txt = e.status === "done" ? (e.final != null ? e.final : e.wrong) : e.wrong;
    return '<button type="button" class="' + cls + '" data-act="pick" data-i="' + i + '" aria-label="' + esc(label + ": " + txt) + '"><span class="n" aria-hidden="true">' + e.n + "</span>" + esc(txt) +
      (showCode ? '<span class="c" aria-hidden="true">' + esc(e.code) + "</span>" : "") + "</button>";
  }

  function paraWithMarks(X) {
    return '<p class="para">' + chunks(X, false).map(function (c) { return c.i == null ? esc(c.t) : markHTML(X, X.errs[c.i], c.i); }).join("") + "</p>";
  }

  function viewFix(X) {
    var done = X.errs.filter(function (e) { return e.status === "done"; }).length;
    var e = X.errs[X.cur];
    var top = X.mode === "ai"
      ? '<h1>Fix your errors</h1><p class="notice strong"><b>AI suggestions. They can be wrong or miss errors.</b></p>'
      : "<h1>" + esc(X.text.title) + "</h1>";
    var dots = '<div class="progressline"><span>' + done + " of " + X.errs.length + ' fixed</span><span class="dots" aria-hidden="true">' + X.errs.map(function (x) { return "<i" + (x.status === "done" ? ' class="d"' : "") + "></i>"; }).join("") + "</span></div>";
    if (!X.errs.length) {
      return top + '<p class="para plain">' + esc(X.display) + "</p>" +
        '<p class="notice">The AI did not suggest any errors this time. This does not mean your text is error-free. Check it again yourself, using the code key.</p>' +
        '<div class="btnrow"><button type="button" class="btn primary" data-act="mineAgain">Try another paragraph</button><button type="button" class="btn" data-act="openKey">Code key</button></div>';
    }
    return top + dots +
      '<p class="hint-text">Tap a numbered error to work on it.</p>' + paraWithMarks(X) +
      '<div class="card panel" id="panel">' + panelHTML(X, e) + "</div>" +
      '<div class="btnrow"><button type="button" class="btn" data-act="openKey" data-code="' + esc(e.code) + '">Code key</button></div>' +
      why("Fixing an error yourself helps you remember the rule. That is why the hints start small.");
  }

  function hintsHTML(X, e) {
    var c = code(e.code), full = c.fullHintEarly, out = "";
    if (e.level >= 2) {
      out += '<div class="hintbox"><span class="lbl">Hint: the code</span><p><span class="codepill">' + esc(e.code) + "</span> <b>" + esc(c.name) + ".</b> " + esc(c.meaning) + "</p>";
      if (full) out += "<p><b>Rule:</b> " + esc(e.ruleReminder || c.rule) + "</p>";
      out += "</div>";
    }
    if (e.level >= 3) {
      out += '<div class="hintbox"><span class="lbl">Hint: ' + (full ? "another example" : "the rule") + "</span>" +
        (full ? "" : "<p>" + esc(e.ruleReminder || c.rule) + "</p>") +
        (c.wrong ? '<div class="ex"><span class="w">' + esc(c.wrong) + '</span><span class="r">' + esc(c.right) + "</span></div>" : "") + "</div>";
    }
    return out;
  }

  function answerHTML(e) {
    var a = e.acceptedAnswers[0];
    return (a != null ? "<p><b>" + (e.outcome === "revealed" && !e.self ? "Answer" : "Model answer") + ":</b> " + esc(a) + "</p>" : "") +
      (e.explanation ? "<p>" + esc(e.explanation) + "</p>" : "");
  }

  function panelHTML(X, e) {
    var i = X.cur, head = '<h2 id="panelTitle" tabindex="-1">Error ' + e.n + " of " + X.errs.length + ": <q>" + esc(e.wrong) + "</q></h2>";
    var next = nextOpen(X, i);
    var nextBtn = next === -1
      ? '<button type="button" class="btn primary" data-act="toSummary">See my summary</button>'
      : '<button type="button" class="btn primary" data-act="next">Next error</button>';

    if (e.status === "done") {
      var msg;
      if (e.outcome === "fixed") msg = '<div class="fb good" role="status"><b>Yes, that works.</b> ' + esc(e.final) + "</div>" + (e.explanation ? "<p>" + esc(e.explanation) + "</p>" : "");
      else if (e.outcome === "self") msg = '<div class="fb" role="status">Good. You checked your answer against the rule.</div>' + answerHTML(e);
      else if (e.outcome === "kept") msg = '<div class="fb" role="status">OK. You kept your original words. AI suggestions can be wrong.</div>';
      else msg = '<div class="fb" role="status">Here is the answer. Read the explanation, then try to say the rule in your own words.</div>' + answerHTML(e);
      return head + hintsHTML(X, e) + msg + '<div class="btnrow">' + nextBtn + "</div>";
    }

    if (e.awaitSelf) {
      var hasModel = e.acceptedAnswers.length > 0;
      return head + hintsHTML(X, e) +
        '<div class="fb" role="status">' + (hasModel ? "This is not one of the answers I expected. Here is a model answer." : "I cannot check this one automatically.") + "</div>" +
        "<p><b>Your answer:</b> " + esc(e.answer) + "</p>" +
        (hasModel ? "<p><b>Model answer:</b> " + esc(e.acceptedAnswers[0]) + "</p>" : "") +
        '<p id="selfQ"><b>' + (hasModel ? "Does yours mean the same and follow the rule?" : "Does yours follow the rule?") + "</b></p>" +
        '<div class="btnrow" role="group" aria-labelledby="selfQ"><button type="button" class="btn primary" data-act="selfYes">Yes, mine works</button><button type="button" class="btn" data-act="selfNo">No, mine was wrong</button></div>';
    }

    var fb = "";
    if (e.tries === 1) fb = '<div class="fb" role="status">This is not one of the answers I expected. Look again and have one more try.</div>';
    var canAnswer = !(X.mode === "ai" && e.level === 3 && e.tries === 0);
    var hintBtn = '<button type="button" class="btn" data-act="hint"' + (canAnswer ? "" : " disabled") + ">" + esc(hintLabel(X, e)) + (X.mode === "ai" ? "" : " (hint " + (e.level + 1) + " of 4)") + "</button>";
    return head +
      (e.level === 1 ? '<p class="muted small">The error is marked. ' + (X.mode === "ai" ? "" : "Try to fix it with no more help.") + "</p>" : "") +
      hintsHTML(X, e) +
      '<form data-form="check" autocomplete="off">' +
      '<label class="q" for="ans">What should this be?</label>' +
      '<input type="text" id="ans" name="ans" value="' + esc(e.answer) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="ansHelp">' +
      '<p class="hint-text" id="ansHelp">Change the marked words so they are correct. Type the whole marked part.</p>' +
      fb +
      '<div class="btnrow"><button type="submit" class="btn primary">Check my answer</button>' + hintBtn +
      (X.mode === "ai" ? '<button type="button" class="btn" data-act="keep">I think this is correct</button>' : "") + "</div>" +
      (canAnswer ? "" : '<p class="hint-text">Try once first. Then you can see a suggestion.</p>') +
      "</form>";
  }

  function nextOpen(X, from) {
    for (var k = 1; k <= X.errs.length; k++) { var j = (from + k) % X.errs.length; if (X.errs[j].status !== "done") return j; }
    return -1;
  }

  function bucket(e) {
    if (e.outcome === "kept") return "kept";
    if (e.outcome === "revealed") return "revealed";
    return e.level <= 1 ? "none" : e.level === 2 ? "code" : "rule";
  }

  function viewSummary(X) {
    var b = { none: 0, code: 0, rule: 0, revealed: 0, kept: 0 };
    var isAI = X.mode === "ai";
    X.errs.forEach(function (e) { b[bucket(e)]++; });
    var orig = "", fixed = "";
    chunks(X, true).forEach(function (c) {
      if (c.i == null) { orig += esc(c.t); fixed += esc(c.t); return; }
      var e = X.errs[c.i];
      orig += '<span class="del">' + esc(e.wrong) + "<sup>" + e.n + "</sup></span>";
      // Practice: show the model answer. Mode 2: show the student's own fixes (there is no model paragraph).
      var model = isAI ? (e.final != null ? e.final : e.wrong) : (e.acceptedAnswers[0] || e.wrong);
      fixed += '<span class="ins">' + esc(model) + "<sup>" + e.n + "</sup></span>";
    });
    var rows = X.errs.map(function (e) {
      var how = { none: "No hint", code: "With the code", rule: "With the rule", revealed: "Answer shown", kept: "Kept as it was" }[bucket(e)];
      return "<tr><td>" + e.n + "</td><td>" + esc(e.code) + "</td><td>" + esc(e.wrong) + " → " + esc(e.final != null ? e.final : "") + "</td><td>" + how + "</td></tr>";
    }).join("");
    var huntLine = X.hunt ? '<p>In the hunt, you found <b>' + X.hunt.found + " of " + X.hunt.total + "</b> errors" + (X.hunt.falseTaps ? " and tapped " + plural(X.hunt.falseTaps, "word") + " that " + (X.hunt.falseTaps === 1 ? "was" : "were") + " not errors" : "") + ".</p>" : "";
    return "<h1>Your summary</h1>" + huntLine +
      '<div class="tally"><div><b>' + b.none + "</b><span>fixed with no hint</span></div><div><b>" + b.code + "</b><span>fixed with the code only</span></div><div><b>" + b.rule + "</b><span>fixed with the rule</span></div><div><b>" + b.revealed + "</b><span>answer shown</span></div></div>" +
      (isAI && b.kept ? '<p class="small muted" style="margin-top:8px">You kept ' + plural(b.kept, "suggestion") + " as it was.</p>" : "") +
      '<div class="compare" style="margin-top:18px"><div><h2>' + (isAI ? "Your paragraph" : "Original") + '</h2><p class="para plain">' + orig + '</p></div><div><h2>' + (isAI ? "With your fixes" : "Corrected") + '</h2><p class="para plain">' + fixed + "</p></div></div>" +
      '<div class="tablewrap" style="margin-top:16px"><table><caption class="sr">Each error and how you fixed it</caption><thead><tr><th>#</th><th>Code</th><th>Your change</th><th>Help used</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="btnrow">' + (isAI ? '<button type="button" class="btn primary" data-act="mineAgain">Try another paragraph</button>' : '<button type="button" class="btn primary" data-act="toReflect">Next: write your rule</button>') + "</div>" +
      why("Seeing how much help you needed shows what you already know and what to practise next.");
  }

  function viewReflect(X) {
    var codesHere = uniq(X.errs.map(function (e) { return e.code; }));
    if (X.ruleSaved) {
      return "<h1>Rule saved</h1><p>Well done. You finished this text.</p>" +
        '<div class="btnrow"><a class="btn primary" href="#/setup">Practise another text</a><a class="btn" href="#/profile">See my error profile</a></div>' +
        why("Coming back to your own rules before you write helps you avoid the same errors.");
    }
    return "<h1>Write your rule</h1>" +
      '<form data-form="rule"><label class="q" for="rule">Write one rule you want to remember, in your own words.</label>' +
      '<p class="hint-text" id="ruleHelp">For example: "After has, I use the past participle: has become, not has became." Codes in this text: ' + codesHere.map(esc).join(", ") + ".</p>" +
      '<textarea id="rule" name="rule" maxlength="400" aria-describedby="ruleHelp" autocorrect="on" spellcheck="true"></textarea>' +
      '<div class="btnrow"><button type="submit" class="btn primary">Save my rule</button><button type="button" class="linkbtn" data-act="skipRule">Skip this time</button></div></form>' +
      storeNote() +
      why("Writing a rule in your own words helps you remember it and use it next time you write.");
  }

  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function recordSession(X) {
    if (X.recorded || X.mode !== "practice") return;
    X.recorded = true;
    DB.sessions.push({
      date: Date.now(), textId: X.text.id, title: X.text.title, focus: X.focus, level: X.level,
      results: X.errs.map(function (e) { return { c: e.code, h: e.level, o: e.outcome }; }),
      hunt: X.hunt ? { found: X.hunt.found, total: X.hunt.total, falseTaps: X.hunt.falseTaps } : null
    });
    saveDB();
  }

  /* ================= profile ================= */
  // Help points per error: 0 = no hint, 1 = code, 2 = rule, 3 = answer shown.
  function stats() {
    var s = {};
    DB.sessions.forEach(function (ss) {
      (ss.results || []).forEach(function (r) {
        var x = s[r.c] || (s[r.c] = { code: r.c, n: 0, help: 0, rev: 0, none: 0 });
        var pts = r.o === "revealed" ? 3 : Math.max(0, Math.min(3, (r.h || 1) - 1));
        x.n++; x.help += pts; if (r.o === "revealed") x.rev++; if (pts === 0) x.none++;
      });
    });
    var list = Object.keys(s).map(function (k) { var x = s[k]; x.avg = x.help / x.n; return x; });
    list.sort(function (a, b) { return (b.avg - a.avg) || (b.n - a.n); });
    return list;
  }
  function weakCodes() { return stats().filter(function (x) { return x.avg > 0; }).slice(0, 3); }

  function viewProfile() {
    var st = stats(), weak = weakCodes(), n = DB.sessions.length;
    if (!n && !DB.rules.length) {
      return "<h1>My error profile</h1>" + storeNote() + '<p class="lead">Your profile is empty. Finish a practice text and your results will appear here.</p><div class="btnrow"><a class="btn primary" href="#/setup">Start practising</a></div>' +
        why("Seeing your patterns helps you check for your own common errors when you write.");
    }
    var total = 0, none = 0;
    st.forEach(function (x) { total += x.n; none += x.none; });
    var bars = '<ul class="bars">' + st.map(function (x) {
      var pct = Math.round(x.avg / 3 * 100);
      return '<li><span class="codepill">' + esc(x.code) + '</span><span class="meter" role="img" aria-label="' + esc(codeName(x.code)) + ": average help " + x.avg.toFixed(1) + ' out of 3"><i style="width:' + pct + '%"></i></span>' +
        '<span class="meta">' + esc(codeName(x.code)) + " · " + plural(x.n, "error") + " · average help " + x.avg.toFixed(1) + " of 3" + (x.rev ? " · answer shown " + plural(x.rev, "time") : "") + "</span></li>";
    }).join("") + "</ul>";
    var weakHTML = weak.length ? "<ol>" + weak.map(function (x) {
      var c = code(x.code), links = D.links[x.code] || [];
      return "<li><b>" + esc(x.code) + " · " + esc(c.name) + "</b><br><span class=\"muted\">" + esc(c.rule) + "</span>" +
        (links.length ? '<br><span class="small">Study: ' + links.slice(0, 2).map(function (l) { return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + "</a>"; }).join(" · ") + "</span>" : "") + "</li>";
    }).join("") + "</ol>" : "<p>You have not needed hints so far. Try <b>Let me hunt</b> for a bigger challenge.</p>";
    var rules = DB.rules.length ? '<ul class="rules">' + DB.rules.slice().reverse().map(function (r) {
      return '<li><span class="when">' + esc(r.d) + (r.c && r.c.length ? " · " + r.c.map(esc).join(", ") : "") + "</span><br>" + esc(r.t) + "</li>";
    }).join("") + "</ul>" : '<p class="muted">No rules saved yet.</p>';
    return "<h1>My error profile</h1>" + storeNote() +
      "<p>" + plural(n, "session") + " · " + plural(total, "error") + " fixed · " + none + " with no hint</p>" +
      '<div class="card"><h2>Top three to work on</h2>' + weakHTML + "</div>" +
      '<div class="card"><h2>Which codes needed the most help</h2><p class="small muted">Help per error: no hint = 0, code = 1, rule = 2, answer shown = 3.</p>' + (st.length ? bars : "<p>No results yet.</p>") + "</div>" +
      '<div class="card"><h2>My rules</h2>' + rules + "</div>" +
      '<div class="btnrow">' + (weak.length ? '<button type="button" class="btn primary" data-act="weak">Practise my weak areas</button>' : "") +
      '<button type="button" class="btn" data-act="copy">Copy summary</button><button type="button" class="btn" data-act="print">Print</button><button type="button" class="btn" data-act="clear">Clear my data</button></div>' +
      '<p class="hint-text" id="copyMsg" role="status"></p>' +
      why("Seeing your patterns helps you check for your own common errors when you write.");
  }

  function summaryText() {
    var st = stats(), weak = weakCodes(), lines = ["My grammar error profile (Grammar Self-Correction Trainer)", "Date: " + today(), "Sessions: " + DB.sessions.length, ""];
    lines.push("Average help per code (0 = no hint, 3 = answer shown):");
    st.forEach(function (x) { lines.push("- " + x.code + " " + codeName(x.code) + ": " + x.avg.toFixed(1) + " (" + plural(x.n, "error") + ")"); });
    if (weak.length) { lines.push("", "Top areas to work on:"); weak.forEach(function (x, i) { lines.push((i + 1) + ". " + x.code + " " + codeName(x.code)); }); }
    if (DB.rules.length) { lines.push("", "My rules:"); DB.rules.forEach(function (r) { lines.push("- " + r.t); }); }
    return lines.join("\n");
  }

  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } finally { document.body.removeChild(ta); }
    });
  }

  /* ================= Mode 2: my own writing ================= */
  function wordCount(s) { return (s.match(/\S+/g) || []).length; }
  function viewMine() {
    var demo = !CFG.aiEnabled;
    var banner = demo ? '<p class="banner" role="note">Demo only, not real feedback. This preview uses sample data.</p>' : "";
    if (M && M.stage !== "paste") return banner + viewSession(M);
    var txt = demo ? window.GSC_AI.SAMPLE.text : (M && M.draft) || "";
    var wc = wordCount(txt);
    return banner + "<h1>My own writing</h1>" +
      '<p class="notice strong"><b>Check your course rules before using AI tools on assessed work.</b></p>' +
      '<p class="lead">Paste one paragraph (up to ' + MAX_WORDS + " words). The app marks possible errors with codes. It does not rewrite your paragraph. You do the fixing.</p>" +
      '<form data-form="mine"><label class="q" for="mineText">Your paragraph</label>' +
      '<textarea id="mineText" name="mineText" rows="7" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="mineCount"' + (demo ? " readonly" : "") + ">" + esc(txt) + "</textarea>" +
      '<p class="hint-text" id="mineCount" aria-live="polite">' + wc + " of " + MAX_WORDS + " words." + (demo ? " In the preview, the sample paragraph is used." : "") + "</p>" +
      '<div class="btnrow"><button type="submit" class="btn primary" id="mineGo"' + (wc > MAX_WORDS || !wc ? " disabled" : "") + ">Mark my errors</button></div>" +
      '<p class="hint-text" id="mineMsg" role="status"></p></form>' +
      "<p class=\"small muted\">Your paragraph is not saved. It is deleted when you leave this page or start again.</p>" +
      why("Marks without corrections make you do the thinking, which is how you learn to check your own work.");
  }

  function startMine(text) {
    var codes = D.codes.map(function (c) { return c.code; });
    var msg = app.querySelector("#mineMsg");
    var p;
    if (!CFG.aiEnabled) {
      var s = window.GSC_AI.SAMPLE;
      p = Promise.resolve(window.GSC_AI.validate(s.text, s, codes));
      text = s.text;
    } else {
      if (msg) msg.textContent = "Checking… this can take a few seconds.";
      p = window.GSC_AI.requestFeedback(text, codes);
    }
    p.then(function (errs) {
      if (route !== "mine") return;
      var t = { id: "mine", title: "My own writing", topic: "", verified: true, text: text, errors: errs };
      M = buildSession(t, [], "guide", "ai");
      rerender(null, true);
    }).catch(function () {
      if (msg) msg.textContent = "Sorry, the hints could not be loaded. Please try again later.";
    });
  }

  /* ================= teacher check page (#/teacher) ================= */
  function viewTeacher() {
    var html = "<h1>Teacher: check the practice texts</h1>" +
      '<p class="lead">This page is not linked for students. Use it to check each text and its answers before you set "verified": true.</p>' +
      "<p>" + D.texts.length + " texts loaded · " + D.texts.filter(function (t) { return t.verified; }).length + " verified.</p>";
    Object.keys(D.issues).forEach(function (k) { if (!D.textMap[k]) html += '<p class="issue">' + esc(k) + ": " + D.issues[k].map(esc).join(" ") + "</p>"; });
    D.texts.forEach(function (t) {
      var X = buildSession(t, [], "guide", "practice");
      X.errs.forEach(function (e) { e.final = e.acceptedAnswers[0]; });
      var orig = "", fixed = "";
      chunks(X, true).forEach(function (c) {
        if (c.i == null) { orig += esc(c.t); fixed += esc(c.t); return; }
        var e = X.errs[c.i];
        orig += '<span class="del">' + esc(e.wrong) + "<sup>" + e.n + " " + esc(e.code) + "</sup></span>";
        fixed += '<span class="ins">' + esc(e.final) + "<sup>" + e.n + "</sup></span>";
      });
      var issues = D.issues[t.id];
      html += '<div class="card" id="t-' + esc(t.id) + '"><h2>' + esc(t.title) + " <span class=\"badge\">" + esc(t.file) + "</span>" + (t.verified ? ' <span class="badge">verified</span>' : draftBadge(t)) + "</h2>" +
        '<p class="small muted">' + esc(t.topic) + " · " + wordCount(t.text) + " words · " + plural(t.errors.length, "error") + " · codes: " + uniq(t.errors.map(function (e) { return e.code; })).map(esc).join(", ") + "</p>" +
        (issues ? '<p class="issue">Problems: ' + issues.map(esc).join(" ") + "</p>" : '<p class="small">Positions checked: all match.</p>') +
        '<div class="compare"><div><h3>With errors</h3><p class="para plain">' + orig + '</p></div><div><h3>Corrected</h3><p class="para plain">' + fixed + "</p></div></div>" +
        '<div class="tablewrap"><table><thead><tr><th>#</th><th>Code</th><th>Wrong</th><th>Accepted answers</th><th>Rule reminder / explanation</th></tr></thead><tbody>' +
        X.errs.map(function (e) { return "<tr><td>" + e.n + "</td><td>" + esc(e.code) + "</td><td>" + esc(e.wrong) + "</td><td>" + e.acceptedAnswers.map(esc).join("<br>") + "</td><td>" + esc(e.ruleReminder) + "<br><span class=\"muted\">" + esc(e.explanation) + "</span></td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    });
    return html;
  }

  /* ================= events ================= */
  function cur() { return route === "mine" ? M : S; }

  var ACT = {
    focus: function (b) {
      var c = b.dataset.code, f = SETUP.focus;
      if (!c) SETUP.focus = [];
      else if (f.indexOf(c) !== -1) f.splice(f.indexOf(c), 1);
      else { if (f.length >= 2) f.shift(); f.push(c); }
      rerender('[data-act="focus"][data-code="' + cssEsc(c) + '"]');
    },
    level: function (b) { SETUP.level = b.dataset.level; rerender('[data-act="level"][data-level="' + b.dataset.level + '"]'); },
    text: function (b) { SETUP.textId = b.dataset.id; rerender('[data-act="text"][data-id="' + cssEsc(b.dataset.id) + '"]'); },
    start: function () {
      var t = SETUP.textId ? D.textMap[SETUP.textId] : pickText(SETUP.focus);
      if (!t) return;
      S = buildSession(t, SETUP.focus, SETUP.level, "practice");
      if (location.hash === "#/session") rerender(null, true); else location.hash = "#/session";
    },
    readDone: function () {
      var X = cur(); X.stage = X.level === "hunt" ? "hunt" : "fix"; rerender(null, true);
    },
    tap: function (b) {
      var X = cur(), k = b.dataset.k;
      if (X.taps[k]) delete X.taps[k]; else X.taps[k] = 1;
      b.setAttribute("aria-pressed", !!X.taps[k]);
      var n = Object.keys(X.taps).length, live = app.querySelector(".hint-text[aria-live]");
      if (live) live.textContent = "You have tapped " + plural(n, "word") + ".";
    },
    huntDone: function () { var X = cur(); huntScore(X); X.stage = "huntResult"; rerender(null, true); },
    startFix: function () { var X = cur(); X.stage = "fix"; X.cur = 0; rerender(null, true); },
    pick: function (b) {
      var X = cur(); X.cur = +b.dataset.i;
      var e = X.errs[X.cur];
      rerender(e.status === "done" || e.awaitSelf ? "#panelTitle" : "#ans");
    },
    hint: function () {
      var X = cur(), e = X.errs[X.cur];
      if (e.level >= 4) return;
      e.level++;
      if (e.level === 4) {
        e.status = "done"; e.outcome = "revealed"; e.final = e.acceptedAnswers[0] != null ? e.acceptedAnswers[0] : e.wrong;
        rerender("#panelTitle");
      } else rerender("#ans");
    },
    selfYes: function () { var X = cur(), e = X.errs[X.cur]; e.awaitSelf = false; e.status = "done"; e.outcome = "self"; e.self = true; e.final = e.answer; rerender("#panelTitle"); },
    selfNo: function () { var X = cur(), e = X.errs[X.cur]; e.awaitSelf = false; e.status = "done"; e.outcome = "revealed"; e.self = true; e.final = e.acceptedAnswers[0] != null ? e.acceptedAnswers[0] : e.wrong; rerender("#panelTitle"); },
    keep: function () { var X = cur(), e = X.errs[X.cur]; e.status = "done"; e.outcome = "kept"; e.final = e.wrong; rerender("#panelTitle"); },
    next: function () { var X = cur(), j = nextOpen(X, X.cur); if (j !== -1) X.cur = j; rerender("#ans"); },
    toSummary: function () { var X = cur(); X.stage = "summary"; recordSession(X); rerender(null, true); },
    toReflect: function () { var X = cur(); X.stage = "reflect"; rerender("#rule", true); },
    skipRule: function () { var X = cur(); X.ruleSaved = true; rerender(null, true); },
    openKey: function (b) { openKey(b.dataset.code); },
    weak: function () {
      SETUP.focus = weakCodes().slice(0, 2).map(function (x) { return x.code; });
      SETUP.textId = ""; location.hash = "#/setup";
    },
    copy: function () {
      var msg = app.querySelector("#copyMsg");
      copyText(summaryText()).then(function () { if (msg) msg.textContent = "Copied. You can paste it into an email or a document."; })
        .catch(function () { if (msg) msg.textContent = "Sorry, copying did not work in this browser."; });
    },
    print: function () { window.print(); },
    clear: function () {
      if (!window.confirm("Delete all your results and saved rules from this device? This cannot be undone.")) return;
      DB = blank(); try { localStorage.removeItem(KEY); } catch (e) {}
      S = null; rerender(null, true);
    },
    mineAgain: function () { M = null; rerender(null, true); }
  };

  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"); }

  app.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]");
    if (!b || !app.contains(b) || b.disabled) return;
    var f = ACT[b.dataset.act];
    if (f) { ev.preventDefault(); f(b, ev); }
  });

  app.addEventListener("submit", function (ev) {
    var form = ev.target, kind = form.dataset.form;
    ev.preventDefault();
    if (kind === "check") {
      var X = cur(), e = X.errs[X.cur], val = form.ans.value;
      if (!val.trim()) { form.ans.focus(); return; }
      e.answer = val;
      var ok = e.acceptedAnswers.some(function (a) { return norm(a) === norm(val); });
      if (ok) { e.status = "done"; e.outcome = "fixed"; e.final = val.trim().replace(/\s+/g, " "); rerender("#panelTitle"); return; }
      e.tries++;
      if (e.tries >= 2 || !e.acceptedAnswers.length) e.awaitSelf = true;
      rerender(e.awaitSelf ? "#panelTitle" : "#ans");
    } else if (kind === "rule") {
      var t = form.rule.value.trim();
      if (!t) { form.rule.focus(); return; }
      var Y = cur();
      DB.rules.push({ d: today(), t: t.slice(0, 400), c: uniq(Y.errs.map(function (x) { return x.code; })), title: Y.text.title });
      saveDB(); Y.ruleSaved = true; rerender(null, true);
    } else if (kind === "mine") {
      var txt = form.mineText.value.trim();
      if (!txt || wordCount(txt) > MAX_WORDS) return;
      startMine(txt);
    }
  });

  app.addEventListener("input", function (ev) {
    if (ev.target.id !== "mineText") return;
    var wc = wordCount(ev.target.value), c = app.querySelector("#mineCount"), go = app.querySelector("#mineGo");
    if (c) c.textContent = wc + " of " + MAX_WORDS + " words." + (wc > MAX_WORDS ? " Please shorten your paragraph." : "");
    if (go) go.disabled = wc > MAX_WORDS || !wc;
  });

  /* code key dialog (keeps your place in a session) */
  var dlg = document.getElementById("keyDlg");
  function openKey(c) {
    var body = document.getElementById("keyDlgBody");
    body.innerHTML = D.codes.map(function (x) { return codeBlock(x, false); }).join("");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    var target = c && body.querySelector("#code-" + (c === "^" ? "missing" : cssEsc(c)));
    if (target) target.scrollIntoView({ block: "start" });
  }
  document.getElementById("keyDlgClose").addEventListener("click", function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg && dlg.close) dlg.close(); });

  /* theme toggle (same "theme" key as davenab.com) */
  document.getElementById("theme").addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ================= start ================= */
  loadDB();
  loadData().then(function () { render(false); })
    .catch(function () {
      app.innerHTML = '<div class="wrap page"><h1>Sorry, the app could not load</h1><p>Please check your internet connection and reload the page. If you opened the file directly from your computer, open it from the website instead.</p></div>';
    });
})();
