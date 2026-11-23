/* Level Check (B1–C1), davenab.com/level-check/
   A fixed-form placement test: 51 questions, 17 at each level (B1, B2, C1), in three parts:
   grammar (24), vocabulary and collocations (15) and short academic texts with gaps (12).
   Scoring: a level is "passed" with at least 11 of its 17 questions right (about 65%).
   The result is the highest level that is passed together with every level below it,
   so lucky guesses at a higher level cannot lift the result. "I don't know" reduces guessing.
   Pages: #/ (start or resume) #/test #/result #/teacher #/class #/key #/about
   Storage: localStorage "levelcheck-v1" on this device only. No server, no AI, nothing sent. */
(function () {
  "use strict";
  var KEY = "levelcheck-v1";
  var app = document.getElementById("app");
  var T = null, ITEMS = [], HUBS = { grammar: [], vocab: [] };
  var LEVELS = ["B1", "B2", "C1"];
  var PASS = 11, NEAR = 9; // of 17 per level

  var BANDS = {
    "Below B1": "You can understand and use common everyday English. Build a strong B1 base first: tenses, questions, articles and common word partners.",
    B1: "You can deal with familiar topics and simple academic texts, and connect ideas with basic linking words. Next: more complex sentences and academic word partners.",
    B2: "You can follow most academic texts and write clear, connected paragraphs. Next: precision, formal structures and academic collocations.",
    C1: "You can understand demanding academic texts and use complex structures flexibly. Next: accuracy under pressure, style and nuance."
  };
  var IELTS = { "Below B1": "below 4.0", B1: "about 4.0–5.0", B2: "about 5.5–6.5", C1: "about 7.0–8.0" };

  /* ---------- storage ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function on(sel, ev, fn) { var el = $(sel); if (el) el.addEventListener(ev, fn); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function focusTop() { var h = $("h1", app) || $("h2", app); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  function today() { return new Date().toISOString().slice(0, 10); }

  on("#theme", "click", function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ---------- load ---------- */
  Promise.all([
    fetch("data/test.json").then(function (r) { return r.json(); }),
    fetch("../grammar-hub/data/units.json").then(function (r) { return r.json(); }).catch(function () { return { units: [] }; }),
    fetch("../vocabulary-hub/data/units.json").then(function (r) { return r.json(); }).catch(function () { return { units: [] }; })
  ]).then(function (res) {
    T = res[0]; ITEMS = T.items; HUBS.grammar = res[1].units || []; HUBS.vocab = res[2].units || [];
    if (S && S.version !== T.version) S = null; // a new version of the test: start again
    window.addEventListener("hashchange", route); route();
  }).catch(function () { app.innerHTML = '<div class="wrap narrow player"><p class="notice">Sorry, the test could not be loaded. Please check your connection and reload.</p></div>'; });

  function setNav(r) { $$(".appnav a").forEach(function (a) { if (a.dataset.r === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function route() {
    var h = location.hash || "#/";
    if (h === "#/test" && S && !S.done) { setNav("home"); viewItem(); }
    else if (h === "#/result" && S && S.done) { setNav("home"); viewResult(); }
    else if (h === "#/teacher") { setNav("teacher"); viewTeacher(); }
    else if (h === "#/class") { setNav("teacher"); viewClass(); }
    else if (h === "#/key") { setNav("teacher"); viewKey(); }
    else if (h === "#/about") { setNav("about"); viewAbout(); }
    else { setNav("home"); viewStart(); }
  }

  /* =====================================================================
     START
     ===================================================================== */
  function viewStart() {
    var h = '<div class="wrap narrow player"><p class="eyebrow">Free · about 30 minutes · B1 to C1</p><h1>English level check</h1>' +
      '<p class="lead muted">51 questions in three parts: grammar, academic vocabulary, and short academic texts. You get your level (B1, B2 or C1), a skills profile, and the units to study next.</p>';
    if (S && !S.done) h += '<div class="panel continue"><div class="grow"><p class="small muted">You have a test in progress</p><p><b>Question ' + (S.i + 1) + " of " + ITEMS.length + '</b></p></div><a class="btn primary" href="#/test">Continue</a><button class="btn" type="button" id="restart">Start again</button></div>';
    if (S && S.done) h += '<div class="panel continue"><div class="grow"><p class="small muted">Your last result (' + esc(S.date) + ')</p><p><b>' + esc(S.result.label) + '</b></p></div><a class="btn primary" href="#/result">See my result</a></div>';
    h += '<div class="stage" style="margin-top:18px"><h2>Before you start</h2><ul>' +
      "<li>Find a quiet place. Allow about 30 minutes. Do it in one go if you can.</li>" +
      "<li>Don’t use a dictionary, a translator or AI. The result is only useful if it shows what <b>you</b> know.</li>" +
      "<li><b>If you don’t know, press “I don’t know”.</b> Guessing makes your result less accurate.</li>" +
      "<li>You can go back and change an answer before you finish. You won’t see right or wrong answers during the test.</li></ul>" +
      '<label class="q" for="nm" style="display:block;font-weight:700;margin:14px 0 6px">Your first name (optional: it is only shown on your result, on this device)</label><input class="input" id="nm" autocomplete="given-name" maxlength="40" value="' + esc((S && S.name) || "") + '">' +
      '<div class="actions"><button class="btn primary" type="button" id="go">' + (S && !S.done ? "Start a new test" : "Start the test") + "</button></div></div>" +
      '<p class="small muted" style="margin-top:14px">Teachers: <a href="#/teacher">how to use this test in a first lesson</a>.</p></div>';
    app.innerHTML = h;
    on("#go", "click", start); on("#restart", "click", start);
    focusTop();
  }
  function start() {
    var nm = ($("#nm") && $("#nm").value.trim()) || (S && S.name) || "";
    var order = {}; ITEMS.forEach(function (it) { order[it.id] = shuffle(it.o.map(function (_, k) { return k; })); });
    S = { version: T.version, name: nm.slice(0, 40), started: Date.now(), date: today(), i: 0, answers: {}, order: order, done: false };
    save(); location.hash = "#/test"; if (location.hash === "#/test") viewItem();
  }

  /* =====================================================================
     TEST
     ===================================================================== */
  function passageHtml(it) {
    var p = T.passages[it.passage];
    var txt = esc(p.text).replace(/\[(\d)\]/g, function (_, g) { return '<span class="gap' + (+g === it.gap ? " now" : "") + '">(' + g + ")" + (+g === it.gap ? " ▢" : "") + "</span>"; });
    return '<p class="small muted" style="margin:0 0 6px"><b>' + esc(p.title) + '</b></p><div class="lc-passage">' + txt + "</div>";
  }
  function viewItem() {
    var it = ITEMS[S.i], n = ITEMS.length, ord = S.order[it.id], ans = S.answers[it.id];
    var partStart = ITEMS.findIndex(function (x) { return x.part === it.part; });
    var intro = S.i === partStart ? '<p class="notice small" style="margin:0 0 12px">' + ({ grammar: "Choose the best answer to complete each sentence.", vocab: "Choose the word that fits best. Think about which words naturally go together.", reading: "Read the text. Choose the best word or phrase for the highlighted gap." }[it.part]) + "</p>" : "";
    app.innerHTML = '<div class="wrap narrow player"><div class="stage">' +
      '<div class="stage-top"><span>' + esc(T.parts[it.part]) + " · Question " + (S.i + 1) + " of " + n + '</span><span class="bar" aria-hidden="true"><i style="width:' + Math.round(100 * S.i / n) + '%"></i></span></div>' + intro +
      (it.passage ? passageHtml(it) + '<h1 class="instr" style="font-size:1.05rem">Gap (' + it.gap + "): choose the best answer.</h1>" : '<h1 class="q" style="font-weight:600">' + esc(it.q).replace(/___/g, '<span class="blank" aria-label="gap"></span>') + "</h1>") +
      '<div class="opts" role="group" aria-label="Answers">' + ord.map(function (k, m) { return '<button class="opt' + (ans === k ? " chosen" : "") + '" type="button" data-k="' + k + '" aria-pressed="' + (ans === k) + '"><span class="k" aria-hidden="true">' + "ABCD"[m] + "</span><span>" + esc(it.o[k]) + "</span></button>"; }).join("") +
      '<button class="opt idk' + (ans === -1 ? " chosen" : "") + '" type="button" data-k="-1" aria-pressed="' + (ans === -1) + '"><span class="k" aria-hidden="true">?</span><span>I don’t know</span></button></div>' +
      '<div class="lc-nav"><button class="btn" type="button" id="back"' + (S.i === 0 ? " disabled" : "") + '>← Back</button><button class="btn primary" type="button" id="next"' + (ans === undefined ? " disabled" : "") + ">" + (S.i + 1 < n ? "Next →" : "Finish and see my result") + "</button></div>" +
      "</div></div>";
    $$(".opt").forEach(function (b) {
      b.addEventListener("click", function () {
        S.answers[it.id] = +b.dataset.k; save();
        $$(".opt").forEach(function (x) { var c = x === b; x.classList.toggle("chosen", c); x.setAttribute("aria-pressed", c); });
        $("#next").disabled = false; $("#next").focus();
      });
    });
    on("#back", "click", function () { S.i--; save(); viewItem(); });
    on("#next", "click", function () {
      if (S.i + 1 < n) { S.i++; save(); viewItem(); }
      else finish();
    });
    document.onkeydown = function (e) {
      if ((location.hash || "") !== "#/test" || e.target.tagName === "INPUT") return;
      var k = "abcd".indexOf((e.key || "").toLowerCase());
      if (k > -1 && ord[k] !== undefined) { $$(".opt")[k].click(); }
      if (e.key === "?") $(".idk").click();
    };
    focusTop();
  }

  /* =====================================================================
     SCORING
     ===================================================================== */
  function score(answers) {
    var lv = {}, parts = {}, idk = 0;
    LEVELS.forEach(function (l) { lv[l] = 0; });
    ["grammar", "vocab", "reading"].forEach(function (p) { parts[p] = { right: 0, total: 0 }; });
    ITEMS.forEach(function (it) {
      var a = answers[it.id]; parts[it.part].total++;
      if (a === -1 || a === undefined) idk++;
      if (a === it.a) { lv[it.level]++; parts[it.part].right++; }
    });
    var per = ITEMS.length / LEVELS.length;
    var level = lv.B1 < PASS ? "Below B1" : lv.B2 < PASS ? "B1" : lv.C1 < PASS ? "B2" : "C1";
    var next = { "Below B1": "B1", B1: "B2", B2: "C1", C1: null }[level];
    var near = next && lv[next] >= NEAR;
    var flags = [];
    if ((lv.C1 >= PASS && lv.B2 < PASS) || (lv.B2 >= PASS && lv.B1 < PASS) || lv.C1 > lv.B1 + 3 || lv.B2 > lv.B1 + 4) flags.push("Higher-level answers were stronger than lower-level ones. This can happen with guessing or a lapse in focus. Treat the result with care: a short speaking or writing task will help confirm it.");
    if (idk > 25) flags.push("You used “I don’t know” many times. That is fine and honest, but the result may be slightly low if you knew more than you showed.");
    var label = level + (near ? " (approaching " + next + ")" : "");
    var pc = function (p) { return Math.round(100 * parts[p].right / parts[p].total); };
    return { level: level, near: !!near, next: next, label: label, perLevel: lv, per: per, parts: { g: pc("grammar"), v: pc("vocab"), r: pc("reading") }, idk: idk, flags: flags, total: LEVELS.reduce(function (a, l) { return a + lv[l]; }, 0) };
  }
  function finish() {
    var unanswered = ITEMS.filter(function (it) { return S.answers[it.id] === undefined; }).length;
    if (unanswered) { alert("Please answer every question (you can choose “I don’t know”)."); return; }
    S.result = score(S.answers); S.done = true; S.minutes = Math.max(1, Math.round((Date.now() - S.started) / 60000)); save();
    location.hash = "#/result";
  }
  function codeOf(s) { // e.g. LC1.B2+.14-12-7.G71-V60-R58.28
    var r = s.result;
    return T.version + "." + (r.level === "Below B1" ? "A2" : r.level) + (r.near ? "+" : "") + "." + r.perLevel.B1 + "-" + r.perLevel.B2 + "-" + r.perLevel.C1 + ".G" + r.parts.g + "-V" + r.parts.v + "-R" + r.parts.r + "." + s.minutes + (r.flags.length && r.flags[0].indexOf("Higher-level") === 0 ? ".!" : "");
  }

  /* =====================================================================
     RESULT
     ===================================================================== */
  function recs(level) {
    var want = level === "Below B1" ? ["A2", "B1"] : level === "C1" ? ["C1"] : [level, { B1: "B2", B2: "C1" }[level]];
    function list(hub, path) {
      return HUBS[hub].filter(function (u) { return want.indexOf(u.level) > -1 || (u.quick && level !== "C1"); }).slice(0, 6)
        .map(function (u) { return '<li><a href="../' + path + "/#/u/" + esc(u.id) + '">' + esc(u.title) + '</a> <span class="lvl-tag" data-level="' + esc(u.level) + '">' + esc(u.level) + "</span></li>"; }).join("");
    }
    return '<div class="panel" style="margin-top:14px"><h2>What to study next</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div><h3>Grammar Hub</h3><ul>' + list("grammar", "grammar-hub") + '</ul></div><div><h3>Vocabulary Hub</h3><ul>' + list("vocab", "vocabulary-hub") + "</ul></div></div></div>";
  }
  function viewResult() {
    var r = S.result, code = codeOf(S);
    var h = '<div class="wrap narrow player"><p class="eyebrow">Your result' + (S.name ? " · " + esc(S.name) : "") + " · " + esc(S.date) + '</p><div class="stage">' +
      '<p class="small muted" style="margin:0">Your level</p><p class="result-level">' + esc(r.level) + "</p>" +
      (r.near ? '<p><b>Approaching ' + r.next + ".</b> You are close to the next level.</p>" : "") +
      "<p>" + esc(BANDS[r.level]) + "</p>" +
      '<p class="small muted">For comparison, IELTS’s published guide places this level at an overall band of ' + IELTS[r.level] + ". This test checks grammar, vocabulary and reading only, so it can’t predict an IELTS score.</p>" +
      "<h2>Your scores by level</h2><div class=\"levelbars\">" + LEVELS.map(function (l) {
        var v = r.perLevel[l], pass = v >= PASS;
        return '<div class="lb"><span>' + l + '</span><span class="track" style="--m:' + Math.round(100 * PASS / r.per) + '%"><i style="width:' + Math.round(100 * v / r.per) + '%"></i></span><span class="pass">' + v + "/" + r.per + (pass ? " ✓" : "") + "</span></div>";
      }).join("") + '</div><p class="small muted">✓ = passed (at least ' + PASS + " of " + r.per + "). The dashed line shows the pass mark. Your level is the highest level you passed together with every level below it.</p>" +
      "<h2>Your skills profile</h2><ul><li>Grammar: <b>" + r.parts.g + "%</b></li><li>Vocabulary and collocations: <b>" + r.parts.v + "%</b></li><li>Reading academic texts: <b>" + r.parts.r + "%</b></li></ul>" +
      (r.flags.length ? '<div class="notice"><b>Please note:</b> ' + r.flags.map(esc).join(" ") + "</div>" : "") +
      '<p class="small muted" style="margin-top:12px">Answered “I don’t know”: ' + r.idk + " · Time: " + S.minutes + " minutes</p></div>" +
      '<div class="panel" style="margin-top:14px"><h2>Your result code</h2><p class="small">If your teacher asks for it, send this code. It contains only your scores, not your name.</p><p class="code" id="code">' + esc(code) + '</p><div class="actions lc-print-hide"><button class="btn primary" type="button" id="copy">Copy my result code</button><button class="btn" type="button" id="print">Print or save as PDF</button><a class="btn ghost" href="#/" id="again">Back to start</a></div><p class="small" id="msg" role="status"></p></div>' +
      recs(r.level) +
      '<p class="small muted" style="margin-top:14px">Want to check your progress? Take the test again after 6–8 weeks of study, not sooner: you will remember the questions.</p></div>';
    app.innerHTML = h;
    on("#copy", "click", function () {
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { $("#msg").textContent = "Copied."; }, function () { $("#msg").textContent = "Select the code above and copy it."; });
    });
    on("#print", "click", function () { window.print(); });
    focusTop();
  }

  /* =====================================================================
     TEACHERS
     ===================================================================== */
  function viewTeacher() {
    app.innerHTML = '<div class="wrap narrow player"><p class="eyebrow">For teachers</p><h1>Using the level check in a first lesson</h1>' +
      '<div class="stage"><h2>In class (about 40 minutes)</h2><ol>' +
      "<li>Share the link <b>davenab.com/level-check</b> (phones, tablets or laptops all work).</li>" +
      "<li>Explain the rules: no dictionaries, translators or AI; press “I don’t know” instead of guessing; about 30 minutes.</li>" +
      "<li>When students finish, they press <b>Copy my result code</b> and send it to you with their name (by chat, email, your LMS or a form). The code contains only scores.</li>" +
      '<li>Paste all the codes into the <a href="#/class">class summary</a> to see everyone’s level in one table, and copy it into a spreadsheet.</li></ol>' +
      "<h2>What it measures, and what it doesn’t</h2><ul>" +
      "<li>It checks <b>grammar</b>, <b>academic vocabulary and collocations</b>, and <b>reading at sentence and short-text level</b>, from B1 to C1. It does not test listening, speaking or extended writing.</li>" +
      "<li>For placement decisions, combine it with a short writing task and a speaking chat. The skills profile (grammar, vocabulary, reading) helps you spot uneven learners.</li></ul>" +
      "<h2>How the level is calculated</h2><ul>" +
      "<li>There are 17 questions at each level (B1, B2, C1). A level is passed with at least 11 of 17 (about 65%).</li>" +
      "<li>The result is the highest level passed <b>together with every level below it</b>. “Approaching” means at least 9 of 17 at the next level.</li>" +
      "<li>“Below B1” means fewer than 11 of 17 at B1. The test does not measure levels below B1 in detail.</li>" +
      "<li>A note appears (and the code ends in “.!”) when higher-level answers are clearly stronger than lower-level ones, which usually means guessing.</li></ul>" +
      "<h2>Making it accurate for your learners</h2><ul>" +
      "<li>This is a new test (marked as draft until it has been piloted). For best accuracy, try it with a few students whose level you already know (for example from a recent IELTS result) and tell Dave if the result seems too high or too low.</li>" +
      "<li>Everyone gets the same questions, so results can be compared across a class. Options appear in a different order for each student, which makes copying harder.</li>" +
      "<li>Wait at least 6–8 weeks before a retest; students remember items.</li></ul>" +
      '<div class="actions"><a class="btn primary" href="#/class">Open the class summary</a><a class="btn" href="#/key">See the answer key</a></div></div></div>';
    focusTop();
  }
  function parseCode(line) {
    var m = line.match(/LC\d+\.(A2|B1|B2|C1)(\+?)\.(\d+)-(\d+)-(\d+)\.G(\d+)-V(\d+)-R(\d+)\.(\d+)(\.!)?/);
    if (!m) return null;
    var name = line.slice(0, m.index).replace(/[:\-–,\t|]+\s*$/, "").trim();
    return { name: name || "(no name)", level: m[1] === "A2" ? "Below B1" : m[1], near: !!m[2], b1: +m[3], b2: +m[4], c1: +m[5], g: +m[6], v: +m[7], r: +m[8], min: +m[9], flag: !!m[10] };
  }
  function viewClass() {
    app.innerHTML = '<div class="wrap player"><p class="eyebrow">For teachers</p><h1>Class summary</h1><p class="muted">Paste one result per line, for example <code>Mina: LC1.B2+.14-12-9.G71-V60-R58.28</code>. Nothing is sent anywhere: this works only in your browser.</p>' +
      '<textarea id="codes" style="min-height:10em" placeholder="Mina: LC1.B2+.14-12-9.G71-V60-R58.28&#10;Omar: LC1.B1.12-8-4.G55-V47-R50.31"></textarea>' +
      '<div class="actions"><button class="btn primary" type="button" id="show">Show the class</button><button class="btn" type="button" id="csv" hidden>Copy as spreadsheet (CSV)</button></div><p class="small" id="msg" role="status"></p><div id="out"></div></div>';
    var rows = [];
    on("#show", "click", function () {
      var lines = $("#codes").value.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
      rows = lines.map(parseCode); var bad = rows.filter(function (x) { return !x; }).length; rows = rows.filter(Boolean);
      var count = {}; rows.forEach(function (x) { count[x.level] = (count[x.level] || 0) + 1; });
      $("#out").innerHTML = '<p><b>' + rows.length + " students.</b> " + ["Below B1", "B1", "B2", "C1"].map(function (l) { return l + ": " + (count[l] || 0); }).join(" · ") + (bad ? ' · <span class="flag">' + bad + " line(s) not recognised</span>" : "") + "</p>" +
        '<div class="tbl-wrap"><table class="lc-table"><thead><tr><th>Name</th><th>Level</th><th>B1</th><th>B2</th><th>C1</th><th>Grammar</th><th>Vocab</th><th>Reading</th><th>Min</th><th>Note</th></tr></thead><tbody>' +
        rows.slice().sort(function (a, b) { return (b.b1 + b.b2 + b.c1) - (a.b1 + a.b2 + a.c1); }).map(function (x) {
          return "<tr><td>" + esc(x.name) + "</td><td><b>" + esc(x.level) + (x.near ? "+" : "") + "</b></td><td>" + x.b1 + "/17</td><td>" + x.b2 + "/17</td><td>" + x.c1 + "/17</td><td>" + x.g + "%</td><td>" + x.v + "%</td><td>" + x.r + "%</td><td>" + x.min + "</td><td>" + (x.flag ? '<span class="flag">check: possible guessing</span>' : (x.min < 12 ? '<span class="flag">very fast</span>' : "")) + "</td></tr>";
        }).join("") + "</tbody></table></div><p class=\"small muted\">+ = approaching the next level.</p>";
      $("#csv").hidden = !rows.length;
    });
    on("#csv", "click", function () {
      var csv = ["Name,Level,Approaching next,B1 /17,B2 /17,C1 /17,Grammar %,Vocabulary %,Reading %,Minutes,Possible guessing"].concat(rows.map(function (x) { return ['"' + x.name.replace(/"/g, '""') + '"', x.level, x.near ? "yes" : "", x.b1, x.b2, x.c1, x.g, x.v, x.r, x.min, x.flag ? "yes" : ""].join(","); })).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(csv) : Promise.reject()).then(function () { $("#msg").textContent = "Copied. Paste it into Excel or Google Sheets."; }, function () { $("#msg").textContent = "Couldn’t copy automatically."; });
    });
    focusTop();
  }
  function viewKey() {
    app.innerHTML = '<div class="wrap player"><p class="eyebrow">For teachers</p><h1>Answer key</h1><p class="muted">Every question with its level and correct answer, in test order. Please don’t share this page with students.</p>' +
      Object.keys(T.passages).map(function (k) { return '<div class="panel" style="margin:12px 0"><h2>Text ' + k + ": " + esc(T.passages[k].title) + '</h2><p class="small">' + esc(T.passages[k].text) + "</p></div>"; }).join("") +
      '<div class="tbl-wrap"><table class="lc-table"><thead><tr><th>#</th><th>Part</th><th>Level</th><th>Question</th><th>Answer</th><th>Other options</th></tr></thead><tbody>' +
      ITEMS.map(function (it, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(it.part) + '</td><td><span class="lvl-tag" data-level="' + it.level + '">' + it.level + "</span></td><td>" + (it.passage ? "Text " + it.passage + ", gap " + it.gap : esc(it.q)) + "</td><td><b>" + esc(it.o[it.a]) + "</b></td><td class=\"muted\">" + it.o.filter(function (_, k) { return k !== it.a; }).map(esc).join(" · ") + "</td></tr>"; }).join("") +
      "</tbody></table></div></div>";
    focusTop();
  }
  function viewAbout() {
    app.innerHTML = '<div class="wrap narrow player"><p class="eyebrow">About</p><h1>About the level check</h1><div class="stage">' +
      "<p>This free test was written by Dave Nab, an EAP teacher and IELTS examiner, for university and IELTS students at about B1 to C1 (CEFR). Levels are guided by the English Grammar Profile, the English Vocabulary Profile and the Academic Word List.</p>" +
      "<ul><li>It checks grammar, vocabulary and collocations, and reading short academic texts. It does not test listening, speaking or extended writing.</li>" +
      "<li>Everyone gets the same 51 questions. A level is passed with at least 11 of its 17 questions right, and only counts if every level below it is passed too.</li>" +
      "<li>The test is new and is being piloted, so treat the result as a guide, not a certificate.</li>" +
      "<li>No sign-in. Your answers and result are saved only in this browser on this device. Nothing is sent to a server, and no AI is used.</li></ul></div></div>";
    focusTop();
  }
})();
