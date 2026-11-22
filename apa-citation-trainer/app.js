/* APA Trainer: APA 7th In-Text Citation Trainer
   Plain JavaScript. No framework, no server, no AI calls, no tracking.
   Practice items live in data/track-*.json (see README.md). House rules live in config.js.
   Progress is kept in localStorage on this device only, and the app still works if storage is blocked. */
(function () {
  "use strict";

  /* ---------------- settings ---------------- */
  const KEY = "dave-cite-v1";
  const SESSION_SIZE = 10;
  const MAX_REVIEW = 6;                   // at most this many review items per session, so new items still appear
  const INTERVALS = [0, 1, 2, 4, 8, 16];  // box number -> sessions until the item comes back
  const MASTER_BOX = 4;                   // box 4 or 5 = "mastered"
  const UNLOCK_SCORE = 0.8;               // about 80% right ...
  const UNLOCK_SESSIONS = 2;              // ... over two sessions
  const MIN_PER_SESSION = 3;              // a session counts for a stage if it had at least 3 items from that stage
  const TRACKS = {
    A: { name: "Citation formats", file: "data/track-a.json", chip: "c-a", blurb: "and / &, et al., commas, page numbers, several sources." },
    B: { name: "Secondary citation", file: "data/track-b.json", chip: "c-b", blurb: "“as cited in”: what it looks like and when to use it." },
    C: { name: "Reporting verbs", file: "data/track-c.json", chip: "c-c", blurb: "Better verbs than “says”: strength, grammar and tense." },
    D: { name: "Variety in citing", file: "data/track-d.json", chip: "c-d", blurb: "Author-first, idea-first and other patterns, so every sentence is not the same." }
  };
  const TRACK_IDS = ["A", "B", "C", "D"];
  const TYPES = ["choice", "build", "fix", "sort", "rewrite"];
  const SELF_CHECK = ["Is the citation format correct?", "Does my verb represent the author fairly?", "Is the meaning unchanged?"];

  /* house rules from config.js (checked, with safe defaults) */
  const RAW = window.CITE_CONFIG || {};
  const CFG = {
    reportingVerbTense: ["present", "past", "either"].indexOf(RAW.reportingVerbTense) >= 0 ? RAW.reportingVerbTense : "either",
    pageNumbersForParaphrase: ["optional", "required"].indexOf(RAW.pageNumbersForParaphrase) >= 0 ? RAW.pageNumbersForParaphrase : "optional"
  };
  const TENSE_TEXT = {
    present: "Your course uses the present simple for reporting verbs (Lee (2020) argues …).",
    past: "Your course uses the past or present perfect for reporting verbs (Lee (2020) argued / has argued …).",
    either: "Your course accepts the present simple (argues) or the past / present perfect (argued, has argued)."
  };
  const PAGE_TEXT = {
    optional: "Page numbers for a paraphrase are optional (APA default).",
    required: "Your course asks for a page number with a paraphrase too, when the source has pages."
  };

  /* ---------------- data ---------------- */
  const DATA = { items: [], byId: {}, stageTitles: { A: {}, B: {}, C: {}, D: {} }, nStages: { A: 0, B: 0, C: 0, D: 0 }, guide: null, topics: {}, verbs: null, links: null, problems: [], loaded: false, error: "" };
  let S = blank();
  let STORE_OK = true;
  let SESSION = null;   // the session in progress (memory only)
  let CUR = null;       // state of the item on screen
  let LAST_END = null;  // summary of the last finished session

  function blank() {
    return {
      v: 1, session: 0,
      tracks: { A: { unlocked: 1, stage: 1, hist: {} }, B: { unlocked: 1, stage: 1, hist: {} }, C: { unlocked: 1, stage: 1, hist: {} }, D: { unlocked: 1, stage: 1, hist: {} } },
      items: {},   // id -> { box, due, seen, right, wrong, hints }
      topics: {},  // topic -> { right, wrong }
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
  function stageTitle(t, n) { return DATA.stageTitles[t][n] || ("Stage " + n); }
  function modeName(m) { return m === "mixed" ? "Mixed" : "Track " + m + ": " + TRACKS[m].name; }
  function topicTitle(id) { return DATA.topics[id] ? DATA.topics[id].title : id; }
  const NOINPUT = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';

  /* Punctuation made easy to see: every mark in a citation gets its own little box. */
  const PM = /[,.;:&()\[\]“”"]/;
  function cite(s) {
    let out = "";
    for (const ch of String(s == null ? "" : s)) out += PM.test(ch) ? '<span class="pm">' + esc(ch) + "</span>" : esc(ch);
    return out;
  }
  /* In a full sentence, only the citation parts (brackets, &, et al.) get the boxes. */
  function sent(s) {
    s = String(s == null ? "" : s);
    const re = /\([^()]*\)|\[[^\]]*\]|&|\bet al\./g;
    let out = "", last = 0, m;
    while ((m = re.exec(s))) { out += esc(s.slice(last, m.index)) + '<span class="cite-in">' + cite(m[0]) + "</span>"; last = m.index + m[0].length; }
    return out + esc(s.slice(last));
  }
  /* {present|past} placeholders in the item files follow the reportingVerbTense setting ("either" shows the past form). */
  function tv(s) { return typeof s === "string" ? s.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (m, a, b) => CFG.reportingVerbTense === "present" ? a : b) : s; }
  function deepTv(x) {
    if (typeof x === "string") return tv(x);
    if (Array.isArray(x)) return x.map(deepTv);
    if (x && typeof x === "object") { const o = {}; for (const k in x) o[k] = (k === "tense") ? x[k] : deepTv(x[k]); return o; }
    return x;
  }

  /* ---------------- citations: joining tiles, comparing, diagnosing ---------------- */
  function joinTiles(tiles) {
    let out = "", prev = null;
    for (const t of tiles) {
      if (prev === null || prev === "(" || prev === "[" || [")", "]", ",", ";", "."].indexOf(t) >= 0) out += t; else out += " " + t;
      prev = t;
    }
    return out;
  }
  /* Tolerant of extra spaces, curly/straight quotes and dash types. NOT tolerant of missing punctuation. */
  function cnorm(s) {
    return String(s || "").replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-")
      .replace(/\s+/g, " ").trim()
      .replace(/([(\[])\s+/g, "$1").replace(/\s+([)\],;])/g, "$1").replace(/\s+\.(?=\s|$|[),;])/g, ".")
      .replace(/\s*-\s*(?=\d)/g, "-")
      .replace(/\)\.$/, ")");
  }
  function acceptedFor(it) {
    let acc = (it.acceptedAnswers || []).slice(), dropped = [];
    if (it.pageRule === "paraphrase" && CFG.pageNumbersForParaphrase === "required") {
      const withPage = acc.filter(a => /\b(p|pp|para)\./.test(a));
      if (withPage.length) { dropped = acc.filter(a => withPage.indexOf(a) < 0); acc = withPage; }
    }
    return { acc, dropped };
  }
  function checkCitation(input, it) {
    const { acc, dropped } = acceptedFor(it);
    const n = cnorm(input);
    const res = { ok: false, problems: [], shown: acc, notes: [] };
    if (it.pageRule === "paraphrase") res.notes.push(PAGE_TEXT[CFG.pageNumbersForParaphrase]);
    if (!n) { res.problems.push("You have not built or typed a citation yet."); return res; }
    if (acc.some(a => cnorm(a) === n)) { res.ok = true; return res; }
    if (dropped.some(a => cnorm(a) === n)) { res.problems.push("Your course asks for a page number with a paraphrase too, when the source has pages."); return res; }
    if (acc.some(a => cnorm(a).toLowerCase() === n.toLowerCase())) { res.problems.push("Check the capital letters: surnames start with a capital letter, and “et al.” and “as cited in” are lower case."); return res; }
    for (const d of (it.errorDiagnosis || [])) { if (d && d.answer && cnorm(d.answer) === n) res.problems.push(d.problem); }
    if (!res.problems.length) {
      const target = cnorm(acc.find(a => (cnorm(a)[0] === "(") === (n[0] === "(")) || acc[0] || "");
      diagnose(n, target).forEach(p => { if (res.problems.indexOf(p) < 0) res.problems.push(p); });
    }
    if (!res.problems.length) res.problems.push("Compare your citation with the correct one, mark by mark: names, commas, brackets and full stops.");
    res.problems = res.problems.slice(0, 3);
    return res;
  }
  function insideB(x) { return (x.match(/\([^()]*\)|\[[^\]]*\]/g) || []).join(" "); }
  function outsideB(x) { return x.replace(/\([^()]*\)/g, " "); }
  function names(x) { return x.match(/[A-Z][A-Za-z'-]+/g) || []; }
  function diagnose(s, t) {
    const P = [];
    const add = m => { if (P.indexOf(m) < 0) P.push(m); };
    const sPar = s[0] === "(", tPar = t[0] === "(";
    /* narrative or parenthetical? */
    if (tPar && !sPar) add("This needs a parenthetical citation: put the author and the year inside the brackets, e.g. (Lee, 2020).");
    if (!tPar && sPar) add("This needs a narrative citation: the author's name is part of the sentence and only the year goes in brackets, e.g. Lee (2020).");
    /* secondary citation */
    if (/as cited in/.test(t)) {
      if (/cited by/i.test(s)) add("Write “as cited in”, not “cited by”.");
      else if (/cited in/.test(s) && !/as cited in/.test(s)) add("One word is missing: the phrase is “as cited in”.");
      else if (!/cited/.test(s)) add("This is a secondary citation. Write “as cited in” before the source you actually read.");
      else {
        const tFirst = (t.match(/[A-Z][A-Za-z'-]+/) || [""])[0], sFirst = (s.match(/[A-Z][A-Za-z'-]+/) || [""])[0];
        if (tFirst && sFirst && tFirst !== sFirst && s.indexOf(tFirst) > -1) add("Wrong order: the original author comes first, then “as cited in” and the source you read.");
      }
      if (!tPar && /\)\s*as cited/.test(s)) add("In a narrative secondary citation, everything after the original author goes in ONE bracket: Varga (2014, as cited in Osei, 2021).");
      if (/;/.test(s) && !/;/.test(t)) add("A semicolon says you read both sources. Use “as cited in” instead.");
    }
    /* & or and */
    if (/\band\b/.test(insideB(s)) && /&/.test(insideB(t))) add("Inside brackets, use & between the last two authors, not “and”.");
    if (/&/.test(outsideB(s)) && /\band\b/.test(outsideB(t))) add("In the sentence (outside the brackets), write “and”, not &.");
    /* et al. */
    if (/et al/.test(t)) {
      if (/et\.\s?al/.test(s)) add("No full stop after “et”: write et al.");
      else if (/et al(?!\.)/.test(s)) add("Put a full stop after “al”: et al.");
      else if (!/et al/.test(s)) add("With three or more authors, write only the first author's surname + et al.");
      if (/[A-Za-z], et al/.test(s)) add("No comma between the surname and et al.");
    } else if (/et al/.test(s)) add("Use et al. only for three or more authors.");
    /* square brackets for a group abbreviation */
    if (/\[/.test(t) && !/\[/.test(s)) {
      const ab = (t.match(/\[([A-Z]+)\]/) || [])[1];
      if (ab && new RegExp("\\(" + ab + "\\)").test(s)) add("Put the abbreviation in square brackets [ ], not round brackets.");
      else add("The first time, write the full name, then the abbreviation in square brackets: [" + (ab || "ABC") + "].");
    }
    if (/as cited in/.test(t) && !/^\(?[^(]*\d{4}[^(]*as cited/.test(t) && /n\.?d/.test(s.split("as cited")[0])) add("The original year is unknown, so leave it out. Do not write n.d. here.");
    /* no date */
    if (/n\.d\./.test(t) && !/n\.d\./.test(s)) add(/no date|n\.?d\b|nd\b/i.test(s) ? "Write n.d. with two full stops (it means “no date”)." : "There is no date. Write n.d. in place of the year.");
    /* years */
    const tYears = t.match(/\b\d{4}[a-z]?\b/g) || [];
    const sYears = s.match(/\b\d{4}[a-z]?\b/g) || [];
    tYears.forEach(y => { if (sYears.indexOf(y) < 0) add(sYears.length ? "Check the year: it should be " + y + "." : "Add the year: " + y + "."); });
    if (!tYears.length && sYears.length && !/n\.d\./.test(t)) add("The original year is unknown, so leave it out.");
    /* comma before the year */
    if (/[A-Za-z.\]"] (\d{4}|n\.d\.)/.test(s) && !/[A-Za-z.\]"] (\d{4}|n\.d\.)/.test(t)) add("Put a comma between the author and the year.");
    if (!tPar && /[A-Za-z.], \(/.test(s)) add("No comma between the name and the bracket in a narrative citation.");
    /* pages */
    const hasP = /\bp\. ?\d/.test(s), hasPP = /\bpp\. ?\d/.test(s), hasPara = /\bpara\. ?\d/.test(s);
    if (/\bp\. \d/.test(t)) {
      if (/\b(pg|page)\b/i.test(s)) add("Write p. for one page, not “page” or “pg”.");
      else if (hasPP) add("Use p. for one page. Use pp. only for more than one page.");
      else if (!hasP) add("This is a direct quotation, so add the page number: " + (t.match(/p\. \d+/) || ["p. 15"])[0] + ".");
      else if (/\bp\.\d/.test(s)) add("Put a space after p.: " + (t.match(/p\. \d+/) || ["p. 15"])[0] + ".");
    }
    if (/\bpp\. \d/.test(t)) {
      if (hasP && !hasPP) add("The quotation runs over more than one page, so use pp.");
      else if (!hasPP) add("Add the pages: " + (t.match(/pp\. [\d-]+/) || ["pp. 12-13"])[0] + ".");
    }
    if (/\bpara\. \d/.test(t)) {
      if (hasP || hasPP) add("This source has no page numbers. Use the paragraph number: " + (t.match(/para\. \d+/) || ["para. 4"])[0] + ".");
      else if (/\bpara \d/.test(s)) add("Write para. with a full stop.");
      else if (!hasPara) add("Add the paragraph number: " + (t.match(/para\. \d+/) || ["para. 4"])[0] + ".");
    }
    if (/\b(p|pp|para)\. ?\d/.test(s) && /\d{4}/.test(t) && /\b(p|pp|para)\. ?\d[^)]*\b\d{4}\b/.test(s)) add("Wrong order: author, year, then page.");
    if (/\b\d{4}[a-z]?, \d+\)/.test(s) && /\b(p|pp|para)\. \d/.test(t)) add("Write p. before the page number.");
    if (/\b(p|pp|para)\. \d/.test(t) && /\d{4}[a-z]? (p|pp|para)\./.test(s)) add("Put a comma before the page: …, 2020, p. 15.");
    /* several works */
    if (/;/.test(t) && !/as cited/.test(t)) {
      if (!/;/.test(s)) add("Separate the different works with a semicolon (;).");
      else {
        const first = x => x.split(";").map(p => (p.match(/[A-Z][A-Za-z'-]+/) || [""])[0]);
        const a = first(s), b = first(t);
        if (a.length === b.length && a.join() !== b.join() && a.slice().sort().join() === b.slice().sort().join()) add("Put the works in alphabetical order by the first author's surname.");
      }
    }
    /* names */
    const tn = names(t).filter(w => ["As"].indexOf(w) < 0);
    const missing = tn.filter(w => s.indexOf(w) < 0);
    if (missing.length && !P.some(p => /et al|abbreviation|semicolon|order/.test(p))) add("Check the author's name: " + missing[0] + " is missing or spelt differently.");
    /* brackets */
    const cnt = (x, c) => x.split(c).length - 1;
    if (cnt(s, "(") !== cnt(s, ")")) add("Check the brackets: every ( needs a ).");
    return P;
  }
  /* Can this answer be built from these tiles? (used by the content check) */
  function canBuild(answer, tiles) {
    const target = cnorm(answer);
    const pool = tiles.map(t => cnorm(t));
    const used = pool.map(() => false);
    function go(pos, prev) {
      if (pos === target.length) return true;
      const tried = {};
      for (let i = 0; i < pool.length; i++) {
        if (used[i] || tried[pool[i]]) continue;
        tried[pool[i]] = 1;
        const t = pool[i];
        const sp = !(prev === null || prev === "(" || prev === "[" || [")", "]", ",", ";", "."].indexOf(t) >= 0);
        const piece = (sp ? " " : "") + t;
        if (target.substr(pos, piece.length) === piece) { used[i] = true; if (go(pos + piece.length, t)) return true; used[i] = false; }
      }
      return false;
    }
    return go(0, null);
  }

  /* ---------------- content check (helps the teacher spot mistakes in the JSON) ---------------- */
  function validate(it, where) {
    const p = msg => DATA.problems.push((it && it.id ? it.id : where) + ": " + msg);
    if (!it || typeof it !== "object") { p("not an item"); return false; }
    if (!it.id) { p("missing id"); return false; }
    if (DATA.byId[it.id]) { p("the same id is used twice"); return false; }
    if (!TRACKS[it.track]) { p("track must be \"A\", \"B\", \"C\" or \"D\""); return false; }
    if (!(it.stage >= 1 && it.stage <= DATA.nStages[it.track])) { p("stage must be a number from 1 to " + DATA.nStages[it.track]); return false; }
    if (TYPES.indexOf(it.type) < 0) { p("type must be one of: " + TYPES.join(", ")); return false; }
    if (typeof it.prompt !== "string" || !it.prompt) { p("missing prompt"); return false; }
    if (!it.rule) { p("missing rule"); return false; }
    if (it.sourceCards && !Array.isArray(it.sourceCards)) { p("sourceCards must be a list [ ]"); return false; }
    const acc = it.acceptedAnswers;
    const opts = Array.isArray(it.options) ? it.options : [];
    switch (it.type) {
      case "choice":
        if (opts.length < 2) { p("needs at least two options"); return false; }
        if (!Array.isArray(acc) || !acc.length || acc.some(a => opts.indexOf(a) < 0)) { p("each accepted answer must be copied exactly from the options"); return false; }
        if (it.tense && Object.keys(it.tense).some(k => opts.indexOf(k) < 0)) { p("each word in \"tense\" must be copied exactly from the options"); return false; }
        break;
      case "build": {
        if (!Array.isArray(it.tiles) || it.tiles.length < 2) { p("needs a list of tiles"); return false; }
        if (!Array.isArray(acc) || !acc.length) { p("needs at least one accepted answer"); return false; }
        const bad = acc.filter(a => !canBuild(a, it.tiles));
        if (bad.length) { p("this accepted answer cannot be built from the tiles: " + bad[0]); return false; }
        if (it.frame != null && (it.frame.split("___").length - 1) !== 1) { p("the frame needs exactly one gap written as ___"); return false; }
        break;
      }
      case "fix": {
        if (!it.frame) { p("needs the sentence in \"frame\""); return false; }
        if (!it.wrongCitation || it.frame.indexOf(it.wrongCitation) < 0) { p("wrongCitation must be copied exactly from the sentence"); return false; }
        const toks = it.frame.split(/\s+/);
        if (!Array.isArray(it.errorTokens) || !it.errorTokens.length) { p("needs errorTokens (the words to tap)"); return false; }
        const miss = it.errorTokens.filter(t => toks.indexOf(t) < 0);
        if (miss.length) { p("these errorTokens are not in the sentence (copy them exactly, with punctuation): " + miss.join("  ")); return false; }
        if (!Array.isArray(acc) || !acc.length) { p("needs the corrected citation in acceptedAnswers"); return false; }
        break;
      }
      case "sort":
        if (!Array.isArray(it.tiles) || !it.tiles.length) { p("needs the verbs to sort in tiles"); return false; }
        if (opts.length < 2) { p("needs the groups in options"); return false; }
        if (!acc || typeof acc !== "object" || Array.isArray(acc)) { p("acceptedAnswers must look like {\"suggest\": \"Tentative\", …}"); return false; }
        if (it.tiles.some(v => opts.indexOf(acc[v]) < 0)) { p("every verb needs a group, copied exactly from options"); return false; }
        break;
      case "rewrite":
        if (!Array.isArray(it.modelAnswers) || !it.modelAnswers.length) { p("needs at least one model answer"); return false; }
        break;
    }
    return true;
  }

  async function loadData() {
    try {
      const get = f => fetch(f, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(f + " (" + r.status + ")"); return r.json(); });
      const files = TRACK_IDS.map(t => TRACKS[t].file).concat(["data/guide.json", "data/verbs.json", "data/links.json"]);
      const res = await Promise.all(files.map(f => get(f).catch(e => { DATA.problems.push("Could not load " + f + ": " + e.message); return null; })));
      TRACK_IDS.forEach((t, i) => {
        const d = res[i];
        if (!d || !Array.isArray(d.stages)) return;
        DATA.nStages[t] = d.stages.length;
        d.stages.forEach((st, si) => {
          DATA.stageTitles[t][st.stage || si + 1] = st.title || ("Stage " + (si + 1));
        });
        d.stages.forEach((st, si) => (st.items || []).forEach((raw, ii) => {
          if (validate(raw, t + " stage " + (si + 1) + " item " + (ii + 1))) {
            const it = deepTv(raw);
            DATA.items.push(it); DATA.byId[it.id] = it;
          }
        }));
      });
      DATA.guide = res[4];
      if (DATA.guide && DATA.guide.sections) DATA.guide.sections.forEach(sec => (sec.rules || []).forEach(r => { DATA.topics[r.id] = r; }));
      DATA.verbs = res[5];
      DATA.links = res[6] || {};
      DATA.items.forEach(it => { if (it.topic && !DATA.topics[it.topic]) DATA.problems.push(it.id + ": topic \"" + it.topic + "\" is not in data/guide.json"); });
      if (!DATA.items.length) DATA.error = "The practice items could not be loaded.";
      TRACK_IDS.forEach(t => {
        const T = S.tracks[t]; const n = DATA.nStages[t] || 1;
        T.unlocked = Math.min(Math.max(1, T.unlocked || 1), n);
        T.stage = Math.min(Math.max(1, T.stage || 1), n);   /* any stage can be chosen */
      });
    } catch (e) { DATA.error = "The practice items could not be loaded."; }
    DATA.loaded = true;
  }

  /* ---------------- sessions ---------------- */
  function rec(id) { return S.items[id]; }
  function buildSession(mode) {
    const tracks = mode === "mixed" ? TRACK_IDS : [mode];
    const pool = DATA.items.filter(it => tracks.indexOf(it.track) >= 0 && it.stage <= Math.max(S.tracks[it.track].unlocked, S.tracks[it.track].stage));
    const picked = [];
    const add = it => { if (picked.length < SESSION_SIZE && picked.indexOf(it) < 0) picked.push(it); };
    pool.filter(it => rec(it.id) && rec(it.id).due <= S.session)
      .sort((a, b) => rec(a.id).box - rec(b.id).box || rec(a.id).due - rec(b.id).due)
      .slice(0, MAX_REVIEW).forEach(add);
    const robin = qs => { let any = true; while (picked.length < SESSION_SIZE && any) { any = false; qs.forEach(q => { const it = q.shift(); if (it) { add(it); any = true; } }); } };
    robin(tracks.map(t => shuffle(pool.filter(it => it.track === t && it.stage === S.tracks[t].stage && !rec(it.id)))));
    robin(tracks.map(t => shuffle(pool.filter(it => it.track === t && it.stage < S.tracks[t].stage && !rec(it.id)))));
    const weak = (a, b) => (rec(a.id).box - rec(b.id).box) || ((rec(b.id).wrong - rec(b.id).right) - (rec(a.id).wrong - rec(a.id).right));
    robin(tracks.map(t => pool.filter(it => it.track === t && it.stage === S.tracks[t].stage && rec(it.id)).sort(weak)));
    robin(tracks.map(t => pool.filter(it => it.track === t && rec(it.id)).sort(weak)));
    robin(tracks.map(t => shuffle(pool.filter(it => it.track === t))));
    return picked;
  }
  function startSession(mode, ids) {
    const preview = !!ids;
    const items = preview ? ids.map(id => DATA.byId[id]).filter(Boolean) : buildSession(mode);
    if (!items.length) return;
    if (!preview) { S.session += 1; save(); }
    SESSION = { mode, preview, items: items.map(i => i.id), i: 0, results: [] };
    startItem();
    if (location.hash === "#/practice") render(); else location.hash = "#/practice";
  }
  function startItem() {
    const it = DATA.byId[SESSION.items[SESSION.i]];
    CUR = { id: it.id, hint: false, done: false, ok: null, sel: null, built: [], typing: false, typed: "", tiles: it.tiles ? shuffle(it.tiles.map((t, i) => ({ t, i }))) : [], step: "tap", misses: 0, sort: {}, text: it.longAnswer ? (it.frame || "") : "", compared: false, checks: {}, fb: "", order: it.options ? (it.keepOrder ? it.options.slice() : shuffle(it.options)) : [] };
  }
  function record(it, ok) {
    SESSION.results.push({ id: it.id, ok, hint: CUR.hint, topic: it.topic, track: it.track, stage: it.stage });
    if (SESSION.preview) return;
    const r = S.items[it.id] || { box: 1, due: 0, seen: 0, right: 0, wrong: 0, hints: 0 };
    r.seen++;
    if (ok) { r.right++; r.box = Math.min(5, (r.box || 1) + 1); } else { r.wrong++; r.box = 1; }
    r.due = S.session + INTERVALS[r.box];
    if (CUR.hint) r.hints++;
    S.items[it.id] = r;
    if (it.topic) { const t = S.topics[it.topic] || { right: 0, wrong: 0 }; ok ? t.right++ : t.wrong++; S.topics[it.topic] = t; }
    save();
  }
  function endSession() {
    const res = SESSION.results;
    const right = res.filter(r => r.ok).length;
    const unlocks = [];
    if (!SESSION.preview) {
      const by = {};
      res.forEach(r => { const k = r.track + r.stage; by[k] = by[k] || { t: r.track, s: r.stage, r: 0, n: 0 }; by[k].n++; if (r.ok) by[k].r++; });
      Object.values(by).forEach(g => {
        if (g.n < MIN_PER_SESSION) return;
        const T = S.tracks[g.t];
        (T.hist[g.s] = T.hist[g.s] || []).push({ r: g.r, n: g.n });
        if (T.hist[g.s].length > 6) T.hist[g.s] = T.hist[g.s].slice(-6);
        if (g.s === T.unlocked && T.unlocked < DATA.nStages[g.t]) {
          const last = T.hist[g.s].slice(-UNLOCK_SESSIONS);
          const sr = last.reduce((a, x) => a + x.r, 0), sn = last.reduce((a, x) => a + x.n, 0);
          if (last.length >= UNLOCK_SESSIONS && sr / sn >= UNLOCK_SCORE) {
            T.unlocked++; T.stage = T.unlocked;
            unlocks.push("Track " + g.t + ": Stage " + T.unlocked + ", " + stageTitle(g.t, T.unlocked));
          }
        }
      });
      S.log.push({ date: today(), mode: SESSION.mode, right, total: res.length, hints: res.filter(r => r.hint).length });
      if (S.log.length > 60) S.log = S.log.slice(-60);
      save();
    }
    LAST_END = { mode: SESSION.mode, preview: SESSION.preview, results: res, right, unlocks };
    SESSION = null; CUR = null;
    location.hash = "#/results";
  }
  function stageProgress(t) {
    const T = S.tracks[t];
    const last = (T.hist[T.unlocked] || []).slice(-UNLOCK_SESSIONS);
    if (!last.length) return "";
    const sr = last.reduce((a, x) => a + x.r, 0), sn = last.reduce((a, x) => a + x.n, 0);
    return Math.round(100 * sr / sn) + "% right at this stage over your last " + (last.length === 1 ? "session" : last.length + " sessions");
  }

  /* ---------------- rendering: shared parts ---------------- */
  const APP = () => $("#app");
  function setNav(r) { $$(".appnav a").forEach(a => a.setAttribute("aria-current", a.dataset.r === r ? "page" : "false")); }
  function page(html, title, r) {
    APP().innerHTML = '<div class="wrap page' + (NOANIM ? "" : " enter") + '">' + html + "</div>";
    document.title = (title ? title + " | " : "") + "APA Trainer | Dave Nab";
    setNav(r);
  }
  function storeNote() { return STORE_OK ? "" : '<p class="notice" role="note">Your browser is not letting this app save. You can still practise, but your progress will be lost when you close the page.</p>'; }
  function chip(t) { return '<span class="chip ' + TRACKS[t].chip + '">Track ' + t + "</span>"; }
  function draftTag(it) { return ""; } /* draft labels are not shown to students (the teacher page still shows which items are checked) */
  function sourceCard(c) {
    const au = (c.authors || []).map(a => {
      const i = a.indexOf(",");
      return '<span class="au">' + (i > 0 ? "<b>" + esc(a.slice(0, i)) + "</b>" + esc(a.slice(i)) : "<b>" + esc(a) + "</b>") + "</span>";
    }).join(" ");
    const read = c.read === true ? '<span class="read yes">✓ You read this</span>' : c.read === false ? '<span class="read no">✗ You did not read this</span>' : "";
    return '<div class="source"><p class="src-top"><span class="src-label">Source card</span>' + read + "</p>" +
      '<dl class="src"><dt>' + ((c.authors || []).length > 1 ? "Authors" : "Author") + "</dt><dd>" + au + "</dd>" +
      "<dt>Year</dt><dd>" + esc(c.year) + "</dd><dt>Title</dt><dd><i>" + esc(c.title) + "</i></dd><dt>Type</dt><dd>" + esc(c.type) + "</dd>" +
      (c.where ? "<dt>Page</dt><dd>" + esc(c.where) + "</dd>" : "") + "</dl>" +
      (c.idea ? '<p class="idea"><b>The idea:</b> ' + esc(c.idea) + "</p>" : "") +
      (c.quote ? '<blockquote class="quote">“' + esc(c.quote) + "”</blockquote>" : "") +
      (c.did ? '<p class="did"><b>What the author did:</b> ' + esc(c.did) + "</p>" : "") + "</div>";
  }
  function cards(it) { return (it.sourceCards || []).length ? '<div class="sources">' + it.sourceCards.map(sourceCard).join("") + "</div>" : ""; }
  function frameHtml(it, fill) {
    const parts = String(it.frame).split("___");
    if (parts.length < 2) return '<p class="frame">' + sent(it.frame) + "</p>";
    const gap = fill ? '<span class="gap filled">' + cite(fill) + "</span>" : '<span class="gap" aria-label="gap">&nbsp;</span>';
    return '<p class="frame">' + sent(parts[0]) + gap + sent(parts.slice(1).join("___")) + "</p>";
  }

  /* ---------------- home ---------------- */
  function viewHome() {
    if (DATA.error) { page('<p class="notice">' + esc(DATA.error) + " If you opened the file straight from your computer, open the app from the website instead.</p>", "", "home"); return; }
    let h = '<section class="hero"><p class="eyebrow">APA 7th · In-text citations</p><h1>APA <span class="hl">Trainer</span></h1>' +
      '<p class="lead">Practise APA 7th in-text citations by building and fixing them yourself. One session is 10 questions and takes about 5 to 8 minutes.</p></section>' + storeNote() +
      (SESSION && !SESSION.preview ? '<div class="card"><h2>You have a session in progress</h2><p>' + esc(modeName(SESSION.mode)) + ", question " + (SESSION.i + 1) + " of " + SESSION.items.length + '.</p><a class="btn primary" href="#/practice">Continue your session</a></div>' : "");
    h += '<div class="tracks">';
    TRACK_IDS.forEach(t => {
      const T = S.tracks[t], n = DATA.nStages[t];
      const goal = S.goals[t];
      const dots = Array.from({ length: n }, (_, i) => '<span class="dot' + (i + 1 <= T.unlocked ? " on" : "") + (i + 1 === T.stage ? " cur" : "") + '"></span>').join("");
      h += '<article class="card track"><p class="track-top">' + chip(t) + '<span class="dots" aria-hidden="true">' + dots + "</span></p>" +
        "<h2>" + esc(TRACKS[t].name) + '</h2><p class="muted">' + esc(TRACKS[t].blurb) + "</p>" +
        '<p class="stage-now">Your stage: <b>' + T.stage + " of " + n + " · " + esc(stageTitle(t, T.stage)) + "</b></p>" +
        (stageProgress(t) ? '<p class="small muted">' + esc(stageProgress(t)) + "</p>" : "") +
        (goal ? '<p class="goal"><b>Your goal from last time:</b> ' + esc(goal.text) + "</p>" : "") +
        '<button class="btn primary" type="button" data-start="' + t + '">Practise Track ' + t + "</button>" +
        '<details class="stage-pick"><summary>Choose any stage (1 to ' + n + ')</summary><ul class="stages">' +
        Array.from({ length: n }, (_, i) => {
          const s = i + 1;
          return '<li><button class="stage-btn" type="button" data-track="' + t + '" data-stage="' + s + '"' + (s === T.stage ? ' aria-current="true"' : "") + ">" +
            "<span>" + s + ". " + esc(stageTitle(t, s)) + "</span><span class=\"small\">" + (s === T.stage ? "Selected" : "Choose") + "</span></button></li>";
        }).join("") + '</ul><p class="small muted">You can choose any stage, at any time. Tip: move on when you get about 8 out of 10 right in two sessions.</p></details></article>';
    });
    h += "</div>";
    const mg = S.goals.mixed;
    h += '<article class="card mixed"><h2>Mixed</h2><p class="muted">Questions from all four tracks, each at your current stage.</p>' + (mg ? '<p class="goal"><b>Your goal from last time:</b> ' + esc(mg.text) + "</p>" : "") +
      '<button class="btn primary" type="button" data-start="mixed">Practise mixed</button></article>';
    h += '<p class="small muted center">Need the rules first? Read the <a href="#/guide">Quick guide</a> or the <a href="#/verbs">Reporting verb bank</a>.</p>';
    page(h, "", "home");
    $$("[data-start]").forEach(b => b.addEventListener("click", () => startSession(b.dataset.start)));
    $$(".stage-btn").forEach(b => b.addEventListener("click", () => { const T = S.tracks[b.dataset.track]; T.stage = +b.dataset.stage; T.unlocked = Math.max(T.unlocked, T.stage); save(); viewHome(); const d = $$(".stage-pick")[TRACK_IDS.indexOf(b.dataset.track)]; if (d) { d.open = true; const x = $('.stage-btn[data-track="' + b.dataset.track + '"][data-stage="' + b.dataset.stage + '"]'); if (x) x.focus(); } }));
  }

  /* ---------------- practice ---------------- */
  function viewPractice() {
    if (!SESSION || !CUR) { location.hash = "#/"; return; }
    const it = DATA.byId[CUR.id];
    const n = SESSION.items.length, i = SESSION.i;
    let h = '<div class="progressline"><span>Question ' + (i + 1) + " of " + n + "</span><span>" + chip(it.track) + " <span class=\"small\">Stage " + it.stage + ": " + esc(stageTitle(it.track, it.stage)) + "</span>" + draftTag(it) + "</span></div>" +
      '<div class="bar" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + i + '"><span style="width:' + Math.round(100 * i / n) + '%"></span></div>' +
      (SESSION.preview ? '<p class="notice">Teacher preview: answers here are not saved.</p>' : "") +
      '<section class="card item" aria-labelledby="q" data-item="' + esc(it.id) + '"><h1 id="q" class="question" tabindex="-1">' + esc(it.prompt) + "</h1>" + cards(it) + body(it) +
      (it.hint && !CUR.done ? (CUR.hint ? '<p class="hint" role="note"><b>Hint:</b> ' + esc(it.hint) + "</p>" : '<p><button class="linkbtn" type="button" id="hintbtn">Show a hint</button></p>') : "") +
      '<div id="fb" aria-live="polite">' + (CUR.fb || "") + "</div>" + actions(it) + "</section>" +
      '<p class="small"><button class="linkbtn" type="button" id="quit">Stop this session</button></p>';
    page(h, "Practice", "home");
    wire(it);
  }
  function rerender(focusSel) {
    const y = window.scrollY;
    NOANIM = true; viewPractice(); NOANIM = false;
    window.scrollTo(0, y);
    if (focusSel) { const el = $(focusSel); if (el) el.focus(); }
  }

  function body(it) {
    switch (it.type) {
      case "choice": {
        const tense = it.tense ? '<p class="small muted">' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>" : "";
        const fill = CUR.done ? correctChoices(it)[0] : (CUR.sel || null);
        return (it.frame ? frameHtml(it, it.frame.indexOf("___") >= 0 ? fill : null) : "") + tense +
          '<div class="opts" role="group" aria-label="Options">' + CUR.order.map((o, k) => {
            let cls = "opt", lbl = "";
            if (CUR.done) {
              const good = correctChoices(it).indexOf(o) >= 0;
              if (good) { cls += " ok"; lbl = '<span class="lbl">✓ Correct answer</span>'; }
              else if (o === CUR.sel) { cls += " bad"; lbl = '<span class="lbl">✗ Your answer</span>'; }
            }
            const pressed = CUR.sel === o ? "true" : "false";
            return '<button class="' + cls + '" type="button" data-opt="' + k + '" aria-pressed="' + pressed + '"' + (CUR.done ? " disabled" : "") + ">" + (it.track === "A" || it.track === "B" ? sent(o) : esc(o)) + lbl + "</button>";
          }).join("") + "</div>";
      }
      case "build": {
        const ans = joinTiles(CUR.built.map(k => CUR.tiles[k].t));
        let h = it.frame ? frameHtml(it, CUR.typing ? (CUR.typed || null) : (ans || null)) : "";
        if (CUR.typing) {
          h += '<label for="typed">Type the citation:</label><input type="text" id="typed" class="cite-input" ' + NOINPUT + ' value="' + esc(CUR.typed) + '"' + (CUR.done ? " readonly" : "") + ">" +
            (CUR.done ? "" : '<p><button class="linkbtn" type="button" id="usetiles">Use the tiles instead</button></p>');
        } else {
          h += '<p class="lbl-line" id="line-l">Your citation:</p><div class="line" aria-labelledby="line-l">' +
            (CUR.built.length ? CUR.built.map((k, pos) => '<button class="tile in" type="button" data-pos="' + pos + '" aria-label="Remove ' + esc(spoken(CUR.tiles[k].t)) + '"' + (CUR.done ? " disabled" : "") + ">" + cite(CUR.tiles[k].t) + "</button>").join("") : '<span class="placeholder">Tap the tiles below in order.</span>') + "</div>" +
            (CUR.built.length ? '<p class="preview" aria-hidden="true">' + cite(ans) + "</p>" : "") +
            (CUR.done ? "" : '<p class="lbl-line" id="bank-l">Tiles:</p><div class="bank" aria-labelledby="bank-l">' +
              CUR.tiles.map((x, k) => CUR.built.indexOf(k) >= 0 ? "" : '<button class="tile" type="button" data-tile="' + k + '" aria-label="Add ' + esc(spoken(x.t)) + '">' + cite(x.t) + "</button>").join("") + "</div>" +
              '<div class="row tools"><button class="btn small-btn" type="button" id="undo"' + (CUR.built.length ? "" : " disabled") + '>Undo last tile</button><button class="btn small-btn" type="button" id="clear"' + (CUR.built.length ? "" : " disabled") + '>Start again</button><button class="linkbtn" type="button" id="typeit">Type it instead</button></div>');
        }
        return h;
      }
      case "fix": {
        const sentence = it.frame;
        const start = sentence.indexOf(it.wrongCitation), end = start + it.wrongCitation.length;
        let pos = 0;
        const toks = sentence.split(/(\s+)/).map(part => {
          const s0 = pos; pos += part.length;
          if (/^\s+$/.test(part) || !part) return part;
          const inCite = s0 < end && s0 + part.length > start;
          return { part, inCite };
        });
        let h = "";
        if (CUR.step === "tap" && !CUR.done) {
          h += '<p class="lbl-line">Tap the part with the mistake:</p><p class="frame tokens">' + toks.map((tk, k) => typeof tk === "string" ? " " : '<button class="tok" type="button" data-tok="' + k + '">' + (tk.inCite ? cite(tk.part) : esc(tk.part)) + "</button>").join("") + "</p>" +
            (CUR.misses ? '<p class="hint" role="status">That part is fine. Look again.</p>' : "");
        } else {
          h += '<p class="frame">' + sent(sentence) + "</p>";
          if (!CUR.done) h += '<p class="okline" role="status">' + (CUR.misses >= 2 ? "The mistake is in this citation: <span class=\"cite\">" + cite(it.wrongCitation) + "</span>" : "✓ Yes, the mistake is there.") + "</p>";
          h += '<label for="typed">Now fix the citation:</label><input type="text" id="typed" class="cite-input" ' + NOINPUT + ' value="' + esc(CUR.typed) + '"' + (CUR.done ? " readonly" : "") + ">";
        }
        return h;
      }
      case "sort":
        return it.tiles.map((v, k) => '<fieldset class="sortrow"><legend>' + esc(v) + '</legend><div class="seg">' +
          it.options.map((g, j) => {
            const id = "s" + k + "-" + j, chk = CUR.sort[v] === g;
            let mark = "";
            if (CUR.done && chk) mark = it.acceptedAnswers[v] === g ? " ✓" : " ✗";
            return '<input type="radio" id="' + id + '" name="s' + k + '" value="' + esc(g) + '" data-verb="' + esc(v) + '"' + (chk ? " checked" : "") + (CUR.done ? " disabled" : "") + '><label for="' + id + '"' + (CUR.done && it.acceptedAnswers[v] === g ? ' class="right"' : "") + ">" + esc(g) + mark + "</label>";
          }).join("") + "</div>" + (CUR.done && CUR.sort[v] !== it.acceptedAnswers[v] ? '<p class="small bad-text">✗ “' + esc(v) + "” is " + esc(it.acceptedAnswers[v]).toLowerCase() + ".</p>" : "") + "</fieldset>").join("");
      case "rewrite": {
        let h = '<div class="toquote">' + sent(it.frame || "") + "</div>";
        h += '<label for="rw">' + (it.longAnswer ? "Rewrite the paragraph here (change two or three sentences):" : "Write your sentence:") + "</label>" +
          '<textarea id="rw" ' + NOINPUT + (it.longAnswer ? ' rows="8"' : ' rows="3"') + (CUR.compared ? " readonly" : "") + ">" + esc(CUR.text) + "</textarea>";
        if (CUR.compared) {
          h += '<div class="compare"><h2>Compare with ' + (it.modelAnswers.length > 1 ? "these models" : "this model") + "</h2>" +
            '<p class="small muted">There is more than one good answer. Yours does not need to match exactly.</p><ul class="models">' + it.modelAnswers.map(m => "<li>" + sent(m) + "</li>").join("") + "</ul>" +
            (it.track === "C" || it.track === "D" ? '<p class="small muted">' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>" : "") +
            '<h2>Check your answer</h2><ul class="checklist">' + (it.selfCheck || SELF_CHECK).map((q, k) => '<li><label><input type="checkbox" data-chk="' + k + '"' + (CUR.checks[k] ? " checked" : "") + (CUR.done ? " disabled" : "") + "> " + esc(q) + "</label></li>").join("") + "</ul></div>";
        }
        return h;
      }
    }
    return "";
  }
  function spoken(t) { return ({ "(": "open bracket", ")": "close bracket", "[": "open square bracket", "]": "close square bracket", ",": "comma", ";": "semicolon", ".": "full stop", "&": "ampersand" })[t] || t; }
  function correctChoices(it) {
    const acc = it.acceptedAnswers.slice();
    if (!it.tense) return acc;
    return acc.filter(o => !it.tense[o] || CFG.reportingVerbTense === "either" || it.tense[o] === CFG.reportingVerbTense);
  }
  function actions(it) {
    if (CUR.done) {
      const last = SESSION.i === SESSION.items.length - 1;
      return '<div class="actions"><button class="btn primary" type="button" id="next">' + (last ? "See my results" : "Next question") + "</button></div>";
    }
    if (it.type === "rewrite") {
      if (!CUR.compared) return '<div class="actions"><button class="btn primary" type="button" id="compare">Compare with the model</button></div>';
      return '<div class="actions"><button class="btn primary" type="button" id="works">✓ Mine works</button><button class="btn" type="button" id="needs">✗ Mine needs work</button></div>';
    }
    if (it.type === "fix" && CUR.step === "tap") return '<div class="actions"><button class="btn" type="button" id="notsure">I can’t find it</button></div>';
    return '<div class="actions"><button class="btn primary" type="button" id="check">Check my answer</button></div>';
  }

  function feedback(ok, parts) {
    return '<div class="feedback ' + (ok === null ? "neutral" : ok ? "ok" : "bad") + '"><h2>' + (ok === null ? "Noted" : ok ? "✓ Right" : "✗ Not quite") + "</h2>" + parts.join("") + "</div>";
  }
  function ruleLine(it) { return '<p class="rule"><b>Rule:</b> ' + esc(it.rule) + (it.topic && DATA.topics[it.topic] ? ' <a href="#/guide/' + esc(it.topic) + '" target="_blank" rel="noopener">Quick guide<span class="sr"> (opens in a new tab)</span></a>' : "") + "</p>"; }
  function finish(it, ok, html) {
    CUR.done = true; CUR.ok = ok; CUR.fb = html;
    record(it, ok);
    rerender("#next");
  }

  function wire(it) {
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on("#quit", "click", () => { if (confirm("Stop this session? Answers so far are saved.")) { SESSION = null; CUR = null; location.hash = "#/"; } });
    on("#hintbtn", "click", () => { CUR.hint = true; rerender(".hint"); });
    on("#next", "click", () => { if (SESSION.i >= SESSION.items.length - 1) endSession(); else { SESSION.i++; startItem(); rerender("#q"); } });
    if (CUR.done) return;
    if (it.type === "choice") {
      $$("[data-opt]").forEach(b => b.addEventListener("click", () => { CUR.sel = CUR.order[+b.dataset.opt]; rerender('[data-opt="' + b.dataset.opt + '"]'); }));
      on("#check", "click", () => {
        if (CUR.sel == null) { CUR.fb = '<p class="hint">Choose one answer first.</p>'; rerender("#check"); return; }
        const good = correctChoices(it);
        const ok = good.indexOf(CUR.sel) >= 0;
        const parts = [];
        if (!ok && it.tense && it.acceptedAnswers.indexOf(CUR.sel) >= 0) parts.push('<p><b>The problem:</b> The grammar is fine, but this is not your course’s tense. ' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>");
        if (!ok || good.length > 1) parts.push("<p><b>" + (good.length > 1 ? "Correct answers" : "Correct answer") + ":</b> " + good.map(g => '<span class="cite">' + sent(g) + "</span>").join(" or ") + "</p>");
        parts.push(ruleLine(it));
        if (it.tense) parts.push('<p class="small">' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>");
        finish(it, ok, feedback(ok, parts));
      });
    }
    if (it.type === "build") {
      $$("[data-tile]").forEach(b => b.addEventListener("click", () => {
        CUR.built.push(+b.dataset.tile);
        const nextTile = $$("[data-tile]").map(x => +x.dataset.tile).find(k => k !== +b.dataset.tile && CUR.built.indexOf(k) < 0);
        rerender(nextTile != null ? '[data-tile="' + nextTile + '"]' : "#check");
      }));
      $$("[data-pos]").forEach(b => b.addEventListener("click", () => { CUR.built.splice(+b.dataset.pos, 1); rerender(CUR.built.length ? '[data-pos="' + Math.min(+b.dataset.pos, CUR.built.length - 1) + '"]' : "[data-tile]"); }));
      on("#undo", "click", () => { CUR.built.pop(); rerender(CUR.built.length ? "#undo" : "[data-tile]"); });
      on("#clear", "click", () => { CUR.built = []; rerender("[data-tile]"); });
      on("#typeit", "click", () => { CUR.typing = true; CUR.typed = joinTiles(CUR.built.map(k => CUR.tiles[k].t)); rerender("#typed"); });
      on("#usetiles", "click", () => { CUR.typing = false; rerender("[data-tile]"); });
      on("#typed", "input", e => { CUR.typed = e.target.value; });
      on("#typed", "keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#check").click(); } });
      on("#check", "click", () => {
        const input = CUR.typing ? CUR.typed : joinTiles(CUR.built.map(k => CUR.tiles[k].t));
        if (!cnorm(input)) { CUR.fb = '<p class="hint">' + (CUR.typing ? "Type a citation first." : "Tap some tiles first.") + "</p>"; rerender(CUR.typing ? "#typed" : "[data-tile]"); return; }
        citeFeedback(it, input);
      });
    }
    if (it.type === "fix") {
      $$("[data-tok]").forEach(b => b.addEventListener("click", () => {
        const tok = String(it.frame.split(/(\s+)/)[+b.dataset.tok]);
        if (it.errorTokens.indexOf(tok) >= 0) { CUR.step = "fix"; CUR.typed = it.wrongCitation; CUR.fb = ""; rerender("#typed"); }
        else { CUR.misses++; if (CUR.misses >= 2) { CUR.step = "fix"; CUR.typed = it.wrongCitation; rerender("#typed"); } else rerender('[data-tok="' + b.dataset.tok + '"]'); }
      }));
      on("#notsure", "click", () => { CUR.misses = Math.max(CUR.misses, 2); CUR.step = "fix"; CUR.typed = it.wrongCitation; rerender("#typed"); });
      on("#typed", "input", e => { CUR.typed = e.target.value; });
      on("#typed", "keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#check").click(); } });
      on("#check", "click", () => citeFeedback(it, CUR.typed));
    }
    if (it.type === "sort") {
      $$("input[type=radio]").forEach(r => r.addEventListener("change", () => { CUR.sort[r.dataset.verb] = r.value; }));
      on("#check", "click", () => {
        if (it.tiles.some(v => !CUR.sort[v])) { CUR.fb = '<p class="hint">Choose a group for every verb first.</p>'; rerender("#check"); return; }
        const wrong = it.tiles.filter(v => CUR.sort[v] !== it.acceptedAnswers[v]);
        const ok = !wrong.length;
        const parts = [];
        if (!ok) parts.push("<p><b>Check again:</b> " + wrong.map(v => "“" + esc(v) + "” is " + esc(it.acceptedAnswers[v]).toLowerCase()).join("; ") + ".</p>");
        parts.push(ruleLine(it));
        parts.push('<p class="small"><a href="#/verbs" target="_blank" rel="noopener">See all the verbs in the Reporting verb bank<span class="sr"> (opens in a new tab)</span></a></p>');
        finish(it, ok, feedback(ok, parts));
      });
    }
    if (it.type === "rewrite") {
      on("#rw", "input", e => { CUR.text = e.target.value; });
      on("#compare", "click", () => {
        if (CUR.text.trim().length < 8 || (it.longAnswer && CUR.text.trim() === String(it.frame).trim())) { CUR.fb = '<p class="hint">' + (it.longAnswer ? "Change two or three sentences first." : "Write your sentence first.") + "</p>"; rerender("#rw"); return; }
        CUR.compared = true; CUR.fb = ""; rerender(".compare h2");
      });
      $$("[data-chk]").forEach(c => c.addEventListener("change", () => { CUR.checks[c.dataset.chk] = c.checked; }));
      const self = ok => {
        const parts = ['<p>' + (ok ? "Good. You said your answer works." : "Thanks for being honest. This item will come back in a later session.") + "</p>", ruleLine(it)];
        finish(it, ok, feedback(ok ? true : false, parts));
      };
      on("#works", "click", () => self(true));
      on("#needs", "click", () => self(false));
    }
  }
  function citeFeedback(it, input) {
    const r = checkCitation(input, it);
    const parts = [];
    if (!r.ok) {
      parts.push('<p><b>Your answer:</b> <span class="cite">' + cite(cnorm(input)) + "</span></p>");
      parts.push("<p><b>" + (r.problems.length > 1 ? "The problems" : "The problem") + ":</b></p><ul class=\"problems\">" + r.problems.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>");
    }
    if (!r.ok || r.shown.length > 1) parts.push("<p><b>" + (r.shown.length > 1 ? "Correct answers" : "Correct answer") + ":</b> " + r.shown.map(a => '<span class="cite">' + cite(a) + "</span>").join(" or ") + "</p>");
    parts.push(ruleLine(it));
    r.notes.forEach(n => parts.push('<p class="small">' + esc(n) + "</p>"));
    if (it.type === "fix" && CUR.misses) parts.push('<p class="small muted">You needed help to find the mistake. Next time, check each part of the citation: names, & or and, commas, year, page.</p>');
    finish(it, r.ok, feedback(r.ok, parts));
  }

  /* ---------------- results ---------------- */
  function viewResults() {
    if (!LAST_END) { location.hash = "#/"; return; }
    const E = LAST_END, res = E.results;
    const hints = res.filter(r => r.hint).length;
    const byTopic = {};
    res.forEach(r => { if (!r.topic) return; byTopic[r.topic] = byTopic[r.topic] || { r: 0, n: 0 }; byTopic[r.topic].n++; if (r.ok) byTopic[r.topic].r++; });
    const good = Object.keys(byTopic).filter(t => byTopic[t].r === byTopic[t].n);
    const review = Object.keys(byTopic).filter(t => byTopic[t].r < byTopic[t].n);
    let h = '<p class="eyebrow">Session finished</p><h1 tabindex="-1" id="rh">You got <span class="hl">' + E.right + " of " + res.length + "</span> right</h1>" +
      '<p class="muted">' + esc(modeName(E.mode)) + " · Hints used: " + hints + "</p>" + storeNote();
    if (E.unlocks.length) h += '<div class="feedback ok" role="status"><h2>✓ Ready for the next stage</h2><ul>' + E.unlocks.map(u => "<li>" + esc(u) + "</li>").join("") + "</ul><p>Your next session starts at this stage. You can choose any stage on the start page.</p></div>";
    h += '<div class="grid two"><section class="card"><h2>What went well</h2>' + (good.length ? "<ul>" + good.map(t => "<li>" + esc(topicTitle(t)) + "</li>").join("") + "</ul>" : '<p class="muted">Keep going. Every rule you practise now will be easier next time.</p>') + "</section>" +
      '<section class="card"><h2>Rules to review</h2>' + (review.length ? "<ul>" + review.map(t => '<li><a href="#/guide/' + esc(t) + '">' + esc(topicTitle(t)) + "</a></li>").join("") + '</ul><p class="small muted">These questions will come back in your next sessions.</p>' : '<p class="muted">Nothing this time. Well done.</p>') + "</section></div>";
    if (!E.preview) {
      const g = S.goals[E.mode];
      h += '<section class="card"><h2><label for="goal">What will you check in your next assignment?</label></h2><p class="small muted">For example: “I will use &amp; inside brackets and “and” in my sentences.”</p>' +
        '<textarea id="goal" rows="2">' + esc(g ? g.text : "") + '</textarea><div class="actions"><button class="btn" type="button" id="savegoal">Save my goal</button></div><p id="goalmsg" class="small" aria-live="polite"></p></section>';
    }
    h += '<div class="actions"><button class="btn primary" type="button" id="again">' + (E.preview ? "Back to the teacher page" : "Practise again") + '</button><a class="btn" href="#/progress">See my progress</a><a class="btn" href="#/">Choose another track</a></div>';
    if (!E.preview) h += (window.DNNext ? DNNext.html("cite") : "");
    page(h, "Results", "home");
    const fh = $("#rh"); if (fh) fh.focus();
    const sg = $("#savegoal");
    if (sg) sg.addEventListener("click", () => { const v = $("#goal").value.trim(); if (v) S.goals[E.mode] = { text: v, date: today() }; else delete S.goals[E.mode]; save(); $("#goalmsg").textContent = STORE_OK ? (v ? "Saved. You will see it next time." : "Goal removed.") : "Your browser is not letting this app save."; });
    $("#again").addEventListener("click", () => { if (E.preview) location.hash = "#/teacher"; else startSession(E.mode); });
  }

  /* ---------------- progress ---------------- */
  function troubleTopics() {
    return Object.keys(S.topics).map(t => ({ t, r: S.topics[t].right, w: S.topics[t].wrong })).filter(x => x.w >= 2 && x.w >= x.r / 2).sort((a, b) => b.w - a.w).slice(0, 6);
  }
  function linksFor(track) { return (DATA.links && Array.isArray(DATA.links[track])) ? DATA.links[track].filter(l => l && l.url && l.title) : []; }
  function summaryText() {
    const L = ["APA Trainer: my progress (" + today() + ")", ""];
    TRACK_IDS.forEach(t => {
      const T = S.tracks[t], ids = DATA.items.filter(i => i.track === t).map(i => i.id);
      const seen = ids.filter(id => rec(id)).length, mast = ids.filter(id => rec(id) && rec(id).box >= MASTER_BOX).length;
      L.push("Track " + t + " (" + TRACKS[t].name + "): furthest stage " + T.unlocked + " of " + DATA.nStages[t] + " (" + stageTitle(t, T.unlocked) + "). Practised " + seen + " of " + ids.length + " questions, " + mast + " mastered.");
    });
    const tr = troubleTopics();
    L.push("", "Rules to review: " + (tr.length ? tr.map(x => topicTitle(x.t)).join("; ") : "none yet"));
    const goals = Object.keys(S.goals).map(m => modeName(m) + ": " + S.goals[m].text);
    if (goals.length) L.push("", "My goals:", ...goals.map(g => "- " + g));
    const total = S.log.length, hints = S.log.reduce((a, x) => a + (x.hints || 0), 0);
    L.push("", "Sessions: " + total + ". Hints used: " + hints + ".");
    return L.join("\n");
  }
  function viewProgress() {
    let h = '<p class="eyebrow">My progress</p><h1>Your citation <span class="hl">progress</span></h1>' + storeNote() + '<div class="grid two">';
    TRACK_IDS.forEach(t => {
      const T = S.tracks[t], ids = DATA.items.filter(i => i.track === t).map(i => i.id);
      const seen = ids.filter(id => rec(id)).length, mast = ids.filter(id => rec(id) && rec(id).box >= MASTER_BOX).length;
      h += '<section class="card">' + chip(t) + "<h2>" + esc(TRACKS[t].name) + "</h2>" +
        '<div class="kv"><span>Furthest stage</span><b>' + T.unlocked + " of " + DATA.nStages[t] + " · " + esc(stageTitle(t, T.unlocked)) + "</b></div>" +
        '<div class="kv"><span>Questions practised</span><b>' + seen + " of " + ids.length + "</b></div>" +
        '<div class="kv"><span>Mastered (right 3 times in a row)</span><b>' + mast + "</b></div>" +
        (stageProgress(t) ? '<p class="small muted">' + esc(stageProgress(t)) + "</p>" : "") +
        (S.goals[t] ? '<p class="goal"><b>Goal:</b> ' + esc(S.goals[t].text) + "</p>" : "") + "</section>";
    });
    h += "</div>";
    const tr = troubleTopics();
    h += '<section class="card"><h2>Rules that keep causing trouble</h2>';
    if (!tr.length) h += '<p class="muted">Nothing yet. Rules you get wrong more than once will appear here.</p>';
    else {
      h += '<ul class="trouble">' + tr.map(x => {
        const g = DATA.topics[x.t]; const links = g ? linksFor(g.track) : [];
        return '<li><a href="#/guide/' + esc(x.t) + '"><b>' + esc(topicTitle(x.t)) + "</b></a> <span class=\"small muted\">(wrong " + x.w + " times, right " + x.r + ")</span>" +
          (g ? '<br><span class="small">' + esc(g.rule) + "</span>" : "") +
          (links.length ? '<br><span class="small">Study: ' + links.map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + "</a>").join(" · ") + "</span>" : "") + "</li>";
      }).join("") + "</ul>";
    }
    h += "</section>";
    if (S.log.length) h += '<section class="card"><h2>Recent sessions</h2>' + S.log.slice(-8).reverse().map(l => '<div class="kv"><span>' + esc(l.date) + " · " + esc(modeName(l.mode)) + "</span><b>" + l.right + " of " + l.total + (l.hints ? ' <span class="small muted">(' + l.hints + " hint" + (l.hints > 1 ? "s" : "") + ")</span>" : "") + "</b></div>").join("") + "</section>";
    h += '<div class="actions no-print"><button class="btn" type="button" id="copy">Copy summary</button><button class="btn" type="button" id="print">Print</button><button class="btn danger" type="button" id="clear">Clear my data</button></div><p id="pmsg" class="small" aria-live="polite"></p>';
    page(h, "My progress", "progress");
    $("#copy").addEventListener("click", () => copyText(summaryText(), $("#pmsg")));
    $("#print").addEventListener("click", () => window.print());
    $("#clear").addEventListener("click", clearData);
  }
  function copyText(txt, msg) {
    const done = () => { msg.textContent = "Copied. You can paste it into an email or a document."; };
    const fallback = () => { const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) { } document.body.removeChild(ta); if (ok) done(); else msg.textContent = "Sorry, copying did not work. Use Print instead."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  function clearData() {
    if (!confirm("Delete all your APA Trainer progress, goals and review schedule from this device? This cannot be undone.")) return;
    try { localStorage.removeItem(KEY); } catch (e) { }
    S = blank(); LAST_END = null;
    render();
    const m = $("#pmsg") || $("#amsg"); if (m) m.textContent = "Your data has been deleted from this device.";
  }

  /* ---------------- quick guide ---------------- */
  function viewGuide(anchor) {
    let h = '<p class="eyebrow">Quick guide</p><h1>APA 7th in-text citations <span class="hl">on one page</span></h1><p class="lead">Each rule in one line, with one example.</p>';
    h += '<nav class="toc" aria-label="Sections">' + (DATA.guide ? DATA.guide.sections : []).map((s, i) => '<a href="#/guide/sec' + i + '">' + esc(s.title) + "</a>").join("") + "</nav>";
    (DATA.guide ? DATA.guide.sections : []).forEach((sec, i) => {
      h += '<section class="card guide" id="g-sec' + i + '"><h2>' + esc(sec.title) + "</h2>";
      sec.rules.forEach(r => {
        h += '<div class="g-rule" id="g-' + esc(r.id) + '"><h3>' + esc(r.title) + "</h3><p>" + esc(r.rule) + "</p>" + (r.use ? '<p class="use"><b>When to use it:</b> ' + esc(r.use) + "</p>" : "") + '<p class="ex">' + sent(r.example) + "</p>" +
          (r.id === "verb-tense" ? '<p class="setting"><b>Your course:</b> ' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>" : "") +
          (r.id === "paraphrase-page" ? '<p class="setting"><b>Your course:</b> ' + esc(PAGE_TEXT[CFG.pageNumbersForParaphrase]) + "</p>" : "") + "</div>";
      });
      const tr = (sec.rules[0] || {}).track; const links = tr ? linksFor(tr) : [];
      if (links.length) h += '<p class="small"><b>Study more:</b> ' + links.map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + "</a>").join(" · ") + "</p>";
      h += "</section>";
    });
    h += '<p class="small">Need the reference list entry for a book, web page, newspaper or other source? Use the <a href="../apa-reference-guide/">APA Reference Guide</a>.</p><p class="small muted">Always follow your own course’s referencing guide where it is different.</p>';
    page(h, "Quick guide", "guide");
    if (anchor) { const el = document.getElementById("g-" + anchor); if (el) { el.classList.add("target"); el.setAttribute("tabindex", "-1"); el.scrollIntoView(); el.focus({ preventScroll: true }); } }
  }

  /* ---------------- verb bank ---------------- */
  function viewVerbs() {
    const V = DATA.verbs || { groups: [], notes: [] };
    let h = '<p class="eyebrow">Reporting verb bank</p><h1>Better verbs than <span class="hl">“says”</span></h1><p class="lead">Grouped by strength and stance, with the grammar pattern and an example.</p><p class="small muted">' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p>";
    V.groups.forEach(g => {
      h += '<section class="card"><h2>' + esc(g.title) + '</h2><p class="muted">' + esc(g.about) + '</p><dl class="verbs">';
      g.verbs.forEach(v => {
        const ex = CFG.reportingVerbTense === "present" ? [v.present] : CFG.reportingVerbTense === "past" ? [v.past] : [v.present, v.past];
        h += "<dt>" + esc(v.verb) + '</dt><dd><span class="pattern">' + esc(v.pattern) + "</span>" + ex.map(e => '<span class="ex">' + sent(e) + "</span>").join("") + "</dd>";
      });
      h += "</dl></section>";
    });
    if ((V.notes || []).length) h += '<section class="card"><h2>Watch out</h2><ul>' + V.notes.map(n => "<li>" + esc(n) + "</li>").join("") + "</ul></section>";
    page(h, "Reporting verb bank", "verbs");
  }

  /* ---------------- about ---------------- */
  function viewAbout() {
    let h = '<p class="eyebrow">About</p><h1>About this <span class="hl">app</span></h1>' +
      '<section class="card"><h2>What it is</h2><p>APA Trainer is a free practice app for APA 7th in-text citations. You build and fix citations yourself in short sessions. Questions you get wrong come back in later sessions.</p>' +
      "<p>There are four tracks: citation formats, secondary citation (“as cited in”), reporting verbs, and variety in citing.</p></section>" +
      '<section class="card"><h2>Honesty and AI</h2><ul>' +
      "<li>The practice items were drafted with AI and checked by the teacher, Dave Nab.</li>" +
      "<li><b>All sources in this app are invented for practice.</b> The authors, studies and titles are not real. Do not cite them in your work.</li>" +
      "<li>This app trains the skill. It does not make citations for your assignments.</li>" +
      "<li>Always follow your own course’s referencing guide where it is different from this app.</li>" +
      "<li>The app makes no AI calls while you use it.</li></ul></section>" +
      '<section class="card"><h2>Your data</h2><p>No sign-in. No tracking. No analytics. Nothing leaves your device.</p>' +
      "<p>The app saves these things in your browser’s storage (localStorage) on this device only: your stage in each track, the review schedule for each question, your recent scores, when you used hints, and your goals.</p>" +
      '<p>To delete it all, use the button below (or “Clear my data” on the My progress page).</p><div class="actions"><button class="btn danger" type="button" id="clear">Clear my data</button></div><p id="amsg" class="small" aria-live="polite"></p></section>' +
      '<section class="card"><h2>Your course’s settings</h2><p>' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + "</p><p>" + esc(PAGE_TEXT[CFG.pageNumbersForParaphrase]) + "</p></section>" +
      '<p class="small muted"><a href="#/teacher">For teachers: check every item</a></p>';
    page(h, "About", "about");
    $("#clear").addEventListener("click", clearData);
  }

  /* ---------------- teacher check page ---------------- */
  let TF = { track: "all", drafts: false };
  let FIRST_DONE = false;
  let NOANIM = false;
  function viewTeacher() {
    let h = '<p class="eyebrow">For teachers</p><h1>Check the <span class="hl">items</span></h1>' +
      '<p>Every item with its answers. Use “Try this item” to see it as a student would (nothing is saved). To mark an item as checked, change <code>"verified": false</code> to <code>"verified": true</code> in its file in <code>data/</code>. See the README.</p>' +
      '<p class="small muted">' + esc(TENSE_TEXT[CFG.reportingVerbTense]) + " " + esc(PAGE_TEXT[CFG.pageNumbersForParaphrase]) + " Verb forms below follow this setting.</p>" +
      (DATA.problems.length ? '<div class="notice"><b>Problems found:</b><ul class="small">' + DATA.problems.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul></div>" : "") +
      '<div class="row filters"><label for="tf">Track</label><select id="tf"><option value="all">All tracks</option>' + TRACK_IDS.map(t => '<option value="' + t + '"' + (TF.track === t ? " selected" : "") + ">Track " + t + ": " + esc(TRACKS[t].name) + "</option>").join("") + "</select>" +
      '<label class="chk"><input type="checkbox" id="td"' + (TF.drafts ? " checked" : "") + "> Only items not yet checked</label></div>";
    TRACK_IDS.filter(t => TF.track === "all" || TF.track === t).forEach(t => {
      const items = DATA.items.filter(i => i.track === t && (!TF.drafts || !i.verified));
      h += "<h2>Track " + t + ": " + esc(TRACKS[t].name) + ' <span class="small muted">(' + items.length + " shown)</span></h2>";
      for (let s = 1; s <= DATA.nStages[t]; s++) {
        const st = items.filter(i => i.stage === s);
        if (!st.length) continue;
        h += "<h3>Stage " + s + ": " + esc(stageTitle(t, s)) + "</h3>";
        st.forEach(it => {
          const acc = it.type === "sort" ? Object.keys(it.acceptedAnswers).map(k => k + " → " + it.acceptedAnswers[k]) : it.type === "choice" ? correctChoices(it) : it.type === "rewrite" ? [] : acceptedFor(it).acc;
          h += '<article class="card titem"><p class="row"><b>' + esc(it.id) + '</b><span class="tag">' + esc(it.type) + "</span>" + (it.verified ? '<span class="tag ok-tag">✓ Checked</span>' : '<span class="tag draft">Draft</span>') + '<span class="small muted">topic: ' + esc(it.topic || "-") + "</span></p>" +
            "<p>" + esc(it.prompt) + "</p>" + (it.frame ? '<p class="frame small-frame">' + sent(it.frame) + "</p>" : "") +
            ((it.sourceCards || []).length ? '<details><summary>Source cards (' + it.sourceCards.length + ")</summary>" + cards(it) + "</details>" : "") +
            (it.options && it.type === "choice" ? "<p><b>Options:</b></p><ul>" + it.options.map(o => "<li>" + (correctChoices(it).indexOf(o) >= 0 ? "✓ " : "✗ ") + sent(o) + (it.tense && it.tense[o] ? ' <span class="small muted">(' + it.tense[o] + ")</span>" : "") + "</li>").join("") + "</ul>" : "") +
            (it.tiles && it.type === "build" ? '<p><b>Tiles:</b> ' + it.tiles.map(x => '<span class="tile mini">' + cite(x) + "</span>").join(" ") + "</p>" : "") +
            (it.errorTokens ? "<p><b>Tap to find the mistake:</b> " + it.errorTokens.map(esc).join("  ·  ") + "</p>" : "") +
            (acc.length ? "<p><b>Accepted:</b> " + acc.map(a => '<span class="cite">' + cite(a) + "</span>").join(" or ") + "</p>" : "") +
            ((it.modelAnswers || []).length ? "<p><b>Models:</b></p><ul>" + it.modelAnswers.map(m => "<li>" + sent(m) + "</li>").join("") + "</ul>" : "") +
            "<p><b>Rule:</b> " + esc(it.rule) + "</p><p><b>Hint:</b> " + esc(it.hint || "-") + "</p>" +
            ((it.errorDiagnosis || []).length ? "<p><b>Special feedback:</b> " + it.errorDiagnosis.map(d => esc(d.answer) + " → " + esc(d.problem)).join("; ") + "</p>" : "") +
            '<button class="btn small-btn" type="button" data-try="' + esc(it.id) + '">Try this item</button></article>';
        });
      }
    });
    page(h, "Teacher check", "about");
    $("#tf").addEventListener("change", e => { TF.track = e.target.value; viewTeacher(); });
    $("#td").addEventListener("change", e => { TF.drafts = e.target.checked; viewTeacher(); });
    $$("[data-try]").forEach(b => b.addEventListener("click", () => startSession(DATA.byId[b.dataset.try].track, [b.dataset.try])));
  }

  /* ---------------- router ---------------- */
  function render() {
    if (!DATA.loaded) return;
    const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    const r = parts[0] || "";
    switch (r) {
      case "practice": viewPractice(); break;
      case "results": viewResults(); break;
      case "progress": viewProgress(); break;
      case "guide": viewGuide(parts[1]); break;
      case "verbs": viewVerbs(); break;
      case "about": viewAbout(); break;
      case "teacher": viewTeacher(); break;
      default: viewHome();
    }
    if (r !== "guide" || !parts[1]) window.scrollTo(0, 0);
    if (r === "practice") { const q = $("#q"); if (q) q.focus({ preventScroll: true }); }
    else if (r !== "results" && !(r === "guide" && parts[1]) && FIRST_DONE) APP().focus({ preventScroll: true });
    FIRST_DONE = true;
  }

  /* theme toggle (shares the website's "theme" setting) */
  function initTheme() {
    const b = $("#theme"); if (!b) return;
    b.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) { }
    });
  }

  /* expose the checking functions for tests (no effect on the page) */
  window.DAVECite = { joinTiles, cnorm, checkCitation, diagnose, canBuild, CFG, DATA };

  load();
  initTheme();
  window.addEventListener("hashchange", render);
  loadData().then(render);
})();
