/* Dictogloss Trainer (davenab.com/dictogloss/)
   Plain JavaScript, no framework, no build step. Progress in localStorage on this device only.
   Live feedback: the shared helper /assets/ai.js posts to Dave's Cloudflare Worker route /dictogloss
   (_tools/cloudflare/worker.js). No API key in this repo. The Worker does not store or log student text.

   One session (about 12–18 min):
   ready → listen1 → listen2 (notes) → write → predict → feedback (AI #1 or self-check) → revise (+ optional AI #2)
   → compare (label differences; optional 3rd listen) → reflect (goal) → done
   Pages: #/  #/s (current session)  #/progress  #/about */
(function () {
  "use strict";
  var KEY = "dictogloss-v1";        // history, disagreements, last goal
  var DKEY = "dictogloss-draft-v1"; // the session in progress (saved as the student types)
  var MAX_WORDS = 250;
  var FEEDBACK_TIMEOUT = 20000;
  var app = document.getElementById("app");

  var CODES = {
    VT: "Verb tense", VF: "Verb form", SVA: "Subject–verb agreement", Art: "Article (a, an, the)", Pl: "Plural or singular noun",
    Prep: "Preposition", WF: "Word form (noun, verb, adjective, adverb)", WC: "Word choice", WO: "Word order", P: "Punctuation",
    SS: "Sentence structure", "^": "Something is missing", X: "Something is not needed"
  };
  var GSC = ["Grammar Self-Correction Trainer", "../grammar-self-correction/"];
  var STUDY = {
    VT: ["Present perfect or past simple? (Grammar Hub)", "../grammar-hub/#/u/present-perfect-past-simple"],
    VF: ["The passive voice (Grammar Hub)", "../grammar-hub/#/u/passive-voice"],
    SVA: GSC, Art: GSC, Prep: GSC, WO: GSC, P: GSC, "^": GSC, X: GSC,
    Pl: ["Much, many, a few, a little (Grammar Hub)", "../grammar-hub/#/u/much-many"],
    WF: ["Nominalisation and Hedging Trainer", "../nominalisation-hedging-trainer/"],
    WC: ["Vocabulary Hub", "../vocabulary-hub/"],
    SS: ["Relative clauses (Grammar Hub)", "../grammar-hub/#/u/relative-clauses"]
  };
  var WHY = {
    ready: "Knowing the topic and a few key words first helps your brain predict what is coming.",
    listen1: "Listening without writing lets you follow the whole message first, not single words.",
    listen2: "Short notes help you remember the ideas, but you can’t write everything, so you choose what matters.",
    write: "Rebuilding the passage makes you use grammar to connect ideas, which is what you do when you summarise at university.",
    predict: "Guessing first, then checking, trains you to notice what you really understood.",
    feedback: "Hints, not answers, make you do the thinking. That is how the skill grows.",
    revise: "Fixing your own text helps you remember the grammar and the ideas much better than reading a correction.",
    compare: "Comparing your version with the original helps you notice grammar words you didn’t hear, like articles and endings.",
    reflect: "One clear goal for next time turns practice into progress."
  };
  var STAGES = ["ready", "listen1", "listen2", "write", "predict", "feedback", "revise", "compare", "reflect"];
  var STAGE_NAMES = { ready: "Get ready", listen1: "Listen 1", listen2: "Listen 2", write: "Write", predict: "Predict", feedback: "Feedback", revise: "Revise", compare: "Compare", reflect: "Reflect" };

  /* ---------- storage ---------- */
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var S = load(KEY, { v: 1, history: [], disagree: [], goal: "" });
  var D = load(DKEY, null); // session draft
  function save() { store(KEY, S); }
  function saveDraft() { store(DKEY, D); }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function words(t) { var m = String(t || "").trim().match(/\S+/g); return m ? m.length : 0; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function why(stage) { return WHY[stage] ? '<p class="why"><b>Why this helps:</b> ' + WHY[stage] + "</p>" : ""; }
  function focusTop() { var h = $("h1", app) || $("h2", app); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: false }); } window.scrollTo(0, 0); }
  function on(sel, ev, fn) { var el = $(sel); if (el) el.addEventListener(ev, fn); }
  function fmtKept(k) { return (Math.round(k * 2) / 2).toString().replace(".5", "½"); }

  /* ---------- theme ---------- */
  on("#theme", "click", function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ---------- data ---------- */
  var INDEX = [], CACHE = {};
  function getPassage(id) {
    if (CACHE[id]) return Promise.resolve(CACHE[id]);
    return fetch("data/passages/" + encodeURIComponent(id) + ".json").then(function (r) { if (!r.ok) throw new Error("load"); return r.json(); })
      .then(function (p) { CACHE[id] = p; return p; });
  }
  fetch("data/index.json").then(function (r) { return r.json(); }).then(function (d) {
    INDEX = d.passages || [];
    window.addEventListener("hashchange", route);
    route();
  }).catch(function () { app.innerHTML = '<div class="wrap page"><p class="notice">Sorry, the passages could not be loaded. Please check your connection and reload the page.</p></div>'; });

  function setNav(r) { $$(".appnav a").forEach(function (a) { if (a.dataset.r === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function route() {
    Player.stop();
    var h = location.hash || "#/";
    if (h === "#/progress") { setNav("progress"); viewProgress(); }
    else if (h === "#/about") { setNav("about"); viewAbout(); }
    else if (h === "#/s" && D) { setNav("home"); viewSession(); }
    else { setNav("home"); viewHome(); }
  }

  /* =====================================================================
     AUDIO: an MP3 if the passage has audioFile, otherwise the browser's speech synthesis.
     Play/pause only. No rewind. Speed: normal (1) or easier (0.85).
     ===================================================================== */
  var Player = (function () {
    var audio = null, utterIdx = 0, sentences = [], playing = false, paused = false, stopped = true, onEnd = null, onChange = null, rate = 1, voice = null;
    var synth = window.speechSynthesis || null;
    function pickVoice() {
      if (!synth) return null;
      var v = synth.getVoices().filter(function (x) { return /^en(-|_|$)/i.test(x.lang); });
      var pref = ["en-AU", "en-GB", "en-NZ", "en-IE", "en-US"];
      for (var i = 0; i < pref.length; i++) {
        var m = v.filter(function (x) { return x.lang.replace("_", "-").toLowerCase() === pref[i].toLowerCase(); });
        if (m.length) { var good = m.filter(function (x) { return /natural|neural|google|premium|enhanced/i.test(x.name); }); return (good[0] || m[0]); }
      }
      return v[0] || null;
    }
    function voicesReady(cb) {
      if (!synth) return cb(false);
      if (synth.getVoices().length) return cb(true);
      var done = false;
      function fin() { if (done) return; done = true; cb(synth.getVoices().length > 0); }
      try { synth.addEventListener("voiceschanged", fin, { once: true }); } catch (e) { synth.onvoiceschanged = fin; }
      setTimeout(fin, 2500);
    }
    function speakFrom(i) {
      if (stopped || paused) return;
      if (i >= sentences.length) { playing = false; stopped = true; if (onChange) onChange(); if (onEnd) onEnd(); return; }
      utterIdx = i;
      var u = new SpeechSynthesisUtterance(sentences[i]);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-AU";
      u.rate = rate === 1 ? 0.95 : 0.8;
      u.onend = function () { if (!paused && !stopped) speakFrom(i + 1); };
      u.onerror = function (e) { if (e && (e.error === "interrupted" || e.error === "canceled")) return; playing = false; stopped = true; if (onChange) onChange("error"); };
      synth.speak(u);
    }
    return {
      mode: function (p) { return p && p.audioFile ? "mp3" : "tts"; },
      // iOS Safari only allows speech that starts inside a tap: speak a silent sound straight away to unlock it.
      unlock: function (p) { if (p.audioFile || !synth) return; try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) {} },
      check: function (p, cb) { if (p.audioFile) return cb(true); voicesReady(cb); },
      isPlaying: function () { return playing; },
      isPaused: function () { return paused; },
      start: function (p, opts) {
        this.stop();
        rate = opts.rate || 1; onEnd = opts.onEnd; onChange = opts.onChange;
        stopped = false; paused = false; playing = true;
        if (p.audioFile) {
          audio = new Audio("audio/" + p.audioFile);
          audio.playbackRate = rate; audio.preservesPitch = true;
          audio.addEventListener("ended", function () { playing = false; stopped = true; if (onChange) onChange(); if (onEnd) onEnd(); });
          audio.addEventListener("error", function () { playing = false; stopped = true; if (onChange) onChange("error"); });
          var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { playing = false; stopped = true; if (onChange) onChange("blocked"); });
        } else {
          voice = pickVoice();
          sentences = p.text.match(/[^.!?]+[.!?]+["”’]?\s*/g) || [p.text];
          synth.cancel();
          speakFrom(0);
        }
        if (onChange) onChange();
      },
      pause: function () {
        if (!playing) return;
        paused = true; playing = false;
        if (audio) audio.pause(); else if (synth) synth.cancel(); // speech restarts the current sentence on resume (no rewind beyond it)
        if (onChange) onChange();
      },
      resume: function () {
        if (!paused) return;
        paused = false; playing = true;
        if (audio) audio.play(); else speakFrom(utterIdx);
        if (onChange) onChange();
      },
      stop: function () {
        stopped = true; playing = false; paused = false;
        if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
        if (synth) try { synth.cancel(); } catch (e) {}
      }
    };
  })();

  /* =====================================================================
     HOME: choose a passage
     ===================================================================== */
  function viewHome() {
    var h = '<div class="wrap page"><h1>Dictogloss Trainer</h1><p class="muted">Listen to a short academic talk, take notes, then rebuild it in your own sentences. About 15 minutes.</p>';
    if (S.goal) h += '<div class="goalbox"><b>Your goal from last time:</b> ' + esc(S.goal) + "</div>";
    if (D) {
      var p0 = INDEX.filter(function (x) { return x.id === D.id; })[0];
      h += '<div class="card"><p style="margin:0 0 8px"><b>You have a session in progress:</b> ' + esc(p0 ? p0.title : D.id) + " · " + STAGE_NAMES[D.stage] + '</p><div class="row"><a class="btn primary" href="#/s">Continue</a><button class="btn" type="button" id="discard">Start again</button></div></div>';
    }
    h += '<h2>Choose a passage</h2><div class="plist">' + INDEX.map(function (p) {
      return '<article class="card pcard"><h3>' + esc(p.title) + "</h3>" +
        '<p class="meta">' + esc(p.topic) + " · about " + p.words + " words · " + esc(p.level) + (p.verified ? "" : ' · <span class="draft">Draft content</span>') + "</p>" +
        "<p class=\"small\" style=\"margin:0\"><b>Listen for:</b> " + p.targetGrammar.map(esc).join(", ") + "</p>" +
        '<button class="btn primary" type="button" data-start="' + esc(p.id) + '">Start<span class="sr">: ' + esc(p.title) + "</span></button></article>";
    }).join("") + "</div></div>";
    app.innerHTML = h;
    $$("[data-start]").forEach(function (b) { b.addEventListener("click", function () { startSession(b.dataset.start); }); });
    on("#discard", "click", function () { D = null; saveDraft(); viewHome(); });
    focusTop();
  }
  function startSession(id) {
    D = { id: id, stage: "ready", rate: 1, listens: 0, heard: 0, third: false, notes: "", paper: false, text1: "", text2: "", predicted: null,
      fb1: null, fb2: null, fbUsed: 0, self: [], labels: {}, gpStep: {}, started: today() };
    saveDraft(); if (location.hash === "#/s") viewSession(); else location.hash = "#/s";
  }
  function go(stage) { Player.stop(); D.stage = stage; saveDraft(); viewSession(); }

  /* =====================================================================
     SESSION
     ===================================================================== */
  function viewSession() {
    getPassage(D.id).then(function (p) { renderStage(p); }).catch(function () {
      app.innerHTML = '<div class="wrap page"><p class="notice">This passage could not be loaded. <a href="#/">Choose another passage</a>.</p></div>';
    });
  }
  function header(p) {
    var i = STAGES.indexOf(D.stage);
    return '<p class="steplabel">' + esc(p.title) + " · Step " + (i + 1) + " of " + STAGES.length + ": " + STAGE_NAMES[D.stage] + (p.verified ? "" : ' · <span class="draft">Draft content</span>') + "</p>" +
      '<div class="steps" aria-hidden="true">' + STAGES.map(function (s, k) { return '<span class="' + (k < i ? "done" : k === i ? "now" : "") + '"></span>'; }).join("") + "</div>";
  }
  function renderStage(p) {
    var fn = { ready: stReady, listen1: stListen, listen2: stListen, write: stWrite, predict: stPredict, feedback: stFeedback, revise: stRevise, compare: stCompare, reflect: stReflect }[D.stage];
    fn(p);
  }

  /* 1–2 Get ready */
  function stReady(p) {
    app.innerHTML = '<div class="wrap page">' + header(p) + '<h1>' + esc(p.title) + "</h1>" +
      '<div class="card"><h2>Key words</h2><ul class="terms">' + p.keyTerms.map(function (t) { return "<li><b>" + esc(t.term) + "</b>" + esc(t.definition) + "</li>"; }).join("") + "</ul>" +
      '<h2>Listen for this grammar</h2><p>' + esc(p.targetGrammar.listenFor) + "</p></div>" +
      '<div class="card"><h2>Listening speed</h2><div class="speed" role="radiogroup" aria-label="Listening speed">' +
      '<label><input type="radio" name="rate" value="1"' + (D.rate === 1 ? " checked" : "") + "> Normal</label>" +
      '<label><input type="radio" name="rate" value="0.85"' + (D.rate !== 1 ? " checked" : "") + "> Easier (0.85×)</label></div>" +
      '<p class="small muted" style="margin:10px 0 0">You will hear the passage twice. You can pause, but you can’t go back.</p><p class="small" id="audioMsg" role="status"></p></div>' +
      '<div class="actions"><button class="btn primary big" type="button" id="next">I’m ready: go to Listen 1</button><a class="btn" href="#/">Choose another passage</a></div>' + why("ready") + "</div>";
    $$('input[name="rate"]').forEach(function (r) { r.addEventListener("change", function () { D.rate = Number(r.value); saveDraft(); }); });
    Player.check(p, function (ok) {
      if (!ok) $("#audioMsg").innerHTML = "<b>Your device has no English voice for reading the passage aloud.</b> Try another browser (Chrome, Edge or Safari), or turn on an English voice in your device’s language settings.";
    });
    on("#next", "click", function () { go("listen1"); });
    focusTop();
  }

  /* 3–4 Listen 1 and 2 */
  function stListen(p) {
    var second = D.stage === "listen2";
    var n = second ? 2 : 1;
    var doneThis = D.heard >= n;
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Listen " + n + " of 2</h1>" +
      (second ? '<p>Now write <b>key words only</b>: content words, numbers and names. Use any language, symbols (→ = ↑) or short forms. You can also write on paper.</p>'
              : "<p><b>Just listen.</b> Don’t write anything yet. Try to follow the main message.</p>") +
      '<div class="card player"><p class="listen-status" id="ls" role="status"></p><div class="row"><button class="btn primary big" type="button" id="play"></button></div>' +
      '<p class="small muted" style="margin:0">Speed: ' + (D.rate === 1 ? "normal" : "easier (0.85×)") + ". You can pause, but you can’t go back.</p><p class=\"small\" id=\"audioMsg\" role=\"alert\"></p></div>" +
      (second ? '<div class="card"><label class="q" for="notes">My notes (key words only)</label><textarea id="notes" class="notes" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="e.g. trees → shade → cooler">' + esc(D.notes) + "</textarea>" +
        '<label class="row small" style="margin-top:8px"><input type="checkbox" id="paper"' + (D.paper ? " checked" : "") + ' style="width:20px;height:20px"> I’m taking notes on paper</label></div>' : "") +
      '<div class="actions"><button class="btn primary" type="button" id="next"' + (doneThis ? "" : " disabled") + ">" + (second ? "Next: write the passage" : "Next: Listen 2") + "</button></div>" + why(D.stage) + "</div>";
    var playBtn = $("#play");
    function paint(err) {
      var playing = Player.isPlaying(), paused = Player.isPaused();
      if (D.heard >= n && !playing && !paused) { playBtn.textContent = "Listen " + n + " finished"; playBtn.disabled = true; $("#ls").textContent = "✓ Listen " + n + " finished."; $("#next").disabled = false; }
      else if (playing) { playBtn.textContent = "⏸ Pause"; playBtn.disabled = false; $("#ls").textContent = "▶ Playing listen " + n + "…"; }
      else if (paused) { playBtn.textContent = "▶ Continue"; playBtn.disabled = false; $("#ls").textContent = "⏸ Paused."; }
      else { playBtn.textContent = "▶ Play listen " + n; playBtn.disabled = false; $("#ls").textContent = "Press play when you are ready."; }
      if (err === "error") $("#audioMsg").textContent = "The audio couldn’t play on this device. Try another browser, or ask your teacher for the recording.";
      if (err === "blocked") $("#audioMsg").textContent = "Your browser blocked the sound. Tap Play again.";
    }
    playBtn.addEventListener("click", function () {
      if (Player.isPlaying()) return Player.pause();
      if (Player.isPaused()) return Player.resume();
      Player.unlock(p);
      Player.check(p, function (ok) {
        if (!ok) { $("#audioMsg").innerHTML = "<b>Your device has no English voice for reading the passage aloud.</b> Try another browser (Chrome, Edge or Safari), or turn on an English voice in your device’s language settings."; return; }
        D.listens = Math.max(D.listens, n); saveDraft();
        Player.start(p, { rate: D.rate, onChange: paint, onEnd: function () { D.heard = Math.max(D.heard, n); saveDraft(); paint(); $("#next").focus(); } });
      });
    });
    if (second) {
      on("#notes", "input", function (e) { D.notes = e.target.value; saveDraft(); });
      on("#paper", "change", function (e) { D.paper = e.target.checked; saveDraft(); });
    }
    on("#next", "click", function () { go(second ? "write" : "listen2"); });
    paint();
    focusTop();
  }

  /* 5 Reconstruct */
  function stWrite(p) {
    var target = words(p.text);
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>What did you hear?</h1><p>Write it in full sentences. Keep the ideas and how they connect. Your own words are fine.</p>" +
      (D.notes.trim() ? '<details class="notes-peek" open><summary>My notes</summary><div class="notes-text">' + esc(D.notes) + "</div></details>" : "") +
      '<div class="card"><label class="q" for="w">My version of the passage</label><textarea id="w" class="write" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' + esc(D.text1) + "</textarea>" +
      '<p class="count" id="wc" aria-live="polite"></p></div>' +
      '<div class="actions"><button class="btn primary" type="button" id="next">I’ve finished writing</button></div>' + why("write") + "</div>";
    var ta = $("#w");
    function count() {
      var n = words(ta.value), over = n > MAX_WORDS;
      $("#wc").textContent = n + " words · the original is about " + target + " words (a guide, not a target)" + (over ? ". Please keep it under " + MAX_WORDS + " words." : ".");
      $("#wc").className = "count" + (over ? " over" : "");
      $("#next").disabled = n < 5 || over;
    }
    ta.addEventListener("input", function () { D.text1 = ta.value; saveDraft(); count(); });
    ta.addEventListener("focus", function () { setTimeout(function () { ta.scrollIntoView({ block: "center", behavior: "smooth" }); }, 300); });
    count();
    on("#next", "click", function () { go("predict"); });
    focusTop();
  }

  /* 6 Predict */
  function stPredict(p) {
    var n = p.keyIdeas.length, nums = "";
    for (var i = 0; i <= n; i++) nums += '<button type="button" data-n="' + i + '" aria-pressed="' + (D.predicted === i) + '">' + i + "</button>";
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>How many of the key ideas do you think you kept?</h1>" +
      '<div class="card"><p>The passage has <b>' + n + " key ideas</b>.</p><div class=\"nums\" role=\"group\" aria-label=\"Number of key ideas you think you kept\">" + nums + "</div></div>" +
      '<div class="actions"><button class="btn primary" type="button" id="next"' + (D.predicted == null ? " disabled" : "") + ">Next: get feedback</button></div>" + why("predict") + "</div>";
    $$("[data-n]").forEach(function (b) { b.addEventListener("click", function () { D.predicted = Number(b.dataset.n); saveDraft(); $$("[data-n]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); $("#next").disabled = false; }); });
    on("#next", "click", function () { go("feedback"); });
    focusTop();
  }

  /* ---------- live feedback ---------- */
  function askAI(p, text) {
    return DNAI.post("/dictogloss", {
      text: p.text, keyIdeas: p.keyIdeas.map(function (k) { return { text: k.text, type: k.type }; }),
      targetGrammar: p.targetGrammar.points.join(" and ") + ". " + p.targetGrammar.listenFor, codes: Object.keys(CODES), answer: text
    }, { app: "dicto", timeout: FEEDBACK_TIMEOUT }).then(function (r) { return validate(r, p, text); });
  }
  function validate(r, p, text) { // only expected fields reach the page
    if (!r || (r.status !== "ok" && r.status !== "retry")) throw new Error("bad");
    if (r.status === "retry") return { status: "retry", message: String(r.message || "Please try again.").slice(0, 200) };
    var st = ["kept", "partly", "missing", "changed"];
    var ideas = p.keyIdeas.map(function (k, i) { var x = (r.ideas || [])[i] || {}; return { status: st.indexOf(x.status) > -1 ? x.status : "missing", hint: String(x.hint || "").slice(0, 200) }; });
    var grammar = (r.grammar || []).filter(function (g) { return g && CODES[g.code] && g.quote && text.indexOf(g.quote) > -1; }).slice(0, 6)
      .map(function (g) { return { quote: String(g.quote).slice(0, 60), code: g.code, rule: String(g.rule || "").slice(0, 200) }; });
    return { status: "ok", ideas: ideas, grammar: grammar, target: { used: !!(r.target && r.target.used), hint: String((r.target && r.target.hint) || "").slice(0, 200) }, well: String(r.well || "").slice(0, 200) };
  }
  var SYM = { kept: ["✓", "Kept"], partly: ["~", "Partly kept"], missing: ["✗", "Missing"], changed: ["≠", "Changed meaning"] };
  function keptCount(ideas) { return ideas.reduce(function (a, x) { return a + (x.status === "kept" ? 1 : x.status === "partly" ? 0.5 : 0); }, 0); }
  function fbHtml(p, fb, text, round) {
    var h = '<p class="ai-label">AI feedback. It can be wrong or miss things.</p>';
    h += "<h2>Key ideas</h2><ul class=\"fb-list\">" + fb.ideas.map(function (x, i) {
      var k = p.keyIdeas[i], dkey = round + "-i" + i;
      return '<li class="fb-item ' + x.status + '"><span class="st ' + x.status + '">' + SYM[x.status][0] + " " + SYM[x.status][1] + "</span> · Idea " + (i + 1) + " (" + (k.type === "main" ? "main idea" : "detail") + ")" +
        (x.hint ? "<p>" + esc(x.hint) + "</p>" : "") + disagreeBtn(dkey) + "</li>";
    }).join("") + "</ul>";
    if (fb.grammar.length) {
      h += "<h2>Grammar points</h2><p class=\"small muted\">Tap a point to see where it is. Tap again for the code, and again for the rule. Try to fix it yourself.</p>" +
        '<div class="mytext" id="mytext-' + round + '">' + esc(text) + "</div><ul class=\"fb-list\" style=\"margin-top:10px\">" + fb.grammar.map(function (g, i) {
          var step = D.gpStep[round + ":" + i] || 0, dkey = round + "-g" + i;
          return '<li class="fb-item gp"><button class="btn sm" type="button" data-gp="' + round + ":" + i + '"' + (step >= 3 ? " disabled" : "") + ">Grammar point " + (i + 1) + (step === 0 ? ": show where" : step === 1 ? ": show the code" : step === 2 ? ": show the rule" : "") + "</button>" +
            (step >= 1 ? '<p class="gp-step">📍 Marked in your text above (underlined).</p>' : "") +
            (step >= 2 ? '<p class="gp-step"><b>Code: ' + esc(g.code) + "</b> = " + esc(CODES[g.code]) + "</p>" : "") +
            (step >= 3 ? '<p class="gp-step"><b>Rule:</b> ' + esc(g.rule) + "</p>" : "") + disagreeBtn(dkey) + "</li>";
        }).join("") + "</ul>";
    } else h += "<h2>Grammar points</h2><p>No clear grammar problems were found. Check articles and word endings yourself.</p>";
    h += "<h2>Target grammar</h2><div class=\"fb-item " + (fb.target.used ? "kept" : "partly") + '"><span class="st ' + (fb.target.used ? "kept" : "partly") + '">' + (fb.target.used ? "✓ You used the target grammar." : "~ Not yet.") + "</span>" + (!fb.target.used && fb.target.hint ? "<p>" + esc(fb.target.hint) + "</p>" : "") + disagreeBtn(round + "-t") + "</div>";
    if (fb.well) h += '<h2>What you did well</h2><p>' + esc(fb.well) + "</p>";
    return h;
  }
  function disagreeBtn(dkey) {
    var done = S.disagree.some(function (d) { return d.key === D.id + ":" + D.started + ":" + dkey; });
    return '<div><button class="btn sm disagree" type="button" data-dis="' + dkey + '" aria-pressed="' + done + '">' + (done ? "✓ Noted: I don’t agree" : "I don’t agree") + "</button></div>";
  }
  function bindFb(p, fb, text, round, rerender) {
    $$("[data-gp]").forEach(function (b) {
      var parts = b.dataset.gp.split(":"); if (parts[0] !== String(round)) return;
      b.addEventListener("click", function () { var k = parts[0] + ":" + parts[1]; D.gpStep[k] = Math.min(3, (D.gpStep[k] || 0) + 1); saveDraft(); rerender(); markText(fb, text, round); var nb = $('[data-gp="' + b.dataset.gp + '"]'); if (nb) nb.focus(); });
    });
    $$("[data-dis]").forEach(function (b) {
      if (b.dataset.dis.indexOf(String(round)) !== 0) return;
      b.addEventListener("click", function () {
        var dkey = b.dataset.dis, full = D.id + ":" + D.started + ":" + dkey;
        if (S.disagree.some(function (d) { return d.key === full; })) return;
        var item = /-i(\d+)$/.test(dkey) ? fb.ideas[+RegExp.$1] : /-g(\d+)$/.test(dkey) ? fb.grammar[+RegExp.$1] : fb.target;
        var what = /-i(\d+)$/.test(dkey) ? "Key idea " + (+RegExp.$1 + 1) + ": AI said “" + SYM[item.status][1] + "”" + (item.hint ? " (" + item.hint + ")" : "")
          : /-g(\d+)$/.test(dkey) ? "Grammar: “" + item.quote + "” marked " + item.code + (item.rule ? " (" + item.rule + ")" : "")
          : "Target grammar: AI said " + (item.used ? "used" : "not yet used");
        S.disagree.push({ key: full, date: today(), passage: p.title, round: round, what: what }); save();
        b.textContent = "✓ Noted: I don’t agree"; b.setAttribute("aria-pressed", "true");
      });
    });
    markText(fb, text, round);
  }
  function markText(fb, text, round) {
    var box = $("#mytext-" + round); if (!box) return;
    var marks = [];
    fb.grammar.forEach(function (g, i) { if ((D.gpStep[round + ":" + i] || 0) >= 1) { var at = text.indexOf(g.quote); if (at > -1) marks.push([at, at + g.quote.length, i + 1]); } });
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", pos = 0;
    marks.forEach(function (m) { if (m[0] < pos) return; out += esc(text.slice(pos, m[0])) + "<mark>" + esc(text.slice(m[0], m[1])) + "</mark><sup>" + m[2] + "</sup>"; pos = m[1]; });
    box.innerHTML = out + esc(text.slice(pos));
  }

  /* 7 Feedback (AI #1, or self-check if it fails) */
  function stFeedback(p) {
    if (D.fb1 && D.fb1.status === "ok") return showFb1(p);
    if (D.selfMode) return selfCheck(p);
    app.innerHTML = '<div class="wrap page">' + header(p) + '<h1>Feedback on your version</h1><div class="card"><p role="status" id="st">Reading your text… This can take up to 20 seconds.</p></div></div>';
    focusTop();
    if (!window.DNAI) { D.selfMode = true; D.fbError = "AI feedback is not available on this page."; saveDraft(); return selfCheck(p); }
    D.fbUsed++; saveDraft();
    askAI(p, D.text1).then(function (fb) {
      if (fb.status === "retry") { D.fbUsed--; D.fbRetry = fb.message; saveDraft(); D.stage = "write"; saveDraft(); viewSession(); setTimeout(function () { var w = $("#wc"); if (w) w.insertAdjacentHTML("afterend", '<p class="notice" role="alert">' + esc(fb.message) + "</p>"); }, 50); return; }
      D.fb1 = fb; saveDraft(); showFb1(p);
    }).catch(function (e) { D.selfMode = true; D.fbError = e && e.message ? e.message : "AI feedback isn’t available right now."; saveDraft(); selfCheck(p); });
  }
  function showFb1(p) {
    function render() {
      app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Feedback on your version</h1>" +
        '<div class="card">' + fbHtml(p, D.fb1, D.text1, 1) + "</div>" +
        '<div class="card"><p style="margin:0">You guessed <b>' + D.predicted + " of " + p.keyIdeas.length + "</b> key ideas. The feedback says about <b>" + fmtKept(keptCount(D.fb1.ideas)) + "</b>.</p></div>" +
        '<div class="actions"><button class="btn primary" type="button" id="next">Next: revise my text</button></div>' + why("feedback") + "</div>";
      bindFb(p, D.fb1, D.text1, 1, render);
      on("#next", "click", function () { if (!D.text2) D.text2 = D.text1; go("revise"); });
    }
    render(); focusTop();
  }
  function selfCheck(p) {
    var n = p.keyIdeas.length, i = D.self.length;
    if (i >= n) {
      app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Your self-check</h1><div class=\"card\"><ul class=\"fb-list\">" + p.keyIdeas.map(function (k, j) {
        var v = D.self[j], m = { got: ["kept", "✓ Got it"], partly: ["partly", "~ Partly"], missed: ["missing", "✗ Missed"] }[v];
        return '<li class="fb-item ' + m[0] + '"><span class="st ' + m[0] + '">' + m[1] + "</span> · " + esc(k.text) + "</li>";
      }).join("") + "</ul><p>You guessed <b>" + D.predicted + "</b>. Your check says <b>" + fmtKept(selfKept()) + "</b> of " + n + ".</p></div>" +
        '<div class="actions"><button class="btn primary" type="button" id="next">Next: revise my text</button></div>' + why("feedback") + "</div>";
      on("#next", "click", function () { if (!D.text2) D.text2 = D.text1; go("revise"); });
      return focusTop();
    }
    var k = p.keyIdeas[i];
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Check your own version</h1>" +
      (i === 0 ? '<p class="notice" role="alert">' + esc(D.fbError || "AI feedback isn’t available right now.") + " Let’s check your version yourself instead.</p>" : "") +
      '<div class="card"><p class="steplabel">Key idea ' + (i + 1) + " of " + n + " · " + (k.type === "main" ? "main idea" : "detail") + '</p><p style="font-size:1.1rem"><b>' + esc(k.text) + "</b></p><p>Is this idea in your version?</p>" +
      '<div class="row"><button class="btn" type="button" data-self="got">✓ Got it</button><button class="btn" type="button" data-self="partly">~ Partly</button><button class="btn" type="button" data-self="missed">✗ Missed</button></div></div>' +
      '<details class="notes-peek"><summary>Show my version</summary><div class="mytext">' + esc(D.text1) + "</div></details></div>";
    $$("[data-self]").forEach(function (b) { b.addEventListener("click", function () { D.self.push(b.dataset.self); saveDraft(); selfCheck(p); }); });
    focusTop();
  }
  function selfKept() { return D.self.reduce(function (a, v) { return a + (v === "got" ? 1 : v === "partly" ? 0.5 : 0); }, 0); }

  /* 8 Revise (+ AI #2 once) */
  function stRevise(p) {
    var canAsk = D.fb1 && D.fb1.status === "ok" && D.fbUsed < 2 && !D.fb2;
    function render() {
      app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Make your version better</h1><p>Use the feedback to fix ideas and grammar. Change your text once, then compare it with the original.</p>" +
        (D.fb1 && D.fb1.status === "ok" ? '<details class="notes-peek"><summary>Show the feedback again</summary><div class="card">' + fbHtml(p, D.fb1, D.text1, 1) + "</div></details>" : "") +
        (D.notes.trim() ? '<details class="notes-peek"><summary>My notes</summary><div class="notes-text">' + esc(D.notes) + "</div></details>" : "") +
        '<div class="card"><label class="q" for="w2">My revised version</label><textarea id="w2" class="write" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"' + (D.fb2 ? " readonly" : "") + ">" + esc(D.text2) + '</textarea><p class="count" id="wc" aria-live="polite"></p></div>' +
        (D.fb2 ? '<div class="card"><h2>Feedback on your revision</h2>' + fbHtml(p, D.fb2, D.text2, 2) + "</div>" : "") +
        '<p class="small" id="st" role="status"></p>' +
        '<div class="actions">' + (canAsk ? '<button class="btn" type="button" id="ask">Check my revision with AI (last time)</button>' : "") +
        '<button class="btn primary" type="button" id="next">Next: compare with the original</button></div>' + why("revise") + "</div>";
      var ta = $("#w2");
      function count() { var n = words(ta.value), over = n > MAX_WORDS; $("#wc").textContent = n + " words" + (over ? ". Please keep it under " + MAX_WORDS + " words." : "."); $("#wc").className = "count" + (over ? " over" : ""); $("#next").disabled = over || n < 5; var a = $("#ask"); if (a) a.disabled = over || n < 5 || ta.value.trim() === D.text1.trim(); }
      ta.addEventListener("input", function () { D.text2 = ta.value; saveDraft(); count(); });
      count();
      if (D.fb1 && D.fb1.status === "ok") bindFb(p, D.fb1, D.text1, 1, render);
      if (D.fb2) bindFb(p, D.fb2, D.text2, 2, render);
      on("#ask", "click", function () {
        var a = $("#ask"); a.disabled = true; a.textContent = "Reading your revision…"; $("#st").textContent = "This can take up to 20 seconds.";
        D.fbUsed++; saveDraft();
        askAI(p, D.text2).then(function (fb) {
          if (fb.status === "retry") { $("#st").textContent = fb.message; a.remove(); return; }
          D.fb2 = fb; saveDraft(); canAsk = false; render();
        }).catch(function (e) { $("#st").textContent = (e && e.message ? e.message : "AI feedback isn’t available right now.") + " You can go on and compare with the original."; a.remove(); });
      });
      on("#next", "click", function () { go("compare"); });
    }
    render(); focusTop();
  }

  /* 9 Compare: word-level differences, labelled by the student */
  function tok(t) { return (String(t).match(/[A-Za-z0-9'’\-]+|[^\sA-Za-z0-9]/g) || []); }
  function norm(w) { return w.toLowerCase().replace(/’/g, "'"); }
  function diff(a, b) { // LCS on words (punctuation ignored for matching)
    var A = tok(a), B = tok(b), wa = A.map(norm), wb = B.map(norm), n = A.length, m = B.length, i, j;
    var isW = function (w) { return /[a-z0-9]/i.test(w); };
    var L = []; for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = wa[i] === wb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (wa[i] === wb[j]) { ops.push(["=", A[i], B[j]]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(["-", A[i]]); i++; }
      else { ops.push(["+", null, B[j]]); j++; }
    }
    while (i < n) ops.push(["-", A[i++]]); while (j < m) ops.push(["+", null, B[j++]]);
    // group into differences; punctuation-only changes are ignored; tiny equal gaps (1 word) are merged
    var groups = [], cur = null, gap = [];
    ops.forEach(function (o) {
      if (o[0] === "=" || (!isW(o[1] || o[2]))) {
        if (cur) gap.push(o); else groups.push({ eq: o });
      } else {
        if (cur && gap.filter(function (g) { return g[0] === "=" && isW(g[1]); }).length === 0) { gap.forEach(function (g) { if (g[0] === "=") { cur.o.push(g[1]); cur.s.push(g[2]); } else if (g[0] === "-") cur.o.push(g[1]); else cur.s.push(g[2]); }); }
        else { if (cur) { groups.push(cur); gap.forEach(function (g) { groups.push({ eq: g }); }); } cur = { o: [], s: [] }; }
        gap = [];
        if (o[0] === "-") cur.o.push(o[1]); else cur.s.push(o[2]);
      }
    });
    if (cur) { groups.push(cur); gap.forEach(function (g) { groups.push({ eq: g }); }); }
    return groups;
  }
  function join(arr) { return arr.join(" ").replace(/\s+([.,!?;:])/g, "$1"); }
  function short(t) { var w = String(t).split(" "); return w.length > 14 ? w.slice(0, 6).join(" ") + " … " + w.slice(-5).join(" ") : t; }
  function stCompare(p) {
    var finalText = D.text2 || D.text1, groups = diff(p.text, finalText), k = 0, diffs = [];
    var o = "", s = "";
    groups.forEach(function (g) {
      if (g.eq) { var e = g.eq; if (e[0] !== "+") o += esc(e[1]) + " "; if (e[0] !== "-") s += esc(e[2]) + " "; return; }
      k++; diffs.push({ n: k, o: join(g.o), s: join(g.s) });
      o += g.o.length ? '<span class="d-orig">' + esc(join(g.o)) + "</span><sup>" + k + "</sup> " : '<span class="d-gap">‸</span><sup>' + k + "</sup> ";
      s += g.s.length ? '<span class="d-stu">' + esc(join(g.s)) + "</span><sup>" + k + "</sup> " : '<span class="d-gap">‸</span><sup>' + k + "</sup> ";
    });
    o = o.replace(/\s+([.,!?;:])/g, "$1"); s = s.replace(/\s+([.,!?;:])/g, "$1");
    var shown = diffs.slice(0, 12);
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Compare with the original</h1><p>Read both versions. Numbers show where they are different. Then say what kind of difference each one is.</p>" +
      '<div class="compare"><div class="side"><h3>The original</h3><p style="margin:0">' + o + '</p></div><div class="side"><h3>Your final version</h3><p style="margin:0">' + s + "</p></div></div>" +
      '<p class="legend">Solid underline = in the original only. Wavy underline = in your version only. ‸ = nothing here.</p>' +
      (shown.length ? "<h2>Label the differences</h2><ol class=\"difflist\">" + shown.map(function (d) {
        var v = D.labels[d.n] || "";
        return "<li><p class=\"pair\"><b>" + d.n + ".</b> Original: “" + esc(short(d.o) || "‸ nothing") + "” · Yours: “" + esc(short(d.s) || "‸ nothing") + "”</p>" +
          '<div class="seg" role="radiogroup" aria-label="Difference ' + d.n + '">' + [["same", "Same meaning"], ["changed", "Changed meaning"], ["slip", "Grammar slip"]].map(function (x) {
            var id = "l" + d.n + x[0];
            return '<input type="radio" id="' + id + '" name="l' + d.n + '" value="' + x[0] + '"' + (v === x[0] ? " checked" : "") + '><label for="' + id + '">' + x[1] + "</label>";
          }).join("") + "</div></li>";
      }).join("") + "</ol>" + (diffs.length > shown.length ? '<p class="small muted">Showing the first ' + shown.length + " of " + diffs.length + " differences.</p>" : "") : "<p>✓ Your version matches the original very closely.</p>") +
      '<div class="card"><p style="margin:0 0 8px">Want to hear it once more, now that you have compared? This third listen is recorded in your summary.</p><div class="row"><button class="btn" type="button" id="third">' + (D.third ? "▶ Play the third listen again" : "▶ Third listen") + '</button><span class="small" id="tl" role="status"></span></div></div>' +
      '<div class="actions"><button class="btn primary" type="button" id="next">Next: reflect</button></div>' + why("compare") + "</div>";
    $$(".seg input").forEach(function (r) { r.addEventListener("change", function () { D.labels[r.name.slice(1)] = r.value; saveDraft(); }); });
    var tb = $("#third");
    tb.addEventListener("click", function () {
      if (Player.isPlaying()) { Player.pause(); tb.textContent = "▶ Continue"; return; }
      if (Player.isPaused()) { Player.resume(); tb.textContent = "⏸ Pause"; return; }
      Player.unlock(p);
      Player.check(p, function (ok) {
        if (!ok) { $("#tl").textContent = "No English voice on this device."; return; }
        D.third = true; saveDraft();
        Player.start(p, { rate: D.rate, onChange: function () {}, onEnd: function () { tb.textContent = "▶ Play the third listen again"; $("#tl").textContent = "✓ Finished."; } });
        tb.textContent = "⏸ Pause"; $("#tl").textContent = "Playing…";
      });
    });
    on("#next", "click", function () { go("reflect"); });
    focusTop();
  }

  /* 10 Reflect */
  function result(p) {
    var fb = D.fb2 && D.fb2.status === "ok" ? D.fb2 : D.fb1 && D.fb1.status === "ok" ? D.fb1 : null;
    var kept = fb ? keptCount(fb.ideas) : selfKept();
    var codes = {};
    [D.fb1, D.fb2].forEach(function (f) { if (f && f.status === "ok") f.grammar.forEach(function (g) { codes[g.code] = (codes[g.code] || 0) + 1; }); });
    var lab = { same: 0, changed: 0, slip: 0 }; Object.keys(D.labels).forEach(function (k) { lab[D.labels[k]]++; });
    return { kept: kept, total: p.keyIdeas.length, source: fb ? "ai" : "self", codes: codes, labels: lab, target: fb ? fb.target.used : null };
  }
  function stReflect(p) {
    var r = result(p), codeList = Object.keys(r.codes);
    app.innerHTML = '<div class="wrap page">' + header(p) + "<h1>Look back on this session</h1>" +
      '<div class="card"><p><b>Key ideas:</b> you guessed ' + D.predicted + " of " + r.total + ". " + (r.source === "ai" ? "The feedback says" : "Your self-check says") + " about <b>" + fmtKept(r.kept) + "</b>." +
      (D.predicted > r.kept + 0.5 ? " You were a little too hopeful: listen for the links between ideas (why, how, so)." : D.predicted < r.kept - 0.5 ? " You kept more than you thought. Well done!" : " Your guess was close. Good self-monitoring!") + "</p>" +
      "<p><b>Grammar codes that came up:</b> " + (codeList.length ? codeList.map(function (c) { return esc(c) + " (" + esc(CODES[c]) + ")" + (r.codes[c] > 1 ? " ×" + r.codes[c] : ""); }).join(", ") : "none") + "</p>" +
      "<p><b>Your labels:</b> " + r.labels.same + " same meaning, " + r.labels.changed + " changed meaning, " + r.labels.slip + " grammar slips.</p>" +
      "<p style=\"margin:0\"><b>Listens:</b> " + (D.third ? "3 (with a third listen after writing)" : "2") + ", at " + (D.rate === 1 ? "normal speed" : "the easier speed") + ".</p></div>" +
      '<div class="card"><label class="q" for="goal">What will you listen for next time?</label><textarea id="goal" style="min-height:5em" placeholder="For example: I will listen for -ed endings and the small words a and the.">' + esc(D.goal || "") + "</textarea></div>" +
      '<div class="actions"><button class="btn primary" type="button" id="finish">Save and finish</button></div>' + why("reflect") + "</div>";
    on("#goal", "input", function (e) { D.goal = e.target.value; saveDraft(); });
    on("#finish", "click", function () {
      var g = ($("#goal").value || "").trim();
      if (g.length < 5) { $("#goal").focus(); $("#goal").insertAdjacentHTML("afterend", '<p class="small" role="alert">Write one short goal first.</p>'); return; }
      S.history.push({ date: today(), id: p.id, title: p.title, predicted: D.predicted, kept: r.kept, total: r.total, source: r.source, codes: r.codes, labels: r.labels,
        listens: D.third ? 3 : 2, rate: D.rate, target: r.target, words: words(D.text2 || D.text1), goal: g });
      S.goal = g; save();
      D = null; saveDraft();
      viewDone(p, r);
    });
    focusTop();
  }
  function viewDone(p, r) {
    app.innerHTML = '<div class="wrap page"><h1>Session saved. Well done!</h1><div class="card"><p>You kept about <b>' + fmtKept(r.kept) + " of " + r.total + "</b> key ideas in “" + esc(p.title) + "”.</p><p style=\"margin:0\"><b>Your goal for next time:</b> " + esc(S.goal) + "</p></div>" +
      '<div class="actions"><a class="btn primary" href="#/">Try another passage</a><a class="btn" href="#/progress">See my progress</a></div>' +
      (window.DNNext ? DNNext.html("dictogloss") : "") + "</div>";
    focusTop();
  }

  /* =====================================================================
     PROGRESS
     ===================================================================== */
  function summaryText() {
    var L = ["Dictogloss Trainer – my summary (" + today() + ")", ""];
    S.history.forEach(function (h) { L.push(h.date + " · " + h.title + ": guessed " + h.predicted + ", kept " + fmtKept(h.kept) + "/" + h.total + (h.source === "self" ? " (self-check)" : "") + ", listens " + h.listens + ", codes: " + (Object.keys(h.codes || {}).join(", ") || "none") + ". Goal: " + h.goal); });
    if (S.disagree.length) { L.push("", "Times I didn’t agree with the AI feedback:"); S.disagree.forEach(function (d) { L.push("- " + d.date + " · " + d.passage + " (" + (d.round === 1 ? "first" : "second") + " feedback): " + d.what); }); }
    return L.join("\n");
  }
  function viewProgress() {
    var codeCount = {}; S.history.forEach(function (h) { Object.keys(h.codes || {}).forEach(function (c) { codeCount[c] = (codeCount[c] || 0) + 1; }); });
    var repeat = Object.keys(codeCount).filter(function (c) { return codeCount[c] >= 2; }).sort(function (a, b) { return codeCount[b] - codeCount[a]; });
    var h = '<div class="wrap page"><h1>My progress</h1><p class="muted">Saved only on this device.</p>' +
      (S.goal ? '<div class="goalbox"><b>My last goal:</b> ' + esc(S.goal) + "</div>" : "");
    if (!S.history.length) h += '<div class="card"><p style="margin:0">No sessions yet. <a href="#/">Choose a passage</a> to start.</p></div>';
    else {
      h += '<div class="card"><h2>Key ideas kept over time</h2><ul class="bars">' + S.history.slice(-12).map(function (x) {
        var pc = Math.round(100 * x.kept / x.total);
        return "<li><span>" + esc(x.date) + "</span><span class=\"bar\" role=\"img\" aria-label=\"" + pc + " per cent\"><i style=\"width:" + pc + '%"></i></span><span>' + fmtKept(x.kept) + "/" + x.total + "</span></li>";
      }).join("") + "</ul></div>";
      h += '<div class="card"><h2>Grammar codes that keep coming up</h2>' + (repeat.length ? "<ul>" + repeat.slice(0, 4).map(function (c) {
        var s = STUDY[c]; return "<li><b>" + esc(c) + "</b> (" + esc(CODES[c]) + "), " + codeCount[c] + " sessions" + (s ? ' · Study: <a href="' + s[1] + '">' + esc(s[0]) + "</a>" : "") + "</li>";
      }).join("") + "</ul>" : "<p style=\"margin:0\">No code has come up in more than one session yet.</p>") + "</div>";
      h += '<div class="card tblwrap"><h2>My sessions</h2><table class="hist"><thead><tr><th>Date</th><th>Passage</th><th>Guess</th><th>Kept</th><th>Listens</th><th>Goal</th></tr></thead><tbody>' +
        S.history.slice().reverse().map(function (x) { return "<tr><td>" + esc(x.date) + "</td><td>" + esc(x.title) + "</td><td>" + x.predicted + "</td><td>" + fmtKept(x.kept) + "/" + x.total + (x.source === "self" ? " (self)" : "") + "</td><td>" + x.listens + "</td><td>" + esc(x.goal) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    }
    if (S.disagree.length) h += '<div class="card"><h2>Times I didn’t agree with the AI</h2><p class="small muted">Show this list to your teacher.</p><ul>' + S.disagree.map(function (d) { return "<li>" + esc(d.date) + " · " + esc(d.passage) + ": " + esc(d.what) + "</li>"; }).join("") + "</ul></div>";
    h += '<div class="actions noprint"><button class="btn" type="button" id="copy">Copy summary</button><button class="btn" type="button" id="print">Print</button><button class="btn" type="button" id="clear">Clear my data</button></div><div id="confirm" class="confirm" aria-live="polite"></div><p class="small" id="msg" role="status"></p></div>';
    app.innerHTML = h;
    on("#copy", "click", function () {
      var t = summaryText();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $("#msg").textContent = "Copied."; }, function () {
        var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); $("#msg").textContent = "Copied."; } catch (e) { $("#msg").textContent = "Couldn’t copy. Please select the text and copy it yourself."; } ta.remove();
      });
    });
    on("#print", "click", function () { window.print(); });
    on("#clear", "click", function () {
      $("#confirm").innerHTML = '<div class="notice"><p style="margin:0 0 8px">Delete all your sessions, goals and notes on this device? This can’t be undone.</p><div class="row"><button class="btn primary" type="button" id="yes">Yes, delete</button><button class="btn" type="button" id="no">Keep my data</button></div></div>';
      on("#yes", "click", function () { S = { v: 1, history: [], disagree: [], goal: "" }; save(); D = null; saveDraft(); viewProgress(); $("#msg").textContent = "Your data has been deleted."; });
      on("#no", "click", function () { $("#confirm").innerHTML = ""; });
      $("#yes").focus();
    });
    focusTop();
  }

  /* =====================================================================
     ABOUT
     ===================================================================== */
  function viewAbout() {
    app.innerHTML = '<div class="wrap page"><h1>About this app</h1>' +
      '<div class="card"><h2>What is a dictogloss?</h2><p>You hear a short academic passage twice, note key words, and rebuild it in full sentences. Then you compare your version with the original. It trains listening for detail and grammar together, which helps with lecture notes and summaries at university.</p></div>' +
      '<div class="card"><h2>How the feedback works</h2><ul>' +
      "<li>The passages were drafted with AI and are checked by the teacher, Dave Nab. Passages marked “Draft content” have not been checked yet.</li>" +
      "<li>When you ask for feedback, these things are sent to an AI service (Cloudflare Workers AI): the original passage, its key ideas, the target grammar, the list of correction codes, and your text. Nothing else. No name or other details.</li>" +
      "<li>Your text is <b>not stored or logged</b> by the service. It is used once to make the feedback, then forgotten.</li>" +
      "<li>The feedback gives <b>hints, not answers</b>, because rebuilding the meaning yourself is the skill you are learning.</li>" +
      "<li>You can ask for feedback once before revising and once after. That keeps the thinking with you, not the AI.</li>" +
      "<li>AI feedback can be wrong or miss things. If you think it is wrong, press “I don’t agree”, and talk to your teacher. Your list is on the My progress page.</li></ul></div>" +
      '<div class="card"><h2>Your privacy</h2><ul><li>No sign-in, no tracking, no analytics.</li><li>Your notes, texts and progress are saved only in this browser on this device. Use “Clear my data” on the My progress page to delete them.</li><li>If storage is blocked on your device, the app still works, but it can’t save.</li></ul></div>' +
      '<div class="card"><h2>Listening</h2><p style="margin:0">If a passage has a recording, you hear it. Otherwise your device reads it aloud with its built-in voice (Australian or British English when available). You hear it twice, at normal or easier speed. A third listen is possible after you have written your version.</p></div></div>';
    focusTop();
  }
})();
