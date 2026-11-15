/* DAVE Notes: Lecture Note-Taking Trainer
   Plain JavaScript. No build step, no server, no AI calls, no analytics.
   Notes and progress: localStorage. Photos: IndexedDB. Nothing is uploaded. */
(function () {
  'use strict';

  var KEY = 'daveNotes.v1';
  var app = document.getElementById('app');

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function countWords(t) { return String(t || '').trim().split(/\s+/).filter(Boolean).length; }
  function fmtNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
        d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return iso; }
  }
  function fmtTime(s) {
    if (!isFinite(s)) return '--:--';
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function why(text) { return '<p class="why"><b>Why this helps</b>' + esc(text) + '</p>'; }
  function draftBadge(l) {
    return l && !l.verified ? '<span class="badge draft" title="This lecture has not been checked by the teacher yet">Draft content</span>' : '';
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
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch (e) { this.ok = false; return false; }
    },
    clear: function () {
      this.data = { sessions: [], lastGoal: '' };
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }
  };

  /* ---------------- storage: photos (IndexedDB, with in-memory fallback) ---------------- */
  var Photos = {
    mem: {}, _p: null,
    open: function () {
      if (this._p) return this._p;
      this._p = new Promise(function (res) {
        try {
          var r = indexedDB.open('daveNotes', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('photos'); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { res(null); };
          r.onblocked = function () { res(null); };
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

  /* Make photos smaller before saving (max 1600px, JPEG). */
  function shrinkImage(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, 1600 / Math.max(w, h));
        w = Math.round(w * s); h = Math.round(h * s);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        try {
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          c.toBlob(function (b) { URL.revokeObjectURL(url); res(b || file); }, 'image/jpeg', 0.75);
        } catch (e) { URL.revokeObjectURL(url); res(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }

  /* ---------------- lectures (JSON files) ---------------- */
  var LECTURES = [], lecturesError = '';
  function normLecture(l) {
    l.keyTerms = l.keyTerms || [];
    l.keyIdeas = (l.keyIdeas || []).map(function (k) {
      return { text: k.text, type: k.type === 'main' ? 'main' : 'detail', segment: Math.max(1, Math.min(l.segments.length, Number(k.segment) || 1)) };
    });
    l.signpostPhrases = l.signpostPhrases || [];
    l.modelNotes = l.modelNotes || [];
    l.questions = l.questions || [];
    l.verified = l.verified === true;
    l.level = l.level || 'B2';
    l.topic = l.topic || '';
    l.words = countWords(l.segments.map(function (s) { return s.text; }).join(' '));
    l.minutes = Math.max(1, Math.round(l.words / 145));
    return l;
  }
  function loadLectures() {
    return fetch('lectures/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('index'); return r.json(); })
      .then(function (idx) {
        return Promise.all((idx.lectures || []).map(function (f) {
          return fetch('lectures/' + encodeURIComponent(f), { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(f); return r.json(); })
            .catch(function () { return null; });
        }));
      })
      .then(function (list) {
        LECTURES = list.filter(function (l) { return l && l.id && Array.isArray(l.segments) && l.segments.length; }).map(normLecture);
        if (!LECTURES.length) lecturesError = 'No lectures could be loaded.';
      })
      .catch(function () {
        lecturesError = 'The lectures could not be loaded. Check your internet connection and reload the page. (If you opened the file straight from a computer folder, open the app from its web address instead.)';
      });
  }

  /* ---------------- skill tips (rotate each session) ---------------- */
  var TIPS = [
    {
      id: 'signpost', name: 'Signposting language', title: 'Listen for signposts',
      intro: 'Lecturers use signpost phrases to show where the talk is going. A signpost tells you: a new point is coming. Signposts are not the content, but they show you where to put it.',
      examples: [['Topic', '“Today I’m going to talk about…”'], ['Order', '“First… Second… Finally…”'], ['Adding', '“Another problem is…”'], ['Contrast', '“However… On the other hand…”'], ['Example', '“For example… Let me give you an example…”'], ['Important', '“The key point is…”'], ['Summary', '“To sum up… Let’s recap…”']],
      tryit: 'When you hear “first”, “another” or “however”, start a new line in your notes.'
    },
    {
      id: 'abbrev', name: 'Abbreviations and symbols', title: 'Write less, catch more',
      intro: 'You can’t write every word, and you don’t need to. Use short forms and symbols so you can keep listening while you write.',
      examples: [['→', 'leads to, causes'], ['↑  ↓', 'increase, decrease'], ['=  ≠', 'is, means  /  is not'], ['+', 'and, also'], ['e.g.', 'for example'], ['b/c', 'because'], ['w/  w/o', 'with  /  without'], ['imp.', 'important'], ['ppl', 'people']],
      tryit: 'Make up your own short forms. Use your first language if it is faster. Just use the same ones every time.'
    },
    {
      id: 'mainidea', name: 'Main idea versus detail', title: 'Catch the main ideas first',
      intro: 'A main idea answers the question: “What is this part about?” Details are the examples, names, reasons and small facts that support it.',
      examples: [['Main idea', 'often comes after a signpost, and is often repeated or said again in other words'], ['Detail', 'examples, names, numbers, reasons'], ['Layout', 'main ideas at the left, details moved in under them']],
      tryit: 'If you miss a detail, let it go. Listen for the next main idea.'
    },
    {
      id: 'organise', name: 'Organising notes', title: 'Make notes you can use later',
      intro: 'Any layout is fine: lists, mind maps, columns, boxes or arrows. What matters is that you can find the ideas again later.',
      examples: [['Headings', 'one heading for each part of the talk'], ['Numbers', 'number the main points: 1, 2, 3'], ['Indent', 'put details under their main idea'], ['Space', 'leave gaps so you can add things later']],
      sample: 'WATER SHORTAGE\n1. Causes\n   - pop. ↑\n   - farming (most imp.)\n2. Effects\n   - health, food\n3. Solutions → ?',
      tryit: 'Leave space after each main idea. Fill it in if you listen a second time.'
    }
  ];
  function tipById(id) { return TIPS.filter(function (t) { return t.id === id; })[0] || TIPS[0]; }

  var YOURWAY = '<div class="notice"><p style="margin:0"><b>Your notes, your way.</b> Write in any language: English, your first language, or a mix. Use symbols, arrows and drawings. Short words are better than full sentences. There is no word count and no “right” layout.</p></div>';

  var STEPNAMES = { ready: 'Get ready', ownready: 'Get ready', skill: 'Skill focus', listen: 'Listen', photo: 'Photo', predict: 'Predict', check: 'Self-check', rate: 'Self-check', quiz: 'Use your notes', summary3: 'Use your notes', review: 'Review', reflect: 'Reflect' };
  var RATE_LABEL = { yes: 'Yes', partly: 'Partly', notyet: 'Not yet' };
  var CHECK_LABEL = { got: 'Got it', partly: 'Partly', missed: 'Missed' };

  /* ---------------- speech synthesis ---------------- */
  var Speech = {
    supported: ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window),
    voice: null, anyVoices: false,
    pick: function () {
      if (!this.supported) return null;
      var vs = [];
      try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
      this.anyVoices = vs.length > 0;
      if (!vs.length) return null;
      function by(p) { return vs.filter(function (v) { return String(v.lang || '').replace('_', '-').toLowerCase().indexOf(p) === 0; }); }
      function best(a) {
        return a.filter(function (v) { return /natural|premium|enhanced|neural/i.test(v.name); })[0] ||
          a.filter(function (v) { return v.localService; })[0] || a[0];
      }
      var au = by('en-au'), gb = by('en-gb'), en = by('en');
      this.voice = au.length ? best(au) : gb.length ? best(gb) : en.length ? best(en) : null;
      return this.voice;
    },
    init: function () {
      var self = this;
      return new Promise(function (res) {
        if (!self.supported) return res(null);
        if (self.pick()) return res(self.voice);
        var done = false;
        function fin() { if (done) return; done = true; self.pick(); res(self.voice); }
        try { window.speechSynthesis.addEventListener('voiceschanged', fin, { once: true }); } catch (e) { window.speechSynthesis.onvoiceschanged = fin; }
        setTimeout(fin, 1500);
      });
    }
  };

  /* A lecture player. Uses the MP3 if the lecture has one, otherwise speaks
     the lecture sentence by sentence. No rewind: only play, pause and speed. */
  function makePlayer(lecture, hooks) {
    hooks = hooks || {};
    var segs = lecture.segments;
    var sentences = segs.map(function (s) {
      var parts = String(s.text).match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) || [s.text];
      return parts.map(function (x) { return x.trim(); }).filter(Boolean);
    });
    var P = {
      mode: lecture.audioFile ? 'file' : 'tts', rate: 1, playing: false, ended: false, started: false,
      seg: 0, sent: 0, only: null, token: 0, wd: null,
      canSeek: segs.every(function (s) { return typeof s.audioStart === 'number'; })
    };
    var audio = null;
    function emit() { if (hooks.onState) hooks.onState(P); }

    if (P.mode === 'file') {
      audio = new Audio();
      audio.preload = 'metadata';
      audio.src = 'audio/' + lecture.audioFile;
      audio.addEventListener('playing', function () { P.started = true; emit(); });
      audio.addEventListener('loadedmetadata', emit);
      audio.addEventListener('timeupdate', function () {
        if (P.only != null) {
          var next = segs[P.only + 1];
          if (next && typeof next.audioStart === 'number' && audio.currentTime >= next.audioStart) {
            audio.pause(); P.playing = false; P.only = null;
            if (hooks.onSegmentDone) hooks.onSegmentDone();
          }
        }
        emit();
      });
      audio.addEventListener('ended', function () {
        P.playing = false;
        if (P.only == null) { P.ended = true; if (hooks.onEnd) hooks.onEnd(); }
        else { P.only = null; if (hooks.onSegmentDone) hooks.onSegmentDone(); }
        emit();
      });
      audio.addEventListener('error', function () {
        if (P.mode !== 'file') return;
        P.mode = 'tts'; P.playing = false; P.canSeek = false;
        if (hooks.onNotice) hooks.onNotice('The recording could not be loaded, so the computer voice will read the lecture instead. Press Play.');
        emit();
      });
    }

    function finish() {
      clearTimeout(P.wd);
      P.playing = false;
      var wasOnly = P.only != null;
      P.only = null;
      if (wasOnly) { if (hooks.onSegmentDone) hooks.onSegmentDone(); }
      else { P.ended = true; P.seg = 0; P.sent = 0; if (hooks.onEnd) hooks.onEnd(); }
      emit();
    }
    function advance() {
      P.sent++;
      if (P.sent >= sentences[P.seg].length) { P.sent = 0; P.seg++; }
    }
    function speakCurrent() {
      var my = ++P.token;
      if (P.seg >= segs.length || (P.only != null && P.seg !== P.only)) { finish(); return; }
      var u = new SpeechSynthesisUtterance(sentences[P.seg][P.sent]);
      if (Speech.voice) { u.voice = Speech.voice; u.lang = Speech.voice.lang; } else { u.lang = 'en-GB'; }
      u.rate = P.rate;
      var started = false;
      u.onstart = function () { started = true; P.started = true; clearTimeout(P.wd); emit(); };
      u.onend = function () {
        if (my !== P.token || !P.playing) return;
        advance(); speakCurrent();
      };
      u.onerror = function (e) {
        if (my !== P.token) return;
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
        clearTimeout(P.wd); P.playing = false;
        if (hooks.onError) hooks.onError(e && e.error); emit();
      };
      try { window.speechSynthesis.speak(u); } catch (e) { P.playing = false; if (hooks.onError) hooks.onError('speak'); emit(); return; }
      if (!P.started) {
        clearTimeout(P.wd);
        P.wd = setTimeout(function () {
          if (my === P.token && !started && P.playing) {
            try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
            P.playing = false; P.token++;
            if (hooks.onError) hooks.onError('no-start'); emit();
          }
        }, 6000);
      }
      emit();
    }

    P.play = function () {
      if (P.playing) return;
      P.playing = true;
      if (P.mode === 'file') {
        if (P.ended) { audio.currentTime = 0; P.ended = false; }
        audio.playbackRate = P.rate;
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () { P.playing = false; emit(); if (hooks.onNotice) hooks.onNotice('The audio did not start. Tap Play again.'); });
      } else {
        if (!Speech.supported) { P.playing = false; if (hooks.onError) hooks.onError('unsupported'); emit(); return; }
        if (P.ended) { P.ended = false; P.seg = 0; P.sent = 0; }
        speakCurrent(); // called inside the tap: needed for iPhone and iPad
      }
      emit();
    };
    P.pause = function () {
      P.playing = false; P.token++; clearTimeout(P.wd);
      if (audio) audio.pause();
      if (P.mode === 'tts' && Speech.supported) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
      emit();
    };
    P.setRate = function (r) {
      P.rate = r;
      if (P.mode === 'file') { if (audio) audio.playbackRate = r; }
      else if (P.playing) {
        P.token++;
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        setTimeout(function () { if (P.playing) speakCurrent(); }, 80);
      }
      emit();
    };
    P.restart = function () {
      P.pause(); P.ended = false; P.seg = 0; P.sent = 0;
      if (audio) { try { audio.currentTime = 0; } catch (e) { /* ignore */ } }
      emit();
    };
    P.playSegment = function (i) {
      P.pause();
      P.only = i;
      if (P.mode === 'file' && P.canSeek) {
        audio.currentTime = segs[i].audioStart;
        audio.playbackRate = P.rate;
        P.playing = true;
        var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { P.playing = false; emit(); });
      } else {
        if (!Speech.supported) { P.only = null; if (hooks.onError) hooks.onError('unsupported'); return; }
        P.mode = 'tts'; // replays of parts use the voice when the MP3 has no start times
        P.seg = i; P.sent = 0; P.playing = true;
        speakCurrent();
      }
      emit();
    };
    P.stop = function () { P.pause(); P.only = null; };
    P.progress = function () {
      if (P.mode === 'file' && audio && audio.duration) return audio.currentTime / audio.duration;
      if (P.ended) return 1;
      var total = 0, done = 0;
      sentences.forEach(function (a, i) { total += a.length; if (i < P.seg) done += a.length; else if (i === P.seg) done += P.sent; });
      return total ? done / total : 0;
    };
    P.statusText = function () {
      var state = P.playing ? 'Playing' : P.ended ? 'Finished' : P.started ? 'Paused' : 'Ready';
      if (P.ended) return 'Finished';
      if (P.mode === 'file' && audio) return state + ' · ' + fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration);
      return state + ' · part ' + Math.min(P.seg + 1, segs.length) + ' of ' + segs.length;
    };
    P.current = function () { return P.only; };
    return P;
  }

  /* ---------------- session state ---------------- */
  var S = null;       // the session in progress
  var player = null;  // current lecture player

  function newSession(kind, lecture) {
    var d = Store.load();
    return {
      id: 's' + Date.now(), date: new Date().toISOString(), kind: kind,
      lecture: lecture || null, lectureId: lecture ? lecture.id : '', title: lecture ? lecture.title : 'My own recording',
      verified: lecture ? lecture.verified : null,
      skill: TIPS[d.sessions.length % TIPS.length].id,
      expect: '', notesMode: null, notes: '', photos: [], photoURLs: [],
      listens: 0, firstDone: false, speed: 1,
      predicted: null, checks: [], ci: 0, organised: null, abbrev: null,
      quiz: [], qi: 0, reflection: '', goal: '',
      own: { topic: '', expect: '', fileName: '', ratings: {}, summary: ['', '', ''] },
      step: kind === 'lecture' ? 'ready' : 'ownready', done: false
    };
  }
  function flow() {
    var a = S.kind === 'lecture'
      ? ['ready', 'skill', 'listen', 'photo', 'predict', 'check', 'quiz', 'review', 'reflect']
      : ['ownready', 'skill', 'listen', 'photo', 'rate', 'summary3', 'reflect'];
    return a.filter(function (s) { return s !== 'photo' || S.notesMode !== 'type'; });
  }
  function go(step) { S.step = step; setGuard(true); SCREENS[step](); }
  function nextStep() { var f = flow(); go(f[f.indexOf(S.step) + 1]); }
  function prevStep() { var f = flow(); var i = f.indexOf(S.step); if (i > 0) go(f[i - 1]); else homeScreen(); }

  function setGuard(on) {
    window.onbeforeunload = on ? function (e) { e.preventDefault(); e.returnValue = ''; return ''; } : null;
  }
  function sessionActive() { return S && !S.done; }

  function stopAudio() {
    if (player) { try { player.stop(); } catch (e) { /* ignore */ } player = null; }
    $$('audio', app).forEach(function (a) { try { a.pause(); } catch (e) { /* ignore */ } });
    if (Speech.supported) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  }

  function render(html) {
    stopAudio();
    app.innerHTML = html;
    window.scrollTo(0, 0);
    var h = $('h1, h2', app);
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }

  function band(title, sub, extra) {
    var line = '';
    if (S && !S.done && flow().indexOf(S.step) > -1) {
      var f = flow(), i = f.indexOf(S.step);
      line = '<div class="stepline"><span class="label">Step ' + (i + 1) + ' of ' + f.length + ' · ' + esc(STEPNAMES[S.step]) + '</span>' +
        '<span class="label" style="color:#fff">' + esc(S.title) + '</span>' + (S.lecture ? draftBadge(S.lecture) : '') + '</div>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + Math.round((i + 1) / f.length * 100) + '%"></i></div>';
    }
    return '<div class="band"><div class="wrap">' + line + '<h2>' + title + '</h2>' + (sub ? '<p style="margin:0">' + sub + '</p>' : '') + (extra || '') + '</div></div>';
  }
  function navActions(o) {
    return '<div class="nav-actions">' +
      (o.back ? '<button type="button" class="btn dark" data-act="back"><span aria-hidden="true">←</span> ' + esc(o.back) + '</button>' : '') +
      (o.extra || '') +
      (o.next ? '<button type="button" class="btn big" data-act="next"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.next) + ' <span aria-hidden="true">→</span></button>' : '') +
      '</div>';
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

  /* ---------------- notes panel (typed notes or photos) ---------------- */
  function notesPanel() {
    if (S.notesMode === 'type') {
      return '<details class="card notespanel" open><summary>Your notes</summary><div class="notesview" tabindex="0" role="region" aria-label="Your notes">' +
        (S.notes.trim() ? esc(S.notes) : '<span class="muted">You did not type any notes.</span>') + '</div></details>';
    }
    if (S.photoURLs.length) {
      return '<details class="card notespanel" open><summary>Your notes (photo)</summary><div class="photos">' +
        S.photoURLs.map(function (u, i) {
          return '<button type="button" data-zoom="' + i + '" aria-label="Photo ' + (i + 1) + ' of your notes. Tap to zoom."><img src="' + u + '" alt="Photo ' + (i + 1) + ' of your notes"></button>';
        }).join('') + '</div><p class="small muted" style="margin:8px 0 0">Tap a photo to zoom.</p></details>';
    }
    return '<div class="card notespanel"><p style="margin:0"><b>Look at your paper notes now.</b> Keep them in front of you.</p></div>';
  }
  function bindZoom(root) {
    $$('[data-zoom]', root).forEach(function (b) {
      b.addEventListener('click', function () { openZoom(S.photoURLs[Number(b.dataset.zoom)]); });
    });
  }
  var zoomEl = document.getElementById('zoom');
  function openZoom(url) {
    if (!url) return;
    $('#zoomImg').src = url;
    zoomEl.classList.remove('big');
    $('#zoomToggle').textContent = 'Zoom in';
    if (zoomEl.showModal) zoomEl.showModal(); else window.open(url, '_blank');
  }
  $('#zoomClose').addEventListener('click', function () { zoomEl.close(); });
  $('#zoomToggle').addEventListener('click', function () {
    var big = zoomEl.classList.toggle('big');
    this.textContent = big ? 'Zoom out' : 'Zoom in';
  });

  /* ---------------- HOME ---------------- */
  function homeScreen() {
    S = null; setGuard(false);
    var d = Store.load();
    var tip = TIPS[d.sessions.length % TIPS.length];
    var html = '<div class="band"><div class="wrap">' +
      '<span class="label" style="color:#ffff00">Lecture note-taking trainer</span>' +
      '<h1>Practise taking notes in lectures</h1>' +
      '<p>Listen to a short lecture. Take notes your way. Then check your own notes and use them to answer questions. One session takes 10 to 15 minutes.</p>' +
      (d.lastGoal ? '<div class="goalbox" style="margin-top:14px"><span class="label">Your goal from last time</span>' + esc(d.lastGoal) + '</div>' : '') +
      '<p class="label" style="margin:16px 0 0;color:#ffff00">Today’s skill: ' + esc(tip.name) + '</p>' +
      '</div></div>' +
      '<div class="wrap section stack">' +
      (!Store.ok ? '<p class="notice warn">This browser is not letting the app save. You can still practise, but your progress will not be kept when you close the page.</p>' : '') +
      YOURWAY +
      '<h2 style="margin-top:24px">Choose a lecture</h2>' +
      (lecturesError ? '<p class="notice warn">' + esc(lecturesError) + '</p>' : '') +
      '<div class="lectures">' + LECTURES.map(function (l) {
        return '<article class="card lec"><div class="badges"><span class="badge">' + esc(l.topic) + '</span>' + draftBadge(l) + '</div>' +
          '<h3>' + esc(l.title) + '</h3>' +
          '<p class="meta">About ' + l.minutes + ' min · Level ' + esc(l.level) + ' · ' + (l.audioFile ? 'Recorded audio' : 'Computer voice') + '</p>' +
          '<button type="button" class="btn block" data-lec="' + esc(l.id) + '">Start this lecture<span class="sr">: ' + esc(l.title) + '</span> <span aria-hidden="true">→</span></button></article>';
      }).join('') + '</div>' +
      '<h2 style="margin-top:28px">Or use your own recording</h2>' +
      '<div class="card stack"><p style="margin:0">Practise with any lecture or talk you have as an audio file. For example, a recording from class (only if you are allowed to record it).</p>' +
      '<div><label class="btn dark big filebtn"><span aria-hidden="true">🎧</span> Use my own recording<input type="file" id="ownFile" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.mp4"></label></div>' +
      '<p class="small muted" style="margin:0"><b>Your file stays on this device. It is never uploaded.</b></p></div>' +
      '<div class="btnrow" style="margin-top:20px"><a class="btn light" href="#progress">See my progress</a><a class="btn light" href="about.html">About this app</a></div>' +
      '</div>';
    render(html);
    $$('[data-lec]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        var l = LECTURES.filter(function (x) { return x.id === b.dataset.lec; })[0];
        S = newSession('lecture', l); go('ready');
      });
    });
    $('#ownFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      S = newSession('own');
      S.ownURL = URL.createObjectURL(f);
      S.own.fileName = f.name;
      go('ownready');
    });
  }

  var SCREENS = {};

  /* ---------------- 2. GET READY (lecture) ---------------- */
  SCREENS.ready = function () {
    var l = S.lecture;
    render(band('Get ready', 'Good listeners think about the topic and the key words before a lecture starts.') +
      '<div class="wrap section stack">' +
      '<div class="card"><div class="badges"><span class="badge">' + esc(l.topic) + '</span><span class="badge">About ' + l.minutes + ' min</span><span class="badge">Level ' + esc(l.level) + '</span>' + draftBadge(l) + '</div>' +
      '<h3 style="font-size:1.5rem;margin:0">' + esc(l.title) + '</h3></div>' +
      '<div class="card"><h3>Key words you will hear</h3><dl class="terms">' + l.keyTerms.map(function (t) {
        return '<div><dt>' + esc(t.term) + '</dt><dd>' + esc(t.definition) + '</dd></div>';
      }).join('') + '</dl></div>' +
      '<div class="card"><label class="q" for="expect">What do you expect the lecturer to say?</label>' +
      '<p class="hint" id="expectHint">' + esc(l.predictionQuestion) + ' Write a few words in any language.</p>' +
      '<textarea id="expect" aria-describedby="expectHint">' + esc(S.expect) + '</textarea></div>' +
      why('Knowing the key words and guessing the content first means your brain has less to do while you listen.') +
      navActions({ back: 'Lectures', next: 'Next: today’s skill' }) + '</div>');
    $('#expect').addEventListener('input', function () { S.expect = this.value; });
    bindNav();
  };

  /* ---------------- 2b. GET READY (own recording) ---------------- */
  SCREENS.ownready = function () {
    render(band('Get ready', 'Think about the talk before you listen.') +
      '<div class="wrap section stack">' +
      '<div class="card"><p class="small muted" style="margin:0 0 12px">Your file: <b>' + esc(S.own.fileName) + '</b> (on this device only)</p>' +
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

  /* ---------------- 3. SKILL FOCUS ---------------- */
  SCREENS.skill = function () {
    var t = tipById(S.skill);
    render(band('Today’s skill: ' + esc(t.name), 'A one-minute tip. Read it, then try it while you listen.') +
      '<div class="wrap section stack"><div class="card">' +
      '<h3>' + esc(t.title) + '</h3><p>' + esc(t.intro) + '</p>' +
      '<div class="tipex">' + t.examples.map(function (e) { return '<div><b>' + esc(e[0]) + '</b><span>' + esc(e[1]) + '</span></div>'; }).join('') + '</div>' +
      (t.sample ? '<p class="label" style="margin-top:12px">Example notes</p><pre class="notesview mono" style="margin:0 0 12px">' + esc(t.sample) + '</pre>' : '') +
      '<p class="goalbox" style="margin:12px 0 0"><span class="label">Try this today</span>' + esc(t.tryit) + '</p>' +
      '</div>' +
      why('Practising one skill at a time, with clear examples, helps you improve faster than just “taking notes”.') +
      navActions({ back: 'Back', next: 'I’m ready to listen' }) + '</div>');
    bindNav();
  };

  /* ---------------- 4. LISTEN AND TAKE NOTES ---------------- */
  function voiceErrorHTML() {
    return '<div class="notice warn" style="margin-top:10px"><p><b>The computer voice is not working on this device.</b></p>' +
      '<ul style="margin:0 0 10px;padding-left:20px"><li>Check your volume. On iPhone or iPad, turn off silent mode.</li>' +
      '<li>Try another browser, such as Chrome, Edge or Safari.</li>' +
      '<li>Or go back to the home page and choose “Use my own recording”.</li></ul>' +
      '<button type="button" class="btn sm dark" id="retryVoice">Try again</button></div>';
  }

  SCREENS.listen = function () {
    var isOwn = S.kind === 'own';
    if (!S.notesMode) {
      render(band('Listen and take notes', 'First, choose how you will take notes today.') +
        '<div class="wrap section stack">' + YOURWAY +
        '<div class="card stack"><h3 style="margin:0">How will you take notes?</h3>' +
        '<div class="btnrow"><button type="button" class="btn big" data-mode="type"><span aria-hidden="true">⌨️</span> I’ll type here</button>' +
        '<button type="button" class="btn big dark" data-mode="paper"><span aria-hidden="true">✍️</span> I’m using paper</button></div>' +
        '<p class="small muted" style="margin:0">Paper is great for arrows, boxes and drawings. After listening, you can take a photo of your notes. The photo stays on this device.</p></div>' +
        navActions({ back: 'Back' }) + '</div>');
      $$('[data-mode]', app).forEach(function (b) {
        b.addEventListener('click', function () { S.notesMode = b.dataset.mode; SCREENS.listen(); });
      });
      bindNav();
      return;
    }

    var playerHTML;
    if (isOwn) {
      playerHTML = '<div class="player"><p class="label" style="color:#ffff00;margin:0">Your recording</p>' +
        '<audio controls preload="metadata" src="' + S.ownURL + '" aria-label="Your recording"></audio>' +
        '<p class="small" style="margin:8px 0 0">Your recording plays on this device only. It is never uploaded.</p></div>';
    } else {
      playerHTML = '<div class="player" id="player">' +
        '<p class="label" style="color:#ffff00;margin:0 0 8px" id="listenLabel">' + (S.listens >= 2 ? 'Second listen (optional)' : 'First listen') + '</p>' +
        '<div class="btnrow"><button type="button" class="btn big" id="pp">▶ Play</button>' +
        '<div class="speed" role="group" aria-label="Speed"><span class="label">Speed</span>' +
        '<button type="button" class="btn sm dark" data-rate="0.85" aria-pressed="' + (S.speed === 0.85) + '">0.85×</button>' +
        '<button type="button" class="btn sm dark" data-rate="1" aria-pressed="' + (S.speed === 1) + '">1×</button></div></div>' +
        '<div class="bar" role="progressbar" aria-label="How much of the lecture you have heard" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="pfill"></i></div>' +
        '<p class="stat" id="pstat" style="margin:4px 0 6px">Ready</p>' +
        '<p class="small" style="margin:0" id="pnote">' + (S.lecture.audioFile ? '' : 'A computer voice reads the lecture. ') + 'There is no rewind, just like a real lecture.</p>' +
        '<p class="sr" role="status" id="plive"></p>' +
        '<div id="pmsg"></div>' +
        '<div id="again" hidden style="margin-top:12px"><p style="margin:0 0 8px">Finished. You can listen once more to fill gaps in your notes. This is optional.</p>' +
        '<button type="button" class="btn" id="againBtn">↻ Listen again (optional)</button></div>' +
        '</div>';
    }

    var notesHTML = S.notesMode === 'type'
      ? '<div><label class="q" for="notes">Your notes</label>' +
        '<textarea id="notes" class="notes" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">' + esc(S.notes) + '</textarea></div>'
      : '<div class="card"><h3>Write on your paper now</h3><p style="margin:0">When you finish, you can take a photo of your notes on the next screen.</p></div>';

    render(band('Listen and take notes', isOwn ? 'Play your recording and take notes while you listen.' : 'Press Play and take notes while you listen. You will see the words of the lecture later, not now.') +
      '<div class="wrap section stack">' + playerHTML +
      '<p class="small muted" style="margin:8px 0 0">Any language, symbols, arrows and drawings are fine. Key words, not full sentences.</p>' +
      notesHTML +
      '<p style="margin:0"><button type="button" class="linkbtn small" id="switchMode">' + (S.notesMode === 'type' ? 'Switch to paper notes' : 'Switch to typing') + '</button></p>' +
      why('Short notes with symbols let you keep listening while you write. Lecturers don’t wait!') +
      navActions({ back: 'Back', next: 'I’ve finished my notes' }) + '</div>');

    if (S.notesMode === 'type') $('#notes').addEventListener('input', function () { S.notes = this.value; });
    $('#switchMode').addEventListener('click', function () { S.notesMode = S.notesMode === 'type' ? 'paper' : 'type'; SCREENS.listen(); });
    bindNav(function () { nextStep(); }, function () { prevStep(); });

    if (isOwn) {
      var au = $('audio', app);
      au.addEventListener('play', function () { S.listens = Math.max(S.listens, 1); });
      au.addEventListener('ended', function () { S.ownPlays = (S.ownPlays || 0) + 1; });
      return;
    }

    var ui = { pp: $('#pp'), fill: $('#pfill'), bar: $('#player .bar'), stat: $('#pstat'), msg: $('#pmsg'), again: $('#again'), label: $('#listenLabel'), live: $('#plive') };
    player = makePlayer(S.lecture, {
      onState: function (P) {
        ui.pp.textContent = P.playing ? '❚❚ Pause' : '▶ Play';
        var pct = Math.round(P.progress() * 100);
        ui.fill.style.width = pct + '%';
        ui.bar.setAttribute('aria-valuenow', String(pct));
        ui.stat.textContent = P.statusText();
        $$('[data-rate]', app).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === P.rate)); });
      },
      onEnd: function () {
        S.firstDone = true;
        ui.live.textContent = 'The lecture has finished.';
        if (S.listens < 2) ui.again.hidden = false;
        else ui.msg.innerHTML = '<p style="margin:10px 0 0">You have finished your second listen.</p>';
      },
      onError: function () {
        ui.msg.innerHTML = voiceErrorHTML();
        $('#retryVoice').addEventListener('click', function () { ui.msg.innerHTML = ''; player.play(); });
      },
      onNotice: function (t) { ui.msg.innerHTML = '<p class="notice warn" style="margin-top:10px">' + esc(t) + '</p>'; }
    });
    var thisPlayer = player;
    player.rate = S.speed;
    ui.stat.textContent = player.statusText();
    if (S.firstDone && S.listens < 2) ui.again.hidden = false;

    if (!S.lecture.audioFile) {
      if (!Speech.supported) {
        ui.msg.innerHTML = voiceErrorHTML();
        $('#retryVoice').addEventListener('click', function () { location.reload(); });
      } else {
        Speech.init().then(function () {
          if (player !== thisPlayer) return;
          if (!Speech.voice && Speech.anyVoices) ui.msg.innerHTML = '<p class="notice" style="margin-top:10px;color:var(--text)">No English voice was found on this device, so the voice may sound unusual.</p>';
        });
      }
    }

    ui.pp.addEventListener('click', function () {
      if (player.playing) { player.pause(); ui.live.textContent = 'Paused'; }
      else { S.listens = Math.max(S.listens, 1); player.play(); ui.live.textContent = 'Playing'; }
    });
    $$('[data-rate]', app).forEach(function (b) {
      b.addEventListener('click', function () { S.speed = Number(b.dataset.rate); player.setRate(S.speed); });
    });
    $('#againBtn').addEventListener('click', function () {
      S.listens = 2; ui.again.hidden = true; ui.label.textContent = 'Second listen (optional)';
      player.restart(); player.play(); ui.live.textContent = 'Playing the second listen';
    });
  };

  /* ---------------- 5. PHOTO OF PAPER NOTES ---------------- */
  SCREENS.photo = function () {
    render(band('Add a photo of your notes', 'This is optional. A photo lets you see your notes beside the checklist.') +
      '<div class="wrap section stack"><div class="card stack">' +
      '<div class="btnrow"><label class="btn big filebtn"><span aria-hidden="true">📷</span> Take a photo of your notes<input type="file" id="camIn" accept="image/*" capture="environment"></label>' +
      '<label class="btn big dark filebtn"><span aria-hidden="true">🖼️</span> Choose photos<input type="file" id="pickIn" accept="image/*" multiple></label></div>' +
      '<p class="small muted" style="margin:0"><b>Your photos stay on this device. They are never uploaded.</b> You can add several pages. The app does not read your handwriting: the photo is only for you to look at.</p>' +
      '<p id="photoMsg" role="status" style="margin:0"></p>' +
      '<div class="thumbs" id="thumbs"></div></div>' +
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
          S.photos.splice(i, 1); S.photoURLs.splice(i, 1); draw();
          msg.textContent = 'Page removed.';
        });
      });
      nextBtn.hidden = !S.photos.length;
      skipBtn.hidden = !!S.photos.length;
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
    bindNav();
    draw();
  };

  /* ---------------- 6. PREDICT ---------------- */
  SCREENS.predict = function () {
    var n = S.lecture.keyIdeas.length, nums = '';
    for (var i = 0; i <= n; i++) {
      nums += '<label><input type="radio" name="pred" value="' + i + '"' + (S.predicted === i ? ' checked' : '') + '><span>' + i + '</span></label>';
    }
    render(band('Before you check', 'Look at your notes for a moment. Then make a guess.') +
      '<div class="wrap section stack"><div class="card"><fieldset><legend class="q">How many of the ' + n + ' key ideas do you think you captured?</legend>' +
      '<p class="hint">Just guess. There is no wrong answer.</p><div class="nums">' + nums + '</div></fieldset></div>' +
      why('Guessing first and then checking trains you to judge your own learning. Good learners do this all the time.') +
      navActions({ back: 'Back', next: 'Start checking', disabled: S.predicted == null }) + '</div>');
    $$('input[name=pred]', app).forEach(function (r) {
      r.addEventListener('change', function () { S.predicted = Number(r.value); $('[data-act="next"]', app).disabled = false; });
    });
    bindNav(function () { S.ci = 0; nextStep(); });
  };

  /* ---------------- 7. SELF-CHECK ---------------- */
  SCREENS.check = function () {
    var n = S.lecture.keyIdeas.length;
    render(band('Check your notes', 'Look at your notes, not your memory. Is each key idea there?', '<div class="dots" id="dots" aria-hidden="true"></div>') +
      '<div class="wrap wide section"><div class="split"><div class="stack" id="checkMain"></div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Checking your notes against the key ideas shows you what you catch and what you miss. That tells you what to practise.') + '</div></div>');
    bindZoom(app);
    var main = $('#checkMain');

    function dots() {
      var h = '';
      for (var i = 0; i < n; i++) h += '<i class="' + (S.checks[i] ? 'done' : '') + (i === S.ci ? ' now' : '') + '"></i>';
      $('#dots').innerHTML = h;
    }
    function showIdea() {
      dots();
      if (S.ci >= n) return showRatings();
      var k = S.lecture.keyIdeas[S.ci];
      main.innerHTML = '<div class="card"><h3 tabindex="-1" id="ideaH" class="label" style="font-size:.9rem">Key idea ' + (S.ci + 1) + ' of ' + n + '</h3>' +
        '<div class="badges"><span class="badge ' + k.type + '">' + (k.type === 'main' ? 'Main idea' : 'Supporting detail') + '</span></div>' +
        '<p class="idea">' + esc(k.text) + '</p>' +
        '<fieldset><legend class="q">Is this in your notes?</legend>' + choiceGroup('check', S.checks[S.ci], 'check') + '</fieldset>' +
        '<p class="small muted" style="margin:12px 0 0">“Got it” means the idea is in your notes in any form: a word, a symbol, a drawing or another language.</p></div>' +
        (S.ci > 0 ? '<div><button type="button" class="btn dark" id="prevIdea">← Previous idea</button></div>' : '');
      $$('.choices button', main).forEach(function (b) {
        b.addEventListener('click', function () { S.checks[S.ci] = b.dataset.v; S.ci++; showIdea(); focusIdea(); });
      });
      var p = $('#prevIdea'); if (p) p.addEventListener('click', function () { S.ci--; showIdea(); focusIdea(); });
    }
    function focusIdea() { var h = $('#ideaH') || $('#rateH'); if (h) h.focus({ preventScroll: false }); }
    function showRatings() {
      main.innerHTML = '<div class="card stack"><h3 tabindex="-1" id="rateH">Two quick questions about your notes</h3>' +
        '<fieldset><legend class="q">My notes are organised.</legend><p class="hint">For example: headings, main ideas easy to find, details under them.</p>' + choiceGroup('organised', S.organised) + '</fieldset>' +
        '<fieldset><legend class="q">I used abbreviations or symbols.</legend><p class="hint">For example: → ↑ = e.g. b/c</p>' + choiceGroup('abbrev', S.abbrev) + '</fieldset></div>' +
        '<div class="nav-actions" style="margin-top:0"><button type="button" class="btn dark" id="prevIdea">← Previous idea</button>' +
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
      $('#prevIdea').addEventListener('click', function () { S.ci = n - 1; showIdea(); focusIdea(); });
      $('#toQuiz').addEventListener('click', function () { S.qi = 0; nextStep(); });
    }
    showIdea();
  };

  /* ---------------- 8. USE YOUR NOTES (quiz) ---------------- */
  function answerIndex(q) {
    var i = q.options.indexOf(q.answer);
    if (i < 0 && typeof q.answer === 'number') i = q.answer - 1;
    return i;
  }
  SCREENS.quiz = function () {
    var qs = S.lecture.questions;
    if (!qs.length) { nextStep(); return; }
    render(band('Use your notes', 'Answer from your notes only. Try not to use your memory.') +
      '<div class="wrap wide section"><div class="split"><div class="stack" id="quizMain"></div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Using your notes later is the second way notes help you learn. It also shows you what good notes need to include.') + '</div></div>');
    bindZoom(app);
    var main = $('#quizMain');
    function show() {
      var q = qs[S.qi], ans = answerIndex(q), chosen = S.quiz[S.qi];
      var answered = chosen != null;
      main.innerHTML = '<div class="card"><p class="label" style="margin:0 0 6px">Question ' + (S.qi + 1) + ' of ' + qs.length + '</p>' +
        '<h3 tabindex="-1" id="qh">' + esc(q.stem) + '</h3>' +
        '<div class="opts" role="group" aria-labelledby="qh">' + q.options.map(function (o, i) {
          var cls = answered ? (i === ans ? ' right' : (i === chosen ? ' wrong' : '')) : '';
          var mk = answered ? (i === ans ? '✓' : (i === chosen ? '✗' : 'ABCDEF'[i])) : 'ABCDEF'[i];
          return '<button type="button" class="btn opt' + cls + '" data-o="' + i + '"' + (answered ? ' disabled aria-disabled="true"' : '') + '><span class="mk" aria-hidden="true">' + mk + '</span><span>' + esc(o) + (answered && i === ans ? '<span class="sr"> (correct answer)</span>' : '') + (answered && i === chosen && i !== ans ? '<span class="sr"> (your answer)</span>' : '') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="feedback" id="fb" role="status">' + (answered ? feedback(q, chosen === ans) : '') + '</div></div>' +
        (answered ? '<div class="btnrow end"><button type="button" class="btn big" id="nextQ">' + (S.qi < qs.length - 1 ? 'Next question →' : 'Next: review the lecture →') + '</button></div>' : '');
      $$('[data-o]', main).forEach(function (b) {
        b.addEventListener('click', function () { S.quiz[S.qi] = Number(b.dataset.o); show(); var nb = $('#nextQ'); if (nb) nb.focus(); });
      });
      var nb = $('#nextQ');
      if (nb) nb.addEventListener('click', function () {
        if (S.qi < qs.length - 1) { S.qi++; show(); $('#qh').focus(); } else nextStep();
      });
    }
    function feedback(q, ok) {
      return '<div class="notice"><p style="margin:0 0 4px"><b>' + (ok ? '✓ Yes, that’s right.' : '✗ Not quite. The answer is: ' + esc(q.options[answerIndex(q)])) + '</b></p>' +
        '<p style="margin:0">' + esc(q.explanation || '') + '</p>' +
        (ok ? '' : '<p class="small muted" style="margin:6px 0 0">Was it in your notes? If not, that is useful to know for next time.</p>') + '</div>';
    }
    show();
  };

  /* ---------------- 9. REVIEW ---------------- */
  function highlight(text, phrases) {
    var ps = (phrases || []).filter(Boolean).slice().sort(function (a, b) { return b.length - a.length; });
    if (!ps.length) return esc(text);
    var re = new RegExp(ps.map(function (p) {
      return (/^\w/.test(p) ? '\\b' : '') + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/\w$/.test(p) ? '\\b' : '');
    }).join('|'), 'g');
    var out = '', last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
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
    if (inList) h += '</ul>';
    return h;
  }
  SCREENS.review = function () {
    var l = S.lecture;
    var missed = l.keyIdeas.map(function (k, i) { return { k: k, v: S.checks[i] }; }).filter(function (x) { return x.v === 'missed' || x.v === 'partly'; });
    render(band('Review the lecture', 'Now you can see the words of the lecture. The yellow phrases are signposts.') +
      '<div class="wrap section stack">' +
      '<div class="player" id="rplayer"><p style="margin:0 0 10px">Tap any ▶ button to hear that part of the lecture again.</p>' +
      '<div class="btnrow" style="margin:0"><button type="button" class="btn sm" id="rstop" disabled>■ Stop</button>' +
      '<div class="speed" role="group" aria-label="Speed"><span class="label">Speed</span>' +
      '<button type="button" class="btn sm dark" data-rate="0.85" aria-pressed="' + (S.speed === 0.85) + '">0.85×</button>' +
      '<button type="button" class="btn sm dark" data-rate="1" aria-pressed="' + (S.speed === 1) + '">1×</button></div></div>' +
      '<p class="stat" id="rstat" role="status" style="margin:8px 0 0"></p><div id="rmsg"></div></div>' +
      (missed.length
        ? '<div class="card"><h3>Ideas you missed or partly caught</h3><p class="hint">Tap an idea to hear that part of the lecture again. Listen for the signpost before it.</p>' +
          '<div class="opts">' + missed.map(function (x) {
            return '<button type="button" class="btn opt" data-seg="' + (x.k.segment - 1) + '"><span class="mk" aria-hidden="true">▶</span><span><span class="sr">Replay: </span>' + esc(x.k.text) + ' <span class="small muted">(' + CHECK_LABEL[x.v] + ', part ' + x.k.segment + ')</span></span></button>';
          }).join('') + '</div></div>'
        : '<div class="card"><h3>You found every key idea in your notes.</h3><p style="margin:0">Use the script below to notice the signposts the lecturer used.</p></div>') +
      '<div class="card script"><h3>The lecture script</h3><p class="hint">Signposts are highlighted. They show the structure of the talk.</p>' +
      l.segments.map(function (s, i) {
        return '<div class="seg"><span class="num" aria-hidden="true">' + (i + 1) + '</span><div><p>' + highlight(s.text, l.signpostPhrases) + '</p>' +
          '<button type="button" class="btn sm light" data-seg="' + i + '">▶ Play part ' + (i + 1) + '</button></div></div>';
      }).join('') + '</div>' +
      '<div class="card model"><h3>Model notes</h3><p class="hint">This is one way to take notes on this lecture. Your notes can look very different and still be good.</p>' +
      modelNotesHTML(l.modelNotes) + '</div>' +
      why('Seeing the signposts in the script helps you hear them next time. Replaying a missed part shows you why you missed it.') +
      navActions({ next: 'Next: reflect' }) + '</div>');
    var stat = $('#rstat'), stopB = $('#rstop');
    player = makePlayer(l, {
      onState: function (P) {
        stopB.disabled = !P.playing;
        if (P.playing) stat.textContent = 'Playing part ' + (P.mode === 'tts' ? P.seg + 1 : (P.current() != null ? P.current() + 1 : '')) + '…';
        $$('#rplayer [data-rate]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === P.rate)); });
      },
      onSegmentDone: function () { stat.textContent = 'Finished that part.'; },
      onEnd: function () { stat.textContent = 'Finished.'; },
      onError: function () { $('#rmsg').innerHTML = voiceErrorHTML(); $('#retryVoice').addEventListener('click', function () { $('#rmsg').innerHTML = ''; }); },
      onNotice: function (t) { $('#rmsg').innerHTML = '<p class="notice warn" style="margin-top:10px">' + esc(t) + '</p>'; }
    });
    player.rate = S.speed;
    if (!l.audioFile) Speech.init();
    $$('[data-seg]', app).forEach(function (b) {
      b.addEventListener('click', function () { player.playSegment(Number(b.dataset.seg)); });
    });
    stopB.addEventListener('click', function () { player.stop(); stat.textContent = 'Stopped.'; });
    $$('#rplayer [data-rate]').forEach(function (b) {
      b.addEventListener('click', function () { S.speed = Number(b.dataset.rate); player.setRate(S.speed); });
    });
    bindNav();
  };

  /* ---------------- OWN: SELF-RATE ---------------- */
  var RUBRIC = [
    ['main', 'My notes show the main ideas.', 'The big points the speaker made.'],
    ['details', 'I noted useful supporting details.', 'Examples, reasons, names or numbers that support the main ideas.'],
    ['organisation', 'My notes are organised.', 'Headings, numbers, details under main ideas.'],
    ['abbrev', 'I used abbreviations or symbols.', 'For example: → ↑ = e.g. b/c']
  ];
  SCREENS.rate = function () {
    render(band('Check your notes', 'There is no checklist for your own recording, so rate your notes yourself. Be honest: this is just for you.') +
      '<div class="wrap wide section"><div class="split"><div class="stack"><div class="card stack">' +
      RUBRIC.map(function (r) {
        return '<fieldset><legend class="q">' + esc(r[1]) + '</legend><p class="hint">' + esc(r[2]) + '</p>' + choiceGroup(r[0], S.own.ratings[r[0]]) + '</fieldset>';
      }).join('') + '</div>' + navActions({ back: 'Back', next: 'Next: use your notes', disabled: !rubricDone() }) + '</div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Rating your notes against clear points helps you see exactly what to improve.') + '</div></div>');
    bindZoom(app);
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
  function rubricDone() { return RUBRIC.every(function (r) { return S.own.ratings[r[0]]; }); }

  /* ---------------- OWN: THREE-SENTENCE SUMMARY ---------------- */
  var SUM_PROMPTS = ['Sentence 1: What was the talk about?', 'Sentence 2: What were the main points?', 'Sentence 3: What was the most important idea or conclusion?'];
  SCREENS.summary3 = function () {
    render(band('Use your notes', 'Write a three-sentence summary of the talk. Use your notes only, not your memory.') +
      '<div class="wrap wide section"><div class="split"><div class="stack"><div class="card stack">' +
      SUM_PROMPTS.map(function (p, i) {
        return '<div><label class="q" for="sum' + i + '">' + esc(p) + '</label><textarea id="sum' + i + '" data-i="' + i + '" style="min-height:90px">' + esc(S.own.summary[i]) + '</textarea></div>';
      }).join('') + '</div>' + navActions({ back: 'Back', next: 'Next: reflect' }) + '</div>' + notesPanel() + '</div>' +
      '<div class="wrap" style="padding:0">' + why('Writing a summary from your notes is the second way notes help you learn. It shows what your notes can do.') + '</div></div>');
    bindZoom(app);
    $$('textarea[data-i]', app).forEach(function (t) { t.addEventListener('input', function () { S.own.summary[Number(t.dataset.i)] = t.value; }); });
    bindNav();
  };

  /* ---------------- 10. REFLECT ---------------- */
  function scoreOf(v) { return v === 'got' ? 1 : v === 'partly' ? 0.5 : 0; }
  function lectureResults() {
    var l = S.lecture, r = { total: l.keyIdeas.length, got: 0, partly: 0, missed: 0, main: 0, mainT: 0, det: 0, detT: 0, q: 0, qT: l.questions.length };
    l.keyIdeas.forEach(function (k, i) {
      var v = S.checks[i] || 'missed';
      r[v === 'got' ? 'got' : v === 'partly' ? 'partly' : 'missed']++;
      if (k.type === 'main') { r.mainT++; r.main += scoreOf(v); } else { r.detT++; r.det += scoreOf(v); }
    });
    r.actual = r.got + r.partly * 0.5;
    l.questions.forEach(function (q, i) { if (S.quiz[i] === answerIndex(q)) r.q++; });
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
    if (S.kind === 'lecture') {
      var r = lectureResults();
      if (r.mainT && r.main / r.mainT < 0.8) out.push('Listen for signposts like “first”, “another” and “the key point is” to catch each main idea.');
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
    var top = '';
    if (S.kind === 'lecture') {
      var r = lectureResults();
      top = '<div class="stats">' +
        '<div class="stat-box"><span class="label">Your guess</span><span class="n">' + S.predicted + '/' + r.total + '</span></div>' +
        '<div class="stat-box"><span class="label">Your check</span><span class="n">' + fmtNum(r.actual) + '/' + r.total + '</span><span class="small">' + r.got + ' got it · ' + r.partly + ' partly · ' + r.missed + ' missed</span></div>' +
        '<div class="stat-box"><span class="label">Main ideas</span><span class="n">' + fmtNum(r.main) + '/' + r.mainT + '</span></div>' +
        '<div class="stat-box"><span class="label">Details</span><span class="n">' + fmtNum(r.det) + '/' + r.detT + '</span></div>' +
        (r.qT ? '<div class="stat-box"><span class="label">Questions from notes</span><span class="n">' + r.q + '/' + r.qT + '</span></div>' : '') +
        '</div>' +
        '<p class="notice">' + esc(calibrationMsg(S.predicted, r.actual)) + '</p>' +
        '<p class="notice">' + esc(balanceMsg(r)) + '</p>' +
        '<p class="small muted">“Partly” counts as half. These numbers come from your own check. The app does not mark your notes.</p>';
    } else {
      top = '<div class="card"><h3>How you rated your notes</h3><dl class="kv">' + RUBRIC.map(function (q) {
        return '<dt>' + esc(q[0] === 'abbrev' ? 'Symbols' : q[0] === 'organisation' ? 'Organised' : q[0] === 'main' ? 'Main ideas' : 'Details') + '</dt><dd>' + esc(RATE_LABEL[S.own.ratings[q[0]]] || '—') + '</dd>';
      }).join('') + '</dl></div>';
    }
    render(band('Reflect', S.kind === 'lecture' ? 'Compare your guess with your check. Then set one goal.' : 'Think about what went well. Then set one goal.') +
      '<div class="wrap section stack">' + top +
      '<div class="card"><label class="q" for="refl">What will you do differently next time?</label>' +
      '<textarea id="refl">' + esc(S.reflection) + '</textarea></div>' +
      '<div class="card"><label class="q" for="goal">My one goal for next time</label><p class="hint" id="goalHint">Write your own goal, or tap an idea below to use it.</p>' +
      '<input type="text" id="goal" maxlength="180" aria-describedby="goalHint" value="' + esc(S.goal) + '">' +
      '<div class="chips" style="margin-top:12px">' + goalIdeas().map(function (g) {
        return '<button type="button" class="btn sm light" data-goal="' + esc(g) + '">' + esc(g) + '</button>';
      }).join('') + '</div></div>' +
      why('Comparing your guess with your check, and setting one clear goal, makes your next practice more focused.') +
      '<p class="small muted" id="goalNeed" style="margin:12px 0 0">' + (S.goal.trim() ? '' : 'Set one goal to finish.') + '</p>' +
      navActions({ next: 'Save and see my summary', disabled: !S.goal.trim() }) + '</div>');
    var nextB = $('[data-act="next"]', app);
    function upd() { nextB.disabled = !S.goal.trim(); $('#goalNeed').textContent = S.goal.trim() ? '' : 'Set one goal to finish.'; }
    $('#refl').addEventListener('input', function () { S.reflection = this.value; });
    $('#goal').addEventListener('input', function () { S.goal = this.value; upd(); });
    $$('[data-goal]', app).forEach(function (b) {
      b.addEventListener('click', function () { S.goal = b.dataset.goal; $('#goal').value = S.goal; upd(); $('#goal').focus(); });
    });
    bindNav(saveSession);
  };

  function saveSession() {
    var rec = {
      id: S.id, date: S.date, kind: S.kind, lectureId: S.lectureId, title: S.title, verified: S.verified,
      skill: S.skill, expect: S.expect, notesMode: S.notesMode, notes: S.notes, photoCount: S.photos.length,
      listens: S.listens, speed: S.speed, reflection: S.reflection.trim(), goal: S.goal.trim()
    };
    if (S.kind === 'lecture') {
      var r = lectureResults();
      rec.predicted = S.predicted; rec.total = r.total; rec.got = r.got; rec.partly = r.partly; rec.missed = r.missed; rec.actual = r.actual;
      rec.main = r.main; rec.mainT = r.mainT; rec.det = r.det; rec.detT = r.detT; rec.q = r.q; rec.qT = r.qT;
      rec.checks = S.checks.slice(); rec.organised = S.organised; rec.abbrev = S.abbrev;
    } else {
      rec.own = { topic: S.own.topic.trim(), expect: S.own.expect, fileName: S.own.fileName, ratings: S.own.ratings, summary: S.own.summary.slice() };
    }
    var d = Store.load();
    d.sessions.push(rec);
    d.lastGoal = rec.goal;
    var saved = Store.save();
    var photoP = S.photos.length ? Photos.put(S.id, S.photos.slice()) : Promise.resolve(true);
    S.done = true; setGuard(false);
    var urls = S.photoURLs.slice();
    photoP.then(function (ok) { summaryScreen(rec, { justSaved: true, saved: saved, photosSaved: ok, urls: urls }); });
  }

  /* ---------------- SUMMARY (one session) ---------------- */
  function skillName(id) { return tipById(id).name; }
  function summaryText(r) {
    var L = [];
    L.push('DAVE Notes: session summary');
    L.push('Date: ' + fmtDate(r.date));
    if (r.kind === 'lecture') {
      L.push('Lecture: ' + r.title + (r.verified ? '' : ' (draft content)'));
    } else {
      L.push('My own recording' + (r.own && r.own.topic ? ': ' + r.own.topic : ''));
    }
    L.push('Skill focus: ' + skillName(r.skill));
    L.push('Notes: ' + (r.notesMode === 'type' ? 'typed' : 'on paper' + (r.photoCount ? ' (' + r.photoCount + ' photo' + (r.photoCount > 1 ? 's' : '') + ')' : '')));
    if (r.kind === 'lecture') {
      L.push('Listens: ' + (r.listens || 0) + ' (speed ' + r.speed + 'x)');
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
    if (r.notesMode === 'type' && r.notes.trim()) { L.push(''); L.push('My notes:'); L.push(r.notes); }
    return L.join('\n');
  }
  function summaryScreen(r, opts) {
    opts = opts || {};
    S = null;
    var rows = [];
    function row(k, v) { if (v !== '' && v != null) rows.push('<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'); }
    row('Date', esc(fmtDate(r.date)));
    if (r.kind === 'lecture') row('Lecture', esc(r.title) + (r.verified ? '' : ' <span class="badge draft">Draft content</span>'));
    else row('Recording', esc((r.own && r.own.topic) || 'My own recording'));
    row('Skill focus', esc(skillName(r.skill)));
    row('Notes', r.notesMode === 'type' ? 'Typed' : 'On paper' + (r.photoCount ? ' (' + r.photoCount + ' photo' + (r.photoCount > 1 ? 's' : '') + ')' : ''));
    if (r.kind === 'lecture') {
      row('Listens', esc(r.listens + (r.listens >= 2 ? ' (used the optional second listen)' : '') + ' · speed ' + r.speed + '×'));
      row('I expected', esc(r.expect));
      row('Guess vs check', esc(r.predicted + '/' + r.total + ' guessed · ' + fmtNum(r.actual) + '/' + r.total + ' found (' + r.got + ' got it, ' + r.partly + ' partly, ' + r.missed + ' missed)'));
      row('Main ideas', esc(fmtNum(r.main) + '/' + r.mainT));
      row('Details', esc(fmtNum(r.det) + '/' + r.detT));
      row('Organised', esc(RATE_LABEL[r.organised] || '—'));
      row('Symbols', esc(RATE_LABEL[r.abbrev] || '—'));
      if (r.qT) row('Questions', esc(r.q + '/' + r.qT + ' answered from notes'));
    } else if (r.own) {
      row('I expected', esc(r.own.expect));
      RUBRIC.forEach(function (q) { row(q[1].replace(/\.$/, ''), esc(RATE_LABEL[r.own.ratings[q[0]]] || '—')); });
    }
    row('Next time', esc(r.reflection));
    row('My goal', '<b>' + esc(r.goal) + '</b>');

    var html = band('Session summary', esc(r.kind === 'lecture' ? r.title : 'My own recording')) +
      '<div class="wrap section stack" id="summary">' +
      (opts.justSaved ? (opts.saved ? '<p class="notice">Saved on this device. Your goal will be shown next time.</p>' : '<p class="notice warn">This browser did not let the app save. Copy or print your summary now if you want to keep it.</p>') : '') +
      (opts.justSaved && opts.photosSaved === false ? '<p class="notice warn">Your photos could not be saved on this device. They are shown below until you close the page, so print now if you need them.</p>' : '') +
      '<div class="card"><dl class="kv">' + rows.join('') + '</dl></div>' +
      (r.own && r.own.summary && r.own.summary.some(function (s) { return s.trim(); })
        ? '<div class="card"><h3>My three-sentence summary</h3><p class="pre" style="margin:0">' + esc(r.own.summary.filter(function (s) { return s.trim(); }).join('\n')) + '</p></div>' : '') +
      (r.notesMode === 'type' ? '<div class="card"><h3>My notes</h3><div class="notesview pre">' + (r.notes.trim() ? esc(r.notes) : '<span class="muted">No typed notes.</span>') + '</div></div>' : '') +
      '<div id="sumPhotos"></div>' +
      '<div class="btnrow no-print"><button type="button" class="btn" id="copyS">Copy summary</button><button type="button" class="btn" id="printS">Print</button></div>' +
      '<p id="copyMsg" role="status" class="small"></p>' +
      '<div class="btnrow no-print"><button type="button" class="btn big" id="newS">Start a new session</button><a class="btn light" href="#progress" id="toProg">My progress</a></div>' +
      '</div>';
    render(html);
    var urls = opts.urls;
    function showPhotos(list) {
      if (!list || !list.length) return;
      $('#sumPhotos').innerHTML = '<div class="card"><h3>Photos of my notes</h3><div class="photos">' + list.map(function (u, i) {
        return '<button type="button" data-zu="' + i + '" aria-label="Photo ' + (i + 1) + ' of my notes. Tap to zoom."><img src="' + u + '" alt="Photo ' + (i + 1) + ' of my notes"></button>';
      }).join('') + '</div></div>';
      $$('[data-zu]', app).forEach(function (b) { b.addEventListener('click', function () { openZoom(list[Number(b.dataset.zu)]); }); });
    }
    if (urls && urls.length) showPhotos(urls);
    else if (r.photoCount) {
      Photos.get(r.id).then(function (blobs) {
        if (blobs && blobs.length) showPhotos(blobs.map(function (b) { return URL.createObjectURL(b); }));
        else $('#sumPhotos').innerHTML = '<p class="small muted">The photos for this session are no longer on this device.</p>';
      });
    }
    $('#copyS').addEventListener('click', function () {
      copyText(summaryText(r)).then(function (ok) { $('#copyMsg').textContent = ok ? 'Copied. You can paste it into an email or document.' : 'Sorry, copying did not work in this browser.'; });
    });
    $('#printS').addEventListener('click', function () { window.print(); });
    $('#newS').addEventListener('click', goHome);
    $('#toProg').addEventListener('click', function (e) {
      if (location.hash === '#progress') { e.preventDefault(); progressScreen(); }
    });
  }

  function copyText(t) {
    return new Promise(function (res) {
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = document.execCommand('copy'); ta.remove(); res(ok);
        } catch (e) { res(false); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { res(true); }, fallback);
      else fallback();
    });
  }

  /* ---------------- 11. PROGRESS ---------------- */
  function progressScreen(msg) {
    S = null; setGuard(false);
    var d = Store.load();
    var list = d.sessions.slice().reverse();
    render(band('My progress', 'Your practice history on this device.') +
      '<div class="wrap section stack">' +
      (msg ? '<p class="notice" role="status">' + esc(msg) + '</p>' : '') +
      (!Store.ok ? '<p class="notice warn">This browser is not letting the app save, so your history may be empty.</p>' : '') +
      (d.lastGoal ? '<div class="goalbox"><span class="label">My current goal</span>' + esc(d.lastGoal) + '</div>' : '') +
      (list.length ? '<p class="label" style="margin-top:20px">' + list.length + ' session' + (list.length > 1 ? 's' : '') + '</p><ul class="hist">' + list.map(function (r) {
        var line = r.kind === 'lecture'
          ? 'Guess ' + r.predicted + '/' + r.total + ' · check ' + fmtNum(r.actual) + '/' + r.total + ' · main ideas ' + fmtNum(r.main) + '/' + r.mainT + (r.qT ? ' · questions ' + r.q + '/' + r.qT : '')
          : 'Own recording · self-rated';
        return '<li class="card flat"><div><b>' + esc(r.kind === 'lecture' ? r.title : ((r.own && r.own.topic) || 'My own recording')) + '</b><br>' +
          '<span class="small mono muted">' + esc(fmtDate(r.date)) + ' · ' + esc(skillName(r.skill)) + '</span><br><span class="small">' + esc(line) + '</span>' +
          (r.goal ? '<br><span class="small">Goal: ' + esc(r.goal) + '</span>' : '') + '</div>' +
          '<button type="button" class="btn sm light no-print" data-view="' + esc(r.id) + '">View<span class="sr"> session from ' + esc(fmtDate(r.date)) + '</span></button></li>';
      }).join('') + '</ul>'
        : '<div class="card"><p style="margin:0">No sessions yet. Finish a session and it will appear here.</p></div>') +
      '<div class="btnrow no-print" style="margin-top:20px">' +
      (list.length ? '<button type="button" class="btn" id="copyAll">Copy summary</button><button type="button" class="btn" id="printAll">Print</button>' : '') +
      '<button type="button" class="btn dark" id="clearAll">Clear my data</button></div>' +
      '<p id="copyMsg" role="status" class="small"></p>' +
      '<p class="small muted">Everything here is saved only in this browser, on this device. Nobody else can see it. If you clear your browser data, it will be deleted.</p>' +
      '<div class="btnrow no-print"><button type="button" class="btn big" id="newS">Start a new session</button></div>' +
      '</div>');
    $$('[data-view]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = d.sessions.filter(function (x) { return x.id === b.dataset.view; })[0];
        if (r) summaryScreen(r);
      });
    });
    var ca = $('#copyAll');
    if (ca) ca.addEventListener('click', function () {
      var txt = (d.lastGoal ? 'My current goal: ' + d.lastGoal + '\n\n' : '') + list.map(summaryText).join('\n\n----------\n\n');
      copyText(txt).then(function (ok) { $('#copyMsg').textContent = ok ? 'Copied all sessions.' : 'Sorry, copying did not work in this browser.'; });
    });
    var pa = $('#printAll'); if (pa) pa.addEventListener('click', function () { window.print(); });
    $('#clearAll').addEventListener('click', function () {
      if (!window.confirm('Delete all your sessions, notes, goals and photos from this device? This cannot be undone.')) return;
      Store.clear();
      Photos.clear().then(function () { progressScreen('All your data has been deleted from this device.'); });
    });
    $('#newS').addEventListener('click', goHome);
  }

  /* ---------------- routing ---------------- */
  function goHome() {
    if (location.hash) { try { history.pushState('', document.title, location.pathname + location.search); } catch (e) { location.hash = ''; } }
    homeScreen();
  }
  function route() {
    if (location.hash === '#progress') progressScreen();
    else homeScreen();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#progress"]');
    if (!a) return;
    if (sessionActive() && !window.confirm('Leave this practice session? Your notes from this session will not be saved.')) { e.preventDefault(); return; }
    if (location.hash === '#progress') { e.preventDefault(); progressScreen(); }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', function () { if (!location.hash && !sessionActive()) homeScreen(); });

  Store.load();
  if (Speech.supported) Speech.init();
  loadLectures().then(route);
})();
