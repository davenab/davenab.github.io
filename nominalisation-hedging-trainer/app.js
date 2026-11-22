/* Nominalisation and Hedging Trainer
   Plain JavaScript. No framework, no tracking. Optional AI feedback on rewritten sentences only when the
   student presses the button (Worker route /rewrite via /assets/ai.js; nothing stored).
   Practice items live in data/*.json (see README.md). Progress is kept in
   localStorage on this device only, and the app still works if storage is blocked. */
(function () {
  "use strict";

  /* ---------------- settings ---------------- */
  const KEY = "nht-v1";
  const SESSION_SIZE = 10;
  const MAX_REVIEW = 6;              // at most this many review items per session, so new items still appear
  const INTERVALS = [0, 1, 2, 4, 8, 16]; // box number -> sessions until the item comes back
  const MASTER_BOX = 4;              // box 4 or 5 = "mastered" (right three times in a row)
  const UNLOCK_SCORE = 0.8;          // about 80% right ...
  const UNLOCK_SESSIONS = 2;         // ... over two sessions
  const MIN_PER_SESSION = 3;         // a session counts for a stage if it had at least 3 items from that stage
  const FILES = { nominalisation: "data/nominalisation.json", hedging: "data/hedging.json", ref: "data/reference.json", links: "data/links.json" };
  const TRACKS = {
    nominalisation: { name: "Nominalisation", letter: "A", blurb: "Pack actions and qualities into nouns: “people use more cars” → “increased car use”.", ref: "#/words", refName: "Word families" },
    hedging: { name: "Hedging", letter: "B", blurb: "Match how sure you sound to the evidence: “causes” → “may contribute to”.", ref: "#/hedges", refName: "Hedging bank" }
  };
  const TYPES = ["word", "spot", "choose", "gapfill", "rewrite", "order", "evidence"];
  const SELF_CHECK = {
    nominalisation: {
      4: ["Did I turn an action or quality into a noun?", "Is the meaning the same?", "Is it still easy to understand?"],
      5: ["Is it easier to read than before?", "Is the meaning the same?", "Is it still formal enough for an essay?"]
    },
    hedging: {
      4: ["Did I change how certain the claim is?", "Does my hedge fit the evidence?", "Did I use only one hedge (plus a word like “some” if needed)?"],
      5: ["Did I remove the extra hedges?", "Does the strength of the claim fit the evidence?", "Is the claim still clear?"]
    }
  };

  /* ---------------- data ---------------- */
  const DATA = { items: [], byId: {}, stageTitles: { nominalisation: {}, hedging: {} }, ref: null, links: null, problems: [], loaded: false, error: "" };
  let S = blank();          // saved state
  let STORE_OK = true;
  let SESSION = null;       // the session in progress (memory only)
  let LAST_END = null;      // summary of the last finished session

  function blank() {
    return {
      v: 1, session: 0,
      tracks: {
        nominalisation: { unlocked: 1, stage: 1, hist: {} },
        hedging: { unlocked: 1, stage: 1, hist: {} }
      },
      items: {},   // id -> { box, due, seen, right, wrong, hints }
      goals: {},   // mode -> { text, date }
      log: []      // finished sessions: { date, mode, right, total, hints }
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      localStorage.setItem(KEY + "-test", "1"); localStorage.removeItem(KEY + "-test");
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) {
          const b = blank();
          S = Object.assign(b, d);
          S.tracks = Object.assign(b.tracks, d.tracks || {});
        }
      }
    } catch (e) { STORE_OK = false; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); STORE_OK = true; } catch (e) { STORE_OK = false; } }

  /* ---------------- helpers ---------------- */
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function today() { try { return new Date().toLocaleDateString("en-AU"); } catch (e) { return new Date().toDateString(); } }
  function stageTitle(track, n) { return DATA.stageTitles[track][n] || ("Stage " + n); }
  function rec(id) { return S.items[id]; }
  const NOINPUT = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';

  /* ---------------- answer checking ----------------
     Ignore capitals, extra spaces, curly quotes and end punctuation.
     Australian spelling is the standard; American spelling is accepted and the Australian form is shown. */
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"')
      .replace(/\s+/g, " ").trim().replace(/[.,!?;:]+$/, "").trim();
  }
  const ISE_KEEP = /^(rise|arise|wise|otherwise|exercise|advise|advertise|compromise|enterprise|surprise|supervise|comprise|revise|expertise|premise|promise|devise|televise|precise|concise|raise|praise|noise|poise|cruise|franchise|merchandise|disguise|despise|improvise|chastise|excise|incise|demise|reprise|treatise|paradise|bruise|guise)$/;
  function amWord(w) {
    let x = w.replace(/isation/g, "ization");
    x = x.replace(/^(.+)is(e|es|ed|ing|er|ers)$/, (m, b, e) => (b.length < 3 || ISE_KEEP.test(b + "ise")) ? m : b + "iz" + e);
    x = x.replace(/^(.+)ys(e|es|ed|ing)$/, "$1yz$2");
    x = x.replace(/^(behavi|col|fav|lab|hon|neighb|hum|rum|harb|vap|vig|endeav|flav|arm|od|rig|tum|clam)our(.*)$/, "$1or$2");
    x = x.replace(/^(cent|met|lit|theat|fib)re(s|d)?$/, "$1er$2");
    x = x.replace(/^(def|off|lic|pret)ence(s)?$/, "$1ense$2");
    x = x.replace(/judgement/, "judgment").replace(/^programme(s)?$/, "program$1").replace(/^ageing$/, "aging");
    x = x.replace(/^(travel|model|label|cancel|level|signal|fuel|counsel|channel)l(ed|ing|er|ers)$/, "$1$2");
    return x;
  }
  function americanise(s) { return s.split(/(\s+|-)/).map(amWord).join(""); }
  /* returns { ok, us, form } : form = the accepted (Australian) answer that matched */
  function check(input, accepted) {
    const n = norm(input);
    if (!n) return { ok: false };
    for (const a of accepted) { if (norm(a) === n) return { ok: true, us: false, form: a }; }
    for (const a of accepted) { const am = americanise(norm(a)); if (am !== norm(a) && am === n) return { ok: true, us: true, form: a }; }
    return { ok: false };
  }
  function cleanTok(t) { return t.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ""); }

  /* ---------------- content check (helps the teacher spot mistakes in the JSON) ---------------- */
  function validate(it, where) {
    const p = msg => DATA.problems.push((it && it.id ? it.id : where) + ": " + msg);
    if (!it || typeof it !== "object") { p("not an item"); return false; }
    if (!it.id) { p("missing id"); return false; }
    if (DATA.byId[it.id]) { p("the same id is used twice"); return false; }
    if (!TRACKS[it.track]) { p("track must be \"nominalisation\" or \"hedging\""); return false; }
    if (!(it.stage >= 1 && it.stage <= 5)) { p("stage must be a number from 1 to 5"); return false; }
    if (TYPES.indexOf(it.type) < 0) { p("type must be one of: " + TYPES.join(", ")); return false; }
    if (typeof it.prompt !== "string") { p("missing prompt"); return false; }
    if (!it.reason) { p("missing reason"); return false; }
    const acc = Array.isArray(it.acceptedAnswers) ? it.acceptedAnswers : [];
    const opts = Array.isArray(it.options) ? it.options : [];
    const models = Array.isArray(it.modelAnswers) ? it.modelAnswers : [];
    switch (it.type) {
      case "word": if (!acc.length) { p("needs at least one accepted answer"); return false; } break;
      case "spot": {
        if (!acc.length) { p("needs the words to tap in acceptedAnswers"); return false; }
        const toks = it.prompt.split(/\s+/).map(cleanTok);
        const miss = acc.filter(a => toks.indexOf(cleanTok(a)) < 0);
        if (miss.length) { p("these answers are not in the sentence: " + miss.join(", ")); return false; }
        break;
      }
      case "choose": case "evidence":
        if (opts.length < 2) { p("needs at least two options"); return false; }
        if (!acc.length || opts.indexOf(acc[0]) < 0) { p("the accepted answer must be copied exactly from the options"); return false; }
        if (it.type === "evidence" && (!Array.isArray(it.optionLabels) || it.optionLabels.length !== opts.length)) { p("needs one optionLabel for each option"); return false; }
        break;
      case "gapfill": {
        const gaps = (it.frame || "").split("___").length - 1;
        if (!gaps) { p("the frame needs gaps written as ___"); return false; }
        if (acc.length !== gaps || !acc.every(Array.isArray)) { p("needs one list of accepted answers for each gap (" + gaps + " gaps)"); return false; }
        if (!models.length) { p("needs a model answer"); return false; }
        break;
      }
      case "rewrite": if (!models.length) { p("needs at least one model answer"); return false; } break;
      case "order":
        if (opts.length < 2 || acc.length !== opts.length || !acc.every(a => opts.indexOf(a) >= 0)) { p("acceptedAnswers must list every option, in the right order"); return false; }
        break;
    }
    return true;
  }

  function loadData() {
    const get = url => fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
    return Promise.all([get(FILES.nominalisation), get(FILES.hedging), get(FILES.ref), get(FILES.links).catch(() => ({}))]).then(([a, b, ref, links]) => {
      [a, b].forEach(file => {
        (file.stages || []).forEach(st => {
          if (file.track && st.stage) DATA.stageTitles[file.track][st.stage] = st.title;
          (st.items || []).forEach((it, i) => {
            if (validate(it, (file.track || "?") + " stage " + st.stage + " item " + (i + 1))) { DATA.items.push(it); DATA.byId[it.id] = it; }
          });
        });
      });
      DATA.ref = ref; DATA.links = links || {}; DATA.loaded = true;
    });
  }

  /* ---------------- building a session ---------------- */
  function itemsOf(track, stage) { return DATA.items.filter(i => i.track === track && (stage == null || i.stage === stage)); }
  function dueItems(tracks) {
    return DATA.items.filter(i => tracks.indexOf(i.track) >= 0 && rec(i.id) && rec(i.id).due <= S.session)
      .sort((a, b) => (rec(a.id).box - rec(b.id).box) || (rec(a.id).due - rec(b.id).due));
  }
  function buildSession(mode) {
    const tracks = mode === "mixed" ? ["nominalisation", "hedging"] : [mode];
    const picked = [], has = {};
    const take = it => { if (it && !has[it.id] && picked.length < SESSION_SIZE) { has[it.id] = 1; picked.push(it); } };
    const due = dueItems(tracks);
    // 1. items due for review
    due.slice(0, MAX_REVIEW).forEach(take);
    // 2. new items at the student's stage (taken in turn from each track in Mixed)
    const fresh = tracks.map(t => shuffle(itemsOf(t, S.tracks[t].stage).filter(i => !rec(i.id))));
    let more = true;
    while (picked.length < SESSION_SIZE && more) { more = false; fresh.forEach(list => { if (list.length) { more = true; take(list.shift()); } }); }
    // 3. not enough? more reviews, then the weakest items at this stage, then earlier stages
    due.forEach(take);
    const weakest = list => list.filter(i => !has[i.id]).sort((a, b) => ((rec(a.id) || {}).box || 0) - ((rec(b.id) || {}).box || 0) || Math.random() - .5);
    weakest(DATA.items.filter(i => tracks.indexOf(i.track) >= 0 && i.stage === S.tracks[i.track].stage)).forEach(take);
    weakest(DATA.items.filter(i => tracks.indexOf(i.track) >= 0 && i.stage < S.tracks[i.track].stage)).forEach(take);
    weakest(DATA.items.filter(i => tracks.indexOf(i.track) >= 0)).forEach(take);
    return shuffle(picked);
  }
  function startSession(mode) {
    S.session += 1; save();
    SESSION = { mode, items: buildSession(mode), i: 0, results: [], hint: false, answered: false };
    LAST_END = null;
    go("#/practice");
  }

  /* ---------------- recording answers ---------------- */
  function record(item, ok) {
    const r = rec(item.id) || { box: 1, due: 0, seen: 0, right: 0, wrong: 0, hints: 0 };
    r.seen++; if (SESSION.hint) r.hints++;
    if (ok) { r.right++; r.box = Math.min(5, r.box + 1); } else { r.wrong++; r.box = 1; }
    r.due = S.session + INTERVALS[r.box];
    S.items[item.id] = r;
    SESSION.results.push({ id: item.id, ok: !!ok, hint: SESSION.hint });
    SESSION.answered = true;
    save();
  }

  function finishSession() {
    const res = SESSION.results;
    const right = res.filter(r => r.ok).length, hints = res.filter(r => r.hint).length;
    // tally by track and stage, for unlocking
    const tally = {};
    res.forEach(r => { const it = DATA.byId[r.id]; const k = it.track + "|" + it.stage; tally[k] = tally[k] || { r: 0, t: 0 }; tally[k].t++; if (r.ok) tally[k].r++; });
    Object.keys(tally).forEach(k => {
      if (tally[k].t < MIN_PER_SESSION) return;
      const [t, st] = k.split("|"); const h = S.tracks[t].hist;
      (h[st] = h[st] || []).push(tally[k]); if (h[st].length > 6) h[st].shift();
    });
    const unlocked = [];
    Object.keys(TRACKS).forEach(t => {
      const tr = S.tracks[t], U = tr.unlocked, h = (tr.hist[U] || []).slice(-UNLOCK_SESSIONS);
      if (U < 5 && h.length >= UNLOCK_SESSIONS) {
        const sr = h.reduce((a, x) => a + x.r, 0), stt = h.reduce((a, x) => a + x.t, 0);
        if (stt && sr / stt >= UNLOCK_SCORE) {
          tr.unlocked = U + 1;
          if (tr.stage === U) tr.stage = U + 1;
          unlocked.push(TRACKS[t].name + ": Stage " + (U + 1) + ", " + stageTitle(t, U + 1));
        }
      }
    });
    // patterns
    const good = {}, bad = {};
    res.forEach(r => { const it = DATA.byId[r.id]; const p = it.pattern || stageTitle(it.track, it.stage); (r.ok ? good : bad)[p] = ((r.ok ? good : bad)[p] || 0) + 1; });
    S.log.push({ date: today(), mode: SESSION.mode, right, total: res.length, hints });
    if (S.log.length > 100) S.log.shift();
    save();
    LAST_END = { mode: SESSION.mode, right, total: res.length, hints, unlocked, good: Object.keys(good).filter(p => !bad[p]), bad: Object.keys(bad) };
    SESSION = null;
    go("#/end");
  }

  /* ---------------- routing ---------------- */
  const app = $("#app");
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function route() { return (location.hash.replace(/^#/, "") || "/").split("?")[0]; }
  function render() {
    const r = route();
    const nav = { "/": "home", "/practice": "home", "/end": "home", "/progress": "progress", "/words": "words", "/hedges": "hedges", "/about": "about" }[r] || "home";
    $$(".appnav a").forEach(a => { if (a.dataset.r === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (DATA.error) { page(`<h1 tabindex="-1">Sorry, something went wrong</h1><p class="notice">${esc(DATA.error)}</p>`); return; }
    if (!DATA.loaded) return;
    if (r === "/practice") { if (SESSION) renderItem(); else go("#/"); return; }
    if (r === "/end") { if (LAST_END) renderEnd(); else go("#/"); return; }
    ({ "/progress": renderProgress, "/words": renderWords, "/hedges": renderHedges, "/about": renderAbout }[r] || renderHome)();
  }
  function page(html, focusSel) {
    app.innerHTML = `<div class="wrap page">${html}</div>`;
    const f = $(focusSel || "h1", app);
    if (f) { if (!f.hasAttribute("tabindex")) f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: false }); }
    window.scrollTo(0, 0);
  }
  const storeNote = () => STORE_OK ? "" : `<p class="notice">This browser is not saving your progress (storage is blocked or full). You can still practise, but your progress will be lost when you close the page.</p>`;

  /* ---------------- home ---------------- */
  function renderHome() {
    const goal = m => S.goals[m] ? `<p class="goal">Your last goal (${esc(S.goals[m].date)}): “${esc(S.goals[m].text)}”</p>` : "";
    const cont = SESSION ? `<div class="card"><h2>You have a session in progress</h2><p>Question ${SESSION.i + 1} of ${SESSION.items.length}.</p><a class="btn primary" href="#/practice">Continue</a></div>` : "";
    const card = t => {
      const tr = S.tracks[t], due = dueItems([t]).length;
      const stages = [1, 2, 3, 4, 5].map(n => {
        return `<li><button type="button" class="btn stage-btn" data-stage="${n}" data-track="${t}" ${n === tr.stage ? 'aria-current="true"' : ""}>
          <span>Stage ${n}: ${esc(stageTitle(t, n))}</span><span class="small">${n === tr.stage ? "● Now" : "Choose"}</span></button></li>`;
      }).join("");
      return `<section class="card" aria-labelledby="h-${t}">
        <h2 id="h-${t}">Track ${TRACKS[t].letter}: ${TRACKS[t].name}</h2>
        <p class="muted">${TRACKS[t].blurb}</p>
        <p><strong>You are on Stage ${tr.stage}: ${esc(stageTitle(t, tr.stage))}.</strong>${due ? ` ${due} item${due > 1 ? "s" : ""} to review.` : ""}</p>
        ${goal(t)}
        <button class="btn primary full" type="button" data-start="${t}">Start ${TRACKS[t].name.toLowerCase()} practice</button>
        <details><summary>Choose any stage (1 to 5)</summary>
          <p class="small muted">You can choose any stage, at any time. Tip: move on when you get about 8 out of 10 right in two sessions.</p>
          <ul class="stages">${stages}</ul></details>
      </section>`;
    };
    page(`<h1>Short practice for academic writing</h1>
      <p>Ten questions, about five to eight minutes. Pick a track and start.</p>
      ${storeNote()}${cont}
      <div class="grid two">${card("nominalisation")}${card("hedging")}</div>
      <section class="card" aria-labelledby="h-mixed">
        <h2 id="h-mixed">Mixed: both tracks</h2>
        <p class="muted">Questions from both tracks at your current stages. Best when you are at Stage 3 or higher in both tracks.</p>
        ${goal("mixed")}
        <button class="btn primary full" type="button" data-start="mixed">Start mixed practice</button>
      </section>`);
    $$("[data-start]", app).forEach(b => b.addEventListener("click", () => startSession(b.dataset.start)));
    $$(".stage-btn", app).forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.track, n = +b.dataset.stage, tr = S.tracks[t];
      tr.unlocked = Math.max(tr.unlocked, n);
      tr.stage = n; save(); renderHome();
      const again = $(`.stage-btn[data-track="${t}"][data-stage="${n}"]`, app);
      if (again) { again.closest("details").open = true; again.focus(); }
    }));
  }

  /* ---------------- one item ---------------- */
  function defaultQuestion(it) {
    if (it.question) return it.question;
    switch (it.type) {
      case "spot": return it.track === "hedging" ? "Which words make this claim less certain? Tap them." : "Which words are nominalisations? Tap them.";
      case "gapfill": return "How would you say this in an essay? Fill the gaps.";
      case "rewrite": return "How would you say this in an essay?";
      case "order": return "Put these in order, strongest first.";
      default: return "";
    }
  }
  function renderItem() {
    const it = SESSION.items[SESSION.i];
    if (!it) { finishSession(); return; }
    SESSION.hint = false; SESSION.answered = false;
    const n = SESSION.i + 1, total = SESSION.items.length;
    let q = defaultQuestion(it), prompt = it.prompt;
    if (it.type === "choose" && !it.question && prompt.indexOf("\n") > 0) { const lines = prompt.split("\n"); q = lines.shift(); prompt = lines.join("\n"); }
    const promptHtml = prompt ? `<div class="prompt">${prompt.split("\n").map(esc).join("<br>")}</div>` : "";
    const evid = it.evidence ? `<p class="evidence"><strong>Evidence:</strong> ${esc(it.evidence)}</p>` : "";
    const top = it.type === "evidence" ? `<p class="evidence"><strong>Evidence:</strong> ${esc(it.prompt)}</p>` : evid + (it.type === "word" ? "" : promptHtml);
    page(`<div class="progressline"><span>Question ${n} of ${total}</span><span>${TRACKS[it.track].name} · Stage ${it.stage}: ${esc(stageTitle(it.track, it.stage))}</span></div>
      <div class="bar" aria-hidden="true"><span style="width:${(n - 1) / total * 100}%"></span></div>
      <h1 class="question" id="q">${esc(it.type === "word" ? it.prompt : q)}</h1>
      ${top}
      <div id="hintbox" aria-live="polite"></div>
      <div id="work"></div>
      <div id="fb"></div>
      <p class="no-print"><a href="#/" class="small">Stop and go back to the start</a></p>`);
    renderWork(it);
    if (it.hint) {
      const hb = $("#hintbox");
      hb.innerHTML = `<button type="button" class="btn quiet" id="hintBtn">Need a hint?</button>`;
      $("#hintBtn").addEventListener("click", () => { SESSION.hint = true; hb.innerHTML = `<p class="hint"><strong>Hint:</strong> ${esc(it.hint)}</p>`; });
    }
  }
  function hideHint() { const b = $("#hintBtn"); if (b) b.remove(); }

  function renderWork(it) {
    const w = $("#work");
    if (it.type === "word") {
      w.innerHTML = `<form id="f" class="stack"><label for="ans">Your answer</label><input type="text" id="ans" ${NOINPUT} inputmode="text">
        <button class="btn primary" type="submit">Check</button></form>`;
      $("#f").addEventListener("submit", e => {
        e.preventDefault(); if (SESSION.answered) return;
        const val = $("#ans").value; if (!val.trim()) { $("#ans").focus(); return; }
        const c = check(val, it.acceptedAnswers);
        $("#ans").readOnly = true; $("button[type=submit]", w).disabled = true;
        record(it, c.ok);
        const usNote = c.us ? `<p>You used American spelling. That is fine. The Australian spelling is <strong>${esc(c.form)}</strong>.</p>` : "";
        feedback(c.ok, c.ok ? usNote : `<p>You wrote: “${esc(val.trim())}”.</p>`, `<p><strong>Answer:</strong> ${esc(it.acceptedAnswers.join(" or "))}</p>`, it);
      });
    }

    else if (it.type === "spot") {
      const toks = it.prompt.split(/\s+/);
      const targets = it.acceptedAnswers.map(cleanTok);
      $(".prompt", app) && $(".prompt", app).remove();
      w.innerHTML = `<p class="small muted">${it.track === "nominalisation" ? "Look for nouns with endings like -tion, -ment, -ity, -ance, -ness, -sis." : "Look for words like may, suggest, some, often, possibly."} Tap a word again to undo.</p>
        <div class="tokens" role="group" aria-label="Words in the sentence">${toks.map((t, i) => `<button type="button" class="tok" data-i="${i}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
        <button type="button" class="btn primary" id="chk">Check</button>`;
      $$(".tok", w).forEach(b => b.addEventListener("click", () => { if (!SESSION.answered) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); }));
      $("#chk").addEventListener("click", () => {
        if (SESSION.answered) return;
        const sel = $$(".tok", w).filter(b => b.getAttribute("aria-pressed") === "true");
        if (!sel.length) { $("#chk").insertAdjacentHTML("afterend", ` <span class="small" role="status">Tap at least one word first.</span>`); return; }
        const selSet = new Set(sel.map(b => cleanTok(toks[+b.dataset.i])));
        const ok = selSet.size === new Set(targets).size && targets.every(t => selSet.has(t));
        $$(".tok", w).forEach(b => {
          const word = cleanTok(toks[+b.dataset.i]), on = b.getAttribute("aria-pressed") === "true", isT = targets.indexOf(word) >= 0;
          b.disabled = true;
          if (on && isT) { b.classList.add("ok"); b.insertAdjacentHTML("beforeend", ' <span aria-hidden="true">✓</span><span class="sr">(right)</span>'); }
          else if (on) { b.classList.add("bad"); b.insertAdjacentHTML("beforeend", ' <span aria-hidden="true">✗</span><span class="sr">(not a target word)</span>'); }
          else if (isT) { b.classList.add("miss"); b.insertAdjacentHTML("beforeend", ' <span class="small">(missed)</span>'); }
        });
        $("#chk").disabled = true;
        record(it, ok);
        feedback(ok, "", `<p><strong>Answer:</strong> ${esc(it.acceptedAnswers.join(", "))}</p>`, it);
      });
    }

    else if (it.type === "choose" || it.type === "evidence") {
      const opts = shuffle(it.options.map((o, i) => ({ o, label: it.optionLabels ? it.optionLabels[i] : "" })));
      w.innerHTML = `<div class="opts" role="group" aria-labelledby="q">${opts.map((x, i) => `<button type="button" class="opt" data-i="${i}">${esc(x.o)}</button>`).join("")}</div>`;
      $$(".opt", w).forEach(b => b.addEventListener("click", () => {
        if (SESSION.answered) return;
        const choice = opts[+b.dataset.i], ok = choice.o === it.acceptedAnswers[0];
        $$(".opt", w).forEach((ob, i) => {
          const x = opts[i], right = x.o === it.acceptedAnswers[0];
          ob.disabled = true;
          let lbl = x.label ? esc(x.label) : "";
          if (right) { ob.classList.add("ok"); lbl = "✓ " + (lbl || "Best answer"); }
          else if (ob === b) { ob.classList.add("bad"); lbl = "✗ " + (lbl || "Your answer"); }
          if (ob === b) lbl += " (your choice)";
          if (lbl) ob.insertAdjacentHTML("beforeend", `<span class="lbl">${lbl}</span>`);
        });
        record(it, ok);
        feedback(ok, "", `<p><strong>Answer:</strong> ${esc(it.acceptedAnswers[0])}</p>`, it);
      }));
    }

    else if (it.type === "order") {
      let start = shuffle(it.options), tries = 0;
      while (start.join("|") === it.acceptedAnswers.join("|") && tries++ < 10) start = shuffle(it.options);
      const chosen = [];
      const draw = () => {
        const left = start.filter(o => chosen.indexOf(o) < 0);
        w.innerHTML = `<p class="small muted">Tap the options in order. Tap an item in “Your order” to take it out.</p>
          <h2 class="small">Options</h2>
          <div class="opts" role="group" aria-label="Options">${left.map(o => `<button type="button" class="opt" data-add="${esc(o)}">${esc(o)}</button>`).join("") || `<p class="small muted">All placed.</p>`}</div>
          <h2 class="small">Your order (strongest first)</h2>
          <ol class="order-list">${it.options.map((_, i) => chosen[i] ? `<li><button type="button" class="opt" data-rm="${i}"><strong>${i + 1}.</strong> ${esc(chosen[i])} <span class="sr">(tap to take out)</span></button></li>` : `<li class="slot">${i + 1}. …</li>`).join("")}</ol>
          <div class="row"><button type="button" class="btn primary" id="chk" ${chosen.length === it.options.length ? "" : "disabled"}>Check</button>
          <button type="button" class="btn quiet" id="reset" ${chosen.length ? "" : "disabled"}>Start again</button></div>`;
        $$("[data-add]", w).forEach(b => b.addEventListener("click", () => { chosen.push(b.dataset.add); draw(); const nx = $("[data-add]", w) || $("#chk", w); nx.focus(); }));
        $$("[data-rm]", w).forEach(b => b.addEventListener("click", () => { chosen.splice(+b.dataset.rm, 1); draw(); ($("[data-add]", w) || $("#chk", w)).focus(); }));
        $("#reset", w).addEventListener("click", () => { chosen.length = 0; draw(); $("[data-add]", w).focus(); });
        $("#chk", w).addEventListener("click", () => {
          if (SESSION.answered) return;
          const ok = chosen.join("|") === it.acceptedAnswers.join("|");
          w.innerHTML = `<h2 class="small">Your order</h2><ol class="order-list">${chosen.map((c, i) => {
            const r = c === it.acceptedAnswers[i];
            return `<li class="opt ${r ? "ok" : "bad"}">${i + 1}. ${esc(c)} <span class="lbl">${r ? "✓ Right place" : "✗ Wrong place"}</span></li>`;
          }).join("")}</ol>`;
          record(it, ok);
          feedback(ok, "", `<p><strong>Correct order:</strong></p><ol>${it.acceptedAnswers.map(a => `<li>${esc(a)}</li>`).join("")}</ol>`, it);
        });
      };
      draw();
    }

    else if (it.type === "gapfill") {
      const parts = it.frame.split("___");
      let html = esc(parts[0]);
      for (let i = 1; i < parts.length; i++) html += `<label class="sr" for="g${i}">Gap ${i}</label><input type="text" class="gap" id="g${i}" ${NOINPUT}>` + esc(parts[i]);
      w.innerHTML = `<form id="f" class="stack"><p class="frame">${html}</p><button class="btn primary" type="submit">Check</button></form>`;
      $("#f").addEventListener("submit", e => {
        e.preventDefault(); if (SESSION.answered) return;
        const vals = $$(".gap", w).map(g => g.value);
        if (vals.every(v => !v.trim())) { $("#g1").focus(); return; }
        $$(".gap", w).forEach(g => g.readOnly = true); $("button[type=submit]", w).disabled = true; hideHint();
        const res = vals.map((v, i) => check(v, it.acceptedAnswers[i]));
        const model = `<p><strong>Model answer:</strong> ${esc(it.modelAnswers[0])}</p>`;
        const us = res.filter(r => r.us).map(r => r.form);
        const usNote = us.length ? `<p>You used American spelling. That is fine. The Australian spelling is <strong>${esc(us.join(", "))}</strong>.</p>` : "";
        if (res.every(r => r.ok)) { record(it, true); feedback(true, usNote, model, it); return; }
        if (vals.some(v => !v.trim())) { record(it, false); feedback(false, "<p>One gap was empty.</p>", model + expected(it), it); return; }
        // Not one of the expected answers: show the model and let the student judge.
        const yours = esc(parts[0]) + vals.map((v, i) => `<strong>${esc(v.trim())}</strong>${esc(parts[i + 1])}`).join("");
        $("#fb").innerHTML = `<div class="feedback neutral"><h2 tabindex="-1">This is not one of the answers I expected</h2>
          <p class="mine">Your sentence: ${yours}</p>${model}${expected(it)}
          <p>Your answer might still work. Compare it with the model. Does your sentence mean the same, and use nouns in the gaps?</p>
          <div class="actions"><button class="btn primary" type="button" data-judge="1">✓ Mine works</button><button class="btn" type="button" data-judge="0">✗ Mine needs work</button></div></div>`;
        $("#fb h2").focus();
        judge(it, model);
      });
    }

    else if (it.type === "rewrite") {
      w.innerHTML = `<form id="f" class="stack"><label for="ans">Your sentence</label><textarea id="ans" rows="3" ${NOINPUT}></textarea>
        <button class="btn primary" type="submit">Compare with model answers</button></form>`;
      $("#f").addEventListener("submit", e => {
        e.preventDefault(); if (SESSION.answered) return;
        const val = $("#ans").value.trim();
        if (!val) { $("#ans").focus(); $("#ans").setAttribute("aria-describedby", "needtext"); if (!$("#needtext")) $("#ans").insertAdjacentHTML("afterend", `<p id="needtext" class="small" role="status">Write your sentence first. It is fine if you are not sure.</p>`); return; }
        $("#ans").readOnly = true; $("button[type=submit]", w).disabled = true; hideHint();
        const models = `<p><strong>Model answers</strong> (there is more than one good answer):</p><ul class="models">${it.modelAnswers.map(m => `<li>${esc(m)}</li>`).join("")}</ul>`;
        const list = (SELF_CHECK[it.track][it.stage] || SELF_CHECK[it.track][4]);
        $("#fb").innerHTML = `<div class="feedback neutral"><h2 tabindex="-1">Compare your sentence</h2>
          <p class="mine">Your sentence: ${esc(val)}</p>${models}${aiBlock()}
          <p><strong>Check your sentence:</strong></p>
          <ul class="checklist">${list.map((c, i) => `<li><label><input type="checkbox" id="sc${i}"> <span>${esc(c)}</span></label></li>`).join("")}</ul>
          <div class="actions"><button class="btn primary" type="button" data-judge="1">✓ Mine works</button><button class="btn" type="button" data-judge="0">✗ Mine needs work</button></div></div>`;
        $("#fb h2").focus();
        judge(it, models);
        bindAi(it, val);
      });
    }
  }
  /* Optional AI feedback on a rewritten sentence (Worker route /rewrite via /assets/ai.js). The student still decides. */
  function aiBlock() {
    if (!window.DNAI) return "";
    return `<div class="ai-fb" id="aiFb"><button class="btn" type="button" id="aiBtn">Get AI feedback on my sentence</button>
      <p class="small" id="aiOut" role="status">AI feedback. It can be wrong or miss things. Your sentence is sent to Cloudflare Workers AI and not stored.</p></div>`;
  }
  function bindAi(it, val) {
    const b = $("#aiBtn"); if (!b) return;
    b.addEventListener("click", () => {
      b.disabled = true; b.textContent = "Checking…";
      DNAI.post("/rewrite", { skill: it.track === "hedging" ? "hedging" : "nominalisation", instruction: defaultQuestion(it), source: it.prompt, models: it.modelAnswers || [], answer: val }, { app: "nomhedge" })
        .then(r => {
          const head = { works: "✓ AI thinks your sentence works", almost: "~ AI thinks it is almost there", not_yet: "✗ AI thinks it needs more work", off_task: "AI thinks this doesn’t answer the task" }[r.verdict] || "AI feedback";
          $("#aiOut").innerHTML = `<b>${head}.</b>${r.well ? " " + esc(r.well) : ""}${(r.points || []).map(p => `<br>${p.quote ? "“" + esc(p.quote) + "”: " : ""}${esc(p.hint)}`).join("")}<br><span class="muted">AI feedback can be wrong. Compare with the models and decide.</span>`;
          b.remove();
        })
        .catch(e => { b.disabled = false; b.textContent = "Get AI feedback on my sentence"; $("#aiOut").textContent = e.message; });
    });
  }
  function expected(it) {
    return `<p><strong>Answers I expected:</strong> ${it.acceptedAnswers.map((a, i) => `gap ${i + 1}: ${esc(a.join(" / "))}`).join("; ")}</p>`;
  }
  function judge(it, answerHtml) {
    $$("[data-judge]", $("#fb")).forEach(b => b.addEventListener("click", () => {
      if (SESSION.answered) return;
      const ok = b.dataset.judge === "1";
      record(it, ok);
      feedback(ok, `<p>You said: ${ok ? "Mine works." : "Mine needs work. This item will come back next session."}</p>`, answerHtml, it, true);
    }));
  }
  function feedback(ok, extra, answerHtml, it, selfJudged) {
    hideHint();
    const last = SESSION.i + 1 >= SESSION.items.length;
    const head = selfJudged ? (ok ? "✓ Good, you judged it works" : "✗ Noted: it needs work") : (ok ? "✓ Right" : "✗ Not quite");
    $("#fb").innerHTML = `<div class="feedback ${ok ? "ok" : "bad"}"><h2 tabindex="-1">${head}</h2>${extra || ""}${answerHtml}
      <p><strong>Why:</strong> ${esc(it.reason)}</p>
      <button class="btn primary" type="button" id="next">${last ? "See my results" : "Next question"}</button></div>`;
    $("#fb h2").focus();
    $("#next").addEventListener("click", () => { SESSION.i++; if (SESSION.i >= SESSION.items.length) finishSession(); else renderItem(); });
  }

  /* ---------------- end of session ---------------- */
  function renderEnd() {
    const e = LAST_END, m = e.mode;
    const name = m === "mixed" ? "Mixed" : TRACKS[m].name;
    page(`<h1>Session finished</h1>
      <div class="card"><p><strong>${e.right} out of ${e.total}</strong> right (${name}).${e.hints ? ` You used a hint ${e.hints} time${e.hints > 1 ? "s" : ""}.` : ""}</p>
        ${e.unlocked.length ? `<p class="notice">Ready for the next stage: ${e.unlocked.map(esc).join("; ")}. You can choose any stage on the start page.</p>` : ""}</div>
      <div class="grid two">
        <div class="card"><h2>What went well</h2>${e.good.length ? `<ul>${e.good.map(p => `<li>✓ ${esc(p)}</li>`).join("")}</ul>` : `<p>Keep going. Every session helps you remember.</p>`}</div>
        <div class="card"><h2>Patterns to review</h2>${e.bad.length ? `<ul>${e.bad.map(p => `<li>↻ ${esc(p)}</li>`).join("")}</ul><p class="small muted">These items will come back next session.</p>` : `<p>Nothing this time. Well done!</p>`}</div>
      </div>
      <form class="card stack" id="goalForm"><label for="goal">What will you try in your next piece of writing?</label>
        <textarea id="goal" rows="3" placeholder="For example: I will turn one ‘because’ clause into a noun phrase." ${NOINPUT}>${esc(S.goals[m] ? S.goals[m].text : "")}</textarea>
        <div class="row"><button class="btn primary" type="submit">Save my goal</button><span id="goalMsg" role="status" class="small"></span></div></form>
      ${window.DNNext ? DNNext.html("nomhedge") : ""}
      <div class="actions"><button class="btn primary" type="button" id="again">Practise again</button><a class="btn" href="#/progress">See my progress</a><a class="btn quiet" href="#/">Back to start</a></div>`);
    $("#goalForm").addEventListener("submit", ev => {
      ev.preventDefault();
      const t = $("#goal").value.trim();
      if (t) S.goals[m] = { text: t, date: today() }; else delete S.goals[m];
      save(); $("#goalMsg").textContent = t ? (STORE_OK ? "✓ Saved." : "Saved for now (this browser cannot store it).") : "Goal cleared.";
    });
    $("#again").addEventListener("click", () => startSession(m));
  }

  /* ---------------- progress ---------------- */
  function trackStats(t) {
    const all = itemsOf(t), mastered = all.filter(i => rec(i.id) && rec(i.id).box >= MASTER_BOX).length, seen = all.filter(i => rec(i.id)).length;
    const pat = {};
    all.forEach(i => { const r = rec(i.id); if (!r) return; const p = i.pattern || stageTitle(t, i.stage); pat[p] = pat[p] || { w: 0, r: 0, h: 0 }; pat[p].w += r.wrong; pat[p].r += r.right; pat[p].h += r.hints; });
    const trouble = Object.keys(pat).filter(p => pat[p].w >= 2).sort((a, b) => pat[b].w - pat[a].w).slice(0, 5);
    const hinty = Object.keys(pat).filter(p => pat[p].h >= 3 && trouble.indexOf(p) < 0);
    return { all: all.length, mastered, seen, trouble, pat, hinty };
  }
  function summaryText() {
    const lines = ["Nominalisation and Hedging Trainer: my progress (" + today() + ")"];
    Object.keys(TRACKS).forEach(t => {
      const st = trackStats(t), tr = S.tracks[t];
      lines.push(`Track ${TRACKS[t].letter} ${TRACKS[t].name}: stage reached ${tr.unlocked} of 5 (${stageTitle(t, tr.unlocked)}). Items mastered: ${st.mastered} of ${st.all}. Patterns to review: ${st.trouble.join(", ") || "none"}.`);
    });
    lines.push("Sessions completed: " + S.log.length);
    Object.keys(S.goals).forEach(m => lines.push(`My goal (${m === "mixed" ? "Mixed" : TRACKS[m].name}): ${S.goals[m].text}`));
    return lines.join("\n");
  }
  function renderProgress() {
    const links = DATA.links || {};
    const block = t => {
      const st = trackStats(t), tr = S.tracks[t];
      const lk = (links[t] || []).filter(l => l && l.url);
      return `<section class="card" aria-labelledby="p-${t}"><h2 id="p-${t}">Track ${TRACKS[t].letter}: ${TRACKS[t].name}</h2>
        <div class="kv"><span>Stage reached</span><strong>${tr.unlocked} of 5: ${esc(stageTitle(t, tr.unlocked))}</strong></div>
        <div class="kv"><span>Practising now</span><strong>Stage ${tr.stage}</strong></div>
        <div class="kv"><span>Items mastered</span><strong>${st.mastered} of ${st.all}</strong></div>
        <div class="kv"><span>Items tried</span><strong>${st.seen} of ${st.all}</strong></div>
        <h3>Patterns that keep causing trouble</h3>
        ${st.trouble.length ? `<ul>${st.trouble.map(p => `<li>${esc(p)} <span class="small muted">(${st.pat[p].w} wrong, ${st.pat[p].r} right)</span></li>`).join("")}</ul>` : `<p class="muted">None yet.</p>`}
        ${st.hinty.length ? `<p class="small">You often use hints for: ${st.hinty.map(esc).join(", ")}.</p>` : ""}
        <h3>Study more</h3><ul><li><a href="${TRACKS[t].ref}">${TRACKS[t].refName} (in this app)</a></li>
        ${lk.slice(0, 2).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)}</a> <span class="small muted">(opens a new tab)</span></li>`).join("")}</ul>
      </section>`;
    };
    const recent = S.log.slice(-5).reverse();
    page(`<h1>My progress</h1>${storeNote()}
      <div class="grid two">${block("nominalisation")}${block("hedging")}</div>
      <section class="card"><h2>Recent sessions</h2>${recent.length ? `<ul>${recent.map(l => `<li>${esc(l.date)}: ${l.mode === "mixed" ? "Mixed" : TRACKS[l.mode].name}, ${l.right} of ${l.total} right${l.hints ? `, ${l.hints} hint${l.hints > 1 ? "s" : ""}` : ""}</li>`).join("")}</ul>` : `<p class="muted">No sessions yet.</p>`}
        ${Object.keys(S.goals).map(m => `<p class="goal">Goal (${m === "mixed" ? "Mixed" : TRACKS[m].name}): “${esc(S.goals[m].text)}”</p>`).join("")}</section>
      <div class="actions no-print"><button class="btn primary" type="button" id="copy">Copy summary</button><button class="btn" type="button" id="print">Print</button><button class="btn quiet" type="button" id="clear">Clear my data</button></div>
      <p id="msg" role="status" class="small"></p>`);
    $("#copy").addEventListener("click", () => {
      const txt = summaryText(), done = () => { $("#msg").textContent = "✓ Summary copied. You can paste it into an email or document."; };
      const fallback = () => { const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove(); if (ok) done(); else $("#msg").textContent = "Sorry, copying did not work in this browser."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    });
    $("#print").addEventListener("click", () => window.print());
    $("#clear").addEventListener("click", () => {
      if (!window.confirm("Delete all your progress, review schedule and goals from this device? This cannot be undone.")) return;
      S = blank(); SESSION = null; LAST_END = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
      renderProgress(); $("#msg").textContent = "✓ Your data has been cleared.";
    });
  }

  /* ---------------- reference pages ---------------- */
  function renderWords() {
    const groups = (DATA.ref && DATA.ref.wordFamilies) || [];
    page(`<h1>Word families</h1><p>Common ways to turn a verb or adjective into a noun. Australian spelling is used (analyse, behaviour).</p>
      ${groups.map(g => `<section class="card"><h2>${esc(g.title)}</h2>${g.note ? `<p class="muted small">${esc(g.note)}</p>` : ""}
        <ul class="ref-entries">${(g.entries || []).map(e => `<li>${esc(e[0])} → <strong>${esc(e[1])}</strong></li>`).join("")}</ul>
        ${g.example ? `<p class="example">${esc(g.example)}</p>` : ""}</section>`).join("")}
      <p><a class="btn primary" href="#/">Practise</a></p>`);
  }
  function renderHedges() {
    const groups = (DATA.ref && DATA.ref.hedgingBank) || [];
    page(`<h1>Hedging bank</h1><p>Words that make a claim less certain, grouped by type.</p>
      ${DATA.ref && DATA.ref.hedgingTip ? `<p class="notice">${esc(DATA.ref.hedgingTip)}</p>` : ""}
      ${groups.map(g => `<section class="card"><h2>${esc(g.title)}</h2>${g.note ? `<p class="muted small">${esc(g.note)}</p>` : ""}
        <ul class="ref-entries">${(g.entries || []).map(e => `<li>${esc(e)}</li>`).join("")}</ul>
        ${g.example ? `<p class="example">${esc(g.example)}</p>` : ""}</section>`).join("")}
      <p><a class="btn primary" href="#/">Practise</a></p>`);
  }
  function renderAbout() {
    page(`<h1>About this app</h1>
      <div class="card"><h2>What it is for</h2><p>Many students write in a spoken style: short clauses with lots of verbs, and claims that sound 100% certain. University writing asks for two skills: <strong>nominalisation</strong> (putting actions and qualities into nouns) and <strong>hedging</strong> (making a claim as strong as the evidence, and no stronger).</p>
        <p>This app gives you short, regular practice. You answer from memory, items you get wrong come back later, and items you know come back less often. You move from single words to full sentences. Some items show what happens when you use <em>too much</em> nominalisation or hedging, so you also learn when to stop.</p></div>
      <div class="card"><h2>Who wrote the questions</h2><p>The practice items were drafted with the help of AI and checked by the teacher, Dave Nab.</p>
        <p>Most of the app does not use AI. On “rewrite” questions you can press <b>Get AI feedback on my sentence</b>: only then, your sentence, the task and the model answers are sent to Cloudflare Workers AI to create feedback. They are not stored or logged. AI feedback can be wrong, so compare with the models and decide yourself.</p></div>
      <div class="card"><h2>Why you check your own rewrites</h2><p>When you rewrite a whole sentence, there is more than one good answer, so the app does not mark it. Instead, you compare your sentence with model answers and a short checklist. Judging your own sentence is part of the skill: it is what you will do when you edit your essays.</p></div>
      <div class="card"><h2>What is stored, and where</h2><ul>
        <li>Your stage in each track, your review schedule, your recent scores, how often you used hints, and your goals.</li>
        <li>It is stored only in this browser on this device (localStorage). Your progress is never sent to a server.</li>
        <li>There is no sign-in, no tracking and no analytics.</li>
        <li>On a shared computer, use <strong>Clear my data</strong> on the <a href="#/progress">My progress</a> page when you finish. Clearing your browser data also deletes your progress.</li></ul></div>
      <div class="card"><h2>Content check</h2>${DATA.problems.length ? `<p class="notice">Some items were skipped because of mistakes in the data files:</p><ul>${DATA.problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p>✓ All ${DATA.items.length} items loaded with no problems.</p>`}</div>`);
  }

  /* ---------------- theme toggle ---------------- */
  const root = document.documentElement;
  $("#theme").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ---------------- start ---------------- */
  load();
  window.addEventListener("hashchange", render);
  loadData().then(render, err => {
    DATA.error = "The practice items could not be loaded. Please check your internet connection and reload the page. (If you opened the file from your computer, use the web address instead.)";
    if (window.console) console.error(err);
    render();
  });
  // for automated tests only
  window.__nht = { check, americanise, DATA, state: () => S, session: () => SESSION };
})();
