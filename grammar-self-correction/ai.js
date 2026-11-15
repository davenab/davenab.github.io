/* Grammar Self-Correction Trainer: Mode 2 ("My own writing") connector.
   ----------------------------------------------------------------------
   Mode 1 (practice texts) never uses this file's network code.
   Mode 2 is OFF while GSC_CONFIG.aiEnabled is false (see config.js).

   THE ONE FUNCTION TO CONNECT:  GSC_AI.requestFeedback(text, codes)

   It sends the student's paragraph to YOUR server-side proxy
   (GSC_CONFIG.aiProxyUrl). The proxy holds the API key and calls the AI
   service. The browser never sees a key. Do not put a key in this file.

   Request the browser sends (POST, JSON):
     { "text": "<the student's paragraph, max 150 words>",
       "codes": ["VT","VF","SVA", ...] }          // the allowed codes

   Response the proxy MUST return (JSON):
     { "errors": [
         { "start": 12,                 // character position where the error starts (0 = first character)
           "end": 17,                   // character position just after the error
           "code": "VT",                // one of the allowed codes
           "ruleReminder": "Use the past simple for finished past time.",   // short, max 200 characters
           "suggestion": "went",        // OPTIONAL: a fix for THIS span only. Shown only after the student tries.
           "explanation": "Last week is finished time." // OPTIONAL, short
         }
     ] }

   Rules the proxy should give the AI (and this file also enforces):
     - Mark errors only. Do NOT return a rewritten or corrected paragraph.
     - Each error is one span; spans must not overlap.
     - text.slice(start, end) must be the exact wrong words.
   Any other fields (for example "corrected" or "rewrite") are ignored.
*/
(function () {
  var MAX_RULE = 200, MAX_SUGGESTION = 80;

  function validate(text, data, allowedCodes) {
    if (!data || !Array.isArray(data.errors)) throw new Error("bad-format");
    var out = [], lastEnd = -1;
    var list = data.errors.slice().sort(function (a, b) { return a.start - b.start; });
    list.forEach(function (e) {
      if (typeof e.start !== "number" || typeof e.end !== "number") return;
      if (e.start < 0 || e.end > text.length || e.end <= e.start) return;
      if (e.start < lastEnd) return;                      // overlapping: skip
      if (allowedCodes.indexOf(e.code) === -1) return;    // unknown code: skip
      var sug = typeof e.suggestion === "string" ? e.suggestion.slice(0, MAX_SUGGESTION) : "";
      out.push({
        start: e.start, end: e.end, wrong: text.slice(e.start, e.end), code: e.code,
        ruleReminder: String(e.ruleReminder || "").slice(0, MAX_RULE),
        acceptedAnswers: sug ? [sug] : [],
        explanation: String(e.explanation || "").slice(0, MAX_RULE)
      });
      lastEnd = e.end;
    });
    return out;   // only these fields are kept: no full rewrite can reach the page
  }

  // >>> CONNECT HERE <<<  This is the only function that talks to an AI service.
  function requestFeedback(text, allowedCodes) {
    var cfg = window.GSC_CONFIG || {};
    if (!cfg.aiEnabled || !cfg.aiProxyUrl) return Promise.reject(new Error("ai-off"));
    return fetch(cfg.aiProxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, codes: allowedCodes }),
      credentials: "omit",
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.json();
    }).then(function (data) { return validate(text, data, allowedCodes); });
  }

  // Sample data for the teacher preview (?preview=1). Not real feedback.
  var SAMPLE_TEXT = "Many students thinks that group work is a waste of time. In my last course, our group have to write a report together, but two members did not came to any meetings. However I learned that good planning makes group work more easier. Now I always share a timeline at first meeting.";
  function find(w, from) { return SAMPLE_TEXT.indexOf(w, from || 0); }
  function span(w, code, rule, sug, expl, from) {
    var s = find(w, from); return { start: s, end: s + w.length, code: code, ruleReminder: rule, suggestion: sug, explanation: expl };
  }
  var SAMPLE = {
    text: SAMPLE_TEXT,
    errors: [
      span("thinks", "SVA", "A plural subject takes a plural verb.", "think", "Students is plural, so the verb has no -s."),
      span("have to", "VT", "Use the past simple for a finished time (in my last course).", "had to", "In my last course is finished time."),
      span("did not came", "VF", "After did or did not, use the base verb.", "did not come", "Did already shows past, so the main verb is the base form."),
      span("However", "P", "Put a comma after However at the start of a sentence.", "However,", "However is a linking word here."),
      span("more easier", "X", "Do not use more with an -er adjective.", "easier", "Easier already means more easy."),
      span("at first meeting", "Art", "Use the before a specific, known noun.", "at the first meeting", "The first meeting is a specific meeting.")
    ]
  };

  window.GSC_AI = { requestFeedback: requestFeedback, validate: validate, SAMPLE: SAMPLE };
})();
