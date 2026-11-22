/* Notetaking Trainer (TED edition)
   Plain JavaScript. No build step, no server, no AI calls, no analytics.
   TED talks play in TED's own embedded player. Breaking News English opens on its own website.
   Notes and progress: localStorage. Photos: IndexedDB. Nothing is uploaded. */
(function () {
  'use strict';

  var KEY = 'daveNotesTed.v1';
  var app = document.getElementById('app');

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function fmtNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
        d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return iso; }
  }
  function fmtLen(s) { s = Math.round(Number(s) || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function timeToSec(t) {
    var m = String(t || '').match(/(\d+):(\d{1,2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function aboutTime(t) { var s = timeToSec(t); return s == null ? '' : 'about ' + fmtLen(s); }
  function why(text) { return '<p class="why"><span><b>Why this helps</b>' + esc(text) + '</span></p>'; }
  function honour(text) { return '<div class="honour"><b class="hl">Honour rule</b>' + text + '</div>'; }
  function draftBadge() { return ''; } // draft labels are not shown to students
  function ext(href, text) { return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + text + ' <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a>'; }
  var SRC_LABEL = { ted: 'TED talk', bne: 'News listening', own: 'My own recording' };
  function srcBadge(s) { return '<span class="badge src-' + esc(s) + '">' + esc(SRC_LABEL[s] || s) + '</span>'; }
  function attribution(a) {
    if (a.source === 'ted') return '<p class="attrib" style="margin:8px 0 0">' + esc(a.speaker) + ' · “' + esc(a.title) + '” · TED · ' + ext(a.tedUrl, 'Watch on TED.com') + '</p>';
    if (a.source === 'bne') return '<p class="attrib" style="margin:8px 0 0">From Breaking News English by Sean Banville · ' + ext(a.bneLessonUrl || a.bneUrl, 'Full lesson on breakingnewsenglish.com') + '</p>';
    return '';
  }

  /* ---------------- storage: progress (localStorage) ---------------- */
  var Store = {
    data: null, ok: true,
    load: function () {
      if (this.data) return this.data;
      var d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { this.ok = false; }
      if (!d || typeof d !== 'object') d = {};
      if (!Array.isArray(d.sessions)) d.sessions = [];
      if (typeof d.lastGoal !== 'string') d.lastGoal = '';
      try { localStorage.setItem(KEY + '.test', '1'); localStorage.removeItem(KEY + '.test'); } catch (e) { this.ok = false; }
      this.data = d;
      return d;
    },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch (e) { this.ok = false; return false; } },
    clear: function () { this.data = { sessions: [], lastGoal: '' }; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  };

  /* ---------------- storage: photos (IndexedDB, in-memory fallback) ---------------- */
  var Photos = {
    mem: {}, _p: null,
    open: function () {
      if (this._p) return this._p;
      this._p = new Promise(function (res) {
        try {
          var r = indexedDB.open('daveNotesTed', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('photos'); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = r.onblocked = function () { res(null); };
        } catch (e) { res(null); }
      });
      return this._p;
    },
    put: function (id, blobs) {
      this.mem[id] = blobs;
      return this.open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try {
            var tx = db.transaction('photos', 'readwrite');
            tx.objectStore('photos').put(blobs, id);
            tx.oncomplete = function () { res(true); };
            tx.onerror = tx.onabort = function () { res(false); };
          } catch (e) { res(false); }
        });
      });
    },
    get: function (id) {
      var self = this;
      if (self.mem[id]) return Promise.resolve(self.mem[id]);
      return self.open().then(function (db) {
        if (!db) return [];
        return new Promise(function (res) {
          try {
            var r = db.transaction('photos').objectStore('photos').get(id);
            r.onsuccess = function () { res(r.result || []); };
            r.onerror = function () { res([]); };
          } catch (e) { res([]); }
        });
      });
    },
    clear: function () {
      this.mem = {};
      return this.open().then(function (db) {
        if (!db) return;
        return new Promise(function (res) {
          try {
            var tx = db.transaction('photos', 'readwrite');
            tx.objectStore('photos').clear();
            tx.oncomplete = tx.onerror = tx.onabort = function () { res(); };
          } catch (e) { res(); }
        });
      });
    }
  };
  function shrinkImage(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, 1600 / Math.max(w, h));
        w = Math.round(w * s); h = Math.round(h * s);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        try {
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          c.toBlob(function (b) { URL.revokeObjectURL(url); res(b || file); }, 'image/jpeg', 0.75);
        } catch (e) { URL.revokeObjectURL(url); res(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }

  /* ---------------- activity sets (JSON files) ---------------- */
  var ACTS = [], actsError = '';
  function norm(a) {
    if (a.source !== 'ted' && a.source !== 'bne') return null; // only TED talks and news listenings
    a.keyTerms = a.keyTerms || [];
    a.keyIdeas = (a.keyIdeas || []).map(function (k) { return { text: k.text, type: k.type === 'main' ? 'main' : 'detail', approxTime: k.approxTime || '' }; });
    a.modelNotes = a.modelNotes || [];
    a.questions = a.questions || [];
    a.signpostPhrases = a.signpostPhrases || [];
    if (typeof a.transcript === 'string') a.transcript = a.transcript.split(/\n\s*\n/);
    a.transcript = a.transcript || [];
    a.verified = a.verified === true;
    a.level = a.level || 'B2';
    a.topic = a.topic || '';
    return a;
  }
  function loadActs() {
    return fetch('activities/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('index'); return r.json(); })
      .then(function (idx) {
        return Promise.all((idx.activities || []).map(function (f) {
          return fetch('activities/' + encodeURIComponent(f), { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(f); return r.json(); })
            .catch(function () { return null; });
        }));
      })
      .then(function (list) {
        ACTS = list.filter(function (a) { return a && a.id && a.title; }).map(norm).filter(Boolean);
        if (!ACTS.length) actsError = 'No activities could be loaded.';
      })
      .catch(function () {
        actsError = 'The activities could not be loaded. Check your internet connection and reload the page. You can still use your own recording below.';
      });
  }

  /* ---------------- skill tips ---------------- */
  var TIPS = [
    { id: 'signpost', name: 'Signposting language', title: 'Listen for signposts',
      intro: 'Speakers use signpost phrases to show where the talk is going. A signpost tells you: a new point is coming. Real speakers use them less neatly than textbooks, so listen carefully.',
      examples: [['Topic', '“Today I want to talk about…”'], ['Order', '“First… The second thing is… Finally…”'], ['Adding', '“And another thing…”'], ['Contrast', '“But… However…”'], ['Example', '“For example… Here’s one…”'], ['Important', '“The biggest lesson is…”'], ['Summary', '“So… Let’s recap…”']],
      tryit: 'When you hear “first”, “and” + a new idea, or “but”, start a new line in your notes.' },
    { id: 'abbrev', name: 'Abbreviations and symbols', title: 'Write less, catch more',
      intro: 'You can’t write every word, and you don’t need to. Use short forms and symbols so you can keep listening while you write.',
      examples: [['→', 'leads to, causes'], ['↑  ↓', 'increase, decrease'], ['=  ≠', 'is, means  /  is not'], ['+', 'and, also'], ['e.g.', 'for example'], ['b/c', 'because'], ['w/  w/o', 'with  /  without'], ['imp.', 'important'], ['ppl', 'people']],
      tryit: 'Make up your own short forms. Use your first language if it is faster. Just use the same ones every time.' },
    { id: 'mainidea', name: 'Main idea versus detail', title: 'Catch the main ideas first',
      intro: 'A main idea answers the question: “What is this part about?” Details are the examples, names, numbers and stories that support it.',
      examples: [['Main idea', 'often comes after a signpost, and is often repeated or said again in other words'], ['Detail', 'examples, names, numbers, stories'], ['Layout', 'main ideas at the left, details moved in under them']],
      tryit: 'If you miss a detail, let it go. Listen for the next main idea.' },
    { id: 'organise', name: 'Organising notes', title: 'Make notes you can use later',
      intro: 'Any layout is fine: lists, mind maps, columns, boxes or arrows. What matters is that you can find the ideas again later.',
      examples: [['Headings', 'one heading for each part of the talk'], ['Numbers', 'number the main points: 1, 2, 3'], ['Indent', 'put details under their main idea'], ['Space', 'leave gaps so you can add things later']],
      sample: '30-DAY CHALLENGE\n1. Idea → try sth new\n2. Lessons\n   - time memorable\n   - confidence ↑\n3. Message → ?',
      tryit: 'Leave space after each main idea. Fill it in if you listen a second time.' }
  ];
  function tipById(id) { return TIPS.filter(function (t) { return t.id === id; })[0] || TIPS[0]; }
  var TIP_BLURB = { signpost: 'Hear where the talk is going', abbrev: 'Write less, catch more', mainidea: 'Tell big points from small ones', organise: 'Make notes you can use later' };
  var pickedSkill = null; // the student's choice for this visit
  function suggestedSkill() { return TIPS[Store.load().sessions.length % TIPS.length].id; }
  function skillPicker(current) {
    var sug = suggestedSkill();
    return '<fieldset><legend class="q">What do you want to practise today?</legend>' +
      '<p class="hint">Choose one skill. You get a short tip about it before you listen.</p><div class="skills">' +
      TIPS.map(function (t) {
        return '<button type="button" class="skillbtn" data-skill="' + t.id + '" aria-pressed="' + (current === t.id) + '">' +
          '<span class="sk-name">' + esc(t.name) + '</span><span class="sk-blurb">' + esc(TIP_BLURB[t.id]) + '</span>' +
          (t.id === sug ? '<span class="sk-sug">Suggested next</span>' : '') + '</button>';
      }).join('') + '</div></fieldset>';
  }
  function bindSkillPicker(onPick) {
    $$('[data-skill]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-skill]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onPick(b.dataset.skill);
      });
    });
  }
  var YOURWAY = '<div class="notice"><p style="margin:0"><b>Your notes, your way.</b> Write in any language: English, your first language, or a mix. Use symbols, arrows and drawings. Short words are better than full sentences. There is no word count and no “right” layout.</p></div>';
  var STEPNAMES = { ready: 'Get ready', ownready: 'Get ready', skill: 'Skill focus', listen: 'Listen', photo: 'Photo', predict: 'Predict', check: 'Self-check', rate: 'Self-check', quiz: 'Use your notes', summary3: 'Use your notes', review: 'Review', reflect: 'Reflect' };
  var RATE_LABEL = { yes: 'Yes', partly: 'Partly', notyet: 'Not yet' };
  var CHECK_LABEL = { got: 'Got it', partly: 'Partly', missed: 'Missed' };

  /* ---------------- session ---------------- */
  var S = null;
  function newSession(kind, a) {
    var d = Store.load();
    return {
      id: 's' + Date.now(), date: new Date().toISOString(), kind: kind, act: a || null,
      actId: a ? a.id : '', source: a ? a.source : 'own', title: a ? a.title : 'My own recording', speaker: a ? (a.speaker || '') : '',
      verified: a ? a.verified : null, skill: pickedSkill || TIPS[d.sessions.length % TIPS.length].id,
      expect: '', notesMode: null, notes: '', photos: [], photoURLs: [], listens: 0, ended: false, aiRes: null,
      predicted: null, checks: [], ci: 0, organised: null, abbrev: null, quiz: [], qi: 0, reflection: '', goal: '',
      own: { topic: '', expect: '', fileName: '', ratings: {}, summary: ['', '', ''] },
      step: kind === 'act' ? 'ready' : 'ownready', done: false
    };
  }
  function flow() {
    var a = S.kind === 'act'
      ? ['ready', 'skill', 'listen', 'photo', 'predict', 'check', 'quiz', 'review', 'reflect']
      : ['ownready', 'skill', 'listen', 'photo', 'rate', 'summary3', 'reflect'];
    return a.filter(function (s) { return s !== 'photo' || S.notesMode !== 'type'; });
  }
  function go(step) { S.step = step; setGuard(true); SCREENS[step](); }
  function nextStep() { var f = flow(); go(f[f.indexOf(S.step) + 1]); }
  function prevStep() { var f = flow(), i = f.indexOf(S.step); if (i > 0) go(f[i - 1]); else homeScreen(); }
  function setGuard(on) { window.onbeforeunload = on ? function (e) { e.preventDefault(); e.returnValue = ''; return ''; } : null; }
  function sessionActive() { return S && !S.done; }

  function stopMedia() { $$('audio', app).forEach(function (a) { try { a.pause(); } catch (e) { /* ignore */ } }); }
  function render(html) {
    stopMedia();
    app.innerHTML = html;
    window.scrollTo(0, 0);
    var h = $('h1, h2', app);
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }
  function hero(title, sub, extra) {
    var line = '';
    if (S && !S.done && flow().indexOf(S.step) > -1) {
      var f = flow(), i = f.indexOf(S.step);
      line = '<div class="stepline"><span class="label">Step ' + (i + 1) + ' of ' + f.length + ' · ' + esc(STEPNAMES[S.step]) + '</span>' +
        '<span class="ttl">' + esc(S.title) + '</span>' + (S.act ? draftBadge(S.act) : '') + '</div>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + Math.round((i + 1) / f.length * 100) + '%"></i></div>';
    }
    return '<div class="hero"><div class="wrap">' + line + '<h2>' + title + '</h2>' + (sub ? '<p style="margin:0">' + sub + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function navActions(o) {
    return '<div class="nav-actions">' +
      (o.back ? '<button type="button" class="btn light" data-act="back"><span aria-hidden="true">←</span> ' + esc(o.back) + '</button>' : '') +
      (o.extra || '') +
      (o.next ? '<button type="button" class="btn big" data-act="next"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.next) + ' <span aria-hidden="true">→</span></button>' : '') + '</div>';
  }
  function bindNav(onNext, onBack) {
    var n = $('[data-act="next"]', app), b = $('[data-act="back"]', app);
    if (n) n.addEventListener('click', onNext || nextStep);
    if (b) b.addEventListener('click', onBack || prevStep);
  }
  function choiceGroup(name, current, kind) {
    var opts = kind === 'check'
      ? [['got', '✓ Got it', 'c-got'], ['partly', '~ Partly', 'c-part'], ['missed', '✗ Missed', 'c-miss']]
      : [['yes', '✓ Yes', 'c-got'], ['partly', '~ Partly', 'c-part'], ['notyet', '✗ Not yet', 'c-miss']];
    return '<div class="choices" data-name="' + esc(name) + '">' + opts.map(function (o) {
      return '<button type="button" class="btn ' + o[2] + '" data-v="' + o[0] + '" aria-pressed="' + (current === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  /* ---------------- notes panel + zoom ---------------- */
  function notesPanel() {
    if (S.notesMode === 'type') {
      return '<details class="card notespanel" open><summary>Your notes</summary><div class="notesview" tabindex="0" role="region" aria-label="Your notes">' +
        (S.notes.trim() ? esc(S.notes) : '<span class="muted">You did not type any notes.</span>') + '</div></details>';
    }
    if (S.photoURLs.length) {
      return '<details class="card notespanel" open><summary>Your notes (photo)</summary><div class="photos">' +
        S.photoURLs.map(function (u, i) {
          return '<button type="button" data-zoom="' + i + '" aria-label="Photo ' + (i + 1) + ' of your notes. Tap to zoom."><img src="' + u + '" alt="Photo ' + (i + 1) + ' of your notes"></button>';
        }).join('') + '</div><p class="small muted" style="margin:8px 0 0">Tap a photo to zoom. You can also pinch to zoom.</p></details>';
    }
    return '<div class="card notespanel"><p style="margin:0"><b>Look at your paper notes now.</b> Keep them in front of you.</p></div>';
  }
  var zoomEl = document.getElementById('zoom');
  function openZoom(url) {
    if (!url) return;
    $('#zoomImg').src = url; zoomEl.classList.remove('big'); $('#zoomToggle').textContent = 'Zoom in';
    if (zoomEl.showModal) zoomEl.showModal(); else window.open(url, '_blank');
  }
  function bindZoom(list) {
    $$('[data-zoom]', app).forEach(function (b) { b.addEventListener('click', function () { openZoom((list || S.photoURLs)[Number(b.dataset.zoom)]); }); });
  }
  $('#zoomClose').addEventListener('click', function () { zoomEl.close(); });
  $('#zoomToggle').addEventListener('click', function () { var big = zoomEl.classList.toggle('big'); this.textContent = big ? 'Zoom out' : 'Zoom in'; });

  /* ---------------- HOME ---------------- */
  function actCard(a) {
    var by = a.source === 'ted' ? esc(a.speaker) + ' · TED' : a.source === 'bne' ? 'Breaking News English' : esc(a.speaker || 'Teacher');
    return '<article class="card act"><div class="badges">' + srcBadge(a.source) + (a.topic ? '<span class="badge">' + esc(a.topic) + '</span>' : '') + draftBadge(a) + '</div>' +
      '<h3>' + esc(a.title) + '</h3><p class="by">' + by + '</p>' +
      '<p class="meta">' + (a.lengthSeconds ? fmtLen(a.lengthSeconds) + ' min · ' : '') + 'Level ' + esc(a.level) + ' · ' + a.keyIdeas.length + ' key ideas</p>' +
      (a.source === 'ted' ? '<p class="small" style="margin:0">' + ext(a.tedUrl, 'View on TED.com') + '</p>' : '') +
      (a.source === 'bne' ? '<p class="small" style="margin:0">' + ext(a.bneLessonUrl || a.bneUrl, 'View on breakingnewsenglish.com') + '</p>' : '') +
      '<button type="button" class="btn block" data-start="' + esc(a.id) + '" style="margin-top:10px">Start<span class="sr">: ' + esc(a.title) + '</span> <span aria-hidden="true">→</span></button></article>';
  }
  function homeScreen() {
    S = null; setGuard(false);
    var d = Store.load();
    if (!pickedSkill) pickedSkill = suggestedSkill();
    function group(src) { return ACTS.filter(function (a) { return a.source === src; }); }
    var ted = group('ted'), bne = group('bne');
    render('<div class="hero"><div class="wrap">' +
      '<span class="label eyebrow">Lecture note-taking trainer</span>' +
      '<h1>Practise taking notes with real talks</h1>' +
      '<p>Watch a short TED talk or listen to a news story. Take notes your way. Then check your own notes and use them to answer questions. One session takes 10 to 15 minutes.</p>' +
      (d.lastGoal ? '<div class="goalbox" style="margin-top:14px"><span class="label">Your goal from last time</span>' + esc(d.lastGoal) + '</div>' : '') +
      '</div></div>' +
      '<div class="wrap section stack">' +
      (!navigator.onLine ? '<p class="notice warn">You seem to be offline. TED talks and news listenings need the internet. You can still use your own recording.</p>' : '') +
      (!Store.ok ? '<p class="notice warn">This browser is not letting the app save. You can still practise, but your progress will not be kept.</p>' : '') +
      '<div class="card" id="skillCard">' + skillPicker(pickedSkill) + '</div>' +
      YOURWAY +
      (actsError ? '<p class="notice warn">' + esc(actsError) + '</p>' : '') +
      (ted.length ? '<div class="sec-h"><h2>TED talks</h2><span class="muted small">about 3 minutes each</span></div><div class="grid">' + ted.map(actCard).join('') + '</div>' : '') +
      (bne.length ? '<div class="sec-h"><h2>News listening</h2><span class="muted small">short news stories, about 1–2 minutes</span></div><div class="grid">' + bne.map(actCard).join('') + '</div>' : '') +
      '<div class="sec-h"><h2>Use my own recording</h2></div>' +
      '<div class="card stack"><p style="margin:0">Practise with any lecture or talk you have as an audio file. For example, a recording from class (only if you are allowed to record it).</p>' +
      '<div><label class="btn dark big filebtn"><span aria-hidden="true">🎧</span> Use my own recording<input type="file" id="ownFile" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.mp4"></label></div>' +
      '<p class="small muted" style="margin:0"><b>Your file stays on this device. It is never uploaded.</b></p></div>' +
      '<div class="btnrow" style="margin-top:22px"><a class="btn light" href="#progress">See my progress</a><a class="btn light" href="about.html">About this app</a></div>' +
      '</div>');
    bindSkillPicker(function (id) { pickedSkill = id; });
    $$('[data-start]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = ACTS.filter(function (x) { return x.id === b.dataset.start; })[0];
        S = newSession('act', a); go('ready');
      });
    });
    $('#ownFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      S = newSession('own'); S.ownURL = URL.createObjectURL(f); S.own.fileName = f.name; go('ownready');
    });
  }

  var SCREENS = {};

  /* ---------------- GET READY ---------------- */
  SCREENS.ready = function () {
    var a = S.act;
    render(hero('Get ready', 'Good listeners think about the topic and the key words before a talk starts.') +
      '<div class="wrap section stack">' +
      '<div class="card"><div class="badges">' + srcBadge(a.source) + (a.topic ? '<span class="badge">' + esc(a.topic) + '</span>' : '') + (a.lengthSeconds ? '<span class="badge">' + fmtLen(a.lengthSeconds) + ' min</span>' : '') + '<span class="badge">Level ' + esc(a.level) + '</span>' + draftBadge(a) + '</div>' +
      '<h3 style="font-size:1.5rem;margin:0">' + esc(a.title) + '</h3>' + attribution(a) + '</div>' +
      '<div class="card"><h3>Key words you will hear</h3><dl class="terms">' + a.keyTerms.map(function (t) {
        return '<div><dt>' + esc(t.term) + '</dt><dd>' + esc(t.definition) + '</dd></div>';
      }).join('') + '</dl></div>' +
      '<div class="card"><label class="q" for="expect">What do you expect to hear?</label>' +
      '<p class="hint" id="expectHint">' + esc(a.predictionQuestion) + ' Write a few words in any language.</p>' +
      '<textarea id="expect" aria-describedby="expectHint">' + esc(S.expect) + '</textarea></div>' +
      why('Knowing the key words and guessing the content first means your brain has less to do while you listen.') +
      navActions({ back: 'Home', next: 'Next: today’s skill' }) + '</div>');
    $('#expect').addEventListener('input', function () { S.expect = this.value; });
    bindNav();
  };
  SCREENS.ownready = function () {
    render(hero('Get ready', 'Think about the talk before you listen.') +
      '<div class="wrap section stack"><div class="card"><p class="small muted" style="margin:0 0 12px">Your file: <b>' + esc(S.own.fileName) + '</b> (on this device only)</p>' +
      '<label class="q" for="otopic">What is the talk about?</label>' +
      '<input type="text" id="otopic" maxlength="120" value="' + esc(S.own.topic) + '" placeholder="For example: climate change and farming">' +
      '<label class="q" for="oexp" style="margin-top:16px">What do you expect to hear?</label>' +
      '<p class="hint" id="oexpHint">Write two or three ideas or words you think the speaker will use. Any language is fine.</p>' +
      '<textarea id="oexp" aria-describedby="oexpHint">' + esc(S.own.expect) + '</textarea></div>' +
      why('Thinking about the topic first helps your brain predict, so listening is easier.') +
      navActions({ back: 'Home', next: 'Next: today’s skill' }) + '</div>');
    $('#otopic').addEventListener('input', function () { S.own.topic = this.value; S.title = this.value.trim() || 'My own recording'; });
    $('#oexp').addEventListener('input', function () { S.own.expect = this.value; });
    bindNav();
  };

  /* ---------------- SKILL FOCUS ---------------- */
  SCREENS.skill = function () {
    var t = tipById(S.skill);
    render(hero('Today’s skill: ' + esc(t.name), 'A one-minute tip. Read it, then try it while you listen.') +
      '<div class="wrap section stack"><details class="card"><summary class="linkbtn" style="display:inline-flex;align-items:center">Change today’s skill</summary><div style="margin-top:10px">' + skillPicker(S.skill) + '</div></details>' +
      '<div class="card"><h3>' + esc(t.title) + '</h3><p>' + esc(t.intro) + '</p>' +
      '<div class="tipex">' + t.examples.map(function (e) { return '<div><b>' + esc(e[0]) + '</b><span>' + esc(e[1]) + '</span></div>'; }).join('') + '</div>' +
      (t.sample ? '<p class="label" style="margin-top:12px">Example notes</p><pre class="notesview mono" style="margin:0 0 12px">' + esc(t.sample) + '</pre>' : '') +
      '<p class="goalbox" style="margin:12px 0 0"><span class="label">Try this today</span>' + esc(t.tryit) + '</p></div>' +
      why('Practising one skill at a time, with clear examples, helps you improve faster than just “taking notes”.') +
      navActions({ back: 'Back', next: 'I’m ready to listen' }) + '</div>');
    bindSkillPicker(function (id) { S.skill = id; pickedSkill = id; SCREENS.skill(); });
    bindNav();
  };

  /* ---------------- LISTEN ---------------- */
  function againToggle() {
    return '<div class="btnrow" style="margin-top:12px"><button type="button" class="btn sm dark" id="againT" aria-pressed="' + (S.listens >= 2) + '">↻ I listened a second time (optional)</button></div>';
  }
  function playerHTML() {
    var a = S.act;
    if (S.kind === 'own') {
      return '<div class="player"><p class="label" style="margin:0;color:#ffbca6">Your recording</p>' +
        '<audio controls preload="metadata" src="' + S.ownURL + '" aria-label="Your recording"></audio>' +
        '<p class="small" style="margin:8px 0 0">Your recording plays on this device only. It is never uploaded.</p></div>';
    }
    if (a.source === 'ted') {
      return honour('Keep subtitles <b>off</b>. Listen once without stopping or going back, like a real lecture. Nobody checks this: it is up to you, and it makes your practice real.') +
        '<div class="player"><div class="embed"><iframe id="tedFrame" src="' + esc(a.embedUrl) + '" title="TED talk: ' + esc(a.title) + ' by ' + esc(a.speaker) + '" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe></div>' +
        attribution(a) + '<div id="embedMsg" role="status"></div>' + againToggle() +
        '<p class="small" style="margin:10px 0 0"><button type="button" class="linkbtn" id="noVideo" style="color:#c7c9ff">Video not working?</button></p></div>';
    }
    if (a.source === 'bne') {
      return honour('Choose the <b>Medium</b> speed. <b>Don’t read the text</b> under the players: just listen. Listen once without going back. Nobody checks this: it is up to you.') +
        '<div class="player"><p style="margin:0 0 12px">This news story plays on the Breaking News English website. It opens in a new tab. Come back to this tab when you finish.</p>' +
        '<a class="btn big coral" href="' + esc(a.bneUrl) + '" target="_blank" rel="noopener" id="openBne">▶ Open the listening <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a>' +
        '<p class="small" style="margin:12px 0 0">On a phone, paper notes are easiest for this one.</p>' + attribution(a) + againToggle() + '</div>';
    }
    return '';
  }
  function problemHTML(offline) {
    return '<div class="notice warn" style="margin-top:12px"><p style="margin:0 0 6px"><b>' + (offline ? 'You seem to be offline.' : 'The TED player didn’t load.') + '</b> Check your internet connection and try again. Or choose a news listening or your own recording instead.</p>' +
      '<div class="btnrow"><button type="button" class="btn sm dark" data-retry>Try again</button><button type="button" class="btn sm" data-otherchoice>Choose something else</button></div></div>';
  }
  function bindProblem() {
    var r = $('[data-retry]', app); if (r) r.addEventListener('click', function () { var f = $('#tedFrame'); if (f) { f.src = f.src; } $('#embedMsg').innerHTML = ''; watchEmbed(); });
    var o = $('[data-otherchoice]', app); if (o) o.addEventListener('click', function () { if (window.confirm('Leave this session and choose something else?')) goHome(); });
  }
  var embedTimer = null;
  function watchEmbed() {
    var f = $('#tedFrame'); if (!f) return;
    clearTimeout(embedTimer);
    if (!navigator.onLine) { $('#embedMsg').innerHTML = problemHTML(true); bindProblem(); return; }
    var loaded = false;
    f.addEventListener('load', function () { loaded = true; clearTimeout(embedTimer); }, { once: true });
    embedTimer = setTimeout(function () { if (!loaded && $('#embedMsg')) { $('#embedMsg').innerHTML = problemHTML(false); bindProblem(); } }, 15000);
  }

  SCREENS.listen = function () {
    if (!S.notesMode) {
      render(hero('Listen and take notes', 'First, choose how you will take notes today.') +
        '<div class="wrap section stack">' + YOURWAY +
        '<div class="card stack"><h3 style="margin:0">How will you take notes?</h3>' +
        '<div class="btnrow"><button type="button" class="btn big" data-mode="type"><span aria-hidden="true">⌨️</span> I’ll type here</button>' +
        '<button type="button" class="btn big dark" data-mode="paper"><span aria-hidden="true">✍️</span> I’m using paper</button></div>' +
        '<p class="small muted" style="margin:0">Paper is great for arrows, boxes and drawings. After listening, you can take a photo of your notes. The photo stays on this device.</p></div>' +
        navActions({ back: 'Back' }) + '</div>');
      $$('[data-mode]', app).forEach(function (b) { b.addEventListener('click', function () { S.notesMode = b.dataset.mode; SCREENS.listen(); }); });
      bindNav();
      return;
    }
    var notesHTML = S.notesMode === 'type'
      ? '<div><label class="q" for="notes">Your notes</label><textarea id="notes" class="notes" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">' + esc(S.notes) + '</textarea></div>'
      : '<div class="card"><h3>Write on your paper now</h3><p style="margin:0">When you finish, you can take a photo of your notes on the next screen.</p></div>';
    var sub = S.kind === 'own' ? 'Play your recording and take notes while you listen.'
      : S.act.source === 'ted' ? 'Press play on the video and take notes while you listen.'
        : S.act.source === 'bne' ? 'Open the listening, press play, and take notes.' : '';
    render(hero('Listen and take notes', sub) +
      '<div class="wrap section stack">' + playerHTML() +
      '<p class="small muted" style="margin:10px 0 0">Any language, symbols, arrows and drawings are fine. Key words, not full sentences.</p>' + notesHTML +
      '<p style="margin:0"><button type="button" class="linkbtn small" id="switchMode">' + (S.notesMode === 'type' ? 'Switch to paper notes' : 'Switch to typing') + '</button></p>' +
      why('Short notes with symbols let you keep listening while you write. Speakers don’t wait!') +
      navActions({ back: 'Back', next: 'I’ve finished my notes' }) + '</div>');
    if (S.notesMode === 'type') $('#notes').addEventListener('input', function () { S.notes = this.value; });
    $('#switchMode').addEventListener('click', function () { S.notesMode = S.notesMode === 'type' ? 'paper' : 'type'; SCREENS.listen(); });
    bindNav(function () { S.listens = Math.max(S.listens, 1); clearTimeout(embedTimer); nextStep(); }, function () { clearTimeout(embedTimer); prevStep(); });

    var t = $('#againT');
    if (t) t.addEventListener('click', function () { var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on)); S.listens = on ? 2 : 1; });
    var nv = $('#noVideo');
    if (nv) nv.addEventListener('click', function () { $('#embedMsg').innerHTML = problemHTML(!navigator.onLine); bindProblem(); });
    if (S.kind === 'act' && S.act.source === 'ted') watchEmbed();
    var ob = $('#openBne'); if (ob) ob.addEventListener('click', function () { S.listens = Math.max(S.listens, 1); });

    var au = $('audio', app);
    if (au) {
      au.addEventListener('play', function () { if (S.ended) S.listens = 2; else S.listens = Math.max(S.listens, 1); });
      au.addEventListener('ended', function () {
        S.ended = true;
      });
      au.addEventListener('error', function () {
        var m = $('#embedMsg'); if (m) m.innerHTML = '<p class="notice warn" style="margin-top:10px">This audio file could not be played. Try a different file, for example an MP3.</p>';
      });
    }
  };

  /* ---------------- PHOTO ---------------- */
  SCREENS.photo = function () {
    render(hero('Add a photo of your notes', 'This is optional. A photo lets you see your notes beside the checklist.') +
      '<div class="wrap section stack"><div class="card stack">' +
      '<div class="btnrow"><label class="btn big filebtn"><span aria-hidden="true">📷</span> Take a photo of your notes<input type="file" id="camIn" accept="image/*" capture="environment"></label>' +
      '<label class="btn big dark filebtn"><span aria-hidden="true">🖼️</span> Choose photos<input type="file" id="pickIn" accept="image/*" multiple></label></div>' +
      '<p class="small muted" style="margin:0"><b>Your photos stay on this device. They are never uploaded.</b> You can add several pages. The app does not read your handwriting: the photo is only for you to look at.</p>' +
      '<p id="photoMsg" role="status" style="margin:0"></p><div class="thumbs" id="thumbs"></div></div>' +
      why('Having your notes in front of you makes the self-check honest and quick.') +
      navActions({ back: 'Back', extra: '<button type="button" class="btn dark" id="skipPhoto">Skip photo</button>', next: 'Use these photos' }) + '</div>');
    var nextBtn = $('[data-act="next"]', app), skipBtn = $('#skipPhoto'), msg = $('#photoMsg');
    function draw() {
      $('#thumbs').innerHTML = S.photoURLs.map(function (u, i) {
        return '<figure><img src="' + u + '" alt="Page ' + (i + 1) + ' of your notes"><figcaption><button type="button" class="btn sm light block" data-rm="' + i + '">Remove page ' + (i + 1) + '</button></figcaption></figure>';
      }).join('');
      $$('[data-rm]', app).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = Number(b.dataset.rm);
          try { URL.revokeObjectURL(S.photoURLs[i]); } catch (e) { /* ignore */ }
          S.photos.splice(i, 1); S.photoURLs.splice(i, 1); draw(); msg.textContent = 'Page removed.';
        });
      });
      nextBtn.hidden = !S.photos.length; skipBtn.hidden = !!S.photos.length;
    }
    function add(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      msg.textContent = 'Getting your photo ready…';
      Promise.all(files.map(shrinkImage)).then(function (blobs) {
        var n = 0;
        blobs.forEach(function (b) { if (b) { S.photos.push(b); S.photoURLs.push(URL.createObjectURL(b)); n++; } });
        msg.textContent = n ? (n === 1 ? 'Photo added.' : n + ' photos added.') + ' You can add more pages.' : 'Sorry, that file could not be opened as a photo.';
        draw();
      });
    }
    $('#camIn').addEventListener('change', function () { add(this.files); this.value = ''; });
    $('#pickIn').addEventListener('change', function () { add(this.files); this.value = ''; });
    skipBtn.addEventListener('click', nextStep);
    bindNav(); draw();
  };

  /* ---------------- PREDICT ---------------- */
  SCREENS.predict = function () {
    var n = S.act.keyIdeas.length, nums = '';
    for (var i = 0; i <= n; i++) nums += '<label><input type="radio" name="pred" value="' + i + '"' + (S.predicted === i ? ' checked' : '') + '><span>' + i + '</span></label>';
    render(hero('Before you check', 'Look at your notes for a moment. Then make a guess.') +
      '<div class="wrap section stack"><div class="card"><fieldset><legend class="q">How many of the ' + n + ' key ideas do you think you captured?</legend>' +
      '<p class="hint">Just guess. There is no wrong answer.</p><div class="nums">' + nums + '</div></fieldset></div>' +
      why('Guessing first and then checking trains you to judge your own learning. Good learners do this all the time.') +
      navActions({ back: 'Back', next: 'Start checking', disabled: S.predicted == null }) + '</div>');
    $$('input[name=pred]', app).forEach(function (r) { r.addEventListener('change', function () { S.predicted = Number(r.value); $('[data-act="next"]', app).disabled = false; }); });
    bindNav(function () { S.ci = 0; nextStep(); });
  };

  /* ---------------- SELF-CHECK ---------------- */
  SCREENS.check = function () {
    var n = S.act.keyIdeas.length;
    render(hero('Check your notes', 'Look at your notes, not your memory. Is each key idea there?', '<div class="dots" id="dots" aria-hidden="true"></div>') +
      '<div class="wrap wide section"><div class="split"><div class="stack" id="checkMain"></div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Checking your notes against the key ideas shows you what you catch and what you miss. That tells you what to practise.') + '</div></div>');
    bindZoom();
    var main = $('#checkMain');
    function dots() { var h = ''; for (var i = 0; i < n; i++) h += '<i class="' + (S.checks[i] ? 'done' : '') + (i === S.ci ? ' now' : '') + '"></i>'; $('#dots').innerHTML = h; }
    function focusH() { var h = $('#ideaH') || $('#rateH'); if (h) h.focus(); }
    var AIL = { got: '✓ Got it', partly: '~ Partly', missed: '✗ Missed' };
    function aiBox() {
      if (!window.DNAI || S.notesMode !== 'type' || S.notes.trim().length < 15) return '';
      if (S.aiRes) return '<p class="small muted" style="margin:0">AI feedback is shown under each idea. It can be wrong or miss things: you decide.</p>';
      return '<div class="card"><p style="margin-top:0"><b>Want a second opinion?</b> AI can read your typed notes and suggest which key ideas are there. You still decide.</p>' +
        '<button type="button" class="btn light" id="aiNotes">Ask AI to check my notes</button>' +
        '<p class="small muted" id="aiMsg" role="status" style="margin:10px 0 0">Your notes and the key ideas are sent to AI feedback (Cloudflare Workers AI). Nothing is stored.</p></div>';
    }
    function aiLine(i) {
      var r = S.aiRes && S.aiRes.ideas && S.aiRes.ideas[i]; if (!r) return '';
      return '<p class="small" style="margin:12px 0 0;padding:10px 12px;border-radius:12px;border:1px dashed currentColor"><b>AI feedback:</b> ' + esc(AIL[r.status] || r.status) + (r.hint ? ' · ' + esc(r.hint) : '') + ' <span class="muted">(It can be wrong.)</span></p>';
    }
    function bindAi() {
      var b = $('#aiNotes'); if (!b) return;
      b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Reading your notes…';
        DNAI.post('/notes', { ideas: S.act.keyIdeas.map(function (k) { return { text: k.text, type: k.type }; }), notes: S.notes }, { app: 'notes' })
          .then(function (r) { S.aiRes = r; showIdea(); focusH(); })
          .catch(function (e) { b.disabled = false; b.textContent = 'Ask AI to check my notes'; $('#aiMsg').textContent = e.message + ' You can check your notes yourself below.'; });
      });
    }
    function showIdea() {
      dots();
      if (S.ci >= n) return showRatings();
      var k = S.act.keyIdeas[S.ci];
      main.innerHTML = aiBox() + '<div class="card"><h3 tabindex="-1" id="ideaH" class="label" style="font-size:.88rem">Key idea ' + (S.ci + 1) + ' of ' + n + '</h3>' +
        '<div class="badges"><span class="badge ' + k.type + '">' + (k.type === 'main' ? 'Main idea' : 'Supporting detail') + '</span></div>' +
        '<p class="idea">' + esc(k.text) + '</p>' +
        aiLine(S.ci) + '<fieldset><legend class="q">Is this in your notes?</legend>' + choiceGroup('check', S.checks[S.ci], 'check') + '</fieldset>' +
        '<p class="small muted" style="margin:12px 0 0">“Got it” means the idea is in your notes in any form: a word, a symbol, a drawing or another language.</p></div>' +
        (S.ci > 0 ? '<div><button type="button" class="btn light" id="prevIdea">← Previous idea</button></div>' : '');
      $$('.choices button', main).forEach(function (b) { b.addEventListener('click', function () { S.checks[S.ci] = b.dataset.v; S.ci++; showIdea(); focusH(); }); });
      var p = $('#prevIdea'); if (p) p.addEventListener('click', function () { S.ci--; showIdea(); focusH(); });
      bindAi();
    }
    function showRatings() {
      main.innerHTML = '<div class="card stack"><h3 tabindex="-1" id="rateH">Two quick questions about your notes</h3>' +
        '<fieldset><legend class="q">My notes are organised.</legend><p class="hint">For example: headings, main ideas easy to find, details under them.</p>' + choiceGroup('organised', S.organised) + '</fieldset>' +
        '<fieldset><legend class="q">I used abbreviations or symbols.</legend><p class="hint">For example: → ↑ = e.g. b/c</p>' + choiceGroup('abbrev', S.abbrev) + '</fieldset></div>' +
        '<div class="nav-actions" style="margin-top:0"><button type="button" class="btn light" id="prevIdea">← Previous idea</button>' +
        '<button type="button" class="btn big" id="toQuiz"' + (S.organised && S.abbrev ? '' : ' disabled') + '>Next: use your notes →</button></div>';
      $$('.choices', main).forEach(function (g) {
        $$('button', g).forEach(function (b) {
          b.addEventListener('click', function () {
            S[g.dataset.name] = b.dataset.v;
            $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            $('#toQuiz').disabled = !(S.organised && S.abbrev);
          });
        });
      });
      $('#prevIdea').addEventListener('click', function () { S.ci = n - 1; showIdea(); focusH(); });
      $('#toQuiz').addEventListener('click', function () { S.qi = 0; nextStep(); });
    }
    showIdea();
  };

  /* ---------------- USE YOUR NOTES (questions) ---------------- */
  function answerIndex(q) { var i = q.options.indexOf(q.answer); if (i < 0 && typeof q.answer === 'number') i = q.answer - 1; return i; }
  SCREENS.quiz = function () {
    var qs = S.act.questions;
    if (!qs.length) { nextStep(); return; }
    render(hero('Use your notes', 'Answer from your notes only. Try not to use your memory.') +
      '<div class="wrap wide section"><div class="split"><div class="stack" id="quizMain"></div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Using your notes later is the second way notes help you learn. It also shows you what good notes need to include.') + '</div></div>');
    bindZoom();
    var main = $('#quizMain');
    function feedback(q, ok) {
      return '<div class="notice' + (ok ? ' ok' : '') + '"><p style="margin:0 0 4px"><b>' + (ok ? '✓ Yes, that’s right.' : '✗ Not quite. The answer is: ' + esc(q.options[answerIndex(q)])) + '</b></p>' +
        '<p style="margin:0">' + esc(q.explanation || '') + '</p>' +
        (ok ? '' : '<p class="small muted" style="margin:6px 0 0">Was it in your notes? If not, that is useful to know for next time.</p>') + '</div>';
    }
    function show() {
      var q = qs[S.qi], ans = answerIndex(q), chosen = S.quiz[S.qi], answered = chosen != null;
      main.innerHTML = '<div class="card"><p class="label" style="margin:0 0 6px">Question ' + (S.qi + 1) + ' of ' + qs.length + '</p>' +
        '<h3 tabindex="-1" id="qh">' + esc(q.stem) + '</h3><div class="opts" role="group" aria-labelledby="qh">' + q.options.map(function (o, i) {
          var cls = answered ? (i === ans ? ' right' : (i === chosen ? ' wrong' : '')) : '';
          var mk = answered ? (i === ans ? '✓' : (i === chosen ? '✗' : 'ABCDEF'[i])) : 'ABCDEF'[i];
          return '<button type="button" class="btn opt' + cls + '" data-o="' + i + '"' + (answered ? ' disabled aria-disabled="true"' : '') + '><span class="mk" aria-hidden="true">' + mk + '</span><span>' + esc(o) +
            (answered && i === ans ? '<span class="sr"> (correct answer)</span>' : '') + (answered && i === chosen && i !== ans ? '<span class="sr"> (your answer)</span>' : '') + '</span></button>';
        }).join('') + '</div><div class="feedback" role="status">' + (answered ? feedback(q, chosen === ans) : '') + '</div></div>' +
        (answered ? '<div class="btnrow end"><button type="button" class="btn big" id="nextQ">' + (S.qi < qs.length - 1 ? 'Next question →' : 'Next: review →') + '</button></div>' : '');
      $$('[data-o]', main).forEach(function (b) { b.addEventListener('click', function () { S.quiz[S.qi] = Number(b.dataset.o); show(); var nb = $('#nextQ'); if (nb) nb.focus(); }); });
      var nb = $('#nextQ');
      if (nb) nb.addEventListener('click', function () { if (S.qi < qs.length - 1) { S.qi++; show(); $('#qh').focus(); } else nextStep(); });
    }
    show();
  };

  /* ---------------- REVIEW ---------------- */
  function highlight(text, phrases) {
    var ps = (phrases || []).filter(Boolean).slice().sort(function (a, b) { return b.length - a.length; });
    if (!ps.length) return esc(text);
    var re = new RegExp(ps.map(function (p) {
      return (/^\w/.test(p) ? '\\b' : '') + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/\w$/.test(p) ? '\\b' : '');
    }).join('|'), 'g');
    var out = '', last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  function modelNotesHTML(lines) {
    var h = '', inList = false;
    lines.forEach(function (line) {
      var sub = /^\s*-\s+/.test(line);
      if (sub && !inList) { h += '<ul>'; inList = true; }
      if (!sub && inList) { h += '</ul>'; inList = false; }
      h += sub ? '<li>' + esc(line.replace(/^\s*-\s+/, '')) + '</li>' : '<p class="h">' + esc(line) + '</p>';
    });
    return h + (inList ? '</ul>' : '');
  }
  SCREENS.review = function () {
    var a = S.act;
    var missed = a.keyIdeas.map(function (k, i) { return { k: k, v: S.checks[i] }; }).filter(function (x) { return x.v === 'missed' || x.v === 'partly'; });
    var sourceCard = '';
    if (a.source === 'ted') {
      sourceCard = '<div class="card"><h3>Find the parts you missed</h3><p>Now you can read what the speaker said. Use the times above to find each part.</p>' +
        '<div class="btnrow"><a class="btn" href="' + esc(a.tedUrl) + '/transcript" target="_blank" rel="noopener">Read the transcript on TED.com <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a></div>' +
        '<details style="margin-top:14px" id="rewatch"><summary class="linkbtn" style="display:inline-flex;align-items:center">Watch the talk again (subtitles are fine now)</summary><div id="rewatchBox" style="margin-top:10px"></div></details>' + attribution(a) + '</div>';
    } else if (a.source === 'bne') {
      sourceCard = '<div class="card"><h3>Read the story</h3><p>Now you may read the text. It is on the same page as the listening, under the players. Use the times above to find each part.</p>' +
        '<div class="btnrow"><a class="btn" href="' + esc(a.bneUrl) + '" target="_blank" rel="noopener">Open the story on Breaking News English <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a></div>' + attribution(a) + '</div>';
    }
    render(hero('Review', 'See what you missed and how a model set of notes looks.') +
      '<div class="wrap section stack">' +
      (missed.length
        ? '<div class="card"><h3>Ideas you missed or partly caught</h3><p class="hint">The times show roughly where each idea is in the ' + (a.source === 'ted' ? 'talk' : 'listening') + '.</p><ul style="list-style:none;padding:0;margin:0;display:grid;gap:10px">' +
          missed.map(function (x) {
            return '<li style="border:1px solid var(--line);border-radius:12px;padding:12px"><p style="margin:0 0 6px"><span class="time">' + esc(aboutTime(x.k.approxTime) || '—') + '</span> <span class="small muted">' + CHECK_LABEL[x.v] + ' · ' + (x.k.type === 'main' ? 'main idea' : 'detail') + '</span></p>' +
              '<p style="margin:0">' + esc(x.k.text) + '</p>' +
              '</li>';
          }).join('') + '</ul></div>'
        : '<div class="card"><h3>You found every key idea in your notes.</h3><p style="margin:0">Look at the model notes below to compare the organisation.</p></div>') +
      sourceCard +
      '<div class="card model"><h3>Model notes</h3><p class="hint">This is one way to take notes on this. Your notes can look very different and still be good.</p>' + modelNotesHTML(a.modelNotes) + '</div>' +
      why('Seeing exactly what you missed, and where, helps you notice the same kind of moment next time.') +
      navActions({ next: 'Next: reflect' }) + '</div>');
    var rw = $('#rewatch');
    if (rw) rw.addEventListener('toggle', function () {
      if (rw.open && !$('#rewatchBox iframe')) $('#rewatchBox').innerHTML = '<div class="embed"><iframe src="' + esc(a.embedUrl) + '" title="TED talk: ' + esc(a.title) + ' by ' + esc(a.speaker) + '" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe></div>';
    });
    bindNav();
  };

  /* ---------------- OWN: RATE + SUMMARY ---------------- */
  var RUBRIC = [
    ['main', 'My notes show the main ideas.', 'The big points the speaker made.'],
    ['details', 'I noted useful supporting details.', 'Examples, reasons, names or numbers that support the main ideas.'],
    ['organisation', 'My notes are organised.', 'Headings, numbers, details under main ideas.'],
    ['abbrev', 'I used abbreviations or symbols.', 'For example: → ↑ = e.g. b/c']
  ];
  function rubricDone() { return RUBRIC.every(function (r) { return S.own.ratings[r[0]]; }); }
  SCREENS.rate = function () {
    render(hero('Check your notes', 'There is no checklist for your own recording, so rate your notes yourself. Be honest: this is just for you.') +
      '<div class="wrap wide section"><div class="split"><div class="stack"><div class="card stack">' +
      RUBRIC.map(function (r) { return '<fieldset><legend class="q">' + esc(r[1]) + '</legend><p class="hint">' + esc(r[2]) + '</p>' + choiceGroup(r[0], S.own.ratings[r[0]]) + '</fieldset>'; }).join('') +
      '</div>' + navActions({ back: 'Back', next: 'Next: use your notes', disabled: !rubricDone() }) + '</div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Rating your notes against clear points helps you see exactly what to improve.') + '</div></div>');
    bindZoom();
    $$('.choices', app).forEach(function (g) {
      $$('button', g).forEach(function (b) {
        b.addEventListener('click', function () {
          S.own.ratings[g.dataset.name] = b.dataset.v;
          $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          $('[data-act="next"]', app).disabled = !rubricDone();
        });
      });
    });
    bindNav();
  };
  var SUM_PROMPTS = ['Sentence 1: What was the talk about?', 'Sentence 2: What were the main points?', 'Sentence 3: What was the most important idea or conclusion?'];
  SCREENS.summary3 = function () {
    render(hero('Use your notes', 'Write a three-sentence summary of the talk. Use your notes only, not your memory.') +
      '<div class="wrap wide section"><div class="split"><div class="stack"><div class="card stack">' +
      SUM_PROMPTS.map(function (p, i) { return '<div><label class="q" for="sum' + i + '">' + esc(p) + '</label><textarea id="sum' + i + '" data-i="' + i + '" style="min-height:90px">' + esc(S.own.summary[i]) + '</textarea></div>'; }).join('') +
      '</div>' + navActions({ back: 'Back', next: 'Next: reflect' }) + '</div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Writing a summary from your notes is the second way notes help you learn. It shows what your notes can do.') + '</div></div>');
    bindZoom();
    $$('textarea[data-i]', app).forEach(function (t) { t.addEventListener('input', function () { S.own.summary[Number(t.dataset.i)] = t.value; }); });
    bindNav();
  };

  /* ---------------- REFLECT ---------------- */
  function scoreOf(v) { return v === 'got' ? 1 : v === 'partly' ? 0.5 : 0; }
  function results() {
    var a = S.act, r = { total: a.keyIdeas.length, got: 0, partly: 0, missed: 0, main: 0, mainT: 0, det: 0, detT: 0, q: 0, qT: a.questions.length };
    a.keyIdeas.forEach(function (k, i) {
      var v = S.checks[i] || 'missed';
      r[v === 'got' ? 'got' : v === 'partly' ? 'partly' : 'missed']++;
      if (k.type === 'main') { r.mainT++; r.main += scoreOf(v); } else { r.detT++; r.det += scoreOf(v); }
    });
    r.actual = r.got + r.partly * 0.5;
    a.questions.forEach(function (q, i) { if (S.quiz[i] === answerIndex(q)) r.q++; });
    return r;
  }
  function calibrationMsg(pred, actual) {
    var d = pred - actual;
    if (Math.abs(d) <= 1) return 'Your guess was close to your check. You are judging your notes well.';
    if (d > 1) return 'You guessed higher than your check showed. This is very common, and it is why checking matters. Next time, look at your notes more carefully before you guess.';
    return 'You found more in your notes than you expected. Your notes may be better than you think.';
  }
  function balanceMsg(r) {
    var mp = r.mainT ? r.main / r.mainT : 0, dp = r.detT ? r.det / r.detT : 0;
    if (mp === 1 && dp === 1) return 'You found every main idea and every detail in your notes.';
    if (mp >= dp) return 'You caught more main ideas than details. That is the right priority: main ideas matter most.';
    return 'You caught more details than main ideas. Next time, listen for the signposts that introduce each new main point.';
  }
  function goalIdeas() {
    var out = [];
    if (S.kind === 'act') {
      var r = results();
      if (r.mainT && r.main / r.mainT < 0.8) out.push('Listen for signposts like “first”, “the second thing” and “the biggest lesson” to catch each main idea.');
      if (S.abbrev !== 'yes') out.push('Use at least five symbols or abbreviations, like → ↑ = e.g.');
      if (S.organised !== 'yes') out.push('Start a new line for each main idea and put details under it.');
      if (S.listens < 2) out.push('Use the second listen to fill gaps in my notes.');
      if (S.predicted != null && Math.abs(S.predicted - r.actual) > 1) out.push('Look at my notes carefully before I guess my score.');
    } else {
      var g = S.own.ratings;
      if (g.main !== 'yes') out.push('Listen for signposts that introduce each main idea.');
      if (g.details !== 'yes') out.push('Note one example or reason under each main idea.');
      if (g.organisation !== 'yes') out.push('Start a new line for each main idea and put details under it.');
      if (g.abbrev !== 'yes') out.push('Use at least five symbols or abbreviations, like → ↑ = e.g.');
    }
    out.push('Write key words only, not full sentences.');
    return out.slice(0, 4);
  }
  SCREENS.reflect = function () {
    var top;
    if (S.kind === 'act') {
      var r = results();
      top = '<div class="stats">' +
        '<div class="stat-box"><span class="label">Your guess</span><span class="n">' + S.predicted + '/' + r.total + '</span></div>' +
        '<div class="stat-box"><span class="label">Your check</span><span class="n">' + fmtNum(r.actual) + '/' + r.total + '</span><span class="small">' + r.got + ' got it · ' + r.partly + ' partly · ' + r.missed + ' missed</span></div>' +
        '<div class="stat-box"><span class="label">Main ideas</span><span class="n">' + fmtNum(r.main) + '/' + r.mainT + '</span></div>' +
        '<div class="stat-box"><span class="label">Details</span><span class="n">' + fmtNum(r.det) + '/' + r.detT + '</span></div>' +
        (r.qT ? '<div class="stat-box"><span class="label">Questions from notes</span><span class="n">' + r.q + '/' + r.qT + '</span></div>' : '') + '</div>' +
        '<p class="notice">' + esc(calibrationMsg(S.predicted, r.actual)) + '</p><p class="notice">' + esc(balanceMsg(r)) + '</p>' +
        '<p class="small muted">“Partly” counts as half. These numbers come from your own check. The app does not mark your notes.</p>';
    } else {
      top = '<div class="card"><h3>How you rated your notes</h3><dl class="kv">' + RUBRIC.map(function (q) {
        return '<dt>' + esc({ main: 'Main ideas', details: 'Details', organisation: 'Organised', abbrev: 'Symbols' }[q[0]]) + '</dt><dd>' + esc(RATE_LABEL[S.own.ratings[q[0]]] || '—') + '</dd>';
      }).join('') + '</dl></div>';
    }
    render(hero('Reflect', S.kind === 'act' ? 'Compare your guess with your check. Then set one goal.' : 'Think about what went well. Then set one goal.') +
      '<div class="wrap section stack">' + top +
      '<div class="card"><label class="q" for="refl">What will you do differently next time?</label><textarea id="refl">' + esc(S.reflection) + '</textarea></div>' +
      '<div class="card"><label class="q" for="goal">My one goal for next time</label><p class="hint" id="goalHint">Write your own goal, or tap an idea below to use it.</p>' +
      '<input type="text" id="goal" maxlength="180" aria-describedby="goalHint" value="' + esc(S.goal) + '">' +
      '<div class="chips" style="margin-top:12px">' + goalIdeas().map(function (g) { return '<button type="button" class="btn sm light" data-goal="' + esc(g) + '">' + esc(g) + '</button>'; }).join('') + '</div></div>' +
      why('Comparing your guess with your check, and setting one clear goal, makes your next practice more focused.') +
      '<p class="small muted" id="goalNeed" style="margin:12px 0 0">' + (S.goal.trim() ? '' : 'Set one goal to finish.') + '</p>' +
      navActions({ next: 'Save and see my summary', disabled: !S.goal.trim() }) + '</div>');
    var nextB = $('[data-act="next"]', app);
    function upd() { nextB.disabled = !S.goal.trim(); $('#goalNeed').textContent = S.goal.trim() ? '' : 'Set one goal to finish.'; }
    $('#refl').addEventListener('input', function () { S.reflection = this.value; });
    $('#goal').addEventListener('input', function () { S.goal = this.value; upd(); });
    $$('[data-goal]', app).forEach(function (b) { b.addEventListener('click', function () { S.goal = b.dataset.goal; $('#goal').value = S.goal; upd(); $('#goal').focus(); }); });
    bindNav(saveSession);
  };

  function saveSession() {
    var rec = { id: S.id, date: S.date, kind: S.kind, source: S.source, actId: S.actId, title: S.title, speaker: S.speaker, verified: S.verified,
      url: S.act ? (S.act.tedUrl || S.act.bneLessonUrl || '') : '', skill: S.skill, expect: S.expect, notesMode: S.notesMode, notes: S.notes,
      photoCount: S.photos.length, listens: Math.max(1, S.listens), reflection: S.reflection.trim(), goal: S.goal.trim() };
    if (S.kind === 'act') {
      var r = results();
      ['total', 'got', 'partly', 'missed', 'actual', 'main', 'mainT', 'det', 'detT', 'q', 'qT'].forEach(function (k) { rec[k] = r[k]; });
      rec.predicted = S.predicted; rec.checks = S.checks.slice(); rec.organised = S.organised; rec.abbrev = S.abbrev;
    } else {
      rec.own = { topic: S.own.topic.trim(), expect: S.own.expect, fileName: S.own.fileName, ratings: S.own.ratings, summary: S.own.summary.slice() };
    }
    var d = Store.load(); d.sessions.push(rec); d.lastGoal = rec.goal;
    var saved = Store.save();
    var urls = S.photoURLs.slice();
    var p = S.photos.length ? Photos.put(S.id, S.photos.slice()) : Promise.resolve(true);
    S.done = true; setGuard(false);
    p.then(function (ok) { summaryScreen(rec, { justSaved: true, saved: saved, photosSaved: ok, urls: urls }); });
  }

  /* ---------------- SUMMARY ---------------- */
  function skillName(id) { return tipById(id).name; }
  function recTitle(r) { return r.kind === 'own' ? ((r.own && r.own.topic) || 'My own recording') : r.title; }
  function sourceLine(r) {
    if (r.source === 'ted') return r.speaker + ' · TED' + (r.url ? ' · ' + r.url : '');
    if (r.source === 'bne') return 'Breaking News English' + (r.url ? ' · ' + r.url : '');
    return 'My own recording';
  }
  function summaryText(r) {
    var L = ['Notetaking Trainer: session summary', 'Date: ' + fmtDate(r.date), 'Activity: ' + recTitle(r), 'Source: ' + sourceLine(r),
      'Skill focus: ' + skillName(r.skill),
      'Notes: ' + (r.notesMode === 'type' ? 'typed' : 'on paper' + (r.photoCount ? ' (' + r.photoCount + ' photo' + (r.photoCount > 1 ? 's' : '') + ')' : '')),
      'Listens: ' + r.listens + (r.listens >= 2 ? ' (used the optional second listen)' : '')];
    if (r.kind === 'act') {
      if (r.expect) L.push('What I expected: ' + r.expect);
      L.push('My guess: ' + r.predicted + '/' + r.total + ' key ideas. My check: ' + fmtNum(r.actual) + '/' + r.total + ' (' + r.got + ' got it, ' + r.partly + ' partly, ' + r.missed + ' missed)');
      L.push('Main ideas: ' + fmtNum(r.main) + '/' + r.mainT + '. Details: ' + fmtNum(r.det) + '/' + r.detT);
      L.push('My notes are organised: ' + (RATE_LABEL[r.organised] || '-') + '. I used abbreviations or symbols: ' + (RATE_LABEL[r.abbrev] || '-'));
      if (r.qT) L.push('Questions answered from notes: ' + r.q + '/' + r.qT);
    } else if (r.own) {
      if (r.own.expect) L.push('What I expected: ' + r.own.expect);
      L.push('Self-rating: ' + RUBRIC.map(function (q) { return q[1].replace(/\.$/, '') + ': ' + (RATE_LABEL[r.own.ratings[q[0]]] || '-'); }).join('; '));
      L.push('My summary: ' + r.own.summary.filter(function (s) { return s.trim(); }).join(' '));
    }
    if (r.reflection) L.push('Next time I will: ' + r.reflection);
    L.push('My goal: ' + r.goal);
    if (r.notesMode === 'type' && r.notes.trim()) L.push('', 'My notes:', r.notes);
    return L.join('\n');
  }
  function summaryScreen(r, opts) {
    opts = opts || {}; S = null;
    var rows = [];
    function row(k, v) { if (v !== '' && v != null) rows.push('<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'); }
    row('Date', esc(fmtDate(r.date)));
    row('Activity', esc(recTitle(r)));
    row('Source', esc(sourceLine(r)));
    row('Skill focus', esc(skillName(r.skill)));
    row('Notes', r.notesMode === 'type' ? 'Typed' : 'On paper' + (r.photoCount ? ' (' + r.photoCount + ' photo' + (r.photoCount > 1 ? 's' : '') + ')' : ''));
    row('Listens', esc(r.listens + (r.listens >= 2 ? ' (used the optional second listen)' : '')));
    if (r.kind === 'act') {
      row('I expected', esc(r.expect));
      row('Guess vs check', esc(r.predicted + '/' + r.total + ' guessed · ' + fmtNum(r.actual) + '/' + r.total + ' found (' + r.got + ' got it, ' + r.partly + ' partly, ' + r.missed + ' missed)'));
      row('Main ideas', esc(fmtNum(r.main) + '/' + r.mainT)); row('Details', esc(fmtNum(r.det) + '/' + r.detT));
      row('Organised', esc(RATE_LABEL[r.organised] || '—')); row('Symbols', esc(RATE_LABEL[r.abbrev] || '—'));
      if (r.qT) row('Questions', esc(r.q + '/' + r.qT + ' answered from notes'));
    } else if (r.own) {
      row('I expected', esc(r.own.expect));
      RUBRIC.forEach(function (q) { row(q[1].replace(/\.$/, ''), esc(RATE_LABEL[r.own.ratings[q[0]]] || '—')); });
    }
    row('Next time', esc(r.reflection)); row('My goal', '<b>' + esc(r.goal) + '</b>');
    render(hero('Session summary', esc(recTitle(r))) +
      '<div class="wrap section stack" id="summary">' +
      (opts.justSaved ? (opts.saved ? '<p class="notice ok">Saved on this device. Your goal will be shown next time.</p>' : '<p class="notice warn">This browser did not let the app save. Copy or print your summary now if you want to keep it.</p>') : '') +
      (opts.justSaved && opts.photosSaved === false ? '<p class="notice warn">Your photos could not be saved on this device. They are shown below until you close the page, so print now if you need them.</p>' : '') +
      '<div class="card"><dl class="kv">' + rows.join('') + '</dl></div>' +
      (r.own && r.own.summary && r.own.summary.some(function (s) { return s.trim(); }) ? '<div class="card"><h3>My three-sentence summary</h3><p class="pre" style="margin:0">' + esc(r.own.summary.filter(function (s) { return s.trim(); }).join('\n')) + '</p></div>' : '') +
      (r.notesMode === 'type' ? '<div class="card"><h3>My notes</h3><div class="notesview pre">' + (r.notes.trim() ? esc(r.notes) : '<span class="muted">No typed notes.</span>') + '</div></div>' : '') +
      '<div id="sumPhotos"></div>' +
      '<div class="btnrow no-print"><button type="button" class="btn" id="copyS">Copy summary</button><button type="button" class="btn" id="printS">Print</button></div>' +
      '<p id="copyMsg" role="status" class="small"></p>' +
      '<div class="btnrow no-print"><button type="button" class="btn big coral" id="newS">Start a new session</button><a class="btn light" href="#progress" id="toProg">My progress</a></div>' + (window.DNNext ? DNNext.html('notes') : '') + '</div>');
    function showPhotos(list) {
      if (!list || !list.length) return;
      $('#sumPhotos').innerHTML = '<div class="card"><h3>Photos of my notes</h3><div class="photos">' + list.map(function (u, i) {
        return '<button type="button" data-zoom="' + i + '" aria-label="Photo ' + (i + 1) + ' of my notes. Tap to zoom."><img src="' + u + '" alt="Photo ' + (i + 1) + ' of my notes"></button>';
      }).join('') + '</div></div>';
      bindZoom(list);
    }
    if (opts.urls && opts.urls.length) showPhotos(opts.urls);
    else if (r.photoCount) Photos.get(r.id).then(function (b) {
      if (b && b.length) showPhotos(b.map(function (x) { return URL.createObjectURL(x); }));
      else $('#sumPhotos').innerHTML = '<p class="small muted">The photos for this session are no longer on this device.</p>';
    });
    $('#copyS').addEventListener('click', function () { copyText(summaryText(r)).then(function (ok) { $('#copyMsg').textContent = ok ? 'Copied. You can paste it into an email or document.' : 'Sorry, copying did not work in this browser.'; }); });
    $('#printS').addEventListener('click', function () { window.print(); });
    $('#newS').addEventListener('click', goHome);
    $('#toProg').addEventListener('click', function (e) { if (location.hash === '#progress') { e.preventDefault(); progressScreen(); } });
  }
  function copyText(t) {
    return new Promise(function (res) {
      function fallback() {
        try {
          var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); res(ok);
        } catch (e) { res(false); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { res(true); }, fallback); else fallback();
    });
  }

  /* ---------------- PROGRESS ---------------- */
  function progressScreen(msg) {
    S = null; setGuard(false);
    var d = Store.load(), list = d.sessions.slice().reverse();
    render(hero('My progress', 'Your practice history on this device.') +
      '<div class="wrap section stack">' +
      (msg ? '<p class="notice ok" role="status">' + esc(msg) + '</p>' : '') +
      (!Store.ok ? '<p class="notice warn">This browser is not letting the app save, so your history may be empty.</p>' : '') +
      (d.lastGoal ? '<div class="goalbox"><span class="label">My current goal</span>' + esc(d.lastGoal) + '</div>' : '') +
      (list.length ? '<p class="label" style="margin-top:20px">' + list.length + ' session' + (list.length > 1 ? 's' : '') + '</p><ul class="hist">' + list.map(function (r) {
        var line = r.kind === 'act' ? 'Guess ' + r.predicted + '/' + r.total + ' · check ' + fmtNum(r.actual) + '/' + r.total + ' · main ideas ' + fmtNum(r.main) + '/' + r.mainT + (r.qT ? ' · questions ' + r.q + '/' + r.qT : '') : 'Own recording · self-rated';
        return '<li class="card"><div><div class="badges" style="margin-bottom:6px">' + srcBadge(r.source) + '</div><b>' + esc(recTitle(r)) + '</b><br>' +
          '<span class="small mono muted">' + esc(fmtDate(r.date)) + ' · ' + esc(skillName(r.skill)) + '</span><br><span class="small">' + esc(line) + '</span>' +
          (r.goal ? '<br><span class="small">Goal: ' + esc(r.goal) + '</span>' : '') + '</div>' +
          '<button type="button" class="btn sm light no-print" data-view="' + esc(r.id) + '">View<span class="sr"> session from ' + esc(fmtDate(r.date)) + '</span></button></li>';
      }).join('') + '</ul>' : '<div class="card"><p style="margin:0">No sessions yet. Finish a session and it will appear here.</p></div>') +
      '<div class="btnrow no-print" style="margin-top:20px">' + (list.length ? '<button type="button" class="btn" id="copyAll">Copy summary</button><button type="button" class="btn" id="printAll">Print</button>' : '') +
      '<button type="button" class="btn dark" id="clearAll">Clear my data</button></div><p id="copyMsg" role="status" class="small"></p>' +
      '<p class="small muted">Everything here is saved only in this browser, on this device. Nobody else can see it. If you clear your browser data, it will be deleted.</p>' +
      '<div class="btnrow no-print"><button type="button" class="btn big coral" id="newS">Start a new session</button></div></div>');
    $$('[data-view]', app).forEach(function (b) { b.addEventListener('click', function () { var r = d.sessions.filter(function (x) { return x.id === b.dataset.view; })[0]; if (r) summaryScreen(r); }); });
    var ca = $('#copyAll'); if (ca) ca.addEventListener('click', function () {
      copyText((d.lastGoal ? 'My current goal: ' + d.lastGoal + '\n\n' : '') + list.map(summaryText).join('\n\n----------\n\n')).then(function (ok) { $('#copyMsg').textContent = ok ? 'Copied all sessions.' : 'Sorry, copying did not work in this browser.'; });
    });
    var pa = $('#printAll'); if (pa) pa.addEventListener('click', function () { window.print(); });
    $('#clearAll').addEventListener('click', function () {
      if (!window.confirm('Delete all your sessions, notes, goals and photos from this device? This cannot be undone.')) return;
      Store.clear(); Photos.clear().then(function () { progressScreen('All your data has been deleted from this device.'); });
    });
    $('#newS').addEventListener('click', goHome);
  }

  /* ---------------- routing ---------------- */
  function goHome() {
    if (location.hash) { try { history.pushState('', document.title, location.pathname + location.search); } catch (e) { location.hash = ''; } }
    homeScreen();
  }
  function route() { if (location.hash === '#progress') progressScreen(); else homeScreen(); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#progress"]');
    if (!a) return;
    if (sessionActive() && !window.confirm('Leave this practice session? Your notes from this session will not be saved.')) { e.preventDefault(); return; }
    if (location.hash === '#progress') { e.preventDefault(); progressScreen(); }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', function () { if (!location.hash && !sessionActive()) homeScreen(); });

  Store.load();
  loadActs().then(route);
})();
